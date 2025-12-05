// src/routes/intelligence.js
const express = require('express');
const router = express.Router();
const AIAssistant = require('../ai/AIAssistant');

const assistant = new AIAssistant();

// Chat endpoint
router.post('/chat', async (req, res) => {
    try {
        const { question } = req.body;
        
        if (!question) {
            return res.status(400).json({ 
                error: 'Question is required' 
            });
        }
        
        console.log('💬 Pergunta recebida:', question);
        
        const response = await assistant.processQuery(question);
        
        res.json({ 
            success: true,
            response 
        });
    } catch (error) {
        console.error('❌ Erro no chat:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Métricas em tempo real
router.get('/metrics', async (req, res) => {
    try {
        const metrics = await assistant.getMetrics();
        res.json({
            success: true,
            ...metrics
        });
    } catch (error) {
        console.error('❌ Erro nas métricas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;