// controllers/orderController.js
const localOrderService = require('../services/localOrderService');
const mongoService = require('../services/mongoService');
const emailService = require('../services/emailService');
const fs = require('fs');
const fs_promises = require('fs').promises; // Para diferenciar do fs normal
const crypto = require('crypto');
const sharp = require('sharp');
const SmartCache = require('../services/smartCache');
const smartCache = new SmartCache(5); // 5GB limite
const { imageQueue, fileQueue } = require('../services/queueService');
const CustomerCode = require('../models/customerCode');
const Order = require('../models/order');
const CategoryPrice = require('../models/categoryPrice');
const path = require('path');

// Função para buscar WebP do disco
function getWebPFromDisk(fileId, type = 'hd') {
  try {
    let webpPath;
    
    if (type === 'thumbnail') {
      const sizes = ['medium', 'large', 'small'];
      for (const size of sizes) {
        webpPath = path.join('/opt/render/project/storage/cache/thumbnails', size, `${fileId}.webp`);
        if (fs.existsSync(webpPath)) {
          return fs.readFileSync(webpPath);
        }
      }
    } else {
      webpPath = path.join('/opt/render/project/storage/cache/webp/hd', `${fileId}.webp`);
      if (fs.existsSync(webpPath)) {
        return fs.readFileSync(webpPath);
      }
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao buscar WebP do disco:', error);
    return null;
  }
}

// Constantes para otimização de imagem
const CACHE_DIR = path.join(__dirname, '../../cache/optimized');
const DEFAULT_QUALITY = 90;
const MAX_WIDTH = 2048;

// Adicionar após os requires no topo do arquivo
const WEBP_DIR = process.env.CACHE_STORAGE_PATH ? 
  path.join(process.env.CACHE_STORAGE_PATH, 'webp') : 
  path.join(__dirname, '../../cache/webp');

// Nova função para buscar WebP pré-convertido
async function getPreConvertedWebP(fileId, size = 'hd') {
  try {
    let webpPath;
    
    if (size === 'thumbnail') {
      // Buscar thumbnail apropriado
      const sizes = ['medium', 'large', 'small'];
      for (const thumbSize of sizes) {
        webpPath = path.join(WEBP_DIR, '..', 'thumbnails', thumbSize, `${fileId}.webp`);
        if (fs.existsSync(webpPath)) {
          return fs.readFileSync(webpPath);
        }
      }
    } else {
      // Buscar HD WebP
      webpPath = path.join(WEBP_DIR, 'hd', `${fileId}.webp`);
      if (fs.existsSync(webpPath)) {
        return fs.readFileSync(webpPath);
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting pre-converted WebP:', error);
    return null;
  }
}

// Garantir que o diretório de cache exista
try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch (error) {
  console.error('Erro ao criar diretório de cache:', error);
}

// NOVO: Cache em memória para referências rápidas
const imageCache = {};

// CORRIGIDA: Encontrar categoria real da foto específica
async function findPhotoInLocalIndex(index, photoId) {
  console.log(`🔍 [DEBUG] Buscando categoria real para foto: ${photoId}`);
  
  // Função recursiva para procurar a foto FISICAMENTE
  const searchInFolder = async (folder, parentPath = []) => {
    const currentPath = [...parentPath, folder.name];

    // Se esta pasta tem fotos, verificar FISICAMENTE se nossa foto está aqui
    if (folder.photoCount > 0 && folder.relativePath) {
      try {
        const folderPath = path.join('/opt/render/project/storage/cache/fotos/imagens-webp', folder.relativePath);
        const photoPath = path.join(folderPath, `${photoId}.webp`);
        
        // ✅ VERIFICAR SE ARQUIVO EXISTE FISICAMENTE
        await fs_promises.access(photoPath);
        
        console.log(`✅ [DEBUG] Foto ${photoId} encontrada em: ${folder.name}`);
        return {
          categoryName: folder.name,
          categoryPath: folder.relativePath,
          fullPath: currentPath.join(' → ')
        };
      } catch (error) {
        // Foto não está nesta pasta, continuar procurando
        console.log(`🔍 [DEBUG] Foto ${photoId} NÃO está em: ${folder.name}`);
      }
    }

    // Buscar nas subpastas
    if (folder.children && folder.children.length > 0) {
      for (const child of folder.children) {
        const result = await searchInFolder(child, currentPath);
        if (result) return result;
      }
    }

    return null;
  };

  // Buscar em todas as pastas raiz
  if (index.folders) {
    for (const folder of index.folders) {
      const result = await searchInFolder(folder);
      if (result) return result;
    }
  }

  console.warn(`⚠️ [DEBUG] Foto ${photoId} não encontrada em nenhuma categoria`);
  return null;
}

// Enviar pedido
exports.submitOrder = async (req, res) => {
  try {
    const { code, comments, photoIds } = req.body;

    if (!code || !photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos para criar pedido'
      });
    }

    // Verificar código do cliente
    const customer = await mongoService.verifyCustomerCode(code);

    if (!customer.success) {
      return res.status(400).json({
        success: false,
        message: 'Código de cliente inválido'
      });
    }

    // MODIFICADO: Registrar o pedido no MongoDB e obter o ID gerado
    const orderDoc = await Order.create({
      customerCode: code,
      customerName: customer.customerName,
      photoIds: photoIds,
      comments: comments,
      status: 'processing',
      createdAt: new Date()
    });

    // Usar o ID gerado pelo MongoDB
    const orderId = orderDoc._id;

    // Atualizar cliente para indicar processamento em andamento
    await CustomerCode.findOneAndUpdate(
      { code },
      {
        orderInProgress: true,
        orderDate: new Date(),
        orderStatus: 'processing'
      }
    );

    // Limpar seleções do cliente imediatamente
    await mongoService.saveCustomerSelections(code, []);

    // Responder ao cliente rapidamente
    res.status(200).json({
      success: true,
      message: 'Seu pedido foi recebido e está sendo processado',
      orderId: orderId
    });

    // Continuar o processamento após responder ao cliente
    processOrderInBackground(
      customer.customerName,
      code,
      photoIds,
      comments,
      orderId
    ).catch(error => {
      console.error('Erro no processamento em segundo plano:', error);
    });

  } catch (error) {
    console.error('Erro ao enviar pedido:', error);
    res.status(500).json({
      success: false,
      message: `Erro ao enviar pedido: ${error.message}`
    });
  }
};

// SUBSTITUIR a função processOrderInBackground COMPLETA por esta:
async function processOrderInBackground(customerName, customerCode, photoIds, comments, orderId) {
  try {
    console.log(`🚀 TESTE: Iniciando processamento para ${customerName}`);
    console.log(`📋 TESTE: PhotoIds recebidos: ${photoIds.length} fotos`);
    console.log(`📁 TESTE: Verificando localOrderService...`);
    
    // Testar se localOrderService está acessível
    if (typeof localOrderService.createOrderFolder === 'function') {
      console.log(`✅ TESTE: localOrderService.createOrderFolder existe!`);
    } else {
      console.log(`❌ TESTE: localOrderService.createOrderFolder NÃO existe!`);
      throw new Error('localOrderService.createOrderFolder não está disponível');
    }
    console.log(`Processando pedido ${orderId} em segundo plano para ${customerName}`);

    // NOVO: Usar localStorageService em vez de Google Drive
    const localStorageService = require('../services/localStorageService');
    const photosByCategory = {};

    // Coletar informações sobre as fotos e suas categorias usando sistema local
    console.log("Obtendo informações das fotos e suas categorias do storage local...");
    
    for (const photoId of photoIds) {
      try {
        // Buscar a foto no índice local
        const index = await localStorageService.getIndex();
        const photoInfo = await findPhotoInLocalIndex(index, photoId);
        
        if (photoInfo) {
          const categoryName = photoInfo.categoryName || "Categoria não especificada";
          
          // Adicionar ao objeto agrupado por categoria
          if (!photosByCategory[categoryName]) {
            photosByCategory[categoryName] = [];
          }

          photosByCategory[categoryName].push({
            id: photoId,
            name: `${photoId}.webp`,
            categoryPath: photoInfo.categoryPath
          });
        } else {
          console.warn(`Foto ${photoId} não encontrada no índice local`);
          // Adicionar à categoria genérica
          if (!photosByCategory["Categoria não especificada"]) {
            photosByCategory["Categoria não especificada"] = [];
          }
          photosByCategory["Categoria não especificada"].push({
            id: photoId,
            name: `${photoId}.webp`
          });
        }
      } catch (photoError) {
        console.error(`Erro ao obter informações da foto ${photoId}:`, photoError);
        // Continue com as outras fotos mesmo se uma falhar
      }
    }

    console.log(`Fotos organizadas em ${Object.keys(photosByCategory).length} categorias`);

    // Criar pasta do pedido usando localOrderService
    const result = await localOrderService.createOrderFolder(
      customerName,
      photosByCategory,
      'waiting'
    );

    if (result.success) {
      console.log(`Pasta do pedido criada: ${result.folderName}`);

      // Atualizar status do cliente no MongoDB
      await CustomerCode.findOneAndUpdate(
        { code: customerCode },
        {
          orderInProgress: false,
          orderCompleted: true,
          orderDate: new Date(),
          orderStatus: 'waiting_payment'
        }
      );

      // Preparar dados para o email
      console.log("Preparando para enviar e-mail de confirmação...");
      const orderDetails = {
        folderName: result.folderName,
        folderId: result.folderId,
        photosByCategory: photosByCategory,
        comments: comments,
        totalPhotos: photoIds.length,
        // Incluir array simples de fotos também para compatibilidade
        photos: photoIds.map(id => ({ id }))
      };

      // Enviar o email
      console.log("Enviando e-mail com os detalhes do pedido...");
      
      try {
        const emailResult = await emailService.sendOrderConfirmation(
          customerName,
          orderDetails
        );

        if (emailResult.success) {
          console.log("E-mail enviado com sucesso:", emailResult.messageId);
        } else {
          console.error("Falha ao enviar e-mail:", emailResult.message);
        }
      } catch (emailError) {
        console.error("Erro no serviço de email:", emailError);
        // Continuar mesmo se email falhar
      }

      // Atualizar status do pedido no MongoDB quando concluído
      await Order.findByIdAndUpdate(
        orderId,
        {
          status: 'waiting_payment',
          processedAt: new Date(),
          folderName: result.folderName,
          folderId: result.folderId
        }
      );

      console.log(`Processamento em segundo plano concluído para pedido ${orderId}`);
    } else {
      // Falha no processamento
      await Order.findByIdAndUpdate(
        orderId,
        {
          status: 'failed',
          error: result.message || 'Falha ao processar arquivos'
        }
      );

      await CustomerCode.findOneAndUpdate(
        { code: customerCode },
        {
          orderInProgress: false
        }
      );

      console.error(`Falha no processamento em segundo plano para pedido ${orderId}:`, result.message);
    }
  } catch (error) {
    console.error(`Erro durante processamento em segundo plano do pedido ${orderId}:`, error);

    // Atualizar status com erro
    try {
      await Order.findByIdAndUpdate(
        orderId,
        {
          status: 'failed',
          error: error.message
        }
      );

      await CustomerCode.findOneAndUpdate(
        { code: customerCode },
        {
          orderInProgress: false
        }
      );
    } catch (updateError) {
      console.error('Erro ao atualizar status do pedido com falha:', updateError);
    }
  }
}

// Listar pastas de pedidos
exports.listOrderFolders = async (req, res) => {
  try {
    const status = req.query.status || 'waiting';
    const result = await localOrderService.listOrdersByStatus(status);

    res.status(200).json(result);
  } catch (error) {
    console.error('Erro ao listar pastas de pedidos:', error);
    res.status(500).json({
      success: false,
      message: `Erro ao listar pastas de pedidos: ${error.message}`
    });
  }
};

// Atualizar status do pedido
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, folderId } = req.body;

    if (!status || !folderId) {
      return res.status(400).json({
        success: false,
        message: 'Status e ID da pasta são obrigatórios'
      });
    }

    const result = await localOrderService.moveOrderToStatus(folderId, status);

    // Se pedido foi marcado como pago, remover os IDs dos arquivos das seleções dos clientes
    if (result.success && status === 'paid' && result.fileIds && result.fileIds.length > 0) {
      // Implementar em MongoDB
      console.log(`Arquivos marcados como vendidos: ${result.fileIds.join(', ')}`);
      
      // Atualizar todas as seleções de clientes para remover esses arquivos
      await CustomerCode.updateMany(
        { items: { $in: result.fileIds } },
        { $pull: { items: { $in: result.fileIds } } }
      );
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Erro ao atualizar status do pedido:', error);
    res.status(500).json({
      success: false,
      message: `Erro ao atualizar status do pedido: ${error.message}`
    });
  }
};

