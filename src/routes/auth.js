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

        res.json({
            success: true,
            message: 'Código verificado com sucesso',
            client: {
                name: accessCode.clientName,
                email: accessCode.clientEmail,
                code: accessCode.code
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

// Buscar dados do cliente logado com categorias filtradas
router.get('/client/data', async (req, res) => {
    try {
        // Buscar código de acesso na sessão (simulado via query param para teste)
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

        // Buscar categorias do Google Drive
        let availableCategories = [];

        try {
            const drive = getGoogleDriveAuth();
            const parentFolderId = process.env.DRIVE_FOLDER_AVAILABLE || '1Ky3wSKKg_mmQihdxmiYwMuqE3-SBTcbx';

            const response = await drive.files.list({
                q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
                fields: 'files(id, name, modifiedTime)',
                orderBy: 'name'
            });

            availableCategories = response.data.files;

        } catch (driveError) {
            console.error('Erro ao buscar categorias do Drive:', driveError);
        }

        // Filtrar categorias permitidas para o cliente
        const allowedCategories = availableCategories.filter(category =>
            accessCode.allowedCategories.some(allowed =>
                category.name.toLowerCase().includes(allowed.toLowerCase()) ||
                allowed.toLowerCase().includes(category.name.toLowerCase())
            )
        );

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
            availableCategories: availableCategories,
            totalCategories: availableCategories.length,
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

// Função auxiliar para Google Drive (copiar do drive.js)
const { google } = require('googleapis');

const getGoogleDriveAuth = () => {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        },
        scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });

    return google.drive({ version: 'v3', auth });
};

// Exportar middleware para uso em outras rotas
router.authenticateToken = authenticateToken;

module.exports = router;