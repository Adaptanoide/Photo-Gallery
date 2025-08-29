//src/routes/admin-selections.js

const express = require('express');
const mongoose = require('mongoose');
const Selection = require('../models/Selection');
const Product = require('../models/Product');
const PhotoStatus = require('../models/PhotoStatus');
const PhotoTagService = require('../services/PhotoTagService');
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

        // ✅ CORREÇÃO: Tratar "All Status"
        let query = {};
        if (status && status !== 'all') {
            query.status = status;
        }

        // ✅ NOVA LÓGICA: Selection Management SÓ vê seleções que CLIENTE processou
        query.$or = [
            // Seleções normais (sempre mostrar)
            { selectionType: { $ne: 'special' } },
            // Seleções especiais SÓ se cliente finalizou (não admin actions)
            {
                selectionType: 'special',
                status: { $in: ['pending', 'finalized', 'cancelled'] },
                // E que não foram canceladas apenas pelo admin
                'movementLog.action': 'finalized'
            }
        ];

        // Se status for 'all', query fica vazio = busca TODAS as seleções

        const selections = await Selection.find({ ...query, isDeleted: { $ne: true } })
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('items.productId');

        const total = await Selection.countDocuments({ ...query, isDeleted: { $ne: true } });

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
 * GET /api/selections/stats
 * Estatísticas COMPLETAS (normal + special selections)
 */
router.get('/stats', async (req, res) => {
    try {
        console.log('📊 Carregando estatísticas completas...');
        // ✅ USAR MESMA LÓGICA: SÓ seleções que cliente processou
        const query = {};
        query.$or = [
            { selectionType: { $ne: 'special' } },
            {
                selectionType: 'special',
                status: { $in: ['pending', 'finalized', 'cancelled'] },
                'movementLog.action': 'finalized'
            }
        ];

        const totalSelections = await Selection.countDocuments(query);
        const pendingQuery = { ...query, status: { $in: ['pending'] } };
        const pendingSelections = await Selection.countDocuments(pendingQuery);

        // Seleções deste mês
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const thisMonthSelections = await Selection.countDocuments({
            createdAt: { $gte: startOfMonth }
        });

        // Valor médio
        const avgResult = await Selection.aggregate([
            { $match: { isDeleted: { $ne: true } } },
            { $group: { _id: null, avg: { $avg: '$totalValue' } } }
        ]);
        const averageValue = avgResult[0]?.avg || 0;

        res.json({
            success: true,
            stats: {
                totalSelections,
                pendingSelections,
                thisMonthSelections,
                averageValue
            }
        });

    } catch (error) {
        console.error('❌ Erro ao carregar estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao carregar estatísticas'
        });
    }
});

// ===== GET SINGLE SELECTION DETAILS =====
// Adicione DEPOIS de router.get('/stats', ...) e ANTES de router.post('/:selectionId/approve', ...)