// CORRIGIDA: Get order details - busca no local correto
exports.getOrderDetails = async (req, res) => {
  try {
    const { folderId } = req.query;

    if (!folderId) {
      return res.status(400).json({
        success: false,
        message: 'Folder ID is required'
      });
    }

    console.log(`Getting order details for folder: ${folderId}`);

    // CORRIGIDO: Usar localOrderService para buscar no local correto
    const orderDetails = await localOrderService.getOrderDetails(folderId);
    
    if (!orderDetails.success) {
      return res.status(404).json({
        success: false,
        message: orderDetails.message || 'Order not found'
      });
    }

    const order = orderDetails.order;
    
    // Buscar informações do pedido no MongoDB para preços
    const mongoOrder = await Order.findOne({ folderId });
    
    // Converter categorias para formato esperado pelo frontend
    const categories = [];
    
    if (order.categories && order.categories.length > 0) {
      for (const category of order.categories) {
        const items = [];
        
        for (const photo of category.photos) {
          // Buscar preço da categoria no MongoDB
          const categoryPrice = await CategoryPrice.findOne({ 
            name: category.name 
          });
          
          const price = categoryPrice ? categoryPrice.price : 99.99;
          
          items.push({
            id: photo.id,
            name: photo.name,
            price: price
          });
        }
        
        categories.push({
          id: category.name.replace(/\s+/g, '_'),
          name: category.name,
          items: items
        });
      }
    }

    // Retornar informações completas
    res.status(200).json({
      success: true,
      folderId: folderId,
      folderName: order.name,
      status: order.status,
      created: order.createdTime,
      categories: categories,
      comments: mongoOrder ? mongoOrder.comments : '',
      photoCount: order.photoCount
    });

  } catch (error) {
    console.error('Error getting order details:', error);
    res.status(500).json({
      success: false,
      message: `Error getting order details: ${error.message}`
    });
  }
};

