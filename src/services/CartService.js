//src/services/CartService.js

const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const AccessCode = require('../models/AccessCode'); // ADICIONADO
// const Product = require('../models/Product'); // COMENTAR
// const PhotoStatus = require('../models/PhotoStatus'); // COMENTAR
const CDEWriter = require('./CDEWriter');

// Função auxiliar para extrair número da foto de forma segura
function extractPhotoNumber(driveFileId) {
    if (!driveFileId) return null;

    try {
        // Pegar só o nome do arquivo: "08211.webp"
        const fileName = driveFileId.split('/').pop();
        // Remover extensão: "08211"
        const nameWithoutExt = fileName.replace('.webp', '').replace('.jpg', '').replace('.png', '');
        // Extrair apenas números: "08211"
        const numbers = nameWithoutExt.match(/\d+/);

        if (numbers && numbers[0]) {
            // Garantir 5 dígitos com zeros à esquerda
            return numbers[0].padStart(5, '0');
        }
    } catch (error) {
        console.log('[CartService] Erro ao extrair número:', error.message);
    }

    return null;
}

class CartService {

    // ===== CONFIGURAÇÕES =====
    static RESERVATION_DURATION = 24 * 60 * 60 * 1000; // 24 horas em ms
    static MAX_ITEMS_PER_CART = 100; // Limite máximo de itens por carrinho

    // ===== MÉTODOS PRINCIPAIS =====

