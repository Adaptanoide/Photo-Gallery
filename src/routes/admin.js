// src/routes/admin.js

const express = require('express');
const mongoose = require('mongoose');
const AccessCode = require('../models/AccessCode');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const { authenticateToken } = require('./auth');
const CartService = require('../services/CartService');

const router = express.Router();

// ROTA TEMPORÁRIA PARA CRIAR CÓDIGO (sem auth)
router.post('/create-test-code', async (req, res) => {
    try {
        // Gerar código único de 4 dígitos
        let code;
        let codeExists = true;
        let attempts = 0;

        // Usar código enviado ou gerar novo
        if (req.body.code) {
            code = req.body.code;
            codeExists = await AccessCode.findOne({ code });

            // Se o código enviado já existe, gerar novo
            if (codeExists) {
                while (codeExists && attempts < 100) {
                    code = Math.floor(1000 + Math.random() * 9000).toString();
                    codeExists = await AccessCode.findOne({ code });
                    attempts++;
                }
            }
        } else {
            // Se não foi enviado código, gerar novo
            while (codeExists && attempts < 100) {
                code = Math.floor(1000 + Math.random() * 9000).toString();
                codeExists = await AccessCode.findOne({ code });
                attempts++;
            }
        }

        const accessCode = new AccessCode({
            code,
            clientName: "João Silva",
            clientEmail: "joao@email.com",
            allowedCategories: ["1. Colombian Cowhides", "2. Brazil Best Sellers"],
            createdBy: "admin"
        });

        await accessCode.save();

        res.json({
            success: true,
            message: 'Código criado com sucesso',
            code: code,
            client: "João Silva"
        });

    } catch (error) {
        console.error('Erro ao criar código:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar código'
        });
    }
});

// Todas as rotas admin precisam de autenticação
router.use(authenticateToken);

// ===== CHANGE PASSWORD ROUTE =====
router.put('/profile/change-password', async (req, res) => {
    try {
        const Admin = require('../models/Admin');
        const { currentPassword, newPassword } = req.body;

        console.log('📝 Change password request for:', req.user.username);

        // Validations
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        // Find admin WITH password (normally we exclude it)
        const admin = await Admin.findById(req.user.id);

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Administrator not found'
            });
        }

        // Verify current password
        const isPasswordValid = await admin.comparePassword(currentPassword);

        if (!isPasswordValid) {
            console.log('⚠️ Incorrect current password for:', admin.username);
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update password (the pre-save hook will hash it automatically)
        admin.password = newPassword;
        await admin.save();

        console.log('✅ Password changed successfully for:', admin.username);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('❌ Error changing password:', error);
        res.status(500).json({
            success: false,
            message: 'Error changing password'
        });
    }
});

// Status do banco de dados
router.get('/db-status', async (req, res) => {
    try {
        // Testar conexão fazendo uma operação simples
        await mongoose.connection.db.admin().ping();

        const collections = await mongoose.connection.db.listCollections().toArray();

        res.json({
            status: 'OK',
            message: 'MongoDB conectado',
            database: mongoose.connection.name,
            collections: collections.map(c => c.name)
        });

    } catch (error) {
        console.error('Erro ao verificar DB:', error);
        res.status(500).json({
            status: 'ERROR',
            message: 'Erro de conexão com MongoDB'
        });
    }
});

// Listar códigos de acesso COM PAGINAÇÃO E INFO DE CARRINHO
router.get('/access-codes', async (req, res) => {
    try {
        // Parâmetros de paginação e busca
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 25;
        const search = req.query.search || '';
        const status = req.query.status || 'all';
        const sortBy = req.query.sortBy || 'recent';

        // Calcular skip
        const skip = (page - 1) * limit;

        // Construir query de busca
        let query = {};

        // Busca por texto
        if (search) {
            query.$or = [
                { clientName: { $regex: search, $options: 'i' } },
                { clientEmail: { $regex: search, $options: 'i' } },
                { companyName: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } }
            ];
        }

        // Filtro por status
        if (status === 'active') {
            query.isActive = true;
        } else if (status === 'inactive') {
            query.isActive = false;
        }

        // ============ NOVA LÓGICA DE CARRINHOS ============
        // Buscar TODOS os carrinhos ativos primeiro
        const now = new Date(); // ⚠️ ADICIONAR ESTA LINHA
        const Cart = require('../models/Cart');
        const activeCarts = await Cart.find({
            'items.0': { $exists: true },
            isActive: true,
            $or: [
                { expiresAt: { $gt: now } },
                { expiresAt: { $exists: false } }
            ]
        }).select('clientCode items createdAt expiresAt');

        // Criar mapa de carrinhos
        const cartMap = {};
        const clientsWithCart = new Set();

        activeCarts.forEach(cart => {
            const validItems = cart.items.filter(item => {
                // ✅ Excluir ghost items
                if (item.ghostStatus === 'ghost') return false;

                // Verificar expiração
                if (!item.expiresAt) return true;
                return new Date(item.expiresAt) > now;
            });

            if (validItems.length > 0) {
                cartMap[cart.clientCode] = {
                    itemCount: validItems.length,
                    totalValue: validItems.reduce((sum, item) => sum + (item.price || 0), 0),
                    isTemporary: true
                };
                clientsWithCart.add(cart.clientCode);
            }
        });

        // ============ BUSCAR CLIENTES EM 2 ETAPAS ============
        let finalClients = [];

        // ETAPA 1: Buscar TODOS os clientes com carrinho (sem paginação)
        if (clientsWithCart.size > 0) {
            const queryWithCart = {
                ...query,
                code: { $in: Array.from(clientsWithCart) }
            };

            const clientsWithCartData = await AccessCode.find(queryWithCart);

            // Ordenar por quantidade de itens no carrinho
            clientsWithCartData.sort((a, b) => {
                const aCount = cartMap[a.code]?.itemCount || 0;
                const bCount = cartMap[b.code]?.itemCount || 0;
                return bCount - aCount;
            });

            finalClients = clientsWithCartData;
            console.log(`✅ ${finalClients.length} clientes com carrinho adicionados ao topo`);
        }

        // ETAPA 2: Buscar clientes SEM carrinho (com paginação)
        const queryWithoutCart = {
            ...query,
            code: { $nin: Array.from(clientsWithCart) }
        };

        // Definir ordenação para clientes sem carrinho
        let sortOptions = {};
        switch (sortBy) {
            case 'name':
                sortOptions = { clientName: 1 };
                break;
            case 'code':
                sortOptions = { code: 1 };
                break;
            case 'oldest':
                sortOptions = { createdAt: 1 };
                break;
            case 'usage':
                sortOptions = { usageCount: -1 };
                break;
            case 'expires-soon':
                sortOptions = { expiresAt: 1 };
                break;
            default:
                sortOptions = { createdAt: -1 };
                break;
        }

        // Calcular quantos sem carrinho precisamos
        const remainingSlots = limit - finalClients.length;
        const skipAdjusted = Math.max(0, skip - finalClients.length);

        if (remainingSlots > 0) {
            const clientsWithoutCart = await AccessCode.find(queryWithoutCart)
                .sort(sortOptions)
                .skip(skipAdjusted)
                .limit(remainingSlots);

            finalClients = [...finalClients, ...clientsWithoutCart];
        }

        // Calcular total correto
        const totalWithCart = clientsWithCart.size;
        const totalWithoutCart = await AccessCode.countDocuments(queryWithoutCart);
        const totalCount = totalWithCart + totalWithoutCart;
        const totalPages = Math.ceil(totalCount / limit);

        // Adicionar info de carrinho em cada código
        const codesWithCart = finalClients.map(code => ({
            ...(code.toObject ? code.toObject() : code),
            cartInfo: cartMap[code.code] || null
        }));

        res.json({
            success: true,
            codes: codesWithCart,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                startIndex: skip + 1,
                endIndex: Math.min(skip + limit, totalCount)
            }
        });

    } catch (error) {
        console.error('Erro ao buscar códigos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar códigos'
        });
    }
});