// Função auxiliar para obter preço de um item
async function getItemPrice(fileId, categoryName) {
  try {
    // Primeiro, tenta buscar o preço da categoria no MongoDB
    const categoryData = await CategoryPrice.findOne({ name: categoryName });

    if (categoryData) {
      return categoryData.price || 99.99;
    }

    // Se não encontrar por nome da categoria, retorna um preço padrão
    return 99.99;
  } catch (error) {
    console.error(`Error getting price for item ${fileId}:`, error);
    return 99.99; // Preço padrão em caso de erro
  }
};

// NOVA: Função otimizada para processamento de imagem com fila
const processImageEfficiently = async (inputBuffer, options = {}) => {
  const { width = 1024, quality = 80, format = 'jpeg' } = options;
  
  // Verificar tamanho do arquivo antes
  if (inputBuffer.length > 15 * 1024 * 1024) { // 15MB limite
    console.log('Image too large for optimization, serving original');
    return inputBuffer;
  }
  
  try {
    const sharpInstance = sharp(inputBuffer, {
      limitInputPixels: 268402689, // ~16K x 16K max
      sequentialRead: true,
      density: 72 // Reduzir DPI para economizar processamento
    });
    
    let processor = sharpInstance
      .resize(width, null, { 
        withoutEnlargement: true,
        fastShrinkOnLoad: true // Otimização importante para CPU
      });
    
    // Escolher formato baseado no tamanho
    if (format === 'webp' && inputBuffer.length < 5 * 1024 * 1024) {
      // WebP apenas para imagens menores
      processor = processor.webp({ quality, effort: 2 }); // effort 2 = balanceado
    } else {
      // JPEG para economizar CPU
      processor = processor.jpeg({ quality, progressive: true });
    }
    
    const optimized = await processor.toBuffer();
    
    console.log(`✅ Image optimized: ${inputBuffer.length} → ${optimized.length} bytes`);
    return optimized;
    
  } catch (error) {
    console.error('Image optimization failed:', error);
    return inputBuffer; // Fallback para original
  }
};

