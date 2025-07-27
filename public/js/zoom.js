/**
 * ZOOM.JS - SUNSHINE COWHIDES
 * Sistema de zoom inteligente e modular para fotos
 * Compatível com desktop e mobile
 */

class PhotoZoom {
    constructor(options = {}) {
        this.options = {
            minZoom: 0.5,
            maxZoom: 4,
            zoomStep: 0.3,
            enableWheel: true,
            enableTouch: true,
            enableButtons: true,
            resetOnChange: true,
            ...options
        };
        
        this.state = {
            zoom: 1,
            panX: 0,
            panY: 0,
            isDragging: false,
            lastTouchDistance: 0,
            isZoomed: false
        };
        
        this.elements = {};
        this.handlers = {};
        
        this.init();
    }
    
    init() {
        console.log('🔍 Inicializando sistema de zoom...');
        this.createZoomControls();
        this.setupEventListeners();
    }
    
    // ===== CRIAR CONTROLES DE ZOOM =====
    createZoomControls() {
        // Verificar se modal existe
        const modal = document.getElementById('photoModal');
        if (!modal) {
            console.warn('Modal não encontrado para zoom');
            return;
        }
        
        // Criar container de controles
        const controlsHTML = `
            <div id="zoomControls" class="zoom-controls">
                <button id="zoomIn" class="zoom-btn zoom-in" title="Ampliar">
                    <i class="fas fa-plus"></i>
                </button>
                <span id="zoomLevel" class="zoom-level">100%</span>
                <button id="zoomOut" class="zoom-btn zoom-out" title="Reduzir">
                    <i class="fas fa-minus"></i>
                </button>
                <button id="zoomReset" class="zoom-btn zoom-reset" title="Tamanho original">
                    <i class="fas fa-expand-arrows-alt"></i>
                </button>
            </div>
        `;
        
        // Inserir controles no modal-body
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody && !document.getElementById('zoomControls')) {
            modalBody.insertAdjacentHTML('beforeend', controlsHTML);
        }
        
