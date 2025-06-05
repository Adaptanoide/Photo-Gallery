// routes/shipments.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const shipmentController = require('../controllers/shipmentController');

// Configurar multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB por arquivo
    files: 1000 // Máximo 1000 arquivos por upload
  },
  fileFilter: (req, file, cb) => {
    // Aceitar apenas imagens
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Listar shipments
router.get('/', shipmentController.listShipments);

// Criar novo shipment
router.post('/', shipmentController.createShipment);

// Obter detalhes de um shipment
router.get('/:shipmentId', shipmentController.getShipmentDetails);

// Atualizar status do shipment
router.put('/:shipmentId/status', shipmentController.updateShipmentStatus);

// Upload de fotos para shipment (usando multer)
router.post('/:shipmentId/upload', upload.array('photos'), shipmentController.processShipmentUpload);

// Distribuir fotos do warehouse para estoque final
router.post('/:shipmentId/distribute', shipmentController.distributePhotos);

// Obter estrutura de pastas disponíveis para distribuição
router.get('/destination/folders', shipmentController.getDestinationFolders);

module.exports = router;