// Função para servir imagens do Google Drive em alta resolução com cache - OTIMIZADA
exports.getHighResImage = async (req, res) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).send('File ID is required');
    }
    
    // Constantes mantidas para alta qualidade
    const DEFAULT_QUALITY = 90;  // Mantém alta qualidade para visualização em tela cheia
    const MAX_WIDTH = 2048;
    const CACHE_DIR = path.join(__dirname, '../../cache/optimized');
    
    // Garantir que o diretório de cache existe
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    
    // Determinar formato baseado no suporte do navegador
    const acceptHeader = req.headers.accept || '';
    const supportsWebP = acceptHeader.includes('image/webp');
    const format = supportsWebP ? 'webp' : 'jpeg';
    const quality = parseInt(req.query.quality) || DEFAULT_QUALITY;
    
    // Criar nomes de arquivo para cache
    const cacheFilename = `${fileId}_${format}_q${quality}`;
    const cachePath = path.join(CACHE_DIR, cacheFilename);
    const metadataPath = cachePath + '.json';
    
    // Verificar cache existente
    if (fs.existsSync(cachePath) && fs.existsSync(metadataPath)) {
      try {
        // Ler metadados do cache
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        
        console.log(`Serving optimized ${format} from cache: ${fileId}`);
        res.setHeader('Content-Type', metadata.mimeType);
        res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 dias
        
        // Streaming do arquivo em cache
        fs.createReadStream(cachePath).pipe(res);
        return;
      } catch (cacheError) {
        console.error('Error reading from cache:', cacheError);
        // Continue para baixar e otimizar se houver erro no cache
      }
    }
    
    // Se não estiver em cache, buscar do Google Drive
    const drive = await getDriveInstance();
    
    // Obter metadados do arquivo primeiro usando imageQueue
    const fileMetadata = await imageQueue.add(() => drive.files.get({
      fileId: fileId,
      fields: 'mimeType,size,name'
    }));
    
    // Verificar se é uma imagem
    if (!fileMetadata.data.mimeType.startsWith('image/')) {
      return res.status(400).send('Not an image file');
    }
    
    console.log(`Downloading from Google Drive for optimization: ${fileMetadata.data.name}`);
    
    // Obter o conteúdo da imagem usando a fila
    const response = await imageQueue.add(() => drive.files.get({
      fileId: fileId,
      alt: 'media'
    }, {
      responseType: 'arraybuffer'
    }));
    
    // Verificar tamanho - se muito grande, servir diretamente para economizar memória
    if (response.data.length > 25 * 1024 * 1024) { // 25MB
      console.log(`Image too large (${Math.round(response.data.length/1024/1024)}MB), serving without optimization`);
      res.setHeader('Content-Type', fileMetadata.data.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(Buffer.from(response.data));
      return;
    }
    
    // Otimizar a imagem com sharp
    console.log(`Optimizing image to ${format} format with quality ${quality}`);
    
    try {
      const optimizedBuffer = await processImageEfficiently(Buffer.from(response.data), {
        width: MAX_WIDTH,
        quality: quality,
        format: format
      });
      
      // Liberar buffer original para economizar memória
      response.data = null;
      
      // Salvar versão otimizada no cache
      fs.writeFileSync(cachePath, optimizedBuffer);
      
      // Salvar metadados
      const metadata = {
        mimeType: `image/${format}`,
        originalSize: fileMetadata.data.size,
        optimizedSize: optimizedBuffer.length,
        name: fileMetadata.data.name,
        quality: quality,
        format: format,
        cachedAt: new Date().toISOString()
      };
      
      fs.writeFileSync(metadataPath, JSON.stringify(metadata));
      
      // Calcular taxa de compressão para log
      const compressionRate = Math.round((1 - optimizedBuffer.length / fileMetadata.data.size) * 100);
      console.log(`Image optimized: ${fileMetadata.data.size} -> ${optimizedBuffer.length} bytes (${compressionRate}% reduction)`);
      
      // Definir cabeçalhos
      res.setHeader('Content-Type', `image/${format}`);
      res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 dias
      
      // Enviar a imagem otimizada
      res.send(optimizedBuffer);
      
    } catch (optimizationError) {
      console.error('Error optimizing image:', optimizationError);
      
      // Fallback: enviar a imagem original se a otimização falhar
      res.setHeader('Content-Type', fileMetadata.data.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(Buffer.from(response.data));
    }
    
  } catch (error) {
    console.error('Error serving high resolution image:', error);
    if (!res.headersSent) {
      res.status(500).send('Error retrieving image');
    }
  }
};

