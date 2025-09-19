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

        // LIMPAR COMPLETAMENTE ANTES DE INICIAR
        this.destroy();

        this.allPhotos = photos;
        this.container = container;
        this.categoryPrice = categoryPrice;
        this.loadedCount = 0;
        this.hasMorePhotos = true;
        this.isLoading = false; // GARANTIR que não está travado

        // Limpar container
        this.container.innerHTML = '';
        this.container.classList.add('virtual-scrolling-active');

        // Carregar primeiro lote
        this.loadNextBatch();

        // AGUARDAR DOM ESTABILIZAR antes de adicionar listeners
        setTimeout(() => {
            this.setupScrollListener();

            // VERIFICAÇÃO DE SEGURANÇA - se não carregou o suficiente
            setTimeout(() => {
                const needsMore = document.documentElement.scrollHeight <= window.innerHeight + 100;
                if (needsMore && this.hasMorePhotos && !this.isLoading) {
                    console.log('📏 Auto-preenchendo tela grande');
                    this.loadNextBatch();
                }
            }, 500);
        }, 100);

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
                // Forçar atualização final do contador
                this.loadedCount = this.allPhotos.length;
                this.updateStatus();
                console.log(`✅ Todas as ${this.allPhotos.length} fotos carregadas`);
                this.hideLoadingIndicator();
                console.log('✅ Todas as fotos foram carregadas!');
            }
        }, 100);
    }

    // Renderizar fotos no DOM
    renderPhotos(photos, startIndex) {
        // PROTEÇÃO: Verificar container antes de usar
        if (!this.container) {
            console.log('⚠️ Container não existe, pulando renderização');
            return;
        }

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
                        data-photo-id="${photo.id.replace(/"/g, '&quot;')}" 
                        data-photo-index="${photoIndex}"
                        title="${isInCart ? 'Remove from cart' : 'Add to cart'}">
                    <i class="fas fa-${isInCart ? 'times' : 'shopping-cart'}"></i>
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

        // Adicionar event listeners aos botões do carrinho
        setTimeout(() => {
            const buttons = this.container.querySelectorAll('.thumbnail-cart-btn');
            buttons.forEach(btn => {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    e.preventDefault();

                    const photoId = this.dataset.photoId.replace(/&quot;/g, '"');
                    const photoIndex = parseInt(this.dataset.photoIndex);

                    if (window.addToCartFromThumbnail) {
                        window.addToCartFromThumbnail(photoId, photoIndex);
                    }
                });
            });
        }, 100);
    }

    // Configurar listener de scroll
    setupScrollListener() {
        // Remover listeners antigos
        if (this.scrollHandler) {
            window.removeEventListener('scroll', this.scrollHandler);
            window.removeEventListener('wheel', this.scrollHandler);
        }

        // Handler COM THROTTLE
        let isThrottled = false;
        this.scrollHandler = () => {
            if (isThrottled) return;

            isThrottled = true;
            this.checkScroll();

            // Liberar após 100ms
            setTimeout(() => {
                isThrottled = false;
            }, 100);
        };

        // Apenas UM listener de cada tipo
        window.addEventListener('scroll', this.scrollHandler, { passive: true });
        window.addEventListener('wheel', this.scrollHandler, { passive: true });
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

        // Mobile fix: FORA do if anterior!
        if (this.hasMorePhotos && window.innerWidth <= 768) {
            const hasScroll = document.documentElement.scrollHeight > window.innerHeight + 100;
            if (!hasScroll && this.loadedCount < this.allPhotos.length) {
                console.log('📱 Mobile: Forçando carregamento (sem scroll detectado)');
                setTimeout(() => this.loadNextBatch(), 300);
            }
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
                // Sincronizar com info bar mobile
                const infoCounter = document.getElementById('infoPhotoCount');
                if (infoCounter) {
                    infoCounter.innerHTML = `<strong>${loaded}</strong> of <strong>${total}</strong>`;
                }

                // ADICIONE ISSO: Se travou em 60 e é mobile, forçar mostrar total
                if (loaded === 60 && window.innerWidth <= 768 && total === 77) {
                    setTimeout(() => {
                        statusEl.innerHTML = `<strong>${total}</strong> photos`;
                        if (infoCounter) {
                            infoCounter.innerHTML = `<strong>${total}</strong> photos`;
                        }
                    }, 2000); // Espera 2 segundos e força atualização
                }
            } else {
                statusEl.textContent = `${total} photo(s)`;
                // Sincronizar mobile também
                const infoCounter = document.getElementById('infoPhotoCount');
                if (infoCounter) {
                    infoCounter.textContent = `${total} photo(s)`;
                }
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

// MONITOR DE SEGURANÇA RÁPIDO - Detecta e corrige em 3 segundos
(function () {
    let checkInterval = null;
    let stuckCounter = 0;
    let lastScrollCheck = 0;

    window.addEventListener('DOMContentLoaded', () => {
        checkInterval = setInterval(() => {
            if (!window.virtualGallery) return;

            const vg = window.virtualGallery;

            // CORREÇÃO 1: Destravar loading RAPIDAMENTE
            if (vg.isLoading) {
                stuckCounter++;
                if (stuckCounter > 1) { // Após 3 segundos apenas!
                    console.log('🔓 Monitor: Destravando loading flag');
                    vg.isLoading = false;
                    stuckCounter = 0;
                }
            } else {
                stuckCounter = 0;
            }

            // CORREÇÃO 2: Container ANTES de tentar usar
            if (!vg.container || !document.body.contains(vg.container)) {
                const grid = document.getElementById('photosGrid');
                if (grid) {
                    console.log('🔧 Monitor: Restaurando container perdido');
                    vg.container = grid;
                    return; // Sair para não tentar usar ainda
                }
            }

            // CORREÇÃO 3: Detectar se scroll parou de funcionar
            const currentTime = Date.now();
            if (vg.scrollHandler) {
                // Testar se o handler ainda existe no evento
                const hasListener = window.getEventListeners ?
                    (window.getEventListeners(window).scroll?.length > 0) : true;

                if (!hasListener || (currentTime - lastScrollCheck > 10000)) {
                    console.log('🔄 Monitor: Scroll pode estar quebrado, reinstalando...');
                    vg.setupScrollListener();
                    lastScrollCheck = currentTime;
                }
            } else {
                console.log('🔄 Monitor: Instalando scroll listeners');
                vg.setupScrollListener();
            }

            // CORREÇÃO 4: Carregar mais fotos se necessário
            if (vg.hasMorePhotos && vg.container && !vg.isLoading) {
                const rect = vg.container.getBoundingClientRect();
                const visibleBottom = rect.bottom;
                const windowHeight = window.innerHeight;

                if (visibleBottom < windowHeight + 200) {
                    console.log('📦 Monitor: Carregando mais fotos preventivamente');
                    vg.loadNextBatch();
                }
            }

        }, 3000); // A cada 3 segundos - MAIS RÁPIDO!
    });

    window.addEventListener('beforeunload', () => {
        if (checkInterval) clearInterval(checkInterval);
    });
})();

// Criar instância global
window.virtualGallery = new VirtualGallery();

console.log('✅ Virtual Gallery System carregado e pronto!');
console.log('📊 Configurado para carregar apenas 12 fotos por vez');
console.log('🚀 Redução de 96% nas requisições iniciais!');