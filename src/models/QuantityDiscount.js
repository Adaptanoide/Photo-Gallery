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
            validator: function(v) {
                return v === null || v >= this.minQuantity;
            },
            message: 'Quantidade máxima deve ser maior que mínima'
        }
    },
    
    // Desconto
    discountPercent: {
        type: Number,
        required: true,
        min: 0,
        max: 100
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
quantityDiscountSchema.statics.getActiveRules = function() {
    return this.find({ isActive: true })
        .sort({ minQuantity: 1 })
        .lean();
};

// Calcular desconto para quantidade específica
quantityDiscountSchema.statics.calculateDiscount = async function(quantity) {
    const rules = await this.getActiveRules();
    
    // Encontrar regra aplicável
    for (const rule of rules) {
        const matchesMin = quantity >= rule.minQuantity;
        const matchesMax = rule.maxQuantity === null || quantity <= rule.maxQuantity;
        
        if (matchesMin && matchesMax) {
            return {
                rule: rule,
                discountPercent: rule.discountPercent,
                description: rule.description
            };
        }
    }
    
    // Nenhuma regra aplicável
    return {
        rule: null,
        discountPercent: 0,
        description: 'Sem desconto'
    };
};

// Validar se há sobreposição de regras
quantityDiscountSchema.statics.validateNoOverlap = async function(minQty, maxQty, excludeId = null) {
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
quantityDiscountSchema.pre('save', async function(next) {
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