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

// ============================================
// SISTEMA DE LIMPEZA AUTOMÁTICA DE CARRINHOS
// ============================================
// ATENÇÃO: Sistema inicia DESLIGADO por segurança
// Para ativar: CART_CLEANUP_ENABLED=true no .env

let cartCleanupInterval = null;
let cartCleanupLastRun = {};

// Função para verificar se deve rodar a limpeza
function shouldRunCartCleanup() {
    // Verificação 1: Sistema está habilitado?
    if (process.env.CART_CLEANUP_ENABLED !== 'true') {
        return false;
    }

    // Verificação 2: É hora de rodar?
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const allowedHours = (process.env.CART_CLEANUP_HOURS || '9,12,15').split(',').map(h => parseInt(h));

    // Só roda na primeira meia hora de cada hora configurada
    if (!allowedHours.includes(currentHour) || currentMinute > 30) {
        return false;
    }

    // Verificação 3: Já rodou nesta hora?
    const lastRunKey = `${currentHour}:${now.getDate()}`;
    if (cartCleanupLastRun[lastRunKey]) {
        return false; // Já rodou hoje nesta hora
    }

    return true;
}

async function runCartCleanup() {
    const mode = process.env.CART_CLEANUP_MODE || 'observe';
    const maxItems = parseInt(process.env.CART_CLEANUP_MAX_ITEMS) || 10;

    console.log('');
    console.log('============================================');
    console.log(`🧹 LIMPEZA AUTOMÁTICA - MODO: ${mode.toUpperCase()}`);
    console.log(`📅 Horário: ${new Date().toLocaleTimeString('pt-BR')}`);
    console.log('============================================');

    try {
        const Cart = require('./models/Cart');
        const now = new Date();

        const cartsWithExpired = await Cart.find({
            isActive: true,
            'items.expiresAt': { $lt: now }
        }).limit(maxItems);

        if (cartsWithExpired.length === 0) {
            console.log('✅ Nenhum item expirado encontrado');
            console.log('============================================\n');
            return;
        }

        // Se modo observe, só contar
        if (mode === 'observe') {
            let totalExpired = 0;
            for (const cart of cartsWithExpired) {
                const expiredCount = cart.items.filter(item =>
                    item.expiresAt && new Date(item.expiresAt) < now
                ).length;
                totalExpired += expiredCount;
            }
            console.log(`📊 ${totalExpired} items expirados encontrados`);
            console.log('⚠️  Modo OBSERVE - nenhuma ação tomada');
        }
        // Se modo clean, limpar de verdade
        else if (mode === 'clean') {
            let cleaned = 0;
            for (const cart of cartsWithExpired) {
                const validItems = cart.items.filter(item =>
                    !item.expiresAt || new Date(item.expiresAt) >= now
                );
                const expiredCount = cart.items.length - validItems.length;

                if (expiredCount > 0) {
                    cart.items = validItems;
                    cart.totalItems = validItems.length;

                    if (cart.items.length === 0) {
                        cart.isActive = false;
                        cart.notes = `Auto-limpeza: ${now.toISOString()}`;
                    }

                    await cart.save();
                    cleaned += expiredCount;
                    console.log(`✅ Cliente ${cart.clientCode}: ${expiredCount} items limpos`);
                }
            }
            console.log(`📊 Total limpo: ${cleaned} items`);
        }

        console.log('============================================\n');

        // Marcar execução
        const hour = now.getHours();
        const day = now.getDate();
        cartCleanupLastRun[`${hour}:${day}`] = true;

    } catch (error) {
        console.error('❌ ERRO NA LIMPEZA AUTOMÁTICA:', error.message);
    }
}

// Inicializar sistema de limpeza
function initCartCleanup() {
    const enabled = process.env.CART_CLEANUP_ENABLED === 'true';

    if (!enabled) {
        console.log('🧹 Sistema de limpeza de carrinhos: DESLIGADO');
        return;
    }

    const mode = process.env.CART_CLEANUP_MODE || 'observe';
    const hours = process.env.CART_CLEANUP_HOURS || '9,12,15';

    console.log('');
    console.log('🧹 ===== SISTEMA DE LIMPEZA DE CARRINHOS =====');
    console.log(`   Status: LIGADO`);
    console.log(`   Modo: ${mode.toUpperCase()}`);
    console.log(`   Horários: ${hours}`);
    console.log(`   Verificação: a cada 10 minutos`);
    console.log('==============================================');
    console.log('');

    // Verificar a cada 10 minutos se deve rodar
    cartCleanupInterval = setInterval(async () => {
        if (shouldRunCartCleanup()) {
            await runCartCleanup();
        }
    }, 10 * 60 * 1000); // 10 minutos

    // Rodar uma vez no início (após 30 segundos) se estiver no horário
    setTimeout(async () => {
        if (shouldRunCartCleanup()) {
            console.log('🧹 Executando limpeza inicial...');
            await runCartCleanup();
        }
    }, 30000); // 30 segundos após iniciar
}

// Chamar após MongoDB conectar (adicione esta linha após a linha 465)
setTimeout(() => {
    initCartCleanup();
}, 5000); // Aguardar 5 segundos para garantir que MongoDB está conectado

// ============================================
// SISTEMA DE EXPIRAÇÃO AUTOMÁTICA DE FOTOS
// ============================================

let photoExpirationInterval = null;

function isBusinessHours() {
    const now = new Date();
    const floridaTime = new Date(now.toLocaleString("en-US", {
        timeZone: "America/New_York"
    }));

    const day = floridaTime.getDay();
    const hour = floridaTime.getHours();

    return (day >= 1 && day <= 6 && hour >= 7 && hour < 17);
}

function initPhotoExpiration() {
    const enabled = process.env.PHOTO_EXPIRATION_ENABLED === 'true';

    if (!enabled) {
        console.log('[EXPIRATION] Sistema desligado');
        return;
    }

    const intervalMinutes = parseInt(process.env.PHOTO_EXPIRATION_INTERVAL) || 30;

    console.log('\n===== EXPIRAÇÃO AUTOMÁTICA DE FOTOS =====');
    console.log(`Status: LIGADO`);
    console.log(`Intervalo: ${intervalMinutes} minutos`);
    console.log('==========================================\n');

    photoExpirationInterval = setInterval(async () => {
        if (isBusinessHours()) {
            const PhotoExpirationService = require('./services/PhotoExpirationService');
            await PhotoExpirationService.processExpiredPhotos();
        } else {
            console.log('[EXPIRATION] Fora do horário comercial - aguardando');
        }
    }, intervalMinutes * 60 * 1000);

    setTimeout(async () => {
        if (isBusinessHours()) {
            console.log('[EXPIRATION] Executando verificação inicial...');
            const PhotoExpirationService = require('./services/PhotoExpirationService');
            await PhotoExpirationService.processExpiredPhotos();
        } else {
            console.log('[EXPIRATION] Fora do horário comercial - verificação inicial cancelada');
        }
    }, 30000);
}

setTimeout(() => {
    initPhotoExpiration();
}, 6000);

module.exports = app;