// src/routes/intelligence.js - VERSÃO OTIMIZADA COM MONITORAMENTO
const express = require('express');
const router = express.Router();
const AIAssistant = require('../ai/AIAssistant');
const AITrainingRule = require('../models/AITrainingRule');
const ConnectionManager = require('../services/ConnectionManager');
const jwt = require('jsonwebtoken');
const AIConversation = require('../models/AIConversation');

// Configurações
const JWT_SECRET = process.env.JWT_SECRET || 'sunshine-ai-secret-2025';
const VALID_USERS = {
    'Andy': 'SUN1!'
};

// Instância do assistente
const assistant = new AIAssistant();

// Rate limiting simples
const requestCounts = new Map();
const RATE_LIMIT = 30; // 30 requests por minuto
const RATE_WINDOW = 60000; // 1 minuto

// ============================================
// INICIALIZAÇÃO DO SISTEMA
// ============================================

// Inicializar pool e cache ao carregar
(async function initializeSystem() {
    console.log('🚀 Initializing Sunshine Intelligence System...');

    try {
        // 1. Inicializar pool de conexões
        await assistant.cde.initializePool();
        console.log('✅ CDE Pool initialized');

        // 2. Testar conexão
        const isConnected = await assistant.cde.testConnection();
        if (isConnected) {
            console.log('✅ CDE Connection verified');

            // 3. Pre-aquecer cache com dados essenciais
            console.log('🔥 Warming up cache...');
            await ConnectionManager.executeWithCache(
                'totalInventory',
                () => assistant.cde.getTotalInventoryAnalysis(),
                30
            );
            await ConnectionManager.executeWithCache(
                'topProducts',
                () => assistant.cde.getTopSellingProducts(),
                60
            );
            console.log('✅ Cache warmed up');
        } else {
            console.warn('⚠️ CDE offline - starting in degraded mode');
        }

        console.log('🎯 System ready for Andy!');

    } catch (error) {
        console.error('❌ System initialization failed:', error);
        console.log('⚠️ Starting in limited mode - some features may be unavailable');
    }
})();

// ============================================
// MIDDLEWARES
// ============================================

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access denied - Please login first'
        });
    }

    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired - Please login again'
            });
        }
        return res.status(401).json({
            success: false,
            error: 'Invalid token'
        });
    }
};

// Middleware de rate limiting
const rateLimiter = (req, res, next) => {
    const userId = req.user?.username || req.ip;
    const now = Date.now();

    // Limpar contadores antigos
    for (const [key, data] of requestCounts.entries()) {
        if (now - data.windowStart > RATE_WINDOW) {
            requestCounts.delete(key);
        }
    }

    // Verificar rate limit
    const userCount = requestCounts.get(userId) || { count: 0, windowStart: now };

    if (now - userCount.windowStart > RATE_WINDOW) {
        userCount.count = 1;
        userCount.windowStart = now;
    } else {
        userCount.count++;
    }

    requestCounts.set(userId, userCount);

    if (userCount.count > RATE_LIMIT) {
        return res.status(429).json({
            success: false,
            error: `Rate limit exceeded. Max ${RATE_LIMIT} requests per minute.`
        });
    }

    next();
};

// ============================================
// ROTAS PÚBLICAS
// ============================================

// Health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'operational',
        timestamp: new Date().toISOString()
    });
});

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            error: 'Username and password are required'
        });
    }

    if (VALID_USERS[username] === password) {
        const token = jwt.sign(
            {
                username,
                loginTime: Date.now(),
                role: 'admin'
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log(`✅ User ${username} logged in`);

        res.json({
            success: true,
            token,
            expiresIn: '24h',
            user: username
        });
    } else {
        console.warn(`⚠️ Failed login attempt for ${username}`);
        res.status(401).json({
            success: false,
            error: 'Invalid credentials'
        });
    }
});

