// src/routes/cart.js

const express = require('express');
const { CartService } = require('../services');

const router = express.Router();

// ===== MIDDLEWARE DE VALIDAÇÃO =====

// Validar sessionId
const validateSessionId = (req, res, next) => {
    const sessionId = req.params.sessionId || req.body.sessionId;

    if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 10) {
        return res.status(400).json({
            success: false,
            message: 'SessionId inválido ou não fornecido'
        });
    }

    req.sessionId = sessionId;
    next();
};

// Validar dados de cliente
const validateClientData = (req, res, next) => {
    const {
        sessionId, clientCode, clientName, driveFileId,
        fileName, category, thumbnailUrl,
        price, formattedPrice, hasPrice
    } = req.body;

    if (!clientCode || typeof clientCode !== 'string' || clientCode.length !== 4) {
        return res.status(400).json({
            success: false,
            message: 'Código de cliente inválido'
        });
    }

    if (!clientName || typeof clientName !== 'string' || clientName.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Nome do cliente é obrigatório'
        });
    }

    next();
};

// ===== ROTAS DO CARRINHO =====

/**
 * POST /api/cart/add
 * Adicionar item ao carrinho com reserva
 */
router.post('/add', validateSessionId, validateClientData, async (req, res) => {
    try {
        // ✅ CORRIGIDO: Extrair TODOS os campos incluindo preços
        const {
            sessionId, clientCode, clientName, driveFileId,
            fileName, category, thumbnailUrl,
            price, formattedPrice, hasPrice
        } = req.body;

        // Validar driveFileId
        if (!driveFileId || typeof driveFileId !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'ID do arquivo no Google Drive é obrigatório'
            });
        }

        console.log(`🛒 Adicionando item ${driveFileId} ao carrinho ${sessionId}`);

        // ✅ NOVO: Incluir dados de preço no itemData
        const itemData = {
            fileName: fileName || 'Produto sem nome',
            category: category || 'Categoria não informada',
            thumbnailUrl: thumbnailUrl || null,
            price: price || 0,
            formattedPrice: formattedPrice || 'Sem preço',
            hasPrice: hasPrice || false
        };

        // Chamar service
        const result = await CartService.addToCart(
            sessionId,
            clientCode,
            clientName,
            driveFileId,
            itemData
        );

        res.status(201).json({
            success: true,
            message: 'Item adicionado ao carrinho com sucesso',
            data: result
        });

    } catch (error) {
        console.error('❌ Erro ao adicionar item ao carrinho:', error);

        // Códigos de erro específicos
        let statusCode = 500;
        if (error.message.includes('não encontrado') || error.message.includes('não disponível')) {
            statusCode = 404;
        } else if (error.message.includes('já está no carrinho') || error.message.includes('limite máximo')) {
            statusCode = 409;
        } else if (error.message.includes('reservado por outro')) {
            statusCode = 423; // Locked
        }

        res.status(statusCode).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * DELETE /api/cart/remove/:driveFileId
 * Remover item do carrinho e liberar reserva
 */
router.delete('/remove/:driveFileId', validateSessionId, async (req, res) => {
    try {
        const { driveFileId } = req.params;
        const { sessionId } = req.body;

        console.log(`🗑️ Removendo item ${driveFileId} do carrinho ${sessionId}`);

        // Chamar service
        const result = await CartService.removeFromCart(sessionId, driveFileId);

        res.json({
            success: true,
            message: 'Item removido do carrinho com sucesso',
            data: result
        });

    } catch (error) {
        console.error('❌ Erro ao remover item do carrinho:', error);

        let statusCode = 500;
        if (error.message.includes('não encontrado')) {
            statusCode = 404;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * GET /api/cart/:sessionId
 * Buscar carrinho completo com itens populados
 */
router.get('/:sessionId', validateSessionId, async (req, res) => {
    try {
        const { sessionId } = req.params;

        console.log(`📦 Buscando carrinho completo: ${sessionId}`);

        // Chamar service
        const cart = await CartService.getCart(sessionId);

        if (!cart) {
            return res.json({
                success: true,
                message: 'Carrinho não encontrado ou vazio',
                data: {
                    totalItems: 0,
                    items: [],
                    isEmpty: true
                }
            });
        }

        res.json({
            success: true,
            message: 'Carrinho carregado com sucesso',
            data: {
                sessionId: cart.sessionId,
                clientCode: cart.clientCode,
                clientName: cart.clientName,
                totalItems: cart.totalItems,
                items: cart.items.map(item => ({
                    productId: item.productId,
                    driveFileId: item.driveFileId,
                    fileName: item.fileName,
                    category: item.category,
                    thumbnailUrl: item.thumbnailUrl,
                    addedAt: item.addedAt,
                    expiresAt: item.expiresAt,
                    timeRemaining: cart.getTimeRemaining(item.driveFileId)
                })),
                lastActivity: cart.lastActivity,
                isEmpty: cart.totalItems === 0
            }
        });

    } catch (error) {
        console.error('❌ Erro ao buscar carrinho:', error);

        res.status(500).json({
            success: false,
            message: 'Erro interno ao buscar carrinho',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * GET /api/cart/:sessionId/summary
 * Buscar resumo rápido do carrinho (para updates frequentes)
 */
router.get('/:sessionId/summary', validateSessionId, async (req, res) => {
    try {
        const { sessionId } = req.params;

        // Chamar service (mais leve que getCart)
        const summary = await CartService.getCartSummary(sessionId);

        res.json({
            success: true,
            message: 'Resumo do carrinho carregado',
            ...summary // Spread direto do summary
        });

    } catch (error) {
        console.error('❌ Erro ao buscar resumo do carrinho:', error);

        // Em caso de erro, retornar carrinho vazio
        res.json({
            success: false,
            message: error.message,
            totalItems: 0,
            items: [],
            isEmpty: true,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * POST /api/cart/cleanup
 * Limpeza manual de reservas expiradas (debug/admin)
 */
router.post('/cleanup', async (req, res) => {
    try {
        console.log('🧹 Executando limpeza manual de carrinho...');

        const stats = await CartService.cleanupExpiredReservations();

        res.json({
            success: true,
            message: 'Limpeza executada com sucesso',
            data: stats
        });

    } catch (error) {
        console.error('❌ Erro na limpeza manual:', error);

        res.status(500).json({
            success: false,
            message: 'Erro na limpeza',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * GET /api/cart/check/:driveFileId
 * Verificar se item específico está em algum carrinho
 */
router.get('/check/:driveFileId', async (req, res) => {
    try {
        const { driveFileId } = req.params;
        const { sessionId } = req.query;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'SessionId é obrigatório'
            });
        }

        const isInCart = await CartService.isInCart(sessionId, driveFileId);

        res.json({
            success: true,
            data: {
                driveFileId,
                isInCart,
                sessionId
            }
        });

    } catch (error) {
        console.error('❌ Erro ao verificar item:', error);

        res.status(500).json({
            success: false,
            message: 'Erro ao verificar item',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * GET /api/cart/stats/system
 * Estatísticas gerais do sistema de carrinho (admin)
 */
router.get('/stats/system', async (req, res) => {
    try {
        const stats = await CartService.getSystemStats();

        res.json({
            success: true,
            message: 'Estatísticas do sistema carregadas',
            data: stats
        });

    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas:', error);

        res.status(500).json({
            success: false,
            message: 'Erro ao buscar estatísticas',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * POST /api/cart/:sessionId/extend
 * Estender tempo de reserva de todos os itens do carrinho
 */
router.post('/:sessionId/extend', validateSessionId, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { minutes = 15 } = req.body; // Default 15 minutos

        // TODO: Implementar extensão de tempo
        // Esta funcionalidade pode ser útil para checkout demorado

        res.json({
            success: false,
            message: 'Funcionalidade de extensão será implementada em versão futura'
        });

    } catch (error) {
        console.error('❌ Erro ao estender tempo:', error);

        res.status(500).json({
            success: false,
            message: 'Erro ao estender tempo de reserva'
        });
    }
});

/**
 * GET /api/cart/:sessionId/calculate-total
 * Calcular total do carrinho com desconto por quantidade
 */
router.get('/:sessionId/calculate-total', validateSessionId, async (req, res) => {
    try {
        const { sessionId } = req.params;

        console.log(`💰 Calculando total com descontos para carrinho: ${sessionId}`);

        // Buscar carrinho
        const cart = await CartService.getCart(sessionId);

        if (!cart || cart.totalItems === 0) {
            return res.json({
                success: true,
                data: {
                    totalItems: 0,
                    subtotal: 0,
                    discountPercent: 0,
                    discountAmount: 0,
                    total: 0,
                    hasDiscount: false,
                    discountDescription: 'Carrinho vazio'
                }
            });
        }

        // Calcular subtotal (soma dos preços individuais)
        let subtotal = 0;
        let itemsWithPrice = 0;

        for (const item of cart.items) {
            if (item.hasPrice && item.price > 0) {
                subtotal += item.price;
                itemsWithPrice++;
            }
        }

        console.log(`📊 Subtotal calculado: R$ ${subtotal.toFixed(2)} (${itemsWithPrice} itens com preço)`);

        // Buscar desconto por quantidade
        const QuantityDiscount = require('../models/QuantityDiscount');
        const discountInfo = await QuantityDiscount.calculateDiscount(cart.totalItems);

        console.log(`📦 Desconto por quantidade:`, discountInfo);

        // Aplicar desconto sobre subtotal
        let discountAmount = 0;
        let total = subtotal;

        if (discountInfo.discountPercent > 0 && subtotal > 0) {
            discountAmount = (subtotal * discountInfo.discountPercent) / 100;
            total = subtotal - discountAmount;
        }

        const result = {
            sessionId: sessionId,
            totalItems: cart.totalItems,
            itemsWithPrice: itemsWithPrice,
            subtotal: subtotal,
            discountPercent: discountInfo.discountPercent,
            discountAmount: discountAmount,
            total: total,
            hasDiscount: discountInfo.discountPercent > 0,
            discountDescription: discountInfo.description,
            discountRule: discountInfo.rule,
            formattedSubtotal: `R$ ${subtotal.toFixed(2)}`,
            formattedDiscountAmount: discountAmount > 0 ? `- R$ ${discountAmount.toFixed(2)}` : 'R$ 0,00',
            formattedTotal: `R$ ${total.toFixed(2)}`,
            calculations: {
                itemBreakdown: cart.items.map(item => ({
                    fileName: item.fileName,
                    price: item.price,
                    formattedPrice: item.formattedPrice,
                    hasPrice: item.hasPrice
                }))
            }
        };

        console.log(`✅ Total final calculado:`, {
            subtotal: result.formattedSubtotal,
            desconto: `${discountInfo.discountPercent}%`,
            valorDesconto: result.formattedDiscountAmount,
            total: result.formattedTotal
        });

        res.json({
            success: true,
            message: 'Total calculado com sucesso',
            data: result
        });

    } catch (error) {
        console.error('❌ Erro ao calcular total do carrinho:', error);

        res.status(500).json({
            success: false,
            message: 'Erro ao calcular total',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// ===== MIDDLEWARE DE ERRO GLOBAL PARA ROTAS DE CARRINHO =====
router.use((error, req, res, next) => {
    console.error('❌ Erro não tratado nas rotas de carrinho:', error);

    res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno'
    });
});

module.exports = router;