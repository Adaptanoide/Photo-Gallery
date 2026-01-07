// src/models/CatalogProduct.js
/**
 * CATALOG PRODUCT MODEL - Sunshine Cowhides
 * ==========================================
 * Modelo para produtos de catálogo (Designer Rugs, Accessories, etc.)
 * Estes produtos são baseados em quantidade, não em foto individual.
 * NÃO participam do Mix & Match.
 */

const mongoose = require('mongoose');

const catalogProductSchema = new mongoose.Schema({
    // QBITEM from CDE - unique identifier
    qbItem: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Product name/description
    name: {
        type: String,
        required: true
    },

    // CDE category (DESIGNER RUG, ACCESORIOS, SHEEPSKIN, etc.)
    category: {
        type: String,
        default: 'General'
    },

    // Country of origin
    origin: {
        type: String,
        default: null
    },

    // Catalog category for product classification
    // IMPORTANT: Must match catalogCategory values in client-catalog.js MAIN_CATEGORIES
    displayCategory: {
        type: String,
        enum: [
            // Default/fallback
            'other',

            // Specialty Cowhides
            'printed',              // Printed Cowhides
            'metallic',             // Devore Metallic Cowhides
            'dyed',                 // Dyed Cowhides

            // Small Accent Hides
            'sheepskin',            // Sheepskins
            'calfskin',             // Calfskins
            'goatskin',             // Goatskins

            // Patchwork Rugs
            'chevron-rugs',         // Chevron Rugs
            'standard-patchwork',   // Square Rugs
            'runner-rugs',          // Runner Rugs
            'bedside-rugs',         // Bedside Rugs
            'special-patterns',     // Special Patterns (STRAW, STRIPES, TERNI, ROPE THREAD)

            // Accessories
            'pillows',              // Pillows
            'bags-purses',          // Bags & Purses
            'table-kitchen',        // Table & Kitchen
            'slippers',             // Slippers
            'scraps-diy',           // Scraps & DIY
            'gifts-seasonal',       // Gifts & Seasonal

            // Furniture
            'pouf-ottoman',         // Pouf / Ottoman
            'leather-furniture',    // Leather Furniture
            'foot-stool',           // Foot Stool

            // Legacy categories (for backwards compatibility)
            'designer-rugs',
            'accessories'
        ],
        default: 'other',
        index: true
    },

    // Current available stock from CDE (physical count)
    currentStock: {
        type: Number,
        default: 0,
        min: 0
    },

    // =====================================================
    // LOGICAL STOCK FIELDS - Para evitar double-booking
    // =====================================================

    // Quantidade reservada em carrinhos ativos
    reservedInCarts: {
        type: Number,
        default: 0,
        min: 0
    },

    // Quantidade confirmada em seleções (aguardando retirada)
    confirmedInSelections: {
        type: Number,
        default: 0,
        min: 0
    },

    // Estoque disponível para venda (calculado)
    // availableStock = currentStock - reservedInCarts - confirmedInSelections
    availableStock: {
        type: Number,
        default: 0,
        min: 0
    },

    // Timestamp da última sincronização do estoque lógico
    lastLogicalSync: {
        type: Date,
        default: null
    },

    // Base price (managed in price management, not from CDE)
    basePrice: {
        type: Number,
        default: 0,
        min: 0
    },

    // Product image URL (optional)
    imageUrl: {
        type: String,
        default: null
    },

    // Last sync timestamp from CDE
    lastCDESync: {
        type: Date,
        default: Date.now
    },

    // Product active status
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    collection: 'catalogproducts'
});

// Index for efficient queries
catalogProductSchema.index({ displayCategory: 1, currentStock: -1 });
catalogProductSchema.index({ category: 1 });
catalogProductSchema.index({ isActive: 1, currentStock: 1 });

// Virtual for formatted price
catalogProductSchema.virtual('formattedPrice').get(function() {
    if (this.basePrice > 0) {
        return `$${this.basePrice.toFixed(2)}`;
    }
    return 'Contact for price';
});

// Method to check if in stock (uses logical available stock)
catalogProductSchema.methods.isInStock = function() {
    return this.availableStock > 0;
};

// Method to calculate and update available stock
catalogProductSchema.methods.recalculateAvailableStock = function() {
    const physicalStock = this.currentStock || 0;
    const reservedInCarts = this.reservedInCarts || 0;
    const confirmedInSelections = this.confirmedInSelections || 0;

    this.availableStock = Math.max(0, physicalStock - reservedInCarts - confirmedInSelections);
    this.lastLogicalSync = new Date();

    return this.availableStock;
};

// Method to check if requested quantity is available
catalogProductSchema.methods.canReserve = function(requestedQty) {
    return this.availableStock >= requestedQty;
};

// Static method to get products by display category (uses available stock)
catalogProductSchema.statics.getByDisplayCategory = async function(displayCategory) {
    return this.find({
        displayCategory,
        availableStock: { $gt: 0 },
        isActive: true
    }).sort({ category: 1, name: 1 });
};

// Static method to update logical stock for a single qbItem
catalogProductSchema.statics.updateLogicalStock = async function(qbItem, reservedInCarts, confirmedInSelections) {
    const product = await this.findOne({ qbItem });
    if (!product) return null;

    product.reservedInCarts = reservedInCarts || 0;
    product.confirmedInSelections = confirmedInSelections || 0;
    product.recalculateAvailableStock();

    await product.save();
    return product;
};

module.exports = mongoose.model('CatalogProduct', catalogProductSchema);
