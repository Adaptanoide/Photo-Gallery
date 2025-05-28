// photo-manager-admin.js CORRIGIDO
// Este arquivo substitui completamente o anterior

// Objeto gerenciador de fotos - VERSÃO CORRIGIDA
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

  // CORRIGIDO: Usar API existente
  async loadStorageStats() {
    try {
      console.log('📊 Loading storage stats...');
      
      // Usar a API existente de leafFolders para calcular estatísticas
      const response = await fetch('/api/admin/folders/leaf?admin=true');
      const data = await response.json();
      
      if (data.success && data.folders) {
        const folders = data.folders;
        const totalPhotos = folders.reduce((sum, folder) => sum + (folder.fileCount || 0), 0);
        const totalFolders = folders.length;
        
        // Estimar uso de disco (2434 fotos * ~200KB média)
        const estimatedSizeGB = Math.round((totalPhotos * 0.2) / 1024 * 100) / 100;
        const usedPercent = Math.round((estimatedSizeGB / 50) * 100);
        
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
              <div class="stat-label">Used Space</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${50 - estimatedSizeGB} GB</div>
              <div class="stat-label">Available</div>
            </div>
          </div>
          <div class="storage-progress-bar">
            <div class="storage-progress-fill" style="width: ${usedPercent}%"></div>
          </div>
          <div class="storage-progress-text">${usedPercent}% of 50GB used</div>
        `;
        
        console.log(`✅ Stats loaded: ${totalPhotos} photos in ${totalFolders} folders`);
      }
    } catch (error) {
      console.error('❌ Error loading storage stats:', error);
      document.getElementById('storage-stats-content').innerHTML = 
        '<div class="error">Failed to load storage statistics</div>';
    }
  },

  // CORRIGIDO: Usar API existente para carregar estrutura
  async loadFolderStructure() {
    try {
      console.log('📂 Loading folder structure...');
      
      // Usar a API existente que já funciona
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

  // NOVA: Organizar pastas planas em hierarquia visual
  organizeIntoHierarchy(folders) {
    console.log('🏗️ Organizing folders into hierarchy...');
    
    const hierarchy = {};
    
    folders.forEach(folder => {
      // Usar o fullPath ou path para criar hierarquia
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

  // NOVA: Converter objeto hierárquico em array para renderização
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

  // MELHORADO: Renderização com melhor UX
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
            <button class="folder-action-btn" onclick="photoManager.selectFolderForMove('${folder.id}', '${folder.name}')" title="Select for Move">📦</button>
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
      
      // Renderizar subpastas se houver
      if (folder.children && folder.children.length > 0) {
        const childContainer = document.createElement('div');
        childContainer.className = 'folder-children';
        container.appendChild(childContainer);
        this.renderFolderTree(folder.children, childContainer, level + 1);
      }
    });
  },

  selectFolder(folder, element) {
    // Remover seleção anterior
    document.querySelectorAll('.folder-item').forEach(item => {
      item.classList.remove('selected');
    });
    
    // Adicionar seleção
    element.classList.add('selected');
    this.selectedFolder = folder;
    
    console.log(`📁 Selected folder: ${folder.name} (${folder.fileCount} photos)`);
  },

  // FUNCIONAL: Visualizar fotos usando API existente
  async viewFolderPhotos(folderId, folderName) {
    console.log(`👁️ Viewing photos in: ${folderName} (${folderId})`);
    
    document.getElementById('current-folder-name').textContent = folderName;
    document.querySelector('.photo-management-panel').style.display = 'block';
    
    const photoGrid = document.getElementById('folder-photos');
    photoGrid.innerHTML = '<div class="loading">Loading photos...</div>';
    
    try {
      // Usar API existente que já funciona
      const response = await fetch(`/api/photos?category_id=${folderId}`);
      const data = await response.json();
      
      let photos = [];
      if (data.success && data.photos) {
        photos = data.photos;
      } else if (Array.isArray(data)) {
        photos = data;
      }
      
      console.log(`📷 Found ${photos.length} photos`);
      
      if (photos.length === 0) {
        photoGrid.innerHTML = '<div class="empty-message">No photos in this folder</div>';
        return;
      }
      
      // Renderizar grid de fotos
      photoGrid.innerHTML = `
        <div class="photo-grid-header">
          <div class="selection-controls">
            <label>
              <input type="checkbox" id="select-all-photos" onchange="photoManager.toggleSelectAll(this.checked)">
              Select All (${photos.length} photos)
            </label>
            <button class="btn btn-secondary" onclick="photoManager.clearSelection()" style="margin-left: 10px;">Clear Selection</button>
            <button class="btn btn-gold" onclick="photoManager.showMoveModal()" style="margin-left: 10px;" disabled id="move-selected-btn">Move Selected</button>
          </div>
        </div>
        <div class="photo-grid-container">
          ${photos.map(photo => `
            <div class="photo-item" data-photo-id="${photo.id}">
              <label class="photo-checkbox-label">
                <input type="checkbox" class="photo-checkbox" value="${photo.id}" onchange="photoManager.togglePhotoSelection('${photo.id}', this.checked)">
                <img src="${photo.thumbnail}" alt="${photo.name || photo.id}" loading="lazy" onerror="this.src='/api/photos/local/thumbnail/${photo.id}'">
                <div class="photo-name">${photo.name || photo.id}</div>
              </label>
            </div>
          `).join('')}
        </div>
      `;
      
    } catch (error) {
      console.error('❌ Error loading folder photos:', error);
      photoGrid.innerHTML = '<div class="error">Failed to load photos</div>';
    }
  },

  // NOVA: Controle de seleção de fotos
  togglePhotoSelection(photoId, selected) {
    if (selected) {
      this.selectedPhotos.add(photoId);
    } else {
      this.selectedPhotos.delete(photoId);
    }
    
    // Atualizar UI
    this.updateSelectionUI();
  },

  toggleSelectAll(selectAll) {
    const checkboxes = document.querySelectorAll('.photo-checkbox');
    this.selectedPhotos.clear();
    
    checkboxes.forEach(checkbox => {
      checkbox.checked = selectAll;
      if (selectAll) {
        this.selectedPhotos.add(checkbox.value);
      }
    });
    
    this.updateSelectionUI();
  },

  clearSelection() {
    this.selectedPhotos.clear();
    document.querySelectorAll('.photo-checkbox').forEach(cb => cb.checked = false);
    document.getElementById('select-all-photos').checked = false;
    this.updateSelectionUI();
  },

  updateSelectionUI() {
    const selectedCount = this.selectedPhotos.size;
    const moveBtn = document.getElementById('move-selected-btn');
    
    if (moveBtn) {
      moveBtn.disabled = selectedCount === 0;
      moveBtn.textContent = selectedCount > 0 ? `Move Selected (${selectedCount})` : 'Move Selected';
    }
    
    console.log(`📋 Selected photos: ${selectedCount}`);
  },

  // PLACEHOLDER: Modal para mover fotos (implementar depois)
  showMoveModal() {
    const selectedCount = this.selectedPhotos.size;
    if (selectedCount === 0) {
      showToast('Please select photos to move', 'warning');
      return;
    }
    
    // Por enquanto, apenas mostrar quantas fotos estão selecionadas
    showToast(`${selectedCount} photos selected. Move modal coming soon!`, 'info');
    
    console.log('📦 Photos to move:', Array.from(this.selectedPhotos));
  },

  // FUNCIONAL: Refresh usando APIs existentes
  async refreshStructure() {
    console.log('🔄 Refreshing folder structure...');
    await this.loadStorageStats();
    await this.loadFolderStructure();
    showToast('Folder structure refreshed', 'success');
  },

  // PLACEHOLDER: Funcionalidades futuras
  async createNewFolder() {
    showToast('Create folder feature coming soon!', 'info');
  },
  
  async renameFolder(folderId, currentName) {
    showToast('Rename folder feature coming soon!', 'info');
  },
  
  async deleteFolder(folderId, folderName) {
    showToast('Delete folder feature coming soon!', 'info');
  }
};

// Modificar a função switchTab existente para incluir nossa aba
document.addEventListener('DOMContentLoaded', () => {
  // Aguardar carregamento do admin
  setTimeout(() => {
    // Encontrar a função switchTab original
    const originalSwitchTab = window.switchTab;
    
    if (originalSwitchTab) {
      window.switchTab = function(tabId) {
        // Chamar função original
        originalSwitchTab(tabId);
        
        // Inicializar nosso manager se a aba photo-storage for selecionada
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