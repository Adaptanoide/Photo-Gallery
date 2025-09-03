// src/routes/admin.js

const express = require('express');
const mongoose = require('mongoose');
const AccessCode = require('../models/AccessCode');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const { authenticateToken } = require('./auth');

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

// Listar códigos de acesso
router.get('/access-codes', async (req, res) => {
    try {
        const codes = await AccessCode.find()
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({
            success: true,
            codes
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
            accessType,  // <- ADICIONE ESTA LINHA
            allowedCategories,
            expiresInDays = 30
        } = req.body;

        if (!clientName) {
            return res.status(400).json({
                success: false,
                message: 'Nome do cliente é obrigatório'
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
            allowedCategories,
            showPrices: req.body.showPrices !== false,
            expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
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
            allowedCategories,
            expiresInDays,
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

        // Calcular nova data de expiração
        const expiresAt = new Date(Date.now() + (expiresInDays || 30) * 24 * 60 * 60 * 1000);

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
                allowedCategories,
                expiresAt,
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

        // Buscar código atual
        const accessCode = await AccessCode.findById(id);

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

            // Verificar se tem QUALQUER seleção pendente
            const pendingSelection = await Selection.findOne({
                clientCode: accessCode.code,
                status: 'pending'
            });

            if (pendingSelection) {
                const type = pendingSelection.selectionType === 'special' ? 'ESPECIAL' : 'REGULAR';
                console.log(`❌ Bloqueado: Cliente tem seleção ${type} pendente`);
                return res.status(400).json({
                    success: false,
                    message: `Cliente tem seleção ${type} pendente (${pendingSelection.selectionId}). Aprove ou cancele antes de reativar.`,
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
router.get('/categories-tree', authenticateToken, async (req, res) => {
    try {
        const PhotoCategory = require('../models/PhotoCategory');

        console.log('🌳 Building categories tree...');

        // Buscar todas as categorias ativas
        const categories = await PhotoCategory.find({
            isActive: true,
            photoCount: { $gt: 0 }
        }).select('displayName qbItem photoCount googleDrivePath');

        // Construir estrutura hierárquica
        const tree = {};

        categories.forEach(cat => {
            const path = cat.displayName || cat.googleDrivePath || '';
            const parts = path.split(' → ').filter(p => p);

            let current = tree;
            parts.forEach((part, index) => {
                if (!current[part]) {
                    current[part] = {
                        name: part,
                        fullPath: parts.slice(0, index + 1).join(' → '),
                        children: {},
                        qbItem: index === parts.length - 1 ? cat.qbItem : null,
                        photoCount: index === parts.length - 1 ? cat.photoCount : 0
                    };
                }
                current = current[part].children;
            });
        });

        console.log(`✅ Tree built with ${Object.keys(tree).length} root categories`);
        res.json({ success: true, tree });

    } catch (error) {
        console.error('❌ Tree build error:', error);
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

        console.log('🗺️ Mapeando categorias:', items);

        const mapped = [];

        for (const item of items) {
            // Limpar item (remover barra final se houver)
            const cleanItem = item.replace(/\/$/, '');

            // Verificar se é QB item (numérico ou com letras)
            if (/^\d+[A-Z]*$|^[A-Z]+\d+[A-Z]*$/i.test(cleanItem)) {
                // É um QB item, buscar por qbItem
                const category = await PhotoCategory.findOne({ qbItem: cleanItem });
                if (category) {
                    mapped.push({
                        original: item,
                        qbItem: category.qbItem,
                        displayName: category.displayName,
                        path: category.googleDrivePath
                    });
                } else {
                    mapped.push({
                        original: item,
                        qbItem: cleanItem,
                        displayName: cleanItem,
                        path: cleanItem
                    });
                }
            } else {
                // É um caminho/nome, buscar por googleDrivePath ou displayName
                const category = await PhotoCategory.findOne({
                    $or: [
                        { googleDrivePath: cleanItem },
                        { googleDrivePath: item },  // com barra
                        { displayName: cleanItem },
                        { displayName: item }
                    ]
                });

                // ADICIONE ESTE DEBUG:
                console.log('🔍 Buscando categoria:', item);
                console.log('📦 Categoria encontrada:', category ? {
                    displayName: category.displayName,
                    qbItem: category.qbItem,
                    googleDrivePath: category.googleDrivePath
                } : 'NÃO ENCONTRADA');

                if (category) {
                    mapped.push({
                        original: item,
                        qbItem: category.qbItem || 'NO-QB',
                        displayName: category.displayName,
                        path: category.googleDrivePath
                    });
                } else {
                    mapped.push({
                        original: item,
                        qbItem: 'NO-QB',
                        displayName: item,
                        path: item
                    });
                }
            }
        }

        console.log(`✅ Mapeadas ${mapped.length} categorias`);
        res.json({ success: true, mapped });

    } catch (error) {
        console.error('❌ Erro ao mapear categorias:', error);
        res.status(500).json({
            success: false,
            message: 'Error mapping categories'
        });
    }
});

// ===== ATUALIZAR CATEGORIAS PERMITIDAS DO CLIENTE =====
router.put('/clients/:clientId/categories', authenticateToken, async (req, res) => {
    try {
        const { clientId } = req.params;
        const { allowedCategories } = req.body;

        console.log(`📁 Updating categories for client ${clientId}:`, allowedCategories.length, 'categories');

        const client = await AccessCode.findByIdAndUpdate(
            clientId,
            {
                allowedCategories: allowedCategories,
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
        const now = new Date();

        // Agregação para estatísticas
        const stats = await AccessCode.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    active: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ['$isActive', true] }, { $gt: ['$expiresAt', now] }] },
                                1,
                                0
                            ]
                        }
                    },
                    inactive: {
                        $sum: {
                            $cond: [{ $eq: ['$isActive', false] }, 1, 0]
                        }
                    },
                    expired: {
                        $sum: {
                            $cond: [{ $lt: ['$expiresAt', now] }, 1, 0]
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
            ...(stats[0] || { total: 0, active: 0, inactive: 0, expired: 0, totalUsage: 0, averageUsage: 0 }),
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

module.exports = router;