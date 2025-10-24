//public/js/cart.js

/**
 * CART.JS - SUNSHINE COWHIDES
 * Sistema de carrinho modular para e-commerce de produtos únicos
 * Integração com backend CartService via APIs REST
 */

// ===== ESTADO GLOBAL DO CARRINHO =====
window.CartSystem = {
    // Função para formatar tempo de forma legível
    formatTimeReadable(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        // Para 24 horas ou mais, mostra formato especial
        if (hours >= 24) {
            const days = Math.floor(hours / 24);
            const remainingHours = hours % 24;
            if (days === 1 && remainingHours === 0 && minutes === 0) {
                return `24 horas`;
            }
            return `${days}d ${remainingHours}h ${minutes}m ${secs}s`;
        }

        // Para menos de 24 horas, SEMPRE mostra segundos
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        }

        // Para menos de 1 hora
        if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        }

        // Apenas segundos
        return `${secs}s`;
    },
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
        autoSyncInterval: 90000, // 90 segundos (reduzir carga)
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
            cartBadge: document.getElementById('cartHeaderBadge'),
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
        const t0 = performance.now(); // ⏱️ INÍCIO

        try {
            this.setLoading(true);
            const t1 = performance.now();
            console.log(`⏱️ [1] setLoading: ${(t1 - t0).toFixed(0)}ms`);

            // Buscar dados da sessão do cliente
            const clientSession = this.getClientSession();
            if (!clientSession) {
                throw new Error('Client session not found');
            }
            const t2 = performance.now();
            console.log(`⏱️ [2] getSession: ${(t2 - t1).toFixed(0)}ms`);

            const requestData = {
                sessionId: this.state.sessionId,
                clientCode: clientSession.accessCode,
                clientName: clientSession.user?.name || 'Client',
                driveFileId,
                ...itemData
            };
            const t3 = performance.now();
            console.log(`⏱️ [3] prepareData: ${(t3 - t2).toFixed(0)}ms`);

            const response = await fetch(`${this.config.apiBaseUrl}/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            const t4 = performance.now();
            console.log(`⏱️ [4] HTTP POST (backend): ${(t4 - t3).toFixed(0)}ms`);

            const result = await response.json();
            const t5 = performance.now();
            console.log(`⏱️ [5] parse JSON: ${(t5 - t4).toFixed(0)}ms`);

            if (!response.ok) {
                throw new Error(result.message || 'Error adding item');
            }

            // 🆕 USAR DADOS DA RESPOSTA AO INVÉS DE BUSCAR NOVAMENTE!
            if (result.success && result.cart) {
                // Atualizar estado local com dados recebidos
                this.state.items = result.cart.items || [];
                this.state.totalItems = result.cart.totalItems || 0;

                console.log(`✅ [6] Estado atualizado localmente - ${this.state.totalItems} itens`);

                // Atualizar UI
                this.updateUI();

                // Iniciar timers para novos itens
                this.startTimers();

                // ✅ NOVO: Disparar evento para atualizar tiers globalmente
                window.dispatchEvent(new CustomEvent('cartUpdated', {
                    detail: {
                        itemCount: this.state.totalItems,
                        items: this.state.items
                    }
                }));
                console.log('🔔 Evento cartUpdated disparado:', this.state.totalItems, 'items');
            } else {
                // Fallback: se resposta não tem cart, buscar do servidor
                console.warn('⚠️ Resposta sem dados do cart, fazendo fallback...');
                await this.loadCart();
            }

            const t6 = performance.now();
            console.log(`⏱️ [6] updateState: ${(t6 - t5).toFixed(0)}ms`);

            // Feedback visual
            setTimeout(() => this.updateToggleButton(), 100);
            const t7 = performance.now();
            console.log(`⏱️ [7] updateButton: ${(t7 - t6).toFixed(0)}ms`);

            const tTotal = performance.now();
            const totalTime = (tTotal - t0).toFixed(0);

            console.log(`⏱️ =============================`);
            console.log(`⏱️ [TOTAL] addItem: ${totalTime}ms`);
            console.log(`⏱️ =============================`);

            if (totalTime > 1000) {
                console.warn(`🐌 LENTO! Total: ${totalTime}ms (> 1 segundo)`);
            } else if (totalTime > 500) {
                console.warn(`⚠️ RAZOÁVEL: ${totalTime}ms (pode melhorar)`);
            } else {
                console.log(`✅ RÁPIDO! Total: ${totalTime}ms`);
            }

            console.log(`✅ Item ${driveFileId} adicionado ao carrinho`);

            return result;

        } catch (error) {
            console.error('❌ Erro ao adicionar item:', error);
            const notificationType = error.message?.includes('reserved') ? 'warning' : 'error';
            this.showNotification(error.message, notificationType);
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

            const response = await fetch(`${this.config.apiBaseUrl}/remove/${encodeURIComponent(driveFileId)}`, {
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

            // ✅ NOVO: Disparar evento para atualizar tiers globalmente
            window.dispatchEvent(new CustomEvent('cartUpdated', {
                detail: {
                    itemCount: this.state.totalItems,
                    items: this.state.items
                }
            }));
            console.log('🔔 Evento cartUpdated disparado:', this.state.totalItems, 'items');

            // 🔴 DESABILITADO: Atualizar badge de preço
            /*
            if (window.updateCategoryPriceBadge) {
                setTimeout(() => window.updateCategoryPriceBadge(), 100);
            }
            
            if (window.updateModalPriceBadge) {
                setTimeout(() => window.updateModalPriceBadge(), 150);
            }
            
            if (window.PriceProgressBar && window.PriceProgressBar.updateProgress) {
                window.PriceProgressBar.updateProgress();
            }
            */

            setTimeout(() => this.updateToggleButton(), 300); // Delay para sincronizar
            // Sincronizar com thumbnails
            if (window.syncThumbnailButtons) {
                window.syncThumbnailButtons();
            }
            console.log(`✅ Item ${driveFileId} removido do carrinho`);

            return result;

        } catch (error) {
            console.error('❌ Erro ao remover item:', error);
            // Usar amarelo para itens reservados
            const notificationType = error.message?.includes('reserved') ? 'warning' : 'error';
            this.showNotification(error.message, notificationType); throw error;
        } finally {
            this.setLoading(false);
        }
    },

    async loadCart() {
        try {
            // Primeiro tentar buscar carrinho ativo do servidor
            const clientSession = this.getClientSession();
            if (clientSession && clientSession.accessCode) {
                console.log('🔍 Buscando carrinho ativo do servidor...');
                const activeResponse = await fetch(`/api/cart/active/${clientSession.accessCode}`);
                const activeCart = await activeResponse.json();

                if (activeCart.success && activeCart.sessionId) {
                    console.log('✅ Carrinho ativo encontrado:', activeCart.sessionId);
                    this.state.sessionId = activeCart.sessionId;
                    const storageKey = `cartSessionId_${clientSession.accessCode}`;
                    localStorage.setItem(storageKey, activeCart.sessionId);
                }
            }

            // Continuar com o fluxo normal
            const response = await fetch(`${this.config.apiBaseUrl}/${this.state.sessionId}/summary`);
            const result = await response.json();

            if (response.ok && result.success !== false) {
                this.state.items = result.items || [];

                // ✅ CORREÇÃO: Filtrar ghost items para contagem
                const validItems = this.state.items.filter(item =>
                    !item.ghostStatus || item.ghostStatus !== 'ghost'
                );
                this.state.totalItems = validItems.length; // ✅ CORRIGIDO

                const ghostCount = this.state.items.length - validItems.length;
                console.log(`📦 Carrinho carregado: ${this.state.totalItems} items válidos` +
                    (ghostCount > 0 ? ` (${ghostCount} ghosts excluídos)` : ''));

                this.updateUI();
                this.startTimers();
            }

        } catch (error) {
            console.error('❌ Erro ao carregar carrinho:', error);
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
        // Não fechar no desktop - carrinho permanece sempre visível
        if (window.innerWidth > 768) {
            return; // Sai da função sem fazer nada no desktop
        }

        // Código original continua para mobile/tablet
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
        this.updateModalIfOpen();
    },

    /**
     * Atualizar badge de contador
     */
    updateBadge() {
        // Atualizar badge do header principal (mobile)
        if (this.elements.badge) {
            this.elements.badge.textContent = this.state.totalItems;
            this.elements.badge.classList.toggle('hidden', this.state.totalItems === 0);
        }

        // Atualizar badge do carrinho fixo (desktop)
        if (this.elements.cartBadge) {
            this.elements.cartBadge.textContent = this.state.totalItems;
        }

        // Atualizar contador de texto
        if (this.elements.itemCount) {
            const text = this.state.totalItems === 0 ? 'Empty cart' :
                this.state.totalItems === 1 ? '1 item' :
                    `${this.state.totalItems} items`;
            this.elements.itemCount.textContent = text;
        }
    },

    /**
     * Reconstruir completamente a interface do carrinho após mudanças externas
     * Usado quando a sincronização CDE remove itens
     */
    rebuildCartInterface: function () {
        console.log('[CartSystem] Reconstruindo interface do carrinho após sincronização...');

        // 1. Atualizar o badge principal do header
        if (this.elements.badge) {
            const itemCount = this.state.items ? this.state.items.length : 0;
            this.elements.badge.textContent = itemCount;
            this.elements.badge.classList.toggle('hidden', itemCount === 0);
        }

        // 2. Atualizar o badge do carrinho fixo (desktop)
        if (this.elements.cartBadge) {
            const itemCount = this.state.items ? this.state.items.length : 0;
            this.elements.cartBadge.textContent = itemCount;
        }

        // 3. Verificar se o carrinho ficou vazio
        const hasItems = this.state.items && this.state.items.length > 0;

        // 4. Se não tem mais itens, mostrar mensagem de carrinho vazio
        if (!hasItems) {
            // Limpar container de itens
            if (this.elements.items) {
                this.elements.items.innerHTML = '';
                this.elements.items.style.display = 'none';
            }

            // Mostrar mensagem de vazio
            if (this.elements.empty) {
                this.elements.empty.style.display = 'block';
                this.elements.empty.innerHTML = `
                    <div class="empty-cart-message">
                        <i class="fas fa-shopping-cart"></i>
                        <p>Your cart is empty</p>
                        <small>Add leathers to begin your selection</small>
                    </div>
                `;
            }

            // Esconder footer do carrinho
            if (this.elements.footer) {
                this.elements.footer.style.display = 'none';
            }

            // Atualizar contador de texto
            if (this.elements.itemCount) {
                this.elements.itemCount.textContent = 'Empty cart';
            }

            // Esconder botão flutuante se existir
            if (this.elements.floatingBtn) {
                this.elements.floatingBtn.classList.remove('has-items');
            }

            console.log('[CartSystem] Interface reconstruída - carrinho vazio');
        } else {
            // Tem itens - reconstruir lista
            if (this.elements.empty) {
                this.elements.empty.style.display = 'none';
            }

            if (this.elements.items) {
                this.elements.items.style.display = 'block';
            }

            if (this.elements.footer) {
                this.elements.footer.style.display = 'block';
            }

            // Renderizar itens novamente
            this.renderCartItems();

            // Atualizar contador
            const text = this.state.totalItems === 1 ? '1 item' : `${this.state.totalItems} items`;
            if (this.elements.itemCount) {
                this.elements.itemCount.textContent = text;
            }

            console.log(`[CartSystem] Interface reconstruída - ${this.state.totalItems} itens`);
        }

        // 5. Atualizar botão toggle se modal estiver aberto
        this.updateToggleButton();

        // 6. Atualizar botão flutuante
        this.updateFloatingButton();

        console.log('[CartSystem] Reconstrução completa finalizada');
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
        // Pegar foto atual
        const currentPhoto = this.getCurrentModalPhoto();
        if (!currentPhoto) return;

        const inCart = this.isInCart(currentPhoto);

        // Atualizar botão do CARRINHO (se existir)
        if (this.elements.toggleBtn && this.elements.toggleBtnText) {
            this.elements.toggleBtn.classList.toggle('in-cart', inCart);
            this.elements.toggleBtnText.textContent = inCart ? 'Remove from Cart' : 'Add to Cart';
            const icon = this.elements.toggleBtn.querySelector('i');
            if (icon) {
                icon.className = inCart ? 'fas fa-trash-alt' : 'fas fa-shopping-cart';
            }
        }

        // NOVO: Atualizar botão do MODAL também!
        const modalBtn = document.getElementById('cartToggleBtn'); if (modalBtn) {
            modalBtn.disabled = false;
            modalBtn.classList.toggle('in-cart', inCart);
            // GARANTIR QUE TENHA TEXTO!
            if (inCart) {
                modalBtn.innerHTML = '<span>Remove</span>';
            } else {
                modalBtn.innerHTML = '<i class="fas fa-shopping-cart"></i><span>Add to Cart</span>';
            }
        }
    },

    async calculateCartTotal() {
        try {
            // Buscar do endpoint /summary (que já carrega os totals)
            const response = await fetch(`${this.config.apiBaseUrl}/${this.state.sessionId}/summary`);

            if (!response.ok) {
                throw new Error('Falha ao buscar totais');
            }

            const data = await response.json();
            const totals = data.totals || {};

            return {
                totalItems: this.state.items.length,
                itemsWithPrice: this.state.items.length,
                discountSource: totals.discount > 0 ? 'volume' : 'none',
                subtotal: totals.subtotal || 0,
                discountPercent: totals.discountPercent || 0,
                discountAmount: totals.discount || 0,
                total: totals.total || 0,
                hasDiscount: (totals.discount || 0) > 0,
                discountDescription: '',
                formattedSubtotal: `$${(totals.subtotal || 0).toFixed(2)}`,
                formattedDiscountAmount: `$${(totals.discount || 0).toFixed(2)}`,
                formattedTotal: `$${(totals.total || 0).toFixed(2)}`,
                hasIncompletePrice: false,
                mixMatchInfo: totals.mixMatchInfo || null // ✅ MIX&MATCH INFO!
            };

        } catch (error) {
            console.error('❌ Erro ao calcular total:', error);

            // Fallback: cálculo local
            let total = 0;
            this.state.items.forEach(item => {
                if (item.price > 0) {
                    total += item.price;
                }
            });

            return {
                totalItems: this.state.items.length,
                itemsWithPrice: this.state.items.length,
                discountSource: 'none',
                subtotal: total,
                discountPercent: 0,
                discountAmount: 0,
                total: total,
                hasDiscount: false,
                discountDescription: '',
                formattedSubtotal: `$${total.toFixed(2)}`,
                formattedDiscountAmount: '$0.00',
                formattedTotal: `$${total.toFixed(2)}`,
                hasIncompletePrice: false,
                mixMatchInfo: null
            };
        }
    },

    /**
     * Calcular desconto para categoria - DESABILITADO (otimização)
     */
    async calculateCategoryDiscount(categoryName, itemCount, categoryTotal) {
        // 🔴 REMOVIDO: Toda lógica de desconto
        return {
            precoUnitario: itemCount > 0 ? categoryTotal / itemCount : 0,
            subtotal: categoryTotal,
            fonte: 'base-price',
            regra: null
        };
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

        // Salvar estados antes de renderizar
        const collapseStates = this.saveCollapseStates();

        // Renderizar itens (agora é assíncrono)
        await this.renderCartItems();

        // Restaurar estados depois
        setTimeout(() => {
            this.restoreCollapseStates(collapseStates);
        }, 10);

        // NOVO: Calcular total com desconto por quantidade
        if (this.elements.itemCount && this.state.totalItems > 0) {
            const cartTotal = await this.calculateCartTotal();

            const totalText = this.state.totalItems === 0 ? 'Empty cart' :
                this.state.totalItems === 1 ? '1 item' :
                    `${this.state.totalItems} items`;

            // Nova interface com subtotal e total
            let totalHTML = '';

            // Só mostrar "X items" se showPrices = true
            if (window.shouldShowPrices && window.shouldShowPrices()) {
                totalHTML = `<div>${totalText}</div>`;
            }

            if (cartTotal.total > 0) {
                // Verificar se deve mostrar preços
                if (!window.shouldShowPrices || !window.shouldShowPrices()) {
                    totalHTML += `
                    <div class="cart-totals-simple">
                        <div class="total-line">
                            <span><strong>Total Items:</strong></span>
                            <span><strong>${this.state.totalItems}</strong></span>
                        </div>
                        <div class="contact-price" style="display: none; margin-top: 10px; padding: 10px; text-align: center;">
                            <i class="fas fa-phone"></i> Contact for Price
                        </div>
                    </div>`;
                } else {
                    totalHTML += `
                    <div class="cart-totals-simple">
                        <div class="subtotal-line">
                            <span>Subtotal:</span>
                            <span>${cartTotal.formattedSubtotal}</span>
                        </div>`;

                    // ============================================
                    // MIX & MATCH INFO (NOVO!)
                    // ============================================
                    if (cartTotal.mixMatchInfo) {
                        const mmInfo = cartTotal.mixMatchInfo;
                        const tierText = ` `;

                        totalHTML += `
                        <div class="mix-match-info" style="padding: 2px; background: rgba(255, 193, 7, 0.1); border-radius: 4px; font-size: 13px;">
                            <div style="color: #856404;">
                                ${tierText}
                            </div>`;

                        // Mostrar incentivo para próximo tier
                        if (mmInfo.nextTier && mmInfo.itemsToNextTier > 0) {
                            totalHTML += `
                            <div style="color: #28a745; margin-top: 4px; font-size: 14px;">
                                💡 Add ${mmInfo.itemsToNextTier} more for ${mmInfo.nextTier.name}!
                            </div>`;
                        }

                        totalHTML += `</div>`;
                    }
                    // ============================================

                    // Se há desconto, mostrar valor economizado
                    if (cartTotal.hasDiscount && cartTotal.discountAmount > 0) {
                        // Determinar o texto baseado na fonte do desconto
                        const discountLabel = 'Quantity Discount:';

                        totalHTML += `
                        <div class="discount-line" style="color: #28a745;">
                            <span>${discountLabel}</span>
                            <span>-${cartTotal.formattedDiscountAmount}</span>
                        </div>`;
                    }

                    // Total final sempre
                    totalHTML += `
                        <div class="total-line" style="border-top: 1px solid #dee2e6; margin-top: 8px; padding-top: 8px;">
                            <span><strong>Total:</strong></span>
                            <span><strong>${cartTotal.formattedTotal}</strong></span>
                        </div>`;

                    totalHTML += `</div>`;
                }
            }

            this.elements.itemCount.innerHTML = totalHTML;
        }
    },
    
    // Adicionar ANTES de renderCartItems()
    saveCollapseStates() {
        const states = {};
        // Salvar quais categorias estão colapsadas
        document.querySelectorAll('.category-items').forEach(container => {
            const id = container.id;
            states[id] = container.style.display === 'none';
        });
        return states;
    },

    // Adicionar DEPOIS de toggleCategory()
    restoreCollapseStates(states) {
        if (!states) return;

        Object.keys(states).forEach(id => {
            const container = document.getElementById(id);
            const toggleIcon = document.getElementById(id.replace('items-', 'toggle-'));

            if (container && states[id]) {
                container.style.display = 'none';
                if (toggleIcon) {
                    toggleIcon.className = 'fas fa-chevron-right category-toggle';
                }
            }
        });
    },

    /**
     * Renderizar lista de itens do carrinho - VERSÃO OTIMIZADA
     */
    async renderCartItems() {
        if (!this.elements.items) return;

        if (this.state.items.length === 0) {
            this.elements.items.innerHTML = '';
            return;
        }

        // 🔴 REMOVIDO: Busca de descontos no backend (otimização)
        let discountDetails = {};

        // Agrupar itens por categoria
        const categories = {};
        this.state.items.forEach(item => {
            // Pegar categoria completa primeiro
            let cat = (item.pathLevels && item.pathLevels.length > 0)
                ? item.pathLevels[item.pathLevels.length - 1]
                : item.category || 'Uncategorized';

            // Processar nome da categoria
            if (cat.endsWith('/')) {
                cat = cat.slice(0, -1);
            }
            const lastSlash = cat.lastIndexOf('/');
            if (lastSlash !== -1) {
                cat = cat.substring(lastSlash + 1);
            }

            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(item);
        });

        // Renderizar com separadores e collapse
        let html = '';


        // Para cada categoria
        Object.keys(categories).sort().forEach(category => {
            const items = categories[category];
            const itemCount = items.length;

            // Calcular total usando preços locais
            let categoryTotal = 0;
            items.forEach(item => {
                if (item.price > 0) {
                    categoryTotal += item.price;
                }
            });

            const categoryId = category.replace(/[^a-zA-Z0-9]/g, '_');

            // Cabeçalho da categoria
            // Verificar se categoria participa do Mix & Match
            const fullPath = items[0].category || items[0].fullPath || category;
            const isMixMatch = window.isGlobalMixMatch && window.isGlobalMixMatch(fullPath);

            html += `
            <div class="category-divider" onclick="CartSystem.toggleCategory('${categoryId}')" style="cursor: pointer;">
                <div class="category-left">
                    <i class="fas fa-chevron-down category-toggle" id="toggle-${categoryId}"></i>
                    ${isMixMatch ? '<span class="category-badge mix-match">🎯 Mix & Match</span>' : '<span class="category-badge regular">📦 Regular</span>'}
                    <span class="category-label" title="${items[0].fullPath || category}">${category}</span>
                    <span class="category-count">${itemCount}</span>
                </div>
                <div class="category-right">
                    ${(window.shouldShowPrices && window.shouldShowPrices() && categoryTotal > 0) ?
                    `<span class="category-subtotal">$${categoryTotal.toFixed(2)}</span>` :
                    ''
                }
                </div>
            </div>`;

            // Container dos itens
            html += `<div class="category-items" id="items-${categoryId}">`;

            // Renderizar cada item
            items.forEach(item => {
                html += this.renderCartItem(item);
            });

            html += `</div>`;
        });

        this.elements.items.innerHTML = html;
        this.setupCartItemListeners();
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

    // Funções auxiliares para evitar problemas com caracteres especiais
    setupCartItemListeners() {
        // Configurar cliques após renderizar
        setTimeout(() => {
            document.querySelectorAll('.cart-item').forEach(item => {
                const fileId = item.dataset.driveFileId.replace(/&quot;/g, '"');

                // Clique na imagem
                const img = item.querySelector('.cart-item-image');
                if (img) {
                    img.onclick = (e) => {
                        e.stopPropagation();
                        this.openPhotoFromCart(fileId);
                    };
                }

                // Clique nas informações
                const info = item.querySelector('.cart-item-info');
                if (info) {
                    info.onclick = (e) => {
                        e.stopPropagation();
                        this.openPhotoFromCart(fileId);
                    };
                }

                // Botão remover
                const removeBtn = item.querySelector('.cart-item-remove');
                if (removeBtn) {
                    removeBtn.onclick = (e) => {
                        e.stopPropagation();
                        this.removeItem(fileId);
                    };
                }
            });
        }, 100);
    },

    /**
     * Renderizar item individual do carrinho
     */
    renderCartItem(item) {
        // Verificar se é um ghost item
        const isGhost = item.ghostStatus === 'ghost';

        // URL do thumbnail
        const thumbnailUrl = item.thumbnailUrl ||
            `https://images.sunshinecowhides-gallery.com/_thumbnails/${item.driveFileId}`;

        // Escapar aspas duplas
        const safeDriveFileId = item.driveFileId.replace(/"/g, '&quot;');
        const timeRemaining = item.timeRemaining || 0;
        const timeText = this.formatTimeReadable(timeRemaining);

        let timerClass = '';
        if (!isGhost) { // Só aplicar classes de timer se não for ghost
            if (timeRemaining < 300) timerClass = 'critical';
            else if (timeRemaining < 600) timerClass = 'warning';
        }

        // Classe adicional para ghost items
        const itemClass = isGhost ? 'cart-item ghost-item' : 'cart-item';

        return `
            <div class="${itemClass}" data-drive-file-id="${safeDriveFileId}">
                ${isGhost ? `
                    <div class="ghost-overlay">
                        <div class="ghost-message">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span>${item.ghostReason || 'Item unavailable'}</span>
                        </div>
                    </div>
                ` : ''}
                <div class="cart-item-image" style="cursor: ${isGhost ? 'not-allowed' : 'pointer'};">
                    ${thumbnailUrl ?
                `<img src="${thumbnailUrl}" alt="${item.fileName}" loading="lazy">` :
                `<div class="placeholder"><i class="fas fa-image"></i></div>`
            }
                </div>
                <div class="cart-item-info" style="cursor: ${isGhost ? 'not-allowed' : 'pointer'};">
                    <div class="cart-item-title ${isGhost ? 'ghost-text' : ''}">${item.fileName}</div>
                    <div class="cart-item-category ${isGhost ? 'ghost-text' : ''}">${item.category}</div>
                    ${!isGhost && (window.shouldShowPrices && window.shouldShowPrices()) ?
                `<div class="cart-item-price">
                            ${(item.price > 0 || item.basePrice > 0) ?
                    `<span class="price-value">$${(item.price || item.basePrice).toFixed(2)}</span>` :
                    `<span class="price-consult">Check price</span>`
                }
                        </div>` :
                ''
            }
                    ${isGhost ?
                `<div class="ghost-status">
                            <i class="fas fa-ban"></i> Not available for selection
                        </div>` :
                `<div class="cart-item-timer ${timerClass}">
                            <i class="fas fa-clock"></i>
                            <span id="timer-${item.fileName || item.driveFileId.split('/').pop()}">${timeText}</span>
                        </div>`
            }
                </div>
                <div class="cart-item-actions">
                    <button class="cart-item-remove ${isGhost ? 'remove-ghost' : ''}" title="${isGhost ? 'Acknowledge and remove' : 'Remove item'}">
                        <i class="fas ${isGhost ? 'fa-times-circle' : 'fa-trash-alt'}"></i>
                    </button>
                </div>
            </div>
        `;
    },

    // Abrir foto do carrinho em modal fullscreen
    openPhotoFromCart(driveFileId) {
        // Fechar sidebar do carrinho
        this.closeSidebar();

        window.modalOpenedFromCart = true;

        // Preparar array de fotos do carrinho
        const cartPhotos = this.state.items.map((item, index) => ({
            id: item.driveFileId,
            name: item.fileName,
            fileName: item.fileName,
            webViewLink: `https://images.sunshinecowhides-gallery.com/${item.driveFileId}`,
            thumbnailUrl: item.thumbnailUrl,
            category: item.category,
            price: item.price,
            formattedPrice: item.formattedPrice,
            hasPrice: item.hasPrice
        }));

        // Encontrar índice da foto clicada
        const photoIndex = cartPhotos.findIndex(p => p.id === driveFileId);

        if (photoIndex === -1) {
            console.error('Foto não encontrada no carrinho');
            return;
        }

        // Salvar contexto anterior
        this.previousNavigationState = {
            photos: window.navigationState.currentPhotos,
            index: window.navigationState.currentPhotoIndex,
            isFromCart: false
        };

        // Substituir temporariamente as fotos da navegação
        window.navigationState.currentPhotos = cartPhotos;
        window.navigationState.currentPhotoIndex = photoIndex;
        window.navigationState.isViewingCart = true; // Flag especial

        // Abrir modal
        if (window.openPhotoModal) {
            window.openPhotoModal(photoIndex);
        }
    },

    // Restaurar contexto quando fechar modal
    restoreNavigationContext() {
        if (this.previousNavigationState) {
            window.navigationState.currentPhotos = this.previousNavigationState.photos;
            window.navigationState.currentPhotoIndex = this.previousNavigationState.index;
            window.navigationState.isViewingCart = false;
            this.previousNavigationState = null;
        }
    },

    /**
     * Iniciar timers de todos os itens
     */
    startTimers() {
        // Limpar timers existentes
        this.stopTimers();

        // Criar novos timers
        this.state.items.forEach(item => {
            // Calcular tempo restante baseado em expiresAt
            if (item.expiresAt) {
                const now = new Date();
                const expires = new Date(item.expiresAt);
                const timeRemaining = Math.floor((expires - now) / 1000);

                if (timeRemaining > 0) {
                    this.startItemTimer(item.driveFileId, timeRemaining);
                } else {
                    console.warn(`⏰ Item ${item.fileName} já expirou`);
                }
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
            const element = document.getElementById(`timer-${driveFileId.split('/').pop()}`);
            if (element) {
                element.textContent = this.formatTimeReadable(timeRemaining);

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
 * Atualizar modal se estiver aberto
 */
    updateModalIfOpen() {
        // Verificar se o modal está aberto
        const modal = document.getElementById('photoModal');
        if (modal && modal.style.display === 'flex') {
            // Atualizar informações de preço do modal
            if (typeof updateModalPriceInfo === 'function') {
                console.log('🔄 Atualizando Volume Pricing no modal');
                updateModalPriceInfo();
            }
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
    console.log('🟡 toggleCartItem() executado');

    // ============ FEEDBACK VISUAL INSTANTÂNEO ============
    const clickedButton = event?.target?.closest('button') ||
        document.querySelector('.modal-cart-btn:hover') ||
        document.querySelector('.thumbnail-cart-btn:hover');

    if (clickedButton) {
        const originalHTML = clickedButton.innerHTML;
        const originalClass = clickedButton.classList.contains('in-cart');

        clickedButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span> </span>';
        clickedButton.disabled = true;
    }

    // Garantir restauração após 1.5s
    setTimeout(() => {
        const modalBtn = document.getElementById('cartToggleBtn');
        if (modalBtn) {
            const currentPhoto = CartSystem.getCurrentModalPhoto();
            if (currentPhoto) {
                const isInCart = CartSystem.isInCart(currentPhoto);

                modalBtn.disabled = false;

                if (isInCart) {
                    modalBtn.classList.add('in-cart');
                    modalBtn.classList.remove('adding');
                    modalBtn.innerHTML = '<span>Remove</span>';
                } else {
                    modalBtn.classList.remove('in-cart');
                    modalBtn.classList.remove('adding');
                    modalBtn.innerHTML = '<i class="fas fa-shopping-cart"></i><span>Add to Cart</span>';
                }
            }
        }
    }, 1500);

    const currentPhoto = CartSystem.getCurrentModalPhoto();
    if (!currentPhoto) {
        console.log('❌ Nenhuma foto selecionada');
        CartSystem.showNotification('No photo selected', 'error');
        return;
    }

    console.log('🟡 currentPhoto:', currentPhoto);

    try {
        if (CartSystem.isInCart(currentPhoto)) {
            console.log('🟡 Removendo item do carrinho');
            await CartSystem.removeItem(currentPhoto);

            // AUTO-AVANÇO: Se removeu do modal e está vendo carrinho
            if (window.navigationState && window.navigationState.isViewingCart &&
                document.getElementById('photoModal').style.display !== 'none') {

                console.log('🔄 Auto-avançando após remoção...');

                const currentIndex = window.navigationState.currentPhotoIndex;
                window.navigationState.currentPhotos.splice(currentIndex, 1);

                if (window.navigationState.currentPhotos.length > 0) {
                    let nextIndex = currentIndex;
                    if (nextIndex >= window.navigationState.currentPhotos.length) {
                        nextIndex = window.navigationState.currentPhotos.length - 1;
                    }

                    setTimeout(() => {
                        window.openPhotoModal(nextIndex);
                    }, 400);
                } else {
                    console.log('🔭 Carrinho vazio, fechando modal...');
                    setTimeout(() => {
                        window.closePhotoModal();
                        CartSystem.showNotification('Cart is now empty', 'info');
                    }, 400);
                }

                return;
            }

            // Sincronizar thumbnails após remover
            setTimeout(() => {
                if (window.syncThumbnailButtons) {
                    window.syncThumbnailButtons();
                }
            }, 100);

        } else {
            // =============== CORREÇÃO DO BUG AQUI ===============
            console.log('🟡 Adicionando item ao carrinho');

            // Buscar dados da foto atual
            const photos = window.navigationState.currentPhotos;
            const photoIndex = window.navigationState.currentPhotoIndex;
            const photo = photos[photoIndex];

            if (!photo) {
                throw new Error('Photo data not found');
            }

            // Buscar preço da categoria
            let priceInfo = { hasPrice: false, basePrice: 0, price: 0, formattedPrice: 'No price' };

            console.log('🔍 [CART DEBUG] Verificando preço...');
            console.log('📸 photo.customPrice:', photo.customPrice);
            console.log('📁 navigationState.currentFolderId:', window.navigationState?.currentFolderId);
            console.log('🔧 loadCategoryPrice existe?', typeof window.loadCategoryPrice);

            // Verificar se tem customPrice (Special Selection)
            if (photo.customPrice) {
                console.log('💰 [CART] Usando customPrice:', photo.customPrice);
                priceInfo = {
                    hasPrice: true,
                    basePrice: parseFloat(photo.customPrice),
                    price: parseFloat(photo.customPrice),
                    formattedPrice: `$${parseFloat(photo.customPrice).toFixed(2)}`
                };
            }
            else if (window.navigationState.currentFolderId && window.loadCategoryPrice) {
                console.log('🔍 [CART] Tentando buscar preço com loadCategoryPrice...');
                console.log('📁 [CART] currentFolderId:', window.navigationState.currentFolderId);
                try {
                    priceInfo = await window.loadCategoryPrice(window.navigationState.currentFolderId);
                    console.log('✅ [CART] Preço carregado:', priceInfo);
                } catch (error) {
                    console.warn('❌ [CART] Erro ao buscar preço:', error);
                }
            } else {
                console.log('⚠️ [CART] Não entrou em nenhuma condição de preço!');
                console.log('   - customPrice?', !!photo.customPrice);
                console.log('   - currentFolderId?', !!window.navigationState?.currentFolderId);
                console.log('   - loadCategoryPrice?', !!window.loadCategoryPrice);
            }

            // Montar dados completos do item
            const itemData = {
                fileName: photo.name || photo.fileName || 'Unnamed product',
                category: window.navigationState?.currentCategoryName ||
                    window.getCurrentCategoryDisplayName() ||
                    'Category',
                thumbnailUrl: ImageUtils.getThumbnailUrl(photo),
                pathLevels: window.navigationState?.currentPath?.map(p => p.name) || [],
                fullPath: window.navigationState?.currentPath?.map(p => p.name).join(' → ') || '',
                basePrice: priceInfo.basePrice || 0,
                price: priceInfo.price || 0,
                formattedPrice: priceInfo.formattedPrice || 'No price',
                hasPrice: priceInfo.hasPrice || false
            };

            console.log('📦 Dados do item montados:', itemData);

            // Adicionar ao carrinho COM OS DADOS COMPLETOS
            await CartSystem.addItem(currentPhoto, itemData);

            // Sincronizar thumbnails após adicionar
            setTimeout(() => {
                if (window.syncThumbnailButtons) {
                    window.syncThumbnailButtons();
                }
            }, 100);
        }

    } catch (error) {
        console.error('❌ Erro no toggle do carrinho:', error);
        CartSystem.showNotification(error.message || 'Error managing cart', 'error');
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
            CartSystem.showNotification('Carrinho vazio', 'warning');
            return;
        }

        // Filtrar ghost items localmente primeiro
        const validItems = CartSystem.state.items.filter(item =>
            !item.ghostStatus || item.ghostStatus !== 'ghost'
        );

        const ghostCount = CartSystem.state.items.length - validItems.length;

        if (validItems.length === 0) {
            CartSystem.showNotification('Todos os itens estão indisponíveis', 'error');
            return;
        }

        // NOVO: Mostrar modal de confirmação
        showConfirmationModal(validItems, ghostCount);

    } catch (error) {
        console.error('❌ Erro ao iniciar finalização:', error);
        CartSystem.showNotification('Erro ao processar seleção', 'error');
    }
}

// NOVA FUNÇÃO: Modal de confirmação
function showConfirmationModal(validItems, ghostCount) {
    // Criar HTML do modal melhorado
    const modalHTML = `
        <div id="confirmSelectionModal" class="modal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 20000; align-items: center; justify-content: center;">
            <div class="modal-content" style="background: white; padding: 25px; border-radius: 10px; max-width: 500px; width: 90%; max-height: 60vh; overflow-y: auto; position: relative;">
                <!-- Header compacto -->
                <h2 style="margin-bottom: 15px; color: #333; font-size: 1.5rem;">Confirm Your Selection</h2>
                
                <!-- Info de itens -->
                <div style="margin-bottom: 15px; padding: 12px; background: #f8f9fa; border-radius: 5px;">
                    <p style="margin: 0; font-weight: 600;">
                        <i class="fas fa-check-circle" style="color: #28a745;"></i>
                        Items to be reserved: <span style="color: #28a745;">${validItems.length} photos</span>
                    </p>
                    ${ghostCount > 0 ? `
                        <p style="margin: 8px 0 0 0; color: #ff9800; font-size: 14px;">
                            <i class="fas fa-exclamation-triangle"></i>
                            ${ghostCount} unavailable item(s) will be removed
                        </p>
                    ` : ''}
                </div>
                
                <!-- AVISO IMPORTANTE COM DESTAQUE -->
                <div style="background: #fff3cd; border: 2px solid #ffc107; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="display: flex; align-items: start; gap: 10px;">
                        <i class="fas fa-info-circle" style="color: #ff9800; font-size: 20px; margin-top: 2px;"></i>
                        <div>
                            <strong style="color: #856404; display: block; margin-bottom: 5px;">Important Notice:</strong>
                            <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.5;">
                                After confirming, <strong>your access will be temporarily disabled</strong> while our sales team processes your selection. 
                                You will be contacted within 24 hours to complete the purchase.
                            </p>
                        </div>
                    </div>
                </div>
                
                <!-- Campo de observações compacto -->
                <div style="margin-bottom: 20px;">
                    <label for="clientObservations" style="display: block; margin-bottom: 5px; font-weight: 600; font-size: 14px;">
                        Observations (optional):
                    </label>
                    <textarea 
                        id="clientObservations" 
                        rows="3" 
                        style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px; resize: vertical; font-size: 14px; height: 160px;"
                        placeholder="Add any special requests or notes..."
                    ></textarea>
                </div>
                
                <!-- Botões -->
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="cancelConfirmation()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
                        Cancel
                    </button>
                    <button onclick="proceedWithSelection()" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 14px;">
                        <i class="fas fa-check"></i> Confirm Selection
                    </button>
                </div>
            </div>
        </div>
    `;

    // Adicionar modal ao body
    const modalDiv = document.createElement('div');
    modalDiv.innerHTML = modalHTML;
    document.body.appendChild(modalDiv);
}

// Cancelar confirmação
window.cancelConfirmation = function () {
    const modal = document.getElementById('confirmSelectionModal');
    if (modal) modal.remove();
}

// Prosseguir com a seleção
window.proceedWithSelection = async function () {
    try {
        // Pegar observações
        const observations = document.getElementById('clientObservations')?.value || '';

        // Fechar modal de confirmação
        cancelConfirmation();

        // Buscar dados da sessão
        const clientSession = CartSystem.getClientSession();
        if (!clientSession) {
            console.error('Sessão do cliente não encontrada');
            CartSystem.showNotification('Session error', 'error');
            return;
        }

        const requestData = {
            sessionId: CartSystem.state.sessionId,
            clientCode: clientSession.accessCode,
            clientName: clientSession.user?.name || 'Client',
            observations: observations
        };

        console.log('🎯 Enviando seleção para processamento...');

        // ========== RESPOSTA IMEDIATA ==========
        // MOSTRAR MODAL DE SUCESSO IMEDIATAMENTE!
        showSuccessModalWithMessage({
            selection: {
                totalItems: CartSystem.state.items.filter(item =>
                    !item.ghostStatus || item.ghostStatus !== 'ghost'
                ).length
            }
        });

        // ========== PROCESSAR EM BACKGROUND ==========
        // Enviar para o backend SEM ESPERAR
        fetch('/api/selection/finalize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        }).then(async response => {
            const result = await response.json();

            if (response.ok) {
                console.log('✅ Seleção processada em background:', result);
                // Limpar carrinho
                await CartSystem.loadCart();
            } else {
                console.error('❌ Erro no processamento background:', result);
                // Não mostrar erro - cliente já viu sucesso
            }
        }).catch(error => {
            console.error('❌ Erro de rede no background:', error);
            // Não mostrar erro - cliente já viu sucesso
        });

    } catch (error) {
        console.error('❌ Erro:', error);
        CartSystem.showNotification(error.message, 'error');
    }
}

// Modal de sucesso melhorado
function showSuccessModalWithMessage(result) {
    const modalHTML = `
        <div id="successModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 30000; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 20px; border-radius: 12px; max-width: 520px; width: 90%; text-align: center; max-height: 85vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                <!-- Ícone de sucesso maior -->
                <i class="fas fa-check-circle" style="color: #28a745; font-size: 70px; margin-bottom: 20px;"></i>
                
                <!-- Título principal -->
                <h2 style="margin-bottom: 10px; font-size: 28px; color: #333;">Selection Confirmed!</h2>
                
                <!-- Destaque para número de itens -->
                <div style="margin: 20px 0; padding: 15px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); border-radius: 8px;">
                    <p style="margin: 0; font-size: 24px; font-weight: bold; color: white;">
                        ${result.selection.totalItems} items have been reserved
                    </p>
                </div>
                
                <!-- Box de próximos passos com mais destaque -->
                <div style="background: #d4edda; border: 3px solid #28a745; padding: 25px; border-radius: 10px; margin: 25px 0; text-align: left;">
                    <h4 style="margin: 0 0 15px 0; color: #155724; font-size: 20px; text-align: center;">
                        <i class="fas fa-info-circle" style="color: #28a745;"></i> Important Information
                    </h4>
                    <ul style="margin: 0; padding-left: 25px; color: #155724; font-size: 16px; line-height: 2;">
                        <li><strong>Our sales team will contact you within 24 hours</strong></li>
                        <li>This tool was designed to help you pre-select products</li>
                        <li>Payment methods and shipping options will be discussed with your sales representative</li>
                        <li>Final pricing may vary based on quantity and negotiation</li>
                    </ul>
                </div>
                
                <!-- Aviso importante com mais destaque -->
                <div style="background: #fff3cd; border: 2px solid #ffc107; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="color: #856404; font-size: 14px; margin: 0; line-height: 1.5;">
                        <i class="fas fa-info-circle" style="color: #ff9800; font-size: 18px;"></i><br>
                        <strong>Your access has been temporarily disabled.</strong><br>
                        Contact your sales representative for assistance.
                    </p>
                </div>
                
                <!-- Botão mais destacado -->
                <button onclick="location.href='/'" style="
                    padding: 15px 40px; 
                    background: linear-gradient(135deg, #d4af37 0%, #f4d03f 100%);
                    color: white; 
                    border: none; 
                    border-radius: 8px; 
                    cursor: pointer; 
                    font-weight: bold; 
                    font-size: 18px;
                    box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
                    transition: all 0.3s;
                    margin-top: 10px;
                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    <i class="fas fa-home"></i> Return to Home
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
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

    // Gerar conteúdo ASSÍNCRONO agora
    generateOrderSummary().then(summaryHTML => {
        body.innerHTML = summaryHTML;

        // Ativar funcionalidade de collapse após renderizar
        setTimeout(() => {
            document.querySelectorAll('.summary-category-header').forEach(header => {
                header.addEventListener('click', function () {
                    toggleSummaryCategory(this);
                });
            });
        }, 100);
    });

    // Mostrar modal
    modal.style.display = 'flex';
}

function closeOrderSummary() {
    const modal = document.getElementById('orderSummaryModal');
    modal.style.display = 'none';
}

// NOVA FUNÇÃO para toggle de categorias
function toggleSummaryCategory(header) {
    const items = header.nextElementSibling;
    const icon = header.querySelector('.category-toggle-icon');

    if (items.style.display === 'none') {
        items.style.display = 'block';
        icon.className = 'fas fa-chevron-down category-toggle-icon';
    } else {
        items.style.display = 'none';
        icon.className = 'fas fa-chevron-right category-toggle-icon';
    }
}

async function generateOrderSummary() {
    // Verificar se deve mostrar preços
    const showPrices = window.shouldShowPrices && window.shouldShowPrices();

    const items = CartSystem.state.items;

    if (items.length === 0) {
        return '<p style="text-align: center; padding: 20px;">Your cart is empty</p>';
    }

    // 🔴 REMOVIDO: Fetch de descontos do backend
    // Usar apenas dados locais
    let discountDetails = {};

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
    const clientCode = clientSession?.accessCode || 'N/A';

    html += `
        <div class="summary-section">
            <div class="summary-info">
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Client:</strong> ${clientSession?.user?.name || 'Client'}</p>
                <p><strong>Code:</strong> ${clientCode}</p>
            </div>
        </div>
    `;

    // Items por categoria COM COLLAPSE
    html += '<div class="summary-section">';
    html += '<div class="summary-section-title">Items by Category</div>';

    let grandTotal = 0;
    let totalItems = 0;

    Object.keys(categories).forEach((category, index) => {
        const allCategoryItems = categories[category];

        // ✅ FILTRAR GHOST ITEMS DA CATEGORIA
        const categoryItems = allCategoryItems.filter(item =>
            !item.ghostStatus || item.ghostStatus !== 'ghost'
        );

        // Se todos eram ghosts, pular essa categoria
        if (categoryItems.length === 0) return;

        let categoryTotal = 0;

        // Calcular total da categoria usando preços locais
        categoryItems.forEach(item => {
            if (item.price > 0) {
                categoryTotal += item.price;
            }
        });

        grandTotal += categoryTotal;
        totalItems += categoryItems.length; // ✅ CORRIGIDO - só conta válidos

        // Header da categoria (clicável)
        html += `
            <div class="summary-category">
                <div class="summary-category-header" style="cursor: pointer; padding: 8px 0; background: #f8f9fa; margin: 5px 0; padding: 8px;">
                    <i class="fas fa-chevron-down category-toggle-icon" style="margin-right: 8px; font-size: 12px;"></i>
                    <strong>${category}</strong>
                    <span style="float: right; color: #666;">
                        ${categoryItems.length} ${categoryItems.length === 1 ? 'item' : 'items'} 
                        ${showPrices && categoryTotal > 0 ? `| $${categoryTotal.toFixed(2)}` : ''}
                    </span>
                </div>
                <div class="summary-category-items" style="display: ${index === 0 ? 'block' : 'none'};">
        `;

        // Items da categoria (só válidos)
        categoryItems.forEach(item => {
            let price = 'No price';
            if (item.price > 0) {
                price = `$${item.price.toFixed(2)}`;
            }

            html += `
                <div class="summary-item" style="padding: 4px 8px; margin-left: 20px;">
                    <span style="color: #666;">${item.fileName}</span>
                    ${showPrices ? `<span style="float: right;">${price}</span>` : ''}
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    html += '</div>';

    // USAR CÁLCULO SIMPLES LOCAL
    const cartTotal = await CartSystem.calculateCartTotal();

    // Totais
    html += '<div class="summary-totals" style="border-top: 2px solid #dee2e6; margin-top: 15px; padding-top: 15px;">';

    // Verificar se deve mostrar preços
    if (!showPrices) {
        // Não mostrar preços - apenas quantidade
        html += `
            <div class="summary-total-line">
                <span><strong>Total Items:</strong></span>
                <span><strong>${totalItems}</strong></span>
            </div>
        `;
    } else {
        // Mostrar preços
        html += `
            <div class="summary-total-line final" style="font-size: 1.2em; font-weight: bold; border-top: 2px solid #333; margin-top: 10px; padding-top: 10px;">
                <span>TOTAL:</span>
                <span>${cartTotal.formattedTotal}</span>
            </div>
        `;
    }

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
window.toggleSummaryCategory = toggleSummaryCategory;

console.log('📦 cart.js carregado - aguardando inicialização...');