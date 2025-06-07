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
  }]
});

module.exports = mongoose.model('CategoryAccess', CategoryAccessSchema);