    /**
     * Adicionar item ao carrinho com reserva
     * @param {string} sessionId - ID da sessão do cliente
     * @param {string} clientCode - Código de acesso do cliente
     * @param {string} clientName - Nome do cliente
     * @param {string} driveFileId - ID do arquivo no Google Drive
     * @param {object} itemData - Dados adicionais do item
     * @returns {object} Resultado da operação
     */
    static async addToCart(sessionId, clientCode, clientName, driveFileId, itemData = {}) {
        const session = await mongoose.startSession();

        try {
            return await session.withTransaction(async () => {
                console.log(`🛒 Tentando adicionar item ${driveFileId} ao carrinho ${sessionId}`);

                // ADICIONADO: Buscar configuração TTL do cliente
                const clientConfig = await AccessCode.findOne({ code: clientCode }).session(session);
                const TTL_HOURS = clientConfig?.cartSettings?.ttlHours || 24;
                const CUSTOM_DURATION = TTL_HOURS * 60 * 60 * 1000;
                console.log(`⏰ TTL para cliente ${clientCode}: ${TTL_HOURS} horas`);

                // 1. Verificar se produto existe, senão criar automaticamente
                let product = await UnifiedProductComplete.findOne({
                    driveFileId
                }).session(session);

                if (!product) {
                    // CRIAR PRODUTO AUTOMATICAMENTE A PARTIR DA FOTO DO GOOGLE DRIVE
                    console.log(`📦 Criando produto automaticamente para foto: ${driveFileId}`);

                    // LINHA ~47-60 - Criar produto automaticamente
                    product = new UnifiedProductComplete({
                        // Campos obrigatórios do novo model
                        idhCode: `TEMP_${Date.now()}`, // Temporário até buscar no CDE
                        photoNumber: extractPhotoNumber(driveFileId) || 'unknown',
                        photoId: driveFileId,

                        // Campos originais do Product
                        driveFileId: driveFileId,
                        fileName: itemData.fileName || 'Produto sem nome',
                        category: itemData.category || 'Categoria',
                        subcategory: null,
                        price: 0,
                        status: 'available',
                        thumbnailUrl: itemData.thumbnailUrl || null,
                        webViewLink: null,
                        size: null,

                        // Campos adicionais necessários
                        currentStatus: 'available',
                        virtualStatus: { status: 'available' }
                    });

                    await product.save({ session });
                    console.log(`✅ Produto criado automaticamente: ${product._id} para foto ${driveFileId}`);
                } else {
                    console.log(`📦 Produto já existe: ${product._id} para foto ${driveFileId}`);
                }

                console.log(`🔍 DEBUG PRODUTO: ${driveFileId} - status: '${product.status}', reservedBy: ${JSON.stringify(product.reservedBy)}`);

                // ✅ LIMPEZA AUTOMÁTICA: Produtos expirados ou órfãos
                if (product.status === 'reserved_pending' && product.reservedBy?.expiresAt) {
                    const now = new Date();
                    const expiresAt = new Date(product.reservedBy.expiresAt);
                    if (now > expiresAt) {
                        console.log(`🧹 PRODUTO EXPIRADO: ${driveFileId} - liberando automaticamente`);
                        product.status = 'available';
                        product.reservedBy = undefined;
                        await product.save({ session });
                    }
                }

                // Verificar se produto está disponível OU já reservado para o mesmo cliente
                if (product.status !== 'available') {
                    // Se já está reservado para o MESMO cliente, permitir continuar
                    if (product.reservedBy && product.reservedBy.clientCode === clientCode) {
                        console.log(`✅ Produto já reservado para cliente ${clientCode} - permitindo trabalhar com reserva existente`);

                        // Verificar se já está no carrinho para evitar duplicação
                        if (cart && cart.hasItem(driveFileId)) {
                            throw new Error('Item já está no carrinho');
                        }

                        // Se não está no carrinho mas está reservado para ele, continuar normalmente
                        // O produto já está reservado, então pular a parte de reservar novamente
                    } else {
                        // Só dar erro se está reservado para OUTRO cliente diferente
                        console.log(`❌ Produto reservado para outro cliente: ${product.reservedBy?.clientCode}`);
                        throw new Error('This item has been reserved by another customer');
                    }
                }

                // 2. Buscar carrinho existente DO CLIENTE primeiro
                let cart = await Cart.findOne({
                    clientCode: clientCode,
                    isActive: true
                }).session(session);

                // Se não tem carrinho ativo do cliente, tentar pelo sessionId
                if (!cart) {
                    cart = await Cart.findOne({ sessionId }).session(session);
                }

                // Se ainda não tem, criar novo
                if (!cart) {
                    // Desativar qualquer carrinho vazio anterior do cliente
                    await Cart.updateMany(
                        {
                            clientCode: clientCode,
                            totalItems: 0,
                            isActive: true
                        },
                        {
                            isActive: false
                        }
                    ).session(session);

                    // Criar novo carrinho
                    cart = new Cart({
                        sessionId,
                        clientCode,
                        clientName,
                        items: []
                    });
                    console.log(`🛒 Novo carrinho criado para ${clientName} (${clientCode})`);
                } else if (!cart.isActive) {
                    // Reativar carrinho existente se estiver inativo
                    console.log(`🔄 Reativando carrinho inativo: ${sessionId}`);
                    cart.isActive = true;
                    cart.items = []; // Limpar itens antigos
                    cart.clientCode = clientCode; // Atualizar dados do cliente
                    cart.clientName = clientName;
                }

                // 3. Verificar se item já está no carrinho
                if (cart.hasItem(driveFileId)) {
                    throw new Error('Item já está no carrinho');
                }

                // 4. Verificar limite de itens
                if (cart.totalItems >= CartService.MAX_ITEMS_PER_CART) {
                    throw new Error(`Limite máximo de ${CartService.MAX_ITEMS_PER_CART} itens por carrinho`);
                }

                // 5. Calcular tempo de expiração - MODIFICADO
                const expiresAt = new Date(Date.now() + CUSTOM_DURATION);

                // 6. Reservar produto (operação atômica)
                const updateResult = await UnifiedProductComplete.updateOne(
                    {
                        _id: product._id,
                        status: 'available' // Double-check
                    },
                    {
                        $set: {
                            status: 'reserved',
                            'reservedBy.clientCode': clientCode,
                            'reservedBy.sessionId': sessionId,
                            'reservedBy.expiresAt': expiresAt,
                            cartAddedAt: new Date()
                        }
                    }
                ).session(session);

                if (updateResult.matchedCount === 0) {
                    throw new Error('This item has been reserved by another customer');
                }

                // 7. Adicionar item ao carrinho
                const cartItem = {
                    productId: product._id,
                    driveFileId: product.driveFileId,
                    fileName: product.fileName,
                    category: product.category,
                    thumbnailUrl: product.thumbnailUrl,
                    expiresAt,
                    ...itemData
                };

                cart.items.push(cartItem);
                await cart.save({ session });

                // NOVO: Notificar CDE em background (não bloqueia)
                setImmediate(async () => {
                    try {
                        // MUDANÇA: Usar a função extractPhotoNumber
                        const photoNumber = extractPhotoNumber(driveFileId);

                        if (!photoNumber) {
                            console.log(`[CartService] Não foi possível extrair número da foto de: ${driveFileId}`);
                            return;
                        }

                        const photoStatus = await UnifiedProductComplete.findOne({
                            $or: [
                                { photoNumber: photoNumber },
                                { photoId: photoNumber },
                                { fileName: `${photoNumber}.webp` }
                            ]
                        });

                        if (photoStatus?.idhCode) {
                            console.log(`[CartService] Foto encontrada: ${photoStatus.photoNumber} - IDH: ${photoStatus.idhCode}`);
                            console.log(`[CartService] Tentando notificar CDE sobre reserva de ${photoStatus.photoNumber}`);
                            await CDEWriter.markAsReserved(
                                photoStatus.photoNumber,
                                photoStatus.idhCode,
                                clientCode,
                                sessionId,
                                clientName
                            );
                        } else {
                            console.log(`[CartService] Foto NÃO encontrada no PhotoStatus: ${photoNumber}`);
                        }
                    } catch (error) {
                        console.error('[CartService] Erro ao notificar CDE:', error.message);
                        // Não falha a operação principal se CDE der erro
                    }
                });

                console.log(`✅ Item ${driveFileId} adicionado ao carrinho ${sessionId}`);

                return {
                    success: true,
                    message: 'Item adicionado ao carrinho',
                    item: cartItem,
                    cart: await this.getCartSummary(sessionId),
                    expiresAt,
                    timeRemaining: Math.floor(CUSTOM_DURATION / 1000) // MODIFICADO
                };
            });

        } catch (error) {
            console.error(`❌ Erro ao adicionar item ao carrinho:`, error);
            throw error;
        } finally {
            await session.endSession();
        }
    }

