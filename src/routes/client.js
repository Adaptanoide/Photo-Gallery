// routes/client.js
const express = require('express');
const router = express.Router();
const photoController = require('../controllers/photoController');

// Rota para dados iniciais do cliente
router.get('/initial-data', photoController.getClientInitialData);

// End point para limpeza de cache
router.post('/clear-cache', photoController.clearCache);

module.exports = router;