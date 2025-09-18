// src/routes/cart.js
// VERSÃO SIMPLIFICADA - Rotas diretas sem complexidade desnecessária

const express = require('express');
const CartService = require('../services/CartService');
const PhotoCategory = require('../models/PhotoCategory');
const AccessCode = require('../models/AccessCode');
const Selection = require('../models/Selection');

const router = express.Router();

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
 * Buscar carrinho completo
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

        // Calcular totais se necessário
        const totals = { subtotal: 0, discount: 0, total: 0 };

        res.json({
            success: true,
            data: {
                sessionId: cart.sessionId,
                clientCode: cart.clientCode,
                clientName: cart.clientName,
                totalItems: cart.totalItems,
                items: cart.items,
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
        const summary = await CartService.getCartSummary(sessionId);

        res.json({
            success: true,
            ...summary
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

    // Agrupar por categoria
    const itemsByCategory = {};
    cart.items.forEach(item => {
        const category = item.category || 'uncategorized';
        if (!itemsByCategory[category]) {
            itemsByCategory[category] = [];
        }
        itemsByCategory[category].push(item);
        subtotal += item.basePrice || 0;
    });

    // Calcular com descontos se aplicável
    if (isSpecialSelection && accessCode.specialSelection?.selectionId) {
        // Lógica especial para Special Selections
        const selection = await Selection.findById(accessCode.specialSelection.selectionId);

        for (const [categoryName, items] of Object.entries(itemsByCategory)) {
            const quantity = items.length;
            const specialCategory = selection?.customCategories?.find(cat =>
                cat.categoryName === categoryName
            );

            if (specialCategory?.rateRules?.length > 0) {
                for (const rule of specialCategory.rateRules) {
                    if (quantity >= rule.from && (!rule.to || quantity <= rule.to)) {
                        total += quantity * rule.price;
                        break;
                    }
                }
            } else {
                total += quantity * (items[0].price || items[0].basePrice || 0);
            }
        }
    } else {
        // Cliente normal - aplicar descontos por categoria
        for (const [categoryPath, items] of Object.entries(itemsByCategory)) {
            const quantity = items.length;

            // Buscar categoria no banco
            const categoryName = categoryPath.split('/').pop().replace('/', '');
            const category = await PhotoCategory.findOne({
                $or: [
                    { folderName: categoryName },
                    { displayName: { $regex: categoryName } }
                ]
            });

            if (category) {
                const priceResult = await category.getPriceForClient(cart.clientCode, quantity);
                total += quantity * priceResult.finalPrice;
            } else {
                total += quantity * (items[0].price || items[0].basePrice || 0);
            }
        }
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

module.exports = router;