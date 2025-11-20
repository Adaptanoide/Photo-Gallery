//public/js/zoom.js

/**
 * ZOOM SIMPLIFICADO E MELHORADO - SUNSHINE COWHIDES
 * Versão focada em experiência confiável do usuário
 * Remove scroll zoom, melhora proporção e centralização
 */

class PhotoZoomSimplified {
    constructor(options = {}) {
        this.options = {
            minZoom: 0.8,
            maxZoom: 3,
            zoomStep: 0.4,
            enableWheel: false,        // DESABILITADO - era problemático
            enableTouch: true,         // Mantido para mobile
            enableButtons: true,       // Principal método de zoom
            resetOnChange: true,
            smoothZoom: true,
            centerOnZoom: true,
            ...options
        };

        this.state = {
            zoom: 1,
            panX: 0,
            panY: 0,
            isDragging: false,
            lastTouchDistance: 0,
            isZoomed: false,
            imageOriginalSize: { width: 0, height: 0 },
            containerSize: { width: 0, height: 0 },
            isLoadingOriginal: false  // ← ADICIONE ESTA LINHA
        };

        this.elements = {};
        this.handlers = {};

        this.init();
    }

    init() {
        console.log('🔍 Inicializando zoom simplificado...');
        this.createZoomControls();
        this.setupEventListeners();
        this.improveImageLayout();
    }

    // ===== MELHORAR LAYOUT DA IMAGEM =====
    improveImageLayout() {
        const modalBody = document.querySelector('.modal-body');
        const photoContainer = document.querySelector('.photo-container');

        if (modalBody && photoContainer) {
            // Melhorar CSS para maior aproveitamento da tela
            modalBody.style.padding = '5px';
            photoContainer.style.padding = '5px';

            // Garantir que imagem use espaço máximo disponível
            const img = document.querySelector('#modalPhoto');
            if (img) {
                img.style.maxWidth = 'calc(100vw - 100px)';
                img.style.maxHeight = 'calc(100vh - 160px)';
                img.style.width = 'auto';
                img.style.height = 'auto';
            }
        }
    }

    // ===== CRIAR CONTROLES SIMPLIFICADOS =====
    createZoomControls() {
        const modal = document.getElementById('photoModal');
        if (!modal) return;

        const controlsHTML = `
            <div id="zoomControls" class="zoom-controls-simple">
                <button id="zoomIn" class="zoom-btn-simple zoom-in" title="Ampliar">
                    <i class="fas fa-plus"></i>
                </button>
                <button id="zoomOut" class="zoom-btn-simple zoom-out" title="Reduzir">
                    <i class="fas fa-minus"></i>
                </button>
                <button id="zoomReset" class="zoom-btn-simple zoom-reset" title="Resetar">
                    <i class="fas fa-expand-arrows-alt"></i>
                </button>
            </div>
        `;

        const modalBody = modal.querySelector('.modal-body');
        if (modalBody && !document.getElementById('zoomControls')) {
            modalBody.insertAdjacentHTML('beforeend', controlsHTML);
        }

        this.elements = {
            modal: modal,
            modalBody: modalBody,
            image: modal.querySelector('#modalPhoto'),
            photoContainer: modal.querySelector('.photo-container'),
            zoomControls: document.getElementById('zoomControls'),
            zoomIn: document.getElementById('zoomIn'),
            zoomOut: document.getElementById('zoomOut'),
            zoomReset: document.getElementById('zoomReset')
        };
    }

    // ===== CONFIGURAR EVENT LISTENERS SIMPLIFICADOS =====
    setupEventListeners() {
        if (!this.elements.image || !this.elements.photoContainer) return;

        // Botões de zoom (principal método)
        this.elements.zoomIn?.addEventListener('click', () => this.zoomIn());
        this.elements.zoomOut?.addEventListener('click', () => this.zoomOut());
        this.elements.zoomReset?.addEventListener('click', () => this.resetZoom());

        // REMOVIDO: Scroll do mouse (era problemático)
        // REMOVIDO: Event listeners de wheel

        // Touch para mobile (mantido, mas simplificado)
        if (this.options.enableTouch) {
            this.handlers.touchStart = (e) => this.handleTouchStart(e);
            this.handlers.touchMove = (e) => this.handleTouchMove(e);
            this.handlers.touchEnd = (e) => this.handleTouchEnd(e);

            this.elements.photoContainer.addEventListener('touchstart', this.handlers.touchStart, { passive: false });
            this.elements.photoContainer.addEventListener('touchmove', this.handlers.touchMove, { passive: false });
            this.elements.photoContainer.addEventListener('touchend', this.handlers.touchEnd, { passive: false });
        }

        // Pan simplificado apenas quando ampliado
        this.handlers.mouseDown = (e) => this.handleMouseDown(e);
        this.handlers.mouseMove = (e) => this.handleMouseMove(e);
        this.handlers.mouseUp = (e) => this.handleMouseUp(e);

        this.elements.image.addEventListener('mousedown', this.handlers.mouseDown);
        document.addEventListener('mousemove', this.handlers.mouseMove);
        document.addEventListener('mouseup', this.handlers.mouseUp);

        // Duplo clique para fit/reset
        this.handlers.doubleClick = (e) => this.handleDoubleClick(e);
        this.elements.image.addEventListener('dblclick', this.handlers.doubleClick);

        // Resetar ao trocar foto
        this.handlers.modalClose = () => this.resetZoom();
        this.elements.modal.addEventListener('click', (e) => {
            if (e.target === this.elements.modal || e.target.classList.contains('modal-overlay')) {
                this.resetZoom();
            }
        });

        // Atualizar tamanhos quando imagem carregar
        this.elements.image.addEventListener('load', () => {
            this.updateImageInfo();
            // Só resetar se NÃO estiver carregando original
            if (!this.state.isLoadingOriginal) {
                this.resetZoom(); // Resetar apenas para fotos novas
            }
            this.state.isLoadingOriginal = false; // Limpar flag
        });
    }

