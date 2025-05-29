// photo-manager-admin.js - MODAL DE MOVIMENTAÇÃO
// Substitua completamente o arquivo existente

const photoManager = {
  currentStructure: null,
  selectedFolder: null,
  selectedPhotos: new Set(), // Para seleção múltipla
  currentFolderPhotos: [], // Armazenar fotos da pasta atual
  currentFolderId: null, // ID da pasta atual
  currentFolderName: '', // Nome da pasta atual
  viewMode: 'list', // 'list' ou 'thumbnails'
  photosToMove: null, // Set de IDs das fotos a serem movidas
  selectedDestinationFolder: null, // Pasta destino selecionada

  async init() {
    console.log('🚀 Initializing Photo Storage tab...');

    if (document.getElementById('photo-storage')) {
      await this.loadStorageStats();
      await this.loadFolderStructure();
    }
  },

  async loadStorageStats(forceReload = false) {
    try {
      console.log('📊 Loading storage stats...');

      // Cache busting para forçar atualização
      const cacheParam = forceReload ? `?t=${Date.now()}` : '';
      const response = await fetch(`/api/admin/folders/leaf${cacheParam}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.folders) {
        const folders = data.folders;
        const totalPhotos = folders.reduce((sum, folder) => sum + (folder.fileCount || 0), 0);
        const totalFolders = folders.length;

        // Calcular estatísticas
        const stats = {
          totalPhotos: totalPhotos,
          totalFolders: totalFolders,
          usedSpace: (totalPhotos * 2.5).toFixed(2), // ~2.5MB por foto
          availableSpace: '50.00',
          percentUsed: Math.min(100, (totalPhotos * 2.5 / 50) * 100).toFixed(1)
        };

        console.log(`✅ Stats loaded: ${stats.totalPhotos} photos in ${stats.totalFolders} folders`);

        // Atualizar interface
        this.renderStorageStats(stats);

        return stats;
      } else {
        throw new Error('Invalid response format');
      }

    } catch (error) {
      console.error('❌ Error loading storage stats:', error);
      showToast('Error loading storage statistics', 'error');
      return null;
    }
  },

  async loadFolderStructure() {
    try {
      console.log('📂 Loading folder structure...');

      const response = await fetch('/api/admin/folders/leaf?admin=true');
      const data = await response.json();

      if (data.success && data.folders) {
        console.log(`📋 Loaded ${data.folders.length} folders`);

        const organizedStructure = this.organizeIntoHierarchy(data.folders);
        this.currentStructure = organizedStructure;
        this.renderFolderTree(organizedStructure);

        console.log('✅ Folder structure rendered successfully');
      } else {
        throw new Error(data.message || 'Failed to load folders');
      }
    } catch (error) {
      console.error('❌ Error loading folder structure:', error);
      document.getElementById('folder-tree').innerHTML =
        `<div class="error">Failed to load folder structure: ${error.message}</div>`;
    }
  },

  organizeIntoHierarchy(folders) {
    const hierarchy = {};

    folders.forEach(folder => {
      const path = folder.path || folder.fullPath || folder.name;
      const parts = Array.isArray(path) ? path : path.split(' → ');

      let current = hierarchy;

      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = {
            name: part,
            children: {},
            isLeaf: index === parts.length - 1,
            folder: index === parts.length - 1 ? folder : null
          };
        }
        current = current[part].children;
      });
    });

    return this.convertToArray(hierarchy);
  },

  convertToArray(hierarchyObj) {
    return Object.values(hierarchyObj).map(item => ({
      name: item.name,
      isLeaf: item.isLeaf,
      fileCount: item.folder ? item.folder.fileCount : 0,
      id: item.folder ? item.folder.id : null,
      folder: item.folder,
      children: Object.keys(item.children).length > 0 ? this.convertToArray(item.children) : []
    }));
  },

  renderFolderTree(folders, container = null, level = 0) {
    if (!container) {
      container = document.getElementById('folder-tree');
      container.innerHTML = '';

      if (folders.length === 0) {
        container.innerHTML = '<div class="empty-message">No folders found</div>';
        return;
      }
    }

    folders.forEach(folder => {
      const folderDiv = document.createElement('div');
      folderDiv.className = `folder-item ${folder.isLeaf ? 'folder-leaf' : 'folder-branch'}`;
      folderDiv.style.paddingLeft = `${level * 20}px`;

      const icon = folder.isLeaf ? '📄' : (folder.children.length > 0 ? '📁' : '📂');
      const photoCount = folder.isLeaf ? ` (${folder.fileCount || 0} photos)` : '';

      folderDiv.innerHTML = `
        <span class="folder-icon">${icon}</span>
        <span class="folder-name">${folder.name}</span>
        <span class="folder-count">${photoCount}</span>
        ${folder.isLeaf ? `
          <div class="folder-actions">
            <button class="folder-action-btn" onclick="photoManager.openFolderModal('${folder.id}', '${folder.name.replace(/'/g, '\\\'')}')" title="View Photos">👁️</button>
          </div>
        ` : ''}
      `;

      if (folder.isLeaf) {
        folderDiv.onclick = (e) => {
          if (!e.target.classList.contains('folder-action-btn')) {
            this.selectFolder(folder, folderDiv);
          }
        };
      }

      container.appendChild(folderDiv);

      if (folder.children && folder.children.length > 0) {
        const childContainer = document.createElement('div');
        childContainer.className = 'folder-children';
        container.appendChild(childContainer);
        this.renderFolderTree(folder.children, childContainer, level + 1);
      }
    });
  },

  selectFolder(folder, element) {
    document.querySelectorAll('.folder-item').forEach(item => {
      item.classList.remove('selected');
    });

    element.classList.add('selected');
    this.selectedFolder = folder;

    console.log(`📁 Selected folder: ${folder.name} (${folder.fileCount} photos)`);
  },

  // Abrir modal da pasta
  async openFolderModal(folderId, folderName) {
    console.log(`🎯 Opening folder modal: ${folderName} (${folderId})`);

    // Armazenar informações da pasta atual
    this.currentFolderId = folderId;
    this.currentFolderName = folderName;
    this.selectedPhotos.clear(); // Limpar seleções anteriores

    if (!document.getElementById('photo-folder-modal')) {
      this.createFolderModal();
    }

    document.getElementById('modal-folder-title').textContent = folderName;
    document.getElementById('photo-folder-modal').style.display = 'flex';

    await this.loadFolderPhotos(folderId, folderName);
  },

  // Criar modal para fotos
  createFolderModal() {
    console.log('🏗️ Creating folder modal...');

    const modalHTML = `
      <div id="photo-folder-modal" class="photo-folder-modal" style="display: none;">
        <div class="photo-modal-content">
          <div class="photo-modal-header">
            <h3 id="modal-folder-title">Folder Name</h3>
            <div class="photo-modal-controls">
              <button class="btn btn-secondary btn-sm" onclick="photoManager.toggleViewMode()" id="view-mode-btn">🖼️ Switch to Thumbnails</button>
              <button class="btn btn-gold btn-sm" onclick="photoManager.moveSelectedPhotos()" id="move-selected-btn" disabled>📦 Move Selected (0)</button>
              <button class="photo-modal-close" onclick="photoManager.closeFolderModal()">&times;</button>
            </div>
          </div>

          <div class="photo-modal-body">
            <div id="photo-modal-loading" class="loading">Loading photos...</div>
            <div id="photo-modal-content" style="display: none;">
              <!-- Photos will be loaded here -->
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    console.log('✅ Folder modal created');
  },

  // Carregar fotos da pasta
  async loadFolderPhotos(folderId, forceReload = false) {
    try {
      console.log(`📋 Loading photos for folder: ${folderId} (forceReload: ${forceReload})`);

      if (!folderId) {
        console.error('❌ No folder ID provided');
        return;
      }

      // Cache busting se forçado
      const cacheParam = forceReload ? `?t=${Date.now()}` : '';
      const response = await fetch(`/api/photos?category_id=${folderId}${cacheParam}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const photos = await response.json();
      console.log(`📷 Found ${photos.length} photos`);

      // Atualizar array interno
      this.currentFolderPhotos = photos;

      // Encontrar informações da pasta atual
      const currentFolder = this.allFolders.find(f => f.id === folderId);
      if (currentFolder) {
        console.log(`📂 Folder: ${currentFolder.name} (${photos.length} photos)`);

        // Atualizar título do modal se estiver aberto
        const folderTitleElement = document.getElementById('current-folder-name');
        if (folderTitleElement) {
          folderTitleElement.textContent = `${currentFolder.name} (${photos.length} photos)`;
        }
      }

      // Re-renderizar no modo atual
      if (this.isListMode) {
        console.log('🎨 Re-rendering in list mode');
        this.renderPhotosInListMode(photos);
      } else {
        console.log('🎨 Re-rendering in thumbnails mode');
        this.renderPhotosInThumbnailsMode(photos);
      }

      // Limpar seleções após recarregar
      this.photosToMove.clear();
      this.updateSelectedCount();

      console.log('✅ Folder photos reloaded successfully');

    } catch (error) {
      console.error('❌ Error loading folder photos:', error);
      showToast('Error reloading photos', 'error');
    }
  },

  // Renderizar fotos (lista ou thumbnails)
  renderPhotosInModal(photos) {
    console.log(`🎨 Rendering ${photos.length} photos in ${this.viewMode} mode`);

    const contentDiv = document.getElementById('photo-modal-content');

    if (this.viewMode === 'list') {
      this.renderListMode(photos, contentDiv);
    } else {
      this.renderThumbnailsMode(photos, contentDiv);
    }

    // Atualizar contador de selecionados
    this.updateSelectionCounter();
  },

  // Renderizar modo lista COM CHECKBOXES
  renderListMode(photos, container) {
    console.log('📋 Rendering list mode with checkboxes');

    const listHTML = `
      <div class="photo-list-header">
        <div class="selection-controls">
          <label class="select-all-label">
            <input type="checkbox" id="select-all-checkbox" onchange="photoManager.toggleSelectAll(this.checked)">
            Select All
          </label>
          <span class="photo-count"><strong>${photos.length}</strong> photos in this folder</span>
        </div>
      </div>
      <div class="photo-list-container">
        ${photos.map((photo, index) => `
          <div class="photo-list-item ${this.selectedPhotos.has(photo.id) ? 'selected' : ''}" data-photo-id="${photo.id}">
            <label class="photo-checkbox-container" onclick="event.stopPropagation();">
              <input type="checkbox" class="photo-checkbox" value="${photo.id}" 
                ${this.selectedPhotos.has(photo.id) ? 'checked' : ''} 
                onchange="photoManager.togglePhotoSelection('${photo.id}', this.checked)">
            </label>
            <span class="photo-list-icon">📸</span>
            <span class="photo-list-name" onclick="photoManager.openPhotoFullscreen('${photo.id}', ${index})">${photo.name || photo.id}</span>
            <span class="photo-list-id">${photo.id}</span>
          </div>
        `).join('')}
      </div>
    `;
    container.innerHTML = listHTML;
  },

  // Renderizar modo thumbnails COM CHECKBOXES
  renderThumbnailsMode(photos, container) {
    console.log('🖼️ Rendering thumbnails mode with checkboxes');

    const thumbnailsHTML = `
      <div class="photo-thumbnails-header">
        <div class="selection-controls">
          <label class="select-all-label">
            <input type="checkbox" id="select-all-checkbox" onchange="photoManager.toggleSelectAll(this.checked)">
            Select All
          </label>
          <span class="photo-count"><strong>${photos.length}</strong> photos in this folder</span>
        </div>
      </div>
      <div class="photo-thumbnails-container">
        ${photos.map((photo, index) => {
      let thumbnailUrl = photo.thumbnail;
      if (!thumbnailUrl || thumbnailUrl.includes('undefined')) {
        thumbnailUrl = `/api/photos/local/thumbnail/${photo.id}`;
      }

      return `
            <div class="photo-thumbnail-item ${this.selectedPhotos.has(photo.id) ? 'selected' : ''}" data-photo-id="${photo.id}">
              <label class="photo-thumbnail-checkbox" onclick="event.stopPropagation();">
                <input type="checkbox" class="photo-checkbox" value="${photo.id}" 
                  ${this.selectedPhotos.has(photo.id) ? 'checked' : ''} 
                  onchange="photoManager.togglePhotoSelection('${photo.id}', this.checked)">
              </label>
              <div class="photo-thumbnail-preview" onclick="photoManager.openPhotoFullscreen('${photo.id}', ${index})">
                <img src="${thumbnailUrl}" 
                     alt="${photo.name || photo.id}" 
                     loading="lazy" 
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div class="photo-placeholder" style="display: none;">📷</div>
              </div>
              <div class="photo-thumbnail-name">${photo.name || photo.id}</div>
            </div>
          `;
    }).join('')}
      </div>
    `;
    container.innerHTML = thumbnailsHTML;
  },

  // Alternar seleção de foto individual
  togglePhotoSelection(photoId, selected) {
    console.log(`📋 Toggling photo selection: ${photoId} = ${selected}`);

    if (selected) {
      this.selectedPhotos.add(photoId);
    } else {
      this.selectedPhotos.delete(photoId);
    }

    // Atualizar visual da linha/thumbnail
    const photoElement = document.querySelector(`[data-photo-id="${photoId}"]`);
    if (photoElement) {
      if (selected) {
        photoElement.classList.add('selected');
      } else {
        photoElement.classList.remove('selected');
      }
    }

    this.updateSelectionCounter();
    this.updateSelectAllCheckbox();
  },

  // Selecionar/desselecionar todas
  toggleSelectAll(selectAll) {
    console.log(`📋 Toggle select all: ${selectAll}`);

    const checkboxes = document.querySelectorAll('.photo-checkbox');
    this.selectedPhotos.clear();

    checkboxes.forEach(checkbox => {
      checkbox.checked = selectAll;
      if (selectAll) {
        this.selectedPhotos.add(checkbox.value);
      }

      // Atualizar visual
      const photoElement = checkbox.closest('[data-photo-id]');
      if (photoElement) {
        if (selectAll) {
          photoElement.classList.add('selected');
        } else {
          photoElement.classList.remove('selected');
        }
      }
    });

    this.updateSelectionCounter();
  },

  // Atualizar contador de selecionados
  updateSelectionCounter() {
    const selectedCount = this.selectedPhotos.size;
    const moveBtn = document.getElementById('move-selected-btn');

    if (moveBtn) {
      moveBtn.disabled = selectedCount === 0;
      moveBtn.textContent = `📦 Move Selected (${selectedCount})`;
    }

    console.log(`📊 Selected photos: ${selectedCount}`);
  },

  // Atualizar checkbox "Select All"
  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    if (selectAllCheckbox) {
      const totalPhotos = this.currentFolderPhotos.length;
      const selectedCount = this.selectedPhotos.size;

      selectAllCheckbox.checked = selectedCount === totalPhotos && totalPhotos > 0;
      selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalPhotos;
    }
  },

  // Alternar modo de visualização
  toggleViewMode() {
    this.viewMode = this.viewMode === 'list' ? 'thumbnails' : 'list';
    console.log(`🔄 Switching to ${this.viewMode} mode`);

    // Atualizar botão
    const btn = document.getElementById('view-mode-btn');
    btn.textContent = this.viewMode === 'list' ? '🖼️ Switch to Thumbnails' : '📋 Switch to List';

    // Re-renderizar fotos mantendo seleções
    this.renderPhotosInModal(this.currentFolderPhotos);
  },

  // Abrir foto em fullscreen
  openPhotoFullscreen(photoId, photoIndex) {
    console.log(`🖼️ Opening photo fullscreen: ${photoId} (index: ${photoIndex})`);

    const photo = this.currentFolderPhotos[photoIndex];
    if (!photo) {
      console.error('❌ Photo not found');
      return;
    }

    if (!document.getElementById('photo-fullscreen-modal')) {
      this.createFullscreenModal();
    }

    const imageUrl = photo.highres || `/api/photos/local/${this.currentFolderId}/${photoId}`;
    document.getElementById('fullscreen-image').src = imageUrl;
    document.getElementById('fullscreen-photo-name').textContent = photo.name || photoId;

    // Armazenar foto atual para o botão Move
    this.currentFullscreenPhoto = photo;

    document.getElementById('photo-fullscreen-modal').style.display = 'flex';

    console.log(`✅ Fullscreen opened for: ${photo.name || photoId}`);
  },

  // Criar modal fullscreen
  createFullscreenModal() {
    const fullscreenHTML = `
      <div id="photo-fullscreen-modal" class="photo-fullscreen-modal" style="display: none;">
        <div class="fullscreen-content">
          <div class="fullscreen-header">
            <h4 id="fullscreen-photo-name">Photo Name</h4>
            <div class="fullscreen-controls">
              <button class="btn btn-secondary" onclick="photoManager.closeFullscreen()">← Back</button>
              <button class="btn btn-gold" onclick="photoManager.moveSinglePhoto()">📦 Move Photo</button>
              <button class="fullscreen-close" onclick="photoManager.closeFullscreen()">&times;</button>
            </div>
          </div>
          
          <div class="fullscreen-image-container">
            <img id="fullscreen-image" src="" alt="Photo" />
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', fullscreenHTML);
    console.log('✅ Fullscreen modal created');
  },

  // Fechar modal da pasta
  closeFolderModal() {
    console.log('🚪 Closing folder modal');
    document.getElementById('photo-folder-modal').style.display = 'none';
    this.selectedPhotos.clear();
    this.currentFolderPhotos = [];
    this.currentFolderId = null;
    this.currentFolderName = '';
  },

  // Fechar fullscreen
  closeFullscreen() {
    console.log('🚪 Closing fullscreen');
    document.getElementById('photo-fullscreen-modal').style.display = 'none';
    this.currentFullscreenPhoto = null;
  },

  // NOVA FUNÇÃO: Mover foto única (do fullscreen)
  moveSinglePhoto() {
    if (!this.currentFullscreenPhoto) {
      showToast('No photo selected', 'error');
      return;
    }

    console.log(`📦 Moving single photo: ${this.currentFullscreenPhoto.id}`);

    // Criar set com uma foto para usar a mesma lógica
    const singlePhotoSet = new Set([this.currentFullscreenPhoto.id]);
    this.openMoveModal(singlePhotoSet);
  },

  // NOVA FUNÇÃO: Mover fotos selecionadas
  moveSelectedPhotos() {
    if (this.selectedPhotos.size === 0) {
      showToast('Please select photos to move', 'warning');
      return;
    }

    console.log(`📦 Moving ${this.selectedPhotos.size} selected photos`);
    this.openMoveModal(this.selectedPhotos);
  },

  // NOVA FUNÇÃO: Abrir modal de movimentação
  async openMoveModal(photosToMove) {
    console.log('📦 Opening move modal for photos:', Array.from(photosToMove));

    this.photosToMove = new Set(photosToMove);
    this.selectedDestinationFolder = null;

    // Criar modal se não existir
    if (!document.getElementById('photo-move-modal')) {
      this.createMoveModal();
    }

    // Atualizar título
    document.getElementById('move-modal-title').textContent =
      `Move ${photosToMove.size} ${photosToMove.size === 1 ? 'Photo' : 'Photos'}`;

    // Mostrar de onde estão vindo
    document.getElementById('move-source-folder').textContent = this.currentFolderName;

    // Mostrar modal
    document.getElementById('photo-move-modal').style.display = 'flex';

    // Carregar estrutura de pastas para seleção
    await this.loadFoldersForMove();
  },

  // NOVA FUNÇÃO: Criar modal de movimentação
  createMoveModal() {
    console.log('🏗️ Creating move modal...');

    const moveModalHTML = `
      <div id="photo-move-modal" class="photo-move-modal" style="display: none;">
        <div class="move-modal-content">
          <div class="move-modal-header">
            <h3 id="move-modal-title">Move Photos</h3>
            <button class="move-modal-close" onclick="photoManager.closeMoveModal()">&times;</button>
          </div>
          
          <div class="move-modal-body">
            <div class="move-info">
              <p><strong>From:</strong> <span id="move-source-folder"></span></p>
              <p><strong>To:</strong> <span id="move-destination-folder" style="color: #666;">Select a destination folder below</span></p>
            </div>
            
            <div class="move-folder-selection">
              <h4>Select Destination Folder:</h4>
              <div id="move-folders-loading" class="loading">Loading folders...</div>
              <div id="move-folders-tree" style="display: none;">
                <!-- Folder tree will be loaded here -->
              </div>
            </div>
          </div>
          
          <div class="move-modal-footer">
            <button class="btn btn-secondary" onclick="photoManager.closeMoveModal()">Cancel</button>
            <button class="btn btn-gold" onclick="photoManager.confirmMovePhotos()" id="confirm-move-btn" disabled>📦 Move Photos</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', moveModalHTML);
    console.log('✅ Move modal created');
  },

  // NOVA FUNÇÃO: Carregar pastas para movimentação
  async loadFoldersForMove() {
    console.log('📂 Loading folder structure for move...');

    const loadingDiv = document.getElementById('move-folders-loading');
    const treeDiv = document.getElementById('move-folders-tree');

    loadingDiv.style.display = 'block';
    treeDiv.style.display = 'none';

    try {
      // Usar a estrutura já carregada
      const foldersForMove = this.filterFoldersForMove(this.currentStructure);

      if (foldersForMove.length === 0) {
        treeDiv.innerHTML = '<div class="empty-message">No available destination folders</div>';
      } else {
        this.renderMoveTree(foldersForMove, treeDiv);
      }

      loadingDiv.style.display = 'none';
      treeDiv.style.display = 'block';

    } catch (error) {
      console.error('❌ Error loading folders for move:', error);
      treeDiv.innerHTML = `<div class="error">Failed to load folders: ${error.message}</div>`;
      loadingDiv.style.display = 'none';
      treeDiv.style.display = 'block';
    }
  },

  // NOVA FUNÇÃO: Filtrar pastas válidas para movimentação
  filterFoldersForMove(folders) {
    const adminFoldersToExclude = ['Waiting Payment', 'Sold'];

    const filterRecursive = (folderList) => {
      return folderList.filter(folder => {
        // Excluir pastas administrativas
        if (adminFoldersToExclude.includes(folder.name)) {
          return false;
        }

        // Excluir a pasta atual (não pode mover para ela mesma)
        if (folder.id === this.currentFolderId) {
          return false;
        }

        // Filtrar filhos recursivamente
        if (folder.children && folder.children.length > 0) {
          folder.children = filterRecursive(folder.children);
        }

        return true;
      });
    };

    return filterRecursive(folders);
  },

  // NOVA FUNÇÃO: Renderizar árvore de pastas para movimentação
  renderMoveTree(folders, container, level = 0) {
    container.innerHTML = '';

    folders.forEach(folder => {
      const folderDiv = document.createElement('div');
      folderDiv.className = 'move-folder-item';
      folderDiv.style.paddingLeft = `${level * 20}px`;

      const icon = folder.isLeaf ? '📄' : (folder.children.length > 0 ? '📁' : '📂');
      const photoCount = folder.isLeaf ? ` (${folder.fileCount || 0} photos)` : '';

      folderDiv.innerHTML = `
        <div class="move-folder-content" onclick="photoManager.selectDestinationFolder('${folder.id}', '${folder.name.replace(/'/g, '\\\'')}')" ${folder.isLeaf ? 'data-selectable="true"' : ''}>
          <span class="move-folder-icon">${icon}</span>
          <span class="move-folder-name">${folder.name}</span>
          <span class="move-folder-count">${photoCount}</span>
          ${folder.isLeaf ? '<span class="move-folder-action">Click to select</span>' : ''}
        </div>
      `;

      container.appendChild(folderDiv);

      // Renderizar filhos
      if (folder.children && folder.children.length > 0) {
        const childContainer = document.createElement('div');
        childContainer.className = 'move-folder-children';
        container.appendChild(childContainer);
        this.renderMoveTree(folder.children, childContainer, level + 1);
      }
    });
  },

  // NOVA FUNÇÃO: Selecionar pasta destino
  selectDestinationFolder(folderId, folderName) {
    console.log(`📁 Selected destination folder: ${folderName} (${folderId})`);

    // Remover seleção anterior
    document.querySelectorAll('.move-folder-item').forEach(item => {
      item.classList.remove('selected');
    });

    // Adicionar seleção atual
    event.currentTarget.closest('.move-folder-item').classList.add('selected');

    // Atualizar informações
    this.selectedDestinationFolder = { id: folderId, name: folderName };
    document.getElementById('move-destination-folder').textContent = folderName;
    document.getElementById('move-destination-folder').style.color = 'var(--color-gold)';

    // Habilitar botão confirmar
    document.getElementById('confirm-move-btn').disabled = false;
  },

  // NOVA FUNÇÃO: Confirmar movimentação
  async confirmMovePhotos() {
    if (!this.selectedDestinationFolder || !this.photosToMove || this.photosToMove.size === 0) {
      showToast('Invalid move operation', 'error');
      return;
    }

    const photoCount = this.photosToMove.size;
    const destinationName = this.selectedDestinationFolder.name;

    console.log(`📦 Confirming move of ${photoCount} photos to: ${destinationName}`);

    // Mostrar confirmação
    showConfirm(
      `Are you sure you want to move ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'} to "${destinationName}"?`,
      async () => {
        await this.executeMovePhotos();
      },
      'Confirm Move'
    );
  },

  async executeMovePhotos() {
    try {
      console.log('🚀 Executing real photo move...');

      if (!this.selectedDestinationFolder || !this.photosToMove || this.photosToMove.size === 0) {
        showToast('Invalid move operation', 'error');
        return;
      }

      const photoIds = Array.from(this.photosToMove);
      const sourceFolderId = this.currentFolderId;
      const destinationFolderId = this.selectedDestinationFolder.id;
      const photoCount = photoIds.length;
      const destinationName = this.selectedDestinationFolder.name;

      console.log(`📦 Moving ${photoCount} photos:`);
      console.log(`📂 From: ${sourceFolderId} → To: ${destinationFolderId}`);
      console.log(`📂 Destination name: ${destinationName}`);
      console.log('📋 Photo IDs:', photoIds);

      // Mostrar toast de loading
      showToast(`Moving ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'} to ${destinationName}...`, 'info');

      try {
        // Chamada real para a API
        console.log('📡 Sending API request...');
        const response = await fetch('/api/admin/photos/move', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            photoIds: photoIds,
            sourceFolderId: sourceFolderId,
            destinationFolderId: destinationFolderId
          })
        });

        console.log(`📡 API Response status: ${response.status}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('📡 API Response data:', result);

        if (result.success) {
          // Sucesso - processar resultado
          const movedCount = result.movedCount || 0;
          const errors = result.errors || [];

          console.log(`✅ API returned success: moved ${movedCount} photos`);

          if (movedCount > 0) {
            // Fotos foram movidas com sucesso
            let successMessage = `Successfully moved ${movedCount} ${movedCount === 1 ? 'photo' : 'photos'} to ${destinationName}`;

            if (errors.length > 0) {
              successMessage += ` (${errors.length} warnings)`;
              console.warn('⚠️ Move warnings:', errors);
            }

            showToast(successMessage, 'success');

            // 🎯 ATUALIZAÇÃO FORÇADA DA INTERFACE
            console.log('🔄 Starting interface refresh...');

            // 1. Fechar modal de movimentação
            this.closeMoveModal();
            console.log('✅ Move modal closed');

            // 2. Limpar seleções
            this.photosToMove.clear();
            this.selectedDestinationFolder = null;
            console.log('✅ Selections cleared');

            // 3. Atualizar estatísticas gerais
            console.log('📊 Refreshing storage stats...');
            await this.loadStorageStats();

            // 4. Atualizar estrutura de pastas (contador de fotos)
            console.log('📂 Refreshing folder structure...');
            await this.loadFolderStructure();

            // 5. Recarregar fotos da pasta atual
            console.log(`🔄 Reloading photos for current folder: ${this.currentFolderId}`);
            await this.loadFolderPhotos(this.currentFolderId);

            console.log('✅ Interface refresh completed');

          } else {
            // Nenhuma foto foi movida
            if (errors.length > 0) {
              console.warn('⚠️ No photos moved due to:', errors);
              showToast(`No photos moved: ${errors[0]}`, 'warning');
            } else {
              console.warn('⚠️ No photos moved - unknown reason');
              showToast('No photos were moved', 'warning');
            }
          }

        } else {
          // API retornou erro
          console.error('❌ API returned error:', result.message);
          showToast(`Failed to move photos: ${result.message}`, 'error');

          if (result.errors && result.errors.length > 0) {
            console.error('❌ Detailed errors:', result.errors);
          }
        }

      } catch (fetchError) {
        console.error('❌ Network/Fetch Error:', fetchError);

        if (fetchError.message.includes('404')) {
          showToast('API endpoint not found - check server routes', 'error');
          console.error('🔍 Verify that /api/admin/photos/move route exists in backend');
        } else if (fetchError.message.includes('500')) {
          showToast('Server error during photo move', 'error');
          console.error('🔍 Check server logs for detailed error information');
        } else {
          showToast('Network error while moving photos', 'error');
        }
      }

    } catch (error) {
      console.error('❌ Error in executeMovePhotos:', error);
      showToast('Unexpected error while moving photos', 'error');
    }
  },

  // NOVA FUNÇÃO: Fechar modal de movimentação
  closeMoveModal() {
    console.log('🚪 Closing move modal');
    document.getElementById('photo-move-modal').style.display = 'none';
    this.photosToMove = null;
    this.selectedDestinationFolder = null;
  },

  async refreshStructure() {
    console.log('🔄 Refreshing folder structure...');
    await this.loadStorageStats();
    await this.loadFolderStructure();
    showToast('Folder structure refreshed', 'success');
  }
};

// Integração com o sistema existente
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const originalSwitchTab = window.switchTab;

    if (originalSwitchTab) {
      window.switchTab = function (tabId) {
        originalSwitchTab(tabId);

        if (tabId === 'photo-storage') {
          console.log('🎯 Photo Storage tab activated');
          setTimeout(() => {
            photoManager.init();
          }, 100);
        }
      };

      console.log('✅ Photo Manager integration completed');
    }
  }, 500);
});