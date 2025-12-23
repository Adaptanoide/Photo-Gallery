/**
 * CLIENT-CATALOG.JS - Sunshine Cowhides
 * ============================================
 * Sistema de navegação e catálogo com Homepage e Categorias
 */

// ============================================
// THUMBNAIL URL HELPER
// ============================================
// Em produção usa R2, em desenvolvimento usa local
const THUMBNAIL_CONFIG = {
    // Detecta produção pelo hostname
    isProduction: () => !window.location.hostname.includes('localhost') &&
                        !window.location.hostname.includes('127.0.0.1'),

    // URL base do R2 para thumbnails
    r2BaseUrl: 'https://images.sunshinecowhides-gallery.com/catalog-thumbnails',

    // URL base local
    localBaseUrl: '/images/thumbnailsCards'
};

/**
 * Gera URL de thumbnail - usa R2 em produção, local em dev
 * @param {string} imageName - Nome da imagem (com ou sem .png)
 */
function getThumbnailUrl(imageName) {
    // Garantir que tem extensão .png
    const fileName = imageName.endsWith('.png') ? imageName : `${imageName}.png`;

    if (THUMBNAIL_CONFIG.isProduction()) {
        // Em produção: URL do R2 com encoding
        return `${THUMBNAIL_CONFIG.r2BaseUrl}/${encodeURIComponent(fileName)}`;
    } else {
        // Em desenvolvimento: URL local
        return `${THUMBNAIL_CONFIG.localBaseUrl}/${fileName}`;
    }
}

/**
 * Processa URL de thumbnail de categoria
 * Converte path local para R2 em produção
 * @param {string} localPath - Ex: '/images/thumbnailsCards/Natural Cowhides.png'
 */
function processCategoryThumbnail(localPath) {
    if (!localPath) return '';

    if (THUMBNAIL_CONFIG.isProduction()) {
        // Extrair nome do arquivo do path local
        const fileName = localPath.split('/').pop();
        return `${THUMBNAIL_CONFIG.r2BaseUrl}/${encodeURIComponent(fileName)}`;
    }

    // Em dev, retorna o path local original
    return localPath;
}

// ============================================
// CATEGORY STRUCTURE
// ============================================

const MAIN_CATEGORIES = {
    'natural-cowhides': {
        name: 'Natural Cowhides',
        icon: 'fa-cow',
        description: 'Premium quality natural cowhide rugs from Brazil and Colombia',
        image: '/images/categories/natural-cowhides.jpg',
        thumbnail: '/images/thumbnailsCards/Natural Cowhides.png',
        hasSubcategories: true,
        subcategories: {
            'brazil-best-sellers': {
                name: 'Brazil Best Sellers',
                description: 'Best value products with excellent cost-benefit ratio',
                viewType: 'photo',
                folderPath: 'Brazil Best Sellers',  // Pasta real no R2
                thumbnail: '/images/thumbnailsCards/Brazil Best Sallers.png',
                hasMixMatch: true  // Indica que tem Mix & Match disponível
            },
            'brazil-top-categories': {
                name: 'Brazil Top Selected Categories',
                description: 'Premium selection of high-quality Brazilian leathers',
                viewType: 'photo',
                folderPath: 'Brazil Top Selected Categories',  // Pasta real no R2
                thumbnail: '/images/thumbnailsCards/Brazil Top Selected.png'
            },
            'colombian-cowhides': {
                name: 'Colombian Cowhides',
                description: 'Exotic tricolor patterns and unique combinations',
                viewType: 'photo',
                folderPath: 'Colombian Cowhides',  // Pasta real no R2
                thumbnail: '/images/thumbnailsCards/Colombian Cowhides.png'
            }
        }
    },
    'specialty-cowhides': {
        name: 'Specialty Cowhides',
        icon: 'fa-paint-brush',
        description: 'Unique printed, metallic and dyed cowhide designs',
        image: '/images/categories/specialty-cowhides.jpg',
        thumbnail: '/images/thumbnailsCards/Special.png',
        hasSubcategories: true,
        subcategories: {
            'cowhide-with-binding': {
                name: 'Cowhide with Leather Binding',
                description: 'Premium cowhides with leather binding and lining',
                viewType: 'photo',
                folderPath: 'Cowhide Hair On BRA With Leather Binding And Lined',
                thumbnail: '/images/thumbnailsCards/borda subcard.png'
            },
            'printed-cowhides': {
                name: 'Printed Cowhides',
                description: 'Stylish printed patterns and stenciled designs',
                viewType: 'stock',
                catalogCategory: 'printed',
                thumbnail: '/images/thumbnailsCards/printed subcard.png'
            },
            'devore-metallic': {
                name: 'Devore Metallic Cowhides',
                description: 'Elegant devore and metallic finish cowhides',
                viewType: 'stock',
                catalogCategory: 'metallic',
                thumbnail: '/images/thumbnailsCards/Devore subcard.png'
            },
            'dyed-cowhides': {
                name: 'Dyed Cowhides',
                description: 'Solid color dyed cowhides in various shades',
                viewType: 'stock',
                catalogCategory: 'dyed',
                thumbnail: '/images/thumbnailsCards/dyed subcard.png'
            }
        }
    },
    'small-accent-hides': {
        name: 'Small Accent Hides',
        icon: 'fa-feather',
        description: 'Sheepskins, calfskins and other small accent pieces',
        image: '/images/categories/small-hides.jpg',
        thumbnail: '/images/thumbnailsCards/Small hides card principal.png',
        hasSubcategories: true,
        subcategories: {
            'sheepskins': {
                name: 'Sheepskins',
                description: 'Luxurious sheepskin rugs - Browse unique photos or order from stock',
                viewType: 'mixed',
                folderPath: 'Sheepskins',
                catalogCategory: 'sheepskin',
                thumbnail: '/images/thumbnailsCards/sheepskin subcard.png'
            },
            'calfskins': {
                name: 'Calfskins',
                description: 'Small and delicate calf leathers - Order from stock',
                viewType: 'stock',
                catalogCategory: 'calfskin',
                thumbnail: '/images/thumbnailsCards/Calfskins subcard.png'
            },
            'goatskins': {
                name: 'Goatskins',
                description: 'Natural goatskin hides in various sizes and tones',
                viewType: 'stock',
                catalogCategory: 'goatskin',
                thumbnail: '/images/thumbnailsCards/Goatskins subcard.png'
            }
        }
    },
    'patchwork-rugs': {
        name: 'Patchwork Rugs',
        icon: 'fa-puzzle-piece',
        description: 'Handcrafted patchwork and designer rugs',
        image: '/images/categories/patchwork-rugs.jpg',
        thumbnail: '/images/thumbnailsCards/patchwork card princial.png',
        hasSubcategories: true,
        subcategories: {
            'chevron-rugs': {
                name: 'Chevron Rugs',
                description: 'Beautiful chevron pattern rugs in various sizes',
                viewType: 'stock',
                catalogCategory: 'chevron-rugs',
                thumbnail: '/images/thumbnailsCards/chevron designer subcard.png'
            },
            'square-rugs': {
                name: 'Square Rugs',
                description: 'Classic patchwork rugs - 3X5, 4X6, 6X8 and 9X11 sizes',
                viewType: 'stock',
                catalogCategory: 'standard-patchwork',
                thumbnail: '/images/thumbnailsCards/Squade designer subcard.png'
            },
            'runner-rugs': {
                name: 'Runner Rugs',
                description: 'Long runner rugs 2.5X8 for hallways and spaces',
                viewType: 'stock',
                catalogCategory: 'runner-rugs',
                thumbnail: '/images/thumbnailsCards/Runners subcard.png'
            },
            'bedside-rugs': {
                name: 'Bedside Rugs',
                description: 'Small 22X34 rugs perfect for bedside placement',
                viewType: 'stock',
                catalogCategory: 'bedside-rugs',
                thumbnail: '/images/thumbnailsCards/bedside subcard.png'
            },
            'rodeo-rugs': {
                name: 'Rodeo Rugs',
                description: 'Handcrafted rodeo rugs with star and longhorn designs',
                viewType: 'photo',
                folderPath: 'Rodeo Rugs',
                thumbnail: '/images/thumbnailsCards/Rodeo Rugs subcard.png'
            }
        }
    },
    'accessories': {
        name: 'Accessories',
        icon: 'fa-shopping-bag',
        description: 'Pillows, bags and leather accessories',
        image: '/images/categories/accessories.jpg',
        thumbnail: '/images/thumbnailsCards/Acessories card principal.png',
        hasSubcategories: true,
        subcategories: {
            'pillows': {
                name: 'Pillows',
                description: 'Cowhide hair on pillows - Multiple sizes available',
                viewType: 'stock',
                catalogCategory: 'pillows',
                thumbnail: '/images/thumbnailsCards/Pillows subcard.png'
            },
            'bags-purses': {
                name: 'Bags & Purses',
                description: 'Handbags, crossbody bags and shoulder bags',
                viewType: 'stock',
                catalogCategory: 'bags-purses',
                thumbnail: '/images/thumbnailsCards/Hangbags subcard.png'
            },
            'table-kitchen': {
                name: 'Table & Kitchen',
                description: 'Coasters, place mats, napkin rings, koozies and wine accessories',
                viewType: 'stock',
                catalogCategory: 'table-kitchen',
                thumbnail: '/images/thumbnailsCards/Coaster subcard.png'
            },
            'slippers': {
                name: 'Slippers',
                description: 'Classic shearling slippers - Multiple sizes',
                viewType: 'stock',
                catalogCategory: 'slippers',
                thumbnail: '/images/thumbnailsCards/spleeper subcard.png'
            },
            'scraps-diy': {
                name: 'Scraps & DIY',
                description: 'Cowhide scraps for crafts and DIY projects',
                viewType: 'stock',
                catalogCategory: 'scraps-diy',
                thumbnail: '/images/thumbnailsCards/Scraps subcard.png'
            },
            'gifts-seasonal': {
                name: 'Gifts & Seasonal',
                description: 'Holiday stockings, gift items and seasonal accessories',
                viewType: 'stock',
                catalogCategory: 'gifts-seasonal',
                thumbnail: '/images/thumbnailsCards/Stocking.png'
            }
        }
    },
    'furniture': {
        name: 'Furniture',
        icon: 'fa-couch',
        description: 'Leather furniture and home decor',
        image: '/images/categories/furniture.jpg',
        thumbnail: '/images/thumbnailsCards/Forniture card principal.png',
        hasSubcategories: true,
        subcategories: {
            'pouf-ottoman': {
                name: 'Pouf / Ottoman',
                description: 'Cowhide poufs and ottomans - Hair on cowhide cubes',
                viewType: 'stock',
                catalogCategory: 'pouf-ottoman',
                thumbnail: '/images/thumbnailsCards/Pouf subcard.png'
            },
            'leather-furniture': {
                name: 'Leather Furniture',
                description: 'Leather chairs with cowhide accents - Custom order available',
                viewType: 'stock',
                catalogCategory: 'leather-furniture',
                thumbnail: '/images/thumbnailsCards/Foniture subcard.png'
            },
            'foot-stool': {
                name: 'Foot Stool',
                description: 'Cowhide footstools with wooden legs',
                viewType: 'stock',
                catalogCategory: 'foot-stool',
                hidden: true  // Hidden until we confirm CDE inventory
            }
        }
    }
};

