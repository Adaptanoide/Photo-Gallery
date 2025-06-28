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

// NOVA FUNÇÃO: Obter apenas pastas finais para Price Management
exports.getLeafFoldersForPricing = async function (req, res) {
  try {
    console.log('Getting leaf folders for pricing');

    const includeEmptyFolders = req.query.include_empty === 'true';
    const result = await localStorageService.getLeafFoldersForPricing(includeEmptyFolders);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    console.log(`Found ${result.folders.length} leaf folders for pricing`);

    res.status(200).json({
      success: true,
      folders: result.folders
    });

  } catch (error) {
    console.error('Error getting leaf folders for pricing:', error);
    res.status(500).json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
};

// SUBSTITUA a função exports.getLeafFolders por esta versão:
exports.getLeafFolders = async function (req, res) {
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

    // 🔧 FILTRAR PASTAS ADMINISTRATIVAS para Photo Storage
    const adminFoldersToExclude = ['Waiting Payment', 'Sold'];
    folders = folders.filter(folder => !adminFoldersToExclude.includes(folder.name));
    console.log(`📋 Filtered out admin folders. Returning ${folders.length} folders`);

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
exports.getCategoryPrices = async function (req, res) {
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

// Nova função para configurar QB Item
exports.setQBItem = async function (req, res) {
  try {
    const { folderId } = req.params;
    const { qbItem } = req.body;

    if (!folderId) {
      return res.status(400).json({
        success: false,
        message: 'Folder ID is required'
      });
    }

    // Validar formato QB Item (opcional - você pode ajustar)
    if (qbItem && !/^[0-9]{2,4}[A-Z]{0,3}$/i.test(qbItem)) {
      return res.status(400).json({
        success: false,
        message: 'QB Item format should be like: 5302A, 5234B, etc.'
      });
    }

    // Usar localStorageService para obter informações da pasta
    const index = await localStorageService.getIndex();
    const folder = localStorageService.findCategoryById(index, folderId);

    if (!folder) {
      return res.status(400).json({
        success: false,
        message: 'Folder not found'
      });
    }

    // Atualizar ou criar no MongoDB
    const result = await CategoryPrice.findOneAndUpdate(
      { folderId },
      {
        folderId: folderId,
        name: folder.name,
        qbItem: qbItem ? qbItem.toUpperCase() : null,
        updatedAt: new Date(),
        path: folder.relativePath
      },
      { upsert: true, new: true }
    );

    console.log(`QB Item updated for ${folder.name}: ${qbItem || 'removed'}`);

    res.status(200).json({
      success: true,
      qbItem: result.qbItem,
      message: `QB Item ${qbItem ? 'updated' : 'removed'} successfully`
    });

  } catch (error) {
    console.error('Error setting QB Item:', error);
    res.status(500).json({
      success: false,
      message: `Error setting QB Item: ${error.message}`
    });
  }
};

// SUBSTITUA a função exports.setCategoryPrice completamente por esta:
exports.setCategoryPrice = async function (req, res) {
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
exports.bulkUpdatePrices = async function (req, res) {
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

// Movimentar fotos entre categorias
exports.movePhotos = async function (req, res) {
  try {
    console.log('🔄 Starting photo move operation...');

    const { photoIds, sourceFolderId, destinationFolderId } = req.body;

    // Validações básicas
    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Photo IDs are required and must be an array'
      });
    }

    if (!sourceFolderId || !destinationFolderId) {
      return res.status(400).json({
        success: false,
        message: 'Source and destination folder IDs are required'
      });
    }

    if (sourceFolderId === destinationFolderId) {
      return res.status(400).json({
        success: false,
        message: 'Source and destination folders cannot be the same'
      });
    }

    console.log(`📦 Moving ${photoIds.length} photos from ${sourceFolderId} to ${destinationFolderId}`);

    // Obter índice e encontrar pastas
    const index = await localStorageService.getIndex();

    const sourceFolder = localStorageService.findCategoryById(index, sourceFolderId);
    const destinationFolder = localStorageService.findCategoryById(index, destinationFolderId);

    if (!sourceFolder) {
      return res.status(400).json({
        success: false,
        message: 'Source folder not found'
      });
    }

    if (!destinationFolder) {
      return res.status(400).json({
        success: false,
        message: 'Destination folder not found'
      });
    }

    // Validar que não são pastas administrativas
    const adminFolders = ['Waiting Payment', 'Sold'];
    if (adminFolders.includes(destinationFolder.name)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot move photos to administrative folders'
      });
    }

    console.log(`📁 Source: ${sourceFolder.name} (${sourceFolder.relativePath})`);
    console.log(`📁 Destination: ${destinationFolder.name} (${destinationFolder.relativePath})`);

    // Chamar função auxiliar do localStorageService
    const result = await localStorageService.movePhotosToCategory(
      photoIds,
      sourceFolder,
      destinationFolder
    );

    if (result.success) {
      console.log(`✅ Successfully moved ${result.movedCount} photos`);

      res.status(200).json({
        success: true,
        message: `Successfully moved ${result.movedCount} photos`,
        movedCount: result.movedCount,
        errors: result.errors || []
      });
    } else {
      console.error('❌ Failed to move photos:', result.message);

      res.status(400).json({
        success: false,
        message: result.message,
        errors: result.errors || []
      });
    }

  } catch (error) {
    console.error('❌ Error in movePhotos controller:', error);
    res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  }
};

