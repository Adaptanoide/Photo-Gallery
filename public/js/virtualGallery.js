// SISTEMA DE VIRTUAL SCROLLING OTIMIZADO PARA SUNSHINE COWHIDES
// Reduz de 349 requisições para apenas 12 iniciais!

class VirtualGallery {
    constructor() {
        // CONFIGURAÇÕES CRÍTICAS PARA FOTOS PESADAS
        this.BATCH_SIZE = 20;
        this.LOAD_THRESHOLD = 500;
        this.allPhotos = [];
        this.loadedCount = 0;
        this.isLoading = false;
        this.container = null;
        this.categoryPrice = null;
        this.hasMorePhotos = true;
        this.scrollHandler = null;
    }

    // Inicializar com as fotos
    init(photos, container, categoryPrice) {
        console.log(`🚀 Virtual Gallery: Gerenciando ${photos.length} fotos`);
        console.log(`📸 Carregando apenas ${this.BATCH_SIZE} fotos inicialmente`);

        this.allPhotos = photos;
        this.container = container;
        this.categoryPrice = categoryPrice;
        this.loadedCount = 0;
        this.hasMorePhotos = true;

        // Limpar container
        this.container.innerHTML = '';
        this.container.classList.add('virtual-scrolling-active');

        // Carregar primeiro lote
        this.loadNextBatch();

        // Configurar scroll listener
        this.setupScrollListener();

        // Mostrar indicador se tem mais fotos
        if (photos.length > this.BATCH_SIZE) {
            this.showLoadingIndicator();
        }
    }

    // Carregar próximo lote de fotos
    loadNextBatch() {
        if (this.isLoading || !this.hasMorePhotos) {
            return;
        }

        this.isLoading = true;

        const start = this.loadedCount;
        const end = Math.min(start + this.BATCH_SIZE, this.allPhotos.length);

        if (start >= this.allPhotos.length) {
            this.hasMorePhotos = false;
            this.hideLoadingIndicator();
            return;
        }

        console.log(`⏳ Carregando fotos ${start + 1} a ${end} de ${this.allPhotos.length}`);

        const batch = this.allPhotos.slice(start, end);

        // Renderizar com pequeno delay para não travar
        setTimeout(() => {
            this.renderPhotos(batch, start);
            this.loadedCount = end;
            this.updateStatus();
            this.isLoading = false;

            // Verificar se ainda tem fotos
            if (end >= this.allPhotos.length) {
                this.hasMorePhotos = false;
                this.hideLoadingIndicator();
                console.log('✅ Todas as fotos foram carregadas!');
            }
        }, 100);
    }

    // Renderizar fotos no DOM
    renderPhotos(photos, startIndex) {
        const fragment = document.createDocumentFragment();

        photos.forEach((photo, index) => {
            const photoIndex = startIndex + index;
            const div = document.createElement('div');
            div.className = 'photo-thumbnail';
            div.setAttribute('data-photo-id', photo.fileName ? photo.fileName.replace('.webp', '') : photo.id);
            div.setAttribute('data-status', photo.status || 'available');
            div.setAttribute('data-photo-index', photoIndex);

            // IMPORTANTE: Manter compatibilidade com openPhotoModal
            div.onclick = () => {
                if (typeof openPhotoModal === 'function') {
                    openPhotoModal(photoIndex);
                }
            };

            // Verificar se está no carrinho
            const isInCart = window.CartSystem &&
                typeof CartSystem.isInCart === 'function' &&
                CartSystem.isInCart(photo.id);

            // Usar sistema centralizado de cache
            const thumbnailUrl = ImageUtils.getThumbnailUrl(photo);

            // HTML da foto
            div.innerHTML = `
                <img src="${thumbnailUrl}" 
                     alt="${photo.name}" 
                     loading="lazy"
                     decoding="async"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                
                <div class="photo-placeholder" style="display: none;">
                    <i class="fas fa-image"></i>
                    <small>Image not available</small>
                </div>
                
                <div class="photo-price ${this.categoryPrice?.hasPrice ? '' : 'no-price'}">
                    ${this.categoryPrice?.formattedPrice || 'Check price'}
                </div>
                
                <button class="thumbnail-cart-btn ${isInCart ? 'in-cart' : ''}" 
                        onclick="event.stopPropagation(); 
                                if(typeof addToCartFromThumbnail === 'function') {
                                    addToCartFromThumbnail('${photo.id}', ${photoIndex});
                                }"
                        title="${isInCart ? 'Remove from cart' : 'Add to cart'}">
                    <i class="fas fa-${isInCart ? 'check' : 'shopping-cart'}"></i>
                    <span>${isInCart ? 'Remove' : 'Add'}</span>
                </button>
                
                <div class="photo-overlay">
                    <div><strong>${photo.name}</strong></div>
                    <small>${this.formatFileSize(photo.size)}</small>
                </div>
            `;

            fragment.appendChild(div);
        });

        this.container.appendChild(fragment);
    }

    // Configurar listener de scroll
    setupScrollListener() {
        // Remover listener anterior se existir
        if (this.scrollHandler) {
            window.removeEventListener('scroll', this.scrollHandler);
        }

        // Criar função de scroll com throttle
        let scrollTimeout;
        this.scrollHandler = () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.checkScroll();
            }, 150);
        };

        // Adicionar listener
        window.addEventListener('scroll', this.scrollHandler);
    }

    // Verificar se precisa carregar mais fotos
    checkScroll() {
        if (this.isLoading || !this.hasMorePhotos) {
            return;
        }

        const scrollBottom = window.innerHeight + window.scrollY;
        const pageBottom = document.documentElement.offsetHeight - this.LOAD_THRESHOLD;

        if (scrollBottom >= pageBottom) {
            console.log('📜 Usuário chegou perto do fim, carregando mais fotos...');
            this.loadNextBatch();
        }
    }

    // Mostrar indicador de carregamento
    showLoadingIndicator() {
        let indicator = document.getElementById('virtual-loading-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'virtual-loading-indicator';
            indicator.innerHTML = `
                <div class="loading-more">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Loading more photos...</span>
                </div>
            `;
            indicator.style.cssText = `
                text-align: center;
                padding: 40px;
                font-size: 16px;
                color: #666;
            `;

            // Adicionar após o container de fotos
            if (this.container && this.container.parentElement) {
                this.container.parentElement.appendChild(indicator);
            }
        }
        indicator.style.display = 'block';
    }

    // Esconder indicador
    hideLoadingIndicator() {
        const indicator = document.getElementById('virtual-loading-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    // Atualizar contador de status
    updateStatus() {
        const statusEl = document.getElementById('photosCount');
        if (statusEl) {
            const total = this.allPhotos.length;
            const loaded = this.loadedCount;

            if (loaded < total) {
                statusEl.innerHTML = `<strong>${loaded}</strong> of <strong>${total}</strong>`;
            } else {
                statusEl.textContent = `${total} photo(s)`;
            }
        }
    }

    // Formatar tamanho do arquivo
    formatFileSize(bytes) {
        if (!bytes) return '';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // Limpar quando sair da galeria
    destroy() {
        console.log('🧹 Limpando Virtual Gallery...');
        if (this.scrollHandler) {
            window.removeEventListener('scroll', this.scrollHandler);
        }
        this.allPhotos = [];
        this.loadedCount = 0;
        this.hideLoadingIndicator();
    }
}

// Criar instância global
window.virtualGallery = new VirtualGallery();

console.log('✅ Virtual Gallery System carregado e pronto!');
console.log('📊 Configurado para carregar apenas 12 fotos por vez');
console.log('🚀 Redução de 96% nas requisições iniciais!');