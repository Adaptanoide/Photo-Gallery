const mongoose = require('mongoose');

const aiTrainingRuleSchema = new mongoose.Schema({
    // ========== CAMPOS BÁSICOS ==========
    title: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['restock', 'pricing', 'seasonal', 'client', 'general', 'alert', 'lead_time'],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    created_by: {
        type: String,
        default: 'system'
    },
    active: {
        type: Boolean,
        default: true
    },
    applied: {
        type: Boolean,
        default: false
    },

    // ========== TRIGGERS AUTOMÁTICOS ==========
    trigger_value: {
        type: Number,
        default: null  // Ex: 100 (quando estoque < 100)
    },
    trigger_comparison: {
        type: String,
        enum: ['<', '>', '==', '>=', '<=', '!=', null],
        default: null  // Ex: '<' para "menor que"
    },
    trigger_field: {
        type: String,
        default: null  // Ex: 'current_stock', 'days_in_transit', 'days_since_last_order'
    },

    // ========== PRODUTOS ESPECÍFICOS ==========
    product_codes: [{
        type: String  // Ex: ['2110', '2115', '2129'] - códigos QB
    }],
    product_categories: [{
        type: String  // Ex: ['Colombian', 'Brazilian', 'Coasters']
    }],

    // ========== LEAD TIMES E FORNECEDORES ==========
    lead_time_days: {
        type: Number,
        default: null  // Ex: 45 para produtos do Brasil
    },
    supplier_country: {
        type: String,
        default: null  // Ex: 'Brazil', 'Colombia', 'Poland'
    },
    reorder_quantity: {
        type: Number,
        default: null  // Ex: 500 (quantidade a pedir)
    },

    // ========== SAZONALIDADE ==========
    seasonality: {
        months: [{
            type: Number,
            min: 1,
            max: 12  // Ex: [10, 11, 12] para Out-Dez
        }],
        pattern: {
            type: String,
            enum: ['peak', 'low', 'normal', null],
            default: null
        },
        adjustment_percent: {
            type: Number,
            default: null  // Ex: 30 para "+30% no estoque"
        }
    },

    // ========== VELOCIDADE DE VENDAS ==========
    velocity_threshold: {
        min_per_day: {
            type: Number,
            default: null
        },
        max_per_day: {
            type: Number,
            default: null
        }
    },

    // ========== CLIENTES ESPECÍFICOS ==========
    client_codes: [{
        type: String  // Ex: ['JORDAN', 'VIP123']
    }],
    client_preferences: {
        type: String,
        default: null  // Ex: 'prefers tricolor patterns'
    },

    // ========== CANAIS DE VENDA ==========
    applies_to_channels: [{
        type: String,
        enum: ['etsy', 'amazon', 'shopify', 'direct', 'wholesale']
    }],

    // ========== AÇÕES E PRIORIDADE ==========
    action_recommended: {
        type: String,
        default: null  // Ex: 'RESTOCK', 'REVIEW_PRICING', 'CONTACT_CLIENT', 'HOLD'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },

    // ========== ALERTAS ==========
    alert_enabled: {
        type: Boolean,
        default: false
    },
    alert_email: {
        type: Boolean,
        default: false
    },
    last_triggered: {
        type: Date,
        default: null
    },
    trigger_count: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Índices para queries eficientes
aiTrainingRuleSchema.index({ type: 1, active: 1 });
aiTrainingRuleSchema.index({ priority: 1 });
aiTrainingRuleSchema.index({ product_codes: 1 });
aiTrainingRuleSchema.index({ alert_enabled: 1 });

module.exports = mongoose.model('AITrainingRule', aiTrainingRuleSchema);