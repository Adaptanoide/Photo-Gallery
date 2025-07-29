//src/models/Sales.js

const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
    saleId: {
        type: String,
        required: true,
        unique: true
    },
    accessCode: {
        type: String,
        required: true
    },
    clientName: {
        type: String,
        required: true
    },
    clientEmail: {
        type: String
    },
    products: [{
        driveFileId: String,
        fileName: String,
        category: String,
        price: Number
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'completed', 'cancelled'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['pix', 'card', 'transfer'],
        default: 'pix'
    },
    notes: {
        type: String
    }
}, {
    timestamps: true
});

saleSchema.index({ saleId: 1 });
saleSchema.index({ accessCode: 1 });
saleSchema.index({ status: 1 });

module.exports = mongoose.model('Sale', saleSchema);
