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
            throw new Error('Sessão não encontrada');
        }

        const session = JSON.parse(savedSession);
        if (!session.accessCode) {
            throw new Error('Código de acesso não encontrado');
        }

        // Fazer requisição para buscar dados
        const response = await fetch(`/api/auth/client/data?code=${session.accessCode}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Erro ao carregar dados');
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
        console.error('Erro ao carregar dados do cliente:', error);

        // Mostrar erro
        loadingEl.style.display = 'none';
        contentEl.style.display = 'none';
        errorEl.style.display = 'block';

        const errorMsg = document.getElementById('errorMessage');
        errorMsg.textContent = error.message || 'Erro de conexão';
    }
}

// Função para atualizar cabeçalho do cliente
function updateClientInterface(data) {
    const { client, allowedCategories } = data;

    // Atualizar cabeçalho
    const welcomeEl = document.getElementById('clientWelcome');
    const infoEl = document.getElementById('clientInfo');

    welcomeEl.textContent = `🎉 Bem-vindo, ${client.name}!`;
    infoEl.textContent = `Código: ${client.code} - ${allowedCategories.length} categoria(s) disponível(eis)`;
}

// ===== NAVEGAÇÃO DE CATEGORIAS =====

// Mostrar categorias principais
function showCategories() {
    hideAllContainers();
    document.getElementById('categoriesContainer').style.display = 'grid';

    const containerEl = document.getElementById('categoriesContainer');
    const { allowedCategories } = navigationState;

    if (allowedCategories.length === 0) {
        showNoContent('Nenhuma categoria disponível', 'Entre em contato com o administrador para verificar suas permissões.');
        return;
    }

    // Gerar cards de categorias
    containerEl.innerHTML = allowedCategories.map(category => `
        <div class="category-card" onclick="navigateToCategory('${category.id}', '${category.name}')">
            <h3>
                <i class="fas fa-folder"></i> 
                ${category.name}
            </h3>
            <p>Categoria com acesso liberado para navegação completa</p>
            <div class="category-meta">
                <i class="fas fa-info-circle"></i> Clique para explorar subcategorias e produtos
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
            throw new Error(data.message || 'Erro ao carregar pasta');
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
            showNoContent('Pasta vazia', 'Esta categoria não possui conteúdo no momento.');
        }

    } catch (error) {
        console.error('Erro ao carregar pasta:', error);
        showNoContent('Erro ao carregar', error.message);
    }
}

