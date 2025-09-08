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

            // Buscar preço da categoria
            const currentFolderId = navigationState.currentFolderId;
            let priceInfo = { hasPrice: false, basePrice: 0, price: 0, formattedPrice: 'No price' };

            if (currentFolderId && window.loadCategoryPrice) {
                try {
                    priceInfo = await window.loadCategoryPrice(currentFolderId);
                } catch (error) {
                    console.warn('Erro ao buscar preço:', error);
                }
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
                price: priceInfo.price,
                formattedPrice: priceInfo.formattedPrice,
                hasPrice: priceInfo.hasPrice
            };

            await CartSystem.addItem(photoId, itemData);
            button.classList.add('in-cart');
            button.innerHTML = '<i class="fas fa-check"></i><span>Remove</span>';
        }

        // Atualizar badge de preço
        if (window.updateCategoryPriceBadge) {
            setTimeout(() => window.updateCategoryPriceBadge(), 100);
        }

    } catch (error) {
        console.error('Erro ao gerenciar carrinho:', error);
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
        button.innerHTML = '<i class="fas fa-check"></i><span>Remove</span>';
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

window.clearAllFilters = function () {
    window.activeFilters = {
        type: [],
        tone: [],
        size: [],
        price: { min: null, max: null }
    };

    document.querySelectorAll('#filterSidebar input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });

    const priceMin = document.getElementById('priceMin');
    const priceMax = document.getElementById('priceMax');
    if (priceMin) priceMin.value = '';
    if (priceMax) priceMax.value = '';

    applyFilters();
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
                <button onclick="clearAllFilters(); applyFilters();" class="btn btn-primary">Clear Filters</button>
            </div>
        `;
        return;
    }

    // Renderizar categorias filtradas
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
        const thumbnail = window.categoryThumbnails && window.categoryThumbnails[cleanName];

        categoryCard.className = thumbnail ? 'category-card folder-card has-thumbnail' : 'category-card';
        categoryCard.innerHTML = thumbnail ? `
            <div class="category-thumbnail">
                <img src="https://images.sunshinecowhides-gallery.com/category-thumbnails/${thumbnail}" 
                    alt="${cleanName}" loading="lazy" />
                ${category.formattedPrice ? `<span class="price-corner">${category.formattedPrice}</span>` : ''}
                <span class="sample-badge">Sample Photo</span>
            </div>
            <div class="card-footer-info">
                <h4>${window.cleanName(cleanName)}</h4>
            </div>
        ` : `
            <h3>${cleanName}</h3>
            <p class="category-path">${displayName}</p>
            <div class="folder-stats">
                ${window.shouldShowPrices() && category.formattedPrice ?
            `<span class="folder-price-badge"><i class="fas fa-tag"></i> ${category.formattedPrice}</span>` : ''}
            </div>
        `;

        container.appendChild(categoryCard);
    });

    container.style.display = 'grid';
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

// Função clearAllFilters corrigida
window.clearAllFilters = function () {
    // Desmarcar radio buttons
    document.querySelectorAll('input[name="typePattern"]').forEach(rb => {
        rb.checked = false;
    });

    // Desmarcar checkboxes de preço
    document.querySelectorAll('#priceFilters input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    // Voltar para categorias principais
    window.showCategories();
}

console.log('🛍️ client-commerce.js carregado - Módulo comercial pronto');