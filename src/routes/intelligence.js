// src/routes/intelligence.js
const express = require('express');
const router = express.Router();
const AIAssistant = require('../ai/AIAssistant');
const AITrainingRule = require('../models/AITrainingRule');

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

/* Métricas em tempo real
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
}); */ 

// Salvar regra de treinamento
router.post('/training-rules', async (req, res) => {
    try {
        const rule = new AITrainingRule(req.body);
        await rule.save();
        res.json({ success: true, rule });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Buscar todas as regras
router.get('/training-rules', async (req, res) => {
    try {
        const rules = await AITrainingRule.find().sort({ createdAt: -1 });
        res.json({ success: true, rules });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Atualizar uma regra
router.put('/training-rules/:id', async (req, res) => {
    try {
        const rule = await AITrainingRule.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json({ success: true, rule });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Deletar uma regra
router.delete('/training-rules/:id', async (req, res) => {
    try {
        await AITrainingRule.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;