// Mostrar subpastas
function showSubfolders(folders) {
    hideAllContainers();
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
                    ${hasPhotos ? `<span><i class="fas fa-image"></i> ${folder.imageCount || folder.totalFiles} foto(s)</span>` : ''}
                    ${folder.totalSubfolders > 0 ? `<span><i class="fas fa-folder"></i> ${folder.totalSubfolders} subpasta(s)</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
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

        const response = await fetch(`/api/drive/photos/${folderId}?limit=500`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Erro ao carregar fotos');
        }

        navigationState.currentPhotos = data.photos;
        const categoryPrice = await loadCategoryPrice(folderId);
        showPhotosGallery(data.photos, data.folder.name, categoryPrice);

    } catch (error) {
        console.error('Erro ao carregar fotos:', error);
        showNoContent('Erro ao carregar fotos', error.message);
    } finally {
        showPhotosLoading(false);
    }
}

// Mostrar galeria de fotos
function showPhotosGallery(photos, folderName, categoryPrice) {
    hideAllContainers();
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
    document.getElementById('photosCount').textContent = `${photos.length} foto(s)`;

    // Gerar grid de fotos
    const gridEl = document.getElementById('photosGrid');

    if (photos.length === 0) {
        showNoContent('Nenhuma foto', 'Esta categoria não possui fotos no momento.');
        return;
    }

    gridEl.innerHTML = photos.map((photo, index) => {
        // Usar thumbnail de melhor qualidade do Google Drive
        const thumbnailUrl = photo.thumbnailLink ?
            photo.thumbnailLink.replace('=s220', '=s400') : // Melhor qualidade
            photo.thumbnailMedium ||
            photo.thumbnailSmall ||
            '';

        return `
            <div class="photo-thumbnail" onclick="openPhotoModal(${index})">
                <img src="${thumbnailUrl}" 
                     alt="${photo.name}" 
                     loading="lazy"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="photo-placeholder" style="display: none;">
                    <i class="fas fa-image"></i>
                    <small>Imagem não disponível</small>
                </div>
                <div class="photo-overlay">
                    <div><strong>${photo.name}</strong></div>
                    <small>${formatFileSize(photo.size)}</small>
                    <div class="photo-price ${categoryPrice?.hasPrice ? 'has-price' : 'no-price'}">
                        <i class="fas fa-tag"></i>
                        <span>${categoryPrice?.formattedPrice || 'Sem preço'}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
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

    // Atualizar informações básicas
    document.getElementById('modalPhotoTitle').textContent = photo.name;
    document.getElementById('modalPhotoCounter').textContent = `${photoIndex + 1} / ${photos.length}`;
    document.getElementById('modalPhotoSize').textContent = `Tamanho: ${formatFileSize(photo.size)}`;
    document.getElementById('modalPhotoDate').textContent = `Data: ${formatDate(photo.modifiedTime)}`;

    // Atualizar botões de navegação
    document.getElementById('prevBtn').disabled = photoIndex === 0;
    document.getElementById('nextBtn').disabled = photoIndex === photos.length - 1;

    // Carregar foto em alta resolução
    await loadPhotoInModal(photo.id);
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
            throw new Error('Erro ao carregar foto');
        }

    } catch (error) {
        console.error('Erro ao carregar foto:', error);
        spinner.style.display = 'none';
        img.style.display = 'block';

        // Tentar usar a foto atual como fallback
        const currentPhoto = navigationState.currentPhotos[navigationState.currentPhotoIndex];
        if (currentPhoto && currentPhoto.thumbnailLink) {
            img.src = currentPhoto.thumbnailLink.replace('=s220', '=s1200');
        } else {
            img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23f8f9fa"/><text x="50%" y="50%" font-family="Arial" font-size="16" fill="%23666" text-anchor="middle" dy=".3em">Erro ao carregar foto</text></svg>';
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
        console.warn('Sistema de carrinho não carregado');
        showNotification('Sistema de carrinho carregando...', 'info');
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
        'Salt & Pepper': 'Padrão mesclado com tons variados',
        'Best Value': 'Excelente custo-benefício',
        'Tannery Run': 'Produção especial do curtume',
        'Tricolor': 'Três cores em padrão natural',
        'Brindle': 'Padrão tigrado natural',
        'Black & White': 'Preto e branco clássico',
        'Brown & White': 'Marrom e branco natural',
        'Exotic': 'Padrões únicos e especiais',
        'Small': 'Tamanho pequeno',
        'Medium': 'Tamanho médio',
        'Large': 'Tamanho grande',
        'XL': 'Tamanho extra grande',
        'ML': 'Médio-grande'
    };

    for (const [pattern, desc] of Object.entries(patterns)) {
        if (folderName.includes(pattern)) {
            return desc;
        }
    }

    return 'Couros de alta qualidade selecionados';
}

// Ocultar todos os containers
function hideAllContainers() {
    document.getElementById('categoriesContainer').style.display = 'none';
    document.getElementById('foldersContainer').style.display = 'none';
    document.getElementById('photosContainer').style.display = 'none';
    document.getElementById('noContentMessage').style.display = 'none';
}

// Mostrar mensagem de conteúdo vazio
function showNoContent(title, message) {
    hideAllContainers();
    document.getElementById('noContentMessage').style.display = 'block';
    document.getElementById('noContentMessage').innerHTML = `
        <i class="fas fa-folder-open fa-3x"></i>
        <h3>${title}</h3>
        <p>${message}</p>
    `;
    document.getElementById('breadcrumbContainer').style.display = 'block';
    document.getElementById('backNavigation').style.display = 'block';
}

// Mostrar loading genérico
function showLoading() {
    hideAllContainers();
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
    return date.toLocaleDateString('pt-BR');
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
        console.log('✅ Sistema de zoom disponível');
    } else {
        console.warn('⚠️ Sistema de zoom não carregado');
    }
});

// Cache de preços por categoria
window.categoryPrices = new Map();

// Buscar preço da categoria atual
async function loadCategoryPrice(folderId) {
    try {
        if (window.categoryPrices.has(folderId)) {
            return window.categoryPrices.get(folderId);
        }

        const response = await fetch(`/api/pricing/category-price?googleDriveId=${folderId}`);
        const data = await response.json();

        let priceInfo = {
            hasPrice: false,
            price: 0,
            formattedPrice: 'Sem preço'
        };

        if (data.success && data.category) {
            priceInfo = {
                hasPrice: data.category.basePrice > 0,
                price: data.category.basePrice || 0,
                formattedPrice: data.category.formattedPrice
            };
        }

        window.categoryPrices.set(folderId, priceInfo);
        return priceInfo;
    } catch (error) {
        console.error('Erro ao buscar preço:', error);
        return { hasPrice: false, price: 0, formattedPrice: 'Erro no preço' };
    }
}