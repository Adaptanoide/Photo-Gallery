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
    allowedCatalogCategories: [], // NOVO: Categorias de catálogo/stock permitidas
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
    // REATIVADO - Verifica se cliente pode ver preços
    const savedSession = localStorage.getItem('sunshineSession');
    if (savedSession) {
        const session = JSON.parse(savedSession);
        const showPrices = session.user?.showPrices ?? session.client?.showPrices ?? false;
        return showPrices;
    }
    return false;
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

    // Ocultar loading/error
    loadingEl.style.display = 'none';
    errorEl.style.display = 'none';
    contentEl.style.display = 'none';

    // ✅ IR DIRETO PARA GALERIA AVAILABLE (Coming Soon desabilitado)
    selectGalleryMode('available');
}

// ===== NOVA FUNÇÃO: Carregar dados APÓS escolher galeria =====
window.loadClientDataAfterMode = async function () {
    const loadingEl = document.getElementById('clientLoading');
    const errorEl = document.getElementById('clientError');
    const contentEl = document.getElementById('clientContent');
    const navLoading = document.getElementById('navigationLoading');
    const catalogContainer = document.getElementById('catalogContainer');

    // 🗑️ LIMPAR APENAS catalogContainer (homepage cards)
    // NÃO limpar categoriesContainer/contentContainer (usado para galeria de fotos)
    if (catalogContainer) {
        catalogContainer.innerHTML = ''; // Limpar cards antigos do cache
        catalogContainer.style.display = 'none'; // Esconder durante loading
    }

    // Mostrar área de conteúdo com loading de 3 pontos
    loadingEl.style.display = 'none';
    errorEl.style.display = 'none';
    contentEl.style.display = 'block'; // ✅ Mostrar conteúdo AGORA
    if (navLoading) navLoading.style.display = 'flex'; // ✅ Mostrar loading de 3 pontos VISÍVEL

    try {
        const savedSession = localStorage.getItem('sunshineSession');
        if (!savedSession) {
            throw new Error('Session not found');
        }

        const session = JSON.parse(savedSession);
        if (!session.accessCode) {
            throw new Error('Access code not found');
        }

        // ⏱️ Criar promessa de delay mínimo de 2.5 segundos
        const minLoadingTime = new Promise(resolve => setTimeout(resolve, 2500));

        // 🔄 Carregar dados do servidor
        const dataPromise = fetchWithAuth(`/api/auth/client/data?code=${encodeURIComponent(session.accessCode)}`)
            .then(response => response.json());

        // ⏳ Esperar AMBOS: dados carregarem E 2.5 segundos passarem
        const [data] = await Promise.all([dataPromise, minLoadingTime]);

        if (!data.success) {
            throw new Error(data.message || 'Error loading data');
        }

        navigationState.clientData = data;
        navigationState.allowedCategories = data.allowedCategories;
        navigationState.allowedCatalogCategories = data.allowedCatalogCategories || []; // NOVO

        console.log('🔐 Permissões carregadas:', {
            catalogCats: navigationState.allowedCatalogCategories.length,
            photoCats: navigationState.allowedCategories.length
        });

        updateClientInterface(data);
        updatePriceFilterVisibility();

        // ✅ SEMPRE mostrar homepage com as permissões corretas (sistema de catálogo)
        console.log('📦 Renderizando homepage com permissões após 2.5s...');
        if (window.showHomepage) {
            window.showHomepage(); // Renderiza homepage com permissões já carregadas
        }

        if (window.updateFilterVisibility) {
            await window.updateFilterVisibility();
        }

        // ✅ Esconder loading de 3 pontos DEPOIS de renderizar
        if (navLoading) navLoading.style.display = 'none';
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

    // Salvar showPrices e outros dados do cliente
    const savedSession = localStorage.getItem('sunshineSession');
    if (savedSession) {
        const session = JSON.parse(savedSession);
        session.client = { ...session.client, showPrices: client.showPrices };
        session.user = {
            ...session.user,
            name: client.name,
            email: client.email,
            phone: client.phone,
            companyName: client.companyName
        };
        localStorage.setItem('sunshineSession', JSON.stringify(session));
    }

    // Atualizar welcome
    const headerWelcome = document.getElementById('headerWelcome');
    if (headerWelcome) {
        headerWelcome.textContent = `Welcome, ${client.name}!`;
    }

    // Atualizar dropdown de perfil se existir
    if (window.updateDropdownUserInfo) {
        window.updateDropdownUserInfo();
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
                        ? (window.CurrencyManager ? CurrencyManager.format(stats.minPrice) : `$${stats.minPrice.toFixed(2)}`)
                        : (window.CurrencyManager ? `${CurrencyManager.format(stats.minPrice)} - ${CurrencyManager.format(stats.maxPrice)}` : `$${stats.minPrice.toFixed(2)} - $${stats.maxPrice.toFixed(2)}`))
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
    // ✅ Sempre redirecionar para a homepage do catálogo
    console.log('🏠 navigateToRoot → Catalog Homepage');
    navigationState.currentPath = [];
    navigationState.currentFolderId = null;

    // Usar sistema de catálogo se disponível
    if (window.showHomepage) {
        window.showHomepage();
    } else {
        // Fallback para galeria antiga
        showCategories();
    }
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

    // ✅ DETECTAR se está em Coming Soon
    if (window.navigationState.isComingSoon) {
        console.log('🚢 Breadcrumb Coming Soon:', target.id);

        if (target.id === 'transit') {
            // Voltou para raiz do Coming Soon
            window.loadComingSoonCategories();
        } else {
            // Navegar para subnível
            window.loadComingSoonSubcategories(target.id, target.name);
        }
    } else {
        // Galeria normal
        await loadFolderContents(target.id);
    }
}

// ===== CARREGAR CONTEÚDO DE PASTAS =====
window.loadFolderContents = async function (folderId) {
    try {
        showLoading();

        // Buscar estrutura - USANDO fetchWithAuth
        const response = await fetchWithAuth(`/api/gallery/structure?prefix=${encodeURIComponent(folderId)}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Error loading folder');
        }

        const folderData = data.structure;

        // Se tem subpastas
        if (folderData.hasSubfolders && folderData.folders.length > 0) {
            try {
                // Buscar dados com preços
                const priceData = await CategoriesCache.fetch();

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

            showSubfolders(folderData.folders);

        } else if (folderData.hasImages || folderData.totalImages > 0) {
            // Tem fotos - chamar loadPhotos do gallery module
            if (window.loadPhotos) {
                await window.loadPhotos(folderId);
            }
        } else {
            showNoContent('Empty folder', 'This category has no content at the moment.');
        }
    } catch (error) {
        console.error('Error loading folder:', error);
        showNoContent('Error loading content', error.message);
    }
}

// ===== MOSTRAR SUBPASTAS =====

window.showSubfolders = function (folders) {
    // Armazenar folders para re-renderização quando moeda mudar
    window.lastLoadedFolders = folders;

    hideAllContainers();
    hideLoading();
    document.getElementById('foldersContainer').style.display = 'grid';
    document.getElementById('breadcrumbContainer').style.display = 'block';

    // ✅ Mostrar category header se houver contexto do catálogo
    const ctx = window.CatalogState?.breadcrumbContext;
    if (ctx && ctx.subcategoryName) {
        // Buscar descrição e ícone da subcategoria
        const category = window.MAIN_CATEGORIES?.[ctx.categoryKey];
        const subcategory = category?.subcategories?.[ctx.subcategoryKey];
        const description = subcategory?.description || '';
        const icon = category?.icon || 'fa-folder';

        window.updateCategoryHeader(ctx.subcategoryName, description, icon);
    } else {
        window.hideCategoryHeader();
    }

    const containerEl = document.getElementById('foldersContainer');

    containerEl.innerHTML = folders.map(folder => {
        const description = generateProductDescription(folder.name);
        const hasPhotos = folder.hasImages || folder.imageCount > 0;

        // ✅ Usar availableCount do backend
        const availableCount = folder.availableCount || 0;
        const hasAvailablePhotos = folder.hasAvailablePhotos || availableCount > 0;

        const photoCount = folder.imageCount || folder.photoCount || folder.totalFiles || 0;
        const price = folder.price || 0;
        const formattedPrice = shouldShowPrices()
            ? (price > 0
                ? (window.CurrencyManager ? CurrencyManager.format(price) : `$${price.toFixed(2)}`)
                : (folder.formattedPrice || ''))
            : '';

        // ✅ Verificar se tem subcategorias
        const hasSubfolders = folder.hasSubfolders || false;

        // ✅ Classe CSS para cards sem estoque APENAS em níveis finais
        const outOfStockClass = (!hasAvailablePhotos && !hasSubfolders) ? 'out-of-stock' : '';

        // ✅ Limpar nome para exibição (remove "1.", "2.", etc.)
        const displayName = window.cleanName ? window.cleanName(folder.name) : folder.name;

        return `
            <div class="folder-card ${outOfStockClass}"
                data-folder-id="${folder.id.replace(/"/g, '&quot;')}"
                data-folder-name="${folder.name.replace(/"/g, '&quot;')}"
                data-has-subfolders="${hasSubfolders}"
                data-available-count="${availableCount}">

                <div class="folder-card-header">
                    <h4>${displayName}</h4>
                </div>
                
                <div class="folder-description">${description}</div>
                
                <div class="folder-stats">
                    <!-- PREÇO À ESQUERDA -->
                    ${shouldShowPrices() && formattedPrice ?
                `<span class="folder-price-badge"><i class="fas fa-tag"></i> ${formattedPrice}</span>` :
                (!shouldShowPrices() ? '<span class="contact-price"><i class="fas fa-phone"></i> Contact for Price</span>' : '')}
                    
                    <!-- CONTADOR OU OUT OF STOCK À DIREITA -->
                    ${!hasSubfolders ? `
                        ${hasAvailablePhotos ? `
                            <div class="photo-count-badge">
                                <i class="fas fa-box"></i>
                                <span class="count-text">${availableCount} ${availableCount === 1 ? 'product' : 'products'}</span>
                            </div>
                        ` : `
                            <div class="out-of-stock-inline">
                                <i class="fas fa-box-open"></i>
                                <span class="out-text">OUT OF STOCK</span>
                            </div>
                        `}
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    setTimeout(() => {
        containerEl.querySelectorAll('.folder-card').forEach(card => {
            card.addEventListener('click', function () {
                const folderId = this.dataset.folderId;
                const folderName = this.dataset.folderName;

                if (folderId && folderName) {
                    if (window.navigationState.isComingSoon) {
                        console.log('🚢 Clique em card Coming Soon:', folderId);
                        const hasSubfolders = this.dataset.hasSubfolders === 'true';

                        if (hasSubfolders) {
                            console.log('   → É path, carregando subnível...');
                            window.loadComingSoonSubcategories(folderId, folderName);
                        } else {
                            console.log('   → É qbItem, carregando fotos...');
                            navigationState.currentPath.push({
                                id: folderId,
                                name: folderName
                            });
                            navigationState.currentFolderId = folderId;
                            updateBreadcrumb();
                            window.loadPhotos(folderId);
                        }
                    } else {
                        navigateToSubfolder(folderId, folderName);
                    }
                }
            });
        });
    }, 0);
}

// ===== BREADCRUMB =====
window.updateBreadcrumb = function () {
    const pathEl = document.getElementById('breadcrumbPath');
    const container = document.getElementById('breadcrumbContainer');

    // Referência ao Back button fixo do HTML
    const fixedBackBtn = container?.querySelector('.breadcrumb > .back-btn');

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
        // Mostrar Back fixo quando não há contexto
        if (fixedBackBtn) fixedBackBtn.style.display = 'flex';
        return;
    }

    // ✅ Verificar se há contexto do catálogo
    const ctx = window.CatalogState?.breadcrumbContext;
    let catalogPrefixHtml = '';

    if (ctx && ctx.categoryKey) {
        // Esconder Back fixo do HTML (vamos usar o do JavaScript)
        if (fixedBackBtn) fixedBackBtn.style.display = 'none';

        // Back button do catálogo
        catalogPrefixHtml += `
            <button class="breadcrumb-item back-btn catalog-back" onclick="window.goBackOneLevel()">
                <i class="fas fa-arrow-left"></i> Back
            </button>
        `;
        // Categoria principal (ex: Natural Cowhides)
        catalogPrefixHtml += `
            <span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>
            <button class="breadcrumb-item" onclick="window.openCategory('${ctx.categoryKey}')">${ctx.categoryName}</button>
        `;
    } else {
        // Mostrar Back fixo quando não há contexto do catálogo
        if (fixedBackBtn) fixedBackBtn.style.display = 'flex';
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

    pathEl.innerHTML = catalogPrefixHtml + breadcrumbHtml;
}

// ===== FUNÇÕES DE UI =====
window.hideAllContainers = function () {
    document.getElementById('categoriesContainer').style.display = 'none';
    document.getElementById('foldersContainer').style.display = 'none';
    document.getElementById('photosContainer').style.display = 'none';
    document.getElementById('noContentMessage').style.display = 'none';

    // Esconder também o catalogContainer (sistema de homepage)
    const catalogContainer = document.getElementById('catalogContainer');
    if (catalogContainer) {
        catalogContainer.style.display = 'none';
    }

    // Esconder category header
    const categoryHeaderContainer = document.getElementById('categoryHeaderContainer');
    if (categoryHeaderContainer) {
        categoryHeaderContainer.style.display = 'none';
    }

    const loadingEl = document.getElementById('navigationLoading');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }

    // Limpar breadcrumb info quando não estiver em fotos
    const breadcrumbPriceBadge = document.getElementById('breadcrumbPriceBadge');
    if (breadcrumbPriceBadge) {
        breadcrumbPriceBadge.innerHTML = '';
        breadcrumbPriceBadge.className = 'breadcrumb-price-badge';
    }
    const breadcrumbPhotoCount = document.getElementById('breadcrumbPhotoCount');
    if (breadcrumbPhotoCount) {
        breadcrumbPhotoCount.innerHTML = '';
    }
}

// ===== CATEGORY HEADER - Título + Descrição =====
window.updateCategoryHeader = function (title, description, icon = null) {
    const container = document.getElementById('categoryHeaderContainer');
    const titleEl = document.getElementById('categoryHeaderTitle');
    const descEl = document.getElementById('categoryHeaderDescription');

    if (!container || !titleEl || !descEl) return;

    if (title) {
        // Clean title without icons
        titleEl.innerHTML = `<span>${title}</span>`;
        descEl.textContent = description || '';
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
}

window.hideCategoryHeader = function () {
    const container = document.getElementById('categoryHeaderContainer');
    if (container) {
        container.style.display = 'none';
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

    // Mostrar nome do cliente no loading inicial
    try {
        const savedSession = localStorage.getItem('sunshineSession');
        if (savedSession) {
            const session = JSON.parse(savedSession);
            const welcomeNameEl = document.getElementById('clientWelcomeName');
            if (welcomeNameEl && session.user && session.user.name) {
                welcomeNameEl.textContent = session.user.name;
            }
        }
    } catch (error) {
        console.error('Erro ao carregar nome do cliente:', error);
    }

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

// ===== BARRA DE BUSCA EXPANSÍVEL =====
window.toggleSearchExpand = function() {
    const searchContainer = document.querySelector('.search-container');
    if (!searchContainer) return;

    const isExpanded = searchContainer.classList.contains('expanded');

    if (isExpanded) {
        searchContainer.classList.remove('expanded');
        const input = searchContainer.querySelector('.search-input');
        if (input) input.value = '';
    } else {
        searchContainer.classList.add('expanded');
        const input = searchContainer.querySelector('.search-input');
        if (input) {
            setTimeout(() => input.focus(), 100);
        }
    }
};

// Fechar busca ao clicar fora
document.addEventListener('click', function(event) {
    const searchContainer = document.querySelector('.search-container');
    if (!searchContainer) return;

    // For compact mode
    if (!event.target.closest('.search-container') && searchContainer.classList.contains('expanded')) {
        searchContainer.classList.remove('expanded');
    }

    // For always-visible mode - close suggestions
    const suggestionsDropdown = document.getElementById('searchSuggestionsDropdown');
    if (suggestionsDropdown && !event.target.closest('.search-container')) {
        suggestionsDropdown.classList.remove('show');
    }
});

// ===== GLOBAL SEARCH FUNCTIONALITY =====
window.clearSearch = function() {
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    const suggestionsDropdown = document.getElementById('searchSuggestionsDropdown');
    if (suggestionsDropdown) {
        suggestionsDropdown.classList.remove('show');
        suggestionsDropdown.innerHTML = '';
    }
};

// Search cache for products
let searchProductsCache = null;
let searchCacheTimestamp = 0;
const SEARCH_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ❌ DESATIVADO - Busca unificada agora está em client-commerce.js
// O listener duplicado causava sobreposição de dropdowns
// As funções getSearchProducts() e performSearch() ainda estão disponíveis para uso
/*
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('globalSearch');
    if (!searchInput) return;

    let searchTimeout = null;

    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.trim();

        // Clear previous timeout
        if (searchTimeout) clearTimeout(searchTimeout);

        // Hide suggestions if query is empty
        if (query.length < 2) {
            const dropdown = document.getElementById('searchSuggestionsDropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
                dropdown.innerHTML = '';
            }
            return;
        }

        // Debounce search
        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 300);
    });

    // Handle Enter key
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const query = e.target.value.trim();
            if (query.length >= 2) {
                performSearch(query, true);
            }
        }
        if (e.key === 'Escape') {
            const dropdown = document.getElementById('searchSuggestionsDropdown');
            if (dropdown) dropdown.classList.remove('show');
        }
    });
});
*/

// Perform search and show results
async function performSearch(query, showAll = false) {
    const dropdown = document.getElementById('searchSuggestionsDropdown');
    if (!dropdown) return;

    // Show loading
    dropdown.innerHTML = '<div class="search-loading" style="padding: 20px; text-align: center;"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
    dropdown.classList.add('show');

    try {
        // Get products from cache or API
        const products = await getSearchProducts();

        // Filter products by query
        const queryLower = query.toLowerCase();
        const matches = products.filter(p => {
            const name = (p.name || '').toLowerCase();
            const qbItem = (p.qbItem || '').toLowerCase();
            const category = (p.category || '').toLowerCase();
            return name.includes(queryLower) || qbItem.includes(queryLower) || category.includes(queryLower);
        });

        // Render results
        if (matches.length === 0) {
            dropdown.innerHTML = `
                <div class="search-no-results">
                    <i class="fas fa-search"></i>
                    No products found for "${query}"
                </div>
            `;
        } else {
            const resultsToShow = showAll ? matches : matches.slice(0, 8);
            let html = '';

            for (const product of resultsToShow) {
                const price = product.price || product.basePrice;
                const formattedPrice = price ? (window.formatPrice ? window.formatPrice(price) : `$${price.toFixed(2)}`) : '';
                const stock = product.stock || 0;
                const stockClass = stock > 0 ? '' : 'out-of-stock';

                html += `
                    <div class="search-suggestion-item ${stockClass}" onclick="openSearchResult('${product.qbItem}')">
                        <div class="suggestion-icon">
                            <i class="fas fa-tag"></i>
                        </div>
                        <div class="suggestion-info">
                            <div class="suggestion-name">${product.name || product.qbItem}</div>
                            <div class="suggestion-category">${product.category || 'Product'} ${stock > 0 ? `• ${stock} in stock` : '• Out of stock'}</div>
                        </div>
                        ${formattedPrice ? `<div class="suggestion-price">${formattedPrice}</div>` : ''}
                    </div>
                `;
            }

            if (!showAll && matches.length > 8) {
                html += `
                    <div class="search-suggestion-item" onclick="performSearch('${query}', true)" style="justify-content: center; color: #B87333; font-weight: 600;">
                        <i class="fas fa-search"></i>
                        <span>View all ${matches.length} results</span>
                    </div>
                `;
            }

            dropdown.innerHTML = html;
        }
    } catch (error) {
        console.error('Search error:', error);
        dropdown.innerHTML = '<div class="search-no-results"><i class="fas fa-exclamation-circle"></i> Error searching products</div>';
    }
}

// Get products for search (with caching)
async function getSearchProducts() {
    const now = Date.now();

    // Return cached data if still valid
    if (searchProductsCache && (now - searchCacheTimestamp) < SEARCH_CACHE_DURATION) {
        return searchProductsCache;
    }

    // Fetch fresh data
    try {
        const response = await fetch('/api/catalog/products?category=all&limit=1000', {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success && data.products) {
            searchProductsCache = data.products;
            searchCacheTimestamp = now;
            return data.products;
        }
    } catch (error) {
        console.error('Failed to fetch products for search:', error);
    }

    return searchProductsCache || [];
}

// Open search result - navigate to product
window.openSearchResult = function(qbItem) {
    console.log('🔍 Opening product:', qbItem);

    // Close search dropdown
    const dropdown = document.getElementById('searchSuggestionsDropdown');
    if (dropdown) dropdown.classList.remove('show');

    // Clear search input
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) searchInput.value = '';

    // For now, show an alert with the product ID
    // This can be expanded to navigate to the product detail view
    if (window.showProductDetail) {
        window.showProductDetail(qbItem);
    } else {
        // Fallback: scroll to or highlight the product if visible
        console.log('Product detail view not implemented yet. Product:', qbItem);
    }
};

// ===== REAGIR A MUDANÇAS DE MOEDA =====
window.addEventListener('currencyChanged', (e) => {
    console.log('💱 [Core] Moeda alterada para:', e.detail.newCurrency);

    // Atualizar labels dos filtros de preço
    updatePriceFilterLabels();

    setTimeout(() => {
        // Verificar se estamos vendo subcategorias (folder-cards)
        const foldersContainer = document.getElementById('foldersContainer');
        const isShowingFolders = foldersContainer && foldersContainer.style.display === 'grid';

        if (isShowingFolders && window.lastLoadedFolders && window.lastLoadedFolders.length > 0) {
            // Está em subcategorias - re-renderizar com os mesmos dados
            console.log('💱 [Core] Re-renderizando subcategorias com nova moeda...');
            window.showSubfolders(window.lastLoadedFolders);
        } else if (navigationState.currentPath.length === 0) {
            // Está na Home - re-renderizar categorias principais
            console.log('💱 [Core] Re-renderizando categorias principais...');
            window.showCategories();
        }
        // Se estamos vendo fotos, o listener do client-gallery.js cuida disso
    }, 100);
});

// Atualizar labels quando a moeda estiver pronta no carregamento inicial
window.addEventListener('currencyReady', () => {
    console.log('💱 [Core] Currency ready - atualizando filtros de preço');
    updatePriceFilterLabels();
});

/**
 * Atualiza os labels dos filtros de preço com a moeda atual
 * Funciona tanto no dropdown do desktop quanto no sidebar do mobile
 */
function updatePriceFilterLabels() {
    if (!window.CurrencyManager || !CurrencyManager.state.isLoaded) {
        return;
    }

    const symbol = CurrencyManager.getSymbol();

    // Mapeamento de valores USD para labels
    const priceRanges = [
        { value: '0-50', label: `Under ${symbol}${CurrencyManager.convert(50).toFixed(0)}` },
        { value: '50-100', label: `${symbol}${CurrencyManager.convert(50).toFixed(0)} - ${symbol}${CurrencyManager.convert(100).toFixed(0)}` },
        { value: '100-150', label: `${symbol}${CurrencyManager.convert(100).toFixed(0)} - ${symbol}${CurrencyManager.convert(150).toFixed(0)}` },
        { value: '150-200', label: `${symbol}${CurrencyManager.convert(150).toFixed(0)} - ${symbol}${CurrencyManager.convert(200).toFixed(0)}` },
        { value: '200-999', label: `Over ${symbol}${CurrencyManager.convert(200).toFixed(0)}` }
    ];

    // Atualizar todos os checkboxes de preço (desktop dropdown e mobile sidebar)
    priceRanges.forEach(range => {
        // Desktop dropdown
        const desktopCheckboxes = document.querySelectorAll(`.filters-dropdown-content input[value="${range.value}"]`);
        desktopCheckboxes.forEach(checkbox => {
            const label = checkbox.closest('label');
            if (label) {
                const span = label.querySelector('span');
                if (span) span.textContent = range.label;
            }
        });

        // Mobile sidebar
        const mobileCheckboxes = document.querySelectorAll(`.filter-sidebar input[value="${range.value}"]`);
        mobileCheckboxes.forEach(checkbox => {
            const label = checkbox.closest('label');
            if (label) {
                const span = label.querySelector('span');
                if (span) span.textContent = range.label;
            }
        });
    });

    console.log('💱 [Core] Labels de filtros de preço atualizados para', CurrencyManager.getCurrency());
}

// Expor função globalmente
window.updatePriceFilterLabels = updatePriceFilterLabels;

console.log('💱 [Core] Currency change listener registrado');