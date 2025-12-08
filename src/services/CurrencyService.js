// src/services/CurrencyService.js
// Serviço para gerenciar conversão de moedas

const CurrencyRate = require('../models/CurrencyRate');

class CurrencyService {
    // Moedas suportadas
    static SUPPORTED_CURRENCIES = ['USD', 'CAD', 'EUR'];
    
    // API gratuita de taxas de câmbio (1500 requests/mês grátis)
    static API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';
    
    // Símbolos de moeda
    static SYMBOLS = {
        USD: '$',
        CAD: 'C$',
        EUR: '€'
    };
    
    // Nomes completos
    static NAMES = {
        USD: 'US Dollar',
        CAD: 'Canadian Dollar',
        EUR: 'Euro'
    };

    // Timer para atualização automática
    static updateTimer = null;

    /**
     * Buscar taxas da API externa
     * @returns {Promise<Object>} Resultado da operação
     */
    static async fetchRatesFromAPI() {
        try {
            console.log('🌐 [CurrencyService] Buscando taxas de câmbio da API...');
            
            const response = await fetch(this.API_URL, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                timeout: 10000 // 10 segundos timeout
            });
            
            if (!response.ok) {
                throw new Error(`API retornou status ${response.status}`);
            }
            
            const data = await response.json();
            
            // Validar dados recebidos
            if (!data.rates || !data.rates.CAD || !data.rates.EUR) {
                throw new Error('Dados inválidos recebidos da API');
            }
            
            const newRates = {
                CAD: parseFloat(data.rates.CAD.toFixed(4)),
                EUR: parseFloat(data.rates.EUR.toFixed(4))
            };
            
            // Salvar no banco
            await CurrencyRate.updateRates(newRates, 'api');
            
            console.log(`✅ [CurrencyService] Taxas atualizadas: CAD=${newRates.CAD}, EUR=${newRates.EUR}`);
            
            return {
                success: true,
                rates: newRates,
                source: 'api',
                timestamp: new Date()
            };
            
        } catch (error) {
            console.error('❌ [CurrencyService] Erro ao buscar taxas:', error.message);
            
            // Retornar última taxa conhecida como fallback
            const fallback = await CurrencyRate.getCurrentRates();
            
            return {
                success: false,
                rates: fallback.rates,
                source: 'fallback',
                error: error.message,
                timestamp: fallback.lastUpdated
            };
        }
    }

    /**
     * Obter taxas atuais do banco
     * @returns {Promise<Object>} Taxas atuais
     */
    static async getRates() {
        const ratesDoc = await CurrencyRate.getCurrentRates();
        
        return {
            baseCurrency: 'USD',
            rates: {
                USD: 1,
                CAD: ratesDoc.rates.CAD,
                EUR: ratesDoc.rates.EUR
            },
            lastUpdated: ratesDoc.lastUpdated,
            lastApiUpdate: ratesDoc.lastApiUpdate,
            source: ratesDoc.source
        };
    }

    /**
     * Converter valor de USD para outra moeda
     * @param {number} amountUSD - Valor em USD
     * @param {string} toCurrency - Moeda destino
     * @returns {Promise<number>} Valor convertido
     */
    static async convert(amountUSD, toCurrency) {
        if (!amountUSD || isNaN(amountUSD)) return 0;
        if (toCurrency === 'USD') return amountUSD;
        
        const ratesDoc = await CurrencyRate.getCurrentRates();
        return ratesDoc.convert(amountUSD, toCurrency);
    }

    /**
     * Formatar preço com símbolo da moeda
     * @param {number} amount - Valor
     * @param {string} currency - Moeda
     * @returns {string} Preço formatado
     */
    static formatPrice(amount, currency = 'USD') {
        const symbol = this.SYMBOLS[currency] || '$';
        const value = parseFloat(amount) || 0;
        return `${symbol}${value.toFixed(2)}`;
    }

    /**
     * Converter e formatar em uma operação
     * @param {number} amountUSD - Valor em USD
     * @param {string} toCurrency - Moeda destino
     * @returns {Promise<string>} Preço convertido e formatado
     */
    static async convertAndFormat(amountUSD, toCurrency) {
        const converted = await this.convert(amountUSD, toCurrency);
        return this.formatPrice(converted, toCurrency);
    }

    /**
     * Obter informações de uma moeda
     * @param {string} currency - Código da moeda
     * @returns {Object} Informações da moeda
     */
    static getCurrencyInfo(currency) {
        return {
            code: currency,
            symbol: this.SYMBOLS[currency] || '$',
            name: this.NAMES[currency] || currency,
            isSupported: this.SUPPORTED_CURRENCIES.includes(currency)
        };
    }

    /**
     * Validar código de moeda
     * @param {string} currency - Código a validar
     * @returns {boolean} Se é válido
     */
    static isValidCurrency(currency) {
        return this.SUPPORTED_CURRENCIES.includes(currency);
    }

    /**
     * Iniciar atualização automática de taxas
     * @param {number} intervalHours - Intervalo em horas (padrão: 24)
     */
    static startAutoUpdate(intervalHours = 24) {
        // Limpar timer anterior se existir
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        
        // Atualizar imediatamente ao iniciar
        console.log(`⏰ [CurrencyService] Iniciando atualização automática (a cada ${intervalHours}h)`);
        this.fetchRatesFromAPI();
        
        // Configurar intervalo
        const intervalMs = intervalHours * 60 * 60 * 1000;
        
        this.updateTimer = setInterval(() => {
            console.log(`⏰ [CurrencyService] Atualização automática programada...`);
            this.fetchRatesFromAPI();
        }, intervalMs);
        
        console.log(`✅ [CurrencyService] Auto-update configurado: próxima atualização em ${intervalHours}h`);
    }

    /**
     * Parar atualização automática
     */
    static stopAutoUpdate() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
            console.log('🛑 [CurrencyService] Atualização automática parada');
        }
    }

    /**
     * Obter status do serviço
     * @returns {Promise<Object>} Status atual
     */
    static async getStatus() {
        const rates = await CurrencyRate.getCurrentRates();
        
        return {
            isRunning: this.updateTimer !== null,
            supportedCurrencies: this.SUPPORTED_CURRENCIES,
            currentRates: rates.rates,
            lastUpdated: rates.lastUpdated,
            lastApiUpdate: rates.lastApiUpdate,
            source: rates.source,
            historyCount: rates.updateHistory?.length || 0
        };
    }
}

module.exports = CurrencyService;