// ============================================
// PRODUCT EXCLUSIONS BY CATEGORY
// Products that should NOT appear in certain categories
// ============================================
const CATEGORY_EXCLUSIONS = {
    'printed': [
        'Calfskin Hair On Printed Baby Zebra',
        'RUG Bedside 22X34 BRA Degrade'
    ],
    'calfskin': [
        'Calfskin Hair On Printed Baby Zebra'
    ],
    'sheepskin': [
        'RUG Bedside 22X34 BRA Degrade'
    ],
    'chevron-rugs': [
        'Rug Designer Runner CHEVRON 2.5X8 BRA Palomino Tones Mix',
        'Designer Rug Runner CHEVRON 2.5X8 BRA Degrade',
        'Designer Rug Runner CHEVRON 2.5X8 BRA Greyish Tones',
        'Designer Rug Runner CHEVRON 2.5X8 BRA Off White'
    ]
};

// ============================================
// PRODUCT INCLUSIONS BY CATEGORY
// Products that MUST appear in certain categories (fetched from other categories)
// Format: { targetCategory: [{ name, sourceCategory }] }
// ============================================
const CATEGORY_INCLUSIONS = {
    'bedside-rugs': [
        { name: 'RUG Bedside 22X34 BRA Degrade', sourceCategory: 'sheepskin' }
    ],
    'runner-rugs': [
        { name: 'Rug Designer Runner CHEVRON 2.5X8 BRA Palomino Tones Mix', sourceCategory: 'chevron-rugs' },
        { name: 'Designer Rug Runner CHEVRON 2.5X8 BRA Degrade', sourceCategory: 'chevron-rugs' },
        { name: 'Designer Rug Runner CHEVRON 2.5X8 BRA Greyish Tones', sourceCategory: 'chevron-rugs' },
        { name: 'Designer Rug Runner CHEVRON 2.5X8 BRA Off White', sourceCategory: 'chevron-rugs' }
    ]
};

