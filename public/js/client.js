//public/js/client.js

/**
 * CLIENT.JS - SUNSHINE COWHIDES
 * JavaScript específico para interface do cliente
 * Extraído de client.html para modularização
 */

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

// Alias local para compatibilidade
let navigationState = window.navigationState;

// ===== SISTEMA DE CACHE PARA NAVEGAÇÃO VIA FILTROS =====
// Cache global de todas as categorias e seus caminhos
let globalCategoriesCache = new Map();

// Mapa das categorias principais (será preenchido automaticamente)
let mainCategoriesMap = {};

// Mapa COMPLETO das subcategorias intermediárias com IDs REAIS
const INTERMEDIATE_FOLDERS_MAP = {
    // Brazil Top Selected Categories > Subcategorias
    'Extra Large': '1Os3jXBBMFuZipaIE90DdjNuI1hAhNphF',
    'Medium Large': '1BjqQeS0xe0EhN8353AzaMYiAhlV88HnG',
    'Small': '12uruRqw07061R2fB4O1p2iU5CcpTstBz',

    // Rodeo Rugs > Subcategorias (Nível 1)
    '3\'x5 Rodeo Rug': '1uoRcbcydmoMq61hXvze9mpzFBdkQte8I',
    'Round Rug': '1NE2vm1xP5wHd8hThwq0FLBS6bPsFr5FT',

    // Rodeo Rugs > Round Rug > Subcategorias (Nível 2)
    'Round Rug::Brazil': '1m24Q5CIsfVFusowI7yzdgnMsN09mXf7V',
    'Round Rug::Colombia': '1YPtRsCQv8-kJOWvuSh3Orjzw7XziPXuo',

    // Rodeo Rugs > 3'x5 Rodeo Rug > Subcategorias (Nível 2)
    '3\'x5 Rodeo Rug::Colombia': '1QzKybg7Nf7RTTKDjWYxLQr43VIlEkCyN',

    // Colombian Cowhides > Subcategorias
    '0. Small': '1a0jS1p-J5SjthVviDg9t7SAxCk09D6Rm',
    '1. Medium': '1b-PBngUoUmO7dn1ng1kzo0YV2m4VT6yE',
    '2. Large': '1AMkKBIhxWZ2JVOBE4a2OZEC19wDCKRfH',
    '3. X-Large': '1_OGzVEd5zl2ezU9lmQAikL0H1pm_x04o',
    '4. Value Tricolor Dark Tones & Creamish White S-M': '1RNb17klfL5jElVAEEMxz9OenMebsNVEn',
    '5. Value Tricolor Dark Tones & Creamish White L-XL': '1v55KZfYe5f6Hzj1bD4TZU3V-TulADmEn',

    // Rodeo Rugs > Round Rug > Colombia > Pastas finais
    '40" Round Rug Single Star': '110NT-Xq_QiuSwuUXkWZD4sPrlUJWE2i-',
    '60\'\' Round Rug Multi Star': '1DFxLI3utsLLlc9Wlki1yw_iAEAxMESYi',

    // Contextos alternativos para Brazil e Colombia quando aparecem sozinhos
    'Brazil': '1m24Q5CIsfVFusowI7yzdgnMsN09mXf7V', // Default para Round Rug > Brazil
    'Colombia': '1YPtRsCQv8-kJOWvuSh3Orjzw7XziPXuo' // Default para Round Rug > Colombia
};

