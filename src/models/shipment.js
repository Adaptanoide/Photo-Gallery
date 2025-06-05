// src/models/shipment.js
const mongoose = require('mongoose');

const ShipmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true  // "COURO & ARTE S21 1940-2025 250un"
  },
  status: {
    type: String,
    enum: ['incoming-air', 'incoming-sea', 'warehouse', 'processing', 'completed'],
    default: 'incoming-air'
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  statusUpdatedAt: {
    type: Date,
    default: Date.now
  },
  categories: [{
    name: String,           // "Black & White"
    photoCount: Number,     // 45
    processedPhotos: {      // Para controle de distribuição
      type: Number,
      default: 0
    }
  }],
  totalPhotos: {
    type: Number,
    default: 0
  },
  processedPhotos: {
    type: Number,
    default: 0
  },
  folderId: String,        // ID único da pasta física
  folderPath: String,      // Caminho completo da pasta
  notes: String,           // Observações do admin
  completedAt: Date,       // Quando foi totalmente distribuído
  createdBy: String        // Admin que fez upload
});

// Middleware para atualizar statusUpdatedAt
ShipmentSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.statusUpdatedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Shipment', ShipmentSchema);