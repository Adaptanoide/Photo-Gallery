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

// ===== FILTROS DINÂMICOS BASEADOS NO ACESSO =====
window.setupDynamicFilters = async function () {
    console.log('🔍 Configurando filtros dinâmicos...');

    try {
        // Buscar categorias que o cliente tem acesso
        const data = await window.CategoriesCache.fetch();
        const categories = data.categories || [];

        // Analisar quais tipos existem nas categorias permitidas
        const availableTypes = new Set();

        categories.forEach(cat => {
            const name = (cat.name || '').toLowerCase();

            // Detectar tipos presentes
            if (name.includes('brindle')) availableTypes.add('brindle');
            if (name.includes('black') && name.includes('white')) availableTypes.add('black-white');
            if (name.includes('brown') && name.includes('white')) availableTypes.add('brown-white');
            if (name.includes('salt') || name.includes('pepper')) availableTypes.add('salt-pepper');
            if (name.includes('tricolor')) availableTypes.add('tricolor');
            if (name.includes('grey')) availableTypes.add('brindle-grey');
            if (name.includes('backbone')) availableTypes.add('brindle-white-backbone');
            if (name.includes('belly')) availableTypes.add('brindle-white-belly');
            if (name.includes('exotic')) availableTypes.add('exotic');
        });

        console.log('✅ Tipos disponíveis:', Array.from(availableTypes));

        // Ocultar radio buttons que não se aplicam
        document.querySelectorAll('input[name="typePattern"]').forEach(radio => {
            const value = radio.value;
            const label = radio.parentElement;

            // Sempre mostrar "All Types"
            if (value === '' || value === 'all') {
                label.style.display = '';
                return;
            }

            // Mapear valores para tipos detectados
            const typeMap = {
                'black-white': 'black-white',
                'brindle': 'brindle',
                'brindle-grey': 'brindle-grey',
                'brindle-white-backbone': 'brindle-white-backbone',
                'brindle-white-belly': 'brindle-white-belly',
                'brown-white': 'brown-white',
                'salt-pepper': 'salt-pepper',
                'tricolor': 'tricolor'
            };

            // Mostrar/Ocultar baseado no que existe
            if (availableTypes.has(typeMap[value])) {
                label.style.display = '';
            } else {
                label.style.display = 'none';
            }
        });

        // Contar quantos filtros estão visíveis
        const visibleFilters = document.querySelectorAll('input[name="typePattern"]:not([value=""]):not([style*="display: none"])').length;
        console.log(`📊 ${visibleFilters} filtros visíveis de tipo`);

    } catch (error) {
        console.error('Erro configurando filtros dinâmicos:', error);
    }
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
                console.log('💰 [THUMBNAIL] Usando customPrice:', photo.customPrice);
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

// ===== PRICE PROGRESS BAR =====
window.PriceProgressBar = {
    currentCategoryId: null,
    rateRules: [],
    basePrice: 0,

    init(categoryId) {
        this.currentCategoryId = categoryId;
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

            if (data.success && data.data.ranges) {
                this.rateRules = data.data.ranges.map(range => ({
                    from: range.min,
                    to: range.max || 999,
                    price: range.price
                }));
                this.basePrice = data.data.ranges[0]?.price || 0;
            }
        } catch (error) {
            console.error('Erro ao carregar rate rules:', error);
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
            return;
        }

        if (this.rateRules.length === 0) {
            priceBarContainer.style.display = 'none';
            return;
        }

        // HTML normal
        let html = '<div class="price-progress-wrapper">';

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

        html += '</div>';
        priceBarContainer.innerHTML = html;
        priceBarContainer.style.display = 'block';
    },

    updateProgress() {
        if (!window.CartSystem || !window.CartSystem.state) return;

        let relevantItemCount = 0;

        if (window.isSpecialSelection) {
            relevantItemCount = window.CartSystem.state.totalItems;
        } else {
            let currentCategoryName = null;
            if (window.navigationState && window.navigationState.currentPath && window.navigationState.currentPath.length > 0) {
                const lastPath = window.navigationState.currentPath[window.navigationState.currentPath.length - 1];
                currentCategoryName = lastPath.name;
            }

            // Contar TODOS os itens do carrinho (global)
            relevantItemCount = window.CartSystem.state.totalItems;
        }

        // Atualizar tiers
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
        const activeTier = document.querySelector('.price-tier.active');
        if (activeTier) {
            // Extrair preço do tier ativo
            const priceText = activeTier.querySelector('.tier-price')?.textContent || activeTier.textContent;
            const priceMatch = priceText.match(/\$(\d+)/);

            if (priceMatch) {
                const currentPrice = priceMatch[0]; // $109, $105, etc

                // Atualizar info bar
                const infoBadge = document.getElementById('infoPriceBadge');
                if (infoBadge && !infoBadge.classList.contains('no-price')) {
                    infoBadge.textContent = `${currentPrice}/each`;
                }

                // Atualizar modal se estiver aberto
                const modalBadge = document.querySelector('.modal-price-badge');
                if (modalBadge && !modalBadge.classList.contains('contact-price')) {
                    modalBadge.textContent = `${currentPrice}/each`;
                }

                // ADICIONAR PARA DESKTOP - Atualizar título da galeria
                const galleryBadge = document.querySelector('.gallery-header .category-price-badge');
                if (galleryBadge && !galleryBadge.classList.contains('no-price')) {
                    galleryBadge.textContent = `${currentPrice}/each`;
                }
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
    console.log('💰 Client Commerce carregado');

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
    console.log('🔍 Aplicando filtros automaticamente...');

    // Limpar fotos antigas
    const photosGrid = document.getElementById('photosGrid');
    if (photosGrid) {
        photosGrid.innerHTML = '';
    }

    const photosContainer = document.getElementById('photosContainer');
    if (photosContainer) {
        photosContainer.style.display = 'none';
    }

    const categoriesContainer = document.getElementById('categoriesContainer');
    if (categoriesContainer) {
        categoriesContainer.style.display = 'grid';
    }

    const breadcrumbContainer = document.getElementById('breadcrumbContainer');
    if (breadcrumbContainer) {
        breadcrumbContainer.style.display = 'none';
    }

    // Coletar filtros selecionados
    const selectedFilters = {
        types: [],
        prices: []
    };

    // Type/Pattern
    document.querySelectorAll('input[name="typePattern"]:checked').forEach(cb => {
        selectedFilters.types.push(cb.value);
    });

    // Price ranges
    document.querySelectorAll('#priceFilters input[type="checkbox"]:checked').forEach(cb => {
        selectedFilters.prices.push(cb.value);
    });

    console.log('📌 Filtros selecionados:', selectedFilters);

    try {
        // Buscar todas as categorias
        const data = await window.CategoriesCache.fetch();
        let filteredCategories = data.categories || [];

        // Aplicar filtros de tipo
        if (selectedFilters.types.length > 0) {
            filteredCategories = filteredCategories.filter(category => {
                const catName = (category.name || '').toLowerCase();
                return selectedFilters.types.some(type => {
                    if (type === 'salt-pepper') {
                        return catName.includes('salt') || catName.includes('pepper');
                    }
                    if (type === 'black-white') {
                        return catName.includes('black') && catName.includes('white');
                    }
                    if (type === 'brown-white') {
                        // Procurar por "brown & white" OU "brown and white"
                        return (catName.includes('brown & white') || catName.includes('brown and white'));
                    }
                    if (type === 'light tones') {
                        return catName.includes('light tones') || catName.includes('light');
                    }
                    if (type === 'dark tones') {
                        return catName.includes('dark tones') || catName.includes('dark');
                    }
                    // Para todos os outros, buscar exatamente como está
                    return catName.includes(type);
                });
            });
        }

        // Aplicar filtros de preço
        if (selectedFilters.prices.length > 0 && window.shouldShowPrices()) {
            filteredCategories = filteredCategories.filter(category => {
                const price = category.price || 0;
                return selectedFilters.prices.some(range => {
                    const [min, max] = range.split('-').map(Number);
                    return price >= min && price <= (max || 999999);
                });
            });
        }

        console.log(`✅ ${filteredCategories.length} categorias após filtros`);
        displayFilteredCategories(filteredCategories);

    } catch (error) {
        console.error('Erro ao aplicar filtros:', error);
    }
}

// ===== ESCONDER FILTROS SEM PERMISSÃO =====
window.updateFilterVisibility = async function () {
    console.log('🔒 Verificando filtros disponíveis para o cliente...');

    try {
        // Buscar categorias permitidas - JÁ VEM FILTRADAS DO BACKEND!
        const data = await window.CategoriesCache.fetch();
        const allowedCategories = data.categories || [];

        // Verificar quais tipos existem
        const availableTypes = new Set();

        allowedCategories.forEach(category => {
            const catName = (category.name || '').toLowerCase();

            if (catName.includes('brindle')) availableTypes.add('brindle');
            if (catName.includes('salt') || catName.includes('pepper')) availableTypes.add('salt-pepper');
            if (catName.includes('black') && catName.includes('white')) availableTypes.add('black-white');
            if (catName.includes('tricolor')) availableTypes.add('tricolor');
            if (catName.includes('exotic')) availableTypes.add('exotic');
        });

        console.log('✅ Tipos disponíveis para este cliente:', Array.from(availableTypes));

        // Por enquanto, não esconder nada - apenas logar
        // Podemos implementar isso depois se necessário

    } catch (error) {
        console.error('Erro ao verificar filtros:', error);
    }
}

window.displayFilteredCategories = function (categories) {
    const container = document.getElementById('categoriesContainer');
    if (!container) return;

    // Mostrar breadcrumb
    document.getElementById('breadcrumbContainer').style.display = 'block';
    document.getElementById('backNavigation').style.display = 'none';

    // Atualizar breadcrumb
    const breadcrumbPath = document.getElementById('breadcrumbPath');
    if (breadcrumbPath) {
        breadcrumbPath.innerHTML = `
            <span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>
            <span class="breadcrumb-item current">Filtered Results (${categories.length})</span>
        `;
    }

    // Limpar container
    container.innerHTML = '';

    if (categories.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <i class="fas fa-search fa-3x" style="color: #ccc; margin-bottom: 20px;"></i>
                <h3>No categories found</h3>
                <p>Try adjusting your filters</p>
                <button onclick="clearAllFilters(); window.showCategories();" class="btn btn-primary">Clear Filters</button>
            </div>
        `;
        return;
    }

    // Renderizar categorias filtradas - SEMPRE COMO CARDS COM DESCRIÇÃO
    categories.forEach(category => {
        const categoryCard = document.createElement('div');
        categoryCard.className = 'category-card';
        categoryCard.onclick = () => {
            // Navegar para a categoria
            const categoryId = category.driveId || category.id;
            const categoryName = category.displayName || category.name;

            // Construir path navegável
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
        };

        const displayName = category.displayName || category.name;
        const cleanName = displayName.split(' → ').pop();

        // Gerar descrição baseada no nome da categoria
        const description = generateCategoryDescription(cleanName);

        // IMPORTANTE: Sempre mostrar cards SEM thumbnails e SEM preços
        categoryCard.innerHTML = `
            <h3>${cleanName}</h3>
            <p>${description}</p>
            <div class="folder-stats">
                <span class="contact-price">
                    <i class="fas fa-phone"></i> Contact for Price
                </span>
            </div>
        `;

        container.appendChild(categoryCard);
    });

    container.style.display = 'grid';
}

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
    // Resetar o objeto de filtros ativos
    window.activeFilters = {
        type: [],
        tone: [],
        size: [],
        price: { min: null, max: null }
    };

    // Desmarcar radio buttons
    document.querySelectorAll('input[name="typePattern"]').forEach(rb => {
        rb.checked = false;
    });

    // Marcar "All Types" como selecionado
    const allTypesRadio = document.querySelector('input[name="typePattern"][value=""]');
    if (allTypesRadio) {
        allTypesRadio.checked = true;
    }

    // Desmarcar checkboxes do sidebar
    document.querySelectorAll('#filterSidebar input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });

    // Limpar campos de preço
    const priceMin = document.getElementById('priceMin');
    const priceMax = document.getElementById('priceMax');
    if (priceMin) priceMin.value = '';
    if (priceMax) priceMax.value = '';

    // NOVO: Fechar o dropdown após limpar
    const dropdown = document.getElementById('filtersDropdown');
    const button = document.querySelector('.header-filters-btn');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
    if (button) {
        button.classList.remove('active');
    }

    // Voltar para categorias principais
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

console.log('🛍️ client-commerce.js carregado - Módulo comercial pronto');