    /**
     * Remover item do carrinho e liberar reserva
     * @param {string} sessionId - ID da sessão do cliente
     * @param {string} driveFileId - ID do arquivo no Google Drive
     * @returns {object} Resultado da operação
     */
    static async removeFromCart(sessionId, driveFileId) {
        const session = await mongoose.startSession();

        try {
            return await session.withTransaction(async () => {
                console.log(`🗑️ Removendo item ${driveFileId} do carrinho ${sessionId}`);

                // 1. Buscar carrinho
                const cart = await Cart.findActiveBySession(sessionId).session(session);

                if (!cart || !cart.hasItem(driveFileId)) {
                    throw new Error('Item não encontrado no carrinho');
                }

                // 2. Remover item do carrinho
                cart.items = cart.items.filter(item => item.driveFileId !== driveFileId);

                // 3. Liberar reserva do produto (operação atômica)
                // CORREÇÃO: Buscar o clientCode do carrinho para garantir liberação
                const clientCode = cart.clientCode;

                const updateResult = await UnifiedProductComplete.updateOne(
                    {
                        driveFileId,
                        $or: [
                            { 'reservedBy.sessionId': sessionId },      // Tenta pelo sessionId primeiro
                            { 'reservedBy.clientCode': clientCode }     // Se não encontrar, tenta pelo cliente
                        ]
                    },
                    {
                        $set: {
                            status: 'available'
                        },
                        $unset: {
                            'reservedBy': 1,
                            'cartAddedAt': 1
                        }
                    }
                ).session(session);

                // Adicionar log para debug
                if (updateResult.modifiedCount === 0) {
                    console.log(`⚠️ [CartService] Produto ${driveFileId} não foi liberado - pode já estar available`);
                } else {
                    console.log(`✅ [CartService] Produto ${driveFileId} liberado com sucesso`);
                }

                // 4. Salvar carrinho
                if (cart.totalItems === 0) {
                    cart.isActive = false;
                }

                await cart.save({ session });

                // NOVO: Notificar CDE em background (não bloqueia)
                setImmediate(async () => {
                    try {
                        // MUDANÇA: Usar a função extractPhotoNumber
                        const photoNumber = extractPhotoNumber(driveFileId);

                        if (!photoNumber) {
                            console.log(`[CartService] Não foi possível extrair número da foto de: ${driveFileId}`);
                            return;
                        }

                        const photoStatus = await UnifiedProductComplete.findOne({
                            $or: [
                                { photoNumber: photoNumber },
                                { photoId: photoNumber },
                                { fileName: `${photoNumber}.webp` }
                            ]
                        });

                        if (photoStatus?.idhCode) {
                            console.log(`[CartService] Foto encontrada: ${photoStatus.photoNumber} - IDH: ${photoStatus.idhCode}`);
                            console.log(`[CartService] Tentando notificar CDE sobre liberação de ${photoStatus.photoNumber}`);
                            // Só vai funcionar quando tiver permissão WRITE (segunda-feira)
                            await CDEWriter.markAsAvailable(
                                photoStatus.photoNumber,
                                photoStatus.idhCode
                            );
                        } else {
                            console.log(`[CartService] Foto NÃO encontrada no PhotoStatus: ${photoNumber}`);
                        }
                    } catch (error) {
                        console.error('[CartService] Erro ao notificar CDE:', error.message);
                        // Não falha a operação principal se CDE der erro
                    }
                });

                console.log(`✅ Item ${driveFileId} removido do carrinho ${sessionId}`);

                return {
                    success: true,
                    message: 'Item removido do carrinho',
                    cart: await this.getCartSummary(sessionId)
                };
            });

        } catch (error) {
            console.error(`❌ Erro ao remover item do carrinho:`, error);
            throw error;
        } finally {
            await session.endSession();
        }
    }

