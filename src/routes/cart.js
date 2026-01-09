// src/routes/cart.js
// VERSÃO SIMPLIFICADA - Rotas diretas sem complexidade desnecessária

const express = require('express');
const CartService = require('../services/CartService');
const PhotoCategory = require('../models/PhotoCategory');
const AccessCode = require('../models/AccessCode');
const Selection = require('../models/Selection');
const CDEQueries = require('../ai/CDEQueries');
const CDEWriter = require('../services/CDEWriter');
const CatalogSyncService = require('../services/CatalogSyncService');

// Instância do CDEQueries para catálogo
const cdeQueries = new CDEQueries();

// Instância do CatalogSyncService para sincronização de estoque
const catalogSyncService = CatalogSyncService.getInstance();

const router = express.Router();

// ============================================
// GLOBAL MIX & MATCH CONFIGURATION
// ============================================
// NOTA: Esta lista está sendo mantida temporariamente para compatibilidade
// O sistema está migrando para usar participatesInMixMatch do banco de dados
const GLOBAL_MIX_MATCH_CATEGORIES = [
    'Brazilian Cowhides',
    'Colombian Cowhides',
    'Brazil Best Sellers',
    'Brazil Top Selected Categories'
];

/**
 * Verifica se uma categoria participa do Mix & Match global
 */
function isGlobalMixMatch(categoryPath) {
    if (!categoryPath) return false;

    const mainCategory = categoryPath.split('/')[0];

    // Normalizar para comparação
    const normalized = mainCategory.trim();

    return GLOBAL_MIX_MATCH_CATEGORIES.some(mixCat =>
        normalized.includes(mixCat) || mixCat.includes(normalized)
    );
}

/**
 * Middleware de validação robusto
 * Verifica: sessionId, clientCode E se cliente existe/está ativo no banco
 */
const validateRequest = async (req, res, next) => {
    const sessionId = req.params.sessionId || req.body.sessionId;
    const clientCode = req.body.clientCode;

    if (req.path.includes('/add') || req.path.includes('/remove')) {
        // Validação básica do sessionId
        if (!sessionId || sessionId.length < 10) {
            console.log(`[CART-VALIDATION] ❌ SessionId inválido: ${sessionId}`);
            return res.status(400).json({
                success: false,
                message: 'SessionId inválido'
            });
        }

        // Validação do clientCode para adição
        if (req.path.includes('/add')) {
            if (!clientCode || clientCode.length !== 4) {
                console.log(`[CART-VALIDATION] ❌ ClientCode inválido: ${clientCode}`);
                return res.status(400).json({
                    success: false,
                    message: 'Código de cliente inválido'
                });
            }

            // 🆕 NOVA VALIDAÇÃO: Verificar se cliente existe e está ativo
            try {
                const client = await AccessCode.findOne({ code: clientCode });

                if (!client) {
                    console.log(`[CART-VALIDATION] ❌ Cliente não encontrado: ${clientCode}`);
                    return res.status(404).json({
                        success: false,
                        message: 'Cliente não encontrado'
                    });
                }

                if (!client.isActive) {
                    console.log(`[CART-VALIDATION] ❌ Cliente inativo: ${clientCode}`);
                    return res.status(403).json({
                        success: false,
                        message: 'Código de acesso expirado ou inativo. Entre em contato com seu vendedor.'
                    });
                }

                // Anexar dados do cliente validado ao request
                req.validatedClient = {
                    code: client.code,
                    salesRep: client.salesRep,
                    companyName: client.companyName,
                    ttlHours: client.cartSettings?.ttlHours || 24
                };

            } catch (dbError) {
                console.error(`[CART-VALIDATION] ⚠️ Erro ao validar cliente:`, dbError.message);
                // Em caso de erro de DB, deixa passar (fail-open para não bloquear)
                // O CartService vai tentar de novo de qualquer forma
            }
        }
    }

    req.validatedData = { sessionId, clientCode };
    next();
};

/**
 * POST /api/cart/add
 * Adicionar item ao carrinho - operação síncrona e instantânea
 */
