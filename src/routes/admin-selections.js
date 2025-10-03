//src/routes/admin-selections.js

const express = require('express');
const mongoose = require('mongoose');
const Selection = require('../models/Selection');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const PhotoTagService = require('../services/PhotoTagService');
const { authenticateToken } = require('./auth');
const router = express.Router();
const processingLocks = new Map();

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

        // Buscar TODAS as seleções primeiro (sem paginação)
        const allSelections = await Selection.find({ ...query, isDeleted: { $ne: true } })
            .lean();

        // ✅ ORDENAR POR PRIORIDADE DE STATUS
        const statusOrder = {
            'pending': 1,      // Primeiro - precisam de ação
            'finalized': 2,    // Segundo - já processadas (SOLD)
            'cancelled': 3,    // Terceiro - canceladas
            'confirmed': 4,    // Quarto - confirmadas
            'reverted': 5      // Quinto - revertidas
        };

        allSelections.sort((a, b) => {
            // Primeiro, ordenar por status
            const statusA = statusOrder[a.status] || 999;
            const statusB = statusOrder[b.status] || 999;

            if (statusA !== statusB) {
                return statusA - statusB;
            }

            // Se mesmo status, ordenar por data (mais recente primeiro)
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // Aplicar paginação DEPOIS da ordenação
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedSelections = allSelections.slice(startIndex, endIndex);

        const total = allSelections.length;

        res.json({
            success: true,
            selections: paginatedSelections.map(s => ({
                selectionId: s.selectionId,
                clientCode: s.clientCode,
                clientName: s.clientName,
                clientCompany: s.clientCompany || '-',
                salesRep: s.salesRep || 'Unassigned',
                totalItems: s.totalItems,
                totalValue: s.totalValue,
                status: s.status,
                createdAt: s.createdAt,
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

        const Selection = require('../models/Selection');

        // Filtro base: excluir deletadas E canceladas
        const baseFilter = {
            $and: [
                {
                    $or: [
                        { isDeleted: { $exists: false } },
                        { isDeleted: false }
                    ]
                },
                { status: { $nin: ['cancelled', 'cancelling'] } }
            ]
        };

        // PENDING: apenas não deletadas e status pending
        const pendingFilter = {
            $and: [
                {
                    $or: [
                        { isDeleted: { $exists: false } },
                        { isDeleted: false }
                    ]
                },
                { status: 'pending' }
            ]
        };

        const totalSelections = await Selection.countDocuments(baseFilter);
        const pendingSelections = await Selection.countDocuments(pendingFilter);

        console.log(`📊 Total: ${totalSelections}, Pending: ${pendingSelections}`);

        // Seleções deste mês
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const thisMonthSelections = await Selection.countDocuments({
            ...baseFilter,
            createdAt: { $gte: startOfMonth }
        });

        // Valor médio
        const avgResult = await Selection.aggregate([
            { $match: baseFilter },
            { $group: { _id: null, avg: { $avg: '$totalValue' } } }
        ]);
        const averageValue = avgResult[0]?.avg || 0;

        // SOLD PHOTOS: contar fotos em selections finalizadas (não deletadas)
        const soldPhotosResult = await Selection.aggregate([
            {
                $match: {
                    status: 'finalized',
                    $or: [
                        { isDeleted: { $exists: false } },
                        { isDeleted: false }
                    ]
                }
            },
            {
                $group: {
                    _id: null,
                    totalItems: { $sum: '$totalItems' }
                }
            }
        ]);

        const soldPhotosCount = soldPhotosResult[0]?.totalItems || 0;

        console.log(`📊 Sold Photos: ${soldPhotosCount}`);

        res.json({
            success: true,
            stats: {
                totalSelections,
                pendingSelections,
                thisMonthSelections,
                averageValue,
                soldPhotosCount
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
            clientCompany: selection.clientCompany || selection.clientName,
            salesRep: selection.salesRep || 'Unassigned',
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
    const { selectionId } = req.params;

    // PROTEÇÃO CONTRA DUPLO PROCESSAMENTO
    if (processingLocks.has(selectionId)) {
        console.log(`⚠️ Aprovação já em andamento para ${selectionId}`);
        return res.status(409).json({
            success: false,
            message: 'Aprovação já está em andamento'
        });
    }

    // Adicionar lock
    processingLocks.set(selectionId, true);

    const session = await mongoose.startSession();

    try {
        // INICIAR TRANSAÇÃO MANUALMENTE (SEM RETRY)
        await session.startTransaction({
            readConcern: { level: "local" },
            writeConcern: { w: 1 },
            maxTimeMS: 30000
        });

        const { adminUser, notes } = req.body;
        console.log(`✅ Aprovando seleção ${selectionId}...`);

        // 1. Buscar seleção
        const selection = await Selection.findOne({ selectionId }).session(session);

        if (!selection) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: 'Seleção não encontrada'
            });
        }

        // VERIFICAR SE JÁ ESTÁ PROCESSANDO
        if (selection.status === 'approving' || selection.status === 'finalized') {
            await session.abortTransaction();
            console.log(`⚠️ Seleção ${selectionId} já está ${selection.status}`);
            return res.status(409).json({
                success: false,
                message: `Seleção já está ${selection.status}`
            });
        }

        if (selection.status !== 'pending') {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Apenas seleções pendentes podem ser aprovadas'
            });
        }

        // Marcar como approving
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

        // 2. SISTEMA DE TAGS: Marcar fotos como vendidas
        console.log('🏷️ [TAGS] Marcando fotos como vendidas...');

        // IMPORTANTE: NÃO chamar PhotoTagService dentro da transação
        // Vamos fazer o update diretamente
        const updateResult = await UnifiedProductComplete.updateMany(
            { selectionId: selectionId },
            {
                $set: {
                    status: 'sold',
                    cdeStatus: 'CONFIRMED',
                    soldAt: new Date()
                },
                $unset: { 'reservedBy': 1 }
            }
        ).session(session);

        console.log(`✅ [TAGS] ${updateResult.modifiedCount} fotos marcadas como SOLD`);
        console.log('📁 [TAGS] Nenhuma movimentação física realizada!');

        // 3. Atualizar seleção para finalized
        selection.status = 'finalized';
        selection.processedBy = adminUser || 'admin';
        selection.processedAt = new Date();
        selection.finalizedAt = new Date();
        selection.adminNotes = notes || '';
        selection.processStatus = { active: false };

        // Adicionar ao log
        if (selection.addMovementLog) {
            selection.addMovementLog('approved', `Seleção aprovada por ${adminUser || 'admin'}`);
        } else {
            selection.movementLog = selection.movementLog || [];
            selection.movementLog.push({
                action: 'approved',
                timestamp: new Date(),
                details: `Seleção aprovada por ${adminUser || 'admin'}`
            });
        }

        await selection.save({ session });

        // COMMIT MANUAL
        await session.commitTransaction();
        console.log(`✅ Seleção ${selectionId} aprovada com sucesso`);

        res.json({
            success: true,
            message: 'Seleção aprovada com sucesso',
            selection: {
                selectionId: selection.selectionId,
                status: selection.status,
                totalItems: selection.totalItems,
                totalValue: selection.totalValue
            }
        });

    } catch (error) {
        console.error('❌ Erro ao aprovar seleção:', error);

        // Abortar transação se ainda estiver ativa
        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        res.status(500).json({
            success: false,
            message: 'Erro ao aprovar seleção',
            error: error.message
        });
    } finally {
        // SEMPRE limpar
        processingLocks.delete(selectionId);
        await session.endSession();
    }
});

router.post('/:selectionId/cancel', async (req, res) => {
    const { selectionId } = req.params;

    // PROTEÇÃO CONTRA DUPLO PROCESSAMENTO
    if (processingLocks.has(selectionId)) {
        console.log(`⚠️ Cancelamento já em andamento para ${selectionId}`);
        return res.status(409).json({
            success: false,
            message: 'Cancelamento já está em andamento'
        });
    }

    // Adicionar lock
    processingLocks.set(selectionId, true);

    const session = await mongoose.startSession();

    try {
        // INICIAR TRANSAÇÃO MANUALMENTE (SEM RETRY)
        await session.startTransaction({
            readConcern: { level: "local" },
            writeConcern: { w: 1 },
            maxTimeMS: 30000
        });

        const { reason, adminUser } = req.body;
        console.log(`❌ Cancelando seleção ${selectionId}...`);

        // 1. Buscar seleção
        const selection = await Selection.findOne({ selectionId }).session(session);

        if (!selection) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: 'Seleção não encontrada'
            });
        }

        // VERIFICAR SE JÁ ESTÁ PROCESSANDO
        if (selection.status === 'cancelling' || selection.status === 'cancelled') {
            await session.abortTransaction();
            console.log(`⚠️ Seleção ${selectionId} já está ${selection.status}`);
            return res.status(409).json({
                success: false,
                message: `Seleção já está ${selection.status}`
            });
        }

        if (selection.status !== 'pending' && selection.status !== 'finalized') {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Only pending or finalized selections can be cancelled'
            });
        }

        // Marcar como cancelling
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

        // 2. Liberar fotos no MongoDB
        console.log('🏷️ [TAGS] Liberando fotos para disponível...');

        const productIds = selection.items.map(item => item.productId);

        const updateResult = await UnifiedProductComplete.updateMany(
            { _id: { $in: productIds } },
            {
                $set: {
                    status: 'available',
                    cdeStatus: 'INGRESADO'
                },
                $unset: {
                    'reservedBy': 1,
                    'reservationInfo': 1,
                    'soldAt': 1,
                    'reservedAt': 1,
                    'cartAddedAt': 1,
                    'selectionId': 1
                }
            }
        ).session(session);

        console.log(`✅ [TAGS] ${updateResult.modifiedCount} fotos liberadas`);

        // 3. Liberar no CDE (FORA da transação principal para evitar timeout)
        const CDEWriter = require('../services/CDEWriter');
        const cdeResults = [];
        const failedReleases = [];

        for (const item of selection.items) {
            const photoMatch = item.fileName?.match(/(\d+)/);
            if (!photoMatch) continue;

            const photoNumber = photoMatch[1];
            let releaseSuccess = false;
            let attempts = 0;
            const MAX_ATTEMPTS = 3;

            while (!releaseSuccess && attempts < MAX_ATTEMPTS) {
                attempts++;

                try {
                    const currentCDEStatus = await CDEWriter.checkStatus(photoNumber);

                    if (currentCDEStatus?.status === 'INGRESADO') {
                        console.log(`[CANCEL] ✅ Foto ${photoNumber} já está INGRESADO`);
                        releaseSuccess = true;
                        cdeResults.push({ photo: photoNumber, success: true, alreadyFree: true });
                    } else {
                        const released = await CDEWriter.markAsAvailable(photoNumber);

                        if (released) {
                            console.log(`[CANCEL] ✅ Foto ${photoNumber} liberada no CDE`);
                            releaseSuccess = true;
                            cdeResults.push({ photo: photoNumber, success: true, attempts });
                        } else if (attempts < MAX_ATTEMPTS) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                } catch (cdeError) {
                    console.error(`[CANCEL] Erro ao liberar ${photoNumber}:`, cdeError.message);
                    if (attempts >= MAX_ATTEMPTS) {
                        failedReleases.push({
                            photo: photoNumber,
                            error: cdeError.message,
                            attempts
                        });
                    }
                }
            }

            if (!releaseSuccess) {
                cdeResults.push({ photo: photoNumber, success: false, attempts });
                failedReleases.push({ photo: photoNumber, attempts });
            }
        }

        const successCount = cdeResults.filter(r => r.success).length;
        const failedCount = cdeResults.filter(r => !r.success).length;

        console.log(`[CANCEL] CDE: ${successCount}/${selection.items.length} fotos liberadas`);

        // 4. Atualizar seleção para cancelled
        selection.status = 'cancelled';
        selection.processedBy = adminUser || 'admin';
        selection.processedAt = new Date();
        selection.adminNotes = reason || 'Cancelada pelo admin';
        selection.processStatus = { active: false };

        // Adicionar ao log
        if (selection.addMovementLog) {
            selection.addMovementLog('cancelled', `Cancelada por ${adminUser || 'admin'}: ${reason || 'Sem motivo'}`);
        } else {
            selection.movementLog = selection.movementLog || [];
            selection.movementLog.push({
                action: 'cancelled',
                timestamp: new Date(),
                details: `Cancelada por ${adminUser || 'admin'}: ${reason || 'Sem motivo'}`
            });
        }

        if (failedCount > 0) {
            selection.movementLog.push({
                action: 'cde_release_partial',
                timestamp: new Date(),
                details: `${failedCount} fotos não liberadas no CDE`,
                failedPhotos: failedReleases
            });
        }

        await selection.save({ session });

        // COMMIT MANUAL
        await session.commitTransaction();
        console.log(`✅ Seleção ${selectionId} cancelada com sucesso`);

        // Resposta
        const responseData = {
            success: true,
            message: 'Seleção cancelada com sucesso',
            selection: {
                selectionId: selection.selectionId,
                status: selection.status
            },
            cdeRelease: {
                total: selection.items.length,
                successful: successCount,
                failed: failedCount
            }
        };

        if (failedCount > 0) {
            responseData.warning = `${failedCount} fotos precisam ser liberadas manualmente no CDE`;
            responseData.cdeRelease.details = failedReleases;
        }

        res.json(responseData);

    } catch (error) {
        console.error('❌ Erro ao cancelar seleção:', error);

        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        res.status(500).json({
            success: false,
            message: 'Erro ao cancelar seleção',
            error: error.message
        });
    } finally {
        processingLocks.delete(selectionId);
        await session.endSession();
    }
});

