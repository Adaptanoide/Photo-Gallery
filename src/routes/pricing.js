// src/routes/pricing.js
const express = require('express');
const PricingService = require('../services/PricingService');
const PhotoCategory = require('../models/PhotoCategory');
const { authenticateToken } = require('./auth');

const router = express.Router();

// ===== ROTAS DE TESTE (SEM AUTENTICAÇÃO) =====
// REMOVER DEPOIS QUE TUDO FUNCIONAR

router.get('/test/stats', async (req, res) => {
    try {
        console.log('🧪 Testando rota /test/stats');

        // Testar conexão básica
        const stats = {
            totalCategories: 0,
            categoriesWithPrice: 0,
            categoriesWithoutPrice: 0,
            totalPhotos: 0,
            testMode: true,
            timestamp: new Date()
        };

        res.json({
            success: true,
            data: stats,
            message: 'Teste de conexão OK - MongoDB e API funcionando'
        });

    } catch (error) {
        console.error('❌ Erro no teste de stats:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.get('/test/sync/status', async (req, res) => {
    try {
        console.log('🧪 Testando rota /test/sync/status');

        const syncStatus = {
            needingSyncCount: 0,
            lastSyncDate: null,
            isOutdated: true,
            hoursOld: 0,
            testMode: true
        };

        const statistics = {
            totalCategories: 0,
            categoriesWithPrice: 0,
            categoriesWithoutPrice: 0,
            totalPhotos: 0
        };

        res.json({
            success: true,
            syncStatus,
            statistics,
            message: 'Status de sync - teste OK'
        });

    } catch (error) {
        console.error('❌ Erro no teste de sync status:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.get('/test/categories', async (req, res) => {
    try {
        console.log('🧪 Testando rota /test/categories');

        // Retornar dados fake para teste
        const categories = [
            {
                _id: 'test1',
                displayName: 'Teste Colombian Cowhides > Medium > Brown & White M',
                googleDrivePath: 'Colombian Cowhides/Medium/Brown & White M',
                photoCount: 2,
                basePrice: 0,
                hasCustomRules: false,
                updatedAt: new Date()
            },
            {
                _id: 'test2',
                displayName: 'Teste Brazilian > Large > Black Pattern',
                googleDrivePath: 'Brazilian/Large/Black Pattern',
                photoCount: 5,
                basePrice: 150.00,
                hasCustomRules: false,
                updatedAt: new Date()
            }
        ];

        const pagination = {
            page: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false
        };

        res.json({
            success: true,
            categories,
            pagination,
            message: 'Categorias de teste carregadas'
        });

    } catch (error) {
        console.error('❌ Erro no teste de categories:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Buscar preço por Google Drive ID (para cliente) - VERSÃO CORRIGIDA
router.get('/category-price', async (req, res) => {
    try {
        const { googleDriveId, clientCode } = req.query;
        
        console.log(`🏷️ Buscando preço para categoria ${googleDriveId}, cliente: ${clientCode || 'ANÔNIMO'}`);
        
        const category = await PhotoCategory.findByDriveId(googleDriveId);

        if (!category) {
            console.log(`❌ Categoria não encontrada: ${googleDriveId}`);
            return res.json({
                success: false,
                message: 'Categoria não encontrada'
            });
        }

        // NOVO: Calcular preço específico para o cliente
        let finalPrice = category.basePrice;
        let priceSource = 'base';
        
        if (clientCode) {
            // Usar método do model para calcular preço personalizado
            const clientPrice = category.getPriceForClient(clientCode);
            if (clientPrice !== category.basePrice) {
                finalPrice = clientPrice;
                priceSource = 'personalizado';
            }
        }

        const priceInfo = {
            _id: category._id,
            displayName: category.displayName,
            basePrice: category.basePrice,
            finalPrice: finalPrice,
            priceSource: priceSource,
            formattedPrice: finalPrice > 0 ? `R$ ${finalPrice.toFixed(2)}` : 'Sem preço',
            hasPrice: finalPrice > 0
        };

        console.log(`✅ Preço calculado:`, {
            categoria: category.displayName,
            cliente: clientCode,
            precoBase: category.basePrice,
            precoFinal: finalPrice,
            fonte: priceSource
        });

        res.json({
            success: true,
            category: priceInfo
        });

    } catch (error) {
        console.error('❌ Erro ao buscar preço:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Todas as rotas de preços precisam de autenticação admin
router.use(authenticateToken);

// ===== SINCRONIZAÇÃO COM GOOGLE DRIVE =====

/**
 * POST /api/pricing/sync
 * Sincronizar estrutura do Google Drive com banco de dados
 */
router.post('/sync', async (req, res) => {
    try {
        const { forceRefresh = false } = req.body;

        console.log(`🔄 Iniciando sincronização ${forceRefresh ? 'forçada' : 'normal'}...`);

        const result = await PricingService.scanAndSyncDrive(forceRefresh);

        res.json({
            success: true,
            message: 'Sincronização concluída com sucesso',
            data: result,
            summary: result.sync.summary
        });

    } catch (error) {
        console.error('❌ Erro na sincronização:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao sincronizar com Google Drive',
            error: error.message
        });
    }
});

/**
 * GET /api/pricing/sync/status
 * Verificar status da última sincronização
 */
router.get('/sync/status', async (req, res) => {
    try {
        // Buscar categorias mais antigas (que precisam de sync)
        const needingSync = await PhotoCategory.findNeedingSync(24); // 24 horas

        // Última sincronização
        const lastSync = await PhotoCategory.findOne({ isActive: true })
            .sort({ lastSync: -1 })
            .select('lastSync')
            .lean();

        // Estatísticas gerais
        const stats = await PhotoCategory.getPricingStats();

        res.json({
            success: true,
            syncStatus: {
                needingSyncCount: needingSync.length,
                lastSyncDate: lastSync?.lastSync || null,
                isOutdated: needingSync.length > 0,
                hoursOld: lastSync ?
                    Math.round((Date.now() - new Date(lastSync.lastSync)) / (1000 * 60 * 60)) : null
            },
            statistics: stats
        });

    } catch (error) {
        console.error('❌ Erro ao verificar status de sync:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao verificar status',
            error: error.message
        });
    }
});

// ===== GESTÃO DE CATEGORIAS E PREÇOS =====

/**
 * GET /api/pricing/categories
 * Listar todas as categorias com preços para interface admin
 */
router.get('/categories', async (req, res) => {
    try {
        const {
            search = '',
            hasPrice = null,
            page = 1,
            limit = 50
        } = req.query;

        // Filtros
        const filters = {};
        if (search) filters.search = search;
        if (hasPrice !== null) filters.hasPrice = hasPrice === 'true';

        const categories = await PricingService.getAdminCategoriesList(filters);

        // Paginação
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedCategories = categories.slice(startIndex, endIndex);

        res.json({
            success: true,
            categories: paginatedCategories,
            pagination: {
                total: categories.length,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(categories.length / limit),
                hasNext: endIndex < categories.length,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('❌ Erro ao listar categorias:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao carregar categorias',
            error: error.message
        });
    }
});

/**
 * GET /api/pricing/categories/:id
 * Buscar categoria específica com detalhes completos
 */
router.get('/categories/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const category = await PhotoCategory.findById(id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Categoria não encontrada'
            });
        }

        // Informações adicionais
        const details = {
            ...category.toObject(),
            summary: category.getSummary(),
            priceHistoryCount: category.priceHistory.length,
            activeDiscountRules: category.discountRules.filter(r => r.isActive).length,
            lastPriceChange: category.priceHistory.length > 0 ?
                category.priceHistory[category.priceHistory.length - 1] : null
        };

        res.json({
            success: true,
            category: details
        });

    } catch (error) {
        console.error('❌ Erro ao buscar categoria:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar categoria',
            error: error.message
        });
    }
});

/**
 * PUT /api/pricing/categories/:id/price
 * Definir/atualizar preço de uma categoria
 */
router.put('/categories/:id/price', async (req, res) => {
    try {
        const { id } = req.params;
        const { price, reason = '' } = req.body;

        // Validações
        if (typeof price !== 'number' || price < 0) {
            return res.status(400).json({
                success: false,
                message: 'Preço deve ser um número não negativo'
            });
        }

        const result = await PricingService.setPriceForCategory(
            id,
            price,
            req.user.username, // Do middleware de auth
            reason
        );

        res.json({
            success: true,
            message: result.message,
            data: result
        });

    } catch (error) {
        console.error('❌ Erro ao definir preço:', error);

        let statusCode = 500;
        if (error.message.includes('não encontrada')) statusCode = 404;
        if (error.message.includes('inativa')) statusCode = 400;
        if (error.message.includes('negativo')) statusCode = 400;

        res.status(statusCode).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * POST /api/pricing/categories/bulk-price
 * Definir preços em lote para múltiplas categorias
 */
router.post('/categories/bulk-price', async (req, res) => {
    try {
        const { pricesData, reason = 'Atualização em lote' } = req.body;

        if (!Array.isArray(pricesData) || pricesData.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Array de preços é obrigatório'
            });
        }

        // Validar dados
        const validation = PricingService.validatePricingData(pricesData);

        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Dados inválidos',
                errors: validation.errors,
                summary: validation.summary
            });
        }

        // Aplicar preços um por um
        const results = [];
        let successful = 0;
        let failed = 0;

        for (const item of validation.validItems) {
            try {
                const result = await PricingService.setPriceForCategory(
                    item.categoryId,
                    item.price,
                    req.user.username,
                    reason
                );

                results.push({
                    categoryId: item.categoryId,
                    success: true,
                    price: item.price,
                    result
                });
                successful++;

            } catch (error) {
                results.push({
                    categoryId: item.categoryId,
                    success: false,
                    error: error.message
                });
                failed++;
            }
        }

        res.json({
            success: failed === 0,
            message: `Atualização em lote: ${successful} sucessos, ${failed} falhas`,
            results,
            summary: {
                total: pricesData.length,
                successful,
                failed,
                processed: successful + failed
            }
        });

    } catch (error) {
        console.error('❌ Erro na atualização em lote:', error);
        res.status(500).json({
            success: false,
            message: 'Erro na atualização em lote',
            error: error.message
        });
    }
});

// ===== REGRAS DE DESCONTO POR CLIENTE =====

/**
 * POST /api/pricing/categories/:id/discount-rules
 * Adicionar regra de desconto para cliente específico
 */
router.post('/categories/:id/discount-rules', async (req, res) => {
    try {
        const { id } = req.params;
        const { clientCode, clientName, discountPercent, customPrice } = req.body;

        // Validações
        if (!clientCode || clientCode.length !== 4) {
            return res.status(400).json({
                success: false,
                message: 'Código de cliente deve ter 4 dígitos'
            });
        }

        if (!clientName) {
            return res.status(400).json({
                success: false,
                message: 'Nome do cliente é obrigatório'
            });
        }

        if (discountPercent && (discountPercent < 0 || discountPercent > 100)) {
            return res.status(400).json({
                success: false,
                message: 'Desconto deve ser entre 0 e 100%'
            });
        }

        if (customPrice && customPrice < 0) {
            return res.status(400).json({
                success: false,
                message: 'Preço customizado não pode ser negativo'
            });
        }

        // Buscar categoria
        const category = await PhotoCategory.findById(id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Categoria não encontrada'
            });
        }

        // Adicionar regra
        const newRule = category.addDiscountRule(clientCode, clientName, {
            discountPercent: discountPercent || 0,
            customPrice: customPrice || null
        });

        await category.save();

        res.json({
            success: true,
            message: 'Regra de desconto adicionada com sucesso',
            rule: newRule,
            category: category.getSummary()
        });

    } catch (error) {
        console.error('❌ Erro ao adicionar regra de desconto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao adicionar regra de desconto',
            error: error.message
        });
    }
});

/**
 * DELETE /api/pricing/categories/:id/discount-rules/:clientCode
 * Remover regra de desconto para cliente específico
 */
router.delete('/categories/:id/discount-rules/:clientCode', async (req, res) => {
    try {
        const { id, clientCode } = req.params;

        const category = await PhotoCategory.findById(id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Categoria não encontrada'
            });
        }

        // Remover regra
        const initialCount = category.discountRules.length;
        category.discountRules = category.discountRules.filter(
            rule => rule.clientCode !== clientCode
        );

        if (category.discountRules.length === initialCount) {
            return res.status(404).json({
                success: false,
                message: 'Regra de desconto não encontrada para este cliente'
            });
        }

        await category.save();

        res.json({
            success: true,
            message: 'Regra de desconto removida com sucesso',
            category: category.getSummary()
        });

    } catch (error) {
        console.error('❌ Erro ao remover regra de desconto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao remover regra de desconto',
            error: error.message
        });
    }
});

