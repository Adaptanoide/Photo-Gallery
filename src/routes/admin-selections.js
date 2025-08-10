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

        const selections = await Selection.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('items.productId');

        const total = await Selection.countDocuments(query);

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
            selection.status = 'finalized';
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

            // 2. Reverter fotos no Google Drive
            console.log('🔄 Revertendo fotos...');
            const revertResults = [];

            // Verificar se tem backup (Special Selections)
            if (selection.googleDriveInfo?.specialSelectionInfo?.originalPhotosBackup?.length > 0) {
                console.log('📦 Usando backup de Special Selection para reverter...');

                for (const backup of selection.googleDriveInfo.specialSelectionInfo.originalPhotosBackup) {
                    try {
                        console.log(`📸 Revertendo ${backup.photoId} para: ${backup.originalPath}`);

                        const revertResult = await GoogleDriveService.revertPhotoToOriginalLocation(
                            backup.photoId,
                            backup.originalPath
                        );

                        revertResults.push({
                            success: revertResult.success,
                            photoId: backup.photoId,
                            originalPath: backup.originalPath
                        });

                    } catch (error) {
                        console.warn(`⚠️ Erro ao reverter, usando fallback para raiz...`);

                        // Fallback: mover para raiz do estoque
                        await GoogleDriveService.movePhotoToSelection(
                            backup.photoId,
                            '1Ky3wSKKg_mmQihdxmiYwMuqE3-SBTcbx' // ACTUAL_PICTURES
                        );

                        revertResults.push({
                            success: true,
                            photoId: backup.photoId,
                            fallback: true
                        });
                    }
                }
            } else {
                // Seleções regulares - usar originalPath dos items
                console.log('📦 Processando seleção regular...');

                for (const item of selection.items) {
                    try {
                        // Verificar se tem originalPath
                        if (item.originalPath && item.originalPath !== 'unknown') {
                            console.log(`📸 Revertendo ${item.fileName} para: ${item.originalPath}`);

                            try {
                                const revertResult = await GoogleDriveService.revertPhotoToOriginalLocation(
                                    item.driveFileId,
                                    item.originalPath
                                );

                                revertResults.push({
                                    success: revertResult.success,
                                    fileName: item.fileName,
                                    originalPath: item.originalPath
                                });
                                continue; // Próximo item
                            } catch (error) {
                                console.warn(`⚠️ Erro ao reverter para caminho original, usando fallback...`);
                            }
                        }

                        // Fallback: mover para raiz se não tiver originalPath ou se falhar
                        console.log(`📦 Movendo ${item.fileName} para raiz (fallback)...`);
                        await GoogleDriveService.movePhotoToSelection(
                            item.driveFileId,
                            '1Ky3wSKKg_mmQihdxmiYwMuqE3-SBTcbx' // ACTUAL_PICTURES
                        );

                        revertResults.push({
                            success: true,
                            fileName: item.fileName,
                            driveFileId: item.driveFileId,
                            movedTo: 'Raiz do estoque (fallback)'
                        });

                    } catch (error) {
                        console.error(`❌ Erro ao mover ${item.fileName}:`, error);
                        revertResults.push({
                            success: false,
                            fileName: item.fileName,
                            error: error.message
                        });
                    }
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
                    const revertResult = await GoogleDriveService.revertPhotoToOriginalLocation(
                        item.driveFileId,
                        originalPath
                    );

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
                    await GoogleDriveService.cleanupEmptyFolder(folderId);
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

module.exports = router;