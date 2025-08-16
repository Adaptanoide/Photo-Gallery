// src/routes/storage.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const StorageService = require('../services/StorageService');

// Configurar multer para upload em memória
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas imagens são permitidas'));
        }
    }
});

// Status do sistema
router.get('/status', (req, res) => {
    res.json({
        success: true,
        mode: StorageService.getCurrentMode(),
        isR2: StorageService.isUsingR2(),
        r2Url: process.env.R2_PUBLIC_URL || 'Não configurado'
    });
});

// Upload de foto
router.post('/upload', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Nenhum arquivo enviado'
            });
        }
        
        const { folder = '' } = req.body;
        
        console.log(`📤 Upload: ${req.file.originalname} para ${folder || '/'}`);
        
        const result = await StorageService.uploadFile(
            req.file.buffer,
            req.file.originalname,
            folder
        );
        
        res.json({
            success: true,
            ...result,
            url: result.publicUrl || result.webViewLink
        });
        
    } catch (error) {
        console.error('❌ Erro no upload:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Listar pastas
router.get('/folders/:path?', async (req, res) => {
    try {
        const path = req.params.path || '';
        const result = await StorageService.getSubfolders(path);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Listar fotos
router.get('/photos/:path?', async (req, res) => {
    try {
        const path = req.params.path || '';
        const result = await StorageService.getPhotos(path);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
