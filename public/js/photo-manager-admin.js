// photo-manager-admin.js
const photoManager = {
  currentStructure: null,
  selectedFolder: null,
  selectedPhotos: new Set(),
  currentFolderPhotos: [],
  currentFolderId: null,
  currentFolderName: '',
  viewMode: 'list',
  photosToMove: null,
  selectedDestinationFolder: null,

  async init() {
    console.log('🚀 Initializing Photo Storage tab...');

    if (document.getElementById('photo-storage')) {
      await this.loadStorageStats();
      await this.loadFolderStructure();

      // 🔄 RESTAURAR UPLOAD EM PROGRESSO (sem alert chato)
      await this.restoreUploadIfNeeded();

      // NOVO: Ativar proteção contra saída
      this.setupUploadProtection();

      // NOVO: Inicializar pesquisa
      this.setupAdminSearch();

      // NOVO: Event listener para fechar menus ao clicar fora
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.folder-actions')) {
          this.closeAllMenus();
        }
      });

      // NOVO: Event listener para fechar menu no scroll
      document.addEventListener('scroll', () => {
        this.closeFloatingMenu();
      }, true);

    }
  },

  checkBrowserCompatibility() {
    const features = {
      fileAPI: window.File && window.FileReader && window.FileList && window.Blob,
      dragDrop: 'draggable' in document.createElement('div'),
      formData: typeof FormData !== 'undefined',
      fetch: typeof fetch !== 'undefined'
    };

    const missingFeatures = Object.keys(features).filter(key => !features[key]);

    if (missingFeatures.length > 0) {
      console.warn('⚠️ Browser compatibility issues:', missingFeatures);
      showToast('Your browser might not support all upload features. Please use a modern browser.', 'warning');
      return false;
    }

    console.log('✅ Browser compatibility check passed');
    return true;
  },

  getFileTypeFromExtension(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    const typeMap = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'gif': 'image/gif'
    };

    return typeMap[extension] || 'application/octet-stream';
  },

  async loadStorageStats(forceReload = false) {
    try {
      console.log('📊 Loading storage stats...');

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

        const stats = {
          totalPhotos: totalPhotos,
          totalFolders: totalFolders,
          usedSpace: (totalPhotos * 2.5).toFixed(2),
          availableSpace: '50.00',
          percentUsed: Math.min(100, (totalPhotos * 2.5 / 50) * 100).toFixed(1)
        };

        console.log(`✅ Stats loaded: ${stats.totalPhotos} photos in ${stats.totalFolders} folders`);

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

        this.allFolders = data.folders;
        // NOVO: Buscar QB Items do Price Management
        console.log('📊 Loading QB Items for Photo Storage...');
        try {
          const qbResponse = await fetch('/api/admin/categories/prices');
          const qbData = await qbResponse.json();

          this.qbItemData = {};
          if (qbData.success && qbData.prices) {
            qbData.prices.forEach(item => {
              if (item.qbItem) {
                this.qbItemData[item.folderId] = item.qbItem;
              }
            });
            console.log(`✅ Loaded ${Object.keys(this.qbItemData).length} QB Items for Photo Storage`);
          }
        } catch (error) {
          console.warn('⚠️ Error loading QB Items:', error);
          this.qbItemData = {};
        }
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

      // Adicionar headers no topo
      const headerDiv = document.createElement('div');
      headerDiv.className = 'folder-headers';
      headerDiv.innerHTML = `
        <span class="header-folder">Folder</span>
        <span class="header-photos">Photos</span>
        <span class="header-qb">QB Item</span>
        <span class="header-actions">Actions</span>
      `;
      container.appendChild(headerDiv);
    }

    folders.forEach(folder => {
      const folderDiv = document.createElement('div');
      folderDiv.className = `folder-item ${folder.isLeaf ? 'folder-leaf' : 'folder-branch'}`;
      folderDiv.style.paddingLeft = `${level * 20}px`;

      const icon = (!folder.children || folder.children.length === 0) ? '📷' : '📁';
      const photoCount = folder.isLeaf ? ` (${folder.fileCount || 0} photos)` : '';

      const adminFolders = ['Waiting Payment', 'Sold'];
      const isAdminFolder = adminFolders.includes(folder.name);

      // Obter QB Item para esta pasta (verificação defensiva)
      const qbItem = (this.qbItemData && this.qbItemData[folder.id]) || 'Not set';
      const tooltipInfo = `QB Item: ${qbItem} | Photos: ${folder.fileCount || 0}`;

      // NOVA LÓGICA: Calcular nome para exibição
      const isLeafFolder = !folder.children || folder.children.length === 0;
      const hasFullPath = folder.folder && folder.folder.path;
      const displayName = (isLeafFolder && hasFullPath) ? folder.folder.path : folder.name;

      // Adicionar tooltip DEPOIS de definir tooltipInfo
      folderDiv.innerHTML = `
        <span class="folder-icon">${icon}</span>
        <span class="folder-name">${displayName}</span>
        <span class="folder-count">${photoCount}</span>
        <span class="folder-qb-info">
          <span class="qb-code">${qbItem !== 'Not set' ? qbItem : '-'}</span>
        </span>
        <div class="folder-actions">
          <button class="menu-trigger" onclick="photoManager.toggleMenu('${folder.id}', event)" title="More actions">⋮</button>
          ${!folder.isLeaf ? `
            <div class="action-menu" id="menu-${folder.id}" style="display: none;">
              ${!isAdminFolder ? `
                <div class="menu-item" onclick="photoManager.confirmDeleteFolder('${folder.id}', '${folder.name.replace(/'/g, '\\\'')}')">🗑️ Delete</div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `;

      if (folder.isLeaf) {
        folderDiv.onclick = (e) => {
          if (!e.target.classList.contains('folder-action-btn')) {
            // Adicionar efeito visual de seleção
            this.selectFolder(folder, folderDiv);
            // Calcular nome completo para o modal
            const isLeafFolder = !folder.children || folder.children.length === 0;
            const hasFullPath = folder.folder && folder.folder.path;
            const modalTitle = (isLeafFolder && hasFullPath) ? folder.folder.path : folder.name;
            // Abrir modal de fotos
            this.openFolderModal(folder.id, modalTitle);
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

  async openFolderModal(folderId, folderName) {
    console.log(`🎯 Opening folder modal: ${folderName} (${folderId})`);

    this.currentFolderId = folderId;
    this.currentFolderName = folderName;
    this.selectedPhotos.clear();

    // CORREÇÃO: Verificação robusta e recriação se necessário
    let modal = document.getElementById('photo-folder-modal');
    let titleElement = document.getElementById('modal-folder-title');

    if (!modal || !titleElement) {
      console.log('🔧 Modal or title element missing, creating/recreating modal...');

      // Remover modal existente se estiver corrompido
      if (modal) {
        modal.remove();
      }

      // Criar novo modal
      this.createFolderModal();

      // AGUARDAR criação completa do DOM
      await new Promise(resolve => setTimeout(resolve, 50));

      // Reobter referências
      modal = document.getElementById('photo-folder-modal');
      titleElement = document.getElementById('modal-folder-title');
    }

    // VERIFICAÇÃO FINAL antes de usar
    if (titleElement) {
      titleElement.textContent = folderName;
    } else {
      console.error('❌ modal-folder-title still not found after recreation');
      showToast('Error opening folder. Please refresh the page.', 'error');
      return;
    }

    if (modal) {
      modal.style.display = 'flex';
    }

    await this.loadFolderPhotos(folderId, folderName);
  },

  createFolderModal() {
    console.log('🏗️ Creating folder modal...');

    const modalHTML = `
      <div id="photo-folder-modal" class="photo-folder-modal" style="display: none;">
        <div class="photo-modal-content">
          <div class="photo-modal-header">
            <h3 id="modal-folder-title">Folder Name</h3>
            <div class="photo-modal-controls">
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

    // VERIFICAÇÃO pós-criação
    setTimeout(() => {
      const titleCheck = document.getElementById('modal-folder-title');
      if (titleCheck) {
        console.log('✅ Folder modal created successfully');
      } else {
        console.error('❌ Modal title element not found after creation');
      }
    }, 10);
  },

  async loadFolderPhotos(folderId, folderName) {
    try {
      console.log(`📋 Loading photos for folder: ${folderName || folderId}`);

      const response = await fetch(`/api/photos?category_id=${folderId}&limit=1000`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const photos = await response.json();
      console.log(`📷 Found ${photos.length} photos`);

      this.currentFolderPhotos = photos;

      this.renderPhotosInModal(photos);

    } catch (error) {
      console.error('❌ Error loading folder photos:', error);
      const contentDiv = document.getElementById('photo-modal-content');
      if (contentDiv) {
        contentDiv.innerHTML = `<div class="error">Failed to load photos: ${error.message}</div>`;
      }
    }
  },

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

    this.updateSelectionCounter();
  },

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
        <button class="btn btn-secondary btn-sm" onclick="photoManager.toggleViewMode()" id="view-mode-btn">🖼️ Switch to Thumbnails</button>
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
        <button class="btn btn-secondary btn-sm" onclick="photoManager.toggleViewMode()" id="view-mode-btn">🖼️ Switch to List</button>
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

  togglePhotoSelection(photoId, selected) {
    console.log(`📋 Toggling photo selection: ${photoId} = ${selected}`);

    if (selected) {
      this.selectedPhotos.add(photoId);
    } else {
      this.selectedPhotos.delete(photoId);
    }

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

  toggleSelectAll(selectAll) {
    console.log(`📋 Toggle select all: ${selectAll}`);

    const checkboxes = document.querySelectorAll('.photo-checkbox');
    this.selectedPhotos.clear();

    checkboxes.forEach(checkbox => {
      checkbox.checked = selectAll;
      if (selectAll) {
        this.selectedPhotos.add(checkbox.value);
      }

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

  updateSelectionCounter() {
    const selectedCount = this.selectedPhotos.size;

    const moveBtn = document.getElementById('move-selected-btn');
    if (moveBtn) {
      moveBtn.disabled = selectedCount === 0;
      moveBtn.textContent = `📦 Move Selected (${selectedCount})`;
    }

    const deleteBtn = document.getElementById('delete-selected-btn');
    if (deleteBtn) {
      deleteBtn.disabled = selectedCount === 0;
      deleteBtn.textContent = `🗑️ Delete Selected (${selectedCount})`;
    }

    console.log(`📊 Selected photos: ${selectedCount}`);
  },

  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    if (selectAllCheckbox) {
      const totalPhotos = this.currentFolderPhotos.length;
      const selectedCount = this.selectedPhotos.size;

      selectAllCheckbox.checked = selectedCount === totalPhotos && totalPhotos > 0;
      selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalPhotos;
    }
  },

  toggleViewMode() {
    this.viewMode = this.viewMode === 'list' ? 'thumbnails' : 'list';
    console.log(`🔄 Switching to ${this.viewMode} mode`);

    const btn = document.getElementById('view-mode-btn');
    btn.textContent = this.viewMode === 'list' ? '🖼️ Switch to Thumbnails' : '📋 Switch to List';

    this.renderPhotosInModal(this.currentFolderPhotos);
  },

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

    this.currentFullscreenPhoto = photo;

    document.getElementById('photo-fullscreen-modal').style.display = 'flex';

    console.log(`✅ Fullscreen opened for: ${photo.name || photoId}`);
  },

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

  closeFolderModal() {
    console.log('🚪 Closing folder modal');
    document.getElementById('photo-folder-modal').style.display = 'none';
    this.selectedPhotos.clear();
    this.currentFolderPhotos = [];
    this.currentFolderId = null;
    this.currentFolderName = '';
  },

  closeFullscreen() {
    console.log('🚪 Closing fullscreen');
    document.getElementById('photo-fullscreen-modal').style.display = 'none';
    this.currentFullscreenPhoto = null;
  },

  moveSinglePhoto() {
    if (!this.currentFullscreenPhoto) {
      showToast('No photo selected', 'error');
      return;
    }

    console.log(`📦 Moving single photo: ${this.currentFullscreenPhoto.id}`);

    const singlePhotoSet = new Set([this.currentFullscreenPhoto.id]);
    this.openMoveModal(singlePhotoSet);
  },

  moveSelectedPhotos() {
    if (this.selectedPhotos.size === 0) {
      showToast('Please select photos to move', 'warning');
      return;
    }

    console.log(`📦 Moving ${this.selectedPhotos.size} selected photos`);
    this.openMoveModal(this.selectedPhotos);
  },

  async openMoveModal(photosToMove) {
    console.log('📦 Opening move modal for photos:', Array.from(photosToMove));

    this.photosToMove = new Set(photosToMove);
    this.selectedDestinationFolder = null;

    if (!document.getElementById('photo-move-modal')) {
      this.createMoveModal();
    }

    document.getElementById('move-modal-title').textContent =
      `Move ${photosToMove.size} ${photosToMove.size === 1 ? 'Photo' : 'Photos'}`;

    document.getElementById('move-source-folder').textContent = this.currentFolderName;

    document.getElementById('photo-move-modal').style.display = 'flex';

    await this.loadFoldersForMove();
  },

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

  async loadFoldersForMove() {
    console.log('📂 Loading folder structure for move...');

    const loadingDiv = document.getElementById('move-folders-loading');
    const treeDiv = document.getElementById('move-folders-tree');

    loadingDiv.style.display = 'block';
    treeDiv.style.display = 'none';

    try {
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

  filterFoldersForMove(folders) {
    const adminFoldersToExclude = ['Waiting Payment', 'Sold'];

    const filterRecursive = (folderList) => {
      return folderList.filter(folder => {
        if (adminFoldersToExclude.includes(folder.name)) {
          return false;
        }

        if (folder.id === this.currentFolderId) {
          return false;
        }

        if (folder.children && folder.children.length > 0) {
          folder.children = filterRecursive(folder.children);
        }

        return true;
      });
    };

    return filterRecursive(folders);
  },

  renderMoveTree(folders, container, level = 0) {
    container.innerHTML = '';

    folders.forEach(folder => {
      const folderDiv = document.createElement('div');
      folderDiv.className = 'move-folder-item';
      folderDiv.style.paddingLeft = `${level * 20}px`;

      const icon = (!folder.children || folder.children.length === 0) ? '📷' : '📁';
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

      if (folder.children && folder.children.length > 0) {
        const childContainer = document.createElement('div');
        childContainer.className = 'move-folder-children';
        container.appendChild(childContainer);
        this.renderMoveTree(folder.children, childContainer, level + 1);
      }
    });
  },

  selectDestinationFolder(folderId, folderName) {
    console.log(`📁 Selected destination folder: ${folderName} (${folderId})`);

    document.querySelectorAll('.move-folder-item').forEach(item => {
      item.classList.remove('selected');
    });

    event.currentTarget.closest('.move-folder-item').classList.add('selected');

    this.selectedDestinationFolder = { id: folderId, name: folderName };
    document.getElementById('move-destination-folder').textContent = folderName;
    document.getElementById('move-destination-folder').style.color = 'var(--color-gold)';

    document.getElementById('confirm-move-btn').disabled = false;
  },

  async confirmMovePhotos() {
    if (!this.selectedDestinationFolder || !this.photosToMove || this.photosToMove.size === 0) {
      showToast('Invalid move operation', 'error');
      return;
    }

    const photoCount = this.photosToMove.size;
    const destinationName = this.selectedDestinationFolder.name;

    console.log(`📦 Confirming move of ${photoCount} photos to: ${destinationName}`);

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

          console.log('🧹 Cleaning up selections...');

          this.closeMoveModal();

          if (this.photosToMove && typeof this.photosToMove.clear === 'function') {
            this.photosToMove.clear();
            console.log('✅ photosToMove cleared');
          }

          if (this.selectedPhotos && typeof this.selectedPhotos.clear === 'function') {
            this.selectedPhotos.clear();
            console.log('✅ selectedPhotos cleared');
          }

          this.selectedDestinationFolder = null;
          console.log('✅ selectedDestinationFolder reset');

          console.log('🔄 Refreshing interface...');

          setTimeout(async () => {
            try {
              await this.loadStorageStats(true);
              console.log('✅ Storage stats refreshed');

              await this.loadFolderStructure();
              console.log('✅ Folder structure refreshed');

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

  closeMoveModal() {
    console.log('🚪 Closing move modal');
    document.getElementById('photo-move-modal').style.display = 'none';
    this.photosToMove = null;
    this.selectedDestinationFolder = null;
  },

  async refreshStructure() {
    console.log('🔄 Refreshing folder structure...');

    try {
      // 🆕 NOVO: Forçar rebuild do índice primeiro
      showToast('Recalculating photo counts...', 'info');

      const rebuildResponse = await fetch('/api/admin/force-rebuild-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const rebuildResult = await rebuildResponse.json();

      if (rebuildResult.success) {
        console.log(`✅ Índice reconstruído: ${rebuildResult.totalPhotos} fotos`);

        // Agora recarregar interface com dados corretos
        await this.loadStorageStats();
        await this.loadFolderStructure();
        showToast(`Counters updated! ${rebuildResult.totalPhotos} photos in ${rebuildResult.totalFolders} categories`, 'success');
      } else {
        throw new Error(rebuildResult.message);
      }

    } catch (error) {
      console.error('❌ Erro no refresh:', error);
      showToast(`Error refreshing: ${error.message}`, 'error');
    }
  },

  renderStorageStats(stats) {
    const discreteCount = document.getElementById('discrete-photo-count');
    if (discreteCount) {
      discreteCount.textContent = `${stats.totalPhotos} photos`;
    }

    console.log(`📊 Discrete stats updated: ${stats.totalPhotos} photos`);
  },

  // NOVA FUNÇÃO: Iniciar processo de rename
  confirmRenameFolder(folderId, folderName) {
    console.log(`✏️ Rename category requested: ${folderName} (${folderId})`);

    // Verificar se é pasta administrativa
    const adminFolders = ['Waiting Payment', 'Sold'];
    if (adminFolders.includes(folderName)) {
      showToast('Cannot rename administrative categories', 'error');
      return;
    }

    this.showRenameFolderModal(folderId, folderName);
  },

  // NOVA FUNÇÃO: Mostrar modal de rename
  showRenameFolderModal(folderId, folderName) {
    // Remover modal existente se houver
    const existingModal = document.getElementById('rename-folder-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modalHTML = `
      <div id="rename-folder-modal" class="modal" style="display: flex; z-index: 15000;">
        <div class="modal-content" style="max-width: 500px;">
          <h2 style="color: #333;">Rename Category</h2>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 15px 0;">
            <p><strong>Current Name:</strong> ${folderName}</p>
            <p style="color: #856404; margin: 0;"><strong>Enter new name for this category:</strong></p>
          </div>
          
          <div style="margin: 15px 0;">
            <label for="new-folder-name" style="display: block; margin-bottom: 5px; font-weight: 600;">New Folder Name:</label>
            <input type="text" id="new-folder-name" class="form-control" value="${folderName}" placeholder="Enter new folder name" style="margin: 10px 0;" maxlength="100">
            <small style="color: #6c757d;">Letters, numbers, spaces, hyphens, and underscores allowed</small>
          </div>
          
          <div style="display: flex; justify-content: flex-end; gap: 15px; margin-top: 20px;">
            <button class="btn btn-secondary" onclick="photoManager.closeRenameFolderModal()">Cancel</button>
            <button class="btn btn-gold" onclick="photoManager.executeRenameFolder('${folderId}', '${folderName.replace(/'/g, '\\\'')}')" id="confirm-rename-btn">Rename Category</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Focar no input e selecionar o texto
    const input = document.getElementById('new-folder-name');
    setTimeout(() => {
      input.focus();
      input.select();
    }, 100);
  },

  // NOVA FUNÇÃO: Fechar modal de rename
  closeRenameFolderModal() {
    const modal = document.getElementById('rename-folder-modal');
    if (modal) {
      modal.remove();
    }
  },

  // NOVA FUNÇÃO: Executar rename da categoria
  async executeRenameFolder(folderId, currentName) {
    try {
      const input = document.getElementById('new-folder-name');
      const newName = input.value.trim();

      // Validações
      if (!newName) {
        showToast('Category name cannot be empty', 'error');
        input.focus();
        return;
      }

      if (newName === currentName) {
        showToast('New name must be different from current name', 'error');
        input.focus();
        return;
      }

      // Validar caracteres permitidos
      const validNameRegex = /^[a-zA-Z0-9\s\-_&]+$/;
      if (!validNameRegex.test(newName)) {
        showToast('Category name can only contain letters, numbers, spaces, hyphens, underscores and ampersands', 'error');
        input.focus();
        return;
      }

      if (newName.length > 100) {
        showToast('Category name must be 100 characters or less', 'error');
        input.focus();
        return;
      }

      console.log(`✏️ Executing rename: "${currentName}" → "${newName}"`);

      // Fechar modal antes da requisição
      this.closeRenameFolderModal();

      // Mostrar loading
      showToast(`Renaming category to "${newName}"...`, 'info');

      // Fazer requisição para API
      const response = await fetch('/api/photos/admin/folder/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          folderId: folderId,
          newName: newName
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log(`✅ Category renamed successfully: ${result.message}`);

        // Mostrar sucesso
        showToast(`Category renamed to "${newName}" successfully!`, 'success');

        // Atualizar interface
        await this.updateInterfaceAfterRename(folderId, newName);

      } else {
        console.error('❌ Rename failed:', result);

        // Verificar se é erro de nome duplicado
        if (result.message && result.message.includes('already exists')) {
          showToast(`A category named "${newName}" already exists. Please choose a different name.`, 'error');
        } else {
          showToast(`Failed to rename category: ${result.message || 'Unknown error'}`, 'error');
        }
      }

    } catch (error) {
      console.error('❌ Error renaming category:', error);
      showToast(`Error renaming category: ${error.message}`, 'error');
    }
  },

  // NOVA FUNÇÃO: Atualizar interface após rename
  async updateInterfaceAfterRename(folderId, newName) {
    try {
      console.log(`🔄 Updating interface after rename: ${folderId} → ${newName}`);

      // Atualizar nome na árvore de pastas
      const folderElements = document.querySelectorAll('.folder-item');
      folderElements.forEach(element => {
        const viewButton = element.querySelector(`[onclick*="${folderId}"]`);
        if (viewButton) {
          const nameSpan = element.querySelector('.folder-name');
          if (nameSpan) {
            nameSpan.textContent = newName;
            console.log(`✅ Updated folder name in tree: ${newName}`);
          }
        }
      });

      // Recarregar estrutura completa para garantir consistência
      setTimeout(async () => {
        await this.loadFolderStructure();
        console.log('✅ Folder structure reloaded after rename');
      }, 1000);

    } catch (error) {
      console.error('❌ Error updating interface after rename:', error);
    }
  },

  confirmDeleteFolder(folderId, folderName) {
    console.log(`🗑️ Delete folder requested: ${folderName} (${folderId})`);

    const adminFolders = ['Waiting Payment', 'Sold'];
    if (adminFolders.includes(folderName)) {
      showToast('Cannot delete administrative folders', 'error');
      return;
    }

    const folder = this.allFolders?.find(f => f.id === folderId);
    const photoCount = folder?.fileCount || 0;

    if (photoCount > 0) {
      this.showDeleteFolderModal(folderId, folderName, photoCount);
    } else {
      showConfirm(
        `Are you sure you want to delete the empty folder "${folderName}"?`,
        () => this.executeDeleteFolder(folderId, folderName, false),
        'Delete Empty Folder'
      );
    }
  },

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

  confirmDeleteSinglePhoto(photoId) {
    console.log(`🗑️ Delete single photo requested: ${photoId}`);

    showConfirm(
      `⚠️ PERMANENT DELETION WARNING\n\nYou are about to permanently delete photo:\n${photoId}.webp\n\n🚨 This action CANNOT be undone!\n\nAre you absolutely sure?`,
      () => this.executeDeleteSinglePhoto(photoId),
      'Delete Photo Permanently'
    );
  },

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

    const input = document.getElementById('delete-confirmation-input');
    const button = document.getElementById('confirm-delete-folder-btn');

    input.addEventListener('input', () => {
      button.disabled = input.value.trim() !== 'DELETE';
    });

    setTimeout(() => input.focus(), 100);
  },

  confirmDeleteFolderWithText(folderId, folderName) {
    const input = document.getElementById('delete-confirmation-input');

    if (input.value.trim() !== 'DELETE') {
      showToast('Please type DELETE to confirm', 'error');
      return;
    }

    this.closeDeleteFolderModal();
    this.executeDeleteFolder(folderId, folderName, true);
  },

  closeDeleteFolderModal() {
    const modal = document.getElementById('delete-folder-modal');
    if (modal) {
      modal.remove();
    }
  },

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
        const deletedFoldersCount = result.deletedFolders || 0;

        // Criar mensagem dinâmica baseada no que foi deletado
        let message = `Successfully deleted folder "${folderName}"`;

        const details = [];
        if (deletedCount > 0) {
          details.push(`${deletedCount} photo${deletedCount !== 1 ? 's' : ''}`);
        }
        if (deletedFoldersCount > 0) {
          details.push(`${deletedFoldersCount} subfolder${deletedFoldersCount !== 1 ? 's' : ''}`);
        }

        if (details.length > 0) {
          message += ` with ${details.join(' and ')}`;
        }

        showToast(message, 'success');

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

        this.selectedPhotos.clear();
        this.updateSelectionCounter();

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

        if (this.selectedPhotos.has(photoId)) {
          this.selectedPhotos.delete(photoId);
          this.updateSelectionCounter();
        }

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
  },

  openUploadModal() {
    console.log('🔺 Opening upload modal...');

    if (!this.checkBrowserCompatibility()) {
      return;
    }

    if (!document.getElementById('photo-upload-modal')) {
      this.createUploadModal();
    }

    this.loadFoldersForUpload();

    document.getElementById('photo-upload-modal').style.display = 'flex';
  },

  createUploadModal() {
    console.log('🏗️ Creating upload modal...');

    const uploadModalHTML = `
      <div id="photo-upload-modal" class="photo-upload-modal" style="display: none;">
        <div class="upload-modal-content">
          <div class="upload-modal-header">
            <h3>📸 Upload Photos</h3>
            <button class="upload-modal-close" onclick="photoManager.closeUploadModal()">&times;</button>
          </div>
          
          <div class="upload-modal-body">
            <div class="upload-step" id="upload-step-1">
              <h4>Step 1: Select Destination Folder</h4>
              <p>Choose where to upload your photos:</p>
              
              <div class="upload-folder-selection">
                <div id="upload-folders-loading" class="loading">Loading folders...</div>
                <div id="upload-folders-tree" style="display: none;"></div>
              </div>
              
              <div class="upload-selected-folder" style="display: none;">
                <p><strong>Selected:</strong> <span id="upload-destination-name"></span></p>
                <button class="btn btn-gold" id="next-to-files-btn" onclick="photoManager.goToFileSelection()">Next: Select Photos →</button>
              </div>
            </div>
            
            <div class="upload-step" id="upload-step-2" style="display: none;">
              <h4>Step 2: Select Photos</h4>
              <p>Choose photos from your computer:</p>
              
              <div class="file-upload-area">
                <input type="file" id="photo-files-input" multiple accept="image/*" style="display: none;">
                <div class="file-drop-zone" onclick="document.getElementById('photo-files-input').click()">
                  <div class="drop-zone-content">
                    <span class="drop-icon">📁</span>
                    <p>Click to select photos or drag & drop here</p>
                    <small>Supports: JPG, PNG, WebP</small>
                  </div>
                </div>
              </div>
              
              <div class="selected-files-preview" id="selected-files-preview" style="display: none;"></div>
              
              <div class="upload-actions" style="display: none;">
                <button class="btn btn-secondary" onclick="photoManager.goBackToFolderSelection()">← Back</button>
                <button class="btn btn-gold" onclick="photoManager.startUpload()" id="start-upload-btn">🔺 Upload Photos</button>
              </div>
            </div>
            
            <div class="upload-step" id="upload-step-3" style="display: none;">
              <h4>Uploading Photos...</h4>
              
              <div class="upload-progress-container">
                <div class="upload-progress-bar">
                  <div class="upload-progress-fill" id="upload-progress-fill" style="width: 0%"></div>
                </div>
                <div class="upload-progress-text" id="upload-progress-text">Preparing upload...</div>
              </div>
              
              <div class="upload-status" id="upload-status"></div>
            </div>
          </div>
          
          <div class="upload-modal-footer">
            <button class="btn btn-secondary" onclick="photoManager.closeUploadModal()">Cancel</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', uploadModalHTML);
    console.log('✅ Upload modal created');
  },

  async loadFoldersForUpload() {
    console.log('📂 Loading folders for upload...');

    const loadingDiv = document.getElementById('upload-folders-loading');
    const treeDiv = document.getElementById('upload-folders-tree');

    // VERIFICAR se elementos existem
    if (!loadingDiv || !treeDiv) {
      console.error('❌ Upload modal elements not found - recreating modal');
      this.createUploadModal();
      return this.loadFoldersForUpload(); // Tentar novamente
    }

    loadingDiv.style.display = 'block';
    treeDiv.style.display = 'none';

    try {
      const foldersForUpload = this.filterFoldersForUpload(this.currentStructure);

      if (foldersForUpload.length === 0) {
        treeDiv.innerHTML = '<div class="empty-message">No available folders for upload</div>';
      } else {
        this.renderUploadTree(foldersForUpload, treeDiv);
      }

      loadingDiv.style.display = 'none';
      treeDiv.style.display = 'block';

    } catch (error) {
      console.error('❌ Error loading folders for upload:', error);
      treeDiv.innerHTML = `<div class="error">Failed to load folders: ${error.message}</div>`;
      loadingDiv.style.display = 'none';
      treeDiv.style.display = 'block';
    }
  },

  filterFoldersForUpload(folders) {
    const adminFoldersToExclude = ['Waiting Payment', 'Sold'];

    const filterRecursive = (folderList) => {
      return folderList.filter(folder => {
        if (adminFoldersToExclude.includes(folder.name)) {
          return false;
        }

        if (folder.children && folder.children.length > 0) {
          folder.children = filterRecursive(folder.children);
        }

        return true;
      });
    };

    return filterRecursive(folders);
  },

  renderUploadTree(folders, container, level = 0) {
    container.innerHTML = '';

    folders.forEach(folder => {
      const folderDiv = document.createElement('div');
      folderDiv.className = 'upload-folder-item';
      folderDiv.style.paddingLeft = `${level * 20}px`;

      const icon = (!folder.children || folder.children.length === 0) ? '📷' : '📁';
      const photoCount = folder.isLeaf ? ` (${folder.fileCount || 0} photos)` : '';

      folderDiv.innerHTML = `
      <div class="upload-folder-content" onclick="photoManager.selectUploadDestination('${folder.id}', '${folder.name.replace(/'/g, '\\\'')}')" ${folder.isLeaf ? 'data-selectable="true"' : ''}>
        <span class="upload-folder-icon">${icon}</span>
        <span class="upload-folder-name">${folder.name}</span>
        <span class="upload-folder-count">${photoCount}</span>
        ${folder.isLeaf ? '<span class="upload-folder-action">Click to select</span>' : ''}
      </div>
    `;

      container.appendChild(folderDiv);

      if (folder.children && folder.children.length > 0) {
        const childContainer = document.createElement('div');
        childContainer.className = 'upload-folder-children';
        container.appendChild(childContainer);
        this.renderUploadTree(folder.children, childContainer, level + 1);
      }
    });
  },

  selectUploadDestination(folderId, folderName) {
    console.log(`📁 Selecting upload destination: ${folderName} (${folderId})`);

    this.selectedUploadDestination = {
      id: folderId,
      name: folderName,
      path: []
    };

    document.querySelectorAll('.upload-folder-item').forEach(item => {
      item.classList.remove('selected');
    });

    if (event && event.currentTarget) {
      event.currentTarget.closest('.upload-folder-item').classList.add('selected');
    }

    const destinationNameSpan = document.getElementById('upload-destination-name');
    const selectedFolderDiv = document.querySelector('.upload-selected-folder');

    if (destinationNameSpan) {
      destinationNameSpan.textContent = folderName;
    }

    if (selectedFolderDiv) {
      selectedFolderDiv.style.display = 'block';
    }

    console.log('✅ Upload destination selected:', this.selectedUploadDestination);
  },

  goToFileSelection() {
    console.log('📁 Going to file selection step...');

    document.getElementById('upload-step-1').style.display = 'none';
    document.getElementById('upload-step-2').style.display = 'block';

    this.initializeFileUpload();
  },

  initializeFileUpload() {
    console.log('📎 Initializing file upload functionality...');

    const fileInput = document.getElementById('photo-files-input');
    const dropZone = document.querySelector('.file-drop-zone');

    this.selectedFiles = [];
    this.updateFilePreview();

    fileInput.addEventListener('change', (e) => {
      this.handleFileSelection(e.target.files);
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      this.handleFileSelection(e.dataTransfer.files);
    });

    console.log('✅ File upload functionality initialized');
  },

  handleFileSelection(files) {
    console.log(`📎 Processing ${files.length} selected files...`);

    const validFiles = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validation = this.validateFile(file);

      if (validation.valid) {
        validFiles.push(file);
        console.log(`✅ Valid file: ${file.name} (${this.formatFileSize(file.size)})`);
      } else {
        errors.push(`${file.name}: ${validation.error}`);
        console.warn(`❌ Invalid file: ${file.name} - ${validation.error}`);
      }
    }

    if (errors.length > 0) {
      const errorMsg = `Some files were rejected:\n\n${errors.slice(0, 5).join('\n')}`;
      showToast(errorMsg, 'warning');
    }

    if (validFiles.length > 0) {
      this.selectedFiles = [...this.selectedFiles, ...validFiles];
      this.updateFilePreview();

      showToast(`Added ${validFiles.length} ${validFiles.length === 1 ? 'photo' : 'photos'}`, 'success');
    }

    console.log(`📊 Total selected files: ${this.selectedFiles.length}`);
  },

  validateFile(file) {
    let fileType = file.type;
    if (!fileType || fileType === 'application/octet-stream') {
      fileType = this.getFileTypeFromExtension(file.name);
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(fileType)) {
      return {
        valid: false,
        error: 'Invalid file type. Only JPG, PNG, and WebP are allowed.'
      };
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File too large (${this.formatFileSize(file.size)}). Maximum size is 10MB.`
      };
    }

    if (file.size === 0) {
      return {
        valid: false,
        error: 'File is empty.'
      };
    }

    if (file.name.length > 100) {
      return {
        valid: false,
        error: 'Filename too long. Maximum 100 characters.'
      };
    }

    const invalidChars = /[<>:"/\\|?*]/g;
    if (invalidChars.test(file.name)) {
      return {
        valid: false,
        error: 'Filename contains invalid characters.'
      };
    }

    return { valid: true };
  },

  updateFilePreview() {
    const previewContainer = document.getElementById('selected-files-preview');
    const uploadActions = document.querySelector('.upload-actions');
    const startUploadBtn = document.getElementById('start-upload-btn');

    if (this.selectedFiles.length === 0) {
      previewContainer.style.display = 'none';
      uploadActions.style.display = 'none';
      return;
    }

    previewContainer.style.display = 'block';
    uploadActions.style.display = 'flex';

    const totalSize = this.selectedFiles.reduce((sum, file) => sum + file.size, 0);
    const totalSizeFormatted = this.formatFileSize(totalSize);

    const previewHTML = `
    <div class="files-summary">
      <h5>📸 Selected Photos (${this.selectedFiles.length})</h5>
      <p>Total size: ${totalSizeFormatted}</p>
      <button class="btn btn-secondary btn-sm" onclick="photoManager.clearSelectedFiles()">Clear All</button>
    </div>
    
    <div class="files-grid">
      ${this.selectedFiles.map((file, index) => `
        <div class="file-preview-item" data-index="${index}">
          <div class="file-preview-image">
            <img src="${URL.createObjectURL(file)}" alt="${file.name}" 
                 onload="this.style.opacity=1" style="opacity:0; transition: opacity 0.3s ease;">
          </div>
          <div class="file-preview-info">
            <div class="file-name">${this.truncateFileName(file.name, 20)}</div>
            <div class="file-size">${this.formatFileSize(file.size)}</div>
          </div>
          <button class="file-remove-btn" onclick="photoManager.removeFile(${index})" title="Remove file">×</button>
        </div>
      `).join('')}
    </div>
  `;

    previewContainer.innerHTML = previewHTML;

    startUploadBtn.textContent = `🔺 Upload ${this.selectedFiles.length} ${this.selectedFiles.length === 1 ? 'Photo' : 'Photos'}`;

    console.log(`📊 Preview updated: ${this.selectedFiles.length} files (${totalSizeFormatted})`);
  },

  removeFile(index) {
    console.log(`🗑️ Removing file at index: ${index}`);

    if (index >= 0 && index < this.selectedFiles.length) {
      const removedFile = this.selectedFiles[index];
      this.selectedFiles.splice(index, 1);

      console.log(`✅ Removed file: ${removedFile.name}`);

      this.updateFilePreview();
      showToast(`Removed ${removedFile.name}`, 'info');
    }
  },

  clearSelectedFiles() {
    console.log('🧹 Clearing all selected files...');

    this.selectedFiles = [];
    this.updateFilePreview();

    const fileInput = document.getElementById('photo-files-input');
    if (fileInput) {
      fileInput.value = '';
    }

    showToast('All files cleared', 'info');
  },

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  truncateFileName(fileName, maxLength) {
    if (fileName.length <= maxLength) return fileName;

    const extension = fileName.split('.').pop();
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
    const truncatedName = nameWithoutExt.substring(0, maxLength - extension.length - 4) + '...';

    return truncatedName + '.' + extension;
  },

  // 🎯 VERSÃO ASSÍNCRONA DA FUNÇÃO startUpload() - MODAL FECHA IMEDIATAMENTE
  async startUpload() {
    let uploadBtn = null;
    let originalText = '';

    try {
      console.log('🚀 Starting real photo upload...');

      const destination = this.selectedUploadDestination;
      const files = this.selectedFiles;

      if (!destination || !destination.id) {
        console.log('❌ Destination not found');
        showToast('Please select destination folder again', 'error');
        return;
      }

      if (!files || files.length === 0) {
        console.log('❌ No files selected');
        showToast('Please select files to upload', 'error');
        return;
      }

      console.log('✅ Validation passed - proceeding with upload');

      const fileCount = files.length;
      const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(1);

      console.log(`📦 Starting upload of ${fileCount} files (${totalSizeMB}MB) to "${destination.name}"`);

      const currentPhotoCount = await this.getCurrentPhotoCount(destination.id);
      const expectedFinalCount = currentPhotoCount + fileCount;

      console.log(`📊 Current photos in destination: ${currentPhotoCount}`);
      console.log(`📊 Expected final count: ${expectedFinalCount}`);

      // NOVO: Salvar estado do upload para proteção
      this.saveUploadState(destination, files, expectedFinalCount);

      // 🎯 MARCAR PASTA COMO UPLOADANDO (SÓ A SETINHA 📤)
      this.startRealUploadMonitoring(destination.id, destination.name, fileCount, expectedFinalCount);

      const formData = new FormData();
      formData.append('destinationFolderId', destination.id);

      console.log('📦 Adding files to FormData...');
      Array.from(files).forEach((file, index) => {
        console.log(`📎 File ${index + 1}: ${file.name} (${this.formatFileSize(file.size)})`);
        formData.append('photos', file);
      });

      // NOVO: Toast imediato e fechar modal
      showToast(`Upload started! ${fileCount} photos uploading in background...`, 'success');
      this.closeUploadModal(); // FECHAR MODAL IMEDIATAMENTE

      // NOVO: Iniciar upload em background (sem await)
      this.performBackgroundUpload(formData, destination, fileCount, expectedFinalCount);

    } catch (error) {
      console.error('❌ Upload error:', error);
      showToast(`Upload failed: ${error.message}`, 'error');

      if (this.selectedUploadDestination) {
        this.stopUploadMonitoring(this.selectedUploadDestination.id);
      }
    }
  },

  // NOVA FUNÇÃO: Upload em background com retry E detecção de rede
  async performBackgroundUpload(formData, destination, fileCount, expectedFinalCount) {
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📡 Upload attempt ${attempt}/${maxRetries}...`);
        console.log('📡 Sending upload request...');
        console.log('⏰ This may take several minutes for large files...');

        // Verificar conectividade antes do upload
        if (!navigator.onLine) {
          throw new Error('No internet connection detected');
        }

        // Timeout de 10 minutos + detecção de rede
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.log('⏰ Upload timeout - network may be slow or disconnected');
        }, 600000);

        const response = await fetch('/api/admin/photos/upload', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        console.log(`📡 Response status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.log('📡 Error response:', errorText);
          throw new Error(`Server error ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log('📡 Server response:', result);

        if (result.success && result.uploadedCount > 0) {
          console.log('✅ Upload request successful!');
          console.log('⏰ Files are now being processed on server...');
          console.log('🔄 Monitoring will continue until photos appear in folder...');

          // Limpar estado salvo
          this.clearUploadState(destination.id);
          return; // Sucesso, sair do loop
        } else {
          throw new Error(result.message || 'Upload failed');
        }

      } catch (error) {
        console.error(`❌ Upload attempt ${attempt} failed:`, error);

        // Detectar tipos específicos de erro
        let errorMessage = '';
        let retryRecommended = true;

        if (error.name === 'AbortError') {
          errorMessage = 'Upload timed out - check your internet connection';
          retryRecommended = true;
        } else if (!navigator.onLine) {
          errorMessage = 'Internet connection lost';
          retryRecommended = false; // Não adianta retry sem internet
        } else if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
          errorMessage = 'Network error - check your connection';
          retryRecommended = true;
        } else if (error.message.includes('No internet connection')) {
          errorMessage = 'No internet connection detected';
          retryRecommended = false;
        } else if (error.message.includes('Server error 5')) {
          errorMessage = 'Server error - please try again later';
          retryRecommended = true;
        } else {
          errorMessage = error.message || 'Unknown upload error';
          retryRecommended = true;
        }

        if (attempt === maxRetries) {
          // Última tentativa falhou
          if (!navigator.onLine) {
            showToast('❌ Upload failed: No internet connection. Please check your connection and try again.', 'error');
          } else {
            showToast(`❌ Upload failed: ${errorMessage}. Please try again.`, 'error');
          }
          this.stopUploadMonitoring(destination.id);
          this.clearUploadState(destination.id);
        } else {
          // Decidir se vale a pena tentar novamente
          if (!retryRecommended && !navigator.onLine) {
            showToast('❌ Upload failed: No internet connection. Please check your connection and try again.', 'error');
            this.stopUploadMonitoring(destination.id);
            this.clearUploadState(destination.id);
            break; // Sair do loop - não adianta retry
          } else {
            // Tentar novamente
            showToast(`⚠️ ${errorMessage}, retrying... (${attempt}/${maxRetries})`, 'warning');

            // Esperar mais tempo se for erro de rede
            const retryDelay = errorMessage.includes('Network') || errorMessage.includes('connection') ? 5000 : 3000;
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      }
    }
  },

  // NOVA FUNÇÃO: Salvar estado do upload
  saveUploadState(destination, files, expectedFinalCount) {
    try {
      const uploadState = {
        destinationId: destination.id,
        destinationName: destination.name,
        fileCount: files.length,
        expectedFinalCount: expectedFinalCount,
        timestamp: Date.now()
      };

      let activeUploads = JSON.parse(localStorage.getItem('activeUploads') || '{}');
      activeUploads[destination.id] = uploadState;
      localStorage.setItem('activeUploads', JSON.stringify(activeUploads));

      console.log('💾 Upload state saved for protection');
    } catch (error) {
      console.warn('Could not save upload state:', error);
    }
  },

  // NOVA FUNÇÃO: Limpar estado do upload
  clearUploadState(destinationId) {
    try {
      let activeUploads = JSON.parse(localStorage.getItem('activeUploads') || '{}');
      delete activeUploads[destinationId];
      localStorage.setItem('activeUploads', JSON.stringify(activeUploads));

      console.log('🧹 Upload state cleared');
    } catch (error) {
      console.warn('Could not clear upload state:', error);
    }
  },

  // NOVA FUNÇÃO: Verificar se há uploads ativos
  hasActiveUploads() {
    try {
      const activeUploads = JSON.parse(localStorage.getItem('activeUploads') || '{}');
      return Object.keys(activeUploads).length > 0;
    } catch (error) {
      return false;
    }
  },

  closeUploadModal() {
    console.log('🚪 Closing upload modal with full cleanup...');

    const modal = document.getElementById('photo-upload-modal');
    if (modal) {
      modal.style.display = 'none';

      this.resetUploadModal();
    }
  },

  resetUploadModal() {
    console.log('🧹 Performing full upload modal reset...');

    document.getElementById('upload-step-1').style.display = 'block';
    document.getElementById('upload-step-2').style.display = 'none';
    document.getElementById('upload-step-3').style.display = 'none';
    document.querySelector('.upload-selected-folder').style.display = 'none';

    this.selectedUploadFolder = null;

    if (this.selectedFiles && this.selectedFiles.length > 0) {
      this.selectedFiles.forEach(file => {
        const img = document.querySelector(`img[src^="blob:"][alt="${file.name}"]`);
        if (img && img.src.startsWith('blob:')) {
          URL.revokeObjectURL(img.src);
        }
      });
    }

    this.selectedFiles = [];

    const fileInput = document.getElementById('photo-files-input');
    if (fileInput) {
      fileInput.value = '';

      const newFileInput = fileInput.cloneNode(true);
      fileInput.parentNode.replaceChild(newFileInput, fileInput);
    }

    document.querySelectorAll('.upload-folder-item').forEach(item => {
      item.classList.remove('selected');
    });

    const progressFill = document.getElementById('upload-progress-fill');
    const progressText = document.getElementById('upload-progress-text');
    const statusDiv = document.getElementById('upload-status');

    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = 'Preparing upload...';
    if (statusDiv) statusDiv.innerHTML = '';

    console.log('✅ Upload modal reset completed');
  },

  goBackToFolderSelection() {
    console.log('📁 Going back to folder selection...');

    if (this.selectedFiles && this.selectedFiles.length > 0) {
      showConfirm(
        `You have ${this.selectedFiles.length} ${this.selectedFiles.length === 1 ? 'photo' : 'photos'} selected.\n\nDo you want to keep them or start over?`,
        () => {
          document.getElementById('upload-step-2').style.display = 'none';
          document.getElementById('upload-step-1').style.display = 'block';
        },
        () => {
          this.clearSelectedFiles();
          document.getElementById('upload-step-2').style.display = 'none';
          document.getElementById('upload-step-1').style.display = 'block';
        },
        'Keep Files',
        'Start Over'
      );
    } else {
      document.getElementById('upload-step-2').style.display = 'none';
      document.getElementById('upload-step-1').style.display = 'block';
    }
  },

  findFolderByName(folderName) {
    if (!this.currentStructure) return null;

    const searchRecursive = (folders) => {
      for (const folder of folders) {
        if (folder.name === folderName && folder.isLeaf) {
          return folder;
        }
        if (folder.children && folder.children.length > 0) {
          const result = searchRecursive(folder.children);
          if (result) return result;
        }
      }
      return null;
    };

    return searchRecursive(this.currentStructure);
  },

  // 🎯 VERSÃO LIMPA - SÓ MARCA A SETINHA 📤 (SEM TEXTO CHATO)
  markFolderAsUploading(folderId, folderName, fileCount) {
    console.log(`🔄 Marking folder as uploading: ${folderName} (${fileCount} files)`);

    const folderElements = document.querySelectorAll('.folder-item');
    folderElements.forEach(element => {
      const viewButton = element.querySelector(`[onclick*="${folderId}"]`);
      if (viewButton) {
        // ✅ MANTER APENAS: Classe de upload (para a setinha 📤)
        element.classList.add('folder-uploading');
      }
    });
  },

  unmarkFolderAsUploading(folderId) {
    console.log(`✅ Removing upload loading state from folder: ${folderId}`);

    const folderElements = document.querySelectorAll('.folder-item.folder-uploading');
    folderElements.forEach(element => {
      const viewButton = element.querySelector(`[onclick*="${folderId}"]`);
      if (viewButton) {
        element.classList.remove('folder-uploading');

        const countSpan = element.querySelector('.folder-count');
        if (countSpan && countSpan.dataset.originalText) {
          countSpan.textContent = countSpan.dataset.originalText;
          delete countSpan.dataset.originalText;
        }

        const eyeButton = element.querySelector('.view-btn');
        if (eyeButton) {
          eyeButton.disabled = false;
          eyeButton.style.opacity = '1';
          eyeButton.title = 'View Photos';
        }
      }
    });
  },

  async updateInterfaceAfterUpload(destination, uploadedCount) {
    try {
      console.log('🔄 Interface update - REAL monitoring will handle this...');

      console.log('✅ Interface update delegated to real monitoring system');

    } catch (error) {
      console.error('❌ Error in interface update:', error);
    }
  },

  async validateFolderId(folderId, folderName) {
    try {
      console.log(`🔍 Validating folder ID: ${folderId} (${folderName})`);

      const response = await fetch(`/api/photos?category_id=${folderId}&limit=1`);

      if (response.ok) {
        const photos = await response.json();
        console.log(`✅ Folder ID validated: ${folderId}`);
        return { valid: true, folderId: folderId };
      } else {
        console.log(`⚠️ Folder ID may have changed: ${folderId}`);

        const currentFolder = this.findFolderByName(folderName);
        if (currentFolder) {
          console.log(`🔄 Found folder with new ID: ${currentFolder.id}`);
          return { valid: false, newFolderId: currentFolder.id, oldFolderId: folderId };
        }
      }

      return { valid: false };

    } catch (error) {
      console.error('Error validating folder ID:', error);
      return { valid: false };
    }
  },

  async getCurrentPhotoCount(folderId) {
    try {
      console.log(`🔍 Getting photo count for folder: ${folderId}`);

      const photosResponse = await fetch(`/api/photos?category_id=${folderId}`);
      if (photosResponse.ok) {
        const photos = await photosResponse.json();
        console.log(`📊 Strategy 1 - Photos API: ${photos.length} photos`);
        if (photos.length > 0) {
          return photos.length;
        }
      }

      const statsResponse = await fetch(`/api/admin/folders/leaf`);
      if (statsResponse.ok) {
        const data = await statsResponse.json();
        if (data.success && data.folders) {
          const folder = data.folders.find(f => f.id === folderId);
          if (folder) {
            console.log(`📊 Strategy 2 - Stats API: ${folder.fileCount || 0} photos`);
            return folder.fileCount || 0;
          }
        }
      }

      if (this.allFolders) {
        const folder = this.allFolders.find(f => f.id === folderId);
        if (folder) {
          console.log(`📊 Strategy 3 - Local cache: ${folder.fileCount || 0} photos`);
          return folder.fileCount || 0;
        }
      }

      console.warn(`⚠️ Could not get photo count for folder: ${folderId}`);
      return 0;

    } catch (error) {
      console.error('❌ Error getting current photo count:', error);
      return 0;
    }
  },

  // 🎯 VERSÃO LIMPA DO MONITORAMENTO - SEM INDICADORES CHATOS
  startRealUploadMonitoring(folderId, folderName, uploadingCount, expectedFinalCount, isRestoring = false) {
    console.log(`🔄 Starting REAL upload monitoring for: ${folderName} (restoring: ${isRestoring})`);
    console.log(`📊 Expecting ${expectedFinalCount} photos when complete`);

    // ✅ MANTER APENAS: Setinha na pasta
    this.markFolderAsUploading(folderId, folderName, uploadingCount);

    if (this.uploadMonitoringIntervals && this.uploadMonitoringIntervals.has(folderId)) {
      clearInterval(this.uploadMonitoringIntervals.get(folderId));
    }

    const monitoringInterval = setInterval(async () => {
      try {
        console.log(`🔍 Checking photo count for ${folderName}...`);

        const currentCount = await this.getCurrentPhotoCount(folderId);
        console.log(`📊 Current count: ${currentCount}, Expected: ${expectedFinalCount}`);

        if (currentCount >= expectedFinalCount) {
          console.log(`✅ Upload completed! ${folderName} now has ${currentCount} photos`);

          clearInterval(monitoringInterval);
          this.stopUploadMonitoring(folderId);

          this.updateSpecificFolder(folderId, currentCount);

          // 🎯 SEM ALERT CHATO - SÓ TOAST SIMPLES
          showToast(`Upload completed! "${folderName}" now has ${currentCount} photos.`, 'success');

          await this.loadStorageStats(true);
        }

      } catch (error) {
        console.error('Error in upload monitoring:', error);
      }
    }, 30000);

    if (!this.uploadMonitoringIntervals) {
      this.uploadMonitoringIntervals = new Map();
    }
    this.uploadMonitoringIntervals.set(folderId, monitoringInterval);
  },

  // 🎯 VERSÃO LIMPA DO STOP MONITORING
  stopUploadMonitoring(folderId) {
    console.log(`🛑 Stopping upload monitoring for folder: ${folderId}`);

    if (this.uploadMonitoringIntervals && this.uploadMonitoringIntervals.has(folderId)) {
      clearInterval(this.uploadMonitoringIntervals.get(folderId));
      this.uploadMonitoringIntervals.delete(folderId);
    }

    this.unmarkFolderAsUploading(folderId);

    // ❌ REMOVIDO: Indicador do topo direito
    // ❌ REMOVIDO: Proteção contra saída
    // ❌ REMOVIDO: Estado persistente
  },

  updateSpecificFolder(folderId, newPhotoCount) {
    console.log(`🔄 Updating specific folder ${folderId} with count: ${newPhotoCount}`);

    const folderElements = document.querySelectorAll('.folder-item');
    folderElements.forEach(element => {
      const viewButton = element.querySelector(`[onclick*="${folderId}"]`);
      if (viewButton) {
        const countSpan = element.querySelector('.folder-count');
        if (countSpan) {
          countSpan.textContent = ` (${newPhotoCount} photos)`;
        }

        console.log(`✅ Updated folder display: ${newPhotoCount} photos`);
      }
    });
  },

  // 🎯 VERSÃO COMPLETA DO RESTORE - COM PERSISTÊNCIA DA SETINHA
  async restoreUploadIfNeeded() {
    try {
      const activeUploads = JSON.parse(localStorage.getItem('activeUploads') || '{}');
      const uploadIds = Object.keys(activeUploads);

      if (uploadIds.length === 0) {
        console.log('📝 No active uploads to restore');
        return;
      }

      console.log(`🔄 Restoring ${uploadIds.length} active uploads...`);

      for (const folderId of uploadIds) {
        const uploadState = activeUploads[folderId];

        // Verificar se o estado não é muito antigo (max 2 horas)
        const uploadAge = Date.now() - uploadState.timestamp;
        const maxAge = 2 * 60 * 60 * 1000; // 2 horas

        if (uploadAge > maxAge) {
          console.log(`⏰ Upload state too old, cleaning up: ${uploadState.destinationName}`);
          this.clearUploadState(folderId);
          continue;
        }

        console.log(`🔄 Restoring upload monitoring for: ${uploadState.destinationName}`);

        // Restaurar monitoramento visual E funcional
        this.startRealUploadMonitoring(
          folderId,
          uploadState.destinationName,
          uploadState.fileCount,
          uploadState.expectedFinalCount,
          true // isRestoring = true
        );
      }

    } catch (error) {
      console.warn('Error restoring uploads:', error);
    }
  },

  createNewFolderModal() {
    const modalHTML = `
  <div id="create-folder-modal" class="modal" style="display: none;">
      <div class="modal-content" style="max-width: 600px;">
        <h3>Create New Folder</h3>
        
        <div class="form-group">
          <label for="new-folder-name">Folder Name:</label>
          <input type="text" id="new-folder-name" class="form-control" 
                 placeholder="Enter folder name..." maxlength="100">
        </div>
        
        <div id="parent-selector" class="parent-selector" style="display: block;">
          <h4>Select Parent Folder:</h4>
          <div id="parent-folders-loading" class="loading-message">Loading folders...</div>
          <div id="parent-folders-tree" class="parent-folders-tree" style="display: none;"></div>
        </div>
        
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="photoManager.closeCreateFolderModal()">Cancel</button>
          <button class="btn btn-gold" onclick="photoManager.createNewFolder()">Create Folder</button>
        </div>
      </div>
    </div>
  `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    console.log('✅ Create folder modal created');
  },

  async loadParentFolders() {
    console.log('📂 Loading parent folders...');

    const loadingDiv = document.getElementById('parent-folders-loading');
    const treeDiv = document.getElementById('parent-folders-tree');

    loadingDiv.style.display = 'block';
    treeDiv.style.display = 'none';

    try {
      // Usar estrutura atual, mas permitir seleção de pastas não-leaf também
      const foldersForParent = this.filterFoldersForParent(this.currentStructure);

      if (foldersForParent.length === 0) {
        treeDiv.innerHTML = '<div class="empty-message">No available parent folders</div>';
      } else {
        this.renderParentTree(foldersForParent, treeDiv);
      }

      loadingDiv.style.display = 'none';
      treeDiv.style.display = 'block';

    } catch (error) {
      console.error('❌ Error loading parent folders:', error);
      treeDiv.innerHTML = `<div class="error">Failed to load folders: ${error.message}</div>`;
      loadingDiv.style.display = 'none';
      treeDiv.style.display = 'block';
    }
  },

  filterFoldersForParent(folders) {
    const adminFoldersToExclude = ['Waiting Payment', 'Sold'];

    const filterRecursive = (folderList) => {
      return folderList.filter(folder => {
        if (adminFoldersToExclude.includes(folder.name)) {
          return false;
        }

        if (folder.children && folder.children.length > 0) {
          folder.children = filterRecursive(folder.children);
        }

        return true;
      });
    };

    return filterRecursive(folders);
  },

  renderParentTree(folders, container, level = 0) {
    container.innerHTML = '';

    // Opção "Root Level"
    if (level === 0) {
      const rootDiv = document.createElement('div');
      rootDiv.className = 'parent-folder-item root-option';
      rootDiv.innerHTML = `
      <div class="parent-folder-content" onclick="photoManager.selectParentFolder(null, 'Root Level')">
        <span class="parent-folder-icon">🏠</span>
        <span class="parent-folder-name">Root Level</span>
        <span class="parent-folder-note">(Create at top level)</span>
      </div>
    `;
      container.appendChild(rootDiv);
    }

    folders.forEach(folder => {
      const folderDiv = document.createElement('div');
      folderDiv.className = 'parent-folder-item';
      folderDiv.style.paddingLeft = `${(level + 1) * 20}px`;

      const icon = (!folder.children || folder.children.length === 0) ? '📷' : '📁';
      const photoCount = folder.isLeaf ? ` (${folder.fileCount || 0} photos)` : '';

      folderDiv.innerHTML = `
      <div class="parent-folder-content" onclick="photoManager.selectParentFolder('${folder.id}', '${folder.name.replace(/'/g, '\\\'')}')" data-selectable="true">
        <span class="parent-folder-icon">${icon}</span>
        <span class="parent-folder-name">${folder.name}</span>
        <span class="parent-folder-count">${photoCount}</span>
      </div>
    `;

      container.appendChild(folderDiv);

      if (folder.children && folder.children.length > 0) {
        const childContainer = document.createElement('div');
        childContainer.className = 'parent-folder-children';
        container.appendChild(childContainer);
        this.renderParentTree(folder.children, childContainer, level + 1);
      }
    });
  },

  selectParentFolder(folderId, folderName) {
    // Remover seleção anterior
    document.querySelectorAll('.parent-folder-item').forEach(item => {
      item.classList.remove('selected');
    });

    // Selecionar novo
    event.target.closest('.parent-folder-item').classList.add('selected');

    this.selectedParentFolder = folderId;
    const selectedParentElement = document.getElementById('selected-parent-name');
    if (selectedParentElement) {
      selectedParentElement.textContent = folderName;
    }
    console.log(`📁 Selected parent: ${folderName} (${folderId})`);
  },

  async toggleParentSelector() {
    const selector = document.getElementById('parent-selector');
    const isVisible = selector.style.display !== 'none';

    if (isVisible) {
      selector.style.display = 'none';
    } else {
      selector.style.display = 'block';
      await this.loadParentFolders();
    }
  },

  async createNewFolder() {
    const folderName = document.getElementById('new-folder-name').value.trim();

    if (!folderName) {
      showToast('Please enter a folder name', 'error');
      return;
    }

    // Validar nome da pasta
    if (!/^[a-zA-Z0-9\s\-_.()]+$/.test(folderName)) {
      showToast('Folder name can only contain letters, numbers, spaces, and basic punctuation', 'error');
      return;
    }

    try {
      showToast('Creating folder...', 'info');

      const response = await fetch('/api/photos/admin/folder/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          parentId: this.selectedParentFolder,
          name: folderName
        })
      });

      const result = await response.json();

      if (result.success) {
        showToast(`Folder "${folderName}" created successfully!`, 'success');
        this.closeCreateFolderModal();

        // Refresh estrutura
        await this.refreshStructure();

      } else {
        showToast(`Error creating folder: ${result.message}`, 'error');
      }

    } catch (error) {
      console.error('❌ Error creating folder:', error);
      showToast(`Error creating folder: ${error.message}`, 'error');
    }
  },

  // FUNÇÃO FALTANTE: Abrir modal de criação de pasta
  openCreateFolderModal() {
    console.log('📁 Opening create folder modal...');

    if (!document.getElementById('create-folder-modal')) {
      this.createNewFolderModal();
    }

    // Resetar formulário
    const nameInput = document.getElementById('new-folder-name');
    if (nameInput) nameInput.value = '';

    this.selectedParentFolder = null;

    const parentNameSpan = document.getElementById('selected-parent-name');
    if (parentNameSpan) parentNameSpan.textContent = 'No parent selected (root level)';

    const modal = document.getElementById('create-folder-modal');
    if (modal) modal.style.display = 'flex';
    console.log('✅ Create folder modal opened');

    // Auto-carregar lista de pastas
    setTimeout(async () => {
      await this.loadParentFolders();
    }, 100);
  },

  closeCreateFolderModal() {
    document.getElementById('create-folder-modal').style.display = 'none';
    this.selectedParentFolder = null;
  },

  // NOVA FUNÇÃO: Proteção completa contra saída durante uploads
  setupUploadProtection() {
    // Proteção contra fechar navegador/aba
    window.addEventListener('beforeunload', (e) => {
      if (this.hasActiveUploads()) {
        e.preventDefault();
        e.returnValue = 'You have uploads in progress. They may be lost if you leave.';
        return 'You have uploads in progress. They may be lost if you leave.';
      }
    });

    // Proteção contra logout do admin
    this.protectAdminLogout();

    console.log('🛡️ Upload protection enabled');
  },

  // NOVA FUNÇÃO: Proteger logout durante upload
  protectAdminLogout() {
    // Interceptar função de logout
    const originalLogout = window.adminLogout;

    if (originalLogout) {
      window.adminLogout = () => {
        if (this.hasActiveUploads()) {
          showConfirm(
            'You have uploads in progress. They will be lost if you logout.\n\nAre you sure you want to continue?',
            () => {
              // Limpar uploads ativos e fazer logout
              localStorage.removeItem('activeUploads');
              originalLogout();
            },
            'Logout with active uploads?'
          );
        } else {
          originalLogout();
        }
      };
    }
  },

  // NOVA FUNÇÃO: Abrir modal de upload para pasta específica
  openUploadModalForFolder(folderId, folderName) {
    console.log(`📤 Opening direct upload for: ${folderName} (${folderId})`);

    // Definir destino imediatamente
    this.selectedUploadDestination = {
      id: folderId,
      name: folderName
    };

    // Criar modal direto de seleção de arquivos (sem Step 1)
    this.createDirectUploadModal(folderName);
  },

  // NOVA FUNÇÃO: Modal direto para seleção de arquivos - COM EVENT LISTENERS
  createDirectUploadModal(folderName) {
    // Remover apenas o modal direto se houver
    const existingDirectModal = document.getElementById('direct-upload-modal');
    if (existingDirectModal) {
      existingDirectModal.remove();
    }

    const modalHTML = `
    <div id="direct-upload-modal" class="photo-upload-modal" style="display: flex;">
      <div class="upload-modal-content">
        <div class="upload-modal-header">
          <h3>🔺 Upload Photos to: ${folderName}</h3>
          <button class="upload-modal-close" id="direct-modal-close">&times;</button>
        </div>
        
        <div class="upload-modal-body">
          <div class="upload-step">
            <h4>Select Photos to Upload</h4>
            <p>Choose photos to upload to <strong>${folderName}</strong>:</p>
            
            <div class="file-drop-zone" id="direct-file-drop-zone">
              <div class="drop-zone-content">
                <div class="drop-icon">📁</div>
                <p>Drag & drop photos here</p>
                <p>or</p>
              </div>
              <input type="file" id="direct-photo-files" multiple accept="image/*" style="display: none;">
            </div>
            <div style="text-align: center; margin-top: 15px;">
              <button type="button" class="btn btn-gold" id="direct-choose-files-btn">Choose Files</button>
            </div>
            
            <div id="direct-selected-files-preview" style="display: none; margin-top: 20px;">
              <h5>Selected Files:</h5>
              <div id="direct-files-list" class="files-list"></div>
            </div>
          </div>
        </div>
        
        <div class="upload-modal-footer">
          <button class="btn btn-secondary" id="direct-cancel-btn">Cancel</button>
          <button class="btn btn-gold" id="direct-start-upload-btn" disabled>Upload Photos</button>
        </div>
      </div>
    </div>
  `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // ADICIONAR EVENT LISTENERS após criar o modal
    this.setupDirectModalEvents();

    console.log(`✅ Direct upload modal opened for: ${folderName}`);
    showToast(`Ready to upload to: ${folderName}`, 'info');
  },

  // NOVA FUNÇÃO: Selecionar arquivos via botão
  selectFiles() {
    document.getElementById('photo-files').click();
  },

  // NOVAS FUNÇÕES PARA MODAL DIRETO
  selectDirectFiles() {
    document.getElementById('direct-photo-files').click();
  },

  handleDirectFileSelection(files) {
    if (files && files.length > 0) {
      this.selectedFiles = Array.from(files);
      this.updateDirectFilesPreview(this.selectedFiles);
      document.getElementById('direct-start-upload-btn').disabled = false;
    }
  },

  updateDirectFilesPreview(files) {
    const preview = document.getElementById('direct-selected-files-preview');
    const filesList = document.getElementById('direct-files-list');

    let html = '';
    files.forEach((file, i) => {
      const size = this.formatFileSize(file.size);
      html += `<div class="file-item">📸 ${file.name} (${size})</div>`;
    });

    filesList.innerHTML = html;
    preview.style.display = 'block';

    console.log(`📁 Selected ${files.length} files for direct upload`);
  },

  closeDirectUploadModal() {
    const modal = document.getElementById('direct-upload-modal');
    if (modal) {
      modal.remove();
    }
    this.selectedFiles = [];
  },

  startDirectUpload() {
    console.log('🚀 Starting direct upload and closing modal...');

    // Fazer upload PRIMEIRO (enquanto ainda tem arquivos)
    this.startUpload();

    // Fechar modal DEPOIS do upload começar
    this.closeDirectUploadModal();
  },

  // NOVA FUNÇÃO: Setup dos eventos do modal direto
  setupDirectModalEvents() {
    console.log('🔧 Setting up direct modal events...');

    // Botão Choose Files
    const chooseBtn = document.getElementById('direct-choose-files-btn');
    if (chooseBtn) {
      chooseBtn.addEventListener('click', () => {
        console.log('🔍 Choose Files button clicked!');
        this.selectDirectFiles();
      });
    }

    // Input de arquivo
    const fileInput = document.getElementById('direct-photo-files');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        this.handleDirectFileSelection(e.target.files);
      });
    }

    // Botão Close
    const closeBtn = document.getElementById('direct-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closeDirectUploadModal();
      });
    }

    // Botão Cancel
    const cancelBtn = document.getElementById('direct-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.closeDirectUploadModal();
      });
    }

    // Botão Upload
    const uploadBtn = document.getElementById('direct-start-upload-btn');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        this.startDirectUpload();
      });
    }

    console.log('✅ Direct modal events setup completed');
  },

  // NOVA FUNÇÃO: Configurar pesquisa do admin
  setupAdminSearch() {
    console.log('🔍 Setting up admin search...');

    const searchInput = document.getElementById('admin-photo-search');
    const resultsDiv = document.getElementById('admin-search-results');

    if (!searchInput || !resultsDiv) {
      console.warn('Search elements not found');
      return;
    }

    // Pesquisa em tempo real
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.trim();
      this.performAdminSearch(searchTerm);
    });

    // Fechar resultados ao clicar fora
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
        resultsDiv.style.display = 'none';
      }
    });

    // Focar na pesquisa ao clicar
    searchInput.addEventListener('focus', (e) => {
      if (e.target.value.trim()) {
        this.performAdminSearch(e.target.value.trim());
      }
    });
  },

  // NOVA FUNÇÃO: Executar pesquisa
  async performAdminSearch(searchTerm) {
    const resultsDiv = document.getElementById('admin-search-results');

    if (!searchTerm || searchTerm.length < 2) {
      resultsDiv.style.display = 'none';
      return;
    }

    console.log(`🔍 Searching for: "${searchTerm}"`);

    try {
      // Buscar em todas as categorias
      const results = await this.searchPhotosAndCategories(searchTerm);
      this.displaySearchResults(results, searchTerm);
    } catch (error) {
      console.error('Search error:', error);
      resultsDiv.innerHTML = '<div class="search-no-results">Search error occurred</div>';
      resultsDiv.style.display = 'block';
    }
  },

  // NOVA FUNÇÃO: Buscar fotos e categorias
  async searchPhotosAndCategories(searchTerm) {
    const results = [];
    const searchLower = searchTerm.toLowerCase();

    // 1. Buscar categorias por nome
    if (this.currentStructure) {
      this.searchCategoriesRecursive(this.currentStructure, searchLower, results);
    }

    // 2. Buscar fotos por ID/nome em categorias que têm fotos
    const leafFolders = this.getLeafFolders(this.currentStructure || []);

    for (const folder of leafFolders.slice(0, 10)) { // Limite inicial
      try {
        const response = await fetch(`/api/photos?category_id=${folder.id}&limit=100`);
        if (response.ok) {
          const photos = await response.json();

          photos.forEach(photo => {
            const photoId = photo.id || '';
            const photoName = photo.name || photoId;

            if (photoId.toLowerCase().includes(searchLower) ||
              photoName.toLowerCase().includes(searchLower)) {
              results.push({
                type: 'photo',
                photoId: photoId,
                photoName: photoName,
                categoryId: folder.id,
                categoryName: folder.name
              });
            }
          });
        }
      } catch (error) {
        console.warn(`Error searching in folder ${folder.name}:`, error);
      }
    }

    return results.slice(0, 20); // Máximo 20 resultados
  },

  // NOVA FUNÇÃO: Buscar apenas em categorias finais com fotos (incluindo QB Items)
  searchCategoriesRecursive(folders, searchTerm, results) {
    folders.forEach(folder => {
      // SÓ BUSCAR EM LEAF FOLDERS COM FOTOS
      if (folder.isLeaf && folder.fileCount && folder.fileCount > 0) {
        let matchFound = false;
        let matchReason = '';

        // 1. Buscar por nome da categoria
        if (folder.name.toLowerCase().includes(searchTerm)) {
          matchFound = true;
          matchReason = 'name';
        }

        // 2. NOVO: Buscar por QB Item
        if (!matchFound && this.qbItemData && this.qbItemData[folder.id]) {
          const qbItem = this.qbItemData[folder.id].toLowerCase();
          if (qbItem.includes(searchTerm)) {
            matchFound = true;
            matchReason = 'qb';
          }
        }

        // Adicionar resultado se encontrou match
        if (matchFound) {
          results.push({
            type: 'category',
            categoryId: folder.id,
            categoryName: folder.folder && folder.folder.path ? folder.folder.path : folder.name,
            photoCount: folder.fileCount || 0,
            qbItem: this.qbItemData && this.qbItemData[folder.id] ? this.qbItemData[folder.id] : null,
            matchReason: matchReason
          });
        }
      }

      // Continue buscando nos filhos
      if (folder.children && folder.children.length > 0) {
        this.searchCategoriesRecursive(folder.children, searchTerm, results);
      }
    });
  },

  // NOVA FUNÇÃO: Exibir resultados
  displaySearchResults(results, searchTerm) {
    const resultsDiv = document.getElementById('admin-search-results');

    if (results.length === 0) {
      resultsDiv.innerHTML = `<div class="search-no-results">No results found for "${searchTerm}"</div>`;
      resultsDiv.style.display = 'block';
      return;
    }

    let html = '';

    results.forEach(result => {
      if (result.type === 'category') {
        const matchInfo = result.matchReason === 'qb' && result.qbItem ?
          `QB: ${result.qbItem} | ${result.photoCount} photos` :
          `${result.photoCount} photos`;

        html += `
          <div class="search-result-item" onclick="photoManager.openSearchResult('${result.categoryId}', '${result.categoryName.replace(/'/g, '\\\'')}')" data-type="category">
            <div class="search-result-photo">📷 ${result.categoryName}</div>
            <div class="search-result-category">${matchInfo}</div>
          </div>
        `;
      } else if (result.type === 'photo') {
        html += `
          <div class="search-result-item" onclick="photoManager.openSearchResult('${result.categoryId}', '${result.categoryName.replace(/'/g, '\\\'')}')" data-type="photo">
            <div class="search-result-photo">📸 ${result.photoName}</div>
            <div class="search-result-category">in ${result.categoryName}</div>
          </div>
        `;
      }
    });

    resultsDiv.innerHTML = html;
    resultsDiv.style.display = 'block';
  },

  // NOVA FUNÇÃO: Abrir resultado da pesquisa
  async openSearchResult(categoryId, categoryName) {
    console.log(`🎯 Opening search result: ${categoryName} (${categoryId})`);

    // Fechar resultados da pesquisa
    document.getElementById('admin-search-results').style.display = 'none';

    // Limpar campo de pesquisa
    document.getElementById('admin-photo-search').value = '';

    // Abrir categoria
    await this.openFolderModal(categoryId, categoryName);
  },

  // NOVA FUNÇÃO: Obter pastas com fotos
  getLeafFolders(folders) {
    const leafFolders = [];

    const collectLeaves = (folderList) => {
      folderList.forEach(folder => {
        if (folder.isLeaf && folder.fileCount > 0) {
          leafFolders.push(folder);
        }
        if (folder.children && folder.children.length > 0) {
          collectLeaves(folder.children);
        }
      });
    };

    collectLeaves(folders);
    return leafFolders;
  },

  // Editar QB Item de uma categoria
  editQBItem(folderId, folderName) {
    console.log(`🏷️ Opening QB modal for: ${folderName} (${folderId})`);

    // Armazenar informações para uso posterior
    this.currentQBFolderId = folderId;
    this.currentQBFolderName = folderName;

    // DEBUG: Verificar dados
    console.log('🔍 DEBUG - folderId:', folderId);
    console.log('🔍 DEBUG - folderName:', folderName);
    console.log('🔍 DEBUG - currentStructure:', this.currentStructure);

    // Obter dados completos da pasta para mostrar caminho completo
    const folderData = this.findFolderById(folderId);
    console.log('🔍 DEBUG - folderData:', folderData);

    const fullDisplayName = (folderData && folderData.folder && folderData.folder.path) ?
      folderData.folder.path :
      (folderData && folderData.name) ? folderData.name : folderName; console.log('🔍 DEBUG - fullDisplayName:', fullDisplayName);

    // Obter QB Item atual (usar sua lógica existente)
    const currentQB = (this.qbItemData && this.qbItemData[folderId]) || '';

    // Atualizar título do modal com categoria completa
    const modalTitle = document.querySelector('#qb-edit-modal h2');
    const modalDescription = document.querySelector('#qb-edit-modal p');
    modalTitle.textContent = 'Edit QB Item';
    modalDescription.innerHTML = `Setting QB code for:<br><strong style="color: #333;">${fullDisplayName}</strong>`;

    // Preencher modal
    document.getElementById('qb-input-field').value = currentQB;
    document.getElementById('qb-current-value').textContent = currentQB || 'Not set';

    // Mostrar modal
    document.getElementById('qb-edit-modal').style.display = 'block';

    // Focar no input
    setTimeout(() => {
      document.getElementById('qb-input-field').focus();
    }, 100);
  },

  // Salvar QB Item via API
  async saveQBItem(folderId, folderName, qbItem) {
    try {
      console.log(`💾 Saving QB Item: ${qbItem} for ${folderName}`);

      const response = await fetch(`/api/admin/categories/${folderId}/qbitem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qbItem: qbItem || null })
      });

      const result = await response.json();

      if (result.success) {
        // Atualizar cache local
        if (!this.qbItemData) this.qbItemData = {};
        this.qbItemData[folderId] = result.qbItem;

        // Atualizar tooltip
        this.updateFolderTooltip(folderId);

        showToast(`✅ QB Item updated: ${result.qbItem || 'Removed'}`, 'success');
      } else {
        showToast(`❌ Error: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('❌ Error saving QB Item:', error);
      showToast(`❌ Error saving QB Item: ${error.message}`, 'error');
    }
  },

  // Atualizar tooltip E interface visual de uma pasta específica
  updateFolderTooltip(folderId) {
    const folderElement = document.querySelector(`[onclick*="${folderId}"]`)?.closest('.folder-item');
    if (folderElement) {
      const qbItem = (this.qbItemData && this.qbItemData[folderId]) || 'Not set';
      const photos = folderElement.querySelector('.folder-count')?.textContent || '0 photos';

      // Atualizar tooltip
      folderElement.title = `QB Item: ${qbItem} | ${photos}`;

      // NOVO: Atualizar interface visual do QB code
      const qbCodeElement = folderElement.querySelector('.qb-code');
      if (qbCodeElement) {
        qbCodeElement.textContent = qbItem !== 'Not set' ? qbItem : '-';
        console.log(`🔄 Updated QB visual: ${qbItem} for folder ${folderId}`);
      }
    }
  },

  // Toggle menu dropdown com posicionamento inteligente
  toggleMenu(folderId, event) {
    event.stopPropagation();

    const existingMenu = document.querySelector('.floating-menu');

    // Se já existe um menu aberto para o mesmo folder, fechar
    if (existingMenu && existingMenu.dataset.folderId === folderId) {
      this.closeFloatingMenu();
      return;
    }

    // Fechar qualquer menu existente
    this.closeFloatingMenu();

    const trigger = event.target;
    const triggerRect = trigger.getBoundingClientRect();

    // Criar menu flutuante
    const menu = document.createElement('div');
    menu.className = 'floating-menu';
    menu.dataset.folderId = folderId; // Marcar qual folder pertence
    menu.innerHTML = `
      <div class="menu-item" onclick="photoManager.editQBItem('${folderId}', 'folder'); photoManager.closeFloatingMenu();">✏️ Edit QB</div>
      <div class="menu-item" onclick="photoManager.openUploadModalForFolder('${folderId}', 'folder'); photoManager.closeFloatingMenu();">🔺 Upload</div>
      <div class="menu-item" onclick="photoManager.confirmRenameFolder('${folderId}', 'folder'); photoManager.closeFloatingMenu();">✏️ Rename</div>
      <div class="menu-item" onclick="photoManager.confirmDeleteFolder('${folderId}', 'folder'); photoManager.closeFloatingMenu();">🗑️ Delete</div>
    `;

    // Posicionar no body
    document.body.appendChild(menu);

    // Calcular posição
    const menuHeight = 160;
    let top = triggerRect.bottom + 5;

    // Se sai da tela, abrir para cima
    if (top + menuHeight > window.innerHeight) {
      top = triggerRect.top - menuHeight - 5;
    }

    menu.style.left = (triggerRect.right - 120) + 'px';
    menu.style.top = top + 'px';
  },

  // Fechar menu flutuante
  closeFloatingMenu() {
    document.querySelectorAll('.floating-menu').forEach(menu => {
      menu.remove();
    });
  },

  // Fechar menus ao clicar fora
  closeAllMenus() {
    this.closeFloatingMenu();
  },

  // Fechar modal QB
  closeQBModal() {
    document.getElementById('qb-edit-modal').style.display = 'none';
    this.currentQBFolderId = null;
    this.currentQBFolderName = null;
  },

  // Salvar QB do modal (usa sua função saveQBItem existente)
  saveQBFromModal() {
    const newQBValue = document.getElementById('qb-input-field').value.trim().toUpperCase();

    if (!this.currentQBFolderId) {
      showToast('Error: No folder selected', 'error');
      return;
    }

    // Obter QB atual
    const currentQB = (this.qbItemData && this.qbItemData[this.currentQBFolderId]) || '';

    // Se não mudou, só fechar
    if (newQBValue === currentQB) {
      this.closeQBModal();
      return;
    }

    console.log(`💾 Saving QB: ${newQBValue} for folder: ${this.currentQBFolderId}`);

    // Usar sua função saveQBItem existente
    this.saveQBItem(this.currentQBFolderId, this.currentQBFolderName, newQBValue);

    // Fechar modal
    this.closeQBModal();
  },

  // Encontrar pasta por ID na estrutura atual
  findFolderById(folderId) {
    const searchInStructure = (folders) => {
      for (const folder of folders) {
        if (folder.id === folderId) {
          return folder;
        }
        if (folder.children && folder.children.length > 0) {
          const found = searchInStructure(folder.children);
          if (found) return found;
        }
      }
      return null;
    };

    return searchInStructure(this.currentStructure || []);
  },

};


// Integração com o sistema existente
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const originalSwitchTab = window.switchTab;

    if (originalSwitchTab) {
      window.switchTab = function (tabId) {
        // ❌ REMOVIDO: Verificação de proteção contra saída

        originalSwitchTab(tabId);

        if (tabId === 'photo-storage') {
          // ✅ RESTAURAR SETINHAS QUANDO VOLTA PARA ABA
          console.log('🎯 Photo Storage tab activated');
          setTimeout(() => {
            photoManager.init();
          }, 100);
        }
      };

      console.log('✅ Photo Manager integration completed (simplified version)');
    }
  }, 500);
});