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
        this.expandedCategories = new Set();
        this.selectedStockPhotos = new Set(); // ← NOVA LINHA
        this.isProcessingClick = false; // ← ADICIONAR ESTA LINHA
        this.draggedPhoto = null; // ← NOVA LINHA
        this.draggedPhotos = []; // Para múltiplas fotos
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
        this.btnBuilderHelp = document.getElementById('btnBuilderHelp');

        // Elementos de seleção múltipla
        this.selectionActionsBar = document.getElementById('selectionActionsBar');
        this.selectionCount = document.getElementById('selectionCount');
        this.btnMoveSelected = document.getElementById('btnMoveSelected');
        this.btnClearSelection = document.getElementById('btnClearSelection');
    }

    setupEventListeners() {
        // Botões principais
        this.btnSaveAndContinue?.addEventListener('click', () => this.saveSelection());
        this.btnCancelBuilder?.addEventListener('click', () => this.cancelBuilder());
        this.btnAddCategory?.addEventListener('click', () => this.showAddCategoryModalLuxury());
        this.btnAddCategoryBottom?.addEventListener('click', () => this.showAddCategoryModalLuxury());
        this.btnRefreshStock?.addEventListener('click', () => this.refreshStock());
        this.btnPreviewSelection?.addEventListener('click', () => this.previewSelection());
        this.btnBuilderHelp?.addEventListener('click', () => this.showHelpModal());
        this.btnSelectAll = document.getElementById('btnSelectAll');
        this.btnSelectAll?.addEventListener('click', () => this.selectAllVisiblePhotos());

        // Event listeners para seleção múltipla
        this.btnMoveSelected?.addEventListener('click', () => this.showMoveSelectedModal());
        this.btnClearSelection?.addEventListener('click', () => this.clearAllSelections());

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
            const response = await fetch('/api/gallery/structure', {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success && data.structure && data.structure.folders) {
                this.stockCategoriesData = data.structure.folders;
                this.renderStockCategories();
                console.log(`✅ ${this.stockCategoriesData.length} categorias carregadas`);
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

            // CACHE: Verificar se já temos esta pasta
            const cacheKey = `photos_${folderId}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const cacheData = JSON.parse(cached);
                if (cacheData.expires > Date.now()) {
                    console.log('⚡ CACHE HIT - Fotos instantâneas!');
                    this.stockPhotosData = cacheData.photos;
                    this.renderStockPhotos();
                    console.log(`✅ ${cacheData.photos.length} fotos do cache`);
                    return; // Pula API
                }
            }

            const response = await fetch(`/api/gallery/photos?prefix=${encodeURIComponent(folderId)}`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success && data.photos) {
                this.stockPhotosData = data.photos;

                // CACHE: Salvar fotos para próxima vez
                const cacheData = {
                    photos: data.photos,
                    expires: Date.now() + (15 * 60 * 1000) // 15 minutos
                };
                localStorage.setItem(cacheKey, JSON.stringify(cacheData));

                this.renderStockPhotos();
                console.log(`✅ ${this.stockPhotosData.length} fotos carregadas e cacheadas`);
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
            <div class="category-count">${(category.photoCount && category.photoCount > 0) ? category.photoCount + ' photos' : ''}</div>
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

        // ✅ DESLIGAR LOADING
        this.showLoading(false);
    }
    renderStockPhotos() {
        // ✅ DEBUG LOGS - INÍCIO
        console.log(`🔥 DEBUG renderStockPhotos: selectedStockPhotos.size = ${this.selectedStockPhotos.size}`);
        const selectionCountElement = document.getElementById('selectionCount');
        console.log(`🔥 DEBUG renderStockPhotos: DOM antes = ${selectionCountElement?.textContent}`);

        if (!this.stockPhotosData || this.stockPhotosData.length === 0) {
            this.stockPhotosElement.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-muted); grid-column: 1 / -1;">
                    <i class="fas fa-images" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>No photos in this category</p>
                </div>
            `;
        } else {
            const html = this.stockPhotosData.map((photo, index) => {
                // Verificar se foto já foi movida
                const isPhotoMoved = this.selectedPhotos.some(selectedPhoto => selectedPhoto.id === photo.id);
                const movedClass = isPhotoMoved ? ' photo-moved' : '';

                return `
                    <div class="photo-card${movedClass}" 
                        draggable="true" 
                        data-photo-id="${photo.id}" 
                        data-photo-name="${photo.name}"
                        data-photo-url="${photo.webViewLink}"
                        onclick="window.specialSelectionBuilder.handlePhotoClick(event, ${index})"
                        style="cursor: pointer;">
                        
                        <!-- Checkbox para seleção múltipla -->
                        <div class="photo-checkbox${isPhotoMoved ? ' photo-checkbox-disabled' : ''}">
                            <input type="checkbox" 
                                id="photo_${photo.id}" 
                                data-photo-index="${index}"
                                ${isPhotoMoved ? 'disabled' : ''}
                                onclick="event.stopPropagation(); window.specialSelectionBuilder.togglePhotoSelection('${photo.id}', ${index})">
                            <label for="photo_${photo.id}" onclick="event.stopPropagation()"></label>
                        </div>
                        
                        <img class="photo-image" 
                            src="${photo.thumbnailLink || photo.webViewLink}" 
                            alt="${photo.name}"
                            loading="lazy">
                        
                        <div class="photo-info">
                            <div class="photo-name">${photo.name}</div>
                            <div class="photo-price">$${photo.price || '0.00'}</div>
                        </div>
                    </div>
                    `;
            }).join('');

            this.stockPhotosElement.innerHTML = html;

            // Configurar drag & drop
            this.setupPhotoDragDrop();

            this.updateHeaderBasePrice();
        }

        // ✅ DEBUG LOGS - FINAL
        console.log(`🔥 DEBUG renderStockPhotos: DOM depois = ${document.getElementById('selectionCount')?.textContent}`);

        // Mostrar fotos, esconder categorias
        this.stockCategoriesElement.style.display = 'none';
        this.stockPhotosElement.style.display = 'grid';

        // ✅ DESLIGAR LOADING
        this.showLoading(false);
    }

    renderCustomCategories() {
        if (this.customCategories.length === 0) {
            this.customCategoriesContainer.innerHTML = '';
            this.initialDropZone.style.display = 'block';
            return;
        }

        this.initialDropZone.style.display = 'none';

        const html = this.customCategories.map((category, index) => `
            <div class="custom-category${this.expandedCategories.has(index) ? ' expanded' : ''}" data-category-index="${index}">
                <div class="custom-category-header" data-header-index="${index}" style="cursor: pointer;">
                    <div class="custom-category-info">
                        <button class="category-chevron" data-chevron-index="${index}">
                            <i class="fas fa-chevron-${this.expandedCategories.has(index) ? 'up' : 'down'}"></i>
                        </button>
                        <div class="custom-category-name">${category.name}</div>
                        <div class="custom-category-count">${category.photos.length}</div>
                        <div class="custom-category-price">Custom Price: $${category.customPrice || '0.00'}</div>
                    </div>
                    <div class="custom-category-actions">
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
                                </div>
                                <div class="photo-actions">
                                    <button class="photo-action-btn" data-action="info" data-photo-id="${photo.id}" data-category-index="${index}" title="Photo Details">
                                        <i class="fas fa-info-circle"></i>
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

    toggleCategory(categoryIndex) {
        const categoryElement = document.querySelector(`.custom-category[data-category-index="${categoryIndex}"]`);
        if (!categoryElement) {
            console.warn(`Categoria ${categoryIndex} não encontrada`);
            return;
        }

        const chevronIcon = categoryElement.querySelector('.category-chevron i');

        if (this.expandedCategories.has(categoryIndex)) {
            // Colapsar
            this.expandedCategories.delete(categoryIndex);
            categoryElement.classList.remove('expanded');
            if (chevronIcon) {
                chevronIcon.className = 'fas fa-chevron-down';
            }
            console.log(`📁 Categoria ${categoryIndex} colapsada`);
        } else {
            // Expandir
            this.expandedCategories.add(categoryIndex);
            categoryElement.classList.add('expanded');
            if (chevronIcon) {
                chevronIcon.className = 'fas fa-chevron-up';
            }
            console.log(`📁 Categoria ${categoryIndex} expandida`);
        }
    }

    // ===== SISTEMA DE SELEÇÃO MÚLTIPLA =====

    handlePhotoClick(event, photoIndex) {
        // Se não clicou no checkbox, abrir preview normalmente
        if (!event.target.closest('.photo-checkbox')) {
            this.previewPhoto(photoIndex);
        }
    }

    togglePhotoSelection(photoId, photoIndex) {
        const checkbox = document.getElementById(`photo_${photoId}`);
        const photoCard = checkbox.closest('.photo-card');

        if (this.selectedStockPhotos.has(photoId)) {
            // Desselecionar
            this.selectedStockPhotos.delete(photoId);
            photoCard.classList.remove('selected-checkbox');
        } else {
            // Selecionar
            this.selectedStockPhotos.add(photoId);
            photoCard.classList.add('selected-checkbox');
        }

        this.updateSelectionCounter();
        console.log(`📋 Fotos selecionadas: ${this.selectedStockPhotos.size}`);
    }

    updateSelectionCounter() {
        const count = this.selectedStockPhotos.size;

        // Buscar elementos fixos no header
        const selectionCount = document.getElementById('selectionCount');
        const btnMoveSelected = document.getElementById('btnMoveSelected');
        const btnClearSelection = document.getElementById('btnClearSelection');
        const selectionCounter = document.querySelector('.selection-counter');

        // Atualizar contador
        if (selectionCount) selectionCount.textContent = count;

        if (count > 0) {
            // Ativar controles
            selectionCounter?.classList.add('active');
            btnMoveSelected?.removeAttribute('disabled');
            btnClearSelection?.removeAttribute('disabled');

            console.log(`📊 ${count} photos selected - controls enabled`);
        } else {
            // Desativar controles
            selectionCounter?.classList.remove('active');
            btnMoveSelected?.setAttribute('disabled', 'true');
            btnClearSelection?.setAttribute('disabled', 'true');

            console.log(`📊 No photos selected - controls disabled`);
        }

        // Atualizar botão Select All
        this.updateSelectAllButton();
    }

    clearAllSelections() {
        // Limpar checkboxes
        this.selectedStockPhotos.forEach(photoId => {
            const checkbox = document.getElementById(`photo_${photoId}`);
            const photoCard = checkbox?.closest('.photo-card');

            if (checkbox) checkbox.checked = false;
            if (photoCard) photoCard.classList.remove('selected-checkbox');
        });

        // Limpar Set
        this.selectedStockPhotos.clear();
        this.updateSelectionCounter();

        console.log('🧹 Seleção limpa');
    }

    selectAllVisiblePhotos() {
        // Verificar se estamos vendo fotos (não categorias)
        if (this.stockPhotosElement.style.display === 'none') {
            console.warn('📋 Não há fotos visíveis para selecionar');
            return;
        }

        // Pegar todas as fotos visíveis que NÃO foram movidas
        const visiblePhotos = this.stockPhotosElement.querySelectorAll('.photo-card:not(.photo-moved)');

        // Se já tem todas selecionadas, desselecionar todas
        if (this.selectedStockPhotos.size === visiblePhotos.length) {
            // Desselecionar todas
            this.clearAllSelections();
            console.log('📋 Todas as fotos desmarcadas');
        } else {
            // Selecionar todas
            visiblePhotos.forEach(photoCard => {
                const photoId = photoCard.dataset.photoId;
                if (photoId && !this.selectedStockPhotos.has(photoId)) {
                    this.selectedStockPhotos.add(photoId);

                    // Marcar checkbox
                    const checkbox = document.getElementById(`photo_${photoId}`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }

                    // Adicionar classe visual
                    photoCard.classList.add('selected-checkbox');
                }
            });

            console.log(`📋 ${visiblePhotos.length} fotos selecionadas`);
        }

        // Atualizar contador
        this.updateSelectionCounter();

        // Atualizar texto do botão
        this.updateSelectAllButton();
    }

    updateSelectAllButton() {
        const btnSelectAll = document.getElementById('btnSelectAll');
        if (!btnSelectAll) return;

        const visiblePhotos = this.stockPhotosElement.querySelectorAll('.photo-card:not(.photo-moved)');

        if (this.selectedStockPhotos.size === visiblePhotos.length && visiblePhotos.length > 0) {
            // Todas selecionadas - mudar visual
            btnSelectAll.innerHTML = 'None';
            btnSelectAll.title = 'Deselect All';
            btnSelectAll.classList.remove('btn-outline');
            btnSelectAll.classList.add('btn-primary');
        } else {
            // Não todas selecionadas
            btnSelectAll.innerHTML = 'All';
            btnSelectAll.title = 'Select All Photos';
            btnSelectAll.classList.remove('btn-primary');
            btnSelectAll.classList.add('btn-outline');
        }
    }

    showMoveSelectedModal() {
        const count = this.selectedStockPhotos.size;

        if (count === 0) {
            alert('Please select photos first');
            return;
        }

        console.log(`🚀 Abrindo modal para ${count} fotos selecionadas`);

        // Abrir modal - MÉTODO CORRETO
        const modal = document.getElementById('massSelectionModal');
        modal.classList.add('active');  // ← CORRIGIDO

        // Popular modal com dados
        this.populateMassSelectionModal();

        // Configurar event listeners do modal
        this.setupMassSelectionModalEvents();
    }

    closeMassSelectionModal() {
        const modal = document.getElementById('massSelectionModal');
        modal.classList.remove('active');  // ← CORRIGIDO

        // Limpar dados do modal
        this.clearMassSelectionModal();

        console.log('❌ Modal de seleção em massa fechado');
    }

    async populateMassSelectionModal() {
        const count = this.selectedStockPhotos.size;

        // Atualizar contador
        const countElement = document.getElementById('massSelectionCount');
        countElement.textContent = count;

        // Popular categoria origem e buscar preço
        await this.populateSourceCategory();

        // Popular dropdown de categorias
        this.populateExistingCategoriesDropdown();

        // Resetar formulário
        this.resetMassSelectionForm();
    }

    async populateSourceCategory() {
        const sourcePath = document.getElementById('sourceCategoryPath');
        const sourcePrice = document.getElementById('sourceCategoryPrice');

        try {
            // Construir caminho completo
            const fullPath = this.buildFullCategoryPath();
            sourcePath.textContent = fullPath;

            // Buscar preço da categoria atual
            const categoryPrice = await this.getCurrentCategoryPrice();

            if (categoryPrice !== null) {
                sourcePrice.innerHTML = `Base price: <span style="color: var(--gold-primary); font-weight: 600;">$${categoryPrice.toFixed(2)}</span>`;

                // Pré-popular Custom Price com o preço base
                const customPriceInput = document.getElementById('customPriceGlobal');
                if (customPriceInput && !customPriceInput.value) {
                    customPriceInput.value = categoryPrice.toFixed(2);
                }
            } else {
                sourcePrice.innerHTML = `Base price: <span style="color: var(--text-muted);">Not defined</span>`;
            }

        } catch (error) {
            console.error('❌ Erro ao carregar dados da categoria origem:', error);
            sourcePath.textContent = 'Error loading category path';
            sourcePrice.innerHTML = `Base price: <span style="color: var(--danger);">Error</span>`;
        }
    }

    buildFullCategoryPath() {
        if (!this.navigationState.currentPath || this.navigationState.currentPath.length === 0) {
            return 'Stock';
        }

        // Construir caminho: Stock > Brazil Best Sellers > Best Value - Brindle...
        const pathParts = ['Stock', ...this.navigationState.currentPath.map(item => item.name)];
        return pathParts.join(' > ');
    }

    async getCurrentCategoryPrice() {
        try {
            // Debug: verificar estado da navegação
            console.log('🔍 Debug navigationState:', this.navigationState);
            console.log('🔍 Debug currentPath:', this.navigationState.currentPath);

            if (!this.navigationState.currentPath || this.navigationState.currentPath.length === 0) {
                console.log('⚠️ Nenhum caminho de navegação encontrado');
                return null;
            }

            // Usar último item do path (categoria final)
            const currentCategory = this.navigationState.currentPath[this.navigationState.currentPath.length - 1];
            console.log('🔍 Debug currentCategory:', currentCategory);

            if (!currentCategory || !currentCategory.name) {
                console.log('⚠️ Categoria atual não tem nome válido');
                return null;
            }

            const categoryName = currentCategory.name;
            console.log(`💰 Buscando preço para categoria: "${categoryName}"`);

            // Usar API existente do Price Management
            const response = await fetch(`/api/pricing/category-price?googleDriveId=${encodeURIComponent(this.navigationState.currentFolderId)}`, {
                headers: this.getAuthHeaders()
            });

            console.log('🌐 Response status:', response.status);

            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`⚠️ Categoria sem preço definido: ${categoryName}`);
                } else {
                    console.log(`❌ Erro HTTP ${response.status} ao buscar preço`);
                }
                return null;
            }

            const data = await response.json();
            console.log('📦 Response data DETALHADO:', JSON.stringify(data, null, 2));

            if (data.success && data.category && data.category.basePrice !== undefined) {
                console.log(`✅ Preço encontrado: $${data.category.basePrice} para ${categoryName}`);
                return parseFloat(data.category.basePrice);
            }

            console.log('⚠️ Response sem preço válido');
            return null;

        } catch (error) {
            console.error('❌ Erro ao buscar preço da categoria:', error);
            return null;
        }
    }

    populateSelectedPhotosGrid() {
        const grid = document.getElementById('selectedPhotosGrid');
        grid.innerHTML = '';

        // Converter Set para Array para facilitar manipulação
        const selectedPhotosArray = Array.from(this.selectedStockPhotos);

        selectedPhotosArray.forEach(photoId => {
            // Encontrar dados da foto no stockPhotosData
            const photoData = this.stockPhotosData.find(photo => photo.id === photoId);

            if (photoData) {
                const photoItem = document.createElement('div');
                photoItem.className = 'selected-photo-item';
                photoItem.innerHTML = `
                <img src="${photoData.thumbnailLink || photoData.webViewLink}" 
                     alt="${photoData.name}" 
                     loading="lazy">
                <div class="photo-overlay">
                    ${photoData.name}
                </div>
            `;

                grid.appendChild(photoItem);
            }
        });

        console.log(`📸 ${selectedPhotosArray.length} fotos populadas no grid`);
    }

    populateExistingCategoriesDropdown() {
        const select = document.getElementById('existingCategoriesSelect');

        // Limpar opções existentes (manter apenas a primeira)
        select.innerHTML = '<option value="">Select a category...</option>';

        // Adicionar categorias customizadas existentes
        this.customCategories.forEach((category, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${category.name} (${category.photos.length} photos)`;
            select.appendChild(option);
        });

        // NOVO: Event listener para atualizar preço quando selecionar categoria
        select.addEventListener('change', (e) => {
            this.updateExistingCategoryPrice(e.target.value);
            this.updateMoveButtonState();
        });

        console.log(`📁 ${this.customCategories.length} categorias populadas no dropdown`);
    }

    updateExistingCategoryPrice(categoryIndex) {
        const fromPriceSpan = document.getElementById('fromPrice');
        const toPriceSpan = document.getElementById('toPrice');
        const priceInfoDiv = document.getElementById('existingCategoryPriceInfo');

        if (categoryIndex === '' || categoryIndex === null) {
            // Ocultar info quando nenhuma categoria selecionada
            if (priceInfoDiv) priceInfoDiv.style.display = 'none';
            return;
        }

        try {
            const selectedCategory = this.customCategories[parseInt(categoryIndex)];

            // Pegar base price da categoria origem
            const basePriceElement = document.querySelector('#sourceCategoryPrice span');
            let basePrice = 0;
            if (basePriceElement) {
                const basePriceText = basePriceElement.textContent;
                basePrice = parseFloat(basePriceText.replace('$', '')) || 0;
            }

            if (selectedCategory && selectedCategory.customPrice) {
                const currentPrice = selectedCategory.customPrice;

                // Mostrar informações
                if (fromPriceSpan) fromPriceSpan.textContent = `$${basePrice.toFixed(2)}`;
                if (toPriceSpan) toPriceSpan.textContent = `$${currentPrice.toFixed(2)}`;
                if (priceInfoDiv) priceInfoDiv.style.display = 'block';

                console.log(`💰 Categoria "${selectedCategory.name}" - Base: $${basePrice} → Custom: $${currentPrice}`);
            }
        } catch (error) {
            console.error('❌ Erro ao buscar preço da categoria:', error);
            if (priceInfoDiv) priceInfoDiv.style.display = 'none';
        }
    }

    resetMassSelectionForm() {
        const existingRadio = document.querySelector('input[name="destination"][value="existing"]');
        const newRadio = document.querySelector('input[name="destination"][value="new"]');

        if (existingRadio) existingRadio.checked = true;
        if (newRadio) newRadio.checked = false;

        // Limpar todos os campos
        const existingSelect = document.getElementById('existingCategoriesSelect');
        const existingPriceInput = document.getElementById('existingCategoryCustomPrice');
        const newNameInput = document.getElementById('newCategoryName');
        const newPriceInput = document.getElementById('newCategoryCustomPrice');
        const notesInput = document.getElementById('priceAdjustmentNotes');

        if (existingSelect) existingSelect.value = '';
        if (existingPriceInput) existingPriceInput.value = '';
        if (newNameInput) newNameInput.value = '';
        if (newPriceInput) newPriceInput.value = '';
        if (notesInput) notesInput.value = '';

        this.updateDestinationInputsState();
        this.updateMoveButtonState();
    }

    updateDestinationInputsState() {
        const existingRadio = document.querySelector('input[name="destination"][value="existing"]');
        const newRadio = document.querySelector('input[name="destination"][value="new"]');

        const existingSelect = document.getElementById('existingCategoriesSelect');
        const existingPriceInput = document.getElementById('existingCategoryCustomPrice');
        const newNameInput = document.getElementById('newCategoryName');
        const newPriceInput = document.getElementById('newCategoryCustomPrice');

        if (existingRadio && existingRadio.checked) {
            // Habilitar Existing Category
            if (existingSelect) existingSelect.disabled = false;

            // Desabilitar Create New
            if (newNameInput) newNameInput.disabled = true;
            if (newPriceInput) newPriceInput.disabled = true;
        } else if (newRadio && newRadio.checked) {
            // Desabilitar Existing Category
            if (existingSelect) existingSelect.disabled = true;

            // Habilitar Create New
            if (newNameInput) newNameInput.disabled = false;
            if (newPriceInput) newPriceInput.disabled = false;
        }

        this.updateMoveButtonState();
    }

    updateMoveButtonState() {
        const existingRadio = document.querySelector('input[name="destination"][value="existing"]');
        const existingSelect = document.getElementById('existingCategoriesSelect');
        const newRadio = document.querySelector('input[name="destination"][value="new"]');
        const newNameInput = document.getElementById('newCategoryName');
        const moveButton = document.getElementById('btnExecuteMassMovement');

        let canMove = false;

        if (existingRadio.checked) {
            // Categoria existente selecionada
            canMove = existingSelect.value !== '';
        } else if (newRadio.checked) {
            // Nova categoria com nome preenchido
            canMove = newNameInput.value.trim() !== '';
        }

        moveButton.disabled = !canMove;

        // Atualizar texto do botão
        const buttonText = document.getElementById('moveButtonText');
        const count = this.selectedStockPhotos.size;

        if (canMove) {
            buttonText.textContent = `Move ${count} Photo${count > 1 ? 's' : ''}`;
            moveButton.style.opacity = '1';
        } else {
            buttonText.textContent = 'Select Destination First';
            moveButton.style.opacity = '0.6';
        }
    }

    setupMassSelectionModalEvents() {
        // ✅ NOVO: Remover listeners antigos PRIMEIRO
        this.removeMassSelectionModalEvents();

        // Radio buttons para alternar entre categorias existentes/nova
        const radioButtons = document.querySelectorAll('input[name="destination"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', () => this.updateDestinationInputsState());
        });

        // Dropdown de categorias existentes
        const existingSelect = document.getElementById('existingCategoriesSelect');
        existingSelect.addEventListener('change', () => this.updateMoveButtonState());

        // Input de nova categoria
        const newNameInput = document.getElementById('newCategoryName');
        newNameInput.addEventListener('input', () => this.updateMoveButtonState());

        // Botão de executar movimentação
        const moveButton = document.getElementById('btnExecuteMassMovement');
        moveButton.addEventListener('click', () => this.executeMassMovement());

        console.log('🔧 Event listeners do modal configurados');
    }

    // ✅ NOVA FUNÇÃO: Remover listeners
    removeMassSelectionModalEvents() {
        const moveButton = document.getElementById('btnExecuteMassMovement');
        if (moveButton) {
            // Clona o botão para remover TODOS os listeners
            const newButton = moveButton.cloneNode(true);
            moveButton.parentNode.replaceChild(newButton, moveButton);
        }
    }

    clearMassSelectionModal() {
        // Limpar grid de fotos (REMOVIDO - não existe mais)
        // const grid = document.getElementById('selectedPhotosGrid');
        // grid.innerHTML = '';

        // Esconder progress bar
        const progressBar = document.getElementById('massMovementProgress');
        if (progressBar) progressBar.style.display = 'none';

        // Resetar progress
        const progressFill = document.getElementById('progressFill');
        if (progressFill) progressFill.style.width = '0%';
    }

    async executeMassMovement() {
        // Mostrar loading
        const moveButton = document.getElementById('btnExecuteMassMovement');
        const originalText = moveButton.innerHTML;
        moveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        moveButton.disabled = true;

        const existingRadio = document.querySelector('input[name="destination"][value="existing"]');
        const existingSelect = document.getElementById('existingCategoriesSelect');
        const newNameInput = document.getElementById('newCategoryName');
        const newPriceInput = document.getElementById('newCategoryCustomPrice');

        let targetCategory;
        let targetCategoryIndex;

        try {
            // Determinar categoria de destino
            if (existingRadio.checked) {
                // Categoria existente
                targetCategoryIndex = parseInt(existingSelect.value);
                targetCategory = this.customCategories[targetCategoryIndex];

                if (!targetCategory) {
                    throw new Error('Categoria selecionada não encontrada');
                }
            } else {
                // Nova categoria
                const categoryName = newNameInput.value.trim();
                const categoryPrice = parseFloat(newPriceInput.value) || 0;

                if (!categoryName) {
                    throw new Error('Nome da categoria é obrigatório');
                }

                // Criar nova categoria
                targetCategory = {
                    name: categoryName,
                    customPrice: categoryPrice,
                    photos: []
                };

                this.customCategories.push(targetCategory);
                targetCategoryIndex = this.customCategories.length - 1;
            }

            console.log(`🎯 Movendo para categoria: ${targetCategory.name}`);

            // Executar movimentação
            await this.performMassMovement(targetCategory, targetCategoryIndex);

        } catch (error) {
            console.error('❌ Erro na movimentação em massa:', error);
            alert(`Error: ${error.message}`);
        } finally {
            // Restaurar botão
            const moveButton = document.getElementById('btnExecuteMassMovement');
            const originalText = '<i class="fas fa-arrow-right"></i> <span id="moveButtonText">Move Photos</span>';
            moveButton.innerHTML = originalText;
            moveButton.disabled = false;
        }
    }

    async performMassMovement(targetCategory, targetCategoryIndex) {
        console.log('🚨 DEBUG: performMassMovement EXECUTANDO - INÍCIO');
        console.log('🚨 DEBUG: targetCategory:', targetCategory.name);

        const selectedPhotosArray = Array.from(this.selectedStockPhotos);
        const totalPhotos = selectedPhotosArray.length;

        // REMOVER: Progress bar (elementos não existem no HTML)
        console.log(`📋 Processando ${totalPhotos} fotos...`);

        let processedCount = 0;

        // Processar cada foto (mantém lógica existente)
        for (const photoId of selectedPhotosArray) {
            try {
                const photoData = this.stockPhotosData.find(photo => photo.id === photoId);

                if (photoData) {
                    const existingPhoto = targetCategory.photos.find(p => p.id === photoId);

                    if (!existingPhoto) {
                        // Enriquecer foto com dados adicionais (igual ao drag/drop)
                        // Pegar base price UMA VEZ só, não para cada foto
                        const basePrice = await this.getCurrentCategoryBasePrice();
                        const sourceCategory = this.getCurrentCategoryName();
                        const sourcePath = this.getCurrentCategoryPath();

                        // Depois no loop:
                        const enrichedPhoto = {
                            ...photoData,
                            originalPrice: basePrice,
                            sourceCategory: sourceCategory,
                            sourcePath: sourcePath
                        };

                        targetCategory.photos.push(enrichedPhoto);
                        this.selectedPhotos.push(enrichedPhoto);
                        console.log(`✅ Foto ${photoData.name} movida para ${targetCategory.name}`);
                    } else {
                        console.log(`⚠️ Foto ${photoData.name} já existe na categoria`);
                    }
                }

                processedCount++;
                console.log(`📊 Progresso: ${processedCount}/${totalPhotos}`);

            } catch (error) {
                console.error(`❌ Erro ao mover foto ${photoId}:`, error);
            }
        }

        // Finalizar movimentação
        this.finalizeMassMovement(totalPhotos, targetCategory.name);
    }

    finalizeMassMovement(totalPhotos, categoryName) {
        // Limpar seleção
        this.selectedStockPhotos.clear();

        // Forçar reset do contador
        this.updateSelectionCounter();

        // Atualizar interfaces
        this.renderCustomCategories();
        this.renderStockPhotos();
        this.updateCounts();

        // Fechar modal PRIMEIRO
        this.closeMassSelectionModal();

        console.log(`✅ ${totalPhotos} photos moved to "${categoryName}"`);

        console.log(`🎉 Movimentação em massa concluída: ${totalPhotos} fotos para ${categoryName}`);
    }

    // ===== NAVEGAÇÃO HIERÁRQUICA (ADAPTADO DO CLIENT.JS) =====
    async navigateToCategory(folderId, categoryName) {
        console.log(`📂 Navegando para categoria: ${categoryName} (${folderId})`);

        // Atualizar estado de navegação
        this.navigationState.currentPath = [{ id: folderId, name: categoryName }];
        this.navigationState.currentFolderId = folderId;

        this.updateBreadcrumb();
        await this.loadFolderContents(folderId);
    }

    async loadFolderContents(folderId) {
        try {
            this.showLoading(true);
            console.log(`📁 Carregando conteúdo da pasta: ${folderId}`);
            // CACHE: Verificar estrutura da pasta
            const cacheKey = `folder_structure_${folderId}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const cacheData = JSON.parse(cached);
                if (cacheData.expires > Date.now()) {
                    console.log('🗂️ CACHE HIT - Estrutura instantânea!');
                    const folderData = cacheData.structure;

                    // Usar mesma lógica de processamento
                    if (folderData.hasSubfolders && folderData.folders.length > 0) {
                        this.showSubfolders(folderData.folders);
                    } else if (folderData.hasImages || folderData.totalImages > 0) {
                        await this.loadStockPhotos(folderId);
                    } else {
                        this.showEmptyFolder();
                    }
                    console.log('✅ Estrutura carregada do cache');
                    return; // Pular API
                }
            }

            // Usar mesma API que client.js
            const response = await fetch(`/api/gallery/structure?prefix=${encodeURIComponent(folderId)}`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Erro ao carregar pasta');
            }

            const folderData = data.structure;

            // CACHE: Salvar estrutura para próxima vez
            const cacheData = {
                structure: folderData,
                expires: Date.now() + (15 * 60 * 1000) // 15 minutos
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));

            // LÓGICA INTELIGENTE (igual client.js)
            if (folderData.hasSubfolders && folderData.folders.length > 0) {
                // Mostrar subpastas (navegação mais profunda)
                this.showSubfolders(folderData.folders);
            } else if (folderData.hasImages || folderData.totalImages > 0) {
                // Mostrar fotos (chegou no final da hierarquia)
                await this.loadStockPhotos(folderId);
            } else {
                // Pasta vazia
                this.showEmptyFolder();
            }

        } catch (error) {
            console.error('❌ Erro ao carregar conteúdo da pasta:', error);
            this.showError('Erro ao carregar conteúdo da pasta');
        } finally {
            this.showLoading(false);
        }
    }

    showSubfolders(folders) {
        console.log(`📁 Mostrando ${folders.length} subpastas`);
        const html = folders.map(folder => `
            <div class="category-item" data-folder-id="${folder.id}" data-category-name="${folder.name}">
                <div class="category-icon">
                    <i class="fas fa-${folder.hasImages ? 'images' : 'folder'}"></i>
                </div>
                <div class="category-name">${folder.name}</div>
                <div class="category-stats">
                    ${(folder.imageCount > 0 && !folder.totalSubfolders) ? `${folder.imageCount} photos` : ''}
                </div>
            </div>
        `).join('');
        this.stockCategoriesElement.innerHTML = html;

        // Event listeners para navegação mais profunda
        this.stockCategoriesElement.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', () => {
                const folderId = item.dataset.folderId;
                const categoryName = item.dataset.categoryName;
                this.navigateToSubfolder(folderId, categoryName);
            });
        });

        // Mostrar categorias, esconder fotos
        this.stockCategoriesElement.style.display = 'block';
        this.stockPhotosElement.style.display = 'none';

        // ✅ DESLIGAR LOADING
        this.showLoading(false);
    }

    async navigateToSubfolder(folderId, folderName) {
        console.log(`📂 Navegando para subpasta: ${folderName} (${folderId})`);

        // Adicionar ao caminho de navegação
        this.navigationState.currentPath.push({ id: folderId, name: folderName });
        this.navigationState.currentFolderId = folderId;

        this.updateBreadcrumb();
        await this.loadFolderContents(folderId);  // ← Recursivo!
    }

    showEmptyFolder() {
        this.stockCategoriesElement.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
            <i class="fas fa-folder-open" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
            <p>Pasta vazia</p>
        </div>
    `;
        this.stockCategoriesElement.style.display = 'block';
        this.stockPhotosElement.style.display = 'none';

        // ✅ DESLIGAR LOADING
        this.showLoading(false);
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

    updateBreadcrumb() {
        if (!this.navigationState.currentPath || this.navigationState.currentPath.length === 0) {
            this.resetBreadcrumb();
            return;
        }

        const breadcrumbHtml = `
        <span class="breadcrumb-item" onclick="specialSelectionBuilder.navigateToFolder('root')">
            <i class="fas fa-home"></i> Stock
        </span>
        ${this.navigationState.currentPath.map((item, index) => {
            const isLast = index === this.navigationState.currentPath.length - 1;
            return `
                <span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>
                ${isLast ?
                    `<span class="breadcrumb-item active">${item.name}</span>` :
                    `<button class="breadcrumb-item" onclick="specialSelectionBuilder.navigateToBreadcrumb(${index})">${item.name}</button>`
                }
            `;
        }).join('')}
    `;

        this.stockBreadcrumb.innerHTML = breadcrumbHtml;
    }

    async navigateToBreadcrumb(index) {
        console.log(`🧭 Navegando via breadcrumb para índice: ${index}`);

        // Cortar caminho até o índice selecionado
        this.navigationState.currentPath = this.navigationState.currentPath.slice(0, index + 1);
        const target = this.navigationState.currentPath[index];
        this.navigationState.currentFolderId = target.id;

        this.updateBreadcrumb();
        await this.loadFolderContents(target.id);
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
        // ✅ DEBUG LOG
        console.log(`🔥 DEBUG setupPhotoDragDrop: selectedStockPhotos.size = ${this.selectedStockPhotos.size}`);

        const photoCards = this.stockPhotosElement.querySelectorAll('.photo-card');

        photoCards.forEach(card => {
            // Drag start
            card.addEventListener('dragstart', async (e) => {
                // Verificar se há seleção múltipla
                if (this.selectedStockPhotos.size > 0 && this.selectedStockPhotos.has(card.dataset.photoId)) {
                    // ARRASTAR TODAS AS SELECIONADAS
                    this.draggedPhotos = [];

                    for (const photoId of this.selectedStockPhotos) {
                        const photoCard = document.querySelector(`[data-photo-id="${photoId}"]`);
                        if (photoCard) {
                            this.draggedPhotos.push({
                                id: photoId,
                                name: photoCard.dataset.photoName,
                                url: photoCard.dataset.photoUrl,
                                thumbnailLink: photoCard.querySelector('.photo-image').src,
                                originalPrice: await this.getCurrentCategoryBasePrice(),
                                sourceCategory: this.getCurrentCategoryName(),
                                sourcePath: this.getCurrentCategoryPath()
                            });
                            photoCard.classList.add('dragging');
                        }
                    }

                    // Mostrar contador
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('text/plain', `Moving ${this.draggedPhotos.length} photos`);
                    console.log(`🎯 Arrastando ${this.draggedPhotos.length} fotos selecionadas`);

                } else {
                    // ARRASTAR SÓ UMA (comportamento original)
                    this.draggedPhotos = [{
                        id: card.dataset.photoId,
                        name: card.dataset.photoName,
                        url: card.dataset.photoUrl,
                        thumbnailLink: card.querySelector('.photo-image').src,
                        originalPrice: await this.getCurrentCategoryBasePrice(),
                        sourceCategory: this.getCurrentCategoryName(),
                        sourcePath: this.getCurrentCategoryPath()
                    }];
                    card.classList.add('dragging');
                    console.log('🎯 Arrastando 1 foto individual');
                }

                // Manter compatibilidade
                this.draggedPhoto = this.draggedPhotos[0];
            });

            // Drag end
            card.addEventListener('dragend', (e) => {
                // Remover classe de todas as fotos arrastadas
                if (this.draggedPhotos && this.draggedPhotos.length > 0) {
                    this.draggedPhotos.forEach(photo => {
                        const photoCard = document.querySelector(`[data-photo-id="${photo.id}"]`);
                        if (photoCard) {
                            photoCard.classList.remove('dragging');
                        }
                    });
                }

                this.draggedPhoto = null;
                this.draggedPhotos = [];
                console.log('🎯 Drag finalizado');
            });

            // Click action (fallback para mobile)
            card.addEventListener('click', (e) => {
                const actionBtn = e.target.closest('.photo-action-btn');
                if (actionBtn) {
                    const action = actionBtn.dataset.action;
                    if (action === 'preview') {
                        // Encontrar índice da foto na lista atual
                        const photoId = card.dataset.photoId;
                        const photoIndex = this.stockPhotosData.findIndex(p => p.id === photoId);
                        if (photoIndex !== -1) {
                            this.previewPhoto(photoIndex);
                        }
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

        // ✅ NOVO: Área expandida de drop
        const categoryContents = this.customCategoriesContainer.querySelectorAll('.custom-category-content');
        categoryContents.forEach(content => {
            this.setupExpandedDropZone(content);
        });

        // 🔥 CORREÇÃO CRÍTICA: Event listeners específicos e limpos

        // 1. Headers clicáveis (expand/collapse)
        this.customCategoriesContainer.querySelectorAll('[data-header-index]').forEach(header => {
            header.addEventListener('click', (e) => {
                // Verificar se o clique foi em um botão de ação
                if (e.target.closest('.category-action-btn')) {
                    return; // Não expandir/colapsar se clicou em botão
                }

                const index = parseInt(header.dataset.headerIndex);
                this.toggleCategory(index);
            });
        });

        // 2. Botões de chevron (expand/collapse alternativo)
        this.customCategoriesContainer.querySelectorAll('[data-chevron-index]').forEach(chevron => {
            chevron.addEventListener('click', (e) => {
                e.stopPropagation(); // Evitar duplo trigger
                const index = parseInt(chevron.dataset.chevronIndex);
                this.toggleCategory(index);
            });
        });

        // 3. Botões de ação das categorias
        this.customCategoriesContainer.querySelectorAll('[data-action]').forEach(actionBtn => {
            actionBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Evitar propagação para o header

                const action = actionBtn.dataset.action;
                const index = parseInt(actionBtn.dataset.index || actionBtn.dataset.categoryIndex);
                const photoId = actionBtn.dataset.photoId;

                console.log(`🎯 Ação executada: ${action}, index: ${index}, photoId: ${photoId}`);

                // Executar ação sem debounce complexo
                switch (action) {
                    case 'info':
                        this.showPhotoInfo(photoId, index);
                        break;
                    case 'edit-category':
                        this.editCustomCategory(index);
                        break;
                    case 'delete-category':
                        this.showDeleteCategoryModal(index);
                        break;
                    case 'remove':
                        this.removePhotoFromCategory(photoId, index);
                        break;
                    case 'preview':
                        // Implementar preview se necessário
                        break;
                    default:
                        console.warn(`Ação desconhecida: ${action}`);
                }
            });
        });

        console.log('🔗 Event listeners das categorias customizadas configurados corretamente');
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

    setupExpandedDropZone(categoryContent) {
        const categoryIndex = parseInt(categoryContent.closest('.custom-category').dataset.categoryIndex);

        categoryContent.addEventListener('dragover', (e) => {
            e.preventDefault();
            categoryContent.classList.add('category-drag-over');
        });

        categoryContent.addEventListener('dragleave', (e) => {
            e.preventDefault();
            // Só remove se saiu completamente da categoria
            if (!categoryContent.contains(e.relatedTarget)) {
                categoryContent.classList.remove('category-drag-over');
            }
        });

        categoryContent.addEventListener('drop', (e) => {
            e.preventDefault();
            categoryContent.classList.remove('category-drag-over');
            this.handlePhotoDrop(e, categoryIndex);
        });
    }

    handlePhotoDrop(e, categoryIndex) {
        if (!this.draggedPhotos || this.draggedPhotos.length === 0) {
            console.warn('⚠️ Nenhuma foto sendo arrastada');
            return;
        }

        console.log(`📸 Drop de ${this.draggedPhotos.length} fotos na categoria ${categoryIndex}`);

        if (categoryIndex === 'new-category') {
            // SEMPRE USAR O MODAL LUXURY
            if (this.draggedPhotos.length === 1) {
                // Uma foto - comportamento existente
                this.createCategoryWithPhoto(this.draggedPhotos[0]);
            } else {
                // MÚLTIPLAS FOTOS - USAR MODAL LUXURY TAMBÉM!
                this.pendingPhotosForNewCategory = this.draggedPhotos; // Guardar todas as fotos

                // Abrir modal luxury
                const modal = document.getElementById('addCategoryModalLuxury');
                modal.classList.add('active');

                // Atualizar título do modal para mostrar quantidade
                const modalTitle = modal.querySelector('.special-modal-title');
                if (modalTitle) {
                    modalTitle.innerHTML = `<i class="fas fa-plus"></i> Add New Category (${this.draggedPhotos.length} photos)`;
                }

                // Pré-preencher preço base se disponível
                const priceInput = document.getElementById('luxuryPriceInput');
                if (priceInput && this.draggedPhotos[0].originalPrice) {
                    priceInput.value = this.draggedPhotos[0].originalPrice || '99.00';
                }

                // Focar no nome
                setTimeout(() => {
                    const nameInput = document.getElementById('luxuryNameInput');
                    if (nameInput) {
                        nameInput.focus();
                        nameInput.select();
                    }
                }, 100);
            }
        } else {
            // Adicionar múltiplas fotos à categoria existente
            this.draggedPhotos.forEach(photo => {
                const existingPhoto = this.customCategories[categoryIndex].photos.find(p => p.id === photo.id);
                if (!existingPhoto) {
                    this.customCategories[categoryIndex].photos.push(photo);
                    this.selectedPhotos.push(photo);
                }
            });

            // Limpar checkboxes após mover
            this.clearAllSelections();

            this.renderCustomCategories();
            this.renderStockPhotos();
            this.updateCounts();
        }

        this.draggedPhoto = null;
        this.draggedPhotos = [];
    }

    // ===== GERENCIAMENTO DE CATEGORIAS CUSTOMIZADAS =====
    createCategoryWithPhoto(photo) {
        // Armazenar foto(s) para usar após confirmação
        if (Array.isArray(photo)) {
            this.pendingPhotosForNewCategory = photo; // Array de fotos
        } else {
            this.pendingPhotoForNewCategory = photo; // Foto única (compatibilidade)
        }

        // Abrir modal luxury
        document.getElementById('addCategoryModalLuxury').classList.add('active');

        // Pré-preencher preço
        const priceToUse = Array.isArray(photo) ? photo[0].originalPrice : photo.originalPrice;
        document.getElementById('luxuryPriceInput').value = priceToUse || '99.00';

        // Focar no input de nome
        setTimeout(() => {
            document.getElementById('luxuryNameInput').focus();
            document.getElementById('luxuryNameInput').select();
        }, 100);
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
            this.renderStockPhotos();
            this.updateCounts();

            console.log(`✅ Foto adicionada à categoria ${this.customCategories[categoryIndex].name}`);
        }
    }

    removePhotoFromCategory(photoId, categoryIndex) {
        if (categoryIndex >= 0 && categoryIndex < this.customCategories.length) {
            this.customCategories[categoryIndex].photos = this.customCategories[categoryIndex].photos.filter(p => p.id !== photoId);
            this.selectedPhotos = this.selectedPhotos.filter(p => p.id !== photoId);
            this.renderCustomCategories(); // ← Re-renderiza DIREITA
            this.renderStockPhotos();      // ← NOVA LINHA: Re-renderiza ESQUERDA
            this.updateCounts();

            console.log(`✅ Foto removida da categoria`);
        }
    }

    deleteCustomCategory(categoryIndex) {
        console.log('🗑️ FUNÇÃO CHAMADA!');

        if (confirm('Delete this category? All photos will return to original folders.')) {
            const category = this.customCategories[categoryIndex];
            if (category) {
                // Remover fotos da seleção
                category.photos.forEach(photo => {
                    this.selectedPhotos = this.selectedPhotos.filter(p => p.id !== photo.id);
                });

                // Remover categoria
                this.customCategories.splice(categoryIndex, 1);

                // Re-renderizar
                this.renderCustomCategories();
                this.renderStockPhotos();
                this.updateCounts();

                console.log(`✅ Categoria deletada: ${category.name}`);
            }
        }
    }

    // NOVA FUNÇÃO: Mostrar modal de delete
    showDeleteCategoryModal(categoryIndex) {
        console.log('📋 Abrindo modal delete para categoria:', categoryIndex);

        const category = this.customCategories[categoryIndex];
        if (!category) {
            console.log('❌ Categoria não encontrada!');
            return;
        }

        console.log('📋 Categoria encontrada:', category.name);

        // Preencher dados do modal
        document.getElementById('deleteCategoryName').textContent = category.name;
        document.getElementById('deleteCategoryPhotoCount').textContent = category.photos.length;

        // Armazenar índice para usar na confirmação
        this.categoryToDelete = categoryIndex;

        // Mostrar modal
        document.getElementById('deleteCategoryModal').style.display = 'block';

        // Configurar botão de confirmação
        const confirmBtn = document.getElementById('btnConfirmDeleteCategory');
        confirmBtn.onclick = () => this.confirmDeleteCategory();
    }

    // NOVA FUNÇÃO: Fechar modal
    closeDeleteCategoryModal() {
        document.getElementById('deleteCategoryModal').style.display = 'none';
        this.categoryToDelete = null;
    }

    // NOVA FUNÇÃO: Confirmar delete
    confirmDeleteCategory() {
        if (this.categoryToDelete === null) return;

        const category = this.customCategories[this.categoryToDelete];
        if (category) {
            // Remover fotos da seleção
            category.photos.forEach(photo => {
                this.selectedPhotos = this.selectedPhotos.filter(p => p.id !== photo.id);
            });

            // Remover categoria
            this.customCategories.splice(this.categoryToDelete, 1);

            // Re-renderizar AMBOS os lados
            this.renderCustomCategories();
            this.renderStockPhotos(); // ← NOVO: Atualizar visual das fotos
            this.updateCounts();

            console.log(`✅ Categoria deletada: ${category.name}`);
        }

        // Fechar modal
        this.closeDeleteCategoryModal();
    }

    // ===== MODAL LUXURY - TESTE =====
    showAddCategoryModalLuxury() {
        document.getElementById('addCategoryModalLuxury').classList.add('active');

        // Focar no input
        setTimeout(() => {
            document.getElementById('luxuryNameInput').focus();
            document.getElementById('luxuryNameInput').select();
        }, 100);
    }

    // Toggle Rate Rules Section
    toggleRateRules(show) {
        const section = document.getElementById('rateRulesSection');
        const priceInput = document.getElementById('luxuryPriceInput');

        if (show) {
            section.style.display = 'block';
            // Preencher primeiro rate com o preço base
            const firstPriceInput = section.querySelector('.rate-price');
            if (firstPriceInput && priceInput.value) {
                firstPriceInput.value = priceInput.value;
            }
        } else {
            section.style.display = 'none';
        }
    }

    // Add new rate rule
    addRateRule() {
        const rulesList = document.getElementById('rateRulesList');
        const lastRule = rulesList.lastElementChild;
        const lastTo = lastRule ? parseInt(lastRule.querySelector('.rate-to').value) : 0;

        const newRule = document.createElement('div');
        newRule.className = 'rate-rule-item';
        newRule.innerHTML = `
            <span>From</span>
            <input type="number" class="rate-from" value="${lastTo + 1}" min="1" readonly>
            <span>to</span>
            <input type="number" class="rate-to" value="${lastTo + 10}" min="${lastTo + 2}">
            <span>→ $</span>
            <input type="number" class="rate-price" step="0.01" placeholder="0.00">
            <span class="rate-remove" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </span>
        `;

        rulesList.appendChild(newRule);
    }

    // Get rate rules from modal
    getRateRules() {
        const pricingType = document.querySelector('input[name="pricingType"]:checked').value;

        if (pricingType === 'fixed') {
            return null; // Sem rate rules
        }

        const rules = [];
        const ruleItems = document.querySelectorAll('.rate-rule-item');

        ruleItems.forEach(item => {
            const from = parseInt(item.querySelector('.rate-from').value);
            const to = parseInt(item.querySelector('.rate-to').value) || null;
            const price = parseFloat(item.querySelector('.rate-price').value);

            if (price > 0) {
                rules.push({ from, to, price });
            }
        });

        return rules.length > 0 ? rules : null;
    }

    confirmAddCategoryLuxury() {
        const categoryName = document.getElementById('luxuryNameInput').value.trim();
        if (!categoryName) {
            alert('Please enter a category name');
            return;
        }

        const customPrice = parseFloat(document.getElementById('luxuryPriceInput').value) || null;

        const newCategory = {
            categoryId: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            name: categoryName,
            customPrice: customPrice,
            rateRules: this.getRateRules(), // ← ADICIONAR ESTA LINHA
            photos: []
        };

        console.log('📤 Categoria criada no frontend:', JSON.stringify(newCategory, null, 2));

        // Adicionar foto(s) pendente(s)
        if (this.pendingPhotosForNewCategory) {
            // Múltiplas fotos
            newCategory.photos = this.pendingPhotosForNewCategory;
            this.selectedPhotos.push(...this.pendingPhotosForNewCategory);
            this.pendingPhotosForNewCategory = null;
            // Limpar seleção de checkboxes
            this.clearAllSelections();

            // Limpar seleção
            this.clearAllSelections();

        } else if (this.pendingPhotoForNewCategory) {
            // Uma foto (compatibilidade)
            newCategory.photos.push(this.pendingPhotoForNewCategory);
            this.selectedPhotos.push(this.pendingPhotoForNewCategory);
            this.pendingPhotoForNewCategory = null;
        }

        this.customCategories.push(newCategory);
        this.renderCustomCategories();
        this.renderStockPhotos();
        this.updateCounts();

        console.log('✅ Nova categoria luxury criada:', newCategory);

        // Fechar modal e resetar
        document.getElementById('addCategoryModalLuxury').classList.remove('active');
        document.getElementById('luxuryNameInput').value = 'Custom Category';
        document.getElementById('luxuryPriceInput').value = '99.00';

        // Resetar título do modal
        const modalTitle = document.querySelector('#addCategoryModalLuxury .special-modal-title');
        if (modalTitle) {
            modalTitle.innerHTML = '<i class="fas fa-plus"></i> Add New Category';
        }
    }

    cancelLuxuryModal() {
        // Limpar classe dragging de TODAS as fotos
        document.querySelectorAll('.photo-card.dragging').forEach(card => {
            card.classList.remove('dragging');
        });

        // ADICIONAR: Limpar checkboxes também
        this.clearAllSelections();

        // Limpar dados pendentes
        this.draggedPhoto = null;
        this.draggedPhotos = [];
        this.pendingPhotoForNewCategory = null;
        this.pendingPhotosForNewCategory = null;

        // Fechar modal
        document.getElementById('addCategoryModalLuxury').classList.remove('active');

        // Resetar campos
        document.getElementById('luxuryNameInput').value = 'Custom Category';
        document.getElementById('luxuryPriceInput').value = '99.00';

        // Resetar título se tiver sido modificado
        const modalTitle = document.querySelector('#addCategoryModalLuxury .special-modal-title');
        if (modalTitle) {
            modalTitle.innerHTML = '<i class="fas fa-plus"></i> Add New Category';
        }

        console.log('❌ Modal cancelado - fotos destorcidas');
    }

    editCustomCategory(categoryIndex) {
        // Abrir modal ao invés de prompt
        this.showRenameCategoryModal(categoryIndex);
    }

    // NOVA FUNÇÃO: Mostrar modal de edição
    showRenameCategoryModal(categoryIndex) {
        const category = this.customCategories[categoryIndex];
        if (!category) return;

        // Preencher dados atuais
        document.getElementById('currentCategoryName').textContent = category.name;
        document.getElementById('newCategoryNameInput').value = category.name;

        document.getElementById('currentCategoryPrice').textContent = `$${category.customPrice || '0.00'}`;
        document.getElementById('newCategoryPriceInput').value = category.customPrice || '';

        // Armazenar índice para usar na confirmação
        this.categoryToRename = categoryIndex;

        // Mostrar modal e focar no input
        document.getElementById('renameCategoryModal').style.display = 'block';
        setTimeout(() => {
            document.getElementById('newCategoryNameInput').focus();
            document.getElementById('newCategoryNameInput').select();
        }, 100);
    }

    // NOVA FUNÇÃO: Fechar modal
    closeRenameCategoryModal() {
        document.getElementById('renameCategoryModal').style.display = 'none';
        this.categoryToRename = null;
    }

    // NOVA FUNÇÃO: Confirmar edição
    confirmRenameCategory() {
        if (this.categoryToRename === null) return;

        const newName = document.getElementById('newCategoryNameInput').value.trim();
        const newPrice = document.getElementById('newCategoryPriceInput').value.trim();

        if (!newName) {
            alert('Category name cannot be empty!');
            return;
        }

        const category = this.customCategories[this.categoryToRename];
        if (category) {
            // Atualizar nome
            category.name = newName;

            // Atualizar preço (se fornecido)
            if (newPrice && !isNaN(parseFloat(newPrice))) {
                category.customPrice = parseFloat(newPrice);
            } else if (newPrice === '') {
                category.customPrice = null; // Remove preço customizado
            }

            // Re-renderizar
            this.renderCustomCategories();
            console.log(`✅ Categoria editada: "${newName}" - Preço: $${category.customPrice || '0.00'}`);
        }

        // Fechar modal
        this.closeRenameCategoryModal();
    }

    // NOVA FUNÇÃO: Obter nome da categoria atual
    getCurrentCategoryName() {
        if (!this.navigationState.currentPath || this.navigationState.currentPath.length === 0) {
            return 'Stock';
        }
        return this.navigationState.currentPath[this.navigationState.currentPath.length - 1].name;
    }

    // NOVA FUNÇÃO: Obter caminho completo
    getCurrentCategoryPath() {
        if (!this.navigationState.currentPath) return 'Stock';
        return this.navigationState.currentPath.map(item => item.name).join(' > ');
    }

    // NOVA FUNÇÃO: Obter preço base da categoria atual
    async getCurrentCategoryBasePrice() {
        try {
            // Tentar pegar do header primeiro (elemento correto)
            const headerPriceElement = document.getElementById('headerBasePrice');
            if (headerPriceElement && headerPriceElement.textContent && headerPriceElement.textContent !== 'Loading...') {
                const priceText = headerPriceElement.textContent.replace(/[R$\s]/g, '');
                const price = parseFloat(priceText);
                if (!isNaN(price)) return price.toFixed(2);
            }

            // Se não tem no header, buscar diretamente da API
            if (this.navigationState.currentFolderId) {
                const response = await fetch(`/api/pricing/category-price?googleDriveId=${encodeURIComponent(this.navigationState.currentFolderId)}`);

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.category && data.category.basePrice) {
                        return data.category.basePrice.toFixed(2);
                    }
                }
            }

            return '0.00';
        } catch (error) {
            console.log('Erro ao obter preço base:', error);
            return '0.00';
        }
    }

    // NOVA FUNÇÃO: Mostrar informações da foto
    showPhotoInfo(photoId, categoryIndex) {
        const category = this.customCategories[categoryIndex];
        const photo = category.photos.find(p => p.id === photoId);

        if (!photo) return;

        // Evitar múltiplas chamadas
        if (document.getElementById('photoInfoModal')) return;

        // Criar modal dinâmico
        const modal = document.createElement('div');
        modal.id = 'photoInfoModal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); z-index: 9999; display: flex;
            align-items: center; justify-content: center;
        `;

        modal.innerHTML = `
            <div style="background: #2c2c34; padding: 2rem; border-radius: 8px; max-width: 400px; border: 2px solid #d4af37;">
                <h3 style="color: #d4af37; margin-bottom: 1rem;">📋 Photo Details</h3>
                <p style="color: white; margin-bottom: 0.5rem;">📸 ${photo.name}</p>
                <p style="color: white; margin-bottom: 0.5rem;">📂 ${photo.sourceCategory || 'Unknown'}</p>
                <p style="color: white; margin-bottom: 1.5rem;">💰 Base: $${photo.originalPrice || '0.00'} → Custom: $${category.customPrice || '0.00'}</p>
                <button onclick="document.getElementById('photoInfoModal').remove()" 
                    style="padding: 0.5rem 1rem; background: #d4af37; color: #2c2c34; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">OK</button>
            </div>
        `;

        document.body.appendChild(modal);
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

    previewPhoto(photoIndex = 0) {
        if (!this.stockPhotosData || this.stockPhotosData.length === 0) return;

        this.currentPhotoIndex = photoIndex;
        const photo = this.stockPhotosData[photoIndex];

        // Mostrar modal
        const modal = document.getElementById('photoModal');
        modal.style.display = 'flex';

        // Atualizar informações
        // Atualizar informações
        const fullPath = this.buildFullCategoryPath();
        document.getElementById('modalPhotoTitle').textContent = fullPath;
        document.getElementById('modalPhotoName').textContent = photo.name;
        document.getElementById('modalPhotoIndex').textContent = `${photoIndex + 1} of ${this.stockPhotosData.length}`;

        // Carregar imagem (ID CORRIGIDO)
        const img = document.getElementById('modalPhoto');
        // Usar imagem original do R2, não thumbnail!
        const originalUrl = photo.url || photo.webViewLink;
        img.src = originalUrl?.replace('/_thumbnails/', '/').replace('/thumbnails/', '/') || photo.webViewLink;
        img.alt = photo.name;

        // ✅ NOVO: Configurar loading para quando imagem carregar
        img.onload = () => {
            // Esconder loading quando imagem carregar
            this.showModalPhotoLoading(false);
        };

        img.onerror = () => {
            // Esconder loading mesmo se der erro
            this.showModalPhotoLoading(false);
        };

        // Atualizar botões de navegação
        document.getElementById('prevBtn').disabled = photoIndex === 0;
        document.getElementById('nextBtn').disabled = photoIndex === this.stockPhotosData.length - 1;

        // ✅ NOVO: Inicializar zoom
        setTimeout(() => {
            if (window.initializePhotoZoom) {
                window.initializePhotoZoom();
            }
        }, 100);

        // ✅ NOVO: Sincronizar checkbox
        this.syncModalCheckbox(photo.id);

        // ✅ NOVO: Atualizar contador de seleção no modal
        this.updateModalSelectionCounter();

        // ✅ NOVO: Setup event listener do checkbox
        this.setupModalCheckboxListener(photo.id);

        // ✅ NOVO: Mostrar informações da categoria no header
        this.updateModalCategoryInfo();
    }

    closePhotoModal() {
        document.getElementById('photoModal').style.display = 'none';

        // ✅ NOVO: Destruir zoom
        if (window.destroyPhotoZoom) {
            window.destroyPhotoZoom();
        }
    }

    prevPhoto() {
        if (this.currentPhotoIndex > 0) {
            // Mostrar loading
            this.showModalPhotoLoading(true);

            // Notificar mudança de foto para zoom
            if (window.notifyPhotoChange) {
                window.notifyPhotoChange();
            }

            this.previewPhoto(this.currentPhotoIndex - 1);
        }
    }

    nextPhoto() {
        if (this.currentPhotoIndex < this.stockPhotosData.length - 1) {
            // Mostrar loading
            this.showModalPhotoLoading(true);

            // Notificar mudança de foto para zoom
            if (window.notifyPhotoChange) {
                window.notifyPhotoChange();
            }

            this.previewPhoto(this.currentPhotoIndex + 1);
        }
    }

    addCurrentPhotoToSelection() {
        const photo = this.stockPhotosData[this.currentPhotoIndex];
        // Implementar lógica para adicionar à seleção
        console.log('📸 Adicionando foto à seleção:', photo.name);
        this.showAddToSelectionModal(null, photo);
    }

    getCurrentCategoryName() {
        return this.navigationState.currentPath[this.navigationState.currentPath.length - 1]?.name || 'Category';
    }

    previewSelection() {
        console.log('📋 Abrindo Preview da Seleção...');

        // Calcular dados para preview
        const totalCategories = this.customCategories.length;
        const totalPhotos = this.selectedPhotos.length;

        // Calcular valor estimado
        let estimatedValue = 0;
        this.customCategories.forEach(category => {
            if (category.customPrice && category.photos.length > 0) {
                estimatedValue += category.photos.length * category.customPrice;
            }
        });

        // Criar modal HTML dinamicamente
        const modalHtml = `
            <div id="previewModal" class="help-modal">
                <div class="help-modal-content">
                    <div class="help-modal-header">
                        <h3><i class="fas fa-eye"></i> Selection Preview</h3>
                        <button id="previewModalClose" class="help-modal-close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="help-modal-body">
                        <div class="preview-summary">
                            <h4><i class="fas fa-chart-bar"></i> Summary</h4>
                            <div class="preview-stats">
                                <div class="preview-stat">
                                    <span class="stat-number">${totalCategories}</span>
                                    <span class="stat-label">Custom Categories</span>
                                </div>
                                <div class="preview-stat">
                                    <span class="stat-number">${totalPhotos}</span>
                                    <span class="stat-label">Total Photos</span>
                                </div>
                                <div class="preview-stat">
                                    <span class="stat-number">$${estimatedValue.toFixed(2)}</span>
                                    <span class="stat-label">Estimated Value</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="preview-categories">
                            <h4><i class="fas fa-folder-open"></i> Categories Breakdown</h4>
                            ${this.generateCategoriesPreview()}
                        </div>
                    </div>
                    <div class="help-modal-footer">
                        <button id="previewCloseBtn" class="btn btn-primary">Close Preview</button>
                    </div>
                </div>
            </div>
        `;

        // Adicionar ao DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Mostrar modal
        const modal = document.getElementById('previewModal');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Event listeners
        document.getElementById('previewModalClose').addEventListener('click', () => this.closePreviewModal());
        document.getElementById('previewCloseBtn').addEventListener('click', () => this.closePreviewModal());

        console.log('✅ Preview Modal aberto');
    }

    generateCategoriesPreview() {
        if (this.customCategories.length === 0) {
            return '<p class="preview-empty">No categories created yet.</p>';
        }

        return this.customCategories.map((category, index) => {
            const photoCount = category.photos.length;
            const categoryValue = photoCount * (category.customPrice || 0);

            return `
                <div class="preview-category">
                    <div class="preview-category-header">
                        <i class="fas fa-folder"></i>
                        <span class="category-name">${category.name}</span>
                        <span class="category-price">$${(category.customPrice || 0).toFixed(2)}</span>
                    </div>
                    <div class="preview-category-details">
                        <span class="category-photos">${photoCount} photo${photoCount !== 1 ? 's' : ''}</span>
                        <span class="category-value">Value: $${categoryValue.toFixed(2)}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    closePreviewModal() {
        const modal = document.getElementById('previewModal');
        if (modal) {
            modal.remove();
            document.body.style.overflow = '';
        }
        console.log('🔒 Preview Modal fechado');
    }

    showHelpModal() {
        console.log('🌟 Abrindo Help Modal...');

        // Resetar step para 1 sempre que abrir modal
        this.currentHelpStep = 1;

        // Criar modal HTML dinamicamente
        const modalHtml = `
            <div id="helpModal" class="help-modal">
                <div class="help-modal-content">
                    <div class="help-modal-header">
                        <h3><i class="fas fa-question-circle"></i> Special Selection Builder Guide</h3>
                        <button id="helpModalClose" class="help-modal-close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="help-modal-body">
                        <div class="help-step" id="helpStep1">
                            <h4>🌟 Step 1 of 5: Find Your Photos</h4>
                            <div class="help-content">
                                <p><strong>📁 Left Panel = Your Stock</strong><br>
                                Navigate through folders to find photos</p>
                                <ul>
                                    <li>Click folders to expand</li>
                                    <li>Use breadcrumbs to go back</li>
                                    <li>Cache makes it super fast!</li>
                                </ul>
                                <p class="help-tip">💡 Tip: Start with your most popular categories</p>
                            </div>
                        </div>
                    </div>
                    <div class="help-modal-footer">
                        <button id="helpSkip" class="btn btn-outline">Skip Tutorial</button>
                        <div class="help-navigation">
                        <div class="help-navigation">
                            <button id="helpPrevious" class="btn btn-outline" style="display: none;">← Previous</button>
                            <span class="help-step-counter">Step 1 of 5</span>
                            <button id="helpNext" class="btn btn-primary">Next Step →</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Adicionar ao DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Mostrar modal
        const modal = document.getElementById('helpModal');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Event listeners
        document.getElementById('helpModalClose').addEventListener('click', () => this.closeHelpModal());
        document.getElementById('helpSkip').addEventListener('click', () => this.closeHelpModal());
        document.getElementById('helpNext').addEventListener('click', () => this.nextHelpStep());
        document.getElementById('helpPrevious').addEventListener('click', () => this.previousHelpStep());
        console.log('✅ Help Modal aberto');
    }

    closeHelpModal() {
        const modal = document.getElementById('helpModal');
        if (modal) {
            modal.remove();
            document.body.style.overflow = '';
        }
        console.log('🔒 Help Modal fechado');
    }

    nextHelpStep() {
        // Inicializar currentHelpStep se não existir
        if (!this.currentHelpStep) this.currentHelpStep = 1;

        // Avançar para próximo step
        this.currentHelpStep++;

        // Máximo 5 steps
        if (this.currentHelpStep > 5) {
            this.closeHelpModal();
            return;
        }

        console.log(`🔄 Navegando para Help Step ${this.currentHelpStep}`);

        // Atualizar conteúdo do modal
        this.updateHelpStep();
    }

    previousHelpStep() {
        if (!this.currentHelpStep) this.currentHelpStep = 1;
        this.currentHelpStep--;
        if (this.currentHelpStep < 1) this.currentHelpStep = 1;
        console.log(`🔄 Voltando para Help Step ${this.currentHelpStep}`);
        this.updateHelpStep();
    }

    updateHelpStep() {
        const stepContent = this.getHelpStepContent(this.currentHelpStep);
        const helpBody = document.querySelector('.help-modal-body');
        const stepCounter = document.querySelector('.help-step-counter');

        if (helpBody) {
            helpBody.innerHTML = stepContent;
        }

        if (stepCounter) {
            stepCounter.textContent = `Step ${this.currentHelpStep} of 5`;
        }

        // Controlar botões
        this.updateHelpButtons();
    }

    getHelpStepContent(step) {
        const steps = {
            1: `
                <div class="help-step" id="helpStep1">
                    <h4> Step 1 of 5: Find Your Photos</h4>
                    <div class="help-content">
                        <p><strong>📁 Left Panel = Your Stock</strong><br>
                        Navigate through folders to find photos</p>
                        <ul>
                            <li>Click folders to expand</li>
                            <li>Use breadcrumbs to go back</li>
                            <li>Cache makes it super fast!</li>
                        </ul>
                        <p class="help-tip">💡 Tip: Start with your most popular categories</p>
                    </div>
                </div>
            `,
            2: `
                <div class="help-step" id="helpStep2">
                    <h4> Step 2 of 5: Create Custom Categories</h4>
                    <div class="help-content">
                        <p><strong>🏷️ Right Panel = Your Selection</strong><br>
                        Create themed categories for your client:</p>
                        <ul>
                            <li>"Premium Collection"</li>
                            <li>"Best Value Options"</li>
                            <li>"Seasonal Specials"</li>
                        </ul>
                        <p class="help-tip">💰 Set base price for each category</p>
                    </div>
                </div>
            `,
            3: `
                <div class="help-step" id="helpStep3">
                    <h4> Step 3 of 5: Move Your Photos</h4>
                    <div class="help-content">
                        <p><strong>🖱️ Drag from Left → Right</strong><br>
                        Move photos to organize your selection:</p>
                        <ul>
                            <li>Select individual photos</li>
                            <li>Or use bulk selection (checkboxes)</li>
                            <li>Drop into categories you created</li>
                            <li>Photos organize automatically!</li>
                        </ul>
                        <p class="help-tip">⚡ Pro tip: Use checkboxes to move multiple photos at once</p>
                    </div>
                </div>
            `,
            4: `
                <div class="help-step" id="helpStep4">
                    <h4> Step 4 of 5: Set Custom Prices</h4>
                    <div class="help-content">
                        <p><strong>💰 Flexible Pricing Options:</strong></p>
                        <ul>
                            <li>Category base price (all photos)</li>
                            <li>Individual photo pricing</li>
                            <li>Custom prices override base</li>
                        </ul>
                        <p class="help-tip">📊 Prices show as elegant golden badges</p>
                    </div>
                </div>
            `,
            5: `
                <div class="help-step" id="helpStep5">
                    <h4> Step 5 of 5: Go Live!</h4>
                    <div class="help-content">
                        <p><strong>🚀 Save & Continue:</strong></p>
                        <ul>
                            <li>Creates Google Drive folders</li>
                            <li>Moves photos to organized structure</li>
                            <li>Activates for client access</li>
                            <li>Client gets special access instantly!</li>
                        </ul>
                        <p class="help-tip">✨ Your client sees only your selection</p>
                    </div>
                </div>
            `
        };

        return steps[step] || steps[1];
    }

    updateHelpButtons() {
        const prevBtn = document.getElementById('helpPrevious');
        const nextBtn = document.getElementById('helpNext');

        // Controlar botão Previous (ocultar no Step 1)
        if (prevBtn) {
            prevBtn.style.display = this.currentHelpStep > 1 ? 'inline-flex' : 'none';
        }

        // Controlar botão Next (alterar texto no Step 5)
        if (nextBtn) {
            if (this.currentHelpStep >= 5) {
                nextBtn.innerHTML = '<i class="fas fa-check"></i> Finish';
            } else {
                nextBtn.innerHTML = 'Next Step →';
            }
        }

        console.log(`🔘 Botões atualizados para step ${this.currentHelpStep} - Previous: ${this.currentHelpStep > 1 ? 'visible' : 'hidden'}`);
    }

    // ===== SALVAR E FINALIZAR =====
    async saveSelection() {
        try {
            console.log('💾 Salvando seleção especial...');

            // 1. Validações básicas
            if (this.customCategories.length === 0) {
                alert('Please add at least one category with photos before saving.');
                return;
            }

            const totalPhotos = this.customCategories.reduce((total, cat) => total + cat.photos.length, 0);
            if (totalPhotos === 0) {
                alert('Please add at least one photo to your categories before saving.');
                return;
            }

            // 2. Mostrar loading no botão
            const saveButton = this.btnSaveAndContinue;
            const originalText = saveButton.innerHTML;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            saveButton.disabled = true;

            // 3. Buscar ID da seleção especial
            const selectionId = this.getSelectionIdFromStorage();
            if (!selectionId) {
                throw new Error('Selection ID not found. Please restart the process from admin panel.');
            }

            // ✅ 4. NOVA LÓGICA: Salvar dados no localStorage para processamento
            const selectionData = {
                selectionId: selectionId,
                customCategories: this.customCategories.map(category => ({
                    categoryId: category.categoryId,  // ← ADICIONAR ESTA LINHA AQUI
                    name: category.name,
                    customPrice: category.customPrice || 0,
                    rateRules: category.rateRules || [],
                    photos: category.photos.map(photo => ({
                        id: photo.id,
                        name: photo.name,
                        sourcePath: photo.sourcePath || this.getCurrentCategoryPath(),
                        sourceCategory: photo.sourceCategory || this.getCurrentCategoryName(),
                        originalPrice: parseFloat(photo.originalPrice) || 0
                    }))
                })),
                currentFolderId: this.navigationState.currentFolderId,
                totalPhotos: totalPhotos
            };

            // Salvar para processamento background
            localStorage.setItem('pendingSelectionData', JSON.stringify(selectionData));
            console.log('🔍 DEBUG customCategories no Save:', JSON.stringify(this.customCategories, null, 2));
            console.log(`📦 Dados salvos para processamento: ${totalPhotos} fotos em ${this.customCategories.length} categorias`);

            // ✅ 5. CHAMAR NOVA ROTA ASSÍNCRONA
            const response = await fetch(`/api/special-selections/${selectionId}/process-async`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(selectionData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to start processing: ${errorData.message}`);
            }

            const result = await response.json();
            console.log('🚀 Processamento iniciado:', result);

            // ✅ 6. REDIRECT IMEDIATO - SEM ESPERAR PROCESSAMENTO!
            const successMessage = `🎉 Special Selection processing started!

    📋 Selection: ${this.selectionData.selectionName}
    👤 Client: ${this.selectionData.clientName} (${this.selectionData.clientCode})
    📁 Categories: ${this.customCategories.length}
    📸 Total Photos: ${totalPhotos}

    Processing is happening in the background.
    You can monitor progress in the Admin Panel.`;
            console.log('🎯 ANTES do modal:', successMessage);
            this.showSuccessModal(successMessage);
            // Limpar dados temporários
            this.clearBuilderStorage();
            this.clearStockCache();

            // Redirect imediato para admin
            console.log('🔄 Redirecionando para admin panel...');

        } catch (error) {
            console.error('❌ Erro ao iniciar processamento:', error);

            const errorMessage = `❌ Error starting special selection processing:

    ${error.message}

    Please try again or contact support if the problem persists.`;

            alert(errorMessage);

        } finally {
            // Restaurar botão se ainda estiver na página
            if (this.btnSaveAndContinue) {
                const saveButton = this.btnSaveAndContinue;
                saveButton.innerHTML = '<i class="fas fa-save"></i> Save & Continue';
                saveButton.disabled = false;
            }
        }
    }

    // ===== FUNÇÕES AUXILIARES PARA A CORREÇÃO =====

    // Função para buscar ID da seleção do localStorage/URL
    getSelectionIdFromStorage() {
        // Primeiro tentar pegar da URL
        const urlParams = new URLSearchParams(window.location.search);
        const selectionId = urlParams.get('selectionId');

        if (selectionId) {
            console.log(`🔍 Selection ID encontrado na URL: ${selectionId}`);
            return selectionId;
        }

        // Depois tentar localStorage
        const storedId = localStorage.getItem('currentSelectionId');
        if (storedId) {
            console.log(`🔍 Selection ID encontrado no localStorage: ${storedId}`);
            return storedId;
        }

        // Se não encontrar, mostrar erro
        console.error('❌ Selection ID não encontrado nem na URL nem no localStorage');
        return null;
    }

    // Função para limpar dados temporários após salvar
    clearBuilderStorage() {
        const keysToRemove = [
            'builderSelectionName',
            'builderClientCode',
            'builderClientName',
            'currentSelectionId'
        ];

        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log(`🧹 Removido localStorage: ${key}`);
        });
    }

    clearStockCache() {
        console.log('🧹 Limpando cache do estoque após seleção...');

        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('photos_') || key.startsWith('folders_')) {
                localStorage.removeItem(key);
            }
        });

        console.log('🚀 Cache do estoque limpo - próxima navegação será atualizada');
    }

    async cancelBuilder() {
        if (this.selectedPhotos.length > 0) {
            if (!confirm('You have unsaved changes. Are you sure you want to cancel?')) {
                return;
            }
        }

        console.log('❌ Cancelando e deletando seleção completamente...');

        // Pegar o ID da seleção atual
        const urlParams = new URLSearchParams(window.location.search);
        const selectionId = urlParams.get('selection');

        if (selectionId) {
            try {
                // Token do admin
                const adminToken = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');

                // Deletar COMPLETAMENTE a seleção
                const response = await fetch(`/api/special-selections/${selectionId}?returnPhotos=false`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${adminToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();
                console.log('🗑️ Resposta da deleção:', data);

            } catch (error) {
                console.error('❌ Erro ao deletar:', error);
            }
        }

        // Voltar para o admin
        window.location.href = "/admin.html#special-selections";
    }

    // ===== UTILITÁRIOS =====
    updateCounts() {
        // ✅ CORREÇÃO: Usar selectedStockPhotos (lado esquerdo) ao invés de selectedPhotos (lado direito)
        const selectionCountElement = document.getElementById('selectionCount');
        if (selectionCountElement) {
            selectionCountElement.textContent = this.selectedStockPhotos.size; // ← CORRIGIDO!
        }

        // NOVO: Atualizar base price no header
        this.updateHeaderBasePrice();

        // Contadores do painel direito (estes estão corretos - usam selectedPhotos)
        if (this.photoCount) {
            this.photoCount.textContent = this.selectedPhotos.length;
        }
        if (this.categoryCount) {
            this.categoryCount.textContent = this.customCategories.length;
        }
    }

    // NOVA FUNÇÃO: Mostrar base price no header
    async updateHeaderBasePrice() {
        const panelHeaderLeft = document.querySelector('.panel-header-left');

        if (!panelHeaderLeft) return;

        // Verificar se já existe elemento de base price
        let basePriceElement = document.getElementById('headerBasePrice');

        if (!basePriceElement) {
            // Criar elemento de base price
            basePriceElement = document.createElement('div');
            basePriceElement.id = 'headerBasePrice';
            basePriceElement.style.cssText = `
                font-size: 1rem;
                color: var(--gold-primary);
                font-weight: 600;
                margin-left: 1rem;
                display: none;
            `;

            panelHeaderLeft.appendChild(basePriceElement);
        }

        // NOVO: Buscar preço da categoria atual via API
        if (this.navigationState && this.navigationState.currentFolderId) {
            try {
                const response = await fetch(`/api/pricing/category-price?googleDriveId=${this.navigationState.currentFolderId}`, {
                    headers: this.getAuthHeaders()
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.category && data.category.basePrice > 0) {
                        basePriceElement.innerHTML = `Base: <span style="color: var(--text-primary);">$${data.category.basePrice}</span>`;
                        basePriceElement.style.display = 'block';
                        return;
                    }
                }
            } catch (error) {
                console.log('💰 Sem preço para esta categoria');
            }
        }

        // Esconder se não tiver preço
        basePriceElement.style.display = 'none';
    }

    refreshStock() {
        console.log('🔄 Atualizando estoque...');

        // LIMPAR CACHE ANTES DE RECARREGAR
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('photos_') || key.startsWith('folder_structure_')) {
                localStorage.removeItem(key);
            }
        });
        console.log('🧹 Cache limpo');

        // Agora sim recarregar
        this.loadStockCategories();
    }

    showLoading(show) {
        console.log(`🔍 showLoading(${show}) chamado - NOVO HEADER`);

        this.isLoading = show;

        // ✅ NOVO: Usar loading do header
        const headerLoading = document.getElementById('headerLoading');
        if (headerLoading) {
            headerLoading.style.display = show ? 'flex' : 'none';
            console.log(`🔍 Header loading display: ${headerLoading.style.display}`);
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

    // ===== FUNÇÕES DO MODAL COM CHECKBOX =====

    syncModalCheckbox(photoId) {
        const modalCheckbox = document.getElementById('modalPhotoCheckbox');
        if (modalCheckbox) {
            const isSelected = this.selectedStockPhotos.has(photoId);
            modalCheckbox.checked = isSelected;

            // Verificar se foto foi movida
            const isPhotoMoved = this.selectedPhotos.some(selectedPhoto => selectedPhoto.id === photoId);
            modalCheckbox.disabled = isPhotoMoved;

            // Visual feedback se foi movida
            const checkboxLabel = document.querySelector('.modal-checkbox-compact');
            if (checkboxLabel) {
                if (isPhotoMoved) {
                    checkboxLabel.style.opacity = '0.5';
                    checkboxLabel.querySelector('.checkbox-text-compact').textContent = 'Moved';
                } else {
                    checkboxLabel.style.opacity = '1';
                    checkboxLabel.querySelector('.checkbox-text-compact').textContent = 'Select';
                }
            }

            // ✅ NOVO: Aplicar visual "moved" na imagem
            const modalImage = document.getElementById('modalPhoto');
            const modalBody = modalImage?.closest('.modal-body');

            if (isPhotoMoved) {
                modalImage?.classList.add('photo-moved');
                modalBody?.classList.add('photo-moved');
            } else {
                modalImage?.classList.remove('photo-moved');
                modalBody?.classList.remove('photo-moved');
            }
        }
    }

    setupModalCheckboxListener(photoId) {
        const modalCheckbox = document.getElementById('modalPhotoCheckbox');

        // Remover listener anterior se existir
        if (this.currentModalCheckboxListener) {
            modalCheckbox.removeEventListener('change', this.currentModalCheckboxListener);
        }

        // Criar novo listener
        this.currentModalCheckboxListener = (e) => {
            if (e.target.checked) {
                this.selectedStockPhotos.add(photoId);
            } else {
                this.selectedStockPhotos.delete(photoId);
            }

            // Sincronizar com checkbox do grid principal
            const gridCheckbox = document.getElementById(`photo_${photoId}`);
            if (gridCheckbox) {
                gridCheckbox.checked = e.target.checked;
                const photoCard = gridCheckbox.closest('.photo-card');
                if (photoCard) {
                    if (e.target.checked) {
                        photoCard.classList.add('selected-checkbox');
                    } else {
                        photoCard.classList.remove('selected-checkbox');
                    }
                }
            }

            // Atualizar contadores
            this.updateSelectionCounter();
            this.updateModalSelectionCounter();
        };

        modalCheckbox.addEventListener('change', this.currentModalCheckboxListener);
    }

    updateModalSelectionCounter() {
        const count = this.selectedStockPhotos.size;
        const countElement = document.getElementById('modalSelectionCount');
        const moveButton = document.getElementById('modalMoveSelected');

        if (countElement) {
            countElement.textContent = count === 1 ? '1 selected' : `${count} selected`;
        }

        if (moveButton) {
            moveButton.disabled = count === 0;
        }
    }

    // ===== FUNÇÃO PARA ATUALIZAR INFO DA CATEGORIA NO MODAL =====

    async updateModalCategoryInfo() {
        const basePriceElement = document.getElementById('modalBasePrice');

        if (basePriceElement) {
            try {
                // Buscar preço da categoria atual
                const basePrice = await this.getCurrentCategoryBasePrice();

                if (basePrice && parseFloat(basePrice) > 0) {
                    basePriceElement.textContent = `Base Price: $${parseFloat(basePrice).toFixed(2)}`;
                    basePriceElement.style.display = 'inline-block';
                } else {
                    basePriceElement.textContent = 'Base Price: Not defined';
                    basePriceElement.style.opacity = '0.6';
                    basePriceElement.style.display = 'inline-block';
                }
            } catch (error) {
                console.log('❌ Erro ao buscar preço base para modal:', error);
                basePriceElement.textContent = 'Base Price: --';
                basePriceElement.style.display = 'inline-block';
            }
        }
    }

    // ===== LOADING DA NAVEGAÇÃO DO MODAL =====

    showModalPhotoLoading(show) {
        const modalBody = document.querySelector('#photoModal .modal-body');
        const img = document.getElementById('modalPhoto');

        if (!modalBody) return;

        // Remover loading existente
        const existingLoading = modalBody.querySelector('.modal-photo-loading');
        if (existingLoading) {
            existingLoading.remove();
        }

        if (show) {
            // Adicionar efeito translúcido na imagem
            if (img) {
                img.classList.add('loading-transition');
            }

            // Criar loading overlay
            const loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'modal-photo-loading';
            loadingOverlay.innerHTML = `
            <div class="loading-spinner-modal">
                <div class="spinner-icon">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <div class="spinner-text">Loading...</div>
            </div>
        `;

            modalBody.appendChild(loadingOverlay);

            // Ativar loading com delay para animação
            setTimeout(() => {
                loadingOverlay.classList.add('active');
            }, 50);

        } else {
            // Remover efeito translúcido da imagem
            if (img) {
                img.classList.remove('loading-transition');
            }
        }
    }

    moveFromFullscreen() {
        // 1. Fechar fullscreen
        this.closePhotoModal();

        // 2. Abrir modal massa selection após delay
        setTimeout(() => {
            this.showMoveSelectedModal();
        }, 300);
    }

    // ===== MODAL DE SUCESSO LUXURY =====
    showSuccessModal(message) {
        // Criar modal dinamicamente
        const modalHtml = `
            <div id="luxurySuccessModal" class="luxury-modal-overlay">
                <div class="luxury-modal">
                    <div class="luxury-modal-header">
                        <div class="luxury-icon">
                            <i class="fas fa-star"></i>
                        </div>
                        <h2 class="luxury-title">Success!</h2>
                    </div>
                    <div class="luxury-modal-body">
                        <p class="luxury-message">${message.replace(/\n/g, '<br>')}</p>
                    </div>
                    <div class="luxury-modal-footer">
                        <button class="luxury-btn" onclick="document.getElementById('luxurySuccessModal').remove(); window.location.href='/admin.html#special-selections';">
                            <i class="fas fa-check"></i>
                            Continue
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Adicionar ao body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Mostrar modal
        setTimeout(() => {
            document.getElementById('luxurySuccessModal').classList.add('show');
        }, 100);
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