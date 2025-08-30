const mongoose = require('mongoose');

const folderStatsSchema = new mongoose.Schema({
    folderPath: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    folderName: {
        type: String,
        required: true
    },
    totalPhotos: {
        type: Number,
        default: 0
    },
    availablePhotos: {
        type: Number,
        default: 0
    },
    soldPhotos: {
        type: Number,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Índice para busca rápida
folderStatsSchema.index({ folderPath: 1 });

module.exports = mongoose.model('FolderStats', folderStatsSchema);