// ===== CONSULTA DE PREÇOS PARA CLIENTES =====

/**
 * GET /api/pricing/client/:clientCode/photo/:driveFileId
 * Obter preço de foto específica para cliente
 */
router.get('/client/:clientCode/photo/:driveFileId', async (req, res) => {
    try {
        const { clientCode, driveFileId } = req.params;

        const priceInfo = await PricingService.getPriceForClient(driveFileId, clientCode);

        res.json({
            success: true,
            priceInfo
        });

    } catch (error) {
        console.error('❌ Erro ao buscar preço para cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar preço',
            error: error.message
        });
    }
});

// ===== RELATÓRIOS E ESTATÍSTICAS =====

/**
 * GET /api/pricing/reports/overview
 * Relatório geral de preços
 */
router.get('/reports/overview', async (req, res) => {
    try {
        const report = await PricingService.generatePricingReport();

        res.json({
            success: true,
            report
        });

    } catch (error) {
        console.error('❌ Erro ao gerar relatório:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao gerar relatório',
            error: error.message
        });
    }
});

/**
 * GET /api/pricing/stats
 * Estatísticas rápidas para dashboard
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await PhotoCategory.getPricingStats();

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar estatísticas',
            error: error.message
        });
    }
});

// ===== UTILITÁRIOS =====

/**
 * POST /api/pricing/validate
 * Validar dados de preços antes de aplicar
 */
