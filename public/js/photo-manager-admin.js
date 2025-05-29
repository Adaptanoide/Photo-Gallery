// photo-manager-admin.js - MODAL + MODO LISTA
// Substitua completamente o arquivo existente

const photoManager = {
  currentStructure: null,
  selectedFolder: null,
  selectedPhotos: new Set(),
  currentFolderPhotos: [], // Armazenar fotos da pasta atual
  viewMode: 'list', // 'list' ou 'thumbnails'

  async init() {
    console.log('🚀 Initializing Photo Storage tab...');
    
    if (document.getElementById('photo-storage')) {
      await this.loadStorageStats();
      await this.loadFolderStructure();
    }
  },

  async loadStorageStats() {
    try {
      console.log('📊 Loading storage stats...');
      
      const response = await fetch('/api/admin/folders/leaf?admin=true');
      const data = await response.json();
      
      if (data.success && data.folders) {
        const folders = data.folders;
        const totalPhotos = folders.reduce((sum, folder) => sum + (folder.fileCount || 0), 0);
        const totalFolders = folders.length;
        
        // Cálculo mais realista de espaço
        const estimatedSizeMB = totalPhotos * 2.5;
        const estimatedSizeGB = Math.round((estimatedSizeMB / 1024) * 100) / 100;
        const usedPercent = Math.round((estimatedSizeGB / 50) * 100);
        
        console.log(`📊 Calculated stats: ${totalPhotos} photos, estimated ${estimatedSizeGB}GB`);
        
        document.getElementById('storage-stats-content').innerHTML = `
          <div class="storage-stats-grid">
            <div class="stat-card">
              <div class="stat-value">${totalPhotos}</div>
              <div class="stat-label">Total Photos</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${totalFolders}</div>
              <div class="stat-label">Photo Folders</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${estimatedSizeGB} GB</div>
              <div class="stat-label">Used Space (est.)</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${(50 - estimatedSizeGB).toFixed(1)} GB</div>
              <div class="stat-label">Available</div>
            </div>
          </div>
          <div class="storage-progress-bar">
            <div class="storage-progress-fill" style="width: ${Math.min(usedPercent, 100)}%"></div>
          </div>
          <div class="storage-progress-text">${usedPercent}% of 50GB used (estimated)</div>
        `;
        
        console.log(`✅ Stats loaded: ${totalPhotos} photos in ${totalFolders} folders`);
      }
    } catch (error) {
      console.error('❌ Error loading storage stats:', error);
      document.getElementById('storage-stats-content').innerHTML = 
        '<div class="error">Failed to load storage statistics</div>';
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
    console.log('🏗️ Organizing folders into hierarchy...');
    
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

  // NOVA FUNÇÃO: Abrir modal da pasta
  async openFolderModal(folderId, folderName) {
    console.log(`🎯 Opening folder modal: ${folderName} (${folderId})`);
    
    // Criar modal se não existir
    if (!document.getElementById('photo-folder-modal')) {
      this.createFolderModal();
    }
    
    // Atualizar título do modal
    document.getElementById('modal-folder-title').textContent = folderName;
    
    // Mostrar modal
    const modal = document.getElementById('photo-folder-modal');
    modal.style.display = 'flex';
    
    // Carregar fotos
    await this.loadFolderPhotos(folderId, folderName);
  },

  // NOVA FUNÇÃO: Criar modal para fotos
  createFolderModal() {
    console.log('🏗️ Creating folder modal...');
    
    const modalHTML = `
      <div id="photo-folder-modal" class="photo-folder-modal" style="display: none;">
        <div class="photo-modal-content">
          <div class="photo-modal-header">
            <h3 id="modal-folder-title">Folder Name</h3>
            <div class="photo-modal-controls">
              <button class="btn btn-secondary btn-sm" onclick="photoManager.toggleViewMode()" id="view-mode-btn">📋 Switch to Thumbnails</button>
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

  // NOVA FUNÇÃO: Carregar fotos da pasta
  async loadFolderPhotos(folderId, folderName) {
    console.log(`📋 Loading photos for folder: ${folderName}`);
    
    const loadingDiv = document.getElementById('photo-modal-loading');
    const contentDiv = document.getElementById('photo-modal-content');
    
    loadingDiv.style.display = 'block';
    contentDiv.style.display = 'none';
    
    try {
      const response = await fetch(`/api/photos?category_id=${folderId}`);
      console.log(`📡 API Response status: ${response.status}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      let photos = [];
      if (data.success && data.photos) {
        photos = data.photos;
      } else if (Array.isArray(data)) {
        photos = data;
      }
      
      console.log(`📷 Found ${photos.length} photos`);
      this.currentFolderPhotos = photos;
      
      if (photos.length === 0) {
        contentDiv.innerHTML = '<div class="empty-message">No photos in this folder</div>';
      } else {
        this.renderPhotosInModal(photos);
      }
      
      loadingDiv.style.display = 'none';
      contentDiv.style.display = 'block';
      
    } catch (error) {
      console.error('❌ Error loading folder photos:', error);
      contentDiv.innerHTML = `<div class="error">Failed to load photos: ${error.message}</div>`;
      loadingDiv.style.display = 'none';
      contentDiv.style.display = 'block';
    }
  },

  // NOVA FUNÇÃO: Renderizar fotos no modal (modo lista como padrão)
  renderPhotosInModal(photos) {
    console.log(`🎨 Rendering ${photos.length} photos in ${this.viewMode} mode`);
    
    const contentDiv = document.getElementById('photo-modal-content');
    
    if (this.viewMode === 'list') {
      // MODO LISTA (PADRÃO)
      const listHTML = `
        <div class="photo-list-header">
          <span><strong>${photos.length}</strong> photos in this folder</span>
        </div>
        <div class="photo-list-container">
          ${photos.map((photo, index) => `
            <div class="photo-list-item" onclick="photoManager.openPhotoFullscreen('${photo.id}', ${index})">
              <span class="photo-list-icon">📸</span>
              <span class="photo-list-name">${photo.name || photo.id}</span>
              <span class="photo-list-id">${photo.id}</span>
            </div>
          `).join('')}
        </div>
      `;
      contentDiv.innerHTML = listHTML;
    } else {
      // MODO THUMBNAILS (para depois)
      this.renderThumbnailsMode(photos);
    }
  },

  // NOVA FUNÇÃO: Abrir foto em fullscreen
  openPhotoFullscreen(photoId, photoIndex) {
    console.log(`🖼️ Opening photo fullscreen: ${photoId} (index: ${photoIndex})`);
    
    const photo = this.currentFolderPhotos[photoIndex];
    if (!photo) {
      console.error('❌ Photo not found');
      return;
    }
    
    // Criar fullscreen se não existir
    if (!document.getElementById('photo-fullscreen-modal')) {
      this.createFullscreenModal();
    }
    
    // Configurar imagem
    const imageUrl = photo.highres || `/api/photos/local/${this.selectedFolder.id}/${photoId}`;
    document.getElementById('fullscreen-image').src = imageUrl;
    document.getElementById('fullscreen-photo-name').textContent = photo.name || photoId;
    
    // Mostrar modal fullscreen
    document.getElementById('photo-fullscreen-modal').style.display = 'flex';
    
    console.log(`✅ Fullscreen opened for: ${photo.name || photoId}`);
  },

  // NOVA FUNÇÃO: Criar modal fullscreen
  createFullscreenModal() {
    const fullscreenHTML = `
      <div id="photo-fullscreen-modal" class="photo-fullscreen-modal" style="display: none;">
        <div class="fullscreen-content">
          <div class="fullscreen-header">
            <h4 id="fullscreen-photo-name">Photo Name</h4>
            <div class="fullscreen-controls">
              <button class="btn btn-secondary" onclick="photoManager.closeFullscreen()">← Back</button>
              <button class="btn btn-gold" onclick="photoManager.movePhoto()">📦 Move Photo</button>
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

  // NOVA FUNÇÃO: Fechar modal da pasta
  closeFolderModal() {
    console.log('🚪 Closing folder modal');
    document.getElementById('photo-folder-modal').style.display = 'none';
  },

  // NOVA FUNÇÃO: Fechar fullscreen
  closeFullscreen() {
    console.log('🚪 Closing fullscreen');
    document.getElementById('photo-fullscreen-modal').style.display = 'none';
  },

  // NOVA FUNÇÃO: Alternar modo de visualização (para depois)
  toggleViewMode() {
    this.viewMode = this.viewMode === 'list' ? 'thumbnails' : 'list';
    console.log(`🔄 Switching to ${this.viewMode} mode`);
    
    // Atualizar botão
    const btn = document.getElementById('view-mode-btn');
    btn.textContent = this.viewMode === 'list' ? '📋 Switch to Thumbnails' : '🖼️ Switch to List';
    
    // Re-renderizar fotos
    this.renderPhotosInModal(this.currentFolderPhotos);
  },

  // PLACEHOLDER: Mover foto (implementar depois)
  movePhoto() {
    showToast('Move photo feature coming soon!', 'info');
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
      window.switchTab = function(tabId) {
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