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
// NOTA: Esta lista é usada como FALLBACK enquanto migramos para
// usar participatesInMixMatch do banco de dados
const GLOBAL_MIX_MATCH_CATEGORIES = [
    'Brazilian Cowhides',
    'Colombian Cowhides',
    'Brazil Best Sellers',
    'Brazil Top Selected Categories'
];

// ✅ NOVO: Armazenar participatesInMixMatch da API para a categoria atual
window.currentCategoryMixMatchStatus = null;

/**
 * Verifica se a categoria atual participa do Mix & Match global
 * PRIORIDADE: Usar valor da API se disponível, senão fallback para lista hardcoded
 */
function isCurrentCategoryMixMatch() {
    if (!window.navigationState || !window.navigationState.currentPath || window.navigationState.currentPath.length === 0) {
        return false;
    }

    // ✅ PRIORIDADE 1: Usar valor da API se disponível
    if (window.currentCategoryMixMatchStatus !== null) {
        console.log('🔍 Mix & Match (via API):', window.currentCategoryMixMatchStatus);
        return window.currentCategoryMixMatchStatus;
    }

    // ✅ FALLBACK: Usar lista hardcoded se API não disponível
    const mainCategory = window.navigationState.currentPath[0].name;

    console.log('🔍 Verificando Mix & Match (fallback):', mainCategory);

    // Verificar se está na lista
    const isMixMatch = GLOBAL_MIX_MATCH_CATEGORIES.some(mixCat =>
        mainCategory.includes(mixCat) || mixCat.includes(mainCategory)
    );

    console.log('   → É Mix & Match?', isMixMatch);

    return isMixMatch;
}

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

    renderSpecialSelection(rateRules, basePrice) {
        if (!window.isSpecialSelection) return;

        this.rateRules = rateRules;
        this.basePrice = basePrice;

        const sidebar = document.getElementById('filterSidebar');
        if (!sidebar) return;

        sidebar.style.display = 'block';
        const filterContainer = sidebar.querySelector('.filter-container');
        if (filterContainer) {
            filterContainer.style.display = 'none';
        }

        let priceBarContainer = document.getElementById('priceProgressContainer');
        if (!priceBarContainer) {
            priceBarContainer = document.createElement('div');
            priceBarContainer.id = 'priceProgressContainer';
            // Inserir após o gallery-header, não no sidebar
            const galleryHeader = document.querySelector('.gallery-header');
            if (galleryHeader && galleryHeader.parentElement) {
                galleryHeader.parentElement.insertBefore(priceBarContainer, galleryHeader.nextSibling);
            } else {
                sidebar.appendChild(priceBarContainer); // fallback
            }
        }

        // HTML para Special Selection
        let html = `
            <div class="special-selection-header">
                <h3 style="color: #d4af37; margin-bottom: 15px;">
                    <i class="fas fa-star"></i> Special Selection Pricing
                </h3>
            </div>
            <div class="price-progress-wrapper">
        `;

        this.rateRules.forEach((rule, index) => {
            const label = rule.to === 999 ? `${rule.from}+` : `${rule.from}-${rule.to}`;
            const isFirst = index === 0;

            html += `
                <div class="price-tier ${isFirst ? 'base-tier' : ''}" data-min="${rule.from}" data-max="${rule.to}">
                    <div class="tier-label">${label} photos</div>
                    <div class="tier-price">$${rule.price}/each</div>
                </div>
            `;
        });

        html += `
            </div>
            <div class="current-selection-info">
                <div id="selectionCount">0 photos selected</div>
                <div id="currentUnitPrice">Unit price: $${this.basePrice}</div>
            </div>
        `;

        priceBarContainer.innerHTML = html;
        priceBarContainer.style.display = 'block';

        this.updateProgress();
    },

    render() {
        if (window.isSpecialSelection) {
            if (window.specialSelectionRateRules) {
                this.renderSpecialSelection(window.specialSelectionRateRules, window.specialSelectionBasePrice);
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
        // Se temos rate rules, é uma categoria Mix & Match
        const breadcrumbMmBadge = document.getElementById('breadcrumbMixMatchBadge');

        // Mostrar badge Mix & Match no breadcrumb quando categoria é Mix & Match
        if (breadcrumbMmBadge && this.rateRules.length > 0) {
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

        let relevantItemCount = 0;

        if (window.isSpecialSelection) {
            relevantItemCount = window.CartSystem.state.totalItems;
        } else {
            // ✅ IMPORTANTE: Contar APENAS itens que participam do Mix & Match
            // Mix & Match é exclusivo para fotos únicas de Natural Cowhides
            relevantItemCount = window.CartSystem.state.items.filter(item => {
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

                // Verificar se é uma categoria Mix & Match
                return GLOBAL_MIX_MATCH_CATEGORIES.some(mixCat =>
                    mainCategory.includes(mixCat) || mixCat.includes(mainCategory)
                );
            }).length;
        }

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

        // Atualizar informações para Special Selection
        if (window.isSpecialSelection) {
            const countEl = document.getElementById('selectionCount');
            const priceEl = document.getElementById('currentUnitPrice');

            if (countEl) {
                countEl.textContent = `${relevantItemCount} photos selected`;
            }

            if (priceEl && this.rateRules.length > 0) {
                let currentPrice = this.basePrice;
                for (const rule of this.rateRules) {
                    if (relevantItemCount >= rule.from && relevantItemCount <= rule.to) {
                        currentPrice = rule.price;
                        break;
                    }
                }
                priceEl.textContent = `Unit price: $${currentPrice}`;
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

// ===== SISTEMA DE BUSCA RECONSTRUÍDO COM SUGESTÕES =====
window.handleSearchInput = function (event) {
    const query = event.target.value.trim().toLowerCase();

    if (query.length >= 2) {
        performLiveSearch(query);
        showSearchSuggestions(query);
    } else if (query.length === 0) {
        hideSearchSuggestions();
        window.showCategories();
    }
}

function performLiveSearch(query) {
    console.log('🔍 Buscando por:', query);

    // Buscar nos cards de categoria visíveis
    const cards = document.querySelectorAll('.category-card');
    let visibleCount = 0;

    cards.forEach(card => {
        const title = card.querySelector('h3')?.textContent?.toLowerCase() || '';
        const desc = card.querySelector('p')?.textContent?.toLowerCase() || '';
        const fullText = title + ' ' + desc;

        if (fullText.includes(query)) {
            card.style.display = '';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    // Se não achou nada nos cards visíveis, buscar no cache
    if (visibleCount === 0 && window.CategoriesCache) {
        searchInAllCategories(query);
    }
}

async function searchInAllCategories(query) {
    try {
        const data = await window.CategoriesCache.fetch();
        const categories = data.categories || [];

        const results = categories.filter(cat => {
            const name = (cat.name || '').toLowerCase();
            const displayName = (cat.displayName || '').toLowerCase();
            return name.includes(query) || displayName.includes(query);
        });

        if (results.length > 0) {
            window.displayFilteredCategories(results);
        }
    } catch (error) {
        console.error('Erro na busca:', error);
    }
}

async function showSearchSuggestions(query) {
    try {
        const data = await window.CategoriesCache.fetch();
        const categories = data.categories || [];

        // Filtrar categorias que correspondem à busca
        const results = categories.filter(cat => {
            const name = (cat.name || '').toLowerCase();
            const displayName = (cat.displayName || '').toLowerCase();
            return name.includes(query) || displayName.includes(query);
        }).slice(0, 10); // Limitar a 10 sugestões

        // Criar ou atualizar dropdown
        let dropdown = document.getElementById('searchSuggestionsDropdown');

        if (!dropdown) {
            const searchInput = document.getElementById('globalSearch');
            if (!searchInput) return;

            dropdown = document.createElement('div');
            dropdown.id = 'searchSuggestionsDropdown';
            dropdown.className = 'search-suggestions-dropdown';
            dropdown.style.cssText = `
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: white;
                border: 1px solid #ddd;
                border-radius: 4px;
                max-height: 300px;
                overflow-y: auto;
                z-index: 1000;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                display: none;
            `;
            searchInput.parentElement.style.position = 'relative';
            searchInput.parentElement.appendChild(dropdown);
        }

        if (results.length > 0) {
            let html = '';
            results.forEach(cat => {
                const displayName = cat.displayName || cat.name;
                // Destacar o termo buscado
                const highlighted = displayName.replace(
                    new RegExp(`(${query})`, 'gi'),
                    '<strong>$1</strong>'
                );

                html += `
                    <div class="suggestion-item" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #f0f0f0;"
                         onmouseover="this.style.backgroundColor='#f5f5f5'"
                         onmouseout="this.style.backgroundColor='white'"
                         onclick="selectSuggestion('${(cat.driveId || cat.id).replace(/'/g, "\\'")}', '${displayName.replace(/'/g, "\\'")}')">
                        <div>${highlighted}</div>
                        <small style="color: #666;">${cat.photoCount || 0} photos</small>
                    </div>
                `;
            });

            dropdown.innerHTML = html;
            dropdown.style.display = 'block';
        } else {
            dropdown.innerHTML = `
                <div style="padding: 10px; color: #666;">
                    No results for "${query}"
                </div>
            `;
            dropdown.style.display = 'block';
        }

    } catch (error) {
        console.error('Erro ao mostrar sugestões:', error);
    }
}

function hideSearchSuggestions() {
    const dropdown = document.getElementById('searchSuggestionsDropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
}

window.selectSuggestion = function (categoryId, categoryName) {
    hideSearchSuggestions();

    // Navegar direto para a categoria selecionada
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

window.executeGlobalSearch = function () {
    const searchInput = document.getElementById('globalSearch');
    if (!searchInput) return;

    const query = searchInput.value.trim().toLowerCase();
    if (query.length >= 2) {
        performLiveSearch(query);
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