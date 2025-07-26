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

// Exportar middleware para uso em outras rotas
router.authenticateToken = authenticateToken;

module.exports = router;