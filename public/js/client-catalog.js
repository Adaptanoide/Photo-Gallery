/**
 * CLIENT-CATALOG.JS - Sunshine Cowhides
 * ============================================
 * Sistema de catálogo para produtos por quantidade
 * (Designer Rugs, Accessories, Sheepskin, etc.)
 *
 * Diferente das fotos (1 unidade cada), produtos de catálogo
 * são selecionados por tipo + quantidade.
 * NÃO participam do Mix & Match.
 */

// ============================================
// GLOBAL STATE
// ============================================

window.CatalogState = {
    currentTab: 'cowhides',  // cowhides | designer-rugs | accessories
    currentType: 'photo',     // photo | catalog
    products: [],
    isLoading: false,
    lastSync: null
};

// ============================================
// MAIN TAB NAVIGATION
// ============================================

/**
 * Trocar entre as tabs principais (Cowhides | Designer Rugs | Accessories)
 */
window.switchMainTab = async function(tabId, tabType) {
    console.log(`🏷️ Switching to tab: ${tabId} (${tabType})`);

    // Update state
    CatalogState.currentTab = tabId;
    CatalogState.currentType = tabType;

    // Update UI - active tab
    document.querySelectorAll('.main-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    // Hide filters dropdown for catalog views
    const filtersDropdown = document.querySelector('.header-filters-dropdown');
    if (filtersDropdown) {
        filtersDropdown.style.display = tabType === 'catalog' ? 'none' : '';
    }

    if (tabType === 'photo') {
        // Show photo gallery (Cowhides)
        await showPhotoGallery();
    } else {
        // Show catalog products (Designer Rugs, Accessories)
        await showCatalogProducts(tabId);
    }
};

/**
 * Mostrar galeria de fotos (Cowhides)
 */
async function showPhotoGallery() {
    // Hide catalog container
    const catalogContainer = document.getElementById('catalogContainer');
    if (catalogContainer) {
        catalogContainer.style.display = 'none';
        catalogContainer.innerHTML = '';
    }

    // Show photo containers
    const categoriesContainer = document.getElementById('categoriesContainer');
    const foldersContainer = document.getElementById('foldersContainer');
    const photosContainer = document.getElementById('photosContainer');
    const breadcrumbContainer = document.getElementById('breadcrumbContainer');

    if (categoriesContainer) categoriesContainer.style.display = '';
    if (foldersContainer) foldersContainer.style.display = '';
    if (photosContainer) photosContainer.style.display = '';
    if (breadcrumbContainer) breadcrumbContainer.style.display = '';

    // Reset navigation and show categories
    if (window.navigationState) {
        window.navigationState.currentPath = [];
        window.navigationState.currentFolderId = null;
    }

    if (window.showCategories) {
        await window.showCategories();
    }

    if (window.updateBreadcrumb) {
        window.updateBreadcrumb();
    }
}

/**
 * Mostrar produtos de catálogo (Designer Rugs, Accessories)
 */
async function showCatalogProducts(categoryId) {
    // Hide photo containers
    const categoriesContainer = document.getElementById('categoriesContainer');
    const foldersContainer = document.getElementById('foldersContainer');
    const photosContainer = document.getElementById('photosContainer');
    const breadcrumbContainer = document.getElementById('breadcrumbContainer');

    if (categoriesContainer) categoriesContainer.style.display = 'none';
    if (foldersContainer) foldersContainer.style.display = 'none';
    if (photosContainer) photosContainer.style.display = 'none';
    if (breadcrumbContainer) breadcrumbContainer.style.display = 'none';

    // Show catalog container
    const catalogContainer = document.getElementById('catalogContainer');
    if (catalogContainer) {
        catalogContainer.style.display = 'block';
    }

    // Load products from API
    await loadCatalogProducts(categoryId);
}

// ============================================
// CATALOG API CALLS
// ============================================

/**
 * Carregar produtos do catálogo via API
 */
async function loadCatalogProducts(displayCategory) {
    const container = document.getElementById('catalogContainer');
    if (!container) return;

    CatalogState.isLoading = true;

    // Show loading
    container.innerHTML = `
        <div class="catalog-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading products...</p>
        </div>
    `;

    try {
        // Map displayCategory to CDE category
        const categoryMap = {
            'designer-rugs': 'DESIGNER RUG',
            'accessories': 'ACCESORIOS'
        };

        const cdeCategory = categoryMap[displayCategory] || displayCategory;

        const response = await fetchWithAuth(`/api/catalog/products?category=${encodeURIComponent(displayCategory)}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Error loading products');
        }

        CatalogState.products = data.products || [];
        CatalogState.lastSync = new Date();

        console.log(`📦 Loaded ${CatalogState.products.length} catalog products`);

        renderCatalogProducts(container);

    } catch (error) {
        console.error('❌ Error loading catalog products:', error);
        container.innerHTML = `
            <div class="catalog-empty">
                <i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i>
                <h3>Error Loading Products</h3>
                <p>${error.message || 'An error occurred. Please try again.'}</p>
                <button onclick="switchMainTab('${displayCategory}', 'catalog')"
                        style="margin-top: 15px; padding: 10px 20px; background: var(--gold-primary); color: #fff; border: none; border-radius: 8px; cursor: pointer;">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;
    } finally {
        CatalogState.isLoading = false;
    }
}

/**
 * Renderizar produtos no grid
 */
function renderCatalogProducts(container) {
    if (CatalogState.products.length === 0) {
        container.innerHTML = `
            <div class="catalog-empty">
                <i class="fas fa-box-open"></i>
                <h3>No Products Available</h3>
                <p>There are no products in this category at the moment. Please check back later.</p>
            </div>
        `;
        return;
    }

    const showPrices = window.shouldShowPrices ? window.shouldShowPrices() : true;

    let html = '<div class="catalog-grid">';

    CatalogState.products.forEach(product => {
        html += renderProductCard(product, showPrices);
    });

    html += '</div>';

    container.innerHTML = html;

    // Setup event listeners
    setupCatalogListeners();
}

/**
 * Renderizar card de produto individual
 */
function renderProductCard(product, showPrices = true) {
    const stock = product.currentStock || product.stock || 0;
    const isLowStock = stock > 0 && stock <= 5;
    const isOutOfStock = stock <= 0;

    // Stock badge
    let stockBadgeClass = 'in-stock';
    let stockBadgeText = `${stock} in stock`;
    if (isOutOfStock) {
        stockBadgeClass = 'out-of-stock';
        stockBadgeText = 'Out of Stock';
    } else if (isLowStock) {
        stockBadgeClass = 'low-stock';
        stockBadgeText = `Only ${stock}`;
    }

    // Price display
    let priceHtml = '';
    if (showPrices && product.basePrice > 0) {
        const formatted = window.CurrencyManager
            ? CurrencyManager.format(product.basePrice)
            : `$${product.basePrice.toFixed(2)}`;
        priceHtml = `<div class="catalog-price">${formatted}</div>`;
    } else {
        priceHtml = `<div class="catalog-price contact"><i class="fas fa-phone"></i> Contact for Price</div>`;
    }

    // Placeholder icon based on category
    const iconMap = {
        'DESIGNER RUG': 'fa-rug',
        'ACCESORIOS': 'fa-gem',
        'SHEEPSKIN': 'fa-cloud',
        'SMALL HIDES': 'fa-cow',
        'PILLOW': 'fa-couch',
        'RODEO RUG': 'fa-star'
    };
    const icon = iconMap[product.category] || 'fa-box';

    // Check if in cart
    const inCart = isProductInCart(product.qbItem);
    const cartQty = getProductCartQuantity(product.qbItem);

    return `
        <div class="catalog-card ${isOutOfStock ? 'out-of-stock' : ''}"
             data-qbitem="${product.qbItem}"
             data-stock="${stock}">

            <div class="catalog-image">
                ${product.imageUrl
                    ? `<img src="${product.imageUrl}" alt="${product.name}" loading="lazy">`
                    : `<div class="catalog-placeholder">
                         <i class="fas ${icon}"></i>
                         <span>${product.category || 'Product'}</span>
                       </div>`
                }
                <span class="catalog-stock-badge ${stockBadgeClass}">${stockBadgeText}</span>
            </div>

            <div class="catalog-info">
                <h4 class="catalog-name" title="${product.name}">${product.name || product.qbItem}</h4>
                <div class="catalog-category">
                    <i class="fas fa-tag"></i>
                    <span>${product.category || 'General'}</span>
                </div>
                ${product.origin ? `
                    <div class="catalog-stock-info">
                        <i class="fas fa-globe-americas"></i>
                        <span>Origin: ${product.origin}</span>
                    </div>
                ` : ''}
                ${priceHtml}
                ${!isOutOfStock ? `
                    <div class="catalog-stock-info ${isLowStock ? 'low' : ''}">
                        <i class="fas fa-boxes"></i>
                        <span>${stock} available</span>
                    </div>
                ` : ''}
            </div>

            <div class="catalog-actions">
                ${!isOutOfStock ? `
                    <div class="qty-selector">
                        <button class="qty-btn" onclick="adjustCatalogQty('${product.qbItem}', -1)" ${cartQty <= 1 ? 'disabled' : ''}>
                            <i class="fas fa-minus"></i>
                        </button>
                        <span class="qty-value" id="qty-${product.qbItem}">${cartQty || 1}</span>
                        <button class="qty-btn" onclick="adjustCatalogQty('${product.qbItem}', 1)" ${(cartQty || 1) >= stock ? 'disabled' : ''}>
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <button class="btn-add-catalog ${inCart ? 'in-cart' : ''}"
                            onclick="addCatalogToCart('${product.qbItem}')"
                            data-qbitem="${product.qbItem}"
                            data-name="${product.name || ''}"
                            data-price="${product.basePrice || 0}"
                            data-category="${product.category || ''}"
                            data-stock="${stock}">
                        <i class="fas ${inCart ? 'fa-check' : 'fa-cart-plus'}"></i>
                        <span>${inCart ? `In Cart (${cartQty})` : 'Add to Cart'}</span>
                    </button>
                ` : `
                    <button class="btn-add-catalog" disabled>
                        <i class="fas fa-ban"></i>
                        <span>Out of Stock</span>
                    </button>
                `}
            </div>
        </div>
    `;
}

// ============================================
// QUANTITY & CART FUNCTIONS
// ============================================

/**
 * Ajustar quantidade no card
 */
window.adjustCatalogQty = function(qbItem, delta) {
    const qtyElement = document.getElementById(`qty-${qbItem}`);
    const card = document.querySelector(`.catalog-card[data-qbitem="${qbItem}"]`);
    if (!qtyElement || !card) return;

    const maxStock = parseInt(card.dataset.stock) || 999;
    let currentQty = parseInt(qtyElement.textContent) || 1;
    let newQty = currentQty + delta;

    newQty = Math.max(1, Math.min(newQty, maxStock));
    qtyElement.textContent = newQty;

    // Update button states
    const minusBtn = card.querySelector('.qty-btn:first-child');
    const plusBtn = card.querySelector('.qty-btn:last-child');

    if (minusBtn) minusBtn.disabled = newQty <= 1;
    if (plusBtn) plusBtn.disabled = newQty >= maxStock;
};

/**
 * Adicionar produto de catálogo ao carrinho
 */
window.addCatalogToCart = async function(qbItem) {
    const card = document.querySelector(`.catalog-card[data-qbitem="${qbItem}"]`);
    const btn = card?.querySelector('.btn-add-catalog');
    if (!card || !btn) return;

    const qtyElement = document.getElementById(`qty-${qbItem}`);
    const quantity = parseInt(qtyElement?.textContent) || 1;

    const productName = btn.dataset.name;
    const unitPrice = parseFloat(btn.dataset.price) || 0;
    const category = btn.dataset.category;

    // Disable button
    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Adding...</span>';

    try {
        const clientSession = getClientSession();
        if (!clientSession) {
            throw new Error('Session not found');
        }

        const response = await fetch('/api/cart/add-catalog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: window.CartSystem?.state?.sessionId,
                clientCode: clientSession.accessCode,
                clientName: clientSession.user?.name || 'Client',
                qbItem,
                productName,
                quantity,
                unitPrice,
                category
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Error adding to cart');
        }

        // Update button
        btn.classList.add('in-cart');
        btn.innerHTML = `<i class="fas fa-check"></i> <span>In Cart (${quantity})</span>`;

        // Refresh cart
        if (window.CartSystem) {
            await CartSystem.loadCart();
        }

        // Show notification
        if (window.showNotification) {
            showNotification(`${productName} added to cart`, 'success');
        }

    } catch (error) {
        console.error('❌ Error adding to cart:', error);
        btn.innerHTML = originalHtml;

        if (window.showNotification) {
            showNotification(error.message || 'Error adding to cart', 'error');
        }
    } finally {
        btn.disabled = false;
    }
};

/**
 * Verificar se produto está no carrinho
 */
function isProductInCart(qbItem) {
    if (!window.CartSystem?.state?.items) return false;
    return CartSystem.state.items.some(item =>
        item.isCatalogProduct && item.qbItem === qbItem
    );
}

/**
 * Obter quantidade do produto no carrinho
 */
function getProductCartQuantity(qbItem) {
    if (!window.CartSystem?.state?.items) return 0;
    const item = CartSystem.state.items.find(i =>
        i.isCatalogProduct && i.qbItem === qbItem
    );
    return item ? item.quantity : 0;
}

/**
 * Obter sessão do cliente
 */
function getClientSession() {
    const saved = localStorage.getItem('sunshineSession');
    return saved ? JSON.parse(saved) : null;
}

// ============================================
// SEARCH EXPAND/COLLAPSE
// ============================================

/**
 * Toggle da barra de pesquisa compacta
 */
window.toggleSearchExpand = function() {
    const container = document.querySelector('.search-container.compact');
    if (!container) return;

    container.classList.toggle('expanded');

    if (container.classList.contains('expanded')) {
        const input = container.querySelector('.search-input');
        if (input) {
            setTimeout(() => input.focus(), 300);
        }
    }
};

// Close search on click outside
document.addEventListener('click', (e) => {
    const container = document.querySelector('.search-container.compact.expanded');
    if (container && !container.contains(e.target)) {
        container.classList.remove('expanded');
    }
});

// ============================================
// EVENT LISTENERS
// ============================================

function setupCatalogListeners() {
    // Listen for cart updates
    window.addEventListener('cartUpdated', updateCatalogCartButtons);
}

function updateCatalogCartButtons() {
    document.querySelectorAll('.catalog-card .btn-add-catalog').forEach(btn => {
        const qbItem = btn.dataset.qbitem;
        if (!qbItem) return;

        const inCart = isProductInCart(qbItem);
        const qty = getProductCartQuantity(qbItem);

        btn.classList.toggle('in-cart', inCart);

        if (inCart) {
            btn.innerHTML = `<i class="fas fa-check"></i> <span>In Cart (${qty})</span>`;
        } else {
            btn.innerHTML = `<i class="fas fa-cart-plus"></i> <span>Add to Cart</span>`;
        }
    });
}

// ============================================
// CURRENCY CHANGE LISTENER
// ============================================

window.addEventListener('currencyChanged', () => {
    console.log('💱 [Catalog] Currency changed, re-rendering...');
    if (CatalogState.currentType === 'catalog' && CatalogState.products.length > 0) {
        const container = document.getElementById('catalogContainer');
        if (container) {
            renderCatalogProducts(container);
        }
    }
});

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('📦 client-catalog.js loaded');

    // Setup event listeners
    setupCatalogListeners();
});

console.log('📦 Catalog system initialized');
