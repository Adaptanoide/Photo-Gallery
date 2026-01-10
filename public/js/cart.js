//public/js/cart.js

/**
 * CART.JS - SUNSHINE COWHIDES
 * Sistema de carrinho modular para e-commerce de produtos únicos
 * Integração com backend CartService via APIs REST
 */

// ===== MAPEAMENTO ROBUSTO DE CATEGORIAS =====
// Apenas 8 categorias permitidas no carrinho:
// 1. Brazil Best Sellers (Natural Cowhides)
// 2. Brazil Top Selected (Natural Cowhides)
// 3. Colombian Cowhides (Natural Cowhides)
// 4. Specialty Cowhides
// 5. Small Accent Hides
// 6. Patchwork Rugs
// 7. Accessories
// 8. Furniture

// Mapeia catalogCategory (produtos de stock) → categoria principal do carrinho
const CATALOG_CATEGORY_MAP = {
    // Small Accent Hides
    'sheepskin': 'Small Accent Hides',
    'calfskin': 'Small Accent Hides',
    'goatskin': 'Small Accent Hides',

    // Specialty Cowhides
    'printed': 'Specialty Cowhides',
    'metallic': 'Specialty Cowhides',
    'dyed': 'Specialty Cowhides',

    // Patchwork Rugs
    'chevron-rugs': 'Patchwork Rugs',
    'standard-patchwork': 'Patchwork Rugs',
    'runner-rugs': 'Patchwork Rugs',
    'bedside-rugs': 'Patchwork Rugs',

    // Accessories
    'pillows': 'Accessories',
    'bags-purses': 'Accessories',
    'table-kitchen': 'Accessories',
    'slippers': 'Accessories',
    'scraps-diy': 'Accessories',
    'gifts-seasonal': 'Accessories',

    // Furniture
    'pouf-ottoman': 'Furniture',
    'leather-furniture': 'Furniture',
    'foot-stool': 'Furniture'
};

// Mapeia folderPath (fotos únicas) → categoria principal do carrinho
const FOLDER_PATH_MAP = {
    // Natural Cowhides (3 especiais)
    'Brazil Best Sellers': 'Brazil Best Sellers',
    'Brazil Top Selected Categories': 'Brazil Top Selected',
    'Colombian Cowhides': 'Colombian Cowhides',

    // Small Accent Hides
    'Sheepskins': 'Small Accent Hides',

    // Specialty Cowhides
    'Cowhide Hair On BRA With Leather Binding And Lined': 'Specialty Cowhides',

    // Patchwork Rugs
    'Rodeo Rugs': 'Patchwork Rugs'
};

// Mapeia categorias CDE (UPPERCASE) → categoria principal do carrinho
const CDE_CATEGORY_MAP = {
    // CDE main categories
    'COWHIDES': 'Specialty Cowhides',
    'SMALL HIDES': 'Small Accent Hides',
    'ACCESORIOS': 'Accessories',
    'ACCESORIO': 'Accessories',
    'ACCESSORIES': 'Accessories',
    'MOBILIARIO': 'Furniture',
    'FURNITURE': 'Furniture',
    'PUFFS': 'Furniture',
    'DESIGNER': 'Patchwork Rugs',
    'DESIGNER RUG': 'Patchwork Rugs',
    'RODEO RUGS': 'Patchwork Rugs',

    // ✅ SHEEPSKIN e subcategorias de Small Hides
    'SHEEPSKIN': 'Small Accent Hides',
    'SHEEPSKINS': 'Small Accent Hides',
    'CALFSKIN': 'Small Accent Hides',
    'CALFSKINS': 'Small Accent Hides',
    'GOATSKIN': 'Small Accent Hides',
    'GOATSKINS': 'Small Accent Hides',

    // ✅ Subcategorias de Specialty Cowhides
    'PRINTED': 'Specialty Cowhides',
    'METALLIC': 'Specialty Cowhides',
    'DYED': 'Specialty Cowhides',
    'DEVORE': 'Specialty Cowhides'
};

// ===== MIX & MATCH POOLS CONFIGURATION =====
// Define which categories have their own Mix & Match tier pricing
const MIX_MATCH_POOLS = {
    'natural-cowhides': {
        id: 'natural-cowhides',
        name: 'Natural Cowhides',
        icon: 'fa-layer-group',
        color: '#8B4513',
        // Categories that belong to this pool
        matchCategories: ['Brazil Best Sellers', 'Brazil Top Selected', 'Colombian Cowhides'],
        matchPaths: ['NATURAL COWHIDES', 'NATURAL-COWHIDES', 'BRAZIL BEST SELLERS', 'BRAZIL TOP SELECTED', 'COLOMBIAN COWHIDES'],
        // Tier structure (quantity-based discount from backend)
        hasTiers: true,
        tierType: 'quantity-discount', // Discount calculated by backend based on total quantity
        tiers: [
            { level: 1, name: 'Tier 1', min: 1, max: 4, color: '#CD7F32' },
            { level: 2, name: 'Tier 2', min: 5, max: 12, color: '#A8A8A8' },
            { level: 3, name: 'Tier 3', min: 13, max: Infinity, color: '#D4AF37' }
        ]
    },
    'goatskin': {
        id: 'goatskin',
        name: 'Goatskins',
        icon: 'fa-layer-group',
        color: '#CD7F32', // Bronze base color
        // Categories that belong to this pool
        matchCategories: ['goatskin'],
        matchCatalogCategory: 'goatskin',
        matchQBPrefix: '900',
        // Tier structure (fixed price tiers)
        hasTiers: true,
        tierType: 'fixed-price',
        tiers: [
            { level: 1, name: 'Bronze', min: 1, max: 12, color: '#CD7F32' },
            { level: 2, name: 'Silver', min: 13, max: 24, color: '#A8A8A8' },
            { level: 3, name: 'Gold', min: 25, max: Infinity, color: '#D4AF37' }
        ]
    },
    'calfskin': {
        id: 'calfskin',
        name: 'Calfskins',
        icon: 'fa-layer-group',
        color: '#8B5A2B', // Brown base color
        // Categories that belong to this pool
        matchCategories: ['calfskin'],
        matchCatalogCategory: 'calfskin',
        // Tier structure (fixed price tiers)
        hasTiers: true,
        tierType: 'fixed-price',
        tiers: [
            { level: 1, name: 'Bronze', min: 1, max: 12, color: '#CD7F32' },
            { level: 2, name: 'Silver', min: 13, max: 24, color: '#A8A8A8' },
            { level: 3, name: 'Gold', min: 25, max: Infinity, color: '#D4AF37' }
        ]
    }
};

/**
 * Check if an item belongs to a specific Mix & Match pool
 * @param {object} item - Cart item
 * @param {object} pool - Mix & Match pool configuration
 * @returns {boolean}
 */
