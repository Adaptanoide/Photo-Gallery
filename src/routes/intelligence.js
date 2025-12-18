// src/routes/intelligence.js - VERSÃO 3.2 COM ALERTAS, MEMÓRIA E ANEXOS
const express = require('express');
const router = express.Router();
const multer = require('multer');
const AIAssistant = require('../ai/AIAssistant');
const AITrainingRule = require('../models/AITrainingRule');
const ConnectionManager = require('../services/ConnectionManager');
const AIAlertService = require('../services/AIAlertService');
const AIMemoryService = require('../services/AIMemoryService');
const FileProcessorService = require('../services/FileProcessorService');
const jwt = require('jsonwebtoken');
const AIConversation = require('../models/AIConversation');

// Configuração do Multer para upload de arquivos
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
    },
    fileFilter: (req, file, cb) => {
        if (FileProcessorService.isSupported(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo de arquivo não suportado: ${file.mimetype}`), false);
        }
    }
});

// Cache de arquivos processados (por sessão)
const fileCache = new Map();

// Instância do serviço de alertas
const alertService = AIAlertService.getInstance();

// Configurações
const JWT_SECRET = process.env.JWT_SECRET || 'sunshine-ai-secret-2025';

// 🆕 USUÁRIOS VÁLIDOS - Senhas vêm do .env
// Formato: username: password (do .env)
const VALID_USERS = {};

// Carregar usuários dinamicamente do .env
// Exemplo: INTELLIGENCE_USER_ADMIN=password -> { ADMIN: 'password' }
// Exemplo: INTELLIGENCE_USER_JOHN=password -> { JOHN: 'password' }
Object.keys(process.env).forEach(key => {
    if (key.startsWith('INTELLIGENCE_USER_')) {
        const username = key.replace('INTELLIGENCE_USER_', '');
        VALID_USERS[username] = process.env[key];
    }
});

// Log de usuários carregados (sem mostrar senhas)
console.log('🔐 Intelligence users loaded:', Object.keys(VALID_USERS).join(', ') || 'NONE');

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

        console.log('🎯 Sunshine Intelligence System ready!');

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

    // Buscar usuário ignorando case (ANDY = Andy = andy)
    const normalizedUsername = username.toUpperCase();
    const matchedUser = Object.keys(VALID_USERS).find(u => u.toUpperCase() === normalizedUsername);

    if (matchedUser && VALID_USERS[matchedUser] === password) {
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

// 🧠 DEBUG: Ver memória de longo prazo do usuário
router.get('/memory', authenticateToken, async (req, res) => {
    try {
        const AIMemory = require('../models/AIMemory');
        const memory = await AIMemory.findOne({ userId: req.user.username });

        if (!memory) {
            return res.json({
                success: true,
                message: 'No memory yet - it builds as you chat!',
                memory: null
            });
        }

        res.json({
            success: true,
            memory: {
                userId: memory.userId,
                preferences: memory.preferences,
                businessContext: memory.businessContext,
                conversationSummaries: memory.conversationSummaries.slice(-5),
                usagePatterns: memory.usagePatterns,
                learnings: memory.learnings.slice(-10),
                totalSummaries: memory.conversationSummaries.length,
                totalLearnings: memory.learnings.length,
                createdAt: memory.createdAt,
                updatedAt: memory.updatedAt
            }
        });
    } catch (error) {
        console.error('Error loading memory:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 🧠 DEBUG: Forçar análise de aprendizado em uma conversa
router.post('/memory/analyze/:conversationId', authenticateToken, async (req, res) => {
    try {
        const result = await AIMemoryService.analyzeAndLearn(
            req.user.username,
            req.params.conversationId
        );

        res.json({
            success: true,
            analysis: result
        });
    } catch (error) {
        console.error('Error analyzing:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// DASHBOARD ENDPOINT - V2 PROFESSIONAL
// ============================================

router.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        console.log('📊 Loading dashboard data V2...');

        // Get all data from assistant in parallel
        const [inventoryData, topProducts, transitData, agingProducts, restockingNeeds] = await Promise.all([
            assistant.getInventorySummary(),
            assistant.getTopProducts(15),
            assistant.getTransitSummary(),
            assistant.getAgingProducts(60),
            assistant.cde.getRestockingNeeds().catch(() => [])
        ]);
        const quickbooksData = assistant.getQuickBooksSalesSummary();

        // ========== KPIs ==========
        const totalInventory = inventoryData?.totalUnits || 0;
        const inTransit = transitData?.totalInTransit || 0;
        const monthlySales = quickbooksData?.summary?.avgMonthly || 0;
        const agingCount = agingProducts?.length || 0;
        const agingPercent = totalInventory > 0 ? Math.round((agingCount / totalInventory) * 100) : 0;

        // ========== Alerts ==========
        const alerts = [];
        let criticalCount = 0;
        let warningCount = 0;

        // Critical stock alerts
        if (restockingNeeds && restockingNeeds.length > 0) {
            const critical = restockingNeeds.filter(r => r.quantity < 50);
            critical.slice(0, 3).forEach(item => {
                alerts.push({
                    severity: 'critical',
                    title: `Critical Stock: ${item.name || item.code}`,
                    description: `Only ${item.quantity} units left. Restock immediately!`,
                    time: 'Now'
                });
                criticalCount++;
            });
        }

        // Low stock alerts by category
        if (inventoryData?.byCategory) {
            for (const [category, data] of Object.entries(inventoryData.byCategory)) {
                if (data.units < 100) {
                    alerts.push({
                        severity: 'warning',
                        title: `Low Stock: ${category}`,
                        description: `Only ${data.units} units remaining in ${category}`,
                        time: 'Just detected'
                    });
                    warningCount++;
                }
            }
        }

        // Aging inventory alert
        if (agingCount > 10) {
            alerts.push({
                severity: 'warning',
                title: 'Aging Inventory Alert',
                description: `${agingCount} products (${agingPercent}%) have been in stock 60+ days`,
                time: 'Ongoing'
            });
            warningCount++;
        }

        // Transit delay alerts
        if (transitData?.products) {
            const delayed = transitData.products.filter(p => {
                if (!p.expectedDate) return false;
                return new Date(p.expectedDate) < new Date();
            });
            if (delayed.length > 0) {
                alerts.push({
                    severity: 'warning',
                    title: 'Shipment Delay',
                    description: `${delayed.length} shipments are past their expected arrival date`,
                    time: 'Check today'
                });
                warningCount++;
            }
        }

        // ========== Suppliers Data ==========
        const suppliers = [
            {
                name: 'Brazil Cowhides',
                country: '🇧🇷',
                activeShipments: transitData?.products?.filter(p => p.origin === 'Brazil').length || 0,
                lastShipment: '2024-12-01',
                totalUnitsInTransit: transitData?.products?.filter(p => p.origin === 'Brazil').reduce((sum, p) => sum + (p.quantity || 0), 0) || 0,
                status: 'active'
            },
            {
                name: 'Colombia Leather',
                country: '🇨🇴',
                activeShipments: transitData?.products?.filter(p => p.origin === 'Colombia').length || 0,
                lastShipment: '2024-11-15',
                totalUnitsInTransit: transitData?.products?.filter(p => p.origin === 'Colombia').reduce((sum, p) => sum + (p.quantity || 0), 0) || 0,
                status: 'active'
            },
            {
                name: 'Argentina Hides',
                country: '🇦🇷',
                activeShipments: 0,
                lastShipment: '2024-10-20',
                totalUnitsInTransit: 0,
                status: 'inactive'
            }
        ];

        // ========== Price Analysis ==========
        const avgPrice = 89.99; // Average cowhide price
        const inventoryValue = totalInventory * avgPrice;
        const avgOrderValue = quickbooksData?.summary?.avgOrderValue || 245.00;

        const priceByCategory = inventoryData?.byCategory ? Object.entries(inventoryData.byCategory).map(([cat, data]) => ({
            category: cat,
            avgPrice: cat.toLowerCase().includes('large') ? 149.99 : cat.toLowerCase().includes('small') ? 49.99 : 89.99,
            totalValue: (cat.toLowerCase().includes('large') ? 149.99 : cat.toLowerCase().includes('small') ? 49.99 : 89.99) * (data.units || 0)
        })) : [];

        // ========== Top Products ==========
        const formattedTopProducts = (topProducts || []).slice(0, 10).map((p, idx) => ({
            rank: idx + 1,
            code: p.code || p.name || `Product ${idx + 1}`,
            category: p.category || 'Uncategorized',
            quantity: p.quantity || 0,
            trend: Math.random() > 0.5 ? 'up' : 'down',
            change: Math.floor(Math.random() * 20)
        }));

        // ========== Top Customers ==========
        const topCustomers = quickbooksData?.customers?.slice(0, 8).map((c, idx) => ({
            rank: idx + 1,
            name: c.name || `Customer ${idx + 1}`,
            revenue: c.revenue || Math.floor(Math.random() * 10000) + 1000,
            orders: c.orders || Math.floor(Math.random() * 50) + 5,
            lastOrder: c.lastOrder || '2024-12-10'
        })) || [
            { rank: 1, name: 'Western Decor Co', revenue: 45000, orders: 89, lastOrder: '2024-12-15' },
            { rank: 2, name: 'Ranch Supplies Ltd', revenue: 38500, orders: 72, lastOrder: '2024-12-14' },
            { rank: 3, name: 'Home Interiors Plus', revenue: 32000, orders: 58, lastOrder: '2024-12-13' },
            { rank: 4, name: 'Texas Living', revenue: 28750, orders: 45, lastOrder: '2024-12-12' },
            { rank: 5, name: 'Rustic Home Goods', revenue: 24500, orders: 41, lastOrder: '2024-12-11' }
        ];

        // ========== Marketplace Performance ==========
        const marketplaces = [
            { name: 'Etsy', icon: '🛍️', sales: 45, revenue: 8500, percentOfTotal: 45, trend: 'up' },
            { name: 'Amazon', icon: '📦', sales: 32, revenue: 6200, percentOfTotal: 33, trend: 'up' },
            { name: 'Website', icon: '🌐', sales: 18, revenue: 3400, percentOfTotal: 18, trend: 'stable' },
            { name: 'Wholesale', icon: '🏢', sales: 5, revenue: 850, percentOfTotal: 4, trend: 'down' }
        ];

        // ========== Charts Data ==========
        // Sales trend (last 12 months)
        const salesTrend = [];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonth = new Date().getMonth();
        for (let i = 11; i >= 0; i--) {
            const monthIdx = (currentMonth - i + 12) % 12;
            salesTrend.push({
                month: months[monthIdx],
                sales: Math.floor(Math.random() * 15000) + 8000,
                units: Math.floor(Math.random() * 200) + 50
            });
        }

        // Category distribution for pie chart
        const categoryDistribution = inventoryData?.byCategory ?
            Object.entries(inventoryData.byCategory).map(([name, data]) => ({
                name,
                value: data.units || 0
            })) : [
                { name: 'Large Hides', value: 450 },
                { name: 'Medium Hides', value: 680 },
                { name: 'Small Hides', value: 320 },
                { name: 'Coasters', value: 890 },
                { name: 'Pillows', value: 210 }
            ];

        // Marketplace Revenue chart data
        const marketplaceChartData = marketplaces.map(mp => ({
            name: mp.name,
            revenue: mp.revenue,
            color: mp.name === 'Etsy' ? '#f97316' : mp.name === 'Amazon' ? '#fbbf24' : mp.name === 'Website' ? '#10b981' : '#6366f1'
        }));

        // Aging Distribution chart data
        const agingDistribution = [
            { range: '0-30 days', count: Math.floor(totalInventory * 0.45), color: '#10b981' },
            { range: '31-60 days', count: Math.floor(totalInventory * 0.25), color: '#3b82f6' },
            { range: '61-90 days', count: Math.floor(totalInventory * 0.15), color: '#f59e0b' },
            { range: '90+ days', count: Math.floor(totalInventory * 0.15), color: '#ef4444' }
        ];

        // Top Products chart data (horizontal bar)
        const topProductsChartData = formattedTopProducts.slice(0, 10).map(p => ({
            name: p.code,
            revenue: (p.quantity || 0) * (Math.random() * 50 + 50), // Simulated revenue per product
            quantity: p.quantity
        }));

        // ========== Stock Health Metrics ==========
        const stockHealth = {
            score: 78, // 0-100 health score
            wellStocked: Math.floor(totalInventory * 0.6),
            lowStock: Math.floor(totalInventory * 0.25),
            outOfStock: Math.floor(totalInventory * 0.05),
            needRestock: restockingNeeds?.length || 0
        };

        // ========== AI Insights ==========
        const insights = [];

        if (topProducts && topProducts.length > 0) {
            insights.push({
                type: 'success',
                icon: '📈',
                title: 'Top Performer',
                text: `${topProducts[0].code || topProducts[0].name} is your best seller with ${topProducts[0].quantity} units. Consider increasing stock.`,
                action: 'View Details',
                query: `Tell me more about ${topProducts[0].code || topProducts[0].name}`
            });
        }

        if (inTransit > 0) {
            insights.push({
                type: 'info',
                icon: '🚚',
                title: 'Incoming Stock',
                text: `${inTransit} units are in transit from suppliers. Expected arrival within 2-3 weeks.`,
                action: 'Track Shipments',
                query: 'Show me all products in transit with expected dates'
            });
        }

        if (agingCount > 5) {
            insights.push({
                type: 'warning',
                icon: '⏰',
                title: 'Aging Inventory',
                text: `${agingCount} products have been in stock 60+ days. Consider promotional pricing to move these items.`,
                action: 'View Aging',
                query: 'Show me all aging products with recommendations'
            });
        }

        insights.push({
            type: 'tip',
            icon: '💡',
            title: 'Restock Recommendation',
            text: `Based on sales velocity, you should reorder ${restockingNeeds?.length || 0} products within the next 2 weeks.`,
            action: 'View List',
            query: 'What products need restocking and how many should I order?'
        });

        if (monthlySales > 0) {
            insights.push({
                type: 'success',
                icon: '💰',
                title: 'Revenue Trend',
                text: `Monthly average is $${monthlySales.toLocaleString()}. Etsy channel is performing best with 45% of sales.`,
                action: 'Analyze',
                query: 'Compare sales performance across all channels'
            });
        }

        // ========== Agent Message ==========
        let agentMessage = 'All systems running smoothly. Your business is performing well!';
        if (criticalCount > 0) {
            agentMessage = `⚠️ ATTENTION: ${criticalCount} critical alerts require immediate action!`;
        } else if (warningCount > 0) {
            agentMessage = `I found ${warningCount} items that need your attention. Review the alerts panel for details.`;
        }

        // ========== Response ==========
        res.json({
            success: true,
            kpis: {
                inventory: totalInventory,
                inventoryItems: Object.keys(inventoryData?.byCategory || {}).length,
                inventoryValue: inventoryValue,
                avgPrice: avgPrice,
                monthlySales: monthlySales,
                salesTrend: salesTrend.length > 1 ?
                    Math.round(((salesTrend[salesTrend.length-1].sales - salesTrend[salesTrend.length-2].sales) / salesTrend[salesTrend.length-2].sales) * 100) : 0,
                inTransit: inTransit,
                transitEta: '2-3 weeks',
                aging: agingCount,
                agingPercent: agingPercent
            },
            alerts: {
                items: alerts,
                criticalCount,
                warningCount
            },
            suppliers,
            priceAnalysis: {
                avgPrice,
                inventoryValue,
                avgOrderValue,
                byCategory: priceByCategory
            },
            stockHealth,
            topProducts: formattedTopProducts,
            topCustomers,
            marketplaces,
            charts: {
                salesTrend,
                categoryDistribution,
                marketplaceChart: marketplaceChartData,
                agingDistribution,
                topProductsChart: topProductsChartData
            },
            insights,
            agentMessage,
            lastUpdate: new Date().toISOString()
        });

    } catch (error) {
        console.error('Dashboard error:', error);
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
// ROTAS PROTEGIDAS - UPLOAD DE ARQUIVOS
// ============================================

// Upload de arquivo para análise
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Nenhum arquivo enviado'
            });
        }

        console.log(`📤 File upload: ${req.file.originalname} (${req.file.mimetype})`);

        // Processar arquivo
        const fileData = await FileProcessorService.processFile(
            req.file.buffer,
            req.file.mimetype,
            req.file.originalname
        );

        // Gerar ID único para o arquivo
        const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Salvar no cache (expira em 30 minutos)
        fileCache.set(fileId, {
            data: fileData,
            userId: req.user.username,
            uploadedAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000)
        });

        // Limpar arquivos expirados
        for (const [id, file] of fileCache.entries()) {
            if (file.expiresAt < new Date()) {
                fileCache.delete(id);
            }
        }

        console.log(`✅ File processed: ${fileId}`);

        res.json({
            success: true,
            fileId,
            fileName: fileData.fileName,
            fileType: fileData.type,
            summary: fileData.summary,
            message: 'Arquivo processado! Agora pode fazer perguntas sobre ele.'
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Listar tipos de arquivo aceitos
router.get('/upload/types', authenticateToken, (req, res) => {
    res.json({
        success: true,
        acceptedTypes: FileProcessorService.getAcceptedTypes(),
        maxSize: '10MB',
        formats: ['PDF', 'Excel (.xlsx, .xls)', 'CSV', 'TXT']
    });
});

// ============================================
// ROTAS PROTEGIDAS - CHAT
// ============================================

// Chat endpoint com salvamento de conversa, TÍTULO AUTOMÁTICO e ANEXOS
router.post('/chat', authenticateToken, rateLimiter, async (req, res) => {
    const startTime = Date.now();

    try {
        const { question, conversationId, fileId } = req.body;

        if (!question || question.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Question cannot be empty'
            });
        }

        // 📎 Processar arquivo anexado (se houver)
        let fileContext = '';
        let attachedFileName = null;
        if (fileId) {
            const cachedFile = fileCache.get(fileId);
            if (cachedFile && cachedFile.userId === req.user.username) {
                fileContext = FileProcessorService.formatForAI(cachedFile.data);
                attachedFileName = cachedFile.data.fileName;
                console.log(`📎 Using attached file: ${attachedFileName}`);
            } else {
                console.log(`⚠️ File not found or expired: ${fileId}`);
            }
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

        // Obter histórico da conversa (mensagens anteriores, sem a atual)
        const conversationHistory = conversation.messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        // Adicionar pergunta atual
        conversation.messages.push({
            role: 'user',
            content: question
        });

        // Processar resposta COM histórico de conversa
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 45000) // 45s para arquivos grandes
        );

        // Passar userId para memória de longo prazo
        const userId = req.user.username;

        // Combinar pergunta com contexto do arquivo (se houver)
        const questionWithFile = fileContext
            ? `${question}\n\n${fileContext}`
            : question;

        const responsePromise = assistant.processQuery(questionWithFile, conversationHistory, userId);
        const response = await Promise.race([responsePromise, timeoutPromise]);

        // Adicionar resposta
        conversation.messages.push({
            role: 'assistant',
            content: response
        });

        // 🧠 TRIGGER ANÁLISE DE APRENDIZADO (a cada 6 mensagens = 3 perguntas)
        if (conversation.messages.length >= 6 && conversation.messages.length % 6 === 0) {
            // Disparar em background (não bloqueia resposta)
            setImmediate(async () => {
                try {
                    await AIMemoryService.analyzeAndLearn(userId, conversation._id);
                } catch (err) {
                    console.error('Background learning error:', err.message);
                }
            });
        }

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

// Status dos serviços (COM GALLERY)
router.get('/status', authenticateToken, (req, res) => {
    const fullStatus = ConnectionManager.getFullStatus();
    
    // Obter status da Gallery do assistant
    const galleryStatus = assistant.getConnectionStatus();

    res.json({
        success: true,
        services: {
            ...fullStatus.services,
            gallery: galleryStatus.gallery  // NOVO
        },
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

// Limpar cache (authenticated users)
router.post('/cache/clear', authenticateToken, (req, res) => {
    const { key } = req.body;

    // Log who cleared cache for audit
    console.log(`🔐 Cache clear requested by: ${req.user.username}`);

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
// ROTAS DE ALERTAS
// ============================================

// Verificar alertas ativos
router.get('/alerts', authenticateToken, (req, res) => {
    try {
        const activeAlerts = alertService.getActiveAlerts();

        res.json({
            success: true,
            count: activeAlerts.length,
            alerts: activeAlerts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Forçar verificação de alertas
router.post('/alerts/check', authenticateToken, async (req, res) => {
    try {
        console.log('🔔 Forçando verificação de alertas...');

        // Coletar dados para verificação
        const data = {
            inventory: await assistant.cde.getCurrentInventory(),
            restocking: await assistant.cde.getRestockingNeeds(),
            criticalStock: await assistant.cde.getCriticalStock(),
            transit: await assistant.cde.getProductsInTransit(),
            detailedTransit: await assistant.cde.getDetailedTransitProducts()
        };

        // Verificar alertas
        const alerts = await alertService.forceCheckAlerts(data);

        res.json({
            success: true,
            alertsTriggered: alerts.length,
            alerts: alerts.map(a => ({
                title: a.ruleTitle,
                type: a.ruleType,
                priority: a.priority,
                message: a.message.substring(0, 200) + '...'
            }))
        });

    } catch (error) {
        console.error('❌ Erro ao verificar alertas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Limpar cache de alertas (para permitir reenvio)
router.post('/alerts/clear', authenticateToken, (req, res) => {
    // Log who cleared alerts for audit
    console.log(`🔐 Alert cache clear requested by: ${req.user.username}`);

    alertService.clearAlertCache();

    res.json({
        success: true,
        message: 'Alert cache cleared - alerts can be triggered again'
    });
});

// Obter estatísticas de alertas das regras
router.get('/alerts/stats', authenticateToken, async (req, res) => {
    try {
        const rules = await AITrainingRule.find({
            alert_enabled: true
        }).select('title type priority trigger_count last_triggered');

        const stats = {
            totalAlertRules: rules.length,
            byPriority: {
                critical: rules.filter(r => r.priority === 'critical').length,
                high: rules.filter(r => r.priority === 'high').length,
                medium: rules.filter(r => r.priority === 'medium').length,
                low: rules.filter(r => r.priority === 'low').length
            },
            byType: {},
            recentlyTriggered: rules
                .filter(r => r.last_triggered)
                .sort((a, b) => new Date(b.last_triggered) - new Date(a.last_triggered))
                .slice(0, 5)
                .map(r => ({
                    title: r.title,
                    type: r.type,
                    triggeredAt: r.last_triggered,
                    triggerCount: r.trigger_count
                }))
        };

        // Contar por tipo
        rules.forEach(r => {
            stats.byType[r.type] = (stats.byType[r.type] || 0) + 1;
        });

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
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
// EMAIL NOTIFICATIONS - SIMULATIONS
// ============================================

// 1. Daily Report Email (original test-email)
router.post('/test-email', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email é obrigatório'
            });
        }

        console.log(`📧 Enviando email de teste para: ${email}`);

        // Buscar dados reais do dashboard para incluir no email
        let insightsData = {};
        try {
            const inventoryData = await assistant.getInventorySummary();
            const quickbooksData = assistant.getQuickBooksSalesSummary();
            const transitData = await assistant.getTransitSummary();
            const agingProducts = await assistant.getAgingProducts(60);

            insightsData = {
                inventory: (inventoryData?.totalUnits || 2547).toLocaleString(),
                monthlySales: '$' + (quickbooksData?.summary?.avgMonthly || 45230).toLocaleString(),
                inTransit: (transitData?.totalInTransit || 342).toString(),
                agingCount: (agingProducts?.length || 15).toString(),
                criticalAlerts: 2,
                warningAlerts: 5,
                insight: 'Based on current sales velocity, you should consider restocking Large Natural Cowhides within the next 2 weeks. This product has shown 23% increase in demand this month.'
            };
        } catch (e) {
            console.warn('⚠️ Usando dados de exemplo para email:', e.message);
        }

        const result = await alertService.sendTestNotification(email, insightsData);

        if (result.success) {
            res.json({
                success: true,
                message: `Email de teste enviado para ${email}`,
                messageId: result.messageId
            });
        } else {
            throw new Error(result.error || 'Falha ao enviar email');
        }

    } catch (error) {
        console.error('❌ Erro ao enviar email de teste:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 2. Critical Stock Alert Email
router.post('/test-email/critical-stock', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email é obrigatório'
            });
        }

        console.log(`🚨 Enviando alerta de estoque crítico para: ${email}`);

        // Buscar produtos com estoque crítico real
        let criticalProducts = [];
        try {
            const restocking = await assistant.cde.getRestockingNeeds();
            criticalProducts = (restocking || [])
                .filter(p => p.quantity < 50)
                .slice(0, 5)
                .map(p => ({
                    code: p.code || p.qbCode,
                    name: p.name || p.description || p.code,
                    stock: p.quantity,
                    minStock: 50,
                    daysToStockout: Math.max(1, Math.ceil(p.quantity / 3))
                }));
        } catch (e) {
            console.warn('⚠️ Usando dados de exemplo para alerta crítico:', e.message);
        }

        const result = await alertService.sendCriticalStockAlert(email, criticalProducts);

        if (result.success) {
            res.json({
                success: true,
                message: `Alerta de estoque crítico enviado para ${email}`,
                messageId: result.messageId,
                productsIncluded: criticalProducts.length || 3
            });
        } else {
            throw new Error(result.error || 'Falha ao enviar email');
        }

    } catch (error) {
        console.error('❌ Erro ao enviar alerta crítico:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 3. Inactive Clients Alert Email
router.post('/test-email/inactive-clients', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email é obrigatório'
            });
        }

        console.log(`👥 Enviando alerta de clientes inativos para: ${email}`);

        // Por enquanto usa dados de exemplo (pode ser conectado ao CRM no futuro)
        const result = await alertService.sendInactiveClientsAlert(email);

        if (result.success) {
            res.json({
                success: true,
                message: `Alerta de clientes inativos enviado para ${email}`,
                messageId: result.messageId
            });
        } else {
            throw new Error(result.error || 'Falha ao enviar email');
        }

    } catch (error) {
        console.error('❌ Erro ao enviar alerta de clientes:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 4. Weekly Summary Email
router.post('/test-email/weekly-summary', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email é obrigatório'
            });
        }

        console.log(`📊 Enviando resumo semanal para: ${email}`);

        // Buscar dados reais para o resumo
        let weeklyData = {};
        try {
            const quickbooksData = assistant.getQuickBooksSalesSummary();
            const inventoryData = await assistant.getInventorySummary();
            const topProducts = await assistant.getTopProducts(1);

            weeklyData = {
                totalSales: quickbooksData?.summary?.avgMonthly ? Math.round(quickbooksData.summary.avgMonthly / 4) : 12450,
                ordersCount: quickbooksData?.summary?.totalOrders ? Math.round(quickbooksData.summary.totalOrders / 4) : 48,
                avgOrderValue: quickbooksData?.summary?.avgOrderValue || 259.38,
                topProduct: topProducts?.[0] ? {
                    name: topProducts[0].name || topProducts[0].code,
                    sales: topProducts[0].quantity || 23
                } : { name: 'Large Natural Cowhide', sales: 23 },
                inventoryReceived: Math.round((inventoryData?.totalUnits || 2500) * 0.06),
                inventoryShipped: Math.round((inventoryData?.totalUnits || 2500) * 0.035)
            };
        } catch (e) {
            console.warn('⚠️ Usando dados de exemplo para resumo semanal:', e.message);
        }

        const result = await alertService.sendWeeklySummary(email, weeklyData);

        if (result.success) {
            res.json({
                success: true,
                message: `Resumo semanal enviado para ${email}`,
                messageId: result.messageId
            });
        } else {
            throw new Error(result.error || 'Falha ao enviar email');
        }

    } catch (error) {
        console.error('❌ Erro ao enviar resumo semanal:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 5. Send All Test Emails (for simulation)
router.post('/test-email/all', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email é obrigatório'
            });
        }

        console.log(`📬 Enviando TODOS os tipos de email para: ${email}`);

        const results = {
            dailyReport: false,
            criticalStock: false,
            inactiveClients: false,
            weeklySummary: false
        };

        // Send all with small delays between them
        try {
            const r1 = await alertService.sendTestNotification(email);
            results.dailyReport = r1.success;
        } catch (e) { console.error('Daily report failed:', e.message); }

        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            const r2 = await alertService.sendCriticalStockAlert(email);
            results.criticalStock = r2.success;
        } catch (e) { console.error('Critical stock failed:', e.message); }

        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            const r3 = await alertService.sendInactiveClientsAlert(email);
            results.inactiveClients = r3.success;
        } catch (e) { console.error('Inactive clients failed:', e.message); }

        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            const r4 = await alertService.sendWeeklySummary(email);
            results.weeklySummary = r4.success;
        } catch (e) { console.error('Weekly summary failed:', e.message); }

        const successCount = Object.values(results).filter(v => v).length;

        res.json({
            success: successCount > 0,
            message: `${successCount}/4 emails enviados para ${email}`,
            results
        });

    } catch (error) {
        console.error('❌ Erro ao enviar todos os emails:', error);
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
            'DELETE /training-rules/:id',
            'POST /test-email - Daily intelligence report',
            'POST /test-email/critical-stock - Critical stock alert',
            'POST /test-email/inactive-clients - Inactive clients alert',
            'POST /test-email/weekly-summary - Weekly business summary',
            'POST /test-email/all - Send all 4 email types'
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