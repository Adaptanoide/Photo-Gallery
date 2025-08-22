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
        const { googleDriveId, prefix, clientCode } = req.query;

        console.log(`🏷️ Buscando preço para categoria ${googleDriveId || prefix}, cliente: ${clientCode || 'ANÔNIMO'}`);
        const categoryId = googleDriveId || prefix;

        // ===== NOVO: DETECTAR CLIENTE ESPECIAL =====
        let category = null;
        let isSpecialClient = false;

        if (clientCode) {
            // Verificar se cliente tem acesso especial
            const AccessCode = require('../models/AccessCode');
            const accessCode = await AccessCode.findOne({ code: clientCode });

            if (accessCode && accessCode.accessType === 'special') {
                console.log(`🔑 Cliente especial detectado: ${clientCode} - buscando preço customizado`);
                isSpecialClient = true;

                try {
                    // Buscar seleção especial
                    const Selection = require('../models/Selection');
                    const selection = await Selection.findById(accessCode.specialSelection.selectionId);

                    if (selection) {
                        // Buscar categoria customizada pelo googleDriveFolderId
                        const customCategory = selection.customCategories.find(
                            cat => cat.googleDriveFolderId === googleDriveId
                        );

                        if (customCategory) {
                            // Converter categoria customizada para formato compatível
                            category = {
                                _id: customCategory.categoryId,
                                displayName: customCategory.categoryDisplayName || customCategory.categoryName,
                                basePrice: customCategory.baseCategoryPrice || 0,
                                getPriceForClient: () => customCategory.baseCategoryPrice || 0, // Método mock
                                isCustomCategory: true,
                                selectionId: selection.selectionId
                            };

                            console.log(`✅ Categoria especial encontrada: ${category.displayName} - Preço: R$ ${category.basePrice}`);
                        } else {
                            console.log(`❌ Categoria customizada não encontrada: ${googleDriveId}`);
                        }
                    } else {
                        console.log(`❌ Seleção especial não encontrada: ${accessCode.specialSelection.selectionId}`);
                    }
                } catch (error) {
                    console.error('❌ Erro ao buscar categoria especial:', error);
                }
            }
        }

        // Se não é cliente especial ou não encontrou categoria especial, buscar categoria normal
        if (!category) {
            console.log(`🔍 Buscando categoria normal: ${categoryId}`);
            // Remover barra final se existir
            const cleanPath = categoryId.endsWith('/') ? categoryId.slice(0, -1) : categoryId;

            // Buscar por folderName ou displayName
            category = await PhotoCategory.findOne({
                $or: [
                    { folderName: cleanPath.split('/').pop() },  // Último segmento do path
                    { displayName: { $regex: ` → ${cleanPath.split('/').pop().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$` } },
                    { googleDrivePath: cleanPath }
                ]
            });
        }

        if (!category) {
            console.log(`❌ Categoria não encontrada: ${googleDriveId}`);
            return res.json({
                success: false,
                message: 'Categoria não encontrada'
            });
        }

        // ===== CORREÇÃO: CALCULAR PREÇO FINAL =====

        let finalPrice = 0;
        let priceSource = 'base';
        let hierarchy = null;

        // Se é categoria especial, usar preço customizado diretamente
        if (category.isCustomCategory) {
            finalPrice = category.basePrice; // Preço customizado já está em basePrice
            priceSource = 'special_selection';
            hierarchy = 'Custom price from special selection';

            console.log(`💰 Usando preço customizado: $${finalPrice} (fonte: special_selection)`);
        } else {
            // Lógica normal para categorias regulares
            finalPrice = category.basePrice;
            priceSource = 'base';

            if (clientCode) {
                try {
                    const priceResult = await category.getPriceForClient(clientCode);
                    finalPrice = priceResult.finalPrice;
                    priceSource = priceResult.appliedRule;
                    hierarchy = PricingService.getHierarchyExplanation(priceResult.appliedRule);
                } catch (error) {
                    console.log(`⚠️ Erro ao calcular preço hierárquico, usando base: ${error.message}`);
                }
            }
        }

        const priceInfo = {
            _id: category._id,
            displayName: category.displayName,
            basePrice: category.basePrice,
            finalPrice: finalPrice,
            priceSource: priceSource,
            hierarchy: hierarchy,
            formattedPrice: finalPrice > 0 ? `$${finalPrice.toFixed(2)}` : 'No price',
            hasPrice: finalPrice > 0
        };

        console.log(`✅ Preço calculado:`, {
            categoria: category.displayName,
            cliente: clientCode || 'ANÔNIMO',
            precoBase: category.basePrice,
            precoFinal: finalPrice,
            fonte: priceSource,
            isSpecial: category.isCustomCategory || false
        });

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


