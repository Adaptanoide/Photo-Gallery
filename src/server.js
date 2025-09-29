// src/server.js
// VERSÃO 2.1 - Servidor com Sincronização Incremental Opcional

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
const storageRoutes = require('./routes/storage');

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

// Status de inicialização
console.log('Sistema inicializando...');
console.log('MongoDB configurado');
console.log('Modo: ' + (process.env.NODE_ENV || 'development'));

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/selections', require('./routes/admin-selections'));
app.use('/api/admin', adminRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/gallery', require('./routes/gallery'));
app.use('/api/cart', cartRoutes);
app.use('/api/selection', selectionRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/email-config', require('./routes/email-config'));
app.use('/api/storage', storageRoutes);
app.use('/api/images', require('./routes/images'));

// Páginas principais
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.get('/client', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/client.html'));
});

// ============================================
// SISTEMA DE SINCRONIZAÇÃO INCREMENTAL
// ============================================

// Variável para controlar o serviço de sincronização
let CDEIncrementalSync = null;

// Rota para iniciar sincronização incremental
app.post('/api/sync/start', async (req, res) => {
    try {
        // Carregar o serviço apenas quando necessário
        if (!CDEIncrementalSync) {
            CDEIncrementalSync = require('./services/CDEIncrementalSync');
        }

        const { intervalMinutes = 2, mode = 'observe' } = req.body;

        // Configurar o modo de operação
        CDEIncrementalSync.setMode(mode); // 'observe', 'safe', ou 'full'

        // Iniciar sincronização
        CDEIncrementalSync.start(intervalMinutes);

        res.json({
            success: true,
            message: `Sincronização iniciada em modo ${mode}`,
            interval: `${intervalMinutes} minutos`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota para parar sincronização
app.post('/api/sync/stop', async (req, res) => {
    try {
        if (CDEIncrementalSync) {
            CDEIncrementalSync.stop();
            res.json({
                success: true,
                message: 'Sincronização parada'
            });
        } else {
            res.json({
                success: false,
                message: 'Sincronização não estava rodando'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota para executar sincronização uma única vez
app.post('/api/sync/run-once', async (req, res) => {
    try {
        if (!CDEIncrementalSync) {
            CDEIncrementalSync = require('./services/CDEIncrementalSync');
        }

        const { mode = 'observe' } = req.body;
        CDEIncrementalSync.setMode(mode);

        const result = await CDEIncrementalSync.runSync();

        res.json({
            success: true,
            message: 'Sincronização executada',
            result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota para obter estatísticas da sincronização
app.get('/api/sync/stats', async (req, res) => {
    try {
        if (!CDEIncrementalSync) {
            return res.json({
                success: true,
                stats: {
                    status: 'not_initialized',
                    message: 'Sincronização ainda não foi iniciada'
                }
            });
        }

        const stats = CDEIncrementalSync.getStats();

        res.json({
            success: true,
            stats: {
                ...stats,
                status: CDEIncrementalSync.isRunning ? 'running' : 'idle',
                mode: CDEIncrementalSync.mode || 'not_set'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota para obter último relatório de discrepâncias
app.get('/api/sync/last-report', async (req, res) => {
    try {
        if (!CDEIncrementalSync) {
            return res.json({
                success: false,
                message: 'Sincronização não inicializada'
            });
        }

        const report = CDEIncrementalSync.getLastReport();

        res.json({
            success: true,
            report
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// FIM DO SISTEMA DE SINCRONIZAÇÃO
// ============================================

// Rota de status do sistema (atualizada)
app.get('/api/status', (req, res) => {
    const syncStatus = CDEIncrementalSync ?
        (CDEIncrementalSync.isRunning ? 'active' : 'stopped') :
        'not_initialized';

    res.json({
        status: 'OK',
        message: 'Sunshine Cowhides API funcionando',
        features: [
            'Normal Selections',
            'Special Selections',
            'Cart System',
            'R2 Storage Integration',
            'Pricing Management',
            'Client Management',
            'CDE Incremental Sync'
        ],
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '2.1.0',
        mode: 'SYNC_DIRECT',
        syncStatus: syncStatus
    });
});

// Rota para verificar status do CDE
app.get('/api/cde/status', async (req, res) => {
    try {
        const CDEWriter = require('./services/CDEWriter');
        const connected = await CDEWriter.testConnection();

        res.json({
            connected,
            message: connected ? 'CDE conectado e funcionando' : 'CDE não acessível',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            connected: false,
            error: error.message
        });
    }
});

// Rota para sincronização manual completa (legado)
app.post('/api/sync/manual', async (req, res) => {
    try {
        const CDEManualSync = require('./services/CDEManualSync');
        const result = await CDEManualSync.syncNow();

        res.json({
            success: true,
            message: 'Sincronização manual completa executada',
            result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota para processar expirações manualmente
app.post('/api/cart/process-expirations', async (req, res) => {
    try {
        const Cart = require('./models/Cart');
        const CartService = require('./services/CartService');

        const activeCarts = await Cart.find({
            isActive: true,
            'items.0': { $exists: true }
        });

        let processedCount = 0;
        const now = new Date();

        for (const cart of activeCarts) {
            const expiredItems = cart.items.filter(item =>
                item.expiresAt && new Date(item.expiresAt) < now
            );

            for (const item of expiredItems) {
                await CartService.processExpiredItem(item, cart);
                processedCount++;
            }
        }

        res.json({
            success: true,
            message: `${processedCount} itens expirados processados`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Handler de erros global
app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err.stack);
    res.status(500).json({
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno',
        timestamp: new Date().toISOString()
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
            '/api/cde/status',
            '/api/sync/manual',
            '/api/sync/start',
            '/api/sync/stop',
            '/api/sync/run-once',
            '/api/sync/stats',
            '/api/sync/last-report',
            '/api/cart/process-expirations'
        ],
        message: 'Verifique a URL e tente novamente'
    });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log('SERVIDOR SUNSHINE COWHIDES v2.1');
    console.log('='.repeat(50));
    console.log(`Porta: ${PORT}`);
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`Status: http://localhost:${PORT}/api/status`);
    console.log(`CDE Status: http://localhost:${PORT}/api/cde/status`);
    console.log('='.repeat(50));
    console.log('Sistema operacional - Modo SYNC DIRECT');
    console.log('Todas operações são síncronas e instantâneas');

    // Verificar configuração de sincronização
    const syncEnabled = process.env.ENABLE_CDE_SYNC === 'true';
    const syncInterval = parseInt(process.env.SYNC_INTERVAL_MINUTES) || 2;
    const syncMode = process.env.SYNC_MODE || 'observe';

    // Log de status do sync
    console.log('='.repeat(50));
    console.log('🔧 AMBIENTE:', process.env.NODE_ENV || 'development');
    console.log('🔧 CDE SYNC:', syncEnabled ? '✅ ATIVADO' : '⛔ DESATIVADO');
    console.log('🔧 INSTANCE ID:', process.env.SYNC_INSTANCE_ID || 'not-set');

    if (syncEnabled) {
        console.log('='.repeat(50));
        console.log('SINCRONIZAÇÃO INCREMENTAL CONFIGURADA');
        console.log(`Modo: ${syncMode}`);
        console.log(`Intervalo: ${syncInterval} minutos`);
        console.log('Iniciando em 30 segundos...');

        // Iniciar sincronização automaticamente após 30 segundos
        setTimeout(() => {
            if (!CDEIncrementalSync) {
                CDEIncrementalSync = require('./services/CDEIncrementalSync');
            }
            CDEIncrementalSync.setMode(syncMode);
            CDEIncrementalSync.start(syncInterval);
            console.log(`[SYNC] Sincronização iniciada em modo ${syncMode}`);
        }, 30000);
    } else {
        console.log('Sincronização automática DESABILITADA');
        console.log('Use /api/sync/start para iniciar manualmente');
    }

    console.log('='.repeat(50) + '\n');
});

// Tratamento de shutdown gracioso
process.on('SIGTERM', () => {
    console.log('SIGTERM recebido. Encerrando servidor...');

    // Parar sincronização se estiver rodando
    if (CDEIncrementalSync) {
        CDEIncrementalSync.stop();
    }

    server.close(() => {
        console.log('Servidor encerrado');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\nSIGINT recebido. Encerrando servidor...');

    // Parar sincronização se estiver rodando
    if (CDEIncrementalSync) {
        CDEIncrementalSync.stop();
    }

    server.close(() => {
        console.log('Servidor encerrado');
        process.exit(0);
    });
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    console.error('ERRO NÃO CAPTURADO:', error);

    // Tentar parar sincronização antes de sair
    if (CDEIncrementalSync) {
        CDEIncrementalSync.stop();
    }

    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('PROMISE REJEITADA NÃO TRATADA:', reason);

    // Tentar parar sincronização antes de sair
    if (CDEIncrementalSync) {
        CDEIncrementalSync.stop();
    }

    process.exit(1);
});

module.exports = app;