// Função para servir thumbnails através do seu próprio servidor - OTIMIZADA
exports.getThumbnail = async (req, res) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).send('File ID is required');
    }
    
    // Headers de cache agressivos logo no início
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 ano
    res.setHeader('Vary', 'Accept'); // Para WebP
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Verificar ETag imediatamente
    const etag = `"thumb-${fileId}-v2"`;
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end(); // Not Modified
    }
    res.setHeader('ETag', etag);

    // NOVO: Tentar buscar WebP pré-convertido primeiro
    const preConverted = await getPreConvertedWebP(fileId, 'thumbnail');
    if (preConverted) {
      console.log(`Serving pre-converted thumbnail for ${fileId}`);
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('X-Cache-Source', 'pre-converted');
      return res.send(preConverted);
    }
    
    // Constantes otimizadas para thumbnails
    const THUMBNAIL_SIZE = 300;
    const THUMBNAIL_QUALITY = 80; // Aumentado para melhor qualidade
    const CACHE_DIR = process.env.CACHE_STORAGE_PATH || path.join(__dirname, '../../cache/optimized');
    
    // Garantir que o diretório de cache existe
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    
    // Determinar formato baseado no suporte do navegador
    const acceptHeader = req.headers.accept || '';
    const supportsWebP = acceptHeader.includes('image/webp');
    const format = supportsWebP && process.env.ENABLE_WEBP_CONVERSION === 'true' ? 'webp' : 'jpeg';
    
    // Criar nomes de arquivo para cache
    const cacheFilename = `thumb_${fileId}_${format}_${THUMBNAIL_SIZE}`;
    const cachePath = path.join(CACHE_DIR, 'thumbnails', format, cacheFilename);
    const metadataPath = `${cachePath}.meta`;
    
    // Verificar cache
    if (fs.existsSync(cachePath)) {
      console.log(`Serving thumbnail from cache: ${fileId}`);
      
      // Streaming do arquivo em cache
      const stream = fs.createReadStream(cachePath);
      res.setHeader('Content-Type', `image/${format}`);
      stream.pipe(res);
      return;
    }
    
    // Obter a instância do Drive
    const drive = await getDriveInstance();
    
    // Verificar se é uma imagem
    try {
      const fileMetadata = await drive.files.get({
        fileId: fileId,
        fields: 'mimeType,name,parents'
      });
      
      if (!fileMetadata.data.mimeType.startsWith('image/')) {
        return res.status(400).send('Not an image file');
      }
      
      // Extrair categoryId dos parents
      const categoryId = fileMetadata.data.parents ? fileMetadata.data.parents[0] : null;
      
      console.log(`Processing thumbnail for: ${fileMetadata.data.name}`);
      
      // Obter o conteúdo da imagem usando imageQueue para controle de concorrência
      const response = await imageQueue.add(() => drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, {
        responseType: 'arraybuffer'
      }));
      
      // Garantir que o diretório existe
      const thumbDir = path.dirname(cachePath);
      if (!fs.existsSync(thumbDir)) {
        fs.mkdirSync(thumbDir, { recursive: true });
      }
      
      // Processar imagem com Sharp
      console.log(`Optimizing thumbnail to ${format} format with quality ${THUMBNAIL_QUALITY}`);
      
      let sharpInstance = sharp(Buffer.from(response.data), {
        failOnError: false,
        sequentialRead: true,
        density: 72
      })
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'cover',
        position: 'center',
        withoutEnlargement: true
      });
      
      // Aplicar formato específico
      if (format === 'webp') {
        sharpInstance = sharpInstance.webp({ 
          quality: THUMBNAIL_QUALITY,
          effort: 4 // Balanceado entre qualidade e velocidade
        });
      } else {
        sharpInstance = sharpInstance.jpeg({ 
          quality: THUMBNAIL_QUALITY, 
          progressive: true,
          mozjpeg: true
        });
      }
      
      const thumbnail = await sharpInstance.toBuffer();
      
      // Salvar no cache usando SmartCache
      await smartCache.addFile(cacheFilename, thumbnail, categoryId);
      
      // Criar metadados
      const metadata = {
        etag: etag,
        created: new Date().toISOString(),
        mimeType: `image/${format}`,
        fileId: fileId,
        categoryId: categoryId
      };
      
      // Salvar metadados
      try {
        fs.writeFileSync(metadataPath, JSON.stringify(metadata));
      } catch (metaErr) {
        console.error('Error saving metadata:', metaErr);
      }
      
      // Definir cabeçalhos finais
      res.setHeader('Content-Type', `image/${format}`);
      res.setHeader('Content-Length', thumbnail.length);
      
      // Liberar explicitamente a memória
      response.data = null;
      
      // Enviar a imagem
      res.send(thumbnail);
      
    } catch (error) {
      console.error(`Error processing thumbnail: ${error.message}`);
      
      // Se falhar, tentar servir uma imagem padrão ou erro
      if (!res.headersSent) {
        res.status(500).send('Error retrieving thumbnail');
      }
    }
  } catch (error) {
    console.error('Error serving thumbnail:', error);
    if (!res.headersSent) {
      res.status(500).send('Error retrieving thumbnail');
    }
  }
};