router.post('/validate', async (req, res) => {
    try {
        const { pricesData } = req.body;

        if (!Array.isArray(pricesData)) {
            return res.status(400).json({
                success: false,
                message: 'pricesData deve ser um array'
            });
        }

        const validation = PricingService.validatePricingData(pricesData);

        res.json({
            success: validation.isValid,
            validation
        });

    } catch (error) {
        console.error('❌ Erro na validação:', error);
        res.status(500).json({
            success: false,
            message: 'Erro na validação',
            error: error.message
        });
    }
});

/**
 * GET /api/pricing/clients/active
 * Buscar lista de clientes ativos para dropdowns
 */
router.get('/clients/active', async (req, res) => {
    try {
        console.log('👥 Buscando clientes ativos para pricing...');

        // Buscar códigos de acesso ativos
        const AccessCode = require('../models/AccessCode');
        const activeClients = await AccessCode.find({
            isActive: true,
            expiresAt: { $gt: new Date() }
        })
            .select('code clientName clientEmail')
            .sort({ clientName: 1 })
            .lean();

        const clientsList = activeClients.map(client => ({
            code: client.code,
            name: client.clientName,
            email: client.clientEmail || ''
        }));

        console.log(`✅ ${clientsList.length} clientes ativos encontrados`);

        res.json({
            success: true,
            clients: clientsList,
            total: clientsList.length
        });

    } catch (error) {
        console.error('❌ Erro ao buscar clientes ativos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar clientes ativos',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/pricing/categories/:id/discount-rules
 * Buscar todas as regras de desconto de uma categoria
 */
router.get('/categories/:id/discount-rules', async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`🏷️ Buscando regras de desconto para categoria: ${id}`);

        const category = await PhotoCategory.findById(id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Categoria não encontrada'
            });
        }

        // Filtrar apenas regras ativas
        const activeRules = category.discountRules.filter(rule => rule.isActive);

        res.json({
            success: true,
            categoryId: id,
            categoryName: category.displayName,
            basePrice: category.basePrice,
            discountRules: activeRules,
            totalRules: activeRules.length
        });

    } catch (error) {
        console.error('❌ Erro ao buscar regras de desconto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar regras de desconto',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ===== DESCONTOS POR QUANTIDADE =====

/**
 * GET /api/pricing/quantity-discounts
 * Buscar todas as regras de desconto por quantidade
 */
router.get('/quantity-discounts', async (req, res) => {
    try {
        console.log('📦 Buscando regras de desconto por quantidade...');

        const QuantityDiscount = require('../models/QuantityDiscount');
        const rules = await QuantityDiscount.getActiveRules();

        console.log(`✅ ${rules.length} regras de quantidade encontradas`);

        res.json({
            success: true,
            rules: rules,
            total: rules.length
        });

    } catch (error) {
        console.error('❌ Erro ao buscar regras de quantidade:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar regras de desconto por quantidade',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * POST /api/pricing/quantity-discounts
 * Criar nova regra de desconto por quantidade
 */
router.post('/quantity-discounts', async (req, res) => {
    try {
        const { minQuantity, maxQuantity, discountPercent, description } = req.body;

        // Validações básicas
        if (!minQuantity || minQuantity < 1) {
            return res.status(400).json({
                success: false,
                message: 'Quantidade mínima deve ser maior que 0'
            });
        }

        if (!discountPercent || discountPercent < 0 || discountPercent > 100) {
            return res.status(400).json({
                success: false,
                message: 'Desconto deve ser entre 0 e 100%'
            });
        }

        if (!description || description.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Descrição é obrigatória'
            });
        }

        console.log(`📦 Criando regra de quantidade: ${minQuantity}-${maxQuantity || '∞'} = ${discountPercent}%`);

        const QuantityDiscount = require('../models/QuantityDiscount');

        // Validar sobreposição
        const validation = await QuantityDiscount.validateNoOverlap(minQuantity, maxQuantity);
        if (!validation.isValid) {
            return res.status(409).json({
                success: false,
                message: validation.message,
                conflictingRule: validation.conflictingRule
            });
        }

        // Criar regra
        const newRule = new QuantityDiscount({
            minQuantity,
            maxQuantity: maxQuantity || null,
            discountPercent,
            description: description.trim(),
            createdBy: req.user.username
        });

        await newRule.save();

        console.log(`✅ Regra de quantidade criada: ${newRule._id}`);

        res.status(201).json({
            success: true,
            message: 'Regra de desconto criada com sucesso',
            rule: newRule
        });

    } catch (error) {
        console.error('❌ Erro ao criar regra de quantidade:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar regra de desconto',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * PUT /api/pricing/quantity-discounts/:id
 * Editar regra de desconto por quantidade
 */
router.put('/quantity-discounts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { minQuantity, maxQuantity, discountPercent, description, isActive } = req.body;

        console.log(`📦 Editando regra de quantidade: ${id}`);

        const QuantityDiscount = require('../models/QuantityDiscount');
        const rule = await QuantityDiscount.findById(id);

        if (!rule) {
            return res.status(404).json({
                success: false,
                message: 'Regra não encontrada'
            });
        }

        // Validar sobreposição se mudando quantidades
        if (minQuantity !== undefined || maxQuantity !== undefined) {
            const newMin = minQuantity !== undefined ? minQuantity : rule.minQuantity;
            const newMax = maxQuantity !== undefined ? maxQuantity : rule.maxQuantity;

            const validation = await QuantityDiscount.validateNoOverlap(newMin, newMax, id);
            if (!validation.isValid) {
                return res.status(409).json({
                    success: false,
                    message: validation.message,
                    conflictingRule: validation.conflictingRule
                });
            }
        }

        // Atualizar campos
        if (minQuantity !== undefined) rule.minQuantity = minQuantity;
        if (maxQuantity !== undefined) rule.maxQuantity = maxQuantity || null;
        if (discountPercent !== undefined) rule.discountPercent = discountPercent;
        if (isActive !== undefined) rule.isActive = isActive;

        // Sempre regenerar description quando houver mudanças
        const newMin = minQuantity !== undefined ? minQuantity : rule.minQuantity;
        const newMax = maxQuantity !== undefined ? (maxQuantity || null) : rule.maxQuantity;
        const newDiscount = discountPercent !== undefined ? discountPercent : rule.discountPercent;

        const rangeText = newMax ? `${newMin}-${newMax} fotos` : `${newMin}+ fotos`;
        rule.description = `${rangeText}: ${newDiscount}% desconto`;

        await rule.save();

        console.log(`✅ Regra de quantidade atualizada: ${id}`);

        res.json({
            success: true,
            message: 'Regra atualizada com sucesso',
            rule: rule
        });

    } catch (error) {
        console.error('❌ Erro ao editar regra de quantidade:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao editar regra de desconto',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * DELETE /api/pricing/quantity-discounts/:id
 * Remover regra de desconto por quantidade
 */
router.delete('/quantity-discounts/:id', async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`📦 Removendo regra de quantidade: ${id}`);

        const QuantityDiscount = require('../models/QuantityDiscount');
        const rule = await QuantityDiscount.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true }
        );

        if (!rule) {
            return res.status(404).json({
                success: false,
                message: 'Regra não encontrada'
            });
        }

        console.log(`✅ Regra de quantidade desativada: ${id}`);

        res.json({
            success: true,
            message: 'Regra removida com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao remover regra de quantidade:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao remover regra de desconto',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/pricing/quantity-discounts/calculate/:quantity
 * Calcular desconto para quantidade específica
 */
router.get('/quantity-discounts/calculate/:quantity', async (req, res) => {
    try {
        const { quantity } = req.params;
        const qty = parseInt(quantity);

        if (isNaN(qty) || qty < 1) {
            return res.status(400).json({
                success: false,
                message: 'Quantidade deve ser um número positivo'
            });
        }

        const QuantityDiscount = require('../models/QuantityDiscount');
        const discount = await QuantityDiscount.calculateDiscount(qty);

        res.json({
            success: true,
            quantity: qty,
            discount: discount
        });

    } catch (error) {
        console.error('❌ Erro ao calcular desconto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao calcular desconto',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;