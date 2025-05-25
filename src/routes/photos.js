// routes/photos.js - VERSÃO COMPLETA ATUALIZADA
const express = require('express');
const router = express.Router();
const photoController = require('../controllers/photoController');

// Rotas existentes
router.get('/', photoController.getPhotos);
router.get('/categories', photoController.getCategories);

// NOVAS ROTAS PARA GERENCIAMENTO LOCAL

// Servir imagens do disco local
router.get('/local/thumbnail/:photoId', photoController.serveLocalImage);
router.get('/local/:categoryId/:photoId', photoController.serveLocalImage);

// Rotas administrativas para gerenciamento de pastas (requerem autenticação admin)
router.use('/admin/*', (req, res, next) => {
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

module.exports = router;