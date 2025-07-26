// src/routes/admin.js
const express = require('express');
const mongoose = require('mongoose');
const AccessCode = require('../models/AccessCode');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const { authenticateToken } = require('./auth');

const router = express.Router();

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
        const { clientName, clientEmail, allowedCategories, expiresInDays = 30 } = req.body;
        
        if (!clientName || !allowedCategories || allowedCategories.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Nome do cliente e categorias são obrigatórios'
            });
        }
        
        // Gerar código único de 4 dígitos
        let code;
        let codeExists = true;
        let attempts = 0;
        
        while (codeExists && attempts < 100) {
            code = Math.floor(1000 + Math.random() * 9000).toString();
            codeExists = await AccessCode.findOne({ code });
            attempts++;
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
            allowedCategories,
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

module.exports = router;