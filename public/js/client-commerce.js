// public/js/client-commerce.js
/**
 * CLIENT-COMMERCE.JS - SUNSHINE COWHIDES
 * Módulo comercial: Preços, filtros e integração com carrinho
 * Parte 3/3 da modularização do client.js
 */

// ===== INTERCEPTAR CLIQUES NOS FILTROS IMEDIATAMENTE =====
document.addEventListener('click', function (e) {
    // Se clicou em qualquer input dentro do filterSidebar
    if (e.target && (e.target.type === 'checkbox' || e.target.type === 'radio')) {
        const sidebar = document.getElementById('filterSidebar');
        if (sidebar && sidebar.contains(e.target)) {
            console.log('🚨 Filtro clicado - escondendo categorias IMEDIATAMENTE');

            // ESCONDER TUDO INSTANTANEAMENTE
            const categoriesContainer = document.getElementById('categoriesContainer');
            if (categoriesContainer) {
                categoriesContainer.style.visibility = 'hidden';
                categoriesContainer.style.opacity = '0';
            }

            // Mostrar loading
            const loadingEl = document.getElementById('navigationLoading');
            if (loadingEl) {
                loadingEl.style.display = 'flex';
            }
        }
    }
}, true); // TRUE = captura ANTES de qualquer outro evento

// ===== SETUP FILTERS (NEW UNIVERSAL SYSTEM) =====
window.setupDynamicFilters = async function () {
    console.log('🔍 Setting up universal filters...');
    // Show ALL main categories in filter - no hiding
    // The filter will just return empty results if no products match
    document.querySelectorAll('input[name="categoryFilter"]').forEach(radio => {
        const label = radio.parentElement;
        label.style.display = '';
    });
    console.log('✅ All category filters visible');
}

// ===== VERIFICAR DEPENDÊNCIAS =====
if (!window.navigationState) {
    console.error('❌ client-commerce.js requer client-core.js');
}

// ===== ADICIONAR AO CARRINHO =====
window.addToCartFromThumbnail = async function (photoId, photoIndex) {
    const button = event.target.closest('.thumbnail-cart-btn');
    if (!button) return;

    // Feedback visual imediato
    button.disabled = true;
    const originalHTML = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Loading...</span>';

    try {
        const isInCart = window.CartSystem && CartSystem.isInCart(photoId);

        if (isInCart) {
            // Remover do carrinho
            await CartSystem.removeItem(photoId);
            button.classList.remove('in-cart');
            button.innerHTML = '<i class="fas fa-shopping-cart"></i><span>Add</span>';
        } else {
            // Buscar dados da foto
            const photos = navigationState.currentPhotos;
            const photo = photos[photoIndex];

            if (!photo) {
                throw new Error('Photo not found');
            }

            console.log('🔍 [THUMBNAIL] Adicionando ao carrinho...');
            console.log('📸 Photo:', photo);
            console.log('📁 currentFolderId:', navigationState.currentFolderId);

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
            } else if (navigationState.currentFolderId && window.loadCategoryPrice) {
                console.log('🔍 [THUMBNAIL] Buscando preço com loadCategoryPrice...');
                try {
                    priceInfo = await window.loadCategoryPrice(navigationState.currentFolderId);
                    console.log('✅ [THUMBNAIL] Preço carregado:', priceInfo);
                } catch (error) {
                    console.warn('❌ [THUMBNAIL] Erro ao buscar preço:', error);
                }
            } else {
                console.log('⚠️ [THUMBNAIL] Não foi possível buscar preço');
                console.log('   - customPrice?', !!photo.customPrice);
                console.log('   - currentFolderId?', !!navigationState.currentFolderId);
                console.log('   - loadCategoryPrice?', !!window.loadCategoryPrice);
            }

            // Dados do item
            const itemData = {
                fileName: photo.name || 'Unnamed product',
                category: window.navigationState?.currentCategoryName ||
                    (window.navigationState?.currentPath?.length > 1
                        ? window.navigationState.currentPath[window.navigationState.currentPath.length - 1].name
                        : window.navigationState?.currentPath?.[0]?.name) || 'Category',
                thumbnailUrl: ImageUtils.getThumbnailUrl(photo),
                pathLevels: window.navigationState?.currentPath?.map(p => p.name) || [],
                fullPath: window.navigationState?.currentPath?.map(p => p.name).join(' → ') || '',
                basePrice: priceInfo.basePrice || 0,
                price: priceInfo.price || 0,
                formattedPrice: priceInfo.formattedPrice || 'No price',
                hasPrice: priceInfo.hasPrice || false
            };

            console.log('📦 [THUMBNAIL] Dados do item montados:', itemData);

            await CartSystem.addItem(photoId, itemData);
            button.classList.add('in-cart');
            button.innerHTML = '<span>Remove</span>';
        }

        // Atualizar badge de preço
        if (window.updateCategoryPriceBadge) {
            setTimeout(() => window.updateCategoryPriceBadge(), 100);
        }

    } catch (error) {
        console.error('❌ [THUMBNAIL] Erro ao gerenciar carrinho:', error);
        button.innerHTML = originalHTML;

        if (window.showNotification) {
            window.showNotification(error.message || 'Error managing cart', 'error');
        }
    } finally {
        button.disabled = false;
    }
}

// ===== SINCRONIZAÇÃO DE UI DO CARRINHO =====
window.syncCartUIFromAdd = function (photoId) {
    const button = document.querySelector(`[data-photo-id="${photoId}"] .thumbnail-cart-btn`);
    if (button) {
        button.classList.add('in-cart');
        button.innerHTML = '<span>Remove</span>';
    }
}

window.syncCartUIFromRemove = function (photoId) {
    const button = document.querySelector(`[data-photo-id="${photoId}"] .thumbnail-cart-btn`);
    if (button) {
        button.classList.remove('in-cart');
        button.innerHTML = '<i class="fas fa-shopping-cart"></i><span>Add</span>';
    }
}

// ===== MOBILE: Toggle Mix & Match =====
window.toggleMobileMixMatch = function() {
    const container = document.getElementById('mobileMixMatch');
    const content = document.getElementById('mobileMmContent');
    const toggle = document.getElementById('mobileMmToggle');

    if (container && content && toggle) {
        container.classList.toggle('collapsed');
        if (container.classList.contains('collapsed')) {
            content.style.display = 'none';
            toggle.classList.remove('fa-chevron-up');
            toggle.classList.add('fa-chevron-down');
        } else {
            content.style.display = 'block';
            toggle.classList.remove('fa-chevron-down');
            toggle.classList.add('fa-chevron-up');
        }
    }
}

// ===== CATEGORIAS MIX & MATCH (GLOBAL TIERS) =====
// APENAS Natural Cowhides participa do Mix & Match
const MIX_MATCH_CATEGORY_KEY = 'natural-cowhides';

// Subcategorias conhecidas de Natural Cowhides (para detectar fotos do carrinho)
// As 3 categorias principais de Natural Cowhides:
// 1. Brazil Best Sellers
// 2. Brazil Top Selected Categories
// 3. Colombian Cowhides
const NATURAL_COWHIDES_SUBCATEGORIES = [
    // Top-level categories (3 main)
    'Brazil Best Sellers',
    'Brazil Top Selected Categories',
    'Brazil Top Selected',
    'Colombian Cowhides',
    // Common subcategories
    'Brazil First Selection',
    'Best Value',
    'Premium Selection',
    'XL Collection',
    'Brindle',
    'Tricolor',
    'Speckled',
    'Solid',
    'Black and White',
    'Brown and White',
    'Exotic',
    // Size subcategories
    'Medium',
    'Large',
    'XL',
    'XXL'
];

/**
 * Verifica se um texto contém indicadores de Natural Cowhides
 */
function isNaturalCowhidesPath(text) {
    if (!text) return false;
    const upperText = text.toUpperCase();

    // Verificação direta
    if (upperText.includes('NATURAL COWHIDES') || upperText.includes('NATURAL-COWHIDES')) {
        return true;
    }

    // Verificar subcategorias conhecidas
    for (const subcat of NATURAL_COWHIDES_SUBCATEGORIES) {
        if (upperText.includes(subcat.toUpperCase())) {
            return true;
        }
    }

    return false;
}

/**
 * Verifica se a categoria atual participa do Mix & Match global
 * APENAS retorna true para Natural Cowhides e suas subcategorias
 * Também verifica fotos do carrinho que pertencem a Natural Cowhides
 */
function isCurrentCategoryMixMatch() {
    // Verificar CatalogState (disponível quando navegando no catálogo)
    if (window.CatalogState) {
        const catKey = window.CatalogState.currentCategory;
        const directGallery = window.CatalogState.directGalleryCategory;

        // Verificar se está em Natural Cowhides (categoria ou galeria direta)
        if (catKey === MIX_MATCH_CATEGORY_KEY || directGallery === MIX_MATCH_CATEGORY_KEY) {
            return true;
        }
    }

    // Verificar NavigationState (para quando está vendo fotos)
    if (window.navigationState && window.navigationState.currentPath && window.navigationState.currentPath.length > 0) {
        const mainCategory = window.navigationState.currentPath[0].name;
        if (mainCategory === 'Natural Cowhides') {
            return true;
        }
    }

    // Verificar se está visualizando foto do carrinho que pertence a Natural Cowhides
    if (window.navigationState && (window.navigationState.isViewingCart || window.modalOpenedFromCart)) {
        const photos = window.navigationState.currentPhotos;
        const currentIndex = window.navigationState.currentPhotoIndex;
        if (photos && photos[currentIndex]) {
            const photo = photos[currentIndex];
            // Usar fullPath se disponível (contém caminho completo como "Natural Cowhides → Brazil Best Sellers → ...")
            const fullPath = photo.fullPath || '';
            const category = photo.category || '';
            const pathLevels = photo.pathLevels || [];

            // Verificar se o caminho completo inclui Natural Cowhides
            if (isNaturalCowhidesPath(fullPath) ||
                isNaturalCowhidesPath(category) ||
                pathLevels.some(level => isNaturalCowhidesPath(level))) {
                return true;
            }
        }
    }

    return false;
}

// Expor helper globalmente
window.isNaturalCowhidesPath = isNaturalCowhidesPath;

// Expor globalmente para uso em outros módulos
window.isCurrentCategoryMixMatch = isCurrentCategoryMixMatch;