// ============================================
// HELPER: Sanitize product name for image path
// Replaces characters not allowed in filenames
// ============================================
function sanitizeImageName(name) {
    if (!name) return '';
    return name
        .replace(/\//g, '-')   // Replace / with -
        .replace(/\\/g, '-')   // Replace \ with -
        .replace(/:/g, '-')    // Replace : with -
        .replace(/\*/g, '')    // Remove *
        .replace(/\?/g, '')    // Remove ?
        .replace(/"/g, '')     // Remove "
        .replace(/</g, '')     // Remove <
        .replace(/>/g, '')     // Remove >
        .replace(/\|/g, '-');  // Replace | with -
}

// ============================================
// GLOBAL STATE
// ============================================

window.CatalogState = {
    currentView: 'homepage',  // homepage | subcategories | products
    currentCategory: null,
    currentSubcategory: null,
    currentViewType: null,
    products: [],
    currentPage: 1,
    itemsPerPage: 12,
    isLoading: false,
    // Contexto para breadcrumb - mantém o caminho do catálogo
    breadcrumbContext: null  // { categoryKey, categoryName, subcategoryKey, subcategoryName }
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🏠 Catalog system initializing...');

    // Show homepage on load
    setTimeout(() => {
        showHomepage();
    }, 100);

    // ✅ Listen for catalog stock restoration (when item is removed from cart)
    window.addEventListener('catalogStockRestored', function(event) {
        const { qbItem, quantityRestored } = event.detail;
        console.log(`📊 Restaurando estoque na UI: ${qbItem} +${quantityRestored}`);

        // Update local state
        const productIndex = CatalogState.products.findIndex(p => p.qbItem === qbItem);
        if (productIndex !== -1) {
            const currentStock = CatalogState.products[productIndex].availableStock ?? 0;
            const newStock = currentStock + quantityRestored;
            CatalogState.products[productIndex].availableStock = newStock;

            // Update the card in the UI using helper function
            updateStockCardUI(qbItem, newStock);
        }
    });

    // ✅ Listen for catalog stock changes (when +/- buttons used in cart)
    window.addEventListener('catalogStockChanged', function(event) {
        const { qbItem, stockChange } = event.detail;
        console.log(`📊 Mudança de estoque: ${qbItem} ${stockChange > 0 ? '+' : ''}${stockChange}`);

        // Update local state
        const productIndex = CatalogState.products.findIndex(p => p.qbItem === qbItem);
        if (productIndex !== -1) {
            const currentStock = CatalogState.products[productIndex].availableStock ?? 0;
            const newStock = Math.max(0, currentStock + stockChange);
            CatalogState.products[productIndex].availableStock = newStock;

            // Update the card in the UI (same logic as catalogStockRestored)
            updateStockCardUI(qbItem, newStock);
        }
    });
});

/**
 * Helper function to update stock card UI
 */
function updateStockCardUI(qbItem, newStock) {
    const stockCard = document.querySelector(`.stock-card[onclick*="'${qbItem}'"]`);
    if (!stockCard) return;

    // Update stock badge
    const stockBadge = stockCard.querySelector('.stock-badge');
    if (stockBadge) {
        stockBadge.textContent = newStock > 10 ? 'In Stock' : newStock > 0 ? `${newStock} left` : 'Out of Stock';
        stockBadge.className = `stock-badge ${newStock > 10 ? 'in-stock' : newStock > 0 ? 'low-stock' : 'out-of-stock'}`;
    }

    // Update units display
    const stockQty = stockCard.querySelector('.stock-qty');
    if (stockQty) {
        stockQty.innerHTML = `<i class="fas fa-boxes"></i> ${newStock} units`;
    }

    // Update qty input max
    const qtyInput = stockCard.querySelector(`#qty-${qbItem}`);
    if (qtyInput) {
        qtyInput.max = newStock;
        if (parseInt(qtyInput.value) > newStock && newStock > 0) {
            qtyInput.value = Math.max(1, newStock);
        }
    }

    // Update +/- buttons
    const minusBtn = stockCard.querySelector('.qty-minus');
    const plusBtn = stockCard.querySelector('.qty-plus');
    if (minusBtn) minusBtn.onclick = () => window.adjustQty(qbItem, -1, newStock);
    if (plusBtn) plusBtn.onclick = () => window.adjustQty(qbItem, 1, newStock);

    // Handle out of stock
    if (newStock === 0) {
        stockCard.classList.add('out-of-stock');
        const footer = stockCard.querySelector('.stock-footer');
        if (footer) {
            footer.innerHTML = '<span class="out-of-stock-label">Unavailable</span>';
        }
    } else {
        stockCard.classList.remove('out-of-stock');
        // Restore action row if needed
        const footer = stockCard.querySelector('.stock-footer');
        if (footer && !footer.querySelector('.stock-action-row')) {
            footer.innerHTML = `
                <div class="stock-action-row" onclick="event.stopPropagation()">
                    <div class="qty-selector">
                        <button class="qty-btn qty-minus" onclick="adjustQty('${qbItem}', -1, ${newStock})">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input type="number" class="qty-input" id="qty-${qbItem}" value="1" min="1" max="${newStock}"
                               onchange="validateQty('${qbItem}', ${newStock})" onclick="event.stopPropagation()">
                        <button class="qty-btn qty-plus" onclick="adjustQty('${qbItem}', 1, ${newStock})">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="btn-stock-add" onclick="addStockToCart('${qbItem}')">
                            <i class="fas fa-cart-plus"></i> Add
                        </button>
                    </div>
                </div>
            `;
        }
    }

    console.log(`✅ UI atualizada: ${qbItem} agora tem ${newStock} disponível`);
}

// ============================================
// HOMEPAGE
// ============================================

/**
 * Go back one level in navigation - step by step
 * Navigates back through: folder → subfolder root → subcategory → category → home
 */
window.goBackOneLevel = function() {
    console.log('⬅️ Going back one level');

    // Check gallery navigation state
    const galleryPath = window.navigationState?.currentPath || [];
    console.log('Gallery path:', galleryPath.map(p => p.name));
    console.log('Catalog state:', CatalogState.currentView, CatalogState.currentCategory, CatalogState.currentSubcategory);

    // STEP 1: If we're inside a gallery with a path > 1 item, navigate back within gallery
    if (galleryPath.length > 1) {
        console.log('📂 Navigating back within gallery');
        if (window.navigateBack) {
            window.navigateBack();
        }
        return;
    }

    // STEP 2: We're at the root of a gallery (or no gallery path)
    // If in direct-gallery mode with sidebar, go to homepage
    if (CatalogState.currentView === 'direct-gallery') {
        console.log('🏠 At gallery root in direct-gallery mode, going to homepage');
        showHomepage();
        return;
    }

    // STEP 3: If we have a subcategory, go back to category view (subcategory list)
    if (CatalogState.currentSubcategory && CatalogState.currentCategory) {
        console.log('📁 Going back to category:', CatalogState.currentCategory);
        openCategory(CatalogState.currentCategory);
        return;
    }

    // STEP 4: If we have a category (but no subcategory), go back to homepage
    if (CatalogState.currentCategory) {
        console.log('🏠 Going back to homepage from category');
        showHomepage();
        return;
    }

    // Default: go to homepage
    console.log('🏠 Default: going to homepage');
    showHomepage();
};

/**
 * Show the main homepage with category cards
 */
window.showHomepage = function() {
    console.log('🏠 Showing homepage');

    CatalogState.currentView = 'homepage';
    CatalogState.currentCategory = null;
    CatalogState.currentSubcategory = null;
    CatalogState.breadcrumbContext = null;  // ✅ Limpar contexto ao voltar para home
    CatalogState.directGalleryCategory = null;  // ✅ Limpar estado da galeria direta

    // Hide photo gallery containers
    hidePhotoContainers();

    // Remove category sidebar if present
    const sidebar = document.querySelector('.category-sidebar');
    if (sidebar) sidebar.remove();
    document.body.classList.remove('has-category-sidebar');

    // Get or create catalog container
    let container = document.getElementById('catalogContainer');
    if (!container) {
        const main = document.querySelector('main .container');
        if (main) {
            container = document.createElement('div');
            container.id = 'catalogContainer';
            main.appendChild(container);
        }
    }

    if (!container) return;

    container.style.display = 'block';
    container.innerHTML = renderHomepage();

    // Update breadcrumb
    updateCatalogBreadcrumb([{ name: 'Home', path: null }]);

    // Update nav buttons
    clearActiveNavButtons();
};

/**
 * Render homepage HTML
 */
function renderHomepage() {
    let html = `
        <div class="catalog-homepage">
            <div class="homepage-header">
                <h1>Welcome to Sunshine Cowhides Gallery</h1>
                <p>Select a category to explore our collection</p>
            </div>
            <div class="homepage-grid">
    `;

    for (const [key, category] of Object.entries(MAIN_CATEGORIES)) {
        // Check if category has a thumbnail - process for R2 in production
        const hasThumbnail = category.thumbnail ? true : false;
        const thumbnailClass = hasThumbnail ? 'has-thumbnail' : '';
        const thumbnailUrl = processCategoryThumbnail(category.thumbnail);
        const thumbnailStyle = hasThumbnail ? `style="background-image: url('${thumbnailUrl}');"` : '';

        // Check if category has Mix & Match subcategories
        const hasMixMatchSubcategories = category.subcategories &&
            Object.values(category.subcategories).some(sub => sub.hasMixMatch);
        const mixMatchBadge = hasMixMatchSubcategories ?
            `<button class="card-badge badge-mixmatch badge-mixmatch-btn" onclick="event.stopPropagation(); openMixMatchInfoModal();" title="Click to learn about Mix & Match">
                 MIX & MATCH <i class="fas fa-info-circle"></i>
            </button>` : '';

        if (hasThumbnail) {
            // Card with thumbnail - full background image style
            html += `
                <div class="homepage-card ${thumbnailClass}" ${thumbnailStyle} onclick="openCategory('${key}')">
                    ${mixMatchBadge}
                    <div class="card-overlay">
                        <h3>${category.name}</h3>
                        <p>${category.description}</p>
                    </div>
                </div>
            `;
        } else {
            // Regular card without thumbnail - simple text only
            html += `
                <div class="homepage-card no-thumbnail" onclick="openCategory('${key}')">
                    ${mixMatchBadge}
                    <div class="card-content">
                        <h3>${category.name}</h3>
                        <p>${category.description}</p>
                    </div>
                    <div class="card-arrow">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            `;
        }
    }

    html += `
            </div>
        </div>
    `;

    return html;
}

// ============================================
// CATEGORY NAVIGATION
// ============================================

/**
 * Open a main category
 */
window.openCategory = function(categoryKey) {
    console.log(`📂 Opening category: ${categoryKey}`);

    const category = MAIN_CATEGORIES[categoryKey];
    if (!category) {
        console.error(`Category not found: ${categoryKey}`);
        return;
    }

    CatalogState.currentCategory = categoryKey;
    setActiveNavButton(categoryKey);

    if (category.hasSubcategories) {
        // Check if ALL subcategories are photo-based (for direct navigation)
        const subcats = Object.values(category.subcategories).filter(s => !s.hidden);
        const allPhotoBased = subcats.every(sub => sub.viewType === 'photo');

        if (allPhotoBased && subcats.length > 0) {
            // DIRECT NAVIGATION: Skip subcategory page, go straight to photos with tabs
            console.log('🚀 Direct navigation mode: all subcategories are photo-based');
            showDirectPhotoGallery(categoryKey, category);
        } else {
            // Show subcategories normally
            showSubcategories(categoryKey, category);
        }
    } else {
        // Show products directly
        showProducts(categoryKey, null, category.viewType);
    }
};

/**
 * Show direct photo gallery with tabs (for all-photo categories like Natural Cowhides)
 * Reduces clicks by skipping the subcategory selection page
 */
async function showDirectPhotoGallery(categoryKey, category) {
    console.log(`🚀 Direct photo gallery for: ${categoryKey}`);

    CatalogState.currentView = 'direct-gallery';

    // Get all photo subcategories
    const subcatEntries = Object.entries(category.subcategories).filter(([k, v]) => !v.hidden);
    const firstSubcatKey = subcatEntries[0][0];
    const firstSubcat = subcatEntries[0][1];

    // Save current state
    CatalogState.currentSubcategory = firstSubcatKey;
    CatalogState.directGalleryCategory = categoryKey;
    CatalogState.directGallerySubcategories = subcatEntries;

    // Save breadcrumb context
    CatalogState.breadcrumbContext = {
        categoryKey: categoryKey,
        categoryName: category.name,
        subcategoryKey: firstSubcatKey,
        subcategoryName: firstSubcat.name
    };

    // Hide catalog container, show photo containers
    const catalogContainer = document.getElementById('catalogContainer');
    if (catalogContainer) catalogContainer.style.display = 'none';

    // Show breadcrumb container
    const breadcrumbContainer = document.getElementById('breadcrumbContainer');
    if (breadcrumbContainer) breadcrumbContainer.style.display = 'block';

    // Create or update the tabs bar
    createDirectGalleryTabs(categoryKey, category, subcatEntries, firstSubcatKey);

    // Navigate to the first folder
    if (firstSubcat.folderPath && window.navigateToCategory) {
        console.log('📂 Navigating to folder:', firstSubcat.folderPath);
        await window.navigateToCategory(firstSubcat.folderPath, firstSubcat.name);
    }
}

/**
 * Create left sidebar for direct gallery navigation with thumbnail images
 */
function createDirectGalleryTabs(categoryKey, category, subcatEntries, activeKey) {
    // Remove existing sidebar if any
    const existingSidebar = document.querySelector('.category-sidebar');
    if (existingSidebar) existingSidebar.remove();

    // Create sidebar HTML (no back button - we have Home in header and Back in breadcrumb)
    let sidebarHtml = `
        <aside class="category-sidebar">
            <div class="sidebar-header">
                <span class="sidebar-title">${category.name}</span>
            </div>
            <div class="sidebar-nav">
    `;

    for (const [subKey, sub] of subcatEntries) {
        const isActive = subKey === activeKey ? 'active' : '';
        const thumbnail = processCategoryThumbnail(sub.thumbnail);
        const thumbnailStyle = thumbnail ? `style="background-image: url('${thumbnail}');"` : '';

        sidebarHtml += `
            <button class="sidebar-card ${isActive}" onclick="switchDirectGalleryTab('${categoryKey}', '${subKey}')" data-subkey="${subKey}">
                <div class="sidebar-card-image" ${thumbnailStyle}></div>
                <span class="sidebar-card-name">${sub.name}</span>
            </button>
        `;
    }

    sidebarHtml += `
            </div>
        </aside>
    `;

    // Insert sidebar into the main area
    const mainContainer = document.querySelector('main') || document.body;
    mainContainer.insertAdjacentHTML('afterbegin', sidebarHtml);

    // Add class to body to shift content
    document.body.classList.add('has-category-sidebar');
}

/**
 * Switch between subcategories in sidebar navigation
 */
window.switchDirectGalleryTab = async function(categoryKey, subcategoryKey) {
    console.log(`🔄 Switching to subcategory: ${subcategoryKey}`);

    const category = MAIN_CATEGORIES[categoryKey];
    const subcategory = category.subcategories[subcategoryKey];

    // Update state
    CatalogState.currentSubcategory = subcategoryKey;
    CatalogState.breadcrumbContext = {
        categoryKey: categoryKey,
        categoryName: category.name,
        subcategoryKey: subcategoryKey,
        subcategoryName: subcategory.name
    };

    // Update active sidebar card
    document.querySelectorAll('.category-sidebar .sidebar-card').forEach(card => {
        card.classList.remove('active');
    });
    const activeCard = document.querySelector(`.category-sidebar .sidebar-card[data-subkey="${subcategoryKey}"]`);
    if (activeCard) activeCard.classList.add('active');

    // Navigate to the new folder
    if (subcategory.folderPath && window.navigateToCategory) {
        await window.navigateToCategory(subcategory.folderPath, subcategory.name);
    }
};

/**
 * Show subcategories for a category
 */
function showSubcategories(categoryKey, category) {
    console.log(`📁 Showing subcategories for: ${categoryKey}`);

    CatalogState.currentView = 'subcategories';
    CatalogState.currentSubcategory = null;  // ✅ Reset subcategory when showing list
    CatalogState.breadcrumbContext = null;  // ✅ Limpar contexto ao mostrar subcategorias

    hidePhotoContainers();

    // Remove category sidebar if present
    const sidebar = document.querySelector('.category-sidebar');
    if (sidebar) sidebar.remove();
    document.body.classList.remove('has-category-sidebar');

    // Esconder breadcrumb antigo da galeria
    const oldBreadcrumb = document.getElementById('breadcrumbContainer');
    if (oldBreadcrumb) oldBreadcrumb.style.display = 'none';

    const container = document.getElementById('catalogContainer');
    if (!container) return;

    container.style.display = 'block';
    container.innerHTML = renderSubcategories(categoryKey, category);
}

/**
 * Render subcategories HTML
 */
function renderSubcategories(categoryKey, category) {
    let html = `
        <div class="catalog-subcategories">
            <!-- Breadcrumb integrado -->
            <nav class="catalog-breadcrumb">
                <button class="breadcrumb-back" onclick="goBackOneLevel()">
                    <i class="fas fa-arrow-left"></i> Back
                </button>
                <span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span>
                <span class="breadcrumb-current">${category.name}</span>
            </nav>

            <div class="subcategories-header">
                <h2>${category.name}</h2>
                <p>${category.description}</p>
            </div>
            <div class="subcategories-grid">
    `;

    for (const [subKey, sub] of Object.entries(category.subcategories)) {
        // Skip hidden subcategories
        if (sub.hidden) continue;

        // Check if subcategory has a thumbnail - process for R2 in production
        const hasThumbnail = sub.thumbnail ? true : false;
        const thumbnailClass = hasThumbnail ? 'has-thumbnail' : '';
        const thumbnailUrl = processCategoryThumbnail(sub.thumbnail);
        const thumbnailStyle = hasThumbnail ? `style="background-image: url('${thumbnailUrl}');"` : '';

        // Determine badge based on viewType and hasMixMatch
        let viewTypeBadge = '';
        if (sub.hasMixMatch) {
            viewTypeBadge = '<span class="card-badge badge-mixmatch">Mix & Match</span>';
        }
        // Remove badges from photo and stock categories - cleaner design
        // Only show badge for special features like Mix & Match

        // Cards with thumbnail: large card with bg image and text at bottom
        // Cards without thumbnail: regular card with badge
        if (hasThumbnail) {
            html += `
                <div class="subcategory-card folder-card ${thumbnailClass}" ${thumbnailStyle}
                     onclick="openSubcategory('${categoryKey}', '${subKey}')">
                    ${viewTypeBadge}
                    <div class="card-overlay">
                        <h4>${sub.name}</h4>
                        <p class="folder-description">${sub.description}</p>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="subcategory-card folder-card folder-card-simple"
                     onclick="openSubcategory('${categoryKey}', '${subKey}')">
                    ${viewTypeBadge}
                    <div class="card-content">
                        <h4>${sub.name}</h4>
                        <p class="folder-description">${sub.description}</p>
                    </div>
                    <div class="card-arrow-hint">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            `;
        }
    }

    html += `
            </div>
        </div>
    `;

    return html;
}

/**
 * Open a subcategory
 */
window.openSubcategory = function(categoryKey, subcategoryKey) {
    console.log(`📄 Opening subcategory: ${categoryKey}/${subcategoryKey}`);

    const category = MAIN_CATEGORIES[categoryKey];
    if (!category || !category.subcategories) return;

    const subcategory = category.subcategories[subcategoryKey];
    if (!subcategory) return;

    CatalogState.currentSubcategory = subcategoryKey;

    showProducts(categoryKey, subcategoryKey, subcategory.viewType);
};

// ============================================
// PRODUCTS VIEW
// ============================================

/**
 * Show products based on view type
 */
async function showProducts(categoryKey, subcategoryKey, viewType) {
    console.log(`📦 Showing products: ${categoryKey}/${subcategoryKey} (${viewType})`);

    CatalogState.currentView = 'products';
    CatalogState.currentViewType = viewType;

    const category = MAIN_CATEGORIES[categoryKey];
    const subcategory = subcategoryKey ? category.subcategories[subcategoryKey] : null;

    // Update breadcrumb
    const breadcrumbs = [{ name: 'Home', path: 'home' }];

    if (category.hasSubcategories) {
        breadcrumbs.push({ name: category.name, path: `category:${categoryKey}` });
        if (subcategory) {
            breadcrumbs.push({ name: subcategory.name, path: null });
        }
    } else {
        breadcrumbs.push({ name: category.name, path: null });
    }

    updateCatalogBreadcrumb(breadcrumbs);

    // Show content based on view type
    if (viewType === 'photo') {
        await showPhotoGallery(categoryKey, subcategoryKey, subcategory);
    } else if (viewType === 'stock') {
        // Garantir que config tenha todas as propriedades necessárias
        const config = {
            ...subcategory,
            name: subcategory?.name || category.name,
            description: subcategory?.description || category.description,
            catalogCategory: subcategory?.catalogCategory || categoryKey
        };
        await showStockProducts(categoryKey, subcategoryKey, config);
    } else if (viewType === 'mixed') {
        await showMixedView(categoryKey, subcategoryKey, subcategory);
    }
}

/**
 * Show photo gallery view
 */
async function showPhotoGallery(categoryKey, subcategoryKey, subcategory) {
    console.log('📷 Showing photo gallery for:', subcategory?.folderPath || subcategory?.name);

    const category = MAIN_CATEGORIES[categoryKey];

    // ✅ Salvar contexto do catálogo para o breadcrumb
    CatalogState.breadcrumbContext = {
        categoryKey: categoryKey,
        categoryName: category?.name || categoryKey,
        subcategoryKey: subcategoryKey,
        subcategoryName: subcategory?.name || subcategoryKey
    };
    console.log('📍 Breadcrumb context saved:', CatalogState.breadcrumbContext);

    // Hide catalog container
    const catalogContainer = document.getElementById('catalogContainer');
    if (catalogContainer) {
        catalogContainer.style.display = 'none';
    }

    // Show breadcrumb container for gallery
    const breadcrumbContainer = document.getElementById('breadcrumbContainer');
    if (breadcrumbContainer) {
        breadcrumbContainer.style.display = 'block';
    }

    // Navegar diretamente para a pasta da galeria
    if (subcategory?.folderPath && window.navigateToCategory) {
        // Usar o sistema de navegação da galeria para ir para a pasta correta
        console.log('📂 Navigating to folder:', subcategory.folderPath);
        await window.navigateToCategory(subcategory.folderPath, subcategory.name);
    } else {
        // Fallback: mostrar todas as categorias
        console.log('⚠️ No folderPath defined, showing all categories');
        showPhotoContainers();
        if (window.showCategories) {
            await window.showCategories();
        }
    }
}

/**
 * Show stock products view
 */
async function showStockProducts(categoryKey, subcategoryKey, config) {
    console.log('📦 Showing stock products for:', config.catalogCategory || categoryKey);

    hidePhotoContainers();

    // Esconder breadcrumb antigo da galeria
    const oldBreadcrumb = document.getElementById('breadcrumbContainer');
    if (oldBreadcrumb) oldBreadcrumb.style.display = 'none';

    const container = document.getElementById('catalogContainer');
    if (!container) return;

    container.style.display = 'block';
    container.innerHTML = `
        <div class="catalog-subcategories">
            <nav class="catalog-breadcrumb">
                <button class="breadcrumb-back" onclick="goBackOneLevel()">
                    <i class="fas fa-arrow-left"></i> Back
                </button>
                <span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span>
                <button class="breadcrumb-link" onclick="openCategory('${categoryKey}')">${MAIN_CATEGORIES[categoryKey]?.name || categoryKey}</button>
                <span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span>
                <span class="breadcrumb-current">${config.name || 'Products'}</span>
            </nav>
            <div class="stock-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading products...</p>
            </div>
        </div>
    `;

    try {
        // Load products from API
        const catalogCategory = config.catalogCategory || categoryKey;
        const response = await fetch(`/api/catalog/products?category=${encodeURIComponent(catalogCategory)}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to load products');
        }

        // Apply exclusions filter
        let products = data.products || [];
        const exclusions = CATEGORY_EXCLUSIONS[catalogCategory] || [];
        if (exclusions.length > 0) {
            products = products.filter(p => !exclusions.includes(p.name));
        }

        // Apply inclusions - fetch products from other categories that should appear here
        const inclusions = CATEGORY_INCLUSIONS[catalogCategory] || [];
        if (inclusions.length > 0) {
            // Group inclusions by source category
            const sourceCategories = [...new Set(inclusions.map(i => i.sourceCategory))];
            for (const sourceCategory of sourceCategories) {
                try {
                    const sourceResponse = await fetch(`/api/catalog/products?category=${encodeURIComponent(sourceCategory)}`);
                    const sourceData = await sourceResponse.json();
                    if (sourceData.success && sourceData.products) {
                        const productNames = inclusions.filter(i => i.sourceCategory === sourceCategory).map(i => i.name);
                        const includedProducts = sourceData.products.filter(p => productNames.includes(p.name));
                        products = [...products, ...includedProducts];
                    }
                } catch (e) {
                    console.warn('Failed to fetch inclusion products from:', sourceCategory);
                }
            }
        }

        // ✅ IMPORTANTE: Adicionar catalogCategory a cada produto para categorização correta no carrinho
        products = products.map(p => ({
            ...p,
            catalogCategory: catalogCategory  // Categoria usada para buscar (ex: 'sheepskin', 'pillows')
        }));

        CatalogState.products = products;
        renderStockGrid(container, CatalogState.products, config, categoryKey);
    } catch (error) {
        console.error('Error loading products:', error);
        container.innerHTML = `
            <div class="catalog-subcategories">
                <nav class="catalog-breadcrumb">
                    <button class="breadcrumb-back" onclick="goBackOneLevel()">
                        <i class="fas fa-arrow-left"></i> Back
                    </button>
                    <span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span>
                    <button class="breadcrumb-link" onclick="openCategory('${categoryKey}')">${MAIN_CATEGORIES[categoryKey]?.name || categoryKey}</button>
                </nav>
                <div class="stock-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Error loading products</h3>
                    <p>${error.message}</p>
                    <button class="btn-retry" onclick="showProducts('${categoryKey}', '${subcategoryKey}', 'stock')">
                        <i class="fas fa-redo"></i> Try Again
                    </button>
                </div>
            </div>
        `;
    }
}

/**
 * Show mixed view (photos + stock with tabs)
 * Used for categories that have both unique photographed items AND stock products
 */
async function showMixedView(categoryKey, subcategoryKey, subcategory) {
    console.log('🔀 Showing mixed view for:', subcategoryKey);

    hidePhotoContainers();

    // Hide the gallery breadcrumb to prevent duplication
    const galleryBreadcrumb = document.getElementById('breadcrumbContainer');
    if (galleryBreadcrumb) galleryBreadcrumb.style.display = 'none';

    const category = MAIN_CATEGORIES[categoryKey];
    const container = document.getElementById('catalogContainer');
    if (!container) return;

    container.style.display = 'block';

    // Store config for tabs
    window._mixedViewConfig = {
        categoryKey,
        subcategoryKey,
        subcategory,
        category
    };

    // Show loading while we fetch counts
    container.innerHTML = `
        <div class="catalog-subcategories">
            <nav class="catalog-breadcrumb">
                <button class="breadcrumb-back" onclick="goBackOneLevel()">
                    <i class="fas fa-arrow-left"></i> Back
                </button>
                <span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span>
                <button class="breadcrumb-link" onclick="openCategory('${categoryKey}')">${category?.name || categoryKey}</button>
                <span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span>
                <span class="breadcrumb-current">${subcategory?.name || 'Products'}</span>
            </nav>
            <div class="stock-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading...</p>
            </div>
        </div>
    `;

    // Fetch photo count and stock count in parallel
    let photoCount = 0;
    let stockCount = 0;
    let stockTotal = 0;

    try {
        const [photoData, stockData] = await Promise.all([
            // Fetch R2 folder structure for photos
            fetch(`/api/gallery/structure?prefix=${encodeURIComponent(subcategory?.folderPath || '')}`, {
                credentials: 'include'
            }).then(r => r.json()).catch(() => ({ success: false })),
            // Fetch stock products
            fetch(`/api/catalog/products?category=${encodeURIComponent(subcategory?.catalogCategory || '')}`)
                .then(r => r.json()).catch(() => ({ success: false }))
        ]);

        // Count AVAILABLE photos only (not out-of-stock items)
        if (photoData.success && photoData.structure?.folders) {
            photoCount = photoData.structure.folders.reduce((sum, f) => sum + (f.availableCount || 0), 0);
        }

        // Count stock products (usa estoque lógico disponível)
        if (stockData.success && stockData.products) {
            stockCount = stockData.products.length;
            stockTotal = stockData.products.reduce((sum, p) => sum + (p.availableStock ?? p.currentStock ?? p.stock ?? 0), 0);
        }
    } catch (error) {
        console.error('Error fetching counts:', error);
    }

    // Render mixed view with tabs
    container.innerHTML = `
        <div class="catalog-subcategories">
            <nav class="catalog-breadcrumb">
                <button class="breadcrumb-back" onclick="goBackOneLevel()">
                    <i class="fas fa-arrow-left"></i> Back
                </button>
                <span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span>
                <button class="breadcrumb-link" onclick="openCategory('${categoryKey}')">${category?.name || categoryKey}</button>
                <span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span>
                <span class="breadcrumb-current">${subcategory?.name || 'Products'}</span>
            </nav>

            <div class="mixed-header">
                <div class="mixed-header-info">
                    <h2>${subcategory?.name || 'Products'}</h2>
                    <p>${subcategory?.description || 'Browse our collection'}</p>
                </div>
            </div>

            <div class="mixed-tabs-container">
                <div class="mixed-tabs">
                    <button class="mixed-tab active" data-tab="stock" onclick="switchMixedTab('stock')">
                        <i class="fas fa-boxes"></i>
                        <span class="tab-label">Order from Stock</span>
                        <span class="tab-count">${stockCount} types / ${stockTotal} units</span>
                    </button>
                    <button class="mixed-tab" data-tab="photo" onclick="switchMixedTab('photo')">
                        <i class="fas fa-camera"></i>
                        <span class="tab-label">Unique Photos</span>
                        <span class="tab-count">${photoCount}</span>
                    </button>
                </div>
                <div class="mixed-tab-hint">
                    <i class="fas fa-info-circle"></i>
                    <span id="mixedTabHint">Generic stock products - order by type and quantity</span>
                </div>
            </div>

            <div class="mixed-content" id="mixedContent">
                <div class="stock-loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading products...</p>
                </div>
            </div>
        </div>
    `;

    // Load stock view by default
    switchMixedTab('stock');
}

/**
 * Switch tab in mixed view
 */
window.switchMixedTab = async function(tab) {
    const config = window._mixedViewConfig;
    if (!config) return;

    console.log(`🔄 Switching to tab: ${tab}`);

    // Update tab UI
    document.querySelectorAll('.mixed-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.mixed-tab[data-tab="${tab}"]`)?.classList.add('active');

    // Update hint text
    const hint = document.getElementById('mixedTabHint');
    if (hint) {
        hint.textContent = tab === 'photo'
            ? 'Unique photographed items - what you see is what you get'
            : 'Generic stock products - order by type and quantity';
    }

    const content = document.getElementById('mixedContent');
    if (!content) return;

    if (tab === 'photo') {
        // Show photo gallery
        content.innerHTML = '<div class="stock-loading"><i class="fas fa-spinner fa-spin"></i><p>Loading photos...</p></div>';
        await loadMixedPhotos(content, config);
    } else {
        // Show stock products
        content.innerHTML = '<div class="stock-loading"><i class="fas fa-spinner fa-spin"></i><p>Loading products...</p></div>';
        await loadMixedStock(content, config);
    }
};

/**
 * Load photos for mixed view
 */
async function loadMixedPhotos(content, config) {
    try {
        const folderPath = config.subcategory?.folderPath;
        if (!folderPath) {
            content.innerHTML = '<div class="stock-empty"><i class="fas fa-image"></i><h3>No photos available</h3></div>';
            return;
        }

        // Fetch folder structure
        const response = await fetch(`/api/gallery/structure?prefix=${encodeURIComponent(folderPath)}`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (!data.success || !data.structure?.folders || data.structure.folders.length === 0) {
            content.innerHTML = '<div class="stock-empty"><i class="fas fa-image"></i><h3>No photos available</h3><p>Check back later for new arrivals!</p></div>';
            return;
        }

        // Count totals
        const totalPhotos = data.structure.folders.reduce((sum, f) => sum + (f.imageCount || 0), 0);
        const availablePhotos = data.structure.folders.reduce((sum, f) => sum + (f.availableCount || 0), 0);
        const soldOutFolders = data.structure.folders.filter(f => (f.imageCount || 0) > 0 && (f.availableCount || 0) === 0).length;

        // Check if this is a size-based category (folders contain "sqft" or size ranges)
        const isSizeCategory = data.structure.folders.some(f =>
            f.name.toLowerCase().includes('sqft') ||
            f.name.match(/\d+-\d+/) ||
            f.name.toLowerCase().includes('small') ||
            f.name.toLowerCase().includes('medium') ||
            f.name.toLowerCase().includes('large') ||
            f.name.toLowerCase().includes('xl')
        );

        // Quick Size Selector for size-based categories
        let html = '';
        if (isSizeCategory && data.structure.folders.length > 1) {
            html += `
                <div class="size-quick-selector">
                    <div class="size-selector-label">
                        <i class="fas fa-ruler-combined"></i>
                        <span>Quick Size Selection:</span>
                    </div>
                    <div class="size-pills">
            `;

            // Sort folders by size (extract numbers for sorting)
            const sortedFolders = [...data.structure.folders].sort((a, b) => {
                const numA = parseInt(a.name.match(/\d+/)?.[0] || '999');
                const numB = parseInt(b.name.match(/\d+/)?.[0] || '999');
                return numA - numB;
            });

            for (const folder of sortedFolders) {
                const availableCount = folder.availableCount || 0;
                const isOutOfStock = availableCount === 0;
                const pillClass = isOutOfStock ? 'size-pill out-of-stock' : 'size-pill';
                // ✅ Limpar nome para exibição (remove "1.", "2.", etc.)
                const displayName = window.cleanName ? window.cleanName(folder.name) : folder.name;

                html += `
                    <button class="${pillClass}"
                            data-folder-path="${folder.path}"
                            data-folder-name="${folder.name}"
                            ${isOutOfStock ? 'disabled' : ''}>
                        <span class="pill-name">${displayName}</span>
                        <span class="pill-count">${availableCount}</span>
                    </button>
                `;
            }

            html += `
                    </div>
                </div>
            `;
        }

        // Also show folder cards for detailed view
        html += '<div class="folders-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">';

        // Sort folders: available first, out-of-stock at the bottom
        const sortedFolders = [...data.structure.folders].sort((a, b) => {
            const aAvailable = (a.availableCount || 0) > 0;
            const bAvailable = (b.availableCount || 0) > 0;
            if (aAvailable && !bAvailable) return -1;
            if (!aAvailable && bAvailable) return 1;
            return 0;
        });

        for (const folder of sortedFolders) {
            const totalCount = folder.imageCount || 0;
            const availableCount = folder.availableCount || 0;
            const isOutOfStock = availableCount === 0;

            // Show ALL folders (even empty ones) - like production version
            // Get price from folder metadata if available
            const price = folder.price || folder.basePrice;
            const formattedPrice = price ? (window.formatPrice ? window.formatPrice(price) : `$${price.toFixed(2)}`) : null;

            const cardClass = isOutOfStock ? 'folder-card folder-card-clean out-of-stock' : 'folder-card folder-card-clean';

            // Get description from folder metadata
            const description = folder.description || '';

            // ✅ Limpar nome para exibição (remove "1.", "2.", etc.)
            const displayName = window.cleanName ? window.cleanName(folder.name) : folder.name;

            html += `
                <div class="${cardClass}"
                     data-folder-path="${folder.path}"
                     data-folder-name="${folder.name}"
                     data-available="${availableCount}"
                     style="cursor: ${isOutOfStock ? 'default' : 'pointer'}">
                    <div class="card-content">
                        <h4>${displayName}</h4>
                        ${description ? `<p class="folder-description">${description}</p>` : ''}
                        <div class="folder-stats">
                            ${formattedPrice ?
                                `<span class="folder-price-badge"><i class="fas fa-tag"></i> ${formattedPrice}</span>` :
                                ''
                            }

                            ${isOutOfStock ? `
                                <div class="out-of-stock-inline">
                                    <i class="fas fa-box-open"></i>
                                    <span class="out-text">OUT OF STOCK</span>
                                </div>
                            ` : `
                                <div class="photo-count-badge">
                                    <i class="fas fa-images"></i>
                                    <span class="count-text">${availableCount} ${availableCount === 1 ? 'product' : 'products'}</span>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }

        html += '</div>';

        content.innerHTML = html;

        // Add click handlers for size pills (quick navigation)
        content.querySelectorAll('.size-pill:not(.out-of-stock)').forEach(pill => {
            pill.addEventListener('click', function() {
                const folderPath = this.dataset.folderPath;
                const folderName = this.dataset.folderName;
                if (folderPath && folderName) {
                    window.openMixedPhotoFolder(folderPath, folderName);
                }
            });
        });

        // Add click handlers for cards with available photos
        content.querySelectorAll('.folder-card:not(.out-of-stock)').forEach(card => {
            card.addEventListener('click', function() {
                const folderPath = this.dataset.folderPath;
                const folderName = this.dataset.folderName;
                if (folderPath && folderName) {
                    window.openMixedPhotoFolder(folderPath, folderName);
                }
            });
        });

    } catch (error) {
        console.error('Error loading photos:', error);
        content.innerHTML = '<div class="stock-error"><i class="fas fa-exclamation-circle"></i><h3>Error loading photos</h3><p>' + error.message + '</p></div>';
    }
}

/**
 * Open photo folder from mixed view
 */
window.openMixedPhotoFolder = async function(folderPath, folderName) {
    console.log('📷 Opening photo folder:', folderPath);

    const config = window._mixedViewConfig;
    if (!config) return;

    // Save breadcrumb context
    CatalogState.breadcrumbContext = {
        categoryKey: config.categoryKey,
        categoryName: config.category?.name,
        subcategoryKey: config.subcategoryKey,
        subcategoryName: config.subcategory?.name
    };

    // Hide catalog container
    const catalogContainer = document.getElementById('catalogContainer');
    if (catalogContainer) catalogContainer.style.display = 'none';

    // Show breadcrumb container
    const breadcrumbContainer = document.getElementById('breadcrumbContainer');
    if (breadcrumbContainer) breadcrumbContainer.style.display = 'block';

    // Navigate to the folder using gallery system
    if (window.navigateToCategory) {
        await window.navigateToCategory(folderPath, folderName);
    }
};

/**
 * Load stock products for mixed view
 */
async function loadMixedStock(content, config) {
    try {
        const catalogCategory = config.subcategory?.catalogCategory;
        if (!catalogCategory) {
            content.innerHTML = '<div class="stock-empty"><i class="fas fa-boxes"></i><h3>No stock products available</h3></div>';
            return;
        }

        // Fetch stock products
        const response = await fetch(`/api/catalog/products?category=${encodeURIComponent(catalogCategory)}`);
        const data = await response.json();

        if (!data.success || !data.products || data.products.length === 0) {
            content.innerHTML = '<div class="stock-empty"><i class="fas fa-boxes"></i><h3>No stock products available</h3><p>Check back later!</p></div>';
            return;
        }

        // ✅ IMPORTANTE: Adicionar catalogCategory a cada produto para categorização correta no carrinho
        const productsWithCategory = data.products.map(p => ({
            ...p,
            catalogCategory: catalogCategory  // Categoria usada para buscar (ex: 'sheepskin')
        }));

        // Save products to state for cart access
        CatalogState.products = productsWithCategory;

        // Render stock grid directly in content
        renderMixedStockGrid(content, productsWithCategory, config);

    } catch (error) {
        console.error('Error loading stock:', error);
        content.innerHTML = '<div class="stock-error"><i class="fas fa-exclamation-circle"></i><h3>Error loading products</h3><p>' + error.message + '</p></div>';
    }
}

/**
 * Render stock grid for mixed view (simplified, no breadcrumb)
 */
function renderMixedStockGrid(container, products, config) {
    // Sort: products with stock first (usa estoque lógico disponível)
    const sortedProducts = [...products].sort((a, b) => {
        const stockA = a.availableStock ?? a.currentStock ?? a.stock ?? 0;
        const stockB = b.availableStock ?? b.currentStock ?? b.stock ?? 0;
        if (stockA > 0 && stockB === 0) return -1;
        if (stockA === 0 && stockB > 0) return 1;
        return (a.name || '').localeCompare(b.name || '');
    });

    const inStockCount = sortedProducts.filter(p => (p.availableStock ?? p.currentStock ?? p.stock ?? 0) > 0).length;
    const totalStock = sortedProducts.reduce((sum, p) => sum + (p.availableStock ?? p.currentStock ?? p.stock ?? 0), 0);

    let html = `
        <div class="stock-grid">
    `;

    for (const product of sortedProducts) {
        const stock = product.availableStock ?? product.currentStock ?? product.stock ?? 0;
        const stockClass = stock > 10 ? 'in-stock' : stock > 0 ? 'low-stock' : 'out-of-stock';
        const stockLabel = stock > 10 ? 'In Stock' : stock > 0 ? `${stock} left` : 'Out of Stock';
        const maxQty = stock > 0 ? stock : 0;

        let placeholderIcon = 'fa-cloud'; // Default for sheepskins
        if (product.name?.toLowerCase().includes('goat')) placeholderIcon = 'fa-paw';
        if (product.name?.toLowerCase().includes('calf')) placeholderIcon = 'fa-paw';

        // Get price if available - use API formatted price or fallback
        const hasPrice = product.hasPrice || (product.basePrice && product.basePrice > 0);
        const formattedProductPrice = product.formattedPrice && product.formattedPrice !== 'Contact for Price'
            ? product.formattedPrice
            : (product.basePrice > 0
                ? (window.formatPrice ? window.formatPrice(product.basePrice) : `$${product.basePrice.toFixed(2)}`)
                : null);

        // Build image path from product name - uses R2 in production
        const imagePath = getThumbnailUrl(sanitizeImageName(product.name));

        html += `
            <div class="stock-card ${stock === 0 ? 'out-of-stock' : ''}" onclick="viewStockProduct('${product.qbItem}')" data-price="${product.basePrice || 0}">
                <div class="stock-image">
                    <img src="${imagePath}" alt="${product.name}"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                         onload="this.style.display='block'; this.nextElementSibling.style.display='none';">
                    <div class="stock-placeholder">
                        <i class="fas ${placeholderIcon}"></i>
                        <span>NO PHOTO</span>
                    </div>
                </div>
                <div class="stock-info">
                    <h4>${product.name || product.qbItem}</h4>
                    <div class="stock-meta-row">
                        <span class="stock-qty"><i class="fas fa-boxes"></i> ${stock} units</span>
                        ${!formattedProductPrice ? `<span class="contact-price-badge">Contact for Price</span>` : ''}
                        ${formattedProductPrice ? `<span class="stock-price-inline">${formattedProductPrice}</span>` : ''}
                    </div>
                    <div class="stock-footer">
                        ${stock > 0 ? `
                        <div class="stock-action-row" onclick="event.stopPropagation()">
                            <div class="qty-selector">
                                <button class="qty-btn qty-minus" onclick="adjustQty('${product.qbItem}', -1, ${maxQty})">
                                    <i class="fas fa-minus"></i>
                                </button>
                                <input type="number" class="qty-input" id="qty-${product.qbItem}" value="1" min="1" max="${maxQty}"
                                       onchange="validateQty('${product.qbItem}', ${maxQty})" onclick="event.stopPropagation()">
                                <button class="qty-btn qty-plus" onclick="adjustQty('${product.qbItem}', 1, ${maxQty})">
                                    <i class="fas fa-plus"></i>
                                </button>
                                <button class="btn-stock-add" onclick="addStockToCart('${product.qbItem}')">
                                    <i class="fas fa-cart-plus"></i> Add
                                </button>
                            </div>
                        </div>
                        ` : `
                        <span class="out-of-stock-label">Unavailable</span>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

// ============================================
// STOCK GRID RENDERING
// ============================================

function renderStockGrid(container, products, config, categoryKey) {
    const category = MAIN_CATEGORIES[categoryKey];

    if (!products || products.length === 0) {
        container.innerHTML = `
            <div class="catalog-subcategories">
                <nav class="catalog-breadcrumb">
                    <button class="breadcrumb-back" onclick="goBackOneLevel()">
                        <i class="fas fa-arrow-left"></i> Back
                    </button>
                    <span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span>
                    <button class="breadcrumb-link" onclick="openCategory('${categoryKey}')">${category?.name || categoryKey}</button>
                    <span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span>
                    <span class="breadcrumb-current">${config.name || 'Products'}</span>
                </nav>
                <div class="stock-empty">
                    <i class="fas fa-box-open"></i>
                    <h3>No products available</h3>
                    <p>There are no products in stock for this category at the moment.</p>
                    <button class="btn-retry" onclick="openCategory('${categoryKey}')">
                        <i class="fas fa-arrow-left"></i> Back to ${category?.name || 'Category'}
                    </button>
                </div>
            </div>
        `;
        return;
    }

    // Ordenar: produtos COM estoque primeiro, SEM estoque no final (usa estoque lógico disponível)
    const sortedProducts = [...products].sort((a, b) => {
        const stockA = a.availableStock ?? a.currentStock ?? a.stock ?? 0;
        const stockB = b.availableStock ?? b.currentStock ?? b.stock ?? 0;
        // Produtos com estoque primeiro (ordem decrescente de estoque)
        if (stockA > 0 && stockB === 0) return -1;
        if (stockA === 0 && stockB > 0) return 1;
        // Dentro de cada grupo, ordenar por nome
        return (a.name || '').localeCompare(b.name || '');
    });

    // Contar produtos com estoque (usa estoque lógico disponível)
    const inStockCount = sortedProducts.filter(p => (p.availableStock ?? p.currentStock ?? p.stock ?? 0) > 0).length;
    const totalStock = sortedProducts.reduce((sum, p) => sum + (p.availableStock ?? p.currentStock ?? p.stock ?? 0), 0);

    let html = `
        <div class="catalog-subcategories">
            <nav class="catalog-breadcrumb">
                <button class="breadcrumb-back" onclick="goBackOneLevel()">
                    <i class="fas fa-arrow-left"></i> Back
                </button>
                <span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span>
                <button class="breadcrumb-link" onclick="openCategory('${categoryKey}')">${category?.name || categoryKey}</button>
                <span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span>
                <span class="breadcrumb-current">${config.name || 'Products'}</span>
            </nav>

            <div class="stock-header">
                <div class="stock-header-info">
                    <h2>${config.name || 'Products'}</h2>
                    <p>${config.description || 'Browse our available products'}</p>
                </div>
            </div>

            <div class="stock-grid">
    `;

    for (const product of sortedProducts) {
        const stock = product.availableStock ?? product.currentStock ?? product.stock ?? 0;
        const stockClass = stock > 10 ? 'in-stock' : stock > 0 ? 'low-stock' : 'out-of-stock';
        const stockLabel = stock > 10 ? 'In Stock' : stock > 0 ? `${stock} left` : 'Out of Stock';
        const maxQty = stock > 0 ? stock : 0;

        // Determinar ícone baseado na categoria
        let placeholderIcon = 'fa-cloud';
        if (product.category) {
            const cat = product.category.toUpperCase();
            if (cat.includes('RUG')) placeholderIcon = 'fa-cloud';
            else if (cat.includes('SHEEPSKIN')) placeholderIcon = 'fa-cloud';
            else if (cat.includes('SMALL') || cat.includes('CALF')) placeholderIcon = 'fa-cloud';
            else if (cat.includes('MOBIL') || cat.includes('FURNITURE')) placeholderIcon = 'fa-couch';
            else if (cat.includes('ACCESS') || cat.includes('PILLOW')) placeholderIcon = 'fa-shopping-bag';
        }

        // Get price if available - use API formatted price or fallback
        const hasPrice = product.hasPrice || (product.basePrice && product.basePrice > 0);
        const formattedProductPrice = product.formattedPrice && product.formattedPrice !== 'Contact for Price'
            ? product.formattedPrice
            : (product.basePrice > 0
                ? (window.formatPrice ? window.formatPrice(product.basePrice) : `$${product.basePrice.toFixed(2)}`)
                : null);

        // Build image path from product name - uses R2 in production
        const imagePath = getThumbnailUrl(sanitizeImageName(product.name));

        html += `
            <div class="stock-card ${stock === 0 ? 'out-of-stock' : ''}" onclick="viewStockProduct('${product.qbItem}')" data-price="${product.basePrice || 0}">
                <div class="stock-image">
                    <img src="${imagePath}" alt="${product.name}"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                         onload="this.style.display='block'; this.nextElementSibling.style.display='none';">
                    <div class="stock-placeholder">
                        <i class="fas ${placeholderIcon}"></i>
                        <span>NO PHOTO</span>
                    </div>
                </div>
                <div class="stock-info">
                    <h4>${product.name || product.qbItem}</h4>
                    <div class="stock-meta-row">
                        <span class="stock-qty"><i class="fas fa-boxes"></i> ${stock} units</span>
                        ${!formattedProductPrice ? `<span class="contact-price-badge">Contact for Price</span>` : ''}
                        ${formattedProductPrice ? `<span class="stock-price-inline">${formattedProductPrice}</span>` : ''}
                    </div>
                    <div class="stock-footer">
                        ${stock > 0 ? `
                        <div class="stock-action-row" onclick="event.stopPropagation()">
                            <div class="qty-selector">
                                <button class="qty-btn qty-minus" onclick="adjustQty('${product.qbItem}', -1, ${maxQty})">
                                    <i class="fas fa-minus"></i>
                                </button>
                                <input type="number" class="qty-input" id="qty-${product.qbItem}" value="1" min="1" max="${maxQty}"
                                       onchange="validateQty('${product.qbItem}', ${maxQty})" onclick="event.stopPropagation()">
                                <button class="qty-btn qty-plus" onclick="adjustQty('${product.qbItem}', 1, ${maxQty})">
                                    <i class="fas fa-plus"></i>
                                </button>
                                <button class="btn-stock-add" onclick="addStockToCart('${product.qbItem}')">
                                    <i class="fas fa-cart-plus"></i> Add
                                </button>
                            </div>
                        </div>
                        ` : `
                        <span class="out-of-stock-label">Unavailable</span>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    html += `
            </div>
        </div>
    `;

    container.innerHTML = html;
}

/**
 * View stock product details (modal or page)
 */
window.viewStockProduct = function(qbItem) {
    console.log('📦 Viewing stock product:', qbItem);

    // Find product in current state
    const product = CatalogState.products.find(p => p.qbItem === qbItem);
    const productName = product?.name || qbItem;
    const imagePath = getThumbnailUrl(sanitizeImageName(productName));

    // Create elegant coming soon modal
    const modal = document.createElement('div');
    modal.className = 'product-preview-modal';
    modal.innerHTML = `
        <div class="product-preview-overlay" onclick="this.parentElement.remove()"></div>
        <div class="product-preview-content">
            <button class="product-preview-close" onclick="this.closest('.product-preview-modal').remove()">
                <i class="fas fa-times"></i>
            </button>
            <div class="product-preview-image">
                <img src="${imagePath}" alt="${productName}"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="product-preview-placeholder" style="display:none;">
                    <i class="fas fa-image"></i>
                </div>
            </div>
            <div class="product-preview-info">
                <h3>${productName}</h3>
                <p class="product-preview-coming-soon">
                    <i class="fas fa-camera"></i>
                    More photos & zoom coming soon
                </p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
};

/**
 * Adjust quantity with +/- buttons
 */
window.adjustQty = function(qbItem, delta, maxQty) {
    const input = document.getElementById(`qty-${qbItem}`);
    if (!input) return;

    let newValue = parseInt(input.value || 1) + delta;
    newValue = Math.max(1, Math.min(newValue, maxQty));
    input.value = newValue;
};

/**
 * Validate quantity input
 */
window.validateQty = function(qbItem, maxQty) {
    const input = document.getElementById(`qty-${qbItem}`);
    if (!input) return;

    let value = parseInt(input.value) || 1;
    value = Math.max(1, Math.min(value, maxQty));
    input.value = value;
};

/**
 * Add stock product to cart
 */
window.addStockToCart = async function(qbItem) {
    const input = document.getElementById(`qty-${qbItem}`);
    const qty = input ? parseInt(input.value) || 1 : 1;
    const btn = document.querySelector(`button.btn-stock-add[onclick*="${qbItem}"]`);

    console.log('🛒 Adding to cart:', qbItem, 'qty:', qty);

    // Get product data from state
    const product = CatalogState.products.find(p => p.qbItem === qbItem);
    if (!product) {
        console.error('Product not found in state:', qbItem);
        if (window.UISystem && window.UISystem.showToast) {
            window.UISystem.showToast('error', 'Product not found. Please refresh the page.');
        }
        return;
    }

    // Get client session
    const sessionData = localStorage.getItem('sunshineSession');
    if (!sessionData) {
        console.error('No session found');
        if (window.UISystem && window.UISystem.showToast) {
            window.UISystem.showToast('error', 'Please login to add items to cart');
        }
        return;
    }

    const session = JSON.parse(sessionData);
    const clientCode = session.accessCode;
    const clientName = session.user?.name || session.user?.companyName || 'Client';

    // Get sessionId from CartSystem (not from sunshineSession)
    const sessionId = window.CartSystem?.state?.sessionId;
    if (!sessionId) {
        console.error('Cart session not initialized');
        if (window.UISystem && window.UISystem.showToast) {
            window.UISystem.showToast('error', 'Cart not ready. Please try again.');
        }
        return;
    }

    // Show loading state
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }

    try {
        // Build image path - uses R2 in production
        const imagePath = getThumbnailUrl(sanitizeImageName(product.name));

        const response = await fetch('/api/cart/add-catalog', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId,
                clientCode,
                clientName,
                qbItem: product.qbItem,
                productName: product.name || product.qbItem,
                category: product.category || product.displayCategory || 'Stock Product',
                catalogCategory: product.catalogCategory || null,  // ✅ Para categorização correta no carrinho
                quantity: qty,
                unitPrice: product.basePrice || 0,
                thumbnailUrl: imagePath
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to add to cart');
        }

        console.log('✅ Added to cart:', data);

        // Update cart UI
        if (window.CartSystem && window.CartSystem.loadCart) {
            await window.CartSystem.loadCart();
        }

        // ✅ UPDATE LOCAL STATE - Decrementar estoque no state local
        const productIndex = CatalogState.products.findIndex(p => p.qbItem === qbItem);
        if (productIndex !== -1) {
            const currentStock = CatalogState.products[productIndex].availableStock ??
                                 CatalogState.products[productIndex].currentStock ??
                                 CatalogState.products[productIndex].stock ?? 0;
            const newStock = Math.max(0, currentStock - qty);
            CatalogState.products[productIndex].availableStock = newStock;

            // Atualizar o card na UI
            const stockCard = document.querySelector(`.stock-card[onclick*="'${qbItem}'"]`);
            if (stockCard) {
                // Update stock badge
                const stockBadge = stockCard.querySelector('.stock-badge');
                if (stockBadge) {
                    stockBadge.textContent = newStock > 10 ? 'In Stock' : newStock > 0 ? `${newStock} left` : 'Out of Stock';
                    stockBadge.className = `stock-badge ${newStock > 10 ? 'in-stock' : newStock > 0 ? 'low-stock' : 'out-of-stock'}`;
                }

                // Update units display
                const stockQty = stockCard.querySelector('.stock-qty');
                if (stockQty) {
                    stockQty.innerHTML = `<i class="fas fa-boxes"></i> ${newStock} units`;
                }

                // Update qty input max
                const qtyInput = stockCard.querySelector(`#qty-${qbItem}`);
                if (qtyInput) {
                    qtyInput.max = newStock;
                    if (parseInt(qtyInput.value) > newStock) {
                        qtyInput.value = Math.max(1, newStock);
                    }
                }

                // Update +/- buttons onclick with new maxQty
                const minusBtn = stockCard.querySelector('.qty-minus');
                const plusBtn = stockCard.querySelector('.qty-plus');
                if (minusBtn) minusBtn.onclick = () => adjustQty(qbItem, -1, newStock);
                if (plusBtn) plusBtn.onclick = () => adjustQty(qbItem, 1, newStock);

                // If out of stock, update card class and hide add controls
                if (newStock === 0) {
                    stockCard.classList.add('out-of-stock');
                    const actionRow = stockCard.querySelector('.stock-action-row');
                    const footer = stockCard.querySelector('.stock-footer');
                    if (actionRow) {
                        actionRow.remove();
                    }
                    if (footer && !footer.querySelector('.out-of-stock-label')) {
                        footer.innerHTML = '<span class="out-of-stock-label">Unavailable</span>';
                    }
                }
            }
            console.log(`📊 Local stock updated: ${qbItem} now has ${newStock} available`);
        }

        // ✅ REMOVIDO: Toast de sucesso (usuário prefere sem notificação)
        // O botão já mostra feedback visual "Added" temporariamente

        // Reset quantity to 1 after successful add
        if (input) input.value = 1;

        // Update button state
        if (btn) {
            btn.innerHTML = '<i class="fas fa-check"></i> Added';
            btn.classList.add('added');
            setTimeout(() => {
                btn.innerHTML = '<i class="fas fa-cart-plus"></i> Add';
                btn.classList.remove('added');
                btn.disabled = false;
            }, 2000);
        }

    } catch (error) {
        console.error('Error adding to cart:', error);

        // Show error toast
        if (window.UISystem && window.UISystem.showToast) {
            window.UISystem.showToast('error', error.message || 'Failed to add to cart');
        }

        // Reset button
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-cart-plus"></i> Add';
        }
    }
};

// ============================================
// BREADCRUMB
// ============================================

function updateCatalogBreadcrumb(items) {
    const container = document.getElementById('breadcrumbContainer');
    if (!container) return;

    container.style.display = 'block';

    const breadcrumb = container.querySelector('.breadcrumb') || container;
    const pathElement = breadcrumb.querySelector('#breadcrumbPath') || breadcrumb;

    // Se está na homepage, esconder o breadcrumb ou mostrar mensagem simples
    if (items.length === 1 && items[0].name === 'Home' && !items[0].path) {
        // Esconder breadcrumb na homepage - a mensagem "Welcome" já está no header
        container.style.display = 'none';
        return;
    }

    let html = '';

    items.forEach((item, index) => {
        const isLast = index === items.length - 1;

        if (item.path === 'home') {
            html += `<button class="breadcrumb-item back-btn" onclick="goBackOneLevel()">
                <i class="fas fa-arrow-left"></i> Back
            </button>`;
        } else if (item.path?.startsWith('category:')) {
            const catKey = item.path.replace('category:', '');
            html += `<span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>`;
            html += `<button class="breadcrumb-item" onclick="openCategory('${catKey}')">${item.name}</button>`;
        } else if (isLast) {
            if (index > 0) {
                html += `<span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>`;
            }
            html += `<span class="breadcrumb-item current">${item.name}</span>`;
        }
    });

    pathElement.innerHTML = html;

    // Esconder elementos extras do breadcrumb (preços, contagem) que são da galeria
    const priceBadge = document.getElementById('breadcrumbPriceBadge');
    const photoCount = document.getElementById('breadcrumbPhotoCount');
    const priceHint = document.getElementById('breadcrumbPriceHint');
    if (priceBadge) priceBadge.style.display = 'none';
    if (photoCount) photoCount.style.display = 'none';
    if (priceHint) priceHint.style.display = 'none';
}

// ============================================
// NAVIGATION HELPERS
// ============================================

/**
 * Navigate from header button
 */
window.navigateFromHeader = function(categoryKey) {
    openCategory(categoryKey);
};

/**
 * Navigate to root (homepage)
 */
window.navigateToRoot = function() {
    showHomepage();
};

function setActiveNavButton(categoryKey) {
    clearActiveNavButtons();

    const buttons = document.querySelectorAll('#simpleNav button');
    const categoryMap = {
        'natural-cowhides': 0,
        'specialty-cowhides': 0, // Cowhides button
        'small-accent-hides': 1,
        'patchwork-rugs': 2,
        'accessories': 3,
        'furniture': 4
    };

    const index = categoryMap[categoryKey];
    if (index !== undefined && buttons[index]) {
        buttons[index].style.background = 'rgba(255,255,255,0.3)';
    }
}

function clearActiveNavButtons() {
    document.querySelectorAll('#simpleNav button').forEach(btn => {
        btn.style.background = 'rgba(255,255,255,0.15)';
    });
}

// ============================================
// UI HELPERS
// ============================================

function hidePhotoContainers() {
    // Usar a função global se disponível (garante exclusão mútua)
    if (window.hideAllContainers) {
        window.hideAllContainers();
    } else {
        // Fallback manual
        const containers = ['categoriesContainer', 'foldersContainer', 'photosContainer', 'noContentMessage'];
        containers.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }
}

function showPhotoContainers() {
    // Esconder catalog primeiro
    const catalogContainer = document.getElementById('catalogContainer');
    if (catalogContainer) {
        catalogContainer.style.display = 'none';
    }

    // Mostrar containers da galeria
    const containers = ['breadcrumbContainer'];
    containers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'block';
    });
}

// ============================================
// EXPORTS FOR COMPATIBILITY
// ============================================

window.MAIN_CATEGORIES = MAIN_CATEGORIES;
window.toggleNavDropdown = function() {}; // Legacy - not used anymore
window.navigateTo = function(cat, sub, type) {
    // Legacy function - redirect to new system
    const mapping = {
        'cowhides': 'natural-cowhides',
        'small-hides': 'small-accent-hides',
        'rugs': 'patchwork-rugs',
        'accessories': 'accessories',
        'furniture': 'furniture'
    };
    openCategory(mapping[cat] || cat);
};

console.log('✅ Catalog system loaded');
