//src/server.js

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// Importações dos modelos e serviços
const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const clientRoutes = require('./routes/client');
const cartRoutes = require('./routes/cart');
const selectionRoutes = require('./routes/selection');
const pricingRoutes = require('./routes/pricing');
const specialSelectionsRoutes = require('./routes/special-selections'); // NOVO
const storageRoutes = require('./routes/storage');
const Cart = require('./models/Cart');
const { CartService } = require('./services');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Conectar ao MongoDB
connectDB();

// ===== TESTE DOS MODELS E SERVICES =====
console.log('✅ Models carregados: Product, Cart, PhotoCategory, Selection, AccessCode, PhotoStatus');
console.log('✅ Services carregados: CartService, PricingService, SpecialSelectionService');

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/selections', require('./routes/admin-selections'));
app.use('/api/admin', adminRoutes);
app.use('/api/client', clientRoutes);
// app.use('/api/drive', driveRoutes); // ANTIGA - comentada
app.use('/api/gallery', require('./routes/gallery')); // NOVA - R2
app.use('/api/cart', cartRoutes);
app.use('/api/selection', selectionRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/email-config', require('./routes/email-config'));
app.use('/api/special-selections', specialSelectionsRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/images', require('./routes/images'));

// Rota principal - Dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Rota admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// Rota cliente
app.get('/client', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/client.html'));
});

// NOVA: Rota para testar seleções especiais
app.get('/special-selections-test', (req, res) => {
    res.json({
        message: 'Special Selections API is working!',
        endpoints: [
            'GET /api/special-selections - List all special selections',
            'POST /api/special-selections - Create new special selection',
            'GET /api/special-selections/:id - Get selection details',
            'POST /api/special-selections/:id/activate - Activate selection',
            'POST /api/special-selections/:id/categories - Add custom category',
            'POST /api/special-selections/:id/photos/move - Move photo to category'
        ],
        timestamp: new Date().toISOString()
    });
});

// Rota de status
app.get('/api/status', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Sunshine Cowhides API funcionando',
        features: [
            'Normal Selections',
            'Special Selections', // NOVO
            'Cart System',
            'R2 Storage Integration',
            'Pricing Management',
            'Client Management'
        ],
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Handler de erros
app.use((err, req, res, next) => {
    console.error('Erro:', err.stack);
    res.status(500).json({
        error: 'Algo deu errado!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Rota não encontrada',
        availableRoutes: [
            '/',
            '/admin',
            '/client',
            '/api/status',
            '/special-selections-test'
        ]
    });
});

// Sincronização CDE a cada 10 minutos
const CDESync = require('./services/CDESync');
console.log('[Server] Iniciando sincronização CDE a cada 10 minutos');
CDESync.syncAllStates(); // Executar uma vez ao iniciar
setInterval(() => {
    console.log('[Server] Executando sincronização CDE...');
    CDESync.syncAllStates();
}, 600000); // 10 minutos

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🌐 Acesse: http://localhost:${PORT}`);
    console.log(`📊 Status: http://localhost:${PORT}/api/status`);
    console.log(`⭐ Special Selections Test: http://localhost:${PORT}/special-selections-test`);
});