router.post('/add', validateRequest, async (req, res) => {
    try {
        const {
            sessionId, clientCode, clientName, driveFileId,
            fileName, category, thumbnailUrl,
            basePrice, price, formattedPrice, hasPrice
        } = req.body;

        if (!driveFileId) {
            return res.status(400).json({
                success: false,
                message: 'ID do arquivo é obrigatório'
            });
        }

        // 🆕 Log estruturado para diagnóstico
        console.log(`[CART-ADD] 📥 Início | Cliente: ${clientCode} | Foto: ${fileName} | Session: ${sessionId?.substring(0, 8)}...`);

        // 🆕 Usar dados pré-validados se disponíveis (evita query duplicada)
        const validatedClient = req.validatedClient;

        const result = await CartService.addToCart(
            sessionId,
            clientCode,
            clientName,
            driveFileId,
            {
                fileName,
                category: category ? category.replace(/\//g, ' → ') : category,  // ✅ Sempre converte
                thumbnailUrl,
                basePrice: basePrice || 0,
                price: price || 0,
                formattedPrice,
                hasPrice
            }
        );

        // ⭐ RECALCULAR preços e totais antes de retornar
        let totals = null;
        if (result.success && result.cart) {
            totals = await calculateCartTotals(result.cart);
        }

        // 🆕 Log de sucesso
        if (result.success) {
            console.log(`[CART-ADD] ✅ Sucesso | Cliente: ${clientCode} | Foto: ${fileName} | Total: ${result.cart?.totalItems || 0} itens`);
        }

        res.status(201).json({
            ...result,
            totals: totals // ✅ ADICIONAR TOTALS!
        });

    } catch (error) {
        // 🆕 Log estruturado de erro com mais contexto
        console.error(`[CART-ADD] ❌ Erro | Cliente: ${req.body.clientCode} | Foto: ${req.body.fileName} | Erro: ${error.message}`);

        let statusCode = 500;
        let userMessage = error.message;

        // 🆕 Mapeamento de erros mais específico
        if (error.message.includes('reservado') || error.message.includes('reserved')) {
            statusCode = 423; // Locked
            userMessage = 'This item is currently reserved by another customer';
        } else if (error.message.includes('já está') || error.message.includes('already')) {
            statusCode = 409; // Conflict
            userMessage = 'This item is already in your cart';
        } else if (error.message.includes('não disponível') || error.message.includes('unavailable')) {
            statusCode = 410; // Gone
            userMessage = 'This item is no longer available';
        } else if (error.message.includes('não encontrado') || error.message.includes('not found')) {
            statusCode = 404;
            userMessage = 'Item not found';
        }

        res.status(statusCode).json({
            success: false,
            message: userMessage,
            errorCode: statusCode // 🆕 Para debugging no frontend
        });
    }
});

/**
 * POST /api/cart/add-catalog
 * Adicionar produto de catálogo ao carrinho (com quantidade)
 */
router.post('/add-catalog', validateRequest, async (req, res) => {
    try {
        const {
            sessionId, clientCode, clientName,
            qbItem, productName, category,
            catalogCategory,  // ✅ Para categorização correta no carrinho
            quantity, unitPrice, thumbnailUrl
        } = req.body;

        if (!qbItem) {
            return res.status(400).json({
                success: false,
                message: 'Código do produto (qbItem) é obrigatório'
            });
        }

        const qty = parseInt(quantity) || 1;
        if (qty < 1 || qty > 100) {
            return res.status(400).json({
                success: false,
                message: 'Quantidade deve estar entre 1 e 100'
            });
        }

        console.log(`[ROUTE] Adicionando ${qty}x ${productName || qbItem} ao carrinho de ${clientName}`);

        // =====================================================
        // ESTOQUE LÓGICO - NÃO ALTERA CDE, APENAS VERIFICA
        // O CDE permanece inalterado para produtos de catálogo
        // A reserva é apenas lógica no MongoDB
        // =====================================================

        // Verificar estoque físico no CDE (apenas leitura)
        const stockInfo = await cdeQueries.getCatalogProductStock(qbItem);
        console.log(`[ROUTE] 📦 Estoque físico CDE para ${qbItem}: ${stockInfo.available}`);

        // Verificar estoque lógico disponível (físico - reservado - confirmado)
        const CatalogProduct = require('../models/CatalogProduct');
        let catalogProduct = await CatalogProduct.findOne({ qbItem });

        // ✅ CRIAR PRODUTO NO MONGODB SE NÃO EXISTIR
        if (!catalogProduct) {
            console.log(`[ROUTE] 📝 Criando CatalogProduct para ${qbItem} no MongoDB...`);
            catalogProduct = new CatalogProduct({
                qbItem,
                name: productName || `Product ${qbItem}`,
                category: category || 'Catalog Product',
                displayCategory: catalogCategory || 'other',
                currentStock: stockInfo.available,
                availableStock: stockInfo.available,
                reservedInCarts: 0,
                confirmedInSelections: 0,
                isActive: true
            });
            await catalogProduct.save();
            console.log(`[ROUTE] ✅ CatalogProduct ${qbItem} criado com estoque ${stockInfo.available}`);
        } else {
            // Atualizar estoque físico do CDE se mudou
            if (catalogProduct.currentStock !== stockInfo.available) {
                catalogProduct.currentStock = stockInfo.available;
                catalogProduct.recalculateAvailableStock();
                await catalogProduct.save();
            }
        }

        // Calcular estoque disponível considerando reservas locais
        const reservedInCarts = catalogProduct.reservedInCarts || 0;
        const confirmedInSelections = catalogProduct.confirmedInSelections || 0;
        const logicalAvailable = stockInfo.available - reservedInCarts - confirmedInSelections;

        console.log(`[ROUTE] 📊 Estoque lógico: ${stockInfo.available} - ${reservedInCarts} (carrinhos) - ${confirmedInSelections} (seleções) = ${logicalAvailable}`);

        if (logicalAvailable < qty) {
            return res.status(400).json({
                success: false,
                message: `Estoque insuficiente. Disponível: ${Math.max(0, logicalAvailable)}`,
                available: Math.max(0, logicalAvailable)
            });
        }

        console.log(`[ROUTE] ✅ Reserva lógica aprovada: ${qty} unidades de ${qbItem}`);

        // Adicionar ao carrinho via CartService (sem reserva de IDHs no CDE)
        const result = await CartService.addCatalogToCart(
            sessionId,
            clientCode,
            clientName,
            {
                qbItem,
                productName: productName || `Product ${qbItem}`,
                category: category || 'Catalog Product',
                catalogCategory: catalogCategory || null,
                quantity: qty,
                unitPrice: unitPrice || 0,
                thumbnailUrl
                // NÃO passa reservedIDHs - estoque é apenas lógico
            }
        );

        // Recalcular totais
        let totals = null;
        if (result.success && result.cart) {
            totals = await calculateCartTotals(result.cart);
        }

        // ✅ SINCRONIZAR ESTOQUE LÓGICO (em background)
        if (result.success && qbItem) {
            catalogSyncService.syncSingleProduct(qbItem).catch(syncErr => {
                console.warn(`[ROUTE] ⚠️ Erro ao sincronizar estoque de ${qbItem}:`, syncErr.message);
            });
        }

        res.status(201).json({
            ...result,
            totals
        });

    } catch (error) {
        console.error('[ROUTE] Erro ao adicionar catálogo:', error.message);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * PUT /api/cart/update-catalog-quantity
 * Atualizar quantidade de produto de catálogo no carrinho
 */
router.put('/update-catalog-quantity', validateRequest, async (req, res) => {
    try {
        const { sessionId, qbItem, quantity } = req.body;

        if (!qbItem) {
            return res.status(400).json({
                success: false,
                message: 'Código do produto (qbItem) é obrigatório'
            });
        }

        const newQty = parseInt(quantity);
        if (newQty < 0 || newQty > 100) {
            return res.status(400).json({
                success: false,
                message: 'Quantidade deve estar entre 0 e 100'
            });
        }

        console.log(`[ROUTE] Atualizando quantidade de ${qbItem} para ${newQty}`);

        const result = await CartService.updateCatalogQuantity(sessionId, qbItem, newQty);

        // Recalcular totais
        let totals = null;
        if (result.success && result.cart) {
            totals = await calculateCartTotals(result.cart);
        }

        // ✅ SINCRONIZAR ESTOQUE LÓGICO (em background)
        if (result.success && qbItem) {
            catalogSyncService.syncSingleProduct(qbItem).catch(syncErr => {
                console.warn(`[ROUTE] ⚠️ Erro ao sincronizar estoque de ${qbItem}:`, syncErr.message);
            });
        }

        res.json({
            ...result,
            totals
        });

    } catch (error) {
        console.error('[ROUTE] Erro ao atualizar quantidade:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * DELETE /api/cart/remove-catalog/:qbItem
 * Remover produto de catálogo do carrinho
 */
router.delete('/remove-catalog/:qbItem', validateRequest, async (req, res) => {
    try {
        const { qbItem } = req.params;
        const { sessionId } = req.body;

        console.log(`[ROUTE] Removendo produto de catálogo ${qbItem} do carrinho`);

        const result = await CartService.removeCatalogFromCart(sessionId, qbItem);

        // Recalcular totais
        let totals = null;
        if (result.success && result.cart) {
            totals = await calculateCartTotals(result.cart);
        }

        // ✅ SINCRONIZAR ESTOQUE LÓGICO (em background)
        if (result.success && qbItem) {
            catalogSyncService.syncSingleProduct(qbItem).catch(syncErr => {
                console.warn(`[ROUTE] ⚠️ Erro ao sincronizar estoque de ${qbItem}:`, syncErr.message);
            });
        }

        res.json({
            ...result,
            totals
        });

    } catch (error) {
        console.error('[ROUTE] Erro ao remover produto de catálogo:', error.message);
        res.status(error.message.includes('não encontrado') ? 404 : 500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * DELETE /api/cart/remove/:driveFileId
 * Remover item do carrinho - operação síncrona e instantânea
 */
router.delete('/remove/:driveFileId', validateRequest, async (req, res) => {
    try {
        const { driveFileId } = req.params;
        const { sessionId, clientCode } = req.body;

        // 🆕 Log estruturado
        console.log(`[CART-REMOVE] 📤 Início | Session: ${sessionId?.substring(0, 8)}... | Client: ${clientCode || 'N/A'} | FileId: ${driveFileId?.substring(0, 20)}...`);

        // 🆕 Passar clientCode para fallback
        const result = await CartService.removeFromCart(sessionId, driveFileId, clientCode);

        // ⭐ OTIMIZAÇÃO: Calcular totais uma única vez e retornar na resposta
        let totals = null;
        if (result.success && result.cart) {
            totals = await calculateCartTotals(result.cart);
        }

        // 🆕 Log de sucesso
        if (result.success) {
            console.log(`[CART-REMOVE] ✅ Sucesso | Session: ${sessionId?.substring(0, 8)}... | Itens restantes: ${result.cart?.totalItems || 0}`);
        }

        res.json({
            ...result,
            totals: totals  // ✅ Incluir totais na resposta
        });

    } catch (error) {
        // 🆕 Log de erro estruturado
        console.error(`[CART-REMOVE] ❌ Erro | Session: ${req.body.sessionId?.substring(0, 8)}... | Erro: ${error.message}`);

        let statusCode = 500;
        if (error.message.includes('não encontrado') || error.message.includes('not found')) {
            statusCode = 404;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message,
            errorCode: statusCode
        });
    }
});

/**
 * GET /api/cart/:sessionId
 * Buscar carrinho completo com preços recalculados por volume
 */
router.get('/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const cart = await CartService.getCart(sessionId);

        if (!cart) {
            return res.json({
                success: true,
                message: 'Carrinho vazio',
                data: {
                    totalItems: 0,
                    items: [],
                    isEmpty: true
                }
            });
        }

        // RECALCULAR PREÇOS DE CADA ITEM baseado em volume
        // ⭐ SEPARAR: Produtos de catálogo vs fotos únicas
        const catalogItems = cart.items.filter(item => item.isCatalogProduct);
        const uniquePhotoItems = cart.items.filter(item => !item.isCatalogProduct);

        console.log('🔄 [DEBUG] Recalculando preços do carrinho...');
        console.log(`📦 [DEBUG] ${catalogItems.length} produtos de catálogo, ${uniquePhotoItems.length} fotos únicas`);

        // ============================================
        // RECALCULAR GOATSKINS (tier pricing)
        // ============================================
        const goatskinItems = catalogItems.filter(item =>
            item.catalogCategory === 'goatskin' ||
            item.qbItem?.startsWith('900') ||
            item.productName?.toLowerCase().includes('goatskin')
        );

        if (goatskinItems.length > 0) {
            const CatalogProduct = require('../models/CatalogProduct');
            const totalGoatskinQty = goatskinItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

            let tierLevel, tierName;
            if (totalGoatskinQty >= 25) {
                tierLevel = 3; tierName = 'Gold (24+)';
            } else if (totalGoatskinQty >= 13) {
                tierLevel = 2; tierName = 'Silver (13-24)';
            } else {
                tierLevel = 1; tierName = 'Bronze (1-12)';
            }

            console.log(`🐐 [LOAD] Goatskins: ${totalGoatskinQty} total → ${tierName}`);

            for (const item of goatskinItems) {
                const catalogProduct = await CatalogProduct.findOne({ qbItem: item.qbItem });
                if (catalogProduct) {
                    const basePrice = catalogProduct.tier1Price || 0;
                    let unitPrice = basePrice;

                    if (tierLevel === 3) {
                        unitPrice = catalogProduct.tier3Price || catalogProduct.tier2Price || basePrice;
                    } else if (tierLevel === 2) {
                        unitPrice = catalogProduct.tier2Price || basePrice;
                    }

                    const qty = item.quantity || 1;
                    item.unitPrice = unitPrice;
                    item.basePrice = basePrice;
                    item.price = unitPrice * qty;
                    item.formattedPrice = unitPrice > 0 ? `$${item.price.toFixed(2)}` : 'No price';
                    item.tierInfo = { level: tierLevel, name: tierName, totalQty: totalGoatskinQty };

                    console.log(`   🐐 ${item.productName}: ${qty} × $${unitPrice} = $${item.price}`);
                }
            }
        }

        // ============================================
        // RECALCULAR CALFSKINS (tier pricing)
        // ============================================
        const calfskinItems = catalogItems.filter(item =>
            item.catalogCategory === 'calfskin' ||
            item.productName?.toLowerCase().includes('calfskin')
        );

        if (calfskinItems.length > 0) {
            const CatalogProduct = require('../models/CatalogProduct');
            const totalCalfskinQty = calfskinItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

            let tierLevel, tierName;
            if (totalCalfskinQty >= 25) {
                tierLevel = 3; tierName = 'Gold (24+)';
            } else if (totalCalfskinQty >= 13) {
                tierLevel = 2; tierName = 'Silver (13-24)';
            } else {
                tierLevel = 1; tierName = 'Bronze (1-12)';
            }

            console.log(`🐄 [LOAD] Calfskins: ${totalCalfskinQty} total → ${tierName}`);

            for (const item of calfskinItems) {
                const catalogProduct = await CatalogProduct.findOne({ qbItem: item.qbItem });
                if (catalogProduct && (catalogProduct.tier1Price > 0 || catalogProduct.tier2Price > 0 || catalogProduct.tier3Price > 0)) {
                    const basePrice = catalogProduct.tier1Price || 0;
                    let unitPrice = basePrice;

                    if (tierLevel === 3) {
                        unitPrice = catalogProduct.tier3Price || catalogProduct.tier2Price || basePrice;
                    } else if (tierLevel === 2) {
                        unitPrice = catalogProduct.tier2Price || basePrice;
                    }

                    const qty = item.quantity || 1;
                    item.unitPrice = unitPrice;
                    item.basePrice = basePrice;
                    item.price = unitPrice * qty;
                    item.formattedPrice = unitPrice > 0 ? `$${item.price.toFixed(2)}` : 'No price';
                    item.tierInfo = { level: tierLevel, name: tierName, totalQty: totalCalfskinQty };

                    console.log(`   🐄 ${item.productName}: ${qty} × $${unitPrice} = $${item.price}`);
                }
            }
        }

        // ============================================
        // RECALCULAR FOTOS ÚNICAS (por categoria)
        // ============================================
        const itemsByCategory = {};
        uniquePhotoItems.forEach(item => {
            const categoryPath = item.category || 'Uncategorized';
            if (!itemsByCategory[categoryPath]) {
                itemsByCategory[categoryPath] = [];
            }
            itemsByCategory[categoryPath].push(item);
        });

        console.log(`📂 [DEBUG] ${Object.keys(itemsByCategory).length} categorias de fotos únicas`);

        for (const [categoryPath, items] of Object.entries(itemsByCategory)) {
            const quantity = items.length;

            console.log(`\n📂 [DEBUG] Categoria: ${categoryPath}`);
            console.log(`📊 [DEBUG] Quantidade: ${quantity} items`);

            // Buscar categoria no banco
            const categoryName = categoryPath.split('/').pop().replace('/', '');
            const category = await PhotoCategory.findOne({
                $or: [
                    { folderName: categoryName },
                    { displayName: { $regex: categoryName } }
                ]
            });

            if (category) {
                // Calcular preço correto para essa quantidade
                const priceResult = await category.getPriceForClient(cart.clientCode, quantity);

                console.log(`💰 [DEBUG] Preço calculado: $${priceResult.finalPrice} (${priceResult.appliedRule})`);
                console.log(`📝 [DEBUG] Atualizando ${items.length} items para $${priceResult.finalPrice}`);

                // ATUALIZAR o campo price de TODOS os items dessa categoria
                items.forEach(item => {
                    item.price = priceResult.finalPrice;
                    item.formattedPrice = `$${priceResult.finalPrice.toFixed(2)}`;
                });
            } else {
                console.log(`❌ [DEBUG] Categoria não encontrada no banco!`);
            }
        }

        console.log('\n✅ [DEBUG] Recálculo completo!\n');

        // Calcular totais com os novos preços
        const totals = await calculateCartTotals(cart);

        res.json({
            success: true,
            data: {
                sessionId: cart.sessionId,
                clientCode: cart.clientCode,
                clientName: cart.clientName,
                totalItems: cart.totalItems,
                items: cart.items, // Items agora têm preços atualizados!
                totals: totals,
                lastActivity: cart.lastActivity,
                isEmpty: cart.totalItems === 0
            }
        });

    } catch (error) {
        console.error('[ROUTE] Erro ao buscar carrinho:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/cart/:sessionId/summary
 * Resumo rápido do carrinho
 */
router.get('/:sessionId/summary', async (req, res) => {
    try {
        const { sessionId } = req.params;

        // Buscar carrinho completo
        const cart = await CartService.getCart(sessionId);

        if (!cart) {
            return res.json({
                success: true,
                totalItems: 0,
                items: [],
                isEmpty: true,
                totals: {
                    subtotal: 0,
                    discount: 0,
                    total: 0,
                    mixMatchInfo: null
                }
            });
        }

        // ⭐ RECALCULAR preços E capturar totals
        const totals = await calculateCartTotals(cart);

        res.json({
            success: true,
            sessionId: cart.sessionId,
            totalItems: cart.totalItems,
            items: cart.items, // Com preços recalculados!
            isEmpty: cart.totalItems === 0,
            totals: totals // ✅ ADICIONAR TOTALS COM mixMatchInfo!
        });

    } catch (error) {
        console.error('[ROUTE] Erro ao buscar resumo:', error.message);
        res.json({
            success: false,
            totalItems: 0,
            items: [],
            isEmpty: true,
            totals: {
                subtotal: 0,
                discount: 0,
                total: 0,
                mixMatchInfo: null
            }
        });
    }
});

/**
 * GET /api/cart/:sessionId/calculate-total
 * Calcular total com descontos
 */
router.get('/:sessionId/calculate-total', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const cart = await CartService.getCart(sessionId);

        if (!cart || cart.totalItems === 0) {
            return res.json({
                success: true,
                data: {
                    totalItems: 0,
                    subtotal: 0,
                    total: 0
                }
            });
        }

        const totals = {
            totalItems: cart.totalItems,
            subtotal: 0,
            discount: 0,
            total: 0,
            discountPercent: 0
        };

        res.json({
            success: true,
            data: totals
        });

    } catch (error) {
        console.error('[ROUTE] Erro ao calcular total:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/cart/:clientCode/extend
 * Estender tempo do carrinho
 */
router.post('/:clientCode/extend', async (req, res) => {
    try {
        const { clientCode } = req.params;
        const { hours = 1, extendedBy = 'admin' } = req.body;

        const result = await CartService.extendCartTime(clientCode, hours, extendedBy);

        res.json({
            success: true,
            message: `Carrinho estendido por ${hours} horas`,
            ...result
        });

    } catch (error) {
        console.error('[ROUTE] Erro ao estender tempo:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/cart/active/:clientCode
 * Buscar carrinho ativo do cliente
 */
router.get('/active/:clientCode', async (req, res) => {
    try {
        const { clientCode } = req.params;

        const Cart = require('../models/Cart');
        const cart = await Cart.findOne({
            clientCode: clientCode,
            isActive: true,
            totalItems: { $gt: 0 }
        }).sort({ lastActivity: -1 });

        if (!cart) {
            return res.json({
                success: true,
                message: 'Nenhum carrinho ativo',
                totalItems: 0,
                items: []
            });
        }

        const summary = await CartService.getCartSummary(cart.sessionId);

        res.json({
            success: true,
            sessionId: cart.sessionId,
            ...summary
        });

    } catch (error) {
        console.error('[ROUTE] Erro ao buscar carrinho ativo:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/cart/process-expired
 * Processar itens expirados manualmente
 */
router.post('/process-expired', async (req, res) => {
    try {
        const Cart = require('../models/Cart');
        const now = new Date();

        const cartsWithExpired = await Cart.find({
            isActive: true,
            'items.expiresAt': { $lt: now }
        });

        let processedCount = 0;

        for (const cart of cartsWithExpired) {
            const expiredItems = cart.items.filter(item =>
                item.expiresAt && new Date(item.expiresAt) < now
            );

            for (const item of expiredItems) {
                await CartService.processExpiredItem(item, cart);
                processedCount++;
            }
        }

        res.json({
            success: true,
            message: `${processedCount} itens expirados processados`,
            timestamp: new Date()
        });

    } catch (error) {
        console.error('[ROUTE] Erro ao processar expirados:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/cart/stats/system
 * Estatísticas do sistema
 */
router.get('/stats/system', async (req, res) => {
    try {
        const stats = await CartService.getSystemStats();

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('[ROUTE] Erro ao buscar estatísticas:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * ⭐ CACHE para evitar cálculos duplicados
 * Armazena resultado por 1 segundo baseado no hash do carrinho
 */
const totalsCache = new Map();
const CACHE_TTL_MS = 1000; // 1 segundo

function getCartHash(cart) {
    if (!cart || !cart.items) return 'empty';
    // Hash baseado em: clientCode + quantidade de itens + IDs + quantidades (para catalog products)
    const itemDetails = cart.items.map(i => {
        const id = i.driveFileId || i.qbItem || 'unknown';
        const qty = i.quantity || 1;
        return `${id}:${qty}`;
    }).sort().join(',');
    return `${cart.clientCode}_${cart.totalItems}_${itemDetails}`;
}

/**
 * Função auxiliar para calcular totais do carrinho
 * ATUALIZADO: Agora usa participatesInMixMatch do banco de dados
 * ⭐ OTIMIZADO: Cache de 1s para evitar cálculos repetidos
 */
async function calculateCartTotals(cart) {
    if (!cart || cart.totalItems === 0) {
        return {
            subtotal: 0,
            discount: 0,
            total: 0,
            mixMatchInfo: null
        };
    }

    // ⭐ Verificar cache antes de calcular
    const cartHash = getCartHash(cart);
    const cached = totalsCache.get(cartHash);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
        console.log(`⚡ [CACHE] Retornando totais do cache (${cart.totalItems} itens)`);
        return cached.result;
    }

    let subtotalMixMatch = 0;      // Subtotal Mix & Match (Tier 1)
    let subtotalOthers = 0;        // Subtotal outras categorias
    let totalMixMatch = 0;         // Total Mix & Match (com tier)
    let totalOthers = 0;           // Total outras categorias

    // Verificar se é Special Selection
    const accessCode = await AccessCode.findOne({ code: cart.clientCode });
    const isSpecialSelection = accessCode?.accessType === 'special';

    // ============================================
    // PASSO 0: FILTRAR GHOST ITEMS (não devem participar do cálculo)
    // ============================================
    const validItems = cart.items.filter(item => item.ghostStatus !== 'ghost');

    if (validItems.length === 0) {
        console.log(`👻 [CART] Todos os itens são ghost - carrinho vazio para cálculo`);
        return {
            subtotal: 0,
            discount: 0,
            total: 0,
            mixMatchInfo: null,
            validItemsCount: 0,
            ghostItemsCount: cart.items.length
        };
    }

    console.log(`📊 [CART] Calculando: ${validItems.length} itens válidos (${cart.items.length - validItems.length} ghosts excluídos)`);

    // ============================================
    // PASSO 1: Extrair categorias únicas e buscar do banco
    // ============================================
    const uniqueCategoryPaths = [...new Set(validItems.map(item => item.category || 'uncategorized'))];

    // Identificar quais categorias têm APENAS produtos de catálogo (para não mostrar warnings)
    const catalogOnlyCategories = new Set();
    for (const categoryPath of uniqueCategoryPaths) {
        const itemsInCategory = validItems.filter(item => (item.category || 'uncategorized') === categoryPath);
        const allAreCatalog = itemsInCategory.every(item => item.isCatalogProduct);
        if (allAreCatalog) {
            catalogOnlyCategories.add(categoryPath);
        }
    }

    // Buscar todas as categorias do banco de uma vez
    const categoryMixMatchMap = {};

    for (const categoryPath of uniqueCategoryPaths) {
        let cleanPath = categoryPath.endsWith('/') ? categoryPath.slice(0, -1) : categoryPath;
        const normalizedPath = cleanPath.replace(/ → /g, '/');

        // Se a categoria só tem produtos de catálogo, não precisa buscar no MongoDB
        // Produtos de catálogo nunca participam do Mix & Match
        if (catalogOnlyCategories.has(categoryPath)) {
            categoryMixMatchMap[categoryPath] = false;
            console.log(`📦 [CATÁLOGO] ${cleanPath}: Categoria de produtos de estoque (não participa do Mix & Match)`);
            continue;
        }

        const category = await PhotoCategory.findOne({
            $or: [
                { googleDrivePath: normalizedPath },
                { googleDrivePath: normalizedPath + '/' },
                { displayName: cleanPath }
            ]
        });

        if (category) {
            // PRIORIDADE: Usar participatesInMixMatch do banco de dados
            categoryMixMatchMap[categoryPath] = category.participatesInMixMatch === true;
            console.log(`📊 [MIX&MATCH] ${cleanPath}: participatesInMixMatch = ${category.participatesInMixMatch}`);
        } else {
            // FALLBACK: Usar lista hardcoded se categoria não encontrada
            categoryMixMatchMap[categoryPath] = isGlobalMixMatch(categoryPath);
            console.log(`⚠️ [MIX&MATCH] ${cleanPath}: Categoria não encontrada, usando fallback = ${categoryMixMatchMap[categoryPath]}`);
        }
    }

    // ============================================
    // PASSO 2: SEPARAR ITEMS EM 2 GRUPOS BASEADO NO BANCO
    // ============================================
    const globalMixMatchItems = {}; // Items que participam do Mix & Match
    const separateItems = {};       // Items que NÃO participam

    validItems.forEach(item => {
        const categoryPath = item.category || 'uncategorized';

        // ✅ IMPORTANTE: Produtos de catálogo (stock) NUNCA participam do Mix & Match
        // Mix & Match é exclusivo para fotos únicas de Natural Cowhides
        if (item.isCatalogProduct) {
            if (!separateItems[categoryPath]) {
                separateItems[categoryPath] = [];
            }
            separateItems[categoryPath].push(item);
            return; // Não verificar Mix & Match para produtos de catálogo
        }

        const isMixMatch = categoryMixMatchMap[categoryPath] || false;

        if (isMixMatch) {
            if (!globalMixMatchItems[categoryPath]) {
                globalMixMatchItems[categoryPath] = [];
            }
            globalMixMatchItems[categoryPath].push(item);
        } else {
            if (!separateItems[categoryPath]) {
                separateItems[categoryPath] = [];
            }
            separateItems[categoryPath].push(item);
        }
    });

    // ============================================
    // PROCESSAR GRUPO GLOBAL MIX & MATCH
    // ============================================
    const globalQuantity = Object.keys(globalMixMatchItems).length > 0
        ? Object.values(globalMixMatchItems).reduce((sum, items) => sum + items.length, 0)
        : 0;

    if (globalQuantity > 0) {
        console.log(`🌍 [MIX&MATCH GLOBAL] ${globalQuantity} items no total`);

        for (const [categoryPath, items] of Object.entries(globalMixMatchItems)) {
            let cleanPath = categoryPath.endsWith('/')
                ? categoryPath.slice(0, -1)
                : categoryPath;

            // ✅ CORREÇÃO: Converter setas de volta para barras para busca no MongoDB
            const normalizedPath = cleanPath.replace(/ → /g, '/');

            console.log(`🔍 Buscando categoria: "${cleanPath}"`);
            console.log(`🔍 Path normalizado: "${normalizedPath}"`);

            const category = await PhotoCategory.findOne({
                $or: [
                    { googleDrivePath: normalizedPath },
                    { googleDrivePath: normalizedPath + '/' },
                    { displayName: cleanPath }  // displayName já usa setas
                ]
            });

            if (category) {
                console.log(`✅ Categoria encontrada: ${category.displayName} (QB: ${category.qbItem})`);

                // ✅ SUBTOTAL: Usar preço Tier 1 (quantidade = 1)
                const tier1Result = await category.getPriceForClient(cart.clientCode, 1);
                const tier1Price = tier1Result.finalPrice;

                // ✅ TOTAL: Usar preço com tier global
                const currentTierResult = await category.getPriceForClient(cart.clientCode, globalQuantity);
                const currentTierPrice = currentTierResult.finalPrice;

                console.log(`   💰 Tier 1 Price: $${tier1Price} | Current Tier Price: $${currentTierPrice}`);
                console.log(`   📦 ${category.displayName}: ${items.length} items (tier global: ${globalQuantity})`);

                // Acumular valores
                subtotalMixMatch += items.length * tier1Price;
                totalMixMatch += items.length * currentTierPrice;

                // Atualizar preço de cada item no carrinho
                items.forEach(item => {
                    item.price = currentTierPrice;
                    item.basePrice = tier1Price;  // ✅ basePrice = Tier 1
                    item.formattedPrice = `$${currentTierPrice.toFixed(2)}`;
                });

            } else {
                console.warn(`⚠️ Categoria NÃO encontrada para path: "${cleanPath}"`);

                // Fallback: usar preço do item
                const fallbackPrice = items[0].price || items[0].basePrice || 0;
                subtotalMixMatch += items.length * fallbackPrice;
                totalMixMatch += items.length * fallbackPrice;
            }
        }
    }

    // ============================================
    // PROCESSAR CATEGORIAS SEPARADAS
    // ============================================
    for (const [categoryPath, items] of Object.entries(separateItems)) {
        // ✅ Separar produtos de catálogo de fotos únicas
        const catalogItems = items.filter(item => item.isCatalogProduct);
        const uniquePhotoItems = items.filter(item => !item.isCatalogProduct);

        // ============================================
        // PROCESSAR PRODUTOS DE CATÁLOGO (STOCK)
        // ============================================
        if (catalogItems.length > 0) {
            // Separar goatskins e calfskins de outros produtos de catálogo
            const goatskinItems = catalogItems.filter(item =>
                item.catalogCategory === 'goatskin' ||
                item.qbItem?.startsWith('900') ||
                item.productName?.toLowerCase().includes('goatskin')
            );

            const calfskinItems = catalogItems.filter(item =>
                item.catalogCategory === 'calfskin' ||
                item.productName?.toLowerCase().includes('calfskin')
            );

            const otherCatalogItems = catalogItems.filter(item =>
                !goatskinItems.includes(item) && !calfskinItems.includes(item)
            );

            // ============================================
            // GOATSKINS: Mix & Match entre eles (tier pricing)
            // Tiers: 1-12 = tier1Price, 13-24 = tier2Price, 24+ = tier3Price
            // ============================================
            if (goatskinItems.length > 0) {
                const CatalogProduct = require('../models/CatalogProduct');

                // Calcular quantidade total de goatskins no carrinho
                const totalGoatskinQty = goatskinItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

                // Determinar tier baseado na quantidade total
                let tierName, tierLevel;
                if (totalGoatskinQty >= 25) {
                    tierLevel = 3;
                    tierName = 'Gold (24+)';
                } else if (totalGoatskinQty >= 13) {
                    tierLevel = 2;
                    tierName = 'Silver (13-24)';
                } else {
                    tierLevel = 1;
                    tierName = 'Bronze (1-12)';
                }

                console.log(`🐐 [GOATSKIN MIX&MATCH] ${totalGoatskinQty} goatskins total → ${tierName}`);

                for (const item of goatskinItems) {
                    const qty = item.quantity || 1;

                    // Buscar tier prices do produto
                    const catalogProduct = await CatalogProduct.findOne({ qbItem: item.qbItem });

                    let unitPrice = 0;
                    let basePrice = 0; // Tier 1 price (para mostrar desconto)

                    if (catalogProduct) {
                        basePrice = catalogProduct.tier1Price || 0;

                        // Aplicar tier baseado na quantidade total de goatskins
                        if (tierLevel === 3) {
                            unitPrice = catalogProduct.tier3Price || catalogProduct.tier2Price || catalogProduct.tier1Price || 0;
                        } else if (tierLevel === 2) {
                            unitPrice = catalogProduct.tier2Price || catalogProduct.tier1Price || 0;
                        } else {
                            unitPrice = catalogProduct.tier1Price || 0;
                        }
                    }

                    const itemTotal = unitPrice * qty;
                    const baseTotal = basePrice * qty;

                    if (unitPrice > 0) {
                        subtotalOthers += baseTotal;  // Subtotal usa preço base (tier 1)
                        totalOthers += itemTotal;     // Total usa preço com desconto
                        console.log(`   🐐 [GOATSKIN] ${item.productName}: ${qty} × $${unitPrice} = $${itemTotal} (base: $${basePrice})`);
                    } else {
                        console.log(`   🐐 [GOATSKIN] ${item.productName}: ${qty} × (sem preço) - NÃO contabilizado`);
                    }

                    // Atualizar preços do item no carrinho
                    item.unitPrice = unitPrice;
                    item.basePrice = basePrice;
                    item.price = itemTotal;
                    item.formattedPrice = unitPrice > 0 ? `$${itemTotal.toFixed(2)}` : 'No price';
                    item.tierInfo = { level: tierLevel, name: tierName, totalQty: totalGoatskinQty };
                }
            }

            // ============================================
            // CALFSKINS: Mix & Match entre eles (tier pricing)
            // Tiers: 1-12 = tier1Price, 13-24 = tier2Price, 24+ = tier3Price
            // ============================================
            if (calfskinItems.length > 0) {
                const CatalogProduct = require('../models/CatalogProduct');

                // Calcular quantidade total de calfskins no carrinho
                const totalCalfskinQty = calfskinItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

                // Determinar tier baseado na quantidade total
                let tierName, tierLevel;
                if (totalCalfskinQty >= 25) {
                    tierLevel = 3;
                    tierName = 'Gold (24+)';
                } else if (totalCalfskinQty >= 13) {
                    tierLevel = 2;
                    tierName = 'Silver (13-24)';
                } else {
                    tierLevel = 1;
                    tierName = 'Bronze (1-12)';
                }

                console.log(`🐄 [CALFSKIN MIX&MATCH] ${totalCalfskinQty} calfskins total → ${tierName}`);

                for (const item of calfskinItems) {
                    const qty = item.quantity || 1;

                    // Buscar tier prices do produto
                    const catalogProduct = await CatalogProduct.findOne({ qbItem: item.qbItem });

                    let unitPrice = 0;
                    let basePrice = 0; // Tier 1 price (para mostrar desconto)

                    if (catalogProduct) {
                        basePrice = catalogProduct.tier1Price || 0;

                        // Aplicar tier baseado na quantidade total de calfskins
                        if (tierLevel === 3) {
                            unitPrice = catalogProduct.tier3Price || catalogProduct.tier2Price || catalogProduct.tier1Price || 0;
                        } else if (tierLevel === 2) {
                            unitPrice = catalogProduct.tier2Price || catalogProduct.tier1Price || 0;
                        } else {
                            unitPrice = catalogProduct.tier1Price || 0;
                        }
                    }

                    const itemTotal = unitPrice * qty;
                    const baseTotal = basePrice * qty;

                    if (unitPrice > 0) {
                        subtotalOthers += baseTotal;  // Subtotal usa preço base (tier 1)
                        totalOthers += itemTotal;     // Total usa preço com desconto
                        console.log(`   🐄 [CALFSKIN] ${item.productName}: ${qty} × $${unitPrice} = $${itemTotal} (base: $${basePrice})`);
                    } else {
                        console.log(`   🐄 [CALFSKIN] ${item.productName}: ${qty} × (sem preço) - NÃO contabilizado`);
                    }

                    // Atualizar preços do item no carrinho
                    item.unitPrice = unitPrice;
                    item.basePrice = basePrice;
                    item.price = itemTotal;
                    item.formattedPrice = unitPrice > 0 ? `$${itemTotal.toFixed(2)}` : 'No price';
                    item.tierInfo = { level: tierLevel, name: tierName, totalQty: totalCalfskinQty };
                }
            }

            // Processar outros produtos de catálogo normalmente
            otherCatalogItems.forEach(item => {
                // Usar unitPrice do próprio item (definido quando adicionado)
                const unitPrice = item.unitPrice || 0;
                const qty = item.quantity || 1;
                const itemTotal = unitPrice * qty;

                if (unitPrice > 0) {
                    subtotalOthers += itemTotal;
                    totalOthers += itemTotal;
                    console.log(`   📦 [CATÁLOGO] ${item.productName}: ${qty} × $${unitPrice} = $${itemTotal}`);
                } else {
                    console.log(`   📦 [CATÁLOGO] ${item.productName}: ${qty} × (sem preço) - NÃO contabilizado`);
                }

                // Manter preços do item
                item.price = itemTotal;
                item.formattedPrice = unitPrice > 0 ? `$${itemTotal.toFixed(2)}` : 'No price';
            });
        }

        // ============================================
        // PROCESSAR FOTOS ÚNICAS (não Mix & Match)
        // ============================================
        if (uniquePhotoItems.length > 0) {
            const quantity = uniquePhotoItems.length;

            let cleanPath = categoryPath.endsWith('/')
                ? categoryPath.slice(0, -1)
                : categoryPath;

            // ✅ CORREÇÃO: Converter setas de volta para barras para busca no MongoDB
            const normalizedPath = cleanPath.replace(/ → /g, '/');

            console.log(`🔍 [SEPARADO] Buscando categoria: "${cleanPath}"`);
            console.log(`🔍 [SEPARADO] Path normalizado: "${normalizedPath}"`);

            const category = await PhotoCategory.findOne({
                $or: [
                    { googleDrivePath: normalizedPath },
                    { googleDrivePath: normalizedPath + '/' },
                    { displayName: cleanPath }  // displayName já usa setas
                ]
            });

            let pricePerItem = uniquePhotoItems[0].price || uniquePhotoItems[0].basePrice || 0;

            if (category) {
                console.log(`✅ [SEPARADO] Categoria encontrada: ${category.displayName} (QB: ${category.qbItem || 'N/A'})`);

                const priceResult = await category.getPriceForClient(cart.clientCode, quantity);
                pricePerItem = priceResult.finalPrice;

                console.log(`   💰 Base Price: $${priceResult.basePrice || pricePerItem}`);
                console.log(`   🔸 ${category.displayName}: ${quantity} items × $${pricePerItem} (tier próprio)`);

                // Para categorias separadas: subtotal = total (sem desconto de tier global)
                subtotalOthers += quantity * pricePerItem;
                totalOthers += quantity * pricePerItem;

                // Atualizar preço de cada item
                uniquePhotoItems.forEach(item => {
                    item.price = pricePerItem;
                    item.basePrice = pricePerItem;  // Para não Mix & Match, base = current
                    item.formattedPrice = `$${pricePerItem.toFixed(2)}`;
                });

            } else {
                console.warn(`⚠️ [SEPARADO] Categoria NÃO encontrada para path: "${cleanPath}"`);

                subtotalOthers += quantity * pricePerItem;
                totalOthers += quantity * pricePerItem;
            }
        }
    }

    // ============================================
    // CALCULAR TIER INFO (PARA EXIBIR NO FRONTEND)
    // ============================================
    let mixMatchInfo = null;

    if (globalQuantity > 0) {
        let currentTier = null;
        let nextTier = null;
        let itemsToNextTier = 0;

        // Determinar tier atual e próximo
        if (globalQuantity >= 37) {
            currentTier = { level: 4, min: 37, max: null, name: "Tier 4" };
            nextTier = null;
            itemsToNextTier = 0;
        } else if (globalQuantity >= 13) {
            currentTier = { level: 3, min: 13, max: 36, name: "Tier 3" };
            nextTier = { level: 4, min: 37, name: "Tier 4" };
            itemsToNextTier = 37 - globalQuantity;
        } else if (globalQuantity >= 6) {
            currentTier = { level: 2, min: 6, max: 12, name: "Tier 2" };
            nextTier = { level: 3, min: 13, name: "Tier 3" };
            itemsToNextTier = 13 - globalQuantity;
        } else {
            currentTier = { level: 1, min: 1, max: 5, name: "Tier 1" };
            nextTier = { level: 2, min: 6, name: "Tier 2" };
            itemsToNextTier = 6 - globalQuantity;
        }

        mixMatchInfo = {
            itemCount: globalQuantity,
            currentTier: currentTier,
            nextTier: nextTier,
            itemsToNextTier: itemsToNextTier
        };

        console.log(`🎯 Tier Info: ${currentTier.name} (${globalQuantity} items) - ${itemsToNextTier} to ${nextTier?.name || 'max'}`);
    }

    // ============================================
    // TOTAIS FINAIS
    // ============================================
    const subtotal = subtotalMixMatch + subtotalOthers;
    const total = totalMixMatch + totalOthers;
    const discount = subtotal - total;

    console.log(`\n💰 RESUMO DO CARRINHO:`);
    console.log(`   Subtotal Mix & Match: $${subtotalMixMatch.toFixed(2)}`);
    console.log(`   Subtotal Others: $${subtotalOthers.toFixed(2)}`);
    console.log(`   SUBTOTAL TOTAL: $${subtotal.toFixed(2)}`);
    console.log(`   Discount: -$${discount.toFixed(2)}`);
    console.log(`   TOTAL FINAL: $${total.toFixed(2)}\n`);

    // ⭐ IMPORTANTE: Salvar os preços atualizados de volta no carrinho
    // Isso garante que os preços calculados (tier pricing) sejam persistidos
    try {
        if (cart.save && typeof cart.save === 'function') {
            await cart.save();
            console.log(`💾 [CART] Preços atualizados salvos no carrinho`);
        }
    } catch (saveErr) {
        console.warn(`⚠️ [CART] Erro ao salvar preços atualizados:`, saveErr.message);
    }

    const result = {
        subtotal: subtotal,
        discount: discount,
        total: total,
        discountPercent: subtotal > 0 ? Math.round((discount / subtotal) * 100) : 0,
        mixMatchInfo: mixMatchInfo
    };

    // ⭐ Salvar no cache antes de retornar
    totalsCache.set(cartHash, {
        result: result,
        timestamp: Date.now()
    });

    // Limpar cache antigo (mais de 10 segundos)
    for (const [key, value] of totalsCache.entries()) {
        if (Date.now() - value.timestamp > 10000) {
            totalsCache.delete(key);
        }
    }

    return result;
}

// ============================================
// ENDPOINT DE STATUS DO CARRINHO - Para sincronização com frontend
// Adicionado para resolver problema de dessincronização quando CDE remove itens
// ============================================
router.get('/status/:clientCode', async (req, res) => {
    try {
        const { clientCode } = req.params;

        // Validação básica
        if (!clientCode || clientCode.length !== 4) {
            return res.status(400).json({
                success: false,
                message: 'Código de cliente inválido'
            });
        }

        // Importar o modelo Cart (já está sendo usado em outras rotas)
        const Cart = require('../models/Cart');

        // Buscar carrinho ativo do cliente
        const cart = await Cart.findOne({
            clientCode: clientCode,
            isActive: true
        }).select('items totalItems totalValue updatedAt');

        // Se não tem carrinho, retornar vazio
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.json({
                success: true,
                hasCart: false,
                items: [],
                totalItems: 0,
                totalValue: 0,
                lastUpdated: null
            });
        }

        // Retornar informações resumidas do carrinho
        res.json({
            success: true,
            hasCart: true,
            items: cart.items.map(item => ({
                fileName: item.fileName,
                category: item.category,
                price: item.price
            })),
            totalItems: cart.totalItems || cart.items.length,
            totalValue: cart.totalValue || 0,
            lastUpdated: cart.updatedAt
        });

    } catch (error) {
        console.error('[Cart Status] Erro ao verificar status do carrinho:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/cart/test/status
 * Ver status atual de carrinhos e expiração
 */
router.get('/test/status', async (req, res) => {
    // Só funciona em desenvolvimento
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Não disponível em produção' });
    }

    try {
        const Cart = require('../models/Cart');
        const now = new Date();

        // Buscar todos os carrinhos ativos
        const activeCarts = await Cart.find({ isActive: true });

        const status = {
            timestamp: now.toISOString(),
            totalCarrinhos: activeCarts.length,
            carrinhosComItens: 0,
            carrinhosVazios: 0,
            totalItens: 0,
            itensExpirados: 0,
            itensValidos: 0,
            carrinhos: []
        };

        for (const cart of activeCarts) {
            if (cart.items.length > 0) {
                status.carrinhosComItens++;

                const expiredItems = cart.items.filter(item =>
                    item.expiresAt && new Date(item.expiresAt) < now
                );

                const validItems = cart.items.filter(item =>
                    !item.expiresAt || new Date(item.expiresAt) >= now
                );

                status.totalItens += cart.items.length;
                status.itensExpirados += expiredItems.length;
                status.itensValidos += validItems.length;

                status.carrinhos.push({
                    clientCode: cart.clientCode,
                    sessionId: cart.sessionId,
                    totalItens: cart.items.length,
                    expirados: expiredItems.length,
                    validos: validItems.length,
                    criadoEm: cart.createdAt,
                    ultimaAtividade: cart.lastActivity
                });
            } else {
                status.carrinhosVazios++;
            }
        }

        res.json(status);

    } catch (error) {
        console.error('Erro ao buscar status:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

module.exports = router;

// Exportar função para uso em selection.js
module.exports.calculateCartTotals = calculateCartTotals;