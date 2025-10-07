// public/js/client-core.js
/**
 * CLIENT-CORE.JS - SUNSHINE COWHIDES
 * Módulo principal: Estado, navegação e categorias
 * Parte 1/3 da modularização do client.js
 */

// ===== ESTADO GLOBAL DA NAVEGAÇÃO =====
window.navigationState = {
    currentPath: [],
    currentFolderId: null,
    clientData: null,
    allowedCategories: [],
    currentPhotos: [],
    currentPhotoIndex: 0,
    currentCategoryName: null // Para Special Selection
};

// NOVO - Mapa de thumbnails (por enquanto manual, depois virá do banco)
window.categoryThumbnails = {
    // Brazil Best Sellers
    'Best Value - Brindle Medium and Dark Tones Mix ML-XL': 'brindle-novo.webp',
    'Best Value -Salt & Pepper Mix - Black & White': 'salt-pepper-black.webp',
    'Best Value -Salt & Pepper Mix - Brown & White + Tricolor': 'salt-pepper-brown.webp',
    'Best Value -Salt & Pepper Mix - Chocolate & White': 'salt-pepper-chocolate.webp',
    'Dark Tones Mix ML-XL': 'dark-tones-mlxl.webp',
    'Exotic Tones ML-XL': 'exotic-tones-mlxl.webp',
    'Light Tones Mix ML-XL': 'light-tones-mlxl.webp',
    'Super Promo Small - Assorted Natural Tones': 'super-promo-small.webp',
    'Super Promo XS - Assorted Tones': 'super-promo-xs.webp',
    'Tannery Run - Salt & Pepper Mix - Brown & White + Black & White + Tricolor - ML - XL': 'tannery-salt-pepper-mlxl.webp',
    'Tannery Run - Salt & Pepper Mix - Brown & White + Black & White + Tricolor - SMALL': 'tannery-salt-pepper-small.webp',

    // Brazil Top Selected - XL
    'Black & White XL': 'black-white.webp',
    'Black and White Reddish XL': 'black-white-reddish.webp',
    'Brindle Grey XL': 'brindle-grey.webp',
    'Brindle Light Grey-Beige XL': 'brindle-light-grey-beige.webp',
    'Brindle White Backbone XL': 'brindle-white-backbone.webp',
    'Brindle White Belly XL': 'brindle-white-belly.webp',
    'Brown & White XL': 'brown-white.webp',
    'Champagne XL': 'champagne.webp',
    'Grey Beige XL': 'grey-beige.webp',
    'Grey XL': 'grey.webp',
    'Hereford XL': 'hereford.webp',
    'Natural White XL': 'natural-white.webp',
    'Palomino Exotic XL': 'palomino-exotic.webp',
    'Palomino Solid XL': 'palomino-solid.webp',
    'Salt & Pepper - Tricolor, Brown and White XL': 'salt-pepper-tricolor-brown.webp',
    'Salt & Pepper Black and White XL': 'salt-pepper-black.webp',
    'Salt & Pepper Chocolate and White XL': 'salt-pepper-chocolate.webp',
    'Taupe XL': 'taupe.webp',
    'Tricolor XL': 'tricolor.webp',

    // Brazil Top Selected - ML
    'Black & White ML': 'black-white.webp',
    'Black & White Reddish ML': 'black-white-reddish.webp',
    'Brindle Grey ML': 'brindle-grey.webp',
    'Brindle Light Grey-Beige ML': 'brindle-light-grey-beige.webp',
    'Brindle White Backbone ML': 'brindle-white-backbone.webp',
    'Brindle White Belly ML': 'brindle-white-belly.webp',
    'Brown & White ML': 'brown-white.webp',
    'Buttercream ML': 'buttercream.webp',
    'Champagne ML': 'champagne.webp',
    'Grey Beige ML': 'grey-beige.webp',
    'Grey ML': 'grey.webp',
    'Hereford ML': 'hereford.webp',
    'Natural White ML': 'natural-white.webp',
    'Palomino Exotic ML': 'palomino-exotic.webp',
    'Palomino Solid ML': 'palomino-solid.webp',
    'Salt & Pepper - Tricolor, Brown and White ML': 'salt-pepper-tricolor-brown.webp',
    'Salt & Pepper - Tricolor, Brown and White Medium': 'salt-pepper-tricolor-brown.webp',
    'Salt & Pepper Black and White ML': 'salt-pepper-black.webp',
    'Salt & Pepper Chocolate and White ML': 'salt-pepper-chocolate.webp',
    'Taupe ML': 'taupe.webp',
    'Tricolor ML': 'tricolor.webp',

    // Brazil Top Selected - SMALL
    'Black & White Small': 'black-white.webp',
    'Black & White Reddish Small': 'black-white-reddish.webp',
    'Brindle Light Grey-Beige Small': 'brindle-light-grey-beige.webp',
    'Brindle Medium Tone Small': 'brindle-medium-tone.webp',
    'Brindle White Backbone Small': 'brindle-white-backbone.webp',
    'Brindle White Belly Small': 'brindle-white-belly.webp',
    'Brown & White Small': 'brown-white.webp',
    'Champagne Small': 'champagne.webp',
    'Grey Beige Small': 'grey-beige.webp',
    'Grey Small': 'grey.webp',
    'Hereford Small': 'hereford.webp',
    'Natural White Small': 'natural-white.webp',
    'Palomino Exotic Small': 'palomino-exotic.webp',
    'Salt & Pepper - Tricolor, Brown and White Small': 'salt-pepper-tricolor-brown.webp',
    'Salt & Pepper Black and White Small': 'salt-pepper-black.webp',
    'Taupe Small': 'taupe.webp',
    'Tricolor Small': 'tricolor.webp',

    // Colombian Cowhides
    'Black & White M': 'colombian-black-white.webp',
    'Black & White L': 'colombian-black-white.webp',
    'Brindle Mix M': 'colombian-brindle-mix.webp',
    'Brindle Mix L': 'colombian-brindle-mix.webp',
    'Brown & White M': 'colombian-brown-white.webp',
    'Brown & White': 'colombian-brown-white.webp',
    'Exotic M': 'colombian-exotic.webp',
    'Exotic L': 'colombian-exotic.webp',
    'Tricolor Mix M': 'colombian-tricolor-mix.webp',
    'Tricolor Mix L': 'colombian-tricolor-mix.webp',
    'Tricolor Mix XL': 'colombian-tricolor-mix.webp',
    'Tricolor Clouded L': 'colombian-tricolor-clouded.webp',
    'Tricolor Clouded XL': 'colombian-tricolor-clouded.webp',
    'Tricolor Spotted L': 'colombian-tricolor-spotted.webp',
    'Tricolor Spotted XL': 'colombian-tricolor-spotted.webp',

    // Rodeo Rugs
    "3' x 5' Star & Longhorns-Salt and Pepper & Brindle Mix Brazil": 'rodeo-star-longhorns-salt.webp',
    "3' x 5' Star Brazil": 'rodeo-star-brazil.webp',
    "3'x5' Star & Longhorns Colombia": 'rodeo-star-longhorns-colombia.webp',
    "3'x5' Star Colombia": 'rodeo-star-colombia.webp',
    '40" Round Star Colombia': 'rodeo-40-round-star.webp',
    '60" Round Brazil': 'rodeo-60-round-brazil.webp',
    '60" Round Multi Star Colombia': 'rodeo-60-round-multi.webp',

    // Sheepskins
    'Himalayan Exotic Tones': 'sheepskins-himalayan.webp',
    'Tibetan Exotic Tones': 'sheepskins-tibetan.webp',

    // Calfskins
    'Metallica Silver On Black': 'calfskins-metallic-silver.webp',

    // Duffle Bags
    'LUXE BLACK HAIR ON COWHIDE': 'duffle-luxe-black.webp',
    'WELLINGTON BLACK LEATHER WITH DARK BRINDLE HAIR ON ACCENTS': 'duffle-wellington-black-brindle.webp',
    'WELLINGTON BLACK LEATHER WITH S&P BLACK & WHITE HAIR ON ACCENTS': 'duffle-wellington-black-sp.webp',
    'WELLINGTON BLACK LEATHER WITH SOLID BLACK HAIR ON ACCENTS': 'duffle-wellington-black-solid.webp',
    'WELLINGTON BROWN LEATHER WITH DARK BEIGE HAIR ON ACCENTS': 'duffle-wellington-brown-beige.webp',
    'WELLINGTON BROWN LEATHER WITH PALOMINO EXOTIC HAIR ON ACCENTS': 'duffle-wellington-brown-palomino.webp',
    'WELLINGTON BROWN LEATHER WITH S&P BROWN & WHITE HAIR ON ACCENTS': 'duffle-wellington-brown-sp.webp',
    'WELLINGTON COFFEE LEATHER WITH DARK BRINDLE HAIR ON ACCENTS': 'duffle-wellington-coffee-brindle.webp',
    'WELLINGTON COFFEE LEATHER WITH S&P TAUPE AND WHITE HAIR ON ACCENTS': 'duffle-wellington-coffee-taupe.webp',

    // Furniture
    ' PUFF L18XW18XH18 - SALT & PEPPER BLACK & WHITE': 'furniture-puff-sp-black.webp',
    'PUFF L18WX18XH18 - SALT & PEPPER BROWN & WHITE': 'furniture-puff-sp-brown.webp',
    'PUFF L18XW18XH18 - BROWN & WHITE': 'furniture-puff-brown-white.webp',
    'PUFF L18XW18XH18 - PALOMINO & WHITE': 'furniture-puff-palomino.webp',
    'PUFF L18XW18XH18 - SALT & PEPPER TRICOLOR': 'furniture-puff-sp-tricolor.webp'
};

