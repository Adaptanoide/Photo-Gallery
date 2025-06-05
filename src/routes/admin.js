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
router.get('/categories/prices', adminController.getCategoryPrices);
router.post('/categories/:folderId/price', adminController.setCategoryPrice);
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

module.exports = router;