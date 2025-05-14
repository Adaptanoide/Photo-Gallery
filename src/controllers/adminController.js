// controllers/adminController.js
const { db, admin } = require('../config/firebase');
const firebaseService = require('../services/firebaseService');
const driveService = require('../services/driveService');

// Admin login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await firebaseService.verifyAdminCredentials(email, password);
    res.status(result.success ? 200 : 401).json(result);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// Generate customer code
exports.generateCustomerCode = async (req, res) => {
  try {
    const { customerName } = req.body;
    const result = await firebaseService.generateCustomerCode(customerName);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Error generating code:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating code'
    });
  }
};

// Get active codes
exports.getActiveCodes = async (req, res) => {
  try {
    const result = await firebaseService.getActiveCodes();
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Error getting codes:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving codes'
    });
  }
};

// Deletar código de cliente
exports.deleteCustomerCode = async (req, res) => {
  try {
    const { code } = req.params;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Código do cliente é obrigatório'
      });
    }
    
    const result = await firebaseService.deleteCustomerCode(code);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Erro ao deletar código:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar código do cliente'
    });
  }
};

exports.getLeafFolders = async function(req, res) {
  try {
    console.log('Starting getLeafFolders - optimized version');
    
    // Verificar se é para incluir pastas vazias (para o painel de administrador)
    const includeEmptyFolders = req.query.include_empty === 'true' || req.query.admin === 'true';
    
    // Cache key para armazenar resultados
    const cacheKey = includeEmptyFolders ? 'leaf_folders_all' : 'leaf_folders';
    
    // Verificar se temos um resultado em cache
    const cachedResult = global[cacheKey];
    const cacheAge = cachedResult ? (Date.now() - cachedResult.timestamp) : null;
    
    // Usar cache se existir e tiver menos de 30 minutos
    if (cachedResult && cacheAge < 30 * 60 * 1000) {
      console.log(`Serving leaf folders from cache (includeEmptyFolders=${includeEmptyFolders})`);
      return res.status(200).json({
        success: true,
        folders: cachedResult.folders,
        fromCache: true
      });
    }
    
    // Obter a pasta raiz
    const rootFolderResult = await driveService.getRootFolderId();
    if (!rootFolderResult.success) {
      console.error('Could not determine root folder:', rootFolderResult.message);
      return res.status(400).json({
        success: false,
        message: 'Could not determine root folder'
      });
    }
    
    console.log('Root folder found:', rootFolderResult.folderId);
    
    // Usar a função otimizada com o parâmetro includeEmptyFolders
    const result = await driveService.getAllLeafFoldersOptimized(rootFolderResult.folderId, includeEmptyFolders);
    
    if (!result.success) {
      console.error('Could not get leaf folders:', result.message);
      return res.status(400).json({
        success: false,
        message: 'Could not get leaf folders: ' + result.message
      });
    }
    
    console.log(`Found ${result.folders.length} leaf folders`);
    
    // Armazenar em cache
    global[cacheKey] = {
      folders: result.folders,
      timestamp: Date.now()
    };
    
    res.status(200).json({
      success: true,
      folders: result.folders
    });
  } catch (error) {
    console.error('Error finding leaf folders:', error);
    res.status(500).json({
      success: false,
      message: `Error finding leaf folders: ${error.message}`
    });
  }
};

// Obter preços de todas as categorias
exports.getCategoryPrices = async function(req, res) {
  try {
    const snapshot = await db.collection('categoryPrices').get();
    
    const prices = [];
    snapshot.forEach(doc => {
      prices.push({
        folderId: doc.id,
        ...doc.data()
      });
    });
    
    res.status(200).json({
      success: true,
      prices: prices
    });
  } catch (error) {
    console.error('Error getting category prices:', error);
    res.status(500).json({
      success: false,
      message: `Error getting prices: ${error.message}`
    });
  }
};

