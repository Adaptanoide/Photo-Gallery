// src/models/customerCode.js
const mongoose = require('mongoose');

const CustomerCodeSchema = new mongoose.Schema({
  code: { 
    type: String, 
    required: true, 
    unique: true 
  },
  customerName: { 
    type: String, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  lastAccess: {
    type: Date
  },
  lastUpdated: {
    type: Date
  },
  items: [{ 
    type: String 
  }],
  orderInProgress: {
    type: Boolean,
    default: false
  },
  orderCompleted: {
    type: Boolean,
    default: false
  },
  orderStatus: {
    type: String,
    enum: ['processing', 'waiting_payment', 'paid', null],
    default: null
  },
  orderDate: {
    type: Date
  }
});

module.exports = mongoose.model('CustomerCode', CustomerCodeSchema);