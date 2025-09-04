// src/models/ClientPermissionsCache.js
const mongoose = require('mongoose');

const clientPermissionsCacheSchema = new mongoose.Schema({
    clientCode: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    allowedPaths: [{
        type: String
    }],
    processedAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 30 * 60 * 1000) // 30 minutos
    }
});

// Índice para limpeza automática
clientPermissionsCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ClientPermissionsCache', clientPermissionsCacheSchema);