// public/js/currency-manager.js
/**
 * CURRENCY MANAGER - Sunshine Cowhides
 * Gerenciador de moeda de exibição no frontend
 * 
 * USO:
 * - CurrencyManager.format(100)       → "$100.00" ou "C$138.00" ou "€92.00"
 * - CurrencyManager.convert(100)      → 100 ou 138 ou 92
 * - CurrencyManager.getSymbol()       → "$" ou "C$" ou "€"
 * - CurrencyManager.getCurrency()     → "USD" ou "CAD" ou "EUR"
 * - CurrencyManager.setCurrency('CAD') → Muda para CAD
 */

window.CurrencyManager = {
    // ===== ESTADO =====
    state: {
        currency: 'USD',
        rates: { USD: 1, CAD: 1.38, EUR: 0.92 },
        symbols: { USD: '$', CAD: 'C$', EUR: '€' },
        names: { USD: 'US Dollar', CAD: 'Canadian Dollar', EUR: 'Euro' },
        lastUpdated: null,
        isLoaded: false
    },

    // ===== INICIALIZAÇÃO =====

    /**
     * Inicializar o gerenciador de moeda
     */
    async init() {
        console.log('💱 [CurrencyManager] Inicializando...');

        try {
            // 1. Carregar preferência salva localmente
            this.loadSavedPreference();

            // 2. Buscar taxas atuais do servidor
            await this.fetchRates();

            // 3. Buscar preferência do cliente (se logado)
            await this.fetchClientPreference();

            // 4. Renderizar seletor no header
            this.renderSelector();

            // 5. Marcar como carregado
            this.state.isLoaded = true;

            console.log(`✅ [CurrencyManager] Pronto! Moeda: ${this.state.currency}`);

            // 6. Disparar evento de inicialização
            window.dispatchEvent(new CustomEvent('currencyReady', {
                detail: {
                    currency: this.state.currency,
                    rates: this.state.rates
                }
            }));

        } catch (error) {
            console.error('❌ [CurrencyManager] Erro na inicialização:', error);
            this.state.isLoaded = true; // Marcar como carregado mesmo com erro
        }
    },

    /**
     * Buscar taxas do servidor
     */
    async fetchRates() {
        try {
            const response = await fetch('/api/currency/rates');
            const data = await response.json();

            if (data.success) {
                this.state.rates = data.rates;
                this.state.symbols = data.symbols || this.state.symbols;
                this.state.names = data.names || this.state.names;
                this.state.lastUpdated = data.lastUpdated;
                console.log('💱 [CurrencyManager] Taxas carregadas:', this.state.rates);
            }
        } catch (error) {
            console.warn('⚠️ [CurrencyManager] Usando taxas padrão:', error.message);
        }
    },

    /**
     * Buscar preferência do cliente logado
     */
    async fetchClientPreference() {
        try {
            const session = JSON.parse(localStorage.getItem('sunshineSession') || '{}');
            const clientCode = session.accessCode;

            if (!clientCode) {
                console.log('💱 [CurrencyManager] Sem sessão ativa, usando preferência local');
                return;
            }

            const response = await fetch(`/api/currency/preference/${clientCode}`);
            const data = await response.json();

            if (data.success && data.currency) {
                this.state.currency = data.currency;
                this.savePreference(data.currency);
                console.log(`💱 [CurrencyManager] Preferência do servidor: ${data.currency}`);
            }
        } catch (error) {
            console.warn('⚠️ [CurrencyManager] Erro ao buscar preferência:', error.message);
        }
    },

    /**
     * Carregar preferência do localStorage
     */
    loadSavedPreference() {
        const saved = localStorage.getItem('preferredCurrency');
        if (saved && ['USD', 'CAD', 'EUR'].includes(saved)) {
            this.state.currency = saved;
            console.log(`💱 [CurrencyManager] Preferência local: ${saved}`);
        }
    },

    /**
     * Salvar preferência no localStorage
     */
    savePreference(currency) {
        localStorage.setItem('preferredCurrency', currency);
    },

    // ===== CONVERSÃO E FORMATAÇÃO =====

    /**
     * Converter valor de USD para moeda atual
     * @param {number} amountUSD - Valor em dólares
     * @returns {number} Valor convertido
     */
    convert(amountUSD) {
        if (!amountUSD || isNaN(amountUSD)) return 0;
        if (this.state.currency === 'USD') return parseFloat(amountUSD);

        const rate = this.state.rates[this.state.currency] || 1;
        return Math.round(parseFloat(amountUSD) * rate * 100) / 100;
    },

    /**
     * Formatar preço na moeda atual
     * @param {number} amountUSD - Valor em dólares
     * @returns {string} Preço formatado (ex: "$100.00", "C$138.00")
     */
    format(amountUSD) {
        const converted = this.convert(amountUSD);
        const symbol = this.state.symbols[this.state.currency] || '$';
        return `${symbol}${converted.toFixed(2)}`;
    },

    /**
     * Formatar range de preços
     * @param {number} minUSD - Valor mínimo em USD
     * @param {number} maxUSD - Valor máximo em USD
     * @returns {string} Range formatado (ex: "$80.00 - $120.00")
     */
    formatRange(minUSD, maxUSD) {
        const minConverted = this.convert(minUSD);
        const maxConverted = this.convert(maxUSD);
        const symbol = this.state.symbols[this.state.currency] || '$';
        return `${symbol}${minConverted.toFixed(2)} - ${symbol}${maxConverted.toFixed(2)}`;
    },

    /**
     * Obter símbolo da moeda atual
     * @returns {string} Símbolo (ex: "$", "C$", "€")
     */
    getSymbol() {
        return this.state.symbols[this.state.currency] || '$';
    },

    /**
     * Obter código da moeda atual
     * @returns {string} Código (ex: "USD", "CAD", "EUR")
     */
    getCurrency() {
        return this.state.currency;
    },

    /**
     * Verificar se moeda atual não é USD
     * @returns {boolean}
     */
    isConverted() {
        return this.state.currency !== 'USD';
    },

    // ===== ALTERAÇÃO DE MOEDA =====

    /**
     * Alterar moeda de exibição
     * @param {string} newCurrency - Nova moeda ('USD', 'CAD', 'EUR')
     */
    async setCurrency(newCurrency) {
        if (!['USD', 'CAD', 'EUR'].includes(newCurrency)) {
            console.error('❌ [CurrencyManager] Moeda inválida:', newCurrency);
            return;
        }

        const oldCurrency = this.state.currency;

        if (oldCurrency === newCurrency) {
            console.log('💱 [CurrencyManager] Moeda já é', newCurrency);
            this.closeAllDropdowns();
            return;
        }

        // Atualizar estado
        this.state.currency = newCurrency;
        this.savePreference(newCurrency);

        console.log(`💱 [CurrencyManager] Moeda alterada: ${oldCurrency} → ${newCurrency}`);

        // Salvar no servidor (se logado)
        this.saveToServer(newCurrency);

        // Atualizar UI do seletor
        this.updateSelectorDisplay();

        // Fechar dropdowns/modais
        this.closeAllDropdowns();

        // Disparar evento para outros componentes
        window.dispatchEvent(new CustomEvent('currencyChanged', {
            detail: {
                oldCurrency,
                newCurrency,
                rates: this.state.rates,
                symbol: this.state.symbols[newCurrency]
            }
        }));
    },

    /**
     * Salvar preferência no servidor
     */
    async saveToServer(currency) {
        try {
            const session = JSON.parse(localStorage.getItem('sunshineSession') || '{}');
            if (!session.accessCode) return;

            await fetch('/api/currency/preference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientCode: session.accessCode,
                    currency: currency
                })
            });

            console.log('💾 [CurrencyManager] Preferência salva no servidor');
        } catch (error) {
            console.warn('⚠️ [CurrencyManager] Erro ao salvar no servidor:', error);
        }
    },

    // ===== RENDERIZAÇÃO DO SELETOR =====

    /**
     * Renderizar seletor de moeda no header
     */
    renderSelector() {
        // Desktop - inserir após Welcome
        this.renderDesktopSelector();

        // Mobile - inserir botão no header
        this.renderMobileButton();
    },

    /**
     * Renderizar seletor desktop
     */
    renderDesktopSelector() {
        // Verificar se já existe
        if (document.getElementById('currencySelectorDesktop')) return;

        // Encontrar slot no menu unificado
        const currencySlot = document.getElementById('currencySlot');
        if (!currencySlot) {
            console.warn('⚠️ [CurrencyManager] currencySlot não encontrado');
            return;
        }

        const selector = document.createElement('div');
        selector.id = 'currencySelectorDesktop';
        selector.className = 'currency-selector';
        selector.innerHTML = this.getSelectorHTML('desktop');

        currencySlot.appendChild(selector);
        console.log('✅ [CurrencyManager] Seletor desktop renderizado');
    },

    /**
     * Renderizar botão mobile
     */
    renderMobileButton() {
        // Verificar se já existe
        if (document.getElementById('currencyBtnMobile')) return;

        // Encontrar local para inserir
        const mobileNav = document.querySelector('.client-header-nav');
        if (!mobileNav) return;

        // Criar botão
        const btn = document.createElement('button');
        btn.id = 'currencyBtnMobile';
        btn.className = 'mobile-currency-btn';
        btn.innerHTML = `<i class="fas fa-dollar-sign"></i>`;
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            CurrencyManager.openMobileModal();
        };

        // Inserir ANTES do botão de logout (para logout ficar por último)
        const logoutBtn = mobileNav.querySelector('.client-logout-btn');
        if (logoutBtn) {
            logoutBtn.insertAdjacentElement('beforebegin', btn);
        } else {
            // Fallback: inserir antes do carrinho
            const cartBtn = mobileNav.querySelector('.client-cart-btn');
            if (cartBtn) {
                cartBtn.insertAdjacentElement('beforebegin', btn);
            } else {
                mobileNav.appendChild(btn);
            }
        }

        console.log('✅ [CurrencyManager] Botão mobile renderizado');
    },

    /**
     * Gerar HTML do seletor
     */
    getSelectorHTML(type) {
        const curr = this.state.currency;
        const symbol = this.state.symbols[curr];

        return `
            <button class="currency-btn" onclick="CurrencyManager.toggleDropdown('${type}')">
                <span class="currency-symbol">${symbol}</span>
                <span class="currency-code">${curr}</span>
                <i class="fas fa-chevron-down currency-arrow"></i>
            </button>
            <div class="currency-dropdown" id="currencyDropdown${type === 'desktop' ? 'Desktop' : 'Mobile'}">
                ${this.getOptionsHTML()}
                <div class="currency-disclaimer">
                    <i class="fas fa-info-circle"></i>
                    Approximate prices. Final invoice in USD.<br>
                    <a href="https://www.exchangerate-api.com" target="_blank" class="disclaimer-link">Rates by ExchangeRate-API</a>
                </div>
            </div>
        `;
    },

    /**
     * Gerar HTML das opções
     */
    getOptionsHTML() {
        return ['USD', 'CAD', 'EUR'].map(code => {
            const isActive = this.state.currency === code;
            return `
                <div class="currency-option ${isActive ? 'active' : ''}" onclick="CurrencyManager.setCurrency('${code}')">
                    <span class="option-symbol">${this.state.symbols[code]}</span>
                    <div class="option-info">
                        <span class="option-code">${code}</span>
                        <span class="option-name">${this.state.names[code]}</span>
                    </div>
                    <i class="fas fa-check option-check"></i>
                </div>
            `;
        }).join('');
    },

    /**
     * Toggle dropdown
     */
    toggleDropdown(type) {
        const dropdownId = type === 'desktop' ? 'currencyDropdownDesktop' : 'currencyDropdownMobile';
        const dropdown = document.getElementById(dropdownId);
        const btn = dropdown?.previousElementSibling;

        if (dropdown) {
            const isOpen = dropdown.classList.contains('show');

            // Fechar todos primeiro
            this.closeAllDropdowns();

            // Toggle este
            if (!isOpen) {
                dropdown.classList.add('show');
                btn?.classList.add('active');
            }
        }
    },

    /**
     * Fechar todos os dropdowns
     */
    closeAllDropdowns() {
        document.querySelectorAll('.currency-dropdown').forEach(d => {
            d.classList.remove('show');
        });
        document.querySelectorAll('.currency-btn').forEach(b => {
            b.classList.remove('active');
        });
        this.closeMobileModal();
    },

    /**
     * Atualizar display do seletor
     */
    updateSelectorDisplay() {
        const curr = this.state.currency;
        const symbol = this.state.symbols[curr];

        // Atualizar botão desktop
        const desktopBtn = document.querySelector('#currencySelectorDesktop .currency-btn');
        if (desktopBtn) {
            desktopBtn.querySelector('.currency-symbol').textContent = symbol;
            desktopBtn.querySelector('.currency-code').textContent = curr;
        }

        // Atualizar dropdown desktop
        const desktopDropdown = document.getElementById('currencyDropdownDesktop');
        if (desktopDropdown) {
            const optionsContainer = desktopDropdown.querySelector('.currency-disclaimer');
            if (optionsContainer) {
                optionsContainer.insertAdjacentHTML('beforebegin', '');
            }
            // Atualizar classes active
            desktopDropdown.querySelectorAll('.currency-option').forEach(opt => {
                const optCode = opt.querySelector('.option-code')?.textContent;
                opt.classList.toggle('active', optCode === curr);
            });
        }

        // Atualizar modal mobile se existir
        this.updateMobileModal();
    },

    // ===== MODAL MOBILE =====

    /**
     * Abrir modal mobile
     */
    openMobileModal() {
        let modal = document.getElementById('currencyModalMobile');

        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'currencyModalMobile';
            modal.className = 'currency-modal-mobile';
            document.body.appendChild(modal);
        }

        modal.innerHTML = this.getMobileModalHTML();
        modal.classList.add('show');

        // Prevenir scroll do body
        document.body.style.overflow = 'hidden';
    },

    /**
     * Fechar modal mobile
     */
    closeMobileModal() {
        const modal = document.getElementById('currencyModalMobile');
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    },

    /**
     * Atualizar modal mobile
     */
    updateMobileModal() {
        const modal = document.getElementById('currencyModalMobile');
        if (modal && modal.classList.contains('show')) {
            modal.innerHTML = this.getMobileModalHTML();
        }
    },

    /**
     * Gerar HTML do modal mobile
     */
    getMobileModalHTML() {
        const curr = this.state.currency;

        const options = ['USD', 'CAD', 'EUR'].map(code => {
            const isActive = curr === code;
            return `
                <button class="currency-modal-option ${isActive ? 'active' : ''}" 
                        onclick="CurrencyManager.setCurrency('${code}');">
                    <span class="modal-option-symbol">${this.state.symbols[code]}</span>
                    <div class="modal-option-info">
                        <span class="modal-option-code">${code}</span>
                        <span class="modal-option-name">${this.state.names[code]}</span>
                    </div>
                    <i class="fas fa-check modal-option-check"></i>
                </button>
            `;
        }).join('');

        return `
            <div class="currency-modal-overlay" onclick="CurrencyManager.closeMobileModal()"></div>
            <div class="currency-modal-content">
                <div class="currency-modal-header">
                    <h3><i class="fas fa-coins"></i> Select Currency</h3>
                    <button class="currency-modal-close" onclick="CurrencyManager.closeMobileModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="currency-modal-options">
                    ${options}
                </div>
                <div class="currency-modal-disclaimer">
                    <i class="fas fa-info-circle"></i>
                    Prices shown are approximate conversions. Your final invoice will always be in USD.
                </div>
            </div>
        `;
    }
};

// ===== EVENT LISTENERS GLOBAIS =====

// Fechar dropdown ao clicar fora
document.addEventListener('click', (e) => {
    if (!e.target.closest('.currency-selector') && !e.target.closest('.currency-modal-mobile')) {
        CurrencyManager.closeAllDropdowns();
    }
});

// Fechar com ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        CurrencyManager.closeAllDropdowns();
    }
});

// ===== INICIALIZAÇÃO =====

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Aguardar sessão carregar
        setTimeout(() => CurrencyManager.init(), 500);
    });
} else {
    // DOM já carregado
    setTimeout(() => CurrencyManager.init(), 500);
}

// ===== FUNÇÃO HELPER GLOBAL =====

/**
 * Função helper para formatação rápida de preços
 * Pode ser usada em qualquer lugar: formatPrice(100) → "$100.00"
 */
window.formatPrice = function (amountUSD) {
    if (window.CurrencyManager && CurrencyManager.state.isLoaded) {
        return CurrencyManager.format(amountUSD);
    }
    return '$' + parseFloat(amountUSD || 0).toFixed(2);
};

console.log('💱 currency-manager.js carregado');