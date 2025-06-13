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
      const { name, status = "incoming-air", notes, departureDate, expectedArrival } = req.body;

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
        createdBy: "admin",
        departureDate: departureDate ? new Date(departureDate) : undefined,
        expectedArrival: expectedArrival ? new Date(expectedArrival) : undefined
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

  // Upload de fotos para shipment - VERSÃO COM DEBUG EXTENSIVO
  async uploadPhotos(req, res) {
    console.log('\n🚀 === SHIPMENT UPLOAD DEBUG START ===');
    console.log('📊 Request info:');
    console.log('   shipmentId:', req.params.shipmentId);
    console.log('   files count:', req.files?.length || 0);
    console.log('   body keys:', Object.keys(req.body));
    console.log('   filePathsJson exists:', !!req.body.filePathsJson);
    
    try {
      const { shipmentId } = req.params;
      const files = req.files;
      
      console.log('✅ Step 1: Variables initialized');

      if (!files || files.length === 0) {
        console.log('❌ No files received');
        return res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
      }

      console.log('✅ Step 2: Files validation passed');
      console.log(`📤 Processing ${files.length} files for shipment: ${shipmentId}`);

      const shipment = await Shipment.findById(shipmentId);
      if (!shipment) {
        console.log('❌ Shipment not found');
        return res.status(404).json({
          success: false,
          message: 'Shipment not found'
        });
      }

      console.log('✅ Step 3: Shipment found:', shipment.name);
      console.log('   folderPath:', shipment.folderPath);
      console.log('   status:', shipment.status);

      // Verificar se folderPath existe fisicamente
      try {
        await fs.access(shipment.folderPath);
        console.log('✅ Step 4: Shipment folder exists');
      } catch (accessError) {
        console.log('⚠️  Step 4: Shipment folder missing, creating...');
        try {
          await fs.mkdir(shipment.folderPath, { recursive: true });
          console.log('✅ Step 4b: Shipment folder created');
        } catch (mkdirError) {
          console.error('❌ Step 4b: Failed to create shipment folder:', mkdirError);
          return res.status(500).json({
            success: false,
            message: `Failed to create shipment folder: ${mkdirError.message}`
          });
        }
      }

      // Debug detalhado dos arquivos recebidos
      console.log('\n🔍 Step 5: Analyzing first 3 files...');
      files.slice(0, 3).forEach((file, index) => {
        console.log(`📁 File ${index + 1}:`);
        console.log(`   originalname: "${file.originalname}"`);
        console.log(`   size: ${file.size} bytes`);
        console.log(`   mimetype: "${file.mimetype}"`);
      });

      const categoriesData = {};
      let totalProcessed = 0;
      let debugStats = {
        detectedCategories: new Set(),
        failedDetections: 0,
        sharpErrors: 0,
        fsErrors: 0
      };

      console.log('\n🔍 Step 6: Starting file processing loop...');

      for (const file of files) {
        try {
          console.log(`\n📄 Processing file ${totalProcessed + 1}/${files.length}: ${file.originalname}`);
          
          let categoryName = 'Mixed Category'; // fallback
          let detectionMethod = 'fallback';

          // 🔧 SOLUÇÃO CORRIGIDA: Ler paths do novo formato JSON
          const fileIndex = files.indexOf(file);
          let filePaths = [];

          console.log(`   🔍 fileIndex: ${fileIndex}`);
          console.log(`   🔍 filePathsJson exists: ${!!req.body.filePathsJson}`);

          // Tentar ler do novo formato JSON primeiro
          if (req.body.filePathsJson) {
            try {
              filePaths = JSON.parse(req.body.filePathsJson);
              console.log(`   ✅ Parsed ${filePaths.length} paths from JSON`);
            } catch (parseError) {
              console.error('   ❌ Error parsing filePathsJson:', parseError.message);
              filePaths = [];
            }
          }
          // Fallback para formato antigo
          else if (req.body.filePaths) {
            filePaths = Array.isArray(req.body.filePaths) ? req.body.filePaths : [req.body.filePaths];
            console.log(`   ✅ Using legacy filePaths: ${filePaths.length} paths`);
          }

          const customPath = filePaths[fileIndex] || null;
          console.log(`   🔍 customPath: "${customPath}"`);

          // MÉTODO 1: Usar path customizado (enviado do frontend)
          if (customPath && customPath.includes('/')) {
            const pathParts = customPath.split('/');
            console.log(`   🔍 Custom path parts:`, pathParts);

            if (pathParts.length >= 2) {
              // Para "PASTA/5302B BR/foto.jpg" → pegar "5302B BR"
              categoryName = pathParts[pathParts.length - 2];
              detectionMethod = 'customPath';
              console.log(`   ✅ Detected category: "${categoryName}" from customPath`);
            }
          }

          // Estatísticas de debug
          if (categoryName === 'Mixed Category') {
            debugStats.failedDetections++;
            console.log(`   ⚠️  Failed to detect category for: ${file.originalname}`);
          } else {
            debugStats.detectedCategories.add(categoryName);
          }

          if (!categoriesData[categoryName]) {
            categoriesData[categoryName] = [];
          }

          console.log(`   🔄 Converting to WebP...`);
          
          // Converter para WebP se necessário
          let fileBuffer = file.buffer;
          try {
            if (file.mimetype !== 'image/webp') {
              fileBuffer = await sharp(file.buffer)
                .webp({ quality: 90, effort: 4 })
                .toBuffer();
              console.log(`   ✅ WebP conversion successful (${fileBuffer.length} bytes)`);
            } else {
              console.log(`   ✅ File already WebP, skipping conversion`);
            }
          } catch (sharpError) {
            console.error(`   ❌ Sharp conversion error:`, sharpError.message);
            debugStats.sharpErrors++;
            continue; // Skip this file
          }

          // Gerar nome único do arquivo
          const originalBaseName = path.parse(file.originalname.split('/').pop()).name;
          const fileName = `${originalBaseName}_${Date.now()}_${totalProcessed}.webp`;
          console.log(`   📝 Generated filename: ${fileName}`);

          // Salvar na pasta do shipment preservando estrutura
          const categoryPath = path.join(shipment.folderPath, categoryName);
          console.log(`   📁 Category path: ${categoryPath}`);
          
          try {
            await fs.mkdir(categoryPath, { recursive: true });
            console.log(`   ✅ Category folder created/verified`);
          } catch (mkdirError) {
            console.error(`   ❌ Failed to create category folder:`, mkdirError.message);
            debugStats.fsErrors++;
            continue; // Skip this file
          }

          const filePath = path.join(categoryPath, fileName);
          console.log(`   💾 Writing file to: ${filePath}`);
          
          try {
            await fs.writeFile(filePath, fileBuffer);
            console.log(`   ✅ File written successfully`);
          } catch (writeError) {
            console.error(`   ❌ Failed to write file:`, writeError.message);
            debugStats.fsErrors++;
            continue; // Skip this file
          }

          categoriesData[categoryName].push({
            originalName: file.originalname,
            fileName: fileName,
            size: fileBuffer.length,
            originalPath: customPath || file.originalname,
            detectionMethod: detectionMethod
          });

          totalProcessed++;
          console.log(`   ✅ File processed successfully (${totalProcessed}/${files.length})`);

        } catch (fileError) {
          console.error(`❌ Error processing file ${file.originalname}:`, fileError.message);
          console.error(`   Stack trace:`, fileError.stack);
        }
      }

      // Debug final
      console.log('\n📊 FINAL PROCESSING RESULTS:');
      console.log(`   Total files processed: ${totalProcessed}/${files.length}`);
      console.log(`   Categories detected: ${debugStats.detectedCategories.size}`);
      console.log(`   Category list: [${Array.from(debugStats.detectedCategories).join(', ')}]`);
      console.log(`   Failed detections: ${debugStats.failedDetections}`);
      console.log(`   Sharp errors: ${debugStats.sharpErrors}`);
      console.log(`   FS errors: ${debugStats.fsErrors}`);

      if (totalProcessed === 0) {
        console.log('❌ No files were processed successfully');
        return res.status(400).json({
          success: false,
          message: 'No files could be processed',
          debugInfo: debugStats
        });
      }

      // Atualizar shipment no banco
      const categories = Object.entries(categoriesData).map(([name, files]) => ({
        name,
        photoCount: files.length,
        processedPhotos: 0
      }));

      console.log('\n💾 Updating shipment in database...');
      try {
        shipment.categories = categories;
        shipment.totalPhotos = totalProcessed;
        await shipment.save();
        console.log('✅ Shipment updated in database');
      } catch (dbError) {
        console.error('❌ Failed to update shipment in database:', dbError.message);
        // Continue anyway, files are already saved
      }

      console.log(`\n🎉 Upload completed successfully!`);
      console.log(`   Processed: ${totalProcessed} photos`);
      console.log(`   Categories: ${categories.length}`);
      console.log('📁 Categories:', categories.map(c => `${c.name} (${c.photoCount} photos)`));

      res.status(200).json({
        success: true,
        processedPhotos: totalProcessed,
        categories: categories,
        debugInfo: {
          detectedCategories: Array.from(debugStats.detectedCategories),
          failedDetections: debugStats.failedDetections,
          sharpErrors: debugStats.sharpErrors,
          fsErrors: debugStats.fsErrors
        },
        message: `Successfully uploaded ${totalProcessed} photos in ${categories.length} folders`
      });

    } catch (error) {
      console.error('\n💥 CRITICAL ERROR in uploadPhotos:');
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
      
      res.status(500).json({
        success: false,
        message: `Error uploading photos: ${error.message}`,
        errorDetails: {
          name: error.name,
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
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

  // SUBSTITUA a função distributePhotos no shipmentController.js por esta versão corrigida:

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

          // 🔧 FIX: Converter path com "→" para estrutura de pasta real
          let realDestinationPath;
          if (destinationPath.includes('→')) {
            // Converter "1. Colombian Cowhides → 1. Medium → Black & White M"
            // Para: "1. Colombian Cowhides/1. Medium/Black & White M"
            realDestinationPath = destinationPath.replace(/\s*→\s*/g, '/');
            console.log(`🔄 Converted path: "${destinationPath}" → "${realDestinationPath}"`);
          } else {
            realDestinationPath = destinationPath;
          }

          const fullDestinationPath = path.join('/opt/render/project/storage/cache/fotos/imagens-webp', realDestinationPath);

          console.log(`📁 Source: ${sourcePath}`);
          console.log(`📁 Destination: ${fullDestinationPath}`);

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
              console.log(`✅ Moved: ${file}`);
            } catch (fileError) {
              console.error(`Error moving file ${file}:`, fileError);
            }
          }

          results[categoryName] = {
            moved: categoryMoved,
            destination: realDestinationPath, // Usar path real, não o com "→"
            originalDestination: destinationPath
          };

          console.log(`✅ Category ${categoryName}: ${categoryMoved} photos moved`);

          // Remover pasta vazia se necessário
          try {
            const remainingFiles = await fs.readdir(sourcePath);
            if (remainingFiles.length === 0) {
              await fs.rmdir(sourcePath);
              console.log(`🗑️ Removed empty source folder: ${sourcePath}`);
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
        shipment.status = 'warehouse';
        // Removido: shipment.completedAt = new Date();
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