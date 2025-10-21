// src/routes/cart.js
// VERSÃO SIMPLIFICADA - Rotas diretas sem complexidade desnecessária

const express = require('express');
const CartService = require('../services/CartService');
const PhotoCategory = require('../models/PhotoCategory');
const AccessCode = require('../models/AccessCode');
const Selection = require('../models/Selection');

const router = express.Router();

// ============================================
// GLOBAL MIX & MATCH CONFIGURATION
// ============================================
const GLOBAL_MIX_MATCH_CATEGORIES = [
    'Colombia Cowhides',
    'Brazil Best Sellers',
    'Brazil Cowhides - Selected Categories Small',
    'Brazil Cowhides - Selected Categories ML & XL'
];

/**
 * Verifica se uma categoria participa do Mix & Match global
 */
function isGlobalMixMatch(categoryPath) {
    if (!categoryPath) return false;

    const mainCategory = categoryPath.split('/')[0];

    // Normalizar para comparação
    const normalized = mainCategory.trim();

    return GLOBAL_MIX_MATCH_CATEGORIES.some(mixCat =>
        normalized.includes(mixCat) || mixCat.includes(normalized)
    );
}

/**
 * Middleware de validação simples e direto
 */
const validateRequest = (req, res, next) => {
    const sessionId = req.params.sessionId || req.body.sessionId;
    const clientCode = req.body.clientCode;

    if (req.path.includes('/add') || req.path.includes('/remove')) {
        if (!sessionId || sessionId.length < 10) {
            return res.status(400).json({
                success: false,
                message: 'SessionId inválido'
            });
        }

        if (req.path.includes('/add') && (!clientCode || clientCode.length !== 4)) {
            return res.status(400).json({
                success: false,
                message: 'Código de cliente inválido'
            });
        }
    }

    req.validatedData = { sessionId, clientCode };
    next();
};

/**
 * POST /api/cart/add
 * Adicionar item ao carrinho - operação síncrona e instantânea
 */
