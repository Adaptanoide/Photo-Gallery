// price-manager.js
// Variáveis globais
let leafFolders = []; // Armazena todas as pastas finais
let priceManagerCategoryPrices = {}; // Armazena os preços das categorias - Renomeado para evitar conflito
let isLoadingFolders = false; // Flag para controlar carregamento

// Função de inicialização
function initPriceManager() {
  console.log("Initializing price manager...");
  
  // Mostrar mensagem de carregamento com indicador de progresso
  document.getElementById('category-price-container').innerHTML = 
    '<div class="loading-folders">Carregando dados...<div id="loading-progress">Preparando...</div></div>';
  
  isLoadingFolders = true;
  
  // Primeiro carregar preços (geralmente rápido)
  loadCategoryPrices()
    .then(() => {
      // Verificar se já temos pastas em cache localmente
      const cachedFolders = sessionStorage.getItem('leaf_folders');
      const cacheTimestamp = sessionStorage.getItem('leaf_folders_timestamp');
      const cacheAge = cacheTimestamp ? (Date.now() - parseInt(cacheTimestamp)) : null;
      
      // Usar cache se disponível e fresco (menos de 10 minutos)
      if (cachedFolders && cacheAge && cacheAge < 10 * 60 * 1000) {
        console.log('Using cached folders from session storage');
        leafFolders = JSON.parse(cachedFolders);
        renderCategoryPriceTable();
        isLoadingFolders = false;
        
        // Adicionar evento de redimensionamento
        setTimeout(adjustTableHeight, 100);
        window.addEventListener('resize', adjustTableHeight);
        
        // Ainda buscar atualizações em segundo plano
        backgroundRefreshFolders();
        return;
      }
      
      // Se não temos cache, fazer carregamento normal com UI de progresso
      loadLeafFoldersWithProgress();
    })
    .catch(error => {
      document.getElementById('category-price-container').innerHTML = 
        `<div class="error-message">Erro ao carregar dados: ${error.message}</div>`;
      isLoadingFolders = false;
    });
}

// Carregar pastas com progresso
function loadLeafFoldersWithProgress() {
  const progressElement = document.getElementById('loading-progress');
  
  // Atualizar mensagem de progresso
  if (progressElement) {
    progressElement.textContent = 'Buscando categorias...';
  }
  
  console.log('Fazendo requisição para: /api/admin/folders/leaf?include_empty=true');
  
  // Fazer a requisição
  fetch('/api/admin/folders/leaf?include_empty=true')
    .then(response => {
      console.log('Response status:', response.status);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(result => {
      console.log('API Response completa:', result);
      
      if (result.success) {
        leafFolders = result.folders || [];
        console.log(`Loaded ${leafFolders.length} leaf folders`);
        console.log('Primeiras 3 pastas:', leafFolders.slice(0, 3));
        
        // Armazenar em cache na sessão
        sessionStorage.setItem('leaf_folders', JSON.stringify(leafFolders));
        sessionStorage.setItem('leaf_folders_timestamp', Date.now().toString());
        
        // Atualizar UI
        renderCategoryPriceTable();
        
        // Ajustar altura da tabela
        setTimeout(adjustTableHeight, 100);
        
        // Adicionar evento de redimensionamento
        window.addEventListener('resize', adjustTableHeight);
      } else {
        throw new Error(result.message || 'Falha ao carregar pastas');
      }
    })
    .catch(error => {
      console.error('Error loading leaf folders:', error);
      document.getElementById('category-price-container').innerHTML = 
        `<div class="error-message">Erro ao carregar categorias: ${error.message}</div>`;
    })
    .finally(() => {
      isLoadingFolders = false;
    });
}

// Atualizar pastas em segundo plano sem interromper o usuário
function backgroundRefreshFolders() {
  fetch('/api/admin/folders/leaf?include_empty=true')
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        const newFolders = result.folders || [];
        
        // Verificar se houve mudanças significativas
        const oldLength = leafFolders.length;
        const newLength = newFolders.length;
        
        // Se temos diferenças significativas, atualizar UI
        if (Math.abs(oldLength - newLength) > 5 || newLength === 0) {
          leafFolders = newFolders;
          sessionStorage.setItem('leaf_folders', JSON.stringify(leafFolders));
          sessionStorage.setItem('leaf_folders_timestamp', Date.now().toString());
          renderCategoryPriceTable();
        }
      }
    })
    .catch(error => {
      console.error('Background refresh error:', error);
      // Não mostramos erro na UI para atualizações em segundo plano
    });
}

