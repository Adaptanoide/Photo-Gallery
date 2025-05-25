const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

console.log('🚀 Starting full server...');

// Importações
const monitoringService = require('./services/monitoringService');
const connectDB = require('./config/database');
const localStorageService = require('./services/localStorageService');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações de produção
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  
  try {
    const compression = require('compression');
    app.use(compression());
    console.log('✅ Compression enabled for production');
  } catch (error) {
    console.log('⚠️ Compression not available, continuing without it');
  }
}

// Middlewares básicos
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de cache para arquivos estáticos
app.use('/api/orders/thumbnail', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.use('/api/orders/image', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 dias
  next();
});

// Configurar paths de storage na inicialização
const ensureStoragePaths = () => {
  const fs = require('fs');
  const storagePath = process.env.CACHE_STORAGE_PATH || './storage/cache';
  const paths = [
    storagePath,
    path.join(storagePath, 'persistent'),
    path.join(storagePath, 'temp'),
    path.join(storagePath, 'thumbnails', 'webp'),
    path.join(storagePath, 'thumbnails', 'jpeg'),
    path.join(storagePath, 'optimized', 'hd')
  ];
  
  paths.forEach(p => {
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
      console.log(`📁 Created storage path: ${p}`);
    }
  });
};

// Chamar antes de iniciar o servidor
ensureStoragePaths();

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Servir imagens WebP do disco
app.use('/images', express.static('/opt/render/project/storage/cache', {
  maxAge: '1y',
  etag: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }
  }
}));

// Middleware de monitoramento
app.use('/api', (req, res, next) => {
  monitoringService.countRequest();
  
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      monitoringService.countError();
    }
  });
  
  next();
});

// Carregar rotas
const dbRoutes = require('./routes/db');
const photoRoutes = require('./routes/photos');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const clientRoutes = require('./routes/client');
const configRoutes = require('./routes/config');

app.use('/api/db', dbRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/config', configRoutes);

// Rota de status
app.get('/api/status', (req, res) => {
  try {
    const status = monitoringService.getStatus();
    
    res.json({
      success: true,
      status: status,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Error getting system status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system status',
      timestamp: new Date().toISOString()
    });
  }
});

// Rota de status do storage local (ADICIONAR AQUI)
app.get('/api/storage/status', async (req, res) => {
  try {
    const stats = await localStorageService.getStorageStats();
    res.json({
      success: true,
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting storage status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get storage status'
    });
  }
});

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ✅ MIDDLEWARE DE FALLBACK CORRIGIDO
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
      path: req.path
    });
  } else {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  monitoringService.countError();
  
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// Conectar ao MongoDB e iniciar servidor
connectDB()
  .then(() => {
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Servidor rodando na porta ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Status: http://localhost:${PORT}/api/status`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('📴 SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('🔒 HTTP server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('📴 SIGINT received, shutting down gracefully');
      server.close(() => {
        console.log('🔒 HTTP server closed');
        process.exit(0);
      });
    });
  })
  .catch(err => {
    console.error('❌ Failed to connect to MongoDB:', err);
    console.log('🔄 Starting server without MongoDB...');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`⚠️ Servidor rodando na porta ${PORT} (sem MongoDB)`);
      console.log(`📊 Status: http://localhost:${PORT}/api/status`);
    });
  });

   
// Inicializar LocalStorageService
  localStorageService.initialize()
    .then(() => {
      console.log('✅ LocalStorageService initialized');
    })
    .catch(err => {
      console.error('⚠️ Failed to initialize LocalStorageService:', err);
    }); 