// ===== FUNÇÃO PARA ESCAPAR STRINGS PARA USO SEGURO =====
function escapeForJS(str) {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\\\')     // Escapar barras invertidas
        .replace(/"/g, '\\"')        // Escapar aspas duplas  
        .replace(/'/g, "\\'")        // Escapar apóstrofes
        .replace(/\n/g, '\\n')       // Escapar quebras de linha
        .replace(/\r/g, '\\r');      // Escapar retorno de carro
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
        const response = await fetch(`/api/auth/client/data?code=${session.accessCode}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Error loading data');
        }

        // Salvar dados no estado
        navigationState.clientData = data;
        navigationState.allowedCategories = data.allowedCategories;

        // Atualizar interface com dados recebidos
        updateClientInterface(data);
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

// Função para atualizar cabeçalho do cliente
function updateClientInterface(data) {
    const { client, allowedCategories } = data;

    // Atualizar cabeçalho
    const welcomeEl = document.getElementById('clientWelcome');
    const infoEl = document.getElementById('clientInfo');

    welcomeEl.textContent = `Welcome, ${client.name}!`;
    infoEl.textContent = `Code: ${client.code} - ${allowedCategories.length} ${allowedCategories.length === 1 ? 'category' : 'categories'} available`;
}

// ===== NAVEGAÇÃO DE CATEGORIAS =====

function showCategories() {
    hideAllContainers();
    hideLoading();
    document.getElementById('categoriesContainer').style.display = 'grid';

    const containerEl = document.getElementById('categoriesContainer');
    const { allowedCategories } = navigationState;

    if (allowedCategories.length === 0) {
        showNoContent('No categories available', 'Please contact the administrator to verify your permissions.');
        return;
    }

    // Gerar cards de categorias
    containerEl.innerHTML = allowedCategories.map(category => `
        <div class="category-card" onclick="navigateToCategory('${category.id}', '${escapeForJS(category.name)}')">
            <h3>
                <i class="fas fa-folder"></i> 
                ${category.name}
            </h3>
            <p>Category with full navigation access enabled</p>
            <div class="category-meta">
                <i class="fas fa-info-circle"></i> Click to explore subcategories and products
            </div>
        </div>
    `).join('');

    // MODIFICAR ESTAS LINHAS - Manter breadcrumb SEMPRE visível!
    document.getElementById('breadcrumbContainer').style.display = 'block';  // MUDOU!
    document.getElementById('backNavigation').style.display = 'none';

    // Limpar o path do breadcrumb quando estiver na home
    const breadcrumbPath = document.getElementById('breadcrumbPath');
    if (breadcrumbPath) {
        breadcrumbPath.innerHTML = ''; // Limpar, deixando só o botão Home
    }
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
    try {
        showLoading();

        // Buscar estrutura da pasta usando o explorador melhorado
        const response = await fetch(`/api/drive/explore/${folderId}?depth=1`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Error loading folder');
        }

        const folderData = data.structure;

        // Verificar se há subpastas ou se há fotos diretas
        if (folderData.hasSubfolders && folderData.folders.length > 0) {
            // Mostrar subpastas
            showSubfolders(folderData.folders);
        } else if (folderData.hasImages || folderData.totalImages > 0) {
            // Mostrar fotos diretamente
            await loadPhotos(folderId);
        } else {
            // Pasta vazia
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
    hideLoading(); // NOVO: esconder loading
    document.getElementById('foldersContainer').style.display = 'grid';
    document.getElementById('breadcrumbContainer').style.display = 'block';
    document.getElementById('backNavigation').style.display = 'block';

    const containerEl = document.getElementById('foldersContainer');

    containerEl.innerHTML = folders.map(folder => {
        // Usar o nome da pasta como descrição do produto
        const description = generateProductDescription(folder.name);
        const hasPhotos = folder.hasImages || folder.imageCount > 0;

        return `
            <div class="folder-card" onclick="navigateToSubfolder('${folder.id}', '${escapeForJS(folder.name)}')">
                <h4>
                    <i class="fas fa-${hasPhotos ? 'images' : 'folder'}"></i>
                    ${folder.name}
                </h4>
                <div class="folder-description">${description}</div>
                <div class="folder-stats">
                    ${hasPhotos ? `<span><i class="fas fa-image"></i> ${folder.imageCount || folder.totalFiles} photo(s)</span>` : ''}
                    ${folder.totalSubfolders > 0 ? `<span><i class="fas fa-folder"></i> ${folder.totalSubfolders} subfolder(s)</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Navegar para subpasta
async function navigateToSubfolder(folderId, folderName) {
    // CÓDIGO ORIGINAL CONTINUA
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

        const response = await fetch(`/api/drive/photos/${folderId}?limit=500`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Error loading photos');
        }

        navigationState.currentPhotos = data.photos;
        const categoryPrice = await loadCategoryPrice(folderId);
        showPhotosGallery(data.photos, data.folder.name, categoryPrice);

    } catch (error) {
        console.error('Error loading photos:', error);
        showNoContent('Error loading photos', error.message);
    } finally {
        showPhotosLoading(false);
    }
}

// Mostrar galeria de fotos - COM VIRTUAL SCROLLING
function showPhotosGallery(photos, folderName, categoryPrice) {
    hideAllContainers();
    hideLoading(); // NOVO: esconder loading
    document.getElementById('photosContainer').style.display = 'block';
    document.getElementById('breadcrumbContainer').style.display = 'block';
    document.getElementById('backNavigation').style.display = 'block';

    // Atualizar título e contador
    const galleryTitle = document.getElementById('galleryTitle');
    if (categoryPrice && categoryPrice.hasPrice) {
        galleryTitle.innerHTML = `${folderName} <span class="category-price">${categoryPrice.formattedPrice}</span>`;
    } else {
        galleryTitle.textContent = folderName;
    }

    // Gerar grid de fotos
    const gridEl = document.getElementById('photosGrid');

    if (photos.length === 0) {
        showNoContent('No photos', 'This category has no photos at the moment.');
        return;
    }

    // NOVO: Decidir se usa Virtual Scrolling ou modo tradicional
    const USE_VIRTUAL_SCROLLING = photos.length > 30;

    if (USE_VIRTUAL_SCROLLING && window.virtualGallery) {
        // MODO VIRTUAL SCROLLING - Para muitas fotos
        console.log(`🚀 Usando Virtual Scrolling para ${photos.length} fotos`);
        document.getElementById('photosCount').innerHTML = `Loading <strong>${photos.length}</strong> photos...`;

        // Limpar galeria anterior se existir
        if (window.virtualGallery.destroy) {
            window.virtualGallery.destroy();
        }

        // Inicializar Virtual Gallery
        window.virtualGallery.init(photos, gridEl, categoryPrice);

    } else {
        // MODO TRADICIONAL - Para poucas fotos (mantém código original)
        console.log(`📋 Modo tradicional para ${photos.length} fotos`);
        document.getElementById('photosCount').textContent = `${photos.length} photo(s)`;

        gridEl.innerHTML = photos.map((photo, index) => {
            // Usar sistema centralizado de cache
            const thumbnailUrl = ImageUtils.getThumbnailUrl(photo);

            // Verificar se está no carrinho
            const isInCart = window.CartSystem && CartSystem.isInCart(photo.id);

            return `
                <div class="photo-thumbnail" onclick="openPhotoModal(${index})">
                    <img src="${thumbnailUrl}" 
                        alt="${photo.name}" 
                        loading="lazy"
                        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    
                    <!-- Badge de preço no canto superior direito -->
                    <div class="photo-price ${categoryPrice?.hasPrice ? '' : 'no-price'}">
                        ${categoryPrice?.formattedPrice || 'Check price'}
                    </div>

                    <!-- NOVO: Botão Add to Cart -->
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

    // NOVO: Inicializar sistema de zoom
    initializePhotoZoom();

    // Atualizar informações comerciais elegantes
    await updateModalCommercialInfo(photo, photoIndex, photos.length);

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
}

// Atualizar informações comerciais do modal
async function updateModalCommercialInfo(photo, photoIndex, totalPhotos) {
    // 1. HEADER - Nome da categoria em vez de nome técnico
    const categoryName = getCurrentCategoryDisplayName();
    document.getElementById('modalPhotoTitle').textContent = categoryName;

    // 2. CONTADOR (manter como está)
    document.getElementById('modalPhotoCounter').textContent = `${photoIndex + 1} / ${totalPhotos}`;

    // 3. FOOTER - Preço e qualidade em vez de dados técnicos
    await updateModalPriceInfo();
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

// Atualizar informações de preço no modal
async function updateModalPriceInfo() {
    try {
        const currentFolderId = navigationState.currentFolderId;
        const priceInfo = currentFolderId ? await loadCategoryPrice(currentFolderId) : null;

        if (priceInfo && priceInfo.hasPrice) {
            // Badge dourado igual aos thumbnails
            document.getElementById('modalPhotoSize').innerHTML = `
                <span class="modal-price-badge">${priceInfo.formattedPrice}</span>
            `;
            document.getElementById('modalPhotoDate').textContent = ''; // Vazio - sem descrição
        } else {
            // Sem preço - badge discreto
            document.getElementById('modalPhotoSize').innerHTML = `
                <span class="modal-price-badge no-price">Check price</span>
            `;
            document.getElementById('modalPhotoDate').textContent = ''; // Vazio - sem descrição
        }
    } catch (error) {
        console.error('Erro ao carregar preço do modal:', error);
        // Fallback em caso de erro
        document.getElementById('modalPhotoSize').innerHTML = `
            <span class="modal-price-badge no-price">Contact us</span>
        `;
        document.getElementById('modalPhotoDate').textContent = ''; // Vazio - sem descrição
    }
}

// Carregar foto em alta resolução no modal
async function loadPhotoInModal(photoId) {
    const img = document.getElementById('modalPhoto');
    const spinner = document.getElementById('photoLoadingSpinner');

    try {
        spinner.style.display = 'block';
        img.style.display = 'none';

        // USAR NOSSA ROTA DE CACHE!
        const imageUrl = `/api/images/full/${photoId}`;

        img.src = imageUrl;
        img.onload = () => {
            spinner.style.display = 'none';
            img.style.display = 'block';
        };

        img.onerror = () => {
            console.error('Erro carregando imagem:', photoId);
            spinner.style.display = 'none';
            img.style.display = 'block';
            // Fallback
            const currentPhoto = navigationState.currentPhotos[navigationState.currentPhotoIndex];
            if (currentPhoto) {
                img.src = ImageUtils.getFullImageUrl(currentPhoto);
            } else {
                img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23f8f9fa"/><text x="50%" y="50%" font-family="Arial" font-size="16" fill="%23666" text-anchor="middle" dy=".3em">Error loading photo</text></svg>';
            }
        };

    } catch (error) {
        console.error('Error loading photo:', error);
        spinner.style.display = 'none';
        img.style.display = 'block';
    }
}

// Navegar para foto anterior
function previousPhoto() {
    if (navigationState.currentPhotoIndex > 0) {
        // NOVO: Notificar mudança de foto para resetar zoom
        notifyPhotoChange();
        openPhotoModal(navigationState.currentPhotoIndex - 1);
        // NOVO: Notificar carrinho sobre mudança
        notifyCartOnPhotoChange();
    }
}

// Navegar para próxima foto
function nextPhoto() {
    if (navigationState.currentPhotoIndex < navigationState.currentPhotos.length - 1) {
        // NOVO: Notificar mudança de foto para resetar zoom
        notifyPhotoChange();
        openPhotoModal(navigationState.currentPhotoIndex + 1);
        // NOVO: Notificar carrinho sobre mudança
        notifyCartOnPhotoChange();
    }
}

// Fechar modal de foto
function closePhotoModal() {
    // NOVO: Destruir zoom antes de fechar
    destroyPhotoZoom();
    document.getElementById('photoModal').style.display = 'none';
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

// Selecionar foto para carrinho (AGORA FUNCIONAL)
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

// ===== NOVA FUNÇÃO PARA CONSTRUIR BREADCRUMB NAVEGÁVEL =====
// Construir breadcrumb navegável com IDs reais e suporte a contextos
function buildNavigablePath(fullPath, targetId) {
    console.log('🔍 Construindo caminho navegável para:', fullPath);

    const parts = fullPath.split('→').map(p => p.trim());

    // Remover "Sunshine Cowhides Actual Pictures"
    if (parts[0] === 'Sunshine Cowhides Actual Pictures') {
        parts.shift();
    }

    const path = [];
    let previousPart = null;

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
            // Partes intermediárias - tentar múltiplas estratégias

            // Estratégia 1: Busca direta
            itemId = INTERMEDIATE_FOLDERS_MAP[part];

            // Estratégia 2: Busca com contexto do pai direto
            if (!itemId && previousPart) {
                const contextKey = `${previousPart}::${part}`;
                itemId = INTERMEDIATE_FOLDERS_MAP[contextKey];
                if (itemId) {
                    console.log(`✅ Encontrado com contexto: ${contextKey}`);
                }
            }

            // Estratégia 3: Busca com contexto da raiz
            if (!itemId && parts[0]) {
                const rootContextKey = `${parts[0]}::${part}`;
                itemId = INTERMEDIATE_FOLDERS_MAP[rootContextKey];
                if (itemId) {
                    console.log(`✅ Encontrado com contexto raiz: ${rootContextKey}`);
                }
            }

            isNavigable = !!itemId;

            if (!itemId) {
                console.log(`⚠️ Pasta não mapeada: ${part} (nível ${index})`);
            }
        }

        path.push({
            id: itemId,
            name: part,
            isLast: isLast,
            isNavigable: isNavigable
        });

        previousPart = part;
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

// Ocultar todos os containers incluindo loading
function hideAllContainers() {
    document.getElementById('categoriesContainer').style.display = 'none';
    document.getElementById('foldersContainer').style.display = 'none';
    document.getElementById('photosContainer').style.display = 'none';
    document.getElementById('noContentMessage').style.display = 'none';
    // NOVO: esconder loading também
    const loadingEl = document.getElementById('navigationLoading');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

// Mostrar mensagem de conteúdo vazio
function showNoContent(title, message) {
    hideAllContainers();
    hideLoading(); // NOVO: esconder loading
    document.getElementById('noContentMessage').style.display = 'block';
    document.getElementById('noContentMessage').innerHTML = `
        <i class="fas fa-folder-open fa-3x"></i>
        <h3>${title}</h3>
        <p>${message}</p>
    `;
    document.getElementById('breadcrumbContainer').style.display = 'block';
    document.getElementById('backNavigation').style.display = 'block';
}

// Mostrar loading discreto de navegação
function showLoading() {
    hideAllContainers();
    const loadingEl = document.getElementById('navigationLoading');
    if (loadingEl) {
        loadingEl.style.display = 'flex';
    }
}

// Esconder loading de navegação
function hideLoading() {
    const loadingEl = document.getElementById('navigationLoading');
    if (loadingEl) {
        loadingEl.style.display = 'none';
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
    // Pode alterar para 'en-US' se preferir formato americano
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

        // NOVO: Buscar código do cliente da sessão
        let clientCode = null;
        const savedSession = localStorage.getItem('sunshineSession');
        if (savedSession) {
            const session = JSON.parse(savedSession);
            clientCode = session.accessCode;
        }

        console.log(`🏷️ Loading price for category ${folderId}, client: ${clientCode || 'ANONYMOUS'}`);

        // NOVO: Incluir clientCode na requisição
        const url = `/api/pricing/category-price?googleDriveId=${folderId}${clientCode ? `&clientCode=${clientCode}` : ''}`;
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
                price: data.category.finalPrice || 0,  // NOVO: usar finalPrice em vez de basePrice
                formattedPrice: data.category.formattedPrice,
                priceSource: data.category.priceSource || 'base'  // NOVO: fonte do preço
            };

            // NOVO: Log detalhado para debug
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
        // Pegar a foto
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
            showNotification('Item removed from cart', 'info');
            // Atualizar botão para ADD
            const button = document.querySelector(`button[onclick*="'${driveFileId}'"]`);
            if (button) {
                button.classList.remove('in-cart');
                button.innerHTML = '<i class="fas fa-shopping-cart"></i><span>Add</span>';
                button.title = 'Add to cart';
            }
        } else {
            // Adicionar ao carrinho
            // Buscar preço da categoria
            const currentFolderId = navigationState.currentFolderId;
            let priceInfo = { hasPrice: false, price: 0, formattedPrice: 'No price' };

            if (currentFolderId && window.loadCategoryPrice) {
                try {
                    priceInfo = await window.loadCategoryPrice(currentFolderId);
                    console.log('✅ Preço encontrado para thumbnail:', priceInfo);
                } catch (error) {
                    console.warn('❌ Erro ao buscar preço para thumbnail:', error);
                }
            }
            await CartSystem.addItem(driveFileId, {
                fileName: photo.name,
                thumbnailUrl: photo.thumbnailLink || photo.webViewLink,
                fullImageUrl: ImageUtils.getFullImageUrl(photo),
                // Pegar o ÚLTIMO nível do path (onde a foto realmente está)
                category: navigationState.currentPath?.length > 1
                    ? navigationState.currentPath[navigationState.currentPath.length - 1].name
                    : navigationState.currentPath[0]?.name || 'Category',
                categoryName: navigationState.currentPath[navigationState.currentPath.length - 1] || 'Products',
                categoryPath: navigationState.currentPath.join(' > '),
                price: priceInfo.price,
                formattedPrice: priceInfo.formattedPrice,
                hasPrice: priceInfo.hasPrice
            });
            showNotification('Item added to cart!', 'success');
            // Atualizar botão para REMOVE  
            const button = document.querySelector(`button[onclick*="'${driveFileId}'"]`);
            if (button) {
                button.classList.add('in-cart');
                button.innerHTML = '<i class="fas fa-check"></i><span>Remove</span>';
                button.title = 'Remove from cart';
            }
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error updating cart', 'error');
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
        thumbButton.innerHTML = '<i class="fas fa-check"></i><span>Remove</span>';
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
    // Desmarcar checkboxes
    document.querySelectorAll('#typeFilters input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    // Reset radio buttons
    document.querySelector('#photoFilters input[value="all"]').checked = true;

    console.log('✅ Filtros limpos');
}

// Aplicar filtros automaticamente
async function autoApplyFilters() {
    console.log('🔍 Aplicando filtros automaticamente...');

    // Coletar filtros selecionados
    const selectedFilters = {
        types: [],
        tones: [],
        sizes: [],
        prices: []
    };

    // Types
    document.querySelectorAll('#typeFilters input[type="checkbox"]:checked').forEach(cb => {
        selectedFilters.types.push(cb.value);
    });

    // Tones
    document.querySelectorAll('#toneFilters input[type="checkbox"]:checked').forEach(cb => {
        selectedFilters.tones.push(cb.value);
    });

    // Sizes
    document.querySelectorAll('#sizeFilters input[type="checkbox"]:checked').forEach(cb => {
        selectedFilters.sizes.push(cb.value);
    });

    // Prices
    document.querySelectorAll('#priceFilters input[type="checkbox"]:checked').forEach(cb => {
        selectedFilters.prices.push(cb.value);
    });

    // Se nenhum filtro selecionado, mostrar todas
    const hasFilters = selectedFilters.types.length > 0 ||
        selectedFilters.tones.length > 0 ||
        selectedFilters.sizes.length > 0 ||
        selectedFilters.prices.length > 0;

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

        // Filtrar categorias
        let filteredCategories = data.categories.filter(cat => {
            // Type filter
            if (selectedFilters.types.length > 0) {
                const catTypes = detectType(cat.name);
                const hasType = selectedFilters.types.some(type => catTypes.includes(type));
                if (!hasType) return false;
            }

            // Tone filter
            if (selectedFilters.tones.length > 0) {
                const catTone = detectTone(cat.name);
                if (!selectedFilters.tones.includes(catTone)) return false;
            }

            // Size filter
            if (selectedFilters.sizes.length > 0) {
                const catSize = detectSize(cat.name);
                if (!catSize || !selectedFilters.sizes.includes(catSize)) return false;
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

// Alias para compatibilidade
function applyFilters() {
    autoApplyFilters();
}

// Limpar todos os filtros
function clearAllFilters() {
    // Desmarcar todos os checkboxes
    document.querySelectorAll('.filter-checkbox input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    // Mostrar todas as categorias
    showCategories();

    console.log('🧹 Filtros limpos');
}

// Para compatibilidade
function clearFilters() {
    clearAllFilters();
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

        categoryCard.innerHTML = `
            <div class="category-collection">${info.collection}</div>
            <h3>
                <i class="fas fa-folder"></i>
                ${info.displayName}
            </h3>
            <p>Category with full navigation access enabled</p>
            <div class="category-meta">
                <span class="photo-count">
                    <i class="fas fa-images"></i> ${category.photoCount} photos
                </span>
            </div>
            <div class="category-action">
                <i class="fas fa-arrow-right"></i>
                <span>Click to explore products</span>
            </div>
        `;

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

        // Contar por tipo - BASEADO NO NOME/PATH
        const typeCounts = {
            'brindle': 0,
            'salt-pepper': 0,
            'black-white': 0,
            'tricolor': 0,
            'exotic': 0
        };

        data.categories.forEach(cat => {
            const fullText = ((cat.name || '') + ' ' + (cat.fullPath || '')).toLowerCase();

            // Verificar cada tipo
            if (fullText.includes('brindle')) {
                typeCounts['brindle']++;
            }
            if (fullText.includes('salt') && fullText.includes('pepper')) {
                typeCounts['salt-pepper']++;
            }
            if (fullText.includes('black') && fullText.includes('white')) {
                typeCounts['black-white']++;
            }
            if (fullText.includes('tricolor')) {
                typeCounts['tricolor']++;
            }
            if (fullText.includes('exotic')) {
                typeCounts['exotic']++;
            }
        });

        // Atualizar os contadores na interface
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

        console.log('📊 Contagens carregadas:', typeCounts);

    } catch (error) {
        console.error('❌ Erro ao carregar contagens:', error);
    }

    // Comentado - data não existe neste contexto
    // updateFilterCounts(data.categories);
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

// Tornar global
window.showAllCategories = showAllCategories;