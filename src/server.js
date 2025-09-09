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

// Sincronização CDE - intervalo baseado no ambiente e horário comercial
const CDESync = require('./services/CDESync');
// Função para verificar horário comercial Fort Myers (EST/EDT)
function isBusinessHours() {
    const now = new Date();
    const ftMyersTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));

    const day = ftMyersTime.getDay();
    const hour = ftMyersTime.getHours();

    // Segunda(1) a Sexta(5), 7am-6pm
    return (day >= 1 && day <= 5 && hour >= 7 && hour < 18);
}

// Função para executar sync com verificação de horário
function runCDESync() {
    if (isBusinessHours()) {
        console.log('[Server] Dentro do horário comercial Fort Myers - executando syncs...');
        CDESync.syncAllStates();
    } else {
        const now = new Date();
        const ftTime = now.toLocaleString("en-US", {
            timeZone: "America/New_York",
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
        console.log(`[Server] Fora do horário comercial (Fort Myers: ${ftTime}) - syncs pausados`);
    }
}

// Configurar intervalo baseado no ambiente
const syncInterval = process.env.NODE_ENV === 'production'
    ? 10 * 60 * 1000    // 10 minutos em produção
    : 5 * 60 * 1000;    // 5 minutos em desenvolvimento

const syncMinutes = syncInterval / 60000;
const syncHours = syncMinutes / 60;
console.log(`[Server] CDESync configurado para cada ${syncMinutes >= 60 ? syncHours + ' horas' : syncMinutes + ' minutos'} (somente horário comercial)`);

// Executar sync inicial
runCDESync();

// Configurar intervalo
setInterval(() => {
    runCDESync();
}, syncInterval);
// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🌐 Acesse: http://localhost:${PORT}`);
    console.log(`📊 Status: http://localhost:${PORT}/api/status`);
    console.log(`⭐ Special Selections Test: http://localhost:${PORT}/special-selections-test`);
});