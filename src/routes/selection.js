// src/routes/selection.js

const express = require('express');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Selection = require('../models/Selection');
const Product = require('../models/Product');
const EmailService = require('../services/EmailService');
const PhotoTagService = require('../services/PhotoTagService');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');

const router = express.Router();

/**
 * POST /api/selection/finalize
 * Finalizar seleção do cliente - mover fotos para RESERVED + enviar email
 */
router.post('/finalize', async (req, res) => {
    const session = await mongoose.startSession();

    try {
        return await session.withTransaction(async () => {
            const { sessionId, clientCode, clientName } = req.body;

            console.log(`🎯 Iniciando finalização de seleção para cliente: ${clientName} (${clientCode})`);

            // 1. Buscar carrinho ativo
            const cart = await Cart.findActiveBySession(sessionId).session(session);

            if (!cart || cart.totalItems === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Carrinho vazio ou não encontrado'
                });
            }

            console.log(`📦 Carrinho encontrado: ${cart.totalItems} itens`);

            // 2. Buscar produtos detalhados
            const productIds = cart.items.map(item => item.productId);
            console.log('🔍 DEBUG COMPLETO:');
            console.log('  Cart items:', cart.items.length);
            console.log('  ProductIds:', productIds);
            console.log('  SessionId:', sessionId);
            console.log('  ClientCode:', clientCode);

            // Buscar SEM filtros primeiro para debug
            const allProducts = await UnifiedProductComplete.find({
                _id: { $in: productIds }
            }).session(session);

            console.log(`  Produtos encontrados (sem filtro): ${allProducts.length}`);
            if (allProducts.length > 0) {
                allProducts.forEach(p => {
                    console.log(`    - ${p.fileName}: status=${p.status}, clientCode=${p.reservedBy?.clientCode}, sessionId=${p.reservedBy?.sessionId}`);
                });
            }

            // Agora buscar com filtros
            const products = await UnifiedProductComplete.find({
                _id: { $in: productIds },
                $or: [
                    { status: 'available' },
                    {
                        status: 'reserved',
                        'reservedBy.clientCode': clientCode
                    }
                ]
            }).session(session);

            console.log(`  Produtos válidos: ${products.length}`);

            if (products.length !== cart.totalItems) {
                console.log(`  ❌ ERRO: Esperado ${cart.totalItems}, encontrado ${products.length}`);
                throw new Error('Alguns itens do carrinho não estão mais disponíveis');
            }

            // 3. ✅ NOVA ORDEM: Verificar PRIMEIRO se é cliente especial
            const AccessCode = require('../models/AccessCode');
            const SpecialSelectionService = require('../services/SpecialSelectionService');

            console.log(`🔍 Verificando tipo de cliente ${clientCode}...`);
            const accessCode = await AccessCode.findOne({ code: clientCode }).session(session);
            const salesRep = accessCode?.salesRep || 'Unassigned';
            console.log(`👤 Sales Rep do cliente: ${salesRep}`);

            const isSpecialClient = accessCode &&
                accessCode.accessType === 'special' &&
                accessCode.specialSelection;

            let selectionId;
            let selection;
            let specialSelection = null;

            // 4. Criar referência da seleção (R2 não precisa criar pasta física)
            console.log(`📁 Preparando seleção para cliente ${clientName}...`);

            // Criar objeto folderResult para compatibilidade
            const folderResult = {
                success: true,
                folderId: `selection-${clientCode}-${Date.now()}`,
                folderName: `${clientName}_${new Date().toISOString().split('T')[0]}_${cart.totalItems}_items`,
                path: 'VIRTUAL_PATH'
            };

            console.log(`✅ Seleção preparada: ${folderResult.folderName}`);

            console.log(`✅ Seleção preparada: ${folderResult.folderName}`);

            // 5. Preparar dados dos produtos para movimentação
            const photosToMove = products.map(product => {
                const cartItem = cart.items.find(item => item.driveFileId === product.driveFileId);
                return {
                    driveFileId: product.driveFileId,
                    fileName: product.fileName,
                    category: product.category,
                    productId: product._id,
                    thumbnailUrl: cartItem?.thumbnailUrl || product.thumbnailUrl
                };
            });

            // 6. SISTEMA DE TAGS: Marcar fotos como reservadas (SEM MOVER!)
            console.log(`🏷️ [TAGS] Marcando ${photosToMove.length} fotos como RESERVADAS...`);

            // Extrair IDs das fotos
            const photoIds = photosToMove.map(p => p.driveFileId);

            // Importar PhotoTagService (adicionar no topo do arquivo se necessário)
            const PhotoTagService = require('../services/PhotoTagService');

            // Gerar ID da seleção ANTES de usar
            if (isSpecialClient) {
                selectionId = accessCode.specialSelection?.selectionCode || Selection.generateSpecialSelectionId();
            } else {
                selectionId = Selection.generateSelectionId();
            }

            // Usar tags ao invés de mover
            const tagResult = await PhotoTagService.reservePhotos(
                photoIds,
                selectionId,  // Agora usa o ID real!
                clientCode
            );

            console.log(`✅ [TAGS] ${tagResult.photosTagged} fotos marcadas como reservadas`);
            console.log('📁 [TAGS] Nenhuma movimentação física realizada!');

            // Criar moveResult fake para compatibilidade com código existente
            const moveResult = {
                success: true,
                summary: {
                    successful: tagResult.photosTagged,
                    failed: 0,
                    hierarchiesCreated: 0
                },
                results: photosToMove.map(p => ({
                    success: true,
                    photoId: p.driveFileId,
                    fileName: p.fileName,
                    originalHierarchicalPath: p.category
                }))
            };
            // 7. Calcular valor total dos itens
            let totalValue = 0;
            cart.items.forEach(item => {
                if (item.hasPrice && item.price > 0) {
                    totalValue += item.price;
                }
            });

            // 8. ✅ LÓGICA CONDICIONAL: Cliente Especial vs Normal
            if (isSpecialClient) {
                // ===== CLIENTE ESPECIAL =====
                console.log(`🎯 Cliente especial detectado! Processando seleção especial...`);

                // Buscar a Special Selection existente
                specialSelection = await Selection.findOne({
                    selectionId: accessCode.specialSelection.selectionCode,
                    selectionType: 'special',
                    status: { $in: ['confirmed', 'active'] }
                }).session(session);

                if (!specialSelection) {
                    throw new Error('Seleção especial não encontrada ou não ativa');
                }

                console.log(`📋 Special Selection encontrada: ${specialSelection.selectionId}`);
                selectionId = specialSelection.selectionId;

                // Atualizar a seleção especial com informações da finalização
                specialSelection.status = 'pending'; // ← MUDA para pending (aguardando aprovação)

                // Garantir que googleDriveInfo existe completamente
                if (!specialSelection.googleDriveInfo) {
                    specialSelection.googleDriveInfo = {};
                }

                // Preservar ou criar specialSelectionInfo
                if (!specialSelection.googleDriveInfo.specialSelectionInfo) {
                    specialSelection.googleDriveInfo.specialSelectionInfo = {
                        specialFolderId: specialSelection.googleDriveInfo.clientFolderId || '',
                        specialFolderName: specialSelection.googleDriveInfo.clientFolderName || '',
                        originalPhotosBackup: []
                    };
                }

                // Atualizar apenas os campos necessários
                specialSelection.googleDriveInfo.clientFolderId = folderResult.folderId;
                specialSelection.googleDriveInfo.clientFolderName = folderResult.folderName;
                specialSelection.googleDriveInfo.clientFolderPath = folderResult.path;

                // Adicionar informações de finalização
                specialSelection.googleDriveInfo.finalizationInfo = {
                    finalizedAt: new Date(),
                    totalItemsSelected: cart.totalItems,
                    totalValueSelected: totalValue,
                    hierarchyPreserved: true,
                    hierarchiesCreated: moveResult.summary.hierarchiesCreated || 0
                };

                // Adicionar items finalizados à seleção especial
                specialSelection.items = products.map(product => {
                    const cartItem = cart.items.find(item => item.driveFileId === product.driveFileId);
                    const moveResultItem = moveResult.results.find(r => r.photoId === product.driveFileId);

                    return {
                        productId: product._id,
                        driveFileId: product.driveFileId,
                        fileName: product.fileName,
                        category: product.category,
                        thumbnailUrl: cartItem?.thumbnailUrl || product.thumbnailUrl,
                        originalPath: moveResultItem?.originalHierarchicalPath || 'unknown',
                        newPath: moveResultItem?.newParent || folderResult.folderId,
                        price: cartItem?.price || 0,
                        selectedAt: cartItem?.addedAt || new Date(),
                        movedAt: moveResultItem?.success ? new Date() : null
                    };
                });

                specialSelection.totalItems = cart.totalItems;
                specialSelection.totalValue = totalValue;
                specialSelection.reservationExpiredAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 horas

                // Adicionar log de movimentação
                specialSelection.addMovementLog(
                    'finalized',
                    `Cliente finalizou seleção: ${cart.totalItems} fotos selecionadas`,
                    true,
                    null,
                    {
                        clientFolderId: folderResult.folderId,
                        clientFolderName: folderResult.folderName,
                        totalItems: cart.totalItems,
                        totalValue: totalValue
                    }
                );

                // NOVO: Sistema de tags - fotos não selecionadas permanecem disponíveis
                console.log('🏷️ [TAGS] Fotos não selecionadas permanecem com status AVAILABLE');
                console.log('🏷️ [TAGS] Nenhuma devolução física necessária!');

                // SEMPRE atualizar status e salvar
                specialSelection.status = 'pending';

                // ===== DESATIVAR CLIENTE APÓS FINALIZAR SPECIAL SELECTION =====
                console.log('🔒 Desativando acesso do cliente após finalizar Special Selection...');

                try {
                    // Reverter para normal mas DESATIVAR o acesso
                    const updatedAccessCode = await AccessCode.findOneAndUpdate(
                        { code: clientCode },
                        {
                            $set: {
                                accessType: 'normal',
                                isActive: false,
                                // Restaurar categorias originais ou usar padrão
                                allowedCategories: accessCode.specialSelection?.originalCategories || ['Brazil Best Sellers']
                            },
                            $unset: {
                                specialSelection: 1
                            }
                        },
                        {
                            session,
                            new: true
                        }
                    );

                    if (updatedAccessCode) {
                        console.log(`🔒 Cliente ${clientCode} DESATIVADO após finalizar seleção`);
                        console.log(`   AccessType: ${updatedAccessCode.accessType}`);
                        console.log(`   Ativo: ${updatedAccessCode.isActive}`);
                        console.log(`   Categorias: mantidas as originais`);
                        console.log(`   ➡️ Cliente precisa contatar vendedor para novo acesso`);
                    }

                    // Marcar Special Selection como inativa
                    specialSelection.isActive = false;

                    // SALVAR TUDO
                    await specialSelection.save({ session });
                    console.log('✅ Special Selection salva como pending e inativa');
                    console.log('🔒 Cliente SEM ACESSO até admin reativar');

                } catch (revertError) {
                    console.error('⚠️ Erro ao desativar cliente:', revertError);
                    // Se falhar, ainda tentar salvar a selection
                    await specialSelection.save({ session });
                }
                // ===== FIM DA DESATIVAÇÃO =====

                selection = specialSelection; // Para usar na resposta
                console.log(`✅ Special Selection salva com status 'pending'`);

            } else {
                // ===== CLIENTE NORMAL =====
                console.log(`📋 Cliente normal detectado. Criando nova seleção...`);

                // Criar nova seleção normal
                const selectionData = {
                    selectionId,
                    sessionId,
                    clientCode,
                    clientName,
                    salesRep: salesRep,
                    items: products.map(product => {
                        const cartItem = cart.items.find(item => item.driveFileId === product.driveFileId);
                        const moveResultItem = moveResult.results.find(r => r.photoId === product.driveFileId);

                        return {
                            productId: product._id,
                            driveFileId: product.driveFileId,
                            fileName: product.fileName,
                            category: product.category,
                            thumbnailUrl: cartItem?.thumbnailUrl || product.thumbnailUrl,
                            originalPath: moveResultItem?.originalHierarchicalPath || 'unknown',
                            newPath: moveResultItem?.newParent || folderResult.folderId,
                            price: cartItem?.price || 0,
                            selectedAt: cartItem?.addedAt || new Date(),
                            movedAt: moveResultItem?.success ? new Date() : null
                        };
                    }),
                    totalItems: cart.totalItems,
                    totalValue: totalValue,
                    status: 'pending',
                    selectionType: 'normal', // ← Explicitamente marcar como regular
                    googleDriveInfo: {
                        clientFolderId: folderResult.folderId,
                        clientFolderName: folderResult.folderName,
                        clientFolderPath: folderResult.path,
                        hierarchyPreserved: true,
                        hierarchiesCreated: moveResult.summary.hierarchiesCreated || 0
                    },
                    reservationExpiredAt: new Date(Date.now() + (24 * 60 * 60 * 1000))
                };

                selection = new Selection(selectionData);
                selection.addMovementLog('created', `Seleção criada com ${cart.totalItems} itens`);

                await selection.save({ session });

                console.log(`✅ Seleção normal salva no MongoDB: ${selectionId}`);

                // ===== DESATIVAR CLIENTE APÓS SELEÇÃO REGULAR =====
                console.log('🔒 Desativando cliente após finalizar seleção REGULAR...');

                try {
                    const updatedAccessCode = await AccessCode.findOneAndUpdate(
                        { code: clientCode },
                        {
                            $set: {
                                isActive: false,  // DESATIVAR!
                                // Manter tipo normal e categorias como estão
                            }
                        },
                        {
                            session,
                            new: true
                        }
                    );

                    if (updatedAccessCode) {
                        console.log(`🔒 Cliente ${clientCode} DESATIVADO após seleção regular`);
                        console.log(`   ➡️ Cliente precisa contatar vendedor para novo acesso`);
                    }

                } catch (desactivateError) {
                    console.error('⚠️ Erro ao desativar cliente (regular):', desactivateError);
                }
                // ===== FIM DA DESATIVAÇÃO REGULAR =====
            }

            // ========== CORREÇÃO DEFINITIVA: ATUALIZAÇÃO EM DUAS ETAPAS ==========
            // 9. Atualizar status dos produtos (comum para ambos)
            console.log(`🏷️ Marcando ${productIds.length} produtos com selectionId: ${selectionId}`);

            // DEBUG: Verificar se selectionId está definido
            console.log(`🔍 DEBUG - selectionId antes do update: "${selectionId}"`);
            console.log(`🔍 DEBUG - Tipo do selectionId: ${typeof selectionId}`);

            // PRIMEIRA ETAPA: Atualizar status e campos básicos incluindo cdeStatus
            const updateResult = await UnifiedProductComplete.updateMany(
                { _id: { $in: productIds } },
                {
                    $set: {
                        status: 'in_selection',
                        currentStatus: 'in_selection',
                        cdeStatus: 'PRE-SELECTED',  // ADICIONAR ESTA LINHA
                        reservedAt: new Date(),
                        'virtualStatus.status': 'in_selection'
                    },
                    $unset: { 'cartAddedAt': 1 }
                }
            ).session(session);

            console.log(`📊 Primeira etapa - updateResult: ${JSON.stringify(updateResult)}`);

            // SEGUNDA ETAPA: Adicionar selectionId especificamente
            // Usando uma abordagem diferente para garantir que o campo seja salvo
            const selectionUpdateResult = await UnifiedProductComplete.updateMany(
                { _id: { $in: productIds } },
                {
                    $set: {
                        'selectionId': String(selectionId),  // Forçar string
                        'virtualStatus.selectionId': String(selectionId),
                        'reservedBy.inSelection': true,
                        'reservedBy.selectionId': String(selectionId)
                    }
                }
            ).session(session);

            console.log(`📊 Segunda etapa - selectionUpdateResult: ${JSON.stringify(selectionUpdateResult)}`);

            // VERIFICAÇÃO: Confirmar que o selectionId foi salvo
            const verifyUpdate = await UnifiedProductComplete.findOne(
                { _id: productIds[0] },
                { selectionId: 1, status: 1 }
            ).session(session);

            console.log(`✅ Verificação pós-update:`, {
                selectionId: verifyUpdate?.selectionId,
                status: verifyUpdate?.status
            });

            if (!verifyUpdate?.selectionId) {
                console.error('⚠️ AVISO: selectionId não foi salvo corretamente!');
            }
            // ========== FIM DA CORREÇÃO ==========

            // 10. Desativar carrinho (comum para ambos)
            cart.isActive = false;
            cart.notes = `Finalizado como seleção ${selectionId}`;
            await cart.save({ session });

            console.log(`✅ Carrinho desativado e produtos atualizados`);

            // 11. Enviar email de notificação (em background)
            setImmediate(async () => {
                try {
                    console.log(`📧 Enviando notificação de nova seleção...`);

                    const emailService = EmailService.getInstance();
                    const emailResult = await emailService.notifyNewSelection({
                        selectionId,
                        clientCode,
                        clientName,
                        salesRep: salesRep,
                        totalItems: cart.totalItems,
                        totalValue: totalValue,
                        googleDriveInfo: {
                            clientFolderName: folderResult.folderName
                        },
                        isSpecialSelection: isSpecialClient
                    });

                    if (emailResult.success) {
                        console.log(`✅ Email de notificação enviado com sucesso`);
                    } else {
                        console.warn(`⚠️ Falha ao enviar email de notificação:`, emailResult.error);
                    }

                } catch (emailError) {
                    console.error('❌ Erro no envio de email (background):', emailError);
                }
            });

            // 12. Resposta de sucesso
            res.json({
                success: true,
                message: 'Seleção finalizada com sucesso!',
                selection: {
                    selectionId,
                    clientFolderName: folderResult.folderName,
                    totalItems: cart.totalItems,
                    totalValue: totalValue,
                    status: 'pending',
                    type: isSpecialClient ? 'special' : 'regular'
                },
                googleDrive: {
                    folderCreated: folderResult.folderName,
                    photosMovedCount: moveResult.summary.successful,
                    hierarchiesCreated: moveResult.summary.hierarchiesCreated || 0
                },
                nextSteps: {
                    message: 'Suas fotos foram reservadas e movidas para uma pasta exclusiva.',
                    expiration: 'Você tem 24 horas para confirmar esta seleção.',
                    contact: 'Entre em contato conosco para finalizar a negociação.'
                }
            });
        });

    } catch (error) {
        console.error('❌ Erro ao finalizar seleção:', error);

        res.status(500).json({
            success: false,
            message: 'Erro ao finalizar seleção',
            error: error.message,
            details: 'Por favor, tente novamente ou entre em contato com o suporte.'
        });
    } finally {
        await session.endSession();
    }
});

/**
 * GET /api/selection/:selectionId
 * Buscar detalhes de uma seleção específica
 */
router.get('/:selectionId', async (req, res) => {
    try {
        const { selectionId } = req.params;

        const selection = await Selection.findOne({ selectionId })
            .populate('items.productId');

        if (!selection) {
            return res.status(404).json({
                success: false,
                message: 'Seleção não encontrada'
            });
        }

        res.json({
            success: true,
            selection: selection.getSummary(),
            details: selection
        });

    } catch (error) {
        console.error('❌ Erro ao buscar seleção:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar seleção',
            error: error.message
        });
    }
});

/**
 * GET /api/selection/client/:clientCode
 * Buscar seleções de um cliente específico
 */
router.get('/client/:clientCode', async (req, res) => {
    try {
        const { clientCode } = req.params;
        const limit = parseInt(req.query.limit) || 10;

        const selections = await Selection.findByClient(clientCode, limit);

        res.json({
            success: true,
            selections: selections.map(s => s.getSummary()),
            total: selections.length
        });

    } catch (error) {
        console.error('❌ Erro ao buscar seleções do cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar seleções',
            error: error.message
        });
    }
});

module.exports = router;