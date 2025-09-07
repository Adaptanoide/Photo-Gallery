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
    const savedSession = localStorage.getItem('sunshineSession');
    if (savedSession) {
        const session = JSON.parse(savedSession);
        const showPrices = session.user?.showPrices ?? session.client?.showPrices ?? true;
        return showPrices;
    }
    return true;
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

    // Mostrar loading
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';
    contentEl.style.display = 'none';

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

        // Salvar dados no estado
        navigationState.clientData = data;
        navigationState.allowedCategories = data.allowedCategories;

        // Atualizar interface
        updateClientInterface(data);
        updatePriceFilterVisibility();
        showCategories();

        // Atualizar visibilidade dos filtros baseado nas permissões
        if (window.updateFilterVisibility) {
            await window.updateFilterVisibility();
        }

        // Carregar contagens dos filtros
        //if (window.loadFilterCounts) {
        //    await window.loadFilterCounts();
        //}

        // Mostrar conteúdo
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
                                <span><i class="fas fa-images"></i> ${category.photoCount} photos</span>
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
                        ${stats.totalPhotos > 0 ? `<span><i class="fas fa-images"></i> ${stats.totalPhotos} photos</span>` : ''}                        ${''}
                        ${shouldShowPrices() && priceRange !== 'Price on request' ?
                    `<span class="folder-price-badge"><i class="fas fa-tag"></i> ${priceRange}</span>` :
                    (!shouldShowPrices() ? '<span class="contact-price"><i class="fas fa-phone"></i> Contact for Price</span>' : '')}
                    </div>
                    <div class="category-action">
                        <i class="fas fa-arrow-right"></i>
                        <span>Click to explore</span>
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
                <div class="category-action">
                    <i class="fas fa-arrow-right"></i>
                    <span>Click to explore</span>
                </div>
            </div>
        `).join('');
    }

    document.getElementById('breadcrumbContainer').style.display = 'block';
    document.getElementById('backNavigation').style.display = 'none';
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

        return `
            <div class="folder-card" data-folder-id="${folder.id.replace(/"/g, '&quot;')}" data-folder-name="${folder.name.replace(/"/g, '&quot;')}">
                <h4>${folder.name}</h4>
                <div class="folder-description">${description}</div>
                <div class="folder-stats">
                    ${hasPhotos && photoCount > 0 ? `<span><i class="fas fa-image"></i> ${photoCount} photos</span>` : ''}
                    ${''}
                    ${shouldShowPrices() && formattedPrice ?
                `<span class="folder-price-badge"><i class="fas fa-tag"></i> ${formattedPrice}</span>` :
                (!shouldShowPrices() ? '<span class="contact-price"><i class="fas fa-phone"></i> Contact for Price</span>' : '')}
                </div>
                <div class="category-action">
                    <i class="fas fa-arrow-right"></i>
                    <span>Click to explore</span>
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

console.log('📦 client-core.js carregado - Módulo de navegação pronto');