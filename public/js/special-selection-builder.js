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
        this.draggedPhoto = null; // ← NOVA LINHA
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
        this.btnAddCategory?.addEventListener('click', () => this.showAddCategoryModal());
        this.btnAddCategoryBottom?.addEventListener('click', () => this.showAddCategoryModal());
        this.btnRefreshStock?.addEventListener('click', () => this.refreshStock());
        this.btnPreviewSelection?.addEventListener('click', () => this.previewSelection());

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
                    
                    <!-- Checkbox para seleção -->
                    <div class="photo-checkbox">
                        <input type="checkbox" 
                            id="photo_${photo.id}" 
                            data-photo-index="${index}"
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
                    
                    <div class="photo-actions">
                        <button class="photo-action-btn" data-action="move" title="Add to Selection">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
                `;
            }).join('');

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
        <div class="custom-category${this.expandedCategories.has(index) ? ' expanded' : ''}" data-category-index="${index}">
            <div class="custom-category-header" onclick="window.specialSelectionBuilder.toggleCategory(${index})">
                <div class="custom-category-info">
                    <button class="category-chevron" onclick="event.stopPropagation(); window.specialSelectionBuilder.toggleCategory(${index})">
                        <i class="fas fa-chevron-${this.expandedCategories.has(index) ? 'up' : 'down'}"></i>
                    </button>
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
        if (!categoryElement) return;

        if (this.expandedCategories.has(categoryIndex)) {
            this.expandedCategories.delete(categoryIndex);
            categoryElement.classList.remove('expanded');
        } else {
            this.expandedCategories.add(categoryIndex);
            categoryElement.classList.add('expanded');
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
        const existingPriceInput = document.getElementById('existingCategoryCustomPrice');
        const priceInfoElement = document.getElementById('existingCategoryPriceInfo');

        if (!existingPriceInput) return;

        if (categoryIndex === '' || categoryIndex === null) {
            existingPriceInput.value = '';
            existingPriceInput.placeholder = 'Custom price';
            if (priceInfoElement) priceInfoElement.style.display = 'none';
            return;
        }

        try {
            const selectedCategory = this.customCategories[parseInt(categoryIndex)];

            if (selectedCategory && selectedCategory.customPrice) {
                const currentPrice = selectedCategory.customPrice;

                // CORRIGIDO: Pegar base price do elemento correto
                const basePriceElement = document.querySelector('#sourceCategoryPrice span');
                let basePrice = 0;

                if (basePriceElement) {
                    const basePriceText = basePriceElement.textContent;
                    basePrice = parseFloat(basePriceText.replace('$', ''));
                }

                // Preencher campo
                existingPriceInput.value = currentPrice;
                existingPriceInput.placeholder = 'Edit price';

                // Mostrar info compacta
                if (priceInfoElement && basePrice > 0) {
                    priceInfoElement.innerHTML = `$${basePrice} → $${currentPrice}`;
                    priceInfoElement.style.display = 'block';
                }

                console.log(`💰 Categoria "${selectedCategory.name}" - Ajustado: $${basePrice} → $${currentPrice}`);
            } else {
                existingPriceInput.value = '';
                existingPriceInput.placeholder = 'Set custom price';
                if (priceInfoElement) priceInfoElement.style.display = 'none';
            }

        } catch (error) {
            console.error('❌ Erro ao buscar preço da categoria:', error);
            existingPriceInput.value = '';
            existingPriceInput.placeholder = 'Custom price';
            if (priceInfoElement) priceInfoElement.style.display = 'none';
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
            if (existingPriceInput) existingPriceInput.disabled = false;

            // Desabilitar Create New
            if (newNameInput) newNameInput.disabled = true;
            if (newPriceInput) newPriceInput.disabled = true;
        } else if (newRadio && newRadio.checked) {
            // Desabilitar Existing Category
            if (existingSelect) existingSelect.disabled = true;
            if (existingPriceInput) existingPriceInput.disabled = true;

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
        }
    }

    async performMassMovement(targetCategory, targetCategoryIndex) {
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
                        targetCategory.photos.push(photoData);
                        this.selectedPhotos.push(photoData);
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

        // Atualizar interfaces
        this.updateSelectionCounter();
        this.renderCustomCategories();
        this.renderStockPhotos();
        this.updateCounts();

        // Fechar modal PRIMEIRO
        this.closeMassSelectionModal();

        // Feedback de sucesso SEM setTimeout (corrige bug)
        alert(`✅ Success!\n\n${totalPhotos} photos moved to "${categoryName}"\n\nThe photos have been added to your custom selection.`);

        console.log(`🎉 Movimentação em massa concluída: ${totalPhotos} fotos para ${categoryName}`);
    }

    // Função auxiliar para selecionar todas as fotos visíveis
    selectAllVisiblePhotos() {
        const visiblePhotos = document.querySelectorAll('#stockPhotos .photo-card:not(.photo-selected)');

        visiblePhotos.forEach(photoCard => {
            const photoId = photoCard.dataset.photoId;
            if (photoId) {
                this.togglePhotoSelection(photoId);
            }
        });

        console.log(`📋 Selecionadas todas as fotos visíveis`);
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

            // Usar mesma API que client.js
            const response = await fetch(`/api/drive/explore/${folderId}?depth=1`, {
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
                ${folder.imageCount || folder.totalFiles || 0} fotos
                ${folder.totalSubfolders > 0 ? ` • ${folder.totalSubfolders} pastas` : ''}
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
        this.renderStockPhotos();
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
            this.renderStockPhotos();
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

    previewPhoto(photoIndex = 0) {
        if (!this.stockPhotosData || this.stockPhotosData.length === 0) return;

        this.currentPhotoIndex = photoIndex;
        const photo = this.stockPhotosData[photoIndex];

        // Mostrar modal
        const modal = document.getElementById('photoModal');
        modal.style.display = 'flex';

        // Atualizar informações
        document.getElementById('modalPhotoTitle').textContent = this.getCurrentCategoryName();
        document.getElementById('modalPhotoName').textContent = photo.name;
        document.getElementById('modalPhotoIndex').textContent = `${photoIndex + 1} of ${this.stockPhotosData.length}`;

        // Carregar imagem
        const img = document.getElementById('modalPhotoImage');
        img.src = photo.thumbnailLarge || photo.thumbnailLink?.replace('=s220', '=s1200') || photo.webViewLink;
        img.alt = photo.name;

        // Atualizar botões de navegação
        document.getElementById('prevBtn').disabled = photoIndex === 0;
        document.getElementById('nextBtn').disabled = photoIndex === this.stockPhotosData.length - 1;
    }

    closePhotoModal() {
        document.getElementById('photoModal').style.display = 'none';
    }

    prevPhoto() {
        if (this.currentPhotoIndex > 0) {
            this.previewPhoto(this.currentPhotoIndex - 1);
        }
    }

    nextPhoto() {
        if (this.currentPhotoIndex < this.stockPhotosData.length - 1) {
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