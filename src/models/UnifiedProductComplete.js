// src/models/UnifiedProductComplete.js
const mongoose = require('mongoose');

const unifiedProductCompleteSchema = new mongoose.Schema({
    // ===== IDENTIFICAÇÃO PRINCIPAL (IDH como chave) =====
    idhCode: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    photoNumber: {
        type: String,
        required: true,
        index: true
    },
    fileName: {
        type: String,
        required: true
    },

    // ===== COMPATIBILIDADE LEGACY (para não quebrar nada) =====
    driveFileId: {  // Product usa isso 20x em cart.js!
        type: String,
        required: true,
        index: true
    },
    photoId: {  // PhotoStatus usa isso 46x em special-selection-builder.js!
        type: String,
        required: true,
        index: true
    },

    // ===== LOCALIZAÇÃO R2 =====
    r2Path: String,
    category: {
        type: String,
        required: true,
        index: true
    },
    subcategory: String,
    thumbnailUrl: String,
    webViewLink: String,
    size: Number,

    // ===== STATUS COMPLETO (todos os tipos) =====
    status: {  // Product.status (compatibilidade)
        type: String,
        enum: ['available', 'reserved', 'reserved_pending', 'sold', 'unavailable'], // ADICIONADO unavailable
        default: 'available',
        index: true
    },
    currentStatus: {  // PhotoStatus.currentStatus (compatibilidade)
        type: String,
        enum: ['available', 'reserved', 'locked', 'moved', 'sold', 'archived', 'unavailable'], // ADICIONADO unavailable
        default: 'available',
        index: true
    },
    cdeStatus: {
        type: String,
        enum: ['INGRESADO', 'PRE-SELECTED', 'RETIRADO', 'RESERVED', 'STANDBY', null],
        default: null,
        index: true
    },

    // ===== LOCALIZAÇÃO ATUAL (PhotoStatus) =====
    currentLocation: {
        locationType: {
            type: String,
            enum: ['stock', 'cart', 'special_selection', 'sold_folder', 'archived'],
            default: 'stock'
        },
        currentPath: String,
        currentParentId: String,
        currentCategory: String,
        specialSelectionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Selection'
        },
        cartSessionId: String,
        lastMovedAt: Date
    },

    // ===== LOCALIZAÇÃO ORIGINAL (backup) =====
    originalLocation: {
        originalPath: String,
        originalParentId: String,
        originalCategory: String,
        originalPrice: Number
    },

    // ===== SISTEMA DE LOCK (admin) =====
    lockInfo: {
        isLocked: { type: Boolean, default: false, index: true },
        lockedBy: String,
        lockedAt: Date,
        lockExpiresAt: { type: Date, index: true },
        lockReason: {
            type: String,
            enum: ['editing', 'moving', 'processing', 'manual']
        },
        lockMetadata: Object
    },

    // ===== RESERVA (Product + PhotoStatus) =====
    reservedBy: {  // Product.reservedBy (compatibilidade)
        clientCode: { type: String, index: true },
        sessionId: { type: String, index: true },
        expiresAt: {
            type: Date,
            index: { expireAfterSeconds: 0 }  // TTL automático!
        }
    },

    // ===== SELEÇÃO CONFIRMADA =====
    selectionId: {
        type: String,
        index: true,
        sparse: true  // Permite que seja null/undefined para a maioria dos produtos
    },

    reservationInfo: {  // PhotoStatus.reservationInfo
        isReserved: { type: Boolean, default: false, index: true },
        reservedBy: {
            clientCode: String,
            clientName: String,
            sessionId: String
        },
        reservedAt: Date,
        reservationExpiresAt: { type: Date, index: true },
        renewalCount: { type: Number, default: 0 }
    },

    // ===== SISTEMA DE TAGS VIRTUAL (PhotoStatus) =====
    virtualStatus: {
        status: {
            type: String,
            enum: ['available', 'reserved', 'sold', 'unavailable'], // ADICIONADO unavailable
            default: 'available',
            index: true
        },
        currentSelection: { type: String, index: true },
        clientCode: String,
        tags: [{ type: String, index: true }],
        lastStatusChange: Date
    },

    // ===== PREÇOS =====
    price: {  // Product.price (compatibilidade)
        type: Number,
        default: 0,
        min: 0
    },
    currentPricing: {  // PhotoStatus.currentPricing
        currentPrice: { type: Number, default: 0 },
        hasPrice: { type: Boolean, default: false },
        priceSource: {
            type: String,
            enum: ['category', 'custom', 'special_selection', 'discount']
        },
        formattedPrice: String,
        priceUpdatedAt: Date
    },
    basePrice: Number,
    qbItem: String,

    // ===== METADADOS =====
    metadata: {
        fileType: {
            type: String,
            enum: ['jpg', 'jpeg', 'png', 'webp'],
            default: 'webp'
        },
        fileSize: Number,
        dimensions: {
            width: Number,
            height: Number
        },
        tags: [String],
        quality: {
            type: String,
            enum: ['premium', 'standard', 'basic'],
            default: 'standard'
        },
        popularity: {
            viewCount: { type: Number, default: 0 },
            reservationCount: { type: Number, default: 0 },
            lastViewedAt: Date
        },
        adminNotes: String
    },

    // ===== HISTÓRICO (importante!) =====
    statusHistory: [{
        action: {
            type: String,
            enum: ['created', 'moved', 'reserved', 'unreserved', 'locked',
                'unlocked', 'price_updated', 'sold', 'archived', 'restored']
        },
        previousStatus: String,
        newStatus: String,
        actionDetails: String,
        performedBy: String,
        performedByType: {
            type: String,
            enum: ['admin', 'client', 'system']
        },
        timestamp: { type: Date, default: Date.now },
        metadata: Object
    }],

    // ===== DATAS (Product) =====
    cartAddedAt: Date,
    reservedAt: Date,
    soldAt: Date,

    // ===== SYNC CDE =====
    lastCDESync: Date,
    syncedFromCDE: Boolean,

    // ===== CONTROLE =====
    isActive: { type: Boolean, default: true },
    migrated: { type: Boolean, default: false },
    migratedFrom: String

}, {
    timestamps: true,
    collection: 'unified_products_complete'
});

// ===== TODOS OS ÍNDICES NECESSÁRIOS =====
unifiedProductCompleteSchema.index({ status: 1, category: 1 });
unifiedProductCompleteSchema.index({ currentStatus: 1, 'currentLocation.locationType': 1 });
unifiedProductCompleteSchema.index({ 'virtualStatus.status': 1, 'virtualStatus.clientCode': 1 });
unifiedProductCompleteSchema.index({ 'lockInfo.isLocked': 1, 'lockInfo.lockExpiresAt': 1 });
unifiedProductCompleteSchema.index({ 'reservationInfo.isReserved': 1 });
unifiedProductCompleteSchema.index({ cdeStatus: 1, lastCDESync: 1 });

module.exports = mongoose.model('UnifiedProductComplete', unifiedProductCompleteSchema);