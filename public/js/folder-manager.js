// folder.js
// Variáveis globais
let currentFolderId = ''; // ID da pasta atual (inicialmente vazio, será definido na inicialização)
let folderStructure = []; // Armazenar estrutura de pastas para manipulação
let folderPath = []; // Armazenar caminho de navegação
let parentFolderId = null; // Variável global para armazenar o ID da pasta pai
let SUNSHINE_COWHIDES_ROOT_ID = ''; // ID da pasta raiz, será preenchido na inicialização

// Inicializar o gerenciador de pastas
function initFolderManager() {
  // Obter o ID da pasta raiz Sunshine Cowhides Actual Pictures
  apiClient.getRootFolderId()
    .then(function(result) {
      if (result.success) {
        currentFolderId = result.folderId;
        SUNSHINE_COWHIDES_ROOT_ID = result.folderId; // Armazenar o ID da pasta raiz
        
        // Inicializar folderPath apenas na primeira vez
        folderPath = [{
          id: result.folderId,
          name: "Sunshine Cowhides Actual Pictures"
        }];
        
        loadFolderStructure(currentFolderId);
      } else {
        showToast('Error loading root folder: ' + result.message, 'error');
      }
    })
    .catch(function(error) {
      showToast('Error initializing folder manager: ' + error, 'error');
    });
}

// Função modificada de loadFolderStructure para obter e armazenar o ID da pasta pai
function loadFolderStructure(folderId, parentPath = []) {
  showLoader();
  
  // Verificar se o ID da pasta raiz já foi definido
  if (SUNSHINE_COWHIDES_ROOT_ID && folderId !== SUNSHINE_COWHIDES_ROOT_ID) {
    // Não estamos na pasta raiz, então buscar o pai
    apiClient.getFolderInfo(folderId)
      .then(function(folderInfo) {
        if (folderInfo.success && folderInfo.parents && folderInfo.parents.length > 0) {
          parentFolderId = folderInfo.parents[0];
          updateBackButton(true);
        } else {
          parentFolderId = null;
          updateBackButton(false);
        }
      })
      .catch(function(error) {
        console.error("Error getting folder info:", error);
        parentFolderId = null;
        updateBackButton(false);
      });
  } else {
    // Estamos na pasta raiz ou SUNSHINE_COWHIDES_ROOT_ID ainda não foi definido
    parentFolderId = null;
    updateBackButton(false);
  }
  
  // Continuar com o código existente para carregar a estrutura de pastas
  apiClient.getFolderContents(folderId)
    .then(function(result) {
      hideLoader();
      
      if (result.success) {
        folderStructure = result.folders;
        currentFolderId = folderId;
        
        // Atualizar caminho de navegação
        if (parentPath.length > 0) {
          folderPath = parentPath;
        } else if (folderPath.length === 0) {
          // Início da navegação
          folderPath = [{
            id: folderId,
            name: "Sunshine Cowhides Actual Pictures"
          }];
        }
        
        updateBreadcrumb();
        renderFolderStructure(folderStructure);
      } else {
        showToast('Error loading folders: ' + result.message, 'error');
      }
    })
    .catch(function(error) {
      hideLoader();
      showToast('Error loading folder structure: ' + error, 'error');
    });
}

// Renderizar estrutura de pastas
function renderFolderStructure(folders) {
  const folderStructureEl = document.getElementById('folder-structure');
  
  if (!folders || folders.length === 0) {
    folderStructureEl.innerHTML = '<div class="empty-folder-message">No folders found in this location.</div>';
    return;
  }
  
  let html = '<ul class="folder-list">';
  
  folders.forEach(folder => {
    const hasFiles = folder.fileCount > 0;
    const fileCountBadge = hasFiles ? 
      `<span class="file-count-badge">${folder.fileCount} files</span>` : '';
    
    html += `
      <li class="folder-item">
        <div class="folder-info">
          <span class="folder-icon">📁</span>
          <span class="folder-name" onclick="navigateToFolder('${folder.id}', '${folder.name}')">${folder.name}</span>
          ${fileCountBadge}
          <div class="folder-actions">
            <button class="action-btn rename-btn" onclick="renameFolder('${folder.id}', '${folder.name}')">Rename</button>
            <button class="action-btn delete-btn" onclick="deleteFolder('${folder.id}', '${folder.name}')">Delete</button>
          </div>
        </div>
      </li>
    `;
  });
  
  html += '</ul>';
  folderStructureEl.innerHTML = html;
}

