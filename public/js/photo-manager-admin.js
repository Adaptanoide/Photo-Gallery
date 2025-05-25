// Adicionar ao admin.js ou criar novo arquivo photo-manager-admin.js

// Adicionar nova aba no painel admin
function addPhotoManagerTab() {
  // Adicionar botão da aba
  const tabButtons = document.querySelector('.admin-tabs');
  const newTabButton = document.createElement('button');
  newTabButton.className = 'tab-button';
  newTabButton.textContent = 'Photo Storage';
  newTabButton.onclick = () => switchTab('photo-storage');
  tabButtons.appendChild(newTabButton);

  // Adicionar conteúdo da aba
  const tabContent = document.querySelector('.tab-content');
  const newTabPane = document.createElement('div');
  newTabPane.id = 'photo-storage';
  newTabPane.className = 'tab-pane';
  newTabPane.innerHTML = `
    <div class="admin-section">
      <h3>Photo Storage Management</h3>
      <p>Manage photos and folders on local Render disk (50GB)</p>
      
      <div class="storage-stats-panel">
        <h4>Storage Statistics</h4>
        <div id="storage-stats-content">
          <div class="loading">Loading storage stats...</div>
        </div>
      </div>

      <div class="folder-management-panel">
        <h4>Folder Structure</h4>
        <div class="folder-toolbar">
          <button class="btn btn-gold" onclick="photoManager.createNewFolder()">New Folder</button>
          <button class="btn btn-secondary" onclick="photoManager.refreshStructure()">Refresh</button>
        </div>
        
        <div class="folder-tree-container">
          <div id="folder-tree" class="folder-tree">
            <div class="loading">Loading folder structure...</div>
          </div>
        </div>
      </div>

      <div class="photo-management-panel" style="display: none;">
        <h4>Photos in: <span id="current-folder-name"></span></h4>
        <div class="photo-grid" id="folder-photos">
          <!-- Photos will be loaded here -->
        </div>
      </div>
    </div>
  `;
  tabContent.appendChild(newTabPane);

  // Adicionar estilos
  const style = document.createElement('style');
  style.textContent = `
    .storage-stats-panel {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .storage-stats-content {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }

    .stat-card {
      background: white;
      padding: 15px;
      border-radius: 6px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: var(--color-gold);
    }

    .stat-label {
      font-size: 14px;
      color: #666;
      margin-top: 5px;
    }

    .folder-management-panel {
      margin-top: 30px;
    }

    .folder-toolbar {
      display: flex;
      gap: 10px;
      margin-bottom: 15px;
    }

    .folder-tree-container {
      background: white;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 20px;
      max-height: 400px;
      overflow-y: auto;
    }

    .folder-tree {
      font-family: monospace;
    }

    .folder-item {
      padding: 5px 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .folder-item:hover {
      background: #f0f0f0;
      border-radius: 4px;
    }

    .folder-item.selected {
      background: #e3f2fd;
      border-radius: 4px;
    }

    .folder-icon {
      width: 16px;
    }

    .folder-actions {
      margin-left: auto;
      display: none;
      gap: 5px;
    }

    .folder-item:hover .folder-actions {
      display: flex;
    }

    .folder-action-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 12px;
    }

    .folder-action-btn:hover {
      background: rgba(0,0,0,0.1);
    }

    .photo-management-panel {
      margin-top: 30px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 20px;
    }

    .photo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 10px;
      margin-top: 15px;
    }

    .photo-item {
      aspect-ratio: 1;
      background: #f0f0f0;
      border-radius: 4px;
      overflow: hidden;
      cursor: pointer;
      position: relative;
    }

    .photo-item img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .photo-item-actions {
      position: absolute;
      top: 5px;
      right: 5px;
      display: none;
    }

    .photo-item:hover .photo-item-actions {
      display: block;
    }

    .storage-progress-bar {
      width: 100%;
      height: 20px;
      background: #e0e0e0;
      border-radius: 10px;
      overflow: hidden;
      margin-top: 10px;
    }

    .storage-progress-fill {
      height: 100%;
      background: var(--color-gold);
      transition: width 0.3s ease;
    }

    .storage-progress-text {
      text-align: center;
      margin-top: 5px;
      font-size: 14px;
      color: #666;
    }

    .folder-children {
      margin-left: 20px;
    }
  `;
  document.head.appendChild(style);
}