// Carregar preços das categorias
function loadCategoryPrices() {
  return fetch('/api/admin/categories/prices')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(result => {
      if (result.success) {
        priceManagerCategoryPrices = {}; // ALTERADO: Renomeado para evitar conflito
        
        // Transformar array em objeto para fácil acesso
        (result.prices || []).forEach(price => {
          priceManagerCategoryPrices[price.folderId] = price; // ALTERADO: Renomeado para evitar conflito
        });
        
        console.log(`Loaded ${Object.keys(priceManagerCategoryPrices).length} category prices`); // ALTERADO: Renomeado para evitar conflito
        return priceManagerCategoryPrices; // ALTERADO: Renomeado para evitar conflito
      } else {
        throw new Error(result.message || 'Falha ao carregar preços');
      }
    });
}

// FUNÇÃO PRINCIPAL - LIMPA E CORRIGIDA
function renderCategoryPriceTable() {
  const container = document.getElementById('category-price-container');
  
  if (!leafFolders || leafFolders.length === 0) {
    if (isLoadingFolders) {
      container.innerHTML = '<div class="loading-folders">Carregando categorias...<div id="loading-progress">Aguarde...</div></div>';
    } else {
      container.innerHTML = '<div class="empty-folder-message">Nenhuma categoria encontrada.</div>';
    }
    return;
  }
  
  let html = `
    <div class="bulk-actions">
      <h4>Atualização em Lote</h4>
      <div class="bulk-form">
        <select id="bulk-update-type" class="form-control">
          <option value="fixed">Definir Preço Fixo</option>
          <option value="percentage">Ajustar por Porcentagem</option>
        </select>
        <input type="number" id="bulk-value" class="form-control" placeholder="Valor" step="0.01">
        <button class="btn btn-gold" onclick="applyBulkUpdate()">Aplicar às Selecionadas</button>
      </div>
    </div>
    
    <div class="table-filter">
      <input type="text" id="category-filter" class="form-control" placeholder="Filtrar categorias..." onkeyup="filterCategories()">
      <div class="filter-stats">Mostrando <span id="displayed-count">${leafFolders.length}</span> de ${leafFolders.length} categorias</div>
    </div>
    
    <div class="price-table-container">
      <table class="price-table">
        <thead>
          <tr>
            <th class="checkbox-column"><input type="checkbox" id="select-all" onclick="toggleSelectAll()"></th>
            <th class="category-column">Categoria</th>
            <th class="photos-column">Qtd. Fotos</th>
            <th class="price-column">Preço</th>
            <th class="actions-column">Ações</th>
          </tr>
        </thead>
        <tbody id="price-table-body">
  `;
  
  // Renderizar TODAS as pastas de uma vez - SÓ COM OS 2 BOTÕES
  leafFolders.forEach(folder => {
    const price = priceManagerCategoryPrices[folder.id] ? priceManagerCategoryPrices[folder.id].price : '';
    const formattedPrice = price ? '$' + parseFloat(price).toFixed(2) : '-';
    const hasPrice = price !== '';
    
    html += `
      <tr data-folder-id="${folder.id}" data-folder-name="${folder.name.toLowerCase()}">
        <td><input type="checkbox" class="category-checkbox" value="${folder.id}"></td>
        <td>${folder.name}</td>
        <td>${folder.fileCount || '0'}</td>
        <td>
          <span class="price-display">${formattedPrice}</span>
          <input type="number" class="price-input form-control" value="${price}" style="display: none;" step="0.01">
        </td>
        <td>
          <button class="action-btn edit-price-btn" onclick="togglePriceEdit('${folder.id}')">
            ${hasPrice ? 'Edit Price' : 'Set Price'}
          </button>
          <button class="action-btn save-price-btn" onclick="savePrice('${folder.id}')" style="display: none;">Salvar</button>
        </td>
      </tr>
    `;
  });
  
  html += `
        </tbody>
      </table>
    </div>
  `;
  
  // DEFINIR O HTML UMA ÚNICA VEZ
  container.innerHTML = html;
}

// Função para ajustar altura da tabela
function adjustTableHeight() {
  const container = document.querySelector('.price-table-container');
  if (!container) return;
  
  const windowHeight = window.innerHeight;
  const containerPosition = container.getBoundingClientRect().top;
  const footerHeight = 100; // Espaço estimado para o rodapé
  
  const availableHeight = windowHeight - containerPosition - footerHeight;
  container.style.height = `${Math.max(400, availableHeight)}px`;
}

// Função para filtrar categorias
function filterCategories() {
  const filterValue = document.getElementById('category-filter').value.toLowerCase();
  const rows = document.querySelectorAll('#price-table-body tr');
  let displayedCount = 0;
  
  rows.forEach(row => {
    const folderName = row.getAttribute('data-folder-name');
    if (folderName.includes(filterValue)) {
      row.style.display = '';
      displayedCount++;
    } else {
      row.style.display = 'none';
    }
  });
  
  // Atualizar contador
  const countDisplay = document.getElementById('displayed-count');
  if (countDisplay) {
    countDisplay.textContent = displayedCount;
  }
}