// Definir preço para uma categoria específica
exports.setCategoryPrice = async function(req, res) {
  try {
    const { folderId } = req.params;
    const { price } = req.body;
    
    if (!folderId || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Folder ID and price are required'
      });
    }
    
    // Obter informações da pasta para pegar o nome
    const folderInfo = await driveService.getFolderInfo(folderId);
    
    if (!folderInfo.success) {
      return res.status(400).json({
        success: false,
        message: 'Could not get folder information'
      });
    }
    
    // Salvar preço no Firestore
    const priceRef = db.collection('categoryPrices').doc(folderId);
    await priceRef.set({
      folderId: folderId,
      name: folderInfo.name,
      price: parseFloat(price),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      path: req.body.path || ''  // Caminho opcional
    }, { merge: true });
    
    res.status(200).json({
      success: true,
      message: 'Price updated successfully'
    });
  } catch (error) {
    console.error('Error setting category price:', error);
    res.status(500).json({
      success: false,
      message: `Error setting category price: ${error.message}`
    });
  }
};

// Atualizar preços em lote
exports.bulkUpdatePrices = async function(req, res) {
  try {
    const { type, value, folderIds } = req.body;
    
    if (!type || value === undefined || !folderIds || !Array.isArray(folderIds)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters'
      });
    }
    
    // Obter preços atuais
    const batch = db.batch();
    
    // Processar os folderIds em grupos, porque o Firestore tem limite "in" de 10 itens
    const chunkSize = 10;
    let allCurrentPrices = {};
    
    for (let i = 0; i < folderIds.length; i += chunkSize) {
      const chunk = folderIds.slice(i, i + chunkSize);
      const pricesSnapshot = await db.collection('categoryPrices')
        .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
        .get();
      
      pricesSnapshot.forEach(doc => {
        allCurrentPrices[doc.id] = doc.data().price || 0;
      });
    }
    
    // Atualizar cada pasta
    for (const folderId of folderIds) {
      const priceRef = db.collection('categoryPrices').doc(folderId);
      
      // Obter informações da pasta se não existe ainda no Firestore
      if (!allCurrentPrices[folderId]) {
        const folderInfo = await driveService.getFolderInfo(folderId);
        if (folderInfo.success) {
          allCurrentPrices[folderId] = 0; // Preço inicial
        } else {
          continue; // Pular este folder se não encontrar informações
        }
      }
      
      // Calcular novo preço
      let newPrice = 0;
      if (type === 'fixed') {
        newPrice = parseFloat(value);
      } else if (type === 'percentage') {
        const currentPrice = allCurrentPrices[folderId] || 0;
        // Ajuste percentual: +10% seria value=10, -10% seria value=-10
        newPrice = currentPrice * (1 + parseFloat(value) / 100);
      }
      
      // Arredondar para 2 casas decimais e garantir valor não negativo
      newPrice = Math.max(0, Math.round(newPrice * 100) / 100);
      
      // Adicionar à operação em lote
      batch.set(priceRef, {
        price: newPrice,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
    
    // Executar todas as atualizações em uma única transação
    await batch.commit();
    
    res.status(200).json({
      success: true,
      message: `Prices updated for ${folderIds.length} categories`
    });
  } catch (error) {
    console.error('Error updating prices in bulk:', error);
    res.status(500).json({
      success: false,
      message: `Error updating prices: ${error.message}`
    });
  }
};

// Obter configurações de acesso a categorias para um cliente
exports.getCustomerCategoryAccess = async (req, res) => {
  try {
    const { code } = req.params;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Código do cliente é obrigatório'
      });
    }
    
    const result = await firebaseService.getCustomerCategoryAccess(code);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Erro ao obter configurações de acesso:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter configurações de acesso'
    });
  }
};

// Salvar configurações de acesso a categorias para um cliente
exports.saveCustomerCategoryAccess = async (req, res) => {
  try {
    const { code } = req.params;
    const categoryAccessData = req.body;
    
    if (!code || !categoryAccessData) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos para configurações de acesso'
      });
    }
    
    const result = await firebaseService.saveCustomerCategoryAccess(code, categoryAccessData);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Erro ao salvar configurações de acesso:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao salvar configurações de acesso'
    });
  }
};