    /**
     * Buscar carrinho completo
     * @param {string} sessionId - ID da sessão do cliente
     * @returns {object} Carrinho com itens populados
     */
    static async getCart(sessionId) {
        try {
            const cart = await Cart.findActiveBySession(sessionId);

            if (!cart) {
                return null;
            }

            // Limpar itens expirados antes de retornar
            const hadExpiredItems = cart.cleanExpiredItems();

            if (hadExpiredItems) {
                await cart.save();

                // Liberar reservas dos itens expirados
                await this.releaseExpiredReservations(sessionId);
            }

            return cart;

        } catch (error) {
            console.error(`❌ Erro ao buscar carrinho:`, error);
            throw error;
        }
    }

    /**
     * Resumo do carrinho (para APIs mais rápidas)
     * @param {string} sessionId - ID da sessão do cliente
     * @returns {object} Resumo do carrinho
     */
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

            return {
                totalItems: cart.totalItems,
                items: cart.items.map(item => ({
                    driveFileId: item.driveFileId,
                    fileName: item.fileName,
                    category: item.category,
                    thumbnailUrl: item.thumbnailUrl,
                    basePrice: item.basePrice,  // ← ADICIONE ESTA LINHA AQUI!
                    price: item.price,
                    formattedPrice: item.formattedPrice,
                    hasPrice: item.hasPrice,
                    timeRemaining: cart.getTimeRemaining(item.driveFileId),
                    expiresAt: item.expiresAt
                })),
                isEmpty: cart.totalItems === 0,
                lastActivity: cart.lastActivity
            };

        } catch (error) {
            console.error(`❌ Erro ao buscar resumo do carrinho:`, error);
            return {
                totalItems: 0,
                items: [],
                isEmpty: true,
                error: error.message
            };
        }
    }

    /**
     * Verificar se item está no carrinho
     * @param {string} sessionId - ID da sessão do cliente
     * @param {string} driveFileId - ID do arquivo no Google Drive
     * @returns {boolean} True se item está no carrinho
     */
    static async isInCart(sessionId, driveFileId) {
        try {
            const cart = await Cart.findActiveBySession(sessionId);
            return cart ? cart.hasItem(driveFileId) : false;
        } catch (error) {
            console.error(`❌ Erro ao verificar item no carrinho:`, error);
            return false;
        }
    }

    // ===== MÉTODOS DE LIMPEZA =====

    /**
     * Limpar reservas expiradas para uma sessão específica
     * @param {string} sessionId - ID da sessão do cliente
     */
    static async releaseExpiredReservations(sessionId) {
        try {
            const now = new Date();

            // Liberar reservas expiradas
            const result = await UnifiedProductComplete.updateMany(
                {
                    'reservedBy.sessionId': sessionId,
                    'reservedBy.expiresAt': { $lt: now }
                },
                {
                    $set: { status: 'available' },
                    $unset: { 'reservedBy': 1, 'cartAddedAt': 1 }
                }
            );

            if (result.modifiedCount > 0) {
                console.log(`🧹 Liberadas ${result.modifiedCount} reservas expiradas para sessão ${sessionId}`);
            }

        } catch (error) {
            console.error(`❌ Erro ao liberar reservas expiradas:`, error);
        }
    }

    /**
     * Limpeza geral de reservas expiradas (job automático)
     * CORRIGIDO: Não remove mais itens válidos dos carrinhos
     * @returns {object} Estatísticas da limpeza
     */
    static async cleanupExpiredReservations() {
        try {
            const now = new Date();
            console.log(`🧹 Iniciando limpeza robusta - ${now.toISOString()}`);

            // PASSO 1: Liberar produtos com reservas REALMENTE expiradas
            // Adiciona margem de segurança de 2 minutos para evitar race conditions
            const margemSeguranca = new Date(now.getTime() - 2 * 60000); // 2 minutos atrás

            const productResult = await UnifiedProductComplete.updateMany(
                {
                    status: 'reserved',
                    'reservedBy.expiresAt': { $lt: margemSeguranca } // Só libera se expirou há mais de 2 minutos
                },
                {
                    $set: {
                        status: 'available',
                        currentStatus: 'available',
                        'virtualStatus.status': 'available',
                        lastModified: now,
                        'virtualStatus.lastStatusChange': now
                    },
                    $unset: {
                        'reservedBy': 1,
                        'cartAddedAt': 1
                    }
                }
            );

            console.log(`✓ ${productResult.modifiedCount} produtos liberados`);

            // Avisar o CDE sobre liberações (mantém como está)
            if (productResult.modifiedCount > 0) {
                console.log(`   🔍 Procurando fotos para avisar o CDE...`);

                const fotosParaLiberar = await UnifiedProductComplete.find({
                    status: 'available',
                    cdeStatus: 'PRE-SELECTED'
                }).limit(10);

                console.log(`   📡 Encontradas ${fotosParaLiberar.length} fotos para liberar no CDE`);

                for (const foto of fotosParaLiberar) {
                    console.log(`   📡 Liberando foto ${foto.photoNumber} no CDE...`);
                    await CDEWriter.markAsAvailable(foto.photoNumber, foto.idhCode);
                }
            }

            // PASSO 2: Limpar APENAS items REALMENTE expirados dos carrinhos
            const Cart = require('../models/Cart');
            let cartsProcessed = 0;
            let itemsRemoved = 0;

            const cartsWithItems = await Cart.find({
                'items.0': { $exists: true }
            });

            for (const cart of cartsWithItems) {
                const originalCount = cart.items.length;

                // IMPORTANTE: Só remove items que expiraram há mais de 2 minutos
                cart.items = cart.items.filter(item => {
                    if (!item.expiresAt) {
                        console.log(`   ⚠️ Item sem expiração mantido: ${item.fileName}`);
                        return true; // Sem data = mantém sempre
                    }

                    const expiracao = new Date(item.expiresAt);
                    const expiradoComMargem = expiracao < margemSeguranca;

                    if (expiradoComMargem) {
                        console.log(`   🗑️ Removendo item expirado: ${item.fileName} (expirou em ${expiracao.toISOString()})`);
                        return false; // Remove
                    }

                    return true; // Mantém se não expirou ou expirou há menos de 2 minutos
                });

                const removedCount = originalCount - cart.items.length;

                if (removedCount > 0) {
                    cart.totalItems = cart.items.length;

                    // Se não tem mais items, desativar carrinho
                    if (cart.items.length === 0) {
                        cart.isActive = false;
                        cart.notes = 'Auto-cleaned: all items expired';
                    }

                    await cart.save();
                    cartsProcessed++;
                    itemsRemoved += removedCount;

                    console.log(`   ✓ Carrinho ${cart.clientCode}: removidos ${removedCount} items realmente expirados`);
                }
            }

            // PASSO 3: DESABILITADO - Estava removendo itens válidos
            // A verificação de "órfãos" estava muito agressiva e removia fotos que ainda eram válidas
            let orphansFixed = 0;
            console.log('   ⏭️ Verificação de órfãos DESABILITADA - preservando integridade dos carrinhos');

            // CÓDIGO ANTIGO REMOVIDO - Não vamos mais fazer essa verificação
            // Os itens só devem sair do carrinho quando REALMENTE expirarem
            // ou quando o cliente remover manualmente

            const summary = {
                timestamp: now,
                productsReleased: productResult.modifiedCount,
                cartsProcessed: cartsProcessed,
                itemsRemoved: itemsRemoved,
                orphansFixed: 0, // Sempre 0 agora que desabilitamos
                success: true
            };

            console.log(`✅ Limpeza concluída:`, summary);
            return summary;

        } catch (error) {
            console.error(`❌ Erro na limpeza robusta:`, error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date()
            };
        }
    }

    /**
     * Estender tempo do carrinho de forma sincronizada
     * CRUCIAL: Atualiza tanto o carrinho quanto os produtos atomicamente
     * @param {string} clientCode - Código do cliente
     * @param {number} hours - Horas para estender (1 a 120)
     * @param {string} extendedBy - Quem está estendendo (admin username)
     * @returns {object} Resultado da operação
     */
    static async extendCartTime(clientCode, hours, extendedBy = 'admin') {
        const session = await mongoose.startSession();

        try {
            return await session.withTransaction(async () => {
                const now = new Date();
                const newExpiration = new Date(now.getTime() + (hours * 60 * 60 * 1000));

                console.log(`⏰ Estendendo tempo do carrinho ${clientCode} por ${hours} horas`);
                console.log(`   Nova expiração: ${newExpiration.toISOString()}`);

                // 1. Buscar o carrinho ativo do cliente
                const cart = await Cart.findOne({
                    clientCode: clientCode,
                    isActive: true,
                    'items.0': { $exists: true }
                }).session(session);

                if (!cart) {
                    throw new Error('Carrinho não encontrado ou vazio');
                }

                console.log(`📦 Carrinho encontrado com ${cart.items.length} items`);

                // 2. Coletar todos os fileNames para atualizar produtos
                const fileNames = cart.items.map(item => item.fileName);

                // 3. Atualizar TODOS os itens do carrinho
                cart.items.forEach(item => {
                    item.expiresAt = newExpiration;
                });

                // Atualizar metadados do carrinho
                cart.lastActivity = now;
                cart.extendedAt = now;
                cart.extendedBy = extendedBy;

                await cart.save({ session });
                console.log(`✅ Carrinho atualizado: ${cart.items.length} items`);

                // 4. CRUCIAL: Atualizar TODOS os produtos correspondentes
                const updateResult = await UnifiedProductComplete.updateMany(
                    {
                        fileName: { $in: fileNames },
                        'reservedBy.clientCode': clientCode,
                        status: 'reserved'
                    },
                    {
                        $set: {
                            'reservedBy.expiresAt': newExpiration,
                            lastModified: now,
                            'extendedBy': extendedBy,
                            'extendedAt': now
                        }
                    },
                    { session }
                );

                console.log(`✅ Produtos atualizados: ${updateResult.modifiedCount} de ${fileNames.length}`);

                // 5. Verificar consistência
                if (cart.items.length !== updateResult.modifiedCount) {
                    console.warn(`⚠️ INCONSISTÊNCIA DETECTADA:`);
                    console.warn(`   Carrinho tem ${cart.items.length} items`);
                    console.warn(`   Mas só ${updateResult.modifiedCount} produtos foram atualizados`);
                }

                return {
                    success: true,
                    cartItemsUpdated: cart.items.length,
                    productsUpdated: updateResult.modifiedCount,
                    newExpiration: newExpiration,
                    consistent: cart.items.length === updateResult.modifiedCount,
                    extendedBy: extendedBy,
                    hoursExtended: hours
                };
            });

        } catch (error) {
            console.error(`❌ Erro ao estender tempo do carrinho:`, error);
            throw error;
        } finally {
            await session.endSession();
        }
    }

    // ===== MÉTODOS UTILITÁRIOS =====

    /**
     * Gerar ID de sessão único
     * @returns {string} ID de sessão
     */
    static generateSessionId() {
        return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Estatísticas gerais do sistema de carrinho
     * @returns {object} Estatísticas
     */
    static async getSystemStats() {
        try {
            const stats = await Promise.all([
                Cart.countDocuments({ isActive: true }),
                Cart.countDocuments({ isActive: false }),
                UnifiedProductComplete.countDocuments({ status: 'available' }),
                UnifiedProductComplete.countDocuments({ status: 'reserved' }),
                UnifiedProductComplete.countDocuments({ status: 'sold' }),
                Cart.aggregate([
                    { $match: { isActive: true } },
                    { $group: { _id: null, totalItems: { $sum: '$totalItems' } } }
                ])
            ]);

            return {
                activeCarts: stats[0],
                inactiveCarts: stats[1],
                availableProducts: stats[2],
                reservedProducts: stats[3],
                soldProducts: stats[4],
                totalItemsInCarts: stats[5][0]?.totalItems || 0,
                timestamp: new Date()
            };

        } catch (error) {
            console.error(`❌ Erro ao buscar estatísticas:`, error);
            throw error;
        }
    }
}

module.exports = CartService;