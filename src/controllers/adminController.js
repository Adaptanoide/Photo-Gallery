// controllers/adminController.js
const localStorageService = require('../services/localStorageService');
const driveService = require('../services/driveService');
const mongoService = require('../services/mongoService');
const CategoryPrice = require('../models/categoryPrice');
const CustomerCode = require('../models/customerCode');
const CategoryAccess = require('../models/categoryAccess');
const Admin = require('../models/admin');

// Admin login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await mongoService.verifyAdminCredentials(email, password);
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
    const result = await mongoService.generateCustomerCode(customerName);
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
    const result = await mongoService.getActiveCodes();
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
    
    const result = await mongoService.deleteCustomerCode(code);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Erro ao deletar código:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar código do cliente'
    });
  }
};

// SUBSTITUA a função exports.getLeafFolders por esta versão:
exports.getLeafFolders = async function(req, res) {
  try {
    console.log('Starting getLeafFolders - usando localStorageService');
    
    // Verificar se é para incluir pastas vazias (para o painel de administrador)
    const includeEmptyFolders = req.query.include_empty === 'true' || req.query.admin === 'true';
    
    console.log(`Include empty folders: ${includeEmptyFolders}`);
    
    // USAR A NOVA FUNÇÃO ESPECÍFICA PARA ADMIN
    const result = await localStorageService.getAdminFolderStructure(includeEmptyFolders);
    
    if (!result.success) {
      console.error('Could not get folder structure:', result.message);
      return res.status(400).json({
        success: false,
        message: 'Could not get folder structure: ' + result.message
      });
    }
    
    let folders = result.folders || [];
    
    console.log(`Found ${folders.length} folders (includeEmpty: ${includeEmptyFolders})`);
    
    // Converter para o formato esperado pelo frontend
    const formattedFolders = folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      fileCount: folder.fileCount || 0,
      path: folder.fullPath || folder.path || folder.name
    }));
    
    res.status(200).json({
      success: true,
      folders: formattedFolders
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
    // Usar o modelo do Mongoose em vez do Firestore
    const prices = await CategoryPrice.find();
    
    res.status(200).json({
      success: true,
      prices: prices.map(price => ({
        folderId: price.folderId,
        price: price.price,
        name: price.name,
        path: price.path || '',
        updatedAt: price.updatedAt
      }))
    });
  } catch (error) {
    console.error('Error getting category prices:', error);
    res.status(500).json({
      success: false,
      message: `Error getting prices: ${error.message}`
    });
  }
};

// SUBSTITUA a função exports.setCategoryPrice completamente por esta:
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
    
    // NOVO: Usar localStorageService em vez de driveService
    const index = await localStorageService.getIndex();
    const folder = localStorageService.findCategoryById(index, folderId);
    
    if (!folder) {
      return res.status(400).json({
        success: false,
        message: 'Folder not found in local storage'
      });
    }
    
    // Atualizar ou criar no MongoDB usando informações do local storage
    await CategoryPrice.findOneAndUpdate(
      { folderId },
      {
        folderId: folderId,
        name: folder.name,
        price: parseFloat(price),
        updatedAt: new Date(),
        path: folder.relativePath || ''
      },
      { upsert: true }
    );
    
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
    
    // Carregar os preços atuais usando MongoDB
    const allPrices = await CategoryPrice.find({
      folderId: { $in: folderIds }
    });
    
    // Criar um mapa de ID da pasta para preço
    const priceMap = {};
    allPrices.forEach(price => {
      priceMap[price.folderId] = price.price || 0;
    });
    
    // Atualizar cada preço individualmente
    const updatePromises = [];
    
    for (const folderId of folderIds) {
      // Obter o preço atual
      let currentPrice = priceMap[folderId] || 0;
      
      // Calcular novo preço
      let newPrice = 0;
      if (type === 'fixed') {
        newPrice = parseFloat(value);
      } else if (type === 'percentage') {
        newPrice = currentPrice * (1 + parseFloat(value) / 100);
      }
      
      // Arredondar para 2 casas decimais e garantir valor não negativo
      newPrice = Math.max(0, Math.round(newPrice * 100) / 100);
      
      // Atualizar no MongoDB (ou criar se não existir)
      const updatePromise = CategoryPrice.findOneAndUpdate(
        { folderId },
        {
          price: newPrice,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
      
      updatePromises.push(updatePromise);
    }
    
    // Aguardar todas as atualizações
    await Promise.all(updatePromises);
    
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
    
    const result = await mongoService.getCustomerCategoryAccess(code);
    
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
    
    const result = await mongoService.saveCustomerCategoryAccess(code, categoryAccessData);
    
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