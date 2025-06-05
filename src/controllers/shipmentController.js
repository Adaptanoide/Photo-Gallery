// controllers/shipmentController.js
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const Shipment = require('../models/shipment');
const localStorageService = require('../services/localStorageService');

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
        createdBy: req.user || 'admin'
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

  // Listar shipments por status
  async listShipments(req, res) {
    try {
      const { status } = req.query;
      
      console.log(`📋 Listando shipments com status: ${status || 'all'}`);

      const query = status ? { status } : {};
      const shipments = await Shipment.find(query)
        .sort({ uploadDate: -1 });

      const shipmentsWithDetails = shipments.map(shipment => ({
        id: shipment._id,
        name: shipment.name,
        status: shipment.status,
        uploadDate: shipment.uploadDate,
        statusUpdatedAt: shipment.statusUpdatedAt,
        totalPhotos: shipment.totalPhotos,
        processedPhotos: shipment.processedPhotos,
        categories: shipment.categories,
        progress: shipment.totalPhotos > 0 
          ? Math.round((shipment.processedPhotos / shipment.totalPhotos) * 100)
          : 0
      }));

      console.log(`📋 Encontrados ${shipmentsWithDetails.length} shipments`);

      res.status(200).json({
        success: true,
        shipments: shipmentsWithDetails
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

      if (!shipmentId || !newStatus) {
        return res.status(400).json({
          success: false,
          message: 'Shipment ID and new status are required'
        });
      }

      console.log(`🔄 Atualizando shipment ${shipmentId} para status: ${newStatus}`);

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

      console.log(`✅ Status atualizado: ${shipment.name} → ${newStatus}`);

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

  // Processar upload de fotos para shipment
  async processShipmentUpload(req, res) {
    try {
      const { shipmentId } = req.params;
      const uploadedFiles = req.files; // Assumindo multer

      if (!uploadedFiles || uploadedFiles.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
      }

      console.log(`📤 Processando upload para shipment: ${shipmentId}`);

      const shipment = await Shipment.findById(shipmentId);
      if (!shipment) {
        return res.status(404).json({
          success: false,
          message: 'Shipment not found'
        });
      }

      // Processar cada arquivo
      const processedCategories = {};
      let totalProcessed = 0;

      for (const file of uploadedFiles) {
        // Detectar categoria baseada no caminho do arquivo
        const categoryName = this.detectCategoryFromFile(file);
        
        if (!processedCategories[categoryName]) {
          processedCategories[categoryName] = 0;
        }

        // Converter para WebP se necessário
        const webpBuffer = await this.convertToWebP(file.buffer);
        
        // Salvar na pasta do shipment
        const categoryPath = path.join(shipment.folderPath, categoryName);
        await fs.mkdir(categoryPath, { recursive: true });
        
        const fileName = `${file.originalname.split('.')[0]}.webp`;
        const filePath = path.join(categoryPath, fileName);
        
        await fs.writeFile(filePath, webpBuffer);
        
        processedCategories[categoryName]++;
        totalProcessed++;
      }

      // Atualizar shipment no banco
      const categories = Object.entries(processedCategories).map(([name, count]) => ({
        name,
        photoCount: count
      }));

      shipment.categories = categories;
      shipment.totalPhotos = totalProcessed;
      await shipment.save();

      console.log(`✅ Upload processado: ${totalProcessed} fotos em ${categories.length} categorias`);

      res.status(200).json({
        success: true,
        processedPhotos: totalProcessed,
        categories: categories,
        message: `Successfully processed ${totalProcessed} photos`
      });

    } catch (error) {
      console.error('❌ Error processing upload:', error);
      res.status(500).json({
        success: false,
        message: `Error processing upload: ${error.message}`
      });
    }
  }

  // SMART DETECTION: Detectar categoria baseada na estrutura existente
  detectCategoryFromFile(file) {
    const fileName = file.originalname.toLowerCase();
    const filePath = file.path || '';

    // Padrões baseados na estrutura que você tem
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
      { pattern: /sheepskin/i, category: 'Sheepskins' }
    ];

    for (const { pattern, category } of patterns) {
      if (pattern.test(fileName) || pattern.test(filePath)) {
        return category;
      }
    }

    // Se não detectar, usar pasta pai ou genérico
    return 'Uncategorized';
  }

  // Converter imagem para WebP
  async convertToWebP(buffer) {
    try {
      return await sharp(buffer)
        .webp({ quality: 90, effort: 4 })
        .toBuffer();
    } catch (error) {
      console.warn('WebP conversion failed, using original:', error.message);
      return buffer;
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

      // Escanear pasta física para informações atualizadas
      const shipmentPath = shipment.folderPath;
      const updatedCategories = [];

      try {
        const items = await fs.readdir(shipmentPath, { withFileTypes: true });
        
        for (const item of items) {
          if (item.isDirectory()) {
            const categoryPath = path.join(shipmentPath, item.name);
            const files = await fs.readdir(categoryPath);
            const photoCount = files.filter(f => f.endsWith('.webp')).length;
            
            updatedCategories.push({
              name: item.name,
              photoCount: photoCount
            });
          }
        }
      } catch (error) {
        console.warn('Error scanning shipment folder:', error);
      }

      res.status(200).json({
        success: true,
        shipment: {
          ...shipment.toObject(),
          categories: updatedCategories.length > 0 ? updatedCategories : shipment.categories
        }
      });

    } catch (error) {
      console.error('❌ Error getting shipment details:', error);
      res.status(500).json({
        success: false,
        message: `Error getting details: ${error.message}`
      });
    }
  }
}

module.exports = new ShipmentController();