// Buscar faixas de desconto aplicáveis para uma categoria
router.get('/category-ranges', async (req, res) => {
    try {
        const { categoryId, clientCode } = req.query;

        if (!categoryId) {
            return res.status(400).json({
                success: false,
                message: 'Category ID required'
            });
        }

        // CORREÇÃO: Remover barra final e buscar por path parcial
        const cleanId = categoryId.replace(/\/$/, '');

        const category = await PhotoCategory.findOne({
            $or: [
                { googleDriveId: cleanId },
                { googleDriveId: cleanId + '/' },
                { googleDrivePath: { $regex: cleanId, $options: 'i' } },
                { displayName: { $regex: cleanId, $options: 'i' } }
            ]
        });

        if (!category) {
            console.log('❌ Categoria não encontrada para:', categoryId);
            return res.json({
                success: false,
                message: 'Category not found'
            });
        }

        console.log('✅ Categoria encontrada:', category.displayName);

        // Resto do código continua igual...
        const response = {
            categoryName: category.displayName,
            basePrice: category.basePrice,
            appliedType: 'base',
            ranges: [],
            currentDiscount: null
        };

        // 1. Verificar Custom Client
        const customRule = category.discountRules.find(r =>
            r.clientCode === clientCode && r.isActive
        );

        if (customRule && customRule.priceRanges?.length > 0) {
            response.appliedType = 'custom';
            response.ranges = customRule.priceRanges.map(r => ({
                min: r.min,
                max: r.max,
                price: r.price,
                label: `${r.min}${r.max ? '-' + r.max : '+'}: $${r.price}`
            }));
            response.currentDiscount = {
                type: 'Special Client',
                clientName: customRule.clientName
            };
        }
        // 2. Senão, verificar Volume
        else {
            const volumeRule = category.discountRules.find(r =>
                r.clientCode === 'VOLUME' && r.isActive
            );

            if (volumeRule && volumeRule.priceRanges?.length > 0) {
                response.appliedType = 'volume';
                response.ranges = volumeRule.priceRanges.map(r => ({
                    min: r.min,
                    max: r.max,
                    price: r.price,
                    label: `${r.min}${r.max ? '-' + r.max : '+'}: $${r.price}`
                }));
                response.currentDiscount = {
                    type: 'Volume Discount',
                    description: 'Available for all clients'
                };
            }
        }

        res.json({
            success: true,
            data: response
        });

    } catch (error) {
        console.error('Error getting category ranges:', error);
        res.status(500).json({
            success: false,
            message: 'Error loading pricing ranges'
        });
    }
});

