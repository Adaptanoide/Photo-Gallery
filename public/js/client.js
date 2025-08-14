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

// Mostrar categorias principais
function showCategories() {
    hideAllContainers();
    hideLoading(); // NOVO: esconder loading
    document.getElementById('categoriesContainer').style.display = 'grid';

    const containerEl = document.getElementById('categoriesContainer');
    const { allowedCategories } = navigationState;

    if (allowedCategories.length === 0) {
        showNoContent('No categories available', 'Please contact the administrator to verify your permissions.');
        return;
    }

    // Gerar cards de categorias
    containerEl.innerHTML = allowedCategories.map(category => `
        <div class="category-card" onclick="navigateToCategory('${category.id}', '${category.name}')">
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

    // Esconder breadcrumb na tela inicial
    document.getElementById('breadcrumbContainer').style.display = 'none';
    document.getElementById('backNavigation').style.display = 'none';
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
            <div class="folder-card" onclick="navigateToSubfolder('${folder.id}', '${folder.name}')">
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
            // Usar thumbnail de melhor qualidade do Google Drive
            const thumbnailUrl = photo.thumbnailLink ?
                photo.thumbnailLink.replace('=s220', '=s220') : // Manter original
                photo.thumbnailMedium ||
                photo.thumbnailSmall ||
                '';

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

        // Buscar foto em alta resolução
        const response = await fetch(`/api/drive/photo/${photoId}?size=large`);
        const data = await response.json();

        if (data.success && data.photo.imageUrl) {
            img.src = data.photo.imageUrl;
            img.onload = () => {
                spinner.style.display = 'none';
                img.style.display = 'block';
            };
        } else {
            throw new Error('Error loading photo');
        }

    } catch (error) {
        console.error('Error loading photo:', error);
        spinner.style.display = 'none';
        img.style.display = 'block';

        // Tentar usar a foto atual como fallback
        const currentPhoto = navigationState.currentPhotos[navigationState.currentPhotoIndex];
        if (currentPhoto && currentPhoto.thumbnailLink) {
            img.src = currentPhoto.thumbnailLink.replace('=s220', '=s1200');
        } else {
            img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23f8f9fa"/><text x="50%" y="50%" font-family="Arial" font-size="16" fill="%23666" text-anchor="middle" dy=".3em">Error loading photo</text></svg>';
        }
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
        return `
            <span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>
            ${isLast ?
                `<span class="breadcrumb-item current">${item.name}</span>` :
                `<button class="breadcrumb-item" onclick="navigateToBreadcrumb(${index})">${item.name}</button>`
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
document.addEventListener('DOMContentLoaded', () => {
    if (isZoomAvailable()) {
        console.log('✅ Zoom system available');
    } else {
        console.warn('⚠️ Zoom system not loaded');
    }
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
                fullImageUrl: photo.webViewLink,
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