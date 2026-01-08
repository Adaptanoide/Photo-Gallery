// src/services/CartService.js
// ✅ VERSÃO ATUALIZADA - Busca Sales Rep e passa para CDEWriter
// MODIFICAÇÃO PRINCIPAL: Linha ~65 - Buscar AccessCode para obter salesRep

const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
const Cart = require('../models/Cart');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const AccessCode = require('../models/AccessCode');
const CDEWriter = require('./CDEWriter');

class CartService {
    static MAX_ITEMS_PER_CART = 100;

    /**
     * Obter conexão MySQL do CDE
     */
    static async getCDEConnection() {
        return await mysql.createConnection({
            host: process.env.CDE_HOST,
            port: process.env.CDE_PORT,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });
    }

    /**
     * Extrair número da foto
     */
    static extractPhotoNumber(fileName) {
        if (!fileName) return null;
        const cleaned = fileName.replace('.webp', '').replace('.jpg', '').replace('.png', '');
        const numbers = cleaned.match(/\d+/);
        return numbers ? numbers[0].padStart(5, '0') : null;
    }

    static async addToCart(sessionId, clientCode, clientName, driveFileId, itemData = {}) {
        const CDEWriter = require('./CDEWriter');

        try {
            console.log(`[CART] Adicionando ${driveFileId} ao carrinho ${clientCode} - VERSÃO SIMPLIFICADA`);

            // Extrair número da foto UMA ÚNICA VEZ
            const photoNumber = itemData.fileName?.match(/(\d+)/)?.[1] || 'unknown';

            // 🆕 BUSCAR ACCESSCODE UMA ÚNICA VEZ E PEGAR TUDO
            console.log(`[CART] 🔍 Buscando configurações do cliente ${clientCode}...`);
            const accessCode = await AccessCode.findOne({ code: clientCode });
            const salesRep = accessCode?.salesRep || 'Unassigned';
            const ttlHours = accessCode?.cartSettings?.ttlHours || 24; // 🆕 JÁ PEGA AQUI!
            console.log(`[CART] 👤 Sales Rep: ${salesRep} | TTL: ${ttlHours}h`);

            // 1. Buscar ou criar produto
            let product = await UnifiedProductComplete.findOne({ driveFileId });

            // ✅ NOVO: Detectar se é Coming Soon
            const isComingSoon = product?.transitStatus === 'coming_soon';
            const cdeTable = product?.cdeTable || 'tbinventario';
            console.log(`[CART] 📦 Tipo: ${isComingSoon ? 'COMING SOON' : 'AVAILABLE'} | Tabela: ${cdeTable}`);

            if (!product) {
                product = new UnifiedProductComplete({
                    idhCode: `TEMP_${Date.now()}`,
                    photoNumber: photoNumber,
                    photoId: driveFileId,
                    driveFileId: driveFileId,
                    fileName: itemData.fileName || 'Produto',
                    category: itemData.category || 'Categoria',
                    status: 'available',
                    thumbnailUrl: itemData.thumbnailUrl || null
                });
                await product.save();
            }

            // 2. Verificar disponibilidade
            if (product.status !== 'available') {
                if (product.reservedBy?.clientCode !== clientCode) {
                    throw new Error('Produto não disponível');
                }
            }

            // 3. Buscar ou criar carrinho
            let cart = await Cart.findOne({ sessionId }) ||
                await Cart.findOne({ clientCode, isActive: true });

            let isNewCart = false;
            if (!cart) {
                // Carrinho novo - criar e salvar para ter _id
                cart = new Cart({
                    sessionId,
                    clientCode,
                    clientName,
                    items: [],
                    isActive: true
                });
                await cart.save();
                isNewCart = true;
                console.log(`[CART] 🆕 Novo carrinho criado para ${clientCode}`);
            }

            // 4. 🆕 VERIFICAÇÃO DE DUPLICATA ROBUSTA (3 formas)
            const checkDuplicate = (items) => items.some(item =>
                item.driveFileId === driveFileId ||
                item.fileName === product.fileName ||
                (photoNumber && photoNumber !== 'unknown' && item.fileName?.includes(photoNumber))
            );

            if (checkDuplicate(cart.items)) {
                console.log(`[CART] ✅ Duplicata ignorada (check 1): ${product.fileName}`);

                // Retorna sucesso (não é erro para o cliente)
                const validItems = cart.items.filter(i => !i.ghostStatus || i.ghostStatus !== 'ghost');
                return {
                    success: true,
                    message: 'Item já está no carrinho',
                    isDuplicate: true,
                    cart: {
                        totalItems: validItems.length,
                        items: cart.items,
                        isEmpty: validItems.length === 0
                    }
                };
            }

            // 🆕 VERIFICAÇÃO EXTRA: Checar se produto já está reservado para OUTRO cliente
            if (product.status === 'reserved' && product.reservedBy?.clientCode && product.reservedBy.clientCode !== clientCode) {
                console.log(`[CART] ⚠️ Produto reservado para outro cliente: ${product.reservedBy.clientCode}`);
                throw new Error('Este produto já está reservado por outro cliente');
            }

            // 5. 🆕 DEFINIR EXPIRAÇÃO (Coming Soon = null)
            const expiresAt = isComingSoon ? null : new Date(Date.now() + (ttlHours * 60 * 60 * 1000));
            console.log(`[CART] Expiração: ${expiresAt ? expiresAt.toISOString() : 'SEM EXPIRAÇÃO (Coming Soon)'}`);

            // 6. Preparar novo item
            const newItem = {
                productId: product._id,
                driveFileId: product.driveFileId,
                fileName: product.fileName,
                category: (itemData.category || product.category || '').replace(/\//g, ' → '),
                thumbnailUrl: itemData.thumbnailUrl || product.thumbnailUrl || `https://images.sunshinecowhides-gallery.com/_thumbnails/${product.driveFileId}`,
                pathLevels: itemData.pathLevels || [],
                fullPath: itemData.fullPath || '',
                folderId: itemData.folderId || '',  // ✅ NOVO: ID da pasta para rate rules
                price: itemData.price || 0,
                basePrice: itemData.basePrice || 0,
                expiresAt,
                addedAt: new Date(),
                // ✅ NOVO: Campos Coming Soon
                transitStatus: product.transitStatus === 'coming_soon' ? 'coming_soon' : null,
                cdeTable: cdeTable,
                isComingSoon: isComingSoon,
            };

            // 🆕 USAR OPERAÇÃO ATÔMICA para adicionar item (evita race condition)
            // Isso garante que se outro request adicionar o mesmo item primeiro, não duplica
            // ⚠️ IMPORTANTE: $inc totalItems porque findOneAndUpdate NÃO dispara middleware pre('save')
            const updateResult = await Cart.findOneAndUpdate(
                {
                    _id: cart._id,
                    'items.driveFileId': { $ne: driveFileId } // Só adiciona se NÃO existe
                },
                {
                    $push: { items: newItem },
                    $inc: { totalItems: 1 },  // 🆕 Incrementar contador manualmente!
                    $set: { lastActivity: new Date() }
                },
                { new: true }
            );

            // Se updateResult é null, significa que o item já existe (race condition evitada!)
            if (!updateResult) {
                // Re-buscar carrinho atualizado para retornar dados corretos
                const currentCart = await Cart.findById(cart._id);
                console.log(`[CART] ✅ Duplicata evitada (operação atômica): ${product.fileName}`);

                const validItems = currentCart.items.filter(i => !i.ghostStatus || i.ghostStatus !== 'ghost');
                return {
                    success: true,
                    message: 'Item já está no carrinho',
                    isDuplicate: true,
                    cart: {
                        totalItems: validItems.length,
                        items: currentCart.items,
                        isEmpty: validItems.length === 0
                    }
                };
            }

            // Atualizar referência do cart com o resultado atualizado
            cart = updateResult;
            console.log(`[CART] Carrinho salvo (atômico) - ${cart.items.length} items`);

            // 7. Marcar produto como reservado
            product.status = 'reserved';
            product.cdeStatus = 'PRE-SELECTED';
            product.reservedBy = {
                clientCode,
                sessionId,
                expiresAt
            };
            await product.save();
            console.log(`[CART] Produto reservado`);

            // 8. 🆕 Atualizar CDE EM BACKGROUND COM SALES REP
            if (photoNumber) {
                console.log(`[CART] 🎯 Vai reservar foto ${photoNumber} em ${cdeTable}`);  // ← ADICIONAR
                // 🚀 EXECUÇÃO ASSÍNCRONA - NÃO ESPERA RESPOSTA!
                CDEWriter.markAsReserved(photoNumber, clientCode, clientName, salesRep, cdeTable)
                    .then(() => {
                        console.log(`[CDE] ✅ Foto ${photoNumber} reservada em background para ${clientName}(${salesRep})`);
                    })
                    .catch(cdeError => {
                        console.error(`[CDE] ⚠️ Erro em background: ${cdeError.message}`);
                        // Sync vai corrigir depois
                    });

                console.log(`[CART] CDE será atualizado em background com Sales Rep: ${salesRep}`);
            }

            // 9. ✅ RETORNAR CART DIRETO para que calculateCartTotals possa atualizar os preços tier
            return {
                success: true,
                message: 'Item adicionado ao carrinho',
                cart: cart,  // ✅ Retorna o documento Mongoose direto para ser modificado por calculateCartTotals
                expiresAt,
                timeRemaining: ttlHours * 3600
            };

        } catch (error) {
            console.error(`[CART] Erro: ${error.message}`);
            throw error;
        }
    }

    static async removeFromCart(sessionId, driveFileId, clientCode = null) {
        try {
            console.log(`[CART] Removendo ${driveFileId} - VERSÃO SIMPLIFICADA`);

            // 1. Buscar carrinho COM FALLBACK (igual ao addToCart)
            let cart = await Cart.findOne({ sessionId, isActive: true });

            // 🆕 FALLBACK: Se não encontrou por sessionId, tentar por clientCode
            if (!cart && clientCode) {
                console.log(`[CART] 🔄 Fallback: buscando por clientCode ${clientCode}`);
                cart = await Cart.findOne({ clientCode, isActive: true });
            }

            // 🆕 FALLBACK 2: Buscar qualquer carrinho ativo que contenha o item
            if (!cart) {
                console.log(`[CART] 🔄 Fallback 2: buscando carrinho com o item ${driveFileId}`);
                cart = await Cart.findOne({
                    'items.driveFileId': driveFileId,
                    isActive: true
                });
            }

            if (!cart) throw new Error('Carrinho não encontrado');

            // Encontrar o item específico para verificar se é ghost
            const itemToRemove = cart.items.find(item => item.driveFileId === driveFileId);
            const isGhostItem = itemToRemove && itemToRemove.ghostStatus === 'ghost';

            if (isGhostItem) {
                console.log(`[CART] Item é um ghost - removendo sem alterar CDE`);
            }

            // 2. Remover do carrinho usando operação atômica (evita conflito de versão)
            const updateResult = await Cart.findOneAndUpdate(
                { _id: cart._id },
                {
                    $pull: { items: { driveFileId: driveFileId } },
                    $set: { lastActivity: new Date() }
                },
                { new: true }
            );

            if (!updateResult) {
                throw new Error('Falha ao atualizar carrinho');
            }

            // Atualizar totalItems manualmente (findOneAndUpdate não dispara pre-save)
            const validItems = updateResult.items.filter(i => !i.ghostStatus || i.ghostStatus !== 'ghost');
            await Cart.updateOne(
                { _id: cart._id },
                { $set: { totalItems: validItems.length } }
            );

            cart = updateResult;
            console.log(`[CART] Carrinho atualizado (atômico) - ${cart.items.length} items`);

            // 3. APENAS SE NÃO FOR GHOST: Liberar produto e atualizar CDE
            if (!isGhostItem) {
                // ✅ IMPORTANTE: Verificar se é produto de CATÁLOGO (stock)
                // Produtos de catálogo NÃO existem no tbinventario do CDE
                const isCatalogProduct = itemToRemove?.isCatalogProduct === true;

                if (isCatalogProduct) {
                    // ============================================
                    // PRODUTO DE CATÁLOGO (STOCK) - APENAS LÓGICO
                    // NÃO altera CDE - apenas remove do carrinho MongoDB
                    // O CatalogSyncService recalcula o estoque disponível
                    // ============================================
                    console.log(`[CART] 📦 Produto de catálogo removido: ${itemToRemove.productName || itemToRemove.qbItem}`);
                    console.log(`[CART] 📊 Estoque lógico será recalculado pelo CatalogSyncService`);
                    // NÃO chama CDEWriter - o estoque no CDE permanece inalterado
                } else {
                    // ============================================
                    // FOTO ÚNICA - LIBERAR NO CDE
                    // ============================================
                    // ✅ DETECTAR SE É COMING SOON
                    const isComingSoonItem = itemToRemove?.transitStatus === 'coming_soon';
                    const correctCDEStatus = isComingSoonItem ? 'PRE-TRANSITO' : 'INGRESADO';

                    // Liberar no MongoDB
                    await UnifiedProductComplete.updateOne(
                        { driveFileId },
                        {
                            $set: {
                                status: 'available',
                                cdeStatus: correctCDEStatus
                            },
                            $unset: { reservedBy: 1 }
                        }
                    );
                    console.log(`[CART] Produto liberado com status: ${correctCDEStatus}`);

                    // 🚀 Atualizar CDE EM BACKGROUND (não esperar)
                    const fileName = driveFileId.split('/').pop();
                    const photoNumber = fileName.match(/(\d+)/)?.[1];
                    if (photoNumber) {
                        // ✅ DETECTAR TABELA DO ITEM REMOVIDO
                        const cdeTable = itemToRemove?.cdeTable || 'tbinventario';
                        console.log(`[CART] 🎯 Vai liberar foto ${photoNumber} em ${cdeTable}`);

                        // EXECUÇÃO ASSÍNCRONA - NÃO ESPERA RESPOSTA!
                        CDEWriter.markAsAvailable(photoNumber, cdeTable)
                            .then(() => {
                                console.log(`[CDE] ✅ Foto ${photoNumber} liberada em background de ${cdeTable}`);
                            })
                            .catch(cdeError => {
                                console.error(`[CDE] ⚠️ Erro ao liberar em background: ${cdeError.message}`);
                                // Sync vai corrigir depois
                            });

                        console.log(`[CART] CDE será liberado em background de ${cdeTable}`);
                    }
                }
            } else {
                // Para ghost items, apenas limpar a reserva local sem mudar status
                await UnifiedProductComplete.updateOne(
                    { driveFileId },
                    {
                        $unset: {
                            reservedBy: 1,
                            ghostNotification: 1
                        }
                    }
                );
                console.log(`[CART] Ghost item removido - CDE mantido como ${itemToRemove.ghostReason}`);
            }

            // ✅ RETORNAR CART DIRETO (igual ao addToCart) para que calculateCartTotals possa atualizar
            // Não usar getCartSummary porque os preços tier serão calculados DEPOIS no route
            return {
                success: true,
                message: isGhostItem ? 'Ghost item acknowledged and removed' : 'Item removed',
                cart: cart  // ✅ Retorna o documento Mongoose direto para ser modificado por calculateCartTotals
            };

        } catch (error) {
            console.error(`[CART] Erro: ${error.message}`);
            throw error;
        }
    }

    /**
     * PROCESSAR ITEM EXPIRADO
     * Quando detecta que um item expirou, libera instantaneamente
     * ✅ ATUALIZADO: Suporta produtos de catálogo (stock)
     */
    static async processExpiredItem(item, cart) {
        let cdeConnection = null;

        try {
            // ============================================
            // PRODUTO DE CATÁLOGO (STOCK) - Apenas remove do carrinho
            // O CatalogSyncService recalcula o estoque automaticamente
            // ============================================
            if (item.isCatalogProduct) {
                console.log(`[EXPIRE] 📦 Processando item de catálogo expirado: ${item.productName || item.qbItem}`);

                // Remover do carrinho usando qbItem ou driveFileId
                await Cart.updateOne(
                    { _id: cart._id },
                    {
                        $pull: { items: { qbItem: item.qbItem } },
                        $inc: { totalItems: -1 }
                    }
                );

                // Sincronizar estoque lógico imediatamente
                try {
                    const CatalogSyncService = require('./CatalogSyncService');
                    const syncService = CatalogSyncService.getInstance();
                    await syncService.syncSingleProduct(item.qbItem);
                    console.log(`[EXPIRE] ✅ Estoque de ${item.qbItem} sincronizado após expiração`);
                } catch (syncErr) {
                    console.warn(`[EXPIRE] ⚠️ Erro ao sincronizar estoque:`, syncErr.message);
                }

                console.log(`[EXPIRE] ✅ Item de catálogo ${item.qbItem} liberado por expiração`);
                return true;
            }

            // ============================================
            // FOTO ÚNICA - Atualiza CDE e MongoDB
            // ============================================
            const photoNumber = this.extractPhotoNumber(item.fileName);
            console.log(`[EXPIRE] Processando foto expirada: ${item.fileName}`);

            // 1. ATUALIZAÇÃO INSTANTÂNEA DO CDE
            if (photoNumber) {
                cdeConnection = await this.getCDEConnection();

                await cdeConnection.execute(
                    `UPDATE tbinventario
                     SET AESTADOP = 'INGRESADO',
                         RESERVEDUSU = NULL,
                         AFECHA = NOW()
                     WHERE ATIPOETIQUETA = ?`,
                    [photoNumber]
                );

                console.log(`[CDE] Foto ${photoNumber} liberada por expiração`);
            }

            // 2. Atualizar MongoDB
            await UnifiedProductComplete.updateOne(
                { fileName: item.fileName },
                {
                    $set: {
                        status: 'available',
                        cdeStatus: 'INGRESADO'
                    },
                    $unset: {
                        reservedBy: 1
                    }
                }
            );

            // 3. Remover do carrinho
            await Cart.updateOne(
                { _id: cart._id },
                {
                    $pull: { items: { fileName: item.fileName } },
                    $inc: { totalItems: -1 }
                }
            );

            console.log(`[EXPIRE] ✅ Item ${item.fileName} liberado por expiração`);
            return true;

        } catch (error) {
            console.error(`[EXPIRE] ❌ Erro ao processar expiração:`, error.message);
            return false;
        } finally {
            if (cdeConnection) await cdeConnection.end();
        }
    }

    /**
     * BUSCAR CARRINHO
     * Processa expirações em tempo real ao buscar
     */
    static async getCart(sessionId) {
        try {
            let cart = await Cart.findOne({
                sessionId,
                isActive: true
            });

            if (!cart) {
                // Verificar se existe mas está inativo
                const inactiveCart = await Cart.findOne({ sessionId });

                if (inactiveCart) {
                    // Se tem items mas está inativo, REATIVAR!
                    if (inactiveCart.items && inactiveCart.items.length > 0) {
                        inactiveCart.isActive = true;
                        inactiveCart.notes = undefined;
                        await inactiveCart.save();
                        cart = inactiveCart; // Usar o cart reativado
                    }
                } else {
                    // Debug: mostrar carts ativos
                    const allCarts = await Cart.find({ isActive: true }).limit(5);
                }
            }

            if (!cart) return null;

            // Processar expirações em tempo real
            const now = new Date();
            const expiredItems = cart.items.filter(item =>
                item.expiresAt && new Date(item.expiresAt) < now
            );

            // Liberar itens expirados instantaneamente
            for (const expiredItem of expiredItems) {
                await this.processExpiredItem(expiredItem, cart);
            }

            // Recarregar carrinho atualizado
            return await Cart.findOne({
                sessionId,
                isActive: true
            });

        } catch (error) {
            console.error(`[CART] Erro ao buscar carrinho:`, error);
            throw error;
        }
    }

    /**
 * Limpar duplicatas do carrinho (mantém apenas primeira ocorrência)
 * Retorna: { cleaned: boolean, removedCount: number, uniqueItems: array }
 */
    static cleanDuplicates(items) {
        const seen = new Map(); // fileName -> primeira ocorrência
        const uniqueItems = [];
        let removedCount = 0;

        items.forEach(item => {
            const key = item.fileName;

            if (!seen.has(key)) {
                // Primeira vez vendo esta foto - manter
                seen.set(key, true);
                uniqueItems.push(item);
            } else {
                // Duplicata - contar mas não adicionar
                removedCount++;
                console.log(`[CART-CLEAN] 🧹 Duplicata removida: ${item.fileName}`);
            }
        });

        return {
            cleaned: removedCount > 0,
            removedCount,
            uniqueItems
        };
    }

    static async getCartSummary(sessionId) {
        try {
            const cart = await this.getCart(sessionId);

            if (!cart) {
                return {
                    totalItems: 0,
                    items: [],
                    isEmpty: true
                };
            }

            // 🆕 AUTO-LIMPEZA DE DUPLICATAS
            const cleanResult = this.cleanDuplicates(cart.items);

            if (cleanResult.cleaned) {
                console.log(`[CART-CLEAN] 🧹 ${cleanResult.removedCount} duplicatas removidas do carrinho`);
                // Usar operação atômica para evitar conflito de versão
                await Cart.findOneAndUpdate(
                    { _id: cart._id },
                    {
                        $set: {
                            items: cleanResult.uniqueItems,
                            totalItems: cleanResult.uniqueItems.length,
                            lastActivity: new Date()
                        }
                    }
                );
                cart.items = cleanResult.uniqueItems;
                console.log(`[CART-CLEAN] ✅ Carrinho limpo e salvo - ${cart.items.length} items únicos`);
            }

            // ✅ FILTRAR GHOST ITEMS PARA CONTAGEM
            const validItems = cart.items.filter(item =>
                !item.ghostStatus || item.ghostStatus !== 'ghost'
            );

            return {
                totalItems: validItems.length, // ✅ CORRIGIDO - conta só válidos
                items: cart.items.map(item => ({
                    driveFileId: item.driveFileId,
                    fileName: item.fileName,
                    category: item.category,
                    thumbnailUrl: item.thumbnailUrl,
                    pathLevels: item.pathLevels || [],
                    fullPath: item.fullPath || '',
                    folderId: item.folderId || '',  // ✅ NOVO: ID da pasta para rate rules
                    price: item.price,
                    basePrice: item.basePrice,
                    unitPrice: item.unitPrice,  // ✅ IMPORTANTE: preço unitário para tier pricing
                    expiresAt: item.expiresAt,
                    timeRemaining: item.expiresAt ?
                        Math.max(0, Math.floor((new Date(item.expiresAt) - new Date()) / 1000)) : 0,
                    ghostStatus: item.ghostStatus || null,
                    ghostReason: item.ghostReason || null,
                    ghostedAt: item.ghostedAt || null,
                    hasPrice: item.hasPrice || false,
                    formattedPrice: item.formattedPrice || '',
                    // ✅ CAMPOS PARA PRODUTOS DE CATÁLOGO (TIER PRICING)
                    isCatalogProduct: item.isCatalogProduct || false,
                    catalogCategory: item.catalogCategory || null,
                    qbItem: item.qbItem || null,
                    productName: item.productName || item.fileName,
                    quantity: item.quantity || 1,
                    tierInfo: item.tierInfo || null  // ✅ Info do tier (Bronze/Silver/Gold)
                })),
                isEmpty: validItems.length === 0, // ✅ baseado em items válidos
                lastActivity: cart.lastActivity
            };

        } catch (error) {
            console.error(`[CART] Erro ao buscar resumo:`, error);
            return {
                totalItems: 0,
                items: [],
                isEmpty: true,
                error: error.message
            };
        }
    }

    /**
     * VERIFICAR STATUS NO CDE EM TEMPO REAL
     * Usado para validar antes de operações críticas
     */
    static async checkCDEStatus(photoNumber) {
        let connection = null;

        try {
            connection = await this.getCDEConnection();

            const [rows] = await connection.execute(
                'SELECT AESTADOP, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA = ?',
                [photoNumber]
            );

            return rows[0] || null;

        } catch (error) {
            console.error(`[CDE] Erro ao verificar status:`, error);
            return null;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * MARCAR ITEM COMO GHOST
     * Usado quando o sync detecta conflito com CDE
     */
    static async markItemAsGhost(clientCode, fileName, reason = 'Item reserved by another channel') {
        try {
            console.log(`[GHOST] Marcando ${fileName} como ghost para cliente ${clientCode}`);

            // Usar operação atômica para evitar conflito de versão
            const updateResult = await Cart.findOneAndUpdate(
                {
                    clientCode,
                    isActive: true,
                    'items.fileName': fileName
                },
                {
                    $set: {
                        'items.$.ghostStatus': 'ghost',
                        'items.$.ghostReason': reason,
                        'items.$.ghostedAt': new Date(),
                        'items.$.price': 0,
                        'items.$.hasPrice': false,
                        lastActivity: new Date()
                    }
                },
                { new: true }
            );

            if (!updateResult) {
                console.log(`[GHOST] Carrinho ou item não encontrado para ${clientCode}`);
                return false;
            }

            console.log(`[GHOST] ✔ Item ${fileName} marcado como ghost`);

            // Notificar o frontend através de uma flag especial
            await UnifiedProductComplete.updateOne(
                { fileName },
                {
                    $set: {
                        ghostNotification: {
                            clientCode,
                            timestamp: new Date(),
                            reason
                        }
                    }
                }
            );

            return true;

        } catch (error) {
            console.error(`[GHOST] Erro ao marcar item como ghost:`, error);
            return false;
        }
    }

    /**
     * ESTENDER TEMPO DO CARRINHO
     * Atualização instantânea sem complexidade
     */
    static async extendCartTime(clientCode, hours, extendedBy = 'admin') {
        const mongoSession = await mongoose.startSession();

        try {
            await mongoSession.startTransaction();

            const newExpiration = new Date(Date.now() + (hours * 60 * 60 * 1000));

            // Atualizar carrinho
            const cart = await Cart.findOne({
                clientCode,
                isActive: true
            }).session(mongoSession);

            if (!cart) {
                throw new Error('Carrinho não encontrado');
            }

            // Atualizar todos os itens
            cart.items.forEach(item => {
                item.expiresAt = newExpiration;
            });

            cart.extendedAt = new Date();
            cart.extendedBy = extendedBy;
            await cart.save({ session: mongoSession });

            // Atualizar produtos
            const fileNames = cart.items.map(item => item.fileName);
            await UnifiedProductComplete.updateMany(
                {
                    fileName: { $in: fileNames },
                    'reservedBy.clientCode': clientCode
                },
                {
                    $set: {
                        'reservedBy.expiresAt': newExpiration,
                        extendedAt: new Date(),
                        extendedBy
                    }
                },
                { session: mongoSession }
            );

            await mongoSession.commitTransaction();

            return {
                success: true,
                newExpiration,
                itemsUpdated: cart.items.length
            };

        } catch (error) {
            await mongoSession.abortTransaction();
            throw error;
        } finally {
            await mongoSession.endSession();
        }
    }

    /**
     * ESTATÍSTICAS DO SISTEMA (simples, sem complexidade)
     */
    static async getSystemStats() {
        try {
            const stats = await Promise.all([
                Cart.countDocuments({ isActive: true }),
                UnifiedProductComplete.countDocuments({ status: 'available' }),
                UnifiedProductComplete.countDocuments({ status: 'reserved' }),
                UnifiedProductComplete.countDocuments({ status: 'sold' })
            ]);

            return {
                activeCarts: stats[0],
                availableProducts: stats[1],
                reservedProducts: stats[2],
                soldProducts: stats[3],
                timestamp: new Date()
            };

        } catch (error) {
            console.error(`[STATS] Erro:`, error);
            throw error;
        }
    }

    // ============================================
    // MÉTODOS PARA CATALOG PRODUCTS
    // ============================================

    /**
     * Adicionar produto de catálogo ao carrinho
     * ESTOQUE LÓGICO - NÃO ALTERA CDE
     * Apenas registra no MongoDB, o CatalogSyncService calcula disponibilidade
     */
    static async addCatalogToCart(sessionId, clientCode, clientName, catalogData) {
        try {
            const { qbItem, productName, category, catalogCategory, quantity, unitPrice, thumbnailUrl } = catalogData;

            console.log(`[CART-CATALOG] Adicionando ${quantity}x ${productName} (${qbItem}) ao carrinho de ${clientCode}`);

            // Buscar ou criar carrinho
            let cart = await Cart.findOne({ sessionId }) ||
                await Cart.findOne({ clientCode, isActive: true });

            if (!cart) {
                cart = new Cart({
                    sessionId,
                    clientCode,
                    clientName,
                    items: [],
                    isActive: true
                });
            }

            // Verificar se já existe item deste qbItem no carrinho
            const existingIndex = cart.items.findIndex(item =>
                item.isCatalogProduct && item.qbItem === qbItem
            );

            if (existingIndex >= 0) {
                // Atualizar quantidade existente
                const existing = cart.items[existingIndex];
                existing.quantity = (existing.quantity || 0) + quantity;
                existing.price = existing.unitPrice * existing.quantity;
                console.log(`[CART-CATALOG] Quantidade atualizada para ${existing.quantity}`);
            } else {
                // Adicionar novo item de catálogo
                cart.items.push({
                    productId: new (require('mongoose')).Types.ObjectId(),
                    driveFileId: `catalog_${qbItem}_${Date.now()}`,
                    fileName: productName,
                    category: category,
                    catalogCategory: catalogCategory || null,
                    thumbnailUrl: thumbnailUrl || null,
                    price: unitPrice * quantity,
                    basePrice: unitPrice,
                    addedAt: new Date(),
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
                    // Campos de catálogo (estoque lógico)
                    isCatalogProduct: true,
                    qbItem: qbItem,
                    productName: productName,
                    quantity: quantity,
                    unitPrice: unitPrice
                    // NÃO usa reservedIDHs - estoque é apenas lógico
                });
            }

            await cart.save();
            console.log(`[CART-CATALOG] Carrinho salvo - ${cart.items.length} items`);

            // Retornar dados do carrinho
            const validItems = cart.items.filter(i => !i.ghostStatus || i.ghostStatus !== 'ghost');

            return {
                success: true,
                message: `${quantity}x ${productName} adicionado ao carrinho`,
                cart: {
                    totalItems: validItems.length,
                    totalUnits: cart.getTotalUnits(),
                    items: cart.items,
                    isEmpty: validItems.length === 0
                }
            };

        } catch (error) {
            console.error(`[CART-CATALOG] Erro: ${error.message}`);
            throw error;
        }
    }

    /**
     * Atualizar quantidade de produto de catálogo
     * ESTOQUE LÓGICO - NÃO ALTERA CDE
     * Apenas atualiza MongoDB, o CatalogSyncService recalcula disponibilidade
     */
    static async updateCatalogQuantity(sessionId, qbItem, newQuantity) {
        try {
            console.log(`[CART-CATALOG] Atualizando ${qbItem} para quantidade ${newQuantity}`);

            const cart = await Cart.findOne({ sessionId, isActive: true });
            if (!cart) throw new Error('Carrinho não encontrado');

            const itemIndex = cart.items.findIndex(item =>
                item.isCatalogProduct && item.qbItem === qbItem
            );

            if (itemIndex < 0) {
                throw new Error('Produto não encontrado no carrinho');
            }

            const item = cart.items[itemIndex];
            const currentQuantity = item.quantity || 0;

            if (newQuantity <= 0) {
                // Remover item completamente
                cart.items.splice(itemIndex, 1);
                console.log(`[CART-CATALOG] Item removido do carrinho`);
                console.log(`[CART-CATALOG] 📊 Estoque lógico será recalculado automaticamente`);
            } else if (newQuantity !== currentQuantity) {
                // Atualizando quantidade (aumentando ou reduzindo)
                console.log(`[CART-CATALOG] Alterando de ${currentQuantity} para ${newQuantity}`);
                item.quantity = newQuantity;
                item.price = item.unitPrice * newQuantity;
                console.log(`[CART-CATALOG] 📊 Estoque lógico será recalculado automaticamente`);
            }

            await cart.save();

            const validItems = cart.items.filter(i => !i.ghostStatus || i.ghostStatus !== 'ghost');

            return {
                success: true,
                message: newQuantity <= 0 ? 'Item removido' : `Quantidade atualizada para ${newQuantity}`,
                cart: {
                    totalItems: validItems.length,
                    totalUnits: cart.getTotalUnits(),
                    items: cart.items,
                    isEmpty: validItems.length === 0
                }
            };

        } catch (error) {
            console.error(`[CART-CATALOG] Erro: ${error.message}`);
            throw error;
        }
    }

    /**
     * Remover produto de catálogo do carrinho
     */
    static async removeCatalogFromCart(sessionId, qbItem) {
        return this.updateCatalogQuantity(sessionId, qbItem, 0);
    }
}

module.exports = CartService;