//src/routes/auth.js

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Admin = require('../models/Admin');
const AccessCode = require('../models/AccessCode');

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
            expiresAt: { $gt: new Date() }
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

        // ========== NOVO: CRIAR TOKEN JWT PARA CLIENTE ==========
        const token = jwt.sign(
            {
                clientCode: accessCode.code,
                clientName: accessCode.clientName,
                accessType: accessCode.accessType || 'normal',
                specialSelectionId: accessCode.specialSelection?.selectionId || null,
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
            token: token,  // <-- ADICIONAR ESTA LINHA
            client: {
                name: accessCode.clientName,
                email: accessCode.clientEmail,
                code: accessCode.code,
                accessType: accessCode.accessType || 'normal'  // <-- ADICIONAR
            },
            allowedCategories: accessCode.allowedCategories,
            expiresAt: accessCode.expiresAt
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
            isActive: true,
            expiresAt: { $gt: new Date() }
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
        let r2Categories = [];

        try {
            const result = await StorageService.getSubfolders('');
            r2Categories = result.folders || [];
            console.log(`📂 ${r2Categories.length} categorias disponíveis no R2`);
        } catch (error) {
            console.error('❌ Erro ao buscar categorias do R2:', error);
        }

        // Converter allowedCategories (strings) para objetos e filtrar
        let allowedCategories = [];

        if (accessCode.allowedCategories && accessCode.allowedCategories.length > 0) {
            // Se tem categorias específicas, filtrar
            allowedCategories = accessCode.allowedCategories
                .map(cat => {
                    // Se é string, converter para objeto
                    if (typeof cat === 'string') {
                        // Verificar se existe no R2
                        const r2Cat = r2Categories.find(r2 =>
                            r2.name.toLowerCase() === cat.toLowerCase()
                        );

                        if (r2Cat) {
                            return {
                                id: r2Cat.name,  // Usar nome como ID para R2
                                name: r2Cat.name
                            };
                        }
                    }
                    return null;
                })
                .filter(cat => cat !== null);
        } else {
            // Se não tem restrições, mostrar todas do R2
            allowedCategories = r2Categories.map(cat => ({
                id: cat.name,
                name: cat.name
            }));
        }

        console.log(`✅ ${allowedCategories.length} categorias permitidas para o cliente`);

        // Atualizar último uso
        accessCode.lastUsed = new Date();
        accessCode.usageCount += 1;
        await accessCode.save();

        res.json({
            success: true,
            client: {
                name: accessCode.clientName,
                email: accessCode.clientEmail,
                code: accessCode.code
            },
            allowedCategories: allowedCategories,
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
                expiresAt: accessCode.expiresAt,
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

// CORREÇÃO: Atualizar categorias do AccessCode (TEMPORÁRIO)
router.post('/fix/accesscode/:code', async (req, res) => {
    try {
        const { code } = req.params;

        const accessCode = await AccessCode.findOne({ code });

        if (!accessCode) {
            return res.status(404).json({
                success: false,
                message: 'Código não encontrado'
            });
        }

        // Corrigir categorias para o cliente 7064
        if (code === '7064') {
            const oldCategories = [...accessCode.allowedCategories];

            accessCode.allowedCategories = [
                "1. Colombian Cowhides",
                "2. Brazil Best Sellers"
            ];

            await accessCode.save();

            return res.json({
                success: true,
                message: 'AccessCode 7064 corrigido com sucesso',
                changes: {
                    before: oldCategories,
                    after: accessCode.allowedCategories
                },
                accessCode: {
                    code: accessCode.code,
                    clientName: accessCode.clientName,
                    allowedCategories: accessCode.allowedCategories
                }
            });
        }

        res.json({
            success: false,
            message: 'Código não necessita correção ou não é suportado para correção automática'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erro ao corrigir AccessCode',
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