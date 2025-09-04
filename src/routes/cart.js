// src/routes/cart.js

const express = require('express');
const { CartService } = require('../services');

const router = express.Router();

/**
 * NOVA FUNÇÃO - Calcular total SEMPRE por categoria
 * Respeita hierarquia: Custom Client > Volume Discount > Base Price
 * Suporta Special Selections com rate rules próprios
 */
const calculateDiscountWithHierarchy = async (cart, itemsWithPrice, subtotal) => {
    const PhotoCategory = require('../models/PhotoCategory');
    const AccessCode = require('../models/AccessCode');
    const Selection = require('../models/Selection');

    console.log(`\n🎯 ===========================================`);
    console.log(`🎯 NOVO CÁLCULO - Cliente: ${cart.clientCode} (${cart.clientName})`);
    console.log(`📦 Total de itens no carrinho: ${cart.totalItems}`);
    console.log(`💰 Subtotal inicial: $${subtotal}`);
    console.log(`===========================================\n`);

    // Verificar se é Special Selection
    const accessCode = await AccessCode.findOne({
        code: cart.clientCode
    });
    const isSpecialSelection = accessCode?.accessType === 'special';

    // Agrupar itens por categoria
    const itemsByCategory = {};
    cart.items.forEach(item => {
        const categoryKey = item.category || 'uncategorized';
        if (!itemsByCategory[categoryKey]) {
            itemsByCategory[categoryKey] = [];
        }
        itemsByCategory[categoryKey].push(item);
    });

    const totalCategories = Object.keys(itemsByCategory).length;
    console.log(`📂 Carrinho tem ${totalCategories} categoria(s) diferentes`);

    // Calcular total e detalhes
    let grandTotal = 0;
    let totalComDesconto = 0;
    const detalhes = [];

    // SPECIAL SELECTION - Lógica própria
    if (isSpecialSelection && accessCode.specialSelection?.selectionId) {
        console.log(`⭐ Cliente com SPECIAL SELECTION detectado`);

        const selection = await Selection.findById(accessCode.specialSelection.selectionId);

        for (const [categoryPath, items] of Object.entries(itemsByCategory)) {
            const quantidade = items.length;
            console.log(`\n🏷️ Categoria Special: ${categoryPath}`);
            console.log(`   📊 Quantidade: ${quantidade} itens`);

            // Encontrar categoria correspondente na Special Selection
            const specialCategory = selection?.customCategories?.find(cat =>
                cat.categoryName === categoryPath ||
                cat.categoryDisplayName === categoryPath ||
                cat.photos.some(p => items.some(item => item.fileName === p.fileName))
            );

            let precoUnitario = items[0].price || items[0].basePrice || 0;
            let fonte = 'special-custom';
            let detalheRegra = null;

            // Se tem rate rules, aplicar
            if (specialCategory?.rateRules?.length > 0) {
                console.log(`   📋 Aplicando Rate Rules da Special Selection`);

                for (const rule of specialCategory.rateRules) {
                    if (quantidade >= rule.from && (!rule.to || quantidade <= rule.to)) {
                        precoUnitario = rule.price;
                        fonte = 'special-rate-rule';
                        detalheRegra = {
                            tipo: 'Special Selection Rate',
                            faixa: `${rule.from}-${rule.to || '+'} itens`,
                            preco: precoUnitario
                        };
                        console.log(`   ✓ Rate Rule: ${rule.from}-${rule.to || '+'} = $${rule.price}/item`);
                        break;
                    }
                }
            } else {
                detalheRegra = {
                    tipo: 'Special Selection Custom Price',
                    preco: precoUnitario
                };
            }

            const subtotalCategoria = quantidade * precoUnitario;
            grandTotal += subtotalCategoria;
            totalComDesconto += subtotalCategoria;

            console.log(`   📊 Cálculo: ${quantidade} × $${precoUnitario} = $${subtotalCategoria}`);

            detalhes.push({
                categoria: categoryPath,
                quantidade: quantidade,
                precoUnitario: precoUnitario,
                subtotal: subtotalCategoria,
                fonte: fonte,
                regra: detalheRegra
            });
        }
    }
    // CLIENTE NORMAL - Lógica original mantida
    else {
        // CALCULAR CADA CATEGORIA SEPARADAMENTE
        for (const [categoryPath, items] of Object.entries(itemsByCategory)) {
            const quantidade = items.length;
            console.log(`\n🏷️ Categoria: ${categoryPath}`);
            console.log(`   📊 Quantidade: ${quantidade} itens`);

            // ✅ CORREÇÃO: Remover barra final e extrair apenas o nome da última pasta
            let categorySearchName = categoryPath;

            // Remover barra final se existir
            if (categorySearchName.endsWith('/')) {
                categorySearchName = categorySearchName.slice(0, -1);
                console.log(`   🔧 Removida barra final: "${categorySearchName}"`);
            }

            // Extrair apenas o nome da última pasta (depois da última /)
            const lastSlashIndex = categorySearchName.lastIndexOf('/');
            if (lastSlashIndex !== -1) {
                categorySearchName = categorySearchName.substring(lastSlashIndex + 1);
                console.log(`   🔧 Extraído nome final: "${categorySearchName}"`);
            }

            // Buscar categoria no banco - ÚNICA BUSCA CORRETA
            let category = null;
            try {
                console.log(`   🔎 Buscando categoria: "${categorySearchName}"`);

                category = await PhotoCategory.findOne({
                    $or: [
                        // 1. Busca EXATA por folderName
                        { folderName: categorySearchName },

                        // 2. Busca por displayName que TERMINA com o nome
                        { displayName: { $regex: ` → ${categorySearchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$` } },

                        // 3. Busca direta
                        { displayName: categorySearchName }
                    ]
                });
            } catch (err) {
                console.log(`   ⚠️ Erro buscando categoria: ${err.message}`);
            }

            if (category) {
                console.log(`   ✅ Categoria encontrada: ${category.displayName}`);
                console.log(`      FolderName: ${category.folderName}`);
                console.log(`      BasePrice: $${category.basePrice}`);
                console.log(`      Busca realizada por: "${categorySearchName}"`);
            }

            if (!category) {
                console.log(`   ❌ Categoria não encontrada no banco`);
                console.log(`   📍 Usando preços individuais dos items`);
                // Somar com preço individual dos itens
                const catSubtotal = items.reduce((sum, item) => {
                    const itemPrice = item.price || item.basePrice || 0;
                    console.log(`      - ${item.fileName}: $${itemPrice}`);
                    return sum + itemPrice;
                }, 0);
                grandTotal += catSubtotal;
                totalComDesconto += catSubtotal;
                console.log(`   💵 Subtotal da categoria: $${catSubtotal}`);
                continue;
            }

            // USAR MÉTODO UNIFICADO - TODA HIERARQUIA EM UM SÓ LUGAR
            let precoUnitario = 0;
            let fonte = '';
            let detalheRegra = null;

            try {
                console.log(`   📞 Chamando getPriceForClient("${cart.clientCode}", ${quantidade})`);

                // Chama o método que já tem toda a lógica de hierarquia
                const priceResult = await category.getPriceForClient(cart.clientCode, quantidade);

                console.log(`   💰 Resultado do getPriceForClient:`);
                console.log(`      - finalPrice: $${priceResult.finalPrice}`);
                console.log(`      - appliedRule: ${priceResult.appliedRule}`);
                console.log(`      - basePrice: $${priceResult.basePrice}`);

                precoUnitario = priceResult.finalPrice;
                fonte = priceResult.appliedRule;

                // Preparar detalhes para exibição
                if (fonte === 'custom-client') {
                    detalheRegra = {
                        tipo: 'Custom Client',
                        cliente: priceResult.ruleDetails?.clientName || cart.clientName,
                        faixa: priceResult.ruleDetails?.appliedRange ?
                            `${priceResult.ruleDetails.appliedRange.min}-${priceResult.ruleDetails.appliedRange.max || '+'} itens` :
                            'Preço especial',
                        preco: precoUnitario,
                        exceeded: priceResult.ruleDetails?.exceeded || false
                    };
                    console.log(`   💎 Custom Client: ${detalheRegra.cliente}`);
                    console.log(`      Faixa: ${detalheRegra.faixa} = $${precoUnitario}/item`);
                    if (detalheRegra.exceeded) {
                        console.log(`      ⚠️ Quantidade excede faixa - mantendo melhor preço`);
                    }
                }
                else if (fonte === 'volume-discount') {
                    detalheRegra = {
                        tipo: 'Volume Discount',
                        faixa: priceResult.ruleDetails?.appliedRange ?
                            `${priceResult.ruleDetails.appliedRange.min}-${priceResult.ruleDetails.appliedRange.max || '+'} itens` :
                            'Desconto por volume',
                        preco: precoUnitario,
                        exceeded: priceResult.ruleDetails?.exceeded || false
                    };
                    console.log(`   📦 Volume Discount (All Regular Clients)`);
                    console.log(`      Faixa: ${detalheRegra.faixa} = $${precoUnitario}/item`);
                    if (detalheRegra.exceeded) {
                        console.log(`      ⚠️ Quantidade excede faixa - mantendo melhor preço`);
                    }
                }
                else if (fonte === 'custom-price' || fonte === 'custom-percent') {
                    detalheRegra = {
                        tipo: 'Custom Client (Legacy)',
                        cliente: cart.clientName,
                        preco: precoUnitario
                    };
                    console.log(`   💎 Custom Client (Legacy): $${precoUnitario}/item`);
                }
                else {
                    detalheRegra = {
                        tipo: 'Base Price',
                        preco: precoUnitario
                    };
                    console.log(`   💰 Base Price: $${precoUnitario}/item`);
                }

            } catch (error) {
                console.log(`   ⚠️ Erro ao calcular preço, usando base: ${error.message}`);
                precoUnitario = category.basePrice || 0;
                fonte = 'base-price';
                detalheRegra = {
                    tipo: 'Base Price (Fallback)',
                    preco: precoUnitario
                };
            }

            // Calcular subtotal desta categoria
            const subtotalCategoria = quantidade * precoUnitario;
            grandTotal += subtotalCategoria;
            totalComDesconto += subtotalCategoria;

            console.log(`   📊 Cálculo: ${quantidade} × $${precoUnitario} = $${subtotalCategoria}`);

            // Guardar detalhes
            detalhes.push({
                categoria: categoryPath,
                quantidade: quantidade,
                precoUnitario: precoUnitario,
                subtotal: subtotalCategoria,
                fonte: fonte,
                regra: detalheRegra
            });
        }
    }

    // Calcular desconto total
    const descontoTotal = subtotal - totalComDesconto;
    const percentualDesconto = subtotal > 0 ? Math.round((descontoTotal / subtotal) * 100) : 0;

    console.log(`\n💵 ===========================================`);
    console.log(`💵 TOTAIS FINAIS:`);
    console.log(`   Subtotal original: $${subtotal}`);
    console.log(`   Total com desconto: $${totalComDesconto}`);
    console.log(`   Economia: $${descontoTotal} (${percentualDesconto}%)`);
    console.log(`   ✅ RETORNANDO TOTAL: $${totalComDesconto}`);
    console.log(`===========================================\n`);

    return {
        rule: {
            detalhes: detalhes,
            totalCategories: totalCategories
        },
        discountPercent: percentualDesconto,
        discountAmount: descontoTotal,
        fixedPrice: null,
        ruleType: isSpecialSelection ? 'special-selection' : 'per-category',
        description: isSpecialSelection ?
            `Special Selection Pricing` :
            `Cálculo por categoria (${totalCategories} categoria${totalCategories > 1 ? 's' : ''})`,
        source: isSpecialSelection ? 'special-selection' : 'category-based',
        finalTotal: totalComDesconto,
        detalhesCompletos: detalhes
    };
};

