// controllers/orderController.js
const mongoService = require('../services/mongoService');
const driveService = require('../services/driveService');
const emailService = require('../services/emailService');
const { google } = require('googleapis');
const { getDriveInstance } = require('../config/google.drive');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const SmartCache = require('../services/smartCache');
const smartCache = new SmartCache(5); // 5GB limite
const { imageQueue, fileQueue } = require('../services/queueService');
const CustomerCode = require('../models/customerCode');
const Order = require('../models/order');
const CategoryPrice = require('../models/categoryPrice');

// Constantes para otimização de imagem
const CACHE_DIR = path.join(__dirname, '../../cache/optimized');
const DEFAULT_QUALITY = 90;
const MAX_WIDTH = 2048;

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

async function processOrderInBackground(customerName, customerCode, photoIds, comments, orderId) {
  try {
    console.log(`Processando pedido ${orderId} em segundo plano para ${customerName}`);

    // Obter informações das fotos e suas categorias
    const drive = await getDriveInstance();
    const photosByCategory = {};

    // Coletar informações sobre as fotos e suas categorias
    console.log("Obtendo informações das fotos e suas categorias...");
    for (const photoId of photoIds) {
      try {
        // Obter informações do arquivo
        const file = await drive.files.get({
          fileId: photoId,
          fields: 'id, name, parents'
        });

        // Tentar obter nome da categoria (pasta pai original)
        let categoryName = "Categoria não especificada";

        if (file.data.parents && file.data.parents.length > 0) {
          const parentId = file.data.parents[0];
          try {
            const parentFolder = await drive.files.get({
              fileId: parentId,
              fields: 'id, name'
            });
            categoryName = parentFolder.data.name;
          } catch (folderError) {
            console.log(`Não foi possível obter nome da pasta pai: ${folderError.message}`);
          }
        }

        // Adicionar ao objeto agrupado por categoria
        if (!photosByCategory[categoryName]) {
          photosByCategory[categoryName] = [];
        }

        photosByCategory[categoryName].push({
          id: file.data.id,
          name: file.data.name
        });
      } catch (photoError) {
        console.error(`Erro ao obter informações da foto ${photoId}:`, photoError);
        // Continue com as outras fotos mesmo se uma falhar
      }
    }

    // Usar fila para operações de arquivo
    const result = await fileQueue.add(() =>
      driveService.processOrderFilesWithCategories(
        customerName,
        photosByCategory,
        'waiting'
      )
    );

    if (result.success) {
      // AQUI: Envio de dados para o CDE após criar pasta e mover arquivos
      try {
        console.log("Enviando dados do pedido para o sistema CDE...");
        
        // Criar objeto de dados para enviar ao CDE
        const cdeOrderData = {
          orderId: orderId,
          customerName: customerName,
          customerCode: customerCode,
          folderName: result.folderName,
          folderId: result.folderId,
          status: 'waiting_payment',
          orderDate: new Date().toISOString(),
          photosByCategory: photosByCategory,
          totalPhotos: photoIds.length,
          comments: comments
        };
        
        // Enviar para o serviço de integração com CDE
        const cdeResult = await cdeIntegrationService.sendOrderToCDE(cdeOrderData);
        
        if (cdeResult.success) {
          console.log("Dados enviados com sucesso para o sistema CDE:", cdeResult.status);
        } else {
          console.error("Falha ao enviar dados para o CDE, mas continuando o processamento:", cdeResult.error);
          // Continua o processamento mesmo com falha no CDE
        }
      } catch (cdeError) {
        // Captura erros específicos da integração com CDE
        console.error("Erro na integração com CDE, mas continuando o processamento:", cdeError);
        // Continua o processamento mesmo com erro
      }

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
        // Incluir array simples de fotos também para compatibilidade
        photos: photoIds.map(id => ({ id }))
      };

      // Enviar o email
      console.log("Enviando e-mail com os detalhes do pedido...");
      const emailResult = await emailService.sendOrderConfirmation(
        customerName,
        orderDetails
      );

      if (emailResult.success) {
        console.log("E-mail enviado com sucesso:", emailResult.messageId);
      } else {
        console.error("Falha ao enviar e-mail:", emailResult.message);
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
    const result = await driveService.listOrderFolders(status);

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

    const result = await driveService.updateOrderStatus(status, folderId);

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

// Nova função para obter detalhes completos de um pedido
exports.getOrderDetails = async (req, res) => {
  try {
    const { folderId } = req.query;

    if (!folderId) {
      return res.status(400).json({
        success: false,
        message: 'Folder ID is required'
      });
    }

    // 1. Buscar informações básicas da pasta
    const drive = await getDriveInstance();
    const folderInfo = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, createdTime'
    });

    // 2. Buscar subpastas (categorias) dentro da pasta do pedido
    const subfolders = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)'
    });

    const categories = [];

    // 3. Para cada subpasta, buscar os itens e suas informações
    for (const folder of subfolders.data.files) {
      const categoryId = folder.id;
      const categoryName = folder.name;

      // Buscar arquivos na categoria
      const filesResponse = await drive.files.list({
        q: `'${categoryId}' in parents and mimeType contains 'image/' and trashed = false`,
        fields: 'files(id, name)'
      });

      const items = [];

      // Para cada arquivo, adicionar informações básicas
      for (const file of filesResponse.data.files) {
        // Tentar obter preço do arquivo (do MongoDB ou de metadados)
        const price = await getItemPrice(file.id, categoryName) || 99.99;

        items.push({
          id: file.id,
          name: file.name,
          price: price
        });
      }

      categories.push({
        id: categoryId,
        name: categoryName,
        items: items
      });
    }

    // 4. Buscar comentários do pedido do MongoDB
    let comments = '';
    try {
      // Tentar encontrar pedido no MongoDB com esse folderId
      const order = await Order.findOne({ folderId });
      if (order) {
        comments = order.comments || '';
      }
    } catch (commentError) {
      console.error('Error fetching order comments:', commentError);
    }

    // 5. Retornar todas as informações
    res.status(200).json({
      success: true,
      folderId: folderId,
      folderName: folderInfo.data.name,
      created: folderInfo.data.createdTime,
      categories: categories,
      comments: comments
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
    
    // Constantes otimizadas para thumbnails
    const THUMBNAIL_SIZE = 300;
    const THUMBNAIL_QUALITY = 75; // Qualidade reduzida para thumbnails
    const CACHE_DIR = path.join(__dirname, '../../cache/optimized');
    
    // Garantir que o diretório de cache existe
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    
    // Determinar formato baseado no suporte do navegador
    const acceptHeader = req.headers.accept || '';
    const supportsWebP = acceptHeader.includes('image/webp');
    const format = supportsWebP ? 'webp' : 'jpeg';
    
    // Criar nomes de arquivo para cache
    const cacheFilename = `thumb_${fileId}_${format}`;
    const cachePath = path.join(CACHE_DIR, cacheFilename);
    const metadataPath = `${cachePath}.meta`;
    
    // Verificar cache
    if (fs.existsSync(cachePath)) {
      // Verificar se temos metadados
      let etag = '';
      if (fs.existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          etag = metadata.etag || '';
          
          // Verificar se o cliente já tem a versão em cache (ETag)
          const clientETag = req.headers['if-none-match'];
          if (clientETag && clientETag === etag) {
            // O cliente já tem esta versão
            return res.status(304).end(); // Not Modified, economiza banda
          }
        } catch (metaError) {
          console.error('Error reading metadata:', metaError);
          // Continua sem metadados
        }
      }
      
      console.log(`Serving thumbnail from cache: ${fileId}`);
      
      // Definir headers
      res.setHeader('Content-Type', `image/${format}`);
      res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 dias
      
      // Adicionar ETag se existir
      if (etag) {
        res.setHeader('ETag', etag);
      }
      
      // Enviar do cache
      fs.createReadStream(cachePath).pipe(res);
      return;
    }
    
    // Obter a instância do Drive
    const drive = await getDriveInstance();
    
    // Verificar se é uma imagem
    try {
      const fileMetadata = await drive.files.get({
        fileId: fileId,
        fields: 'mimeType,name'
      });
      
      if (!fileMetadata.data.mimeType.startsWith('image/')) {
        return res.status(400).send('Not an image file');
      }
      
      console.log(`Processing thumbnail for: ${fileMetadata.data.name}`);
    } catch (error) {
      console.error(`Error getting file metadata: ${error.message}`);
      return res.status(404).send('File not found or not accessible');
    }
    
    // Obter o conteúdo da imagem usando imageQueue para controle de concorrência
    try {
      const response = await imageQueue.add(() => drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, {
        responseType: 'arraybuffer'
      }));
      
      // Usar função otimizada para criar thumbnail
      console.log(`Optimizing thumbnail to ${format} format with quality ${THUMBNAIL_QUALITY}`);
      const thumbnail = await processImageEfficiently(Buffer.from(response.data), {
        width: THUMBNAIL_SIZE,
        height: THUMBNAIL_SIZE, 
        format: format,
        quality: THUMBNAIL_QUALITY
      });
      
      // Gerar ETag (hash MD5 do conteúdo)
      const etag = crypto.createHash('md5').update(thumbnail).digest('hex');
      
      // Criar objeto de metadados
      const metadata = {
        etag: etag,
        created: new Date().toISOString(),
        mimeType: `image/${format}`,
        fileId: fileId
      };
      
      // Salvar imagem e metadados no cache
      fs.writeFileSync(cachePath, thumbnail);
      fs.writeFileSync(metadataPath, JSON.stringify(metadata));
      
      // Definir cabeçalhos
      res.setHeader('Content-Type', `image/${format}`);
      res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 dias
      res.setHeader('ETag', etag);
      
      // Liberar explicitamente a memória
      response.data = null;
      
      // Enviar a imagem
      res.send(thumbnail);
    } catch (error) {
      console.error(`Error processing thumbnail: ${error.message}`);
      res.status(500).send('Error retrieving thumbnail');
    }
  } catch (error) {
    console.error('Error serving thumbnail:', error);
    res.status(500).send('Error retrieving thumbnail');
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