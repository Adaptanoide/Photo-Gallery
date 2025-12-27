// src/services/CatalogSyncService.js
// =====================================================
// CATALOG SYNC SERVICE - Sincronização de Estoque Lógico
// =====================================================
// Este serviço calcula e mantém o estoque lógico atualizado:
// availableStock = physicalStock - reservedInCarts - confirmedInSelections

const CatalogProduct = require('../models/CatalogProduct');
const Cart = require('../models/Cart');
const Selection = require('../models/Selection');
const CDEQueries = require('../ai/CDEQueries');

class CatalogSyncService {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        this.cdeQueries = new CDEQueries();
    }

    static instance = null;

    static getInstance() {
        if (!CatalogSyncService.instance) {
            CatalogSyncService.instance = new CatalogSyncService();
        }
        return CatalogSyncService.instance;
    }

    /**
     * START PERIODIC SYNC
     * Sincroniza estoque a cada X minutos
     * Em produção, também sincroniza estoque físico do CDE a cada 30 minutos
     */
    startPeriodicSync(intervalMinutes = 5) {
        if (this.isRunning) {
            console.log('[CATALOG-SYNC] Sincronização já está em execução');
            return;
        }

        this.isRunning = true;
        const isProduction = process.env.NODE_ENV === 'production';

        console.log(`[CATALOG-SYNC] Sincronização periódica iniciada (a cada ${intervalMinutes} minutos)`);
        console.log(`[CATALOG-SYNC] Ambiente: ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);

        // Executar imediatamente na primeira vez
        this.syncAllCatalogStock().catch(err => {
            console.error('[CATALOG-SYNC] Erro na sincronização inicial:', err.message);
        });

        // Configurar intervalo para estoque lógico
        this.intervalId = setInterval(async () => {
            try {
                await this.syncAllCatalogStock();
            } catch (error) {
                console.error('[CATALOG-SYNC] Erro na sincronização periódica:', error.message);
            }
        }, intervalMinutes * 60 * 1000);

        // ===== SYNC FÍSICO DO CDE - APENAS EM PRODUÇÃO =====
        // Em produção, sincroniza estoque físico do CDE a cada 30 minutos
        // Isso garante que o MongoDB tenha dados atualizados do CDE
        if (isProduction) {
            console.log('[CATALOG-SYNC] 🔄 Sync físico CDE ativado (a cada 30 minutos)');

            // Aguardar 2 minutos antes da primeira sync física (dar tempo ao servidor)
            setTimeout(() => {
                this.syncPhysicalStockFromCDE().catch(err => {
                    console.error('[CATALOG-SYNC] Erro na sync física inicial:', err.message);
                });
            }, 2 * 60 * 1000);

            // Configurar intervalo de 30 minutos para sync física
            this.physicalSyncIntervalId = setInterval(async () => {
                try {
                    await this.syncPhysicalStockFromCDE();
                } catch (error) {
                    console.error('[CATALOG-SYNC] Erro na sync física periódica:', error.message);
                }
            }, 30 * 60 * 1000); // 30 minutos
        } else {
            console.log('[CATALOG-SYNC] ⏭️ Sync físico CDE desativado (apenas em produção)');
        }
    }

    /**
     * STOP PERIODIC SYNC
     */
    stopPeriodicSync() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.physicalSyncIntervalId) {
            clearInterval(this.physicalSyncIntervalId);
            this.physicalSyncIntervalId = null;
        }
        this.isRunning = false;
        console.log('[CATALOG-SYNC] Sincronização parada');
    }

    /**
     * SYNC ALL CATALOG STOCK
     * Sincroniza o estoque lógico de todos os produtos de catálogo
     */
    async syncAllCatalogStock() {
        const startTime = Date.now();
        console.log('[CATALOG-SYNC] Iniciando sincronização de estoque lógico...');

        try {
            // 1. Buscar todos os produtos de catálogo ativos
            const catalogProducts = await CatalogProduct.find({ isActive: true });

            if (catalogProducts.length === 0) {
                console.log('[CATALOG-SYNC] Nenhum produto de catálogo encontrado');
                return { success: true, updated: 0 };
            }

            console.log(`[CATALOG-SYNC] Sincronizando ${catalogProducts.length} produtos...`);

            // 2. Calcular reservas em carrinhos ativos
            const cartReservations = await this.getCartReservations();

            // 3. Calcular confirmados em seleções
            const selectionConfirmations = await this.getSelectionConfirmations();

            // 4. Atualizar cada produto
            let updatedCount = 0;
            for (const product of catalogProducts) {
                const qbItem = product.qbItem;

                const reservedInCarts = cartReservations[qbItem] || 0;
                const confirmedInSelections = selectionConfirmations[qbItem] || 0;

                // Recalcular estoque disponível
                const oldAvailable = product.availableStock;
                product.reservedInCarts = reservedInCarts;
                product.confirmedInSelections = confirmedInSelections;
                product.recalculateAvailableStock();

                // Só salvar se houve mudança
                if (oldAvailable !== product.availableStock ||
                    product.reservedInCarts !== reservedInCarts ||
                    product.confirmedInSelections !== confirmedInSelections) {

                    await product.save();
                    updatedCount++;

                    console.log(`[CATALOG-SYNC] ${qbItem}: ` +
                        `physical=${product.currentStock} - ` +
                        `carts=${reservedInCarts} - ` +
                        `selections=${confirmedInSelections} = ` +
                        `available=${product.availableStock}`);
                }
            }

            const elapsed = Date.now() - startTime;
            console.log(`[CATALOG-SYNC] Sincronização concluída em ${elapsed}ms - ${updatedCount} produtos atualizados`);

            return {
                success: true,
                updated: updatedCount,
                total: catalogProducts.length,
                elapsed
            };

        } catch (error) {
            console.error('[CATALOG-SYNC] Erro na sincronização:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * GET CART RESERVATIONS
     * Calcula quantos de cada qbItem estão reservados em carrinhos ativos
     */
    async getCartReservations() {
        try {
            // Agregar por qbItem em todos os carrinhos ativos
            const result = await Cart.aggregate([
                // Só carrinhos ativos
                { $match: { isActive: true } },
                // Expandir items
                { $unwind: '$items' },
                // Filtrar apenas produtos de catálogo
                { $match: { 'items.isCatalogProduct': true } },
                // Agrupar por qbItem e somar quantidades
                {
                    $group: {
                        _id: '$items.qbItem',
                        totalReserved: { $sum: '$items.quantity' }
                    }
                }
            ]);

            // Converter para objeto { qbItem: quantity }
            const reservations = {};
            result.forEach(item => {
                if (item._id) {
                    reservations[item._id] = item.totalReserved;
                }
            });

            console.log(`[CATALOG-SYNC] Reservas em carrinhos:`, Object.keys(reservations).length, 'produtos');

            return reservations;

        } catch (error) {
            console.error('[CATALOG-SYNC] Erro ao buscar reservas em carrinhos:', error.message);
            return {};
        }
    }

    /**
     * GET SELECTION CONFIRMATIONS
     * Calcula quantos de cada qbItem estão confirmados em seleções (não finalizadas)
     */
    async getSelectionConfirmations() {
        try {
            // Agregar por qbItem em todas as seleções ativas (confirmed, pending)
            const result = await Selection.aggregate([
                // Seleções que ainda não foram finalizadas/retiradas
                {
                    $match: {
                        status: { $in: ['pending', 'confirmed', 'submitted', 'approved'] }
                    }
                },
                // Expandir photos
                { $unwind: '$photos' },
                // Filtrar apenas produtos de catálogo
                { $match: { 'photos.isCatalogProduct': true } },
                // Agrupar por qbItem e somar quantidades
                {
                    $group: {
                        _id: '$photos.qbItem',
                        totalConfirmed: { $sum: '$photos.quantity' }
                    }
                }
            ]);

            // Converter para objeto { qbItem: quantity }
            const confirmations = {};
            result.forEach(item => {
                if (item._id) {
                    confirmations[item._id] = item.totalConfirmed;
                }
            });

            console.log(`[CATALOG-SYNC] Confirmados em seleções:`, Object.keys(confirmations).length, 'produtos');

            return confirmations;

        } catch (error) {
            console.error('[CATALOG-SYNC] Erro ao buscar confirmações em seleções:', error.message);
            return {};
        }
    }

    /**
     * SYNC PHYSICAL STOCK FROM CDE
     * Sincroniza o estoque físico do CDE para o MongoDB
     * Deve ser chamado separadamente (menos frequente)
     */
    async syncPhysicalStockFromCDE() {
        console.log('[CATALOG-SYNC] Sincronizando estoque físico do CDE...');

        try {
            // Buscar todos os qbItems únicos de produtos de catálogo
            const catalogProducts = await CatalogProduct.find({ isActive: true });

            let updatedCount = 0;
            for (const product of catalogProducts) {
                try {
                    // Buscar estoque atual no CDE
                    const stockInfo = await this.cdeQueries.getCatalogProductStock(product.qbItem);

                    if (stockInfo && stockInfo.available !== undefined) {
                        const oldStock = product.currentStock;

                        if (oldStock !== stockInfo.available) {
                            product.currentStock = stockInfo.available;
                            product.lastCDESync = new Date();
                            product.recalculateAvailableStock();
                            await product.save();
                            updatedCount++;

                            console.log(`[CATALOG-SYNC] ${product.qbItem}: CDE stock ${oldStock} -> ${stockInfo.available}`);
                        }
                    }
                } catch (itemError) {
                    console.warn(`[CATALOG-SYNC] Erro ao sincronizar ${product.qbItem}:`, itemError.message);
                }
            }

            console.log(`[CATALOG-SYNC] Estoque físico: ${updatedCount} produtos atualizados`);

            return { success: true, updated: updatedCount };

        } catch (error) {
            console.error('[CATALOG-SYNC] Erro ao sincronizar estoque físico:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * SYNC SINGLE PRODUCT
     * Sincroniza o estoque lógico de um único produto
     * Útil após operações de carrinho
     */
    async syncSingleProduct(qbItem) {
        try {
            const product = await CatalogProduct.findOne({ qbItem });
            if (!product) {
                console.log(`[CATALOG-SYNC] Produto ${qbItem} não encontrado`);
                return null;
            }

            // Contar reservas deste produto em carrinhos
            const cartResult = await Cart.aggregate([
                { $match: { isActive: true } },
                { $unwind: '$items' },
                {
                    $match: {
                        'items.isCatalogProduct': true,
                        'items.qbItem': qbItem
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalReserved: { $sum: '$items.quantity' }
                    }
                }
            ]);

            const reservedInCarts = cartResult[0]?.totalReserved || 0;

            // Contar confirmados deste produto em seleções
            const selectionResult = await Selection.aggregate([
                {
                    $match: {
                        status: { $in: ['pending', 'confirmed', 'submitted', 'approved'] }
                    }
                },
                { $unwind: '$photos' },
                {
                    $match: {
                        'photos.isCatalogProduct': true,
                        'photos.qbItem': qbItem
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalConfirmed: { $sum: '$photos.quantity' }
                    }
                }
            ]);

            const confirmedInSelections = selectionResult[0]?.totalConfirmed || 0;

            // Atualizar produto
            product.reservedInCarts = reservedInCarts;
            product.confirmedInSelections = confirmedInSelections;
            product.recalculateAvailableStock();
            await product.save();

            console.log(`[CATALOG-SYNC] ${qbItem}: ` +
                `physical=${product.currentStock} - ` +
                `carts=${reservedInCarts} - ` +
                `selections=${confirmedInSelections} = ` +
                `available=${product.availableStock}`);

            return product;

        } catch (error) {
            console.error(`[CATALOG-SYNC] Erro ao sincronizar ${qbItem}:`, error.message);
            return null;
        }
    }

    /**
     * GET STOCK STATUS
     * Retorna o status do estoque de um produto
     */
    async getStockStatus(qbItem) {
        try {
            const product = await CatalogProduct.findOne({ qbItem });
            if (!product) return null;

            return {
                qbItem: product.qbItem,
                name: product.name,
                physicalStock: product.currentStock,
                reservedInCarts: product.reservedInCarts,
                confirmedInSelections: product.confirmedInSelections,
                availableStock: product.availableStock,
                lastSync: product.lastLogicalSync,
                lastCDESync: product.lastCDESync
            };

        } catch (error) {
            console.error(`[CATALOG-SYNC] Erro ao buscar status:`, error.message);
            return null;
        }
    }

    /**
     * FORCE RECALCULATE ALL
     * Força o recálculo de todos os estoques
     */
    async forceRecalculateAll() {
        console.log('[CATALOG-SYNC] Forçando recálculo de todos os produtos...');

        // Primeiro sincronizar do CDE
        await this.syncPhysicalStockFromCDE();

        // Depois recalcular lógico
        return await this.syncAllCatalogStock();
    }
}

module.exports = CatalogSyncService;
