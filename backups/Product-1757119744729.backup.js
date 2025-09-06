//src/models/Product.js

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    driveFileId: {
        type: String,
        required: true,
        unique: true
    },
    fileName: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    subcategory: {
        type: String
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    thumbnailUrl: {
        type: String
    },
    webViewLink: {
        type: String
    },
    size: {
        type: Number
    },
    // ===== CAMPOS ÚNICOS (SEM DUPLICAÇÃO) =====
    status: {
        type: String,
        enum: ['available', 'reserved', 'reserved_pending', 'sold'],  // ← NOVO STATUS ADICIONADO
        default: 'available',
        index: true
    },
    reservedBy: {
        clientCode: {
            type: String,
            sparse: true
        },
        sessionId: {
            type: String,
            sparse: true
        },
        expiresAt: {
            type: Date,
            sparse: true
        }
    },
    cartAddedAt: {
        type: Date,
        sparse: true
    },
    reservedAt: {
        type: Date
    },
    soldAt: {
        type: Date
    }
}, {
    timestamps: true
});

// ===== ÍNDICES PARA PERFORMANCE =====
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index(
    { 'reservedBy.expiresAt': 1 },
    {
        expireAfterSeconds: 0,
        partialFilterExpression: { 'reservedBy.expiresAt': { $exists: true } }
    }
);
productSchema.index({ 'reservedBy.sessionId': 1 });
productSchema.index({ driveFileId: 1 });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ status: 1 });

module.exports = mongoose.model('Product', productSchema);
