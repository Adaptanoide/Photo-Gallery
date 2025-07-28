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
        let sessionId = localStorage.getItem('cartSessionId');
        
        if (!sessionId) {
            sessionId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('cartSessionId', sessionId);
        }
        
        this.state.sessionId = sessionId;
        console.log(`🔑 Session ID: ${sessionId}`);
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
            badge: document.getElementById('cartBadge'),
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
        const criticalElements = ['sidebar', 'badge', 'floatingBtn'];
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
                throw new Error('Sessão do cliente não encontrada');
            }
            
            const requestData = {
                sessionId: this.state.sessionId,
                clientCode: clientSession.accessCode,
                clientName: clientSession.user?.name || 'Cliente',
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
                throw new Error(result.message || 'Erro ao adicionar item');
            }
            
            // Atualizar estado local
            await this.loadCart();
            
            // Feedback visual
            this.showNotification(`Item adicionado ao carrinho!`, 'success');
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
                throw new Error(result.message || 'Erro ao remover item');
            }
            
            // Atualizar estado local
            await this.loadCart();
            
            // Feedback visual
            this.showNotification(`Item removido do carrinho`, 'info');
            this.updateToggleButton();
            
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
                
                console.log(`📦 Carrinho carregado: ${this.state.totalItems} itens`);
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
            const text = this.state.totalItems === 0 ? 'Carrinho vazio' : 
                        this.state.totalItems === 1 ? '1 item' : 
                        `${this.state.totalItems} itens`;
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
        this.elements.toggleBtnText.textContent = inCart ? 'Remover do Carrinho' : 'Adicionar ao Carrinho';
        
        // Atualizar ícone
        const icon = this.elements.toggleBtn.querySelector('i');
        if (icon) {
            icon.className = inCart ? 'fas fa-trash-alt' : 'fas fa-shopping-cart';
        }
    },
    
    /**
     * Atualizar conteúdo da sidebar
     */
    updateSidebarContent() {
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
        
        const itemsHTML = this.state.items.map(item => this.renderCartItem(item)).join('');
        this.elements.items.innerHTML = itemsHTML;
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
                    <div class="cart-item-timer ${timerClass}">
                        <i class="fas fa-clock"></i>
                        <span id="timer-${item.driveFileId}">${timeText}</span>
                    </div>
                </div>
                <div class="cart-item-actions">
                    <button class="cart-item-remove" onclick="CartSystem.removeItem('${item.driveFileId}')" title="Remover item">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    },
    
    // ===== SISTEMA DE TIMERS =====
    
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
     * Timer geral do carrinho (menor tempo restante)
     */
    startGeneralTimer() {
        const generalTimer = setInterval(() => {
            if (this.elements.timer && this.state.items.length > 0) {
                const minTime = Math.min(...this.state.items.map(item => item.timeRemaining || 0));
                const minutes = Math.floor(minTime / 60);
                const seconds = minTime % 60;
                this.elements.timer.textContent = `⏰ ${minutes}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
        
        this.state.timers.set('general', generalTimer);
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
        
        this.showNotification('Um item expirou e foi removido do carrinho', 'warning');
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
window.toggleCartItem = async function() {
    const currentPhoto = CartSystem.getCurrentModalPhoto();
    if (!currentPhoto) {
        CartSystem.showNotification('Nenhuma foto selecionada', 'error');
        return;
    }
    
    try {
        if (CartSystem.isInCart(currentPhoto)) {
            await CartSystem.removeItem(currentPhoto);
        } else {
            // Buscar dados da foto atual
            const photoData = window.navigationState?.currentPhotos?.[window.navigationState.currentPhotoIndex];
            
            await CartSystem.addItem(currentPhoto, {
                fileName: photoData?.name || 'Produto sem nome',
                category: window.navigationState?.currentPath?.[0]?.name || 'Categoria',
                thumbnailUrl: photoData?.thumbnailMedium || photoData?.thumbnailLink
            });
        }
    } catch (error) {
        console.error('Erro no toggle do carrinho:', error);
    }
};

/**
 * Abrir sidebar do carrinho
 */
window.openCartSidebar = function() {
    CartSystem.openSidebar();
};

/**
 * Fechar sidebar do carrinho
 */
window.closeCartSidebar = function() {
    CartSystem.closeSidebar();
};

/**
 * Prosseguir para finalização da seleção
 */
window.proceedToFinalize = function() {
    if (CartSystem.state.totalItems === 0) {
        CartSystem.showNotification('Carrinho vazio', 'warning');
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
        CartSystem.setLoading(true);
        CartSystem.showNotification('Finalizando seleção...', 'info');
        
        console.log('🎯 Iniciando finalização da seleção:', CartSystem.state.items);
        
        // Buscar dados da sessão do cliente
        const clientSession = CartSystem.getClientSession();
        if (!clientSession) {
            throw new Error('Sessão do cliente não encontrada');
        }
        
        const requestData = {
            sessionId: CartSystem.state.sessionId,
            clientCode: clientSession.accessCode,
            clientName: clientSession.user?.name || 'Cliente'
        };
        
        const response = await fetch('/api/selection/finalize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Erro ao finalizar seleção');
        }
        
        // Sucesso!
        console.log('✅ Seleção finalizada com sucesso:', result);
        
        CartSystem.showNotification('Seleção finalizada com sucesso!', 'success');
        
        // Atualizar carrinho (deve estar vazio agora)
        await CartSystem.loadCart();
        
        // Fechar sidebar
        CartSystem.closeSidebar();
        
        // Mostrar detalhes da seleção
        showSelectionSuccess(result);
        
    } catch (error) {
        console.error('❌ Erro ao finalizar seleção:', error);
        CartSystem.showNotification(error.message, 'error');
    } finally {
        CartSystem.setLoading(false);
    }
}

/**
 * Mostrar modal de sucesso da seleção
 */
function showSelectionSuccess(result) {
    const { selection, googleDrive, nextSteps } = result;
    
    // Preencher dados no modal
    document.getElementById('modalSelectionId').textContent = selection.selectionId;
    document.getElementById('modalItemCount').textContent = `${selection.totalItems} ${selection.totalItems === 1 ? 'item' : 'itens'}`;
    document.getElementById('modalFolderName').textContent = googleDrive.folderCreated;
    
    // Mostrar modal
    const modal = document.getElementById('selectionSuccessModal');
    modal.style.display = 'flex';
    
    // Adicionar classe para animação
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
    
    // Log para debug
    console.log('📋 Detalhes da seleção:', {
        selectionId: selection.selectionId,
        folderName: selection.clientFolderName,
        totalItems: selection.totalItems,
        status: selection.status
    });
    
    // Auto-close em 30 segundos (opcional)
    setTimeout(() => {
        if (modal.style.display === 'flex') {
            continueSelection();
        }
    }, 30000);
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
    
    // Mostrar loading
    CartSystem.showNotification('Redirecionando...', 'info');
    
    // Redirecionar após 1 segundo
    setTimeout(() => {
        window.location.href = '/';
    }, 1000);
    
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

console.log('📦 cart.js carregado - aguardando inicialização...');