// Deletar fotos
exports.deletePhotos = async function (req, res) {
  try {
    console.log('🗑️ Starting photo deletion...');

    const { photoIds, sourceFolderId } = req.body;

    // Validações básicas
    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Photo IDs are required and must be an array'
      });
    }

    if (!sourceFolderId) {
      return res.status(400).json({
        success: false,
        message: 'Source folder ID is required'
      });
    }

    console.log(`🗑️ Deleting ${photoIds.length} photos from folder ${sourceFolderId}`);
    console.log('📋 Photo IDs:', photoIds);

    // Obter informações da pasta fonte
    const index = await localStorageService.getIndex();
    const sourceFolder = localStorageService.findCategoryById(index, sourceFolderId);

    if (!sourceFolder) {
      return res.status(400).json({
        success: false,
        message: 'Source folder not found'
      });
    }

    console.log(`📁 Source folder: ${sourceFolder.name} (${sourceFolder.relativePath})`);

    // Chamar função de exclusão do serviço
    const result = await localStorageService.deletePhotosFromCategory(
      photoIds,
      sourceFolder
    );

    if (result.success) {
      console.log(`✅ Successfully deleted ${result.deletedCount} photos`);

      res.status(200).json({
        success: true,
        message: `Successfully deleted ${result.deletedCount} photos`,
        deletedCount: result.deletedCount,
        errors: result.errors || []
      });
    } else {
      console.error('❌ Failed to delete photos:', result.message);

      res.status(400).json({
        success: false,
        message: result.message,
        errors: result.errors || []
      });
    }

  } catch (error) {
    console.error('❌ Error in deletePhotos controller:', error);
    res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  }
};

// Deletar pasta
exports.deleteFolder = async function (req, res) {
  try {
    console.log('🗑️ Starting folder deletion...');

    const { folderId, folderName, includePhotos } = req.body;

    // Validações básicas
    if (!folderId) {
      return res.status(400).json({
        success: false,
        message: 'Folder ID is required'
      });
    }

    if (!folderName) {
      return res.status(400).json({
        success: false,
        message: 'Folder name is required'
      });
    }

    // Validar que não é pasta administrativa
    const adminFolders = ['Waiting Payment', 'Sold'];
    if (adminFolders.includes(folderName)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete administrative folders'
      });
    }

    console.log(`🗑️ Deleting folder: ${folderName} (includePhotos: ${includePhotos})`);

    // Obter informações da pasta
    const index = await localStorageService.getIndex();
    const folder = localStorageService.findCategoryById(index, folderId);

    if (!folder) {
      return res.status(400).json({
        success: false,
        message: 'Folder not found'
      });
    }

    console.log(`📁 Target folder: ${folder.name} (${folder.relativePath})`);

    // Chamar função de exclusão FORÇADA do serviço
    const result = await localStorageService.deleteFolderForced(
      folder,
      true // sempre deletar fisicamente
    );

    if (result.success) {
      console.log(`✅ Successfully deleted folder ${folderName}`);

      res.status(200).json({
        success: true,
        message: `Successfully deleted folder "${folderName}"`,
        deletedPhotos: result.deletedPhotos || 0,
        folderDeleted: result.folderDeleted || false
      });
    } else {
      console.error('❌ Failed to delete folder:', result.message);

      res.status(400).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error('❌ Error in deleteFolder controller:', error);
    res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  }
};

// 🆕 ADICIONAR NO FINAL DO adminController.js