function itemBelongsToPool(item, pool) {
    // Check catalog category
    if (pool.matchCatalogCategory && item.catalogCategory === pool.matchCatalogCategory) {
        return true;
    }

    // Check QB prefix
    if (pool.matchQBPrefix && item.qbItem && item.qbItem.startsWith(pool.matchQBPrefix)) {
        return true;
    }

    // Check product name
    if (pool.matchCatalogCategory && item.productName &&
        item.productName.toLowerCase().includes(pool.matchCatalogCategory)) {
        return true;
    }

    // Check path-based matching
    if (pool.matchPaths) {
        const pathToCheck = (item.fullPath || item.category || '').toUpperCase();
        for (const matchPath of pool.matchPaths) {
            if (pathToCheck.includes(matchPath)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Get the Mix & Match pool for an item (if any)
 * @param {object} item - Cart item
 * @returns {object|null} - Pool configuration or null
 */
function getItemMixMatchPool(item) {
    for (const poolId of Object.keys(MIX_MATCH_POOLS)) {
        const pool = MIX_MATCH_POOLS[poolId];
        if (itemBelongsToPool(item, pool)) {
            return pool;
        }
    }
    return null;
}

/**
 * Get tier info for a quantity in a pool
 * @param {object} pool - Mix & Match pool
 * @param {number} quantity - Total quantity in pool
 * @returns {object|null} - Tier info or null
 */
function getPoolTierInfo(pool, quantity) {
    if (!pool || !pool.hasTiers || !pool.tiers) return null;

    for (const tier of pool.tiers) {
        if (quantity >= tier.min && quantity <= tier.max) {
            return {
                level: tier.level,
                name: tier.name,
                color: tier.color,
                poolName: pool.name
            };
        }
    }
    return null;
}

/**
 * Limpar prefixos numéricos (1., 2., etc.) do texto
 * Usado apenas para exibição no cliente
 */
function cleanNumberPrefixes(text) {
    if (!text) return text;
    // Remove padrões como "1. ", "2. ", "10. " no início de cada parte
    return text.replace(/(\s|^)\d+\.\s+/g, '$1').trim();
}

/**
 * Extrair a categoria PRINCIPAL de um path completo
 * "Colombian Cowhides → 1. Medium → Exotic M" → "Colombian Cowhides"
 */
function extractMainCategory(fullPath) {
    if (!fullPath) return fullPath;

    // Se contém " → ", pegar a primeira parte
    if (fullPath.includes(' → ')) {
        return fullPath.split(' → ')[0].trim();
    }

    // Se contém "/", pegar a primeira parte
    if (fullPath.includes('/')) {
        return fullPath.split('/')[0].trim();
    }

    return fullPath;
}

/**
 * Determinar a categoria de exibição no carrinho
 * REGRA: Apenas 8 categorias são permitidas no carrinho
 * @param {string} rawCategory - Categoria raw do item (pode ser path completo, catalogCategory, ou CDE category)
 * @param {object} item - Item completo (opcional) para acesso a catalogCategory
 * @returns {string} Nome da categoria para exibição no carrinho
 */
function getCategoryDisplayName(rawCategory, item = null) {
    if (!rawCategory) return 'Other';

    // ✅ PRIORIDADE 0: Verificar pelo NOME DO PRODUTO (para corrigir erros do CDE)
    // Isso garante que produtos vão para a categoria correta mesmo se CDE classificar errado
    if (item) {
        const productName = (item.productName || item.fileName || '').toLowerCase();

        // Small Accent Hides
        if (productName.includes('sheepskin')) {
            return 'Small Accent Hides';
        }
        if (productName.includes('calfskin')) {
            return 'Small Accent Hides';
        }
        if (productName.includes('goatskin')) {
            return 'Small Accent Hides';
        }

        // Accessories (Bags, Purses, Pillows, etc.)
        if (productName.includes('bag') || productName.includes('purse') || productName.includes('crossbody') ||
            productName.includes('duffle') || productName.includes('handbag') || productName.includes('tote')) {
            return 'Accessories';
        }
        if (productName.includes('pillow')) {
            return 'Accessories';
        }
        if (productName.includes('coaster') || productName.includes('placemat') || productName.includes('napkin')) {
            return 'Accessories';
        }
        if (productName.includes('slipper')) {
            return 'Accessories';
        }
        if (productName.includes('stocking') || productName.includes('ornament')) {
            return 'Accessories';
        }

        // Patchwork Rugs
        if (productName.includes('chevron') || productName.includes('patchwork') || productName.includes('designer rug') ||
            productName.includes('bedside') || productName.includes('runner') || productName.includes('rug designer')) {
            return 'Patchwork Rugs';
        }

        // Furniture
        if (productName.includes('puff') || productName.includes('pouf') || productName.includes('ottoman') ||
            productName.includes('foot stool') || productName.includes('chair') || productName.includes('bench') ||
            productName.includes('stool') || productName.includes('furniture')) {
            return 'Furniture';
        }
    }

    // ✅ PRIORIDADE 1: Se item tem catalogCategory, usar mapeamento de catálogo
    if (item && item.catalogCategory) {
        const catLower = item.catalogCategory.toLowerCase();
        if (CATALOG_CATEGORY_MAP[catLower]) {
            return CATALOG_CATEGORY_MAP[catLower];
        }
    }

    // ✅ PRIORIDADE 2: Extrair categoria principal de paths completos
    const mainCategory = extractMainCategory(rawCategory);

    // ✅ PRIORIDADE 3: Verificar se é uma pasta de fotos únicas (folderPath)
    if (FOLDER_PATH_MAP[mainCategory]) {
        return FOLDER_PATH_MAP[mainCategory];
    }

    // ✅ PRIORIDADE 4: Verificar no mapeamento de catálogo (catalogCategory lowercase)
    const catLower = mainCategory.toLowerCase();
    if (CATALOG_CATEGORY_MAP[catLower]) {
        return CATALOG_CATEGORY_MAP[catLower];
    }

    // ✅ PRIORIDADE 5: Verificar categoria CDE (UPPERCASE)
    const upperMain = mainCategory.toUpperCase();
    if (CDE_CATEGORY_MAP[upperMain]) {
        return CDE_CATEGORY_MAP[upperMain];
    }

    // ✅ PRIORIDADE 6: Verificar com raw category completo
    const rawUpper = rawCategory.toUpperCase();
    if (CDE_CATEGORY_MAP[rawUpper]) {
        return CDE_CATEGORY_MAP[rawUpper];
    }

    // ✅ PRIORIDADE 7: Verificar categorias especiais (Colombia)
    if (mainCategory.toLowerCase().includes('colombian')) {
        return 'Colombian Cowhides';
    }
    if (mainCategory.toLowerCase().includes('brazil best')) {
        return 'Brazil Best Sellers';
    }
    if (mainCategory.toLowerCase().includes('brazil top')) {
        return 'Brazil Top Selected';
    }

    // ✅ FALLBACK: Retornar categoria principal capitalizada
    // Mas NÃO criar novas categorias - mapear para a mais próxima
    console.warn(`⚠️ [CART] Categoria não mapeada: "${rawCategory}" → usando "Other"`);
    return 'Other';
}

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

    /**
     * Obter descrição detalhada do item (subcategoria, tamanho, etc.)
     * Mostra o caminho completo da categoria como era antes
     * Remove prefixos numéricos (1., 2., etc.) para exibição limpa
     */
    getItemSubDescription(item) {
        // Se tem fullPath, mostrar COMPLETO (sem prefixos numéricos)
        if (item.fullPath) {
            let cleanPath = item.fullPath.replace(/→\s*$/, '').trim();
            if (cleanPath) {
                return cleanNumberPrefixes(cleanPath);
            }
        }

        // Se tem pathLevels, juntar todos em um caminho completo
        if (item.pathLevels && item.pathLevels.length > 0) {
            return cleanNumberPrefixes(item.pathLevels.join(' → '));
        }

        // ✅ Se category contém " → " é um caminho completo - mostrar limpo!
        if (item.category && item.category.includes(' → ')) {
            // Limpar trailing → e prefixos numéricos
            const cleanPath = item.category.replace(/→\s*$/, '').trim();
            return cleanNumberPrefixes(cleanPath);
        }

        // Se tem category com subcategorias (formato "Category/Subcategory")
        if (item.category && item.category.includes('/')) {
            const cleanCat = item.category.replace(/\/$/, '');
            return cleanNumberPrefixes(cleanCat.replace(/\//g, ' → '));
        }

        // Para catálogo, mostrar categoria com ícone
        if (item.isCatalogProduct) {
            return `<i class="fas fa-tag" style="margin-right: 4px; color: #B87333;"></i>${getCategoryDisplayName(item.category)}`;
        }

        // Fallback: mostrar a categoria original
        if (item.category) {
            return getCategoryDisplayName(item.category);
        }

        return '';
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
            const t0 = performance.now();
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


            // Feedback visual
            setTimeout(() => this.updateToggleButton(), 100);

            const tTotal = performance.now();
            const totalTime = (tTotal - t0).toFixed(0);


            if (totalTime > 1000) {
            } else if (totalTime > 500) {
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
     * ⭐ OTIMIZADO: Usa dados da resposta ao invés de fazer loadCart() extra
     */
    async removeItem(driveFileId) {
        try {
            this.setLoading(true);

            // ✅ ANTES DE REMOVER: Guardar dados do item se for catálogo (para restaurar estoque na UI)
            const isCatalogItem = driveFileId && driveFileId.startsWith('catalog_');
            let catalogItemData = null;
            if (isCatalogItem) {
                const itemBeforeRemove = this.state.items.find(i => i.driveFileId === driveFileId);
                if (itemBeforeRemove) {
                    catalogItemData = {
                        qbItem: itemBeforeRemove.qbItem,
                        quantity: itemBeforeRemove.quantity || 1
                    };
                    console.log(`📦 Item de catálogo detectado: ${catalogItemData.qbItem} x${catalogItemData.quantity}`);
                }
            }

            // 🆕 Buscar clientCode para fallback no backend
            const clientSession = this.getClientSession();
            const clientCode = clientSession?.accessCode || null;

            const response = await fetch(`${this.config.apiBaseUrl}/remove/${encodeURIComponent(driveFileId)}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.state.sessionId,
                    clientCode: clientCode
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Error removing item');
            }

            // ⭐ OTIMIZAÇÃO: Usar dados da resposta diretamente (evita loadCart() extra)
            if (result.success && result.cart) {
                this.state.items = result.cart.items || [];
                this.state.totalItems = result.cart.totalItems || 0;
                console.log(`✅ Estado atualizado da resposta - ${this.state.totalItems} itens`);

                // Atualizar UI com dados recebidos
                this.updateUI();
                this.startTimers();
            } else {
                // Fallback: se resposta não tem cart, buscar do servidor
                console.warn('⚠️ Resposta sem dados do cart, fazendo fallback...');
                await this.loadCart();
            }

            // Disparar evento para atualizar tiers globalmente
            window.dispatchEvent(new CustomEvent('cartUpdated', {
                detail: {
                    itemCount: this.state.totalItems,
                    items: this.state.items,
                    totals: result.totals  // ✅ Incluir totais do backend
                }
            }));
            console.log('🔔 Evento cartUpdated disparado:', this.state.totalItems, 'items');

            setTimeout(() => this.updateToggleButton(), 100);

            if (window.syncThumbnailButtons) {
                window.syncThumbnailButtons();
            }
            console.log(`✅ Item ${driveFileId} removido do carrinho`);

            // ✅ APÓS REMOVER: Disparar evento para restaurar estoque de catálogo na UI
            if (isCatalogItem && catalogItemData && catalogItemData.qbItem) {
                window.dispatchEvent(new CustomEvent('catalogStockRestored', {
                    detail: {
                        qbItem: catalogItemData.qbItem,
                        quantityRestored: catalogItemData.quantity
                    }
                }));
                console.log(`📊 Evento catalogStockRestored disparado: ${catalogItemData.qbItem} +${catalogItemData.quantity}`);
            }

            return result;

        } catch (error) {
            console.error('❌ Erro ao remover item:', error);
            const notificationType = error.message?.includes('reserved') ? 'warning' : 'error';
            this.showNotification(error.message, notificationType);
            throw error;
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

                // ✅ Disparar evento para atualizar tier highlighting (goatskins)
                window.dispatchEvent(new CustomEvent('cartUpdated', {
                    detail: {
                        itemCount: this.state.totalItems,
                        items: this.state.items
                    }
                }));
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

        // Se cart foi aberto do modal, retornar ao modal
        if (window.cartOpenedFromModal && window.modalStateBeforeCart) {
            setTimeout(() => {
                if (typeof window.returnToModalFromCart === 'function') {
                    window.returnToModalFromCart();
                }
            }, 300);
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

        // Atualizar footer cart badge no modal (mobile)
        const footerCartCount = document.getElementById('footerCartCount');
        if (footerCartCount) {
            footerCartCount.textContent = this.state.totalItems;
        }

        // Atualizar modal cart badge button (mobile header)
        const modalCartBadgeCount = document.getElementById('modalCartBadgeCount');
        if (modalCartBadgeCount) {
            modalCartBadgeCount.textContent = this.state.totalItems;
        }

        // Atualizar badge do botão toggle (desktop colapsado)
        if (window.updateToggleBadge) {
            window.updateToggleBadge(this.state.totalItems);
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

        // 2b. Atualizar footer cart badge no modal (mobile)
        const footerCartCount = document.getElementById('footerCartCount');
        if (footerCartCount) {
            const itemCount = this.state.items ? this.state.items.length : 0;
            footerCartCount.textContent = itemCount;
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
                formattedSubtotal: window.CurrencyManager ? CurrencyManager.format(totals.subtotal || 0) : `$${(totals.subtotal || 0).toFixed(2)}`,
                formattedDiscountAmount: window.CurrencyManager ? CurrencyManager.format(totals.discount || 0) : `$${(totals.discount || 0).toFixed(2)}`,
                formattedTotal: window.CurrencyManager ? CurrencyManager.format(totals.total || 0) : `$${(totals.total || 0).toFixed(2)}`,
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

            // Atualizar o label de items no footer (ao lado do Review Summary)
            const itemsLabel = document.getElementById('cartItemsLabel');
            if (itemsLabel) {
                itemsLabel.textContent = totalText;
            }

            // Nova interface com subtotal e total (SEM "X items" - agora está no footer row)
            let totalHTML = '';

            if (cartTotal.total > 0) {
                // Verificar se deve mostrar preços
                if (!window.shouldShowPrices || !window.shouldShowPrices()) {
                    totalHTML += `
                    <div class="cart-totals-simple">
                        <div class="total-line">
                            <span><strong>Total Items:</strong></span>
                            <span><strong>${this.state.totalItems}</strong></span>
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
                        <div class="discount-line">
                            <span>${discountLabel}</span>
                            <span>-${cartTotal.formattedDiscountAmount}</span>
                        </div>`;
                    }

                    // Total final sempre
                    totalHTML += `
                        <div class="total-line">
                            <span>Total:</span>
                            <span>${cartTotal.formattedTotal}</span>
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

        // Agrupar itens por categoria (usando nome de EXIBIÇÃO para agrupar)
        const categories = {};
        this.state.items.forEach(item => {
            // ✅ ESTRATÉGIA ROBUSTA DE CATEGORIZAÇÃO:
            // 1. Para produtos de catálogo: usar catalogCategory
            // 2. Para fotos únicas: usar PRIMEIRO nível do path (categoria principal)
            // 3. Fallback: usar category do item

            let rawCat;

            if (item.isCatalogProduct && item.catalogCategory) {
                // Produto de catálogo - usar catalogCategory diretamente
                rawCat = item.catalogCategory;
            } else if (item.fullPath) {
                // Foto única com fullPath - extrair categoria principal
                rawCat = item.fullPath;
            } else if (item.pathLevels && item.pathLevels.length > 0) {
                // Foto única com pathLevels - pegar PRIMEIRO nível (categoria principal)
                rawCat = item.pathLevels[0];
            } else {
                // Fallback para category
                rawCat = item.category || 'Uncategorized';
            }

            // ✅ USAR NOME DE EXIBIÇÃO para agrupar
            // Passar item completo para acesso a catalogCategory
            const displayCat = getCategoryDisplayName(rawCat, item);

            if (!categories[displayCat]) categories[displayCat] = [];
            categories[displayCat].push(item);
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

            // ✅ category já é o nome de exibição (agrupamos por displayName)
            // Envolver tudo em category-group para layout unificado
            html += `<div class="category-group">`;

            // Cabeçalho da categoria (clean, sem badge Mix & Match no carrinho)
            html += `
            <div class="category-divider" onclick="CartSystem.toggleCategory('${categoryId}')">
                <div class="category-left">
                    <i class="fas fa-chevron-down category-toggle" id="toggle-${categoryId}"></i>
                    <span class="category-label" title="${items[0].fullPath || category}">${category}</span>
                </div>
                <div class="category-right">
                    <span class="category-count">${itemCount}</span>
                    ${(window.shouldShowPrices && window.shouldShowPrices() && categoryTotal > 0) ?
                    `<span class="category-subtotal">${window.CurrencyManager ? CurrencyManager.format(categoryTotal) : '$' + categoryTotal.toFixed(2)}</span>` :
                    ''
                }
                </div>
            </div>`;

            // Container dos itens
            html += `<div class="category-items" id="items-${categoryId}">`;

            // Renderizar cada item
            items.forEach(item => {
                // ✅ CALCULAR timeRemaining ANTES de renderizar
                if (item.expiresAt) {
                    const now = Date.now();
                    const expires = new Date(item.expiresAt);
                    item.timeRemaining = Math.max(0, Math.floor((expires - now) / 1000));
                } else {
                    item.timeRemaining = 0;
                }

                html += this.renderCartItem(item);
            });

            html += `</div>`; // Close category-items
            html += `</div>`; // Close category-group
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

                // ✅ PRODUTOS DE CATÁLOGO - Preview simples
                if (item.classList.contains('catalog-item')) {
                    const qbItem = item.dataset.qbitem;

                    // Clique na imagem - abre preview simples
                    const img = item.querySelector('.cart-item-image');
                    if (img) {
                        img.style.cursor = 'pointer';
                        img.onclick = (e) => {
                            e.stopPropagation();
                            this.openCatalogPreview(qbItem);
                        };
                    }

                    // Os botões +/- e lixeira já têm handlers inline
                    return;
                }

                // ✅ FOTOS ÚNICAS - Modal fullscreen
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

        // Check if catalog product
        if (item.isCatalogProduct) {
            return this.renderCatalogCartItem(item);
        }

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
                    <div class="cart-item-category ${isGhost ? 'ghost-text' : ''}">${this.getItemSubDescription(item)}</div>

                    ${!isGhost ? `
                        <div class="cart-item-bottom" style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 8px;">
                            ${(window.shouldShowPrices && window.shouldShowPrices()) ? `
                                <div class="cart-item-price">
                                    ${(item.price > 0 || item.basePrice > 0) ?
                        `<span class="price-value">${window.CurrencyManager ? CurrencyManager.format(item.price || item.basePrice) : '$' + (item.price || item.basePrice).toFixed(2)}</span>` :
                        `<span class="price-consult">Check price</span>`
                    }
                           </div>
                            ` : ''}
                            <div class="cart-item-timer ${timerClass}">
                                <i class="fas fa-clock"></i>
                                <span id="timer-${item.fileName || item.driveFileId.split('/').pop()}">${timeText}</span>
                            </div>
                        </div>
                    ` : `
                        <div class="ghost-status">
                            <i class="fas fa-ban"></i> Not available for selection
                        </div>
                    `}
                </div>
                <div class="cart-item-actions">
                    <button class="cart-item-remove ${isGhost ? 'remove-ghost' : ''}" title="${isGhost ? 'Acknowledge and remove' : 'Remove item'}">
                        <i class="fas ${isGhost ? 'fa-times-circle' : 'fa-trash-alt'}"></i>
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Renderizar item de CATÁLOGO no carrinho (com quantidade)
     */
    renderCatalogCartItem(item) {
        const quantity = item.quantity || 1;
        const unitPrice = item.unitPrice || 0;
        const basePrice = item.basePrice || unitPrice;
        const totalPrice = item.price || (unitPrice * quantity);
        const productName = item.productName || item.fileName || 'Product';
        const qbItem = item.qbItem || '';
        const tierInfo = item.tierInfo || null;

        const showPrices = window.shouldShowPrices && window.shouldShowPrices();

        // Check if this is a goatskin with tier pricing
        const isGoatskin = item.catalogCategory === 'goatskin' ||
                          productName.toLowerCase().includes('goatskin');

        // ✅ Determinar o que mostrar no preço
        let priceHtml = '';
        if (showPrices) {
            if (unitPrice > 0) {
                // Check if there's a discount from tier pricing
                const hasDiscount = basePrice > unitPrice && basePrice > 0;

                priceHtml = `
                    <div class="cart-item-price" style="margin-top: 6px;">
                        ${hasDiscount ? `
                            <span class="price-original" style="font-size: 0.75rem; color: #999; text-decoration: line-through; margin-right: 6px;">
                                ${window.CurrencyManager ? CurrencyManager.format(basePrice) : '$' + basePrice.toFixed(2)}
                            </span>
                        ` : ''}
                        <span class="price-value" style="font-size: 0.85rem; color: ${hasDiscount ? '#16a34a' : '#666'};">
                            ${window.CurrencyManager ? CurrencyManager.format(unitPrice) : '$' + unitPrice.toFixed(2)} × ${quantity} =
                        </span>
                        <span class="cart-item-total" style="${hasDiscount ? 'color: #16a34a; font-weight: 700;' : ''}">
                            ${window.CurrencyManager ? CurrencyManager.format(totalPrice) : '$' + totalPrice.toFixed(2)}
                        </span>
                    </div>
                    ${tierInfo && isGoatskin ? `
                        <div class="tier-badge" style="margin-top: 4px; font-size: 0.7rem; color: #666; display: flex; align-items: center; gap: 4px;">
                            <i class="fas fa-layer-group" style="color: ${tierInfo.level >= 3 ? '#D4AF37' : tierInfo.level === 2 ? '#A8A8A8' : '#CD7F32'};"></i>
                            <span>${tierInfo.name}</span>
                            <span style="color: #999;">(${tierInfo.totalQty} total)</span>
                        </div>
                    ` : ''}
                `;
            } else {
                // ✅ Mostrar "No price" quando não tem preço configurado
                priceHtml = `
                    <div class="cart-item-price no-price" style="margin-top: 6px;">
                        <span style="color: #999; font-size: 0.85rem; font-style: italic;">No price</span>
                    </div>
                `;
            }
        }

        return `
            <div class="cart-item catalog-item" data-qbitem="${qbItem}" data-drive-file-id="${item.driveFileId || qbItem}">
                <div class="cart-item-image" style="cursor: default;">
                    ${item.thumbnailUrl ?
                        `<img src="${item.thumbnailUrl}" alt="${productName}" loading="lazy">` :
                        `<div class="placeholder"><i class="fas fa-box"></i></div>`
                    }
                </div>
                <div class="cart-item-info" style="cursor: default;">
                    <div class="cart-item-title">${productName}</div>

                    <div class="cart-item-quantity" onclick="event.stopPropagation()">
                        <button class="qty-btn-small" onclick="event.stopPropagation(); CartSystem.updateCatalogQty('${qbItem}', -1)">
                            <i class="fas fa-minus"></i>
                        </button>
                        <span style="margin: 0 8px; font-weight: 600;">Qty: ${quantity}</span>
                        <button class="qty-btn-small" onclick="event.stopPropagation(); CartSystem.updateCatalogQty('${qbItem}', 1)">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>

                    ${priceHtml}
                </div>
                <div class="cart-item-actions" onclick="event.stopPropagation()">
                    <button class="cart-item-remove" title="Remove item" onclick="event.stopPropagation(); CartSystem.removeCatalogItem('${qbItem}')">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Atualizar quantidade de item de catálogo
     * ⭐ OTIMIZADO: Usa dados da resposta ao invés de fazer loadCart() extra
     */
    async updateCatalogQty(qbItem, delta) {
        try {
            const item = this.state.items.find(i => i.isCatalogProduct && i.qbItem === qbItem);
            if (!item) return;

            const oldQty = item.quantity || 1;
            const newQty = oldQty + delta;

            if (newQty < 1) {
                await this.removeCatalogItem(qbItem);
                return;
            }

            const response = await fetch('/api/cart/update-catalog-quantity', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.state.sessionId,
                    qbItem,
                    quantity: newQty
                })
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || 'Error updating quantity');
            }

            // ⭐ OTIMIZAÇÃO: Usar dados da resposta diretamente
            if (result.success && result.cart) {
                this.state.items = result.cart.items || [];
                this.state.totalItems = result.cart.totalItems || 0;
                this.updateUI();
            } else {
                await this.loadCart();
            }

            // Disparar evento para atualização de tiers
            window.dispatchEvent(new CustomEvent('cartUpdated', {
                detail: {
                    itemCount: this.state.totalItems,
                    items: this.state.items,
                    totals: result.totals
                }
            }));

            // ✅ ATUALIZAR ESTOQUE NO CATÁLOGO
            // delta > 0 = aumentou qty no carrinho = diminui estoque disponível
            // delta < 0 = diminuiu qty no carrinho = aumenta estoque disponível
            const stockChange = -delta; // Inverso: +1 no carrinho = -1 no estoque
            window.dispatchEvent(new CustomEvent('catalogStockChanged', {
                detail: {
                    qbItem: qbItem,
                    stockChange: stockChange
                }
            }));
            console.log(`📊 Estoque atualizado: ${qbItem} ${stockChange > 0 ? '+' : ''}${stockChange}`);

        } catch (error) {
            console.error('❌ Error updating catalog quantity:', error);
            this.showNotification(error.message, 'error');
        }
    },

    /**
     * Remover item de catálogo
     * ⭐ OTIMIZADO: Usa dados da resposta ao invés de fazer loadCart() extra
     */
    async removeCatalogItem(qbItem) {
        try {
            // ✅ Guardar quantidade antes de remover (para restaurar estoque na UI)
            const itemBeforeRemove = this.state.items.find(i => i.isCatalogProduct && i.qbItem === qbItem);
            const quantityRemoved = itemBeforeRemove?.quantity || 1;

            const response = await fetch(`/api/cart/remove-catalog/${encodeURIComponent(qbItem)}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.state.sessionId
                })
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || 'Error removing item');
            }

            // ⭐ OTIMIZAÇÃO: Usar dados da resposta diretamente
            if (result.success && result.cart) {
                this.state.items = result.cart.items || [];
                this.state.totalItems = result.cart.totalItems || 0;
                console.log(`✅ Catálogo removido - ${this.state.totalItems} itens restantes`);

                this.updateUI();
                this.startTimers();
            } else {
                // Fallback
                await this.loadCart();
            }

            // Dispatch event to update catalog buttons
            window.dispatchEvent(new CustomEvent('cartUpdated', {
                detail: {
                    itemCount: this.state.totalItems,
                    items: this.state.items,
                    totals: result.totals
                }
            }));

            // ✅ Dispatch event to restore catalog stock in UI
            window.dispatchEvent(new CustomEvent('catalogStockRestored', {
                detail: {
                    qbItem: qbItem,
                    quantityRestored: quantityRemoved
                }
            }));
            console.log(`📊 Evento catalogStockRestored disparado: ${qbItem} +${quantityRemoved}`);

        } catch (error) {
            console.error('❌ Error removing catalog item:', error);
            this.showNotification(error.message, 'error');
        }
    },

    // ============================================
    // PREVIEW SIMPLES PARA PRODUTOS DE CATÁLOGO
    // ============================================
    openCatalogPreview(qbItem) {
        const item = this.state.items.find(i => i.isCatalogProduct && i.qbItem === qbItem);
        if (!item) {
            console.error('Produto de catálogo não encontrado:', qbItem);
            return;
        }

        const productName = item.productName || item.fileName || 'Product';
        const thumbnailUrl = item.thumbnailUrl;
        const quantity = item.quantity || 1;
        const unitPrice = item.unitPrice || 0;

        // Criar overlay simples
        const overlay = document.createElement('div');
        overlay.id = 'catalog-preview-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            cursor: pointer;
        `;

        // Conteúdo do preview
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 20px;
            max-width: 90%;
            max-height: 90%;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 15px;
            cursor: default;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        `;
        content.onclick = (e) => e.stopPropagation();

        // Imagem
        if (thumbnailUrl) {
            const img = document.createElement('img');
            img.src = thumbnailUrl;
            img.alt = productName;
            img.style.cssText = `
                max-width: 400px;
                max-height: 400px;
                object-fit: contain;
                border-radius: 8px;
            `;
            content.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.innerHTML = '<i class="fas fa-box" style="font-size: 80px; color: #ccc;"></i>';
            placeholder.style.cssText = `
                width: 200px;
                height: 200px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #f5f5f5;
                border-radius: 8px;
            `;
            content.appendChild(placeholder);
        }

        // Título
        const title = document.createElement('h3');
        title.textContent = productName;
        title.style.cssText = `
            margin: 0;
            color: #333;
            font-size: 1.2rem;
            text-align: center;
        `;
        content.appendChild(title);

        // Info
        const info = document.createElement('div');
        info.style.cssText = `
            display: flex;
            gap: 20px;
            color: #666;
            font-size: 0.95rem;
        `;
        info.innerHTML = `
            <span><strong>Qty:</strong> ${quantity}</span>
            ${unitPrice > 0 ? `<span><strong>Price:</strong> $${unitPrice.toFixed(2)}</span>` : ''}
        `;
        content.appendChild(info);

        // Botão fechar
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<i class="fas fa-times"></i> Close';
        closeBtn.style.cssText = `
            padding: 10px 25px;
            background: #B87333;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.95rem;
            margin-top: 10px;
        `;
        closeBtn.onclick = () => overlay.remove();
        content.appendChild(closeBtn);

        overlay.appendChild(content);
        overlay.onclick = () => overlay.remove();

        // ESC para fechar
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        document.body.appendChild(overlay);
        console.log(`📷 Preview aberto para produto de catálogo: ${productName}`);
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
            fullPath: item.fullPath || item.category,  // Include full path for Mix & Match detection
            pathLevels: item.pathLevels || [],
            folderId: item.folderId || '',  // ✅ NOVO: ID da pasta para buscar rate rules específicos
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

                // ✅ LIMPAR CACHE ANTES de buscar preço
                if (window.categoryPrices && window.categoryPrices.has(window.navigationState.currentFolderId)) {
                    console.log('🗑️ [CART] Limpando cache de preço desta categoria');
                    window.categoryPrices.delete(window.navigationState.currentFolderId);
                }

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
                folderId: window.navigationState?.currentFolderId || '',  // ✅ NOVO: Guardar folder ID para rate rules
                basePrice: priceInfo.basePrice || 0,
                price: priceInfo.price || 0,
                formattedPrice: priceInfo.formattedPrice || 'No price',
                hasPrice: priceInfo.hasPrice || false
            };

            console.log('📦 Dados do item montados:', itemData);

            // Adicionar ao carrinho COM OS DADOS COMPLETOS
            await CartSystem.addItem(currentPhoto, itemData);

            // ✅ LIMPAR cache e forçar atualização IMEDIATA
            if (window.categoryPrices && window.navigationState.currentFolderId) {
                window.categoryPrices.delete(window.navigationState.currentFolderId);
            }

            // ✅ Atualizar badge IMEDIATAMENTE (não esperar 200ms)
            const modal = document.getElementById('photoModal');
            if (modal && modal.style.display === 'flex') {
                if (window.updateModalPriceInfo) {
                    // Usar await para garantir atualização ANTES de continuar
                    await window.updateModalPriceInfo();
                }
            }

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
 * Toggle do carrinho (colapsar/expandir) - Desktop only
 */
window.toggleCartSidebar = function () {
    // Só funciona no desktop
    if (window.innerWidth <= 768) return;

    const sidebar = document.getElementById('cartSidebar');
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const main = document.querySelector('.main');
    const scrollToTop = document.querySelector('.scroll-to-top');

    if (!sidebar || !toggleBtn) return;

    const isCollapsed = sidebar.classList.contains('collapsed');

    if (isCollapsed) {
        // Expandir - Carrinho desliza para dentro
        sidebar.classList.remove('collapsed');
        toggleBtn.classList.remove('collapsed');
        if (main) main.classList.remove('cart-collapsed');
        if (scrollToTop) scrollToTop.classList.remove('cart-hidden');
        document.body.classList.remove('cart-collapsed');
        localStorage.setItem('cartCollapsed', 'false');
    } else {
        // Colapsar - Carrinho desliza para fora
        sidebar.classList.add('collapsed');
        toggleBtn.classList.add('collapsed');
        if (main) main.classList.add('cart-collapsed');
        if (scrollToTop) scrollToTop.classList.add('cart-hidden');
        document.body.classList.add('cart-collapsed');
        localStorage.setItem('cartCollapsed', 'true');
    }
};

/**
 * Restaurar estado do carrinho (colapsado/expandido) no carregamento
 */
window.restoreCartState = function () {
    if (window.innerWidth <= 768) return;

    const isCollapsed = localStorage.getItem('cartCollapsed') === 'true';
    const sidebar = document.getElementById('cartSidebar');
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const main = document.querySelector('.main');
    const scrollToTop = document.querySelector('.scroll-to-top');

    if (isCollapsed && sidebar && toggleBtn) {
        sidebar.classList.add('collapsed');
        toggleBtn.classList.add('collapsed');
        if (main) main.classList.add('cart-collapsed');
        if (scrollToTop) scrollToTop.classList.add('cart-hidden');
        document.body.classList.add('cart-collapsed');
    }
};

/**
 * Atualizar badge do botão toggle
 */
window.updateToggleBadge = function (count) {
    const badge = document.getElementById('toggleBadge');
    if (badge) {
        badge.textContent = count || 0;
        badge.setAttribute('data-count', count || 0);
    }
};

// Restaurar estado ao carregar
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(restoreCartState, 100);
});

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

// NOVA FUNÇÃO: Modal de confirmação - Clean Design
function showConfirmationModal(validItems, ghostCount) {
    // Calcular total se preços estiverem visíveis
    const showPrices = window.shouldShowPrices && window.shouldShowPrices();
    let totalValue = 0;
    if (showPrices) {
        validItems.forEach(item => {
            if (item.price > 0) totalValue += item.price;
        });
    }
    const formattedTotal = window.CurrencyManager ? CurrencyManager.format(totalValue) : `$${totalValue.toFixed(2)}`;

    // Check for dark mode
    const isDarkMode = document.body.classList.contains('dark-mode');

    const modalHTML = `
        <style>
            #confirmSelectionModal * { box-sizing: border-box; }
            @keyframes confirmModalSlideIn {
                from { opacity: 0; transform: scale(0.95) translateY(-10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            #confirmSelectionModal .confirm-header-icon {
                width: 56px; height: 56px; background: linear-gradient(135deg, #B87333 0%, #D4A574 100%);
                border-radius: 50%; display: flex; align-items: center; justify-content: center;
                box-shadow: 0 4px 12px rgba(184, 115, 51, 0.3);
            }
            #confirmSelectionModal .info-card {
                border-radius: 10px; padding: 14px 16px;
                display: flex; align-items: flex-start; gap: 12px;
            }
            #confirmSelectionModal .info-card i { font-size: 16px; margin-top: 2px; }
            #confirmSelectionModal .info-card strong { font-size: 0.9rem; }
            #confirmSelectionModal .info-card p { margin: 4px 0 0 0; font-size: 0.85rem; line-height: 1.5; }

            /* Mobile optimizations */
            @media (max-width: 480px) {
                #confirmSelectionModal { padding: 12px !important; }
                #confirmModalBox { border-radius: 12px !important; }
                #confirmSelectionModal .confirm-header-icon { width: 48px; height: 48px; }
                #confirmSelectionModal .confirm-header-icon i { font-size: 20px !important; }
                #confirmSelectionModal .modal-header-section { padding: 16px 16px 12px !important; }
                #confirmSelectionModal .modal-body-section { padding: 14px 16px !important; }
                #confirmSelectionModal .info-card { padding: 12px !important; gap: 10px !important; }
                #confirmSelectionModal .info-card i { font-size: 16px !important; }
                #confirmSelectionModal .info-card strong { font-size: 0.85rem !important; }
                #confirmSelectionModal .info-card p { font-size: 0.8rem !important; }
                #confirmSelectionModal .notes-section { padding: 14px !important; }
                #confirmSelectionModal .notes-section label { font-size: 0.9rem !important; margin-bottom: 8px !important; }
                #confirmSelectionModal .notes-section p { font-size: 0.8rem !important; margin-bottom: 10px !important; }
                #confirmSelectionModal #clientObservations { min-height: 100px !important; padding: 12px !important; font-size: 0.9rem !important; }
                #confirmSelectionModal .modal-footer-section { padding: 12px 16px !important; }
                #confirmSelectionModal .modal-footer-section button { padding: 10px 16px !important; font-size: 0.85rem !important; }
            }
        </style>
        <div id="confirmSelectionModal" style="
            display: flex !important; position: fixed !important; top: 0 !important; left: 0 !important;
            width: 100vw !important; height: 100vh !important; background: rgba(0,0,0,0.6) !important;
            backdrop-filter: blur(4px); z-index: 99999 !important; align-items: center !important;
            justify-content: center !important; padding: 20px !important; margin: 0 !important;
        ">
            <div id="confirmModalBox" style="
                background: ${isDarkMode ? '#2a2a2a' : 'white'} !important; border-radius: 16px !important; max-width: 480px !important;
                width: 100% !important; box-shadow: 0 25px 50px rgba(0, 0, 0, ${isDarkMode ? '0.5' : '0.25'}) !important;
                animation: confirmModalSlideIn 0.3s ease !important; overflow: hidden !important;
                max-height: 90vh !important; display: flex; flex-direction: column;
            ">
                <!-- Header -->
                <div class="modal-header-section" style="padding: 20px 20px 14px; text-align: center; border-bottom: 1px solid ${isDarkMode ? '#3d3d3d' : '#f0f0f0'};">
                    <div class="confirm-header-icon" style="margin: 0 auto 12px;">
                        <i class="fas fa-clipboard-check" style="font-size: 22px; color: white;"></i>
                    </div>
                    <h2 style="margin: 0 0 4px; font-size: 1.2rem; font-weight: 600; color: ${isDarkMode ? '#f0f0f0' : '#1f2937'};">Confirm Your Selection</h2>
                    <p style="margin: 0; color: ${isDarkMode ? '#a0a0a0' : '#6b7280'}; font-size: 0.85rem;">
                        <i class="fas fa-box" style="margin-right: 5px; color: #B87333;"></i>
                        ${validItems.length} item${validItems.length > 1 ? 's' : ''} selected
                        ${showPrices && totalValue > 0 ? `<span style="margin-left: 6px; font-weight: 600; color: ${isDarkMode ? '#4ade80' : '#166534'};">• ${formattedTotal}</span>` : ''}
                    </p>
                </div>

                <!-- Body - Scrollable -->
                <div class="modal-body-section" style="padding: 16px 20px; overflow-y: auto; flex: 1; background: ${isDarkMode ? '#2a2a2a' : 'white'};">
                    ${ghostCount > 0 ? `
                        <div style="background: ${isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#fef3cd'}; border-left: 3px solid #f59e0b; padding: 10px 12px; border-radius: 0 8px 8px 0; margin-bottom: 14px; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-exclamation-triangle" style="color: #f59e0b; font-size: 14px;"></i>
                            <span style="color: ${isDarkMode ? '#fcd34d' : '#92400e'}; font-size: 0.8rem;">${ghostCount} unavailable item(s) will be removed</span>
                        </div>
                    ` : ''}

                    <!-- Info Card - Compact -->
                    <div class="info-card" style="margin-bottom: 14px; background: ${isDarkMode ? 'rgba(22, 163, 74, 0.12)' : '#f0fdf4'}; border: 1px solid ${isDarkMode ? 'rgba(34, 197, 94, 0.3)' : '#bbf7d0'}; border-radius: 10px; padding: 12px 14px; display: flex; gap: 12px;">
                        <i class="fas fa-handshake" style="color: ${isDarkMode ? '#4ade80' : '#16a34a'}; font-size: 18px; flex-shrink: 0; margin-top: 2px;"></i>
                        <div>
                            <strong style="color: ${isDarkMode ? '#86efac' : '#166534'}; font-size: 0.85rem;">What happens next?</strong>
                            <p style="margin: 4px 0 0; color: ${isDarkMode ? '#a0a0a0' : '#15803d'}; font-size: 0.8rem; line-height: 1.4;">Our team will review and contact you to confirm details, shipping, and payment.</p>
                        </div>
                    </div>

                    <!-- Notes Section - Compact -->
                    <div class="notes-section" style="background: ${isDarkMode ? '#333' : '#f8fafc'}; border: 1px solid ${isDarkMode ? '#555' : '#e2e8f0'}; border-radius: 10px; padding: 14px;">
                        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-weight: 600; font-size: 0.9rem; color: ${isDarkMode ? '#e0e0e0' : '#1f2937'};">
                            <i class="fas fa-edit" style="color: #B87333; font-size: 16px;"></i>
                            Additional Notes
                            <span style="font-weight: 400; font-size: 0.8rem; color: ${isDarkMode ? '#888' : '#9ca3af'};">(optional)</span>
                        </label>
                        <p style="margin: 0 0 10px 0; font-size: 0.8rem; color: ${isDarkMode ? '#888' : '#6b7280'}; line-height: 1.5;">
                            Share your shipping address, delivery instructions, questions, or any special requests for your order.
                        </p>
                        <textarea id="clientObservations" style="
                            width: 100%; padding: 12px; border: 1px solid ${isDarkMode ? '#555' : '#e5e7eb'}; border-radius: 8px;
                            resize: vertical; font-size: 0.9rem; font-family: inherit; min-height: 100px;
                            transition: border-color 0.2s, box-shadow 0.2s; background: ${isDarkMode ? '#2a2a2a' : 'white'};
                            color: ${isDarkMode ? '#e0e0e0' : '#1f2937'}; line-height: 1.4;
                        " placeholder="e.g., Shipping address, delivery instructions, questions about items..."
                        onfocus="this.style.borderColor='#B87333'; this.style.boxShadow='0 0 0 3px rgba(184,115,51,0.15)';"
                        onblur="this.style.borderColor='${isDarkMode ? '#555' : '#e5e7eb'}'; this.style.boxShadow='none';"></textarea>
                    </div>
                </div>

                <!-- Footer - Fixed -->
                <div class="modal-footer-section" style="padding: 12px 20px; background: ${isDarkMode ? '#252525' : '#f9fafb'}; border-top: 1px solid ${isDarkMode ? '#3d3d3d' : '#e5e7eb'}; display: flex; gap: 10px; justify-content: space-between; flex-shrink: 0;">
                    <button onclick="cancelConfirmation()" style="
                        padding: 10px 16px; background: ${isDarkMode ? '#3d3d3d' : 'white'}; color: ${isDarkMode ? '#c0c0c0' : '#6b7280'}; border: 1px solid ${isDarkMode ? '#555' : '#e5e7eb'};
                        border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 500; transition: all 0.2s;
                    " onmouseover="this.style.background='${isDarkMode ? '#4d4d4d' : '#f3f4f6'}'; this.style.borderColor='${isDarkMode ? '#666' : '#d1d5db'}';"
                       onmouseout="this.style.background='${isDarkMode ? '#3d3d3d' : 'white'}'; this.style.borderColor='${isDarkMode ? '#555' : '#e5e7eb'}';">
                        Cancel
                    </button>
                    <button onclick="proceedWithSelection()" style="
                        padding: 10px 20px; background: linear-gradient(135deg, #B87333, #A0522D); color: white;
                        border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.85rem;
                        display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(184, 115, 51, 0.3);
                        transition: all 0.2s;
                    " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 16px rgba(184, 115, 51, 0.4)';"
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(184, 115, 51, 0.3)';">
                        <i class="fas fa-check"></i> Confirm Selection
                    </button>
                </div>
            </div>
        </div>
    `;

    const modalDiv = document.createElement('div');
    modalDiv.innerHTML = modalHTML;
    document.body.appendChild(modalDiv);

    // Auto-focus no textarea após um pequeno delay para a animação
    setTimeout(() => {
        const textarea = document.getElementById('clientObservations');
        if (textarea) {
            textarea.focus();
        }
    }, 100);
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

// Modal de sucesso UNIFICADO com Feedback - Clean Design
function showSuccessModalWithMessage(result) {
    const itemCount = result.selection.totalItems;
    const itemText = itemCount === 1 ? 'item' : 'items';
    const isDarkMode = document.body.classList.contains('dark-mode');

    // Get client info for feedback
    const session = JSON.parse(localStorage.getItem('sunshineSession') || '{}');
    const clientName = session.user?.name || 'Client';
    const clientCode = session.accessCode || '';

    // Dark mode colors
    const colors = isDarkMode ? {
        modalBg: '#2a2a2a',
        cardBg: '#333',
        cardBorder: '#444',
        headerBorder: '#444',
        footerBg: '#1f1f1f',
        footerBorder: '#444',
        titleColor: '#e0e0e0',
        subtitleColor: '#9ca3af',
        strongColor: '#e0e0e0',
        textColor: '#b0b0b0',
        warnBg: '#3d3520',
        warnBorder: '#5c4d2a',
        warnTitle: '#fbbf24',
        warnText: '#d4a94a',
        feedbackBg: '#333',
        feedbackBorder: '#444',
        btnBg: '#3d3d3d',
        btnBorder: '#555',
        btnHoverBg: '#4a4540',
        textareaBg: '#2a2a2a',
        textareaBorder: '#555'
    } : {
        modalBg: 'white',
        cardBg: '#fafafa',
        cardBorder: '#e5e7eb',
        headerBorder: '#f0f0f0',
        footerBg: '#f9fafb',
        footerBorder: '#e5e7eb',
        titleColor: '#1f2937',
        subtitleColor: '#6b7280',
        strongColor: '#374151',
        textColor: '#6b7280',
        warnBg: '#fffbeb',
        warnBorder: '#fde68a',
        warnTitle: '#92400e',
        warnText: '#78350f',
        feedbackBg: '#f8fafc',
        feedbackBorder: '#e2e8f0',
        btnBg: 'white',
        btnBorder: '#e5e7eb',
        btnHoverBg: '#faf7f5',
        textareaBg: 'white',
        textareaBorder: '#e5e7eb'
    };

    const modalHTML = `
        <style>
            #successModalOverlay, #successModalOverlay * { box-sizing: border-box !important; }
            @keyframes successModalSlideIn {
                from { opacity: 0; transform: scale(0.95) translateY(-10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            #successModalOverlay {
                position: fixed !important; top: 0 !important; left: 0 !important;
                width: 100vw !important; height: 100vh !important;
                background: rgba(0,0,0,0.6) !important; backdrop-filter: blur(4px) !important;
                z-index: 999999 !important; display: flex !important;
                align-items: center !important; justify-content: center !important;
                padding: 20px !important; margin: 0 !important;
            }
            #successModalOverlay .success-modal-box {
                background: ${colors.modalBg} !important; border-radius: 16px !important;
                max-width: 460px !important; width: 100% !important;
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25) !important;
                animation: successModalSlideIn 0.3s ease !important;
                overflow: hidden !important; display: flex !important;
                flex-direction: column !important; max-height: 90vh !important;
            }
            #successModalOverlay .success-modal-header {
                padding: 16px 20px !important; display: flex !important;
                align-items: center !important; gap: 12px !important;
                border-bottom: 1px solid ${colors.headerBorder} !important;
                flex-shrink: 0 !important;
            }
            #successModalOverlay .success-modal-body {
                padding: 14px 20px !important; overflow-y: auto !important;
                flex: 1 1 auto !important; display: block !important;
            }
            #successModalOverlay .success-info-card {
                background: ${colors.cardBg} !important; border: 1px solid ${colors.cardBorder} !important;
                border-radius: 10px !important; padding: 12px 14px !important;
                display: flex !important; flex-direction: row !important;
                align-items: flex-start !important; gap: 10px !important;
                margin-bottom: 8px !important; width: 100% !important;
            }
            #successModalOverlay .success-info-card > i {
                color: #B87333 !important; font-size: 14px !important;
                margin-top: 2px !important; flex-shrink: 0 !important;
            }
            #successModalOverlay .success-info-card > div { flex: 1 !important; }
            #successModalOverlay .success-info-card strong {
                color: ${colors.strongColor} !important; font-size: 0.85rem !important;
                display: block !important; margin-bottom: 2px !important;
            }
            #successModalOverlay .success-info-card p {
                margin: 0 !important; color: ${colors.textColor} !important;
                font-size: 0.8rem !important; line-height: 1.4 !important;
            }
            #successModalOverlay .success-feedback-section {
                margin-top: 14px !important; padding: 14px !important;
                background: ${colors.feedbackBg} !important;
                border: 1px solid ${colors.feedbackBorder} !important;
                border-radius: 10px !important; display: block !important;
            }
            #successModalOverlay .success-feedback-grid {
                display: grid !important; grid-template-columns: repeat(4, 1fr) !important;
                gap: 6px !important; margin-bottom: 10px !important;
            }
            #successModalOverlay .success-feedback-btn {
                padding: 10px 8px !important; border: 2px solid ${colors.btnBorder} !important;
                border-radius: 8px !important; background: ${colors.btnBg} !important;
                cursor: pointer !important; text-align: center !important;
                transition: all 0.2s ease !important; display: flex !important;
                flex-direction: column !important; align-items: center !important; gap: 4px !important;
            }
            #successModalOverlay .success-feedback-btn:hover {
                border-color: #B87333 !important; background: ${colors.btnHoverBg} !important;
            }
            #successModalOverlay .success-feedback-btn.selected {
                border-color: #B87333 !important; background: ${colors.btnHoverBg} !important;
            }
            #successModalOverlay .success-feedback-btn i {
                font-size: 16px !important; color: #9ca3af !important; transition: color 0.2s !important;
            }
            #successModalOverlay .success-feedback-btn.selected i { color: #B87333 !important; }
            #successModalOverlay .success-feedback-btn span {
                font-size: 0.7rem !important; color: ${colors.textColor} !important; font-weight: 500 !important;
            }
            #successModalOverlay .success-feedback-btn.selected span { color: #B87333 !important; }
            #successModalOverlay .success-modal-footer {
                padding: 14px 20px !important; background: ${colors.footerBg} !important;
                border-top: 1px solid ${colors.footerBorder} !important;
                flex-shrink: 0 !important;
            }

            /* Mobile optimizations */
            @media (max-width: 480px) {
                #successModalOverlay { padding: 12px !important; }
                #successModalOverlay .success-modal-box { border-radius: 12px !important; max-height: 95vh !important; }
                #successModalOverlay .success-modal-header { padding: 14px 16px !important; }
                #successModalOverlay .success-modal-header h2 { font-size: 1rem !important; }
                #successModalOverlay .success-modal-body { padding: 12px 16px !important; }
                #successModalOverlay .success-info-card { padding: 10px 12px !important; margin-bottom: 6px !important; }
                #successModalOverlay .success-info-card > i { font-size: 13px !important; }
                #successModalOverlay .success-info-card strong { font-size: 0.8rem !important; }
                #successModalOverlay .success-info-card p { font-size: 0.75rem !important; }
                #successModalOverlay .success-feedback-section { padding: 12px !important; margin-top: 10px !important; }
                #successModalOverlay .success-feedback-btn { padding: 8px 6px !important; }
                #successModalOverlay .success-feedback-btn i { font-size: 14px !important; }
                #successModalOverlay .success-feedback-btn span { font-size: 0.65rem !important; }
                #successModalOverlay .success-feedback-textarea { min-height: 60px !important; font-size: 0.85rem !important; }
                #successModalOverlay .success-modal-footer { padding: 12px 16px !important; }
                #successModalOverlay .success-modal-footer button { padding: 11px 20px !important; font-size: 0.9rem !important; }
            }
        </style>
        <div id="successModalOverlay">
            <div class="success-modal-box">
                <!-- Header -->
                <div class="success-modal-header">
                    <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.25); flex-shrink: 0;">
                        <i class="fas fa-check" style="color: white; font-size: 16px;"></i>
                    </div>
                    <div>
                        <h2 style="margin: 0; font-size: 1.05rem; font-weight: 600; color: ${colors.titleColor};">Selection Confirmed</h2>
                        <p style="margin: 2px 0 0; color: ${colors.subtitleColor}; font-size: 0.8rem;">
                            <strong style="color: #22c55e;">${itemCount}</strong> ${itemText} reserved for you
                        </p>
                    </div>
                </div>

                <!-- Body -->
                <div class="success-modal-body">
                    <!-- What's Next -->
                    <div class="success-info-card">
                        <i class="fas fa-phone-alt"></i>
                        <div>
                            <strong>What happens now?</strong>
                            <p>Our team will contact you within <strong style="color: #B87333;">24-48 hours</strong> to discuss shipping, payment, and finalize your order.</p>
                        </div>
                    </div>

                    <!-- Items Reserved -->
                    <div class="success-info-card">
                        <i class="fas fa-bookmark"></i>
                        <div>
                            <strong>Your items are reserved</strong>
                            <p>The ${itemText} you selected ${itemCount === 1 ? 'is' : 'are'} now on hold for you.</p>
                        </div>
                    </div>

                    <!-- Gallery Note -->
                    <div class="success-info-card" style="background: ${colors.warnBg} !important; border-color: ${colors.warnBorder} !important;">
                        <i class="fas fa-info-circle" style="color: #d97706 !important;"></i>
                        <div>
                            <strong style="color: ${colors.warnTitle} !important;">Gallery access</strong>
                            <p style="color: ${colors.warnText} !important;">Your gallery will be temporarily paused until your order is confirmed.</p>
                        </div>
                    </div>

                    <!-- Feedback Section -->
                    <div class="success-feedback-section">
                        <p style="margin: 0 0 10px; font-size: 0.8rem; color: ${colors.textColor}; display: flex; align-items: center; gap: 6px;">
                            <i class="fas fa-comment-dots" style="color: #B87333;"></i>
                            <strong style="color: ${colors.strongColor};">Quick Feedback</strong>
                            <span style="color: ${colors.subtitleColor};">(optional)</span>
                        </p>

                        <!-- Feedback Buttons Grid -->
                        <div class="success-feedback-grid">
                            <button class="success-feedback-btn" data-type="variety" onclick="selectUnifiedFeedback(this)">
                                <i class="fas fa-th-large"></i>
                                <span>Variety</span>
                            </button>
                            <button class="success-feedback-btn" data-type="quality" onclick="selectUnifiedFeedback(this)">
                                <i class="fas fa-gem"></i>
                                <span>Quality</span>
                            </button>
                            <button class="success-feedback-btn" data-type="easy" onclick="selectUnifiedFeedback(this)">
                                <i class="fas fa-hand-pointer"></i>
                                <span>Easy</span>
                            </button>
                            <button class="success-feedback-btn" data-type="found_it" onclick="selectUnifiedFeedback(this)">
                                <i class="fas fa-search"></i>
                                <span>Found it</span>
                            </button>
                        </div>

                        <!-- Comments textarea -->
                        <textarea id="unifiedFeedbackMessage" class="success-feedback-textarea" style="
                            width: 100% !important; padding: 10px 12px !important;
                            border: 1px solid ${colors.textareaBorder} !important; border-radius: 8px !important;
                            resize: none !important; font-size: 0.85rem !important; font-family: inherit !important;
                            min-height: 70px !important; transition: border-color 0.2s, box-shadow 0.2s !important;
                            background: ${colors.textareaBg} !important; color: ${colors.titleColor} !important;
                            line-height: 1.4 !important; display: block !important;
                        " placeholder="Any comments or suggestions? (optional)"
                        onfocus="this.style.borderColor='#B87333'; this.style.boxShadow='0 0 0 3px rgba(184,115,51,0.1)';"
                        onblur="this.style.borderColor='${colors.textareaBorder}'; this.style.boxShadow='none';"></textarea>
                    </div>
                </div>

                <!-- Footer -->
                <div class="success-modal-footer">
                    <button onclick="submitUnifiedFeedbackAndClose('${clientName}', '${clientCode}')" style="
                        padding: 12px 24px !important; background: linear-gradient(135deg, #B87333, #A0522D) !important;
                        color: white !important; border: none !important; border-radius: 8px !important;
                        cursor: pointer !important; font-weight: 600 !important; font-size: 0.95rem !important;
                        display: flex !important; align-items: center !important; justify-content: center !important;
                        gap: 10px !important; width: 100% !important;
                        box-shadow: 0 4px 12px rgba(184, 115, 51, 0.3) !important; transition: all 0.2s !important;
                    " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 16px rgba(184, 115, 51, 0.4)';"
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(184, 115, 51, 0.3)';">
                        <i class="fas fa-home"></i> Done
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Unified feedback selection
let unifiedSelectedFeedback = null;

function selectUnifiedFeedback(btn) {
    // Toggle selection
    if (btn.classList.contains('selected')) {
        btn.classList.remove('selected');
        unifiedSelectedFeedback = null;
    } else {
        // Remove selected from all
        document.querySelectorAll('#successModalOverlay .success-feedback-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        unifiedSelectedFeedback = btn.dataset.type;
    }
}
window.selectUnifiedFeedback = selectUnifiedFeedback;

// Submit feedback and close modal
async function submitUnifiedFeedbackAndClose(clientName, clientCode) {
    const message = document.getElementById('unifiedFeedbackMessage')?.value?.trim() || '';
    const type = unifiedSelectedFeedback;

    // Send feedback if any was provided
    if (type || message) {
        try {
            await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientName,
                    clientCode,
                    type: type || 'general',
                    message,
                    page: 'selection-complete'
                })
            });
            console.log('✅ Feedback enviado');
        } catch (e) {
            console.log('Feedback not saved, continuing anyway');
        }
    }

    // Reset state
    unifiedSelectedFeedback = null;

    // Redirect home
    location.href = '/';
}
window.submitUnifiedFeedbackAndClose = submitUnifiedFeedbackAndClose;

// ============================================
// FEEDBACK MODAL SYSTEM
// ============================================

function showFeedbackModal() {
    // Get client name from session
    const session = JSON.parse(localStorage.getItem('sunshineSession') || '{}');
    const clientName = session.user?.name || 'Client';
    const clientCode = session.accessCode || '';
    const isDarkMode = document.body.classList.contains('dark-mode');

    // Dark mode colors
    const colors = isDarkMode ? {
        modalBg: '#2a2a2a',
        headerBorder: '#444',
        footerBg: '#1f1f1f',
        footerBorder: '#444',
        titleColor: '#e0e0e0',
        subtitleColor: '#9ca3af',
        textColor: '#b0b0b0',
        labelColor: '#c0c0c0',
        btnBg: '#333',
        btnBorder: '#555',
        btnHoverBg: '#3d3a35',
        textareaBg: '#333',
        textareaBorder: '#555',
        skipBtnBg: '#333',
        skipBtnBorder: '#555',
        skipBtnColor: '#b0b0b0',
        skipBtnHoverBg: '#3d3d3d'
    } : {
        modalBg: 'white',
        headerBorder: '#f0f0f0',
        footerBg: '#f9fafb',
        footerBorder: '#e5e7eb',
        titleColor: '#1f2937',
        subtitleColor: '#9ca3af',
        textColor: '#6b7280',
        labelColor: '#374151',
        btnBg: 'white',
        btnBorder: '#e5e7eb',
        btnHoverBg: '#faf7f5',
        textareaBg: '#fafafa',
        textareaBorder: '#e5e7eb',
        skipBtnBg: 'white',
        skipBtnBorder: '#e5e7eb',
        skipBtnColor: '#6b7280',
        skipBtnHoverBg: '#f3f4f6'
    };

    const feedbackHTML = `
        <style>
            #feedbackModal * { box-sizing: border-box; }
            @keyframes feedbackModalSlideIn {
                from { opacity: 0; transform: scale(0.95) translateY(-10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                20%, 60% { transform: translateX(-5px); }
                40%, 80% { transform: translateX(5px); }
            }
            #feedbackModal .feedback-type-btn {
                flex: 1; min-width: 100px; padding: 12px 10px; border: 2px solid ${colors.btnBorder};
                border-radius: 10px; background: ${colors.btnBg}; cursor: pointer; text-align: center;
                transition: all 0.2s ease; display: flex; flex-direction: column; align-items: center; gap: 6px;
            }
            #feedbackModal .feedback-type-btn:hover { border-color: #B87333; background: ${colors.btnHoverBg}; }
            #feedbackModal .feedback-type-btn.selected { border-color: #B87333; background: ${colors.btnHoverBg}; }
            #feedbackModal .feedback-type-btn i { font-size: 20px; color: #9ca3af; transition: color 0.2s; }
            #feedbackModal .feedback-type-btn.selected i { color: #B87333; }
            #feedbackModal .feedback-type-btn span { font-size: 0.8rem; color: ${colors.textColor}; font-weight: 500; }
            #feedbackModal .feedback-type-btn.selected span { color: #B87333; }
        </style>
        <div id="feedbackModal" style="
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 100000;
            display: flex; align-items: center; justify-content: center; padding: 20px;
        ">
            <div style="
                background: ${colors.modalBg}; border-radius: 16px; max-width: 440px; width: 100%;
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25); animation: feedbackModalSlideIn 0.3s ease;
                overflow: hidden; display: flex; flex-direction: column; max-height: 90vh;
            ">
                <!-- Header -->
                <div style="padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid ${colors.headerBorder};">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="
                            width: 40px; height: 40px; background: linear-gradient(135deg, #B87333, #A0522D);
                            border-radius: 10px; display: flex; align-items: center; justify-content: center;
                        ">
                            <i class="fas fa-comment-dots" style="color: white; font-size: 16px;"></i>
                        </div>
                        <div>
                            <h2 style="margin: 0; font-size: 1.05rem; font-weight: 600; color: ${colors.titleColor};">Share your feedback</h2>
                            <p style="margin: 2px 0 0; color: ${colors.subtitleColor}; font-size: 0.8rem;">Help us improve your experience</p>
                        </div>
                    </div>
                    <button onclick="skipFeedback()" style="
                        background: none; border: none; color: #9ca3af; cursor: pointer;
                        font-size: 1.1rem; padding: 4px; transition: color 0.2s;
                    " onmouseover="this.style.color='${isDarkMode ? '#e0e0e0' : '#6b7280'}'" onmouseout="this.style.color='#9ca3af'">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Body -->
                <div style="padding: 20px 24px; overflow-y: auto; flex: 1;">
                    <p style="margin: 0 0 14px; font-size: 0.85rem; color: ${colors.textColor};">
                        What type of feedback would you like to share?
                    </p>

                    <!-- Feedback Types -->
                    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px;">
                        <button class="feedback-type-btn" data-type="suggestion" onclick="selectFeedbackType(this)">
                            <i class="fas fa-lightbulb"></i>
                            <span>Suggestion</span>
                        </button>
                        <button class="feedback-type-btn" data-type="issue" onclick="selectFeedbackType(this)">
                            <i class="fas fa-bug"></i>
                            <span>Issue</span>
                        </button>
                        <button class="feedback-type-btn" data-type="question" onclick="selectFeedbackType(this)">
                            <i class="fas fa-question-circle"></i>
                            <span>Question</span>
                        </button>
                        <button class="feedback-type-btn" data-type="praise" onclick="selectFeedbackType(this)">
                            <i class="fas fa-star"></i>
                            <span>Praise</span>
                        </button>
                    </div>

                    <!-- Message -->
                    <div>
                        <label style="display: block; margin-bottom: 8px; font-size: 0.85rem; font-weight: 500; color: ${colors.labelColor};">
                            Your message <span style="color: #9ca3af;">(optional)</span>
                        </label>
                        <textarea id="feedbackMessage" style="
                            width: 100%; padding: 12px 14px; border: 1px solid ${colors.textareaBorder}; border-radius: 10px;
                            resize: vertical; font-size: 0.9rem; font-family: inherit; min-height: 140px;
                            transition: border-color 0.2s, box-shadow 0.2s; background: ${colors.textareaBg}; color: ${colors.titleColor};
                        " placeholder="Tell us what's on your mind..."
                        onfocus="this.style.borderColor='#B87333'; this.style.boxShadow='0 0 0 3px rgba(184,115,51,0.1)';"
                        onblur="this.style.borderColor='${colors.textareaBorder}'; this.style.boxShadow='none';"></textarea>
                    </div>

                </div>

                <!-- Footer -->
                <div style="padding: 16px 24px; background: ${colors.footerBg}; border-top: 1px solid ${colors.footerBorder}; display: flex; gap: 10px;">
                    <button onclick="skipFeedback()" style="
                        flex: 1; padding: 11px 16px; background: ${colors.skipBtnBg}; color: ${colors.skipBtnColor};
                        border: 1px solid ${colors.skipBtnBorder}; border-radius: 8px; cursor: pointer;
                        font-size: 0.9rem; font-weight: 500; transition: all 0.2s;
                    " onmouseover="this.style.background='${colors.skipBtnHoverBg}'" onmouseout="this.style.background='${colors.skipBtnBg}'">
                        Skip
                    </button>
                    <button onclick="submitFeedback('${clientName}', '${clientCode}')" style="
                        flex: 2; padding: 11px 16px; background: linear-gradient(135deg, #B87333, #A0522D);
                        color: white; border: none; border-radius: 8px; cursor: pointer;
                        font-size: 0.9rem; font-weight: 600; display: flex; align-items: center;
                        justify-content: center; gap: 8px; box-shadow: 0 2px 8px rgba(184, 115, 51, 0.3);
                        transition: all 0.2s;
                    " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
                        <i class="fas fa-paper-plane"></i> Send Feedback
                    </button>
                </div>
            </div>
        </div>
    `;

    // Remove success modal first
    const successModal = document.getElementById('successModal');
    if (successModal) successModal.remove();

    document.body.insertAdjacentHTML('beforeend', feedbackHTML);
}

window.showFeedbackModal = showFeedbackModal;

// Selected feedback type
let selectedFeedbackType = null;

function selectFeedbackType(btn) {
    // Remove selected from all
    document.querySelectorAll('#feedbackModal .feedback-type-btn').forEach(b => b.classList.remove('selected'));
    // Add selected to clicked
    btn.classList.add('selected');
    selectedFeedbackType = btn.dataset.type;
}
window.selectFeedbackType = selectFeedbackType;

function skipFeedback() {
    const modal = document.getElementById('feedbackModal');
    if (modal) modal.remove();
    location.href = '/';
}
window.skipFeedback = skipFeedback;

async function submitFeedback(clientName, clientCode) {
    const message = document.getElementById('feedbackMessage')?.value?.trim() || '';
    const type = selectedFeedbackType;

    // Validate - must have type selected OR message written
    if (!type && !message) {
        // Show inline error message
        let errorDiv = document.getElementById('feedbackError');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'feedbackError';
            errorDiv.style.cssText = 'background: #fee2e2; color: #dc2626; padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;';
            errorDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Select a type or write something, or click Skip';
            const bodyDiv = document.querySelector('#feedbackModal > div > div:nth-child(2)');
            if (bodyDiv) bodyDiv.insertBefore(errorDiv, bodyDiv.firstChild);
        }
        // Shake animation
        errorDiv.style.animation = 'none';
        setTimeout(() => errorDiv.style.animation = 'shake 0.4s ease', 10);
        return;
    }

    try {
        await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientName,
                clientCode,
                type: type || 'general',
                message,
                page: 'selection-complete'
            })
        });
    } catch (e) {
        console.log('Feedback not saved, continuing anyway');
    }

    // Redirect home
    location.href = '/';
}
window.submitFeedback = submitFeedback;

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
    const subtitle = document.getElementById('orderSummarySubtitle');

    // Update subtitle with item count
    const allItems = CartSystem.state.items || [];
    const validItems = allItems.filter(item => !item.ghostStatus || item.ghostStatus !== 'ghost');
    if (subtitle) {
        subtitle.textContent = `${validItems.length} item${validItems.length !== 1 ? 's' : ''} in your selection`;
    }

    // Generate content asynchronously
    generateOrderSummary().then(summaryHTML => {
        body.innerHTML = summaryHTML;

        // Enable collapse functionality after render
        setTimeout(() => {
            document.querySelectorAll('.summary-category-header').forEach(header => {
                header.addEventListener('click', function () {
                    toggleSummaryCategory(this);
                });
            });
        }, 100);
    });

    // Show modal
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

    // Agrupar por categoria (usando nome de EXIBIÇÃO para agrupar)
    const categories = {};
    const categoryMixMatch = {}; // Track Mix & Match pool per category
    const categoryPoolInfo = {}; // Track pool details per category

    // ===== TRACK MIX & MATCH POOLS =====
    const poolStats = {}; // { poolId: { items: [], totalQty: 0, subtotal: 0, total: 0, discount: 0 } }

    items.forEach(item => {
        // ✅ MESMA ESTRATÉGIA ROBUSTA de renderCartItems
        let rawCat;

        if (item.isCatalogProduct && item.catalogCategory) {
            rawCat = item.catalogCategory;
        } else if (item.fullPath) {
            rawCat = item.fullPath;
        } else if (item.pathLevels && item.pathLevels.length > 0) {
            rawCat = item.pathLevels[0];
        } else {
            rawCat = item.category || 'Uncategorized';
        }

        // ✅ USAR NOME DE EXIBIÇÃO para agrupar
        const displayCat = getCategoryDisplayName(rawCat, item);
        if (!categories[displayCat]) {
            categories[displayCat] = [];
        }
        categories[displayCat].push(item);

        // ✅ CHECK WHICH MIX & MATCH POOL THIS ITEM BELONGS TO
        const pool = getItemMixMatchPool(item);
        if (pool) {
            categoryMixMatch[displayCat] = pool;
            categoryPoolInfo[displayCat] = pool;

            // Track pool statistics
            if (!poolStats[pool.id]) {
                poolStats[pool.id] = {
                    pool: pool,
                    items: [],
                    totalQty: 0,
                    subtotal: 0,
                    total: 0,
                    discount: 0
                };
            }
            const qty = item.quantity || 1;
            poolStats[pool.id].items.push(item);
            poolStats[pool.id].totalQty += qty;

            // Calculate discount (basePrice - price)
            if (item.basePrice && item.price && item.basePrice > item.price) {
                poolStats[pool.id].subtotal += item.basePrice * qty;
                poolStats[pool.id].total += item.price;
                poolStats[pool.id].discount += (item.basePrice * qty) - item.price;
            } else if (item.originalPrice && item.price && item.originalPrice > item.price) {
                poolStats[pool.id].subtotal += item.originalPrice;
                poolStats[pool.id].total += item.price;
                poolStats[pool.id].discount += item.originalPrice - item.price;
            } else {
                poolStats[pool.id].total += item.price || 0;
                poolStats[pool.id].subtotal += item.price || 0;
            }
        }
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
    let grandSubtotal = 0;
    let totalItems = 0;
    let totalMixMatchDiscount = 0;

    // ✅ ORDENAR: Mix & Match primeiro, depois outros alfabeticamente
    const sortedCategories = Object.keys(categories).sort((a, b) => {
        const aPool = categoryMixMatch[a];
        const bPool = categoryMixMatch[b];
        const aIsMixMatch = aPool ? 1 : 0;
        const bIsMixMatch = bPool ? 1 : 0;
        // Mix & Match vem primeiro (ordem decrescente)
        if (bIsMixMatch !== aIsMixMatch) {
            return bIsMixMatch - aIsMixMatch;
        }
        // Dentro do mesmo grupo, ordenar alfabeticamente
        return a.localeCompare(b);
    });

    sortedCategories.forEach((category, index) => {
        const allCategoryItems = categories[category];
        const pool = categoryMixMatch[category]; // Now returns pool object or undefined

        // ✅ FILTRAR GHOST ITEMS DA CATEGORIA
        const categoryItems = allCategoryItems.filter(item =>
            !item.ghostStatus || item.ghostStatus !== 'ghost'
        );

        // Se todos eram ghosts, pular essa categoria
        if (categoryItems.length === 0) return;

        let categorySubtotal = 0;
        let categoryDiscount = 0;

        // Calcular total da categoria usando preços locais
        categoryItems.forEach(item => {
            if (item.price > 0) {
                categorySubtotal += item.price;
                // Track original price for discount calculation
                const qty = item.quantity || 1;
                if (item.basePrice && item.basePrice > 0 && item.unitPrice && item.basePrice > item.unitPrice) {
                    // Goatskin-style tier discount
                    categoryDiscount += (item.basePrice - item.unitPrice) * qty;
                } else if (item.originalPrice && item.originalPrice > item.price) {
                    categoryDiscount += (item.originalPrice - item.price);
                }
            }
        });

        // Track Mix & Match discount total
        if (pool) {
            totalMixMatchDiscount += categoryDiscount;
        }

        // ===== COUNT TOTAL UNITS (accounting for quantity on catalog products) =====
        const categoryUnitCount = categoryItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

        grandSubtotal += categorySubtotal;
        grandTotal += categorySubtotal;
        totalItems += categoryUnitCount; // Use unit count instead of item count

        // ===== BUILD MIX & MATCH BADGE WITH POOL INFO =====
        let mixMatchBadge = '';
        if (pool) {
            // Get tier info for this pool - use total units for the pool
            const poolStat = poolStats[pool.id];
            const tierInfo = pool.tiers ? getPoolTierInfo(pool, poolStat?.totalQty || categoryUnitCount) : null;

            let badgeContent = `<i class="fas ${pool.icon}"></i> ${pool.name}`;
            let badgeStyle = `border-color: ${pool.color}; color: ${pool.color};`;

            // Add tier info if available
            if (tierInfo) {
                badgeContent += ` <span style="background: ${tierInfo.color}; color: white; padding: 1px 6px; border-radius: 3px; font-size: 10px; margin-left: 4px;">${tierInfo.name}</span>`;
            }

            mixMatchBadge = `<button class="summary-mm-badge" style="${badgeStyle}" onclick="event.stopPropagation(); if(window.openMixMatchInfoModal) window.openMixMatchInfoModal();">${badgeContent}</button>`;
        }

        const discountInfo = showPrices && categoryDiscount > 0 ?
            `<span class="summary-category-discount">-${window.CurrencyManager ? CurrencyManager.format(categoryDiscount) : '$' + categoryDiscount.toFixed(2)}</span>` : '';

        // Primeira categoria aberta por padrão, outras fechadas
        const isExpanded = index === 0;
        const chevronIcon = isExpanded ? 'fa-chevron-down' : 'fa-chevron-right';

        html += `
            <div class="summary-category ${pool ? 'is-mix-match' : ''}">
                <div class="summary-category-header">
                    <i class="fas ${chevronIcon} category-toggle-icon"></i>
                    <strong>${category}</strong>
                    ${mixMatchBadge}
                    <span class="summary-category-meta">
                        ${categoryUnitCount} ${categoryUnitCount === 1 ? 'unit' : 'units'}
                        ${showPrices && categorySubtotal > 0 ? `| ${window.CurrencyManager ? CurrencyManager.format(categorySubtotal) : '$' + categorySubtotal.toFixed(2)}` : ''}
                    </span>
                </div>
                <div class="summary-category-items" style="display: ${isExpanded ? 'block' : 'none'};">
        `;

        // Items da categoria (só válidos)
        categoryItems.forEach(item => {
            let price = 'No price';
            if (item.price > 0) {
                price = window.CurrencyManager ? CurrencyManager.format(item.price) : `$${item.price.toFixed(2)}`;
            }

            // Para fotos únicas, mostrar subcategoria + número do arquivo
            let displayName = item.fileName;
            if (!item.isCatalogProduct) {
                // Tentar extrair o último nível do caminho (subcategoria mais específica)
                // Verificar em ordem: fullPath, category, pathLevels
                let subcategory = '';

                // Opção 1: fullPath string com " → "
                if (item.fullPath && typeof item.fullPath === 'string' && item.fullPath.includes(' → ')) {
                    const parts = item.fullPath.split(' → ');
                    subcategory = parts[parts.length - 1].trim();
                }
                // Opção 2: category string com " → " (usado pela sidebar do carrinho)
                else if (item.category && typeof item.category === 'string' && item.category.includes(' → ')) {
                    const parts = item.category.split(' → ');
                    subcategory = parts[parts.length - 1].trim();
                }
                // Opção 3: pathLevels array com mais de 1 elemento
                else if (item.pathLevels && Array.isArray(item.pathLevels) && item.pathLevels.length > 1) {
                    subcategory = item.pathLevels[item.pathLevels.length - 1];
                }
                // Opção 4: category com "/" como separador
                else if (item.category && typeof item.category === 'string' && item.category.includes('/')) {
                    const parts = item.category.split('/');
                    subcategory = parts[parts.length - 1].trim().replace(/\/$/, '');
                }

                if (subcategory) {
                    // Limpar prefixos numéricos como "1. " ou "02. "
                    subcategory = subcategory.replace(/^\d+\.\s*/, '');
                    // Extrair número do arquivo (sem extensão)
                    const fileNumber = item.fileName.replace(/\.[^.]+$/, '');
                    displayName = `${subcategory} - ${fileNumber}`;
                }
            }

            html += `
                <div class="summary-item">
                    <span>${displayName}</span>
                    ${showPrices ? `<span>${price}</span>` : ''}
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    html += '</div>';

    // USAR CÁLCULO DO SISTEMA
    const cartTotal = await CartSystem.calculateCartTotal();

    // Totais com breakdown de desconto
    html += '<div class="summary-totals">';

    if (!showPrices) {
        // Não mostrar preços - apenas quantidade
        html += `
            <div class="summary-total-line">
                <span><strong>Total Items:</strong></span>
                <span><strong>${totalItems}</strong></span>
            </div>
        `;
    } else {
        // Subtotal
        html += `
            <div class="summary-total-line">
                <span>Subtotal:</span>
                <span>${cartTotal.formattedSubtotal}</span>
            </div>
        `;

        // Desconto Mix & Match (se houver) - Now shows breakdown by pool
        if (cartTotal.hasDiscount && cartTotal.discountAmount > 0) {
            html += `
                <div class="summary-total-line summary-discount">
                    <span><i class="fas fa-layer-group"></i> Mix & Match Discount:</span>
                    <span>-${cartTotal.formattedDiscountAmount}</span>
                </div>
            `;

            // ===== SHOW BREAKDOWN BY POOL =====
            const activePools = Object.values(poolStats).filter(ps => ps.discount > 0 || ps.totalQty > 0);
            if (activePools.length > 0) {
                let poolInfoHtml = '<div class="summary-mm-info">';
                poolInfoHtml += '<i class="fas fa-info-circle"></i> ';

                const poolDescriptions = activePools.map(ps => {
                    const tierInfo = ps.pool.tiers ? getPoolTierInfo(ps.pool, ps.totalQty) : null;
                    let desc = `<strong>${ps.pool.name}</strong>: ${ps.totalQty} items`;
                    if (tierInfo) {
                        desc += ` <span style="color: ${tierInfo.color}; font-weight: bold;">(${tierInfo.name})</span>`;
                    }
                    if (ps.discount > 0) {
                        const discountFormatted = window.CurrencyManager ? CurrencyManager.format(ps.discount) : '$' + ps.discount.toFixed(2);
                        desc += ` saving ${discountFormatted}`;
                    }
                    return desc;
                });

                poolInfoHtml += poolDescriptions.join(' | ');
                poolInfoHtml += '</div>';
                html += poolInfoHtml;
            }
        }

        // Total final
        html += `
            <div class="summary-total-line final">
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

// Tornar funções globais
window.openOrderSummary = openOrderSummary;
window.closeOrderSummary = closeOrderSummary;
window.toggleSummaryCategory = toggleSummaryCategory;

// ===== REAGIR A MUDANÇAS DE MOEDA =====
window.addEventListener('currencyChanged', (e) => {
    console.log('💱 [Cart] Moeda alterada para:', e.detail.newCurrency);

    // Re-renderizar o carrinho com novos preços
    if (window.CartSystem && CartSystem.state.items.length > 0) {
        setTimeout(() => {
            CartSystem.updateUI();
            console.log('💱 [Cart] Carrinho atualizado com nova moeda');
        }, 100);
    }
});

console.log('💱 [Cart] Currency change listener registrado');

console.log('📦 cart.js carregado - aguardando inicialização...');