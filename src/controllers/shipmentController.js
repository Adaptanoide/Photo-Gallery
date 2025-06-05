// controllers/shipmentController.js
const fs = require('fs').promises;
const path = require('path');
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

}

// Exportar instância
const shipmentController = new ShipmentController();

// Exportar métodos individuais
module.exports = {
  createShipment: shipmentController.createShipment.bind(shipmentController),
  listShipments: shipmentController.listShipments.bind(shipmentController),
  updateShipmentStatus: shipmentController.updateShipmentStatus.bind(shipmentController),
  getShipmentDetails: shipmentController.getShipmentDetails.bind(shipmentController)
};