// ===== MIDDLEWARE DE VALIDAÇÃO =====

// Validar sessionId
const validateSessionId = (req, res, next) => {
    const sessionId = req.params.sessionId || req.body.sessionId;

    if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 10) {
        return res.status(400).json({
            success: false,
            message: 'SessionId inválido ou não fornecido'
        });
    }

    req.sessionId = sessionId;
    next();
};

// Validar dados de cliente
const validateClientData = (req, res, next) => {
    const {
        sessionId, clientCode, clientName, driveFileId,
        fileName, category, thumbnailUrl,
        basePrice, price, formattedPrice, hasPrice  // ← ADICIONE basePrice
    } = req.body;

    if (!clientCode || typeof clientCode !== 'string' || clientCode.length !== 4) {
        return res.status(400).json({
            success: false,
            message: 'Código de cliente inválido'
        });
    }

    if (!clientName || typeof clientName !== 'string' || clientName.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Nome do cliente é obrigatório'
        });
    }

    next();
};

// ===== ROTAS DO CARRINHO =====

/**
 * POST /api/cart/add
 * Adicionar item ao carrinho com reserva
 */
router.post('/add', validateSessionId, validateClientData, async (req, res) => {
    try {
        // ✅ CORRIGIDO: Extrair TODOS os campos incluindo preços
        const {
            sessionId, clientCode, clientName, driveFileId,
            fileName, category, thumbnailUrl,
            basePrice, price, formattedPrice, hasPrice  // ← ADICIONE basePrice
        } = req.body;

        // Validar driveFileId
        if (!driveFileId || typeof driveFileId !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'ID do arquivo no Google Drive é obrigatório'
            });
        }

        console.log(`🛒 Adicionando item ${driveFileId} ao carrinho ${sessionId}`);

        const itemData = {
            fileName: fileName || 'Produto sem nome',
            category: category || 'Categoria não informada',
            thumbnailUrl: thumbnailUrl || null,
            basePrice: basePrice || 0,  // ← ADICIONE ESTA LINHA!
            price: price || 0,
            formattedPrice: formattedPrice || 'Sem preço',
            hasPrice: hasPrice || false
        };

        // Chamar service
        const result = await CartService.addToCart(
            sessionId,
            clientCode,
            clientName,
            driveFileId,
            itemData
        );

        res.status(201).json({
            success: true,
            message: 'Item adicionado ao carrinho com sucesso',
            data: result
        });

    } catch (error) {
        console.error('❌ Erro ao adicionar item ao carrinho:', error);

        // Códigos de erro específicos
        let statusCode = 500;
        if (error.message.includes('não encontrado') || error.message.includes('não disponível')) {
            statusCode = 404;
        } else if (error.message.includes('já está no carrinho') || error.message.includes('limite máximo')) {
            statusCode = 409;
        } else if (error.message.includes('reservado por outro')) {
            statusCode = 423; // Locked
        }

        res.status(statusCode).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * DELETE /api/cart/remove/:driveFileId
 * Remover item do carrinho e liberar reserva
 */
router.delete('/remove/:driveFileId', validateSessionId, async (req, res) => {
    try {
        const { driveFileId } = req.params;
        const { sessionId } = req.body;

        console.log(`🗑️ Removendo item ${driveFileId} do carrinho ${sessionId}`);

        // Chamar service
        const result = await CartService.removeFromCart(sessionId, driveFileId);

        res.json({
            success: true,
            message: 'Item removido do carrinho com sucesso',
            data: result
        });

    } catch (error) {
        console.error('❌ Erro ao remover item do carrinho:', error);

        let statusCode = 500;
        if (error.message.includes('não encontrado')) {
            statusCode = 404;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * GET /api/cart/:sessionId
 * Buscar carrinho completo com itens populados
 */
router.get('/:sessionId', validateSessionId, async (req, res) => {
    try {
        const { sessionId } = req.params;

        console.log(`📦 Buscando carrinho completo: ${sessionId}`);

        // Chamar service
        const cart = await CartService.getCart(sessionId);

        if (!cart) {
            return res.json({
                success: true,
                message: 'Carrinho não encontrado ou vazio',
                data: {
                    totalItems: 0,
                    items: [],
                    isEmpty: true
                }
            });
        }

        // ADICIONAR CÁLCULO DE TOTAL AQUI
        let subtotal = 0;
        let itemsWithPrice = 0;

        for (const item of cart.items) {
            if (item.hasPrice) {
                // Usa price (com desconto) se existir, senão usa basePrice
                const itemPrice = item.price > 0 ? item.price : item.basePrice;
                subtotal += itemPrice;
                itemsWithPrice++;
            }
        }

        // Calcular desconto usando a hierarquia
        const discountInfo = await calculateDiscountWithHierarchy(cart, itemsWithPrice, subtotal);

        res.json({
            success: true,
            message: 'Carrinho carregado com sucesso',
            data: {
                sessionId: cart.sessionId,
                clientCode: cart.clientCode,
                clientName: cart.clientName,
                totalItems: cart.totalItems,
                items: cart.items.map(item => ({
                    productId: item.productId,
                    driveFileId: item.driveFileId,
                    fileName: item.fileName,
                    category: item.category,
                    thumbnailUrl: item.thumbnailUrl,
                    addedAt: item.addedAt,
                    expiresAt: item.expiresAt,
                    timeRemaining: cart.getTimeRemaining(item.driveFileId),
                    price: item.price,
                    formattedPrice: item.formattedPrice,
                    hasPrice: item.hasPrice
                })),
                lastActivity: cart.lastActivity,
                isEmpty: cart.totalItems === 0,
                discountInfo: discountInfo // Adicionar info de desconto
            }
        });

    } catch (error) {
        console.error('❌ Erro ao buscar carrinho:', error);

        res.status(500).json({
            success: false,
            message: 'Erro interno ao buscar carrinho',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * GET /api/cart/:sessionId/summary
 * Buscar resumo rápido do carrinho (para updates frequentes)
 */
router.get('/:sessionId/summary', validateSessionId, async (req, res) => {
    try {
        const { sessionId } = req.params;

        // Chamar service (mais leve que getCart)
        const summary = await CartService.getCartSummary(sessionId);

        res.json({
            success: true,
            message: 'Resumo do carrinho carregado',
            ...summary // Spread direto do summary
        });

    } catch (error) {
        console.error('❌ Erro ao buscar resumo do carrinho:', error);

        // Em caso de erro, retornar carrinho vazio
        res.json({
            success: false,
            message: error.message,
            totalItems: 0,
            items: [],
            isEmpty: true,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * POST /api/cart/cleanup
 * Limpeza manual de reservas expiradas (debug/admin)
 */
router.post('/cleanup', async (req, res) => {
    try {
        console.log('🧹 Executando limpeza manual de carrinho...');

        const stats = await CartService.cleanupExpiredReservations();

        res.json({
            success: true,
            message: 'Limpeza executada com sucesso',
            data: stats
        });

    } catch (error) {
        console.error('❌ Erro na limpeza manual:', error);

        res.status(500).json({
            success: false,
            message: 'Erro na limpeza',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * GET /api/cart/check/:driveFileId
 * Verificar se item específico está em algum carrinho
 */
router.get('/check/:driveFileId', async (req, res) => {
    try {
        const { driveFileId } = req.params;
        const { sessionId } = req.query;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'SessionId é obrigatório'
            });
        }

        const isInCart = await CartService.isInCart(sessionId, driveFileId);

        res.json({
            success: true,
            data: {
                driveFileId,
                isInCart,
                sessionId
            }
        });

    } catch (error) {
        console.error('❌ Erro ao verificar item:', error);

        res.status(500).json({
            success: false,
            message: 'Erro ao verificar item',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * GET /api/cart/stats/system
 * Estatísticas gerais do sistema de carrinho (admin)
 */
router.get('/stats/system', async (req, res) => {
    try {
        const stats = await CartService.getSystemStats();

        res.json({
            success: true,
            message: 'Estatísticas do sistema carregadas',
            data: stats
        });

    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas:', error);

        res.status(500).json({
            success: false,
            message: 'Erro ao buscar estatísticas',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * POST /api/cart/:sessionId/extend
 * Estender tempo de reserva de todos os itens do carrinho
 */
router.post('/:sessionId/extend', validateSessionId, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { minutes = 15 } = req.body; // Default 15 minutos

        // TODO: Implementar extensão de tempo
        // Esta funcionalidade pode ser útil para checkout demorado

        res.json({
            success: false,
            message: 'Funcionalidade de extensão será implementada em versão futura'
        });

    } catch (error) {
        console.error('❌ Erro ao estender tempo:', error);

        res.status(500).json({
            success: false,
            message: 'Erro ao estender tempo de reserva'
        });
    }
});

/**
 * GET /api/cart/:sessionId/calculate-total
 * Calcular total do carrinho com desconto por quantidade
 */
router.get('/:sessionId/calculate-total', validateSessionId, async (req, res) => {
    try {
        const { sessionId } = req.params;

        console.log(`💰 Calculando total com descontos para carrinho: ${sessionId}`);

        // Buscar carrinho
        const cart = await CartService.getCart(sessionId);

        if (!cart || cart.totalItems === 0) {
            return res.json({
                success: true,
                data: {
                    totalItems: 0,
                    subtotal: 0,
                    discountPercent: 0,
                    discountAmount: 0,
                    total: 0,
                    hasDiscount: false,
                    discountDescription: 'Carrinho vazio'
                }
            });
        }

        // Calcular subtotal (SEMPRE com basePrice para mostrar valor sem desconto)
        let subtotal = 0;
        let itemsWithPrice = 0;

        for (const item of cart.items) {
            if (item.hasPrice) {
                // SEMPRE usar basePrice para subtotal (preço sem desconto)
                const itemPrice = item.basePrice || 99; // 99 como fallback padrão
                subtotal += itemPrice;
                itemsWithPrice++;
            }
        }

        console.log(`📊 Subtotal calculado: $${subtotal.toFixed(2)} (${itemsWithPrice} itens com preço)`);

        // CORREÇÃO: Usar a função de hierarquia
        const discountInfo = await calculateDiscountWithHierarchy(cart, itemsWithPrice, subtotal);

        console.log(`📦 Desconto aplicado:`, discountInfo);

        // CORREÇÃO: Aplicar desconto baseado no TIPO da regra
        let discountAmount = 0;
        let total = subtotal;
        let effectiveDiscountPercent = 0;

        // Se tem regra de desconto
        if (discountInfo.rule) {
            // TIPO 1: Preço fixo por item
            if (discountInfo.ruleType === 'fixed' && discountInfo.fixedPrice > 0) {
                // Calcular novo total com preço fixo
                const newTotal = itemsWithPrice * discountInfo.fixedPrice;
                discountAmount = subtotal - newTotal;
                total = newTotal;

                // Calcular percentual efetivo para exibição
                if (subtotal > 0) {
                    effectiveDiscountPercent = Math.round((discountAmount / subtotal) * 100);
                }

                console.log(`💵 Aplicando preço fixo: ${itemsWithPrice} itens x $${discountInfo.fixedPrice} = $${newTotal}`);
            }
            // TIPO 2: Usar o total já calculado (NÃO APLICAR DESCONTO NOVAMENTE!)
            else if (discountInfo.finalTotal !== undefined && discountInfo.finalTotal !== null) {
                total = discountInfo.finalTotal;
                discountAmount = subtotal - total;
                effectiveDiscountPercent = discountInfo.discountPercent || Math.round((discountAmount / subtotal) * 100);
                console.log(`✅ Usando total já calculado: $${total} (economia: $${discountAmount})`);
            }
            // TIPO 3: Fallback se não tem finalTotal
            else if (discountInfo.discountPercent > 0) {
                discountAmount = (subtotal * discountInfo.discountPercent) / 100;
                total = subtotal - discountAmount;
                effectiveDiscountPercent = discountInfo.discountPercent;
                console.log(`📊 Aplicando desconto percentual: ${discountInfo.discountPercent}%`);
            }
        }

        const result = {
            sessionId: sessionId,
            totalItems: cart.totalItems,
            itemsWithPrice: itemsWithPrice,
            subtotal: subtotal,
            discountPercent: effectiveDiscountPercent,
            discountAmount: discountAmount,
            total: total,
            hasDiscount: discountAmount > 0,
            discountDescription: discountInfo.description,
            discountRule: discountInfo.rule,
            discountSource: discountInfo.source, // Adicionar fonte do desconto
            formattedSubtotal: `$${subtotal.toFixed(2)}`,
            formattedDiscountAmount: discountAmount > 0 ? `$${discountAmount.toFixed(2)}` : '$0,00',
            formattedTotal: `$${total.toFixed(2)}`,
            calculations: {
                itemBreakdown: cart.items.map(item => ({
                    fileName: item.fileName,
                    price: item.price,
                    formattedPrice: item.formattedPrice,
                    hasPrice: item.hasPrice
                }))
            }
        };

        console.log(`✅ Total final calculado:`, {
            subtotal: result.formattedSubtotal,
            desconto: `${effectiveDiscountPercent}%`,
            valorDesconto: result.formattedDiscountAmount,
            total: result.formattedTotal,
            fonte: discountInfo.source
        });

        res.json({
            success: true,
            message: 'Total calculado com sucesso',
            data: result
        });

    } catch (error) {
        console.error('❌ Erro ao calcular total do carrinho:', error);

        res.status(500).json({
            success: false,
            message: 'Erro ao calcular total',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// ===== MIDDLEWARE DE ERRO GLOBAL PARA ROTAS DE CARRINHO =====
router.use((error, req, res, next) => {
    console.error('❌ Erro não tratado nas rotas de carrinho:', error);

    res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno'
    });
});

/**
 * GET /api/cart/active/:clientCode
 * SEMPRE retorna o carrinho ativo do cliente (independente do sessionId)
 */
router.get('/active/:clientCode', async (req, res) => {
    try {
        const { clientCode } = req.params;

        console.log(`🔍 Buscando carrinho ativo para cliente: ${clientCode}`);

        // Buscar carrinho ativo mais recente
        let cart = await CartService.getCart(null, clientCode);

        if (!cart) {
            // Buscar diretamente no banco
            const Cart = require('../models/Cart');
            cart = await Cart.findOne({
                clientCode: clientCode,
                isActive: true,
                totalItems: { $gt: 0 }
            }).sort({ lastActivity: -1 });
        }

        if (!cart) {
            return res.json({
                success: true,
                message: 'Nenhum carrinho ativo encontrado',
                totalItems: 0,
                items: [],
                sessionId: null
            });
        }

        // Retornar carrinho encontrado
        const summary = await CartService.getCartSummary(cart.sessionId);

        res.json({
            success: true,
            sessionId: cart.sessionId,
            ...summary
        });

    } catch (error) {
        console.error('Erro ao buscar carrinho ativo:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
module.exports.calculateDiscountWithHierarchy = calculateDiscountWithHierarchy;
module.exports = router;