// ===== PRICE PROGRESS BAR =====
window.PriceProgressBar = {
    currentCategoryId: null,
    rateRules: [],
    basePrice: 0,

    init(categoryId) {
        this.currentCategoryId = categoryId;
        // ✅ Resetar status Mix & Match antes de carregar nova categoria
        window.currentCategoryMixMatchStatus = null;
        this.loadRateRules().then(() => {
            this.render();
            this.updateProgress();
        });
    },

    async loadRateRules() {
        try {
            const savedSession = localStorage.getItem('sunshineSession');
            let clientCode = null;
            if (savedSession) {
                const session = JSON.parse(savedSession);
                clientCode = session.accessCode;
            }

            const response = await fetch(`/api/pricing/category-ranges?categoryId=${encodeURIComponent(this.currentCategoryId)}&clientCode=${encodeURIComponent(clientCode || '')}`);
            const data = await response.json();

            if (data.success && data.data) {
                // ✅ NOVO: Armazenar status Mix & Match da API
                window.currentCategoryMixMatchStatus = data.data.participatesInMixMatch === true;
                console.log('📦 Mix & Match status da API:', window.currentCategoryMixMatchStatus);

                if (data.data.ranges) {
                    this.rateRules = data.data.ranges.map(range => ({
                        from: range.min,
                        to: range.max || 999,
                        price: range.price
                    }));
                    this.basePrice = data.data.ranges[0]?.price || 0;
                }
            }
        } catch (error) {
            console.error('Erro ao carregar rate rules:', error);
            // Reset status em caso de erro
            window.currentCategoryMixMatchStatus = null;
        }
    },

    render() {
        // IMPORTANTE: Só renderizar Mix & Match para Natural Cowhides
        const isMixMatch = window.isCurrentCategoryMixMatch && window.isCurrentCategoryMixMatch();
        if (!isMixMatch) {
            // Esconder container se existir
            const existingContainer = document.getElementById('priceProgressContainer');
            if (existingContainer) {
                existingContainer.style.display = 'none';
            }
            // Esconder badge Mix & Match no breadcrumb
            const breadcrumbMmBadge = document.getElementById('breadcrumbMixMatchBadge');
            if (breadcrumbMmBadge) {
                breadcrumbMmBadge.style.display = 'none';
            }
            return;
        }

        const sidebar = document.getElementById('filterSidebar');
        if (!sidebar) return;

        let priceBarContainer = document.getElementById('priceProgressContainer');
        if (!priceBarContainer) {
            priceBarContainer = document.createElement('div');
            priceBarContainer.id = 'priceProgressContainer';
            // Inserir após o gallery-header, não no sidebar
            const galleryHeader = document.querySelector('.gallery-header');
            if (galleryHeader && galleryHeader.parentElement) {
                galleryHeader.parentElement.insertBefore(priceBarContainer, galleryHeader.nextSibling);
            } else {
                sidebar.insertBefore(priceBarContainer, sidebar.firstChild); // fallback
            }
        }

        if (!shouldShowPrices()) {
            priceBarContainer.style.display = 'none';
            // Esconder badge Mix & Match no breadcrumb
            const breadcrumbMmBadge = document.getElementById('breadcrumbMixMatchBadge');
            if (breadcrumbMmBadge) {
                breadcrumbMmBadge.style.display = 'none';
            }
            return;
        }

        // Se não tem rate rules, esconder tiers e mostrar badge de preço único
        if (this.rateRules.length === 0) {
            priceBarContainer.style.display = 'none';
            // Mostrar badge de preço para categorias com preço único (não Mix & Match)
            const breadcrumbBadge = document.getElementById('breadcrumbPriceBadge');
            if (breadcrumbBadge && window.innerWidth > 768) {
                breadcrumbBadge.style.display = '';
            }
            // Esconder badge Mix & Match no breadcrumb (não é Mix & Match)
            const breadcrumbMmBadge = document.getElementById('breadcrumbMixMatchBadge');
            if (breadcrumbMmBadge) {
                breadcrumbMmBadge.style.display = 'none';
            }
            return;
        }

        // Mix & Match ativo - mostrar badge no breadcrumb
        // IMPORTANTE: Só mostrar para Natural Cowhides, independente de rate rules carregadas
        const breadcrumbMmBadge = document.getElementById('breadcrumbMixMatchBadge');
        const isMixMatchCategory = window.isCurrentCategoryMixMatch && window.isCurrentCategoryMixMatch();

        // Mostrar badge Mix & Match no breadcrumb quando categoria é Mix & Match
        if (breadcrumbMmBadge && isMixMatchCategory) {
            breadcrumbMmBadge.style.display = '';
        } else if (breadcrumbMmBadge) {
            breadcrumbMmBadge.style.display = 'none';
        }

        // Nomes e classes de cores para cada tier
        const tierNames = ['Bronze', 'Silver', 'Gold', 'Diamond'];
        const tierClasses = ['tier-bronze', 'tier-silver', 'tier-gold', 'tier-diamond'];

        // Build tier items HTML - cada tier tem um label "Your price tier" que aparece só quando ativo
        // + incentivo dinâmico que aparece acima do próximo tier a ser desbloqueado
        let tierItemsHtml = '';
        this.rateRules.forEach((rule, index) => {
            const label = rule.to === 999 ? `${rule.from}+ hides` : `up to ${rule.to} hides`;
            const tierClass = tierClasses[index] || '';
            const tierName = tierNames[index] || `Tier ${index + 1}`;
            const price = window.CurrencyManager ? CurrencyManager.format(rule.price) : '$' + rule.price;

            tierItemsHtml += `
                <div class="mm-tier-wrapper" data-tier-index="${index}">
                    <div class="mm-tier-incentive" id="mmTierIncentive${index}" style="display: none;">
                        <i class="fas fa-lightbulb"></i> <span class="incentive-text"></span>
                    </div>
                    <div class="mm-tier-item ${tierClass}" data-min="${rule.from}" data-max="${rule.to}" data-tier="${index}" data-tier-name="${tierName}">
                        <span class="mm-tier-label-top">Your price tier - ${tierName}</span>
                        <span class="mm-tier-price">${price}</span>
                        <span class="mm-tier-range">${label}</span>
                    </div>
                </div>
            `;
        });

        // Build mobile tier items HTML (layout antigo para mobile)
        let mobileTierItemsHtml = '';
        this.rateRules.forEach((rule, index) => {
            const label = rule.to === 999 ? `${rule.from}+` : `${rule.from}-${rule.to}`;
            const tierClass = tierClasses[index] || '';
            const tierName = tierNames[index] || `Tier ${index + 1}`;
            const price = window.CurrencyManager ? CurrencyManager.format(rule.price) : '$' + rule.price;

            mobileTierItemsHtml += `
                <div class="price-tier ${tierClass}" data-min="${rule.from}" data-max="${rule.to}" data-tier="${index}">
                    <span class="tier-name">${tierName}</span>
                    <span class="tier-label">${label} hides</span>
                    <span class="tier-price">${price}/each</span>
                </div>
            `;
        });

        // HTML com novo layout clean - Desktop (compacto)
        // + Layout mobile antigo (escondido no desktop pelo CSS)
        let html = `
        <!-- DESKTOP: Novo layout compacto -->
        <div class="mix-match-container">
            <!-- Tiers em linha (com incentivo dinâmico acima de cada tier) -->
            <div class="mm-tiers-row">
                ${tierItemsHtml}
            </div>

            <!-- Barra de progresso -->
            <div class="mm-progress-section">
                <div class="mm-tier-counter" id="mmTierCounter">0/5</div>
                <div class="mm-progress-track">
                    <div class="mm-progress-fill" id="progressBarFill" style="width: 0%"></div>
                </div>
                <div class="mm-next-tier" id="mmNextTier">
                    <i class="fas fa-arrow-right"></i>
                    <span id="mmNextTierName">Silver</span>
                </div>
            </div>
        </div>

        <!-- MOBILE: Layout dinâmico e clean (fixo) -->
        <div class="mobile-mix-match" id="mobileMixMatch">
            <div class="mobile-mm-header">
                <div class="mobile-mm-header-left">
                    <button class="badge-mixmatch badge-mixmatch-btn mobile-mm-badge" onclick="openMixMatchInfoModal()">
                        MIX & MATCH <i class="fas fa-info-circle"></i>
                    </button>
                    <span class="mobile-mm-photo-count" id="mobilePhotoCount"></span>
                </div>
                <div class="mobile-mm-header-right">
                    <span class="mobile-mm-tier-badge" id="mobileTierBadge">Bronze</span>
                    <span class="mobile-mm-price" id="mobileTierPrice">${window.CurrencyManager ? CurrencyManager.format(this.rateRules[0]?.price || this.basePrice) : '$' + (this.rateRules[0]?.price || this.basePrice)}/ea</span>
                </div>
            </div>
            <div class="mobile-mm-content">
                <div class="mobile-mm-progress">
                    <div class="mobile-mm-progress-bar">
                        <div class="mobile-mm-progress-fill" id="mobileProgressFill" style="width: 0%"></div>
                    </div>
                    <span class="mobile-mm-incentive" id="mobileIncentive">Add items to save more!</span>
                </div>
            </div>
        </div>
        `;

        priceBarContainer.innerHTML = html;
        priceBarContainer.style.display = 'block';
    },

    updateProgress() {
        if (!window.CartSystem || !window.CartSystem.state) return;

        // ✅ IMPORTANTE: Contar APENAS itens que participam do Mix & Match
        // Mix & Match é exclusivo para fotos únicas de Natural Cowhides
        const relevantItemCount = window.CartSystem.state.items.filter(item => {
            // Excluir produtos de catálogo (stock) - eles NUNCA participam do Mix & Match
            if (item.isCatalogProduct) {
                return false;
            }

            // Verificar se a categoria do item participa do Mix & Match
            const category = item.category || item.fullPath || '';
            const mainCategory = category.includes(' → ')
                ? category.split(' → ')[0].trim()
                : category.includes('/')
                    ? category.split('/')[0].trim()
                    : category;

            // Verificar se é Natural Cowhides (única categoria Mix & Match)
            return mainCategory === 'Natural Cowhides' ||
                   mainCategory.includes('Brazil Best Sellers') ||
                   mainCategory.includes('Brazil Top Selected');
        }).length;

        // Atualizar tiers (novo layout)
        document.querySelectorAll('.mm-tier-item').forEach(tier => {
            tier.classList.remove('active', 'completed');

            const min = parseInt(tier.dataset.min);
            const max = parseInt(tier.dataset.max);

            if (relevantItemCount >= min && relevantItemCount <= max) {
                tier.classList.add('active');
            } else if (relevantItemCount > max) {
                tier.classList.add('completed');
            }
        });

        // Atualizar também os tiers antigos (para compatibilidade)
        document.querySelectorAll('.price-tier').forEach(tier => {
            tier.classList.remove('active', 'completed');

            const min = parseInt(tier.dataset.min);
            const max = parseInt(tier.dataset.max);

            if (relevantItemCount >= min && relevantItemCount <= max) {
                tier.classList.add('active');
            } else if (relevantItemCount > max) {
                tier.classList.add('completed');
            }
        });

        // Atualizar preços quando tier muda (DESKTOP E MOBILE)
        if (this.rateRules.length > 0) {
            // Encontrar o preço do tier atual baseado na quantidade
            let currentTierPrice = this.basePrice;
            for (const rule of this.rateRules) {
                if (relevantItemCount >= rule.from && relevantItemCount <= rule.to) {
                    currentTierPrice = rule.price;
                    break;
                }
            }

            // Formatar o preço com a moeda atual
            const formattedPrice = window.CurrencyManager ?
                CurrencyManager.format(currentTierPrice) :
                `$${currentTierPrice}`;

            // Atualizar info bar mobile
            const infoBadge = document.getElementById('infoPriceBadge');
            if (infoBadge && !infoBadge.classList.contains('no-price')) {
                infoBadge.textContent = `${formattedPrice}/each`;
            }

            // Atualizar badge principal (ao lado do título)
            const mainBadge = document.querySelector('.category-price-badge:not(.contact-price):not(.no-price)');
            if (mainBadge && !mainBadge.closest('#mobileInfoBar')) {
                mainBadge.innerHTML = `${formattedPrice} <span class="badge-chat-icon" style="margin-left: 5px; cursor: pointer;">💬</span>`;
            }

            // Atualizar breadcrumb price badge (desktop)
            const breadcrumbBadge = document.getElementById('breadcrumbPriceBadge');
            if (breadcrumbBadge && breadcrumbBadge.innerHTML !== '' && !breadcrumbBadge.classList.contains('no-price') && !breadcrumbBadge.classList.contains('contact-price')) {
                breadcrumbBadge.innerHTML = `<i class="fas fa-comment-dollar"></i> ${formattedPrice}`;
            }
        }

        // ============================================
        // ATUALIZAR BADGE MIX & MATCH GAMIFICADO
        // ============================================
        const tierIncentiveEl = document.getElementById('tierIncentive');
        if (tierIncentiveEl && this.rateRules.length > 0) {
            let incentiveHTML = '';

            // Encontrar tier ativo e próximo tier
            let currentTier = null;
            let nextTier = null;
            let tierIndex = -1;

            for (let i = 0; i < this.rateRules.length; i++) {
                const rule = this.rateRules[i];
                if (relevantItemCount >= rule.from && relevantItemCount <= rule.to) {
                    currentTier = rule;
                    tierIndex = i;
                    if (i < this.rateRules.length - 1) {
                        nextTier = this.rateRules[i + 1];
                    }
                    break;
                }
            }

            // Se tem items no carrinho
            if (relevantItemCount > 0 && currentTier) {
                const tierName = currentTier.to === 999 ? `Tier ${tierIndex + 1}` : `Tier ${tierIndex + 1}`;
                const nextTierTarget = nextTier ? nextTier.from : currentTier.to;

                incentiveHTML = `
                    <div style="margin-bottom: 8px;">
                        <strong>🎯 ${relevantItemCount}/${nextTierTarget} items</strong><br>
                        <span style="color: #4CAF50;">🌟 ${tierName} Active</span>
                    </div>
                `;

                // Calcular quantos faltam para próximo tier
                if (nextTier) {
                    const itemsNeeded = nextTier.from - relevantItemCount;
                    incentiveHTML += `
                        <div style="font-size: 11px;">
                            💡 <strong>Add ${itemsNeeded} more</strong><br>
                            to unlock Tier ${tierIndex + 2}!
                        </div>
                    `;
                } else {
                    // Último tier - melhor preço
                    incentiveHTML += `
                        <div style="font-size: 11px; color: #4CAF50;">
                            🎉 <strong>Best price<br>unlocked!</strong>
                        </div>
                    `;
                }
            } else if (relevantItemCount === 0) {
                // Carrinho vazio - incentivo inicial
                incentiveHTML = `
                    <div style="font-size: 11px;">
                        💡 <strong>Add ${this.rateRules[0].from} item${this.rateRules[0].from > 1 ? 's' : ''}</strong><br>
                        to start saving!
                    </div>
                `;
            }

            tierIncentiveEl.innerHTML = incentiveHTML;
        }

        // ============================================
        // ATUALIZAR BARRA DE PROGRESSO VISUAL (NOVO LAYOUT)
        // ============================================
        const progressBarFill = document.getElementById('progressBarFill');
        const mmNextTier = document.getElementById('mmNextTier');
        const mmNextTierName = document.getElementById('mmNextTierName');
        const mmIncentive = document.getElementById('mmIncentive');

        // Legacy elements (para compatibilidade)
        const progressLabel = document.getElementById('progressLabel');
        const progressIncentive = document.getElementById('progressIncentive');

        if (this.rateRules.length > 0) {
            // Encontrar tier atual e próximo tier
            let nextTierTarget = this.rateRules[this.rateRules.length - 1].from;
            let currentTierName = 'Bronze';
            let currentTierIndex = 0;
            let nextTierName = '';
            let currentTierPrice = this.basePrice;
            let currentTierMax = this.rateRules[0]?.to || 5;
            const tierNames = ['Bronze', 'Silver', 'Gold', 'Diamond'];
            const tierClasses = ['tier-bronze', 'tier-silver', 'tier-gold', 'tier-diamond'];

            for (let i = 0; i < this.rateRules.length; i++) {
                const rule = this.rateRules[i];
                if (relevantItemCount >= rule.from && relevantItemCount <= rule.to) {
                    currentTierName = tierNames[i] || `Tier ${i + 1}`;
                    currentTierIndex = i;
                    currentTierPrice = rule.price;
                    currentTierMax = rule.to;
                    if (i < this.rateRules.length - 1) {
                        nextTierTarget = this.rateRules[i + 1].from;
                        nextTierName = tierNames[i + 1] || `Tier ${i + 2}`;
                    }
                    break;
                }
            }

            // Calcular porcentagem para a barra
            let percentage = 0;
            if (relevantItemCount > 0) {
                percentage = Math.min((relevantItemCount / nextTierTarget) * 100, 100);
            }

            // Formatar preço
            const formattedPrice = window.CurrencyManager ?
                CurrencyManager.format(currentTierPrice) :
                `$${currentTierPrice}`;

            // ========== NOVO LAYOUT ==========
            // Atualizar barra de progresso
            if (progressBarFill) {
                progressBarFill.style.width = `${percentage}%`;
            }

            // Atualizar contador de tier (ex: "1/6", "6/13")
            // Mostra progresso para o PRÓXIMO tier
            const mmTierCounter = document.getElementById('mmTierCounter');
            if (mmTierCounter) {
                if (relevantItemCount === 0) {
                    mmTierCounter.style.display = 'none';
                } else if (percentage >= 100) {
                    // No último tier (Diamond) - mostrar apenas o total
                    mmTierCounter.style.display = 'flex';
                    mmTierCounter.textContent = `${relevantItemCount}`;
                } else {
                    // Mostrar X/Y onde Y é o início do próximo tier
                    mmTierCounter.style.display = 'flex';
                    mmTierCounter.textContent = `${relevantItemCount}/${nextTierTarget}`;
                }
            }

            // Atualizar próximo tier indicator
            if (mmNextTier && mmNextTierName) {
                const icon = mmNextTier.querySelector('i');
                if (relevantItemCount === 0) {
                    // Carrinho vazio - esconder indicador
                    mmNextTier.style.display = 'none';
                } else if (nextTierName && percentage < 100) {
                    // Mostrar próximo tier
                    mmNextTier.style.display = 'flex';
                    mmNextTierName.textContent = nextTierName;
                    icon?.classList.remove('fa-trophy');
                    icon?.classList.add('fa-arrow-right');
                } else {
                    // No último tier - mostrar "Best!"
                    mmNextTier.style.display = 'flex';
                    mmNextTierName.textContent = 'Best!';
                    icon?.classList.remove('fa-arrow-right');
                    icon?.classList.add('fa-trophy');
                }
            }

            // Atualizar incentivo no final da barra de progresso (mm-next-tier)
            // Desktop only - mostra "Add X more for Silver" ou "Best price!" no lugar de "→ Silver"
            if (window.innerWidth > 768) {
                const mmNextTier = document.getElementById('mmNextTier');
                const mmNextTierName = document.getElementById('mmNextTierName');
                const mmNextTierIcon = mmNextTier?.querySelector('i');

                if (mmNextTier && mmNextTierName) {
                    if (relevantItemCount > 0 && percentage < 100 && nextTierName) {
                        const itemsNeeded = nextTierTarget - relevantItemCount;
                        mmNextTierName.innerHTML = `Add ${itemsNeeded} more for <strong>${nextTierName}</strong>`;
                        if (mmNextTierIcon) {
                            mmNextTierIcon.className = 'fas fa-lightbulb';
                            mmNextTierIcon.style.color = '#f5c451';
                        }
                        mmNextTier.classList.add('has-incentive');
                    } else if (percentage >= 100) {
                        mmNextTierName.innerHTML = `<strong>🎉 Best price!</strong>`;
                        if (mmNextTierIcon) {
                            mmNextTierIcon.style.display = 'none';
                        }
                        mmNextTier.classList.add('has-incentive', 'completed');
                    } else {
                        // Sem itens ou estado inicial - mostrar próximo tier
                        mmNextTierName.textContent = nextTierName || 'Silver';
                        if (mmNextTierIcon) {
                            mmNextTierIcon.className = 'fas fa-arrow-right';
                            mmNextTierIcon.style.color = '#9ca3af';
                            mmNextTierIcon.style.display = '';
                        }
                        mmNextTier.classList.remove('has-incentive', 'completed');
                    }
                }
            }

            // Esconder badge verde do breadcrumb (tiers já mostram preços)
            const breadcrumbBadge = document.getElementById('breadcrumbPriceBadge');
            if (breadcrumbBadge && window.innerWidth > 768) {
                breadcrumbBadge.style.display = 'none';
            }

            // ========== MOBILE: Atualizar layout dinâmico ==========
            const mobileTierBadge = document.getElementById('mobileTierBadge');
            const mobileTierPrice = document.getElementById('mobileTierPrice');
            const mobileProgressFill = document.getElementById('mobileProgressFill');
            const mobileIncentive = document.getElementById('mobileIncentive');

            if (mobileTierBadge) {
                mobileTierBadge.textContent = currentTierName;
                mobileTierBadge.className = 'mobile-mm-tier-badge tier-' + currentTierName.toLowerCase();
            }

            if (mobileTierPrice) {
                mobileTierPrice.textContent = formattedPrice + '/each';
            }

            if (mobileProgressFill) {
                mobileProgressFill.style.width = `${percentage}%`;
            }

            if (mobileIncentive) {
                if (relevantItemCount === 0) {
                    mobileIncentive.innerHTML = 'Add items to unlock savings!';
                } else if (percentage >= 100) {
                    mobileIncentive.innerHTML = '<strong>🎉 Best price unlocked!</strong>';
                } else if (nextTierName) {
                    const itemsNeeded = nextTierTarget - relevantItemCount;
                    mobileIncentive.innerHTML = `Add <strong>${itemsNeeded} more</strong> for <strong>${nextTierName}</strong> tier`;
                }
            }

            // Atualizar contagem de fotos no mobile (total da subcategoria atual)
            const mobilePhotoCount = document.getElementById('mobilePhotoCount');
            if (mobilePhotoCount) {
                const totalPhotos = window.navigationState?.currentPhotos?.length || 0;
                if (totalPhotos > 0) {
                    const unitText = totalPhotos === 1 ? 'unit' : 'units';
                    mobilePhotoCount.textContent = `${totalPhotos} ${unitText}`;
                }
            }

            // Esconder mobileInfoBar inteiro no mobile para Mix & Match
            // (o preço e contagem agora estão no Mix & Match header)
            if (window.innerWidth <= 768) {
                const mobileInfoBar = document.getElementById('mobileInfoBar');
                if (mobileInfoBar) {
                    mobileInfoBar.style.display = 'none';
                }
            }

            // ========== LEGACY LAYOUT (para compatibilidade) ==========
            if (progressLabel) {
                if (relevantItemCount === 0) {
                    progressLabel.textContent = `Your Progress: Start adding photos!`;
                } else if (percentage >= 100) {
                    progressLabel.textContent = `Your Progress: ${relevantItemCount} items • ${currentTierName} tier (Best price!)`;
                } else {
                    progressLabel.textContent = `Your Progress: ${relevantItemCount}/${nextTierTarget} items to ${tierNames[Math.min(this.rateRules.findIndex(r => r.from > relevantItemCount), tierNames.length - 1)]} tier`;
                }
            }

            if (progressIncentive) {
                let incentiveText = '';
                if (relevantItemCount > 0 && percentage < 100 && nextTierName) {
                    const itemsNeeded = nextTierTarget - relevantItemCount;
                    incentiveText = `💡 Add ${itemsNeeded} more for ${nextTierName}!`;
                } else if (percentage >= 100) {
                    incentiveText = `🎉 Best price unlocked!`;
                }
                progressIncentive.textContent = incentiveText;
            }
        } else {
            // Categoria SEM rate rules (preço único) - garantir que badge seja visível (desktop only)
            const breadcrumbBadge = document.getElementById('breadcrumbPriceBadge');
            if (breadcrumbBadge && window.innerWidth > 768) {
                breadcrumbBadge.style.display = '';
            }
        }
        // ============================================
    },

    hide() {
        const container = document.getElementById('priceProgressContainer');
        if (container) {
            container.style.display = 'none';
        }
    }
};

