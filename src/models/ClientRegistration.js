// src/models/ClientRegistration.js

const mongoose = require('mongoose');

const clientRegistrationSchema = new mongoose.Schema({
    // ===== DADOS DO CONTATO =====
    contactName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },

    // ===== DADOS DA EMPRESA =====
    companyName: {
        type: String,
        required: true,
        trim: true
    },
    businessType: {
        type: String,
        required: true,
        enum: ['retailer', 'wholesaler', 'designer', 'manufacturer', 'decorator', 'other'],
        default: 'retailer'
    },
    businessTypeOther: {
        type: String,
        trim: true
    },

    // ===== ENDEREÇO =====
    city: {
        type: String,
        required: true,
        trim: true
    },
    state: {
        type: String,
        required: true,
        trim: true
    },
    country: {
        type: String,
        required: true,
        default: 'United States'
    },

    // ===== INTERESSE =====
    interestMessage: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    howDidYouHear: {
        type: String,
        enum: ['google', 'instagram', 'facebook', 'referral', 'trade_show', 'sales_rep', 'other', ''],
        default: ''
    },
    referredBy: {
        type: String,
        trim: true
    },

    // ===== STATUS DO CADASTRO =====
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },

    // ===== DADOS DE APROVAÇÃO =====
    approvedAt: Date,
    approvedBy: String,
    assignedCode: String,
    assignedCategories: [String],

    // ===== DADOS DE REJEIÇÃO =====
    rejectedAt: Date,
    rejectedBy: String,
    rejectionReason: String,

    // ===== METADADOS =====
    ipAddress: String,
    userAgent: String,
    submittedAt: {
        type: Date,
        default: Date.now
    },
    adminNotes: String

}, {
    timestamps: true
});

// ===== ÍNDICES =====
clientRegistrationSchema.index({ status: 1 });
clientRegistrationSchema.index({ email: 1 });
clientRegistrationSchema.index({ submittedAt: -1 });

// ===== MÉTODOS =====
clientRegistrationSchema.methods.approve = function(adminUser, accessCode, categories = []) {
    this.status = 'approved';
    this.approvedAt = new Date();
    this.approvedBy = adminUser;
    this.assignedCode = accessCode;
    this.assignedCategories = categories;
    return this;
};

clientRegistrationSchema.methods.reject = function(adminUser, reason = '') {
    this.status = 'rejected';
    this.rejectedAt = new Date();
    this.rejectedBy = adminUser;
    this.rejectionReason = reason;
    return this;
};

// ===== STATICS =====
clientRegistrationSchema.statics.countPending = function() {
    return this.countDocuments({ status: 'pending' });
};

clientRegistrationSchema.statics.findPending = function() {
    return this.find({ status: 'pending' }).sort({ submittedAt: -1 });
};

clientRegistrationSchema.statics.emailExists = async function(email) {
    const existing = await this.findOne({ 
        email: email.toLowerCase(),
        status: { $in: ['pending', 'approved'] }
    });
    return !!existing;
};

module.exports = mongoose.model('ClientRegistration', clientRegistrationSchema);