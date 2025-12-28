//src/routes/auth.js

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Admin = require('../models/Admin');
const AccessCode = require('../models/AccessCode');
const { getAllowedCatalogCategories, VALID_CATALOG_CATEGORIES } = require('../config/categoryMapping');

const router = express.Router();

// Login do administrador
router.post('/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validação básica
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Usuário e senha são obrigatórios'
            });
        }

        // Buscar admin no banco
        const admin = await Admin.findOne({
            username: username.toLowerCase(),
            isActive: true
        });

        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }

        // Verificar senha
        const isPasswordValid = await admin.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }

        // Atualizar último login
        admin.lastLogin = new Date();
        await admin.save();

        // Gerar JWT
        const token = jwt.sign(
            {
                id: admin._id,
                username: admin.username,
                role: admin.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Login realizado com sucesso',
            token,
            user: {
                id: admin._id,
                username: admin.username,
                email: admin.email,
                role: admin.role,
                lastLogin: admin.lastLogin
            }
        });

    } catch (error) {
        console.error('Erro no login admin:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Verificação de código de acesso do cliente
router.post('/client/verify', async (req, res) => {
    try {
        const { code } = req.body;

        // Validação básica
        if (!code || !/^\d{4}$/.test(code)) {
            return res.status(400).json({
                success: false,
                message: 'Código deve ter exatamente 4 dígitos'
            });
        }

        // Buscar código de acesso
        const accessCode = await AccessCode.findOne({
            code: code,
            isActive: true,
        });

        if (!accessCode) {
            return res.status(401).json({
                success: false,
                message: 'Código inválido ou expirado'
            });
        }

        // Atualizar uso do código
        accessCode.usageCount += 1;
        accessCode.lastUsed = new Date();
        await accessCode.save();


        // INÍCIO DO NOVO CÓDIGO - Calcular permissões no login
        if (accessCode.allowedCategories && accessCode.allowedCategories.length > 0) {
            console.log('🔐 Calculando permissões para cache...');
            const startTime = Date.now();

            const PhotoCategory = require('../models/PhotoCategory');
            const ClientPermissionsCache = require('../models/ClientPermissionsCache');
            const allowedPaths = new Set();

            // Buscar TODOS os PhotoCategory de uma vez
            const allQBItems = accessCode.allowedCategories.filter(item => /\d/.test(item));
            const categories = await PhotoCategory.find({
                qbItem: { $in: allQBItems }
            });

            // Criar mapa para lookup rápido
            const categoryMap = new Map();
            categories.forEach(cat => {
                categoryMap.set(cat.qbItem, cat);
            });

            // Processar paths
            for (const item of accessCode.allowedCategories) {
                const isQBItem = /\d/.test(item);

                if (isQBItem) {
                    const cat = categoryMap.get(item);
                    if (cat && cat.googleDrivePath) {
                        const pathParts = cat.googleDrivePath.split('/').filter(p => p);

                        if (pathParts[0]) {
                            allowedPaths.add(pathParts[0]);
                            allowedPaths.add(pathParts[0] + '/');
                        }
                        if (pathParts[1]) {
                            const subPath = pathParts[0] + '/' + pathParts[1];
                            allowedPaths.add(subPath);
                            allowedPaths.add(subPath + '/');
                        }
                        if (pathParts[2]) {
                            const fullPath = pathParts[0] + '/' + pathParts[1] + '/' + pathParts[2];
                            allowedPaths.add(fullPath);
                            allowedPaths.add(fullPath + '/');
                        }
                        allowedPaths.add(cat.googleDrivePath);
                    }
                } else {
                    allowedPaths.add(item);
                    allowedPaths.add(item + '/');
                }
            }

            // Salvar no cache
            await ClientPermissionsCache.findOneAndUpdate(
                { clientCode: accessCode.code },
                {
                    clientCode: accessCode.code,
                    allowedPaths: Array.from(allowedPaths),
                    processedAt: new Date(),
                    expiresAt: new Date(Date.now() + 30 * 60 * 1000)
                },
                { upsert: true, new: true }
            );

            console.log(`✅ Cache de permissões criado em ${Date.now() - startTime}ms`);
        }
        // FIM DO NOVO CÓDIGO

        // ========== CRIAR TOKEN JWT PARA CLIENTE ==========
        const token = jwt.sign(
            {
                clientCode: accessCode.code,
                clientName: accessCode.clientName,
                accessType: accessCode.accessType || 'normal',
                type: 'client' // Para diferenciar de admin
            },
            process.env.JWT_SECRET,
            { expiresIn: '4h' } // Cliente tem 4 horas de sessão
        );

        console.log(`🔐 Token criado para cliente ${accessCode.clientName} (${accessCode.code})`);
        console.log(`   AccessType: ${accessCode.accessType || 'normal'}`);
        // ========== FIM DO NOVO CÓDIGO ==========

        res.json({
            success: true,
            message: 'Código verificado com sucesso',
            token: token,
            client: {
                name: accessCode.clientName,
                email: accessCode.clientEmail,
                code: accessCode.code,
                accessType: accessCode.accessType || 'normal',
                showPrices: accessCode.showPrices
            },
            allowedCategories: accessCode.allowedCategories
        });

    } catch (error) {
        console.error('Erro na verificação do código:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Buscar dados do cliente logado - VERSÃO R2
router.get('/client/data', async (req, res) => {
    try {
        const { code } = req.query;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Código de acesso necessário'
            });
        }

        // Buscar dados do cliente
        const accessCode = await AccessCode.findOne({
            code: code,
            isActive: true
        });

        if (!accessCode) {
            return res.status(404).json({
                success: false,
                message: 'Código inválido ou expirado'
            });
        }

        console.log(`🔑 Cliente ${accessCode.clientName} (${code}) conectado`);

        // NOVO: Buscar categorias do R2
        const StorageService = require('../services/StorageService');
        const PhotoCategory = require('../models/PhotoCategory');
        let r2Categories = [];

        try {
            const result = await StorageService.getSubfolders('');
            // FILTRAR pastas que começam com _ 
            r2Categories = result.folders.filter(f => !f.name.startsWith('_')) || [];
            console.log(`📂 ${r2Categories.length} categorias válidas no R2`);
        } catch (error) {
            console.error('❌ Erro ao buscar categorias do R2:', error);
        }

        // ============================================
        // VERIFICAR SE TEM ACESSO TOTAL (FULLACCESS)
        // ============================================
        const hasFullAccess = accessCode.fullAccess === true;

        if (hasFullAccess) {
            console.log('🌟 Cliente tem FULL ACCESS - acesso a TODAS as categorias (incluindo novas)!');
        }

        // Processar categorias permitidas
        let allowedCategories = [];

        if (hasFullAccess) {
            // FULL ACCESS: Retornar TODAS as categorias (incluindo novas)
            allowedCategories = r2Categories.map(cat => ({
                id: cat.name,
                name: cat.name
            }));
            console.log(`🌟 FULL ACCESS: ${allowedCategories.length} categorias disponíveis`);
        } else if (accessCode.allowedCategories && accessCode.allowedCategories.length > 0) {
            // NOVO: Usar cache ao invés de fazer 105 queries
            const ClientPermissionsCache = require('../models/ClientPermissionsCache');

            let allowedPaths = new Set();

            // Buscar do cache
            const cached = await ClientPermissionsCache.findOne({
                clientCode: code,
                expiresAt: { $gt: new Date() }
            });

            if (cached && cached.allowedPaths) {
                console.log('📦 Usando cache de permissões em /client/data');
                allowedPaths = new Set(cached.allowedPaths);
            } else {
                // Se não tem cache (não deveria acontecer), calcular
                console.log('⚠️ Cache não encontrado em /client/data, recalculando...');

                // Buscar todas as categorias de uma vez
                const PhotoCategory = require('../models/PhotoCategory');
                const qbItems = accessCode.allowedCategories.filter(item => /\d/.test(item));

                if (qbItems.length > 0) {
                    const categories = await PhotoCategory.find({
                        qbItem: { $in: qbItems }
                    });

                    for (const cat of categories) {
                        if (cat.googleDrivePath) {
                            const pathParts = cat.googleDrivePath.split('/').filter(p => p);
                            if (pathParts[0]) allowedPaths.add(pathParts[0]);
                            if (pathParts[1]) allowedPaths.add(pathParts[0] + '/' + pathParts[1]);
                            if (pathParts[2]) allowedPaths.add(pathParts[0] + '/' + pathParts[1] + '/' + pathParts[2]);
                        }
                    }
                }

                // Adicionar categorias diretas
                accessCode.allowedCategories.forEach(item => {
                    if (!/\d/.test(item)) {
                        allowedPaths.add(item);
                    }
                });

                // Salvar no cache para próxima vez
                await ClientPermissionsCache.findOneAndUpdate(
                    { clientCode: code },
                    {
                        clientCode: code,
                        allowedPaths: Array.from(allowedPaths),
                        processedAt: new Date(),
                        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
                    },
                    { upsert: true, new: true }
                );
            }

            // Filtrar apenas categorias permitidas
            allowedCategories = r2Categories
                .filter(cat => allowedPaths.has(cat.name))
                .map(cat => ({
                    id: cat.name,
                    name: cat.name
                }));

            console.log(`🔐 Filtrando: ${allowedCategories.length} de ${r2Categories.length} categorias`);
        } else {
            // Sem restrições - mostrar todas (exceto _)
            allowedCategories = r2Categories.map(cat => ({
                id: cat.name,
                name: cat.name
            }));
        }

        console.log(`✅ ${allowedCategories.length} categorias permitidas para o cliente`);

        // ============================================
        // CALCULAR CATEGORIAS DE CATÁLOGO PERMITIDAS
        // ============================================
        let allowedCatalogCategories = [];

        if (hasFullAccess) {
            // FULL ACCESS: TODAS as categorias de catálogo
            allowedCatalogCategories = VALID_CATALOG_CATEGORIES;
            console.log(`🌟 FULL ACCESS: todas ${allowedCatalogCategories.length} categorias de catálogo`);
        } else if (accessCode.allowedCategories && accessCode.allowedCategories.length > 0) {
            // Converter Set para Array
            const catalogCatsSet = getAllowedCatalogCategories(accessCode.allowedCategories);
            allowedCatalogCategories = Array.from(catalogCatsSet);

            // Debug: mostrar o que foi salvo vs o que foi calculado
            const stockItems = accessCode.allowedCategories.filter(c => !/\d/.test(c));
            console.log(`📦 ${allowedCatalogCategories.length} categorias de catálogo permitidas:`, allowedCatalogCategories);
            console.log(`📋 Items de stock salvos:`, stockItems);
        } else {
            // Sem restrições = todas permitidas
            allowedCatalogCategories = VALID_CATALOG_CATEGORIES;
            console.log(`📦 Sem restrições - todas ${allowedCatalogCategories.length} categorias de catálogo permitidas`);
        }

        // ============================================
        // EXTRAIR QB ITEMS E PATHS PARA VERIFICAÇÃO DE FOTOS
        // ============================================
        let allowedQBItems = [];
        let allowedPhotoPaths = new Set();  // Paths das fotos (para subcategorias)

        if (hasFullAccess) {
            // Full access: buscar TODOS os QB Items e paths
            const PhotoCategory = require('../models/PhotoCategory');
            const allPhotos = await PhotoCategory.find({}, 'qbItem folderName googleDrivePath');
            allowedQBItems = allPhotos.map(p => p.qbItem).filter(qb => qb);
            // Adicionar todos os paths
            allPhotos.forEach(p => {
                if (p.folderName) allowedPhotoPaths.add(p.folderName);
                if (p.googleDrivePath) {
                    const parts = p.googleDrivePath.split('/').filter(x => x);
                    parts.forEach(part => allowedPhotoPaths.add(part));
                }
            });
        } else if (accessCode.allowedCategories && accessCode.allowedCategories.length > 0) {
            // Filtrar apenas QB Items (começam com dígito)
            const qbItems = accessCode.allowedCategories.filter(item => /^\d/.test(item));
            allowedQBItems = qbItems;

            // Buscar os paths correspondentes aos QB Items
            if (qbItems.length > 0) {
                const PhotoCategory = require('../models/PhotoCategory');
                const photos = await PhotoCategory.find(
                    { qbItem: { $in: qbItems } },
                    'qbItem folderName googleDrivePath'
                );
                photos.forEach(p => {
                    if (p.folderName) allowedPhotoPaths.add(p.folderName);
                    if (p.googleDrivePath) {
                        const parts = p.googleDrivePath.split('/').filter(x => x);
                        parts.forEach(part => allowedPhotoPaths.add(part));
                    }
                });
            }
        }

        console.log(`📸 ${allowedQBItems.length} QB Items permitidos`);
        console.log(`📁 ${allowedPhotoPaths.size} photo paths permitidos`);

        res.json({
            success: true,
            client: {
                name: accessCode.clientName,
                email: accessCode.clientEmail,
                code: accessCode.code,
                showPrices: accessCode.showPrices,
                fullAccess: accessCode.fullAccess || false
            },
            allowedCategories: allowedCategories,
            allowedCatalogCategories: allowedCatalogCategories,
            allowedQBItems: allowedQBItems,  // QB Items para verificação
            allowedPhotoPaths: Array.from(allowedPhotoPaths),  // NOVO: Paths de fotos permitidos
            totalCategories: r2Categories.length,
            allowedCount: allowedCategories.length
        });

    } catch (error) {
        console.error('Erro ao buscar dados do cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Criar admin inicial (rota especial para setup)
router.post('/admin/setup', async (req, res) => {
    try {
        // Verificar se já existe admin
        const existingAdmin = await Admin.findOne();

        if (existingAdmin) {
            return res.status(409).json({
                success: false,
                message: 'Sistema já configurado'
            });
        }

        const { username, email, password } = req.body;

        // Validações
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Todos os campos são obrigatórios'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Senha deve ter pelo menos 6 caracteres'
            });
        }

        // Criar admin
        const admin = new Admin({
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password,
            role: 'super_admin'
        });

        await admin.save();

        res.json({
            success: true,
            message: 'Administrador criado com sucesso',
            admin: {
                id: admin._id,
                username: admin.username,
                email: admin.email,
                role: admin.role
            }
        });

    } catch (error) {
        console.error('Erro ao criar admin:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Usuário ou email já existe'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// DEBUG: Verificar dados do AccessCode (TEMPORÁRIO)
router.get('/debug/accesscode/:code', async (req, res) => {
    try {
        const { code } = req.params;

        const accessCode = await AccessCode.findOne({ code });

        if (!accessCode) {
            return res.json({
                success: false,
                message: 'Código não encontrado',
                code
            });
        }

        res.json({
            success: true,
            accessCode: {
                code: accessCode.code,
                clientName: accessCode.clientName,
                clientEmail: accessCode.clientEmail,
                allowedCategories: accessCode.allowedCategories,
                isActive: accessCode.isActive,
                createdAt: accessCode.createdAt,
                usageCount: accessCode.usageCount,
                lastUsed: accessCode.lastUsed
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar AccessCode',
            error: error.message
        });
    }
});

// Middleware para verificar JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Token de acesso requerido'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Token inválido ou expirado'
            });
        }

        req.user = user;
        next();
    });
};

// Verificar se o token é válido
router.get('/verify-token', authenticateToken, async (req, res) => {
    try {
        const admin = await Admin.findById(req.user.id).select('-password');

        if (!admin || !admin.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não encontrado ou inativo'
            });
        }

        res.json({
            success: true,
            user: {
                id: admin._id,
                username: admin.username,
                email: admin.email,
                role: admin.role
            }
        });

    } catch (error) {
        console.error('Erro na verificação do token:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Exportar middleware para uso em outras rotas
router.authenticateToken = authenticateToken;

module.exports = router;