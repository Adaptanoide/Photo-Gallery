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
    status: {
        type: String,
        enum: ['available', 'reserved', 'sold'],
        default: 'available'
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
    reservedBy: {
        type: String
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

productSchema.index({ driveFileId: 1 });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ status: 1 });

module.exports = mongoose.model('Product', productSchema);
