// controllers/shipmentController.js
const fs = require('fs').promises;
const path = require('path');
const Shipment = require('../models/shipment');
const localStorageService = require('../services/localStorageService');
const multer = require('multer');
const sharp = require('sharp');

class ShipmentController {
  constructor() {
    this.shipmentsPath = process.env.CACHE_STORAGE_PATH
      ? path.join(process.env.CACHE_STORAGE_PATH, 'shipments')
      : '/opt/render/project/storage/cache/shipments';
  }

  // Garantir que as pastas de shipment existam
  async ensureShipmentFolders() {
    console.log('📁 Verificando pastas de shipment...');
    
    const shipmentFolders = ['incoming-air', 'incoming-sea', 'warehouse'];
    
    for (const folderName of shipmentFolders) {
      const folderPath = path.join(this.shipmentsPath, folderName);
      try {
        await fs.mkdir(folderPath, { recursive: true });
        console.log(`✅ Pasta criada/verificada: ${folderName}`);
      } catch (error) {
        console.error(`❌ Erro ao criar pasta ${folderName}:`, error);
      }
    }
  }

  // Criar novo shipment
  async createShipment(req, res) {
    try {
      const { name, status = 'incoming-air', notes } = req.body;
      
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Shipment name is required'
        });
      }

      console.log(`🚀 Criando shipment: ${name} (${status})`);

      // Garantir que as pastas existam
      await this.ensureShipmentFolders();

      // Gerar ID único
      const folderId = localStorageService.generateId();
      const folderPath = path.join(this.shipmentsPath, status, name);

      // Criar pasta física
      await fs.mkdir(folderPath, { recursive: true });

      // Criar registro no MongoDB
      const shipment = await Shipment.create({
        name,
        status,
        folderId,
        folderPath,
        notes,
        createdBy: 'admin'
      });

      console.log(`✅ Shipment criado: ${name} (ID: ${folderId})`);

      res.status(200).json({
        success: true,
        shipment: shipment,
        message: `Shipment "${name}" created successfully`
      });

    } catch (error) {
      console.error('❌ Error creating shipment:', error);
      res.status(500).json({
        success: false,
        message: `Error creating shipment: ${error.message}`
      });
    }
  }

  // Listar shipments
  async listShipments(req, res) {
    try {
      console.log('📋 Listando shipments...');

      const shipments = await Shipment.find()
        .sort({ uploadDate: -1 });

      res.status(200).json({
        success: true,
        shipments: shipments
      });

    } catch (error) {
      console.error('❌ Error listing shipments:', error);
      res.status(500).json({
        success: false,
        message: `Error listing shipments: ${error.message}`
      });
    }
  }

  // Atualizar status do shipment
  async updateShipmentStatus(req, res) {
    try {
      const { shipmentId, newStatus } = req.body;

      console.log(`🔄 Atualizando shipment ${shipmentId} para: ${newStatus}`);

      const shipment = await Shipment.findById(shipmentId);
      if (!shipment) {
        return res.status(404).json({
          success: false,
          message: 'Shipment not found'
        });
      }

      // Mover pasta física
      const currentPath = path.join(this.shipmentsPath, shipment.status, shipment.name);
      const newPath = path.join(this.shipmentsPath, newStatus, shipment.name);

      try {
        await fs.rename(currentPath, newPath);
        console.log(`📦 Pasta movida: ${currentPath} → ${newPath}`);
      } catch (moveError) {
        console.error('❌ Erro ao mover pasta:', moveError);
        return res.status(500).json({
          success: false,
          message: 'Error moving shipment folder'
        });
      }

      // Atualizar banco
      shipment.status = newStatus;
      shipment.folderPath = newPath;
      await shipment.save();

      res.status(200).json({
        success: true,
        shipment: shipment,
        message: `Shipment moved to ${newStatus}`
      });

    } catch (error) {
      console.error('❌ Error updating shipment status:', error);
      res.status(500).json({
        success: false,
        message: `Error updating status: ${error.message}`
      });
    }
  }

  // Obter detalhes de um shipment
  async getShipmentDetails(req, res) {
    try {
      const { shipmentId } = req.params;

      const shipment = await Shipment.findById(shipmentId);
      if (!shipment) {
        return res.status(404).json({
          success: false,
          message: 'Shipment not found'
        });
      }

      res.status(200).json({
        success: true,
        shipment: shipment
      });

    } catch (error) {
      console.error('❌ Error getting shipment details:', error);
      res.status(500).json({
        success: false,
        message: `Error getting details: ${error.message}`
      });
    }
  }

  // Deletar shipment
  async deleteShipment(req, res) {
    try {
      const { shipmentId } = req.params;

      console.log(`🗑️ Deletando shipment: ${shipmentId}`);

      const shipment = await Shipment.findById(shipmentId);
      if (!shipment) {
        return res.status(404).json({
          success: false,
          message: 'Shipment not found'
        });
      }

      // Deletar pasta física se existir
      if (shipment.folderPath) {
        try {
          await fs.rmdir(shipment.folderPath, { recursive: true });
          console.log(`📁 Pasta física deletada: ${shipment.folderPath}`);
        } catch (error) {
          console.warn('Aviso: Erro ao deletar pasta física:', error.message);
        }
      }

      // Deletar do banco
      await Shipment.findByIdAndDelete(shipmentId);

      console.log(`✅ Shipment deletado: ${shipment.name}`);

      res.status(200).json({
        success: true,
        message: `Shipment "${shipment.name}" deleted successfully`
      });

    } catch (error) {
      console.error('❌ Error deleting shipment:', error);
      res.status(500).json({
        success: false,
        message: `Error deleting shipment: ${error.message}`
      });
    }
  }

  // Configurar multer para upload
  getUploadMiddleware() {
    const storage = multer.memoryStorage();
    return multer({
      storage: storage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB por arquivo
        files: 1000 // Máximo 1000 arquivos
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files allowed'), false);
        }
      }
    });
  }

    // Upload de fotos para shipment - PRESERVANDO HIERARQUIA
    async uploadPhotos(req, res) {
        try {
        const { shipmentId } = req.params;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({
            success: false,
            message: 'No files uploaded'
            });
        }

        console.log(`📤 Processing ${files.length} files for shipment: ${shipmentId}`);

        const shipment = await Shipment.findById(shipmentId);
        if (!shipment) {
            return res.status(404).json({
            success: false,
            message: 'Shipment not found'
            });
        }

        // NOVO: Preservar estrutura hierárquica usando webkitRelativePath
        const categoriesData = {};
        let totalProcessed = 0;

        for (const file of files) {
            try {
            // USAR CAMINHO REAL DA PASTA em vez de detecção automática
            let categoryName = 'Mixed Category'; // fallback
            
            if (file.originalname && file.originalname.includes('/')) {
                // Extrair pasta pai do caminho: "pasta1/subpasta/foto.jpg" → "subpasta"
                const pathParts = file.originalname.split('/');
                if (pathParts.length >= 2) {
                // Pegar a pasta imediatamente antes do arquivo
                categoryName = pathParts[pathParts.length - 2];
                }
            } else if (file.webkitRelativePath) {
                // Usar webkitRelativePath se disponível
                const pathParts = file.webkitRelativePath.split('/');
                if (pathParts.length >= 2) {
                categoryName = pathParts[pathParts.length - 2];
                }
            }
            
            console.log(`📁 File: ${file.originalname} → Category: ${categoryName}`);
            
            if (!categoriesData[categoryName]) {
                categoriesData[categoryName] = [];
            }

            // Converter para WebP se necessário
            let fileBuffer = file.buffer;
            if (file.mimetype !== 'image/webp') {
                fileBuffer = await sharp(file.buffer)
                .webp({ quality: 90, effort: 4 })
                .toBuffer();
            }

            // Gerar nome único do arquivo
            const originalBaseName = path.parse(file.originalname.split('/').pop()).name;
            const fileName = `${originalBaseName}_${Date.now()}_${totalProcessed}.webp`;
            
            // Salvar na pasta do shipment preservando estrutura
            const categoryPath = path.join(shipment.folderPath, categoryName);
            await fs.mkdir(categoryPath, { recursive: true });
            
            const filePath = path.join(categoryPath, fileName);
            await fs.writeFile(filePath, fileBuffer);
            
            categoriesData[categoryName].push({
                originalName: file.originalname,
                fileName: fileName,
                size: fileBuffer.length,
                originalPath: file.webkitRelativePath || file.originalname
            });
            
            totalProcessed++;
            
            } catch (fileError) {
            console.error(`Error processing file ${file.originalname}:`, fileError);
            }
        }

        // Atualizar shipment no banco
        const categories = Object.entries(categoriesData).map(([name, files]) => ({
            name,
            photoCount: files.length,
            processedPhotos: 0
        }));

        shipment.categories = categories;
        shipment.totalPhotos = totalProcessed;
        await shipment.save();

        console.log(`✅ Upload completed: ${totalProcessed} photos in ${categories.length} categories`);
        console.log('📁 Categories found:', categories.map(c => `${c.name} (${c.photoCount} photos)`));

        res.status(200).json({
            success: true,
            processedPhotos: totalProcessed,
            categories: categories,
            message: `Successfully uploaded ${totalProcessed} photos in ${categories.length} folders`
        });

        } catch (error) {
        console.error('❌ Error uploading photos:', error);
        res.status(500).json({
            success: false,
            message: `Error uploading photos: ${error.message}`
        });
        }
    }

  // Smart Detection de categoria baseada no arquivo
  detectCategoryFromFile(file) {
    const fileName = file.originalname.toLowerCase();
    const filePath = file.path || '';

    // Padrões baseados na sua estrutura existente
    const patterns = [
      { pattern: /black.*white/i, category: 'Black & White' },
      { pattern: /brown.*white/i, category: 'Brown & White' },
      { pattern: /tricolor/i, category: 'Tricolor' },
      { pattern: /brindle/i, category: 'Brindle' },
      { pattern: /exotic/i, category: 'Exotic Tones' },
      { pattern: /palomino/i, category: 'Palomino' },
      { pattern: /salt.*pepper/i, category: 'Salt & Pepper' },
      { pattern: /hereford/i, category: 'Hereford' },
      { pattern: /calfskin/i, category: 'Calfskins' },
      { pattern: /sheepskin/i, category: 'Sheepskins' },
      { pattern: /medium/i, category: 'Medium' },
      { pattern: /large/i, category: 'Large' },
      { pattern: /small/i, category: 'Small' }
    ];

    for (const { pattern, category } of patterns) {
      if (pattern.test(fileName) || pattern.test(filePath)) {
        return category;
      }
    }

    // Se não detectar, usar pasta pai ou genérico
    return 'Mixed Category';
  }

  // Obter estrutura de pastas para distribuição
  async getDestinationFolders(req, res) {
    try {
      console.log('📁 Getting destination folders...');
      
      const folderStructure = await localStorageService.getFolderStructure(true, false);
      
      res.status(200).json({
        success: true,
        folders: folderStructure
      });

    } catch (error) {
      console.error('❌ Error getting destination folders:', error);
      res.status(500).json({
        success: false,
        message: `Error getting folders: ${error.message}`
      });
    }
  }

  // Obter conteúdo detalhado de um shipment para distribuição
  async getShipmentContent(req, res) {
    try {
      const { shipmentId } = req.params;

      console.log(`📋 Getting shipment content for distribution: ${shipmentId}`);

      const shipment = await Shipment.findById(shipmentId);
      if (!shipment) {
        return res.status(404).json({
          success: false,
          message: 'Shipment not found'
        });
      }

      // Escanear pasta física para conteúdo atual
      const shipmentPath = shipment.folderPath;
      const categories = [];

      try {
        const items = await fs.readdir(shipmentPath, { withFileTypes: true });
        
        for (const item of items) {
          if (item.isDirectory()) {
            const categoryPath = path.join(shipmentPath, item.name);
            const files = await fs.readdir(categoryPath);
            const photoFiles = files.filter(f => f.endsWith('.webp'));
            
            if (photoFiles.length > 0) {
              categories.push({
                name: item.name,
                photoCount: photoFiles.length,
                photos: photoFiles.map(f => ({
                  name: f,
                  id: path.parse(f).name
                }))
              });
            }
          }
        }
      } catch (error) {
        console.error('Error scanning shipment folder:', error);
      }

      res.status(200).json({
        success: true,
        shipment: {
          ...shipment.toObject(),
          categories: categories
        }
      });

    } catch (error) {
      console.error('❌ Error getting shipment content:', error);
      res.status(500).json({
        success: false,
        message: `Error getting content: ${error.message}`
      });
    }
  }

  // Distribuir fotos do shipment para estoque
  async distributePhotos(req, res) {
    try {
      const { shipmentId } = req.body;
      const { distributions } = req.body; // { categoryName: destinationPath }

      console.log(`🚚 Distributing photos from shipment: ${shipmentId}`);
      console.log('Distribution mapping:', distributions);

      const shipment = await Shipment.findById(shipmentId);
      if (!shipment) {
        return res.status(404).json({
          success: false,
          message: 'Shipment not found'
        });
      }

      if (shipment.status !== 'warehouse') {
        return res.status(400).json({
          success: false,
          message: 'Shipment must be in warehouse to distribute'
        });
      }

      let totalMoved = 0;
      const results = {};

      // Processar cada categoria
      for (const [categoryName, destinationPath] of Object.entries(distributions)) {
        try {
          console.log(`📦 Moving ${categoryName} to ${destinationPath}`);

          const sourcePath = path.join(shipment.folderPath, categoryName);
          const fullDestinationPath = path.join('/opt/render/project/storage/cache/fotos/imagens-webp', destinationPath);

          // Verificar se pasta origem existe
          try {
            await fs.access(sourcePath);
          } catch {
            console.warn(`Source category not found: ${sourcePath}`);
            continue;
          }

          // Criar pasta destino se não existir
          await fs.mkdir(fullDestinationPath, { recursive: true });

          // Mover todas as fotos da categoria
          const files = await fs.readdir(sourcePath);
          const photoFiles = files.filter(f => f.endsWith('.webp'));

          let categoryMoved = 0;
          for (const file of photoFiles) {
            const sourceFile = path.join(sourcePath, file);
            const destFile = path.join(fullDestinationPath, file);

            try {
              await fs.copyFile(sourceFile, destFile);
              await fs.unlink(sourceFile);
              categoryMoved++;
              totalMoved++;
            } catch (fileError) {
              console.error(`Error moving file ${file}:`, fileError);
            }
          }

          results[categoryName] = {
            moved: categoryMoved,
            destination: destinationPath
          };

          // Remover pasta vazia se necessário
          try {
            const remainingFiles = await fs.readdir(sourcePath);
            if (remainingFiles.length === 0) {
              await fs.rmdir(sourcePath);
            }
          } catch (rmError) {
            console.warn('Could not remove empty category folder:', rmError);
          }

        } catch (categoryError) {
          console.error(`Error processing category ${categoryName}:`, categoryError);
          results[categoryName] = {
            moved: 0,
            error: categoryError.message
          };
        }
      }

      // Atualizar shipment
      shipment.processedPhotos = totalMoved;
      if (totalMoved >= shipment.totalPhotos) {
        shipment.status = 'completed';
        shipment.completedAt = new Date();
      }
      await shipment.save();

      // Rebuild do índice local para refletir as mudanças
      try {
        await localStorageService.rebuildIndex();
        console.log('✅ Local index rebuilt after distribution');
      } catch (indexError) {
        console.warn('Warning: Could not rebuild index:', indexError);
      }

      console.log(`✅ Distribution completed: ${totalMoved} photos moved`);

      res.status(200).json({
        success: true,
        totalMoved: totalMoved,
        results: results,
        message: `Successfully distributed ${totalMoved} photos`
      });

    } catch (error) {
      console.error('❌ Error distributing photos:', error);
      res.status(500).json({
        success: false,
        message: `Error distributing photos: ${error.message}`
      });
    }
  }

}

// Exportar instância
const shipmentController = new ShipmentController();

// Exportar métodos individuais
module.exports = {
  createShipment: shipmentController.createShipment.bind(shipmentController),
  listShipments: shipmentController.listShipments.bind(shipmentController),
  updateShipmentStatus: shipmentController.updateShipmentStatus.bind(shipmentController),
  getShipmentDetails: shipmentController.getShipmentDetails.bind(shipmentController),
  deleteShipment: shipmentController.deleteShipment.bind(shipmentController),
  uploadPhotos: shipmentController.uploadPhotos.bind(shipmentController),
  getDestinationFolders: shipmentController.getDestinationFolders.bind(shipmentController),
  getUploadMiddleware: shipmentController.getUploadMiddleware.bind(shipmentController),
  getShipmentContent: shipmentController.getShipmentContent.bind(shipmentController),
  distributePhotos: shipmentController.distributePhotos.bind(shipmentController)
};