// ===== ATUALIZAR BADGE DE PREÇO =====
window.updateCategoryPriceBadge = async function () {
    if (!window.CartSystem || !window.CartSystem.state) return;

    let relevantItemCount = 0;
    let currentCategoryName = null;

    if (window.navigationState && window.navigationState.currentPath && window.navigationState.currentPath.length > 0) {
        const lastPath = window.navigationState.currentPath[window.navigationState.currentPath.length - 1];
        currentCategoryName = lastPath.name;
    }

    if (currentCategoryName) {
        relevantItemCount = window.CartSystem.state.items.filter(item => {
            let itemCategory = item.category;
            if (itemCategory && itemCategory.includes('/')) {
                const parts = itemCategory.split('/');
                itemCategory = parts[parts.length - 1] || parts[parts.length - 2];
            }
            return itemCategory === currentCategoryName;
        }).length;
    }

    const galleryTitle = document.getElementById('galleryTitle');
    if (!galleryTitle) return;

    const existingBadge = galleryTitle.querySelector('.cart-count-badge');

    if (relevantItemCount > 0) {
        const badgeHTML = ''; // Removido "in cart" - não faz sentido com desconto global

        if (existingBadge) {
            existingBadge.outerHTML = badgeHTML;
        } else {
            galleryTitle.insertAdjacentHTML('beforeend', badgeHTML);
        }
    } else if (existingBadge) {
        existingBadge.remove();
    }

    if (window.PriceProgressBar) {
        window.PriceProgressBar.updateProgress();
    }
}

window.updateModalPriceBadge = function () {
    updateCategoryPriceBadge();
}

// ===== SISTEMA DE FILTROS =====
window.activeFilters = {
    type: [],
    tone: [],
    size: [],
    price: { min: null, max: null }
};

window.setupFilters = function () {
    document.querySelectorAll('#filterSidebar input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', handleFilterChange);
    });

    const priceMin = document.getElementById('priceMin');
    const priceMax = document.getElementById('priceMax');

    if (priceMin) {
        priceMin.addEventListener('input', debounce(handlePriceFilterChange, 500));
    }
    if (priceMax) {
        priceMax.addEventListener('input', debounce(handlePriceFilterChange, 500));
    }

    const toggleButton = document.getElementById('filterToggle');
    const sidebar = document.getElementById('filterSidebar');
    const clearButton = document.querySelector('.clear-filters');

    if (toggleButton && sidebar) {
        toggleButton.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            toggleButton.classList.toggle('active');
        });
    }

    if (clearButton) {
        clearButton.addEventListener('click', clearAllFilters);
    }
}

window.handleFilterChange = function (event) {
    const checkbox = event.target;
    const filterType = checkbox.name;
    const filterValue = checkbox.value;

    if (checkbox.checked) {
        if (!window.activeFilters[filterType]) {
            window.activeFilters[filterType] = [];
        }
        window.activeFilters[filterType].push(filterValue);
    } else {
        const index = window.activeFilters[filterType].indexOf(filterValue);
        if (index > -1) {
            window.activeFilters[filterType].splice(index, 1);
        }
    }

    applyFilters();
}

function handlePriceFilterChange() {
    const minInput = document.getElementById('priceMin');
    const maxInput = document.getElementById('priceMax');

    window.activeFilters.price.min = minInput.value ? parseFloat(minInput.value) : null;
    window.activeFilters.price.max = maxInput.value ? parseFloat(maxInput.value) : null;

    applyFilters();
}

