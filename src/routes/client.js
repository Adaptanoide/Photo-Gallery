// src/routes/client.js

const express = require('express');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');

const router = express.Router();

// Listar produtos disponíveis por categoria (temporário)
router.get('/products/:category', async (req, res) => {
    try {
        const { category } = req.params;

        const products = await UnifiedProductComplete.find({
            category: { $regex: category, $options: 'i' },
            status: 'available'
        }).limit(20);

        res.json({
            success: true,
            products,
            category
        });

    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar produtos'
        });
    }
});

module.exports = router;
