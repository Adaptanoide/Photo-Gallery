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

            // 3. Gerar ID único para a seleção
            const selectionId = Selection.generateSelectionId();

            // 4. Criar pasta do cliente no Google Drive
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

            // 5. Agrupar produtos por categoria para criar subpastas
            const categoriesMap = {};
            products.forEach(product => {
                if (!categoriesMap[product.category]) {
                    categoriesMap[product.category] = [];
                }
                categoriesMap[product.category].push(product);
            });

            const categories = Object.keys(categoriesMap);

            // 6. Preparar dados dos produtos para movimentação (SEM criar subpastas simples)
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

            // 7. Mover fotos preservando hierarquia completa
            console.log(`📸 Movendo ${photosToMove.length} fotos com hierarquia preservada...`);

            const moveResult = await GoogleDriveService.movePhotosToSelection(
                photosToMove,
                folderResult.folderId
                // ← Não passa categorySubfolders - hierarquia será recriada automaticamente
            );

            if (!moveResult.success) {
                throw new Error('Erro ao mover fotos no Google Drive');
            }

            console.log(`✅ Movimentação concluída: ${moveResult.summary.successful} sucessos, ${moveResult.summary.failed} erros`);

            // 9. Calcular valor total dos itens
            let totalValue = 0;
            cart.items.forEach(item => {
                if (item.hasPrice && item.price > 0) {
                    totalValue += item.price;
                }
            });

            // 10. Criar registro de seleção no MongoDB
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
                googleDriveInfo: {
                    clientFolderId: folderResult.folderId,
                    clientFolderName: folderResult.folderName,
                    clientFolderPath: folderResult.path,
                    hierarchyPreserved: true, // ← Novo: indica que hierarquia foi preservada
                    hierarchiesCreated: moveResult.summary.hierarchiesCreated || 0
                },
                reservationExpiredAt: new Date(Date.now() + (24 * 60 * 60 * 1000)) // 24 horas para decidir
            };

            const selection = new Selection(selectionData);
            selection.addMovementLog('created', `Seleção criada com ${cart.totalItems} itens`);
            selection.addMovementLog('moved', `Fotos movidas para ${folderResult.folderName}`);

            await selection.save({ session });

            console.log(`✅ Seleção salva no MongoDB: ${selectionId}`);

            // 11. Atualizar status dos produtos para 'reserved_pending' (aguardando aprovação admin)
            await Product.updateMany(
                { _id: { $in: productIds } },
                {
                    $set: {
                        status: 'reserved_pending',  // ← NOVO: Aguarda aprovação
                        reservedAt: new Date()       // ← Marca quando foi reservado
                    },
                    // ← NÃO remove reservedBy - mantém para rastreamento
                    $unset: { 'cartAddedAt': 1 }     // ← Remove apenas cartAddedAt
                }
            ).session(session);

            // 12. Desativar carrinho
            cart.isActive = false;
            cart.notes = `Finalizado como seleção ${selectionId}`;
            await cart.save({ session });

            console.log(`✅ Carrinho desativado e produtos atualizados`);

            // 13. NOVO: Enviar email de notificação (em background, não bloquear resposta)
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
                        }
                    });

                    if (emailResult.success) {
                        console.log(`✅ Email de notificação enviado com sucesso`);

                        // Adicionar log na seleção
                        selection.addMovementLog('email_sent', `Email de notificação enviado para admins`);
                        await selection.save();
                    } else {
                        console.warn(`⚠️ Falha ao enviar email de notificação:`, emailResult.error);

                        // Adicionar log de falha
                        selection.addMovementLog('email_failed', `Falha ao enviar email: ${emailResult.error}`, false, emailResult.error);
                        await selection.save();
                    }

                } catch (emailError) {
                    console.error('❌ Erro no envio de email (background):', emailError);
                }
            });

            // 14. Resposta de sucesso (sem aguardar email)
            res.json({
                success: true,
                message: 'Seleção finalizada com sucesso!',
                selection: {
                    selectionId,
                    clientFolderName: folderResult.folderName,
                    totalItems: cart.totalItems,
                    totalValue: totalValue,
                    status: 'pending'
                },
                googleDrive: {
                    folderCreated: folderResult.folderName,
                    photosMovedCount: moveResult.summary.successful,
                    hierarchiesCreated: moveResult.summary.hierarchiesCreated || 0  // ← CORRIGIDO!
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