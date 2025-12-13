// src/server.js
// VERSÃO 2.2 - Servidor com Validação de Ambiente e Sincronização Incremental

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// 🆕 VALIDAR VARIÁVEIS DE AMBIENTE NO STARTUP
const { validateEnvOrExit } = require('./config/validateEnv');
validateEnvOrExit();

// Importações dos modelos e serviços
const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const clientRoutes = require('./routes/client');
const cartRoutes = require('./routes/cart');
const selectionRoutes = require('./routes/selection');
const pricingRoutes = require('./routes/pricing');
const storageRoutes = require('./routes/storage');
const trackingRoutes = require('./routes/tracking');
const registrationRoutes = require('./routes/registration');
const intelligenceRoutes = require('./routes/intelligence');
const currencyRoutes = require('./routes/currency');
const CurrencyService = require('./services/CurrencyService');
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(compression());

// 🆕 CORS com whitelist configurável
const corsOptions = {
    origin: function (origin, callback) {
        // Permitir requests sem origin (como apps mobile ou Postman)
        if (!origin) return callback(null, true);

        // Em desenvolvimento, permitir localhost
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }

        // Em produção, verificar whitelist
        const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
            .split(',')
            .map(o => o.trim())
            .filter(o => o);

        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Origem bloqueada: ${origin}`);
            callback(new Error('Não permitido pelo CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

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

// ===== PUBLIC TRACKING ROUTES (NO AUTH) =====
app.use('/', trackingRoutes);

// ===== PUBLIC DOWNLOAD ROUTES (NO AUTH) =====
const Selection = require('./models/Selection');
const JSZip = require('jszip');

// Validar token de download
app.get('/api/public/download/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const selection = await Selection.findOne({ downloadToken: token });

        if (!selection) {
            return res.status(404).json({ success: false, message: 'Invalid download link' });
        }

        // Verificar expiração (7 dias)
        const tokenAge = Date.now() - new Date(selection.downloadTokenCreatedAt).getTime();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 dias

        if (tokenAge > maxAge) {
            return res.status(410).json({ success: false, message: 'Download link has expired' });
        }

        res.json({
            success: true,
            selection: {
                clientName: selection.clientName,
                totalItems: selection.totalItems,
                totalValue: selection.totalValue,
                createdAt: selection.createdAt
            }
        });

    } catch (error) {
        console.error('Erro ao validar token:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Gerar ZIP para download
app.get('/api/public/download/:token/zip', async (req, res) => {
    try {
        const { token } = req.params;

        const selection = await Selection.findOne({ downloadToken: token });

        if (!selection) {
            return res.status(404).json({ success: false, message: 'Invalid download link' });
        }

        // Verificar expiração
        const tokenAge = Date.now() - new Date(selection.downloadTokenCreatedAt).getTime();
        const maxAge = 7 * 24 * 60 * 60 * 1000;

        if (tokenAge > maxAge) {
            return res.status(410).json({ success: false, message: 'Download link has expired' });
        }

        // Incrementar contador de downloads
        selection.downloadCount = (selection.downloadCount || 0) + 1;
        await selection.save();

        // Criar ZIP
        const zip = new JSZip();

        for (const item of selection.items) {
            try {
                // Construir URL da foto
                let photoUrl;
                if (item.thumbnailUrl) {
                    photoUrl = item.thumbnailUrl.replace('/_thumbnails/', '/');
                } else {
                    let categoryPath = (item.originalPath || item.category || '')
                        .replace(/\s*→\s*/g, '/')  // "A → B" vira "A/B"
                        .replace(/\s*\/\s*/g, '/')  // "A / B" vira "A/B"
                        .trim();

                    // Encode cada parte do path
                    const encodedPath = categoryPath.split('/').map(part => encodeURIComponent(part.trim())).join('/');
                    photoUrl = `https://images.sunshinecowhides-gallery.com/${encodedPath}/${item.fileName}`;
                }

                console.log(`📥 Baixando: ${item.fileName} de ${photoUrl}`);

                // Baixar foto
                const response = await fetch(photoUrl);
                if (response.ok) {
                    const buffer = await response.arrayBuffer();
                    zip.file(item.fileName, buffer);
                } else {
                    console.warn(`⚠️ Não conseguiu baixar: ${item.fileName}`);
                }
            } catch (err) {
                console.error(`❌ Erro ao baixar ${item.fileName}:`, err.message);
            }
        }

        // Gerar ZIP
        const zipBuffer = await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        // Enviar resposta
        const fileName = `Sunshine_Cowhides_${selection.clientName.replace(/\s+/g, '_')}_${selection.totalItems}_photos.zip`;

        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': zipBuffer.length
        });

        res.send(zipBuffer);

    } catch (error) {
        console.error('Erro ao gerar ZIP:', error);
        res.status(500).json({ success: false, message: 'Error generating download' });
    }
});

