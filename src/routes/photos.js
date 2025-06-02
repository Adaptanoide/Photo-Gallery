// routes/photos.js - VERSÃO COMPLETA ATUALIZADA
const express = require('express');
const router = express.Router();
const photoController = require('../controllers/photoController');
const localStorageService = require('../services/localStorageService');
const localOrderService = require('../services/localOrderService');
const fs = require('fs');
router.get('/', photoController.getPhotos);
router.get('/categories', photoController.getCategories);

// Servir thumbnail
router.get('/local/thumbnail/:photoId', async (req, res) => {
  try {
    const { photoId } = req.params;
    console.log(`[Routes] Serving thumbnail for: ${photoId}`);
    
    const result = await localStorageService.serveImage(photoId, 'thumbnail');
    
    if (!result) {
      console.log(`[Routes] Thumbnail not found for: ${photoId}`);
      return res.status(404).send('Thumbnail not found');
    }
    
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(result.buffer);
  } catch (error) {
    console.error('Error serving thumbnail:', error);
    res.status(500).send('Error serving thumbnail');
  }
});

// Rota com categoryId (compatibilidade)
router.get('/local/:categoryId/:photoId', async (req, res) => {
  try {
    const { photoId } = req.params;
    console.log(`[Routes] Serving image with category for: ${photoId}`);
    
    const result = await localStorageService.serveImage(photoId, 'full');
    
    if (!result) {
      console.log(`[Routes] Image not found for: ${photoId}`);
      return res.status(404).send('Image not found');
    }
    
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(result.buffer);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).send('Error serving image');
  }
});

// Servir imagem em alta resolução
router.get('/local/image/:photoId', async (req, res) => {
  try {
    const { photoId } = req.params;
    console.log(`[Routes] Serving full image for: ${photoId}`);
    
    const result = await localStorageService.serveImage(photoId, 'full');
    
    if (!result) {
      console.log(`[Routes] Image not found for: ${photoId}`);
      return res.status(404).send('Image not found');
    }
    
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(result.buffer);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).send('Error serving image');
  }
});

// Rotas administrativas para gerenciamento de pastas (requerem autenticação admin)
router.use('/admin', (req, res, next) => {
  // Verificar se é admin - adapte conforme sua lógica de autenticação
  const adminToken = req.headers.authorization;
  if (!adminToken) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  // TODO: Validar token admin aqui
  next();
});

// Gerenciamento de estrutura de pastas
router.get('/admin/folder-structure', photoController.getFolderStructure);
router.post('/admin/folder/create', photoController.createFolder);
router.post('/admin/folder/delete', photoController.deleteFolder);
router.post('/admin/folder/rename', photoController.renameFolder);

// Gerenciamento de fotos
router.post('/admin/photo/move', photoController.movePhoto);
router.post('/admin/photo/delete', photoController.deletePhoto);

// routes/photos.js - ADICIONAR esta rota
router.post('/check-availability', async (req, res) => {
  try {
    const { photoIds } = req.body;
    
    if (!photoIds || !Array.isArray(photoIds)) {
      return res.status(400).json({ success: false, message: 'photoIds required' });
    }

    const results = {};
    
    for (const photoId of photoIds) {
      try {
        const sourcePath = await localOrderService.findPhotoPath(photoId);
        if (sourcePath) {
          await fs.promises.access(sourcePath);
          results[photoId] = { available: true };
        } else {
          results[photoId] = { available: false, reason: 'SOLD' };
        }
      } catch (error) {
        results[photoId] = { available: false, reason: 'SOLD' };
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;