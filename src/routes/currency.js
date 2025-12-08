// src/routes/currency.js
// Rotas da API de moedas

const express = require('express');
const CurrencyService = require('../services/CurrencyService');
const CurrencyRate = require('../models/CurrencyRate');
const AccessCode = require('../models/AccessCode');

const router = express.Router();

/**
 * GET /api/currency/rates
 * Obter taxas de câmbio atuais (público)
 */
router.get('/rates', async (req, res) => {
    try {
        const rates = await CurrencyService.getRates();
        
        res.json({
            success: true,
            baseCurrency: rates.baseCurrency,
            rates: rates.rates,
            lastUpdated: rates.lastUpdated,
            lastApiUpdate: rates.lastApiUpdate,
            source: rates.source,
            supportedCurrencies: CurrencyService.SUPPORTED_CURRENCIES,
            symbols: CurrencyService.SYMBOLS,
            names: CurrencyService.NAMES
        });
        
    } catch (error) {
        console.error('[Currency Routes] Erro ao buscar taxas:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            // Fallback com valores padrão
            rates: { USD: 1, CAD: 1.38, EUR: 0.92 }
        });
    }
});

/**
 * POST /api/currency/preference
 * Salvar preferência de moeda do cliente
 */
router.post('/preference', async (req, res) => {
    try {
        const { clientCode, currency } = req.body;
        
        // Validações
        if (!clientCode) {
            return res.status(400).json({
                success: false,
                message: 'clientCode é obrigatório'
            });
        }
        
        if (!currency) {
            return res.status(400).json({
                success: false,
                message: 'currency é obrigatório'
            });
        }
        
        if (!CurrencyService.isValidCurrency(currency)) {
            return res.status(400).json({
                success: false,
                message: `Moeda inválida. Opções válidas: ${CurrencyService.SUPPORTED_CURRENCIES.join(', ')}`
            });
        }
        
        // Atualizar no AccessCode
        const accessCode = await AccessCode.findOneAndUpdate(
            { code: clientCode },
            { 
                $set: { 'preferences.currency': currency }
            },
            { new: true }
        );
        
        if (!accessCode) {
            return res.status(404).json({
                success: false,
                message: 'Cliente não encontrado'
            });
        }
        
        console.log(`💱 [Currency] Cliente ${clientCode} alterou moeda para ${currency}`);
        
        res.json({
            success: true,
            message: `Moeda alterada para ${currency}`,
            currency: currency,
            clientName: accessCode.clientName
        });
        
    } catch (error) {
        console.error('[Currency Routes] Erro ao salvar preferência:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/currency/preference/:clientCode
 * Obter preferência de moeda do cliente
 */
router.get('/preference/:clientCode', async (req, res) => {
    try {
        const { clientCode } = req.params;
        
        if (!clientCode || clientCode.length !== 4) {
            return res.status(400).json({
                success: false,
                message: 'Código de cliente inválido'
            });
        }
        
        const accessCode = await AccessCode.findOne({ code: clientCode });
        
        if (!accessCode) {
            return res.status(404).json({
                success: false,
                message: 'Cliente não encontrado'
            });
        }
        
        const currency = accessCode.preferences?.currency || 'USD';
        
        res.json({
            success: true,
            currency: currency,
            clientName: accessCode.clientName
        });
        
    } catch (error) {
        console.error('[Currency Routes] Erro ao buscar preferência:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/currency/convert
 * Converter valor para moeda específica
 */
router.post('/convert', async (req, res) => {
    try {
        const { amount, toCurrency, amounts } = req.body;
        
        // Converter múltiplos valores
        if (amounts && Array.isArray(amounts)) {
            const currency = toCurrency || 'USD';
            const rates = await CurrencyService.getRates();
            
            const converted = amounts.map(amt => ({
                original: amt,
                converted: currency === 'USD' ? amt : Math.round(amt * rates.rates[currency] * 100) / 100,
                formatted: CurrencyService.formatPrice(
                    currency === 'USD' ? amt : amt * rates.rates[currency],
                    currency
                )
            }));
            
            return res.json({
                success: true,
                currency: currency,
                results: converted
            });
        }
        
        // Converter valor único
        if (amount === undefined || !toCurrency) {
            return res.status(400).json({
                success: false,
                message: 'amount e toCurrency são obrigatórios'
            });
        }
        
        const converted = await CurrencyService.convert(amount, toCurrency);
        const formatted = CurrencyService.formatPrice(converted, toCurrency);
        
        res.json({
            success: true,
            original: {
                amount: amount,
                currency: 'USD',
                formatted: CurrencyService.formatPrice(amount, 'USD')
            },
            converted: {
                amount: converted,
                currency: toCurrency,
                formatted: formatted
            },
            rate: (await CurrencyService.getRates()).rates[toCurrency]
        });
        
    } catch (error) {
        console.error('[Currency Routes] Erro ao converter:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/currency/status
 * Status do serviço de moedas
 */
router.get('/status', async (req, res) => {
    try {
        const status = await CurrencyService.getStatus();
        res.json({
            success: true,
            ...status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/currency/history
 * Histórico de taxas
 */
router.get('/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const history = await CurrencyRate.getHistory(limit);
        
        res.json({
            success: true,
            count: history.length,
            history: history
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ===== ROTAS ADMIN =====

/**
 * POST /api/currency/admin/update
 * Forçar atualização das taxas via API (admin)
 */
router.post('/admin/update', async (req, res) => {
    try {
        console.log('🔄 [Currency Admin] Forçando atualização de taxas...');
        const result = await CurrencyService.fetchRatesFromAPI();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/currency/admin/set-manual
 * Definir taxas manualmente (admin)
 */
router.post('/admin/set-manual', async (req, res) => {
    try {
        const { rates } = req.body;
        
        if (!rates || (rates.CAD === undefined && rates.EUR === undefined)) {
            return res.status(400).json({
                success: false,
                message: 'Pelo menos uma taxa (CAD ou EUR) é obrigatória'
            });
        }
        
        // Validar valores
        if (rates.CAD !== undefined && (isNaN(rates.CAD) || rates.CAD <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'Taxa CAD inválida'
            });
        }
        
        if (rates.EUR !== undefined && (isNaN(rates.EUR) || rates.EUR <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'Taxa EUR inválida'
            });
        }
        
        const updated = await CurrencyRate.updateRates(rates, 'manual');
        
        console.log(`✏️ [Currency Admin] Taxas definidas manualmente: CAD=${updated.rates.CAD}, EUR=${updated.rates.EUR}`);
        
        res.json({
            success: true,
            message: 'Taxas atualizadas manualmente',
            rates: updated.rates,
            lastUpdated: updated.lastUpdated
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;