// Objeto gerenciador de fotos
const photoManager = {
  currentStructure: null,
  selectedFolder: null,

  async init() {
    if (document.getElementById('photo-storage')) {
      await this.loadStorageStats();
      await this.loadFolderStructure();
    }
  },

  async loadStorageStats() {
    try {
      const response = await fetch('/api/photos/admin/folder-structure', {
        headers: {
          'Authorization': localStorage.getItem('adminToken')
        }
      });

      const data = await response.json();
      
      if (data.success && data.stats) {
        const stats = data.stats;
        document.getElementById('storage-stats-content').innerHTML = `
          <div class="storage-stats-content">
            <div class="stat-card">
              <div class="stat-value">${stats.photoCount || 0}</div>
              <div class="stat-label">Total Photos</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.folderCount || 0}</div>
              <div class="stat-label">Folders</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.usedGB || 0} GB</div>
              <div class="stat-label">Used Space</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.availableGB || 0} GB</div>
              <div class="stat-label">Available</div>
            </div>
          </div>
          <div class="storage-progress-bar">
            <div class="storage-progress-fill" style="width: ${stats.percentUsed || 0}%"></div>
          </div>
          <div class="storage-progress-text">${stats.percentUsed || 0}% of 50GB used</div>
        `;
      }
    } catch (error) {
      console.error('Error loading storage stats:', error);
      document.getElementById('storage-stats-content').innerHTML = 
        '<div class="error">Failed to load storage statistics</div>';
    }
  },

  async loadFolderStructure() {
    try {
      const response = await fetch('/api/photos/admin/folder-structure', {
        headers: {
          'Authorization': localStorage.getItem('adminToken')
        }
      });

      const data = await response.json();
      
      if (data.success && data.structure) {
        this.currentStructure = data.structure;
        this.renderFolderTree(data.structure);
      }
    } catch (error) {
      console.error('Error loading folder structure:', error);
      document.getElementById('folder-tree').innerHTML = 
        '<div class="error">Failed to load folder structure</div>';
    }
  },

  renderFolderTree(folders, container = null, level = 0) {
    if (!container) {
      container = document.getElementById('folder-tree');
      container.innerHTML = '';
    }

    folders.forEach(folder => {
      const folderDiv = document.createElement('div');
      folderDiv.className = 'folder-item';
      folderDiv.style.paddingLeft = `${level * 20}px`;
      
      folderDiv.innerHTML = `
        <span class="folder-icon">📁</span>
        <span class="folder-name">${folder.name}</span>
        <span class="folder-count">(${folder.fileCount || 0} photos)</span>
        <div class="folder-actions">
          <button class="folder-action-btn" onclick="photoManager.renameFolder('${folder.id}', '${folder.name}')" title="Rename">✏️</button>
          <button class="folder-action-btn" onclick="photoManager.deleteFolder('${folder.id}', '${folder.name}')" title="Delete">🗑️</button>
          <button class="folder-action-btn" onclick="photoManager.viewFolderPhotos('${folder.id}', '${folder.name}')" title="View Photos">👁️</button>
        </div>
      `;
      
      folderDiv.onclick = (e) => {
        if (!e.target.classList.contains('folder-action-btn')) {
          this.selectFolder(folder, folderDiv);
        }
      };
      
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
  },

  async createNewFolder() {
    const folderPath = prompt('Enter folder path (e.g., "Category/Subcategory"):');
    if (!folderPath) return;

    try {
      const response = await fetch('/api/photos/admin/folder/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('adminToken')
        },
        body: JSON.stringify({ folderPath })
      });

      const result = await response.json();
      
      if (result.success) {
        showToast('Folder created successfully', 'success');
        this.refreshStructure();
      } else {
        showToast('Error creating folder: ' + result.message, 'error');
      }
    } catch (error) {
      showToast('Error creating folder: ' + error.message, 'error');
    }
  },

  async renameFolder(folderId, currentName) {
    const newName = prompt(`Rename folder "${currentName}" to:`, currentName);
    if (!newName || newName === currentName) return;

    try {
      const response = await fetch('/api/photos/admin/folder/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('adminToken')
        },
        body: JSON.stringify({ folderId, newName })
      });

      const result = await response.json();
      
      if (result.success) {
        showToast('Folder renamed successfully', 'success');
        this.refreshStructure();
      } else {
        showToast('Error renaming folder: ' + result.message, 'error');
      }
    } catch (error) {
      showToast('Error renaming folder: ' + error.message, 'error');
    }
  },

  async deleteFolder(folderId, folderName) {
    if (!confirm(`Delete folder "${folderName}"? (Only empty folders can be deleted)`)) return;

    try {
      const response = await fetch('/api/photos/admin/folder/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('adminToken')
        },
        body: JSON.stringify({ folderId })
      });

      const result = await response.json();
      
      if (result.success) {
        showToast('Folder deleted successfully', 'success');
        this.refreshStructure();
      } else {
        showToast('Error deleting folder: ' + result.message, 'error');
      }
    } catch (error) {
      showToast('Error deleting folder: ' + error.message, 'error');
    }
  },

  async viewFolderPhotos(folderId, folderName) {
    document.getElementById('current-folder-name').textContent = folderName;
    document.querySelector('.photo-management-panel').style.display = 'block';
    
    // Carregar fotos da pasta
    try {
      const response = await fetch(`/api/photos?category_id=${folderId}`, {
        headers: {
          'Authorization': localStorage.getItem('adminToken')
        }
      });

      const data = await response.json();
      const photos = data.photos || data;
      
      const photoGrid = document.getElementById('folder-photos');
      photoGrid.innerHTML = '';
      
      if (!photos || photos.length === 0) {
        photoGrid.innerHTML = '<p>No photos in this folder</p>';
        return;
      }
      
      photos.forEach(photo => {
        const photoDiv = document.createElement('div');
        photoDiv.className = 'photo-item';
        photoDiv.innerHTML = `
          <img src="${photo.thumbnail}" alt="${photo.name}" loading="lazy">
          <div class="photo-item-actions">
            <button class="folder-action-btn" onclick="photoManager.movePhoto('${photo.id}', '${folderId}')" title="Move">↗️</button>
          </div>
        `;
        photoGrid.appendChild(photoDiv);
      });
      
    } catch (error) {
      console.error('Error loading folder photos:', error);
      document.getElementById('folder-photos').innerHTML = 
        '<p class="error">Failed to load photos</p>';
    }
  },

  async movePhoto(photoId, fromCategoryId) {
    // Implementar diálogo para selecionar pasta destino
    const toCategory = prompt('Enter destination folder ID:');
    if (!toCategory) return;

    try {
      const response = await fetch('/api/photos/admin/photo/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('adminToken')
        },
        body: JSON.stringify({
          photoId,
          fromCategoryId,
          toCategoryId: toCategory
        })
      });

      const result = await response.json();
      
      if (result.success) {
        showToast('Photo moved successfully', 'success');
        this.viewFolderPhotos(fromCategoryId, this.selectedFolder.name);
      } else {
        showToast('Error moving photo: ' + result.message, 'error');
      }
    } catch (error) {
      showToast('Error moving photo: ' + error.message, 'error');
    }
  },

  async refreshStructure() {
    await this.loadStorageStats();
    await this.loadFolderStructure();
  }
};

// Adicionar aba quando o admin carregar
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.includes('admin') || document.getElementById('admin-panel-modal')) {
    // Aguardar um pouco para garantir que o admin está carregado
    setTimeout(() => {
      addPhotoManagerTab();
      
      // Modificar switchTab para incluir nossa nova aba
      const originalSwitchTab = window.switchTab;
      window.switchTab = function(tabId) {
        originalSwitchTab(tabId);
        
        if (tabId === 'photo-storage') {
          photoManager.init();
        }
      };
    }, 1000);
  }
});