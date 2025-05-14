// routes/photos.js
const express = require('express');
const router = express.Router();
const photoController = require('../controllers/photoController');

// Obter fotos (com filtro opcional por categoria)
router.get('/', photoController.getPhotos);

// Obter estrutura de categorias
router.get('/categories', photoController.getCategories);

module.exports = router;