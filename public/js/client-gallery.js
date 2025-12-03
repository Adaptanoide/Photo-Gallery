// public/js/client-gallery.js
/**
 * CLIENT-GALLERY.JS - SUNSHINE COWHIDES
 * Módulo de galeria: Fotos, modal e visualização
 * Parte 2/3 da modularização do client.js
 */

// ===== CONFIGURAÇÃO DO MÓDULO =====
(function () {
    'use strict';

    // Atualizar contadores dos cards
    async function updateGalleryCounts() {
        try {
            // Buscar contagem de available (já existe no sistema)
            const availableResponse = await fetchWithAuth('/api/gallery/structure');
            const availableData = await availableResponse.json();

            // Buscar contagem de coming soon
            const transitResponse = await fetchWithAuth('/api/gallery/transit/count');
            const transitData = await transitResponse.json();

            // Atualizar cards
            const availableCount = document.getElementById('availablePhotoCount');
            const comingSoonCount = document.getElementById('comingSoonPhotoCount');

            if (availableCount) {
                // Calcular total de fotos available (você precisa adaptar isso)
                availableCount.textContent = 'Loading...'; // Substituir pela contagem real
            }

            if (comingSoonCount && transitData.success) {
                comingSoonCount.textContent = `${transitData.count} photos`;
            }

        } catch (error) {
            console.error('Erro ao atualizar contadores:', error);
        }
    }

    // Chamar ao carregar a página
    document.addEventListener('DOMContentLoaded', updateGalleryCounts);

    // Mover zoom para footer APENAS no mobile
    function moveZoomToFooter() {
        if (window.innerWidth <= 768) {
            setTimeout(() => {
                const zoomControls = document.querySelector('.zoom-controls-simple');
                const modalFooter = document.querySelector('.modal-footer');
                if (zoomControls && modalFooter && !modalFooter.contains(zoomControls)) {
                    modalFooter.appendChild(zoomControls);
                }
            }, 100);
        }
    }

    // Verificar dependências
    if (!window.navigationState) {
        console.error('❌ client-gallery.js requer client-core.js');
        return;
    }

    // ===== CARREGAR FOTOS =====
    window.loadPhotos = async function (folderId) {
        try {
            showPhotosLoading(true);

            // ===== NOVO: Verificar se é Coming Soon =====
            if (window.navigationState.isComingSoon) {
                console.log('🚢 Carregando fotos em trânsito');

                const response = await fetchWithAuth(`/api/gallery/transit/photos?qbItem=${encodeURIComponent(folderId)}`);
                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.message || 'Error loading transit photos');
                }

                navigationState.currentPhotos = data.photos;
                showPhotosGallery(data.photos, data.folder.name, null);
                return;
            }
            // ===== FIM DO NOVO =====

            // 🆕 GARANTIR que token está na requisição
            const savedSession = localStorage.getItem('sunshineSession');
            if (!savedSession) {
                throw new Error('Session expired - please login again');
            }

            const session = JSON.parse(savedSession);
            console.log('🔑 Cliente identificado:', session.accessCode);

            // Limpar rate rules ao mudar de categoria
            window.specialSelectionRateRules = null;
            window.specialSelectionBasePrice = null;

            const response = await fetchWithAuth(`/api/gallery/photos?prefix=${encodeURIComponent(folderId)}`);
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
                        // ADICIONE AQUI - Ajustar info bar quando não tem rate rules
                        const infoBar = document.getElementById('mobileInfoBar');
                        if (infoBar && window.innerWidth <= 768) {
                            infoBar.classList.add('no-rate-rules');
                        }
                    } else {
                        window.PriceProgressBar.init(navigationState.currentFolderId);
                        // Remover classe primeiro
                        const infoBar = document.getElementById('mobileInfoBar');
                        if (infoBar && window.innerWidth <= 768) {
                            infoBar.classList.remove('no-rate-rules');
                            // Remover também do grid de fotos
                            const photosGrid = document.querySelector('.photos-grid');
                            if (photosGrid) {
                                photosGrid.classList.remove('no-rate-rules');
                            }

                            // Verificar se realmente tem rate rules após init
                            setTimeout(() => {
                                const priceContainer = document.getElementById('priceProgressContainer');
                                if (priceContainer && priceContainer.style.display === 'none') {
                                    infoBar.classList.add('no-rate-rules');
                                    // Ajustar também o grid de fotos
                                    const photosGrid = document.querySelector('.photos-grid');
                                    if (photosGrid) {
                                        photosGrid.classList.add('no-rate-rules');
                                    }
                                }
                            }, 500);
                        }
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
    window.showPhotosGallery = function (photos, folderName, categoryPrice) {
        navigationState.currentCategoryName = folderName;

        hideAllContainers();
        hideLoading();

        // Destruir Virtual Gallery anterior
        if (window.virtualGallery && window.virtualGallery.destroy) {
            console.log('🧹 LIMPANDO Virtual Gallery anterior');
            window.virtualGallery.destroy();
        }

        // Verificar se o photosContainer existe, se não, precisamos recriá-lo
        let photosContainer = document.getElementById('photosContainer');
        if (!photosContainer) {
            // Container não existe, vamos criá-lo com toda a estrutura necessária
            const mainArea = document.querySelector('.gallery-content') ||
                document.querySelector('.container') ||
                document.querySelector('main');

            if (mainArea) {
                photosContainer = document.createElement('div');
                photosContainer.id = 'photosContainer';
                photosContainer.className = 'photos-container';

                // Criar toda a estrutura interna que o código espera encontrar
                photosContainer.innerHTML = `
                    <div class="gallery-header">
                        <h2 id="galleryTitle"></h2>
                        <div id="photosCount"></div>
                    </div>
                    <div id="mobileInfoBar" class="mobile-info-bar" style="display: none;">
                        <span id="infoPriceBadge" class="category-price-badge"></span>
                        <span id="infoPhotoCount" class="photo-count"></span>
                    </div>
                    <div id="photosLoading" style="display: none;">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Loading photos...</span>
                    </div>
                    <div id="photosGrid" class="photos-grid"></div>
                `;

                mainArea.appendChild(photosContainer);
            }
        }

        // Agora podemos mostrar com segurança
        photosContainer.style.display = 'block';

        // Fazer o mesmo para breadcrumb
        const breadcrumbContainer = document.getElementById('breadcrumbContainer');
        if (breadcrumbContainer) {
            breadcrumbContainer.style.display = 'block';
        }
        // Iniciar polling
        if (!window.statusCheckInterval) {
            console.log('🔄 Iniciando polling de status');
            startStatusPolling();
        }

        // Atualizar título
        const galleryTitle = document.getElementById('galleryTitle');
        const customPrice = photos[0]?.customPrice;

        // VERIFICAR SE O ELEMENTO EXISTE ANTES DE USAR
        if (galleryTitle) {
            if (!shouldShowPrices()) {
                galleryTitle.innerHTML = `${folderName} <span class="category-price-badge contact-price">Contact for Price</span>`;
            } else if (customPrice) {
                galleryTitle.innerHTML = `${folderName} <span class="category-price-badge">$${parseFloat(customPrice).toFixed(2)}</span>`;
            } else if (categoryPrice && categoryPrice.hasPrice) {
                galleryTitle.innerHTML = `${folderName} <span class="category-price-badge">${categoryPrice.formattedPrice}</span>`;
            } else {
                galleryTitle.innerHTML = `${folderName} <span class="category-price-badge no-price">Price on request</span>`;
            }
        }

        // ===== TORNAR BADGE CLICÁVEL E ADICIONAR ÍCONE =====
        if (galleryTitle) {
            setTimeout(() => {
                const badge = galleryTitle.querySelector('.category-price-badge');
                if (badge) {
                    // Adicionar ícone de chat (para todos os badges, com ou sem preço)
                    window.addChatIconToBadge(badge);

                    // Adicionar evento de clique
                    if (!badge.dataset.clickListenerAdded) {
                        badge.addEventListener('click', function (e) {
                            e.stopPropagation();
                            console.log('🖱️ Badge da galeria clicado');
                            window.openChatWithPriceQuestion();
                        });
                        badge.dataset.clickListenerAdded = 'true';
                    }
                }
            }, 100);
        }

        // Popular mobile info bar
        const infoBar = document.getElementById('mobileInfoBar');
        const infoPriceBadge = document.getElementById('infoPriceBadge');
        const infoPhotoCount = document.getElementById('infoPhotoCount');

        if (infoBar && window.innerWidth <= 768) {
            // Mostrar a barra no mobile
            infoBar.style.display = 'flex';

            // Copiar preço
            if (infoPriceBadge) {
                if (!shouldShowPrices()) {
                    infoPriceBadge.innerHTML = 'Contact for Price';
                    infoPriceBadge.className = 'category-price-badge contact-price';
                } else if (customPrice) {
                    infoPriceBadge.innerHTML = `$${parseFloat(customPrice).toFixed(2)}`;
                    infoPriceBadge.className = 'category-price-badge';
                } else if (categoryPrice && categoryPrice.hasPrice) {
                    infoPriceBadge.innerHTML = categoryPrice.formattedPrice;
                    infoPriceBadge.className = 'category-price-badge';
                } else {
                    infoPriceBadge.innerHTML = 'Price on request';
                    infoPriceBadge.className = 'category-price-badge no-price';
                }
            }

            // Atualizar contador com formato "X of Y"
            if (infoPhotoCount) {
                const originalCounter = document.getElementById('photosCount');
                if (originalCounter) {
                    infoPhotoCount.textContent = originalCounter.textContent;
                }
            }
        }

        // ===== TORNAR BADGE MOBILE CLICÁVEL E ADICIONAR ÍCONE =====
        if (infoBar && window.innerWidth <= 768) {
            setTimeout(() => {
                const mobileBadge = document.getElementById('infoPriceBadge');
                if (mobileBadge) {
                    // Adicionar ícone de chat
                    window.addChatIconToBadge(mobileBadge);

                    // Adicionar evento de clique
                    if (!mobileBadge.dataset.clickListenerAdded) {
                        mobileBadge.style.cursor = 'pointer';
                        mobileBadge.addEventListener('click', function (e) {
                            e.stopPropagation();
                            console.log('🖱️ Badge mobile clicado');
                            window.openChatWithPriceQuestion();
                        });
                        mobileBadge.dataset.clickListenerAdded = 'true';
                    }
                }
            }, 100);
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
            // Atualizar info bar também
            const infoCount = document.getElementById('infoPhotoCount');
            if (infoCount && window.innerWidth <= 768) {
                infoCount.innerHTML = `Loading <strong>${photos.length}</strong> photos...`;
            }
            window.virtualGallery.init(photos, gridEl, categoryPrice);
        } else {
            // Modo tradicional
            console.log(`📋 Modo tradicional para ${photos.length} fotos`);
            document.getElementById('photosCount').textContent = `${photos.length} photo(s)`;

            gridEl.innerHTML = photos.map((photo, index) => {
                const thumbnailUrl = ImageUtils.getThumbnailUrl(photo);
                const isInCart = window.CartSystem && CartSystem.isInCart(photo.id);

                // NOVO: Determinar status visual correto
                let visualStatus = photo.actualStatus || photo.status || 'available';
                if (photo.isOwnReservation) {
                    visualStatus = 'available'; // Tratar como disponível visualmente
                }

                return `
                    <div class="photo-thumbnail" 
                        data-photo-id="${photo.id}" 
                        data-status="${visualStatus}" 
                        data-own-reservation="${photo.isOwnReservation || false}"
                        onclick="openPhotoModal(${index})">
                        <img src="${thumbnailUrl}" 
                            alt="${photo.name}" 
                            onerror="this.onerror=null; this.src=this.src.replace('/_thumbnails/', '/');"
                            loading="lazy">
                        
                        <div class="photo-price ${photo.customPrice || categoryPrice?.hasPrice ? '' : 'no-price'}">
                            ${photo.customPrice ? `$${parseFloat(photo.customPrice).toFixed(2)}` : (categoryPrice?.formattedPrice || 'Price on request')}
                        </div>
                        
                        <button class="thumbnail-cart-btn ${isInCart ? 'in-cart' : ''}" 
                                data-photo-id="${photo.id.replace(/"/g, '&quot;')}" 
                                data-photo-index="${index}"
                                title="${isInCart ? 'Remove from cart' : 'Add to cart'}">
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

            // Configurar event listeners para os botões do carrinho
            setTimeout(() => {
                const buttons = document.querySelectorAll('.thumbnail-cart-btn');
                buttons.forEach(btn => {
                    btn.addEventListener('click', function (e) {
                        e.stopPropagation();
                        e.preventDefault();

                        // Pegar dados do botão
                        const photoId = this.dataset.photoId.replace(/&quot;/g, '"');
                        const photoIndex = parseInt(this.dataset.photoIndex);

                        // Chamar a função
                        if (window.addToCartFromThumbnail) {
                            window.addToCartFromThumbnail(photoId, photoIndex);
                        }
                    });
                });
            }, 100);

            // Verificação adicional para corrigir estado inicial dos botões do carrinho
            // Aguarda um pouco mais para garantir que tudo está renderizado
            setTimeout(() => {
                const savedSession = localStorage.getItem('sunshineSession');
                if (!savedSession) return; // Se não há sessão, não fazer nada

                try {
                    const sessionData = JSON.parse(savedSession);
                    const clientCode = sessionData.accessCode || sessionData.user?.code;

                    if (!clientCode) return; // Se não há código de cliente, sair

                    // Verificar se há carrinho para este cliente
                    const cartSessionId = localStorage.getItem(`cartSessionId_${clientCode}`);

                    // Se existe carrinho e tem items
                    if (cartSessionId && window.cart && window.cart.items && window.cart.items.length > 0) {
                        console.log(`[Initial Cart Check] Verificando ${window.cart.items.length} items no carrinho`);

                        window.cart.items.forEach(item => {
                            // Obter o ID da foto do nome do arquivo
                            const photoId = item.fileName.replace('.webp', '');

                            // Procurar o botão desta foto
                            const cartBtn = document.querySelector(`.thumbnail-cart-btn[data-photo-id="${photoId}"], .thumbnail-cart-btn[data-photo-id="${photoId}.webp"]`);

                            if (cartBtn && !cartBtn.classList.contains('in-cart')) {
                                console.log(`[Initial Fix] Corrigindo botão da foto ${photoId} para mostrar Remove`);

                                // Atualizar o botão para mostrar "Remove"
                                cartBtn.classList.add('in-cart');
                                cartBtn.innerHTML = '<span>Remove</span>';  // Sem ícone X
                                cartBtn.title = 'Remove from cart';

                                // Remover qualquer indicação de unavailable do elemento pai
                                const photoElement = cartBtn.closest('.photo-item');
                                if (photoElement) {
                                    photoElement.classList.remove('unavailable');
                                    photoElement.removeAttribute('data-status');
                                }
                            }
                        });
                    }
                } catch (error) {
                    console.error('[Initial Cart Check] Erro ao verificar carrinho:', error);
                }
            }, 300); // Aguarda 300ms após os event listeners serem configurados
        }
    }

    // ===== MODAL DE FOTOS =====
    window.openPhotoModal = async function (photoIndex) {
        // Resetar flag se não foi definida (não veio do carrinho)
        if (typeof window.modalOpenedFromCart === 'undefined') {
            window.modalOpenedFromCart = false;
        }
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
        // Mover zoom para footer no mobile
        moveZoomToFooter();
    }

    // ===== CARREGAR FOTO NO MODAL =====
    window.loadPhotoInModal = async function (photoId) {
        const img = document.getElementById('modalPhoto');
        const spinner = document.getElementById('photoLoadingSpinner');

        if (!img) return;

        // Garantir estado inicial correto
        if (spinner) spinner.style.display = 'block';
        img.style.display = 'none';
        img.src = ''; // Limpar src antigo para evitar onerror

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
    window.previousPhoto = function () {
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

    window.nextPhoto = function () {
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

    window.closePhotoModal = function () {
        if (typeof destroyPhotoZoom === 'function') {
            destroyPhotoZoom();
        }

        // Limpar imagem e preparar para próxima abertura
        const modalPhoto = document.getElementById('modalPhoto');
        const spinner = document.getElementById('photoLoadingSpinner');

        if (modalPhoto) {
            modalPhoto.src = ''; // Limpar src
            modalPhoto.style.display = 'none'; // Esconder imagem
        }

        if (spinner) {
            spinner.style.display = 'block'; // Deixar spinner pronto
        }

        document.getElementById('photoModal').style.display = 'none';

        // ADICIONAR ESTE BLOCO
        // Se o modal foi aberto do carrinho, reabrir o carrinho
        if (window.modalOpenedFromCart) {
            window.modalOpenedFromCart = false; // Resetar flag
            if (window.CartSystem && window.CartSystem.openSidebar) {
                setTimeout(() => {
                    window.CartSystem.openSidebar();
                }, 100);
            }
        }

        // Se estava vendo do carrinho, restaurar contexto
        if (window.navigationState.isViewingCart && window.CartSystem) {
            window.CartSystem.restoreNavigationContext();
        }

        if (window.PriceProgressBar && typeof window.PriceProgressBar.updateProgress === 'function') {
            window.PriceProgressBar.updateProgress();
        }
    }

    // ===== INFORMAÇÕES COMERCIAIS =====
    window.updateModalCommercialInfo = async function (photo, photoIndex, totalPhotos) {
        // Se está vendo do carrinho, mostrar categoria + contexto
        if (window.navigationState.isViewingCart) {
            // Pegar a categoria da foto atual
            const currentPhoto = window.navigationState.currentPhotos[photoIndex];
            const categoryName = currentPhoto.category || 'Product';

            // Mostrar categoria + indicador de carrinho
            document.getElementById('modalPhotoTitle').innerHTML = `
                ${categoryName} 
                <span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; margin-left: 10px;">
                    From Cart
                </span>
            `;

            // Contador com destaque
            document.getElementById('modalPhotoCounter').innerHTML = `
                <span style="color: #28a745;">
                    Cart Item ${photoIndex + 1} / ${totalPhotos}
                </span>
            `;

            // Adicionar nome do arquivo também
            const photoName = currentPhoto.fileName || currentPhoto.name;
            if (photoName) {
                // Se tiver um elemento para mostrar o nome da foto
                const nameElement = document.getElementById('modalPhotoName');
                if (nameElement) {
                    nameElement.textContent = photoName;
                }
            }
        } else {
            // Comportamento normal (não do carrinho)
            const categoryName = getCurrentCategoryDisplayName();
            document.getElementById('modalPhotoTitle').textContent = categoryName;
            document.getElementById('modalPhotoCounter').textContent = `${photoIndex + 1} / ${totalPhotos}`;
        }

        await updateModalPriceInfo(photo);
    }

    // ===== NOVA FUNÇÃO 1: Para SALVAR no banco (com barras) =====
    window.getCurrentCategoryPath = function () {
        const currentPath = navigationState.currentPath;

        if (currentPath && currentPath.length > 0) {
            // Retorna o caminho completo com barras "/"
            return currentPath.map(p => p.name).join('/');
        }

        return 'Premium Cowhide Selection';
    }

    // ===== NOVA FUNÇÃO 2: Para EXIBIR visualmente (com setas) =====
    window.getCurrentCategoryDisplayName = function () {
        const currentPath = navigationState.currentPath;

        if (currentPath && currentPath.length > 0) {
            if (currentPath.length > 1) {
                const mainCategory = currentPath[0].name;
                const subCategory = currentPath[currentPath.length - 1].name;
                return `${mainCategory} › ${subCategory}`;  // ✅ Seta apenas para exibição
            } else {
                return currentPath[0].name;
            }
        }

        return 'Premium Cowhide Selection';
    }

    window.updateModalPriceInfo = async function (photo) {
        try {
            if (!shouldShowPrices()) {
                const photoIndex = navigationState.currentPhotoIndex;
                const totalPhotos = navigationState.currentPhotos.length;

                document.getElementById('modalPhotoCounter').innerHTML = `
                    <span class="modal-price-badge contact-price" 
                          style="cursor: pointer; pointer-events: auto; position: relative; z-index: 1000;"
                          onclick="event.stopPropagation(); document.getElementById('photoModal').style.display='none'; setTimeout(() => window.openChatWithPriceQuestion(), 300);">
                        Contact for Price
                    </span>
                    <span style="margin: 0 10px;">-</span>
                    ${photoIndex + 1} / ${totalPhotos}
                `;

                // Adicionar ícone de chat ao badge
                setTimeout(() => {
                    const modalBadge = document.querySelector('#modalPhotoCounter .modal-price-badge');
                    if (modalBadge) {
                        window.addChatIconToBadge(modalBadge);
                    }
                }, 100);

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
                console.log('🔍 [MODAL] Buscando preço para:', currentFolderId);
                priceInfo = currentFolderId ? await loadCategoryPrice(currentFolderId) : null;
                console.log('💰 [MODAL] Preço retornado:', priceInfo);
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
                document.getElementById('modalPhotoSize').innerHTML = '';
                document.getElementById('modalPhotoDate').innerHTML = '';

                // ✅ CALCULAR cartCount
                let cartCount = 0;
                if (window.CartSystem && window.CartSystem.state && window.CartSystem.state.items) {
                    cartCount = window.CartSystem.state.totalItems;
                }

                // ✅ VERIFICAR se é Mix & Match (múltiplos tiers) ou categoria regular (1 tier)
                const hasMultipleTiers = rangeData.success &&
                    rangeData.data &&
                    rangeData.data.ranges &&
                    rangeData.data.ranges.length > 1;

                let currentTierPrice = priceInfo.formattedPrice; // fallback para categorias regulares

                if (hasMultipleTiers) {
                    // ✅ É MIX & MATCH - calcular tier baseado em cartCount
                    for (const range of rangeData.data.ranges) {
                        let isCurrentTier = false;
                        if (cartCount > 0) {
                            if (range.max) {
                                isCurrentTier = cartCount >= range.min && cartCount <= range.max;
                            } else {
                                isCurrentTier = cartCount >= range.min;
                            }
                        } else {
                            // Se carrinho vazio, usar primeiro tier
                            isCurrentTier = range.min === 1;
                        }

                        if (isCurrentTier) {
                            currentTierPrice = `$${range.price}/each`;
                            console.log(`💰 [MODAL] Mix&Match Tier ativo: ${range.min}-${range.max || '∞'} = ${currentTierPrice}`);
                            break;
                        }
                    }
                } else {
                    // ✅ É CATEGORIA REGULAR - usar preço fixo do backend
                    console.log(`💰 [MODAL] Categoria regular: ${currentTierPrice}`);
                }

                // ✅ ATUALIZAR badge com preço correto
                document.getElementById('modalPhotoCounter').innerHTML = `
                    <span class="modal-price-badge"
                          style="cursor: pointer; pointer-events: auto; position: relative; z-index: 1000;"
                          onclick="event.stopPropagation(); document.getElementById('photoModal').style.display='none'; setTimeout(() => window.openChatWithPriceQuestion(), 300);">
                        ${currentTierPrice}
                    </span>
                    <span style="margin: 0 10px;">-</span>
                    ${photoIndex + 1} / ${totalPhotos}
                `;

                // Adicionar ícone de chat ao badge
                setTimeout(() => {
                    const modalBadge = document.querySelector('#modalPhotoCounter .modal-price-badge');
                    if (modalBadge) {
                        window.addChatIconToBadge(modalBadge);
                    }
                }, 100);

                // ✅ MOSTRAR tiers SOMENTE se for Mix & Match
                const gridEl = document.getElementById('modalDiscountGrid');
                if (gridEl && hasMultipleTiers) {
                    let volumeHTML = '<div class="modal-volume-pricing">';

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
                                ${range.min}${range.max ? `-${range.max}` : '+'} photos
                                <span class="tier-price">$${range.price}/each</span>
                            </span>
                        `;
                    });

                    volumeHTML += `
                        <span class="cart-count">
                            <i class="fas fa-shopping-cart"></i> ${cartCount} items
                        </span>
                    `;

                    volumeHTML += '</div>';
                    gridEl.innerHTML = volumeHTML;

                    // Criar barra compacta para mobile
                    if (window.innerWidth <= 768) {
                        let rateBar = document.querySelector('.modal-rate-rules-bar');
                        if (!rateBar) {
                            rateBar = document.createElement('div');
                            rateBar.className = 'modal-rate-rules-bar';
                            document.getElementById('photoModal').appendChild(rateBar);
                        }

                        let compactHTML = '';
                        rangeData.data.ranges.forEach((range, index) => {
                            const isActive = cartCount >= range.min && (!range.max || cartCount <= range.max);
                            const tierClass = isActive ? 'tier-item active' : 'tier-item';

                            if (index > 0) compactHTML += '<span class="separator">|</span>';
                            compactHTML += `<span class="${tierClass}">${range.min}${range.max ? `-${range.max}` : '+'}: $${range.price}</span>`;
                        });

                        rateBar.innerHTML = compactHTML;
                        rateBar.classList.add('active');
                    }
                    gridEl.style.display = window.innerWidth <= 768 ? 'none' : 'block';
                } else if (gridEl) {
                    // Ocultar grid para categorias regulares
                    gridEl.style.display = 'none';
                }

            } else {
                document.getElementById('modalPhotoCounter').textContent = `${photoIndex + 1} / ${totalPhotos}`;
                const gridEl = document.getElementById('modalDiscountGrid');
                if (gridEl) gridEl.style.display = 'none';
            }
        } catch (error) {
            console.error('Erro ao atualizar preço do modal:', error);
        }
    }

    // ===== FUNÇÕES AUXILIARES =====
    window.showPhotosLoading = function (show) {
        document.getElementById('photosLoading').style.display = show ? 'block' : 'none';
    }

    window.notifyCartOnPhotoChange = function () {
        if (window.CartSystem && window.CartSystem.updateToggleButton) {
            setTimeout(() => {
                window.CartSystem.updateToggleButton();
            }, 100);
        }
    }

    window.getCurrentCategoryName = function () {
        if (navigationState.currentPath && navigationState.currentPath.length > 0) {
            return navigationState.currentPath[navigationState.currentPath.length - 1];
        }
        return 'Products';
    }

    // ===== PREÇOS =====
    window.categoryPrices = new Map();

    window.loadCategoryPrice = async function (folderId) {
        try {
            // ✅ LOG 1: O que está sendo buscado
            console.log('🔍 [LOAD PRICE] Buscando preço para:', folderId);

            if (window.categoryPrices.has(folderId)) {
                const cached = window.categoryPrices.get(folderId);
                console.log('📦 [LOAD PRICE] Retornando do CACHE:', cached);
                return cached;
            }

            let clientCode = null;
            const savedSession = localStorage.getItem('sunshineSession');
            if (savedSession) {
                const session = JSON.parse(savedSession);
                clientCode = session.accessCode;
            }

            console.log(`🏷️ Loading price for category ${folderId}, client: ${clientCode || 'ANONYMOUS'}`);

            // ✅ ADICIONAR cartQuantity aqui
            let cartQuantity = 0;
            if (window.CartSystem && window.CartSystem.state) {
                cartQuantity = window.CartSystem.state.totalItems || 0;
            }

            const url = `/api/pricing/category-price?prefix=${encodeURIComponent(folderId)}${clientCode ? `&clientCode=${clientCode}` : ''}&cartQuantity=${cartQuantity}`;

            // ✅ LOG 2: URL completa
            console.log('🌐 [LOAD PRICE] URL:', url);

            const response = await fetch(url);
            const data = await response.json();

            // ✅ LOG 3: O que a API retornou
            console.log('📥 [LOAD PRICE] Resposta da API:', data);

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

    window.startStatusPolling = function () {
        // Função de verificação extraída para reutilizar
        const checkStatus = async () => {
            try {
                // 🔐 DECLARAR UMA ÚNICA VEZ NO INÍCIO
                const savedSession = localStorage.getItem('sunshineSession');
                const session = savedSession ? JSON.parse(savedSession) : null;
                const clientCode = session?.accessCode || session?.user?.code;

                // PARTE 1: Verificação de status das fotos
                const headers = {};
                if (session?.token) {
                    headers['Authorization'] = `Bearer ${session.token}`;
                }

                const response = await fetch('/api/gallery/status-updates', {
                    headers: headers
                });
                const data = await response.json();

                if (data.success && data.changes) {
                    if (!window.photoStatusMap) {
                        window.photoStatusMap = {};
                    }

                    data.changes.forEach(photo => {
                        // ✅ CORREÇÃO: Ignorar fotos que estão no carrinho do cliente
                        const photoIdClean = photo.id.replace('.webp', '');
                        const isInClientCart = window.CartSystem && (
                            window.CartSystem.isInCart(photo.id) ||
                            window.CartSystem.isInCart(photoIdClean) ||
                            window.CartSystem.isInCart(photoIdClean + '.webp')
                        );

                        if (isInClientCart) {
                            console.log(`[Polling] Ignorando ${photo.id} - está no carrinho do cliente`);
                            return;
                        }

                        const currentSessionId = clientCode ? localStorage.getItem(`cartSessionId_${clientCode}`) : null;

                        // PRIMEIRO: Encontrar o elemento da foto no DOM
                        let photoElement = null;
                        photoElement = document.querySelector(`[data-photo-id="${photo.id}"]`);
                        if (!photoElement) {
                            photoElement = document.querySelector(`[data-photo-id*="${photo.id.replace('.webp', '')}"]`);
                        }
                        if (!photoElement && /^\d+$/.test(photo.id)) {
                            photoElement = document.querySelector(`[data-photo-id*="${photo.id}.webp"]`);
                        }

                        // AGORA podemos verificar se é reserva própria
                        if (photo.status === 'reserved' && photo.sessionId === currentSessionId) {
                            console.log(`[Polling] Processando própria reserva: ${photo.id}`);

                            if (photoElement) {
                                const unavailableOverlay = photoElement.querySelector('.unavailable-overlay');
                                if (unavailableOverlay) {
                                    unavailableOverlay.remove();
                                }

                                photoElement.classList.remove('unavailable');
                                photoElement.removeAttribute('data-status');

                                const cartBtn = photoElement.querySelector('.thumbnail-cart-btn');
                                if (cartBtn) {
                                    cartBtn.disabled = false;
                                    cartBtn.classList.add('in-cart');
                                    cartBtn.innerHTML = '<span>Remove</span>';
                                    cartBtn.style.backgroundColor = '#dc3545';
                                    cartBtn.style.color = 'white';
                                    cartBtn.title = 'Remove from cart';
                                }
                            }

                            const modalContent = document.querySelector('.modal-content');
                            if (modalContent) {
                                const modalPhotoId = document.getElementById('modalPhoto')?.getAttribute('data-photo-id');
                                if (modalPhotoId && modalPhotoId.includes(photo.id)) {
                                    const modalOverlay = modalContent.querySelector('.unavailable-overlay');
                                    if (modalOverlay) {
                                        modalOverlay.remove();
                                    }
                                }
                            }

                            return;
                        }

                        // Processar mudanças de status para outras situações
                        if (photoElement) {
                            if (photo.status === 'sold') {
                                photoElement.setAttribute('data-status', 'sold');
                                const cartBtn = photoElement.querySelector('.thumbnail-cart-btn');
                                if (cartBtn) {
                                    cartBtn.disabled = true;
                                    cartBtn.innerHTML = '<span>Sold Out</span>';
                                }
                            } else if (photo.status === 'reserved') {
                                if (photo.sessionId !== currentSessionId) {
                                    photoElement.setAttribute('data-status', 'reserved');
                                    const cartBtn = photoElement.querySelector('.thumbnail-cart-btn');
                                    if (cartBtn) {
                                        cartBtn.disabled = true;
                                        cartBtn.innerHTML = '<span>Unavailable</span>';
                                        cartBtn.style.backgroundColor = '#ffc107';
                                        cartBtn.style.color = '#000';
                                    }
                                }
                            } else if (photo.status === 'available') {
                                photoElement.removeAttribute('data-status');
                                const cartBtn = photoElement.querySelector('.thumbnail-cart-btn');
                                if (cartBtn) {
                                    cartBtn.disabled = false;
                                    cartBtn.innerHTML = '<span>Add</span>';
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

                // PARTE 2: VERIFICAÇÃO DO CARRINHO
                if (session && window.CartSystem && clientCode && session.token) {
                    const cartResponse = await fetch(`/api/cart/status/${clientCode}`, {
                        headers: {
                            'Authorization': `Bearer ${session.token}`
                        }
                    });

                    if (cartResponse.ok) {
                        const serverCart = await cartResponse.json();

                        if (window.CartSystem.state) {
                            const localItems = window.CartSystem.state.items || [];
                            const serverItems = serverCart.items || [];
                            const localCount = localItems.length;
                            const serverCount = serverItems.length;

                            if (localCount !== serverCount) {
                                console.log(`[Cart Sync] Detectada mudança no carrinho: Local=${localCount}, Server=${serverCount}`);

                                if (window.CartSystem && window.CartSystem.loadCart) {
                                    console.log('[Cart Sync] Recarregando carrinho do servidor...');
                                    await window.CartSystem.loadCart();
                                    await new Promise(resolve => setTimeout(resolve, 100));

                                    if (window.CartSystem.rebuildCartInterface) {
                                        console.log('[Cart Sync] Chamando rebuildCartInterface...');
                                        window.CartSystem.rebuildCartInterface();
                                    } else {
                                        console.log('[Cart Sync] Método rebuildCartInterface não encontrado, fazendo atualização manual...');

                                        const cartBadge = document.querySelector('.cart-badge');
                                        const headerBadge = document.getElementById('headerCartBadge');
                                        const cartItemCount = document.getElementById('cartItemCount');
                                        const cartEmpty = document.getElementById('cartEmpty');
                                        const cartItems = document.getElementById('cartItems');
                                        const cartFooter = document.getElementById('cartFooter');

                                        if (cartBadge) {
                                            cartBadge.textContent = serverCount;
                                            cartBadge.style.display = serverCount > 0 ? 'flex' : 'none';
                                        }

                                        if (headerBadge) {
                                            headerBadge.textContent = serverCount;
                                            headerBadge.classList.toggle('hidden', serverCount === 0);
                                        }

                                        if (serverCount === 0) {
                                            if (cartItemCount) {
                                                cartItemCount.textContent = 'Empty cart';
                                            }

                                            if (cartItems) {
                                                cartItems.innerHTML = '';
                                                cartItems.style.display = 'none';
                                            }

                                            if (cartEmpty) {
                                                cartEmpty.style.display = 'block';
                                                cartEmpty.innerHTML = `
                                            <div class="empty-cart-message">
                                                <i class="fas fa-shopping-cart"></i>
                                                <p>Your cart is empty</p>
                                                <small>Add leathers to begin your selection</small>
                                            </div>
                                        `;
                                            }

                                            if (cartFooter) {
                                                cartFooter.style.display = 'none';
                                            }
                                        }
                                    }

                                    if (window.syncThumbnailButtons) {
                                        window.syncThumbnailButtons();
                                    }

                                    console.log('[Cart Sync] Interface atualizada com sucesso');
                                }
                            }
                        }
                    }
                }

            } catch (error) {
                console.error('Erro ao verificar status:', error);
            }
        };

        // PRIMEIRA VERIFICAÇÃO RÁPIDA - em 3 segundos (uma única vez)
        setTimeout(() => {
            console.log('Primeira verificação rápida (3s)');
            checkStatus();
        }, 3000);

        // VERIFICAÇÕES REGULARES - a cada 10 segundos
        window.statusCheckInterval = setInterval(() => {
            console.log('Verificação regular (10s)');
            checkStatus();
        }, 10000);
    }

    // ===== KEYBOARD NAVIGATION =====
    window.setupKeyboardNavigation = function () {
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

    // Função para adicionar/remover do carrinho pela thumbnail
    window.addToCartFromThumbnail = async function (photoId, photoIndex) {
        try {
            // Feedback visual instantâneo
            const thumbButton = document.querySelector(`.thumbnail-cart-btn[onclick*="${photoId}"]`);
            if (thumbButton) {
                const isInCart = thumbButton.classList.contains('in-cart');

                if (isInCart) {
                    thumbButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Removing...</span>';
                    thumbButton.style.backgroundColor = '#6c757d';  // Cinza neutro
                } else {
                    thumbButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Adding...</span>';
                    thumbButton.style.backgroundColor = '#28a745';  // Verde
                    thumbButton.style.color = 'white';
                }

                thumbButton.disabled = true;

                setTimeout(() => {
                    if (thumbButton) thumbButton.disabled = false;
                }, 2000);
            }

            // Pegar a foto
            const photo = navigationState.currentPhotos[photoIndex];
            if (!photo || !window.CartSystem) return;

            const isInCart = window.CartSystem.isInCart(photoId);

            if (isInCart) {
                // Remover do carrinho
                await window.CartSystem.removeItem(photoId);

                // Atualizar PriceProgressBar
                if (window.PriceProgressBar && window.PriceProgressBar.updateProgress) {
                    window.PriceProgressBar.updateProgress();
                }
            } else {
                // Preparar dados do item
                let price = 0;
                let formattedPrice = 'No price';

                if (photo.customPrice) {
                    price = parseFloat(photo.customPrice);
                    formattedPrice = `$${price.toFixed(2)}`;
                } else if (navigationState.currentFolderId) {
                    try {
                        const priceInfo = await window.loadCategoryPrice(navigationState.currentFolderId);
                        price = priceInfo.price || 0;
                        formattedPrice = priceInfo.formattedPrice || 'No price';
                    } catch (error) {
                        console.warn('Error loading price:', error);
                    }
                }

                // Adicionar ao carrinho
                await window.CartSystem.addItem(photoId, {
                    driveFileId: photoId,
                    photoUrl: photo.url,
                    thumbnailUrl: photo.thumbnailUrl,
                    category: getCurrentCategoryPath(),
                    basePrice: price,
                    price: price,
                    formattedPrice: formattedPrice,
                    hasPrice: (price > 0),
                    photoNumber: photo.photoNumber || photoId.split('.')[0]
                });

                // Atualizar PriceProgressBar
                if (window.PriceProgressBar && window.PriceProgressBar.updateProgress) {
                    window.PriceProgressBar.updateProgress();
                }
            }

            // Sincronizar todos os botões
            window.syncThumbnailButtons();

            // Atualizar botão do modal se estiver aberto
            if (window.CartSystem.updateToggleButton) {
                window.CartSystem.updateToggleButton();
            }

        } catch (error) {
            console.error('Error toggling cart item:', error);
            // Reverter botão em caso de erro
            window.syncThumbnailButtons();
        }
    }

    // Função para sincronizar botões das thumbnails com o carrinho
    window.syncThumbnailButtons = function () {
        console.log('🔄 syncThumbnailButtons EXECUTADA!');

        const thumbnails = document.querySelectorAll('.photo-thumbnail');
        console.log('📸 Total de thumbnails encontradas:', thumbnails.length);

        thumbnails.forEach(thumbnail => {
            const photoId = thumbnail.dataset.photoId;
            const cartBtn = thumbnail.querySelector('.thumbnail-cart-btn');

            if (cartBtn && window.CartSystem) {
                // Tentar várias formas de verificar se está no carrinho
                let isInCart = false;

                // Verificar com ID simples
                isInCart = window.CartSystem.isInCart(photoId);

                // Se não encontrou, tentar com .webp
                if (!isInCart) {
                    isInCart = window.CartSystem.isInCart(photoId + '.webp');
                }

                // Se não encontrou, tentar com caminho completo
                if (!isInCart && navigationState.currentPath) {
                    const fullPath = navigationState.currentPath.map(p => p.name).join('/') + '/' + photoId + '.webp';
                    isInCart = window.CartSystem.isInCart(fullPath);
                }

                //console.log(`📌 Foto ${photoId}: está no carrinho? ${isInCart}`);

                if (isInCart) {
                    cartBtn.classList.add('in-cart');
                    cartBtn.innerHTML = '<span>Remove</span>';
                    cartBtn.title = 'Remove from cart';
                    cartBtn.style.backgroundColor = '#dc3545';  // ADICIONAR ESTA LINHA
                    cartBtn.style.color = 'white';              // ADICIONAR ESTA LINHA
                } else {
                    cartBtn.classList.remove('in-cart');
                    cartBtn.innerHTML = '<i class="fas fa-shopping-cart"></i><span>Add</span>';
                    cartBtn.title = 'Add to cart';
                    cartBtn.style.backgroundColor = '';  // STRING VAZIA
                    cartBtn.style.color = '';           // STRING VAZIA            // ADICIONAR ESTA LINHA
                }
            }
        });

        console.log('✅ syncThumbnailButtons FINALIZADA!');
    }

    // Toggle filtros no mobile
    window.toggleFilters = function () {
        const sidebar = document.querySelector('.filter-sidebar');
        const backdrop = document.querySelector('.filter-backdrop');
        const toggleBtn = document.querySelector('.filter-toggle-btn');

        if (sidebar && backdrop) {
            sidebar.classList.toggle('active');
            backdrop.classList.toggle('active');

            // Mudar ícone do botão
            if (toggleBtn) {
                const icon = toggleBtn.querySelector('i');
                if (sidebar.classList.contains('active')) {
                    icon.className = 'fas fa-filter';
                } else {
                    icon.className = 'fas fa-filter';
                }
            }
        }
    }

    // Aplicar filtros e fechar no mobile
    window.applyFiltersAndClose = function () {
        if (window.applyFilters) {
            window.applyFilters();
        }
        toggleFilters();
    }

    // Mostrar/ocultar botão de filtros baseado no tamanho da tela
    function checkFilterButton() {
        const filterBtn = document.querySelector('.mobile-filter-btn');
        if (filterBtn) {
            filterBtn.style.display = window.innerWidth <= 768 ? 'block' : 'none';
        }

        // Mostrar/ocultar X do sidebar baseado no tamanho
        const closeBtn = document.querySelector('.filter-close-btn');
        if (closeBtn) {
            closeBtn.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
        }

        // Mostrar/ocultar botão Apply & Close
        const applyBtn = document.querySelector('.filter-actions-mobile');
        if (applyBtn) {
            applyBtn.style.display = window.innerWidth <= 768 ? 'block' : 'none';
        }
    }

    // Executar ao carregar
    document.addEventListener('DOMContentLoaded', checkFilterButton);
    window.addEventListener('resize', checkFilterButton);

    // Executar imediatamente também
    checkFilterButton();

    // Mostrar botão toggle apenas no mobile
    window.addEventListener('resize', function () {
        const toggleBtn = document.querySelector('.filter-toggle-btn');
        if (toggleBtn) {
            toggleBtn.style.display = window.innerWidth <= 768 ? 'block' : 'none';
        }
    });

    // Executar ao carregar
    document.addEventListener('DOMContentLoaded', function () {
        const toggleBtn = document.querySelector('.filter-toggle-btn');
        if (toggleBtn && window.innerWidth <= 768) {
            toggleBtn.style.display = 'block';
        }
    });

    // ===== GALLERY MODE SELECTION =====
    window.selectGalleryMode = function (mode) {
        console.log(`🎯 Modo de galeria selecionado: ${mode}`);

        // Salvar modo no localStorage
        localStorage.setItem('galleryMode', mode);

        // Esconder selector
        document.getElementById('gallerySelector').style.display = 'none';

        // Mostrar loading
        const loadingEl = document.getElementById('clientLoading');
        const contentEl = document.getElementById('clientContent');

        if (loadingEl) loadingEl.style.display = 'block';
        if (contentEl) contentEl.style.display = 'none';

        // Carregar dados baseado no modo
        if (mode === 'coming-soon') {
            window.navigationState.isComingSoon = true;
            loadComingSoonCategories();
        } else {
            window.navigationState.isComingSoon = false;
            // ✅ USAR A NOVA FUNÇÃO loadClientDataAfterMode ao invés de loadClientData
            if (window.loadClientDataAfterMode) {
                loadClientDataAfterMode();
            } else {
                // Fallback se a função não existir
                console.error('loadClientDataAfterMode não encontrada!');
                loadClientData();
            }
        }
    };

    window.loadComingSoonCategories = async function () {
        try {
            console.log('🚢 Carregando categorias Coming Soon');
            showLoading();

            // Buscar categorias principais (sem prefix)
            const response = await fetchWithAuth('/api/gallery/transit/structure');
            const data = await response.json();

            if (!data.success) {
                throw new Error('Erro ao carregar categorias em trânsito');
            }

            console.log(`✅ ${data.structure.folders.length} categorias principais recebidas`);

            // ✅ Definir flag Coming Soon
            window.navigationState.isComingSoon = true;
            navigationState.currentPath = []; // ✅ Sem "Coming Soon" visível            navigationState.currentFolderId = null;

            // ✅ Mostrar categorias principais
            showSubfolders(data.structure.folders);

            const breadcrumbContainer = document.getElementById('breadcrumbContainer');
            if (breadcrumbContainer) {
                breadcrumbContainer.style.display = 'block';
            }

        } catch (error) {
            console.error('Erro ao carregar Coming Soon:', error);
            showNoContent('Error', 'Unable to load Coming Soon categories');
        } finally {
            hideLoading();

            const clientLoading = document.getElementById('clientLoading');
            if (clientLoading) clientLoading.style.display = 'none';

            const clientContent = document.getElementById('clientContent');
            if (clientContent) clientContent.style.display = 'block';
        }
    };

    // Nova função para navegar em subníveis Coming Soon
    window.loadComingSoonSubcategories = async function (prefix, displayName) {
        try {
            console.log(`🚢 Carregando subnível: ${prefix}`);
            showLoading();

            // Buscar subcategorias usando prefix
            const response = await fetchWithAuth(`/api/gallery/transit/structure?prefix=${encodeURIComponent(prefix)}`);
            const data = await response.json();

            if (!data.success) {
                throw new Error('Erro ao carregar subcategorias');
            }

            console.log(`✅ ${data.structure.folders.length} items encontrados`);

            // ✅ RECONSTRUIR path correto
            const pathParts = prefix.split('/').filter(p => p);
            navigationState.currentPath = pathParts.map(part => ({
                id: pathParts.slice(0, pathParts.indexOf(part) + 1).join('/'),
                name: part
            }));

            // Mostrar subcategorias
            showSubfolders(data.structure.folders);

            // Atualizar breadcrumb
            updateBreadcrumb();

        } catch (error) {
            console.error('Erro ao carregar subcategorias:', error);
            showNoContent('Error', 'Unable to load subcategories');
        } finally {
            hideLoading();
        }
    };

    // ===== INICIALIZAÇÃO =====
    console.log('📸 client-gallery.js carregado - Módulo de galeria pronto');

    // ============================================
    // ATUALIZAÇÃO AUTOMÁTICA DE TIERS
    // ============================================
    /**
     * Escuta mudanças no carrinho e atualiza barras de tiers
     * Resolve bug: tier não atualiza quando remove item de outra categoria
     */
    window.addEventListener('cartUpdated', function (event) {
        console.log('🔄 [TIER UPDATE] Carrinho atualizado, recalculando tiers...');
        const itemCount = event.detail.itemCount || 0;
        console.log(`🎯 [TIER UPDATE] Quantidade global: ${itemCount}`);

        // Atualizar classes dos tiers
        updateAllTierBars(itemCount);

        // Atualizar barra de progresso e label
        if (window.PriceProgressBar && window.PriceProgressBar.updateProgress) {
            window.PriceProgressBar.updateProgress();
        }

        // ✅ NOVO: Atualizar badge de preço no modal (se estiver aberto)
        const modal = document.getElementById('photoModal');
        if (modal && modal.style.display === 'flex') {
            console.log('🔄 [TIER UPDATE] Modal aberto - atualizando preço...');
            if (window.updateModalPriceInfo) {
                window.updateModalPriceInfo();
            }
        }
    });

    /**
     * Atualiza todos os tiers de preço visíveis na página
     */
    function updateAllTierBars(globalCount) {
        // Buscar todos os tiers de preço na página
        const priceTiers = document.querySelectorAll('.price-tier');

        console.log(`📊 [TIER UPDATE] Encontrados ${priceTiers.length} tiers para atualizar`);

        priceTiers.forEach((tier, index) => {
            updateSingleTier(tier, globalCount, index);
        });
    }

    /**
     * Atualiza um único tier de preço
     */
    function updateSingleTier(tier, globalCount, tierIndex = 0) {
        // Extrair min/max dos atributos data
        const min = parseInt(tier.getAttribute('data-min'));
        const max = parseInt(tier.getAttribute('data-max'));

        if (!min && min !== 0) {
            console.log(`⚠️ [TIER UPDATE] Tier ${tierIndex}: sem data-min`);
            return;
        }

        // Determinar se este tier está ativo
        const isActive = globalCount >= min && (!max || globalCount <= max || max === 999);

        console.log(`🔍 [TIER UPDATE] Tier ${tierIndex}: min=${min}, max=${max}, globalCount=${globalCount}, isActive=${isActive}`);

        // Atualizar classes
        if (isActive) {
            if (!tier.classList.contains('active')) {
                tier.classList.add('active');
                console.log(`✅ [TIER UPDATE] Tier ${tierIndex} (${min}-${max || '∞'}) ATIVADO`);
            }
        } else {
            if (tier.classList.contains('active')) {
                tier.classList.remove('active');
                console.log(`⭕ [TIER UPDATE] Tier ${tierIndex} (${min}-${max || '∞'}) DESATIVADO`);
            }
        }
    }

    // ===== ADICIONAR ÍCONE DE CHAT AOS BADGES DE PREÇO =====

    /**
     * Adiciona ícone de chat clicável ao badge de preço
     */
    window.addChatIconToBadge = function (badgeElement) {
        if (!badgeElement) return;

        // Verificar se já tem o ícone (não duplicar)
        if (badgeElement.querySelector('.chat-icon-badge')) return;

        // Criar ícone
        const chatIcon = document.createElement('i');
        chatIcon.className = 'fas fa-comment-dots chat-icon-badge';
        chatIcon.style.marginLeft = '8px';
        chatIcon.style.fontSize = '0.9em';
        chatIcon.style.opacity = '0.9';
        chatIcon.title = 'Click to contact sales';

        // Adicionar ao badge
        badgeElement.appendChild(chatIcon);

        // Tornar clicável
        badgeElement.style.cursor = 'pointer';
        badgeElement.style.transition = 'all 0.3s ease';

        // Efeito hover
        badgeElement.addEventListener('mouseenter', function () {
            this.style.transform = 'scale(1.05)';
            this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        });

        badgeElement.addEventListener('mouseleave', function () {
            this.style.transform = 'scale(1)';
            this.style.boxShadow = 'none';
        });

        console.log('✅ Ícone de chat adicionado ao badge');
    }

    // ===== CHAT: FUNÇÕES PARA ABRIR COM MENSAGEM PRÉ-PREENCHIDA =====

    /**
     * Pega nome da categoria com fallback inteligente
     */
    window.getCategoryNameSafely = function () {
        // Nível 1: Tentar método hierárquico
        if (typeof window.getCurrentCategoryDisplayName === 'function') {
            try {
                const name = window.getCurrentCategoryDisplayName();
                if (name && name !== 'Premium Cowhide Selection') {
                    console.log('✅ Nome da categoria (hierárquico):', name);
                    return name;
                }
            } catch (error) {
                console.warn('⚠️ Erro ao pegar nome hierárquico:', error);
            }
        }

        // Nível 2: Tentar nome simples
        if (window.navigationState && window.navigationState.currentCategoryName) {
            console.log('✅ Nome da categoria (simples):', window.navigationState.currentCategoryName);
            return window.navigationState.currentCategoryName;
        }

        // Nível 3: Fallback
        console.warn('⚠️ Não foi possível obter nome da categoria, usando fallback');
        return null;
    }

    /**
     * Abre chat com mensagem sobre preço pré-preenchida
     */
    window.openChatWithPriceQuestion = function () {
        const categoryName = window.getCategoryNameSafely();

        let message;
        if (categoryName) {
            message = `Hello! I would like to know the price for "${categoryName}".`;
        } else {
            message = `Hello! I would like to know the price for [please specify the category].`;
        }

        console.log('💬 Abrindo chat com mensagem:', message);

        // Abrir chat primeiro
        if (window.chatManager) {
            window.chatManager.openChat();
        } else {
            console.error('❌ ChatManager não disponível');
            alert('Chat system is not available. Please refresh the page.');
            return;
        }

        // Pré-preencher input e ajustar altura
        setTimeout(() => {
            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
                // Preencher mensagem
                chatInput.value = message;

                // Ajustar altura automaticamente
                chatInput.style.height = 'auto';
                chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';

                // Focar e posicionar cursor no final
                chatInput.focus();
                chatInput.setSelectionRange(message.length, message.length);

                console.log('✅ Textarea ajustado para altura:', chatInput.style.height);
            }
        }, 400);
    }
})();

// ===== MOBILE: TOGGLE TIERS =====
function initMobileTierToggle() {
    if (window.innerWidth > 768) return;

    const priceContainer = document.getElementById('priceProgressContainer');
    if (!priceContainer) return;

    const wrapper = priceContainer.querySelector('.price-progress-wrapper');
    if (!wrapper) return;

    // Criar botão toggle se não existir
    let toggleBtn = priceContainer.querySelector('.toggle-tiers-btn');
    if (!toggleBtn) {
        toggleBtn = document.createElement('button');
        toggleBtn.className = 'toggle-tiers-btn';
        toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i> View all prices';

        toggleBtn.addEventListener('click', function () {
            wrapper.classList.toggle('expanded');
            if (wrapper.classList.contains('expanded')) {
                this.innerHTML = '<i class="fas fa-chevron-up"></i> Hide';
            } else {
                this.innerHTML = '<i class="fas fa-chevron-down"></i> View all prices';
            }
        });

        priceContainer.appendChild(toggleBtn);
    }
}

// Chamar quando carregar fotos
const originalLoadPhotos = window.loadPhotos;
window.loadPhotos = async function (folderId) {
    await originalLoadPhotos(folderId);
    setTimeout(initMobileTierToggle, 500);
};

// Inicializar ao carregar
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initMobileTierToggle, 1000);
});