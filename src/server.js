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
const driveRoutes = require('./routes/drive');
const cartRoutes = require('./routes/cart');
const selectionRoutes = require('./routes/selection');
const pricingRoutes = require('./routes/pricing'); // ← NOVA LINHA
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
console.log('✅ Models carregados: Product, Cart, PhotoCategory');
console.log('✅ Services carregados: CartService, PricingService');

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/admin/selections', require('./routes/admin-selections'));
app.use('/api/admin', adminRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/selection', selectionRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/email-config', require('./routes/email-config'));

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

// Rota temporária para explorar estrutura Google Drive
app.get('/drive-explorer', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/drive-explorer.html'));
});

// Rota de status
app.get('/api/status', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Sunshine Cowhides API funcionando',
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
    res.status(404).json({ error: 'Rota não encontrada' });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🌐 Acesse: http://localhost:${PORT}`);
    console.log(`📊 Status: http://localhost:${PORT}/api/status`);
});