// Rotas da API
app.use('/api/auth', authRoutes);  // ← ADICIONAR DE VOLTA!
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
app.use('/api/chat', require('./routes/chat'));
app.use('/api/inventory-monitor', require('./routes/inventory-monitor'));
app.use('/api/monitor-actions', require('./routes/monitor-actions'));
app.use('/api/register', registrationRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api/import', require('./routes/data-import'));

// Servir página Intelligence
app.get('/intelligence', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/intelligence.html'));
});

// ============================================
// ROTAS DE NOTIFICAÇÕES DE EXPIRAÇÃO
// ============================================

// Iniciar serviço de notificações
app.post('/api/cart/notifications/start', async (req, res) => {
    try {
        const CartExpirationNotificationService = require('./services/CartExpirationNotificationService');
        const notificationService = CartExpirationNotificationService.getInstance();

        const { intervalMinutes = 30 } = req.body;
        notificationService.start(intervalMinutes);

        res.json({
            success: true,
            message: 'Serviço de notificações iniciado',
            interval: `${intervalMinutes} minutos`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Parar serviço de notificações
app.post('/api/cart/notifications/stop', async (req, res) => {
    try {
        const CartExpirationNotificationService = require('./services/CartExpirationNotificationService');
        const notificationService = CartExpirationNotificationService.getInstance();

        notificationService.stop();

        res.json({
            success: true,
            message: 'Serviço de notificações parado'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Ver estatísticas
app.get('/api/cart/notifications/stats', async (req, res) => {
    try {
        const CartExpirationNotificationService = require('./services/CartExpirationNotificationService');
        const notificationService = CartExpirationNotificationService.getInstance();

        const stats = notificationService.getStats();

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

// Forçar verificação manual
app.post('/api/cart/notifications/check-now', async (req, res) => {
    try {
        const CartExpirationNotificationService = require('./services/CartExpirationNotificationService');
        const notificationService = CartExpirationNotificationService.getInstance();

        await notificationService.checkAndNotify();

        res.json({
            success: true,
            message: 'Verificação executada',
            stats: notificationService.getStats()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

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

// Variáveis para controlar os serviços de sincronização
let CDEIncrementalSync = null;
let CDETransitSync = null;

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
// SISTEMA DE SINCRONIZAÇÃO DE TRÂNSITO (COMING SOON)
// ============================================

// Rota para iniciar sincronização de trânsito
app.post('/api/transit-sync/start', async (req, res) => {
    try {
        // Carregar o serviço apenas quando necessário
        if (!CDETransitSync) {
            CDETransitSync = require('./services/CDETransitSync');
        }

        const { intervalMinutes = 10 } = req.body;

        // Iniciar sincronização
        CDETransitSync.start(intervalMinutes);

        res.json({
            success: true,
            message: `Sincronização de trânsito iniciada`,
            interval: `${intervalMinutes} minutos`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota para parar sincronização de trânsito
app.post('/api/transit-sync/stop', async (req, res) => {
    try {
        if (CDETransitSync) {
            CDETransitSync.stop();
            res.json({
                success: true,
                message: 'Sincronização de trânsito parada'
            });
        } else {
            res.json({
                success: false,
                message: 'Sincronização de trânsito não estava rodando'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota para executar sincronização de trânsito uma única vez
app.post('/api/transit-sync/run-once', async (req, res) => {
    try {
        if (!CDETransitSync) {
            CDETransitSync = require('./services/CDETransitSync');
        }

        const result = await CDETransitSync.runSync();

        res.json({
            success: true,
            message: 'Sincronização de trânsito executada',
            result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota para obter estatísticas da sincronização de trânsito
app.get('/api/transit-sync/stats', async (req, res) => {
    try {
        if (!CDETransitSync) {
            return res.json({
                success: true,
                stats: {
                    status: 'not_initialized',
                    message: 'Sincronização de trânsito ainda não foi iniciada'
                }
            });
        }

        const stats = CDETransitSync.getStats();

        res.json({
            success: true,
            stats: {
                ...stats,
                status: CDETransitSync.isRunning ? 'running' : 'idle'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// FIM DO SISTEMA DE SINCRONIZAÇÃO DE TRÂNSITO
// ============================================

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
            'CDE Incremental Sync',
            'CDE Transit Sync (Coming Soon)',
            'Cart Expiration Notifications'
        ],
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '2.3.0',
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

        // Iniciar sincronização de trânsito (Coming Soon) após 45 segundos
        const transitSyncEnabled = process.env.ENABLE_TRANSIT_SYNC === 'true';
        if (transitSyncEnabled) {
            console.log('SINCRONIZAÇÃO DE TRÂNSITO (COMING SOON) CONFIGURADA');
            console.log('Intervalo: 10 minutos');
            console.log('Iniciando em 45 segundos...');

            setTimeout(() => {
                if (!CDETransitSync) {
                    CDETransitSync = require('./services/CDETransitSync');
                }
                CDETransitSync.start(10); // A cada 10 minutos
                console.log('[TRANSIT SYNC] Sincronização de trânsito iniciada');
            }, 45000);
        }
    } else {
        console.log('Sincronização automática DESABILITADA');
        console.log('Use /api/sync/start para iniciar manualmente');
    }

    console.log('='.repeat(50) + '\n');
});

// Tratamento de shutdown gracioso
process.on('SIGTERM', () => {
    console.log('SIGTERM recebido. Encerrando servidor...');

    // Parar notificações se estiver rodando
    if (CartExpirationNotificationServiceInstance) {
        CartExpirationNotificationServiceInstance.stop();
    }

    // Parar sincronização se estiver rodando
    if (CDEIncrementalSync) {
        CDEIncrementalSync.stop();
    }

    // Parar sincronização de trânsito se estiver rodando
    if (CDETransitSync) {
        CDETransitSync.stop();
    }

    server.close(() => {
        console.log('Servidor encerrado');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\nSIGINT recebido. Encerrando servidor...');

    // Parar notificações se estiver rodando
    if (CartExpirationNotificationServiceInstance) {
        CartExpirationNotificationServiceInstance.stop();
    }

    // Parar sincronização se estiver rodando
    if (CDEIncrementalSync) {
        CDEIncrementalSync.stop();
    }

    // Parar sincronização de trânsito se estiver rodando
    if (CDETransitSync) {
        CDETransitSync.stop();
    }

    server.close(() => {
        console.log('Servidor encerrado');
        process.exit(0);
    });
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    console.error('ERRO NÃO CAPTURADO:', error);

    // Parar notificações se estiver rodando
    if (CartExpirationNotificationServiceInstance) {
        CartExpirationNotificationServiceInstance.stop();
    }

    // Tentar parar sincronização antes de sair
    if (CDEIncrementalSync) {
        CDEIncrementalSync.stop();
    }

    // Parar sincronização de trânsito se estiver rodando
    if (CDETransitSync) {
        CDETransitSync.stop();
    }

    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('PROMISE REJEITADA NÃO TRATADA:', reason);

    // Parar notificações se estiver rodando
    if (CartExpirationNotificationServiceInstance) {
        CartExpirationNotificationServiceInstance.stop();
    }

    // Tentar parar sincronização antes de sair
    if (CDEIncrementalSync) {
        CDEIncrementalSync.stop();
    }

    process.exit(1);
});

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
        const PhotoExpirationService = require('./services/PhotoExpirationService');
        await PhotoExpirationService.processExpiredPhotos();
    }, intervalMinutes * 60 * 1000);

    setTimeout(async () => {
        console.log('[EXPIRATION] Executando verificação inicial...');
        const PhotoExpirationService = require('./services/PhotoExpirationService');
        await PhotoExpirationService.processExpiredPhotos();
    }, 30000);
}

setTimeout(() => {
    initPhotoExpiration();
}, 6000);

// ============================================
// SISTEMA DE NOTIFICAÇÕES DE EXPIRAÇÃO DE CARRINHO
// ============================================

let CartExpirationNotificationServiceInstance = null;

function initCartExpirationNotifications() {
    const enabled = process.env.CART_EXPIRATION_NOTIFICATIONS_ENABLED === 'true';

    if (!enabled) {
        console.log('[CART-NOTIFY] Sistema de notificações desabilitado');
        console.log('[CART-NOTIFY] Defina CART_EXPIRATION_NOTIFICATIONS_ENABLED=true no .env para ativar');
        return;
    }

    const intervalMinutes = parseInt(process.env.CART_NOTIFICATION_INTERVAL_MINUTES) || 30;

    const CartExpirationNotificationService = require('./services/CartExpirationNotificationService');
    CartExpirationNotificationServiceInstance = CartExpirationNotificationService.getInstance();

    CartExpirationNotificationServiceInstance.start(intervalMinutes);

    console.log('[CART-NOTIFY] Serviço de notificações iniciado com sucesso');
}

// Iniciar após 15 segundos (após o servidor estar estável)
setTimeout(() => {
    initCartExpirationNotifications();
}, 15000);

// ============================================
// INICIAR ATUALIZAÇÃO AUTOMÁTICA DE CÂMBIO
// ============================================
setTimeout(() => {
    console.log('💱 Iniciando serviço de atualização de câmbio...');
    CurrencyService.startAutoUpdate(24); // Atualiza a cada 24 horas
}, 20000); // Aguarda 20 segundos após iniciar

// ============================================
// ENDPOINT DE STATUS DE EXPIRAÇÃO
// Adicionado em: 28/10/2025
// ============================================
app.get('/api/expiration/stats', async (req, res) => {
    try {
        const PhotoExpirationService = require('./services/PhotoExpirationService');
        const UnifiedProductComplete = require('./models/UnifiedProductComplete');
        const stats = PhotoExpirationService.getStats();

        // Buscar fotos atualmente expiradas (pendentes de processamento)
        const now = new Date();
        const expiredCount = await UnifiedProductComplete.countDocuments({
            'reservedBy.expiresAt': { $lt: now },
            'reservedBy.clientCode': { $exists: true }
        });

        res.json({
            success: true,
            stats: {
                ...stats,
                currentlyExpired: expiredCount,
                systemRunning: photoExpirationInterval !== null,
                timestamp: new Date()
            }
        });
    } catch (error) {
        console.error('[EXPIRATION] Erro ao buscar stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = app;