/**
 * POST /api/selections/:selectionId/reopen-cart
 * Reabrir carrinho para cliente - permitir edição da seleção
 */
router.post('/:selectionId/reopen-cart', async (req, res) => {
    const { selectionId } = req.params;

    // Proteção contra duplo processamento
    if (processingLocks.has(`reopen_${selectionId}`)) {
        return res.status(409).json({
            success: false,
            message: 'Reabertura já está em andamento'
        });
    }

    processingLocks.set(`reopen_${selectionId}`, true);

    const session = await mongoose.startSession();

    try {
        await session.startTransaction({
            readConcern: { level: "local" },
            writeConcern: { w: 1 },
            maxTimeMS: 30000
        });

        const { adminUser } = req.body;
        console.log(`🔄 Reabrindo carrinho para seleção ${selectionId}...`);

        // 1. Buscar seleção
        const selection = await Selection.findOne({ selectionId }).session(session);

        if (!selection) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: 'Seleção não encontrada'
            });
        }

        // Só permite reabrir seleções PENDING
        if (selection.status !== 'pending') {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: `Apenas seleções PENDING podem ser reabertas (atual: ${selection.status})`
            });
        }

        console.log(`📋 Seleção encontrada: ${selection.totalItems} items`);

        // 2. Verificar status das fotos no CDE
        const CDEWriter = require('../services/CDEWriter');
        const photoNumbers = [];
        const validItems = [];
        const ghostItems = [];

        for (const item of selection.items) {
            const photoMatch = item.fileName?.match(/(\d+)/);
            if (!photoMatch) continue;

            const photoNumber = photoMatch[1].padStart(5, '0');
            photoNumbers.push(photoNumber);

            // Verificar status atual no CDE
            const cdeStatus = await CDEWriter.checkStatus(photoNumber);

            if (cdeStatus && cdeStatus.status === 'CONFIRMED') {
                // Foto está OK para reabrir
                validItems.push({
                    productId: item.productId,
                    driveFileId: item.driveFileId,
                    fileName: item.fileName,
                    category: item.category,
                    thumbnailUrl: item.thumbnailUrl,
                    price: item.price,
                    photoNumber: photoNumber
                });
            } else if (cdeStatus && cdeStatus.status === 'RETIRADO') {
                // Foto já foi vendida - virar ghost
                ghostItems.push({ ...item, photoNumber, reason: 'Já vendida' });
            } else {
                // Outros estados - considerar válida por enquanto
                validItems.push({
                    productId: item.productId,
                    driveFileId: item.driveFileId,
                    fileName: item.fileName,
                    category: item.category,
                    thumbnailUrl: item.thumbnailUrl,
                    price: item.price,
                    photoNumber: photoNumber
                });
            }
        }

        console.log(`✅ Fotos válidas: ${validItems.length}`);
        console.log(`👻 Ghost items: ${ghostItems.length}`);

        if (validItems.length === 0) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Todas as fotos já foram vendidas. Não é possível reabrir.'
            });
        }

        // 3. Reativar cliente
        const AccessCode = require('../models/AccessCode');
        await AccessCode.updateOne(
            { code: selection.clientCode },
            { $set: { isActive: true } }
        ).session(session);
        console.log(`✅ Cliente ${selection.clientCode} reativado`);

        // 4. Criar novo carrinho
        const Cart = require('../models/Cart');
        const newSessionId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24h

        const newCart = new Cart({
            sessionId: newSessionId,
            clientCode: selection.clientCode,
            clientName: selection.clientName,
            items: validItems.map(item => ({
                productId: item.productId,
                driveFileId: item.driveFileId,
                fileName: item.fileName,
                category: item.category,
                thumbnailUrl: item.thumbnailUrl,
                price: item.price || 0,
                basePrice: item.price || 0,
                expiresAt: expiresAt,
                addedAt: new Date()
            })),
            totalItems: validItems.length,
            isActive: true
        });

        await newCart.save({ session });
        console.log(`🛒 Novo carrinho criado: ${newSessionId} com ${validItems.length} items`);

        // 5. Atualizar produtos no MongoDB
        const productIds = validItems.map(item => item.productId);

        await UnifiedProductComplete.updateMany(
            { _id: { $in: productIds } },
            {
                $set: {
                    status: 'reserved',
                    cdeStatus: 'PRE-SELECTED',
                    reservedBy: {
                        clientCode: selection.clientCode,
                        sessionId: newSessionId,
                        expiresAt: expiresAt
                    }
                },
                $unset: {
                    selectionId: 1,
                    soldAt: 1
                }
            }
        ).session(session);
        console.log(`✅ ${productIds.length} produtos atualizados no MongoDB`);

        // 6. Atualizar fotos no CDE: CONFIRMED → PRE-SELECTED
        let cdeUpdateCount = 0;
        for (const item of validItems) {
            try {
                const success = await CDEWriter.markAsReserved(
                    item.photoNumber,
                    selection.clientCode,
                    selection.clientName
                );
                if (success) cdeUpdateCount++;
            } catch (error) {
                console.error(`[CDE] Erro ao marcar ${item.photoNumber}:`, error.message);
            }
        }
        console.log(`[CDE] ✅ ${cdeUpdateCount}/${validItems.length} fotos voltaram para PRE-SELECTED`);

        // 7. Marcar Selection como reopened E ocultar da lista
        selection.reopenedAt = new Date();
        selection.reopenedBy = adminUser || 'admin';
        selection.reopenCount = (selection.reopenCount || 0) + 1;
        selection.isDeleted = true;  // ✅ ADICIONAR ESTA LINHA - Oculta da lista
        selection.deletedAt = new Date();  // ✅ ADICIONAR ESTA LINHA

        selection.addMovementLog(
            'auto_return',
            `Carrinho reaberto para edição pelo admin ${adminUser || 'admin'}`,
            true,
            null,
            {
                newSessionId: newSessionId,
                validItems: validItems.length,
                ghostItems: ghostItems.length
            }
        );

        await selection.save({ session });
        console.log(`✅ Selection marcada como reopened`);

        // Commit da transação
        await session.commitTransaction();
        console.log(`✅ Carrinho reaberto com sucesso!`);

        res.json({
            success: true,
            message: 'Carrinho reaberto com sucesso',
            data: {
                newSessionId: newSessionId,
                clientCode: selection.clientCode,
                validItems: validItems.length,
                ghostItems: ghostItems.length,
                expiresAt: expiresAt,
                warning: ghostItems.length > 0 ?
                    `${ghostItems.length} fotos não puderam ser reabertas (já vendidas)` : null
            }
        });

    } catch (error) {
        console.error('❌ Erro ao reabrir carrinho:', error);

        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        res.status(500).json({
            success: false,
            message: 'Erro ao reabrir carrinho',
            error: error.message
        });
    } finally {
        processingLocks.delete(`reopen_${selectionId}`);
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

            await UnifiedProductComplete.updateMany(
                { _id: { $in: productIds } },
                {
                    $set: {
                        status: 'available',
                        cdeStatus: 'INGRESADO'
                    },
                    $unset: {
                        'reservedBy': 1,
                        'reservationInfo': 1,
                        'soldAt': 1,
                        'reservedAt': 1,
                        'cartAddedAt': 1
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

            console.log(`🔄 Revertendo seleção ${selectionId} de SOLD para PENDING...`);

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

            // 2. Buscar e atualizar produtos
            const driveFileIds = selection.items.map(item => item.driveFileId);

            // UM ÚNICO UPDATE que faz tudo
            await UnifiedProductComplete.updateMany(
                { driveFileId: { $in: driveFileIds } },
                {
                    $set: {
                        status: 'reserved_pending',
                        cdeStatus: 'PRE-SELECTED'
                    },
                    $unset: {
                        'soldAt': 1  // Remove apenas a data de venda
                    }
                }
            ).session(session);

            // 3. Atualizar seleção
            selection.status = 'pending';  // Volta para pending, não reverted
            selection.addMovementLog('reverted', `Revertida por ${adminUser}: ${reason}`);
            await selection.save({ session });

            console.log(`✅ ${driveFileIds.length} fotos revertidas para PENDING`);

            res.json({
                success: true,
                message: `${driveFileIds.length} fotos revertidas com sucesso`,
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

// Rota para remover múltiplos items de uma seleção
router.post('/:selectionId/remove-items', async (req, res) => {
    try {
        const { selectionId } = req.params;
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No items provided'
            });
        }

        // Buscar a seleção
        const Selection = require('../models/Selection');
        const selection = await Selection.findOne({ selectionId });

        if (!selection) {
            return res.status(404).json({
                success: false,
                message: 'Selection not found'
            });
        }

        // Verificar se pode editar
        if (selection.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Cannot modify cancelled selections'
            });
        }

        const UnifiedProductComplete = require('../models/UnifiedProductComplete');
        const CDEWriter = require('../services/CDEWriter');
        const removedItems = [];

        // Processar cada item para remoção
        for (const itemToRemove of items) {
            const itemIndex = selection.items.findIndex(item =>
                item.fileName === itemToRemove.fileName
            );

            if (itemIndex !== -1) {
                const removedItem = selection.items[itemIndex];

                // Liberar a foto no MongoDB
                const photoNumber = removedItem.fileName.replace('.webp', '');
                await UnifiedProductComplete.updateOne(
                    {
                        $or: [
                            { photoNumber: photoNumber },
                            { fileName: removedItem.fileName }
                        ]
                    },
                    {
                        $set: {
                            status: 'available',
                            cdeStatus: 'INGRESADO'
                        },
                        $unset: {
                            selectionId: '',
                            reservedBy: '',
                            soldAt: '',
                            reservedAt: ''
                        }
                    }
                );

                // Atualizar status no CDE para INGRESADO
                await CDEWriter.markAsAvailable(photoNumber, removedItem.driveFileId);

                // Remover da seleção
                selection.items.splice(itemIndex, 1);
                removedItems.push(removedItem);
            }
        }

        // Atualizar totais
        selection.totalItems = selection.items.length;
        selection.totalValue = selection.items.reduce((sum, item) => sum + (item.price || 0), 0);

        // Adicionar ao log
        selection.movementLog.push({
            action: 'cancelled',
            timestamp: new Date(),
            details: `${removedItems.length} items removed by admin`,
            items: removedItems.map(i => i.fileName),
            success: true
        });

        // Se não sobrou nenhum item, cancelar a seleção
        if (selection.items.length === 0) {
            selection.status = 'cancelled';
            selection.movementLog.push({
                action: 'cancelled',
                timestamp: new Date(),
                details: 'Selection cancelled - no items remaining',
                success: true
            });
        }

        await selection.save();

        res.json({
            success: true,
            message: `${removedItems.length} items removed successfully`,
            data: {
                updatedSelection: selection,
                removedCount: removedItems.length,
                remainingCount: selection.items.length
            }
        });

    } catch (error) {
        console.error('Error removing items:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing items',
            error: error.message
        });
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