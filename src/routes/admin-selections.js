//src/routes/admin-selections.js

const express = require('express');
const mongoose = require('mongoose');                    // ← ADICIONADO
const Selection = require('../models/Selection');
const Product = require('../models/Product');
const GoogleDriveService = require('../services/GoogleDriveService');
const { authenticateToken } = require('./auth');
const router = express.Router();

// Autenticação obrigatória para todas as rotas
router.use(authenticateToken);

/**
 * GET /api/selections
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
 * POST /api/selections/:selectionId/approve
 * Aprovar seleção - mover para SYSTEM_SOLD e marcar produtos como 'sold'
 */
router.post('/:selectionId/approve', async (req, res) => {
    const session = await mongoose.startSession();

    try {
        return await session.withTransaction(async () => {
            const { selectionId } = req.params;
            const { adminUser, notes } = req.body;

            console.log(`✅ Aprovando seleção ${selectionId}...`);

            // 1. Buscar seleção
            const selection = await Selection.findOne({ selectionId }).session(session);

            if (!selection) {
                return res.status(404).json({
                    success: false,
                    message: 'Seleção não encontrada'
                });
            }

            if (selection.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    message: 'Apenas seleções pendentes podem ser aprovadas'
                });
            }

            // 2. Mover pasta no Google Drive: RESERVED → SYSTEM_SOLD
            console.log('📁 Movendo pasta para SYSTEM_SOLD...');

            const moveResult = await GoogleDriveService.finalizeSelection(
                selection.googleDriveInfo.clientFolderId,
                selection.clientCode,
                selection.clientName
            );

            if (!moveResult.success) {
                throw new Error('Erro ao mover pasta no Google Drive');
            }

            // 3. Atualizar produtos: reserved_pending → sold
            const productIds = selection.items.map(item => item.productId);

            await Product.updateMany(
                { _id: { $in: productIds } },
                {
                    $set: {
                        status: 'sold',
                        soldAt: new Date()
                    },
                    $unset: { 'reservedBy': 1 }
                }
            ).session(session);

            // 4. Atualizar seleção
            selection.status = 'confirmed';
            selection.processedBy = adminUser || 'admin';
            selection.processedAt = new Date();
            selection.finalizedAt = new Date();
            selection.adminNotes = notes || '';

            // Atualizar info do Google Drive
            selection.googleDriveInfo.finalFolderId = moveResult.finalFolderId;

            selection.addMovementLog('approved', `Seleção aprovada por ${adminUser || 'admin'}`);
            selection.addMovementLog('moved_to_sold', `Pasta movida para SYSTEM_SOLD: ${moveResult.finalFolderName}`);

            await selection.save({ session });

            console.log(`✅ Seleção ${selectionId} aprovada com sucesso`);

            res.json({
                success: true,
                message: 'Seleção aprovada com sucesso',
                selection: selection.getSummary(),
                googleDrive: {
                    finalFolderName: moveResult.finalFolderName,
                    finalFolderId: moveResult.finalFolderId
                }
            });
        });

    } catch (error) {
        console.error('❌ Erro ao aprovar seleção:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao aprovar seleção',
            error: error.message
        });
    } finally {
        await session.endSession();
    }
});

/**
 * POST /api/selections/:selectionId/cancel
 * Cancelar seleção - voltar fotos para pasta original e marcar como disponível
 */
router.post('/:selectionId/cancel', async (req, res) => {
    const session = await mongoose.startSession();

    try {
        return await session.withTransaction(async () => {
            const { selectionId } = req.params;
            const { reason, adminUser } = req.body;

            console.log(`❌ Cancelando seleção ${selectionId}...`);

            // 1. Buscar seleção com dados completos
            const selection = await Selection.findOne({ selectionId })
                .populate('items.productId')
                .session(session);

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

            // 2. Reverter fotos no Google Drive usando caminhos originais
            console.log('🔄 Revertendo fotos para pastas originais...');

            const revertResults = [];

            for (const item of selection.items) {
                try {
                    // Usar originalPath para encontrar pasta de destino
                    const originalPath = item.originalPath;

                    if (!originalPath) {
                        console.warn(`⚠️ Item ${item.fileName} sem originalPath - usando fallback`);
                        revertResults.push({
                            success: false,
                            fileName: item.fileName,
                            error: 'originalPath não encontrado'
                        });
                        continue;
                    }

                    // Reverter foto usando GoogleDriveService
                    const revertResult = await GoogleDriveService.revertPhotoToOriginalLocation(
                        item.driveFileId,
                        originalPath
                    );

                    revertResults.push({
                        success: revertResult.success,
                        fileName: item.fileName,
                        driveFileId: item.driveFileId,
                        originalPath: originalPath,
                        error: revertResult.success ? null : revertResult.error
                    });

                } catch (error) {
                    console.error(`❌ Erro ao reverter foto ${item.fileName}:`, error);
                    revertResults.push({
                        success: false,
                        fileName: item.fileName,
                        error: error.message
                    });
                }
            }

            const successfulReverts = revertResults.filter(r => r.success).length;
            const failedReverts = revertResults.length - successfulReverts;

            console.log(`🔄 Reversão concluída: ${successfulReverts} sucessos, ${failedReverts} falhas`);

            // 3. Atualizar produtos: reserved_pending → available
            const productIds = selection.items.map(item => item.productId);

            await Product.updateMany(
                { _id: { $in: productIds } },
                {
                    $set: {
                        status: 'available'
                    },
                    $unset: {
                        'reservedBy': 1,
                        'reservedAt': 1,
                        'cartAddedAt': 1
                    }
                }
            ).session(session);

            // 4. Atualizar seleção
            selection.status = 'cancelled';
            selection.processedBy = adminUser || 'admin';
            selection.processedAt = new Date();
            selection.adminNotes = reason || 'Cancelada pelo admin';

            selection.addMovementLog('cancelled', `Seleção cancelada por ${adminUser || 'admin'}: ${reason || 'Sem motivo especificado'}`);
            selection.addMovementLog('photos_reverted', `${successfulReverts} fotos revertidas, ${failedReverts} falhas`);

            await selection.save({ session });

            // 5. Tentar limpar pasta vazia no RESERVED
            try {
                await GoogleDriveService.cleanupEmptyFolder(selection.googleDriveInfo.clientFolderId);
            } catch (cleanupError) {
                console.warn('⚠️ Erro ao limpar pasta vazia:', cleanupError.message);
            }

            console.log(`✅ Seleção ${selectionId} cancelada com sucesso`);

            res.json({
                success: true,
                message: 'Seleção cancelada com sucesso',
                selection: selection.getSummary(),
                reversion: {
                    total: revertResults.length,
                    successful: successfulReverts,
                    failed: failedReverts,
                    details: revertResults
                }
            });
        });

    } catch (error) {
        console.error('❌ Erro ao cancelar seleção:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao cancelar seleção',
            error: error.message
        });
    } finally {
        await session.endSession();
    }
});

module.exports = router;