window.applyPhotoFilters = function () {
    const photos = document.querySelectorAll('.photo-thumbnail');
    let visibleCount = 0;

    // MUDAR APENAS ISTO - pegar os valores dos RADIO buttons do HTML
    const selectedType = document.querySelector('input[name="typePattern"]:checked')?.value;

    photos.forEach(photo => {
        let shouldShow = true;
        const photoName = photo.querySelector('.photo-overlay strong')?.textContent || '';

        // Filtrar por tipo selecionado
        if (selectedType && selectedType !== 'all') {
            if (!photoName.toLowerCase().includes(selectedType.replace('-', ' '))) {
                shouldShow = false;
            }
        }

        photo.style.display = shouldShow ? '' : 'none';
        if (shouldShow) visibleCount++;
    });

    updateFilterCount(visibleCount, photos.length);
}

function updateFilterCount(visible, total) {
    const countEl = document.getElementById('filterCount');
    if (countEl) {
        if (visible === total) {
            countEl.textContent = 'All photos';
        } else {
            countEl.textContent = `${visible} of ${total} photos`;
        }
    }
}

// ===== FUNÇÕES DE DETECÇÃO =====
window.detectType = function (fileName) {
    fileName = fileName.toLowerCase();
    if (fileName.includes('brindle')) return 'brindle';
    if (fileName.includes('salt') || fileName.includes('pepper')) return 'salt-pepper';
    if (fileName.includes('black') && fileName.includes('white')) return 'black-white';
    if (fileName.includes('tricolor')) return 'tricolor';
    if (fileName.includes('exotic')) return 'exotic';
    return 'other';
}

window.detectTone = function (fileName) {
    fileName = fileName.toLowerCase();
    if (fileName.includes('light')) return 'light';
    if (fileName.includes('medium')) return 'medium';
    if (fileName.includes('dark')) return 'dark';
    if (fileName.includes('mix')) return 'mixed';
    return 'medium';
}

window.detectSize = function (fileName) {
    fileName = fileName.toLowerCase();
    if (fileName.includes('small') || fileName.includes(' s ')) return 'small';
    if (fileName.includes('medium') || fileName.includes(' m ')) return 'medium';
    if (fileName.includes('large') || fileName.includes(' l ')) return 'large';
    if (fileName.includes('xl') || fileName.includes('extra')) return 'xl';
    return 'medium';
}

window.detectPrice = function (priceText) {
    const match = priceText.match(/\$?([\d,]+\.?\d*)/);
    if (match) {
        return parseFloat(match[1].replace(',', ''));
    }
    return null;
}

// ===== CARREGAR CONTAGENS DOS FILTROS =====
window.loadFilterCounts = async function () {
    try {
        const response = await fetch('/api/gallery/filter-counts');
        const data = await response.json();

        if (data.success && data.counts) {
            // Atualizar contadores de tipo
            Object.entries(data.counts.types || {}).forEach(([type, count]) => {
                const label = document.querySelector(`label[for="${type}"] .filter-count`);
                if (label) {
                    label.textContent = `(${count})`;
                }
            });

            // Atualizar contadores de tom
            Object.entries(data.counts.tones || {}).forEach(([tone, count]) => {
                const label = document.querySelector(`label[for="${tone}"] .filter-count`);
                if (label) {
                    label.textContent = `(${count})`;
                }
            });

            // Atualizar contadores de tamanho
            Object.entries(data.counts.sizes || {}).forEach(([size, count]) => {
                const label = document.querySelector(`label[for="${size}"] .filter-count`);
                if (label) {
                    label.textContent = `(${count})`;
                }
            });
        }
    } catch (error) {
        console.error('Erro ao carregar contagens dos filtros:', error);
    }
}

// ===== UTILS =====
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {

    // Setup filtros
    setupFilters();

    // Configurar filtros dinâmicos após carregar categorias
    setTimeout(() => {
        window.setupDynamicFilters();
    }, 1000);

    // Carregar contagens - COMENTADO
    // if (window.loadFilterCounts) {
    //     window.loadFilterCounts();  // ← ESTA LINHA DEVE ESTAR COMENTADA
    // }
});

// ===== SISTEMA DE FILTROS ORIGINAL RESTAURADO =====

window.autoApplyFilters = async function () {
    console.log('🔍 Applying filters...');

    // Coletar filtros selecionados (NOVO SISTEMA)
    const selectedFilters = {
        category: '',      // Main category (natural-cowhides, accessories, etc.)
        prices: []         // Price ranges
    };

    // Category filter (radio - both mobile and desktop)
    const categoryRadio = document.querySelector('input[name="categoryFilter"]:checked');
    const isAllCategoriesSelected = categoryRadio && categoryRadio.value === '';

    if (categoryRadio && categoryRadio.value) {
        selectedFilters.category = categoryRadio.value;
    }

    // Price ranges - Collect from BOTH: mobile (#priceFilters) and desktop (name="priceRange")
    document.querySelectorAll('input[name="priceRange"]:checked').forEach(cb => {
        if (!selectedFilters.prices.includes(cb.value)) {
            selectedFilters.prices.push(cb.value);
        }
    });

    console.log('📌 Selected filters:', selectedFilters);
    console.log('📌 All Categories selected:', isAllCategoriesSelected);

    // Check if any filter is active
    // "All Categories" counts as an active filter when explicitly selected
    const hasActiveFilters = selectedFilters.category || selectedFilters.prices.length > 0;

    // Only return to homepage if NO filters AND "All Categories" was NOT explicitly clicked
    // This function is called when user interacts with filters, so we show results
    if (!hasActiveFilters && !isAllCategoriesSelected) {
        // No filters at all - show homepage
        console.log('📌 No filters active - showing categories');
        window.showCategories();
        return;
    }

    // Get MAIN_CATEGORIES from client-catalog.js
    const MAIN_CATEGORIES = window.MAIN_CATEGORIES;
    if (!MAIN_CATEGORIES) {
        console.error('❌ MAIN_CATEGORIES not found');
        window.showCategories();
        return;
    }

    // Collect subcategories to display
    let subcategoriesToShow = [];

    // If category filter is active, show subcategories of that main category
    if (selectedFilters.category) {
        const mainCat = MAIN_CATEGORIES[selectedFilters.category];
        if (mainCat && mainCat.subcategories) {
            for (const [subKey, sub] of Object.entries(mainCat.subcategories)) {
                if (!sub.hidden) {
                    subcategoriesToShow.push({
                        mainKey: selectedFilters.category,
                        subKey: subKey,
                        ...sub
                    });
                }
            }
        }
    } else {
        // No category filter - show all subcategories from all main categories
        for (const [mainKey, mainCat] of Object.entries(MAIN_CATEGORIES)) {
            if (mainCat.subcategories) {
                for (const [subKey, sub] of Object.entries(mainCat.subcategories)) {
                    if (!sub.hidden) {
                        subcategoriesToShow.push({
                            mainKey: mainKey,
                            subKey: subKey,
                            ...sub
                        });
                    }
                }
            }
        }
    }

    // Apply price filter if needed (this would need price data from backend)
    // For now, we show all subcategories since thumbnails don't have price info directly
    if (selectedFilters.prices.length > 0) {
        console.log('💰 Price filter active - filtering by price range');
        // Price filtering will happen at the backend category level
        // We need to fetch price data first
        try {
            const data = await window.CategoriesCache.fetch();
            const categoryPrices = {};

            // Build price map from backend data
            (data.categories || []).forEach(cat => {
                const price = cat.minPrice || cat.price || cat.basePrice || 0;
                categoryPrices[cat.name.toLowerCase()] = price;
            });

            // Filter subcategories by price
            subcategoriesToShow = subcategoriesToShow.filter(sub => {
                const subName = (sub.name || '').toLowerCase();
                const subFolder = (sub.folderPath || '').toLowerCase();

                // Find matching price from backend
                let matchedPrice = 0;
                for (const [catName, price] of Object.entries(categoryPrices)) {
                    if (catName.includes(subName) || subName.includes(catName) ||
                        catName.includes(subFolder) || subFolder.includes(catName)) {
                        matchedPrice = price;
                        break;
                    }
                }

                if (matchedPrice === 0) return true; // Keep if no price data

                return selectedFilters.prices.some(range => {
                    const [min, max] = range.split('-').map(Number);
                    return matchedPrice >= min && matchedPrice <= (max || 999999);
                });
            });
        } catch (error) {
            console.warn('Could not apply price filter:', error);
        }
    }

    console.log(`✅ ${subcategoriesToShow.length} subcategories to show`);
    displayFilteredSubcategories(subcategoriesToShow, selectedFilters);
}

// ===== UPDATE FILTER VISIBILITY BASED ON CLIENT ACCESS =====
window.updateFilterVisibility = async function () {
    console.log('🔒 Checking available filters for client...');
    // Just call setupDynamicFilters which handles everything
    await window.setupDynamicFilters();
}

/**
 * Display filtered subcategories with thumbnails
 * Uses MAIN_CATEGORIES structure for proper card rendering
 */
window.displayFilteredSubcategories = function (subcategories, filters) {
    const container = document.getElementById('categoriesContainer');
    if (!container) return;

    // Hide photos container
    const photosContainer = document.getElementById('photosContainer');
    if (photosContainer) {
        photosContainer.style.display = 'none';
    }

    // Hide stock container if exists
    const catalogContent = document.getElementById('catalogContent');
    if (catalogContent) {
        catalogContent.style.display = 'none';
    }

    // Show breadcrumb
    const breadcrumbContainer = document.getElementById('breadcrumbContainer');
    if (breadcrumbContainer) {
        breadcrumbContainer.style.display = 'block';
    }

    const backNav = document.getElementById('backNavigation');
    if (backNav) {
        backNav.style.display = 'none';
    }

    // Get filter label for breadcrumb
    let filterLabel = 'Filtered Results';
    if (filters.category) {
        const MAIN_CATEGORIES = window.MAIN_CATEGORIES;
        if (MAIN_CATEGORIES && MAIN_CATEGORIES[filters.category]) {
            filterLabel = MAIN_CATEGORIES[filters.category].name;
        }
    }

    // Update breadcrumb
    const breadcrumbPath = document.getElementById('breadcrumbPath');
    if (breadcrumbPath) {
        breadcrumbPath.innerHTML = `
            <span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>
            <span class="breadcrumb-item current">${filterLabel} (${subcategories.length})</span>
        `;
    }

    // Mostrar badge Mix & Match se estamos em categoria Mix & Match
    const breadcrumbMmBadge = document.getElementById('breadcrumbMixMatchBadge');
    if (breadcrumbMmBadge) {
        const isMixMatch = window.isCurrentCategoryMixMatch && window.isCurrentCategoryMixMatch();
        breadcrumbMmBadge.style.display = isMixMatch ? '' : 'none';
    }

    // Clear container
    container.innerHTML = '';

    if (subcategories.length === 0) {
        container.innerHTML = `
            <div class="no-results-container">
                <div class="no-results-icon">
                    <i class="fas fa-filter"></i>
                </div>
                <h3 class="no-results-title">No categories match your filters</h3>
                <p class="no-results-text">Try adjusting your filter criteria or clear all filters to see all categories</p>
                <button onclick="clearAllFilters();" class="btn-clear-filters">
                    <i class="fas fa-times"></i> Clear Filters
                </button>
            </div>
        `;
        container.style.display = 'grid';
        return;
    }

    // Use processCategoryThumbnail from client-catalog.js
    const processThumbnail = window.processCategoryThumbnail || ((url) => url);

    // Render subcategories with thumbnails (same style as homepage)
    let html = '';
    for (const sub of subcategories) {
        const hasThumbnail = sub.thumbnail ? true : false;
        const thumbnailUrl = processThumbnail(sub.thumbnail);
        const thumbnailStyle = hasThumbnail ? `style="background-image: url('${thumbnailUrl}');"` : '';

        if (hasThumbnail) {
            // Card with thumbnail - full background image style
            html += `
                <div class="subcategory-card folder-card has-thumbnail" ${thumbnailStyle}
                     onclick="window.openSubcategory('${sub.mainKey}', '${sub.subKey}')">
                    <div class="card-overlay">
                        <h3>${sub.name}</h3>
                        <p>${sub.description || ''}</p>
                    </div>
                </div>
            `;
        } else {
            // Regular card without thumbnail
            html += `
                <div class="subcategory-card folder-card no-thumbnail"
                     onclick="window.openSubcategory('${sub.mainKey}', '${sub.subKey}')">
                    <div class="card-content">
                        <h3>${sub.name}</h3>
                        <p>${sub.description || ''}</p>
                    </div>
                </div>
            `;
        }
    }

    container.innerHTML = html;
    container.style.display = 'grid';
    container.style.visibility = 'visible';
    container.style.opacity = '1';
}

// Keep old function for backwards compatibility
window.displayFilteredCategories = window.displayFilteredSubcategories;

