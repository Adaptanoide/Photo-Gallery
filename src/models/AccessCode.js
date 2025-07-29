//src/models/AccesCode.js

const mongoose = require('mongoose');

const accessCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        length: 4,
        match: /^\d{4}$/
    },
    clientName: {
        type: String,
        required: true,
        trim: true
    },
    clientEmail: {
        type: String,
        trim: true,
        lowercase: true
    },
    allowedCategories: [{
        type: String,
        required: true
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    },
    createdBy: {
        type: String,
        default: 'admin'
    },
    usageCount: {
        type: Number,
        default: 0
    },
    lastUsed: {
        type: Date
    }
}, {
    timestamps: true
});

accessCodeSchema.index({ code: 1 });
accessCodeSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('AccessCode', accessCodeSchema);