//src/models/PhotoCategory.js

const mongoose = require('mongoose');

const photoCategorySchema = new mongoose.Schema({
    // Identificação única da pasta no Google Drive
    googleDriveId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Caminho completo no Google Drive
    googleDrivePath: {
        type: String,
        required: true
    },

    // Nome para exibição no admin (ex: "Colombian → Medium → Brown & White M")
    displayName: {
        type: String,
        required: true
    },

    // QB Item code for QuickBooks integration
    qbItem: {
        type: String,
        trim: true,
        default: ''
    },

    // Nome original da pasta
    folderName: {
        type: String,
        required: true
    },

    // Quantidade de fotos na pasta
    photoCount: {
        type: Number,
        required: true,
        min: 0 // Só pastas com fotos
    },

    // Preço base da categoria
    basePrice: {
        type: Number,
        default: 0,
        min: 0
    },

    // Modo de precificação ativo para esta categoria
    pricingMode: {
        type: String,
        enum: ['base', 'client', 'quantity'],
        default: 'base',
        index: true
    },

    // Status da categoria
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },

    // Metadados da pasta
    metadata: {
        parentIds: [String], // IDs das pastas pai
        level: {
            type: Number,
            min: 1,
            max: 10
        },
        modifiedTime: Date
    },

    // Última sincronização com Google Drive
    lastSync: {
        type: Date,
        default: Date.now,
        index: true
    },

    // Regras de desconto específicas para esta categoria
    discountRules: [{
        clientCode: {
            type: String,
            length: 4
        },
        clientName: String,
        discountPercent: {
            type: Number,
            min: 0,
            max: 100
        },
        customPrice: {
            type: Number,
            min: 0
        },
        isActive: {
            type: Boolean,
            default: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],

    // Histórico de mudanças de preço
    priceHistory: [{
        oldPrice: Number,
        newPrice: Number,
        changedBy: String, // Username do admin
        changedAt: {
            type: Date,
            default: Date.now
        },
        reason: String
    }]
}, {
    timestamps: true
});

// ===== ÍNDICES PARA PERFORMANCE =====
photoCategorySchema.index({ googleDrivePath: 1 });
photoCategorySchema.index({ isActive: 1, photoCount: -1 });
photoCategorySchema.index({ basePrice: 1 });
photoCategorySchema.index({ 'discountRules.clientCode': 1 });

// ===== MÉTODOS DO SCHEMA =====

// Método para obter preço baseado no modo ativo da categoria
photoCategorySchema.methods.getPriceForClient = async function (clientCode, quantity = 1) {
    console.log(`🎛️ Pricing Mode: ${this.pricingMode} for category: ${this.displayName}`);

    switch (this.pricingMode) {
        case 'client':
            return this.getClientSpecificPrice(clientCode);

        case 'quantity':
            return await this.getQuantityBasedPrice(quantity);

        case 'base':
        default:
            return this.getBasePrice();
    }
};

// Preço específico por cliente
photoCategorySchema.methods.getClientSpecificPrice = function (clientCode) {
    const clientRule = this.discountRules.find(rule =>
        rule.clientCode === clientCode && rule.isActive
    );

    if (clientRule) {
        if (clientRule.customPrice && clientRule.customPrice > 0) {
            return {
                finalPrice: clientRule.customPrice,
                appliedRule: 'client-custom-price',
                ruleDetails: clientRule,
                basePrice: this.basePrice
            };
        }

        if (clientRule.discountPercent > 0) {
            const discount = (this.basePrice * clientRule.discountPercent) / 100;
            const finalPrice = Math.max(0, this.basePrice - discount);
            return {
                finalPrice,
                appliedRule: 'client-discount',
                ruleDetails: clientRule,
                basePrice: this.basePrice
            };
        }
    }

    // Se modo é 'client' mas não há regra, retornar base price
    return this.getBasePrice();
};

// Preço baseado em quantidade
photoCategorySchema.methods.getQuantityBasedPrice = async function (quantity) {
    try {
        const QuantityDiscount = require('./QuantityDiscount');
        const quantityDiscount = await QuantityDiscount.calculateDiscount(quantity);

        if (quantityDiscount.discountPercent > 0) {
            const discount = (this.basePrice * quantityDiscount.discountPercent) / 100;
            const finalPrice = Math.max(0, this.basePrice - discount);
            return {
                finalPrice,
                appliedRule: 'quantity-discount',
                ruleDetails: quantityDiscount,
                basePrice: this.basePrice
            };
        }
    } catch (error) {
        console.error('❌ Error calculating quantity discount:', error);
    }

    return this.getBasePrice();
};

// Preço base padrão
photoCategorySchema.methods.getBasePrice = function () {
    return {
        finalPrice: this.basePrice,
        appliedRule: 'base-price',
        ruleDetails: null,
        basePrice: this.basePrice
    };
};

// Método para adicionar regra de desconto
photoCategorySchema.methods.addDiscountRule = function (clientCode, clientName, options = {}) {
    // Remover regra existente se houver
    this.discountRules = this.discountRules.filter(rule => rule.clientCode !== clientCode);

    // Adicionar nova regra
    const newRule = {
        clientCode,
        clientName,
        discountPercent: options.discountPercent || 0,
        customPrice: options.customPrice || null,
        isActive: true
    };

    this.discountRules.push(newRule);
    return newRule;
};

// Método para atualizar preço com histórico
photoCategorySchema.methods.updatePrice = function (newPrice, adminUser, reason = '') {
    // Adicionar ao histórico
    this.priceHistory.push({
        oldPrice: this.basePrice,
        newPrice: newPrice,
        changedBy: adminUser,
        reason: reason
    });

    // Atualizar preço
    this.basePrice = newPrice;
};

// Método para obter resumo da categoria
photoCategorySchema.methods.getSummary = function () {
    return {
        id: this._id,
        googleDriveId: this.googleDriveId,
        displayName: this.displayName,
        cleanDisplayName: this.getCleanDisplayName(),
        folderName: this.folderName,
        qbItem: this.qbItem || '',
        photoCount: this.photoCount,
        basePrice: this.basePrice,
        pricingMode: this.pricingMode,
        hasDiscountRules: this.discountRules.length > 0,
        activeDiscountRules: this.discountRules.filter(r => r.isActive).length,
        isActive: this.isActive,
        lastSync: this.lastSync
    };
};

// Método para obter displayName sem o prefixo "Sunshine Cowhides Actual Pictures"
photoCategorySchema.methods.getCleanDisplayName = function () {
    if (!this.displayName) return '';

    const prefixToRemove = 'Sunshine Cowhides Actual Pictures →';
    if (this.displayName.startsWith(prefixToRemove)) {
        return this.displayName.substring(prefixToRemove.length).trim();
    }

    return this.displayName;
};

// ===== MÉTODOS ESTÁTICOS =====

// Buscar categoria por ID do Google Drive
photoCategorySchema.statics.findByDriveId = function (googleDriveId) {
    return this.findOne({ googleDriveId, isActive: true });
};

// Buscar categorias por caminho (busca parcial)
photoCategorySchema.statics.findByPath = function (partialPath) {
    return this.find({
        googleDrivePath: { $regex: partialPath, $options: 'i' },
        isActive: true
    }).sort({ googleDrivePath: 1 });
};

// Buscar todas as categorias com preço
photoCategorySchema.statics.findWithPricing = function () {
    return this.find({
        isActive: true,
        photoCount: { $gt: 0 }
    }).sort({ displayName: 1 });
};

// Buscar categorias que precisam de sincronização
photoCategorySchema.statics.findNeedingSync = function (hoursOld = 24) {
    const cutoff = new Date(Date.now() - (hoursOld * 60 * 60 * 1000));
    return this.find({
        lastSync: { $lt: cutoff },
        isActive: true
    });
};

// Estatísticas de preços
photoCategorySchema.statics.getPricingStats = async function () {
    const stats = await this.aggregate([
        { $match: { isActive: true, photoCount: { $gte: 0 } } },
        {
            $group: {
                _id: null,
                totalCategories: { $sum: 1 },
                totalPhotos: { $sum: '$photoCount' },
                categoriesWithPrice: {
                    $sum: { $cond: [{ $gt: ['$basePrice', 0] }, 1, 0] }
                },
                categoriesWithoutPrice: {
                    $sum: { $cond: [{ $eq: ['$basePrice', 0] }, 1, 0] }
                },
                averagePrice: { $avg: '$basePrice' },
                minPrice: { $min: '$basePrice' },
                maxPrice: { $max: '$basePrice' },
                totalDiscountRules: { $sum: { $size: '$discountRules' } }
            }
        }
    ]);

    return stats[0] || {
        totalCategories: 0,
        totalPhotos: 0,
        categoriesWithPrice: 0,
        categoriesWithoutPrice: 0,
        averagePrice: 0,
        minPrice: 0,
        maxPrice: 0,
        totalDiscountRules: 0
    };
};

// ===== MIDDLEWARE =====

// Pre-save: atualizar displayName automaticamente
photoCategorySchema.pre('save', function (next) {
    if (this.googleDrivePath) {
        // Converter caminho para displayName amigável
        const pathParts = this.googleDrivePath.split('/').filter(part => part.trim() !== '');
        this.displayName = pathParts.join(' → ');
    }
    next();
});

// Post-save: log
photoCategorySchema.post('save', function () {
    console.log(`💰 Categoria de preço salva: ${this.displayName} - ${this.photoCount} fotos - R$ ${this.basePrice}`);
});

module.exports = mongoose.model('PhotoCategory', photoCategorySchema);