    // ===== FUNÇÕES DE ZOOM MELHORADAS =====
    zoomIn() {
        this.setZoomCentered(this.state.zoom + this.options.zoomStep);
    }

    zoomOut() {
        this.setZoomCentered(this.state.zoom - this.options.zoomStep);
    }

    setZoomCentered(newZoom) {
        // Limitar zoom
        newZoom = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, newZoom));

        if (newZoom === this.state.zoom) return;

        this.state.zoom = newZoom;
        // Carregar original em zoom 1.8+ (2 cliques)
        if (newZoom >= 1.8 && !this.originalLoading && !this.originalLoaded) {
            this.loadOriginalImage();
        }
        this.state.isZoomed = newZoom > 1;

        // SEMPRE centralizar - remove problema de pan
        this.state.panX = 0;
        this.state.panY = 0;

        this.updateImageTransform();
        this.updateZoomControls();
        this.updateCursor();
    }

    resetZoom() {
        this.state.zoom = 1;
        // Resetar flags da original
        this.originalLoaded = false;
        this.originalLoading = false;
        this.state.panX = 0;
        this.state.panY = 0;
        this.state.isZoomed = false;
        this.state.isDragging = false;

        this.updateImageTransform();
        this.updateZoomControls();
        this.updateCursor();
    }

    // ===== ATUALIZAR INFO DA IMAGEM =====
    updateImageInfo() {
        if (!this.elements.image || !this.elements.photoContainer) return;

        const imageRect = this.elements.image.getBoundingClientRect();
        const containerRect = this.elements.photoContainer.getBoundingClientRect();

        this.state.imageOriginalSize = {
            width: this.elements.image.naturalWidth || imageRect.width,
            height: this.elements.image.naturalHeight || imageRect.height
        };

        this.state.containerSize = {
            width: containerRect.width,
            height: containerRect.height
        };
    }

    // ===== TRANSFORMAÇÕES SIMPLIFICADAS =====
    updateImageTransform() {
        if (!this.elements.image) return;

        const transform = `scale(${this.state.zoom}) translate(${this.state.panX}px, ${this.state.panY}px)`;
        this.elements.image.style.transform = transform;
        this.elements.image.style.transformOrigin = 'center center';
        this.elements.image.style.transition = this.options.smoothZoom ? 'transform 0.3s ease' : 'none';
    }

    updateZoomControls() {
        // Atualizar estado dos botões
        if (this.elements.zoomIn) {
            this.elements.zoomIn.disabled = this.state.zoom >= this.options.maxZoom;
        }

        if (this.elements.zoomOut) {
            this.elements.zoomOut.disabled = this.state.zoom <= this.options.minZoom;
        }
    }

    updateCursor() {
        if (!this.elements.image) return;

        if (this.state.isZoomed) {
            this.elements.image.style.cursor = this.state.isDragging ? 'grabbing' : 'grab';
        } else {
            this.elements.image.style.cursor = 'default';
        }
    }

    // ===== EVENT HANDLERS SIMPLIFICADOS =====

    // REMOVIDO: handleWheel (era problemático)

    handleTouchStart(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            const distance = this.getTouchDistance(e.touches);
            this.state.lastTouchDistance = distance;
        } else if (e.touches.length === 1 && this.state.isZoomed) {
            e.preventDefault();
            this.state.isDragging = true;
            this.state.lastTouchX = e.touches[0].clientX;
            this.state.lastTouchY = e.touches[0].clientY;
        }
    }

    handleTouchMove(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            const distance = this.getTouchDistance(e.touches);
            const scale = distance / this.state.lastTouchDistance;

            // Zoom mais conservador no touch
            const newZoom = this.state.zoom * scale;
            this.setZoomCentered(newZoom);
            this.state.lastTouchDistance = distance;
        } else if (e.touches.length === 1 && this.state.isDragging && this.state.isZoomed) {
            e.preventDefault();
            const deltaX = e.touches[0].clientX - this.state.lastTouchX;
            const deltaY = e.touches[0].clientY - this.state.lastTouchY;

            // Pan limitado
            this.state.panX += deltaX * 0.5; // Mais conservador
            this.state.panY += deltaY * 0.5;

            this.updateImageTransform();

            this.state.lastTouchX = e.touches[0].clientX;
            this.state.lastTouchY = e.touches[0].clientY;
        }
    }

    handleTouchEnd(e) {
        this.state.isDragging = false;
        this.updateCursor();
    }

    handleMouseDown(e) {
        if (this.state.isZoomed) {
            e.preventDefault();
            this.state.isDragging = true;
            this.state.lastMouseX = e.clientX;
            this.state.lastMouseY = e.clientY;
            this.updateCursor();
        }
    }

    handleMouseMove(e) {
        if (this.state.isDragging && this.state.isZoomed) {
            e.preventDefault();
            const deltaX = e.clientX - this.state.lastMouseX;
            const deltaY = e.clientY - this.state.lastMouseY;

            // Pan limitado e suave
            this.state.panX += deltaX * 0.7;
            this.state.panY += deltaY * 0.7;

            this.updateImageTransform();

            this.state.lastMouseX = e.clientX;
            this.state.lastMouseY = e.clientY;
        }
    }

    handleMouseUp(e) {
        this.state.isDragging = false;
        this.updateCursor();
    }

    handleDoubleClick(e) {
        e.preventDefault();

        if (this.state.zoom > 1) {
            this.resetZoom();
        } else {
            this.setZoomCentered(2);
        }
    }

    // ===== UTILITÁRIOS =====
    getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // ===== API PÚBLICA =====
    onPhotoChange() {
        if (this.options.resetOnChange) {
            this.resetZoom();
        }
    }

    destroy() {
        const controls = document.getElementById('zoomControls');
        if (controls) {
            controls.remove();
        }
        console.log('🔍 Zoom simplificado destruído');
    }

    // ADICIONE AQUI A NOVA FUNÇÃO! ←←←←←
    loadOriginalImage() {
        // Evitar carregar múltiplas vezes
        if (this.originalLoading || this.originalLoaded) return;

        this.originalLoading = true;
        this.state.isLoadingOriginal = true; // ← ADICIONE ESTA LINHA
        console.log('🔍 Zoom 1.8+ detectado! Carregando original...');

        const img = this.elements.image;
        if (!img) return;

        // Pegar o ID da foto atual
        const photos = window.navigationState?.currentPhotos || [];
        const currentIndex = window.navigationState?.currentPhotoIndex || 0;
        const photo = photos[currentIndex];

        if (!photo || !photo.id) {
            console.warn('Foto não encontrada para carregar original');
            this.originalLoading = false;
            return;
        }

        // URL da original
        const originalUrl = `https://images.sunshinecowhides-gallery.com/${photo.id}`;

        // Carregar em background
        const tempImg = new Image();
        tempImg.onload = () => {
            // Substituir suavemente
            img.style.transition = 'opacity 0.3s';
            img.style.opacity = '0.8';

            setTimeout(() => {
                img.src = originalUrl;
                img.style.opacity = '1';
                this.originalLoaded = true;
                this.originalLoading = false;
                console.log('✅ Original carregada! Qualidade máxima ativa.');
            }, 300);
        };

        tempImg.onerror = () => {
            console.error('❌ Erro ao carregar original');
            this.originalLoading = false;
        };

        // Iniciar carregamento
        tempImg.src = originalUrl;
    }

}

// ===== SUBSTITUIR INSTÂNCIA GLOBAL =====
let photoZoomInstance = null;

function initializePhotoZoom() {
    if (!photoZoomInstance) {
        photoZoomInstance = new PhotoZoomSimplified({
            minZoom: 0.8,
            maxZoom: 3,
            zoomStep: 0.4,  // ← MUDAR PARA 0.4 (igual ao constructor)
            enableWheel: false,      // DESABILITADO
            enableTouch: true,
            enableButtons: true,
            resetOnChange: true,
            smoothZoom: true,
            centerOnZoom: true
        });
        console.log('🔍 Zoom simplificado inicializado');
    }
    return photoZoomInstance;
}

function notifyPhotoChange() {
    if (photoZoomInstance) {
        photoZoomInstance.onPhotoChange();
    }
}

function destroyPhotoZoom() {
    if (photoZoomInstance) {
        photoZoomInstance.destroy();
        photoZoomInstance = null;
    }
}

// Expor funções globalmente
window.initializePhotoZoom = initializePhotoZoom;
window.notifyPhotoChange = notifyPhotoChange;
window.destroyPhotoZoom = destroyPhotoZoom;