// Navegar para uma pasta
function navigateToFolder(folderId, folderName) {
  // Adicionar a pasta atual ao caminho
  folderPath.push({
    id: folderId,
    name: folderName
  });
  
  // Carregar conteúdo da nova pasta
  loadFolderStructure(folderId, folderPath);
}

// Navegar para trás no caminho
function navigateBack(index) {
  // Cortar o caminho até o índice selecionado
  folderPath = folderPath.slice(0, index + 1);
  
  // Carregar a pasta correspondente
  const targetFolder = folderPath[index];
  loadFolderStructure(targetFolder.id, folderPath);
}

// Navegar para a pasta pai
function navigateToParentFolder() {
  if (!parentFolderId) {
    showToast('Already at the top level folder', 'info');
    return;
  }
  
  // Se o folderPath tem mais de um elemento, podemos retornar no caminho
  if (folderPath.length > 1) {
    // Remover a pasta atual do caminho
    folderPath.pop();
    
    // Carregar a pasta pai
    const parentFolder = folderPath[folderPath.length - 1];
    loadFolderStructure(parentFolder.id, folderPath);
  } else {
    // Se não temos caminho registrado, mas temos parentFolderId, usamos ele
    apiClient.getFolderInfo(parentFolderId)
      .then(function(result) {
        if (result.success) {
          // Redefinir o caminho para incluir apenas a pasta pai
          folderPath = [{
            id: parentFolderId,
            name: result.name // Usar o nome real da pasta pai
          }];
          loadFolderStructure(parentFolderId, folderPath);
        } else {
          showToast('Error getting parent folder info', 'error');
        }
      })
      .catch(function(error) {
        showToast('Error navigating to parent folder', 'error');
      });
  }
}

// Atualizar a visibilidade do botão de retorno
function updateBackButton(show) {
  const backButton = document.getElementById('back-button');
  if (backButton) {
    backButton.style.display = show ? 'inline-flex' : 'none';
  } else {
    // Se o botão ainda não existe, vamos criar e adicionar à barra de ações
    if (show) {
      const folderActions = document.querySelector('.folder-actions');
      if (folderActions) {
        const backButton = document.createElement('button');
        backButton.id = 'back-button';
        backButton.className = 'btn btn-secondary';
        backButton.onclick = navigateToParentFolder;
        backButton.innerHTML = '<span class="folder-up-icon">↑</span> Back to Parent Folder';
        backButton.style.display = 'inline-flex';
        
        // Inserir o botão após o primeiro botão (Create Folder)
        const firstButton = folderActions.querySelector('button');
        if (firstButton) {
          folderActions.insertBefore(backButton, firstButton.nextSibling);
        } else {
          folderActions.appendChild(backButton);
        }
      }
    }
  }
}

// Atualizar breadcrumb de navegação
function updateBreadcrumb() {
  const pathElement = document.getElementById('current-folder-path');
  
  let html = '';
  folderPath.forEach((folder, index) => {
    if (index === folderPath.length - 1) {
      // Pasta atual (sem link)
      html += `<span class="current-folder">${folder.name}</span>`;
    } else {
      // Pasta no caminho (com link para retorno)
      html += `<span class="path-folder" onclick="navigateBack(${index})">${folder.name}</span> / `;
    }
  });
  
  pathElement.innerHTML = html;
}