// ============================================
// NOVO ENDPOINT - FILTROS DE CATEGORIAS
// Adicionado em 21/08/2025 - Sistema de filtros
// ============================================
router.get('/categories/filtered', async (req, res) => {
    console.log('🔍 ==== INICIANDO FILTROS DE CATEGORIAS ====');

    try {
        // ========== VERIFICAR SPECIAL SELECTION ==========
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);

                // Se é cliente com Special Selection
                if (decoded.type === 'client' && decoded.accessType === 'special') {
                    console.log(`⭐ Cliente SPECIAL ${decoded.clientCode} - retornando categorias virtuais`);

                    // Buscar a Special Selection REAL do banco
                    const Selection = require('../models/Selection');
                    const AccessCode = require('../models/AccessCode');

                    try {
                        const accessCode = await AccessCode.findOne({
                            code: decoded.clientCode,
                            accessType: 'special'
                        }).populate('specialSelection.selectionId');

                        if (accessCode && accessCode.specialSelection && accessCode.specialSelection.selectionId) {
                            const selection = await Selection.findById(
                                accessCode.specialSelection.selectionId
                            );

                            // Se tem categorias customizadas, retornar elas
                            if (selection && selection.customCategories && selection.customCategories.length > 0) {
                                const categories = selection.customCategories.map(cat => ({
                                    id: cat.categoryId,
                                    name: cat.categoryDisplayName || cat.categoryName,
                                    fullPath: `special/${cat.categoryId}`,
                                    photoCount: cat.photos ? cat.photos.length : 0,
                                    price: cat.baseCategoryPrice || 0,
                                    formattedPrice: `R$ ${(cat.baseCategoryPrice || 0).toFixed(2)}`,
                                    driveId: cat.categoryId
                                }));

                                console.log(`📦 Retornando ${categories.length} categorias virtuais`);

                                return res.json({
                                    success: true,
                                    total: categories.length,
                                    categories: categories,
                                    isSpecialSelection: true,
                                    message: 'Special Selection Categories'
                                });
                            }
                        }
                    } catch (dbError) {
                        console.log('❌ Erro ao buscar Special Selection:', dbError.message);
                    }

                    // FALLBACK: Se não achou categorias, retornar 1 categoria padrão
                    console.log('⚠️ Sem categorias customizadas, usando fallback');
                    return res.json({
                        success: true,
                        total: 1,
                        categories: [{
                            id: 'special_selection',
                            name: 'Special Selection',
                            fullPath: 'special',
                            photoCount: 3,
                            price: 100,
                            formattedPrice: 'R$ 100.00',
                            driveId: 'special'
                        }],
                        isSpecialSelection: true,
                        message: 'Special Selection Categories (Fallback)'
                    });
                }
            } catch (error) {
                console.log('Token inválido ou não é special:', error.message);
            }
        }
        // ========== FIM DA VERIFICAÇÃO SPECIAL ==========

        console.log('📋 Parâmetros recebidos:', req.query);

        const {
            type,        // Ex: "Brindle", "Salt & Pepper"
            priceMin,    // Ex: 0, 51, 101
            priceMax,    // Ex: 50, 100, 150
            photoMin,    // Ex: 1, 11, 51
            photoMax     // Ex: 10, 50, 100
        } = req.query;

        // Buscar apenas categorias ativas e com fotos
        console.log('📂 Buscando categorias no banco...');
        let categories = await PhotoCategory.find({
            isActive: true,
        }).lean(); // .lean() para melhor performance

        const totalInicial = categories.length;
        console.log(`✅ Encontradas ${totalInicial} categorias ativas com fotos`);

        // ====================================
        // FILTRO 1: Por tipo/padrão
        // ====================================
        if (type && type !== 'all') {
            console.log(`🏷️ Aplicando filtro de tipo: "${type}"`);
            const antes = categories.length;

            // NOVO: Mapeamento de termos para busca flexível
            const typeSearchTerms = {
                'salt-pepper': ['salt & pepper', 'salt and pepper', 'salt&pepper'],
                'black-white': ['black & white', 'black and white', 'black&white'],
                'brown-white': ['brown & white', 'brown and white', 'brown&white'],
                'tricolor': ['tricolor', 'tri-color', 'three color'],
                'brindle': ['brindle'],
                'exotic': ['exotic', 'palomino', 'metallica'],
                'grey': ['grey', 'gray'],
                'hereford': ['hereford']
            };

            // Obter termos de busca ou usar o termo original
            const searchTerms = typeSearchTerms[type] || [type];

            categories = categories.filter(cat => {
                const fullPath = (cat.googleDrivePath || '').toLowerCase();
                const name = (cat.displayName || '').toLowerCase();

                // Verificar se QUALQUER termo de busca está presente
                return searchTerms.some(term => {
                    const searchTerm = term.toLowerCase();
                    return fullPath.includes(searchTerm) || name.includes(searchTerm);
                });
            });

            console.log(`   → Resultado: ${antes} → ${categories.length} categorias`);
        }

        // ====================================
        // FILTRO 2: Por faixa de preço
        // ====================================
        if (priceMin !== undefined || priceMax !== undefined) {
            console.log(`💰 Aplicando filtro de preço: R$ ${priceMin || '0'} - R$ ${priceMax || '∞'}`);
            const antes = categories.length;

            categories = categories.filter(cat => {
                const price = cat.price || 0;

                // Converter para números
                const min = priceMin ? Number(priceMin) : null;
                const max = priceMax ? Number(priceMax) : null;

                // Se tem min e max
                if (min !== null && max !== null) {
                    return price >= min && price <= max;
                }
                // Se só tem min (para "Above R$ X")
                else if (min !== null) {
                    return price >= min;
                }
                // Se só tem max
                else if (max !== null) {
                    return price <= max;
                }
                return true;
            });

            console.log(`   → Resultado: ${antes} → ${categories.length} categorias`);
        }

        // ====================================
        // FILTRO 3: Por quantidade de fotos
        // ====================================
        if (photoMin !== undefined || photoMax !== undefined) {
            console.log(`📸 Aplicando filtro de fotos: ${photoMin || '0'} - ${photoMax || '∞'} fotos`);
            const antes = categories.length;

            categories = categories.filter(cat => {
                const count = cat.photoCount || 0;

                // Converter para números
                const min = photoMin ? Number(photoMin) : null;
                const max = photoMax ? Number(photoMax) : null;

                // Se tem min e max
                if (min !== null && max !== null) {
                    return count >= min && count <= max;
                }
                // Se só tem min (para "100+")
                else if (min !== null) {
                    return count >= min;
                }
                // Se só tem max
                else if (max !== null) {
                    return count <= max;
                }
                return true;
            });

            console.log(`   → Resultado: ${antes} → ${categories.length} categorias`);
        }

        // ====================================
        // ORDENAR RESULTADOS
        // ====================================
        categories.sort((a, b) => {
            // Primeiro por preço (maior primeiro)
            if (a.price !== b.price) {
                return (b.price || 0) - (a.price || 0);
            }
            // Depois por quantidade de fotos
            return (b.photoCount || 0) - (a.photoCount || 0);
        });

        console.log('📊 ==== RESUMO DOS FILTROS ====');
        console.log(`   Total inicial: ${totalInicial} categorias`);
        console.log(`   Total filtrado: ${categories.length} categorias`);
        if (totalInicial > 0) {
            console.log(`   Redução: ${((1 - categories.length / totalInicial) * 100).toFixed(1)}%`);
        }

        // Preparar resposta
        const response = {
            success: true,
            total: categories.length,
            filters: {
                type: type || 'all',
                priceRange: priceMin || priceMax ? `R$ ${priceMin || 0} - R$ ${priceMax || '∞'}` : 'all',
                photoRange: photoMin || photoMax ? `${photoMin || 0} - ${photoMax || '∞'} photos` : 'all'
            },
            categories: categories.map(cat => ({
                id: cat._id,
                name: cat.displayName,
                fullPath: cat.googleDrivePath,
                photoCount: cat.photoCount || 0,
                price: cat.basePrice || 0,
                formattedPrice: cat.basePrice ? `R$ ${(cat.basePrice || 0).toFixed(2)}` : 'R$ 0.00',
                driveId: cat.googleDriveId
            }))
        };

        console.log('✅ Enviando resposta com sucesso!');
        res.json(response);

    } catch (error) {
        console.error('❌ ERRO ao filtrar categorias:', error);
        res.status(500).json({
            success: false,
            message: 'Error filtering categories',
            error: error.message
        });
    }
});

