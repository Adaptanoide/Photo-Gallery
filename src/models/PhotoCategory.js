//src/models/PhotoCategory.js

const mongoose = require('mongoose');

const photoCategorySchema = new mongoose.Schema({
    // Identificação única da pasta no Google Drive
    googleDriveId: {
        type: String,
        required: true,
        unique: true,
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
        },

    // Status da categoria
    isActive: {
        type: Boolean,
        default: true,
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
        priceRanges: [{
            min: { type: Number, required: true },
            max: { type: Number, default: null },
            price: { type: Number, required: true }
        }],
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

// Método principal UNIFICADO - Verifica hierarquia completa
photoCategorySchema.methods.getPriceForClient = async function (clientCode, quantity = 1) {
//     console.log(`🎯 Calculando preço: ${this.displayName} | Cliente: ${clientCode} | Qtd: ${quantity}`);

    // HELPER: Encontrar melhor preço em faixas
    const findBestPrice = (ranges, qty) => {
        if (!ranges || ranges.length === 0) return null;

        let bestRange = null;

        // Procura faixa exata primeiro
        for (const range of ranges) {
            if (qty >= range.min && (!range.max || qty <= range.max)) {
                return range; // Faixa exata encontrada
            }
        }

        // Se não achou exata, pega a maior faixa que o cliente qualifica
        for (const range of ranges) {
            if (qty >= range.min) {
                if (!bestRange || range.min > bestRange.min) {
                    bestRange = range; // Mantém o melhor preço alcançado
                }
            }
        }

        return bestRange;
    };

    // 1️⃣ PRIORIDADE MÁXIMA: Custom Client específico
    const clientRule = this.discountRules.find(rule =>
        rule.clientCode === clientCode &&
        rule.clientCode !== 'VOLUME' &&
        rule.isActive
    );

    if (clientRule) {
        const bestRange = findBestPrice(clientRule.priceRanges, quantity);

        if (bestRange) {
            console.log(`   💎 Custom Client: ${clientRule.clientName} - ${quantity} itens = $${bestRange.price}`);
            return {
                finalPrice: bestRange.price,
                appliedRule: 'custom-client',
                ruleDetails: {
                    clientName: clientRule.clientName,
                    appliedRange: bestRange,
                    exceeded: quantity > (bestRange.max || Infinity)
                },
                basePrice: this.basePrice
            };
        }

        // Fallback para customPrice ou discountPercent (compatibilidade)
        if (clientRule.customPrice && clientRule.customPrice > 0) {
            return {
                finalPrice: clientRule.customPrice,
                appliedRule: 'custom-price',
                ruleDetails: clientRule,
                basePrice: this.basePrice
            };
        }

        if (clientRule.discountPercent && clientRule.discountPercent > 0) {
            const finalPrice = this.basePrice * (1 - clientRule.discountPercent / 100);
            return {
                finalPrice: Math.max(0, finalPrice),
                appliedRule: 'custom-percent',
                ruleDetails: clientRule,
                basePrice: this.basePrice
            };
        }
    }

    // 2️⃣ SEGUNDA PRIORIDADE: Volume Discount (todos clientes regulares)
    const volumeRule = this.discountRules.find(rule =>
        rule.clientCode === 'VOLUME' &&
        rule.isActive
    );

    if (volumeRule) {
        const bestRange = findBestPrice(volumeRule.priceRanges, quantity);

        if (bestRange) {
            console.log(`   📦 Volume Discount: ${quantity} itens = $${bestRange.price}`);
            return {
                finalPrice: bestRange.price,
                appliedRule: 'volume-discount',
                ruleDetails: {
                    appliedRange: bestRange,
                    exceeded: quantity > (bestRange.max || Infinity)
                },
                basePrice: this.basePrice
            };
        }
    }

    // 3️⃣ FALLBACK: Base Price
    console.log(`   💰 Base Price: $${this.basePrice}`);
    return {
        finalPrice: this.basePrice,
        appliedRule: 'base-price',
        ruleDetails: null,
        basePrice: this.basePrice
    };
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
        priceRanges: options.priceRanges || [],  // ← ADICIONE ESTA LINHA!!!
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
    console.log(`💰 Categoria de preço salva: ${this.displayName} - ${this.photoCount} fotos - $${this.basePrice}`);
});

module.exports = mongoose.model('PhotoCategory', photoCategorySchema);