// Alternar edição de preço
function togglePriceEdit(folderId) {
  const row = document.querySelector(`tr[data-folder-id="${folderId}"]`);
  const priceDisplay = row.querySelector('.price-display');
  const priceInput = row.querySelector('.price-input');
  const editBtn = row.querySelector('.edit-price-btn');
  const saveBtn = row.querySelector('.save-price-btn');
  
  priceDisplay.style.display = 'none';
  priceInput.style.display = 'block';
  editBtn.style.display = 'none';
  saveBtn.style.display = 'inline-block';
  
  priceInput.focus();
}

// Salvar preço
function savePrice(folderId) {
  const row = document.querySelector(`tr[data-folder-id="${folderId}"]`);
  const priceInput = row.querySelector('.price-input');
  const price = parseFloat(priceInput.value);
  
  if (isNaN(price) || price < 0) {
    showToast('Por favor, insira um preço válido', 'error');
    return;
  }
  
  showLoader();
  
  fetch(`/api/admin/categories/${folderId}/price`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ price })
  })
  .then(response => response.json())
  .then(result => {
    hideLoader();
    
    if (result.success) {
      showToast(`Preço atualizado com sucesso para a categoria`, 'success');
      
      // Atualizar preço no objeto local
      if (priceManagerCategoryPrices[folderId]) {
        priceManagerCategoryPrices[folderId].price = price;
      } else {
        priceManagerCategoryPrices[folderId] = {
          folderId: folderId,
          price: price
        };
      }
      
      // Atualizar UI
      const priceDisplay = row.querySelector('.price-display');
      priceDisplay.textContent = '$' + price.toFixed(2);
      priceDisplay.style.display = 'block';
      priceInput.style.display = 'none';
      
      // Atualizar texto do botão, agora é "Edit Price" porque temos um preço
      const editBtn = row.querySelector('.edit-price-btn');
      editBtn.textContent = 'Edit Price';
      editBtn.style.display = 'inline-block';
      
      row.querySelector('.save-price-btn').style.display = 'none';
    } else {
      showToast('Erro ao atualizar preço: ' + result.message, 'error');
    }
  })
  .catch(error => {
    hideLoader();
    showToast('Erro ao atualizar preço: ' + error.message, 'error');
  });
}

// Aplicar atualização em lote
function applyBulkUpdate() {
  const updateType = document.getElementById('bulk-update-type').value;
  const valueInput = document.getElementById('bulk-value');
  const value = parseFloat(valueInput.value);
  
  if (isNaN(value)) {
    showToast('Por favor, insira um valor válido', 'error');
    return;
  }
  
  // Obter todas as categorias selecionadas
  const selectedCheckboxes = document.querySelectorAll('.category-checkbox:checked');
  if (selectedCheckboxes.length === 0) {
    showToast('Por favor, selecione pelo menos uma categoria', 'error');
    return;
  }
  
  const selectedFolderIds = Array.from(selectedCheckboxes).map(cb => cb.value);
  
  // Preparar dados para atualização em lote
  const updateData = {
    type: updateType,
    value: value,
    folderIds: selectedFolderIds
  };
  
  showLoader();
  
  fetch('/api/admin/categories/batch-update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData)
  })
  .then(response => response.json())
  .then(result => {
    hideLoader();
    
    if (result.success) {
      showToast(`Preços atualizados para ${selectedFolderIds.length} categorias`, 'success');
      
      // Recarregar preços
      loadCategoryPrices().then(() => {
        renderCategoryPriceTable();
      });
    } else {
      showToast('Erro ao atualizar preços: ' + result.message, 'error');
    }
  })
  .catch(error => {
    hideLoader();
    showToast('Erro ao atualizar preços: ' + error.message, 'error');
  });
}

// Alternar seleção de todas as categorias
function toggleSelectAll() {
  const selectAllCheckbox = document.getElementById('select-all');
  const checkboxes = document.querySelectorAll('.category-checkbox');
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = selectAllCheckbox.checked;
  });
}

// Estender a função switchTab existente para inicializar o gerenciador de preços quando necessário
(function() {
  // Armazenar a função original
  const currentSwitchTabFunc = window.switchTab;
  
  // Definir a nova função que estende a original
  window.switchTab = function(tabId) {
    // Chamar a função original
    if (typeof currentSwitchTabFunc === 'function') {
      currentSwitchTabFunc(tabId);
    }
    
    // Adicionar comportamento extra apenas para a tab de preços
    if (tabId === 'price-management') {
      console.log("Initializing price manager...");
      initPriceManager();
    }
  };
})();