// src/routes/db.js
const express = require('express');
const router = express.Router();
const CustomerCode = require('../models/customerCode');
const CategoryAccess = require('../models/categoryAccess');
const CategoryPrice = require('../models/categoryPrice');
const Order = require('../models/order');

// Obter uma coleção
router.get('/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    let data = [];
    
    switch (collection) {
      case 'customerCodes':
        data = await CustomerCode.find();
        break;
      case 'categoryAccess':
        data = await CategoryAccess.find();
        break;
      case 'categoryPrices':
        data = await CategoryPrice.find();
        break;
      case 'orders':
        data = await Order.find();
        break;
      default:
        return res.status(404).json({ error: 'Collection not found' });
    }
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter um documento específico
router.get('/:collection/:id', async (req, res) => {
  try {
    const { collection, id } = req.params;
    let data = null;
    
    switch (collection) {
      case 'customerCodes':
        data = await CustomerCode.findOne({ code: id });
        break;
      case 'categoryAccess':
        data = await CategoryAccess.findOne({ customerCode: id });
        break;
      case 'categoryPrices':
        data = await CategoryPrice.findOne({ folderId: id });
        break;
      case 'orders':
        data = await Order.findById(id);
        break;
      default:
        return res.status(404).json({ error: 'Collection not found' });
    }
    
    if (!data) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar um documento
router.patch('/:collection/:id', async (req, res) => {
  try {
    const { collection, id } = req.params;
    const updates = req.body;
    let result = null;
    
    switch (collection) {
      case 'customerCodes':
        result = await CustomerCode.findOneAndUpdate({ code: id }, updates, { new: true });
        break;
      case 'categoryAccess':
        result = await CategoryAccess.findOneAndUpdate({ customerCode: id }, updates, { new: true });
        break;
      case 'categoryPrices':
        result = await CategoryPrice.findOneAndUpdate({ folderId: id }, updates, { new: true });
        break;
      case 'orders':
        result = await Order.findByIdAndUpdate(id, updates, { new: true });
        break;
      default:
        return res.status(404).json({ error: 'Collection not found' });
    }
    
    if (!result) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;