// photo-manager-admin.js CORRIGIDO COM DEBUG
// Substitua completamente o arquivo existente

const photoManager = {
  currentStructure: null,
  selectedFolder: null,
  selectedPhotos: new Set(),

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
        
        // CORREÇÃO: Cálculo mais realista de espaço
        // Assumindo ~2.5MB por foto WebP em média
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
        
        // Organizar em estrutura hierárquica para exibição
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
            <button class="folder-action-btn" onclick="photoManager.viewFolderPhotos('${folder.id}', '${folder.name}')" title="View Photos">👁️</button>
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

  // FUNÇÃO CORRIGIDA: viewFolderPhotos com DEBUG
  async viewFolderPhotos(folderId, folderName) {
    console.log(`👁️ Viewing photos in: ${folderName} (${folderId})`);
    
    // PASSO 1: Encontrar e mostrar o painel
    const photoPanel = document.querySelector('.photo-management-panel');
    if (!photoPanel) {
      console.error('❌ Photo management panel not found!');
      return;
    }
    
    console.log('📋 Showing photo management panel...');
    photoPanel.style.display = 'block';
    
    // PASSO 2: Atualizar título
    const titleElement = document.getElementById('current-folder-name');
    if (titleElement) {
      titleElement.textContent = folderName;
      console.log(`📝 Updated title to: ${folderName}`);
    }
    
    // PASSO 3: Encontrar container de fotos
    const photoContainer = document.getElementById('folder-photos');
    if (!photoContainer) {
      console.error('❌ Photo container not found!');
      return;
    }
    
    photoContainer.innerHTML = '<div class="loading">Loading photos...</div>';
    console.log('⏳ Loading photos...');
    
    try {
      // PASSO 4: Buscar fotos via API
      const response = await fetch(`/api/photos?category_id=${folderId}`);
      console.log(`📡 API Response status: ${response.status}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📋 API Response data:', data);
      
      // PASSO 5: Processar resposta
      let photos = [];
      if (data.success && data.photos) {
        photos = data.photos;
      } else if (Array.isArray(data)) {
        photos = data;
      } else {
        console.warn('⚠️ Unexpected API response format:', data);
      }
      
      console.log(`📷 Found ${photos.length} photos`);
      
      if (photos.length === 0) {
        photoContainer.innerHTML = '<div class="empty-message">No photos in this folder</div>';
        return;
      }
      
      // PASSO 6: Renderizar HTML (CORRIGIDO)
      console.log('🎨 Rendering photos HTML...');
      
      const photosHTML = photos.map((photo, index) => {
        // Garantir URLs corretos para thumbnails
        let thumbnailUrl = photo.thumbnail;
        if (!thumbnailUrl || thumbnailUrl.includes('undefined')) {
          thumbnailUrl = `/api/photos/local/thumbnail/${photo.id}`;
        }
        
        console.log(`📸 Photo ${index + 1}: ${photo.id}, thumbnail: ${thumbnailUrl}`);
        
        return `
          <div class="photo-item" data-photo-id="${photo.id}">
            <div class="photo-preview">
              <img src="${thumbnailUrl}" 
                   alt="${photo.name || photo.id}" 
                   loading="lazy" 
                   onerror="console.error('Failed to load image:', this.src); this.style.display='none'; this.nextElementSibling.style.display='block';"
                   onload="console.log('Image loaded successfully:', this.src);">
              <div class="photo-placeholder" style="display: none; width: 100%; height: 140px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #666;">📷</div>
              <div class="photo-name">${photo.name || photo.id}</div>
            </div>
          </div>
        `;
      }).join('');
      
      photoContainer.innerHTML = `
        <div class="photo-grid-header">
          <div class="selection-controls">
            <span><strong>${photos.length}</strong> photos in this folder</span>
          </div>
        </div>
        <div class="photo-grid-container">
          ${photosHTML}
        </div>
      `;
      
      console.log('✅ Photos HTML rendered successfully');
      
      // PASSO 7: Scroll para ver as fotos
      photoPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
    } catch (error) {
      console.error('❌ Error loading folder photos:', error);
      photoContainer.innerHTML = `<div class="error">Failed to load photos: ${error.message}</div>`;
    }
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