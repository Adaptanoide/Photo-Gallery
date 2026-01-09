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
    const { sessionId, clientCode, clientName, observations } = req.body;

    console.log(`🎯 Iniciando finalização de seleção para cliente: ${clientName} (${clientCode})`);
    console.log(`📋 SessionId recebido: ${sessionId}`);

    // ========== BUSCAR CARRINHO FORA DA TRANSAÇÃO PRIMEIRO ==========
    // Isso evita problemas de read concern dentro de transações
    let cart = null;

    // Tentativa 1: Por sessionId
    cart = await Cart.findOne({ sessionId, isActive: true });
    console.log(`[SELECTION] 🔍 Busca por sessionId: ${cart ? `encontrado (${cart.totalItems} itens, clientCode: ${cart.clientCode})` : 'não encontrado'}`);

    // Tentativa 2: Por clientCode
    if (!cart && clientCode) {
        console.log(`[SELECTION] 🔄 Fallback 1: buscando por clientCode ${clientCode}`);
        cart = await Cart.findOne({ clientCode, isActive: true });
        console.log(`[SELECTION] 🔍 Busca por clientCode: ${cart ? `encontrado (${cart.totalItems} itens, sessionId: ${cart.sessionId})` : 'não encontrado'}`);
    }

    // Tentativa 3: Qualquer carrinho do cliente
    if (!cart && clientCode) {
        console.log(`[SELECTION] 🔄 Fallback 2: buscando qualquer carrinho do cliente ${clientCode}`);
        const allCarts = await Cart.find({ clientCode });
        console.log(`[SELECTION] 📦 Encontrados ${allCarts.length} carrinhos para clientCode ${clientCode}:`);
        allCarts.forEach(c => {
            console.log(`   - ${c.sessionId}: ${c.totalItems} itens, isActive: ${c.isActive}`);
        });
        cart = allCarts.find(c => c.isActive && c.totalItems > 0);
    }

    if (!cart || cart.totalItems === 0) {
        console.log(`❌ Carrinho não encontrado ou vazio | sessionId: ${sessionId} | clientCode: ${clientCode}`);
        // Log adicional para debug
        const debugCart = await Cart.findOne({ sessionId });
        if (debugCart) {
            console.log(`⚠️ DEBUG: Carrinho existe mas: isActive=${debugCart.isActive}, totalItems=${debugCart.totalItems}, items.length=${debugCart.items?.length}`);
        }
        return res.status(400).json({
            success: false,
            message: 'Carrinho vazio ou não encontrado'
        });
    }

    console.log(`📦 Carrinho encontrado: ${cart.totalItems} itens (sessionId: ${cart.sessionId})`);

    // ========== ✅ VALIDAÇÃO CRÍTICA: Verificar fotos ANTES da transação ==========
    const photoItems = cart.items.filter(item =>
        !item.isCatalogProduct && item.fileName && (!item.ghostStatus || item.ghostStatus !== 'ghost')
    );

    if (photoItems.length > 0) {
        console.log(`🔍 [FINALIZE] Validando ${photoItems.length} fotos antes de criar seleção...`);

        const validationErrors = [];
        const { getCDEConnection } = require('../config/cde-database');
        const cdeConnection = await getCDEConnection();

        try {
            for (const item of photoItems) {
                const fileName = item.fileName;
                const photoNumber = fileName.match(/(\d+)/)?.[0];

                if (!photoNumber) {
                    validationErrors.push({
                        fileName,
                        error: 'Número da foto inválido'
                    });
                    continue;
                }

                // 1. Verificar MongoDB
                const mongoPhoto = await UnifiedProductComplete.findOne({ fileName });

                if (!mongoPhoto) {
                    validationErrors.push({
                        fileName,
                        photoNumber,
                        error: 'Foto não existe no sistema'
                    });
                    console.log(`❌ [FINALIZE] Foto ${photoNumber} não existe no MongoDB`);
                    continue;
                }

                if (mongoPhoto.status === 'sold' || mongoPhoto.status === 'unavailable') {
                    validationErrors.push({
                        fileName,
                        photoNumber,
                        error: `Foto não está disponível (status: ${mongoPhoto.status})`
                    });
                    console.log(`❌ [FINALIZE] Foto ${photoNumber} status inválido: ${mongoPhoto.status}`);
                    continue;
                }

                // 2. Verificar CDE
                const [rows] = await cdeConnection.execute(
                    'SELECT AESTADOP, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA = ?',
                    [photoNumber.padStart(5, '0')]
                );

                if (rows.length === 0) {
                    validationErrors.push({
                        fileName,
                        photoNumber,
                        error: 'Foto não encontrada no CDE'
                    });
                    console.log(`❌ [FINALIZE] Foto ${photoNumber} não encontrada no CDE`);
                    continue;
                }

                const estadoCDE = rows[0].AESTADOP;
                const reservedBy = rows[0].RESERVEDUSU || '';

                if (estadoCDE === 'RETIRADO') {
                    validationErrors.push({
                        fileName,
                        photoNumber,
                        error: 'Foto já foi vendida (RETIRADO)'
                    });
                    console.log(`❌ [FINALIZE] Foto ${photoNumber} já foi vendida (RETIRADO)`);
                    continue;
                }

                if (estadoCDE === 'RESERVED' || estadoCDE === 'CONFIRMED') {
                    const pertenceAoCliente = reservedBy.includes(clientCode) ||
                                              reservedBy.includes(`-${clientCode}`) ||
                                              reservedBy.includes(`_${clientCode}`);

                    if (!pertenceAoCliente) {
                        validationErrors.push({
                            fileName,
                            photoNumber,
                            error: `Foto reservada por outro cliente (${reservedBy})`
                        });
                        console.log(`❌ [FINALIZE] Foto ${photoNumber} reservada por: ${reservedBy}`);
                        continue;
                    }
                }
            }

            await cdeConnection.end();

        } catch (cdeError) {
            console.error(`⚠️ [FINALIZE] Erro ao validar fotos:`, cdeError.message);
            if (cdeConnection) {
                try { await cdeConnection.end(); } catch (e) {}
            }
        }

        // Se houver erros, retornar ANTES da transação
        if (validationErrors.length > 0) {
            console.error(`❌ [FINALIZE] ${validationErrors.length} fotos com erro - ABORTANDO`);
            validationErrors.forEach(err => {
                console.error(`   - ${err.photoNumber || err.fileName}: ${err.error}`);
            });

            return res.status(400).json({
                success: false,
                message: `${validationErrors.length} foto(s) não está(ão) mais disponível(eis)`,
                errors: validationErrors,
                details: 'As fotos podem ter sido vendidas ou removidas do sistema. Por favor, remova-as do carrinho e tente novamente.'
            });
        }

        console.log(`✅ [FINALIZE] Todas as ${photoItems.length} fotos validadas com sucesso`);
    }

    // ========== AGORA INICIAR A TRANSAÇÃO ==========
    const session = await mongoose.startSession();

    try {
        return await session.withTransaction(async () => {
            // Re-buscar o carrinho dentro da transação para lock
            const cartInTransaction = await Cart.findById(cart._id).session(session);

            if (!cartInTransaction || cartInTransaction.totalItems === 0) {
                throw new Error('Carrinho foi modificado durante a transação');
            }

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

            // ✅ SEPARAR FOTOS ÚNICAS E PRODUTOS DE CATÁLOGO
            let photoItems = validItems.filter(item => !item.isCatalogProduct);
            const catalogItems = validItems.filter(item => item.isCatalogProduct);

            console.log(`📦 Items separados: ${photoItems.length} fotos únicas, ${catalogItems.length} produtos de catálogo`);
            if (catalogItems.length > 0) {
                catalogItems.forEach(item => {
                    console.log(`  📦 Catálogo: ${item.productName || item.fileName} x${item.quantity} @ $${item.unitPrice}`);
                });
            }

            // =====================================================
            // ✅ VALIDAÇÃO DE ESTOQUE PARA PRODUTOS DE CATÁLOGO
            // Verifica se ainda há estoque disponível antes de confirmar
            // IMPORTANTE: Não conta o carrinho ATUAL como reserva (são os itens sendo confirmados)
            // =====================================================
            if (catalogItems.length > 0) {
                const CatalogProduct = require('../models/CatalogProduct');

                const unavailableCatalogItems = [];

                for (const item of catalogItems) {
                    const catalogProduct = await CatalogProduct.findOne({ qbItem: item.qbItem });

                    if (!catalogProduct) {
                        unavailableCatalogItems.push({
                            qbItem: item.qbItem,
                            productName: item.productName || item.fileName,
                            requested: item.quantity,
                            available: 0,
                            reason: 'Produto não encontrado'
                        });
                    } else {
                        // ✅ CORREÇÃO: Calcular estoque disponível SEM contar o carrinho atual
                        // Fórmula: physicalStock - confirmedInSelections - reservasDeOUTROScarrinhos
                        // Como o item está no carrinho atual, ele já foi contado em reservedInCarts
                        // Então somamos de volta a quantidade do carrinho atual
                        const physicalStock = catalogProduct.currentStock || 0;
                        const confirmedInSelections = catalogProduct.confirmedInSelections || 0;
                        const reservedInOtherCarts = Math.max(0, (catalogProduct.reservedInCarts || 0) - item.quantity);

                        const effectiveAvailable = physicalStock - confirmedInSelections - reservedInOtherCarts;

                        console.log(`  📊 ${item.qbItem}: physical=${physicalStock} - selections=${confirmedInSelections} - otherCarts=${reservedInOtherCarts} = ${effectiveAvailable} (pedido: ${item.quantity})`);

                        if (effectiveAvailable < item.quantity) {
                            unavailableCatalogItems.push({
                                qbItem: item.qbItem,
                                productName: item.productName || item.fileName,
                                requested: item.quantity,
                                available: effectiveAvailable,
                                reason: `Estoque insuficiente (disponível: ${effectiveAvailable})`
                            });
                        } else {
                            console.log(`  ✅ ${item.qbItem}: ${item.quantity} de ${effectiveAvailable} disponíveis`);
                        }
                    }
                }

                // Se algum item não tem estoque suficiente, bloquear a seleção
                if (unavailableCatalogItems.length > 0) {
                    console.log(`❌ VALIDAÇÃO FALHOU: ${unavailableCatalogItems.length} produtos sem estoque suficiente`);
                    unavailableCatalogItems.forEach(item => {
                        console.log(`  ❌ ${item.productName}: ${item.reason}`);
                    });

                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        message: 'Alguns produtos de catálogo não estão mais disponíveis',
                        unavailableItems: unavailableCatalogItems,
                        errorCode: 'CATALOG_STOCK_UNAVAILABLE'
                    });
                }

                console.log(`✅ Validação de estoque concluída: todos os ${catalogItems.length} produtos disponíveis`);
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

            // 2. Buscar produtos detalhados (APENAS FOTOS, NÃO CATÁLOGO)
            const photoProductIds = photoItems.map(item => item.productId).filter(Boolean);
            console.log('🔍 DEBUG COMPLETO:');
            console.log('  Total items:', cart.items.length);
            console.log('  Photo items:', photoItems.length);
            console.log('  Catalog items:', catalogItems.length);
            console.log('  PhotoProductIds:', photoProductIds.length);
            console.log('  SessionId:', sessionId);
            console.log('  ClientCode:', clientCode);

            // Buscar produtos apenas para FOTOS (catálogo não tem UnifiedProductComplete)
            let products = [];
            if (photoProductIds.length > 0) {
                // Buscar SEM filtros primeiro para debug
                const allProducts = await UnifiedProductComplete.find({
                    _id: { $in: photoProductIds }
                }).session(session);

                console.log(`  Produtos encontrados (sem filtro): ${allProducts.length}`);
                if (allProducts.length > 0) {
                    allProducts.forEach(p => {
                        console.log(`    - ${p.fileName}: status=${p.status}, clientCode=${p.reservedBy?.clientCode}, sessionId=${p.reservedBy?.sessionId}`);
                    });
                }

                // Agora buscar com filtros
                products = await UnifiedProductComplete.find({
                    _id: { $in: photoProductIds },
                    $or: [
                        { status: 'available' },
                        {
                            status: 'reserved',
                            'reservedBy.clientCode': clientCode
                        }
                    ]
                }).session(session);

                console.log(`  Produtos válidos: ${products.length}`);

                // Se algumas fotos não estão disponíveis, continuar com as disponíveis
                if (products.length !== photoItems.length) {
                    const availableIds = products.map(p => p._id.toString());
                    const unavailableItems = photoItems.filter(item => !availableIds.includes(item.productId?.toString()));

                    console.log(`  ⚠️ AVISO: ${unavailableItems.length} fotos não disponíveis:`);
                    unavailableItems.forEach(item => {
                        console.log(`    - ${item.fileName} (não reservada ou indisponível)`);
                    });

                    // Filtrar photoItems para apenas os disponíveis
                    photoItems = photoItems.filter(item => availableIds.includes(item.productId?.toString()));
                    console.log(`  ✅ Continuando com ${products.length} fotos disponíveis`);

                    // Se NENHUMA foto está disponível E não há catálogo, aí sim é erro
                    if (products.length === 0 && catalogItems.length === 0) {
                        throw new Error('Nenhuma foto do carrinho está disponível para finalização');
                    }
                }
            } else {
                console.log('  ℹ️ Nenhuma foto única no carrinho (apenas produtos de catálogo)');
            }

            // 3. ✅ BUSCAR SALES REP DO CLIENTE
            console.log(`🔍 Buscando informações do cliente ${clientCode}...`);
            const AccessCode = require('../models/AccessCode');
            const accessCode = await AccessCode.findOne({ code: clientCode }).session(session);
            const salesRep = accessCode?.salesRep || 'Unassigned';
            const companyName = accessCode?.companyName || '-';
            const clientCurrency = accessCode?.preferences?.currency || 'USD';

            // Buscar taxa de câmbio atual
            let currencyRate = 1;
            let convertedValue = null;
            if (clientCurrency !== 'USD') {
                try {
                    const CurrencyService = require('../services/CurrencyService');
                    const ratesData = await CurrencyService.getRates();
                    currencyRate = ratesData.rates[clientCurrency] || 1;
                } catch (e) {
                    console.warn('⚠️ Erro ao buscar taxa de câmbio:', e.message);
                }
            }

            console.log(`🏢 Company: ${companyName} | 👤 Sales Rep: ${salesRep} | 💱 Currency: ${clientCurrency} (rate: ${currencyRate})`);

            // Criar seleção normal sempre
            let selectionId;
            let selection;

            // 4. Criar referência da seleção (R2 não precisa criar pasta física)
            console.log(`📁 Preparando seleção para cliente ${clientName}...`);

            // Calcular total de itens disponíveis (fotos válidas + catálogo)
            const actualItemCount = photoItems.length + catalogItems.length;

            // Criar objeto folderResult para compatibilidade
            const folderResult = {
                success: true,
                folderId: `selection-${clientCode}-${Date.now()}`,
                folderName: `${clientName}_${new Date().toISOString().split('T')[0]}_${actualItemCount}_items`,
                path: 'VIRTUAL_PATH'
            };

            console.log(`✅ Seleção preparada: ${folderResult.folderName}`);

            // 5. Preparar dados dos produtos para movimentação (APENAS FOTOS)
            const photosToMove = products.map(product => {
                const cartItem = photoItems.find(item => item.driveFileId === product.driveFileId);
                return {
                    driveFileId: product.driveFileId,
                    fileName: product.fileName,
                    category: product.category,
                    qbItem: product.qbItem,
                    productId: product._id,
                    thumbnailUrl: cartItem?.thumbnailUrl || product.thumbnailUrl
                };
            });

            // Gerar ID da seleção (sempre normal)
            selectionId = Selection.generateSelectionId();

            // 6. SISTEMA DE TAGS: Marcar fotos como reservadas (SEM MOVER!)
            // Só processar se houver fotos únicas
            let tagResult = { photosTagged: 0 };
            if (photosToMove.length > 0) {
                console.log(`🏷️ [TAGS] Marcando ${photosToMove.length} fotos como RESERVADAS...`);

                // Extrair IDs das fotos
                const photoIds = photosToMove.map(p => p.driveFileId);

                // Importar PhotoTagService
                const PhotoTagService = require('../services/PhotoTagService');

                // Usar tags ao invés de mover
                tagResult = await PhotoTagService.reservePhotos(
                    photoIds,
                    selectionId,
                    clientCode
                );

                console.log(`✅ [TAGS] ${tagResult.photosTagged} fotos marcadas como reservadas`);
                console.log('📍 [TAGS] Nenhuma movimentação física realizada!');
            } else {
                console.log('ℹ️ [TAGS] Nenhuma foto única para marcar (apenas produtos de catálogo)');
            }

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

            // ✅ PREPARAR ITEMS DA SELEÇÃO (FOTOS + CATÁLOGO)
            // Items de fotos únicas
            const photoSelectionItems = products.map(product => {
                const cartItem = photoItems.find(item => item.driveFileId === product.driveFileId);
                return {
                    productId: product._id,
                    driveFileId: product.driveFileId,
                    fileName: product.fileName,
                    category: product.category,
                    thumbnailUrl: cartItem?.thumbnailUrl || product.thumbnailUrl,
                    originalPath: product.category,
                    price: cartItem?.price || 0,
                    selectedAt: cartItem?.addedAt || new Date(),
                    transitStatus: cartItem?.transitStatus || null,
                    cdeTable: cartItem?.cdeTable || 'tbinventario',
                    isCatalogProduct: false
                };
            });

            // Items de catálogo
            const catalogSelectionItems = catalogItems.map(item => ({
                productId: item.productId || null,
                driveFileId: item.driveFileId,
                fileName: item.productName || item.fileName,
                category: item.category,
                thumbnailUrl: item.thumbnailUrl,
                originalPath: item.category,
                price: item.price || (item.unitPrice * item.quantity),
                selectedAt: item.addedAt || new Date(),
                transitStatus: null,
                cdeTable: 'tbinventario',
                // ✅ CAMPOS DE CATÁLOGO
                isCatalogProduct: true,
                qbItem: item.qbItem,
                productName: item.productName || item.fileName,
                quantity: item.quantity || 1,
                unitPrice: item.unitPrice || 0,
                reservedIDHs: item.reservedIDHs || []
            }));

            // Combinar todos os items
            const allSelectionItems = [...photoSelectionItems, ...catalogSelectionItems];

            // Contar total de unidades (fotos = 1 cada, catálogo = quantity cada)
            const totalUnits = photoSelectionItems.length + catalogItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
            console.log(`📊 Total items: ${allSelectionItems.length} (${photoSelectionItems.length} fotos + ${catalogSelectionItems.length} catálogo = ${totalUnits} unidades)`);

            // Criar nova seleção
            const selectionData = {
                selectionId,
                sessionId,
                clientCode,
                clientName,
                clientCompany: companyName,
                salesRep: salesRep,
                customerNotes: observations || null,
                galleryType: galleryType,
                items: allSelectionItems,
                totalItems: allSelectionItems.length,
                totalValue: totalValue,
                clientCurrency: clientCurrency,
                currencyRate: currencyRate,
                convertedValue: clientCurrency !== 'USD' ? totalValue * currencyRate : null,
                status: 'pending',
                googleDriveInfo: {
                    clientFolderId: folderResult.folderId,
                    clientFolderName: folderResult.folderName,
                    clientFolderPath: folderResult.path
                },
                reservationExpiredAt: new Date(Date.now() + (24 * 60 * 60 * 1000))
            };

            selection = new Selection(selectionData);
            selection.addMovementLog('created', `Seleção criada com ${allSelectionItems.length} itens`);

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

                    // Marcar carrinho como inativo (dentro da transação)
                    // Delete será feito DEPOIS da transação para evitar write conflict
                    await Cart.updateOne(
                        { sessionId: sessionId },
                        { $set: { isActive: false } }
                    ).session(session);
                    console.log(`🔒 Carrinho ${sessionId} marcado como inativo`);

                    console.log(`   ➡️ Cliente precisa contatar vendedor para novo acesso`);
                }

            } catch (desactivateError) {
                console.error('⚠️ Erro ao desativar cliente:', desactivateError);
            }
            // ===== FIM DA DESATIVAÇÃO =====

            // 9. Atualizar status dos produtos (APENAS FOTOS - Catálogo não tem UnifiedProductComplete)
            if (photoProductIds.length > 0) {
                console.log(`🏷️ Marcando ${photoProductIds.length} fotos com selectionId: ${selectionId}`);

                // PRIMEIRA ETAPA: Atualizar status e campos básicos incluindo cdeStatus
                const updateResult = await UnifiedProductComplete.updateMany(
                    { _id: { $in: photoProductIds } },
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
                    { _id: { $in: photoProductIds } },
                    {
                        $set: {
                            'selectionId': String(selectionId),
                            'reservedBy.inSelection': true,
                            'reservedBy.selectionId': String(selectionId)
                        }
                    }
                ).session(session);

                console.log(`📊 Segunda etapa - selectionUpdateResult: ${JSON.stringify(selectionUpdateResult)}`);
            } else {
                console.log('ℹ️ Nenhuma foto única para atualizar status (apenas produtos de catálogo)');
            }

            // ========== 🆕 ATUALIZAR CDE EM BACKGROUND COM SALES REP (APENAS FOTOS) ==========
            if (products.length > 0) {
                console.log('📡 Atualizando CDE em background (fotos únicas)...');
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
                        const confirmedCount = await CDEWriter.bulkMarkAsConfirmed(
                            photoNumbers,
                            clientCode,
                            clientName,
                            salesRep,
                            cdeTables
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

                // Verificação pós-update
                const verifyUpdate = await UnifiedProductComplete.findOne(
                    { _id: photoProductIds[0] },
                    { selectionId: 1, status: 1 }
                ).session(session);

                console.log(`✅ Verificação pós-update:`, {
                    selectionId: verifyUpdate?.selectionId,
                    status: verifyUpdate?.status
                });

                if (!verifyUpdate?.selectionId) {
                    console.error('⚠️ AVISO: selectionId não foi salvo corretamente!');
                }
            } else {
                console.log('ℹ️ [CDE] Nenhuma foto única para confirmar no CDE (apenas produtos de catálogo)');
                console.log('📦 [CATALOG] Produtos de catálogo não alteram CDE por enquanto');
            }
            // ========== FIM DA ATUALIZAÇÃO CDE ==========

            // 11. Enviar email de notificação (em background)
            setImmediate(async () => {
                try {
                    console.log(`📧 Enviando notificação de nova seleção...`);

                    // Log detalhado dos items para email
                    const photoItemsForEmail = cart.items.filter(i => !i.isCatalogProduct);
                    const catalogItemsForEmail = cart.items.filter(i => i.isCatalogProduct);
                    console.log(`📧 Email terá: ${photoItemsForEmail.length} fotos + ${catalogItemsForEmail.length} produtos de catálogo`);
                    if (catalogItemsForEmail.length > 0) {
                        catalogItemsForEmail.forEach(item => {
                            console.log(`  📦 Email catalog: ${item.qbItem} - ${item.productName || item.fileName} x${item.quantity} @ $${item.unitPrice}`);
                        });
                    }

                    const emailService = EmailService.getInstance();
                    const emailResult = await emailService.notifyNewSelection({
                        selectionId,
                        clientCode,
                        clientName,
                        clientCompany: companyName,
                        salesRep: salesRep,
                        totalItems: cart.totalItems,
                        totalValue: totalValue,
                        clientCurrency: clientCurrency,
                        observations: observations || '',
                        items: cart.items, // Lista de items com isCatalogProduct flag
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

        // ========== DELETAR CARRINHO APÓS TRANSAÇÃO ==========
        // Fazer FORA da transação para evitar write conflicts com sync
        try {
            await Cart.deleteOne({ sessionId: sessionId });
            console.log(`🗑️ Carrinho ${sessionId} deletado após criar seleção`);
        } catch (deleteError) {
            console.error('⚠️ Erro ao deletar carrinho (não crítico):', deleteError.message);
            // Não é crítico - carrinho já está inativo, seleção já foi criada
        }

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