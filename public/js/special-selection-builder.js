//public/js/special-selection-builder.js

/**
 * SPECIAL SELECTION BUILDER - SUNSHINE COWHIDES
 * Interface dual para criação de seleções especiais
 * Reutiliza componentes do client.js e zoom.js
 */

class SpecialSelectionBuilder {
    constructor(selectionData) {
        this.selectionData = selectionData; // Dados da seleção (nome, cliente, etc)
        this.currentStockFolder = 'root';
        this.stockCategoriesData = [];
        this.stockPhotosData = [];
        this.customCategories = [];
        this.selectedPhotos = [];
        this.draggedPhoto = null;
        this.isLoading = false;

        // Estado da navegação (similar ao client.js)
        this.navigationState = {
            currentPath: [],
            currentFolderId: null,
            breadcrumbs: []
        };

        this.init();
    }

    // ===== INICIALIZAÇÃO =====
    init() {
        console.log('🏗️ Inicializando Special Selection Builder...');
        this.setupElements();
        this.setupEventListeners();
        this.loadSelectionInfo();
        this.loadStockCategories();
        console.log('✅ Special Selection Builder inicializado');
    }

    setupElements() {
        // Elementos principais
        this.stockCategoriesElement = document.getElementById('stockCategories');
        this.stockPhotosElement = document.getElementById('stockPhotos');
        this.stockLoading = document.getElementById('stockLoading');
        this.stockBreadcrumb = document.getElementById('stockBreadcrumb');

        this.customCategoriesContainer = document.getElementById('customCategories');
        this.initialDropZone = document.getElementById('initialDropZone');

        // Elementos de informação
        this.selectionNameDisplay = document.getElementById('selectionNameDisplay');
        this.clientNameDisplay = document.getElementById('clientNameDisplay');
        this.photoCount = document.getElementById('photoCount');
        this.categoryCount = document.getElementById('categoryCount');

        // Botões
        this.btnSaveAndContinue = document.getElementById('btnSaveAndContinue');
        this.btnCancelBuilder = document.getElementById('btnCancelBuilder');
        this.btnAddCategory = document.getElementById('btnAddCategory');
        this.btnAddCategoryBottom = document.getElementById('btnAddCategoryBottom');
        this.btnRefreshStock = document.getElementById('btnRefreshStock');
        this.btnPreviewSelection = document.getElementById('btnPreviewSelection');
    }

    setupEventListeners() {
        // Botões principais
        this.btnSaveAndContinue?.addEventListener('click', () => this.saveSelection());
        this.btnCancelBuilder?.addEventListener('click', () => this.cancelBuilder());
        this.btnAddCategory?.addEventListener('click', () => this.showAddCategoryModal());
        this.btnAddCategoryBottom?.addEventListener('click', () => this.showAddCategoryModal());
        this.btnRefreshStock?.addEventListener('click', () => this.refreshStock());
        this.btnPreviewSelection?.addEventListener('click', () => this.previewSelection());

        // Breadcrumb navigation
        this.stockBreadcrumb?.addEventListener('click', (e) => {
            const breadcrumbItem = e.target.closest('.breadcrumb-item');
            if (breadcrumbItem && breadcrumbItem.dataset.folderId) {
                this.navigateToFolder(breadcrumbItem.dataset.folderId);
            }
        });

        // Drop zone events
        this.setupDropZoneEvents();

        console.log('🔗 Event listeners configurados para Builder');
    }

