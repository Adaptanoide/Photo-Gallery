// route/order.js
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Enviar pedido
router.post('/', orderController.submitOrder);

// Listar pastas de pedidos
router.get('/folders', orderController.listOrderFolders);

// Atualizar status do pedido
router.put('/status', orderController.updateOrderStatus);

// Obter detalhes de um pedido específico
router.get('/details', orderController.getOrderDetails);

// Rota para servir imagens em alta resolução
router.get('/highres-image/:fileId', orderController.getHighResImage);

// Rota para servir thumbnails
router.get('/thumbnail/:fileId', orderController.getThumbnail);

// CDE
router.post('/confirm-payment', orderController.confirmPaymentFromCDE);

router.post('/return-to-stock', orderController.processReturnToStock);


module.exports = router;