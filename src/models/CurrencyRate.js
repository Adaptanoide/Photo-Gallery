// src/models/CurrencyRate.js
// Modelo para armazenar taxas de câmbio

const mongoose = require('mongoose');

const currencyRateSchema = new mongoose.Schema({
    baseCurrency: {
        type: String,
        default: 'USD',
        immutable: true
    },
    rates: {
        CAD: {
            type: Number,
            required: true,
            default: 1.38
        },
        EUR: {
            type: Number,
            required: true,
            default: 0.92
        }
    },
    source: {
        type: String,
        enum: ['api', 'manual', 'default'],
        default: 'default'
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    lastApiUpdate: {
        type: Date
    },
    updateHistory: [{
        rates: {
            CAD: Number,
            EUR: Number
        },
        source: String,
        updatedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// ===== MÉTODOS DE INSTÂNCIA =====

/**
 * Obter taxa de conversão para uma moeda
 */
currencyRateSchema.methods.getRate = function(currency) {
    if (currency === 'USD') return 1;
    return this.rates[currency] || 1;
};

/**
 * Converter valor de USD para outra moeda
 */
currencyRateSchema.methods.convert = function(amount, toCurrency) {
    if (toCurrency === 'USD') return amount;
    const rate = this.rates[toCurrency];
    if (!rate) return amount;
    return Math.round(amount * rate * 100) / 100; // 2 casas decimais
};

// ===== MÉTODOS ESTÁTICOS =====

/**
 * Buscar taxas atuais (ou criar se não existir)
 */
currencyRateSchema.statics.getCurrentRates = async function() {
    let rates = await this.findOne().sort({ updatedAt: -1 });
    
    // Se não existir, criar com valores padrão
    if (!rates) {
        console.log('💱 Criando registro de taxas com valores padrão...');
        rates = await this.create({
            rates: { CAD: 1.38, EUR: 0.92 },
            source: 'default'
        });
    }
    
    return rates;
};

/**
 * Atualizar taxas
 */
currencyRateSchema.statics.updateRates = async function(newRates, source = 'manual') {
    const current = await this.getCurrentRates();
    
    // Salvar no histórico antes de atualizar
    current.updateHistory.push({
        rates: { ...current.rates },
        source: current.source,
        updatedAt: current.lastUpdated
    });
    
    // Manter apenas últimos 30 registros no histórico
    if (current.updateHistory.length > 30) {
        current.updateHistory = current.updateHistory.slice(-30);
    }
    
    // Atualizar taxas
    if (newRates.CAD !== undefined) {
        current.rates.CAD = newRates.CAD;
    }
    if (newRates.EUR !== undefined) {
        current.rates.EUR = newRates.EUR;
    }
    
    current.source = source;
    current.lastUpdated = new Date();
    
    if (source === 'api') {
        current.lastApiUpdate = new Date();
    }
    
    await current.save();
    
    console.log(`💱 Taxas atualizadas (${source}): CAD=${current.rates.CAD}, EUR=${current.rates.EUR}`);
    
    return current;
};

/**
 * Obter histórico de taxas
 */
currencyRateSchema.statics.getHistory = async function(limit = 10) {
    const current = await this.getCurrentRates();
    return current.updateHistory.slice(-limit);
};

module.exports = mongoose.model('CurrencyRate', currencyRateSchema);