// ============================================
// ENDPOINT PARA OBTER TIPOS DISPONÍVEIS
// Para popular o filtro de tipos dinamicamente
// ============================================
router.get('/categories/filter-types', async (req, res) => {
    console.log('📋 Buscando tipos de filtros disponíveis...');

    try {
        // Tipos comuns que aparecem nas categorias
        const commonTypes = [
            { value: 'brindle', label: 'Brindle', keywords: ['brindle'] },
            { value: 'salt-pepper', label: 'Salt & Pepper', keywords: ['salt & pepper', 'salt and pepper'] },
            { value: 'black-white', label: 'Black & White', keywords: ['black & white', 'black and white'] },
            { value: 'brown-white', label: 'Brown & White', keywords: ['brown & white', 'brown and white'] },
            { value: 'tricolor', label: 'Tricolor', keywords: ['tricolor'] },
            { value: 'exotic', label: 'Exotic', keywords: ['exotic', 'palomino', 'metallica'] },
            { value: 'grey', label: 'Grey', keywords: ['grey', 'gray'] },
            { value: 'hereford', label: 'Hereford', keywords: ['hereford'] }
        ];

        // Buscar categorias para contar quantas tem cada tipo
        const categories = await PhotoCategory.find({
            isActive: true
            // REMOVIDO O FILTRO photoCount - MOSTRAR TODAS!
        }).lean();

        // Contar ocorrências de cada tipo
        const typesWithCount = commonTypes.map(type => {
            const count = categories.filter(cat => {
                const fullPath = (cat.fullPath || '').toLowerCase();
                const name = (cat.name || '').toLowerCase();

                return type.keywords.some(keyword =>
                    fullPath.includes(keyword) || name.includes(keyword)
                );
            }).length;

            return {
                ...type,
                count
            };
        }).filter(type => type.count > 0); // Só retornar tipos que existem

        console.log(`✅ Encontrados ${typesWithCount.length} tipos de categorias`);

        res.json({
            success: true,
            types: typesWithCount
        });

    } catch (error) {
        console.error('❌ Erro ao buscar tipos de filtros:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting filter types',
            error: error.message
        });
    }
});

