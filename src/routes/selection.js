// src/routes/selection.js

const express = require('express');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Selection = require('../models/Selection');
const Product = require('../models/Product');
const { GoogleDriveService } = require('../services');
const EmailService = require('../services/EmailService');

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
            const products = await Product.find({
                _id: { $in: productIds },
                status: 'reserved',
                'reservedBy.sessionId': sessionId
            }).session(session);

            if (products.length !== cart.totalItems) {
                throw new Error('Alguns itens do carrinho não estão mais disponíveis');
            }

            console.log(`✅ Produtos validados: ${products.length} itens`);

            // 3. ✅ NOVA ORDEM: Verificar PRIMEIRO se é cliente especial
            const AccessCode = require('../models/AccessCode');
            const SpecialSelectionService = require('../services/SpecialSelectionService');

            console.log(`🔍 Verificando tipo de cliente ${clientCode}...`);
            const accessCode = await AccessCode.findOne({ code: clientCode }).session(session);

            const isSpecialClient = accessCode &&
                accessCode.accessType === 'special' &&
                accessCode.specialSelection;

            let selectionId;
            let selection;
            let specialSelection = null;

            // 4. Criar pasta do cliente no Google Drive (comum para ambos os tipos)
            console.log(`📁 Criando pasta para cliente no Google Drive...`);

            const folderResult = await GoogleDriveService.createClientSelectionFolder(
                clientCode,
                clientName,
                cart.totalItems
            );

            if (!folderResult.success) {
                throw new Error('Erro ao criar pasta no Google Drive');
            }

            console.log(`✅ Pasta criada: ${folderResult.folderName}`);

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

            // 6. Mover fotos preservando hierarquia completa
            console.log(`📸 Movendo ${photosToMove.length} fotos com hierarquia preservada...`);

            const moveResult = await GoogleDriveService.movePhotosToSelection(
                photosToMove,
                folderResult.folderId
            );

            if (!moveResult.success) {
                throw new Error('Erro ao mover fotos no Google Drive');
            }

            console.log(`✅ Movimentação concluída: ${moveResult.summary.successful} sucessos, ${moveResult.summary.failed} erros`);

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

                // Processar devolução de fotos não selecionadas
                const selectedPhotoIds = products.map(p => p.driveFileId);
                console.log(`📸 Fotos selecionadas pelo cliente: ${selectedPhotoIds.length}`);

                const unselectedPhotos = [];
                specialSelection.customCategories.forEach(category => {
                    category.photos.forEach(photo => {
                        if (!selectedPhotoIds.includes(photo.photoId)) {
                            unselectedPhotos.push({
                                photoId: photo.photoId,
                                fileName: photo.fileName,
                                categoryName: category.categoryName
                            });
                        }
                    });
                });

                console.log(`🔄 Fotos não selecionadas encontradas: ${unselectedPhotos.length}`);

                if (unselectedPhotos.length > 0) {
                    console.log(`🚀 Iniciando devolução automática de ${unselectedPhotos.length} fotos...`);

                    for (const photo of unselectedPhotos) {
                        try {
                            console.log(`📸 Devolvendo foto: ${photo.fileName}`);

                            const returnResult = await SpecialSelectionService.returnPhotoToOriginalLocation(
                                photo.photoId,
                                'system_auto',
                                session
                            );

                            if (returnResult.success) {
                                console.log(`✅ Foto devolvida: ${photo.fileName}`);
                            }
                        } catch (error) {
                            console.error(`❌ Erro ao devolver foto ${photo.fileName}:`, error);
                        }
                    }

                    specialSelection.addMovementLog(
                        'photos_returned',
                        // LINHA 248-270 NOVA:
                        `${unselectedPhotos.length} fotos não selecionadas foram devolvidas automaticamente`,
                        true,
                        null,
                        {
                            returnedCount: unselectedPhotos.length,
                            selectedCount: selectedPhotoIds.length
                        }
                    );

                    // Recarregar seleção após devolução para evitar conflito
                    console.log(`🔄 Recarregando seleção após devolução automática...`);
                    specialSelection = await Selection.findById(specialSelection._id).session(session);

                } else {
                    console.log(`✅ Sem devolução automática - continuando normalmente`);
                }

                // SEMPRE atualizar status e salvar
                specialSelection.status = 'pending';
                // Save movido para depois da reversão

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

                // Gerar ID único para a seleção normal
                selectionId = Selection.generateSelectionId();

                // Criar nova seleção normal
                const selectionData = {
                    selectionId,
                    sessionId,
                    clientCode,
                    clientName,
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
                selection.addMovementLog('moved', `Fotos movidas para ${folderResult.folderName}`);

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

            // 9. Atualizar status dos produtos (comum para ambos)
            await Product.updateMany(
                { _id: { $in: productIds } },
                {
                    $set: {
                        status: 'reserved_pending',
                        reservedAt: new Date()
                    },
                    $unset: { 'cartAddedAt': 1 }
                }
            ).session(session);

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