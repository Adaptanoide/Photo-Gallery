// src/routes/selection.js
// ✅ VERSÃO ATUALIZADA - Passa Sales Rep para CDEWriter.bulkMarkAsConfirmed
// MODIFICAÇÃO PRINCIPAL: Linha ~195 - Passar salesRep para bulkMarkAsConfirmed

const express = require('express');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Selection = require('../models/Selection');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const EmailService = require('../services/EmailService');
const PhotoTagService = require('../services/PhotoTagService');
const PricingService = require('../services/PricingService');
const { calculateCartTotals } = require('./cart');
const router = express.Router();

/**
 * POST /api/selection/finalize
 * Finalizar seleção do cliente - mover fotos para RESERVED + enviar email
 */
router.post('/finalize', async (req, res) => {
    const session = await mongoose.startSession();

    try {
        return await session.withTransaction(async () => {
            const { sessionId, clientCode, clientName, observations } = req.body;

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

            // FILTRAR GHOST ITEMS - CRÍTICO!
            let validItems = cart.items.filter(item =>
                !item.ghostStatus || item.ghostStatus !== 'ghost'
            );

            let ghostItems = cart.items.filter(item =>
                item.ghostStatus === 'ghost'
            );

            if (ghostItems.length > 0) {
                console.log(`👻 ${ghostItems.length} ghost items removidos da seleção`);
                ghostItems.forEach(ghost => {
                    console.log(`  - ${ghost.fileName}: ${ghost.ghostReason}`);
                });
            }

            if (validItems.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Todos os itens estão indisponíveis. Por favor, adicione novos itens ao carrinho.'
                });
            }

            // Substituir cart.items pelos validItems
            cart.items = validItems;
            cart.totalItems = validItems.length;

            // LIMPAR GHOST ITEMS DO MONGODB - ADICIONAR AQUI!
            if (ghostItems.length > 0) {
                console.log(`🧹 Limpando ${ghostItems.length} ghost items do MongoDB...`);

                for (const ghost of ghostItems) {
                    await UnifiedProductComplete.updateOne(
                        { driveFileId: ghost.driveFileId },
                        {
                            $set: {
                                status: 'unavailable',
                                cdeStatus: 'RESERVED'
                            },
                            $unset: {
                                reservedBy: 1,
                                ghostStatus: 1,
                                ghostReason: 1,
                                ghostedAt: 1,
                                cartAddedAt: 1,
                                reservedAt: 1
                            }
                        }
                    ).session(session);

                    console.log(`  ✔ Ghost item ${ghost.fileName} limpo do MongoDB`);
                }
            }

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

            // 3. ✅ BUSCAR SALES REP DO CLIENTE
            console.log(`🔍 Buscando informações do cliente ${clientCode}...`);
            const AccessCode = require('../models/AccessCode');
            const accessCode = await AccessCode.findOne({ code: clientCode }).session(session);
            const salesRep = accessCode?.salesRep || 'Unassigned';
            const companyName = accessCode?.companyName || '-';
            console.log(`🏢 Company: ${companyName} | 👤 Sales Rep: ${salesRep}`);

            // Criar seleção normal sempre
            let selectionId;
            let selection;

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

            // 5. Preparar dados dos produtos para movimentação
            const photosToMove = products.map(product => {
                const cartItem = cart.items.find(item => item.driveFileId === product.driveFileId);
                return {
                    driveFileId: product.driveFileId,
                    fileName: product.fileName,
                    category: product.category,
                    qbItem: product.qbItem,  // ← ADICIONAR ESTA LINHA!
                    productId: product._id,
                    thumbnailUrl: cartItem?.thumbnailUrl || product.thumbnailUrl
                };
            });

            // 6. SISTEMA DE TAGS: Marcar fotos como reservadas (SEM MOVER!)
            console.log(`🏷️ [TAGS] Marcando ${photosToMove.length} fotos como RESERVADAS...`);

            // Extrair IDs das fotos
            const photoIds = photosToMove.map(p => p.driveFileId);

            // Importar PhotoTagService
            const PhotoTagService = require('../services/PhotoTagService');

            // Gerar ID da seleção (sempre normal)
            selectionId = Selection.generateSelectionId();

            // Usar tags ao invés de mover
            const tagResult = await PhotoTagService.reservePhotos(
                photoIds,
                selectionId,
                clientCode
            );

            console.log(`✅ [TAGS] ${tagResult.photosTagged} fotos marcadas como reservadas`);
            console.log('📍 [TAGS] Nenhuma movimentação física realizada!');

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

            // 7. 🆕 Recalcular preços usando a mesma função do carrinho
            console.log('🧮 Recalculando preços para seleção...');

            const pricingResult = await calculateCartTotals(cart);
            const totalValue = pricingResult.total;

            console.log(`💰 Total Value calculado: $${totalValue.toFixed(2)}`);
            console.log(`   - Subtotal: $${pricingResult.subtotal.toFixed(2)}`);
            console.log(`   - Discount: $${pricingResult.discount.toFixed(2)}`);

            // 8. ✅ CRIAR SELEÇÃO (DETECTAR COMING SOON)
            console.log(`📋 Criando nova seleção para cliente ${clientName}...`);

            // ✅ DETECTAR SE É COMING SOON
            const hasComingSoon = cart.items.some(item => item.transitStatus === 'coming_soon');
            const galleryType = hasComingSoon ? 'coming_soon' : 'available';
            console.log(`🚢 Tipo de galeria: ${galleryType} (${hasComingSoon ? 'TEM' : 'NÃO TEM'} items em trânsito)`);

            // Criar nova seleção
            const selectionData = {
                selectionId,
                sessionId,
                clientCode,
                clientName,
                clientCompany: companyName,
                salesRep: salesRep,
                customerNotes: observations || null,
                galleryType: galleryType,  // ✅ NOVO!
                items: products.map(product => {
                    const cartItem = cart.items.find(item => item.driveFileId === product.driveFileId);

                    return {
                        productId: product._id,
                        driveFileId: product.driveFileId,
                        fileName: product.fileName,
                        category: product.category,
                        thumbnailUrl: cartItem?.thumbnailUrl || product.thumbnailUrl,
                        originalPath: product.category,
                        price: cartItem?.price || 0,
                        selectedAt: cartItem?.addedAt || new Date(),
                        // ✅ NOVO: Campos Coming Soon
                        transitStatus: cartItem?.transitStatus || null,
                        cdeTable: cartItem?.cdeTable || 'tbinventario'
                    };
                }),
                totalItems: cart.totalItems,
                totalValue: totalValue,
                status: 'pending',
                googleDriveInfo: {
                    clientFolderId: folderResult.folderId,
                    clientFolderName: folderResult.folderName,
                    clientFolderPath: folderResult.path
                },
                reservationExpiredAt: new Date(Date.now() + (24 * 60 * 60 * 1000))
            };

            selection = new Selection(selectionData);
            selection.addMovementLog('created', `Seleção criada com ${cart.totalItems} itens`);

            await selection.save({ session });

            console.log(`✅ Seleção normal salva no MongoDB: ${selectionId}`);

            // ===== DESATIVAR CLIENTE APÓS SELEÇÃO =====
            console.log('🔒 Desativando cliente após finalizar seleção...');

            try {
                const updatedAccessCode = await AccessCode.findOneAndUpdate(
                    { code: clientCode },
                    {
                        $set: {
                            isActive: false
                        }
                    },
                    {
                        session,
                        new: true
                    }
                );

                if (updatedAccessCode) {
                    console.log(`🔒 Cliente ${clientCode} DESATIVADO após seleção`);
                    // Deletar o carrinho após criar seleção com sucesso
                    try {
                        await Cart.deleteOne({ sessionId: sessionId }).session(session);
                        console.log(`🗑️ Carrinho ${sessionId} deletado após criar seleção`);
                    } catch (deleteError) {
                        console.error('⚠️ Erro ao deletar carrinho (não crítico):', deleteError.message);
                    }
                    console.log(`   ➡️ Cliente precisa contatar vendedor para novo acesso`);
                }

            } catch (desactivateError) {
                console.error('⚠️ Erro ao desativar cliente:', desactivateError);
            }
            // ===== FIM DA DESATIVAÇÃO =====

            // 9. Atualizar status dos produtos
            console.log(`🏷️ Marcando ${productIds.length} produtos com selectionId: ${selectionId}`);

            // PRIMEIRA ETAPA: Atualizar status e campos básicos incluindo cdeStatus
            const updateResult = await UnifiedProductComplete.updateMany(
                { _id: { $in: productIds } },
                {
                    $set: {
                        status: 'in_selection',
                        cdeStatus: 'CONFIRMED',
                        reservedAt: new Date(),
                    },
                    $unset: { 'cartAddedAt': 1 }
                }
            ).session(session);

            console.log(`📊 Primeira etapa - updateResult: ${JSON.stringify(updateResult)}`);

            // SEGUNDA ETAPA: Adicionar selectionId especificamente
            const selectionUpdateResult = await UnifiedProductComplete.updateMany(
                { _id: { $in: productIds } },
                {
                    $set: {
                        'selectionId': String(selectionId),
                        'reservedBy.inSelection': true,
                        'reservedBy.selectionId': String(selectionId)
                    }
                }
            ).session(session);

            console.log(`📊 Segunda etapa - selectionUpdateResult: ${JSON.stringify(selectionUpdateResult)}`);

            // ========== 🆕 ATUALIZAR CDE EM BACKGROUND COM SALES REP ==========
            console.log('📡 Atualizando CDE em background...');
            const CDEWriter = require('../services/CDEWriter');

            // Extrair números das fotos E TABELAS CDE
            const photoNumbers = products
                .map(p => p.fileName.match(/\d+/)?.[0])
                .filter(Boolean);

            // ✅ EXTRAIR cdeTables DOS PRODUTOS
            const cdeTables = products.map(p => p.cdeTable || 'tbinventario');

            console.log(`[CDE] 🚀 Confirmação de ${photoNumbers.length} fotos agendada em background`);
            console.log(`[CDE] 📊 Tabelas: ${cdeTables.filter(t => t === 'tbetiqueta').length} em tbetiqueta, ${cdeTables.filter(t => t === 'tbinventario').length} em tbinventario`);

            // Processar em background usando BULK UPDATE
            setImmediate(async () => {
                console.log(`[CDE-BG] Iniciando confirmação BULK de ${photoNumbers.length} fotos...`);
                console.log(`[CDE-BG] 👤 Sales Rep: ${salesRep}`);

                const startTime = Date.now();

                try {
                    // ✅ AGORA PASSA cdeTables COMO 5º PARÂMETRO!
                    const confirmedCount = await CDEWriter.bulkMarkAsConfirmed(
                        photoNumbers,
                        clientCode,
                        clientName,
                        salesRep,
                        cdeTables  // ✅ NOVO: Array de tabelas CDE!
                    );

                    const duration = Date.now() - startTime;
                    const failedCount = photoNumbers.length - confirmedCount;

                    console.log(`[CDE-BG] ✅ Confirmação BULK concluída em ${duration}ms`);
                    console.log(`[CDE-BG] 📊 Resultado: ${confirmedCount}/${photoNumbers.length} sucessos, ${failedCount} falhas`);
                    console.log(`[CDE-BG] 👤 RESERVEDUSU atualizado com Sales Rep: ${salesRep}`);

                    if (failedCount > 0) {
                        console.log(`[CDE-BG] ⚠️ ${failedCount} fotos não foram confirmadas (sync vai corrigir automaticamente)`);
                    }
                } catch (error) {
                    console.error(`[CDE-BG] ❌ Erro no bulk confirm:`, error.message);
                    console.log(`[CDE-BG] ℹ️ Sync vai corrigir automaticamente em até 5 minutos`);
                }
            });

            console.log('[CDE] ⚡ Cliente não precisa esperar - resposta imediata');
            // ========== FIM DA ATUALIZAÇÃO CDE ==========

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

            // 11. Enviar email de notificação (em background)
            setImmediate(async () => {
                try {
                    console.log(`📧 Enviando notificação de nova seleção...`);

                    const emailService = EmailService.getInstance();
                    const emailResult = await emailService.notifyNewSelection({
                        selectionId,
                        clientCode,
                        clientName,
                        clientCompany: companyName,
                        salesRep: salesRep,
                        totalItems: cart.totalItems,
                        totalValue: totalValue,
                        observations: observations || '',
                        googleDriveInfo: {
                            clientFolderName: folderResult.folderName
                        },
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
                    type: 'regular'
                },
                googleDrive: {
                    folderCreated: folderResult.folderName,
                    photosMovedCount: cart.totalItems
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