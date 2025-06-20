// src/models/categoryAccess.js
const mongoose = require('mongoose');

const CategoryAccessSchema = new mongoose.Schema({
  customerCode: {
    type: String,
    required: true,
    unique: true
  },
  categoryAccess: [{
    categoryId: String,
    enabled: Boolean,
    customPrice: Number,
    minQuantityForDiscount: Number,
    discountPercentage: Number
  }],
  // 🆕 NOVO: Desconto por volume total do pedido
  volumeDiscounts: [{
    minQuantity: {
      type: Number,
      required: true
    },
    maxQuantity: {
      type: Number,
      default: null  // null = sem limite máximo
    },
    discountPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    }
  }]
});

module.exports = mongoose.model('CategoryAccess', CategoryAccessSchema);