// Função para limpar o nome
window.cleanName = (name) => {
    return name
        .replace('Best Value - ', '')
        .replace('Best Value -', '')
        .replace('Tannery Run - ', '')
        .replace('Super Promo ', '')
        .replace(/^\d+\.\s*/, '');
};

// ===== HELPER PARA REQUISIÇÕES AUTENTICADAS =====
window.fetchWithAuth = async function (url, options = {}) {
    const savedSession = localStorage.getItem('sunshineSession');

    if (savedSession) {
        const session = JSON.parse(savedSession);
        if (session.token) {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${session.token}`
            };
            console.log('🔐 Enviando token JWT para:', url);
        }
    }

    return fetch(url, options);
}

// Compatibilidade
const navigationState = window.navigationState;

// ===== CONFIGURAÇÕES GLOBAIS =====
window.specialSelectionRateRules = null;
window.specialSelectionBasePrice = null;
window.isSpecialSelection = false;

// ===== SISTEMA DE CACHE CENTRALIZADO =====
window.CategoriesCache = {
    data: null,
    timestamp: 0,
    promise: null,
    CACHE_DURATION: 60000, // 60 segundos

    async fetch() {
        const now = Date.now();

        // Cache válido
        if (this.data && (now - this.timestamp < this.CACHE_DURATION)) {
            console.log('✅ Usando cache de categories/filtered');
            return this.data;
        }

        // Requisição em andamento
        if (this.promise) {
            console.log('⏳ Esperando requisição em andamento...');
            return this.promise;
        }

        // Nova requisição
        console.log('🔄 Buscando categories/filtered (nova requisição)');
        this.promise = fetchWithAuth('/api/pricing/categories/filtered')
            .then(response => response.json())
            .then(data => {
                this.data = data;
                this.timestamp = now;
                this.promise = null;
                return data;
            })
            .catch(error => {
                this.promise = null;
                throw error;
            });

        return this.promise;
    },

    clear() {
        this.data = null;
        this.timestamp = 0;
        this.promise = null;
    }
};

// ===== FUNÇÕES UTILITÁRIAS =====
window.safeURL = function (baseURL, params) {
    const url = new URL(baseURL, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.append(key, value);
        }
    });
    return url.toString();
}

window.escapeForJS = function (str) {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
}

window.formatFileSize = function (bytes) {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ===== VERIFICAR PREÇOS =====
window.shouldShowPrices = function () {
    // TEMPORARIAMENTE DESABILITADO DURANTE DESENVOLVIMENTO
    return false;

    /* CÓDIGO ORIGINAL - REATIVAR QUANDO QUISER PREÇOS
    const savedSession = localStorage.getItem('sunshineSession');
    if (savedSession) {
        const session = JSON.parse(savedSession);
        const showPrices = session.user?.showPrices ?? session.client?.showPrices ?? false;
        return showPrices;
    }
    return false;
    */
}

window.updatePriceFilterVisibility = function () {
    const priceFilterSection = document.querySelector('#priceFilters')?.closest('.filter-section');
    if (priceFilterSection) {
        if (shouldShowPrices()) {
            priceFilterSection.style.display = 'block';
        } else {
            priceFilterSection.style.display = 'none';
        }
    }
}

// ===== CARREGAMENTO INICIAL =====
window.loadClientData = async function () {
    const loadingEl = document.getElementById('clientLoading');
    const errorEl = document.getElementById('clientError');
    const contentEl = document.getElementById('clientContent');
    const selectorEl = document.getElementById('gallerySelector');

    // Verificar se já tem modo salvo
    const savedMode = localStorage.getItem('galleryMode');

    if (!savedMode) {
        // Primeira vez - mostrar selector
        loadingEl.style.display = 'none';
        errorEl.style.display = 'none';
        contentEl.style.display = 'none';
        selectorEl.style.display = 'block';

        // Buscar contagens
        document.getElementById('availablePhotoCount').textContent = 'Loading...';
        document.getElementById('comingSoonPhotoCount').textContent = '0 photos';

        return;
    }

    // Mostrar loading
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';
    contentEl.style.display = 'none';
    selectorEl.style.display = 'none';

    try {
        const savedSession = localStorage.getItem('sunshineSession');
        if (!savedSession) {
            throw new Error('Session not found');
        }

        const session = JSON.parse(savedSession);
        if (!session.accessCode) {
            throw new Error('Access code not found');
        }

        const response = await fetchWithAuth(`/api/auth/client/data?code=${encodeURIComponent(session.accessCode)}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Error loading data');
        }

        navigationState.clientData = data;
        navigationState.allowedCategories = data.allowedCategories;

        updateClientInterface(data);
        updatePriceFilterVisibility();
        showCategories();

        if (window.updateFilterVisibility) {
            await window.updateFilterVisibility();
        }

        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';

    } catch (error) {
        console.error('Error loading client data:', error);
        loadingEl.style.display = 'none';
        contentEl.style.display = 'none';
        errorEl.style.display = 'block';
        const errorMsg = document.getElementById('errorMessage');
        errorMsg.textContent = error.message || 'Connection error';
    }
}