// Listar conversas
router.get('/conversations', authenticateToken, async (req, res) => {
    try {
        const conversations = await AIConversation.find({
            userId: req.user.username
        })
            .sort({ lastActivity: -1 })
            .limit(20)
            .select('title createdAt lastActivity');

        res.json({
            success: true,
            conversations
        });
    } catch (error) {
        console.error('Error loading conversations:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Criar nova conversa com título automático
router.post('/conversations', authenticateToken, async (req, res) => {
    try {
        // Gerar título baseado na hora
        const hour = new Date().getHours();
        let timeOfDay = 'Morning';
        if (hour >= 12 && hour < 17) timeOfDay = 'Afternoon';
        else if (hour >= 17) timeOfDay = 'Evening';

        const titles = [
            `${timeOfDay} Analysis`,
            `${timeOfDay} Check`,
            `Inventory ${timeOfDay}`,
            `Quick Review`,
            `Daily Check`
        ];

        const randomTitle = titles[Math.floor(Math.random() * titles.length)];

        const conversation = new AIConversation({
            userId: req.user.username,
            title: req.body.title || randomTitle
        });

        await conversation.save();

        res.json({
            success: true,
            conversation
        });
    } catch (error) {
        console.error('Error creating conversation:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ADICIONE rota para deletar
router.delete('/conversations/:id', authenticateToken, async (req, res) => {
    try {
        await AIConversation.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Conversation deleted'
        });
    } catch (error) {
        console.error('Error deleting conversation:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Carregar conversa específica
router.get('/conversations/:id', authenticateToken, async (req, res) => {
    try {
        const conversation = await AIConversation.findById(req.params.id);

        if (!conversation) {
            return res.status(404).json({
                success: false,
                error: 'Conversation not found'
            });
        }

        res.json({
            success: true,
            conversation
        });
    } catch (error) {
        console.error('Error loading conversation:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// ROTAS PROTEGIDAS - CHAT
// ============================================

// Chat endpoint com salvamento de conversa e TÍTULO AUTOMÁTICO
router.post('/chat', authenticateToken, rateLimiter, async (req, res) => {
    const startTime = Date.now();

    try {
        const { question, conversationId } = req.body;

        if (!question || question.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Question cannot be empty'
            });
        }

        // Buscar ou criar conversa
        let conversation;
        if (conversationId) {
            conversation = await AIConversation.findById(conversationId);
        }

        if (!conversation) {
            conversation = new AIConversation({
                userId: req.user.username,
                title: `New Chat`
            });
        }

        // Adicionar pergunta
        conversation.messages.push({
            role: 'user',
            content: question
        });

        // Processar resposta
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 30000)
        );

        const responsePromise = assistant.processQuery(question);
        const response = await Promise.race([responsePromise, timeoutPromise]);

        // Adicionar resposta
        conversation.messages.push({
            role: 'assistant',
            content: response
        });

        // GERAR TÍTULO AUTOMÁTICO na primeira mensagem
        if (conversation.messages.length === 2) { // Primeira pergunta + resposta
            try {
                // Criar título baseado na pergunta
                let autoTitle = 'Chat';

                // Análise simples da pergunta para gerar título
                const questionLower = question.toLowerCase();

                if (questionLower.includes('restock') || questionLower.includes('restocking')) {
                    autoTitle = 'Restock Analysis';
                } else if (questionLower.includes('top') && questionLower.includes('product')) {
                    autoTitle = 'Top Products';
                } else if (questionLower.includes('sales')) {
                    autoTitle = 'Sales Review';
                } else if (questionLower.includes('inventory')) {
                    autoTitle = 'Inventory Check';
                } else if (questionLower.includes('aging')) {
                    autoTitle = 'Aging Products';
                } else if (questionLower.includes('transit')) {
                    autoTitle = 'Transit Status';
                } else if (questionLower.includes('channel')) {
                    autoTitle = 'Channel Analysis';
                } else {
                    // Pegar primeiras 3 palavras significativas
                    const words = question.split(' ')
                        .filter(w => w.length > 3)
                        .slice(0, 3);
                    if (words.length > 0) {
                        autoTitle = words.join(' ').substring(0, 25);
                    }
                }

                conversation.title = autoTitle;
            } catch (err) {
                console.log('Could not generate title:', err);
                // Manter título padrão
            }
        }

        conversation.lastActivity = new Date();
        await conversation.save();

        const elapsed = Date.now() - startTime;

        res.json({
            success: true,
            response,
            conversationId: conversation._id,
            responseTime: elapsed
        });

    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`❌ Chat error after ${elapsed}ms:`, error.message);

        if (error.message === 'Request timeout') {
            return res.status(504).json({
                success: false,
                error: 'Request took too long. Please try a simpler question.'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to process question',
            message: error.message
        });
    }
});

// ============================================
// ROTAS DE STATUS E MONITORAMENTO
// ============================================

// Status dos serviços
router.get('/status', authenticateToken, (req, res) => {
    const fullStatus = ConnectionManager.getFullStatus();

    res.json({
        success: true,
        services: fullStatus.services,
        performance: fullStatus.performance,
        cache: {
            entries: fullStatus.cache.totalEntries,
            hitRate: `${fullStatus.performance.cacheHitRate}%`
        },
        message: fullStatus.message
    });
});

// Estatísticas de queries
router.get('/query-stats', authenticateToken, (req, res) => {
    const stats = assistant.cde.getQueryStats();

    res.json({
        success: true,
        totalQueries: stats.length,
        queries: stats.slice(0, 10), // Top 10 queries
        cacheInfo: ConnectionManager.getCacheInfo()
    });
});

// Limpar cache (admin only)
router.post('/cache/clear', authenticateToken, (req, res) => {
    const { key } = req.body;

    if (req.user.username !== 'Andy') {
        return res.status(403).json({
            success: false,
            error: 'Only Andy can clear cache'
        });
    }

    if (key) {
        ConnectionManager.clearCache(key);
        console.log(`🗑️ Cache cleared for key: ${key}`);
        res.json({
            success: true,
            message: `Cache cleared for "${key}"`
        });
    } else {
        ConnectionManager.clearCache();
        console.log('🗑️ All cache cleared');
        res.json({
            success: true,
            message: 'All cache cleared'
        });
    }
});

// Refresh cache
router.post('/cache/refresh', authenticateToken, async (req, res) => {
    try {
        console.log('🔄 Refreshing cache...');

        // Atualizar dados essenciais
        await ConnectionManager.executeWithCache(
            'totalInventory',
            () => assistant.cde.getTotalInventoryAnalysis(),
            30,
            true // Forçar refresh
        );

        await ConnectionManager.executeWithCache(
            'topProducts',
            () => assistant.cde.getTopSellingProducts(),
            60,
            true
        );

        res.json({
            success: true,
            message: 'Cache refreshed successfully'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to refresh cache'
        });
    }
});

// ============================================
// ROTAS DE TRAINING RULES
// ============================================

// Criar nova regra
router.post('/training-rules', authenticateToken, async (req, res) => {
    try {
        const { title, type, description } = req.body;

        if (!title || !type || !description) {
            return res.status(400).json({
                success: false,
                error: 'Title, type, and description are required'
            });
        }

        const rule = new AITrainingRule({
            ...req.body,
            createdBy: req.user.username
        });

        await rule.save();
        console.log(`📝 New training rule created: ${title}`);

        res.json({
            success: true,
            rule,
            message: 'Training rule saved successfully'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Listar regras
router.get('/training-rules', authenticateToken, async (req, res) => {
    try {
        const { type, applied } = req.query;

        let query = {};
        if (type) query.type = type;
        if (applied !== undefined) query.applied = applied === 'true';

        const rules = await AITrainingRule.find(query)
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({
            success: true,
            count: rules.length,
            rules
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Atualizar regra
router.put('/training-rules/:id', authenticateToken, async (req, res) => {
    try {
        const rule = await AITrainingRule.findById(req.params.id);

        if (!rule) {
            return res.status(404).json({
                success: false,
                error: 'Rule not found'
            });
        }

        const updatedRule = await AITrainingRule.findByIdAndUpdate(
            req.params.id,
            {
                ...req.body,
                updatedAt: new Date(),
                updatedBy: req.user.username
            },
            { new: true }
        );

        console.log(`✏️ Training rule updated: ${updatedRule.title}`);

        res.json({
            success: true,
            rule: updatedRule,
            message: 'Rule updated successfully'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Deletar regra
router.delete('/training-rules/:id', authenticateToken, async (req, res) => {
    try {
        const rule = await AITrainingRule.findById(req.params.id);

        if (!rule) {
            return res.status(404).json({
                success: false,
                error: 'Rule not found'
            });
        }

        await AITrainingRule.findByIdAndDelete(req.params.id);
        console.log(`🗑️ Training rule deleted: ${rule.title}`);

        res.json({
            success: true,
            message: 'Rule deleted successfully'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Atualizar título da conversa
router.put('/conversations/:id/title', authenticateToken, async (req, res) => {
    try {
        const { title } = req.body;

        const conversation = await AIConversation.findByIdAndUpdate(
            req.params.id,
            { title },
            { new: true }
        );

        res.json({
            success: true,
            conversation
        });
    } catch (error) {
        console.error('Error updating title:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// TRATAMENTO DE ERROS
// ============================================

// 404 handler
router.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        available: [
            'POST /login',
            'POST /chat',
            'GET /status',
            'GET /query-stats',
            'POST /cache/clear',
            'POST /cache/refresh',
            'GET /training-rules',
            'POST /training-rules',
            'PUT /training-rules/:id',
            'DELETE /training-rules/:id'
        ]
    });
});

// Error handler
router.use((error, req, res, next) => {
    console.error('Route error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

module.exports = router;