const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// Configurar Multer para upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB por arquivo
    files: 20 // Máximo 20 arquivos por vez
  },
  fileFilter: (req, file, cb) => {
    // Aceitar apenas imagens
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Apenas JPG, PNG e WebP.'), false);
    }
  }
});

// Controller para upload de fotos
exports.uploadPhotos = [
  // Middleware Multer para múltiplos arquivos
  upload.array('photos', 20),

  // Função principal
  async (req, res) => {
    try {
      console.log('📁 Starting photo upload...');

      const { destinationFolderId } = req.body;
      const files = req.files;

      // Validações básicas
      if (!destinationFolderId) {
        return res.status(400).json({
          success: false,
          message: 'Destination folder ID is required'
        });
      }

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
      }

      console.log(`📦 Processing ${files.length} files for folder: ${destinationFolderId}`);

      // Processar cada arquivo
      const results = [];
      const errors = [];

      for (const file of files) {
        try {
          console.log(`🔄 Processing file: ${file.originalname}`);

          // Gerar ID único para a foto
          const photoId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

          // Converter para WebP usando Sharp (mesma config do convert-local-to-webp.js)
          const webpBuffer = await sharp(file.buffer)
            .rotate() // Auto-rotação baseada em EXIF
            .webp({ quality: 85 }) // Qualidade 85 (mesmo do sistema atual)
            .toBuffer();

          // Salvar foto usando localStorageService
          const saveResult = await localStorageService.savePhotoToFolder(
            destinationFolderId,
            photoId,
            webpBuffer,
            file.originalname
          );

          if (saveResult.success) {
            results.push({
              originalName: file.originalname,
              photoId: photoId,
              size: webpBuffer.length,
              saved: true
            });
            console.log(`✅ Successfully saved: ${file.originalname} as ${photoId}.webp`);
          } else {
            errors.push({
              originalName: file.originalname,
              error: saveResult.error
            });
            console.error(`❌ Failed to save: ${file.originalname} - ${saveResult.error}`);
          }

        } catch (error) {
          console.error(`❌ Error processing ${file.originalname}:`, error);
          errors.push({
            originalName: file.originalname,
            error: error.message
          });
        }
      }

      // Atualizar índice se pelo menos uma foto foi salva
      if (results.length > 0) {
        try {
          await localStorageService.rebuildIndex();
          console.log('📊 Index updated successfully');
        } catch (error) {
          console.error('⚠️ Warning: Failed to update index:', error);
        }
      }

      // Retornar resultado
      const response = {
        success: results.length > 0,
        message: `Successfully uploaded ${results.length} of ${files.length} photos`,
        uploadedCount: results.length,
        errorCount: errors.length,
        results: results,
        errors: errors.length > 0 ? errors : undefined
      };

      console.log(`📊 Upload completed: ${results.length} success, ${errors.length} errors`);
      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during upload: ' + error.message
      });
    }
  }
];

exports.recalculatePhotoCounts = async function (req, res) {
  try {
    console.log('🔄 Recalculando contadores de fotos...');

    // Forçar rebuild do índice
    const newIndex = await localStorageService.rebuildIndex();

    // Limpar cache para forçar uso do novo índice
    localStorageService.clearCache();

    console.log(`✅ Contadores recalculados: ${newIndex.totalPhotos} fotos em ${newIndex.folders.length} categorias`);

    res.status(200).json({
      success: true,
      message: 'Photo counts recalculated successfully',
      totalPhotos: newIndex.totalPhotos,
      totalCategories: newIndex.folders.length
    });

  } catch (error) {
    console.error('❌ Erro ao recalcular contadores:', error);
    res.status(500).json({
      success: false,
      message: `Erro ao recalcular contadores: ${error.message}`
    });
  }
};

// Forçar rebuild do índice de fotos
exports.forceRebuildIndex = async function (req, res) {
  try {
    console.log('🔄 Forçando rebuild do índice...');

    // Forçar novo scan do disco
    const newIndex = await localStorageService.rebuildIndex();

    // Limpar cache
    localStorageService.clearCache();

    res.status(200).json({
      success: true,
      message: 'Index rebuilt successfully',
      totalPhotos: newIndex.totalPhotos,
      totalFolders: newIndex.folders.length
    });

  } catch (error) {
    console.error('❌ Erro no rebuild:', error);
    res.status(500).json({
      success: false,
      message: `Erro: ${error.message}`
    });
  }
};