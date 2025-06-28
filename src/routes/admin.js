// routes/admin.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Admin login
router.post('/login', adminController.login);

// Generate customer code
router.post('/code', adminController.generateCustomerCode);

// Get active codes
router.get('/codes', adminController.getActiveCodes);

// Delete client codes
router.delete('/code/:code', adminController.deleteCustomerCode);

// Rotas para gerenciamento de preços
router.get('/folders/leaf', adminController.getLeafFolders);
router.get('/folders/leaf-pricing', adminController.getLeafFoldersForPricing);
router.get('/categories/prices', adminController.getCategoryPrices);
router.post('/categories/:folderId/price', adminController.setCategoryPrice);
router.post('/categories/:folderId/qbitem', adminController.setQBItem);
router.post('/categories/batch-update', adminController.bulkUpdatePrices);

// Obter configurações de acesso a categorias para um cliente
router.get('/customers/:code/category-access', adminController.getCustomerCategoryAccess);

// Salvar configurações de acesso a categorias para um cliente
router.post('/customers/:code/category-access', adminController.saveCustomerCategoryAccess);

// NOVA ROTA: Movimentação de fotos
router.post('/photos/move', adminController.movePhotos);

// ROTAS DE EXCLUSÃO
router.post('/photos/delete', adminController.deletePhotos);
router.post('/folders/delete', adminController.deleteFolder);

// ROTA DE UPLOAD
router.post('/photos/upload', adminController.uploadPhotos);

// ==== SHIPMENT MANAGEMENT ROUTES ====
const shipmentController = require('../controllers/shipmentController');

// Listar shipments
router.get('/shipments', shipmentController.listShipments);

// Criar novo shipment
router.post('/shipments', shipmentController.createShipment);

// Obter detalhes de um shipment específico
router.get('/shipments/:shipmentId', shipmentController.getShipmentDetails);

// Atualizar status do shipment (Air → Sea → Warehouse)
router.put('/shipments/:shipmentId/status', shipmentController.updateShipmentStatus);

// Deletar shipment
router.delete('/shipments/:shipmentId', shipmentController.deleteShipment);

// Upload de fotos para shipment
router.post('/shipments/:shipmentId/upload',
  (req, res, next) => {
    const upload = shipmentController.getUploadMiddleware();
    upload.array('photos', 1000)(req, res, next);
  },
  shipmentController.uploadPhotos
);

// Obter pastas disponíveis para distribuição
router.get('/shipments/destination/folders', shipmentController.getDestinationFolders);

// Obter conteúdo detalhado do shipment para distribuição
router.get('/shipments/:shipmentId/content', shipmentController.getShipmentContent);

// Distribuir fotos do shipment para estoque final
router.post('/shipments/distribute', shipmentController.distributePhotos);

// DEBUG CategoryAccess (ADICIONAR AQUI)
router.get('/debug/8290', async (req, res) => {
  const CategoryAccess = require('../models/categoryAccess');
  const records = await CategoryAccess.find({ customerCode: "8290" });
  res.json({
    total: records.length,
    records: records.map(r => ({
      id: r._id,
      customerCode: r.customerCode,
      accessCount: r.categoryAccess.length,
      firstAccess: r.categoryAccess[0] || null
    }))
  });
});

router.post('/force-rebuild-index', adminController.forceRebuildIndex);

module.exports = router;