// Criar nova pasta
function createNewFolder() {
  const folderName = prompt('Enter new folder name:');
  
  if (!folderName) return; // Cancelado ou vazio
  
  showLoader();
  
  apiClient.createFolder(currentFolderId, folderName)
    .then(function(result) {
      hideLoader();
      
      if (result.success) {
        showToast(`Folder "${folderName}" created successfully.`, 'success');
        refreshFolderStructure();
      } else {
        showToast('Error creating folder: ' + result.message, 'error');
      }
    })
    .catch(function(error) {
      hideLoader();
      showToast('Error creating folder: ' + error, 'error');
    });
}

// Renomear pasta
function renameFolder(folderId, currentName) {
  const newName = prompt('Enter new name for the folder:', currentName);
  
  if (!newName || newName === currentName) return; // Cancelado ou sem alteração
  
  showLoader();
  
  apiClient.renameFolder(folderId, newName)
    .then(function(result) {
      hideLoader();
      
      if (result.success) {
        showToast(`Folder renamed to "${newName}" successfully.`, 'success');
        refreshFolderStructure();
      } else {
        showToast('Error renaming folder: ' + result.message, 'error');
      }
    })
    .catch(function(error) {
      hideLoader();
      showToast('Error renaming folder: ' + error, 'error');
    });
}

// Excluir pasta
function deleteFolder(folderId, folderName) {
  showConfirm(
    `Are you sure you want to delete the folder "${folderName}"? This will also delete all files and subfolders inside.`,
    function() {
      showLoader();
      
      apiClient.deleteFolder(folderId)
        .then(function(result) {
          hideLoader();
          
          if (result.success) {
            showToast(`Folder "${folderName}" deleted successfully.`, 'success');
            refreshFolderStructure();
          } else {
            showToast('Error deleting folder: ' + result.message, 'error');
          }
        })
        .catch(function(error) {
          hideLoader();
          showToast('Error deleting folder: ' + error, 'error');
        });
    },
    'Confirm Deletion'
  );
}

// Atualizar estrutura de pastas
function refreshFolderStructure() {
  loadFolderStructure(currentFolderId, folderPath);
}

// Estender a função switchTab existente para inicializar o gerenciador de pastas quando necessário
const originalSwitchTab = window.switchTab || function() {};
window.switchTab = function(tabId) {
  if (typeof originalSwitchTab === 'function') {
    originalSwitchTab(tabId);
  }
  
  if (tabId === 'folder-management') {
    initFolderManager();
  }
};

// Verificar e adicionar o botão de volta na interface
function ensureBackButton() {
  // Verificar se o botão já existe
  if (!document.getElementById('back-button')) {
    const folderActions = document.querySelector('.folder-actions');
    if (folderActions) {
      const backButton = document.createElement('button');
      backButton.id = 'back-button';
      backButton.className = 'btn btn-secondary';
      backButton.onclick = function() { navigateToParentFolder(); };
      backButton.innerHTML = '<span class="folder-up-icon">↑</span> Back to Parent Folder';
      backButton.style.display = 'none'; // Inicialmente oculto
      
      // Inserir após o primeiro botão
      const firstButton = folderActions.querySelector('button');
      if (firstButton) {
        folderActions.insertBefore(backButton, firstButton.nextSibling);
      } else {
        folderActions.appendChild(backButton);
      }
    }
  }
}

// Adicionar estilo CSS para o botão de volta
function addBackButtonStyle() {
  // Verificar se o estilo já existe
  if (!document.getElementById('back-button-style')) {
    const style = document.createElement('style');
    style.id = 'back-button-style';
    style.innerHTML = `
      .folder-up-icon {
        margin-right: 5px;
        font-weight: bold;
      }
      
      #back-button {
        display: inline-flex;
        align-items: center;
      }
    `;
    document.head.appendChild(style);
  }
}

// Verificar e configurar elementos necessários quando a aba de pastas é carregada
document.addEventListener('DOMContentLoaded', function() {
  // Adicionar estilo para o botão
  addBackButtonStyle();
  
  // Tentar configurar o botão (se a aba for carregada após o carregamento do DOM)
  ensureBackButton();
});