// src/routes/catalog.js
// Catalog routes - Stub implementation for now

const express = require('express');
const router = express.Router();

// GET /api/catalog - List catalog products
router.get('/', async (req, res) => {
    res.json({
        success: true,
        message: 'Catalog API - not yet implemented',
        products: []
    });
});

// GET /api/catalog/:qbItem - Get single product
router.get('/:qbItem', async (req, res) => {
    res.json({
        success: false,
        message: 'Catalog product lookup not yet implemented'
    });
});

module.exports = router;