// Adicionar função auxiliar para gerar descrições
window.generateCategoryDescription = function (categoryName) {
    const descriptions = {
        // Brindle
        'Brindle': 'Natural tiger stripe pattern in various tones',
        'Brindle Medium and Dark Tones': 'Mix of medium and dark brindle patterns',
        'Brindle White Backbone': 'Brindle pattern with distinctive white backbone',
        'Brindle White Belly': 'Brindle pattern with white belly marking',
        'Brindle Grey': 'Grey-toned brindle pattern',
        'Brindle Light Grey-Beige': 'Light grey and beige brindle combination',

        // Salt & Pepper
        'Salt & Pepper': 'Mixed pattern with varied tones',
        'Salt & Pepper Black and White': 'Classic black and white speckled pattern',
        'Salt & Pepper Chocolate and White': 'Chocolate brown and white combination',
        'Salt & Pepper - Tricolor': 'Three-color salt and pepper pattern',

        // Black & White
        'Black & White': 'Classic black and white pattern',
        'Black and White Reddish': 'Black and white with reddish tones',

        // Tricolor
        'Tricolor': 'Three colors in natural pattern',

        // Exotic
        'Exotic': 'Unique and special patterns',
        'Exotic Tones': 'Various exotic color combinations',
        'Palomino Exotic': 'Exotic palomino coloring',

        // Default
        'default': 'Selected high-quality leathers'
    };

    // Procurar correspondência parcial
    for (const [key, desc] of Object.entries(descriptions)) {
        if (categoryName.includes(key)) {
            return desc;
        }
    }

    return descriptions['default'];
}

// SUBSTITUIR a função applyFilters quebrada
window.applyFilters = async function () {
    const categoriesContainer = document.getElementById('categoriesContainer');
    if (categoriesContainer) {
        categoriesContainer.style.display = 'none';
    }

    window.showLoading();

    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        await autoApplyFilters();
        await new Promise(resolve => setTimeout(resolve, 200));
    } finally {
        window.hideLoading();
    }
}

window.clearAllFilters = function () {
    // Reset filter state
    window.filterState = window.filterState || {};
    window.filterState.inStockOnly = false;

    // Reset category filter - mark "All Categories" as selected
    document.querySelectorAll('input[name="categoryFilter"]').forEach(rb => {
        rb.checked = rb.value === '';
    });

    // Uncheck all price range checkboxes (both mobile and desktop)
    document.querySelectorAll('input[name="priceRange"]').forEach(checkbox => {
        checkbox.checked = false;
    });

    // Uncheck in-stock filter (both mobile and desktop)
    const inStockDesktop = document.getElementById('inStockFilter');
    const inStockMobile = document.getElementById('inStockFilterMobile');
    if (inStockDesktop) inStockDesktop.checked = false;
    if (inStockMobile) inStockMobile.checked = false;

    // Close the dropdown after clearing
    const dropdown = document.getElementById('filtersDropdown');
    const button = document.querySelector('.header-filters-btn');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
    if (button) {
        button.classList.remove('active');
    }

    // Return to main categories
    window.showCategories();
}

// ===== SISTEMA DE BUSCA UNIFICADO =====
// Busca tanto produtos de catálogo (stock) quanto categorias (fotos únicas)
// em um único dropdown organizado

// Usar variáveis globais no window para evitar conflitos com client-core.js
if (typeof window._searchTimeout === 'undefined') window._searchTimeout = null;
if (typeof window._searchProductsCache === 'undefined') window._searchProductsCache = null;
if (typeof window._searchCacheTimestamp === 'undefined') window._searchCacheTimestamp = 0;
const SEARCH_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos

window.handleSearchInput = function (event) {
    const query = event.target.value.trim();

    // Limpar timeout anterior (debounce)
    if (window._searchTimeout) {
        clearTimeout(window._searchTimeout);
    }

    if (query.length < 2) {
        hideSearchSuggestions();
        return;
    }

    // Debounce de 300ms para evitar muitas requisições
    window._searchTimeout = setTimeout(() => {
        performUnifiedSearch(query);
    }, 300);
}

// Buscar produtos de catálogo (stock)
async function getSearchProducts() {
    const now = Date.now();

    // Retornar cache se ainda válido
    if (window._searchProductsCache && (now - window._searchCacheTimestamp) < SEARCH_CACHE_DURATION_MS) {
        return window._searchProductsCache;
    }

    try {
        const response = await fetch('/api/catalog/products?category=all&limit=1000', {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success && data.products) {
            window._searchProductsCache = data.products;
            window._searchCacheTimestamp = now;
            return data.products;
        }
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
    }

    return window._searchProductsCache || [];
}

// Busca unificada - produtos E categorias
async function performUnifiedSearch(query) {
    const dropdown = getOrCreateSearchDropdown();
    if (!dropdown) return;

    const queryLower = query.toLowerCase();

    // Mostrar loading
    dropdown.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #666;">
            Searching...
        </div>
    `;
    showSearchDropdown();

    try {
        // Buscar em paralelo: produtos E categorias
        const [products, categoriesData] = await Promise.all([
            getSearchProducts(),
            window.CategoriesCache ? window.CategoriesCache.fetch() : { categories: [] }
        ]);

        const categories = categoriesData.categories || [];

        // Filtrar produtos
        const matchedProducts = products.filter(p => {
            const name = (p.name || '').toLowerCase();
            const qbItem = (p.qbItem || '').toLowerCase();
            const category = (p.category || '').toLowerCase();
            return name.includes(queryLower) || qbItem.includes(queryLower) || category.includes(queryLower);
        }).slice(0, 6); // Limitar a 6 produtos

        // Filtrar categorias
        const matchedCategories = categories.filter(cat => {
            const name = (cat.name || '').toLowerCase();
            const displayName = (cat.displayName || '').toLowerCase();
            return name.includes(queryLower) || displayName.includes(queryLower);
        }).slice(0, 8); // Limitar a 8 categorias

        // Renderizar resultados
        renderUnifiedResults(dropdown, query, matchedProducts, matchedCategories);

    } catch (error) {
        console.error('Erro na busca:', error);
        dropdown.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #d32f2f;">
                Error searching
            </div>
        `;
    }
}

function renderUnifiedResults(dropdown, query, products, categories) {
    const queryLower = query.toLowerCase();
    const isDark = document.body.classList.contains('dark-mode');

    // Dark mode colors
    const colors = isDark ? {
        bg: '#2d2d2d',
        bgHover: '#3d3a35',
        bgOOS: '#252525',
        text: '#e0e0e0',
        textOOS: '#888',
        border: '#444',
        noResult: '#999'
    } : {
        bg: '#fff',
        bgHover: '#fef6ee',
        bgOOS: '#f9f9f9',
        text: '#333',
        textOOS: '#666',
        border: '#eee',
        noResult: '#666'
    };

    if (products.length === 0 && categories.length === 0) {
        dropdown.innerHTML = `
            <div style="padding: 30px; text-align: center; color: ${colors.noResult}; font-size: 15px;">
                No results for "<span style="color: #B87333; font-weight: 600;">${query}</span>"
            </div>
        `;
        return;
    }

    // Criar lista unificada de todos os itens
    let allItems = [];

    // Adicionar categorias
    categories.forEach(cat => {
        const displayName = cat.displayName || cat.name;
        allItems.push({
            type: 'category',
            name: displayName,
            highlighted: highlightMatch(displayName, queryLower),
            id: cat.driveId || cat.id,
            isOOS: false
        });
    });

    // Adicionar produtos
    products.forEach(product => {
        const name = product.name || product.qbItem;
        const stock = product.stock || 0;
        allItems.push({
            type: 'product',
            name: name,
            highlighted: highlightMatch(name, queryLower),
            qbItem: product.qbItem,
            category: product.category || product.catalogCategory || '',
            isOOS: stock === 0
        });
    });

    // Ordenar: itens em stock primeiro, out of stock no final
    allItems.sort((a, b) => {
        if (a.isOOS === b.isOOS) return 0;
        return a.isOOS ? 1 : -1;
    });

    // Gerar HTML
    let html = '';

    allItems.forEach((item, idx) => {
        const last = idx === allItems.length - 1;

        if (item.type === 'category') {
            html += `<div class="sr-item" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; cursor: pointer; border-bottom: ${last ? 'none' : '1px solid ' + colors.border}; background: ${colors.bg};"
                onmouseover="this.style.background='${colors.bgHover}'; this.style.borderLeft='4px solid #B87333'; this.style.paddingLeft='16px';"
                onmouseout="this.style.background='${colors.bg}'; this.style.borderLeft='none'; this.style.paddingLeft='20px';"
                onclick="selectSearchCategory('${item.id.replace(/'/g, "\\'")}', '${item.name.replace(/'/g, "\\'")}')">
                <span style="flex: 1; font-size: 15px; color: ${colors.text}; font-weight: 400;">${item.highlighted}</span>
                <span style="color: #B87333; font-size: 20px; font-weight: bold; margin-left: 12px;">›</span>
            </div>`;
        } else {
            // Produtos Out of Stock: sem clique, sem hover, apenas exibir
            if (item.isOOS) {
                html += `<div class="sr-item" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; cursor: default; border-bottom: ${last ? 'none' : '1px solid ' + colors.border}; background: ${colors.bgOOS}; opacity: 0.6;">
                    <span style="flex: 1; font-size: 15px; color: ${colors.textOOS}; font-weight: 400;">${item.highlighted}</span>
                    <span style="font-size: 11px; font-weight: 700; color: #fff; background: #d32f2f; padding: 5px 10px; border-radius: 4px; text-transform: uppercase; margin-left: 12px;">OUT OF STOCK</span>
                </div>`;
            } else {
                // Produtos com estoque: clicável, leva para a categoria
                html += `<div class="sr-item" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; cursor: pointer; border-bottom: ${last ? 'none' : '1px solid ' + colors.border}; background: ${colors.bg};"
                    onmouseover="this.style.background='${colors.bgHover}'; this.style.borderLeft='4px solid #B87333'; this.style.paddingLeft='16px';"
                    onmouseout="this.style.background='${colors.bg}'; this.style.borderLeft='none'; this.style.paddingLeft='20px';"
                    onclick="openSearchProduct('${item.qbItem}', '${item.name.replace(/'/g, "\\'")}')">
                    <span style="flex: 1; font-size: 15px; color: ${colors.text}; font-weight: 400;">${item.highlighted}</span>
                    <span style="color: #2e7d32; font-size: 13px; font-weight: 500; margin-left: 12px;">In Stock ›</span>
                </div>`;
            }
        }
    });

    dropdown.innerHTML = html;
}

function highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<strong style="color: #ff9800;">$1</strong>');
}

function getOrCreateSearchDropdown() {
    let dropdown = document.getElementById('searchSuggestionsDropdown');
    const isDark = document.body.classList.contains('dark-mode');

    if (!dropdown) {
        const searchInput = document.getElementById('globalSearch');
        if (!searchInput) return null;

        dropdown = document.createElement('div');
        dropdown.id = 'searchSuggestionsDropdown';
        dropdown.className = 'search-suggestions-dropdown';
        searchInput.parentElement.style.position = 'relative';
        searchInput.parentElement.appendChild(dropdown);

        // Adicionar estilos CSS para os itens de resultado
        addSearchStyles();
    }

    // Atualizar cores baseado no tema atual
    const bgColor = isDark ? '#2d2d2d' : '#ffffff';
    const borderColor = isDark ? '#444' : '#e0e0e0';
    dropdown.style.cssText = `
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        background: ${bgColor};
        border: 1px solid ${borderColor};
        border-radius: 10px;
        max-height: 450px;
        overflow-y: auto;
        z-index: 999999;
        box-shadow: 0 8px 30px rgba(0,0,0,${isDark ? '0.4' : '0.18'});
        display: none;
        isolation: isolate;
    `;

    return dropdown;
}

function addSearchStyles() {
    if (document.getElementById('unified-search-styles')) return;

    const style = document.createElement('style');
    style.id = 'unified-search-styles';
    style.textContent = `
        /* Container do dropdown */
        #searchSuggestionsDropdown {
            border-radius: 10px !important;
            overflow: hidden;
        }

        /* Scrollbar - Light mode */
        #searchSuggestionsDropdown::-webkit-scrollbar {
            width: 8px;
        }
        #searchSuggestionsDropdown::-webkit-scrollbar-track {
            background: #f0f0f0;
        }
        #searchSuggestionsDropdown::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, #B87333, #D4956A);
            border-radius: 4px;
        }
        #searchSuggestionsDropdown::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(180deg, #9A5F28, #B87333);
        }

        /* Scrollbar - Dark mode */
        body.dark-mode #searchSuggestionsDropdown::-webkit-scrollbar-track {
            background: #1a1a1a;
        }

        /* Transition para hover nos itens */
        .sr-item {
            transition: all 0.15s ease !important;
        }
    `;
    document.head.appendChild(style);
}

