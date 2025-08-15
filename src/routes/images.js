// src/routes/images.js

const express = require('express');
const router = express.Router();

/**
 * GET /api/images/thumb/:fileId
 * Redireciona para thumbnail do Google com cache headers
 */
router.get('/thumb/:fileId', (req, res) => {
    const { fileId } = req.params;

    // URL correta de thumbnail do Google Drive
    // Qualidade ALTA - 500px (antes era ~220px)
    const thumbUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;

    console.log(`🖼️ Thumbnail requisitada: ${fileId}`);

    // Headers para Cloudflare cachear por 7 dias
    res.set({
        'Cache-Control': 'public, max-age=604800',
        'Cloudflare-CDN-Cache-Control': 'max-age=604800'
    });

    // Redireciona para o Google
    res.redirect(thumbUrl);
});

/**
 * GET /api/images/full/:fileId
 * Redireciona para imagem completa
 */
router.get('/full/:fileId', (req, res) => {
    const { fileId } = req.params;

    // URL correta completa do Google Drive
    const fullUrl = `https://lh3.googleusercontent.com/d/${fileId}`;

    console.log(`📸 Imagem completa requisitada: ${fileId}`);

    // Headers para cache
    res.set({
        'Cache-Control': 'public, max-age=604800',
        'Cloudflare-CDN-Cache-Control': 'max-age=604800'
    });

    res.redirect(fullUrl);
});

// Rota de teste
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Sistema de cache de imagens funcionando!',
        exemplo_thumb: '/api/images/thumb/SEU_ID_AQUI',
        exemplo_full: '/api/images/full/SEU_ID_AQUI'
    });
});

module.exports = router;