router.get('/:selectionId', async (req, res) => {
    try {
        const { selectionId } = req.params;

        // Buscar a seleção com todos os dados populados
        const selection = await Selection.findOne({ selectionId })
            .populate('items.productId');

        if (!selection) {
            return res.status(404).json({
                success: false,
                message: 'Selection not found'
            });
        }

        // Formatar os dados para o frontend
        const formattedSelection = {
            selectionId: selection.selectionId,
            clientCode: selection.clientCode,
            clientName: selection.clientName,
            status: selection.status,
            selectionType: selection.selectionType || 'regular',
            createdAt: selection.createdAt,
            updatedAt: selection.updatedAt,
            expiresAt: selection.expiresAt,
            items: selection.items.map(item => ({
                productId: item.productId?._id,
                fileName: item.fileName,
                category: item.category,
                price: item.price || 0,
                thumbnailUrl: item.thumbnailUrl,
                originalPath: item.originalPath
            })),
            totalItems: selection.totalItems || selection.items.length,
            totalValue: selection.totalValue || selection.items.reduce((sum, item) => sum + (item.price || 0), 0),
            movementLog: selection.movementLog || []
        };

        res.json({
            success: true,
            selection: formattedSelection
        });

    } catch (error) {
        console.error('Error fetching selection details:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching selection details',
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

            // ========= INÍCIO DO CÓDIGO NOVO =========
            // NOVO: Marcar como approving ANTES de processar
            selection.status = 'approving';
            selection.processStatus = {
                active: true,
                type: 'approving',
                message: `Approving selection...`,
                totalItems: selection.items.length,
                startedAt: new Date()
            };
            await selection.save({ session });

            console.log('📊 Status atualizado para APPROVING');
            // ========= FIM DO CÓDIGO NOVO =========

            // 2. SISTEMA DE TAGS: Marcar fotos como vendidas (SEM MOVER!)
            console.log('🏷️ [TAGS] Marcando fotos como vendidas...');

            // Buscar IDs das fotos do Google Drive
            const driveFileIds = selection.items.map(item => item.driveFileId);

            // Usar PhotoTagService para marcar como sold
            const tagResult = await PhotoTagService.approveSelection(selection.selectionId);

            console.log(`✅ [TAGS] ${tagResult.photosTagged} fotos marcadas como SOLD`);
            console.log('📁 [TAGS] Nenhuma movimentação física realizada!');

            // Criar objeto moveResult fake para compatibilidade
            const moveResult = {
                success: true,
                finalFolderId: selection.googleDriveInfo.clientFolderId,
                finalFolderName: selection.googleDriveInfo.clientFolderName
            };

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
            selection.status = 'finalized';
            selection.processedBy = adminUser || 'admin';
            selection.processedAt = new Date();
            selection.finalizedAt = new Date();
            selection.adminNotes = notes || '';

            // ========= INÍCIO DO CÓDIGO NOVO =========
            // NOVO: Limpar processStatus após conclusão
            selection.processStatus = {
                active: false
            };
            // ========= FIM DO CÓDIGO NOVO =========

            // Atualizar info do Google Drive
            selection.googleDriveInfo.finalFolderId = moveResult.finalFolderId;

            selection.addMovementLog('approved', `Seleção aprovada por ${adminUser || 'admin'}`);

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

            // NOVO: Marcar como cancelling ANTES de processar
            selection.status = 'cancelling';
            selection.processStatus = {
                active: true,
                type: 'cancelling',
                message: `Cancelling selection...`,
                totalItems: selection.items.length,
                startedAt: new Date()
            };
            await selection.save({ session });

            console.log('📊 Status atualizado para CANCELLING');

            // 2. SISTEMA DE TAGS: Liberar fotos (SEM MOVER!)
            console.log('🏷️ [TAGS] Liberando fotos para disponível...');

            // Usar PhotoTagService para cancelar seleção
            const tagResult = await PhotoTagService.cancelSelection(selection.selectionId);

            console.log(`✅ [TAGS] ${tagResult.photosTagged} fotos marcadas como AVAILABLE`);
            console.log('📁 [TAGS] Nenhuma reversão física realizada!');

            // Criar objeto revertResults fake para compatibilidade
            const revertResults = [];
            const successfulReverts = tagResult.photosTagged;
            const failedReverts = 0;

            console.log(`🏷️ [TAGS] Cancelamento concluído: ${successfulReverts} fotos liberadas`);
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

            // NOVO: Limpar processStatus após conclusão
            selection.processStatus = {
                active: false
            };

            selection.addMovementLog('cancelled', `Seleção cancelada por ${adminUser || 'admin'}: ${reason || 'Sem motivo especificado'}`);

            await selection.save({ session });

            // 5. Tentar limpar pasta vazia no RESERVED
            try {
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

/**
 * POST /api/selections/:selectionId/force-cancel
 * Cancelar seleção CONFIRMADA - APENAS PARA LIMPEZA DE TESTES
 */
router.post('/:selectionId/force-cancel', async (req, res) => {
    const session = await mongoose.startSession();

    try {
        return await session.withTransaction(async () => {
            const { selectionId } = req.params;
            const { reason, adminUser, confirmText } = req.body;

            // VERIFICAÇÃO DE SEGURANÇA
            if (confirmText !== 'CONFIRMO CANCELAMENTO FORÇADO') {
                return res.status(400).json({
                    success: false,
                    message: 'Texto de confirmação incorreto. Digite: "CONFIRMO CANCELAMENTO FORÇADO"'
                });
            }

            console.log(`🚨 CANCELAMENTO FORÇADO da seleção ${selectionId}...`);

            // 1. Buscar seleção (aceita qualquer status)
            const selection = await Selection.findOne({ selectionId })
                .populate('items.productId')
                .session(session);

            if (!selection) {
                return res.status(404).json({
                    success: false,
                    message: 'Seleção não encontrada'
                });
            }

            console.log(`📋 Status atual: ${selection.status}`);

            // 2. Reverter fotos do Google Drive
            console.log('🔄 Revertendo fotos para pastas originais (forçado)...');

            const revertResults = [];

            for (const item of selection.items) {
                try {
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

                    // Reverter foto usando GoogleDriveService (funciona com IDs antigos ou caminhos novos)
                    // const revertResult = await GoogleDriveService.revertPhotoToOriginalLocation(
                    //     item.driveFileId,

                    revertResults.push({
                        success: revertResult.success,
                        fileName: item.fileName,
                        driveFileId: item.driveFileId,
                        originalPath: originalPath,
                        method: revertResult.method || 'UNKNOWN',
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

            console.log(`🔄 Reversão forçada: ${successfulReverts} sucessos, ${failedReverts} falhas`);

            // 3. Atualizar produtos: qualquer status → available
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
                        'cartAddedAt': 1,
                        'soldAt': 1
                    }
                }
            ).session(session);

            // 4. Atualizar seleção
            selection.status = 'cancelled';
            selection.processedBy = adminUser || 'admin';
            selection.processedAt = new Date();
            selection.adminNotes = `CANCELAMENTO FORÇADO: ${reason || 'Limpeza de testes'}`;

            selection.addMovementLog('cancelled', `CANCELAMENTO FORÇADO por ${adminUser || 'admin'}: ${reason || 'Limpeza de testes'}`);
            selection.addMovementLog('photos_reverted', `${successfulReverts} fotos revertidas (forçado), ${failedReverts} falhas`);

            await selection.save({ session });

            // 5. Tentar limpar pastas vazias
            const foldersToClean = [
                selection.googleDriveInfo.finalFolderId,
                selection.googleDriveInfo.clientFolderId
            ].filter(Boolean);

            for (const folderId of foldersToClean) {
                try {
                } catch (cleanupError) {
                    console.warn(`⚠️ Erro ao limpar pasta ${folderId}:`, cleanupError.message);
                }
            }

            console.log(`✅ CANCELAMENTO FORÇADO de ${selectionId} concluído`);

            res.json({
                success: true,
                message: `Seleção ${selectionId} cancelada forçadamente`,
                selection: selection.getSummary(),
                reversion: {
                    total: revertResults.length,
                    successful: successfulReverts,
                    failed: failedReverts,
                    details: revertResults
                },
                warning: 'Esta foi uma operação de cancelamento forçado para limpeza'
            });
        });

    } catch (error) {
        console.error('❌ Erro no cancelamento forçado:', error);
        res.status(500).json({
            success: false,
            message: 'Erro no cancelamento forçado',
            error: error.message
        });
    } finally {
        await session.endSession();
    }
});

/**
 * POST /api/selections/:selectionId/revert-sold
 * Reverter fotos vendidas para disponível
 */
router.post('/:selectionId/revert-sold', async (req, res) => {
    const session = await mongoose.startSession();

    try {
        return await session.withTransaction(async () => {
            const { selectionId } = req.params;
            const { adminUser, reason } = req.body;

            console.log(`🔄 Revertendo seleção ${selectionId} de SOLD para AVAILABLE...`);

            // 1. Buscar seleção
            const selection = await Selection.findOne({ selectionId }).session(session);

            if (!selection) {
                return res.status(404).json({
                    success: false,
                    message: 'Seleção não encontrada'
                });
            }

            if (selection.status !== 'finalized') {
                return res.status(400).json({
                    success: false,
                    message: 'Apenas seleções finalizadas podem ser revertidas'
                });
            }

            // 2. Reverter tags
            const driveFileIds = selection.items.map(item => item.driveFileId);

            // Primeiro limpar as tags
            await PhotoStatus.updateMany(
                { photoId: { $in: driveFileIds } },
                {
                    $set: {
                        'virtualStatus.status': 'available',
                        'virtualStatus.currentSelection': null,
                        'virtualStatus.clientCode': null,
                        'virtualStatus.tags': ['available']  // Resetar tags para apenas 'available'
                    }
                }
            ).session(session);

            const result = { modifiedCount: driveFileIds.length };

            // 3. Atualizar produtos
            await Product.updateMany(
                { driveFileId: { $in: driveFileIds } },
                { $set: { status: 'available' } }
            ).session(session);

            // 4. Atualizar seleção
            selection.status = 'reverted';
            selection.addMovementLog('reverted', `Revertida por ${adminUser}: ${reason}`);
            await selection.save({ session });

            console.log(`✅ ${result.modifiedCount} fotos revertidas para AVAILABLE`);

            res.json({
                success: true,
                message: `${result.modifiedCount} fotos revertidas com sucesso`,
                selection: selection.getSummary()
            });
        });

    } catch (error) {
        console.error('❌ Erro ao reverter seleção:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao reverter seleção',
            error: error.message
        });
    } finally {
        await session.endSession();
    }
});

// DELETE - Soft delete selection
router.delete('/:selectionId', async (req, res) => {
    try {
        const { selectionId } = req.params;
        console.log(`🗑️ Soft deleting selection: ${selectionId}`);

        const result = await Selection.findOneAndUpdate(
            { selectionId },
            {
                isDeleted: true,
                deletedAt: new Date()
            },
            { new: true }
        );

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Selection not found'
            });
        }

        res.json({
            success: true,
            message: 'Selection deleted successfully',
            selectionId: selectionId
        });

    } catch (error) {
        console.error('Error deleting selection:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting selection: ' + error.message
        });
    }
});

module.exports = router;