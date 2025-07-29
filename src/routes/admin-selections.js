const express = require('express');
const Selection = require('../models/Selection');
const Product = require('../models/Product');
const GoogleDriveService = require('../services/GoogleDriveService');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Middleware de autenticação para todas as rotas admin
router.use(authenticateToken);

/**
 * GET /api/admin/selections
 * Listar todas as seleções pending para admin
 */
router.get('/', async (req, res) => {
    try {
        const { status = 'pending', page = 1, limit = 50 } = req.query;

        const selections = await Selection.find({ status })
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('items.productId');

        const total = await Selection.countDocuments({ status });

        res.json({
            success: true,
            selections: selections.map(s => ({
                selectionId: s.selectionId,
                clientCode: s.clientCode,
                clientName: s.clientName,
                totalItems: s.totalItems,
                totalValue: s.totalValue,
                status: s.status,
                createdAt: s.createdAt,
                reservationExpiredAt: s.reservationExpiredAt,
                isExpired: s.isExpired(),
                googleDriveInfo: s.googleDriveInfo
            })),
            pagination: {
                total,
                page: parseInt(page),
                totalPages: Math.ceil(total / limit),
                hasNext: page * limit < total
            }
        });

    } catch (error) {
        console.error('❌ Erro ao listar seleções:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao carregar seleções',
            error: error.message
        });
    }
});

/**
 * POST /api/admin/selections/:selectionId/cancel
 * Cancelar seleção - voltar fotos para pasta original
 */
router.post('/:selectionId/cancel', async (req, res) => {
    try {
        const { selectionId } = req.params;
        const { reason, adminUser } = req.body;

        console.log(`🚫 Cancelando seleção ${selectionId}...`);

        const selection = await Selection.findOne({ selectionId });
        
        if (!selection) {
            return res.status(404).json({
                success: false,
                message: 'Seleção não encontrada'
            });
        }

        if (selection.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Apenas seleções pendentes podem ser canceladas'
            });
        }

        // TODO: Implementar lógica de reversão das fotos
        // (implementaremos na próxima etapa)

        res.json({
            success: true,
            message: 'Seleção cancelada com sucesso',
            selection: selection.getSummary()
        });

    } catch (error) {
        console.error('❌ Erro ao cancelar seleção:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao cancelar seleção',
            error: error.message
        });
    }
});

module.exports = router;