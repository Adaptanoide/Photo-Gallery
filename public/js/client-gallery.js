// public/js/client-gallery.js
/**
 * CLIENT-GALLERY.JS - SUNSHINE COWHIDES
 * Módulo de galeria: Fotos, modal e visualização
 * Parte 2/3 da modularização do client.js
 */

// ===== CONFIGURAÇÃO DO MÓDULO =====
(function() {
    'use strict';
    
    // Verificar dependências
    if (!window.navigationState) {
        console.error('❌ client-gallery.js requer client-core.js');
        return;
    }

    // ===== CARREGAR FOTOS =====
    window.loadPhotos = async function(folderId) {
        try {
            showPhotosLoading(true);

            // Limpar rate rules ao mudar de categoria
            window.specialSelectionRateRules = null;
            window.specialSelectionBasePrice = null;

            // Pegar token
            const savedSession = localStorage.getItem('sunshineSession');
            const headers = {};

            if (savedSession) {
                const session = JSON.parse(savedSession);
                if (session.token) {
                    headers['Authorization'] = `Bearer ${session.token}`;
                    console.log('🔐 Enviando token JWT na requisição');
                }
            }

            const response = await fetch(`/api/gallery/photos?prefix=${encodeURIComponent(folderId)}`, {
                headers: headers
            });
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Error loading photos');
            }

            navigationState.currentPhotos = data.photos;
            const categoryPrice = await loadCategoryPrice(folderId);
            showPhotosGallery(data.photos, data.folder.name, categoryPrice);

            // Inicializar Price Progress Bar
            if (window.PriceProgressBar) {
                window.isSpecialSelection = (data.clientType === 'special');
                console.log('🎯 MARCADO como Special Selection:', window.isSpecialSelection);

                // Controlar sidebar
                const sidebar = document.getElementById('filterSidebar');
                if (sidebar) {
                    if (window.isSpecialSelection) {
                        sidebar.style.display = 'block';
                        const filterContainer = sidebar.querySelector('.filter-container');
                        if (filterContainer) {
                            filterContainer.style.display = 'none';
                        }
                    } else {
                        sidebar.style.display = 'block';
                        const filterContainer = sidebar.querySelector('.filter-container');
                        if (filterContainer) {
                            filterContainer.style.display = 'block';
                        }
                    }
                }

                // Rate rules para Special Selection
                if (data.clientType === 'special' && data.rateRules && data.rateRules.length > 0) {
                    window.specialSelectionRateRules = data.rateRules;
                    window.specialSelectionBasePrice = data.baseCategoryPrice;
                    window.PriceProgressBar.renderSpecialSelection(data.rateRules, data.baseCategoryPrice);
                } else {
                    window.specialSelectionRateRules = null;
                    window.specialSelectionBasePrice = null;
                    if (data.clientType === 'special') {
                        window.PriceProgressBar.hide();
                    } else {
                        window.PriceProgressBar.init(navigationState.currentFolderId);
                    }
                }
            }

            // Guardar nome da categoria
            navigationState.currentCategoryName = data.folder.name;

        } catch (error) {
            console.error('Error loading photos:', error);
            showNoContent('Error loading photos', error.message);
        } finally {
            showPhotosLoading(false);
        }
    }

    // ===== MOSTRAR GALERIA =====
    window.showPhotosGallery = function(photos, folderName, categoryPrice) {
        navigationState.currentCategoryName = folderName;

        hideAllContainers();
        hideLoading();

        // Destruir Virtual Gallery anterior
        if (window.virtualGallery && window.virtualGallery.destroy) {
            console.log('🧹 LIMPANDO Virtual Gallery anterior');
            window.virtualGallery.destroy();
        }

        document.getElementById('photosContainer').style.display = 'block';
        document.getElementById('breadcrumbContainer').style.display = 'block';

        // Iniciar polling
        if (!window.statusCheckInterval) {
            console.log('🔄 Iniciando polling de status');
            startStatusPolling();
        }

        // Atualizar título
        const galleryTitle = document.getElementById('galleryTitle');
        const customPrice = photos[0]?.customPrice;

        if (!shouldShowPrices()) {
            galleryTitle.innerHTML = `${folderName} <span class="category-price-badge contact-price">Contact for Price</span>`;
        } else if (customPrice) {
            galleryTitle.innerHTML = `${folderName} <span class="category-price-badge">$${parseFloat(customPrice).toFixed(2)}</span>`;
        } else if (categoryPrice && categoryPrice.hasPrice) {
            galleryTitle.innerHTML = `${folderName} <span class="category-price-badge">${categoryPrice.formattedPrice}</span>`;
        } else {
            galleryTitle.innerHTML = `${folderName} <span class="category-price-badge no-price">Price on request</span>`;
        }

        const gridEl = document.getElementById('photosGrid');

        if (photos.length === 0) {
            showNoContent('No photos', 'This category has no photos at the moment.');
            return;
        }

        // Virtual Scrolling para muitas fotos
        const USE_VIRTUAL_SCROLLING = photos.length > 30;

        if (USE_VIRTUAL_SCROLLING && window.virtualGallery) {
            console.log(`🚀 Usando Virtual Scrolling para ${photos.length} fotos`);
            document.getElementById('photosCount').innerHTML = `Loading <strong>${photos.length}</strong> photos...`;
            window.virtualGallery.init(photos, gridEl, categoryPrice);
        } else {
            // Modo tradicional
            console.log(`📋 Modo tradicional para ${photos.length} fotos`);
            document.getElementById('photosCount').textContent = `${photos.length} photo(s)`;

            gridEl.innerHTML = photos.map((photo, index) => {
                const thumbnailUrl = ImageUtils.getThumbnailUrl(photo);
                const isInCart = window.CartSystem && CartSystem.isInCart(photo.id);

                return `
                    <div class="photo-thumbnail" data-photo-id="${photo.id}" data-status="${photo.status || 'available'}" onclick="openPhotoModal(${index})">
                        <img src="${thumbnailUrl}" 
                            alt="${photo.name}" 
                            onerror="this.onerror=null; this.src=this.src.replace('/_thumbnails/', '/');"
                            loading="lazy">
                        
                        <div class="photo-price ${photo.customPrice || categoryPrice?.hasPrice ? '' : 'no-price'}">
                            ${photo.customPrice ? `$${parseFloat(photo.customPrice).toFixed(2)}` : (categoryPrice?.formattedPrice || 'Price on request')}
                        </div>
                        
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
    window.openPhotoModal = async function(photoIndex) {
        const photos = navigationState.currentPhotos;
        if (!photos || photoIndex < 0 || photoIndex >= photos.length) return;

        navigationState.currentPhotoIndex = photoIndex;
        const photo = photos[photoIndex];

        // Verificar status da foto
        setTimeout(() => {
            const photoNumber = photo.id.split('/').pop().replace('.webp', '');
            let photoElement = document.querySelector(`[data-photo-id="${photoNumber}"]`) ||
                document.querySelector(`[data-photo-id="${photoNumber}.webp"]`) ||
                document.querySelector(`[data-photo-id*="${photoNumber}"]`);

            const isReserved = photoElement && photoElement.getAttribute('data-status') === 'reserved';
            const isSold = photoElement && photoElement.getAttribute('data-status') === 'sold';

            const oldOverlay = document.getElementById('modalUnavailableOverlay');
            if (oldOverlay) oldOverlay.remove();

            if (isReserved) {
                const modalContent = document.querySelector('.modal-content');
                if (modalContent) {
                    const overlay = document.createElement('div');
                    overlay.id = 'modalUnavailableOverlay';
                    overlay.style.cssText = `
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        background: rgba(255, 193, 7, 0.95);
                        color: #000;
                        padding: 20px 40px;
                        font-size: 24px;
                        font-weight: bold;
                        border-radius: 8px;
                        z-index: 1000;
                        pointer-events: none;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                    `;
                    overlay.innerHTML = '<i class="fas fa-lock"></i> UNAVAILABLE';
                    const cartBtn = document.getElementById('cartToggleBtn');
                    if (cartBtn) cartBtn.style.display = 'none';
                    modalContent.appendChild(overlay);

                    const modalPhoto = document.getElementById('modalPhoto');
                    if (modalPhoto) {
                        modalPhoto.style.filter = 'brightness(0.5)';
                    }
                }
            } else if (isSold) {
                const modalContent = document.querySelector('.modal-content');
                if (modalContent) {
                    const overlay = document.createElement('div');
                    overlay.id = 'modalUnavailableOverlay';
                    overlay.style.cssText = `
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        background: rgba(220, 53, 69, 0.95);
                        color: #fff;
                        padding: 20px 40px;
                        font-size: 24px;
                        font-weight: bold;
                        border-radius: 8px;
                        z-index: 1000;
                        pointer-events: none;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                    `;
                    overlay.innerHTML = '<i class="fas fa-ban"></i> SOLD OUT';
                    const cartBtn = document.getElementById('cartToggleBtn');
                    if (cartBtn) cartBtn.style.display = 'none';
                    modalContent.appendChild(overlay);

                    const modalPhoto = document.getElementById('modalPhoto');
                    if (modalPhoto) {
                        modalPhoto.style.filter = 'brightness(0.5)';
                    }
                }
            } else {
                const modalPhoto = document.getElementById('modalPhoto');
                if (modalPhoto) {
                    modalPhoto.style.filter = 'none';
                    const cartBtn = document.getElementById('cartToggleBtn');
                    if (cartBtn) cartBtn.style.display = '';
                }
            }
        }, 500);

        // Mostrar modal
        const modal = document.getElementById('photoModal');
        modal.style.display = 'flex';

        // Inicializar zoom
        if (typeof initializePhotoZoom === 'function') {
            initializePhotoZoom();
        }

        // Atualizar informações
        await updateModalCommercialInfo(photo, photoIndex, photos.length);
        await updateModalPriceInfo(photo);

        // Botões de navegação
        document.getElementById('prevBtn').disabled = photoIndex === 0;
        document.getElementById('nextBtn').disabled = photoIndex === photos.length - 1;

        // Carregar foto
        await loadPhotoInModal(photo.id);

        // Sincronizar carrinho
        if (window.CartSystem && window.CartSystem.updateToggleButton) {
            setTimeout(() => {
                window.CartSystem.updateToggleButton();
            }, 100);
        }

        if (window.updateModalPriceBadge) {
            setTimeout(() => window.updateModalPriceBadge(), 200);
        }
    }

    // ===== CARREGAR FOTO NO MODAL =====
    window.loadPhotoInModal = async function(photoId) {
        const img = document.getElementById('modalPhoto');
        const spinner = document.getElementById('photoLoadingSpinner');

        if (!img) return;

        try {
            if (spinner) {
                spinner.style.display = 'block';
                img.style.display = 'none';
            }

            const photos = navigationState.currentPhotos || [];
            const photo = photos.find(p => p.id === photoId);

            if (!photo) {
                console.warn('Foto não encontrada na lista');
                img.src = `https://images.sunshinecowhides-gallery.com/${photoId}`;
                if (spinner) spinner.style.display = 'none';
                img.style.display = 'block';
                return;
            }

            // Carregamento progressivo para Sheepskins
            if (photo.id && (photo.id.includes('.webp') || photo.id.includes('.jpg'))) {
                console.log('⚡ Carregamento progressivo ativado');

                img.src = ImageUtils.getThumbnailUrl(photo);

                const previewUrl = ImageUtils.getPreviewUrl(photo);
                const previewImg = new Image();
                previewImg.onload = function () {
                    img.src = previewUrl;
                    console.log('✅ Preview carregado');

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
                console.log('📷 Carregamento normal');
                img.src = ImageUtils.getFullImageUrl(photo);
            }

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

    // ===== NAVEGAÇÃO NO MODAL =====
    window.previousPhoto = function() {
        const oldOverlay = document.getElementById('modalUnavailableOverlay');
        if (oldOverlay) oldOverlay.remove();
        const modalPhoto = document.getElementById('modalPhoto');
        if (modalPhoto) modalPhoto.style.filter = 'none';

        if (navigationState.currentPhotoIndex > 0) {
            if (typeof notifyPhotoChange === 'function') {
                notifyPhotoChange();
            }
            openPhotoModal(navigationState.currentPhotoIndex - 1);
            notifyCartOnPhotoChange();
        }
    }

    window.nextPhoto = function() {
        const oldOverlay = document.getElementById('modalUnavailableOverlay');
        if (oldOverlay) oldOverlay.remove();
        const modalPhoto = document.getElementById('modalPhoto');
        if (modalPhoto) modalPhoto.style.filter = 'none';

        if (navigationState.currentPhotoIndex < navigationState.currentPhotos.length - 1) {
            if (typeof notifyPhotoChange === 'function') {
                notifyPhotoChange();
            }
            openPhotoModal(navigationState.currentPhotoIndex + 1);
            notifyCartOnPhotoChange();
        }
    }

    window.closePhotoModal = function() {
        if (typeof destroyPhotoZoom === 'function') {
            destroyPhotoZoom();
        }
        document.getElementById('photoModal').style.display = 'none';

        if (window.PriceProgressBar && typeof window.PriceProgressBar.updateProgress === 'function') {
            console.log('🔄 Atualizando Volume Pricing após fechar modal');
            window.PriceProgressBar.updateProgress();
        }
    }

    // ===== INFORMAÇÕES COMERCIAIS =====
    window.updateModalCommercialInfo = async function(photo, photoIndex, totalPhotos) {
        const categoryName = getCurrentCategoryDisplayName();
        document.getElementById('modalPhotoTitle').textContent = categoryName;
        document.getElementById('modalPhotoCounter').textContent = `${photoIndex + 1} / ${totalPhotos}`;
        await updateModalPriceInfo(photo);
    }

    window.getCurrentCategoryDisplayName = function() {
        const currentPath = navigationState.currentPath;

        if (currentPath && currentPath.length > 0) {
            if (currentPath.length > 1) {
                const mainCategory = currentPath[0].name;
                const subCategory = currentPath[currentPath.length - 1].name;
                return `${mainCategory} › ${subCategory}`;
            } else {
                return currentPath[0].name;
            }
        }

        return 'Premium Cowhide Selection';
    }

    window.updateModalPriceInfo = async function(photo) {
        try {
            if (!shouldShowPrices()) {
                const photoIndex = navigationState.currentPhotoIndex;
                const totalPhotos = navigationState.currentPhotos.length;

                document.getElementById('modalPhotoCounter').innerHTML = `
                    <span class="modal-price-badge contact-price">Contact for Price</span>
                    <span style="margin: 0 10px;">-</span>
                    ${photoIndex + 1} / ${totalPhotos}
                `;

                const gridEl = document.getElementById('modalDiscountGrid');
                if (gridEl) gridEl.style.display = 'none';

                document.getElementById('modalPhotoSize').innerHTML = '';
                document.getElementById('modalPhotoDate').innerHTML = '';
                return;
            }

            if (!photo && navigationState.currentPhotos && navigationState.currentPhotoIndex >= 0) {
                photo = navigationState.currentPhotos[navigationState.currentPhotoIndex];
            }

            let priceInfo = null;
            let currentFolderId = navigationState.currentFolderId;

            if (photo && photo.customPrice) {
                priceInfo = {
                    hasPrice: true,
                    formattedPrice: `$${parseFloat(photo.customPrice).toFixed(2)}`
                };
                console.log('💰 Usando customPrice da Special Selection:', photo.customPrice);
            } else {
                priceInfo = currentFolderId ? await loadCategoryPrice(currentFolderId) : null;
            }

            const savedSession = localStorage.getItem('sunshineSession');
            const clientCode = savedSession ? JSON.parse(savedSession).accessCode : null;
            let rangeData;

            if (window.specialSelectionRateRules) {
                rangeData = {
                    success: true,
                    data: {
                        ranges: window.specialSelectionRateRules.map(rule => ({
                            min: rule.from,
                            max: rule.to,
                            price: rule.price
                        }))
                    }
                };
            } else {
                const rangeResponse = await fetch(`/api/pricing/category-ranges?categoryId=${encodeURIComponent(currentFolderId)}&clientCode=${encodeURIComponent(clientCode)}`);
                rangeData = await rangeResponse.json();
            }

            const photoIndex = navigationState.currentPhotoIndex;
            const totalPhotos = navigationState.currentPhotos.length;

            if (priceInfo && priceInfo.hasPrice) {
                document.getElementById('modalPhotoCounter').innerHTML = `
                    <span class="modal-price-badge">${priceInfo.formattedPrice}</span>
                    <span style="margin: 0 10px;">-</span>
                    ${photoIndex + 1} / ${totalPhotos}
                `;

                document.getElementById('modalPhotoSize').innerHTML = '';
                document.getElementById('modalPhotoDate').innerHTML = '';

                const gridEl = document.getElementById('modalDiscountGrid');
                if (gridEl && rangeData.success && rangeData.data && rangeData.data.ranges && rangeData.data.ranges.length > 0) {
                    let cartCount = 0;
                    if (window.CartSystem && window.CartSystem.state && window.CartSystem.state.items) {
                        if (window.specialSelectionRateRules) {
                            cartCount = window.CartSystem.state.totalItems;
                        } else {
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
                            } else {
                                cartCount = window.CartSystem.state.totalItems;
                            }
                        }
                    }

                    let volumeHTML = '<div class="modal-volume-pricing">';
                    volumeHTML += '<span class="volume-label">Volume Pricing:</span>';

                    rangeData.data.ranges.forEach((range, index) => {
                        let isCurrentTier = false;
                        if (cartCount > 0) {
                            if (range.max) {
                                isCurrentTier = cartCount >= range.min && cartCount <= range.max;
                            } else {
                                isCurrentTier = cartCount >= range.min;
                            }
                        }

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
                document.getElementById('modalPhotoCounter').textContent = `${photoIndex + 1} / ${totalPhotos}`;
                const gridEl = document.getElementById('modalDiscountGrid');
                if (gridEl) gridEl.style.display = 'none';
            }
        } catch (error) {
            console.error('Erro:', error);
        }
    }

    // ===== FUNÇÕES AUXILIARES =====
    window.showPhotosLoading = function(show) {
        document.getElementById('photosLoading').style.display = show ? 'block' : 'none';
    }

    window.notifyCartOnPhotoChange = function() {
        if (window.CartSystem && window.CartSystem.updateToggleButton) {
            setTimeout(() => {
                window.CartSystem.updateToggleButton();
            }, 100);
        }
    }

    window.getCurrentCategoryName = function() {
        if (navigationState.currentPath && navigationState.currentPath.length > 0) {
            return navigationState.currentPath[navigationState.currentPath.length - 1];
        }
        return 'Products';
    }

    // ===== PREÇOS =====
    window.categoryPrices = new Map();

    window.loadCategoryPrice = async function(folderId) {
        try {
            if (window.categoryPrices.has(folderId)) {
                return window.categoryPrices.get(folderId);
            }

            let clientCode = null;
            const savedSession = localStorage.getItem('sunshineSession');
            if (savedSession) {
                const session = JSON.parse(savedSession);
                clientCode = session.accessCode;
            }

            console.log(`🏷️ Loading price for category ${folderId}, client: ${clientCode || 'ANONYMOUS'}`);

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
                    basePrice: data.category.basePrice || 0,
                    price: data.category.finalPrice || 0,
                    formattedPrice: data.category.formattedPrice,
                    priceSource: data.category.priceSource || 'base'
                };

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

    // ===== STATUS POLLING =====
    window.statusCheckInterval = null;

    window.startStatusPolling = function() {
        window.statusCheckInterval = setInterval(async () => {
            try {
                const response = await fetch('/api/gallery/status-updates');
                const data = await response.json();

                if (data.success && data.changes) {
                    if (!window.photoStatusMap) {
                        window.photoStatusMap = {};
                    }

                    data.changes.forEach(photo => {
                        const savedSession = localStorage.getItem('sunshineSession');
                        const clientCode = savedSession ? JSON.parse(savedSession).accessCode : null;
                        const currentSessionId = clientCode ? localStorage.getItem(`cartSessionId_${clientCode}`) : null;

                        if (photo.status === 'reserved' && photo.sessionId === currentSessionId) {
                            console.log(`[Polling] Ignorando própria reserva: ${photo.id}`);
                            return;
                        }

                        let photoElement = null;
                        photoElement = document.querySelector(`[data-photo-id="${photo.id}"]`);
                        if (!photoElement) {
                            photoElement = document.querySelector(`[data-photo-id*="${photo.id.replace('.webp', '')}"]`);
                        }
                        if (!photoElement && /^\d+$/.test(photo.id)) {
                            photoElement = document.querySelector(`[data-photo-id*="${photo.id}.webp"]`);
                        }

                        if (photoElement) {
                            if (photo.status === 'sold') {
                                photoElement.setAttribute('data-status', 'sold');
                                const cartBtn = photoElement.querySelector('.thumbnail-cart-btn');
                                if (cartBtn) {
                                    cartBtn.disabled = true;
                                    cartBtn.innerHTML = '<i class="fas fa-ban"></i><span>Sold Out</span>';
                                }
                            } else if (photo.status === 'reserved') {
                                photoElement.setAttribute('data-status', 'reserved');
                                const cartBtn = photoElement.querySelector('.thumbnail-cart-btn');
                                if (cartBtn) {
                                    cartBtn.disabled = true;
                                    cartBtn.innerHTML = '<i class="fas fa-lock"></i><span>Unavailable</span>';
                                    cartBtn.style.backgroundColor = '#ffc107';
                                    cartBtn.style.color = '#000';
                                }
                            } else if (photo.status === 'available') {
                                photoElement.removeAttribute('data-status');
                                const cartBtn = photoElement.querySelector('.thumbnail-cart-btn');
                                if (cartBtn) {
                                    cartBtn.disabled = false;
                                    cartBtn.innerHTML = '<i class="fas fa-shopping-cart"></i><span>Add to Cart</span>';
                                    cartBtn.style.backgroundColor = '';
                                    cartBtn.style.color = '';
                                }
                            }
                        }
                    });

                    if (data.changes.length > 0) {
                        console.log(`[Status Update] ${data.changes.length} fotos atualizadas`);
                    }
                }
            } catch (error) {
                console.error('Erro ao verificar status:', error);
            }
        }, 30000);
    }

    // ===== KEYBOARD NAVIGATION =====
    window.setupKeyboardNavigation = function() {
        document.addEventListener('keydown', (e) => {
            const modal = document.getElementById('photoModal');
            if (modal && modal.style.display !== 'none') {
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

    // ===== INICIALIZAÇÃO =====
    console.log('📸 client-gallery.js carregado - Módulo de galeria pronto');

})();