router.post('/add', validateRequest, async (req, res) => {
    try {
        const {
            sessionId, clientCode, clientName, driveFileId,
            fileName, category, thumbnailUrl,
            basePrice, price, formattedPrice, hasPrice
        } = req.body;

        if (!driveFileId) {
            return res.status(400).json({
                success: false,
                message: 'ID do arquivo é obrigatório'
            });
        }

        console.log(`[ROUTE] Adicionando ${fileName} ao carrinho de ${clientName}`);

        const result = await CartService.addToCart(
            sessionId,
            clientCode,
            clientName,
            driveFileId,
            {
                fileName,
                category,
                thumbnailUrl,
                basePrice: basePrice || 0,
                price: price || 0,
                formattedPrice,
                hasPrice
            }
        );

        // ⭐ RECALCULAR preços e totais antes de retornar
        if (result.success && result.cart) {
            await calculateCartTotals(result.cart);
        }

        res.status(201).json(result);

    } catch (error) {
        console.error('[ROUTE] Erro ao adicionar:', error.message);

        let statusCode = 500;
        if (error.message.includes('reservado')) {
            statusCode = 423;
        } else if (error.message.includes('já está')) {
            statusCode = 409;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * DELETE /api/cart/remove/:driveFileId
 * Remover item do carrinho - operação síncrona e instantânea
 */
router.delete('/remove/:driveFileId', validateRequest, async (req, res) => {
    try {
        const { driveFileId } = req.params;
        const { sessionId } = req.body;

        console.log(`[ROUTE] Removendo ${driveFileId} do carrinho`);

        const result = await CartService.removeFromCart(sessionId, driveFileId);
        res.json(result);

    } catch (error) {
        console.error('[ROUTE] Erro ao remover:', error.message);

        res.status(error.message.includes('não encontrado') ? 404 : 500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/cart/:sessionId
 * Buscar carrinho completo com preços recalculados por volume
 */
router.get('/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const cart = await CartService.getCart(sessionId);

        if (!cart) {
            return res.json({
                success: true,
                message: 'Carrinho vazio',
                data: {
                    totalItems: 0,
                    items: [],
                    isEmpty: true
                }
            });
        }

        // RECALCULAR PREÇOS DE CADA ITEM baseado em volume
        const itemsByCategory = {};
        cart.items.forEach(item => {
            const categoryPath = item.category || 'Uncategorized';
            if (!itemsByCategory[categoryPath]) {
                itemsByCategory[categoryPath] = [];
            }
            itemsByCategory[categoryPath].push(item);
        });

        // Atualizar preço de cada item baseado na quantidade da categoria
        console.log('🔄 [DEBUG] Recalculando preços do carrinho...');
        console.log(`📦 [DEBUG] ${Object.keys(itemsByCategory).length} categorias no carrinho`);

        for (const [categoryPath, items] of Object.entries(itemsByCategory)) {
            const quantity = items.length;

            console.log(`\n📂 [DEBUG] Categoria: ${categoryPath}`);
            console.log(`📊 [DEBUG] Quantidade: ${quantity} items`);

            // Buscar categoria no banco
            const categoryName = categoryPath.split('/').pop().replace('/', '');
            const category = await PhotoCategory.findOne({
                $or: [
                    { folderName: categoryName },
                    { displayName: { $regex: categoryName } }
                ]
            });

            if (category) {
                // Calcular preço correto para essa quantidade
                const priceResult = await category.getPriceForClient(cart.clientCode, quantity);

                console.log(`💰 [DEBUG] Preço calculado: $${priceResult.finalPrice} (${priceResult.appliedRule})`);
                console.log(`📝 [DEBUG] Atualizando ${items.length} items para $${priceResult.finalPrice}`);

                // ATUALIZAR o campo price de TODOS os items dessa categoria
                items.forEach(item => {
                    item.price = priceResult.finalPrice;
                    item.formattedPrice = `$${priceResult.finalPrice.toFixed(2)}`;
                });
            } else {
                console.log(`❌ [DEBUG] Categoria não encontrada no banco!`);
            }
        }

        console.log('\n✅ [DEBUG] Recálculo completo!\n');

        // Calcular totais com os novos preços
        const totals = await calculateCartTotals(cart);

        res.json({
            success: true,
            data: {
                sessionId: cart.sessionId,
                clientCode: cart.clientCode,
                clientName: cart.clientName,
                totalItems: cart.totalItems,
                items: cart.items, // Items agora têm preços atualizados!
                totals: totals,
                lastActivity: cart.lastActivity,
                isEmpty: cart.totalItems === 0
            }
        });

    } catch (error) {
        console.error('[ROUTE] Erro ao buscar carrinho:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/cart/:sessionId/summary
 * Resumo rápido do carrinho
 */
router.get('/:sessionId/summary', async (req, res) => {
    try {
        const { sessionId } = req.params;

        // Buscar carrinho completo
        const cart = await CartService.getCart(sessionId);

        if (!cart) {
            return res.json({
                success: true,
                totalItems: 0,
                items: [],
                isEmpty: true
            });
        }

        // ⭐ RECALCULAR preços antes de retornar
        await calculateCartTotals(cart);

        res.json({
            success: true,
            sessionId: cart.sessionId,
            totalItems: cart.totalItems,
            items: cart.items, // Com preços recalculados!
            isEmpty: cart.totalItems === 0
        });

    } catch (error) {
        console.error('[ROUTE] Erro ao buscar resumo:', error.message);
        res.json({
            success: false,
            totalItems: 0,
            items: [],
            isEmpty: true
        });
    }
});

/**
 * GET /api/cart/:sessionId/calculate-total
 * Calcular total com descontos
 */
router.get('/:sessionId/calculate-total', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const cart = await CartService.getCart(sessionId);

        if (!cart || cart.totalItems === 0) {
            return res.json({
                success: true,
                data: {
                    totalItems: 0,
                    subtotal: 0,
                    total: 0
                }
            });
        }

        const totals = {
            totalItems: cart.totalItems,
            subtotal: 0,
            discount: 0,
            total: 0,
            discountPercent: 0
        };

        res.json({
            success: true,
            data: totals
        });

    } catch (error) {
        console.error('[ROUTE] Erro ao calcular total:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/cart/:clientCode/extend
 * Estender tempo do carrinho
 */
router.post('/:clientCode/extend', async (req, res) => {
    try {
        const { clientCode } = req.params;
        const { hours = 1, extendedBy = 'admin' } = req.body;

        const result = await CartService.extendCartTime(clientCode, hours, extendedBy);

        res.json({
            success: true,
            message: `Carrinho estendido por ${hours} horas`,
            ...result
        });

    } catch (error) {
        console.error('[ROUTE] Erro ao estender tempo:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/cart/active/:clientCode
 * Buscar carrinho ativo do cliente
 */
router.get('/active/:clientCode', async (req, res) => {
    try {
        const { clientCode } = req.params;

        const Cart = require('../models/Cart');
        const cart = await Cart.findOne({
            clientCode: clientCode,
            isActive: true,
            totalItems: { $gt: 0 }
        }).sort({ lastActivity: -1 });

        if (!cart) {
            return res.json({
                success: true,
                message: 'Nenhum carrinho ativo',
                totalItems: 0,
                items: []
            });
        }

        const summary = await CartService.getCartSummary(cart.sessionId);

        res.json({
            success: true,
            sessionId: cart.sessionId,
            ...summary
        });

    } catch (error) {
        console.error('[ROUTE] Erro ao buscar carrinho ativo:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/cart/process-expired
 * Processar itens expirados manualmente
 */
router.post('/process-expired', async (req, res) => {
    try {
        const Cart = require('../models/Cart');
        const now = new Date();

        const cartsWithExpired = await Cart.find({
            isActive: true,
            'items.expiresAt': { $lt: now }
        });

        let processedCount = 0;

        for (const cart of cartsWithExpired) {
            const expiredItems = cart.items.filter(item =>
                item.expiresAt && new Date(item.expiresAt) < now
            );

            for (const item of expiredItems) {
                await CartService.processExpiredItem(item, cart);
                processedCount++;
            }
        }

        res.json({
            success: true,
            message: `${processedCount} itens expirados processados`,
            timestamp: new Date()
        });

    } catch (error) {
        console.error('[ROUTE] Erro ao processar expirados:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/cart/stats/system
 * Estatísticas do sistema
 */
router.get('/stats/system', async (req, res) => {
    try {
        const stats = await CartService.getSystemStats();

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('[ROUTE] Erro ao buscar estatísticas:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Função auxiliar para calcular totais do carrinho
 * Mantida simples mas funcional
 */
async function calculateCartTotals(cart) {
    if (!cart || cart.totalItems === 0) {
        return {
            subtotal: 0,
            discount: 0,
            total: 0
        };
    }

    let subtotal = 0;
    let total = 0;

    // Verificar se é Special Selection
    const accessCode = await AccessCode.findOne({ code: cart.clientCode });
    const isSpecialSelection = accessCode?.accessType === 'special';

    // ============================================
    // SEPARAR ITEMS EM 2 GRUPOS
    // ============================================
    const globalMixMatchItems = {}; // Items das 4 categorias principais
    const separateItems = {};       // Items de outras categorias

    cart.items.forEach(item => {
        const categoryPath = item.category || 'uncategorized';

        subtotal += item.basePrice || 0;

        if (isGlobalMixMatch(categoryPath)) {
            // Vai para grupo Mix & Match GLOBAL
            if (!globalMixMatchItems[categoryPath]) {
                globalMixMatchItems[categoryPath] = [];
            }
            globalMixMatchItems[categoryPath].push(item);
        } else {
            // Vai para grupo SEPARADO
            if (!separateItems[categoryPath]) {
                separateItems[categoryPath] = [];
            }
            separateItems[categoryPath].push(item);
        }
    });

    // ============================================
    // PROCESSAR GRUPO GLOBAL MIX & MATCH
    // ============================================
    if (Object.keys(globalMixMatchItems).length > 0) {
        // Contar TOTAL de items nas 4 categorias
        const globalQuantity = Object.values(globalMixMatchItems)
            .reduce((sum, items) => sum + items.length, 0);

        console.log(`🌍 [MIX&MATCH GLOBAL] ${globalQuantity} items no total`);

        // Processar cada subcategoria com a quantidade GLOBAL
        for (const [categoryPath, items] of Object.entries(globalMixMatchItems)) {
            const categoryName = categoryPath.split('/').pop().replace('/', '');
            const category = await PhotoCategory.findOne({
                $or: [
                    { folderName: categoryName },
                    { displayName: { $regex: categoryName } }
                ]
            });

            let pricePerItem = items[0].price || items[0].basePrice || 0;

            if (category) {
                // Usar quantidade GLOBAL para calcular tier
                const priceResult = await category.getPriceForClient(
                    cart.clientCode,
                    globalQuantity // ✅ QUANTIDADE GLOBAL!
                );
                pricePerItem = priceResult.finalPrice;

                console.log(`   📦 ${categoryName}: ${items.length} items × $${pricePerItem} (tier global: ${globalQuantity})`);
            }

            // Atualizar preço de cada item
            items.forEach(item => {
                item.price = pricePerItem;
                item.formattedPrice = `$${pricePerItem.toFixed(2)}`;
            });

            total += items.length * pricePerItem;
        }
    }

    // ============================================
    // PROCESSAR CATEGORIAS SEPARADAS
    // ============================================
    for (const [categoryPath, items] of Object.entries(separateItems)) {
        const quantity = items.length; // Quantidade própria

        const categoryName = categoryPath.split('/').pop().replace('/', '');
        const category = await PhotoCategory.findOne({
            $or: [
                { folderName: categoryName },
                { displayName: { $regex: categoryName } }
            ]
        });

        let pricePerItem = items[0].price || items[0].basePrice || 0;

        if (category) {
            const priceResult = await category.getPriceForClient(cart.clientCode, quantity);
            pricePerItem = priceResult.finalPrice;

            console.log(`   🔸 ${categoryName}: ${quantity} items × $${pricePerItem} (tier próprio)`);
        }

        // Atualizar preço de cada item
        items.forEach(item => {
            item.price = pricePerItem;
            item.formattedPrice = `$${pricePerItem.toFixed(2)}`;
        });

        total += quantity * pricePerItem;
    }

    return {
        subtotal: subtotal,
        discount: subtotal - total,
        total: total,
        discountPercent: subtotal > 0 ? Math.round(((subtotal - total) / subtotal) * 100) : 0
    };
}

// ============================================
// ENDPOINT DE STATUS DO CARRINHO - Para sincronização com frontend
// Adicionado para resolver problema de dessincronização quando CDE remove itens
// ============================================
router.get('/status/:clientCode', async (req, res) => {
    try {
        const { clientCode } = req.params;

        // Validação básica
        if (!clientCode || clientCode.length !== 4) {
            return res.status(400).json({
                success: false,
                message: 'Código de cliente inválido'
            });
        }

        // Importar o modelo Cart (já está sendo usado em outras rotas)
        const Cart = require('../models/Cart');

        // Buscar carrinho ativo do cliente
        const cart = await Cart.findOne({
            clientCode: clientCode,
            isActive: true
        }).select('items totalItems totalValue updatedAt');

        // Se não tem carrinho, retornar vazio
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.json({
                success: true,
                hasCart: false,
                items: [],
                totalItems: 0,
                totalValue: 0,
                lastUpdated: null
            });
        }

        // Retornar informações resumidas do carrinho
        res.json({
            success: true,
            hasCart: true,
            items: cart.items.map(item => ({
                fileName: item.fileName,
                category: item.category,
                price: item.price
            })),
            totalItems: cart.totalItems || cart.items.length,
            totalValue: cart.totalValue || 0,
            lastUpdated: cart.updatedAt
        });

    } catch (error) {
        console.error('[Cart Status] Erro ao verificar status do carrinho:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/cart/test/status
 * Ver status atual de carrinhos e expiração
 */
router.get('/test/status', async (req, res) => {
    // Só funciona em desenvolvimento
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Não disponível em produção' });
    }

    try {
        const Cart = require('../models/Cart');
        const now = new Date();

        // Buscar todos os carrinhos ativos
        const activeCarts = await Cart.find({ isActive: true });

        const status = {
            timestamp: now.toISOString(),
            totalCarrinhos: activeCarts.length,
            carrinhosComItens: 0,
            carrinhosVazios: 0,
            totalItens: 0,
            itensExpirados: 0,
            itensValidos: 0,
            carrinhos: []
        };

        for (const cart of activeCarts) {
            if (cart.items.length > 0) {
                status.carrinhosComItens++;

                const expiredItems = cart.items.filter(item =>
                    item.expiresAt && new Date(item.expiresAt) < now
                );

                const validItems = cart.items.filter(item =>
                    !item.expiresAt || new Date(item.expiresAt) >= now
                );

                status.totalItens += cart.items.length;
                status.itensExpirados += expiredItems.length;
                status.itensValidos += validItems.length;

                status.carrinhos.push({
                    clientCode: cart.clientCode,
                    sessionId: cart.sessionId,
                    totalItens: cart.items.length,
                    expirados: expiredItems.length,
                    validos: validItems.length,
                    criadoEm: cart.createdAt,
                    ultimaAtividade: cart.lastActivity
                });
            } else {
                status.carrinhosVazios++;
            }
        }

        res.json(status);

    } catch (error) {
        console.error('Erro ao buscar status:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

module.exports = router;