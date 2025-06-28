// src/models/categoryPrice.js
const mongoose = require('mongoose');

const CategoryPriceSchema = new mongoose.Schema({
  folderId: {
    type: String,
    required: true,
    unique: true
  },
  name: String,
  price: Number,
  qbItem: {
    type: String,
    default: null,
    trim: true,
    uppercase: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  path: String
});

module.exports = mongoose.model('CategoryPrice', CategoryPriceSchema);