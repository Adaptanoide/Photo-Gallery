// photo-manager-admin.js - VERSÃO LIMPA SEM ALERTS
// Removidos: alerts chatos, indicador do topo, texto "processing", proteção de saída
// Mantido: setinha 📤, funcionalidade de upload, monitoramento

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

      const adminFolders = ['Waiting Payment', 'Sold'];
      const isAdminFolder = adminFolders.includes(folder.name);

      folderDiv.innerHTML = `
      <span class="folder-icon">${icon}</span>
      <span class="folder-name">${folder.name}</span>
      <span class="folder-count">${photoCount}</span>
      ${folder.isLeaf ? `
        <div class="folder-actions">
          <button class="folder-action-btn view-btn" onclick="photoManager.openFolderModal('${folder.id}', '${folder.name.replace(/'/g, '\\\'')}')" title="View Photos">View</button>
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

  async openFolderModal(folderId, folderName) {
    console.log(`🎯 Opening folder modal: ${folderName} (${folderId})`);

    this.currentFolderId = folderId;
    this.currentFolderName = folderName;
    this.selectedPhotos.clear();

    if (!document.getElementById('photo-folder-modal')) {
      this.createFolderModal();
    }

    document.getElementById('modal-folder-title').textContent = folderName;
    document.getElementById('photo-folder-modal').style.display = 'flex';

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
    await this.loadStorageStats();
    await this.loadFolderStructure();
    showToast('Folder structure refreshed', 'success');
  },

  renderStorageStats(stats) {
    const discreteCount = document.getElementById('discrete-photo-count');
    if (discreteCount) {
      discreteCount.textContent = `${stats.totalPhotos} photos`;
    }

    console.log(`📊 Discrete stats updated: ${stats.totalPhotos} photos`);
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

    showToast(`Delete ${selectedCount} photos feature coming soon!`, 'info');
  },

  confirmDeleteSinglePhoto(photoId) {
    console.log(`🗑️ Delete single photo requested: ${photoId}`);
    showToast(`Delete photo feature coming soon!\nPhoto: ${photoId}`, 'info');
  },

  confirmDeleteCurrentPhoto() {
    if (!this.currentFullscreenPhoto) {
      showToast('No photo selected', 'error');
      return;
    }

    const photoId = this.currentFullscreenPhoto.id;
    console.log(`🗑️ Delete current photo requested: ${photoId}`);
    showToast(`Delete photo feature coming soon!\nPhoto: ${photoId}`, 'info');
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
        const message = includePhotos
          ? `Successfully deleted folder "${folderName}" and ${deletedCount} photos`
          : `Successfully deleted empty folder "${folderName}"`;

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

      const icon = folder.isLeaf ? '📄' : (folder.children.length > 0 ? '📁' : '📂');
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

  // 🎯 VERSÃO LIMPA DA FUNÇÃO startUpload() - SEM ALERTS E INDICADORES CHATOS
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

      uploadBtn = document.getElementById('start-upload-btn');
      if (uploadBtn) {
        originalText = uploadBtn.textContent;
        uploadBtn.disabled = true;
        uploadBtn.textContent = `🔄 Uploading ${fileCount} photos...`;
      }

      // 🎯 MARCAR PASTA COMO UPLOADANDO (SÓ A SETINHA 📤)
      this.startRealUploadMonitoring(destination.id, destination.name, fileCount, expectedFinalCount);

      const formData = new FormData();
      formData.append('destinationFolderId', destination.id);

      console.log('📦 Adding files to FormData...');
      Array.from(files).forEach((file, index) => {
        console.log(`📎 File ${index + 1}: ${file.name} (${this.formatFileSize(file.size)})`);
        formData.append('photos', file);
      });

      console.log('📡 Sending upload request...');
      console.log('⏰ This may take several minutes for large files...');
      
      const response = await fetch('/api/admin/photos/upload', {
        method: 'POST',
        body: formData
      });

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
        
        // 🎯 SEM ALERT CHATO - SÓ TOAST SIMPLES
        showToast(`Upload started! ${result.uploadedCount} photos being processed.`, 'success');

        this.closeUploadModal();

      } else {
        console.error('❌ Upload failed:', result);
        showToast(`Upload failed: ${result.message || 'Unknown error'}`, 'error');
        
        this.stopUploadMonitoring(destination.id);
      }

    } catch (error) {
      console.error('❌ Upload error:', error);
      showToast(`Upload failed: ${error.message}`, 'error');
      
      if (this.selectedUploadDestination) {
        this.stopUploadMonitoring(this.selectedUploadDestination.id);
      }
      
    } finally {
      if (uploadBtn && originalText) {
        uploadBtn.disabled = false;
        uploadBtn.textContent = originalText;
      }
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
        
        // ❌ REMOVIDO: O texto chato "Processing X photos... (may take ~10min)"
        // Agora só mantém o contador original
        
        const eyeButton = element.querySelector('.view-btn');
        if (eyeButton) {
          eyeButton.disabled = true;
          eyeButton.style.opacity = '0.5';
          eyeButton.title = 'Upload in progress...';
        }
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
    
    // ❌ REMOVIDO: Salvar estado persistente (sem proteção contra saída)
    // ❌ REMOVIDO: Proteção contra saída da página
    
    // ✅ MANTER APENAS: Setinha na pasta
    this.markFolderAsUploading(folderId, folderName, uploadingCount);
    
    // ❌ REMOVIDO: Indicador grande no topo direito
    
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

  // 🎯 VERSÃO LIMPA DO RESTORE - SEM ALERT CHATO
  async restoreUploadIfNeeded() {
    // ❌ REMOVIDO: Sistema de persistência e alerts de restauração
    // Agora não há proteção contra saída, então não precisa restaurar nada
    console.log('📝 Upload restoration system disabled (simplified version)');
  },

};

// ❌ REMOVIDO: Sistema de proteção contra navegação entre tabs

// Integração com o sistema existente
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const originalSwitchTab = window.switchTab;

    if (originalSwitchTab) {
      window.switchTab = function (tabId) {
        // ❌ REMOVIDO: Verificação de proteção contra saída
        
        originalSwitchTab(tabId);

        if (tabId === 'photo-storage') {
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