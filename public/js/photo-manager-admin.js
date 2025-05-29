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

  // 🔧 CORRIGIR A FUNÇÃO loadFolderStructure() PARA ARMAZENAR allFolders:

  async loadFolderStructure() {
    try {
      console.log('📂 Loading folder structure...');

      const response = await fetch('/api/admin/folders/leaf?admin=true');
      const data = await response.json();

      if (data.success && data.folders) {
        console.log(`📋 Loaded ${data.folders.length} folders`);

        // 🔧 ARMAZENAR PARA USO NAS VALIDAÇÕES
        this.allFolders = data.folders;

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

  // 🔧 SUBSTITUIR A FUNÇÃO renderFolderTree() POR ESTA VERSÃO COM BOTÕES DELETE:

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

      // 🆕 VERIFICAR SE É PASTA ADMINISTRATIVA (não pode deletar)
      const adminFolders = ['Waiting Payment', 'Sold'];
      const isAdminFolder = adminFolders.includes(folder.name);

      folderDiv.innerHTML = `
      <span class="folder-icon">${icon}</span>
      <span class="folder-name">${folder.name}</span>
      <span class="folder-count">${photoCount}</span>
      ${folder.isLeaf ? `
        <div class="folder-actions">
          <button class="folder-action-btn view-btn" onclick="photoManager.openFolderModal('${folder.id}', '${folder.name.replace(/'/g, '\\\'')}')" title="View Photos">👁️</button>
          ${!isAdminFolder ? `
            <button class="folder-action-btn delete-btn" onclick="photoManager.confirmDeleteFolder('${folder.id}', '${folder.name.replace(/'/g, '\\\'')}')" title="Delete Folder">🗑️</button>
          ` : ''}
        </div>
      ` : `
        <div class="folder-actions">
          ${!isAdminFolder ? `
            <button class="folder-action-btn delete-btn" onclick="photoManager.confirmDeleteFolder('${folder.id}', '${folder.name.replace(/'/g, '\\\'')}')" title="Delete Folder">🗑️</button>
          ` : ''}
        </div>
      `}
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
  async loadFolderPhotos(folderId, folderName) {
    try {
      console.log(`📋 Loading photos for folder: ${folderName || folderId}`);

      const response = await fetch(`/api/photos?category_id=${folderId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const photos = await response.json();
      console.log(`📷 Found ${photos.length} photos`);

      this.currentFolderPhotos = photos;

      // Renderizar fotos
      this.renderPhotosInModal(photos);

    } catch (error) {
      console.error('❌ Error loading folder photos:', error);
      const contentDiv = document.getElementById('photo-modal-content');
      if (contentDiv) {
        contentDiv.innerHTML = `<div class="error">Failed to load photos: ${error.message}</div>`;
      }
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
    console.log('📋 Rendering list mode with checkboxes and delete button');

    const listHTML = `
    <div class="photo-list-header">
      <div class="selection-controls">
        <label class="select-all-label">
          <input type="checkbox" id="select-all-checkbox" onchange="photoManager.toggleSelectAll(this.checked)">
          Select All
        </label>
        <span class="photo-count"><strong>${photos.length}</strong> photos in this folder</span>
      </div>
      <div class="bulk-actions">
        <button class="btn btn-gold btn-sm" onclick="photoManager.moveSelectedPhotos()" id="move-selected-btn" disabled>📦 Move Selected (0)</button>
        <button class="btn btn-danger btn-sm" onclick="photoManager.confirmDeleteSelectedPhotos()" id="delete-selected-btn" disabled>🗑️ Delete Selected (0)</button>
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
          <div class="photo-individual-actions">
            <button class="btn-icon delete-photo-btn" onclick="photoManager.confirmDeleteSinglePhoto('${photo.id}')" title="Delete Photo">🗑️</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
    container.innerHTML = listHTML;
  },

  // Renderizar modo thumbnails COM CHECKBOXES
  renderThumbnailsMode(photos, container) {
    console.log('🖼️ Rendering thumbnails mode with checkboxes and delete button');

    const thumbnailsHTML = `
    <div class="photo-thumbnails-header">
      <div class="selection-controls">
        <label class="select-all-label">
          <input type="checkbox" id="select-all-checkbox" onchange="photoManager.toggleSelectAll(this.checked)">
          Select All
        </label>
        <span class="photo-count"><strong>${photos.length}</strong> photos in this folder</span>
      </div>
      <div class="bulk-actions">
        <button class="btn btn-gold btn-sm" onclick="photoManager.moveSelectedPhotos()" id="move-selected-btn" disabled>📦 Move Selected (0)</button>
        <button class="btn btn-danger btn-sm" onclick="photoManager.confirmDeleteSelectedPhotos()" id="delete-selected-btn" disabled>🗑️ Delete Selected (0)</button>
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
            
            <div class="photo-thumbnail-actions">
              <button class="btn-icon delete-photo-btn" onclick="photoManager.confirmDeleteSinglePhoto('${photo.id}')" title="Delete Photo">🗑️</button>
            </div>
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

    // Atualizar botão de mover
    const moveBtn = document.getElementById('move-selected-btn');
    if (moveBtn) {
      moveBtn.disabled = selectedCount === 0;
      moveBtn.textContent = `📦 Move Selected (${selectedCount})`;
    }

    // 🆕 Atualizar botão de deletar
    const deleteBtn = document.getElementById('delete-selected-btn');
    if (deleteBtn) {
      deleteBtn.disabled = selectedCount === 0;
      deleteBtn.textContent = `🗑️ Delete Selected (${selectedCount})`;
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
            <button class="btn btn-danger" onclick="photoManager.confirmDeleteCurrentPhoto()">🗑️ Delete Photo</button>
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
    console.log('✅ Fullscreen modal created with delete button');
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

      console.log(`📦 Moving ${photoCount} photos from ${sourceFolderId} to ${destinationFolderId}`);
      console.log('📋 Photo IDs:', photoIds);

      showToast(`Moving ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'} to ${destinationName}...`, 'info');

      try {
        const response = await fetch('/api/admin/photos/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        console.log('📡 Move result:', result);

        if (result.success && result.movedCount > 0) {
          console.log(`✅ Successfully moved ${result.movedCount} photos`);

          showToast(`Successfully moved ${result.movedCount} ${result.movedCount === 1 ? 'photo' : 'photos'}`, 'success');

          // 🔧 CORREÇÃO: Verificar se variáveis existem antes de limpar
          console.log('🧹 Cleaning up selections...');

          // Fechar modal primeiro
          this.closeMoveModal();

          // Limpar seleções com verificação de segurança
          if (this.photosToMove && typeof this.photosToMove.clear === 'function') {
            this.photosToMove.clear();
            console.log('✅ photosToMove cleared');
          }

          if (this.selectedPhotos && typeof this.selectedPhotos.clear === 'function') {
            this.selectedPhotos.clear();
            console.log('✅ selectedPhotos cleared');
          }

          // Resetar variável
          this.selectedDestinationFolder = null;
          console.log('✅ selectedDestinationFolder reset');

          // 🎯 ATUALIZAÇÃO DA INTERFACE
          console.log('🔄 Refreshing interface...');

          // Aguardar um pouco para garantir que modal fechou
          setTimeout(async () => {
            try {
              await this.loadStorageStats(true); // forceReload = true
              console.log('✅ Storage stats refreshed');

              await this.loadFolderStructure();
              console.log('✅ Folder structure refreshed');

              // Só recarregar fotos se ainda estiver na mesma pasta
              if (this.currentFolderId && this.currentFolderName) {
                await this.loadFolderPhotos(this.currentFolderId, this.currentFolderName);
                console.log('✅ Folder photos refreshed');
              }

              console.log('✅ Interface refresh completed');
            } catch (refreshError) {
              console.error('❌ Error refreshing interface:', refreshError);
            }
          }, 500);

        } else {
          const errors = result.errors || [];
          if (errors.length > 0) {
            console.warn('⚠️ Move warnings:', errors);
            showToast(`No photos moved: ${errors[0]}`, 'warning');
          } else {
            showToast('No photos were moved', 'warning');
          }
        }

      } catch (fetchError) {
        console.error('❌ Network Error:', fetchError);
        showToast('Network error while moving photos', 'error');
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
  },

  // 🔧 SUBSTITUIR A FUNÇÃO renderStorageStats() por esta versão discreta:

  renderStorageStats(stats) {
    // Atualizar contador discreto
    const discreteCount = document.getElementById('discrete-photo-count');
    if (discreteCount) {
      discreteCount.textContent = `${stats.totalPhotos} photos`;
    }

    // Remover a interface grande de estatísticas (não faz mais nada)
    // Mantém só o contador pequeno no canto

    console.log(`📊 Discrete stats updated: ${stats.totalPhotos} photos`);
  },

  // Renderizar fotos no modal (função que estava faltando)
  renderPhotosInModal(photos) {
    console.log(`🎨 Rendering ${photos.length} photos in ${this.viewMode} mode`);

    const loadingDiv = document.getElementById('photo-modal-loading');
    const contentDiv = document.getElementById('photo-modal-content');

    if (loadingDiv) loadingDiv.style.display = 'none';
    if (contentDiv) contentDiv.style.display = 'block';

    if (this.viewMode === 'list') {
      this.renderListMode(photos, contentDiv);
    } else {
      this.renderThumbnailsMode(photos, contentDiv);
    }

    // Atualizar contador de selecionados
    this.updateSelectionCounter();
  },

  // ===== FUNÇÕES DELETE - PLACEHOLDER (SÓ VISUAL POR ENQUANTO) =====

  // ===== FUNÇÕES DELETE - VERSÃO ROBUSTA COM CONFIRMAÇÕES =====

  // Confirmar exclusão de pasta
  confirmDeleteFolder(folderId, folderName) {
    console.log(`🗑️ Delete folder requested: ${folderName} (${folderId})`);

    // 🔒 VALIDAÇÃO: Verificar se é pasta administrativa
    const adminFolders = ['Waiting Payment', 'Sold'];
    if (adminFolders.includes(folderName)) {
      showToast('Cannot delete administrative folders', 'error');
      return;
    }

    // 🔒 VALIDAÇÃO: Verificar se pasta tem fotos
    const folder = this.allFolders?.find(f => f.id === folderId);
    const photoCount = folder?.fileCount || 0;

    if (photoCount > 0) {
      // Pasta com fotos - confirmação mais rigorosa
      this.showDeleteFolderModal(folderId, folderName, photoCount);
    } else {
      // Pasta vazia - confirmação simples
      showConfirm(
        `Are you sure you want to delete the empty folder "${folderName}"?`,
        () => this.executeDeleteFolder(folderId, folderName, false),
        'Delete Empty Folder'
      );
    }
  },

  // Confirmar exclusão de fotos selecionadas
  confirmDeleteSelectedPhotos() {
    const selectedCount = this.selectedPhotos.size;
    console.log(`🗑️ Delete ${selectedCount} selected photos requested`);

    if (selectedCount === 0) {
      showToast('Please select photos to delete', 'warning');
      return;
    }

    // 🔒 CONFIRMAÇÃO: Lista as fotos que serão deletadas
    const photoIds = Array.from(this.selectedPhotos);
    const photoList = photoIds.slice(0, 5).join(', ');
    const moreText = selectedCount > 5 ? ` and ${selectedCount - 5} more` : '';

    showConfirm(
      `⚠️ PERMANENT DELETION WARNING\n\nYou are about to permanently delete ${selectedCount} ${selectedCount === 1 ? 'photo' : 'photos'}:\n\n${photoList}${moreText}\n\n🚨 This action CANNOT be undone!\n\nAre you absolutely sure?`,
      () => this.executeDeleteSelectedPhotos(),
      'Delete Photos Permanently'
    );
  },

  // Confirmar exclusão de foto única
  confirmDeleteSinglePhoto(photoId) {
    console.log(`🗑️ Delete single photo requested: ${photoId}`);

    showConfirm(
      `⚠️ PERMANENT DELETION WARNING\n\nYou are about to permanently delete photo:\n${photoId}.webp\n\n🚨 This action CANNOT be undone!\n\nAre you absolutely sure?`,
      () => this.executeDeleteSinglePhoto(photoId),
      'Delete Photo Permanently'
    );
  },

  // Confirmar exclusão da foto atual (fullscreen)
  confirmDeleteCurrentPhoto() {
    if (!this.currentFullscreenPhoto) {
      showToast('No photo selected', 'error');
      return;
    }

    const photoId = this.currentFullscreenPhoto.id;
    const photoName = this.currentFullscreenPhoto.name || photoId;

    console.log(`🗑️ Delete current photo requested: ${photoId}`);

    showConfirm(
      `⚠️ PERMANENT DELETION WARNING\n\nYou are about to permanently delete:\n${photoName}\n\n🚨 This action CANNOT be undone!\n\nAre you absolutely sure?`,
      () => {
        this.closeFullscreen(); // Fechar fullscreen primeiro
        this.executeDeleteSinglePhoto(photoId);
      },
      'Delete Photo Permanently'
    );
  },

  // 🆕 NOVO: Modal especial para pasta com fotos
  showDeleteFolderModal(folderId, folderName, photoCount) {
    const modalHTML = `
    <div id="delete-folder-modal" class="modal" style="display: flex; z-index: 15000;">
      <div class="modal-content" style="max-width: 500px;">
        <h2 style="color: #dc3545;">⚠️ Delete Folder Warning</h2>
        
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 15px 0;">
          <p><strong>Folder:</strong> ${folderName}</p>
          <p><strong>Contains:</strong> ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}</p>
          <p style="color: #856404; margin: 0;"><strong>⚠️ All photos in this folder will be permanently deleted!</strong></p>
        </div>
        
        <p>This action will:</p>
        <ul style="color: #dc3545; font-weight: 500;">
          <li>🗑️ Delete all ${photoCount} photos permanently</li>
          <li>🗂️ Remove the folder completely</li>
          <li>📊 Update the folder index</li>
        </ul>
        
        <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 15px; margin: 15px 0;">
          <p style="margin: 0; color: #721c24; font-weight: 600;">🚨 THIS CANNOT BE UNDONE!</p>
        </div>
        
        <p>To confirm this dangerous action, please type: <code>DELETE</code></p>
        <input type="text" id="delete-confirmation-input" class="form-control" placeholder="Type DELETE to confirm" style="margin: 10px 0;">
        
        <div style="display: flex; justify-content: flex-end; gap: 15px; margin-top: 20px;">
          <button class="btn btn-secondary" onclick="photoManager.closeDeleteFolderModal()">Cancel</button>
          <button class="btn btn-danger" onclick="photoManager.confirmDeleteFolderWithText('${folderId}', '${folderName.replace(/'/g, '\\\'')}')" id="confirm-delete-folder-btn" disabled>🗑️ Delete Folder</button>
        </div>
      </div>
    </div>
  `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // 🔒 VALIDAÇÃO: Só habilitar botão se digitou "DELETE"
    const input = document.getElementById('delete-confirmation-input');
    const button = document.getElementById('confirm-delete-folder-btn');

    input.addEventListener('input', () => {
      button.disabled = input.value.trim() !== 'DELETE';
    });

    // Focar no input
    setTimeout(() => input.focus(), 100);
  },

  // Confirmar delete da pasta com validação de texto
  confirmDeleteFolderWithText(folderId, folderName) {
    const input = document.getElementById('delete-confirmation-input');

    if (input.value.trim() !== 'DELETE') {
      showToast('Please type DELETE to confirm', 'error');
      return;
    }

    this.closeDeleteFolderModal();
    this.executeDeleteFolder(folderId, folderName, true);
  },

  // Fechar modal de confirmação de pasta
  closeDeleteFolderModal() {
    const modal = document.getElementById('delete-folder-modal');
    if (modal) {
      modal.remove();
    }
  },

  // Confirmar exclusão de fotos selecionadas
  confirmDeleteSelectedPhotos() {
    const selectedCount = this.selectedPhotos.size;
    console.log(`🗑️ [PLACEHOLDER] Delete ${selectedCount} selected photos requested`);

    if (selectedCount === 0) {
      showToast('Please select photos to delete', 'warning');
      return;
    }

    showToast(`Delete ${selectedCount} photos feature coming soon!`, 'info');
  },

  // Confirmar exclusão de foto única
  confirmDeleteSinglePhoto(photoId) {
    console.log(`🗑️ [PLACEHOLDER] Delete single photo requested: ${photoId}`);
    showToast(`Delete photo feature coming soon!\nPhoto: ${photoId}`, 'info');
  },

  // Confirmar exclusão da foto atual (fullscreen)
  confirmDeleteCurrentPhoto() {
    if (!this.currentFullscreenPhoto) {
      showToast('No photo selected', 'error');
      return;
    }

    const photoId = this.currentFullscreenPhoto.id;
    console.log(`🗑️ [PLACEHOLDER] Delete current photo requested: ${photoId}`);
    showToast(`Delete photo feature coming soon!\nPhoto: ${photoId}`, 'info');
  },

  // Atualizar contador de botões delete (igual ao move)
  updateDeleteButtonsState() {
    const selectedCount = this.selectedPhotos.size;
    const deleteBtn = document.getElementById('delete-selected-btn');

    if (deleteBtn) {
      deleteBtn.disabled = selectedCount === 0;
      deleteBtn.textContent = `🗑️ Delete Selected (${selectedCount})`;
    }
  },

  // 🔧 ADICIONAR ESTAS FUNÇÕES DE EXECUÇÃO NO photoManager:

  // ===== FUNÇÕES DE EXECUÇÃO DELETE =====

  // Executar exclusão de pasta
  async executeDeleteFolder(folderId, folderName, includePhotos) {
    try {
      console.log(`🗑️ Executing delete folder: ${folderName} (includePhotos: ${includePhotos})`);

      showToast(`Deleting folder "${folderName}"...`, 'info');

      const response = await fetch('/api/admin/folders/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: folderId,
          folderName: folderName,
          includePhotos: includePhotos
        })
      });

      console.log(`📡 Delete folder API response: ${response.status}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('📡 Delete folder result:', result);

      if (result.success) {
        const deletedCount = result.deletedPhotos || 0;
        const message = includePhotos
          ? `Successfully deleted folder "${folderName}" and ${deletedCount} photos`
          : `Successfully deleted empty folder "${folderName}"`;

        showToast(message, 'success');

        // 🔄 ATUALIZAR INTERFACE
        console.log('🔄 Refreshing interface after folder deletion...');
        await this.loadStorageStats(true);
        await this.loadFolderStructure();

        console.log('✅ Interface refreshed after folder deletion');

      } else {
        throw new Error(result.message || 'Failed to delete folder');
      }

    } catch (error) {
      console.error('❌ Error deleting folder:', error);
      showToast(`Failed to delete folder: ${error.message}`, 'error');
    }
  },

  // Executar exclusão de fotos selecionadas
  async executeDeleteSelectedPhotos() {
    try {
      const photoIds = Array.from(this.selectedPhotos);
      const photoCount = photoIds.length;

      console.log(`🗑️ Executing delete ${photoCount} selected photos:`, photoIds);

      showToast(`Deleting ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}...`, 'info');

      const response = await fetch('/api/admin/photos/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds: photoIds,
          sourceFolderId: this.currentFolderId
        })
      });

      console.log(`📡 Delete photos API response: ${response.status}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('📡 Delete photos result:', result);

      if (result.success) {
        const deletedCount = result.deletedCount || 0;
        const errors = result.errors || [];

        let message = `Successfully deleted ${deletedCount} ${deletedCount === 1 ? 'photo' : 'photos'}`;
        if (errors.length > 0) {
          message += ` (${errors.length} errors)`;
          console.warn('⚠️ Delete errors:', errors);
        }

        showToast(message, 'success');

        // 🧹 LIMPAR SELEÇÕES
        this.selectedPhotos.clear();
        this.updateSelectionCounter();

        // 🔄 ATUALIZAR INTERFACE
        console.log('🔄 Refreshing interface after photo deletion...');
        await this.loadStorageStats(true);
        await this.loadFolderStructure();

        if (this.currentFolderId) {
          await this.loadFolderPhotos(this.currentFolderId, this.currentFolderName);
        }

        console.log('✅ Interface refreshed after photo deletion');

      } else {
        throw new Error(result.message || 'Failed to delete photos');
      }

    } catch (error) {
      console.error('❌ Error deleting selected photos:', error);
      showToast(`Failed to delete photos: ${error.message}`, 'error');
    }
  },

  // Executar exclusão de foto única
  async executeDeleteSinglePhoto(photoId) {
    try {
      console.log(`🗑️ Executing delete single photo: ${photoId}`);

      showToast(`Deleting photo ${photoId}...`, 'info');

      const response = await fetch('/api/admin/photos/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds: [photoId],
          sourceFolderId: this.currentFolderId
        })
      });

      console.log(`📡 Delete photo API response: ${response.status}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('📡 Delete photo result:', result);

      if (result.success && result.deletedCount > 0) {
        showToast(`Successfully deleted photo ${photoId}`, 'success');

        // 🧹 REMOVER DA SELEÇÃO SE ESTAVA SELECIONADA
        if (this.selectedPhotos.has(photoId)) {
          this.selectedPhotos.delete(photoId);
          this.updateSelectionCounter();
        }

        // 🔄 ATUALIZAR INTERFACE
        console.log('🔄 Refreshing interface after single photo deletion...');
        await this.loadStorageStats(true);
        await this.loadFolderStructure();

        if (this.currentFolderId) {
          await this.loadFolderPhotos(this.currentFolderId, this.currentFolderName);
        }

        console.log('✅ Interface refreshed after single photo deletion');

      } else {
        const errors = result.errors || [];
        const errorMsg = errors.length > 0 ? errors[0] : 'Unknown error';
        throw new Error(errorMsg);
      }

    } catch (error) {
      console.error('❌ Error deleting single photo:', error);
      showToast(`Failed to delete photo: ${error.message}`, 'error');
    }
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