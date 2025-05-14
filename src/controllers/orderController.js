// controllers/orderController.js
const { db, admin } = require('../config/firebase');
const firebaseService = require('../services/firebaseService');
const driveService = require('../services/driveService');
const emailService = require('../services/emailService'); 
const { google } = require('googleapis');
const { getDriveInstance } = require('../config/google.drive');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
    const customer = await firebaseService.verifyCustomerCode(code);
    
    if (!customer.success) {
      return res.status(400).json({
        success: false,
        message: 'Código de cliente inválido'
      });
    }
    
    // MODIFICAÇÃO: Registrar o pedido no Firebase imediatamente
    const orderId = `order_${Date.now()}`;
    await db.collection('orders').doc(orderId).set({
      customerCode: code,
      customerName: customer.customerName,
      photoIds: photoIds,
      comments: comments,
      status: 'processing',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // MODIFICAÇÃO: Atualizar cliente para indicar processamento em andamento
    const docRef = db.collection('customerCodes').doc(code);
    await docRef.update({
      orderInProgress: true,
      orderDate: admin.firestore.FieldValue.serverTimestamp(),
      orderStatus: 'processing'
    });
    
    // MODIFICAÇÃO: Limpar seleções do cliente imediatamente
    await firebaseService.saveCustomerSelections(code, []);
    
    // MODIFICAÇÃO: Responder ao cliente rapidamente
    res.status(200).json({
      success: true,
      message: 'Seu pedido foi recebido e está sendo processado',
      orderId: orderId
    });
    
    // MODIFICAÇÃO: Continuar o processamento após responder ao cliente
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
    
    // ALTERAÇÃO: Usar nova função que processa arquivos com categorias
    console.log("Processando arquivos com separação por categoria...");
    const result = await driveService.processOrderFilesWithCategories(
      customerName,
      photosByCategory,
      'waiting'
    );
    
    if (result.success) {
      // Atualizar status do cliente no Firebase
      const docRef = db.collection('customerCodes').doc(customerCode);
      await docRef.update({
        orderInProgress: false,
        orderCompleted: true,
        orderDate: admin.firestore.FieldValue.serverTimestamp(),
        orderStatus: 'waiting_payment'
      });
      
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
      
      // Atualizar status do pedido no Firebase quando concluído
      await db.collection('orders').doc(orderId).update({
        status: 'waiting_payment',
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        folderName: result.folderName,
        folderId: result.folderId
      });
      
      console.log(`Processamento em segundo plano concluído para pedido ${orderId}`);
    } else {
      // Falha no processamento
      await db.collection('orders').doc(orderId).update({
        status: 'failed',
        error: result.message || 'Falha ao processar arquivos'
      });
      
      await db.collection('customerCodes').doc(customerCode).update({
        orderInProgress: false
      });
      
      console.error(`Falha no processamento em segundo plano para pedido ${orderId}:`, result.message);
    }
  } catch (error) {
    console.error(`Erro durante processamento em segundo plano do pedido ${orderId}:`, error);
    
    // Atualizar status com erro
    try {
      await db.collection('orders').doc(orderId).update({
        status: 'failed',
        error: error.message
      });
      
      await db.collection('customerCodes').doc(customerCode).update({
        orderInProgress: false
      });
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
      // Esta parte precisaria buscar todos os clientes e remover os IDs vendidos
      // de suas seleções, o que seria uma operação complexa no Firebase
      // Aqui apenas simulamos com um log
      console.log(`Arquivos marcados como vendidos: ${result.fileIds.join(', ')}`);
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
        // Tentar obter preço do arquivo (do Firebase ou de metadados)
        // Aqui estamos usando um preço padrão como fallback
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
    
    // 4. Buscar comentários do pedido do Firebase
    let comments = '';
    try {
      // Tentar encontrar pedido no Firestore com esse folderId
      const orderSnapshot = await db.collection('orders')
        .where('folderId', '==', folderId)
        .limit(1)
        .get();
      
      if (!orderSnapshot.empty) {
        const orderData = orderSnapshot.docs[0].data();
        comments = orderData.comments || '';
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
    // Primeiro, tenta buscar o preço da categoria no Firestore
    const categorySnapshot = await db.collection('categoryPrices')
      .where('name', '==', categoryName)
      .limit(1)
      .get();
    
    if (!categorySnapshot.empty) {
      const categoryData = categorySnapshot.docs[0].data();
      return categoryData.price || 99.99;
    }
    
    // Se não encontrar por nome da categoria, retorna um preço padrão
    return 99.99;
  } catch (error) {
    console.error(`Error getting price for item ${fileId}:`, error);
    return 99.99; // Preço padrão em caso de erro
  }
};

// Função para servir imagens do Google Drive em alta resolução com cache
exports.getHighResImage = async (req, res) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).send('File ID is required');
    }
    
    // Criar diretório de cache se não existir
    const cacheDir = path.join(__dirname, '../cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    // Criar nome de arquivo de cache baseado no fileId (hash para segurança)
    const cacheFilename = crypto.createHash('md5').update(fileId).digest('hex');
    const cachePath = path.join(cacheDir, cacheFilename);
    
    // Verificar cache em memória
    if (imageCache[fileId]) {
      console.log(`Serving from memory cache: ${fileId}`);
      res.setHeader('Content-Type', imageCache[fileId].mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache por 24 horas
      
      // Streming do arquivo em cache
      fs.createReadStream(cachePath).pipe(res);
      return;
    }
    
    // Verificar cache em disco
    if (fs.existsSync(cachePath)) {
      try {
        // Ler metadados do cache
        const metadataPath = cachePath + '.json';
        if (fs.existsSync(metadataPath)) {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          
          console.log(`Serving from disk cache: ${fileId}`);
          res.setHeader('Content-Type', metadata.mimeType);
          res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache por 24 horas
          
          // Adicionar ao cache em memória
          imageCache[fileId] = {
            mimeType: metadata.mimeType,
            cachePath: cachePath
          };
          
          // Streaming do arquivo em cache
          fs.createReadStream(cachePath).pipe(res);
          return;
        }
      } catch (cacheError) {
        console.error('Error reading from cache:', cacheError);
        // Continuar para baixar do Google Drive se houver erro no cache
      }
    }
    
    const drive = await getDriveInstance();
    
    // Obter metadados do arquivo primeiro para verificar tipo e tamanho
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: 'mimeType,size,name'
    });
    
    // Verificar se é uma imagem
    if (!fileMetadata.data.mimeType.startsWith('image/')) {
      return res.status(400).send('Not an image file');
    }
    
    // Registrar informações para debug
    console.log(`Downloading from Google Drive: ${fileMetadata.data.name}, type: ${fileMetadata.data.mimeType}, size: ${fileMetadata.data.size} bytes`);
    
    // Obter e servir o conteúdo original da imagem
    const response = await drive.files.get({
      fileId: fileId,
      alt: 'media'  // Solicita o conteúdo do arquivo
    }, {
      responseType: 'stream'  // Importante para arquivos grandes
    });
    
    // Definir cabeçalhos para cache e tipo de conteúdo
    res.setHeader('Content-Type', fileMetadata.data.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache por 24 horas
    
    // Salvar no cache e enviar para o cliente simultaneamente
    const fileStream = fs.createWriteStream(cachePath);
    let hasError = false;
    
    // Salvar metadados
    const metadata = {
      mimeType: fileMetadata.data.mimeType,
      size: fileMetadata.data.size,
      name: fileMetadata.data.name,
      cachedAt: new Date().toISOString()
    };
    
    // Pipe para o cliente e para o arquivo de cache
    response.data.on('data', chunk => {
      res.write(chunk);
      fileStream.write(chunk);
    });
    
    response.data.on('end', () => {
      // Finalizar resposta e arquivo
      fileStream.end();
      if (!res.headersSent) {
        res.end();
      }
      
      if (!hasError) {
        // Salvar metadados no arquivo .json
        fs.writeFile(cachePath + '.json', JSON.stringify(metadata), (err) => {
          if (err) console.error('Error writing cache metadata:', err);
        });
        
        // Adicionar ao cache em memória para próximos acessos
        imageCache[fileId] = {
          mimeType: fileMetadata.data.mimeType,
          cachePath: cachePath
        };
        
        // Se o cache estiver muito grande, remover itens antigos
        const cacheKeys = Object.keys(imageCache);
        if (cacheKeys.length > 50) { // Limitar a 50 itens em memória
          const keyToRemove = cacheKeys[0];
          delete imageCache[keyToRemove];
        }
      }
    });
    
    response.data.on('error', (err) => {
      hasError = true;
      console.error('Error downloading image:', err);
      // Se o arquivo foi criado mas houve erro, tenta removê-lo
      fileStream.end();
      try {
        fs.unlinkSync(cachePath);
      } catch (e) {
        // Ignora erro ao tentar remover
      }
      
      if (!res.headersSent) {
        res.status(500).send('Error downloading image');
      }
    });
    
    fileStream.on('error', (err) => {
      hasError = true;
      console.error('Error writing to cache:', err);
      // Continuar enviando ao cliente mesmo se o cache falhar
    });
    
  } catch (error) {
    console.error('Error serving high resolution image:', error);
    if (!res.headersSent) {
      res.status(500).send('Error retrieving image');
    }
  }
};