// Adicionar em orderController.js
exports.confirmPaymentFromCDE = async (req, res) => {
  try {
    const { orderId, securityToken } = req.body;
    
    // Validar token de segurança para garantir que apenas o CDE pode chamar
    if (securityToken !== process.env.CDE_SECURITY_TOKEN) {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso não autorizado' 
      });
    }
    
    // Buscar o pedido no MongoDB
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido não encontrado'
      });
    }
    
    // Atualizar status usando função existente
    const result = await driveService.updateOrderStatus('paid', order.folderId);
    
    if (result.success) {
      // Atualizar no MongoDB
      await Order.findByIdAndUpdate(orderId, {
        status: 'paid',
        paidAt: new Date()
      });
      
      return res.status(200).json({
        success: true,
        message: 'Pedido confirmado como pago'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: result.message || 'Erro ao atualizar status'
      });
    }
  } catch (error) {
    console.error('Erro ao confirmar pagamento:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao processar confirmação: ' + error.message
    });
  }
};

// NOVA FUNÇÃO: Process return to stock
exports.processReturnToStock = async (req, res) => {
  try {
    const { folderId, selectedPhotoIds } = req.body;

    if (!folderId || !selectedPhotoIds || !Array.isArray(selectedPhotoIds)) {
      return res.status(400).json({
        success: false,
        message: 'Folder ID and selected photo IDs are required'
      });
    }

    if (selectedPhotoIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one photo must be selected'
      });
    }

    console.log(`Processing return to stock: ${selectedPhotoIds.length} photos from ${folderId}`);

    // Usar localOrderService para processar o retorno
    const result = await localOrderService.returnPhotosToStock(folderId, selectedPhotoIds);

    if (result.success) {
      // Log para auditoria
      console.log(`✅ Return to stock completed: ${result.movedPhotos} photos returned`);
      
      res.status(200).json({
        success: true,
        message: result.message,
        movedPhotos: result.movedPhotos,
        emptyCategories: result.emptyCategories,
        orderDeleted: result.orderDeleted
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message || 'Error processing return to stock'
      });
    }

  } catch (error) {
    console.error('Error processing return to stock:', error);
    res.status(500).json({
      success: false,
      message: `Error processing return to stock: ${error.message}`
    });
  }
};