// Todas as rotas de preços precisam de autenticação admin
router.use(authenticateToken);


/**
 * POST /api/pricing/sync
 * Sincronizar estrutura do R2 com banco de dados
 */
router.post('/sync', async (req, res) => {
    try {
        const { forceRefresh = false } = req.body;

        console.log(`🔄 Iniciando sincronização R2 ${forceRefresh ? 'forçada' : 'normal'}...`);

        // USAR NOVO MÉTODO R2
        const result = await PricingService.scanAndSyncR2(forceRefresh);

        res.json({
            success: true,
            message: 'Sincronização R2 concluída',
            data: result,
            summary: result
        });

    } catch (error) {
        console.error('❌ Erro na sincronização:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao sincronizar com R2',
            error: error.message
        });
    }
});

/**
 * GET /api/pricing/sync/status
 * Status sempre atualizado com R2
 */
router.get('/sync/status', async (req, res) => {
    try {
        // Com R2, sempre está sincronizado
        const stats = await PricingService.getR2Statistics();

        res.json({
            success: true,
            syncStatus: {
                needingSyncCount: 0, // Sempre 0 com R2
                lastSyncDate: stats.lastSyncDate,
                isOutdated: false, // Nunca desatualizado
                hoursOld: 0
            },
            statistics: stats
        });

    } catch (error) {
        console.error('❌ Erro ao verificar status:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao verificar status',
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
            priceStatus = 'all',  // MUDADO DE hasPrice PARA priceStatus
            page = 1,
            limit = 50
        } = req.query;

        // Construir query baseada no status do preço
        const query = { isActive: true };

        // Aplicar filtro de preço
        if (priceStatus === 'with') {
            query.basePrice = { $gt: 0 };
        } else if (priceStatus === 'without') {
            query.$or = [
                { basePrice: 0 },
                { basePrice: null },
                { basePrice: { $exists: false } }
            ];
        }
        // Se priceStatus === 'all', não adiciona filtro (mostra TODAS)

        // Aplicar filtro de busca
        if (search) {
            query.$or = [
                { displayName: { $regex: search, $options: 'i' } },
                { folderName: { $regex: search, $options: 'i' } },
                { qbItem: { $regex: search, $options: 'i' } }
            ];
        }

        const categories = await PhotoCategory.find(query)
            .sort({ displayName: 1 })
            .lean();

        // Paginação
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedCategories = categories.slice(startIndex, endIndex);

        res.json({
            success: true,
            categories: paginatedCategories.map(category => ({
                ...category,
                formattedPrice: category.basePrice > 0 ?
                    `$${category.basePrice.toFixed(2)}` : 'No price',
                hasCustomRules: category.discountRules && category.discountRules.length > 0
            })),
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
 * Definir/atualizar preço de uma categoria e QB Item
 */
router.put('/categories/:id/price', async (req, res) => {
    try {
        const { id } = req.params;
        const { price, qbItem = '', reason = '' } = req.body;

        // Validações
        if (typeof price !== 'number' || price < 0) {
            return res.status(400).json({
                success: false,
                message: 'Preço deve ser um número não negativo'
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

        // Atualizar preço (usando método existente)
        category.updatePrice(price, req.user.username, reason);

        // Atualizar QB Item
        category.qbItem = qbItem.trim();

        await category.save();

        res.json({
            success: true,
            message: price > 0 ? 'Preço e QB Item atualizados com sucesso' : 'QB Item atualizado com sucesso',
            data: {
                category: category.getSummary(),
                newPrice: price,
                qbItem: category.qbItem
            }
        });

    } catch (error) {
        console.error('❌ Erro ao definir preço/QB Item:', error);

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
        const { clientCode, clientName, discountPercent, customPrice, priceRanges } = req.body;

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

        // NOVO: Processar priceRanges se existir
        let processedRanges = null;
        if (priceRanges && Array.isArray(priceRanges) && priceRanges.length > 0) {
            processedRanges = priceRanges.map(range => ({
                min: parseInt(range.min),
                max: range.max ? parseInt(range.max) : null,
                price: parseFloat(range.price)
            }));
        }

        // Validações antigas (mantidas para compatibilidade)
        if (!processedRanges) {
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
        }

        // Buscar categoria
        const category = await PhotoCategory.findById(id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Categoria não encontrada'
            });
        }

        // Preparar dados da regra
        const ruleData = {
            discountPercent: discountPercent || 0,
            customPrice: customPrice || null
        };

        // NOVO: Adicionar priceRanges se existir
        if (processedRanges) {
            ruleData.priceRanges = processedRanges;
        }

        // Adicionar regra
        const newRule = category.addDiscountRule(clientCode, clientName, ruleData);

        await category.save();

        res.json({
            success: true,
            message: 'Regra de desconto adicionada com sucesso',
            rule: newRule,
            discountRules: category.discountRules,
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
 * PUT /api/pricing/categories/:id/pricing-mode
 * Alterar modo de precificação da categoria
 */
router.put('/categories/:id/pricing-mode', async (req, res) => {
    try {
        const { id } = req.params;
        const { pricingMode } = req.body;

        // Validar modo
        const validModes = ['base', 'client', 'quantity'];
        if (!validModes.includes(pricingMode)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid pricing mode. Must be: base, client, or quantity'
            });
        }

        const category = await PhotoCategory.findById(id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Atualizar modo
        category.pricingMode = pricingMode;
        await category.save();

        console.log(`🎛️ Pricing mode updated: ${category.displayName} → ${pricingMode}`);

        res.json({
            success: true,
            message: `Pricing mode changed to ${pricingMode}`,
            category: category.getSummary(),
            pricingMode: pricingMode
        });

    } catch (error) {
        console.error('❌ Error updating pricing mode:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating pricing mode',
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
        const { minQuantity, maxQuantity, discountPercent, fixedPrice, ruleType, description, createdBy } = req.body;

        // Validações básicas
        if (!minQuantity || minQuantity < 1) {
            return res.status(400).json({
                success: false,
                message: 'Quantidade mínima deve ser maior que 0'
            });
        }

        // Validar baseado no tipo de regra
        if (ruleType === 'fixed') {
            if (!fixedPrice || fixedPrice < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Preço fixo deve ser maior que 0'
                });
            }
        } else {
            if (!discountPercent || discountPercent < 0 || discountPercent > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Desconto deve ser entre 0 e 100%'
                });
            }
        }

        if (!description || description.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Descrição é obrigatória'
            });
        }

        console.log(`📦 Criando regra de quantidade: ${minQuantity}-${maxQuantity || '∞'} = ${ruleType === 'fixed' ? '$' + fixedPrice : discountPercent + '%'}`);

        const QuantityDiscount = require('../models/QuantityDiscount');

        // Validar sobreposição
        const validation = await QuantityDiscount.validateNoOverlap(minQuantity, maxQuantity);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: validation.message
            });
        }

        // Criar nova regra
        const newRule = new QuantityDiscount({
            minQuantity,
            maxQuantity: maxQuantity || null,
            discountPercent: discountPercent || 0,
            fixedPrice: fixedPrice || null,
            ruleType: ruleType || 'percentage',
            description: description.trim(),
            createdBy: createdBy || 'admin',
            isActive: true
        });

        await newRule.save();

        console.log(`✅ Regra de quantidade criada: ${newRule._id}`);

        res.json({
            success: true,
            rule: newRule,
            message: 'Regra criada com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao criar regra de quantidade:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao criar regra'
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

// Adicionar estas rotas em src/routes/pricing.js
// APÓS a linha 1000 (depois das rotas de quantity-discounts)

/**
 * POST /api/pricing/categories/:id/volume-rules
 * Adicionar/Atualizar regras de volume para categoria
 * Volume rules são salvas como clientCode='VOLUME'
 */
router.post('/categories/:id/volume-rules', async (req, res) => {
    try {
        const { id } = req.params;
        const { priceRanges } = req.body;

        console.log('📊 Salvando Volume Rules para categoria:', id);
        console.log('Faixas recebidas:', priceRanges);

        // Validar entrada
        if (!priceRanges || !Array.isArray(priceRanges) || priceRanges.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Price ranges are required'
            });
        }

        // Buscar categoria
        const category = await PhotoCategory.findById(id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Processar e validar faixas
        const processedRanges = [];
        for (const range of priceRanges) {
            if (!range.min || range.min < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Minimum quantity must be at least 1'
                });
            }
            if (!range.price || range.price < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Price must be positive'
                });
            }

            processedRanges.push({
                min: parseInt(range.min),
                max: range.max ? parseInt(range.max) : null,
                price: parseFloat(range.price)
            });
        }

        // Ordenar faixas por min
        processedRanges.sort((a, b) => a.min - b.min);

        // Validar sobreposição
        for (let i = 0; i < processedRanges.length - 1; i++) {
            const current = processedRanges[i];
            const next = processedRanges[i + 1];

            if (current.max && current.max >= next.min) {
                return res.status(400).json({
                    success: false,
                    message: `Overlap detected: ${current.min}-${current.max} overlaps with ${next.min}-${next.max || '+'}`
                });
            }
        }

        // Remover regra VOLUME existente se houver
        category.discountRules = category.discountRules.filter(
            rule => rule.clientCode !== 'VOLUME'
        );

        // Adicionar nova regra VOLUME
        category.discountRules.push({
            clientCode: 'VOLUME',
            clientName: 'All Regular Clients',
            priceRanges: processedRanges,
            isActive: true,
            createdAt: new Date()
        });

        await category.save();

        console.log(`✅ Volume rules saved: ${processedRanges.length} ranges`);

        res.json({
            success: true,
            message: 'Volume rules saved successfully',
            data: {
                categoryId: id,
                categoryName: category.displayName,
                volumeRules: processedRanges
            }
        });

    } catch (error) {
        console.error('❌ Error saving volume rules:', error);
        res.status(500).json({
            success: false,
            message: 'Error saving volume rules',
            error: error.message
        });
    }
});

/**
 * GET /api/pricing/categories/:id/volume-rules
 * Buscar regras de volume de uma categoria
 */
router.get('/categories/:id/volume-rules', async (req, res) => {
    try {
        const { id } = req.params;

        const category = await PhotoCategory.findById(id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Buscar regra VOLUME
        const volumeRule = category.discountRules.find(
            rule => rule.clientCode === 'VOLUME' && rule.isActive
        );

        res.json({
            success: true,
            data: {
                categoryId: id,
                categoryName: category.displayName,
                basePrice: category.basePrice,
                hasVolumeRules: !!volumeRule,
                volumeRules: volumeRule ? volumeRule.priceRanges : []
            }
        });

    } catch (error) {
        console.error('❌ Error loading volume rules:', error);
        res.status(500).json({
            success: false,
            message: 'Error loading volume rules',
            error: error.message
        });
    }
});

/**
 * DELETE /api/pricing/categories/:id/volume-rules
 * Remover regras de volume de uma categoria
 */
router.delete('/categories/:id/volume-rules', async (req, res) => {
    try {
        const { id } = req.params;

        const category = await PhotoCategory.findById(id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Remover regra VOLUMEme solicite o arquivo completo e voce 
        const initialLength = category.discountRules.length;
        category.discountRules = category.discountRules.filter(
            rule => rule.clientCode !== 'VOLUME'
        );

        if (category.discountRules.length === initialLength) {
            return res.json({
                success: true,
                message: 'No volume rules to remove'
            });
        }

        await category.save();

        console.log(`✅ Volume rules removed for category: ${category.displayName}`);

        res.json({
            success: true,
            message: 'Volume rules removed successfully'
        });

    } catch (error) {
        console.error('❌ Error removing volume rules:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing volume rules',
            error: error.message
        });
    }
});

module.exports = router;