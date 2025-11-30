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
            selections: paginatedSelections.map(s => {
                // Buscar últimas correções automáticas no movementLog
                const autoCorrections = (s.movementLog || []).filter(log =>
                    log.action === 'item_auto_removed'
                ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                const hasAutoCorrection = autoCorrections.length > 0;
                const lastCorrection = hasAutoCorrection ? autoCorrections[0] : null;

                return {
                    selectionId: s.selectionId,
                    clientCode: s.clientCode,
                    clientName: s.clientName,
                    clientCompany: s.clientCompany || '-',
                    salesRep: s.salesRep || 'Unassigned',
                    totalItems: s.totalItems,
                    totalValue: s.totalValue,
                    status: s.status,
                    createdAt: s.createdAt,
                    googleDriveInfo: s.googleDriveInfo,
                    // Novos campos para alertas
                    hasAutoCorrection: hasAutoCorrection,
                    lastAutoCorrection: s.lastAutoCorrection,
                    priceReviewRequired: s.priceReviewRequired || false,
                    autoCorrections: autoCorrections.map(ac => ({
                        timestamp: ac.timestamp,
                        details: ac.details,
                        extraData: ac.extraData || {}
                    }))
                };
            }),
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
            customerNotes: selection.customerNotes,
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

        // 2. Liberar fotos no MongoDB
        console.log('🏷️ [TAGS] Liberando fotos para disponível...');

        const productIds = selection.items.map(item => item.productId);

        // ✅ DETECTAR SE É COMING SOON
        const isComingSoon = selection.galleryType === 'coming_soon';
        const correctCDEStatus = isComingSoon ? 'PRE-TRANSITO' : 'INGRESADO';
        console.log(`🚢 Tipo: ${selection.galleryType} → Status CDE: ${correctCDEStatus}`);

        const updateResult = await UnifiedProductComplete.updateMany(
            { _id: { $in: productIds } },
            {
                $set: {
                    status: 'available',
                    cdeStatus: correctCDEStatus  // ✅ PRE-TRANSITO ou INGRESADO
                },
                $unset: {
                    'reservedBy': 1,
                    'reservationInfo': 1,
                    'soldAt': 1,
                    'reservedAt': 1,
                    'cartAddedAt': 1,
                    'selectionId': 1
                    // ✅ NÃO remove transitStatus nem cdeTable!
                }
            }
        ).session(session);

        console.log(`✅ ${updateResult.modifiedCount} fotos liberadas com status: ${correctCDEStatus}`);

        // 3. Liberar no CDE EM BACKGROUND usando BULK UPDATE
        console.log('📡 Liberando fotos no CDE em background...');
        const CDEWriter = require('../services/CDEWriter');

        // ✅ Extrair números E TABELAS das fotos
        const photoNumbers = selection.items
            .map(item => item.fileName?.match(/(\d+)/)?.[1])
            .filter(Boolean);

        const cdeTables = selection.items.map(item => item.cdeTable || 'tbinventario');

        console.log(`[CANCEL] 🚀 Liberação BULK de ${photoNumbers.length} fotos agendada em background`);
        console.log(`[CANCEL] 📊 Tabelas: ${cdeTables.filter(t => t === 'tbetiqueta').length} em tbetiqueta, ${cdeTables.filter(t => t === 'tbinventario').length} em tbinventario`);

        // Processar em background usando BULK UPDATE
        setImmediate(async () => {
            console.log(`[CANCEL-BG] Iniciando liberação BULK de ${photoNumbers.length} fotos...`);

            const startTime = Date.now();

            try {
                // ✅ PASSAR cdeTables!
                const releasedCount = await CDEWriter.bulkMarkAsAvailable(photoNumbers, cdeTables);

                const duration = Date.now() - startTime;
                const failedCount = photoNumbers.length - releasedCount;

                console.log(`[CANCEL-BG] ✅ Liberação BULK concluída em ${duration}ms`);
                console.log(`[CANCEL-BG] 📊 Resultado: ${releasedCount}/${photoNumbers.length} sucessos, ${failedCount} falhas`);

                if (failedCount > 0) {
                    console.log(`[CANCEL-BG] ⚠️ ${failedCount} fotos não foram liberadas (sync vai corrigir automaticamente)`);
                }
            } catch (error) {
                console.error(`[CANCEL-BG] ❌ Erro no bulk release:`, error.message);
                console.log(`[CANCEL-BG] ℹ️ Sync vai corrigir automaticamente em até 5 minutos`);
            }
        });

        console.log('[CANCEL] ⚡ Admin não precisa esperar - resposta imediata');

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

        await selection.save({ session });

        // COMMIT MANUAL
        await session.commitTransaction();
        console.log(`✅ Seleção ${selectionId} cancelada com sucesso`);

        // Resposta simplificada (CDE processa em background)
        res.json({
            success: true,
            message: 'Seleção cancelada com sucesso',
            selection: {
                selectionId: selection.selectionId,
                status: selection.status,
                totalItems: selection.items.length
            },
            info: 'CDE está sendo atualizado em background'
        });

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

        // 2. Preparar TODAS as fotos para o carrinho
        const validItems = selection.items.map(item => {
            const photoMatch = item.fileName?.match(/(\d+)/);
            const photoNumber = photoMatch ? photoMatch[1].padStart(5, '0') : null;

            return {
                productId: item.productId,
                driveFileId: item.driveFileId,
                fileName: item.fileName,
                category: item.category,
                thumbnailUrl: item.thumbnailUrl,
                price: item.price,
                photoNumber: photoNumber
            };
        }).filter(item => item.photoNumber !== null);

        // 3. Reativar cliente
        const AccessCode = require('../models/AccessCode');
        await AccessCode.updateOne(
            { code: selection.clientCode },
            { $set: { isActive: true } }
        ).session(session);

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

        // 6. Atualizar CDE em BACKGROUND (BULK)
        const CDEWriter = require('../services/CDEWriter');
        const photoNumbers = validItems.map(item => item.photoNumber).filter(Boolean);

        console.log(`[REOPEN] 🚀 Reserva BULK de ${photoNumbers.length} fotos agendada em background`);

        // Processar em background (não bloqueia resposta)
        setImmediate(async () => {
            console.log(`[REOPEN-BG] Iniciando reserva BULK de ${photoNumbers.length} fotos...`);
            const startTime = Date.now();

            try {
                const reservedCount = await CDEWriter.bulkMarkAsReserved(
                    photoNumbers,
                    selection.clientCode,
                    selection.clientName
                );

                const duration = Date.now() - startTime;
                console.log(`[REOPEN-BG] ✅ Reserva BULK concluída em ${duration}ms`);
                console.log(`[REOPEN-BG] 📊 Resultado: ${reservedCount}/${photoNumbers.length} fotos reservadas no CDE`);
            } catch (error) {
                console.error(`[REOPEN-BG] ❌ Erro no bulk reserve:`, error.message);
                console.log(`[REOPEN-BG] ℹ️ Sync vai corrigir em até 5 minutos`);
            }
        });

        console.log('[REOPEN] ⚡ Admin não precisa esperar - resposta imediata');

        // 7. Marcar Selection como reopened E ocultar da lista
        selection.reopenedAt = new Date();
        selection.reopenedBy = adminUser || 'admin';
        selection.reopenCount = (selection.reopenCount || 0) + 1;
        selection.isDeleted = true;
        selection.deletedAt = new Date();

        // Adicionar log manualmente (evita problemas com save)
        if (!selection.movementLog) {
            selection.movementLog = [];
        }
        selection.movementLog.push({
            action: 'auto_return',
            timestamp: new Date(),
            details: `Carrinho reaberto para edição pelo admin ${adminUser || 'admin'}`,
            success: true,
            error: null,
            metadata: {
                newSessionId: newSessionId,
                validItems: validItems.length
            }
        });

        // SALVAR TUDO DE UMA VEZ
        await selection.save({ session });
        console.log(`✅ Selection marcada como reopened (isDeleted=true)`);

        // Commit da transação
        await session.commitTransaction();
        console.log(`✅ Carrinho reaberto com sucesso!`);

        res.json({
            success: true,
            message: 'Carrinho reaberto com sucesso',
            data: {
                newSessionId: newSessionId,
                clientCode: selection.clientCode,
                totalItems: validItems.length,
                expiresAt: expiresAt
            },
            info: 'CDE está sendo atualizado em background'
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
        const photoNumbersToRelease = [];

        // PRIMEIRA PASSADA: Identificar items e preparar dados
        for (const itemToRemove of items) {
            const itemIndex = selection.items.findIndex(item =>
                item.fileName === itemToRemove.fileName
            );

            if (itemIndex !== -1) {
                const removedItem = selection.items[itemIndex];
                const photoNumber = removedItem.fileName.replace('.webp', '');

                // Guardar para processar
                removedItems.push(removedItem);
                photoNumbersToRelease.push(photoNumber);

                // Remover da seleção
                selection.items.splice(itemIndex, 1);
            }
        }

        if (removedItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Nenhum item foi encontrado para remover'
            });
        }

        console.log(`🗑️ Removendo ${removedItems.length} items da seleção ${selectionId}`);

        // SEGUNDA PASSADA: Atualizar MongoDB (BULK)
        await UnifiedProductComplete.updateMany(
            {
                $or: removedItems.map(item => ({
                    fileName: item.fileName
                }))
            },
            {
                $set: {
                    status: 'available',
                    cdeStatus: 'INGRESADO'
                },
                $unset: {
                    selectionId: 1,
                    reservedBy: 1,
                    soldAt: 1,
                    reservedAt: 1
                }
            }
        );

        // TERCEIRA PASSADA: Atualizar CDE em BACKGROUND (BULK)
        console.log(`[REMOVE] 🚀 Liberação BULK de ${photoNumbersToRelease.length} fotos agendada em background`);

        setImmediate(async () => {
            console.log(`[REMOVE-BG] Iniciando liberação BULK de ${photoNumbersToRelease.length} fotos...`);
            const startTime = Date.now();

            try {
                const releasedCount = await CDEWriter.bulkMarkAsAvailable(photoNumbersToRelease);

                const duration = Date.now() - startTime;
                console.log(`[REMOVE-BG] ✅ Liberação BULK concluída em ${duration}ms`);
                console.log(`[REMOVE-BG] 📊 Resultado: ${releasedCount}/${photoNumbersToRelease.length} fotos liberadas no CDE`);
            } catch (error) {
                console.error(`[REMOVE-BG] ❌ Erro no bulk release:`, error.message);
                console.log(`[REMOVE-BG] ℹ️ Sync vai corrigir em até 5 minutos`);
            }
        });

        console.log('[REMOVE] ⚡ Admin não precisa esperar - resposta imediata');

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
            console.log(`❌ Seleção ${selectionId} cancelada - nenhum item restante`);
        }

        await selection.save();

        res.json({
            success: true,
            message: `${removedItems.length} items removed successfully`,
            data: {
                updatedSelection: {
                    selectionId: selection.selectionId,
                    status: selection.status,
                    totalItems: selection.totalItems,
                    totalValue: selection.totalValue
                },
                removedCount: removedItems.length,
                remainingCount: selection.items.length
            },
            info: 'CDE está sendo atualizado em background'
        });

    } catch (error) {
        console.error('❌ Error removing items:', error);
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

/**
 * @route   GET /api/selections/:selectionId/download-zip
 * @desc    Download all photos from a selection as ZIP
 * @access  Admin only
 */
router.get('/:selectionId/download-zip', async (req, res) => {
    try {
        const { selectionId } = req.params;
        const JSZip = require('jszip');

        console.log(`📥 Backend: Downloading ZIP for selection: ${selectionId}`);

        // Buscar seleção no banco
        const Selection = require('../models/Selection');
        const selection = await Selection.findOne({ selectionId });

        if (!selection) {
            return res.status(404).json({
                success: false,
                message: 'Selection not found'
            });
        }

        // Validar se tem itens
        if (!selection.items || selection.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No photos in this selection'
            });
        }

        console.log(`📸 Processing ${selection.items.length} photos...`);

        // Criar ZIP
        const zip = new JSZip();
        let successCount = 0;
        let errorCount = 0;

        // Baixar cada foto
        for (let i = 0; i < selection.items.length; i++) {
            const item = selection.items[i];

            try {
                // Construir URL da foto original
                let photoUrl;
                if (item.thumbnailUrl) {
                    photoUrl = item.thumbnailUrl.replace('/_thumbnails/', '/');
                } else {
                    const path = item.originalPath ? item.originalPath.replace(/→/g, '/').trim() : '';
                    photoUrl = `https://images.sunshinecowhides-gallery.com/${path}/${item.fileName}`;
                }

                console.log(`📸 Fetching ${i + 1}/${selection.items.length}: ${item.fileName}`);

                // Baixar foto (servidor tem acesso direto, sem CORS!)
                const response = await fetch(photoUrl);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                // Adicionar ao ZIP
                zip.file(item.fileName, buffer);

                successCount++;

            } catch (error) {
                console.error(`❌ Error downloading ${item.fileName}:`, error.message);
                errorCount++;
            }
        }

        // Verificar se conseguiu baixar pelo menos uma foto
        if (successCount === 0) {
            return res.status(500).json({
                success: false,
                message: 'Failed to download any photos'
            });
        }

        console.log(`📦 Generating ZIP... (${successCount} photos, ${errorCount} errors)`);

        // Gerar ZIP
        const zipBuffer = await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        // Criar nome do arquivo
        const date = new Date(selection.createdAt).toISOString().split('T')[0];
        const clientName = (selection.clientName || 'client').replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `selection-${clientName}-${selection.clientCode}-${date}.zip`;

        console.log(`✅ ZIP created: ${fileName} (${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

        // Enviar arquivo
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', zipBuffer.length);

        res.send(zipBuffer);

    } catch (error) {
        console.error('❌ Error creating ZIP:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;