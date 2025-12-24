// src/models/Feedback.js
const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    // Client info
    clientName: {
        type: String,
        required: true,
        trim: true
    },
    clientCode: {
        type: String,
        trim: true
    },

    // Feedback type
    type: {
        type: String,
        enum: ['suggestion', 'issue', 'question', 'praise', 'general'],
        default: 'general'
    },

    // Message content
    message: {
        type: String,
        trim: true
    },

    // Page where feedback was submitted
    page: {
        type: String,
        default: 'unknown'
    },

    // Status for admin tracking
    status: {
        type: String,
        enum: ['new', 'read', 'resolved', 'archived'],
        default: 'new'
    },

    // Admin notes
    adminNotes: {
        type: String,
        trim: true
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    readAt: Date,
    resolvedAt: Date
});

// Index for efficient queries
feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ type: 1, status: 1 });
feedbackSchema.index({ clientCode: 1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