function hideSearchSuggestions() {
    const dropdown = document.getElementById('searchSuggestionsDropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
    // Remover classe do body para restaurar z-index do botão do carrinho
    document.body.classList.remove('search-dropdown-open');
}

function showSearchDropdown() {
    const dropdown = document.getElementById('searchSuggestionsDropdown');
    if (dropdown) {
        dropdown.style.display = 'block';
    }
    // Adicionar classe ao body para esconder botão do carrinho
    document.body.classList.add('search-dropdown-open');
}

// Selecionar categoria (navegar para fotos)
window.selectSearchCategory = function (categoryId, categoryName) {
    hideSearchSuggestions();
    clearSearchInput();

    console.log('🔍 selectSearchCategory:', categoryName, categoryId);

    // Mapeamento de pastas de Natural Cowhides para subcategory keys
    // Os keys devem corresponder EXATAMENTE aos definidos em MAIN_CATEGORIES
    const naturalCowhidesMapping = {
        'Brazil Best Sellers': 'brazil-best-sellers',
        'Brazil Top Selected Categories': 'brazil-top-categories',  // CORRIGIDO: era brazil-top-selected
        'Colombian Cowhides': 'colombian-cowhides'
        // 'Cowhide Hair On BRA...' pertence a specialty-cowhides, não natural-cowhides
    };

    // Detectar se é uma subcategoria de Natural Cowhides
    let detectedSubcategoryKey = null;
    let detectedFolderName = null;
    for (const [folderName, subcatKey] of Object.entries(naturalCowhidesMapping)) {
        if (categoryName.startsWith(folderName)) {
            detectedSubcategoryKey = subcatKey;
            detectedFolderName = folderName;
            break;
        }
    }

    if (detectedSubcategoryKey) {
        console.log('🚀 Natural Cowhides detected:', detectedSubcategoryKey, 'folder:', detectedFolderName);

        // Verificar se o sidebar já existe
        const existingSidebar = document.querySelector('.category-sidebar');

        if (!existingSidebar && window.openCategory) {
            // Criar o sidebar primeiro
            window.openCategory('natural-cowhides');
        }

        // Usar switchDirectGalleryTab para ir para a subcategoria correta
        setTimeout(async () => {
            if (window.switchDirectGalleryTab) {
                console.log('🔄 Switching to subcategory:', detectedSubcategoryKey);
                await window.switchDirectGalleryTab('natural-cowhides', detectedSubcategoryKey);
            }

            // Depois de mudar a subcategoria, navegar para a pasta específica se necessário
            setTimeout(() => {
                // Configurar o path de navegação com TODOS os níveis
                if (categoryName.includes(' → ')) {
                    const parts = categoryName.split(' → ');

                    // Construir o path completo com IDs corretos para cada nível
                    const pathParts = categoryId.split('/').filter(p => p);
                    window.navigationState.currentPath = parts.map((part, index) => {
                        // Construir o ID parcial até este nível
                        const partialPath = pathParts.slice(0, index + 1).join('/');
                        return {
                            id: partialPath,
                            name: part.trim()
                        };
                    });

                    console.log('📍 Path configurado:', window.navigationState.currentPath);

                    // Navegar para a pasta específica (subpasta)
                    window.navigationState.currentFolderId = categoryId;

                    // Atualizar o breadcrumb ANTES de carregar o conteúdo
                    if (window.updateBreadcrumb) {
                        window.updateBreadcrumb();
                    }

                    window.loadFolderContents(categoryId);
                }
                // Se não tem ' → ', a switchDirectGalleryTab já carregou o conteúdo correto
            }, 300);
        }, existingSidebar ? 50 : 150);

        return;
    }

    // Para outras categorias, navegar normalmente
    if (categoryName.includes(' → ')) {
        const parts = categoryName.split(' → ');
        window.navigationState.currentPath = parts.map((part, index) => ({
            id: index === 0 ? categoryId.split('/')[0] : categoryId,
            name: part.trim()
        }));
    } else {
        window.navigationState.currentPath = [{ id: categoryId, name: categoryName }];
    }

    window.navigationState.currentFolderId = categoryId;
    window.updateBreadcrumb();
    window.loadFolderContents(categoryId);
}

// Detectar subcategoria pelo nome do produto
function detectSubcategoryFromName(productName) {
    const name = (productName || '').toLowerCase();

    // Specialty Cowhides
    if (name.includes('devore') || name.includes('metallica') || name.includes('metallic') || name.includes('acid wash')) {
        return { categoryKey: 'specialty-cowhides', subcategoryKey: 'devore-metallic' };
    }
    if (name.includes('printed') || name.includes('zebra') || name.includes('stencil') || name.includes('leopard') || name.includes('tiger') || name.includes('cheetah')) {
        return { categoryKey: 'specialty-cowhides', subcategoryKey: 'printed-cowhides' };
    }
    if (name.includes('dyed') && !name.includes('undyed')) {
        return { categoryKey: 'specialty-cowhides', subcategoryKey: 'dyed-cowhides' };
    }
    if (name.includes('binding') || name.includes('lined') || name.includes('leather border')) {
        return { categoryKey: 'specialty-cowhides', subcategoryKey: 'cowhide-with-binding' };
    }

    // Small Accent Hides (chave correta: 'small-accent-hides')
    if (name.includes('sheepskin') || name.includes('sheep') || name.includes('icelandic') || name.includes('himalayan') || name.includes('tibetan')) {
        return { categoryKey: 'small-accent-hides', subcategoryKey: 'sheepskins' };
    }
    if (name.includes('calfskin') || name.includes('calf skin') || name.includes('baby calf')) {
        return { categoryKey: 'small-accent-hides', subcategoryKey: 'calfskins' };
    }
    if (name.includes('goatskin') || name.includes('goat skin') || name.includes('goat hide')) {
        return { categoryKey: 'small-accent-hides', subcategoryKey: 'goatskins' };
    }

    // Patchwork Rugs
    if (name.includes('chevron')) {
        return { categoryKey: 'patchwork-rugs', subcategoryKey: 'chevron-rugs' };
    }
    if (name.includes('runner') || name.includes('2.5x8') || name.includes('2x8')) {
        return { categoryKey: 'patchwork-rugs', subcategoryKey: 'runner-rugs' };
    }
    if (name.includes('bedside') || name.includes('22x34')) {
        return { categoryKey: 'patchwork-rugs', subcategoryKey: 'bedside-rugs' };
    }
    if (name.includes('rodeo') || name.includes('star rug') || name.includes('longhorn')) {
        return { categoryKey: 'patchwork-rugs', subcategoryKey: 'rodeo-rugs' };
    }
    if (name.includes('patchwork') || (name.includes('rug') && (name.includes('3x5') || name.includes('4x6') || name.includes('6x8') || name.includes('9x11')))) {
        return { categoryKey: 'patchwork-rugs', subcategoryKey: 'square-rugs' };
    }

    // Accessories
    if (name.includes('pillow')) {
        return { categoryKey: 'accessories', subcategoryKey: 'pillows' };
    }
    if (name.includes('bag') || name.includes('purse') || name.includes('handbag') || name.includes('crossbody') || name.includes('duffle') || name.includes('backpack')) {
        return { categoryKey: 'accessories', subcategoryKey: 'bags-purses' };
    }
    if (name.includes('coaster') || name.includes('placemat') || name.includes('napkin') || name.includes('koozie') || name.includes('wine')) {
        return { categoryKey: 'accessories', subcategoryKey: 'table-kitchen' };
    }
    if (name.includes('slipper')) {
        return { categoryKey: 'accessories', subcategoryKey: 'slippers' };
    }
    if (name.includes('scrap') || name.includes('diy')) {
        return { categoryKey: 'accessories', subcategoryKey: 'scraps-diy' };
    }
    if (name.includes('stocking') || name.includes('christmas') || name.includes('holiday') || name.includes('gift')) {
        return { categoryKey: 'accessories', subcategoryKey: 'gifts-seasonal' };
    }

    // Furniture
    if (name.includes('pouf') || name.includes('ottoman') || name.includes('cube')) {
        return { categoryKey: 'furniture', subcategoryKey: 'pouf-ottoman' };
    }
    if (name.includes('stool') || name.includes('foot stool')) {
        return { categoryKey: 'furniture', subcategoryKey: 'foot-stool' };
    }
    if (name.includes('chair') || name.includes('bench') || name.includes('furniture')) {
        return { categoryKey: 'furniture', subcategoryKey: 'leather-furniture' };
    }

    return null;
}

// Abrir produto do catálogo - navega para a categoria do produto
window.openSearchProduct = function (qbItem, productName) {
    hideSearchSuggestions();
    clearSearchInput();

    console.log('🔍 Abrindo produto:', qbItem, 'nome:', productName);

    // Detectar subcategoria pelo nome do produto
    const detected = detectSubcategoryFromName(productName);

    if (detected && window.openSubcategory) {
        console.log('🚀 Detectado:', detected.categoryKey, detected.subcategoryKey);
        window.openSubcategory(detected.categoryKey, detected.subcategoryKey);
    } else {
        console.log('⚠️ Não foi possível detectar categoria para:', productName);
        // Ir para homepage como fallback
        if (window.showHomepage) {
            window.showHomepage();
        }
    }
}

function clearSearchInput() {
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.value = '';
    }
}

// Manter compatibilidade com função antiga
window.selectSuggestion = window.selectSearchCategory;

window.executeGlobalSearch = function () {
    const searchInput = document.getElementById('globalSearch');
    if (!searchInput) return;

    const query = searchInput.value.trim();
    if (query.length >= 2) {
        performUnifiedSearch(query);
    }
}

// Conectar ao campo de busca quando a página carregar
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
        searchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                hideSearchSuggestions();
                executeGlobalSearch();
            }
        });

        // Esconder sugestões ao clicar fora
        document.addEventListener('click', function (e) {
            if (!e.target.closest('#globalSearch') && !e.target.closest('#searchSuggestionsDropdown')) {
                hideSearchSuggestions();
            }
        });
    }
});

// ===== REAGIR A MUDANÇAS DE MOEDA =====
window.addEventListener('currencyChanged', (e) => {
    console.log('💱 [Commerce] Moeda alterada para:', e.detail.newCurrency);

    // Re-renderizar PriceProgressBar se estiver visível
    if (window.PriceProgressBar && window.PriceProgressBar.rateRules && window.PriceProgressBar.rateRules.length > 0) {
        setTimeout(() => {
            console.log('💱 [Commerce] Re-renderizando tiers com nova moeda...');
            window.PriceProgressBar.render();
            window.PriceProgressBar.updateProgress();
        }, 150);
    }
});

console.log('💱 [Commerce] Currency change listener registrado');
console.log('🛍️ client-commerce.js carregado - Módulo comercial pronto');

// ============================================
// MIX & MATCH INFO MODAL
// ============================================