        // Armazenar elementos
        this.elements = {
            modal: modal,
            modalBody: modalBody,
            photoContainer: modal.querySelector('.photo-container'),
            image: modal.querySelector('#modalPhoto'),
            zoomControls: document.getElementById('zoomControls'),
            zoomIn: document.getElementById('zoomIn'),
            zoomOut: document.getElementById('zoomOut'),
            zoomReset: document.getElementById('zoomReset'),
            zoomLevel: document.getElementById('zoomLevel')
        };
    }
    
    // ===== CONFIGURAR EVENT LISTENERS =====
    setupEventListeners() {
        if (!this.elements.image || !this.elements.photoContainer) return;
        
        // Botões de zoom
        if (this.options.enableButtons) {
            this.elements.zoomIn?.addEventListener('click', () => this.zoomIn());
            this.elements.zoomOut?.addEventListener('click', () => this.zoomOut());
            this.elements.zoomReset?.addEventListener('click', () => this.resetZoom());
        }
        
        // Scroll do mouse (desktop)
        if (this.options.enableWheel) {
            this.handlers.wheel = (e) => this.handleWheel(e);
            this.elements.photoContainer.addEventListener('wheel', this.handlers.wheel, { passive: false });
        }
        
        // Touch events (mobile)
        if (this.options.enableTouch) {
            this.handlers.touchStart = (e) => this.handleTouchStart(e);
            this.handlers.touchMove = (e) => this.handleTouchMove(e);
            this.handlers.touchEnd = (e) => this.handleTouchEnd(e);
            
            this.elements.photoContainer.addEventListener('touchstart', this.handlers.touchStart, { passive: false });
            this.elements.photoContainer.addEventListener('touchmove', this.handlers.touchMove, { passive: false });
            this.elements.photoContainer.addEventListener('touchend', this.handlers.touchEnd, { passive: false });
        }
        
        // Mouse events (pan)
        this.handlers.mouseDown = (e) => this.handleMouseDown(e);
        this.handlers.mouseMove = (e) => this.handleMouseMove(e);
        this.handlers.mouseUp = (e) => this.handleMouseUp(e);
        
        this.elements.image.addEventListener('mousedown', this.handlers.mouseDown);
        document.addEventListener('mousemove', this.handlers.mouseMove);
        document.addEventListener('mouseup', this.handlers.mouseUp);
        
        // Duplo clique para zoom rápido
        this.handlers.doubleClick = (e) => this.handleDoubleClick(e);
        this.elements.image.addEventListener('dblclick', this.handlers.doubleClick);
        
        // Resetar zoom quando modal fechar
        this.handlers.modalClose = () => this.resetZoom();
        this.elements.modal.addEventListener('click', (e) => {
            if (e.target === this.elements.modal || e.target.classList.contains('modal-overlay')) {
                this.resetZoom();
            }
        });
    }
    
    // ===== FUNÇÕES DE ZOOM =====
    zoomIn() {
        this.setZoom(this.state.zoom + this.options.zoomStep);
    }
    
    zoomOut() {
        this.setZoom(this.state.zoom - this.options.zoomStep);
    }
    
    setZoom(newZoom, centerX = null, centerY = null) {
        // Limitar zoom
        newZoom = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, newZoom));
        
        if (newZoom === this.state.zoom) return;
        
        const oldZoom = this.state.zoom;
        this.state.zoom = newZoom;
        this.state.isZoomed = newZoom > 1;
        
        // Calcular pan para manter ponto central
        if (centerX !== null && centerY !== null && this.elements.image) {
            const rect = this.elements.image.getBoundingClientRect();
            const containerRect = this.elements.photoContainer.getBoundingClientRect();
            
            // Converter coordenadas do mouse para coordenadas da imagem
            const imageX = (centerX - rect.left) / rect.width;
            const imageY = (centerY - rect.top) / rect.height;
            
            // Ajustar pan baseado no zoom
            const zoomChange = newZoom / oldZoom;
            this.state.panX = (this.state.panX + imageX * rect.width) * zoomChange - imageX * rect.width * newZoom;
            this.state.panY = (this.state.panY + imageY * rect.height) * zoomChange - imageY * rect.height * newZoom;
        }
        
        this.updateImageTransform();
        this.updateZoomControls();
        this.updateCursor();
    }
    
    resetZoom() {
        this.state.zoom = 1;
        this.state.panX = 0;
        this.state.panY = 0;
        this.state.isZoomed = false;
        this.state.isDragging = false;
        
        this.updateImageTransform();
        this.updateZoomControls();
        this.updateCursor();
    }
    
    // ===== ATUALIZAR TRANSFORMAÇÕES =====
    updateImageTransform() {
        if (!this.elements.image) return;
        
        // Limitar pan para não sair da imagem
        this.constrainPan();
        
        const transform = `scale(${this.state.zoom}) translate(${this.state.panX / this.state.zoom}px, ${this.state.panY / this.state.zoom}px)`;
        this.elements.image.style.transform = transform;
        this.elements.image.style.transformOrigin = 'center center';
        this.elements.image.style.transition = this.state.isDragging ? 'none' : 'transform 0.2s ease';
    }
    
    constrainPan() {
        if (!this.elements.image || this.state.zoom <= 1) {
            this.state.panX = 0;
            this.state.panY = 0;
            return;
        }
        
        const rect = this.elements.image.getBoundingClientRect();
        const containerRect = this.elements.photoContainer.getBoundingClientRect();
        
        const scaledWidth = rect.width * this.state.zoom;
        const scaledHeight = rect.height * this.state.zoom;
        
        const maxPanX = Math.max(0, (scaledWidth - containerRect.width) / 2);
        const maxPanY = Math.max(0, (scaledHeight - containerRect.height) / 2);
        
        this.state.panX = Math.max(-maxPanX, Math.min(maxPanX, this.state.panX));
        this.state.panY = Math.max(-maxPanY, Math.min(maxPanY, this.state.panY));
    }
    
    updateZoomControls() {
        if (!this.elements.zoomLevel) return;
        
        const percentage = Math.round(this.state.zoom * 100);
        this.elements.zoomLevel.textContent = `${percentage}%`;
        
        // Atualizar estado dos botões
        if (this.elements.zoomIn) {
            this.elements.zoomIn.disabled = this.state.zoom >= this.options.maxZoom;
        }
        
        if (this.elements.zoomOut) {
            this.elements.zoomOut.disabled = this.state.zoom <= this.options.minZoom;
        }
        
        // Mostrar/ocultar controles baseado no zoom
        if (this.elements.zoomControls) {
            this.elements.zoomControls.style.opacity = this.state.isZoomed ? '1' : '0.7';
        }
    }
    
    updateCursor() {
        if (!this.elements.image) return;
        
        if (this.state.isZoomed) {
            this.elements.image.style.cursor = this.state.isDragging ? 'grabbing' : 'grab';
        } else {
            this.elements.image.style.cursor = 'zoom-in';
        }
    }
    
    // ===== EVENT HANDLERS =====
    handleWheel(e) {
        e.preventDefault();
        
        const delta = e.deltaY > 0 ? -this.options.zoomStep : this.options.zoomStep;
        const rect = this.elements.photoContainer.getBoundingClientRect();
        const centerX = e.clientX;
        const centerY = e.clientY;
        
        this.setZoom(this.state.zoom + delta, centerX, centerY);
    }
    
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
            
            const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            
            this.setZoom(this.state.zoom * scale, centerX, centerY);
            this.state.lastTouchDistance = distance;
        } else if (e.touches.length === 1 && this.state.isDragging && this.state.isZoomed) {
            e.preventDefault();
            const deltaX = e.touches[0].clientX - this.state.lastTouchX;
            const deltaY = e.touches[0].clientY - this.state.lastTouchY;
            
            this.state.panX += deltaX;
            this.state.panY += deltaY;
            
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
            
            this.state.panX += deltaX;
            this.state.panY += deltaY;
            
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
            const rect = this.elements.photoContainer.getBoundingClientRect();
            const centerX = e.clientX;
            const centerY = e.clientY;
            this.setZoom(2, centerX, centerY);
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
        // Remover event listeners
        Object.entries(this.handlers).forEach(([event, handler]) => {
            // Implementar cleanup se necessário
        });
        
        // Remover controles
        const controls = document.getElementById('zoomControls');
        if (controls) {
            controls.remove();
        }
        
        console.log('🔍 Sistema de zoom destruído');
    }
}

// ===== INICIALIZAÇÃO GLOBAL =====
let photoZoomInstance = null;

// Função para inicializar zoom (chamada pelo client.js)
function initializePhotoZoom() {
    if (!photoZoomInstance) {
        photoZoomInstance = new PhotoZoom({
            minZoom: 0.5,
            maxZoom: 5,
            zoomStep: 0.4,
            enableWheel: true,
            enableTouch: true,
            enableButtons: true,
            resetOnChange: true
        });
        console.log('🔍 Sistema de zoom inicializado');
    }
    return photoZoomInstance;
}

// Função para notificar mudança de foto
function notifyPhotoChange() {
    if (photoZoomInstance) {
        photoZoomInstance.onPhotoChange();
    }
}

// Função para destruir zoom
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