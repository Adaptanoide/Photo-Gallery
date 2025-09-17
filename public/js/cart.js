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

            // console.log('🔍 REQUEST DATA SENDO ENVIADO:', {
            //     basePrice: requestData.basePrice,
            //     price: requestData.price,
            //     hasBasePrice: requestData.basePrice !== undefined,
            //     todasAsChaves: Object.keys(requestData)
            // });

            const response = await fetch(`${this.config.apiBaseUrl}/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            const result = await response.json();

            //console.log('🔍 RESPOSTA DO SERVIDOR:', {
            //    success: result.success,
            //    itemAdicionado: result.data?.item
            //});

            if (!response.ok) {
                throw new Error(result.message || 'Error adding item');
            }

            // Atualizar estado local
            await this.loadCart();

            // Atualizar badge de preço
            if (window.updateCategoryPriceBadge) {
                setTimeout(() => window.updateCategoryPriceBadge(), 100);
            }

            // Atualizar modal também
            if (window.updateModalPriceBadge) {
                setTimeout(() => window.updateModalPriceBadge(), 150);
            }

            // Feedback visual
            //this.showNotification(`Item added to cart!`, 'success');
            setTimeout(() => this.updateToggleButton(), 300); // Delay para sincronizar

            console.log(`✅ Item ${driveFileId} adicionado ao carrinho`);

            return result;

        } catch (error) {
            console.error('❌ Erro ao adicionar item:', error);
            // Usar amarelo para itens reservados
            const notificationType = error.message?.includes('reserved') ? 'warning' : 'error';
            this.showNotification(error.message, notificationType); throw error;
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

            // Atualizar badge de preço
            if (window.updateCategoryPriceBadge) {
                setTimeout(() => window.updateCategoryPriceBadge(), 100);
            }

            // Atualizar modal também
            if (window.updateModalPriceBadge) {
                setTimeout(() => window.updateModalPriceBadge(), 150);
            }

            // Feedback visual
            //this.showNotification(`Item removed from cart`, 'info');
            // ADICIONAR ESTAS 3 LINHAS
            if (window.PriceProgressBar && window.PriceProgressBar.updateProgress) {
                window.PriceProgressBar.updateProgress();
            }
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

    /**
     * Carregar carrinho do servidor
     */
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
                    // Atualizar sessionId local
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
                this.state.totalItems = result.totalItems || 0;
                this.updateUI();
                this.startTimers();
                console.log(`📦 Carrinho carregado: ${this.state.totalItems} items`);
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
                modalBtn.innerHTML = '<i class="fas fa-trash"></i><span>Remove</span>';
            } else {
                modalBtn.innerHTML = '<i class="fas fa-shopping-cart"></i><span>Add to Cart</span>';
            }
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

            //console.log(`💰 Total calculado pelo backend:`, {
            // itens: totals.totalItems,
            //subtotal: totals.formattedSubtotal,
            //desconto: `${totals.discountPercent}%`,
            //valorDesconto: totals.formattedDiscountAmount,
            //total: totals.formattedTotal
            //});

            return {
                totalItems: totals.totalItems,
                itemsWithPrice: totals.itemsWithPrice,
                discountSource: totals.discountSource,
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
                formattedSubtotal: total > 0 ? `$${total.toFixed(2)}` : '$0,00',
                formattedDiscountAmount: '$0,00',
                formattedTotal: total > 0 ? `$${total.toFixed(2)}` : '$0,00',
                hasIncompletePrice: itemsWithPrice < this.state.items.length
            };
        }
    },

    /**
     * Calcular desconto para uma categoria específica
     */
    async calculateCategoryDiscount(categoryName, itemCount, categoryTotal) {
        try {
            // Para simplificar, vamos usar a informação do cálculo total
            // que já tem os descontos corretos do backend
            const response = await fetch(`${this.config.apiBaseUrl}/${this.state.sessionId}/calculate-total`);
            const result = await response.json();

            if (result.success && result.data.detalhesCompletos) {
                // Buscar o detalhe desta categoria específica
                const categoryDetail = result.data.detalhesCompletos.find(d =>
                    d.categoria === categoryName ||
                    d.categoria === categoryName + '/' ||
                    d.categoria.includes(categoryName)
                );

                if (categoryDetail) {
                    return {
                        precoUnitario: categoryDetail.precoUnitario,
                        subtotal: categoryDetail.subtotal,
                        fonte: categoryDetail.fonte,
                        regra: categoryDetail.regra
                    };
                }
            }

            // Fallback
            return {
                precoUnitario: categoryTotal / itemCount,
                subtotal: categoryTotal,
                fonte: 'base-price',
                regra: null
            };

        } catch (error) {
            console.error('Erro ao calcular desconto da categoria:', error);
            return {
                precoUnitario: categoryTotal / itemCount,
                subtotal: categoryTotal,
                fonte: 'base-price',
                regra: null
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
         * Renderizar lista de itens do carrinho
         */
    async renderCartItems() {
        if (!this.elements.items) return;

        if (this.state.items.length === 0) {
            this.elements.items.innerHTML = '';
            return;
        }

        // Buscar informações de desconto do backend PRIMEIRO
        let discountDetails = {};
        try {
            const response = await fetch(`${this.config.apiBaseUrl}/${this.state.sessionId}/calculate-total`);
            const result = await response.json();

            //console.log('🔴 RESPOSTA COMPLETA DO BACKEND:', result);

            // DEBUG: Ver EXATAMENTE onde estão os dados
            //console.log('🔍 result.data existe?', !!result.data);
            //console.log('🔍 result.data.detalhesCompletos existe?', !!(result.data && result.data.detalhesCompletos));
            //console.log('🔍 result.data.discountRule existe?', !!(result.data && result.data.discountRule));
            //console.log('🔍 result.data.discountRule.detalhes existe?', !!(result.data && result.data.discountRule && result.data.discountRule.detalhes));

            // FORÇAR busca em TODOS os lugares
            let detalhesArray = null;

            if (result.data && result.data.discountRule && result.data.discountRule.detalhes) {
                detalhesArray = result.data.discountRule.detalhes;
                // console.log('✅ ACHEI EM: data.discountRule.detalhes');
            } else if (result.data && result.data.detalhesCompletos) {
                detalhesArray = result.data.detalhesCompletos;
                // console.log('✅ ACHEI EM: data.detalhesCompletos');
            } else if (result.detalhesCompletos) {
                detalhesArray = result.detalhesCompletos;
                // console.log('✅ ACHEI EM: detalhesCompletos direto');
            } else {
                // console.log('❌ NÃO ACHEI detalhes em lugar nenhum!');
                // console.log('📋 result completo:', JSON.stringify(result, null, 2));
            }

            if (detalhesArray) {
                //console.log('📦 DETALHES ENCONTRADOS:', detalhesArray);

                detalhesArray.forEach(detail => {
                    let catName = detail.categoria;
                    if (catName.endsWith('/')) {
                        catName = catName.slice(0, -1);
                    }
                    const lastSlash = catName.lastIndexOf('/');
                    if (lastSlash !== -1) {
                        catName = catName.substring(lastSlash + 1);
                    }
                    discountDetails[catName] = detail;
                });

                //console.log('💰 MAPA CRIADO:', discountDetails);
            }
        } catch (error) {
            console.error('Erro ao buscar detalhes de desconto:', error);
        }

        // Agrupar itens por categoria
        const categories = {};
        this.state.items.forEach(item => {
            // Pegar categoria completa primeiro
            let cat = (item.pathLevels && item.pathLevels.length > 0)
                ? item.pathLevels[item.pathLevels.length - 1]
                : item.category || 'Uncategorized';

            // PROCESSAR DO MESMO JEITO QUE FIZEMOS COM OS DETALHES
            // Remover barra final se existir
            if (cat.endsWith('/')) {
                cat = cat.slice(0, -1);
            }
            // Pegar apenas o último segmento
            const lastSlash = cat.lastIndexOf('/');
            if (lastSlash !== -1) {
                cat = cat.substring(lastSlash + 1);
            }

            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(item);
        });

        // Renderizar com separadores e collapse
        let html = '';

        html = `
            <div style="
                background: #f5e9c1;
                color: #4b4747;
                padding: 4px;
                border-radius: 100px;
                text-align: center;
                font-weight: 400;
                font-size: 15px;
            ">
                Special pricing available for 12+ photos
            </div>
        `;


        // Para cada categoria
        Object.keys(categories).sort().forEach(category => {
            const items = categories[category];
            const itemCount = items.length;

            // Buscar informação de desconto para esta categoria
            const discountInfo = discountDetails[category];

            let categoryTotal = 0;
            let precoUnitario = 0;
            let categoryDiscount = '';

            if (discountInfo) {
                // USAR VALORES DO BACKEND
                categoryTotal = discountInfo.subtotal;
                precoUnitario = discountInfo.precoUnitario;

                //console.log(`📦 Categoria "${category}": ${itemCount} items x $${precoUnitario} = $${categoryTotal}`);

                // Montar texto de desconto baseado na fonte
                const basePrice = items[0].basePrice || 99;

                // REGRA CLARA: Só mostrar desconto se preço atual for MENOR que base
                if (discountInfo && precoUnitario < basePrice) {
                    const savings = (basePrice * itemCount) - categoryTotal;

                    // Verificar se deve mostrar preços
                    if (!window.shouldShowPrices || !window.shouldShowPrices()) {
                        categoryDiscount = ''; // Não mostrar desconto
                    } else if (discountInfo.fonte === 'custom-client') {
                        categoryDiscount = `
                            <div style="font-size: 0.85em; color: #28a745; margin-top: 4px;">
                                <i class="fas fa-star" style="font-size: 0.8em; color: #ffc107;"></i> 
                                Custom Price: ${itemCount} units = $${precoUnitario} each
                                <span style="color: #28a745;"> (saved $${Math.round(savings)})</span>
                            </div>`;
                    } else if (discountInfo.fonte === 'volume-discount') {
                        categoryDiscount = `
                            <div style="font-size: 0.85em; color: #28a745; margin-top: 4px;">
                                <i class="fas fa-tag" style="font-size: 0.8em;"></i> 
                                Volume Discount: ${itemCount} units = $${precoUnitario} each
                                <span style="color: #28a745;"> (saved $${Math.round(savings)})</span>
                            </div>`;
                    }
                }
                // Se preço = base, não mostra nada (categoryDiscount fica vazio)
            } else {
                // FALLBACK: Calcular localmente se não encontrou desconto
                categoryTotal = items.reduce((sum, item) => {
                    return sum + (item.price || item.basePrice || 0);
                }, 0);
                precoUnitario = itemCount > 0 ? Math.round(categoryTotal / itemCount) : 0;
                console.log(`⚠️ Categoria "${category}": Usando cálculo local (fallback)`);
            }

            // ID único para a categoria (remover caracteres especiais)
            const categoryId = category.replace(/[^a-zA-Z0-9]/g, '_');

            // Cabeçalho clicável da categoria
            html += `
                <div class="category-divider" onclick="CartSystem.toggleCategory('${categoryId}')" style="cursor: pointer;">
                    <div class="category-left">
                        <i class="fas fa-chevron-down category-toggle" id="toggle-${categoryId}"></i>
                        <span class="category-label" title="${items[0].fullPath || category}">${category}</span>
                        <span class="category-count">${itemCount} ${itemCount === 1 ? 'item' : 'items'}</span>
                    </div>
                    <div class="category-right">
                        ${(window.shouldShowPrices && window.shouldShowPrices()) ?
                    `<span class="category-subtotal">$${categoryTotal.toFixed(2)}</span>` :
                    ''
                }
                    </div>
                </div>`;

            // Adicionar info de desconto se houver
            if (categoryDiscount) {
                html += `<div style="padding: 0 15px 8px 40px;">${categoryDiscount}</div>`;
            }

            // Container dos itens (colapsável)
            html += `<div class="category-items" id="items-${categoryId}">`;

            // Adicionar cada item da categoria
            items.forEach(item => {
                // Criar cópia do item com preço correto
                const modifiedItem = { ...item };

                // SE TEM DESCONTO, APLICAR O PREÇO UNITÁRIO COM DESCONTO
                if (discountInfo && precoUnitario > 0) {
                    modifiedItem.formattedPrice = `$${precoUnitario.toFixed(2)}`;
                    modifiedItem.price = precoUnitario;
                    modifiedItem.hasPrice = true;

                    // Guardar preço original se for diferente
                    if (item.price && item.price !== precoUnitario) {
                        modifiedItem.originalPrice = item.price;
                    }
                }



                // Renderizar o item
                html += this.renderCartItem(modifiedItem);
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
        // ESCAPAR aspas duplas para uso seguro no HTML
        const safeDriveFileId = item.driveFileId.replace(/"/g, '&quot;');
        const timeRemaining = item.timeRemaining || 0;
        const timeText = this.formatTimeReadable(timeRemaining);

        let timerClass = '';
        if (timeRemaining < 300) timerClass = 'critical';
        else if (timeRemaining < 600) timerClass = 'warning';

        return `
            <div class="cart-item" data-drive-file-id="${safeDriveFileId}">
                <div class="cart-item-image" style="cursor: pointer;">
                    ${item.thumbnailUrl ?
                `<img src="${item.thumbnailUrl}" alt="${item.fileName}" loading="lazy">` :
                `<div class="placeholder"><i class="fas fa-image"></i></div>`
            }
                </div>
                <div class="cart-item-info" style="cursor: pointer;">
                    <div class="cart-item-title">${item.fileName}</div>
                    <div class="cart-item-category">${item.category}</div>
                    ${(window.shouldShowPrices && window.shouldShowPrices()) ?
                `<div class="cart-item-price">
                                ${item.hasPrice ?
                    `<span class="price-value">${item.formattedPrice}</span>` :
                    `<span class="price-consult">Check price</span>`
                }
                            </div>` :
                ''
            }
                    <div class="cart-item-timer ${timerClass}">
                        <i class="fas fa-clock"></i>
                        <span id="timer-${item.fileName || item.driveFileId.split('/').pop()}">${timeText}</span>
                    </div>
                </div>
                <div class="cart-item-actions">
                    <button class="cart-item-remove" title="Remove item">
                        <i class="fas fa-trash-alt"></i>
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
                    modalBtn.innerHTML = '<i class="fas fa-trash"></i><span>Remove</span>';
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

            // Verificar se tem customPrice (Special Selection)
            if (photo.customPrice) {
                priceInfo = {
                    hasPrice: true,
                    basePrice: parseFloat(photo.customPrice),
                    price: parseFloat(photo.customPrice),
                    formattedPrice: `$${parseFloat(photo.customPrice).toFixed(2)}`
                };
            } else if (window.navigationState.currentFolderId && window.loadCategoryPrice) {
                // Buscar preço da categoria
                try {
                    priceInfo = await window.loadCategoryPrice(window.navigationState.currentFolderId);
                } catch (error) {
                    console.warn('Erro ao buscar preço:', error);
                }
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

    // Agrupar por categoria
    const categories = {};
    let discountDetails = {};
    try {
        const response = await fetch(`${CartSystem.config.apiBaseUrl}/${CartSystem.state.sessionId}/calculate-total`);
        const result = await response.json();

        if (result.success && result.data && result.data.discountRule && result.data.discountRule.detalhes) {
            result.data.discountRule.detalhes.forEach(detail => {
                let catName = detail.categoria;
                if (catName.endsWith('/')) {
                    catName = catName.slice(0, -1);
                }
                const lastSlash = catName.lastIndexOf('/');
                if (lastSlash !== -1) {
                    catName = catName.substring(lastSlash + 1);
                }
                discountDetails[catName] = detail;
            });
        }
    } catch (error) {
        console.error('Erro ao buscar descontos para summary:', error);
    }
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
    const isSpecialClient = clientCode === '8041' || clientCode === 'TESTE';

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
        const categoryItems = categories[category];
        let categoryTotal = 0;
        let categoryItemsWithPrice = 0;

        // PROCESSAR NOME DA CATEGORIA DO MESMO JEITO
        let categorySearchName = category;
        if (categorySearchName.endsWith('/')) {
            categorySearchName = categorySearchName.slice(0, -1);
        }
        const lastSlash = categorySearchName.lastIndexOf('/');
        if (lastSlash !== -1) {
            categorySearchName = categorySearchName.substring(lastSlash + 1);
        }

        // AGORA BUSCAR COM O NOME PROCESSADO
        const discountInfo = discountDetails[categorySearchName];


        // Calcular total da categoria COM DESCONTO
        if (discountInfo && discountInfo.precoUnitario) {
            // Usar preço com desconto
            categoryTotal = discountInfo.precoUnitario * categoryItems.length;
            categoryItemsWithPrice = categoryItems.length;
        } else {
            // Usar preço normal
            categoryItems.forEach(item => {
                if (item.hasPrice && item.price > 0) {
                    categoryTotal += item.price;
                    categoryItemsWithPrice++;
                }
            });
        }

        grandTotal += categoryTotal;
        totalItems += categoryItems.length;
        // Header da categoria (clicável)
        html += `
                <div class="summary-category">
                    <div class="summary-category-header" style="cursor: pointer; padding: 8px 0; background: #f8f9fa; margin: 5px 0; padding: 8px;">
                        <i class="fas fa-chevron-down category-toggle-icon" style="margin-right: 8px; font-size: 12px;"></i>
                        <strong>${category}</strong>
                        <span style="float: right; color: #666;">
                            ${categoryItems.length} ${categoryItems.length === 1 ? 'item' : 'items'} 
                            ${showPrices ? `| $${categoryTotal.toFixed(2)}` : ''}
                        </span>
                    </div>
                    <div class="summary-category-items" style="display: ${index === 0 ? 'block' : 'none'};">
            `;

        // ADICIONAR LINHA DE DESCONTO SE HOUVER
        if (discountInfo && discountInfo.precoUnitario) {
            // Pegar o base price REAL da categoria (não fixo!)
            const basePrice = categoryItems[0].basePrice || 99; // 99 só como fallback

            // Só mostrar se preço atual for menor que base
            if (discountInfo.precoUnitario < basePrice) {
                const savings = (basePrice * categoryItems.length) - (discountInfo.precoUnitario * categoryItems.length);

                // Determinar ícone e texto baseado no tipo
                const icon = discountInfo.fonte === 'custom-client'
                    ? '<i class="fas fa-star" style="color: #ffc107;"></i>'
                    : '<i class="fas fa-tag" style="color: #28a745;"></i>';

                const label = discountInfo.fonte === 'custom-client'
                    ? 'Custom Price'
                    : 'Volume Discount';

                html += `
                    <div style="padding: 8px 20px; color: #28a745; font-size: 0.9em;">
                        ${icon}
                        ${label}: ${categoryItems.length} units = $${discountInfo.precoUnitario} each
                        <span style="color: #28a745;">(saved $${Math.round(savings)})</span>
                    </div>
                `;
            }
        }

        // Items da categoria
        categoryItems.forEach(item => {
            // NOVO: Usar preço com desconto se existir
            let price = 'No price';
            if (discountInfo && discountInfo.precoUnitario) {
                // Usar o preço com desconto
                price = `$${discountInfo.precoUnitario.toFixed(2)}`;
            } else if (item.hasPrice && item.price > 0) {
                // Usar o preço normal
                price = item.formattedPrice;
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

    // USAR O CÁLCULO REAL DO CARRINHO
    const cartTotal = await CartSystem.calculateCartTotal();

    // Totais
    html += '<div class="summary-totals" style="border-top: 2px solid #dee2e6; margin-top: 15px; padding-top: 15px;">';

    // Verificar se deve mostrar preços
    if (!showPrices) {
        // Não mostrar preços - apenas quantidade e Contact for Price
        html += `
            <div class="summary-total-line">
                <span><strong>Total Items:</strong></span>
                <span><strong>${totalItems}</strong></span>
            </div>
            <div class="contact-price" style="display: none; margin-top: 15px; padding: 15px; text-align: center;">
                <i class="fas fa-phone"></i> Contact for Price
            </div>
        `;
    } else {
        // Mostrar preços normalmente - SEU CÓDIGO ORIGINAL
        // Mostrar desconto correto baseado na fonte
        if (cartTotal.hasDiscount && cartTotal.discountAmount > 0) {
            let discountLabel = 'Discount:';
            let discountColor = '#28a745';

            // Determinar tipo de desconto
            if (cartTotal.discountSource === 'custom-client') {
                discountLabel = 'Volume Discount:';
                discountColor = '#ffc107';
            } else if (cartTotal.discountSource === 'volume-global') {
                discountLabel = 'Volume Discount:';
            }

            html += `
                <div class="summary-total-line" style="color: ${discountColor};">
                    <span>${discountLabel}</span>
                    <span>-${cartTotal.formattedDiscountAmount}</span>
                </div>
            `;
        }

        html += `
            <div class="summary-total-line final" style="font-size: 1.2em; font-weight: bold; border-top: 2px solid #333; margin-top: 10px; padding-top: 10px;">
                <span>TOTAL:</span>
                <span>${cartTotal.formattedTotal}</span>
            </div>
        `;

        // Adicionar nota sobre o tipo de cliente
        if (isSpecialClient) {
            html += `
                <div style="text-align: center; margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 5px;">
                    <small style="color: #856404;">
                        <i class="fas fa-star" style="color: #ffc107;"></i> 
                        Volume Pricing Applied
                    </small>
                </div>
            `;
        }
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