    setupDropZoneEvents() {
        // Drop zone inicial
        this.initialDropZone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.initialDropZone.classList.add('drag-over');
        });

        this.initialDropZone?.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.initialDropZone.classList.remove('drag-over');
        });

        this.initialDropZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            this.initialDropZone.classList.remove('drag-over');
            this.handlePhotoDrop(e, 'new-category');
        });
    }

    // ===== CARREGAMENTO DE DADOS =====
    loadSelectionInfo() {
        if (this.selectionData) {
            if (this.selectionNameDisplay) {
                this.selectionNameDisplay.textContent = this.selectionData.selectionName || 'Unnamed Selection';
            }
            if (this.clientNameDisplay) {
                this.clientNameDisplay.textContent = `${this.selectionData.clientName || 'Unknown'} (${this.selectionData.clientCode || 'N/A'})`;
            }
        }
        this.updateCounts();
    }

    async loadStockCategories() {
        try {
            this.showLoading(true);
            console.log('📁 Carregando categorias do estoque...');

            // Usar endpoint correto para explorar estrutura do Google Drive
            const response = await fetch('/api/drive/explore/1Ky3wSKKg_mmQihdxmiYwMuqE3-SBTcbx', {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success && data.structure && data.structure.folders) {
                this.stockCategoriesData = data.structure.folders;
                this.renderStockCategories();
                console.log(`✅ ${this.stockCategories.length} categorias carregadas`);
            } else {
                throw new Error(data.message || 'Erro ao carregar categorias');
            }

        } catch (error) {
            console.error('❌ Erro ao carregar categorias:', error);
            this.showError('Erro ao carregar categorias do estoque');
        } finally {
            this.showLoading(false);
        }
    }

    async loadStockPhotos(folderId) {
        try {
            this.showLoading(true);
            console.log(`📷 Carregando fotos da pasta: ${folderId}`);

            const response = await fetch(`/api/drive/photos/${folderId}`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success && data.photos) {
                this.stockPhotosData = data.photos;
                this.renderStockPhotos();
                console.log(`✅ ${this.stockPhotosData.length} fotos carregadas`);
            } else {
                throw new Error(data.message || 'Erro ao carregar fotos');
            }

        } catch (error) {
            console.error('❌ Erro ao carregar fotos:', error);
            this.showError('Erro ao carregar fotos da categoria');
        } finally {
            this.showLoading(false);
        }
    }

    // ===== RENDERIZAÇÃO DA INTERFACE =====
    renderStockCategories() {
        if (!this.stockCategoriesData || this.stockCategoriesData.length === 0) {
            this.stockCategoriesElement.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <i class="fas fa-folder-open" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>No categories available</p>
            </div>
        `;
            return;
        }

        const html = this.stockCategoriesData.map(category => `
        <div class="category-item" data-folder-id="${category.id}" data-category-name="${category.name}">
            <div class="category-icon">
                <i class="fas fa-folder"></i>
            </div>
            <div class="category-name">${category.name}</div>
            <div class="category-count">${category.photoCount || 0}</div>
        </div>
    `).join('');

        this.stockCategoriesElement.innerHTML = html;

        // Adicionar event listeners para navegação
        this.stockCategoriesElement.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', () => {
                const folderId = item.dataset.folderId;
                const categoryName = item.dataset.categoryName;
                this.navigateToCategory(folderId, categoryName);
            });
        });

        // Mostrar lista de categorias, esconder fotos
        this.stockCategoriesElement.style.display = 'block';
        this.stockPhotosElement.style.display = 'none';
    }

    renderStockPhotos() {
        if (!this.stockPhotosData || this.stockPhotosData.length === 0) {
            this.stockPhotosElement.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted); grid-column: 1 / -1;">
                <i class="fas fa-images" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>No photos in this category</p>
            </div>
        `;
        } else {
            const html = this.stockPhotosData.map(photo => `
            <div class="photo-card" 
                 draggable="true" 
                 data-photo-id="${photo.id}" 
                 data-photo-name="${photo.name}"
                 data-photo-url="${photo.webViewLink}">
                
                <img class="photo-image" 
                     src="${photo.thumbnailLink || photo.webViewLink}" 
                     alt="${photo.name}"
                     loading="lazy">
                
                <div class="photo-info">
                    <div class="photo-name">${photo.name}</div>
                    <div class="photo-price">$${photo.price || '0.00'}</div>
                </div>
                
                <div class="photo-actions">
                    <button class="photo-action-btn" data-action="preview" title="Preview">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="photo-action-btn" data-action="move" title="Add to Selection">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            </div>
        `).join('');

            this.stockPhotosElement.innerHTML = html;

            // Configurar drag & drop
            this.setupPhotoDragDrop();
        }

        // Mostrar fotos, esconder categorias
        this.stockCategoriesElement.style.display = 'none';
        this.stockPhotosElement.style.display = 'grid';
    }

    renderCustomCategories() {
        if (this.customCategories.length === 0) {
            this.customCategoriesContainer.innerHTML = '';
            this.initialDropZone.style.display = 'block';
            return;
        }

        this.initialDropZone.style.display = 'none';

        const html = this.customCategories.map((category, index) => `
            <div class="custom-category" data-category-index="${index}">
                <div class="custom-category-header" onclick="this.parentElement.classList.toggle('expanded')">
                    <div class="custom-category-info">
                        <div class="custom-category-name">${category.name}</div>
                        <div class="custom-category-count">${category.photos.length}</div>
                    </div>
                    <div class="custom-category-actions" onclick="event.stopPropagation()">
                        <button class="category-action-btn" data-action="edit-category" data-index="${index}" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="category-action-btn" data-action="delete-category" data-index="${index}" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="custom-category-content">
                    <div class="photos-grid">
                        ${category.photos.map(photo => `
                            <div class="photo-card selected" data-photo-id="${photo.id}">
                                <img class="photo-image" src="${photo.thumbnailLink}" alt="${photo.name}">
                                <div class="photo-info">
                                    <div class="photo-name">${photo.name}</div>
                                    <div class="photo-price">$${category.customPrice || photo.originalPrice || '0.00'}</div>
                                </div>
                                <div class="photo-actions">
                                    <button class="photo-action-btn" data-action="preview" title="Preview">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button class="photo-action-btn" data-action="remove" data-photo-id="${photo.id}" data-category-index="${index}" title="Remove">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <!-- Drop zone para adicionar mais fotos -->
                    <div class="drop-zone" data-category-index="${index}">
                        <div class="drop-zone-icon">
                            <i class="fas fa-plus"></i>
                        </div>
                        <div class="drop-zone-text">
                            Drop more photos here
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        this.customCategoriesContainer.innerHTML = html;

        // Setup event listeners para as categorias customizadas
        this.setupCustomCategoryEvents();
    }

    // ===== NAVEGAÇÃO (SIMILAR AO CLIENT.JS) =====
    navigateToCategory(folderId, categoryName) {
        console.log(`📂 Navegando para categoria: ${categoryName} (${folderId})`);

        // Atualizar breadcrumb
        this.updateBreadcrumb(categoryName, folderId);

        // Carregar fotos da categoria
        this.loadStockPhotos(folderId);

        // Atualizar estado
        this.currentStockFolder = folderId;
        this.navigationState.currentFolderId = folderId;
        this.navigationState.currentPath.push({ name: categoryName, id: folderId });
    }

    navigateToFolder(folderId) {
        if (folderId === 'root') {
            // Voltar para categorias
            this.resetBreadcrumb();
            this.renderStockCategories();
            this.currentStockFolder = 'root';
            this.navigationState.currentPath = [];
        } else {
            // Navegar para pasta específica (implementar se necessário)
            console.log(`📁 Navegando para pasta: ${folderId}`);
        }
    }

    updateBreadcrumb(categoryName, folderId) {
        const breadcrumbHtml = `
            <span class="breadcrumb-item" data-folder-id="root">
                <i class="fas fa-home"></i> Stock
            </span>
            <span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>
            <span class="breadcrumb-item active" data-folder-id="${folderId}">
                <i class="fas fa-folder-open"></i> ${categoryName}
            </span>
        `;
        this.stockBreadcrumb.innerHTML = breadcrumbHtml;
    }

    resetBreadcrumb() {
        const breadcrumbHtml = `
            <span class="breadcrumb-item active" data-folder-id="root">
                <i class="fas fa-home"></i> Stock
            </span>
        `;
        this.stockBreadcrumb.innerHTML = breadcrumbHtml;
    }

    // ===== DRAG & DROP =====
    setupPhotoDragDrop() {
        const photoCards = this.stockPhotosElement.querySelectorAll('.photo-card');

        photoCards.forEach(card => {
            // Drag start
            card.addEventListener('dragstart', (e) => {
                this.draggedPhoto = {
                    id: card.dataset.photoId,
                    name: card.dataset.photoName,
                    url: card.dataset.photoUrl,
                    thumbnailLink: card.querySelector('.photo-image').src,
                    originalPrice: card.querySelector('.photo-price').textContent.replace('$', '')
                };
                card.classList.add('dragging');
                console.log('🎯 Drag iniciado:', this.draggedPhoto.name);
            });

            // Drag end
            card.addEventListener('dragend', (e) => {
                card.classList.remove('dragging');
                this.draggedPhoto = null;
                console.log('🎯 Drag finalizado');
            });

            // Click action (fallback para mobile)
            card.addEventListener('click', (e) => {
                const actionBtn = e.target.closest('.photo-action-btn');
                if (actionBtn) {
                    const action = actionBtn.dataset.action;
                    if (action === 'preview') {
                        this.previewPhoto(this.draggedPhoto || {
                            url: card.dataset.photoUrl,
                            name: card.dataset.photoName
                        });
                    } else if (action === 'move') {
                        this.showAddToSelectionModal(card);
                    }
                }
            });
        });
    }

    setupCustomCategoryEvents() {
        // Drop zones das categorias customizadas
        const dropZones = this.customCategoriesContainer.querySelectorAll('.drop-zone');
        dropZones.forEach(dropZone => {
            this.setupDropZone(dropZone);
        });

        // Botões de ação das categorias
        this.customCategoriesContainer.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('[data-action]');
            if (!actionBtn) return;

            const action = actionBtn.dataset.action;
            const index = parseInt(actionBtn.dataset.index);
            const photoId = actionBtn.dataset.photoId;

            switch (action) {
                case 'edit-category':
                    this.editCustomCategory(index);
                    break;
                case 'delete-category':
                    this.deleteCustomCategory(index);
                    break;
                case 'remove':
                    this.removePhotoFromCategory(photoId, index);
                    break;
                case 'preview':
                    // Implementar preview
                    break;
            }
        });
    }

    setupDropZone(dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const categoryIndex = parseInt(dropZone.dataset.categoryIndex);
            this.handlePhotoDrop(e, categoryIndex);
        });
    }

    handlePhotoDrop(e, categoryIndex) {
        if (!this.draggedPhoto) {
            console.warn('⚠️ Nenhuma foto sendo arrastada');
            return;
        }

        console.log(`📸 Drop da foto ${this.draggedPhoto.name} na categoria ${categoryIndex}`);

        if (categoryIndex === 'new-category') {
            // Criar nova categoria
            this.createCategoryWithPhoto(this.draggedPhoto);
        } else {
            // Adicionar à categoria existente
            this.addPhotoToCategory(this.draggedPhoto, categoryIndex);
        }

        this.draggedPhoto = null;
    }

    // ===== GERENCIAMENTO DE CATEGORIAS CUSTOMIZADAS =====
    createCategoryWithPhoto(photo) {
        const categoryName = prompt('Enter category name:', 'Custom Category');
        if (!categoryName) return;

        const customPrice = prompt('Enter custom price (optional):', photo.originalPrice || '0.00');

        const newCategory = {
            id: `custom_${Date.now()}`,
            name: categoryName,
            customPrice: parseFloat(customPrice) || null,
            photos: [photo]
        };

        this.customCategories.push(newCategory);
        this.selectedPhotos.push(photo);
        this.renderCustomCategories();
        this.updateCounts();

        console.log('✅ Nova categoria criada:', newCategory);
    }

    addPhotoToCategory(photo, categoryIndex) {
        if (categoryIndex >= 0 && categoryIndex < this.customCategories.length) {
            // Verificar se foto já existe na categoria
            const existingPhoto = this.customCategories[categoryIndex].photos.find(p => p.id === photo.id);
            if (existingPhoto) {
                alert('Photo already exists in this category');
                return;
            }

            this.customCategories[categoryIndex].photos.push(photo);
            this.selectedPhotos.push(photo);
            this.renderCustomCategories();
            this.updateCounts();

            console.log(`✅ Foto adicionada à categoria ${this.customCategories[categoryIndex].name}`);
        }
    }

    removePhotoFromCategory(photoId, categoryIndex) {
        if (categoryIndex >= 0 && categoryIndex < this.customCategories.length) {
            this.customCategories[categoryIndex].photos = this.customCategories[categoryIndex].photos.filter(p => p.id !== photoId);
            this.selectedPhotos = this.selectedPhotos.filter(p => p.id !== photoId);
            this.renderCustomCategories();
            this.updateCounts();

            console.log(`✅ Foto removida da categoria`);
        }
    }

    deleteCustomCategory(categoryIndex) {
        if (!confirm('Are you sure you want to delete this category? All photos will be removed from the selection.')) {
            return;
        }

        const category = this.customCategories[categoryIndex];
        if (category) {
            // Remover fotos da seleção
            category.photos.forEach(photo => {
                this.selectedPhotos = this.selectedPhotos.filter(p => p.id !== photo.id);
            });

            // Remover categoria
            this.customCategories.splice(categoryIndex, 1);
            this.renderCustomCategories();
            this.updateCounts();

            console.log(`✅ Categoria deletada: ${category.name}`);
        }
    }

    // ===== MODALS E INTERACTIONS =====
    showAddCategoryModal() {
        const categoryName = prompt('Enter category name:', 'Custom Category');
        if (!categoryName) return;

        const customPrice = prompt('Enter custom price (optional):', '0.00');

        const newCategory = {
            id: `custom_${Date.now()}`,
            name: categoryName,
            customPrice: parseFloat(customPrice) || null,
            photos: []
        };

        this.customCategories.push(newCategory);
        this.renderCustomCategories();
        this.updateCounts();

        console.log('✅ Nova categoria vazia criada:', newCategory);
    }

    editCustomCategory(categoryIndex) {
        const category = this.customCategories[categoryIndex];
        if (!category) return;

        const newName = prompt('Edit category name:', category.name);
        if (newName && newName !== category.name) {
            category.name = newName;
        }

        const newPrice = prompt('Edit custom price:', category.customPrice || '0.00');
        if (newPrice) {
            category.customPrice = parseFloat(newPrice) || null;
        }

        this.renderCustomCategories();
        console.log('✅ Categoria editada:', category);
    }

    showAddToSelectionModal(photoCard) {
        // Modal simples para selecionar categoria ou criar nova
        const categoryNames = this.customCategories.map((cat, index) => `${index}: ${cat.name}`).join('\n');
        const options = categoryNames ? `Categories:\n${categoryNames}\n\nEnter category number or 'new' to create:` : 'Enter "new" to create first category:';

        const choice = prompt(options, 'new');
        if (!choice) return;

        const photo = {
            id: photoCard.dataset.photoId,
            name: photoCard.dataset.photoName,
            url: photoCard.dataset.photoUrl,
            thumbnailLink: photoCard.querySelector('.photo-image').src,
            originalPrice: photoCard.querySelector('.photo-price').textContent.replace('$', '')
        };

        if (choice === 'new') {
            this.createCategoryWithPhoto(photo);
        } else {
            const categoryIndex = parseInt(choice);
            if (!isNaN(categoryIndex) && categoryIndex >= 0 && categoryIndex < this.customCategories.length) {
                this.addPhotoToCategory(photo, categoryIndex);
            }
        }
    }

    previewPhoto(photo) {
        // Reutilizar sistema de zoom existente
        if (typeof window.zoomApp !== 'undefined' && window.zoomApp.openPhotoModal) {
            window.zoomApp.openPhotoModal(photo.url, photo.name);
        } else {
            // Fallback
            window.open(photo.url, '_blank');
        }
    }

    previewSelection() {
        // Modal de preview da seleção completa
        alert(`Selection Preview:\n\nCategories: ${this.customCategories.length}\nTotal Photos: ${this.selectedPhotos.length}\n\nThis will show a preview of the complete selection in the future.`);
    }

    // ===== SALVAR E FINALIZAR =====
    async saveSelection() {
        try {
            if (this.customCategories.length === 0) {
                alert('Please add at least one category with photos before saving.');
                return;
            }

            console.log('💾 Salvando seleção especial...');

            const selectionData = {
                ...this.selectionData,
                customCategories: this.customCategories,
                totalPhotos: this.selectedPhotos.length,
                totalCustomCategories: this.customCategories.length
            };

            // Por enquanto, simular salvamento (backend será implementado depois)
            console.log('📦 Dados para salvar:', selectionData);

            alert(`Selection saved successfully!\n\nCategories: ${this.customCategories.length}\nPhotos: ${this.selectedPhotos.length}\n\nRedirecting to admin panel...`);

            // Voltar para admin panel
            window.location.href = '/admin#special-selections';

        } catch (error) {
            console.error('❌ Erro ao salvar seleção:', error);
            alert(`Error saving selection: ${error.message}`);
        }
    }

    cancelBuilder() {
        if (this.selectedPhotos.length > 0) {
            if (!confirm('You have unsaved changes. Are you sure you want to cancel?')) {
                return;
            }
        }

        console.log('❌ Cancelando builder...');
        window.location.href = '/admin#special-selections';
    }

    // ===== UTILITÁRIOS =====
    updateCounts() {
        if (this.photoCount) {
            this.photoCount.textContent = this.selectedPhotos.length;
        }
        if (this.categoryCount) {
            this.categoryCount.textContent = this.customCategories.length;
        }
    }

    refreshStock() {
        console.log('🔄 Atualizando estoque...');
        this.loadStockCategories();
    }

    showLoading(show) {
        this.isLoading = show;
        if (this.stockLoading) {
            this.stockLoading.style.display = show ? 'flex' : 'none';
        }
    }

    showError(message) {
        console.error('❌', message);
        alert(`Error: ${message}`);
    }

    getAuthHeaders() {
        const session = JSON.parse(localStorage.getItem('sunshineSession') || '{}');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`
        };
    }
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    // Verificar se temos dados da seleção (passados via URL params ou localStorage)
    const urlParams = new URLSearchParams(window.location.search);
    const selectionData = {
        selectionName: urlParams.get('name') || localStorage.getItem('builderSelectionName') || 'New Selection',
        clientCode: urlParams.get('client') || localStorage.getItem('builderClientCode') || '',
        clientName: urlParams.get('clientName') || localStorage.getItem('builderClientName') || 'Unknown Client'
    };

    console.log('🏗️ Iniciando Builder com dados:', selectionData);

    // Inicializar builder
    window.specialSelectionBuilder = new SpecialSelectionBuilder(selectionData);
});

console.log('🏗️ special-selection-builder.js carregado');