// Criar código de acesso
router.post('/access-codes', async (req, res) => {
    try {
        const {
            clientName,
            clientEmail,
            clientPhone,
            companyName,
            addressLine1,
            addressLine2,
            city,
            state,
            zipCode,
            salesRep,
            accessType,
            allowedCategories
        } = req.body;

        if (!clientName) {
            return res.status(400).json({
                success: false,
                message: 'Nome do cliente é obrigatório'
            });
        }

        // 🆕 NOVA VALIDAÇÃO DE EMAIL
        if (!clientEmail || clientEmail.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Email do cliente é obrigatório'
            });
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(clientEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Email inválido'
            });
        }

        if (!salesRep || salesRep.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Sales Rep é obrigatório'
            });
        }

        // Gerar código único de 4 dígitos
        let code;
        let codeExists = true;
        let attempts = 0;

        // Usar código enviado ou gerar novo
        if (req.body.code) {
            code = req.body.code;
            codeExists = await AccessCode.findOne({ code });

            // Se o código enviado já existe, gerar novo
            if (codeExists) {
                while (codeExists && attempts < 100) {
                    code = Math.floor(1000 + Math.random() * 9000).toString();
                    codeExists = await AccessCode.findOne({ code });
                    attempts++;
                }
            }
        } else {
            // Se não foi enviado código, gerar novo
            while (codeExists && attempts < 100) {
                code = Math.floor(1000 + Math.random() * 9000).toString();
                codeExists = await AccessCode.findOne({ code });
                attempts++;
            }
        }

        if (codeExists) {
            return res.status(500).json({
                success: false,
                message: 'Não foi possível gerar código único'
            });
        }

        const accessCode = new AccessCode({
            code,
            clientName,
            clientEmail,
            clientPhone,
            companyName,
            addressLine1,
            addressLine2,
            city,
            state,
            zipCode,
            salesRep,
            allowedCategories,
            showPrices: req.body.showPrices !== false,
            createdBy: req.user.username
        });

        await accessCode.save();

        res.json({
            success: true,
            message: 'Código criado com sucesso',
            accessCode
        });

    } catch (error) {
        console.error('Erro ao criar código:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar código'
        });
    }
});

// ===== ROTAS CRUD COMPLETAS PARA ACCESS CODES =====

// Atualizar código de acesso
router.put('/access-codes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            clientName,
            clientEmail,
            clientPhone,
            companyName,
            addressLine1,
            addressLine2,
            city,
            state,
            zipCode,
            salesRep,
            allowedCategories,
            isActive
        } = req.body;

        console.log(`✏️ Atualizando código: ${id}`);

        // Validações
        // Buscar o cliente existente para verificar o accessType
        const existingClient = await AccessCode.findById(id);
        if (!clientName || (existingClient?.accessType !== 'special' && (!allowedCategories || allowedCategories.length === 0))) {
            return res.status(400).json({
                success: false,
                message: 'Nome do cliente e categorias são obrigatórios'
            });
        }

        // 🆕 ADICIONAR AQUI - VALIDAÇÃO DE EMAIL
        if (!clientEmail || clientEmail.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Email do cliente é obrigatório'
            });
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(clientEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Email inválido'
            });
        }

        // Atualizar no banco
        const updatedCode = await AccessCode.findByIdAndUpdate(
            id,
            {
                clientName: clientName.trim(),
                clientEmail: clientEmail ? clientEmail.trim() : undefined,
                clientPhone: clientPhone ? clientPhone.trim() : undefined,
                companyName: companyName ? companyName.trim() : undefined,
                addressLine1: addressLine1 ? addressLine1.trim() : undefined,
                addressLine2: addressLine2 ? addressLine2.trim() : undefined,
                city: city ? city.trim() : undefined,
                state: state ? state.trim() : undefined,
                zipCode: zipCode ? zipCode.trim() : undefined,
                salesRep: salesRep ? salesRep.trim() : undefined,
                allowedCategories,
                isActive: isActive !== false, // Default true
                showPrices: req.body.showPrices !== false,
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        );
        if (!updatedCode) {
            return res.status(404).json({
                success: false,
                message: 'Código não encontrado'
            });
        }

        console.log(`✅ Código ${updatedCode.code} atualizado com sucesso`);

        res.json({
            success: true,
            message: 'Código atualizado com sucesso',
            accessCode: updatedCode
        });

    } catch (error) {
        console.error('❌ Erro ao atualizar código:', error);

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Dados inválidos: ' + Object.values(error.errors).map(e => e.message).join(', ')
            });
        }

        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Toggle status ativo/inativo