window.openMixMatchInfoModal = function() {
    // Remover modal existente se houver
    const existing = document.getElementById('mixMatchInfoModal');
    if (existing) existing.remove();

    // Detect dark mode
    const isDark = document.body.classList.contains('dark-mode');
    const bgColor = isDark ? '#2d2d2d' : 'white';
    const textColor = isDark ? '#e0e0e0' : '#333';
    const textMuted = isDark ? '#999' : '#666';
    const textBody = isDark ? '#ccc' : '#555';
    const sectionBg = isDark ? '#252525' : '#f8fafc';
    const tipBg = isDark ? '#3d3d3d' : '#fef9e7';
    const closeBtnBg = isDark ? '#3d3d3d' : '#f3f4f6';
    const closeBtnHover = isDark ? '#4d4d4d' : '#e5e7eb';
    const closeBtnColor = isDark ? '#ccc' : '#6b7280';

    const modalHTML = `
        <style>
            #mixMatchInfoModal * { box-sizing: border-box; }
            @keyframes mixMatchModalSlideIn {
                from { opacity: 0; transform: scale(0.95) translateY(-10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
        </style>
        <div id="mixMatchInfoModal" style="
            display: flex;
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px);
            z-index: 99999;
            align-items: center;
            justify-content: center;
            padding: 20px;
        ">
            <div style="
                background: ${bgColor};
                border-radius: 16px;
                max-width: 520px;
                width: 100%;
                max-height: 90vh;
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
                animation: mixMatchModalSlideIn 0.3s ease;
                overflow-y: auto;
                position: relative;
            ">
                <!-- Close button -->
                <button onclick="closeMixMatchInfoModal()" style="
                    position: sticky;
                    top: 12px;
                    float: right;
                    margin-right: 12px;
                    margin-top: 12px;
                    width: 32px;
                    height: 32px;
                    border: none;
                    background: ${closeBtnBg};
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: ${closeBtnColor};
                    font-size: 14px;
                    transition: all 0.2s;
                    z-index: 10;
                " onmouseover="this.style.background='${closeBtnHover}'" onmouseout="this.style.background='${closeBtnBg}'">
                    <i class="fas fa-times"></i>
                </button>

                <!-- Body -->
                <div style="padding: 28px;">
                    <!-- Title -->
                    <div style="text-align: center; margin-bottom: 24px;">
                        <div style="display: inline-flex; align-items: center; gap: 10px; background: linear-gradient(135deg, #B87333, #D4A574); color: white; padding: 10px 20px; border-radius: 24px; font-weight: 600; font-size: 1.1rem;">
                            <i class="fas fa-layer-group"></i> Mix & Match Program
                        </div>
                        <p style="margin: 12px 0 0; color: ${textMuted}; font-size: 0.95rem;">Save more when you buy more!</p>
                    </div>

                    <!-- How it works -->
                    <div style="margin-bottom: 20px;">
                        <h3 style="margin: 0 0 10px; color: ${textColor}; font-size: 1rem; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-question-circle" style="color: #B87333;"></i> How does it work?
                        </h3>
                        <p style="margin: 0; color: ${textBody}; line-height: 1.6; font-size: 0.9rem;">
                            Our Mix & Match program allows you to <strong>combine different products</strong> from this category to unlock volume discounts. The more items you add, the better price per item you get!
                        </p>
                    </div>

                    <!-- Tier explanation -->
                    <div style="background: ${sectionBg}; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 12px; color: ${textColor}; font-size: 0.95rem;">
                            <i class="fas fa-medal" style="color: #B87333;"></i> Discount Tiers
                        </h4>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <div style="background: #CD7F32; color: white; padding: 10px; border-radius: 8px; text-align: center;">
                                <div style="font-weight: 600; font-size: 0.85rem;">Bronze</div>
                                <div style="font-size: 0.75rem; opacity: 0.9;">1-5 items</div>
                            </div>
                            <div style="background: #C0C0C0; color: #333; padding: 10px; border-radius: 8px; text-align: center;">
                                <div style="font-weight: 600; font-size: 0.85rem;">Silver</div>
                                <div style="font-size: 0.75rem; opacity: 0.8;">6-12 items</div>
                            </div>
                            <div style="background: linear-gradient(135deg, #FFD700, #FFA500); color: #333; padding: 10px; border-radius: 8px; text-align: center;">
                                <div style="font-weight: 600; font-size: 0.85rem;">Gold</div>
                                <div style="font-size: 0.75rem; opacity: 0.8;">13-36 items</div>
                            </div>
                            <div style="background: linear-gradient(135deg, #b9f2ff, #E0E7EE); color: #333; padding: 10px; border-radius: 8px; text-align: center;">
                                <div style="font-weight: 600; font-size: 0.85rem;">Diamond</div>
                                <div style="font-size: 0.75rem; opacity: 0.8;">37+ items</div>
                            </div>
                        </div>
                    </div>

                    <!-- Key benefits -->
                    <div style="margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px; color: ${textColor}; font-size: 0.95rem;">
                            <i class="fas fa-star" style="color: #B87333;"></i> Key Benefits
                        </h4>
                        <ul style="margin: 0; padding-left: 20px; color: ${textBody}; font-size: 0.85rem; line-height: 1.8;">
                            <li><strong>Mix different styles</strong> - Combine any products within this category</li>
                            <li><strong>Automatic discounts</strong> - Prices update as you add items</li>
                            <li><strong>No minimum order</strong> - Start saving from 6 items</li>
                            <li><strong>Best prices at Diamond</strong> - Maximum savings at 37+ items</li>
                        </ul>
                    </div>

                    <!-- Pro tip -->
                    <div style="background: ${tipBg}; border: 1px solid ${isDark ? '#555' : '#bbf7d0'}; border-radius: 10px; padding: 14px; margin-bottom: 20px; display: flex; gap: 12px; align-items: flex-start;">
                        <div style="width: 28px; height: 28px; background: #F5A623; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i class="fas fa-lightbulb" style="color: white; font-size: 12px;"></i>
                        </div>
                        <div>
                            <strong style="color: ${isDark ? '#F5A623' : '#92400e'}; font-size: 0.85rem;">Pro Tip!</strong>
                            <p style="margin: 4px 0 0; color: ${isDark ? '#ccc' : '#92400e'}; font-size: 0.8rem; line-height: 1.5;">
                                Watch the progress bar above to see how close you are to the next tier. Add just a few more items to unlock bigger savings!
                            </p>
                        </div>
                    </div>

                    <!-- Button -->
                    <button onclick="closeMixMatchInfoModal()" style="
                        width: 100%;
                        padding: 14px;
                        background: #B87333;
                        color: white;
                        border: none;
                        border-radius: 10px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 0.95rem;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='#A0522D'" onmouseout="this.style.background='#B87333'">
                        Got it!
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Fechar ao clicar fora
    document.getElementById('mixMatchInfoModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeMixMatchInfoModal();
        }
    });
};

window.closeMixMatchInfoModal = function() {
    const modal = document.getElementById('mixMatchInfoModal');
    if (modal) modal.remove();
};

// ============================================
// HELP MODAL - Tabbed Interface
// ============================================
window.openHelpModal = function() {
    const existing = document.getElementById('helpModal');
    if (existing) existing.remove();

    const isDark = document.body.classList.contains('dark-mode');
    const bgColor = isDark ? '#1a1a1a' : '#ffffff';
    const headerBg = isDark ? '#252525' : '#f8f9fa';
    const textColor = isDark ? '#e0e0e0' : '#1f2937';
    const textMuted = isDark ? '#888' : '#6b7280';
    const textBody = isDark ? '#bbb' : '#4b5563';
    const borderColor = isDark ? '#333' : '#e5e7eb';
    const accentColor = '#B87333';
    const tabActiveBg = isDark ? '#2d2d2d' : '#ffffff';
    const tabInactiveBg = isDark ? '#1a1a1a' : '#f3f4f6';
    const sectionBg = isDark ? '#252525' : '#f8fafc';

    const modalHTML = `
        <style>
            #helpModal * { box-sizing: border-box; }
            @keyframes helpModalFadeIn {
                from { opacity: 0; transform: scale(0.98); }
                to { opacity: 1; transform: scale(1); }
            }
            .help-tab {
                flex: 1;
                padding: 12px 8px;
                border: none;
                background: ${tabInactiveBg};
                color: ${textMuted};
                font-size: 0.7rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                border-bottom: 2px solid transparent;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                min-width: 0;
            }
            .help-tab i {
                font-size: 16px;
            }
            .help-tab-text {
                display: block;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 100%;
            }
            .help-tab:hover {
                color: ${textColor};
                background: ${tabActiveBg};
            }
            .help-tab.active {
                background: ${tabActiveBg};
                color: ${accentColor};
                border-bottom-color: ${accentColor};
                font-weight: 600;
            }
            @media (min-width: 500px) {
                .help-tab {
                    flex-direction: row;
                    gap: 6px;
                    padding: 10px 14px;
                    font-size: 0.8rem;
                }
                .help-tab i {
                    font-size: 14px;
                }
            }
            .help-content-section {
                display: none;
                animation: helpContentFade 0.2s ease;
            }
            .help-content-section.active {
                display: block;
            }
            @keyframes helpContentFade {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .help-section-title {
                font-size: 0.95rem;
                font-weight: 600;
                color: ${textColor};
                margin: 0 0 12px 0;
                padding-bottom: 8px;
                border-bottom: 1px solid ${borderColor};
            }
            .help-step {
                display: flex;
                gap: 10px;
                margin-bottom: 12px;
                padding: 0;
                background: transparent;
            }
            .help-step-number {
                width: 22px;
                height: 22px;
                background: ${accentColor};
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.7rem;
                font-weight: 600;
                flex-shrink: 0;
                margin-top: 2px;
            }
            .help-step-content {
                flex: 1;
            }
            .help-step-title {
                font-weight: 600;
                color: ${textColor};
                font-size: 0.85rem;
                margin-bottom: 4px;
            }
            .help-step-desc {
                color: ${textBody};
                font-size: 0.8rem;
                line-height: 1.5;
            }
            .help-info-row {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 0;
                border-bottom: 1px solid ${borderColor};
            }
            .help-info-row:last-child {
                border-bottom: none;
            }
            .help-info-icon {
                width: 32px;
                height: 32px;
                background: ${sectionBg};
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: ${accentColor};
                flex-shrink: 0;
            }
            .help-tier-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
                margin: 12px 0;
            }
            @media (max-width: 500px) {
                .help-tier-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                .help-tab-text {
                    font-size: 0.65rem;
                }
            }
        </style>
        <div id="helpModal" style="
            display: flex;
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(3px);
            z-index: 99999;
            align-items: center;
            justify-content: center;
            padding: 16px;
        ">
            <div style="
                background: ${bgColor};
                border-radius: 12px;
                max-width: 640px;
                width: 100%;
                max-height: 85vh;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
                animation: helpModalFadeIn 0.25s ease;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            ">
                <!-- Clean Header -->
                <div style="
                    padding: 16px 20px;
                    background: ${headerBg};
                    border-bottom: 1px solid ${borderColor};
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                ">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-question-circle" style="color: ${accentColor}; font-size: 18px;"></i>
                        <span style="font-weight: 600; color: ${textColor}; font-size: 1rem;">Help Center</span>
                    </div>
                    <button onclick="closeHelpModal()" style="
                        width: 28px;
                        height: 28px;
                        border: none;
                        background: transparent;
                        cursor: pointer;
                        color: ${textMuted};
                        font-size: 16px;
                        border-radius: 6px;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    " onmouseover="this.style.background='${sectionBg}';this.style.color='${textColor}'" onmouseout="this.style.background='transparent';this.style.color='${textMuted}'">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Tabs -->
                <div class="help-tabs-container" style="
                    display: flex;
                    background: ${tabInactiveBg};
                    border-bottom: 1px solid ${borderColor};
                ">
                    <button class="help-tab active" onclick="switchHelpTab('navigation', this)">
                        <i class="fas fa-compass"></i>
                        <span class="help-tab-text">Browse</span>
                    </button>
                    <button class="help-tab" onclick="switchHelpTab('ordering', this)">
                        <i class="fas fa-shopping-cart"></i>
                        <span class="help-tab-text">Order</span>
                    </button>
                    <button class="help-tab" onclick="switchHelpTab('mixmatch', this)">
                        <i class="fas fa-layer-group"></i>
                        <span class="help-tab-text">Mix&Match</span>
                    </button>
                    <button class="help-tab" onclick="switchHelpTab('payment', this)">
                        <i class="fas fa-truck"></i>
                        <span class="help-tab-text">Shipping</span>
                    </button>
                    <button class="help-tab" onclick="switchHelpTab('contact', this)">
                        <i class="fas fa-headset"></i>
                        <span class="help-tab-text">Contact</span>
                    </button>
                </div>

                <!-- Content Area -->
                <div id="helpModalContent" style="padding: 20px; overflow-y: auto; flex: 1; overscroll-behavior: contain;">

                    <!-- Navigation Tab -->
                    <div id="help-navigation" class="help-content-section active">
                        <h3 class="help-section-title"><i class="fas fa-compass" style="color: ${accentColor}; margin-right: 8px;"></i>Browsing the Gallery</h3>

                        <div class="help-step">
                            <div class="help-step-number">1</div>
                            <div class="help-step-content">
                                <div class="help-step-title">Select a Category</div>
                                <div class="help-step-desc">From the main screen, click on any category card (Natural Cowhides, Printed Cowhides, Specialty Cowhides, etc.) to explore products within that collection.</div>
                            </div>
                        </div>

                        <div class="help-step">
                            <div class="help-step-number">2</div>
                            <div class="help-step-content">
                                <div class="help-step-title">Browse Subcategories</div>
                                <div class="help-step-desc">Each main category contains subcategories. Click on a subcategory card to see all available items. For example, in Natural Cowhides you'll find Brazil Best Sellers, Premium Selections, and more.</div>
                            </div>
                        </div>

                        <div class="help-step">
                            <div class="help-step-number">3</div>
                            <div class="help-step-content">
                                <div class="help-step-title">View Product Photos</div>
                                <div class="help-step-desc">Once inside a subcategory, you'll see all available products displayed as photo thumbnails. Each photo represents a unique, one-of-a-kind piece with its own SKU number.</div>
                            </div>
                        </div>

                        <div class="help-step">
                            <div class="help-step-number">4</div>
                            <div class="help-step-content">
                                <div class="help-step-title">Navigate Back</div>
                                <div class="help-step-desc">Use the breadcrumb navigation at the top of the page to go back to previous levels. Click on any breadcrumb item to return to that category or subcategory level.</div>
                            </div>
                        </div>

                        <div class="help-step">
                            <div class="help-step-number">5</div>
                            <div class="help-step-content">
                                <div class="help-step-title">Search Products</div>
                                <div class="help-step-desc">Use the search bar in the header to find specific products by SKU, name, or category. Results will show matching items across all categories.</div>
                            </div>
                        </div>
                    </div>

                    <!-- Ordering Tab -->
                    <div id="help-ordering" class="help-content-section">
                        <h3 class="help-section-title"><i class="fas fa-shopping-cart" style="color: ${accentColor}; margin-right: 8px;"></i>How to Place an Order</h3>

                        <div class="help-step">
                            <div class="help-step-number">1</div>
                            <div class="help-step-content">
                                <div class="help-step-title">Add Items to Cart</div>
                                <div class="help-step-desc">Click on any product photo to add it to your cart. A green checkmark will appear on selected items. Each click toggles the selection on/off. The cart icon in the header shows your current item count.</div>
                            </div>
                        </div>

                        <div class="help-step">
                            <div class="help-step-number">2</div>
                            <div class="help-step-content">
                                <div class="help-step-title">Review Your Selection</div>
                                <div class="help-step-desc">Click the cart icon in the header to open your cart panel. Here you'll see all selected items with their photos, SKUs, categories, and prices. The total is calculated automatically.</div>
                            </div>
                        </div>

                        <div class="help-step">
                            <div class="help-step-number">3</div>
                            <div class="help-step-content">
                                <div class="help-step-title">Remove Items (Optional)</div>
                                <div class="help-step-desc">To remove an item from your cart, click the X button next to the item in the cart panel, or click on the photo again in the gallery to deselect it.</div>
                            </div>
                        </div>

                        <div class="help-step">
                            <div class="help-step-number">4</div>
                            <div class="help-step-content">
                                <div class="help-step-title">Add Order Notes</div>
                                <div class="help-step-desc">Before submitting, you can add special instructions or notes about your order in the notes field at the bottom of the cart panel.</div>
                            </div>
                        </div>

                        <div class="help-step">
                            <div class="help-step-number">5</div>
                            <div class="help-step-content">
                                <div class="help-step-title">Submit Your Order</div>
                                <div class="help-step-desc">Click the "Submit Order" button to send your selection. You'll receive a confirmation and our team will process your order.</div>
                            </div>
                        </div>
                    </div>

                    <!-- Mix & Match Tab -->
                    <div id="help-mixmatch" class="help-content-section">
                        <h3 class="help-section-title"><i class="fas fa-layer-group" style="color: ${accentColor}; margin-right: 8px;"></i>Mix & Match Program</h3>

                        <p style="color: ${textBody}; font-size: 0.85rem; line-height: 1.6; margin-bottom: 16px;">
                            Our Mix & Match program rewards you with <strong>volume discounts</strong> when purchasing from the <strong>Natural Cowhides</strong> category. The more items you add, the better price per item you get!
                        </p>

                        <div style="background: ${sectionBg}; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                            <div style="font-weight: 600; color: ${textColor}; font-size: 0.9rem; margin-bottom: 12px;">
                                <i class="fas fa-medal" style="color: ${accentColor}; margin-right: 6px;"></i>Discount Tiers
                            </div>
                            <div class="help-tier-grid">
                                <div style="background: #CD7F32; color: white; padding: 10px 8px; border-radius: 6px; text-align: center;">
                                    <div style="font-weight: 700; font-size: 0.85rem;">Bronze</div>
                                    <div style="font-size: 0.75rem; opacity: 0.9;">1-5 items</div>
                                </div>
                                <div style="background: #C0C0C0; color: #333; padding: 10px 8px; border-radius: 6px; text-align: center;">
                                    <div style="font-weight: 700; font-size: 0.85rem;">Silver</div>
                                    <div style="font-size: 0.75rem; opacity: 0.85;">6-12 items</div>
                                </div>
                                <div style="background: linear-gradient(135deg, #FFD700, #FFA500); color: #333; padding: 10px 8px; border-radius: 6px; text-align: center;">
                                    <div style="font-weight: 700; font-size: 0.85rem;">Gold</div>
                                    <div style="font-size: 0.75rem; opacity: 0.85;">13-36 items</div>
                                </div>
                                <div style="background: linear-gradient(135deg, #b9f2ff, #E0E7EE); color: #333; padding: 10px 8px; border-radius: 6px; text-align: center;">
                                    <div style="font-weight: 700; font-size: 0.85rem;">Diamond</div>
                                    <div style="font-size: 0.75rem; opacity: 0.85;">37+ items</div>
                                </div>
                            </div>
                        </div>

                        <div class="help-step">
                            <div class="help-step-number"><i class="fas fa-check" style="font-size: 10px;"></i></div>
                            <div class="help-step-content">
                                <div class="help-step-title">Combine Different Styles</div>
                                <div class="help-step-desc">Mix any products within Natural Cowhides - different colors, patterns, sizes. All count toward your tier!</div>
                            </div>
                        </div>

                        <div class="help-step">
                            <div class="help-step-number"><i class="fas fa-check" style="font-size: 10px;"></i></div>
                            <div class="help-step-content">
                                <div class="help-step-title">Automatic Price Updates</div>
                                <div class="help-step-desc">As you add items, watch the progress bar at the top. Prices automatically update when you reach a new tier.</div>
                            </div>
                        </div>

                        <div class="help-step">
                            <div class="help-step-number"><i class="fas fa-check" style="font-size: 10px;"></i></div>
                            <div class="help-step-content">
                                <div class="help-step-title">Track Your Progress</div>
                                <div class="help-step-desc">The yellow "Mix & Match" badge and progress bar show your current tier and how many more items until the next discount level.</div>
                            </div>
                        </div>
                    </div>

                    <!-- Payment & Shipping Tab -->
                    <div id="help-payment" class="help-content-section">
                        <h3 class="help-section-title"><i class="fas fa-truck" style="color: ${accentColor}; margin-right: 8px;"></i>Payment & Shipping</h3>

                        <p style="color: ${textBody}; font-size: 0.85rem; line-height: 1.6; margin-bottom: 16px;">
                            After submitting your order, our sales team will contact you to finalize payment and shipping arrangements.
                        </p>

                        <div class="help-step">
                            <div class="help-step-number"><i class="fas fa-credit-card" style="font-size: 10px;"></i></div>
                            <div class="help-step-content">
                                <div class="help-step-title">Payment Methods</div>
                                <div class="help-step-desc">We accept various payment methods including wire transfer, credit card, and other options. Payment terms will be discussed based on your order volume and account history.</div>
                            </div>
                        </div>

                        <div class="help-step">
                            <div class="help-step-number"><i class="fas fa-box" style="font-size: 10px;"></i></div>
                            <div class="help-step-content">
                                <div class="help-step-title">Shipping Options</div>
                                <div class="help-step-desc">We ship worldwide via trusted freight carriers. Shipping method and costs depend on your location and order size. We'll provide a quote before finalizing your order.</div>
                            </div>
                        </div>

                        <div class="help-step">
                            <div class="help-step-number"><i class="fas fa-clock" style="font-size: 10px;"></i></div>
                            <div class="help-step-content">
                                <div class="help-step-title">Delivery Timeframes</div>
                                <div class="help-step-desc">Domestic orders typically ship within 3-5 business days. International shipping times vary by destination. We'll provide an estimated delivery date with your quote.</div>
                            </div>
                        </div>

                        <div class="help-step">
                            <div class="help-step-number"><i class="fas fa-hand-holding-usd" style="font-size: 10px;"></i></div>
                            <div class="help-step-content">
                                <div class="help-step-title">Freight Costs</div>
                                <div class="help-step-desc">Shipping costs are calculated based on weight, dimensions, and destination. For large orders, we can arrange consolidated shipping for better rates.</div>
                            </div>
                        </div>

                        <div style="margin-top: 16px; padding: 12px; background: ${sectionBg}; border-radius: 8px;">
                            <div style="color: ${textBody}; font-size: 0.8rem; line-height: 1.6;">
                                <i class="fas fa-info-circle" style="color: ${accentColor}; margin-right: 6px;"></i>
                                Questions about payment or shipping? Contact our sales team and we'll be happy to assist!
                            </div>
                        </div>
                    </div>

                    <!-- Contact Tab -->
                    <div id="help-contact" class="help-content-section">
                        <h3 class="help-section-title"><i class="fas fa-headset" style="color: ${accentColor}; margin-right: 8px;"></i>Contact & Support</h3>

                        <div style="background: ${sectionBg}; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                            <div style="font-weight: 600; color: ${textColor}; font-size: 0.9rem; margin-bottom: 12px;">
                                <i class="fas fa-store" style="color: ${accentColor}; margin-right: 6px;"></i>Our Store
                            </div>
                            <div style="color: ${textBody}; font-size: 0.85rem; line-height: 1.8;">
                                16220 Airport Park Drive<br>
                                Suite 145<br>
                                Ft. Myers, FL 33913
                            </div>
                        </div>

                        <div class="help-info-row">
                            <div class="help-info-icon"><i class="fas fa-clock"></i></div>
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: ${textColor}; font-size: 0.85rem;">Business Hours</div>
                                <div style="color: ${textBody}; font-size: 0.8rem;">Monday - Friday: 7:30 AM - 3:30 PM EST</div>
                            </div>
                        </div>

                        <div class="help-info-row">
                            <div class="help-info-icon"><i class="fas fa-phone"></i></div>
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: ${textColor}; font-size: 0.85rem;">Phone</div>
                                <div style="color: ${textBody}; font-size: 0.8rem;">+1 (305) 282-8118</div>
                            </div>
                        </div>

                        <div class="help-info-row">
                            <div class="help-info-icon"><i class="fab fa-whatsapp"></i></div>
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: ${textColor}; font-size: 0.85rem;">WhatsApp</div>
                                <div style="color: ${textBody}; font-size: 0.8rem;">+1 (305) 283-1888</div>
                            </div>
                        </div>

                        <div class="help-info-row">
                            <div class="help-info-icon"><i class="fas fa-envelope"></i></div>
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: ${textColor}; font-size: 0.85rem;">Email</div>
                                <div style="color: ${textBody}; font-size: 0.8rem;">sales@sunshinecowhides.com</div>
                            </div>
                        </div>

                        <button onclick="openChatFromHelp();" style="
                            margin-top: 20px;
                            width: 100%;
                            padding: 16px;
                            background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                            transition: all 0.2s;
                            display: flex;
                            align-items: center;
                            gap: 12px;
                        " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(37,211,102,0.4)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
                            <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <i class="fas fa-comments" style="color: white; font-size: 18px;"></i>
                            </div>
                            <div style="flex: 1; text-align: left;">
                                <div style="font-weight: 600; color: white; font-size: 0.9rem;">Open Live Chat</div>
                                <div style="color: rgba(255,255,255,0.9); font-size: 0.75rem;">Mon-Fri, 7:30 AM - 3:30 PM EST</div>
                            </div>
                            <i class="fas fa-chevron-right" style="color: white; font-size: 14px;"></i>
                        </button>

                        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid ${borderColor};">
                            <div style="font-weight: 600; color: ${textColor}; font-size: 0.85rem; margin-bottom: 10px;">
                                <i class="fas fa-user-cog" style="color: ${accentColor}; margin-right: 6px;"></i>Account Settings
                            </div>
                            <p style="color: ${textBody}; font-size: 0.8rem; line-height: 1.6; margin: 0 0 8px 0;">
                                Access your account from the profile menu <i class="fas fa-user" style="color: ${accentColor};"></i> in the header:
                            </p>
                            <ul style="margin: 0; padding-left: 18px; color: ${textBody}; font-size: 0.8rem; line-height: 1.7;">
                                <li><strong>My Profile</strong> - Update your name, company, and contact info</li>
                                <li><strong>Change Access Code</strong> - Update your login credentials</li>
                                <li><strong>Dark Mode</strong> - Switch between light and dark themes</li>
                                <li><strong>Help</strong> - Open this help center</li>
                                <li><strong>Logout</strong> - Sign out of your account</li>
                            </ul>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Block body scroll when modal is open
    document.body.style.overflow = 'hidden';

    document.getElementById('helpModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeHelpModal();
        }
    });

    // Prevent scroll propagation
    const contentArea = document.getElementById('helpModalContent');
    if (contentArea) {
        contentArea.addEventListener('wheel', function(e) {
            const atTop = this.scrollTop === 0;
            const atBottom = this.scrollTop + this.clientHeight >= this.scrollHeight;

            if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
                e.preventDefault();
            }
        }, { passive: false });
    }
};

window.switchHelpTab = function(tabId, buttonElement) {
    // Remove active from all tabs
    document.querySelectorAll('.help-tab').forEach(tab => tab.classList.remove('active'));
    // Add active to clicked tab
    buttonElement.classList.add('active');

    // Hide all content sections
    document.querySelectorAll('.help-content-section').forEach(section => section.classList.remove('active'));
    // Show selected section
    document.getElementById('help-' + tabId).classList.add('active');
};

window.closeHelpModal = function() {
    const modal = document.getElementById('helpModal');
    if (modal) {
        modal.remove();
        // Restore body scroll
        document.body.style.overflow = '';
    }
};

// Open chat from Help modal - needs delay because modal.remove() destroys button mid-click
window.openChatFromHelp = function() {
    // Close modal first
    closeHelpModal();
    // Open chat after small delay to ensure modal is fully closed
    setTimeout(() => {
        if (window.chatManager) {
            window.chatManager.openChat();
        }
    }, 100);
};