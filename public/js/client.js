//public/js/client.js

/**
 * CLIENT.JS - SUNSHINE COWHIDES
 * JavaScript específico para interface do cliente
 * Extraído de client.html para modularização
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
                categoriesContainer.style.visibility = 'hidden'; // Mais rápido que display
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

// ===== ESTADO DA NAVEGAÇÃO =====
// Estado da navegação e fotos (EXPOSTO GLOBALMENTE)
window.navigationState = {
    currentPath: [],
    currentFolderId: null,
    clientData: null,
    allowedCategories: [],
    currentPhotos: [],
    currentPhotoIndex: 0
};

// Guardar rate rules de Special Selection
let specialSelectionRateRules = null;
let specialSelectionBasePrice = null;
// Guardar se é Special Selection
let isSpecialSelection = false;

// Alias local para compatibilidade
const navigationState = window.navigationState;

// ===== HELPER PARA VERIFICAR SE DEVE MOSTRAR PREÇOS =====
function shouldShowPrices() {
    const savedSession = localStorage.getItem('sunshineSession');
    if (savedSession) {
        const session = JSON.parse(savedSession);
        // Verificar tanto em user quanto em client
        const showPrices = session.user?.showPrices ?? session.client?.showPrices ?? true;
        //console.log('🏷️ Show Prices:', showPrices);
        return showPrices;
    }
    return true; // default
}

// Controlar visibilidade do filtro de preços
function updatePriceFilterVisibility() {
    const priceFilterSection = document.querySelector('#priceFilters')?.closest('.filter-section');
    if (priceFilterSection) {
        if (shouldShowPrices()) {
            priceFilterSection.style.display = 'block';
        } else {
            priceFilterSection.style.display = 'none';
        }
    }
}

// Tornar global
window.shouldShowPrices = shouldShowPrices;

// ===== FUNÇÃO HELPER PARA URLs SEGURAS =====
// Helper para sempre encodar parâmetros de URL corretamente
function safeURL(baseURL, params) {
    const url = new URL(baseURL, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.append(key, value);
        }
    });
    return url.toString();
}

// ===== SISTEMA DE CACHE PARA NAVEGAÇÃO VIA FILTROS =====
// Cache global de todas as categorias e seus caminhos
let globalCategoriesCache = new Map();

// Mapa das categorias principais (será preenchido automaticamente)
let mainCategoriesMap = {};

// ===== FUNÇÃO PARA ESCAPAR STRINGS PARA USO SEGURO =====
function escapeForJS(str) {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\\\')  // Escape backslashes primeiro
        .replace(/'/g, "\\'")     // Escape apóstrofos
        .replace(/"/g, '\\"')     // Escape aspas
        .replace(/&/g, '&amp;')   // Escape &
        .replace(/</g, '&lt;')    // Escape 
        .replace(/>/g, '&gt;')    // Escape >
        .replace(/\n/g, '\\n')    // Escape quebras de linha
        .replace(/\r/g, '\\r');   // Escape retorno
}

// ===== FUNÇÕES DE DETECÇÃO PARA FILTROS =====

// Detectar tipo/pattern
function detectType(name) {
    const types = [];
    const lowerName = name.toLowerCase();

    if (lowerName.includes('brindle')) types.push('brindle');
    if (lowerName.includes('salt') && lowerName.includes('pepper')) types.push('salt-pepper');
    if (lowerName.includes('black') && lowerName.includes('white')) types.push('black-white');
    if (lowerName.includes('tricolor')) types.push('tricolor');
    if (lowerName.includes('exotic') || lowerName.includes('palomino') ||
        lowerName.includes('hereford') || lowerName.includes('champagne')) types.push('exotic');

    return types;
}

// Detectar tom
function detectTone(name) {
    const lowerName = name.toLowerCase();

    if (lowerName.includes('light') || lowerName.includes('champagne') ||
        lowerName.includes('buttercream') || lowerName.includes('white')) return 'light';
    if (lowerName.includes('dark') || lowerName.includes('black')) return 'dark';
    if (lowerName.includes('medium tone') || lowerName.includes('medium & dark')) return 'medium';
    if (lowerName.includes('natural') || lowerName.includes('assorted') ||
        lowerName.includes('mix')) return 'natural';

    return 'natural'; // default
}

// Detectar tamanho
function detectSize(name) {
    const lowerName = name.toLowerCase();

    // Checar XS primeiro (mais específico)
    if (lowerName.includes('super promo xs') || lowerName.includes('extra small')) return 'xs';

    // Checar XL (antes de L)
    if (lowerName.includes('extra large') || lowerName.includes(' xl')) return 'xl';

    // Checar ML (antes de M e L)
    if (lowerName.includes('medium large') || lowerName.includes(' ml')) return 'ml';

    // Checar Large
    if (lowerName.includes('→ large') || lowerName.includes(' l ') ||
        lowerName.includes('2. large')) return 'large';

    // Checar Medium
    if (lowerName.includes('→ medium') || lowerName.includes(' m ') ||
        lowerName.includes('1. medium')) return 'medium';

    // Checar Small
    if (lowerName.includes('→ small') || lowerName.includes('super promo small') ||
        lowerName.includes('0. small')) return 'small';

    return null; // sem tamanho detectado
}

// Detectar faixa de preço
function detectPriceRange(price) {
    if (!price || price === 0) return null;

    if (price < 50) return '0-50';
    if (price <= 100) return '50-100';
    if (price <= 150) return '100-150';
    if (price <= 200) return '150-200';
    return '200-999';
}

// Função para construir o cache inicial
function initializeCategoriesCache() {
    console.log('🔄 Iniciando cache de categorias...');

    // Verificar se navigationState existe
    if (!window.navigationState || !window.navigationState.allowedCategories) {
        console.error('❌ navigationState não está disponível!');
        return;
    }

    // Preencher com as categorias principais que já conhecemos
    window.navigationState.allowedCategories.forEach(cat => {
        mainCategoriesMap[cat.name] = cat.id;
        console.log(`📁 Mapeado: ${cat.name} → ${cat.id}`);
    });

    console.log('✅ Total de categorias mapeadas:', Object.keys(mainCategoriesMap).length);
}

// ===== INICIALIZAÇÃO =====

// Carregar dados do cliente quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    loadClientData();
    setupKeyboardNavigation();
});

// Configurar navegação por teclado
function setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('photoModal');
        if (modal.style.display !== 'none') {
            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    previousPhoto();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    nextPhoto();
                    break;
                case 'Escape':
                    e.preventDefault();
                    closePhotoModal();
                    break;
            }
        }
    });
}

// ===== CARREGAMENTO DE DADOS =====

// Função para carregar dados dinâmicos do cliente
async function loadClientData() {
    const loadingEl = document.getElementById('clientLoading');
    const errorEl = document.getElementById('clientError');
    const contentEl = document.getElementById('clientContent');

    // Mostrar loading
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';
    contentEl.style.display = 'none';

    try {
        // Buscar código da sessão
        const savedSession = localStorage.getItem('sunshineSession');
        if (!savedSession) {
            throw new Error('Session not found');
        }

        const session = JSON.parse(savedSession);
        if (!session.accessCode) {
            throw new Error('Access code not found');
        }

        // Fazer requisição para buscar dados
        const response = await fetch(`/api/auth/client/data?code=${encodeURIComponent(session.accessCode)}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Error loading data');
        }

        // Salvar dados no estado
        navigationState.clientData = data;
        navigationState.allowedCategories = data.allowedCategories;

        // Atualizar interface com dados recebidos
        updateClientInterface(data);
        updatePriceFilterVisibility();
        showCategories();

        // Carregar contagens dos filtros
        await loadFilterCounts();

        // Mostrar conteúdo
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';

    } catch (error) {
        console.error('Error loading client data:', error);

        // Mostrar erro
        loadingEl.style.display = 'none';
        contentEl.style.display = 'none';
        errorEl.style.display = 'block';

        const errorMsg = document.getElementById('errorMessage');
        errorMsg.textContent = error.message || 'Connection error';
    }
}

function updateClientInterface(data) {
    const { client, allowedCategories } = data;

    // Salvar showPrices na sessão
    const savedSession = localStorage.getItem('sunshineSession');
    if (savedSession) {
        const session = JSON.parse(savedSession);
        session.client = { ...session.client, showPrices: client.showPrices };
        localStorage.setItem('sunshineSession', JSON.stringify(session));
        console.log('💾 ShowPrices salvo na sessão:', client.showPrices);
    }

    // Atualizar welcome no header superior
    const headerWelcome = document.getElementById('headerWelcome');
    if (headerWelcome) {
        headerWelcome.textContent = `Welcome, ${client.name}!`;
    }

    // Remover elementos antigos se existirem
    const oldWelcome = document.getElementById('clientWelcome');
    if (oldWelcome) {
        oldWelcome.style.display = 'none';
    }
    const oldInfo = document.getElementById('clientInfo');
    if (oldInfo) {
        oldInfo.style.display = 'none';
    }
}

async function showCategories() {
    hideAllContainers();
    updateBreadcrumb();
    updatePriceFilterVisibility();
    // hideLoading(); // Já está comentado

    // RESTAURAR VISIBILIDADE DAS CATEGORIAS
    const categoriesContainer = document.getElementById('categoriesContainer');
    if (categoriesContainer) {
        categoriesContainer.style.display = 'grid';
        categoriesContainer.style.visibility = 'visible'; // RESTAURAR
        categoriesContainer.style.opacity = '1'; // RESTAURAR
    }

    document.getElementById('categoriesContainer').style.display = 'grid';

    const containerEl = document.getElementById('categoriesContainer');

    // ========== VERIFICAR SPECIAL SELECTION ==========
    const savedSession = localStorage.getItem('sunshineSession');
    if (savedSession) {
        const session = JSON.parse(savedSession);
        if (session.user?.accessType === 'special') {
            console.log('⭐ Special Selection ativa - mostrando categorias virtuais');
            // Marcar globalmente como Special Selection
            isSpecialSelection = true;

            // Esconder sidebar para Special Selection
            const sidebar = document.getElementById('filterSidebar');
            if (sidebar) {
                sidebar.style.display = 'none';
                // Ajustar largura do container principal
                const mainContainer = document.querySelector('.main-container');
                if (mainContainer) {
                    mainContainer.style.marginLeft = '0';
                    mainContainer.style.width = '100%';
                }
            }

            try {
                // Buscar categorias especiais do backend
                const response = await fetch('/api/pricing/categories/filtered', {
                    headers: {
                        'Authorization': `Bearer ${session.token}`
                    }
                });
                const data = await response.json();

                if (data.isSpecialSelection) {
                    // Se tem apenas 1 categoria "Special Selection", ir direto para fotos
                    if (data.categories.length === 1 && data.categories[0].id === 'special_selection') {
                        console.log('📸 Indo direto para fotos da Special Selection');

                        // Mostrar mensagem temporária
                        containerEl.innerHTML = `
                            <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                                <h2>Loading Special Selection...</h2>
                                <div class="spinner"></div>
                            </div>
                        `;

                        // Ir direto para fotos após 1 segundo
                        setTimeout(() => {
                            loadPhotos('special_selection');
                        }, 1000);

                        return; // Sair da função
                    }

                    // Se tem múltiplas categorias virtuais, mostrar como cards
                    containerEl.innerHTML = data.categories.map(category => `
                        <div class="category-card special-category" onclick="loadPhotos('${category.id}')">
                            <h3>
                                <i class="fas fa-star"></i> 
                                ${category.name}
                            </h3>
                            <p>Special Selection Category</p>
                            <div class="folder-stats">
                                <span><i class="fas fa-images"></i> ${category.photoCount} photos</span>
                                ${shouldShowPrices() && category.formattedPrice ? `<span><i class="fas fa-tag"></i> ${category.formattedPrice}</span>` : (!shouldShowPrices() && category.formattedPrice ? '<span class="contact-price"><i class="fas fa-phone"></i> Contact for Price</span>' : '')}
                            </div>
                            <div class="category-action">
                                <i class="fas fa-arrow-right"></i>
                                <span>View Selection</span>
                            </div>
                        </div>
                    `).join('');

                    return; // Sair da função
                }
            } catch (error) {
                console.error('Erro ao buscar Special Selection:', error);
            }
        }
    }
    // ========== FIM DA VERIFICAÇÃO SPECIAL ==========

    // CÓDIGO ORIGINAL PARA CLIENTES NORMAIS
    const { allowedCategories } = navigationState;

    if (allowedCategories.length === 0) {
        showNoContent('No categories available', 'Please contact the administrator to verify your permissions.');
        return;
    }

    // Buscar informações completas de cada categoria (preços, fotos, etc)
    try {
        // Buscar dados do backend
        const response = await fetch('/api/pricing/categories/filtered');
        const data = await response.json();

        // Criar mapa de dados por nome
        const categoryDataMap = {};
        if (data.categories) {
            data.categories.forEach(cat => {
                // Pegar apenas o nome principal (primeira parte)
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

                // Calcular range de preços
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

        // Gerar cards melhorados
        containerEl.innerHTML = allowedCategories.map(category => {
            const stats = categoryDataMap[category.name] || {};
            const priceRange = shouldShowPrices()
                ? ((stats.minPrice && stats.maxPrice)
                    ? (stats.minPrice === stats.maxPrice
                        ? `$${stats.minPrice.toFixed(2)}`
                        : `$${stats.minPrice.toFixed(2)} - $${stats.maxPrice.toFixed(2)}`)
                    : 'Price on request')
                : 'Contact for Price';  // Quando showPrices = false

            const description = getMainCategoryDescription(category.name);

            return `
                <div class="category-card" onclick="navigateToCategory('${category.id}', '${escapeForJS(category.name)}')">
                    <h3>${category.name}</h3>
                    <p>${description}</p>
                    <div class="folder-stats">
                        ${stats.totalPhotos > 0 ? `<span><i class="fas fa-images"></i> ${stats.totalPhotos} total photos</span>` : ''}
                        ${stats.categories?.length > 0 ? `<span><i class="fas fa-th-large"></i> ${stats.categories.length} subcategories</span>` : ''}
                        ${shouldShowPrices() && priceRange !== 'Price on request' ? `<span><i class="fas fa-tag"></i> ${priceRange}</span>` : (!shouldShowPrices() ? '<span class="contact-price"><i class="fas fa-phone"></i> Contact for Price</span>' : '')}
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
        // Fallback para cards simples se houver erro
        containerEl.innerHTML = allowedCategories.map(category => `
            <div class="category-card" onclick="navigateToCategory('${category.id}', '${escapeForJS(category.name)}')">
                <h3>
                    <i class="fas fa-th-large"></i> 
                    ${category.name}
                </h3>
                <p>Category with full navigation access enabled</p>
                <div class="category-action">
                    <i class="fas fa-arrow-right"></i>
                    <span>Click to explore</span>
                </div>
            </div>
        `).join('');
    }

    // Manter breadcrumb SEMPRE visível
    document.getElementById('breadcrumbContainer').style.display = 'block';
    document.getElementById('backNavigation').style.display = 'none';

    // Limpar o path do breadcrumb quando estiver na home
    const breadcrumbPath = document.getElementById('breadcrumbPath');
}

// Navegar para uma categoria específica
async function navigateToCategory(categoryId, categoryName) {
    navigationState.currentPath = [{ id: categoryId, name: categoryName }];
    navigationState.currentFolderId = categoryId;

    updateBreadcrumb();
    await loadFolderContents(categoryId);
}

// ===== CARREGAMENTO DE PASTAS =====

// Carregar conteúdo de uma pasta
async function loadFolderContents(folderId) {
    console.log('🔍 DEBUG loadFolderContents - folderId:', folderId);
    try {
        showLoading();

        // ========== NOVO: PEGAR TOKEN ==========
        const savedSession = localStorage.getItem('sunshineSession');
        const headers = {};

        if (savedSession) {
            const session = JSON.parse(savedSession);
            if (session.token) {
                headers['Authorization'] = `Bearer ${session.token}`;
                console.log('🔐 Enviando token JWT na requisição (structure)');
            }
        }
        // ========== FIM DO NOVO CÓDIGO ==========

        // Buscar estrutura da pasta
        const response = await fetch(`/api/gallery/structure?prefix=${encodeURIComponent(folderId)}`, {
            headers: headers  // <-- ADICIONADO
        });
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Error loading folder');
        }

        const folderData = data.structure;

        // Se tem subpastas, buscar dados de preços também
        if (folderData.hasSubfolders && folderData.folders.length > 0) {
            try {
                // Buscar dados completos com preços
                const priceResponse = await fetch('/api/pricing/categories/filtered', {
                    headers: headers  // <-- ADICIONADO TAMBÉM AQUI
                });
                const priceData = await priceResponse.json();

                // Criar mapa de preços por nome
                const priceMap = {};
                if (priceData.categories) {
                    priceData.categories.forEach(cat => {
                        // Pegar última parte do nome (após →)
                        const parts = cat.name.split(' → ');
                        const folderName = parts[parts.length - 1];
                        priceMap[folderName] = {
                            price: cat.price,
                            formattedPrice: cat.formattedPrice,
                            photoCount: cat.photoCount
                        };
                    });
                }

                // Adicionar dados de preço às pastas
                folderData.folders.forEach(folder => {
                    const priceInfo = priceMap[folder.name] || {};
                    folder.price = priceInfo.price || 0;
                    folder.formattedPrice = priceInfo.formattedPrice || '';
                    folder.photoCount = priceInfo.photoCount || folder.imageCount || 0;
                });
            } catch (error) {
                console.error('Erro ao buscar preços:', error);
            }

            // Mostrar subpastas com preços
            showSubfolders(folderData.folders);

        } else if (folderData.hasImages || folderData.totalImages > 0) {
            console.log('🔍 DEBUG antes de loadPhotos - folderId:', folderId);
            await loadPhotos(folderId);
        } else {
            showNoContent('Empty folder', 'This category has no content at the moment.');
        }
    } catch (error) {
        console.error('Error loading folder:', error);
        showNoContent('Error loading content', error.message);
    }
}

// Mostrar subpastas
function showSubfolders(folders) {
    hideAllContainers();
    hideLoading();
    document.getElementById('foldersContainer').style.display = 'grid';
    document.getElementById('breadcrumbContainer').style.display = 'block';

    const containerEl = document.getElementById('foldersContainer');

    containerEl.innerHTML = folders.map(folder => {
        const description = generateProductDescription(folder.name);
        const hasPhotos = folder.hasImages || folder.imageCount > 0;
        const photoCount = folder.photoCount || folder.imageCount || folder.totalFiles || 0;
        const price = folder.price || 0;
        const formattedPrice = shouldShowPrices()
            ? (folder.formattedPrice || (price > 0 ? `$${price.toFixed(2)}` : ''))
            : '';  // Não mostrar preço se showPrices = false

        return `
            <div class="folder-card" data-folder-id="${folder.id.replace(/"/g, '&quot;')}" data-folder-name="${folder.name.replace(/"/g, '&quot;')}">
                <h4>${folder.name}</h4>
                <div class="folder-description">${description}</div>
                <div class="folder-stats">
                    ${hasPhotos && photoCount > 0 ? `<span><i class="fas fa-image"></i> ${photoCount} photos</span>` : ''}
                    ${folder.totalSubfolders > 0 ? `<span><i class="fas fa-folder"></i> ${folder.totalSubfolders} subfolder(s)</span>` : ''}
                    ${shouldShowPrices() && formattedPrice ? `<span><i class="fas fa-tag"></i> ${formattedPrice}</span>` : (!shouldShowPrices() ? '<span class="contact-price"><i class="fas fa-phone"></i> Contact for Price</span>' : '')}
                </div>
                <div class="category-action">
                    <i class="fas fa-arrow-right"></i>
                    <span>Click to explore</span>
                </div>
            </div>
        `;
    }).join('');

    // ADICIONE ESTE BLOCO AQUI:
    // Adicionar event listeners para os folder cards
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

// Navegar para subpasta
async function navigateToSubfolder(folderId, folderName) {
    navigationState.currentPath.push({ id: folderId, name: folderName });
    navigationState.currentFolderId = folderId;

    updateBreadcrumb();
    await loadFolderContents(folderId);
}

// ===== GALERIA DE FOTOS =====

// Carregar fotos de uma pasta
async function loadPhotos(folderId) {
    try {
        showPhotosLoading(true);

        // LIMPAR rate rules ao mudar de categoria
        specialSelectionRateRules = null;
        specialSelectionBasePrice = null;

        // ========== NOVO: PEGAR TOKEN ==========
        const savedSession = localStorage.getItem('sunshineSession');
        const headers = {};

        if (savedSession) {
            const session = JSON.parse(savedSession);
            if (session.token) {
                headers['Authorization'] = `Bearer ${session.token}`;
                console.log('🔐 Enviando token JWT na requisição');
            }
        }
        // ========== FIM DO NOVO CÓDIGO ==========

        const response = await fetch(`/api/gallery/photos?prefix=${encodeURIComponent(folderId)}`, {
            headers: headers  // <-- ADICIONAR
        });
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Error loading photos');
        }

        navigationState.currentPhotos = data.photos;
        const categoryPrice = await loadCategoryPrice(folderId);
        showPhotosGallery(data.photos, data.folder.name, categoryPrice);

        // Inicializar Price Progress Bar AQUI - onde data existe!
        if (window.PriceProgressBar) {
            // Marcar como Special Selection
            isSpecialSelection = (data.clientType === 'special');
            console.log('🎯 MARCADO como Special Selection:', isSpecialSelection);

            // CONTROLAR SIDEBAR - SEMPRE, NÃO SÓ COM RATE RULES!
            const sidebar = document.getElementById('filterSidebar');
            if (sidebar) {
                if (isSpecialSelection) {
                    sidebar.style.display = 'none';
                    // Ajustar largura do container principal
                    const mainContainer = document.querySelector('.main-container');
                    if (mainContainer) {
                        mainContainer.style.marginLeft = '0';
                        mainContainer.style.width = '100%';
                    }
                } else {
                    sidebar.style.display = 'block';
                    // Restaurar largura original
                    const mainContainer = document.querySelector('.main-container');
                    if (mainContainer) {
                        mainContainer.style.marginLeft = '220px';
                        mainContainer.style.width = 'calc(100% - 220px)';
                    }
                }
            }

            // Se for Special Selection com rate rules, usar eles
            if (data.clientType === 'special' && data.rateRules && data.rateRules.length > 0) {
                // Guardar rate rules globalmente para usar no fullscreen
                specialSelectionRateRules = data.rateRules;
                specialSelectionBasePrice = data.baseCategoryPrice;
                window.PriceProgressBar.renderSpecialSelection(data.rateRules, data.baseCategoryPrice);
            } else {
                // IMPORTANTE: Limpar se não tem rate rules
                specialSelectionRateRules = null;
                specialSelectionBasePrice = null;
                if (data.clientType === 'special') {
                    // Special Selection sem rate rules - esconder progress bar
                    window.PriceProgressBar.hide();
                } else {
                    window.PriceProgressBar.init(navigationState.currentFolderId);
                }
            }
        }

        // 🌟 NOVO: Guardar o nome da categoria para Special Selection
        navigationState.currentCategoryName = data.folder.name;

    } catch (error) {
        console.error('Error loading photos:', error);
        showNoContent('Error loading photos', error.message);
    } finally {
        showPhotosLoading(false);
    }
}

// Mostrar galeria de fotos - COM VIRTUAL SCROLLING
function showPhotosGallery(photos, folderName, categoryPrice) {

    // 🌟 NOVO: Guardar o nome da categoria (importante para Special Selection)
    navigationState.currentCategoryName = folderName;

    hideAllContainers();
    hideLoading();

    // SEMPRE DESTRUIR Virtual Gallery anterior - ADICIONE ESTAS 4 LINHAS
    if (window.virtualGallery && window.virtualGallery.destroy) {
        console.log('🧹 LIMPANDO Virtual Gallery anterior SEMPRE');
        window.virtualGallery.destroy();
    }

    document.getElementById('photosContainer').style.display = 'block';
    document.getElementById('breadcrumbContainer').style.display = 'block';

    // Atualizar título e contador COM PREÇO
    const galleryTitle = document.getElementById('galleryTitle');
    // 🌟 NOVO: Verificar primeiro se tem customPrice nas fotos (Special Selection)
    const customPrice = photos[0]?.customPrice;

    // Verificar se deve mostrar preços
    console.log('🔍 DEBUG Gallery Title - shouldShowPrices:', shouldShowPrices());
    if (!shouldShowPrices()) {
        // Não mostrar preços - Contact for Price
        galleryTitle.innerHTML = `${folderName} <span class="category-price-badge contact-price">Contact for Price</span>`;
    } else if (customPrice) {
        // Special Selection - usar o preço customizado
        galleryTitle.innerHTML = shouldShowPrices()
            ? `${folderName} <span class="category-price-badge">$${parseFloat(customPrice).toFixed(2)}</span>`
            : `${folderName} <span class="category-price-badge contact-price">Contact for Price</span>`;
    } else if (categoryPrice && categoryPrice.hasPrice) {
        // Sistema normal - usar preço da categoria
        galleryTitle.innerHTML = `${folderName} <span class="category-price-badge">${categoryPrice.formattedPrice}</span>`;
    } else {
        // Sem preço
        galleryTitle.innerHTML = `${folderName} <span class="category-price-badge no-price">Price on request</span>`;
    }

    // Gerar grid de fotos
    const gridEl = document.getElementById('photosGrid');

    if (photos.length === 0) {
        showNoContent('No photos', 'This category has no photos at the moment.');
        return;
    }

    // Decidir se usa Virtual Scrolling ou modo tradicional
    const USE_VIRTUAL_SCROLLING = photos.length > 30;

    if (USE_VIRTUAL_SCROLLING && window.virtualGallery) {
        console.log(`🚀 Usando Virtual Scrolling para ${photos.length} fotos`);
        console.log('📸 Primeira foto:', photos[0]?.name);  // ← ADICIONE
        console.log('📸 Última foto:', photos[photos.length - 1]?.name);  // ← ADICIONE

        document.getElementById('photosCount').innerHTML = `Loading <strong>${photos.length}</strong> photos...`;

        // Limpar galeria anterior se existir
        if (window.virtualGallery.destroy) {
            console.log('🧹 Destruindo Virtual Gallery antiga');  // ← ADICIONE
            window.virtualGallery.destroy();
        }

        // Inicializar Virtual Gallery
        console.log('✨ Iniciando Virtual Gallery nova');  // ← ADICIONE
        window.virtualGallery.init(photos, gridEl, categoryPrice);
    } else {
        // MODO TRADICIONAL - Para poucas fotos
        console.log(`📋 Modo tradicional para ${photos.length} fotos`);
        document.getElementById('photosCount').textContent = `${photos.length} photo(s)`;

        // DEBUG - VER SE TEM CUSTOM PRICE
        console.log('🔍 PHOTOS RECEBIDAS:', photos);
        console.log('🔍 PRIMEIRA FOTO:', photos[0]);
        console.log('🔍 TEM customPrice?', photos[0]?.customPrice);

        gridEl.innerHTML = photos.map((photo, index) => {
            // Usar sistema centralizado de cache
            const thumbnailUrl = ImageUtils.getThumbnailUrl(photo);

            // Verificar se está no carrinho
            const isInCart = window.CartSystem && CartSystem.isInCart(photo.id);

            return `
                <div class="photo-thumbnail" onclick="openPhotoModal(${index})">
                    <img src="${thumbnailUrl}" 
                        alt="${photo.name}" 
                        onerror="this.onerror=null; this.src=this.src.replace('/_thumbnails/', '/');"
                        loading="lazy">
                    
                    <!-- Badge de preço no canto superior direito -->
                    <div class="photo-price ${photo.customPrice || categoryPrice?.hasPrice ? '' : 'no-price'}">
                        ${photo.customPrice ? `$${parseFloat(photo.customPrice).toFixed(2)}` : (categoryPrice?.formattedPrice || 'Price on request')}
                    </div>
                    <!-- Botão Add to Cart -->
                    <button class="thumbnail-cart-btn ${isInCart ? 'in-cart' : ''}" 
                            onclick="event.stopPropagation(); addToCartFromThumbnail('${photo.id}', ${index})"
                            title="${isInCart ? 'Remove from cart' : 'Add to cart'}">
                        <i class="fas fa-${isInCart ? 'check' : 'shopping-cart'}"></i>
                        <span>${isInCart ? 'Remove' : 'Add'}</span>
                    </button>
                    
                    <div class="photo-placeholder" style="display: none;">
                        <i class="fas fa-image"></i>
                        <small>Image not available</small>
                    </div>
                    
                    <div class="photo-overlay">
                        <div><strong>${photo.name}</strong></div>
                        <small>${formatFileSize(photo.size)}</small>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// ===== PRICE PROGRESS BAR SYSTEM =====

window.PriceProgressBar = {
    currentRanges: null,
    currentType: null,
    barElement: null,

    async init(categoryId) {
        console.log('📊 Initializing Price Progress Bar for:', categoryId);

        // Get client code
        const savedSession = localStorage.getItem('sunshineSession');
        const clientCode = savedSession ? JSON.parse(savedSession).accessCode : null;

        try {
            const response = await fetch(`/api/pricing/category-ranges?categoryId=${encodeURIComponent(categoryId)}&clientCode=${encodeURIComponent(clientCode)}`);
            const data = await response.json();

            if (data.success && data.data.ranges.length > 0) {
                this.currentRanges = data.data.ranges;
                this.currentType = data.data.appliedType;
                this.render(data.data);
            } else {
                this.hide();
            }
        } catch (error) {
            console.error('Error loading price ranges:', error);
            this.hide();
        }
    },

    renderSpecialSelection(rateRules, basePrice) {
        console.log('📊 Renderizando Rate Rules de Special Selection:', rateRules);

        // Formatar rate rules como ranges
        const formattedRanges = rateRules.map(rule => ({
            min: rule.from,
            max: rule.to,
            price: rule.price
        }));

        this.currentRanges = formattedRanges;
        this.currentType = 'special-volume';

        // Renderizar usando o mesmo visual
        this.render({
            ranges: formattedRanges,
            appliedType: 'volume',
            basePrice: basePrice
        });
    },

    render(data) {
        // Se não deve mostrar preços, não renderizar
        if (!shouldShowPrices()) {
            this.hide();
            return;
        }

        // Remove existing bar if any
        if (this.barElement) {
            this.barElement.remove();
        }

        // Create new bar
        this.barElement = document.createElement('div');
        this.barElement.className = 'price-progress-inline';
        this.barElement.innerHTML = this.buildHTML(data);

        // NÃO CRIAR WRAPPER! Adicionar direto depois do gallery-header
        const galleryHeader = document.querySelector('.gallery-header');
        if (galleryHeader) {
            let priceContainer = document.getElementById('priceInfoContainer');
            if (!priceContainer) {
                priceContainer = document.createElement('div');
                priceContainer.id = 'priceInfoContainer';
                priceContainer.className = 'price-info-container';
                // Inserir DEPOIS do gallery-header, NÃO criar wrapper
                galleryHeader.insertAdjacentElement('afterend', priceContainer);
            }
            priceContainer.innerHTML = '';
            priceContainer.appendChild(this.barElement);
        }

        // Update with current cart
        this.updateProgress();
    },

    buildHTML(data) {
        const isCustom = data.appliedType === 'custom';

        // Para Custom Client - mostrar apenas badge inline
        if (isCustom && data.ranges.length === 1) {
            const range = data.ranges[0];
            return `
                <span class="price-info-badge">
                    <i class="fas fa-star"></i>
                    Special Price: $${range.price}
                </span>
            `;
        }

        // Para Volume Discount - mostrar faixas discretas
        const rangesHTML = data.ranges.map((range, index) => `
            <span class="price-range-item">
                ${range.min}${range.max ? '-' + range.max : '+'}: 
                <strong>$${range.price}</strong>
            </span>
        `).join(' | ');

        return `
            <div class="price-info-inline">
                <span class="price-info-label">
                    <i class="fas fa-tag"></i> Volume Pricing:
                </span>
                ${rangesHTML}
                <span class="cart-progress" id="priceProgressStatus">
                    <i class="fas fa-shopping-cart"></i>
                    <span class="progress-text">0 items</span>
                </span>
            </div>
        `;
    },

    updateProgress() {
        if (!this.barElement || !this.currentRanges) return;

        // ADICIONAR ESTAS 3 LINHAS DE DEBUG
        console.log('🔍 DEBUG: updateProgress chamado');
        console.log('🔍 CartSystem.items:', window.CartSystem?.items);
        console.log('🔍 Current Path:', navigationState.currentPath);

        // Pegar todos os itens e filtrar por categoria
        const categoryPath = navigationState.currentPath[navigationState.currentPath.length - 1]?.name || '';
        const allItems = window.CartSystem && window.CartSystem.state && window.CartSystem.state.items ? window.CartSystem.state.items : [];

        const cartItems = allItems.filter(item => {
            return item.category && (
                item.category === categoryPath ||
                item.category.includes(categoryPath)
            );
        });

        // DEBUG - REMOVER DEPOIS - AGORA NO LUGAR CERTO!
        console.log('🔍 allItems:', allItems);
        console.log('🔍 categoria atual:', categoryPath); // ERA currentCategory, AGORA É categoryPath
        console.log('🔍 items filtrados:', cartItems); // AGORA cartItems JÁ EXISTE!

        const quantity = cartItems.length;

        // Find current range
        let currentRange = null;
        for (let i = 0; i < this.currentRanges.length; i++) {
            const range = this.currentRanges[i];
            if (quantity >= range.min && (!range.max || quantity <= range.max)) {
                currentRange = range;
                break;
            }
        }

        // Se quantidade excede todas as faixas, usar última
        if (!currentRange && quantity > 0) {
            currentRange = this.currentRanges[this.currentRanges.length - 1];
        }

        // Atualizar texto do progresso
        const progressEl = this.barElement.querySelector('.progress-text');
        if (!progressEl) return; // Se não tem elemento, sair

        if (quantity === 0) {
            progressEl.textContent = '0 items';

            // ADICIONE ESTAS LINHAS: Remover active de todos os tiers quando não tem items
            this.barElement.querySelectorAll('.price-range-item').forEach((item) => {
                item.classList.remove('active');
            });
        } else if (currentRange) {
            const totalPrice = quantity * currentRange.price;
            const firstPrice = this.currentRanges[0].price;
            const savings = quantity * (firstPrice - currentRange.price);

            progressEl.innerHTML = `${quantity} items = $${totalPrice}`;

            if (savings > 0) {
                progressEl.innerHTML += ` <span class="savings">(saved $${savings})</span>`;
            }

            // Atualizar range ativo
            this.barElement.querySelectorAll('.price-range-item').forEach((item, index) => {
                const range = this.currentRanges[index];
                if (range && currentRange && range.min === currentRange.min) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
        }
    },

    hide() {
        if (this.barElement) {
            this.barElement.remove();
            this.barElement = null;
        }
        this.currentRanges = null;
        this.currentType = null;
    }
};

// ===== MODAL DE FOTOS =====

// Abrir foto em modal fullscreen
async function openPhotoModal(photoIndex) {
    const photos = navigationState.currentPhotos;
    if (!photos || photoIndex < 0 || photoIndex >= photos.length) return;

    navigationState.currentPhotoIndex = photoIndex;
    const photo = photos[photoIndex];

    // Mostrar modal
    const modal = document.getElementById('photoModal');
    modal.style.display = 'flex';

    // Inicializar sistema de zoom
    if (typeof initializePhotoZoom === 'function') {
        initializePhotoZoom();
    }

    // Atualizar informações comerciais elegantes
    await updateModalCommercialInfo(photo, photoIndex, photos.length);

    // ⭐ ADICIONE ESTAS 3 LINHAS AQUI ⭐
    // Forçar atualização do Volume Pricing do modal ao abrir
    console.log('🔄 Atualizando Volume Pricing do modal ao abrir');
    await updateModalPriceInfo(photo);

    // Atualizar botões de navegação
    document.getElementById('prevBtn').disabled = photoIndex === 0;
    document.getElementById('nextBtn').disabled = photoIndex === photos.length - 1;

    // Carregar foto em alta resolução
    await loadPhotoInModal(photo.id);

    // SINCRONIZAR BOTÃO DO CARRINHO NO MODAL
    if (window.CartSystem && window.CartSystem.updateToggleButton) {
        setTimeout(() => {
            window.CartSystem.updateToggleButton();
        }, 100);
    }

    // NOVO: Atualizar preço do modal se tiver desconto
    if (window.updateModalPriceBadge) {
        setTimeout(() => window.updateModalPriceBadge(), 200);
    }
}

// Atualizar informações comerciais do modal
async function updateModalCommercialInfo(photo, photoIndex, totalPhotos) {
    // 1. HEADER - Nome da categoria
    const categoryName = getCurrentCategoryDisplayName();
    document.getElementById('modalPhotoTitle').textContent = categoryName;

    // 2. CONTADOR - só contador por enquanto
    document.getElementById('modalPhotoCounter').textContent = `${photoIndex + 1} / ${totalPhotos}`;

    // 3. FOOTER - Chamar a função original
    await updateModalPriceInfo(photo);
}

// Obter nome da categoria atual para exibição
function getCurrentCategoryDisplayName() {
    const currentPath = navigationState.currentPath;

    if (currentPath && currentPath.length > 0) {
        // Se há subcategoria, mostrar: "Categoria Principal > Subcategoria"
        if (currentPath.length > 1) {
            const mainCategory = currentPath[0].name;
            const subCategory = currentPath[currentPath.length - 1].name;
            return `${mainCategory} › ${subCategory}`;
        } else {
            // Apenas categoria principal
            return currentPath[0].name;
        }
    }

    // Fallback se não houver path
    return 'Premium Cowhide Selection';
}

async function updateModalPriceInfo(photo) {
    try {

        // Verificar se deve mostrar preços
        if (!shouldShowPrices()) {
            // Mostrar "Contact for Price" no badge
            const photoIndex = navigationState.currentPhotoIndex;
            const totalPhotos = navigationState.currentPhotos.length;

            document.getElementById('modalPhotoCounter').innerHTML = `
                <span class="modal-price-badge contact-price">Contact for Price</span>
                <span style="margin: 0 10px;">-</span>
                ${photoIndex + 1} / ${totalPhotos}
            `;

            // Esconder grid de volume
            const gridEl = document.getElementById('modalDiscountGrid');
            if (gridEl) gridEl.style.display = 'none';

            // Limpar outros campos
            document.getElementById('modalPhotoSize').innerHTML = '';
            document.getElementById('modalPhotoDate').innerHTML = '';

            return; // Sair da função
        }

        // Se não recebeu photo, pegar a foto atual do modal
        if (!photo && navigationState.currentPhotos && navigationState.currentPhotoIndex >= 0) {
            photo = navigationState.currentPhotos[navigationState.currentPhotoIndex];
        }

        let priceInfo = null;
        let currentFolderId = navigationState.currentFolderId;

        // 🌟 NOVO: SE TEM CUSTOM PRICE (Special Selection), USAR ELE!
        if (photo && photo.customPrice) {
            priceInfo = {
                hasPrice: true,
                formattedPrice: `$${parseFloat(photo.customPrice).toFixed(2)}`
            };
            console.log('💰 Usando customPrice da Special Selection:', photo.customPrice);
        } else {
            // 📌 MANTÉM TUDO COMO ESTAVA - Sistema normal
            priceInfo = currentFolderId ? await loadCategoryPrice(currentFolderId) : null;
        }

        // 📌 TODO O RESTO CONTINUA IDÊNTICO!
        // BUSCAR OS RANGES DE VOLUME
        const savedSession = localStorage.getItem('sunshineSession');
        const clientCode = savedSession ? JSON.parse(savedSession).accessCode : null;
        let rangeData;

        // Se for Special Selection, usar rate rules salvos
        if (specialSelectionRateRules) {
            rangeData = {
                success: true,
                data: {
                    ranges: specialSelectionRateRules.map(rule => ({
                        min: rule.from,
                        max: rule.to,
                        price: rule.price
                    }))
                }
            };
        } else {
            // Senão, buscar normalmente
            const rangeResponse = await fetch(`/api/pricing/category-ranges?categoryId=${encodeURIComponent(currentFolderId)}&clientCode=${encodeURIComponent(clientCode)}`);
            rangeData = await rangeResponse.json();
        }

        console.log('🔍 RANGES DO MODAL:', rangeData);
        console.log('🔍 TEM RANGES?:', rangeData?.data?.ranges);

        // Pegar valores atuais
        const photoIndex = navigationState.currentPhotoIndex;
        const totalPhotos = navigationState.currentPhotos.length;

        if (priceInfo && priceInfo.hasPrice) {
            // PREÇO NO HEADER
            document.getElementById('modalPhotoCounter').innerHTML = `
                <span class="modal-price-badge">${priceInfo.formattedPrice}</span>
                <span style="margin: 0 10px;">-</span>
                ${photoIndex + 1} / ${totalPhotos}
            `;

            // LIMPAR campos antigos
            document.getElementById('modalPhotoSize').innerHTML = '';
            document.getElementById('modalPhotoDate').innerHTML = '';

            // DEBUG - REMOVER DEPOIS
            console.log('🔍 DEBUG Modal - rangeData:', rangeData);
            console.log('🔍 DEBUG Modal - specialSelectionRateRules:', specialSelectionRateRules);
            // GRID DE VOLUME - USAR OS RANGES
            const gridEl = document.getElementById('modalDiscountGrid');
            if (gridEl && rangeData.success && rangeData.data && rangeData.data.ranges && rangeData.data.ranges.length > 0) {
                // PEGAR CONTADOR DO CARRINHO APENAS DA CATEGORIA ATUAL
                let cartCount = 0;
                if (window.CartSystem && window.CartSystem.state && window.CartSystem.state.items) {
                    // Para Special Selection, contar tudo mesmo
                    if (specialSelectionRateRules) {
                        cartCount = window.CartSystem.state.totalItems;
                    } else {
                        // Para categoria normal, contar só desta categoria
                        let currentCategoryName = null;
                        if (window.navigationState && window.navigationState.currentPath && window.navigationState.currentPath.length > 0) {
                            const lastPath = window.navigationState.currentPath[window.navigationState.currentPath.length - 1];
                            currentCategoryName = lastPath.name;
                        }

                        if (currentCategoryName) {
                            cartCount = window.CartSystem.state.items.filter(item => {
                                let itemCategory = item.category;
                                if (itemCategory && itemCategory.includes('/')) {
                                    const parts = itemCategory.split('/');
                                    itemCategory = parts[parts.length - 1] || parts[parts.length - 2];
                                }
                                return itemCategory === currentCategoryName;
                            }).length;
                            console.log(`📦 Modal: ${cartCount} items de "${currentCategoryName}" no carrinho`);
                        } else {
                            // Fallback para total se não identificar categoria
                            cartCount = window.CartSystem.state.totalItems;
                        }
                    }
                } else {
                    cartCount = 0;
                }

                let volumeHTML = '<div class="modal-volume-pricing">';
                volumeHTML += '<span class="volume-label">Volume Pricing:</span>';

                // Criar os tiers usando RANGES com DESTAQUE VISUAL
                rangeData.data.ranges.forEach((range, index) => {
                    // VERIFICAR SE ESTE É O TIER ATUAL
                    let isCurrentTier = false;
                    if (cartCount > 0) {
                        if (range.max) {
                            isCurrentTier = cartCount >= range.min && cartCount <= range.max;
                        } else {
                            isCurrentTier = cartCount >= range.min;
                        }
                    }

                    // ADICIONAR CLASSE 'active' SE FOR O TIER ATUAL
                    const tierClass = isCurrentTier ? 'volume-tier active' : 'volume-tier';

                    volumeHTML += `
                        <span class="${tierClass}">
                            ${range.min}${range.max ? `-${range.max}` : '+'}: 
                            <span class="tier-price">$${range.price}</span>
                        </span>
                    `;
                    if (index < rangeData.data.ranges.length - 1) {
                        volumeHTML += '<span class="tier-separator">|</span>';
                    }
                });

                // Adicionar contador de items
                volumeHTML += `
                    <span class="cart-count">
                        <i class="fas fa-shopping-cart"></i> ${cartCount} items
                    </span>
                `;

                volumeHTML += '</div>';
                gridEl.innerHTML = volumeHTML;
                gridEl.style.display = 'block';
            } else if (gridEl) {
                gridEl.style.display = 'none';
            }

        } else {
            // Sem preço
            document.getElementById('modalPhotoCounter').textContent = `${photoIndex + 1} / ${totalPhotos}`;
            const gridEl = document.getElementById('modalDiscountGrid');
            if (gridEl) gridEl.style.display = 'none';
        }
    } catch (error) {
        console.error('Erro:', error);
    }
}

// Carregar foto em alta resolução no modal
async function loadPhotoInModal(photoId) {
    const img = document.getElementById('modalPhoto');
    const spinner = document.getElementById('photoLoadingSpinner');

    if (!img) return;

    try {
        // Mostrar spinner se existir
        if (spinner) {
            spinner.style.display = 'block';
            img.style.display = 'none';
        }

        // Buscar foto na lista atual
        const photos = navigationState.currentPhotos || [];
        const photo = photos.find(p => p.id === photoId);

        if (!photo) {
            console.warn('Foto não encontrada na lista');
            // Fallback direto
            img.src = `https://images.sunshinecowhides-gallery.com/${photoId}`;
            if (spinner) spinner.style.display = 'none';
            img.style.display = 'block';
            return;
        }

        // TESTE: Carregamento progressivo para Sheepskins
        if (photo.id && (photo.id.includes('.webp') || photo.id.includes('.jpg'))) {
            console.log('⚡ Carregamento progressivo ativado para Sheepskins');

            // 1. Thumbnail primeiro
            img.src = ImageUtils.getThumbnailUrl(photo);

            // 2. Preview em background
            const previewUrl = ImageUtils.getPreviewUrl(photo);
            const previewImg = new Image();
            previewImg.onload = function () {
                img.src = previewUrl;
                console.log('✅ Preview carregado');

                // 3. Display para zoom
                const displayUrl = ImageUtils.getDisplayUrl(photo);
                const displayImg = new Image();
                displayImg.src = displayUrl;
                img.dataset.hdSrc = displayUrl;
                console.log('📦 Display preparado para zoom');
            };
            previewImg.onerror = function () {
                console.warn('Preview falhou, usando original');
                img.src = ImageUtils.getFullImageUrl(photo);
            };
            previewImg.src = previewUrl;

        } else {
            // Outras categorias - modo normal
            console.log('📷 Carregamento normal (não-Sheepskins)');
            img.src = ImageUtils.getFullImageUrl(photo);
        }

        // Handlers comuns
        img.onload = function () {
            if (spinner) {
                spinner.style.display = 'none';
            }
            img.style.display = 'block';

            if (window.ZoomManager) {
                window.ZoomManager.initialize(img);
                if (img.dataset.hdSrc) {
                    window.ZoomManager.hdSource = img.dataset.hdSrc;
                }
            }
        };

        img.onerror = function () {
            console.error('Erro carregando imagem:', photoId);
            if (spinner) spinner.style.display = 'none';
            img.style.display = 'block';
            // Fallback
            img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23f8f9fa"/><text x="50%" y="50%" font-family="Arial" font-size="16" fill="%23666" text-anchor="middle" dy=".3em">Error loading photo</text></svg>';
        };

    } catch (error) {
        console.error('Erro ao carregar foto:', error);
        if (spinner) spinner.style.display = 'none';
        if (img) {
            img.style.display = 'block';
            img.src = `https://images.sunshinecowhides-gallery.com/${photoId}`;
        }
    }
}

// Navegar para foto anterior
function previousPhoto() {
    if (navigationState.currentPhotoIndex > 0) {
        // Notificar mudança de foto para resetar zoom
        if (typeof notifyPhotoChange === 'function') {
            notifyPhotoChange();
        }
        openPhotoModal(navigationState.currentPhotoIndex - 1);
        // Notificar carrinho sobre mudança
        notifyCartOnPhotoChange();
    }
}

// Navegar para próxima foto
function nextPhoto() {
    if (navigationState.currentPhotoIndex < navigationState.currentPhotos.length - 1) {
        // Notificar mudança de foto para resetar zoom
        if (typeof notifyPhotoChange === 'function') {
            notifyPhotoChange();
        }
        openPhotoModal(navigationState.currentPhotoIndex + 1);
        // Notificar carrinho sobre mudança
        notifyCartOnPhotoChange();
    }
}

function closePhotoModal() {
    // Destruir zoom antes de fechar
    if (typeof destroyPhotoZoom === 'function') {
        destroyPhotoZoom();
    }
    document.getElementById('photoModal').style.display = 'none';

    // NOVO: Atualizar Volume Pricing das thumbnails ao fechar modal
    if (window.PriceProgressBar && typeof window.PriceProgressBar.updateProgress === 'function') {
        console.log('🔄 Atualizando Volume Pricing das thumbnails após fechar modal');
        window.PriceProgressBar.updateProgress();
    }
}

// Notificar carrinho sobre mudança de foto
function notifyCartOnPhotoChange() {
    if (window.CartSystem && window.CartSystem.updateToggleButton) {
        // Pequeno delay para garantir que navigationState foi atualizado
        setTimeout(() => {
            window.CartSystem.updateToggleButton();
        }, 100);
    }
}

// Selecionar foto para carrinho
function selectPhotoForCart() {
    // Esta função foi substituída por toggleCartItem() no cart.js
    // Manter para compatibilidade, mas redirecionar
    if (window.toggleCartItem) {
        window.toggleCartItem();
    } else {
        console.warn('Cart system not loaded');
        showNotification('Cart system loading...', 'info');
    }
}

// ===== NAVEGAÇÃO E BREADCRUMB =====

// Atualizar breadcrumb
function updateBreadcrumb() {
    const pathEl = document.getElementById('breadcrumbPath');

    const breadcrumbHtml = navigationState.currentPath.map((item, index) => {
        const isLast = index === navigationState.currentPath.length - 1;

        // Limpar nome se necessário
        let displayName = item.name;
        if (displayName.includes('→')) {
            const parts = displayName.split('→');
            displayName = parts[parts.length - 1].trim();
        }

        // Se não tem ID (veio do filtro e não é o último), mostrar apenas como texto
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

// Navegar via breadcrumb
async function navigateToBreadcrumb(index) {
    navigationState.currentPath = navigationState.currentPath.slice(0, index + 1);
    const target = navigationState.currentPath[index];
    navigationState.currentFolderId = target.id;

    updateBreadcrumb();
    await loadFolderContents(target.id);
}

// Navegar para root
function navigateToRoot() {
    navigationState.currentPath = [];
    navigationState.currentFolderId = null;
    showCategories();
}

// Construir breadcrumb navegável com IDs reais e suporte a contextos
function buildNavigablePath(fullPath, targetId) {
    console.log('🔍 Construindo caminho navegável para:', fullPath);

    const parts = fullPath.split('→').map(p => p.trim());

    // Remover "Sunshine Cowhides Actual Pictures"
    if (parts[0] === 'Sunshine Cowhides Actual Pictures') {
        parts.shift();
    }

    const path = [];

    // Para cada parte, tentar encontrar o ID real
    parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        let itemId = null;
        let isNavigable = false;

        if (isLast) {
            // Último item - sempre tem o ID real
            itemId = targetId;
            isNavigable = true;
        } else if (index === 0) {
            // Primeira parte - categoria principal
            itemId = mainCategoriesMap[part];
            isNavigable = !!itemId;

            if (itemId) {
                console.log(`✅ Categoria principal: ${part}`);
            } else {
                console.log(`⚠️ Categoria principal não mapeada: ${part}`);
            }
        } else {
            // Partes intermediárias - não temos mais o mapa
            isNavigable = false;
            console.log(`⚠️ Pasta não mapeada: ${part} (nível ${index})`);
        }

        path.push({
            id: itemId,
            name: part,
            isLast: isLast,
            isNavigable: isNavigable
        });
    });

    console.log('📍 Caminho final:', path.map(p => p.name + (p.isNavigable ? '✓' : '✗')).join(' → '));
    return path;
}

// Navegar de volta
async function navigateBack() {
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

// ===== FUNÇÕES UTILITÁRIAS =====

// Mostrar/ocultar loading de fotos
function showPhotosLoading(show) {
    document.getElementById('photosLoading').style.display = show ? 'block' : 'none';
}

// Gerar descrição do produto baseada no nome da pasta
function generateProductDescription(folderName) {
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

// Descrições específicas para categorias principais
function getMainCategoryDescription(categoryName) {
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

// ===== FUNÇÃO UNIFICADA PARA CRIAR CARDS =====
function createUnifiedCard(data) {
    // Extrair informações
    const name = data.name || data.displayName || 'Unknown';
    const photoCount = data.photoCount || data.imageCount || data.totalFiles || 0;
    const hasSubfolders = data.totalSubfolders > 0 || data.hasSubfolders;
    const hasPhotos = photoCount > 0 || data.hasImages;
    const price = data.price || data.basePrice || 0;
    const formattedPrice = data.formattedPrice || (price > 0 ? `$${price.toFixed(2)}` : '');

    // Gerar descrição
    const description = generateProductDescription(name);

    // Determinar ícone principal
    const mainIcon = hasSubfolders && !hasPhotos ? 'folder' : 'images';

    // Criar HTML INTERNO do card (sem o wrapper)
    return `
        <h4>${name}</h4>
        <p>${description}</p>
        <div class="folder-stats">
            ${hasPhotos ? `<span><i class="fas fa-image"></i> ${photoCount} photos</span>` : ''}
            ${hasSubfolders ? `<span><i class="fas fa-th-large"></i> ${data.totalSubfolders} subfolders</span>` : ''}
            ${shouldShowPrices() && formattedPrice ? `<span><i class="fas fa-tag"></i> ${formattedPrice}</span>` : (!shouldShowPrices() ? '<span class="contact-price"><i class="fas fa-phone"></i> Contact for Price</span>' : '')}
        </div>
        <div class="category-action">
            <i class="fas fa-arrow-right"></i>
            <span>Click to explore</span>
        </div>
    `;
}

// Ocultar todos os containers incluindo loading
function hideAllContainers() {
    document.getElementById('categoriesContainer').style.display = 'none';
    document.getElementById('foldersContainer').style.display = 'none';
    document.getElementById('photosContainer').style.display = 'none';
    document.getElementById('noContentMessage').style.display = 'none';
    // Esconder loading também
    const loadingEl = document.getElementById('navigationLoading');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

// Mostrar mensagem de conteúdo vazio
function showNoContent(title, message) {
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

function showLoading() {
    hideAllContainers();

    // GARANTIR que categorias fiquem escondidas
    const categoriesContainer = document.getElementById('categoriesContainer');
    if (categoriesContainer) {
        categoriesContainer.style.display = 'none';
    }

    const loadingEl = document.getElementById('navigationLoading');
    if (loadingEl) {
        loadingEl.style.display = 'flex';
    }
}

// Esconder loading de navegaçãoc
function hideLoading() {
    const loadingEl = document.getElementById('navigationLoading');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }

    // RESTAURAR CATEGORIAS quando loading sumir
    const categoriesContainer = document.getElementById('categoriesContainer');
    if (categoriesContainer) {
        categoriesContainer.style.visibility = 'visible';
        categoriesContainer.style.opacity = '1';
    }
}

// Formatação de tamanho de arquivo
function formatFileSize(bytes) {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Formatação de data
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US');
}

// ===== INTEGRAÇÃO COM SISTEMA DE ZOOM =====

// Verificar se funções de zoom estão disponíveis
function isZoomAvailable() {
    return typeof initializePhotoZoom === 'function' &&
        typeof notifyPhotoChange === 'function' &&
        typeof destroyPhotoZoom === 'function';
}

// Log de inicialização do zoom
document.addEventListener('DOMContentLoaded', async () => {
    console.log('✅ Sistema de filtros carregado');

    // Esperar mais tempo e verificar se está carregado
    const checkAndInitialize = setInterval(() => {
        if (window.navigationState &&
            window.navigationState.allowedCategories &&
            window.navigationState.allowedCategories.length > 0) {

            // Encontrou! Inicializar e parar de verificar
            clearInterval(checkAndInitialize);
            initializeCategoriesCache();
            console.log('📊 Cache inicializado com sucesso!');
            console.log('📁 Categorias mapeadas:', mainCategoriesMap);
        } else {
            console.log('⏳ Aguardando navigationState carregar...');
        }
    }, 500);

    // Timeout de segurança - parar após 10 segundos
    setTimeout(() => clearInterval(checkAndInitialize), 10000);

    // Carregar contagens dos filtros
    loadFilterCounts();
});

// Cache de preços por categoria
window.categoryPrices = new Map();

// Buscar preço da categoria atual - VERSÃO CORRIGIDA
async function loadCategoryPrice(folderId) {
    try {
        if (window.categoryPrices.has(folderId)) {
            return window.categoryPrices.get(folderId);
        }

        // Buscar código do cliente da sessão
        let clientCode = null;
        const savedSession = localStorage.getItem('sunshineSession');
        if (savedSession) {
            const session = JSON.parse(savedSession);
            clientCode = session.accessCode;
        }

        console.log(`🏷️ Loading price for category ${folderId}, client: ${clientCode || 'ANONYMOUS'}`);

        // Incluir clientCode na requisição
        const url = `/api/pricing/category-price?prefix=${encodeURIComponent(folderId)}${clientCode ? `&clientCode=${clientCode}` : ''}`;
        const response = await fetch(url);
        const data = await response.json();

        let priceInfo = {
            hasPrice: false,
            price: 0,
            formattedPrice: 'No price',
            priceSource: 'base'
        };

        if (data.success && data.category) {
            priceInfo = {
                hasPrice: data.category.hasPrice,
                basePrice: data.category.basePrice || 0,  // ← ADICIONE ESTA LINHA!
                price: data.category.finalPrice || 0,
                formattedPrice: data.category.formattedPrice,
                priceSource: data.category.priceSource || 'base'
            };

            // Log detalhado para debug
            console.log(`✅ Price loaded:`, {
                category: data.category.displayName,
                client: clientCode,
                basePrice: data.category.basePrice,
                finalPrice: data.category.finalPrice,
                formattedPrice: data.category.formattedPrice,
                source: data.category.priceSource
            });
        }

        window.categoryPrices.set(folderId, priceInfo);
        return priceInfo;

    } catch (error) {
        console.error('❌ Error loading price:', error);
        return {
            hasPrice: false,
            price: 0,
            formattedPrice: 'Price error',
            priceSource: 'error'
        };
    }
}

// ===== FUNÇÃO AUXILIAR PARA PEGAR NOME DA CATEGORIA =====
function getCurrentCategoryName() {
    // Pegar o último item do path
    if (navigationState.currentPath && navigationState.currentPath.length > 0) {
        return navigationState.currentPath[navigationState.currentPath.length - 1];
    }
    return 'Products';
}

// ===== FUNÇÃO PARA ADD TO CART DA THUMBNAIL =====
async function addToCartFromThumbnail(driveFileId, photoIndex) {
    try {
        // ============ FEEDBACK VISUAL INSTANTÂNEO THUMBNAIL ============
        // Encontrar o botão pelo driveFileId
        const thumbButton = document.querySelector(`.thumbnail-cart-btn[onclick*="${driveFileId}"]`) ||
            document.querySelector(`.thumbnail-cart-btn[data-drive-file-id="${driveFileId}"]`);

        if (thumbButton) {
            const isInCart = thumbButton.classList.contains('in-cart');

            // Muda INSTANTANEAMENTE com spinner
            if (isInCart) {
                // REMOVENDO - deve ficar VERMELHO
                thumbButton.classList.add('in-cart');  // MUDOU! Era remove
                thumbButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Removing...</span>';
            } else {
                // ADICIONANDO - deve ficar VERDE
                thumbButton.classList.remove('in-cart');  // MUDOU! Era add
                thumbButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Adding...</span>';
            }
            thumbButton.disabled = true;

            // Re-habilita após 2 segundos
            setTimeout(() => {
                if (thumbButton) thumbButton.disabled = false;
            }, 2000);
        }
        // ============ FIM DO FEEDBACK INSTANTÂNEO ============

        // Pegar a foto (CÓDIGO ORIGINAL CONTINUA AQUI)
        const photo = navigationState.currentPhotos[photoIndex];
        if (!photo) {
            console.error('Photo not found');
            return;
        }

        // Verificar se já está no carrinho
        const isInCart = window.CartSystem && CartSystem.isInCart(driveFileId);

        if (isInCart) {
            // Remover do carrinho
            await CartSystem.removeItem(driveFileId);
            //showNotification('Item removed from cart', 'info');

            // ADICIONAR ESTAS 3 LINHAS
            if (window.PriceProgressBar && window.PriceProgressBar.updateProgress) {
                window.PriceProgressBar.updateProgress();
            }
            // Atualizar botão para ADD
            const button = document.querySelector(`button[onclick*="'${driveFileId}'"]`);
            if (button) {
                button.classList.remove('in-cart');
                button.innerHTML = '<i class="fas fa-shopping-cart"></i><span>Add</span>';
                button.title = 'Add to cart';
            }
        } else {
            // Adicionar ao carrinho
            let priceInfo = { hasPrice: false, basePrice: 0, price: 0, formattedPrice: 'No price' };

            // 🌟 NOVO: PRIMEIRO VERIFICAR SE A FOTO TEM customPrice (Special Selection)
            if (photo.customPrice) {
                priceInfo = {
                    hasPrice: true,
                    basePrice: parseFloat(photo.customPrice),
                    price: parseFloat(photo.customPrice),
                    formattedPrice: `$${parseFloat(photo.customPrice).toFixed(2)}`
                };
                console.log('💰 Usando customPrice da foto Special Selection:', photo.customPrice);
            }
            // SE NÃO TEM customPrice, buscar da API (sistema normal)
            else {
                const currentFolderId = navigationState.currentFolderId;
                if (currentFolderId && window.loadCategoryPrice) {
                    try {
                        priceInfo = await window.loadCategoryPrice(currentFolderId);
                        //console.log('✅ Preço encontrado para thumbnail:', priceInfo);
                        //console.log('🔍 BASE PRICE DEBUG:');
                        //console.log('  - basePrice:', priceInfo.basePrice);
                        //console.log('  - price:', priceInfo.price);
                        //console.log('  - tem base?:', priceInfo.basePrice !== undefined);
                    } catch (error) {
                        console.warn('❌ Erro ao buscar preço para thumbnail:', error);
                    }
                }
            }

            //console.log('🔍 ENVIANDO PARA CART:');
            //console.log('  - basePrice:', priceInfo.basePrice || 0);
            //console.log('  - price:', priceInfo.price);
            //console.log('  - formattedPrice:', priceInfo.formattedPrice);

            await CartSystem.addItem(driveFileId, {
                fileName: photo.name,
                thumbnailUrl: photo.thumbnailLink || photo.webViewLink,
                fullImageUrl: ImageUtils.getFullImageUrl(photo),
                // 🌟 Usar o nome guardado (Special Selection) ou path normal
                category: navigationState.currentCategoryName || (navigationState.currentPath?.length > 1
                    ? navigationState.currentPath[navigationState.currentPath.length - 1].name
                    : navigationState.currentPath[0]?.name) || 'Category',
                categoryName: navigationState.currentPath[navigationState.currentPath.length - 1] || 'Products',
                categoryPath: navigationState.currentPath.join(' > '),
                basePrice: priceInfo.basePrice || 0,
                price: priceInfo.price,
                formattedPrice: priceInfo.formattedPrice,
                hasPrice: priceInfo.hasPrice
            });
            //showNotification('Item added to cart!', 'success');

            // ADICIONAR ESTAS 3 LINHAS AQUI
            if (window.PriceProgressBar && window.PriceProgressBar.updateProgress) {
                window.PriceProgressBar.updateProgress();
            }
            // Atualizar botão para REMOVE  
            const button = document.querySelector(`button[onclick*="'${driveFileId}'"]`);
            if (button) {
                button.classList.add('in-cart');
                button.innerHTML = '<i class="fas fa-trash"></i><span>Remove</span>';
                button.title = 'Remove from cart';
            }
        }
    } catch (error) {
        console.error('Error in thumbnail:', error);

        // REVERTER O BOTÃO PARA ESTADO ORIGINAL
        const thumbButton = document.querySelector(`.thumbnail-cart-btn[onclick*="${driveFileId}"]`);
        if (thumbButton) {
            thumbButton.disabled = false;

            // Verificar estado real no carrinho
            const isCurrentlyInCart = CartSystem.isInCart(driveFileId);

            // Restaurar estado correto
            if (isCurrentlyInCart) {
                thumbButton.classList.add('in-cart');
                thumbButton.innerHTML = '<i class="fas fa-trash"></i><span>Remove</span>';
            } else {
                thumbButton.classList.remove('in-cart');
                thumbButton.innerHTML = '<i class="fas fa-shopping-cart"></i><span>Add</span>';
            }
        }

        // Mostrar mensagem apropriada
        if (error.message?.includes('reserved') || error.message?.includes('reserv')) {
            showNotification('This item has been reserved by another customer', 'warning');
        } else {
            showNotification(error.message || 'Error updating cart', 'error');
        }
    }
}

// ===== SISTEMA DE SINCRONIZAÇÃO GLOBAL =====
window.syncCartUIFromRemove = function (driveFileId) {
    // Só atualizar se o botão existir na tela atual
    const thumbButton = document.querySelector(`button[onclick*="'${driveFileId}'"]`);
    if (thumbButton) {
        thumbButton.classList.remove('in-cart');
        thumbButton.innerHTML = '<i class="fas fa-shopping-cart"></i><span>Add</span>';
        thumbButton.title = 'Add to cart';
        console.log(`✅ Thumbnail ${driveFileId} sincronizado após remoção`);
    }
}

// Sincronizar quando ADICIONA pelo modal
window.syncCartUIFromAdd = function (driveFileId) {
    // Só atualizar se o botão existir na tela atual
    const thumbButton = document.querySelector(`button[onclick*="'${driveFileId}'"]`);
    if (thumbButton) {
        thumbButton.classList.add('in-cart');
        thumbButton.innerHTML = '<i class="fas fa-trash"></i><span>Remove</span>';
        thumbButton.title = 'Remove from cart';
        console.log(`✅ Thumbnail ${driveFileId} sincronizado após adição via modal`);
    }
}

// Tornar a função global
window.addToCartFromThumbnail = addToCartFromThumbnail;

// ===== SISTEMA DE FILTROS =====

// Toggle da sidebar de filtros
function toggleFilters() {
    const sidebar = document.getElementById('filterSidebar');
    const overlay = document.querySelector('.filter-overlay');

    if (sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        if (overlay) overlay.style.display = 'none';
    } else {
        sidebar.classList.add('active');
        if (overlay) overlay.style.display = 'block';
    }
}

// Limpar todos os filtros
function clearFilters() {
    // Resetar estado de navegação
    navigationState.currentPath = [];
    navigationState.currentFolderId = null;

    // Desmarcar checkboxes
    document.querySelectorAll('#typeFilters input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    // Reset radio buttons
    const allRadio = document.querySelector('#photoFilters input[value="all"]');
    if (allRadio) {
        allRadio.checked = true;
    }

    // Atualizar breadcrumb para limpar visualmente
    updateBreadcrumb();

    console.log('✅ Filtros limpos e navegação resetada');
}

// Aplicar filtros automaticamente
async function autoApplyFilters() {
    console.log('🔍 Aplicando filtros automaticamente...');

    // LIMPAR FOTOS ANTIGAS E ESCONDER CONTAINER
    const photosGrid = document.getElementById('photosGrid');
    if (photosGrid) {
        photosGrid.innerHTML = '';
        console.log('🧹 Fotos antigas limpas');
    }

    const photosContainer = document.getElementById('photosContainer');
    if (photosContainer) {
        photosContainer.style.display = 'none';
    }

    const categoriesContainer = document.getElementById('categoriesContainer');
    if (categoriesContainer) {
        categoriesContainer.style.display = 'flex';
    }

    const breadcrumbContainer = document.getElementById('breadcrumbContainer');
    if (breadcrumbContainer) {
        breadcrumbContainer.style.display = 'none';
    }

    // Coletar filtros selecionados - APENAS TYPE E PRICE
    const selectedFilters = {
        types: [],
        prices: []
    };

    // Types - Radio button (seleção única)
    const selectedType = document.querySelector('#typeFilters input[type="radio"]:checked');
    if (selectedType) {
        selectedFilters.types.push(selectedType.value);
    }

    // Prices - Checkboxes
    document.querySelectorAll('#priceFilters input[type="checkbox"]:checked').forEach(cb => {
        selectedFilters.prices.push(cb.value);
    });

    // Se nenhum filtro selecionado, mostrar todas
    const hasFilters = selectedFilters.types.length > 0 || selectedFilters.prices.length > 0;

    if (!hasFilters) {
        showCategories();
        return;
    }

    // Buscar categorias com preços
    try {
        const response = await fetch('/api/pricing/categories/filtered');
        const data = await response.json();

        if (!data.categories) {
            console.error('Erro ao buscar categorias');
            return;
        }

        // Filtrar categorias - APENAS TYPE E PRICE
        let filteredCategories = data.categories.filter(cat => {
            // Type filter
            if (selectedFilters.types.length > 0) {
                const catTypes = detectType(cat.name);
                const hasType = selectedFilters.types.some(type => catTypes.includes(type));
                if (!hasType) return false;
            }

            // Price filter
            if (selectedFilters.prices.length > 0) {
                const priceRange = detectPriceRange(cat.price);
                if (!priceRange || !selectedFilters.prices.includes(priceRange)) return false;
            }

            return true;
        });

        console.log(`📊 ${filteredCategories.length} categorias após filtros`);

        // Mostrar categorias filtradas
        displayFilteredCategories(filteredCategories);

    } catch (error) {
        console.error('Erro ao aplicar filtros:', error);
    }
}

async function applyFilters() {
    // ESCONDER CATEGORIAS IMEDIATAMENTE (NOVO!)
    const categoriesContainer = document.getElementById('categoriesContainer');
    if (categoriesContainer) {
        categoriesContainer.style.display = 'none';
    }

    // MOSTRAR LOADING IMEDIATAMENTE
    showLoading();

    // Pequeno delay para o loading aparecer na tela
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        // Aplicar filtros
        await autoApplyFilters();

        // Pequeno delay para garantir renderização
        await new Promise(resolve => setTimeout(resolve, 200));

    } finally {
        // SEMPRE esconder loading no final
        hideLoading();
    }
}

// Limpar todos os filtros
function clearAllFilters() {
    // Desmarcar todos os checkboxes
    document.querySelectorAll('.filter-checkbox input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    // Desmarcar todos os radio buttons
    document.querySelectorAll('.filter-checkbox input[type="radio"]').forEach(rb => {
        rb.checked = false;
    });

    // Mostrar todas as categorias
    showCategories();

    console.log('🧹 Filtros limpos');
}

// ===== FUNÇÕES AUXILIARES PARA LIMPAR TÍTULOS =====

// Extrair informações limpas da categoria
function extractCategoryInfo(fullName) {
    // Dividir o caminho completo
    const parts = fullName.split('→').map(p => p.trim());

    // Remover "Sunshine Cowhides Actual Pictures" sempre
    if (parts[0] === 'Sunshine Cowhides Actual Pictures') {
        parts.shift();
    }

    // Pegar o nome final (onde estão as fotos)
    const finalName = parts[parts.length - 1];

    // Identificar a origem/coleção
    let collection = '';
    if (parts.length > 0) {
        const firstPart = parts[0];

        if (firstPart.includes('Brazil Best Sellers')) {
            collection = 'BEST SELLERS';
        } else if (firstPart.includes('Brazil Top Selected')) {
            collection = 'PREMIUM SELECTION';
            // Se tem tamanho no caminho, adicionar
            if (parts.length > 1) {
                const sizePart = parts[1];
                if (sizePart === 'Small' || sizePart === 'Medium Large' || sizePart === 'Extra Large') {
                    collection += ' • ' + sizePart.toUpperCase();
                }
            }
        } else if (firstPart.includes('Colombian')) {
            collection = 'COLOMBIAN';
        } else if (firstPart.includes('Rodeo')) {
            collection = 'RODEO RUGS';
        } else if (firstPart.includes('Sheepskins')) {
            collection = 'SHEEPSKINS';
        } else if (firstPart.includes('Calfskins')) {
            collection = 'CALFSKINS';
        }
    }

    return {
        displayName: finalName,
        collection: collection,
        fullName: fullName
    };
}

// Exibir categorias filtradas
function displayFilteredCategories(categories) {
    const container = document.getElementById('categoriesContainer');

    if (!container) {
        console.error('Container de categorias não encontrado');
        return;
    }

    // IMPORTANTE: Manter breadcrumb e botão Home visíveis!
    document.getElementById('breadcrumbContainer').style.display = 'block';
    document.getElementById('backNavigation').style.display = 'none';

    // Atualizar breadcrumb para mostrar que está filtrado
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
            <div class="no-results">
                <i class="fas fa-search"></i>
                <h3>No categories found</h3>
                <p>Try adjusting your filters</p>
                <button onclick="clearFilters(); applyFilters();" class="btn btn-primary">Clear Filters</button>
            </div>
        `;
        return;
    }

    // Renderizar categorias com títulos limpos
    categories.forEach(category => {
        // Extrair informações limpas
        const info = extractCategoryInfo(category.name || category.displayName);

        const categoryCard = document.createElement('div');
        categoryCard.className = 'category-card';
        categoryCard.onclick = () => {
            // Construir o caminho navegável antes de navegar
            const navPath = buildNavigablePath(category.name, category.driveId || category.id);

            // Setar o caminho completo
            navigationState.currentPath = navPath;
            navigationState.currentFolderId = category.driveId || category.id;

            // Atualizar breadcrumb e carregar conteúdo
            updateBreadcrumb();
            loadFolderContents(category.driveId || category.id);
        };

        categoryCard.innerHTML = createUnifiedCard({
            name: category.name || category.displayName,
            displayName: info.displayName,
            photoCount: category.photoCount || 0,
            price: category.price || category.basePrice || 0,
            formattedPrice: category.formattedPrice,
            hasImages: true,
            hasSubfolders: false
        });

        container.appendChild(categoryCard);
    });

    // Mostrar container
    container.style.display = 'grid';
}

// Função para mostrar/esconder loading
function showNavigationLoading() {
    const loading = document.getElementById('navigationLoading');
    if (loading) loading.style.display = 'flex';
}

function hideNavigationLoading() {
    const loading = document.getElementById('navigationLoading');
    if (loading) loading.style.display = 'none';
}

// Carregar contagens dos filtros
async function loadFilterCounts() {
    try {
        // Buscar todas as categorias sem filtro
        const response = await fetch('/api/pricing/categories/filtered');
        const data = await response.json();

        if (!data.categories) return;

        // Contadores
        const typeCounts = {
            'brindle': 0,
            'salt-pepper': 0,
            'black-white': 0,
            'tricolor': 0,
            'exotic': 0
        };

        const sizeCounts = {
            'xs': 0,
            'small': 0,
            'medium': 0,
            'ml': 0,
            'large': 0,
            'xl': 0
        };

        data.categories.forEach(cat => {
            const fullText = ((cat.name || '') + ' ' + (cat.fullPath || '')).toLowerCase();

            // CONTAR TIPOS
            if (fullText.includes('brindle')) typeCounts['brindle']++;
            if (fullText.includes('salt') && fullText.includes('pepper')) typeCounts['salt-pepper']++;
            if (fullText.includes('black') && fullText.includes('white')) typeCounts['black-white']++;
            if (fullText.includes('tricolor')) typeCounts['tricolor']++;
            if (fullText.includes('exotic')) typeCounts['exotic']++;

            // CONTAR TAMANHOS
            if (fullText.includes('extra small') || fullText.includes('xs')) sizeCounts['xs']++;
            if (fullText.includes('small') && !fullText.includes('extra')) sizeCounts['small']++;
            if (fullText.includes('medium') && !fullText.includes('large')) sizeCounts['medium']++;
            if (fullText.includes('medium large') || fullText.includes(' ml')) sizeCounts['ml']++;
            if (fullText.includes('large') && !fullText.includes('extra') && !fullText.includes('medium')) sizeCounts['large']++;
            if (fullText.includes('extra large') || fullText.includes(' xl')) sizeCounts['xl']++;
        });

        // ATUALIZAR TIPOS
        Object.keys(typeCounts).forEach(type => {
            const checkbox = document.querySelector(`#typeFilters input[value="${type}"]`);
            if (checkbox) {
                const label = checkbox.closest('label');
                const countSpan = label.querySelector('.count');
                if (countSpan) {
                    countSpan.textContent = `(${typeCounts[type]})`;
                }
            }
        });

        // ATUALIZAR TAMANHOS  
        Object.keys(sizeCounts).forEach(size => {
            const checkbox = document.querySelector(`#sizeFilters input[value="${size}"]`);
            if (checkbox) {
                const label = checkbox.closest('label');
                const countSpan = label.querySelector('.count');
                if (countSpan) {
                    countSpan.textContent = `(${sizeCounts[size]})`;
                }
            }
        });

        console.log('📊 Contagens carregadas:', { types: typeCounts, sizes: sizeCounts });

    } catch (error) {
        console.error('❌ Erro ao carregar contagens:', error);
    }
}

// Atualizar contadores dos filtros
function updateFilterCounts(categories) {
    const counts = {
        // Types
        'brindle': 0,
        'salt-pepper': 0,
        'black-white': 0,
        'tricolor': 0,
        'exotic': 0,
        // Tones
        'light': 0,
        'medium': 0,
        'dark': 0,
        'natural': 0,
        // Sizes
        'xs': 0,
        'small': 0,
        'medium-size': 0,
        'ml': 0,
        'large': 0,
        'xl': 0,
        // Prices
        'price-0-50': 0,
        'price-50-100': 0,
        'price-100-150': 0,
        'price-150-200': 0,
        'price-200-999': 0
    };

    categories.forEach(cat => {
        // Count types
        const types = detectType(cat.name);
        types.forEach(type => {
            if (counts.hasOwnProperty(type)) counts[type]++;
        });

        // Count tone
        const tone = detectTone(cat.name);
        if (counts.hasOwnProperty(tone)) counts[tone]++;

        // Count size
        const size = detectSize(cat.name);
        if (size === 'medium') counts['medium-size']++;
        else if (size && counts.hasOwnProperty(size)) counts[size]++;

        // Count price
        const priceRange = detectPriceRange(cat.price);
        if (priceRange) {
            const priceKey = 'price-' + priceRange;
            if (counts.hasOwnProperty(priceKey)) counts[priceKey]++;
        }
    });

    // Atualizar elementos HTML
    Object.keys(counts).forEach(key => {
        const elem = document.getElementById('count-' + key);
        if (elem) {
            elem.textContent = `(${counts[key]})`;
        }
    });
}

// Tornar funções globais
window.toggleFilters = toggleFilters;
window.clearFilters = clearFilters;
window.applyFilters = applyFilters;

console.log('✅ Sistema de filtros carregado');

// Mostrar todas as categorias sem filtros
async function showAllCategories() {
    try {
        // Limpar filtros
        clearFilters();

        // Mostrar loading
        showNavigationLoading();

        // Buscar todas as categorias
        const response = await fetch('/api/pricing/categories/filtered');
        const data = await response.json();

        // Exibir todas
        displayFilteredCategories(data.categories || []);

        console.log('📋 Mostrando todas as categorias:', data.total);

    } catch (error) {
        console.error('❌ Erro ao mostrar todas categorias:', error);
    } finally {
        hideNavigationLoading();
    }
}

// Permitir desmarcar radio buttons de Type/Pattern
let lastSelectedType = null;

function setupRadioToggle() {
    const typeRadios = document.querySelectorAll('#typeFilters input[type="radio"]');

    typeRadios.forEach(radio => {
        radio.addEventListener('click', function (e) {
            // MOSTRAR LOADING IMEDIATAMENTE
            showLoading();
            // Se clicou no mesmo que já estava marcado
            if (this.value === lastSelectedType && this.checked) {
                // Pequeno delay para o browser processar o click
                setTimeout(() => {
                    this.checked = false;
                    lastSelectedType = null;
                    console.log('🔄 Type/Pattern desmarcado');
                    applyFilters(); // Reaplicar filtros
                }, 50);
            } else {
                // Atualizar último selecionado
                lastSelectedType = this.value;
            }
        });
    });

    console.log('✅ Radio toggle configurado');
}

// Chamar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(setupRadioToggle, 500);

    // Atualizar preço do badge após carregar tudo
    setTimeout(() => {
        if (window.updateCategoryPriceBadge) {
            window.updateCategoryPriceBadge();
        }
    }, 1000);
});

// Tornar global
window.showAllCategories = showAllCategories;

// Tornar global
window.showAllCategories = showAllCategories;

// Função para atualizar o preço do badge baseado no desconto do carrinho
async function updateCategoryPriceBadge() {
    try {

        // Verificar se deve mostrar preços
        if (!shouldShowPrices()) {
            return; // Sair sem fazer nada
        }

        const priceElement = document.querySelector('.category-price-badge');
        if (!priceElement) return;

        // Se não tem carrinho ou está vazio, não fazer nada
        if (!window.CartSystem || !window.CartSystem.state.items || window.CartSystem.state.items.length === 0) {
            return;
        }

        // Identificar qual categoria está sendo visualizada
        let currentCategoryName = null;
        if (window.navigationState && window.navigationState.currentPath && window.navigationState.currentPath.length > 0) {
            // Pegar o último item do path (categoria atual)
            const lastPath = window.navigationState.currentPath[window.navigationState.currentPath.length - 1];
            currentCategoryName = lastPath.name;
        }

        if (!currentCategoryName) {
            console.log('❌ Não foi possível identificar a categoria atual');
            return;
        }

        // Buscar preço com desconto do backend
        const response = await fetch(`/api/cart/${window.CartSystem.state.sessionId}/calculate-total`);
        const result = await response.json();

        if (result.success && result.data && result.data.discountRule && result.data.discountRule.detalhes && result.data.discountRule.detalhes.length > 0) {
            // Procurar o detalhe da categoria ATUAL
            let matchedDetail = null;

            for (const detail of result.data.discountRule.detalhes) {
                // Processar nome da categoria do detalhe
                let categoryFromDetail = detail.categoria;
                if (categoryFromDetail.endsWith('/')) {
                    categoryFromDetail = categoryFromDetail.slice(0, -1);
                }
                const lastSlash = categoryFromDetail.lastIndexOf('/');
                if (lastSlash !== -1) {
                    categoryFromDetail = categoryFromDetail.substring(lastSlash + 1);
                }

                // Comparar com a categoria atual
                if (categoryFromDetail === currentCategoryName) {
                    matchedDetail = detail;
                    break;
                }
            }

            if (matchedDetail && matchedDetail.precoUnitario) {
                // Atualizar o texto do badge
                priceElement.innerHTML = `$${matchedDetail.precoUnitario.toFixed(2)}`;
                priceElement.classList.remove('no-price');
                console.log(`✅ Badge de preço atualizado para $${matchedDetail.precoUnitario} (categoria: ${currentCategoryName})`);
            } else {
                console.log(`⚠️ Categoria "${currentCategoryName}" não tem items no carrinho`);
            }
        }
    } catch (error) {
        console.error('Erro ao atualizar badge de preço:', error);
    }
}

// Exportar para uso global
window.updateCategoryPriceBadge = updateCategoryPriceBadge;

// Função para atualizar o preço no modal fullscreen
async function updateModalPriceBadge() {
    try {

        // Verificar se deve mostrar preços
        if (!shouldShowPrices()) {
            return; // Sair sem fazer nada
        }

        const modalPriceElement = document.querySelector('.modal-price-badge');
        if (!modalPriceElement) return;

        // Se não tem carrinho ou está vazio, não fazer nada
        if (!window.CartSystem || !window.CartSystem.state.items || window.CartSystem.state.items.length === 0) {
            return;
        }

        // Identificar qual categoria está sendo visualizada no modal
        let currentCategoryName = null;
        if (window.navigationState && window.navigationState.currentPath && window.navigationState.currentPath.length > 0) {
            // Pegar o último item do path (categoria atual)
            const lastPath = window.navigationState.currentPath[window.navigationState.currentPath.length - 1];
            currentCategoryName = lastPath.name;
        }

        if (!currentCategoryName) {
            console.log('❌ Modal: Não foi possível identificar a categoria atual');
            return;
        }

        // Buscar preço com desconto do backend
        const response = await fetch(`/api/cart/${window.CartSystem.state.sessionId}/calculate-total`);
        const result = await response.json();

        if (result.success && result.data && result.data.discountRule && result.data.discountRule.detalhes && result.data.discountRule.detalhes.length > 0) {
            // Procurar o detalhe da categoria ATUAL
            let matchedDetail = null;

            for (const detail of result.data.discountRule.detalhes) {
                // Processar nome da categoria do detalhe
                let categoryFromDetail = detail.categoria;
                if (categoryFromDetail.endsWith('/')) {
                    categoryFromDetail = categoryFromDetail.slice(0, -1);
                }
                const lastSlash = categoryFromDetail.lastIndexOf('/');
                if (lastSlash !== -1) {
                    categoryFromDetail = categoryFromDetail.substring(lastSlash + 1);
                }

                // Comparar com a categoria atual
                if (categoryFromDetail === currentCategoryName) {
                    matchedDetail = detail;
                    break;
                }
            }

            if (matchedDetail && matchedDetail.precoUnitario) {
                // Atualizar o texto do badge do modal
                modalPriceElement.innerHTML = `$${matchedDetail.precoUnitario.toFixed(2)}`;
                console.log(`✅ Badge do modal atualizado para $${matchedDetail.precoUnitario} (categoria: ${currentCategoryName})`);
            } else {
                console.log(`⚠️ Modal: Categoria "${currentCategoryName}" não tem items no carrinho`);
            }
        }
    } catch (error) {
        console.error('Erro ao atualizar badge do modal:', error);
    }
}

// Exportar para uso global
window.updateModalPriceBadge = updateModalPriceBadge;