router.patch('/access-codes/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        console.log(`🔄 Toggle status código: ${id} → ${isActive ? 'ATIVAR' : 'DESATIVAR'}`);

        // Buscar código atual (aceita _id ou code)
        let accessCode;

        // Se tem 24 caracteres, é ObjectId MongoDB
        if (id.length === 24) {
            accessCode = await AccessCode.findById(id);
        } else {
            // Caso contrário, busca pelo código de 4 dígitos
            accessCode = await AccessCode.findOne({ code: id });
        }

        if (!accessCode) {
            return res.status(404).json({
                success: false,
                message: 'Código não encontrado'
            });
        }

        // ===== VERIFICAR PENDÊNCIAS ANTES DE ATIVAR =====
        if (!accessCode.isActive && isActive) { // Tentando ATIVAR
            console.log('🔍 Verificando pendências antes de ativar...');

            // Importar o modelo Selection
            const Selection = require('../models/Selection');

            // Verificar se tem QUALQUER seleção pendente (excluindo deletadas)
            const pendingSelection = await Selection.findOne({
                clientCode: accessCode.code,
                status: 'pending',
                $or: [
                    { isDeleted: { $exists: false } },
                    { isDeleted: false }
                ]
            });

            if (pendingSelection) {
                console.log(`❌ Bloqueado: Cliente tem seleção pendente`);
                return res.status(400).json({
                    success: false,
                    message: `Client has pending selection (${pendingSelection.selectionId}). Please approve or cancel it before reactivating.`,
                    pendingSelection: pendingSelection.selectionId
                });
            }

            // Verificar se tem categorias (para clientes normais)
            if (accessCode.accessType === 'normal' && (!accessCode.allowedCategories || accessCode.allowedCategories.length === 0)) {
                console.log('❌ Bloqueado: Cliente sem categorias configuradas');
                return res.status(400).json({
                    success: false,
                    message: 'Configure as categorias antes de ativar o cliente. Use o botão Edit.'
                });
            }

            console.log('✅ Sem pendências - pode ativar');
        }
        // ===== FIM DA VERIFICAÇÃO =====

        // Atualizar status
        accessCode.isActive = isActive;
        accessCode.updatedAt = new Date();

        await accessCode.save();

        console.log(`✅ Código ${accessCode.code} ${isActive ? 'ativado' : 'desativado'} com sucesso`);

        res.json({
            success: true,
            message: `Código ${isActive ? 'ativado' : 'desativado'} com sucesso`,
            accessCode
        });

    } catch (error) {
        console.error('❌ Erro ao alterar status:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Deletar código de acesso
router.delete('/access-codes/:id', async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`🗑️ Deletando código: ${id}`);

        // Buscar código antes de deletar
        const accessCode = await AccessCode.findById(id);

        if (!accessCode) {
            return res.status(404).json({
                success: false,
                message: 'Código não encontrado'
            });
        }

        // Verificar se código está sendo usado ativamente
        // TODO: Implementar verificação de uso ativo (carrinho, sessão, etc.)

        // Deletar código
        await AccessCode.findByIdAndDelete(id);

        console.log(`✅ Código ${accessCode.code} deletado com sucesso`);

        res.json({
            success: true,
            message: 'Código deletado com sucesso',
            deletedCode: accessCode.code
        });

    } catch (error) {
        console.error('❌ Erro ao deletar código:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Verificar se código é único (para validação)
router.get('/access-codes/check-unique', async (req, res) => {
    try {
        const { code, exclude } = req.query;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Código é obrigatório'
            });
        }

        // Construir query
        const query = { code };
        if (exclude) {
            query._id = { $ne: exclude };
        }

        // Verificar se código já existe
        const existingCode = await AccessCode.findOne(query);

        res.json({
            success: true,
            isUnique: !existingCode,
            code
        });

    } catch (error) {
        console.error('❌ Erro ao verificar código único:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Buscar código específico com detalhes completos
router.get('/access-codes/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Buscar por ID ou por código
        const accessCode = await AccessCode.findOne({
            $or: [
                { _id: id },
                { code: id }
            ]
        });

        if (!accessCode) {
            return res.status(404).json({
                success: false,
                message: 'Código não encontrado'
            });
        }

        // Calcular estatísticas adicionais
        const stats = {
            daysUntilExpiry: Math.ceil((accessCode.expiresAt - new Date()) / (1000 * 60 * 60 * 24)),
            isExpired: accessCode.expiresAt < new Date(),
            daysSinceCreated: Math.ceil((new Date() - accessCode.createdAt) / (1000 * 60 * 60 * 24)),
            daysSinceLastUsed: accessCode.lastUsed ?
                Math.ceil((new Date() - accessCode.lastUsed) / (1000 * 60 * 60 * 24)) : null
        };

        res.json({
            success: true,
            accessCode,
            statistics: stats
        });

    } catch (error) {
        console.error('❌ Erro ao buscar código:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// ===== NOVA ROTA PARA BUSCAR FOLDERS COM QB ITEMS =====
// Buscar folders/categorias para seleção de cliente
router.get('/folders-search', authenticateToken, async (req, res) => {
    try {
        const { query } = req.query;
        const PhotoCategory = require('../models/PhotoCategory');

        // Se query muito curta, retornar vazio
        if (!query || query.length < 2) {
            return res.json({ success: true, results: [] });
        }

        console.log('🔍 Buscando folders com query:', query);

        // Buscar categorias que correspondem
        const categories = await PhotoCategory.find({
            $or: [
                { qbItem: { $regex: query, $options: 'i' } },
                { displayName: { $regex: query, $options: 'i' } },
                { folderName: { $regex: query, $options: 'i' } }
            ],
            isActive: true,
            photoCount: { $gt: 0 }
        })
            .limit(20)
            .select('qbItem displayName folderName photoCount googleDrivePath');

        console.log(`✅ Encontradas ${categories.length} categorias`);

        // Formatar resultados
        const results = categories.map(cat => ({
            qbItem: cat.qbItem || `TEMP-${cat._id.toString().slice(-4)}`,
            path: cat.getCleanDisplayName() || cat.folderName,
            fullPath: cat.googleDrivePath,
            photoCount: cat.photoCount || 0,
            hasQB: !!cat.qbItem
        }));

        res.json({ success: true, results });

    } catch (error) {
        console.error('❌ Folder search error:', error);
        res.status(500).json({
            success: false,
            message: 'Error searching folders'
        });
    }
});

// ===== ROTA PARA TREE VIEW HIERÁRQUICA =====
// Expandida para incluir tanto categorias de fotos quanto de catálogo
// MANTÉM a estrutura original de PhotoCategory, apenas adiciona nível pai
router.get('/categories-tree', authenticateToken, async (req, res) => {
    try {
        const PhotoCategory = require('../models/PhotoCategory');
        const UnifiedProductComplete = require('../models/UnifiedProductComplete');
        const CatalogProduct = require('../models/CatalogProduct');
        const { MAIN_CATEGORY_MAPPING } = require('../config/categoryMapping');

        console.log('Building categories tree (photos + catalog)...');

        // ========================================
        // 1. BUSCAR DADOS DE FOTOS (PhotoCategory)
        // ========================================
        const photoCategories = await PhotoCategory.find({
            isActive: true
        }).select('displayName qbItem googleDrivePath');

        console.log(`Found ${photoCategories.length} photo categories`);

        // Contar fotos disponíveis para cada categoria
        const photoCategoriesWithCounts = await Promise.all(
            photoCategories.map(async (cat) => {
                const availableCount = await UnifiedProductComplete.countDocuments({
                    category: cat.displayName,
                    status: 'available',
                    isActive: true
                });
                return {
                    displayName: cat.displayName,
                    qbItem: cat.qbItem,
                    googleDrivePath: cat.googleDrivePath,
                    photoCount: availableCount
                };
            })
        );

        // ========================================
        // 2. BUSCAR DADOS DE CATÁLOGO (CatalogProduct)
        // ========================================
        const catalogCounts = await CatalogProduct.aggregate([
            { $match: { isActive: true, availableStock: { $gt: 0 } } },
            {
                $group: {
                    _id: '$displayCategory',
                    stockCount: { $sum: 1 },
                    totalStock: { $sum: '$availableStock' }
                }
            }
        ]);

        const catalogCountMap = {};
        catalogCounts.forEach(item => {
            if (item._id) {
                catalogCountMap[item._id] = {
                    count: item.stockCount,
                    totalStock: item.totalStock
                };
            }
        });

        console.log(`Found catalog counts for ${Object.keys(catalogCountMap).length} categories`);

        // ========================================
        // 3. CONSTRUIR ÁRVORE
        // ========================================
        const tree = {};

        // ========================================
        // 3A. NATURAL COWHIDES - Mantém estrutura original de fotos
        // ========================================
        // Agrupar PhotoCategories pelo PRIMEIRO segmento do displayName
        // Ex: "Brazil Best Sellers → ..." vai para "Brazil Best Sellers"
        const naturalCowhidesConfig = MAIN_CATEGORY_MAPPING['Natural Cowhides'];
        const validPhotoFirstSegments = ['Brazil Best Sellers', 'Brazil Top Selected Categories', 'Colombian Cowhides'];

        // Filtrar apenas fotos que pertencem a Natural Cowhides
        const naturalCowhidesPhotos = photoCategoriesWithCounts.filter(pc => {
            if (!pc.displayName) return false;
            const firstSegment = pc.displayName.split(' → ')[0];
            return validPhotoFirstSegments.includes(firstSegment);
        });

        let naturalCowhidesTotalPhotos = 0;

        // Criar nó pai Natural Cowhides
        tree['Natural Cowhides'] = {
            name: 'Natural Cowhides',
            fullPath: 'Natural Cowhides',
            type: 'photo',
            description: naturalCowhidesConfig.description,
            children: {},
            photoCount: 0,
            stockCount: 0,
            qbItem: null,
            catalogCategory: null
        };

        // Agrupar por primeiro segmento (Brazil Best Sellers, Brazil Top Selected Categories, Colombian)
        const photosByFirstSegment = {};
        for (const pc of naturalCowhidesPhotos) {
            const segments = pc.displayName.split(' → ');
            const firstSegment = segments[0];

            if (!photosByFirstSegment[firstSegment]) {
                photosByFirstSegment[firstSegment] = [];
            }
            photosByFirstSegment[firstSegment].push(pc);
        }

        // Para cada primeiro segmento, criar a hierarquia
        for (const [firstSegment, photos] of Object.entries(photosByFirstSegment)) {
            // Calcular total de fotos para este segmento
            const segmentTotalPhotos = photos.reduce((sum, pc) => sum + pc.photoCount, 0);
            naturalCowhidesTotalPhotos += segmentTotalPhotos;

            // Verificar se é Brazil Best Sellers (tem Mix & Match)
            const hasMixMatch = firstSegment === 'Brazil Best Sellers';

            // Criar nó do primeiro segmento (ex: Brazil Best Sellers)
            tree['Natural Cowhides'].children[firstSegment] = {
                name: firstSegment,
                fullPath: `Natural Cowhides → ${firstSegment}`,
                type: 'photo',
                children: {},
                qbItem: null,
                catalogCategory: null,
                photoCount: segmentTotalPhotos,
                stockCount: 0,
                hasAvailablePhotos: segmentTotalPhotos > 0,
                hasMixMatch: hasMixMatch
            };

            // Construir árvore hierárquica para os segmentos restantes
            for (const pc of photos) {
                const segments = pc.displayName.split(' → ');

                // Começar do segundo segmento (já temos o primeiro como nó pai)
                let currentLevel = tree['Natural Cowhides'].children[firstSegment].children;

                for (let i = 1; i < segments.length; i++) {
                    const segmentName = segments[i];
                    const isLastSegment = i === segments.length - 1;

                    // Construir fullPath até este segmento
                    const pathParts = ['Natural Cowhides', ...segments.slice(0, i + 1)];
                    const segmentFullPath = pathParts.join(' → ');

                    if (!currentLevel[segmentName]) {
                        currentLevel[segmentName] = {
                            name: segmentName,
                            fullPath: isLastSegment ? pc.displayName : segmentFullPath,
                            type: 'photo',
                            children: {},
                            qbItem: isLastSegment ? pc.qbItem : null,
                            catalogCategory: null,
                            photoCount: isLastSegment ? pc.photoCount : 0,
                            stockCount: 0,
                            hasAvailablePhotos: isLastSegment ? pc.photoCount > 0 : false
                        };
                    } else if (isLastSegment) {
                        // Se já existe e é último, atualizar dados
                        currentLevel[segmentName].qbItem = pc.qbItem;
                        currentLevel[segmentName].photoCount = pc.photoCount;
                        currentLevel[segmentName].fullPath = pc.displayName;
                        currentLevel[segmentName].hasAvailablePhotos = pc.photoCount > 0;
                    }

                    // Se não é último, acumular contagem nos pais
                    if (!isLastSegment) {
                        currentLevel[segmentName].photoCount = (currentLevel[segmentName].photoCount || 0) + pc.photoCount;
                        if (pc.photoCount > 0) {
                            currentLevel[segmentName].hasAvailablePhotos = true;
                        }
                    }

                    currentLevel = currentLevel[segmentName].children;
                }
            }
        }

        tree['Natural Cowhides'].photoCount = naturalCowhidesTotalPhotos;

        // ========================================
        // 3B. OUTRAS CATEGORIAS DE FOTOS (Specialty, Patchwork com fotos)
        // ========================================
        // Cowhide with Binding
        const cowhideBindingPhotos = photoCategoriesWithCounts.filter(pc =>
            pc.displayName && pc.displayName.includes('Cowhide with Binding')
        );

        // Rodeo Rugs
        const rodeoRugsPhotos = photoCategoriesWithCounts.filter(pc =>
            pc.displayName && pc.displayName.includes('Rodeo Rugs')
        );

        // Sheepskin (mixed - tem fotos E stock)
        const sheepskinPhotos = photoCategoriesWithCounts.filter(pc =>
            pc.displayName && pc.displayName.includes('Sheepskin')
        );

        // ========================================
        // 3C. CATEGORIAS DE CATÁLOGO (Stock)
        // ========================================
        // Iterar sobre as categorias principais que TÊM stock
        const stockMainCategories = ['Specialty Cowhides', 'Small Accent Hides', 'Patchwork Rugs', 'Accessories', 'Furniture'];

        for (const mainName of stockMainCategories) {
            const mainConfig = MAIN_CATEGORY_MAPPING[mainName];
            if (!mainConfig) continue;

            let mainPhotoCount = 0;
            let mainStockCount = 0;

            tree[mainName] = {
                name: mainName,
                fullPath: mainName,
                type: mainConfig.type,
                description: mainConfig.description,
                children: {},
                photoCount: 0,
                stockCount: 0,
                qbItem: null,
                catalogCategory: null
            };

            for (const sub of mainConfig.subcategories) {
                const subFullPath = `${mainName} → ${sub.name}`;

                if (sub.type === 'photo') {
                    // Subcategoria de foto dentro de categoria mista
                    let matchingPhotos = [];
                    if (sub.photoCategoryPath === 'Cowhide with Binding') {
                        matchingPhotos = cowhideBindingPhotos;
                    } else if (sub.photoCategoryPath === 'Rodeo Rugs') {
                        matchingPhotos = rodeoRugsPhotos;
                    }

                    const subPhotoCount = matchingPhotos.reduce((sum, pc) => sum + pc.photoCount, 0);
                    mainPhotoCount += subPhotoCount;

                    tree[mainName].children[sub.name] = {
                        name: sub.name,
                        fullPath: subFullPath,
                        type: 'photo',
                        children: {},
                        qbItem: matchingPhotos[0]?.qbItem || null,
                        catalogCategory: null,
                        photoCount: subPhotoCount,
                        stockCount: 0,
                        hasAvailablePhotos: subPhotoCount > 0
                    };

                    // Adicionar hierarquia de fotos
                    for (const pc of matchingPhotos) {
                        const segments = pc.displayName.split(' → ');
                        if (segments.length > 1) {
                            let currentLevel = tree[mainName].children[sub.name].children;
                            for (let i = 1; i < segments.length; i++) {
                                const segName = segments[i];
                                const isLast = i === segments.length - 1;

                                if (!currentLevel[segName]) {
                                    currentLevel[segName] = {
                                        name: segName,
                                        fullPath: isLast ? pc.displayName : `${subFullPath} → ${segments.slice(1, i + 1).join(' → ')}`,
                                        type: 'photo',
                                        children: {},
                                        qbItem: isLast ? pc.qbItem : null,
                                        catalogCategory: null,
                                        photoCount: isLast ? pc.photoCount : 0,
                                        stockCount: 0,
                                        hasAvailablePhotos: isLast ? pc.photoCount > 0 : false
                                    };
                                }
                                currentLevel = currentLevel[segName].children;
                            }
                        }
                    }

                } else if (sub.type === 'stock') {
                    // Subcategoria de stock puro
                    const catalogData = catalogCountMap[sub.catalogCategory] || { count: 0, totalStock: 0 };
                    mainStockCount += catalogData.count;

                    tree[mainName].children[sub.name] = {
                        name: sub.name,
                        fullPath: subFullPath,
                        type: 'stock',
                        children: {},
                        qbItem: null,
                        catalogCategory: sub.catalogCategory,
                        photoCount: 0,
                        stockCount: catalogData.count,
                        totalStock: catalogData.totalStock,
                        hasAvailableStock: catalogData.count > 0
                    };

                } else if (sub.type === 'mixed') {
                    // Subcategoria mista (foto + stock)
                    let matchingPhotos = [];
                    if (sub.photoCategoryPath === 'Sheepskin') {
                        matchingPhotos = sheepskinPhotos;
                    }

                    const subPhotoCount = matchingPhotos.reduce((sum, pc) => sum + pc.photoCount, 0);
                    const catalogData = catalogCountMap[sub.catalogCategory] || { count: 0, totalStock: 0 };

                    mainPhotoCount += subPhotoCount;
                    mainStockCount += catalogData.count;

                    tree[mainName].children[sub.name] = {
                        name: sub.name,
                        fullPath: subFullPath,
                        type: 'mixed',
                        children: {},
                        qbItem: matchingPhotos[0]?.qbItem || null,
                        catalogCategory: sub.catalogCategory,
                        photoCount: subPhotoCount,
                        stockCount: catalogData.count,
                        totalStock: catalogData.totalStock,
                        hasAvailablePhotos: subPhotoCount > 0,
                        hasAvailableStock: catalogData.count > 0
                    };

                    // Adicionar hierarquia de fotos para mixed
                    for (const pc of matchingPhotos) {
                        const segments = pc.displayName.split(' → ');
                        if (segments.length > 1) {
                            let currentLevel = tree[mainName].children[sub.name].children;
                            for (let i = 1; i < segments.length; i++) {
                                const segName = segments[i];
                                const isLast = i === segments.length - 1;

                                if (!currentLevel[segName]) {
                                    currentLevel[segName] = {
                                        name: segName,
                                        fullPath: isLast ? pc.displayName : `${subFullPath} → ${segments.slice(1, i + 1).join(' → ')}`,
                                        type: 'photo',
                                        children: {},
                                        qbItem: isLast ? pc.qbItem : null,
                                        catalogCategory: null,
                                        photoCount: isLast ? pc.photoCount : 0,
                                        stockCount: 0,
                                        hasAvailablePhotos: isLast ? pc.photoCount > 0 : false
                                    };
                                }
                                currentLevel = currentLevel[segName].children;
                            }
                        }
                    }
                }
            }

            tree[mainName].photoCount = mainPhotoCount;
            tree[mainName].stockCount = mainStockCount;
        }

        console.log(`Tree built with ${Object.keys(tree).length} main categories`);

        res.json({
            success: true,
            tree,
            meta: {
                totalMainCategories: Object.keys(tree).length,
                totalPhotoCategories: photoCategories.length,
                totalCatalogCategories: catalogCounts.length
            }
        });

    } catch (error) {
        console.error('Tree build error:', error);
        res.status(500).json({
            success: false,
            message: 'Error building categories tree'
        });
    }
});

// ===== MAPEAR QB ITEMS PARA DISPLAY NAMES =====
router.post('/map-categories', authenticateToken, async (req, res) => {
    try {
        const { items } = req.body;
        const PhotoCategory = require('../models/PhotoCategory');

        const startTime = Date.now();

        // Função para normalizar strings (aspas e espaços)
        const normalizeString = (str) => {
            if (!str) return '';
            return str
                .replace(/[""″]/g, '"')  // Normalizar aspas curvas para retas
                .replace(/[''′]/g, "'")  // Normalizar apóstrofes
                .replace(/\s+/g, ' ')     // Normalizar espaços múltiplos
                .trim();
        };

        // Separar items em QB codes e categorias
        const qbCodes = [];
        const categoryPaths = [];

        items.forEach(item => {
            const clean = normalizeString(item);

            // QB codes começam com números
            if (/^\d/.test(clean)) {
                qbCodes.push(clean);
            } else {
                categoryPaths.push(clean);
            }
        });

        // Buscar AMBOS os tipos
        const allCategories = [];

        // 1. Buscar por QB codes (se houver)
        if (qbCodes.length > 0) {
            const allVariations = new Set();
            qbCodes.forEach(item => {
                allVariations.add(item);
                allVariations.add(item.replace(/\s+/g, ''));
                if (/^\d+[A-Z]{2,}/.test(item)) {
                    const withSpace = item.replace(/(\d+[A-Z])([A-Z]+)/, '$1 $2');
                    allVariations.add(withSpace);
                }
            });

            const qbCategories = await PhotoCategory.find({
                qbItem: { $in: Array.from(allVariations) }
            }).select('qbItem displayName googleDrivePath photoCount');

            allCategories.push(...qbCategories);
        }

        // 2. Buscar por paths de categoria (se houver)
        if (categoryPaths.length > 0) {
            // Criar queries para buscar categorias
            const orConditions = [];

            categoryPaths.forEach(path => {
                const normalized = normalizeString(path);

                // Converter → para /
                const withSlash = normalized.replace(/\s*→\s*/g, '/');

                // Criar AMBAS as versões: com e sem espaço após barra
                const withoutSpaces = withSlash.replace(/\/\s+/g, '/').replace(/\s+\//g, '/');
                const withSpaceAfterSlash = withSlash.replace(/\//g, '/ ').replace(/\/\s+\//g, '/'); // Mantém espaço

                // Versões com e sem barra final para TODAS as variações
                [withSlash, withoutSpaces, withSpaceAfterSlash].forEach(variant => {
                    const withTrailing = variant.endsWith('/') ? variant : variant + '/';
                    const withoutTrailing = variant.replace(/\/$/, '');

                    orConditions.push(
                        { displayName: variant },
                        { displayName: withTrailing },
                        { displayName: withoutTrailing },
                        { googleDrivePath: withTrailing },
                        { googleDrivePath: withoutTrailing }
                    );
                });
            });

            const pathCategories = await PhotoCategory.find({
                $or: orConditions
            }).select('qbItem displayName googleDrivePath photoCount');

            allCategories.push(...pathCategories);
        }

        // Criar mapa para lookup rápido com strings normalizadas
        const categoryMap = new Map();

        allCategories.forEach(cat => {
            // Mapear por displayName normalizado
            if (cat.displayName) {
                const normalizedDisplay = normalizeString(cat.displayName);
                categoryMap.set(normalizedDisplay, cat);
            }

            // Mapear por qbItem
            if (cat.qbItem) {
                categoryMap.set(cat.qbItem, cat);
            }
        });

        // Mapear resultados mantendo a ordem original
        const mapped = items.map(item => {
            const normalized = normalizeString(item);

            // Buscar no mapa
            const category = categoryMap.get(normalized);

            if (category) {
                return {
                    original: item,
                    qbItem: category.qbItem || 'NO-QB',
                    displayName: category.displayName || item,
                    path: category.googleDrivePath || '',
                    photoCount: category.photoCount || 0
                };
            } else {
                console.log(`⚠️ Não encontrado: ${item} (normalizado: ${normalized})`);
                return {
                    original: item,
                    qbItem: 'NO-QB',
                    displayName: item,
                    path: '',
                    photoCount: 0
                };
            }
        });

        console.log(`✅ Mapeamento completo em ${Date.now() - startTime}ms`);
        console.log(`📊 Com QB: ${mapped.filter(m => m.qbItem !== 'NO-QB').length}/${mapped.length}`);

        res.json({
            success: true,
            mapped: mapped  // Voltar para 'mapped' que o frontend espera
        });

    } catch (error) {
        console.error('❌ Error mapping categories:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== ATUALIZAR CATEGORIAS PERMITIDAS DO CLIENTE =====
router.put('/clients/:clientId/categories', authenticateToken, async (req, res) => {
    try {
        const { clientId } = req.params;
        const { allowedCategories, showPrices, fullAccess } = req.body;

        console.log(`📁 Updating categories for client ${clientId}:`);
        console.log(`   - ${allowedCategories.length} categories`);
        console.log(`   - showPrices: ${showPrices}`);
        console.log(`   - fullAccess: ${fullAccess}`);

        const client = await AccessCode.findByIdAndUpdate(
            clientId,
            {
                allowedCategories: allowedCategories,
                showPrices: showPrices,
                fullAccess: fullAccess !== undefined ? fullAccess : false,  // NOVO
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Client not found'
            });
        }

        // CRITICAL: Invalidate the client's permissions cache
        // This ensures the client gets the new permissions on next login/refresh
        const ClientPermissionsCache = require('../models/ClientPermissionsCache');
        await ClientPermissionsCache.deleteOne({ clientCode: client.code });
        console.log(`🗑️ Permissions cache invalidated for client ${client.code}`);

        console.log(`✅ Categories updated for ${client.clientName}`);
        res.json({
            success: true,
            client,
            message: `${allowedCategories.length} categories saved`
        });

    } catch (error) {
        console.error('❌ Error updating categories:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating categories'
        });
    }
});

// Estatísticas gerais dos códigos
router.get('/access-codes-stats', async (req, res) => {
    try {
        // Agregação para estatísticas
        const stats = await AccessCode.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    active: {
                        $sum: {
                            $cond: [{ $eq: ['$isActive', true] }, 1, 0]
                        }
                    },
                    inactive: {
                        $sum: {
                            $cond: [{ $eq: ['$isActive', false] }, 1, 0]
                        }
                    },
                    totalUsage: { $sum: '$usageCount' },
                    averageUsage: { $avg: '$usageCount' }
                }
            }
        ]);

        // Categoria mais usada
        const categoryStats = await AccessCode.aggregate([
            { $unwind: '$allowedCategories' },
            { $group: { _id: '$allowedCategories', count: { $sum: '$usageCount' } } },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);

        const result = {
            ...(stats[0] || { total: 0, active: 0, inactive: 0, totalUsage: 0, averageUsage: 0 }),
            mostUsedCategory: categoryStats[0] ? categoryStats[0]._id : null,
            timestamp: new Date()
        };

        res.json({
            success: true,
            statistics: result
        });

    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// ===== GET CLIENT'S SHOPPING CART =====
router.get('/client/:code/cart', authenticateToken, async (req, res) => {
    try {
        const { code } = req.params;
        const Cart = require('../models/Cart');
        const PhotoCategory = require('../models/PhotoCategory');

        console.log(`🛒 Fetching cart for client ${code}...`);

        // Find active cart for client
        const cart = await Cart.findOne({
            clientCode: code,
            'items.0': { $exists: true } // Only return if has items
        }).sort({ createdAt: -1 }); // Most recent first

        if (!cart) {
            return res.json({
                success: true,
                cart: null,
                message: 'No active cart found'
            });
        }

        // Calculate remaining time and format data
        const now = new Date();

        // ✅ FILTRAR GHOST ITEMS
        const validItems = cart.items.filter(item =>
            !item.ghostStatus || item.ghostStatus !== 'ghost'
        );

        // 🆕 AGREGAR POR CATEGORIA para resumo
        // Separar: fotos únicas por categoria, catálogo por qbItem
        const categoryMap = new Map();

        for (const item of validItems) {
            let groupKey;
            let displayCategory;

            if (item.isCatalogProduct) {
                // Produtos de catálogo: agrupar por qbItem
                groupKey = `catalog_${item.qbItem || item.productName || item.fileName}`;
                displayCategory = item.productName || item.fileName || item.category || 'Catalog Product';
            } else {
                // Fotos únicas: agrupar por categoria (path)
                groupKey = item.category || 'Uncategorized';
                displayCategory = item.category || 'Uncategorized';
            }

            if (!categoryMap.has(groupKey)) {
                categoryMap.set(groupKey, {
                    category: displayCategory,
                    groupKey: groupKey,
                    isCatalogProduct: item.isCatalogProduct || false,
                    qbItemFromItem: item.qbItem || null,
                    items: [],
                    count: 0
                });
            }
            const cat = categoryMap.get(groupKey);
            cat.items.push(item);
            cat.count += item.quantity || 1;
        }

        // 🆕 BUSCAR INFO DE PREÇO/TIER para cada categoria
        const categorySummary = [];

        for (const [groupKey, catData] of categoryMap) {
            const categoryPath = catData.category;

            // Para produtos de catálogo, usar dados do próprio item
            if (catData.isCatalogProduct) {
                const firstItem = catData.items[0];
                const totalValue = catData.items.reduce((sum, item) =>
                    sum + ((item.unitPrice || item.price || 0) * (item.quantity || 1)), 0);

                categorySummary.push({
                    category: categoryPath,
                    groupKey: groupKey,
                    shortName: categoryPath,
                    qbItem: catData.qbItemFromItem || '',
                    count: catData.count,
                    basePrice: firstItem?.unitPrice || firstItem?.price || 0,
                    currentPrice: firstItem?.unitPrice || firstItem?.price || 0,
                    totalValue: totalValue,
                    currentTier: null,
                    nextTier: null,
                    allTiers: [],
                    isCatalogProduct: true,
                    items: catData.items.map(item => ({
                        r2Key: item.r2Key || item.driveFileId || item.thumbnailUrl,
                        name: item.productName || item.fileName || item.name || 'Unnamed',
                        price: item.unitPrice || item.price || 0,
                        quantity: item.quantity || 1,
                        thumbnailUrl: item.thumbnailUrl
                    }))
                });
                continue;
            }

            // Para fotos únicas: buscar info de preço/tier
            // Normalizar path para busca (converter " → " para "/")
            const normalizedPath = categoryPath.replace(/ → /g, '/').replace(/\/$/, '');

            // Buscar categoria no banco
            const photoCategory = await PhotoCategory.findOne({
                $or: [
                    { displayName: { $regex: normalizedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
                    { googleDrivePath: { $regex: normalizedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
                ],
                isActive: true
            });

            // Extrair info de pricing
            let qbItem = '';
            let basePrice = 0;
            let priceRanges = [];
            let currentTier = null;
            let nextTier = null;
            let currentPrice = 0;

            if (photoCategory) {
                qbItem = photoCategory.qbItem || '';
                basePrice = photoCategory.basePrice || 0;

                // Buscar regra VOLUME
                const volumeRule = photoCategory.discountRules?.find(r =>
                    r.clientCode === 'VOLUME' && r.isActive
                );

                if (volumeRule && volumeRule.priceRanges?.length > 0) {
                    priceRanges = volumeRule.priceRanges.sort((a, b) => a.min - b.min);

                    // Encontrar tier atual baseado na quantidade
                    for (let i = 0; i < priceRanges.length; i++) {
                        const tier = priceRanges[i];
                        const tierMax = tier.max || Infinity;

                        if (catData.count >= tier.min && catData.count <= tierMax) {
                            currentTier = {
                                index: i + 1,
                                min: tier.min,
                                max: tier.max,
                                price: tier.price
                            };
                            currentPrice = tier.price;

                            // Próximo tier
                            if (i < priceRanges.length - 1) {
                                const next = priceRanges[i + 1];
                                nextTier = {
                                    index: i + 2,
                                    min: next.min,
                                    price: next.price,
                                    itemsNeeded: next.min - catData.count
                                };
                            }
                            break;
                        }
                    }

                    // Se não encontrou tier, usar o maior disponível
                    if (!currentTier && priceRanges.length > 0) {
                        const lastTier = priceRanges[priceRanges.length - 1];
                        if (catData.count >= lastTier.min) {
                            currentTier = {
                                index: priceRanges.length,
                                min: lastTier.min,
                                max: lastTier.max,
                                price: lastTier.price
                            };
                            currentPrice = lastTier.price;
                        }
                    }
                }

                // Fallback para basePrice
                if (!currentPrice) {
                    currentPrice = basePrice;
                }
            }

            // Mostrar caminho completo para melhor identificação
            const shortName = categoryPath || 'Unknown Category';

            categorySummary.push({
                category: categoryPath,
                groupKey: groupKey,
                shortName: shortName,
                qbItem: qbItem,
                count: catData.count,
                basePrice: basePrice,
                currentPrice: currentPrice,
                totalValue: catData.count * currentPrice,
                currentTier: currentTier,
                nextTier: nextTier,
                allTiers: priceRanges.map((t, i) => ({
                    tier: i + 1,
                    min: t.min,
                    max: t.max,
                    price: t.price
                })),
                isCatalogProduct: false,
                // 🆕 ITEMS para expandir com thumbnails
                items: catData.items.map(item => ({
                    r2Key: item.r2Key || item.driveFileId,
                    name: item.name || item.fileName || 'Unnamed',
                    price: item.price || currentPrice || 0
                }))
            });
        }

        // Ordenar: fotos únicas primeiro, depois catálogo, ambos por nome
        categorySummary.sort((a, b) => {
            if (a.isCatalogProduct && !b.isCatalogProduct) return 1;
            if (!a.isCatalogProduct && b.isCatalogProduct) return -1;
            return a.shortName.localeCompare(b.shortName);
        });

        const cartData = {
            _id: cart._id,
            clientCode: cart.clientCode,
            clientName: cart.clientName,
            createdAt: cart.createdAt,
            lastActivity: cart.lastActivity,
            totalItems: validItems.length,
            // 🆕 RESUMO POR CATEGORIA
            categorySummary: categorySummary,
            items: validItems.map(item => {
                const expiresIn = item.expiresAt ?
                    Math.round((new Date(item.expiresAt) - now) / 1000 / 60) : null;

                return {
                    r2Key: item.r2Key || item.driveFileId,
                    name: item.name || item.fileName || 'Unnamed',
                    price: item.price || 0,
                    category: item.category || '',
                    subcategory: item.subcategory || '',
                    addedAt: item.addedAt,
                    expiresAt: item.expiresAt,
                    expiresInMinutes: expiresIn,
                    isExpired: expiresIn !== null && expiresIn <= 0
                };
            }),
            totalValue: validItems.reduce((sum, item) => sum + (item.price || 0), 0)
        };

        console.log(`✅ Cart found: ${cartData.totalItems} items, ${categorySummary.length} categories`);
        res.json({
            success: true,
            cart: cartData
        });

    } catch (error) {
        console.error('❌ Error fetching cart:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching cart data'
        });
    }
});

// ===== EXTEND CART TIME - VERSÃO SINCRONIZADA =====
router.post('/client/:code/cart/extend', authenticateToken, async (req, res) => {
    try {
        const { code } = req.params;
        const { hours } = req.body;

        // Validação básica
        if (!hours || hours <= 0 || hours > 120) {
            return res.status(400).json({
                success: false,
                message: 'Invalid hours value (must be between 1 and 120)'
            });
        }

        console.log(`⏰ Requisição para estender carrinho ${code} por ${hours} horas`);

        // Usar a nova função centralizada que sincroniza tudo
        const result = await CartService.extendCartTime(
            code,
            hours,
            req.user.username || 'admin'
        );

        // Verificar se houve inconsistência
        if (!result.consistent) {
            console.warn(`⚠️ Extensão teve inconsistências para cliente ${code}`);
            // Você pode adicionar aqui um email de alerta ou log especial
        }

        res.json({
            success: true,
            message: `Cart extended by ${hours} hours successfully`,
            details: {
                newExpiration: result.newExpiration,
                cartItemsUpdated: result.cartItemsUpdated,
                productsUpdated: result.productsUpdated,
                consistent: result.consistent
            }
        });

        // Log para auditoria
        console.log(`✅ Carrinho ${code} estendido com sucesso:`, {
            hours: hours,
            newExpiration: result.newExpiration,
            itemsAffected: result.cartItemsUpdated,
            extendedBy: req.user.username
        });

    } catch (error) {
        console.error('❌ Erro ao estender carrinho:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error extending cart time'
        });
    }
});

// ===== ENDPOINT DE STATUS DO SYNC =====
router.get('/sync-status', authenticateToken, async (req, res) => {
    try {
        const db = mongoose.connection.db;

        // Verificar lock atual
        const lock = await db.collection('sync_locks').findOne({ _id: 'cde_sync' });

        // Buscar último log de sync (se você implementar logs)
        const lastSync = await db.collection('sync_logs')
            .findOne({}, { sort: { timestamp: -1 } });

        // Calcular próximo sync
        const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES) || 5;
        const nextSync = new Date(Date.now() + intervalMinutes * 60000);

        res.json({
            success: true,
            status: {
                syncEnabled: process.env.ENABLE_CDE_SYNC === 'true',
                mode: process.env.SYNC_MODE || 'not-set',
                instanceId: process.env.SYNC_INSTANCE_ID,
                intervalMinutes: intervalMinutes,
                environment: process.env.NODE_ENV
            },
            lock: lock ? {
                lockedBy: lock.lockedBy,
                lockedAt: lock.lockedAt,
                expiresAt: lock.expiresAt,
                isExpired: new Date() > new Date(lock.expiresAt)
            } : null,
            lastSync: lastSync,
            nextSync: process.env.ENABLE_CDE_SYNC === 'true' ? nextSync : null,
            businessHours: {
                timezone: process.env.SYNC_TIMEZONE,
                start: process.env.SYNC_BUSINESS_START,
                end: process.env.SYNC_BUSINESS_END
            }
        });
    } catch (error) {
        console.error('Error getting sync status:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching sync status'
        });
    }
});

// ===== REMOVER LOCK MANUALMENTE (EMERGÊNCIA) =====
router.delete('/sync-lock', authenticateToken, async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const result = await db.collection('sync_locks').deleteOne({ _id: 'cde_sync' });

        res.json({
            success: true,
            message: result.deletedCount > 0 ? 'Lock removido' : 'Nenhum lock encontrado'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error removing lock'
        });
    }
});

// Exportar clientes para CSV (Constant Contact)
router.get('/export-clients-csv', authenticateToken, async (req, res) => {
    try {
        const AccessCode = require('../models/AccessCode');

        // Buscar clientes ativos com email
        const clients = await AccessCode.find({
            isActive: true,
            clientEmail: { $exists: true, $ne: '', $ne: null, $regex: /@/ }
        }).select('clientName clientEmail code').sort({ clientName: 1 });

        // Criar CSV
        let csv = 'First Name,Last Name,Email Address,Access Code\n';

        clients.forEach(client => {
            const [firstName, ...lastNameParts] = client.clientName.split(' ');
            const lastName = lastNameParts.join(' ') || '';

            // Escapar vírgulas e aspas
            const escapeCsv = (str) => {
                if (str.includes(',') || str.includes('"')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };

            csv += `${escapeCsv(firstName)},${escapeCsv(lastName)},${client.clientEmail},${client.code}\n`;
        });

        // Enviar CSV
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=sunshine-clients.csv');
        res.send(csv);

        console.log(`📊 [ADMIN] CSV exportado com ${clients.length} clientes`);

    } catch (error) {
        console.error('❌ [ADMIN] Erro ao exportar CSV:', error);
        res.status(500).json({ success: false, message: 'Erro ao exportar CSV' });
    }
});

// Contar clientes com email
router.get('/clients-with-email-count', authenticateToken, async (req, res) => {
    try {
        const count = await AccessCode.countDocuments({
            isActive: true,
            clientEmail: { $exists: true, $ne: '', $ne: null, $regex: /@/ }
        });

        res.json({ success: true, count });

    } catch (error) {
        console.error('❌ [ADMIN] Erro ao contar clientes:', error);
        res.status(500).json({ success: false, message: 'Erro ao contar clientes' });
    }
});

module.exports = router;