//public/js/cart.js

/**
 * CART.JS - SUNSHINE COWHIDES
 * Sistema de carrinho modular para e-commerce de produtos únicos
 * Integração com backend CartService via APIs REST
 */

// ===== ESTADO GLOBAL DO CARRINHO =====
window.CartSystem = {
    // Estado do carrinho
    state: {
        sessionId: null,
        items: [],
        totalItems: 0,
        isLoading: false,
        timers: new Map() // Map para gerenciar timers individuais
    },

    // Configurações
    config: {
        autoSyncInterval: 30000, // 30 segundos
        timerUpdateInterval: 1000, // 1 segundo
        apiBaseUrl: '/api/cart'
    },

    // Elementos DOM cacheados
    elements: {
        // Sidebar
        sidebar: null,
        overlay: null,
        loading: null,
        empty: null,
        items: null,
        footer: null,

        // Contadores
        badge: null,
        itemCount: null,
        timer: null,

        // Botões
        floatingBtn: null,
        toggleBtn: null,
        toggleBtnText: null,

        // Modal atual
        modalPhoto: null
    },

    // ===== INICIALIZAÇÃO =====
    init() {
        console.log('🛒 Inicializando sistema de carrinho...');

        // Gerar ou recuperar sessionId
        this.generateSessionId();

        // Cachear elementos DOM
        this.cacheElements();

        // Configurar event listeners
        this.setupEventListeners();

        // Carregar carrinho inicial
        this.loadCart();

        // Iniciar sincronização automática
        this.startAutoSync();

        console.log('✅ Sistema de carrinho inicializado');
    },

    // ===== GESTÃO DE SESSÃO =====
    generateSessionId() {
        // Pegar código do cliente para criar chave única
        const savedSession = localStorage.getItem('sunshineSession');
        const clientCode = savedSession ? JSON.parse(savedSession).user.code : 'guest';

        // Criar chave única por cliente
        const storageKey = `cartSessionId_${clientCode}`;

        let sessionId = localStorage.getItem(storageKey);
        if (!sessionId) {
            sessionId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem(storageKey, sessionId);
        }
        this.state.sessionId = sessionId;
        console.log(`🔑 Session ID [${clientCode}]: ${sessionId}`);
    },

    // ===== CACHE DE ELEMENTOS DOM =====
    cacheElements() {
        this.elements = {
            // Sidebar
            sidebar: document.getElementById('cartSidebar'),
            overlay: document.querySelector('.cart-overlay'),
            loading: document.getElementById('cartLoading'),
            empty: document.getElementById('cartEmpty'),
            items: document.getElementById('cartItems'),
            footer: document.getElementById('cartFooter'),

            // Contadores
            badge: document.getElementById('headerCartBadge'),
            itemCount: document.getElementById('cartItemCount'),
            timer: document.getElementById('cartTimer'),

            // Botões
            floatingBtn: document.getElementById('cartFloatingBtn'),
            toggleBtn: document.getElementById('cartToggleBtn'),
            toggleBtnText: document.getElementById('cartToggleBtnText'),

            // Modal
            modalPhoto: document.getElementById('modalPhoto')
        };

        // Verificar se elementos críticos existem
        const criticalElements = ['sidebar', 'badge'];
        for (const elementName of criticalElements) {
            if (!this.elements[elementName]) {
                console.warn(`⚠️ Elemento crítico não encontrado: ${elementName}`);
            }
        }
    },

    // ===== EVENT LISTENERS =====
    setupEventListeners() {
        // Floating button
        if (this.elements.floatingBtn) {
            this.elements.floatingBtn.addEventListener('click', () => this.openSidebar());
        }

        // Overlay para fechar
        if (this.elements.overlay) {
            this.elements.overlay.addEventListener('click', () => this.closeSidebar());
        }

        // ESC para fechar sidebar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isSidebarOpen()) {
                this.closeSidebar();
            }
        });

        // Atualizar botão quando modal abre
        document.addEventListener('DOMContentLoaded', () => {
            const photoModal = document.getElementById('photoModal');
            if (photoModal) {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                            if (photoModal.style.display !== 'none') {
                                this.updateToggleButton();
                            }
                        }
                    });
                });

                observer.observe(photoModal, { attributes: true });
            }
        });
    },

    // ===== GESTÃO DE ITENS =====

    /**
     * Adicionar item ao carrinho
     */
    async addItem(driveFileId, itemData = {}) {
        try {
            this.setLoading(true);

            // Buscar dados da sessão do cliente
            const clientSession = this.getClientSession();
            if (!clientSession) {
                throw new Error('Client session not found');
            }

            const requestData = {
                sessionId: this.state.sessionId,
                clientCode: clientSession.accessCode,
                clientName: clientSession.user?.name || 'Client',
                driveFileId,
                ...itemData
            };

            const response = await fetch(`${this.config.apiBaseUrl}/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Error adding item');
            }

            // Atualizar estado local
            await this.loadCart();

            // Feedback visual
            this.showNotification(`Item added to cart!`, 'success');
            this.updateToggleButton();

            console.log(`✅ Item ${driveFileId} adicionado ao carrinho`);

            return result;

        } catch (error) {
            console.error('❌ Erro ao adicionar item:', error);
            this.showNotification(error.message, 'error');
            throw error;
        } finally {
            this.setLoading(false);
        }
    },

    /**
     * Remover item do carrinho
     */
    async removeItem(driveFileId) {
        try {
            this.setLoading(true);

            const response = await fetch(`${this.config.apiBaseUrl}/remove/${driveFileId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.state.sessionId
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Error removing item');
            }

            // Atualizar estado local
            await this.loadCart();

            // Feedback visual
            this.showNotification(`Item removed from cart`, 'info');
            this.updateToggleButton();
            // Sincronizar com thumbnails
            if (window.syncCartUIFromRemove) {
                window.syncCartUIFromRemove(driveFileId);
            }
            console.log(`✅ Item ${driveFileId} removido do carrinho`);

            return result;

        } catch (error) {
            console.error('❌ Erro ao remover item:', error);
            this.showNotification(error.message, 'error');
            throw error;
        } finally {
            this.setLoading(false);
        }
    },

    /**
     * Carregar carrinho do servidor
     */
    async loadCart() {
        try {
            const response = await fetch(`${this.config.apiBaseUrl}/${this.state.sessionId}/summary`);
            const result = await response.json();

            if (response.ok && result.success !== false) {
                this.state.items = result.items || [];
                this.state.totalItems = result.totalItems || 0;

                this.updateUI();
                this.startTimers();

                console.log(`📦 Carrinho carregado: ${this.state.totalItems} items`);
            } else {
                // Carrinho vazio ou erro - resetar estado
                this.state.items = [];
                this.state.totalItems = 0;
                this.updateUI();
            }

        } catch (error) {
            console.error('❌ Erro ao carregar carrinho:', error);
            // Em caso de erro, manter estado local
        }
    },

    /**
     * Verificar se item está no carrinho
     */
    isInCart(driveFileId) {
        return this.state.items.some(item => item.driveFileId === driveFileId);
    },

    /**
     * Obter item do carrinho
     */
    getItem(driveFileId) {
        return this.state.items.find(item => item.driveFileId === driveFileId);
    },

    // ===== INTERFACE DE USUÁRIO =====

    /**
     * Abrir sidebar do carrinho
     */
    openSidebar() {
        if (this.elements.sidebar) {
            this.elements.sidebar.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevenir scroll
            this.loadCart(); // Refresh ao abrir
        }
    },

    /**
     * Fechar sidebar do carrinho
     */
    closeSidebar() {
        if (this.elements.sidebar) {
            this.elements.sidebar.classList.remove('active');
            document.body.style.overflow = ''; // Restaurar scroll
        }
    },

    /**
     * Verificar se sidebar está aberta
     */
    isSidebarOpen() {
        return this.elements.sidebar?.classList.contains('active') || false;
    },

    /**
     * Atualizar toda a UI
     */
    updateUI() {
        this.updateBadge();
        this.updateFloatingButton();
        this.updateSidebarContent();
        this.updateToggleButton();
    },

    /**
     * Atualizar badge de contador
     */
    updateBadge() {
        if (this.elements.badge) {
            this.elements.badge.textContent = this.state.totalItems;
            this.elements.badge.classList.toggle('hidden', this.state.totalItems === 0);
        }

        if (this.elements.itemCount) {
            const text = this.state.totalItems === 0 ? 'Empty cart' :
                this.state.totalItems === 1 ? '1 item' :
                    `${this.state.totalItems} items`;
            this.elements.itemCount.textContent = text;
        }
    },

    /**
     * Atualizar botão flutuante
     */
    updateFloatingButton() {
        if (this.elements.floatingBtn) {
            this.elements.floatingBtn.classList.toggle('has-items', this.state.totalItems > 0);
        }
    },

    /**
     * Atualizar botão toggle no modal
     */
    updateToggleButton() {
        if (!this.elements.toggleBtn || !this.elements.toggleBtnText) return;

        // Verificar se modal está aberto e qual foto está sendo exibida
        const currentPhoto = this.getCurrentModalPhoto();
        if (!currentPhoto) return;

        const inCart = this.isInCart(currentPhoto);

        // Atualizar visual do botão
        this.elements.toggleBtn.classList.toggle('in-cart', inCart);
        this.elements.toggleBtnText.textContent = inCart ? 'Remove from Cart' : 'Add to Cart';

        // Atualizar ícone
        const icon = this.elements.toggleBtn.querySelector('i');
        if (icon) {
            icon.className = inCart ? 'fas fa-trash-alt' : 'fas fa-shopping-cart';
        }
    },

    /**
         * Calcular total do carrinho COM desconto por quantidade - VERSÃO NOVA
         */
    async calculateCartTotal() {
        try {
            // Usar nova API que calcula com desconto por quantidade
            const response = await fetch(`${this.config.apiBaseUrl}/${this.state.sessionId}/calculate-total`);
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Error calculating total');
            }

            const totals = result.data;

            console.log(`💰 Total calculado pelo backend:`, {
                itens: totals.totalItems,
                subtotal: totals.formattedSubtotal,
                desconto: `${totals.discountPercent}%`,
                valorDesconto: totals.formattedDiscountAmount,
                total: totals.formattedTotal
            });

            return {
                totalItems: totals.totalItems,
                itemsWithPrice: totals.itemsWithPrice,
                subtotal: totals.subtotal,
                discountPercent: totals.discountPercent,
                discountAmount: totals.discountAmount,
                total: totals.total,
                hasDiscount: totals.hasDiscount,
                discountDescription: totals.discountDescription,
                formattedSubtotal: totals.formattedSubtotal,
                formattedDiscountAmount: totals.formattedDiscountAmount,
                formattedTotal: totals.formattedTotal,
                hasIncompletePrice: totals.itemsWithPrice < totals.totalItems
            };

        } catch (error) {
            console.error('❌ Erro ao calcular total do carrinho:', error);

            // Fallback para cálculo simples em caso de erro
            let total = 0;
            let itemsWithPrice = 0;

            this.state.items.forEach(item => {
                if (item.hasPrice && item.price > 0) {
                    total += item.price;
                    itemsWithPrice++;
                }
            });

            return {
                totalItems: this.state.items.length,
                itemsWithPrice,
                subtotal: total,
                discountPercent: 0,
                discountAmount: 0,
                total: total,
                hasDiscount: false,
                discountDescription: 'Calculation error',
                formattedSubtotal: total > 0 ? `R$ ${total.toFixed(2)}` : 'R$ 0,00',
                formattedDiscountAmount: 'R$ 0,00',
                formattedTotal: total > 0 ? `R$ ${total.toFixed(2)}` : 'R$ 0,00',
                hasIncompletePrice: itemsWithPrice < this.state.items.length
            };
        }
    },

    /**
         * Atualizar conteúdo da sidebar - VERSÃO COM DESCONTO POR QUANTIDADE
         */
    async updateSidebarContent() {
        // Mostrar/ocultar seções baseado no estado
        if (this.elements.loading) {
            this.elements.loading.style.display = this.state.isLoading ? 'block' : 'none';
        }

        if (this.elements.empty) {
            this.elements.empty.style.display =
                (!this.state.isLoading && this.state.totalItems === 0) ? 'block' : 'none';
        }

        if (this.elements.items) {
            this.elements.items.style.display =
                (!this.state.isLoading && this.state.totalItems > 0) ? 'block' : 'none';
        }

        if (this.elements.footer) {
            this.elements.footer.style.display =
                (!this.state.isLoading && this.state.totalItems > 0) ? 'block' : 'none';
        }

        // Renderizar itens
        this.renderCartItems();

        // NOVO: Calcular total com desconto por quantidade
        if (this.elements.itemCount && this.state.totalItems > 0) {
            const cartTotal = await this.calculateCartTotal();

            const totalText = this.state.totalItems === 0 ? 'Empty cart' :
                this.state.totalItems === 1 ? '1 item' :
                    `${this.state.totalItems} items`;

            // Nova interface com subtotal, desconto e total
            let totalHTML = `<div class="items-text">${totalText}</div>`;

            if (cartTotal.total > 0) {
                // Se há desconto, mostrar de forma simples
                if (cartTotal.hasDiscount) {
                    totalHTML += `
                    <div class="cart-totals-simple">
                        <div class="subtotal-line">
                            <span>Subtotal:</span>
                            <span>${cartTotal.formattedSubtotal}</span>
                        </div>
                        <div class="total-line">
                            <span><strong>Total:</strong></span>
                            <span class="total-with-discount">
                                <strong>${cartTotal.formattedTotal}</strong>
                                <small class="discount-badge">${cartTotal.discountPercent}% off</small>
                            </span>
                        </div>
                        <div class="discount-info">${cartTotal.discountDescription}</div>
                    </div>
                `;
                } else {
                    // Sem desconto, mostrar total simples
                    totalHTML += `
                    <div class="cart-totals-simple">
                        <div class="total-line">
                            <span><strong>Total:</strong></span>
                            <span><strong>${cartTotal.formattedTotal}</strong></span>
                        </div>
                    </div>
                `;
                }

                // Aviso sobre itens sem preço
                if (cartTotal.hasIncompletePrice) {
                    totalHTML += '<div class="price-note">* Some items without price</div>';
                }
            }

            this.elements.itemCount.innerHTML = totalHTML;
        }
    },

    /**
     * Renderizar lista de itens do carrinho
     */
    renderCartItems() {
        if (!this.elements.items) return;

        if (this.state.items.length === 0) {
            this.elements.items.innerHTML = '';
            return;
        }

        // Agrupar itens por categoria
        const categories = {};
        this.state.items.forEach(item => {
            // Usar o último nível do pathLevels se existir, senão usar category
            const cat = (item.pathLevels && item.pathLevels.length > 0)
                ? item.pathLevels[item.pathLevels.length - 1]
                : item.category || 'Uncategorized';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(item);
        });

        // Renderizar com separadores e collapse
        let html = '';
        Object.keys(categories).sort().forEach(category => {
            const items = categories[category];

            // Calcular subtotal da categoria
            const subtotal = items.reduce((sum, item) => {
                return sum + (item.price || 0);
            }, 0);

            // ID único para a categoria (remover espaços e caracteres especiais)
            const categoryId = category.replace(/[^a-zA-Z0-9]/g, '_');

            // Adicionar cabeçalho clicável da categoria
            html += `<div class="category-divider" onclick="CartSystem.toggleCategory('${categoryId}')" style="cursor: pointer;">
            <div class="category-left">
                <i class="fas fa-chevron-down category-toggle" id="toggle-${categoryId}"></i>
                <span class="category-label" title="${items[0].fullPath || category}">${category}</span>
                <span class="category-count">${items.length} ${items.length === 1 ? 'item' : 'items'}</span>
            </div>
            <div class="category-right">
                ${subtotal > 0 ? `<span class="category-subtotal">$${subtotal.toFixed(2)}</span>` : ''}
            </div>
        </div>`;

            // Container dos itens (colapsável)
            html += `<div class="category-items" id="items-${categoryId}">`;

            // Adicionar itens da categoria
            items.forEach(item => {
                html += this.renderCartItem(item);
            });

            html += `</div>`;
        });

        this.elements.items.innerHTML = html;
    },

    // NOVA FUNÇÃO - Adicionar após renderCartItems
    toggleCategory(categoryId) {
        const toggle = document.getElementById(`toggle-${categoryId}`);
        const items = document.getElementById(`items-${categoryId}`);

        if (toggle && items) {
            if (items.style.display === 'none') {
                items.style.display = 'block';
                toggle.className = 'fas fa-chevron-down category-toggle';
            } else {
                items.style.display = 'none';
                toggle.className = 'fas fa-chevron-right category-toggle';
            }
        }
    },

    /**
     * Renderizar item individual do carrinho
     */
    renderCartItem(item) {
        const timeRemaining = item.timeRemaining || 0;
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        let timerClass = '';
        if (timeRemaining < 300) timerClass = 'critical'; // < 5min
        else if (timeRemaining < 600) timerClass = 'warning'; // < 10min

        return `
            <div class="cart-item" data-drive-file-id="${item.driveFileId}">
                <div class="cart-item-image">
                    ${item.thumbnailUrl ?
                `<img src="${item.thumbnailUrl}" alt="${item.fileName}" loading="lazy">` :
                `<div class="placeholder"><i class="fas fa-image"></i></div>`
            }
                </div>
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.fileName}</div>
                    <div class="cart-item-category">${item.category}</div>
                    <div class="cart-item-price">
                        ${item.hasPrice ?
                `<span class="price-value">${item.formattedPrice}</span>` :
                `<span class="price-consult">Check price</span>`
            }
                    </div>
                    <div class="cart-item-timer ${timerClass}">
                        <i class="fas fa-clock"></i>
                        <span id="timer-${item.driveFileId}">${timeText}</span>
                    </div>
                </div>
                <div class="cart-item-actions">
                    <button class="cart-item-remove" onclick="CartSystem.removeItem('${item.driveFileId}')" title="Remove item">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Iniciar timers de todos os itens
     */
    startTimers() {
        // Limpar timers existentes
        this.stopTimers();

        // Criar novos timers
        this.state.items.forEach(item => {
            if (item.timeRemaining > 0) {
                this.startItemTimer(item.driveFileId, item.timeRemaining);
            }
        });

        // Timer geral do carrinho
        this.startGeneralTimer();
    },

    /**
     * Parar todos os timers
     */
    stopTimers() {
        this.state.timers.forEach(timer => clearInterval(timer));
        this.state.timers.clear();
    },

    /**
     * Timer de item individual
     */
    startItemTimer(driveFileId, initialTime) {
        let timeRemaining = initialTime;

        const timer = setInterval(() => {
            timeRemaining--;

            // Atualizar elemento visual
            const element = document.getElementById(`timer-${driveFileId}`);
            if (element) {
                const minutes = Math.floor(timeRemaining / 60);
                const seconds = timeRemaining % 60;
                element.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

                // Atualizar classes de urgência
                const timerElement = element.closest('.cart-item-timer');
                if (timerElement) {
                    timerElement.classList.remove('warning', 'critical');
                    if (timeRemaining < 300) timerElement.classList.add('critical');
                    else if (timeRemaining < 600) timerElement.classList.add('warning');
                }
            }

            // Se expirou, remover do carrinho
            if (timeRemaining <= 0) {
                clearInterval(timer);
                this.state.timers.delete(driveFileId);
                this.handleItemExpired(driveFileId);
            }
        }, 1000);

        this.state.timers.set(driveFileId, timer);
    },

    /**
     * Timer geral do carrinho - REMOVIDO
     * Mantemos apenas os timers individuais dos itens
     */
    startGeneralTimer() {
        // FUNCIONALIDADE REMOVIDA - apenas timers individuais dos itens
        console.log('✅ Timers individuais ativos, timer geral removido');
    },

    /**
     * Lidar com item expirado
     */
    async handleItemExpired(driveFileId) {
        console.log(`⏰ Item ${driveFileId} expirou`);

        // Marcar visualmente como expirado
        const itemElement = document.querySelector(`[data-drive-file-id="${driveFileId}"]`);
        if (itemElement) {
            itemElement.classList.add('expired');
        }

        // Recarregar carrinho para sincronizar com servidor
        setTimeout(() => this.loadCart(), 2000);

        this.showNotification('An item has expired and was removed from the cart', 'warning');
    },

    // ===== UTILITÁRIOS =====

    /**
     * Obter ID da foto atual no modal
     */
    getCurrentModalPhoto() {
        // Integração com navigationState do client.js
        if (window.navigationState && window.navigationState.currentPhotos && window.navigationState.currentPhotoIndex >= 0) {
            const currentPhoto = window.navigationState.currentPhotos[window.navigationState.currentPhotoIndex];
            return currentPhoto?.id;
        }
        return null;
    },

    /**
     * Obter sessão do cliente
     */
    getClientSession() {
        const saved = localStorage.getItem('sunshineSession');
        return saved ? JSON.parse(saved) : null;
    },

    /**
     * Controlar estado de loading
     */
    setLoading(isLoading) {
        this.state.isLoading = isLoading;
        this.updateSidebarContent();

        // Desabilitar botões durante loading
        if (this.elements.toggleBtn) {
            this.elements.toggleBtn.disabled = isLoading;
        }
    },

    /**
     * Mostrar notificações
     */
    showNotification(message, type = 'info') {
        // Integração com sistema de notificações do app.js
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    },

    /**
     * Sincronização automática
     */
    startAutoSync() {
        setInterval(() => {
            if (!this.state.isLoading) {
                this.loadCart();
            }
        }, this.config.autoSyncInterval);
    }
};

// ===== FUNÇÕES GLOBAIS PARA INTEGRAÇÃO =====

/**
 * Toggle item no carrinho (chamada pelo botão do modal)
 */
window.toggleCartItem = async function () {
    console.log('🟡 toggleCartItem() executado'); // ← NOVO LOG

    const currentPhoto = CartSystem.getCurrentModalPhoto();
    if (!currentPhoto) {
        console.log('❌ Nenhuma foto selecionada'); // ← NOVO LOG
        CartSystem.showNotification('No photo selected', 'error');
        return;
    }

    console.log('🟡 currentPhoto:', currentPhoto); // ← NOVO LOG

    try {
        if (CartSystem.isInCart(currentPhoto)) {
            console.log('🟡 Removendo item do carrinho'); // ← NOVO LOG
            await CartSystem.removeItem(currentPhoto);
        } else {
            console.log('🟡 Adicionando item ao carrinho'); // ← NOVO LOG

            // Buscar dados da foto atual
            const photoData = window.navigationState?.currentPhotos?.[window.navigationState.currentPhotoIndex];
            console.log('🟡 photoData:', photoData); // ← NOVO LOG

            // Buscar preço da categoria atual
            const currentFolderId = window.navigationState?.currentFolderId;
            console.log('🟡 currentFolderId para busca:', currentFolderId); // ← NOVO LOG

            let priceInfo = { hasPrice: false, price: 0, formattedPrice: 'No price' };

            if (currentFolderId && window.loadCategoryPrice) {
                try {
                    console.log('🟡 Executando busca de preço...'); // ← NOVO LOG
                    priceInfo = await window.loadCategoryPrice(currentFolderId);
                    console.log('🟡 Preço encontrado para carrinho:', priceInfo); // ← NOVO LOG
                } catch (error) {
                    console.warn('❌ Erro ao buscar preço para carrinho:', error);
                }
            } else {
                console.log('🟡 Não vai buscar preço:', {
                    currentFolderId,
                    loadCategoryPrice: !!window.loadCategoryPrice
                });
            }

            const itemData = {
                fileName: photoData?.name || 'Unnamed product',
                // Pegar o ÚLTIMO nível do path (onde a foto realmente está)
                category: window.navigationState?.currentPath?.length > 1
                    ? window.navigationState.currentPath[window.navigationState.currentPath.length - 1].name
                    : window.navigationState?.currentPath?.[0]?.name || 'Category',
                thumbnailUrl: photoData?.thumbnailMedium || photoData?.thumbnailLink,
                price: priceInfo.price,
                formattedPrice: priceInfo.formattedPrice,
                hasPrice: priceInfo.hasPrice
            };

            console.log('🟡 Dados que serão enviados para addItem:', itemData); // ← NOVO LOG

            await CartSystem.addItem(currentPhoto, itemData);

            // Sincronizar thumbnails quando adiciona pelo modal
            if (window.syncCartUIFromAdd) {
                window.syncCartUIFromAdd(currentPhoto);
            }

        }
    } catch (error) {
        console.error('❌ Erro no toggle do carrinho:', error);
    }
};

/**
 * Abrir sidebar do carrinho
 */
window.openCartSidebar = function () {
    CartSystem.openSidebar();
};

/**
 * Fechar sidebar do carrinho
 */
window.closeCartSidebar = function () {
    CartSystem.closeSidebar();
};

/**
 * Prosseguir para finalização da seleção
 */
window.proceedToFinalize = function () {
    if (CartSystem.state.totalItems === 0) {
        CartSystem.showNotification('Empty cart', 'warning');
        return;
    }

    // Chamar API de finalização
    finalizeSelection();
};

/**
 * Finalizar seleção - chamar API backend
 */
async function finalizeSelection() {
    try {
        // Verificar se há itens
        if (CartSystem.state.totalItems === 0) {
            CartSystem.showNotification('Empty cart', 'warning');
            return;
        }

        // MOSTRAR MODAL IMEDIATAMENTE - SEM ESPERAR PROCESSAMENTO
        showImmediateSuccessModal();

        // Fechar carrinho
        CartSystem.closeSidebar();

        // Buscar dados da sessão do cliente
        const clientSession = CartSystem.getClientSession();
        if (!clientSession) {
            console.error('Sessão do cliente não encontrada');
            return;
        }

        const requestData = {
            sessionId: CartSystem.state.sessionId,
            clientCode: clientSession.accessCode,
            clientName: clientSession.user?.name || 'Client'
        };

        console.log('🎯 Iniciando processamento em background:', CartSystem.state.items);

        // PROCESSAMENTO EM BACKGROUND - SEM LOADING PARA O CLIENTE
        processSelectionInBackground(requestData);

    } catch (error) {
        console.error('❌ Erro ao iniciar finalização:', error);
        CartSystem.showNotification('Error processing selection. Please try again.', 'error');
    }
}

/**
 * Processar seleção em background (invisível para o cliente)
 */
async function processSelectionInBackground(requestData) {
    try {
        console.log('🔄 Processando seleção em background...');

        const response = await fetch('/api/selection/finalize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Error finalizing selection');
        }

        // Sucesso em background
        console.log('✅ Seleção processada com sucesso em background:', result);

        // Atualizar carrinho (deve estar vazio agora)
        await CartSystem.loadCart();

        // Log dos detalhes
        console.log('📋 Detalhes da seleção:', {
            selectionId: result.selection?.selectionId,
            folderName: result.selection?.clientFolderName,
            totalItems: result.selection?.totalItems,
            status: result.selection?.status
        });

    } catch (error) {
        console.error('❌ Erro no processamento em background:', error);
        // Não mostrar erro para o cliente - ele já viu o modal de sucesso
    }
}

/**
 * Mostrar modal de sucesso imediato (comercial)
 */
function showImmediateSuccessModal() {
    // Preencher dados comerciais simples
    document.getElementById('modalItemCount').textContent = `${CartSystem.state.totalItems} ${CartSystem.state.totalItems === 1 ? 'item' : 'items'}`;

    // Mostrar modal
    const modal = document.getElementById('selectionSuccessModal');
    modal.style.display = 'flex';

    // Adicionar classe para animação
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);

    console.log('✅ Modal de sucesso exibido imediatamente');
}

// ===== INICIALIZAÇÃO AUTOMÁTICA =====
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar um pouco para garantir que todos os elementos estejam carregados
    setTimeout(() => {
        CartSystem.init();
    }, 500);
});

/**
 * Continuar com nova seleção
 */
function continueSelection() {
    const modal = document.getElementById('selectionSuccessModal');
    modal.style.display = 'none';
    modal.classList.remove('active');

    // Não redirecionar - cliente continua navegando
    console.log('🔄 Cliente optou por continuar selecionando');
}

/**
 * Ir para página inicial
 */
function goToHome() {
    const modal = document.getElementById('selectionSuccessModal');
    modal.style.display = 'none';
    modal.classList.remove('active');

    // Redirecionar imediatamente
    window.location.href = '/';

    console.log('🏠 Cliente redirecionado para página inicial');
}

// Fechar modal clicando no overlay
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('selectionSuccessModal');
    const overlay = document.querySelector('.selection-modal-overlay');

    if (overlay) {
        overlay.addEventListener('click', () => {
            continueSelection();
        });
    }

    // ESC para fechar modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
            continueSelection();
        }
    });
});

// ===== ORDER SUMMARY FUNCTIONS =====

function openOrderSummary() {
    const modal = document.getElementById('orderSummaryModal');
    const body = document.getElementById('orderSummaryBody');

    // Gerar conteúdo
    const summaryHTML = generateOrderSummary();
    body.innerHTML = summaryHTML;

    // Mostrar modal
    modal.style.display = 'flex';
}

function closeOrderSummary() {
    const modal = document.getElementById('orderSummaryModal');
    modal.style.display = 'none';
}

function generateOrderSummary() {
    const items = CartSystem.state.items;

    if (items.length === 0) {
        return '<p>Your cart is empty</p>';
    }

    // Agrupar por categoria
    const categories = {};
    items.forEach(item => {
        const cat = item.category || 'Uncategorized';
        if (!categories[cat]) {
            categories[cat] = [];
        }
        categories[cat].push(item);
    });

    let html = '';

    // Data e cliente
    const clientSession = CartSystem.getClientSession();
    html += `
        <div class="summary-section">
            <div class="summary-info">
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Client:</strong> ${clientSession?.user?.name || 'Client'}</p>
                <p><strong>Code:</strong> ${clientSession?.accessCode || 'N/A'}</p>
            </div>
        </div>
    `;

    // Items por categoria
    html += '<div class="summary-section">';
    html += '<div class="summary-section-title">Items by Category</div>';

    let grandTotal = 0;
    let itemsWithPrice = 0;

    Object.keys(categories).forEach(category => {
        const categoryItems = categories[category];
        let categoryTotal = 0;

        html += '<div class="summary-category">';
        html += `<div class="summary-category-name">${category}</div>`;

        categoryItems.forEach(item => {
            html += `
                <div class="summary-item">
                    <span>${item.fileName}</span>
                    <span>${item.formattedPrice || 'No price'}</span>
                </div>
            `;
            if (item.hasPrice && item.price > 0) {
                categoryTotal += item.price;
                itemsWithPrice++;
            }
        });

        html += `
            <div class="summary-item" style="font-weight: 500; border-top: 1px solid #e0e0e0; margin-top: 5px;">
                <span>Subtotal:</span>
                <span>R$ ${categoryTotal.toFixed(2)}</span>
            </div>
        `;
        html += '</div>';

        grandTotal += categoryTotal;
    });

    html += '</div>';

    // Totais
    html += '<div class="summary-totals">';

    // Calcular desconto
    let discount = 0;
    let discountPercent = 0;

    if (itemsWithPrice >= 2 && itemsWithPrice <= 5) {
        discountPercent = 10;
    } else if (itemsWithPrice >= 6 && itemsWithPrice <= 10) {
        discountPercent = 15;
    } else if (itemsWithPrice > 10) {
        discountPercent = 20;
    }

    discount = grandTotal * (discountPercent / 100);

    html += `
    <div class="summary-total-line">
        <span>Total items:</span>
        <span>${items.length}</span>
    </div>
        <div class="summary-total-line">
            <span>Subtotal:</span>
            <span>R$ ${grandTotal.toFixed(2)}</span>
        </div>
    `;
    if (discountPercent > 0) {
        html += `
            <div class="summary-total-line" style="color: var(--success-color);">
                <span>Discount (${discountPercent}%):</span>
                <span>- R$ ${discount.toFixed(2)}</span>
            </div>
        `;
    }

    const finalTotal = grandTotal - discount;

    html += `
        <div class="summary-total-line final">
            <span>TOTAL:</span>
            <span>R$ ${finalTotal.toFixed(2)}</span>
        </div>
    `;

    html += '</div>';

    return html;
}

function downloadOrderPDF() {
    // Por enquanto, só um alert
    alert('PDF download will be implemented soon!');
}

function printOrderSummary() {
    window.print();
}

// Tornar funções globais
window.openOrderSummary = openOrderSummary;
window.closeOrderSummary = closeOrderSummary;
window.downloadOrderPDF = downloadOrderPDF;
window.printOrderSummary = printOrderSummary;

console.log('📦 cart.js carregado - aguardando inicialização...');