function updateClientInterface(data) {
    const { client, allowedCategories } = data;

    // Salvar showPrices
    const savedSession = localStorage.getItem('sunshineSession');
    if (savedSession) {
        const session = JSON.parse(savedSession);
        session.client = { ...session.client, showPrices: client.showPrices };
        localStorage.setItem('sunshineSession', JSON.stringify(session));
    }

    // Atualizar welcome
    const headerWelcome = document.getElementById('headerWelcome');
    if (headerWelcome) {
        headerWelcome.textContent = `Welcome, ${client.name}!`;
    }
}

// ===== MOSTRAR CATEGORIAS =====
window.showCategories = async function () {
    // Parar polling se existir
    if (window.statusCheckInterval) {
        clearInterval(window.statusCheckInterval);
        window.statusCheckInterval = null;
    }

    hideAllContainers();
    updateBreadcrumb();
    updatePriceFilterVisibility();

    // Restaurar visibilidade
    const categoriesContainer = document.getElementById('categoriesContainer');
    if (categoriesContainer) {
        categoriesContainer.style.display = 'grid';
        categoriesContainer.style.visibility = 'visible';
        categoriesContainer.style.opacity = '1';
    }

    const containerEl = document.getElementById('categoriesContainer');

    // Verificar Special Selection
    const savedSession = localStorage.getItem('sunshineSession');
    if (savedSession) {
        const session = JSON.parse(savedSession);
        if (session.user?.accessType === 'special') {
            window.isSpecialSelection = true;

            // Manter sidebar visível mas vazia
            const sidebar = document.getElementById('filterSidebar');
            if (sidebar) {
                sidebar.style.display = 'block';
                const filterContainer = sidebar.querySelector('.filter-container');
                if (filterContainer) {
                    filterContainer.style.display = 'none';
                }
            }

            try {
                const data = await CategoriesCache.fetch();

                if (data.isSpecialSelection) {
                    // Se tem apenas 1 categoria, ir direto
                    if (data.categories.length === 1 && data.categories[0].id === 'special_selection') {
                        containerEl.innerHTML = `
                            <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                                <h2>Loading Special Selection...</h2>
                                <div class="spinner"></div>
                            </div>
                        `;

                        setTimeout(() => {
                            if (window.loadPhotos) {
                                window.loadPhotos('special_selection');
                            }
                        }, 1000);
                        return;
                    }

                    // Múltiplas categorias virtuais
                    containerEl.innerHTML = data.categories.map(category => `
                        <div class="category-card special-category" onclick="loadPhotos('${category.id}')">
                            <h3>
                                <i class="fas fa-star"></i> 
                                ${category.name}
                            </h3>
                            <p>Special Selection Category</p>
                            <div class="folder-stats">
                                ${shouldShowPrices() && category.formattedPrice ?
                            `<span class="folder-price-badge"><i class="fas fa-tag"></i> ${category.formattedPrice}</span>` :
                            (!shouldShowPrices() && category.formattedPrice ?
                                '<span class="contact-price"><i class="fas fa-phone"></i> Contact for Price</span>' : '')}
                            </div>
                            <div class="category-action">
                                <i class="fas fa-arrow-right"></i>
                                <span>View Selection</span>
                            </div>
                        </div>
                    `).join('');
                    return;
                }
            } catch (error) {
                console.error('Erro ao buscar Special Selection:', error);
            }
        }
    }

    // CATEGORIAS NORMAIS
    const { allowedCategories } = navigationState;

    if (allowedCategories.length === 0) {
        showNoContent('No categories available', 'Please contact the administrator to verify your permissions.');
        return;
    }

    try {
        const data = await CategoriesCache.fetch();

        // Criar mapa de dados
        const categoryDataMap = {};
        if (data.categories) {
            data.categories.forEach(cat => {
                const mainName = cat.name.split(' → ')[0];
                if (!categoryDataMap[mainName]) {
                    categoryDataMap[mainName] = {
                        totalPhotos: 0,
                        minPrice: null,
                        maxPrice: null,
                        categories: []
                    };
                }
                categoryDataMap[mainName].totalPhotos += cat.photoCount || 0;
                categoryDataMap[mainName].categories.push(cat);

                const price = cat.price || 0;
                if (price > 0) {
                    if (!categoryDataMap[mainName].minPrice || price < categoryDataMap[mainName].minPrice) {
                        categoryDataMap[mainName].minPrice = price;
                    }
                    if (!categoryDataMap[mainName].maxPrice || price > categoryDataMap[mainName].maxPrice) {
                        categoryDataMap[mainName].maxPrice = price;
                    }
                }
            });
        }

        // Gerar cards
        containerEl.innerHTML = allowedCategories.map(category => {
            const stats = categoryDataMap[category.name] || {};
            const priceRange = shouldShowPrices()
                ? ((stats.minPrice && stats.maxPrice)
                    ? (stats.minPrice === stats.maxPrice
                        ? `$${stats.minPrice.toFixed(2)}`
                        : `$${stats.minPrice.toFixed(2)} - $${stats.maxPrice.toFixed(2)}`)
                    : 'Price on request')
                : 'Contact for Price';

            const description = getMainCategoryDescription(category.name);

            return `
                <div class="category-card" onclick="navigateToCategory('${category.id}', '${escapeForJS(category.name)}')">
                    <h3>${category.name}</h3>
                    <p>${description}</p>
                    <div class="folder-stats">
                        ${shouldShowPrices() && priceRange !== 'Price on request' ?
                    `<span class="folder-price-badge"><i class="fas fa-tag"></i> ${priceRange}</span>` :
                    (!shouldShowPrices() ? '<span class="contact-price"><i class="fas fa-phone"></i> Contact for Price</span>' : '')}
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Erro ao buscar dados das categorias:', error);
        // Fallback simples
        containerEl.innerHTML = allowedCategories.map(category => `
            <div class="category-card" onclick="navigateToCategory('${category.id}', '${escapeForJS(category.name)}')">
                <h3>${category.name}</h3>
                <p>Category with full navigation access enabled</p>
            </div>
        `).join('');
    }

    document.getElementById('breadcrumbContainer').style.display = 'block';
    document.getElementById('backNavigation').style.display = 'none';

    // Atualizar filtros dinâmicos quando voltar às categorias
    if (window.setupDynamicFilters) {
        setTimeout(() => window.setupDynamicFilters(), 500);
    }
}

// ===== NAVEGAÇÃO =====
window.navigateToCategory = async function (categoryId, categoryName) {
    navigationState.currentPath = [{ id: categoryId, name: categoryName }];
    navigationState.currentFolderId = categoryId;
    updateBreadcrumb();
    await loadFolderContents(categoryId);
}

window.navigateToSubfolder = async function (folderId, folderName) {
    navigationState.currentPath.push({ id: folderId, name: folderName });
    navigationState.currentFolderId = folderId;
    updateBreadcrumb();
    await loadFolderContents(folderId);
}

window.navigateToRoot = function () {
    navigationState.currentPath = [];
    navigationState.currentFolderId = null;
    showCategories();
}

window.navigateBack = async function () {
    if (navigationState.currentPath.length <= 1) {
        navigateToRoot();
        return;
    }

    navigationState.currentPath.pop();
    const target = navigationState.currentPath[navigationState.currentPath.length - 1];
    navigationState.currentFolderId = target.id;

    updateBreadcrumb();
    await loadFolderContents(target.id);
}

window.navigateToBreadcrumb = async function (index) {
    navigationState.currentPath = navigationState.currentPath.slice(0, index + 1);
    const target = navigationState.currentPath[index];
    navigationState.currentFolderId = target.id;

    updateBreadcrumb();
    await loadFolderContents(target.id);
}

// ===== CARREGAR CONTEÚDO DE PASTAS =====
window.loadFolderContents = async function (folderId) {
    try {
        console.time('⏱️ Total loadFolderContents');
        showLoading();

        // Buscar estrutura - USANDO fetchWithAuth
        console.time('  📡 Fetch structure');
        const response = await fetchWithAuth(`/api/gallery/structure?prefix=${encodeURIComponent(folderId)}`);
        const data = await response.json();
        console.timeEnd('  📡 Fetch structure');

        if (!data.success) {
            throw new Error(data.message || 'Error loading folder');
        }

        const folderData = data.structure;

        // Se tem subpastas
        if (folderData.hasSubfolders && folderData.folders.length > 0) {
            try {
                // Buscar dados com preços
                console.time('  💰 Cache preços');
                const priceData = await CategoriesCache.fetch();
                console.timeEnd('  💰 Cache preços');

                // Criar mapa de preços
                const priceMap = {};
                if (priceData.categories) {
                    priceData.categories.forEach(cat => {
                        const parts = cat.name.split(' → ');
                        const folderName = parts[parts.length - 1];
                        priceMap[folderName] = {
                            price: cat.price,
                            formattedPrice: cat.formattedPrice,
                            photoCount: cat.photoCount
                        };
                    });
                }

                // Adicionar preços às pastas
                folderData.folders.forEach(folder => {
                    const priceInfo = priceMap[folder.name] || {};
                    folder.price = priceInfo.price || 0;
                    folder.formattedPrice = priceInfo.formattedPrice || '';
                    folder.photoCount = priceInfo.photoCount || folder.imageCount || 0;
                });
            } catch (error) {
                console.error('Erro ao buscar preços:', error);
            }

            console.time('  🖼️ Render subfolders');
            showSubfolders(folderData.folders);
            console.timeEnd('  🖼️ Render subfolders');

        } else if (folderData.hasImages || folderData.totalImages > 0) {
            // Tem fotos - chamar loadPhotos do gallery module
            if (window.loadPhotos) {
                await window.loadPhotos(folderId);
            }
        } else {
            showNoContent('Empty folder', 'This category has no content at the moment.');
        }
        console.timeEnd('⏱️ Total loadFolderContents');
    } catch (error) {
        console.error('Error loading folder:', error);
        showNoContent('Error loading content', error.message);
    }
}

// ===== MOSTRAR SUBPASTAS =====
window.showSubfolders = function (folders) {
    hideAllContainers();
    hideLoading();
    document.getElementById('foldersContainer').style.display = 'grid';
    document.getElementById('breadcrumbContainer').style.display = 'block';

    const containerEl = document.getElementById('foldersContainer');


    containerEl.innerHTML = folders.map(folder => {
        const description = generateProductDescription(folder.name);
        const hasPhotos = folder.hasImages || folder.imageCount > 0;
        const photoCount = folder.imageCount || folder.photoCount || folder.totalFiles || 0;
        const price = folder.price || 0;
        const formattedPrice = shouldShowPrices()
            ? (folder.formattedPrice || (price > 0 ? `$${price.toFixed(2)}` : ''))
            : '';

        // NOVO - Verificar se tem thumbnail
        const thumbnail = null; // DESATIVADO - Remover fotos sample dos cards

        // Cards sempre sem thumbnail - formato limpo
        return `
        <div class="folder-card" data-folder-id="${folder.id.replace(/"/g, '&quot;')}" data-folder-name="${folder.name.replace(/"/g, '&quot;')}">
            <h4>${folder.name}</h4>
            <div class="folder-description">${description}</div>
            <div class="folder-stats">
                ${shouldShowPrices() && formattedPrice ?
                `<span class="folder-price-badge"><i class="fas fa-tag"></i> ${formattedPrice}</span>` :
                (!shouldShowPrices() ? '<span class="contact-price"><i class="fas fa-phone"></i> Contact for Price</span>' : '')}
            </div>
        </div>
    `;
    }).join('');

    // Event listeners
    setTimeout(() => {
        containerEl.querySelectorAll('.folder-card').forEach(card => {
            card.addEventListener('click', function () {
                const folderId = this.dataset.folderId;
                const folderName = this.dataset.folderName;
                if (folderId && folderName) {
                    navigateToSubfolder(folderId, folderName);
                }
            });
        });
    }, 0);
}

// ===== BREADCRUMB =====
window.updateBreadcrumb = function () {
    const pathEl = document.getElementById('breadcrumbPath');
    const container = document.getElementById('breadcrumbContainer');

    // Se está na home (path vazio), mostrar mensagem orientadora
    if (!navigationState.currentPath || navigationState.currentPath.length === 0) {
        if (pathEl) {
            pathEl.innerHTML = `
                <span class="breadcrumb-home-message">
                    Select a category to begin
                </span>
            `;
        }
        if (container) {
            container.style.display = 'block';
        }
        return;
    }

    const breadcrumbHtml = navigationState.currentPath.map((item, index) => {
        const isLast = index === navigationState.currentPath.length - 1;

        let displayName = item.name;
        if (displayName.includes('→')) {
            const parts = displayName.split('→');
            displayName = parts[parts.length - 1].trim();
        }

        // Remove números apenas para Colombian Cowhides
        if (navigationState.currentPath[0]?.name === 'Colombian Cowhides') {
            displayName = displayName.replace(/^\d+\.\s*/, '');
        }

        if (!item.id && !isLast) {
            return `
                <span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>
                <span class="breadcrumb-item disabled">${displayName}</span>
            `;
        }

        return `
            <span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>
            ${isLast ?
                `<span class="breadcrumb-item current">${displayName}</span>` :
                `<button class="breadcrumb-item" onclick="navigateToBreadcrumb(${index})">${displayName}</button>`
            }
        `;
    }).join('');

    pathEl.innerHTML = breadcrumbHtml;
}

// ===== FUNÇÕES DE UI =====
window.hideAllContainers = function () {
    document.getElementById('categoriesContainer').style.display = 'none';
    document.getElementById('foldersContainer').style.display = 'none';
    document.getElementById('photosContainer').style.display = 'none';
    document.getElementById('noContentMessage').style.display = 'none';
    const loadingEl = document.getElementById('navigationLoading');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

window.showNoContent = function (title, message) {
    hideAllContainers();
    hideLoading();
    document.getElementById('noContentMessage').style.display = 'block';
    document.getElementById('noContentMessage').innerHTML = `
        <i class="fas fa-folder-open fa-3x"></i>
        <h3>${title}</h3>
        <p>${message}</p>
    `;
    document.getElementById('breadcrumbContainer').style.display = 'block';
}

window.showLoading = function () {
    hideAllContainers();
    const categoriesContainer = document.getElementById('categoriesContainer');
    if (categoriesContainer) {
        categoriesContainer.style.display = 'none';
    }
    const loadingEl = document.getElementById('navigationLoading');
    if (loadingEl) {
        loadingEl.style.display = 'flex';
    }
}

window.hideLoading = function () {
    const loadingEl = document.getElementById('navigationLoading');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
    const categoriesContainer = document.getElementById('categoriesContainer');
    if (categoriesContainer) {
        categoriesContainer.style.visibility = 'visible';
        categoriesContainer.style.opacity = '1';
    }
}

// ===== DESCRIÇÕES =====
window.generateProductDescription = function (folderName) {
    const patterns = {
        'Salt & Pepper': 'Mixed pattern with varied tones',
        'Best Value': 'Excellent cost-benefit ratio',
        'Tannery Run': 'Special tannery production',
        'Tricolor': 'Three colors in natural pattern',
        'Brindle': 'Natural tiger stripe pattern',
        'Black & White': 'Classic black and white',
        'Brown & White': 'Natural brown and white',
        'Exotic': 'Unique and special patterns',
        'Small': 'Small size',
        'Medium': 'Medium size',
        'Large': 'Large size',
        'XL': 'Extra large size',
        'ML': 'Medium-large'
    };

    for (const [pattern, desc] of Object.entries(patterns)) {
        if (folderName.includes(pattern)) {
            return desc;
        }
    }

    return 'Selected high-quality leathers';
}

window.getMainCategoryDescription = function (categoryName) {
    const descriptions = {
        'Brazil Best Sellers': 'Best value products with excellent cost-benefit ratio',
        'Brazil Top Selected Categories': 'Premium selection of high-quality leathers',
        'Calfskins': 'Small and delicate calf leathers',
        'Colombian Cowhides': 'Exotic tricolor patterns and unique combinations',
        'Rodeo Rugs': 'Handcrafted rugs with custom designs',
        'Sheepskins': 'Soft and luxurious sheep fur'
    };
    return descriptions[categoryName] || 'Selected high-quality leathers';
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Client Core carregado');

    // Carregar dados iniciais
    loadClientData();

    // Inicializar botão scroll to top
    const scrollBtn = document.getElementById('scrollToTop');
    if (scrollBtn) {
        // Mostrar/esconder baseado no scroll
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                scrollBtn.classList.add('show');
            } else {
                scrollBtn.classList.remove('show');
            }
        });

        // Voltar ao topo quando clicar
        scrollBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // Setup keyboard se necessário
    if (window.setupKeyboardNavigation) {
        window.setupKeyboardNavigation();
    }
});

// ===== DROPDOWN DE FILTROS NO HEADER (APENAS DESKTOP) =====
window.toggleFiltersDropdown = function () {
    // Só funciona no desktop - proteção dupla
    if (window.innerWidth <= 768) return;

    const dropdown = document.getElementById('filtersDropdown');
    const button = document.querySelector('.header-filters-btn');

    if (!dropdown || !button) return;

    // Toggle do dropdown
    const isOpen = dropdown.classList.contains('show');

    if (isOpen) {
        dropdown.classList.remove('show');
        button.classList.remove('active');
    } else {
        dropdown.classList.add('show');
        button.classList.add('active');
    }
}

// Fechar dropdown quando clicar fora
document.addEventListener('click', function (event) {
    // Só no desktop
    if (window.innerWidth <= 768) return;

    const dropdown = document.getElementById('filtersDropdown');
    const button = document.querySelector('.header-filters-btn');

    if (!dropdown || !button) return;

    // Se clicou fora do dropdown e do botão
    if (!event.target.closest('.header-filters-dropdown')) {
        dropdown.classList.remove('show');
        button.classList.remove('active');
    }
});

console.log('📦 client-core.js carregado - Módulo de navegação pronto');