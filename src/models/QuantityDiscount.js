//src/models/QuantityDiscount.js
const mongoose = require('mongoose');

const quantityDiscountSchema = new mongoose.Schema({
    // Faixa de quantidade
    minQuantity: {
        type: Number,
        required: true,
        min: 1
    },

    maxQuantity: {
        type: Number,
        default: null, // null = sem limite (ex: "21+")
        validate: {
            validator: function (v) {
                return v === null || v >= this.minQuantity;
            },
            message: 'Quantidade máxima deve ser maior que mínima'
        }
    },

    // Desconto percentual (MANTIDO para compatibilidade)
    discountPercent: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },

    // NOVO: Preço fixo (alternativa ao desconto percentual)
    fixedPrice: {
        type: Number,
        default: null,
        min: 0
    },

    // NOVO: Tipo de regra
    ruleType: {
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'fixed' // MUDAMOS PARA FIXED como padrão
    },

    // Descrição da regra
    description: {
        type: String,
        required: true
    },

    // Status
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },

    // Metadados
    createdBy: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

// ===== ÍNDICES =====
quantityDiscountSchema.index({ minQuantity: 1, maxQuantity: 1 });
quantityDiscountSchema.index({ isActive: 1, minQuantity: 1 });

// ===== MÉTODOS ESTÁTICOS =====

// Buscar regras ativas ordenadas por quantidade
quantityDiscountSchema.statics.getActiveRules = function () {
    return this.find({ isActive: true })
        .sort({ minQuantity: 1 })
        .lean();
};

// MODIFICADO: Calcular desconto/preço para quantidade específica
quantityDiscountSchema.statics.calculateDiscount = async function (quantity, basePrice = 0) {
    const rules = await this.getActiveRules();

    // Encontrar regra aplicável
    for (const rule of rules) {
        const matchesMin = quantity >= rule.minQuantity;
        const matchesMax = rule.maxQuantity === null || quantity <= rule.maxQuantity;

        if (matchesMin && matchesMax) {
            // Se tem preço fixo, usa ele
            if (rule.ruleType === 'fixed' && rule.fixedPrice !== null) {
                return {
                    rule: rule,
                    discountPercent: 0,
                    fixedPrice: rule.fixedPrice,
                    ruleType: 'fixed',
                    description: rule.description,
                    finalPrice: rule.fixedPrice
                };
            }
            // Senão, usa porcentagem (compatibilidade)
            else {
                const discount = rule.discountPercent || 0;
                return {
                    rule: rule,
                    discountPercent: discount,
                    fixedPrice: null,
                    ruleType: 'percentage',
                    description: rule.description,
                    finalPrice: basePrice * (1 - discount / 100)
                };
            }
        }
    }

    // Nenhuma regra aplicável - retorna preço base
    return {
        rule: null,
        discountPercent: 0,
        fixedPrice: null,
        ruleType: 'none',
        description: 'Preço base',
        finalPrice: basePrice
    };
};

// Validar se há sobreposição de regras
quantityDiscountSchema.statics.validateNoOverlap = async function (minQty, maxQty, excludeId = null) {
    const query = { isActive: true };
    if (excludeId) query._id = { $ne: excludeId };

    const existingRules = await this.find(query);

    for (const rule of existingRules) {
        const ruleMax = rule.maxQuantity || Infinity;
        const newMax = maxQty || Infinity;

        // Verificar sobreposição
        const overlap = (minQty <= ruleMax) && (newMax >= rule.minQuantity);

        if (overlap) {
            return {
                isValid: false,
                conflictingRule: rule,
                message: `Conflito com regra existente: ${rule.description}`
            };
        }
    }

    return { isValid: true };
};

// ===== MIDDLEWARE =====
quantityDiscountSchema.pre('save', async function (next) {
    // Validar não sobreposição ao salvar
    if (this.isNew || this.isModified('minQuantity') || this.isModified('maxQuantity')) {
        const validation = await this.constructor.validateNoOverlap(
            this.minQuantity,
            this.maxQuantity,
            this._id
        );

        if (!validation.isValid) {
            return next(new Error(validation.message));
        }
    }

    next();
});

module.exports = mongoose.model('QuantityDiscount', quantityDiscountSchema);