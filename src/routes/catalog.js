// src/routes/catalog.js - Stub para funcionalidade futura
const express = require('express');
const router = express.Router();

// Placeholder - funcionalidade de catálogo será implementada no futuro
router.get('/products', (req, res) => {
    res.json({ success: true, products: [], message: 'Catalog not implemented yet' });
});

router.get('/categories', (req, res) => {
    res.json({ success: true, categories: [], message: 'Catalog not implemented yet' });
});

module.exports = router;
