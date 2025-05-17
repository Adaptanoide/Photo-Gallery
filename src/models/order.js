// src/models/order.js
const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  customerCode: {
    type: String,
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  photoIds: [{
    type: String
  }],
  comments: String,
  status: {
    type: String,
    enum: ['processing', 'waiting_payment', 'failed', 'paid'],
    default: 'processing'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  processedAt: Date,
  folderName: String,
  folderId: String,
  error: String
});

module.exports = mongoose.model('Order', OrderSchema);