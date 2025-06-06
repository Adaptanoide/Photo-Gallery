// admin.js
// Load admin panel
function loadAdminPanel() {
  document.getElementById('admin-panel-modal').style.display = 'block';
  loadActiveCodes();
  setupResponsiveAdminPanel();

  // Reload categories with admin privileges
  loadCategories();
}

// Function to handle responsive admin panel
function setupResponsiveAdminPanel() {
  // Get the mobile close button
  const mobileCloseBtn = document.querySelector('#admin-panel-modal .mobile-close-btn');

  // Function to check window size and show/hide button
  function checkWindowSize() {
    if (window.innerWidth <= 768) {
      mobileCloseBtn.style.display = 'flex';
    } else {
      mobileCloseBtn.style.display = 'none';
    }
  }

  // Initial check
  checkWindowSize();

  // Listen for window resize
  window.addEventListener('resize', checkWindowSize);
}

// Function to switch between tabs
function switchTab(tabId) {
  // Hide all tab panes
  const tabPanes = document.querySelectorAll('.tab-pane');
  tabPanes.forEach(pane => {
    pane.classList.remove('active');
  });

  // Deactivate all tab buttons
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.classList.remove('active');
  });

  // Show the selected tab pane
  document.getElementById(tabId).classList.add('active');

  // Initialize specific tabs
  if (tabId === 'shipment-control') {
    initShipmentTab();
  }

  // Activate the clicked tab button
  const activeButton = document.querySelector(`.tab-button[onclick="switchTab('${tabId}')"]`);
  if (activeButton) {
    activeButton.classList.add('active');
  }

  // Load data based on the tab
  if (tabId === 'customer-codes') {
    loadActiveCodes();
  } else if (tabId === 'order-management') {
    const status = document.getElementById('order-status').value;
    loadOrderFolders(status);
  } else if (tabId === 'price-management') {
    console.log("Initializing price manager...");
    initPriceManager();
  }
}

// Load active customer codes
function loadActiveCodes() {
  const codesList = document.getElementById('active-codes-list');
  codesList.innerHTML = 'Loading...';

  fetch('/api/admin/codes')
    .then(response => response.json())
    .then(result => {
      if (!result.success || !result.codes || result.codes.length === 0) {
        codesList.innerHTML = '<p>No active codes found.</p>';
        return;
      }

      let html = '<table style="width: 100%; border-collapse: collapse;">';
      html += '<tr><th style="text-align: left; padding: 8px;">Code</th><th style="text-align: left; padding: 8px;">Customer</th><th style="text-align: left; padding: 8px;">Created</th><th style="text-align: center; padding: 8px;">Actions</th></tr>';

      result.codes.forEach(data => {
        const date = data.createdAt ? new Date(data.createdAt) : new Date();
        const formattedDate = date.toLocaleDateString();

        html += `<tr>
        <td style="padding: 8px;">${data.code}</td>
        <td style="padding: 8px;">${data.customerName || 'Anonymous'}</td>
        <td style="padding: 8px;">${formattedDate}</td>
        <td style="padding: 8px; text-align: center;">
          <div class="action-buttons-container" style="display: flex; justify-content: center; gap: 8px; flex-direction: row; flex-wrap: nowrap;">
            <button class="btn btn-gold action-btn" style="background-color: #D4AF37; color: #212529;" onclick="editCustomerAccess('${data.code}', '${data.customerName || 'Anonymous'}')">Edit Access</button>
            <button class="btn btn-danger action-btn trash-button" style="width: 36px !important; min-width: 36px !important; padding: 6px 0px;" onclick="deleteCustomerCode('${data.code}', '${data.customerName || 'Anonymous'}')">🗑️</button>
          </div>
        </td>
      </tr>`;
      });

      html += '</table>';
      codesList.innerHTML = html;
    })
    .catch((error) => {
      codesList.innerHTML = `<p>Error loading codes: ${error.message}</p>`;
    });
}

// Generate new customer code
function generateCustomerCode() {
  const customerName = document.getElementById('customer-name').value.trim();

  if (!customerName) {
    alert('Please enter a customer name. This is required for order processing.');
    return;
  }

  // Usar a API REST para gerar código
  fetch('/api/admin/code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ customerName })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        document.getElementById('new-code').textContent = data.code;
        document.getElementById('generated-code').style.display = 'block';
        document.getElementById('customer-name').value = '';

        // Show notification
        showToast(`New customer code ${data.code} has been generated successfully`, 'success');

        // Refresh the list of codes
        loadActiveCodes();
      } else {
        showToast('Error generating code: ' + data.message, 'error');
      }
    })
    .catch((error) => {
      showToast('Error generating code: ' + error.message, 'error');
    });
}

function loadOrderFolders(status, retryCount = 0) {
  const MAX_RETRIES = 3;
  const listElement = document.getElementById('order-folders-list');

  if (retryCount === 0) {
    listElement.innerHTML = 'Loading...';
  }

  console.log(`Attempting to load folders (attempt ${retryCount + 1}/${MAX_RETRIES + 1})...`);

  apiClient.listOrderFolders(status)
    .then(function (result) {
      console.log("Received result:", result);

      // Handle null result with retry logic
      if (!result) {
        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
          setTimeout(() => {
            loadOrderFolders(status, retryCount + 1);
          }, 1000 * (retryCount + 1));
          return;
        } else {
          listElement.innerHTML = '<p>Error: Server returned no data after multiple attempts. Please try again later.</p>';
          return;
        }
      }

      // Handle error case
      if (!result.success) {
        listElement.innerHTML = `<p>Error loading folders: ${result.message || 'Unknown error'}</p>`;
        return;
      }

      // Get folders from result or use empty array as fallback
      const folders = result.folders || [];

      // Handle empty folder list
      if (folders.length === 0) {
        listElement.innerHTML = '<p>No order folders found for this status.</p>';
        return;
      }

      // Build HTML table for folders
      let html = '<table style="width: 100%; border-collapse: collapse;">';
      html += '<tr><th style="text-align: left; padding: 8px;">Order Name</th><th style="text-align: left; padding: 8px;">Created</th><th style="text-align: left; padding: 8px;">Action</th></tr>';

      folders.forEach(folder => {
        const date = new Date(folder.dateCreated);
        const formattedDate = date.toLocaleDateString();
      
        // Different action buttons based on current status
        let actionButtons = '';
        if (status === 'waiting') {
          actionButtons = `
            <button class="btn btn-secondary" style="padding: 4px 8px; white-space: nowrap;" 
              onclick="viewOrderDetails('${folder.id}', '${folder.name}')">View Details</button>
            <button class="btn btn-gold" style="padding: 4px 8px; white-space: nowrap;" 
              onclick="moveOrderToSold('${folder.id}', '${folder.name}')">Mark as Sold</button>
            <button class="btn btn-info" style="padding: 4px 8px; white-space: nowrap;" 
              onclick="openReturnToStockModal('${folder.id}', '${folder.name}')">📦 Return to Stock</button>
          `;
        } else if (status === 'paid') {
          actionButtons = `
            <button class="btn btn-secondary" style="padding: 4px 8px; white-space: nowrap;" 
              onclick="viewOrderDetails('${folder.id}', '${folder.name}')">View Details</button>
            <button class="btn btn-info" style="padding: 4px 8px; white-space: nowrap;" 
              onclick="openReturnToStockModal('${folder.id}', '${folder.name}')">📦 Return to Stock</button>
          `;
        }
      
        html += `<tr>
          <td style="padding: 8px;">${folder.name}</td>
          <td style="padding: 8px;">${formattedDate}</td>
          <td style="padding: 8px; text-align: right;">
            <div class="button-container" style="display: flex; flex-wrap: nowrap; gap: 5px; justify-content: flex-end;">
              ${actionButtons}
            </div>
          </td>
        </tr>`;
      });

      html += '</table>';
      listElement.innerHTML = html;
    })
    .catch(function (error) {
      console.error("Error from server:", error);

      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying after error... (${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => {
          loadOrderFolders(status, retryCount + 1);
        }, 1000 * (retryCount + 1));
        return;
      }

      listElement.innerHTML = `<p>Error loading folders: ${error}</p>`;
    });
}

// Function to attempt refreshing the folder list with fallback
function refreshFolderList() {
  const status = document.getElementById('order-status').value;

  // Try primary method first
  loadOrderFolders(status, 0);

  // If that fails (no response within 5 seconds), try alternative method
  setTimeout(function () {
    const listElement = document.getElementById('order-folders-list');
    if (listElement.innerHTML.includes('Loading...')) {
      loadFoldersAlternative(status);
    }
  }, 5000);
}

// Alternative approach to load folders if the main method fails
function loadFoldersAlternative(status) {
  const listElement = document.getElementById('order-folders-list');
  listElement.innerHTML = 'Trying alternative loading method...';

  apiClient.listFoldersByStatus(status)
    .then(function (result) {
      console.log("Alternative method result:", result);

      if (!result || !result.success) {
        listElement.innerHTML = '<p>Error: Could not load folders using any method. Please check folder permissions and IDs.</p>';
        return;
      }

      const folders = result.folders || [];

      if (folders.length === 0) {
        listElement.innerHTML = '<p>No order folders found for this status.</p>';
        return;
      }

      // Same display logic as before...
      let html = '<table style="width: 100%; border-collapse: collapse;">';
      html += '<tr><th style="text-align: left; padding: 8px;">Order Name</th><th style="text-align: left; padding: 8px;">Created</th><th style="text-align: left; padding: 8px;">Action</th></tr>';

      folders.forEach(folder => {
        const date = new Date(folder.dateCreated);
        const formattedDate = date.toLocaleDateString();


        let actionButton = '';
        if (status === 'waiting') {
          actionButton = `<button class="btn btn-gold" style="padding: 4px 8px;" 
            onclick="moveOrderToSold('${folder.id}', '${folder.name}')">Mark as Sold</button>`;
        } else if (status === 'paid') {
          actionButton = `<button class="btn btn-secondary" style="padding: 4px 8px;" 
            onclick="useOrderFolder('${folder.id}', '${folder.name}')">View Details</button>`;
        }

        html += `<tr>
          <td style="padding: 8px;">${folder.name}</td>
          <td style="padding: 8px;">${formattedDate}</td>
          <td style="padding: 8px;">
            ${actionButton}
          </td>
        </tr>`;
      });

      html += '</table>';
      listElement.innerHTML = html;
    })
    .catch(function (error) {
      listElement.innerHTML = `<p>Error: ${error}</p>`;
    });
}

// Function to use selected folder
function useOrderFolder(folderId, folderName) {
  document.getElementById('order-folder').value = folderId;
  showToast(`Selected folder: "${folderName}"`, 'info');
}

// Function to move an order to "Sold" status
function moveOrderToSold(folderId, folderName) {
  showConfirm(
    `Are you sure you want to mark "${folderName}" as sold?`,
    function () {
      showLoader();

      apiClient.updateOrderStatus('paid', folderId)
        .then(function (result) {
          hideLoader();

          if (result.success) {
            showToast(`Order "${folderName}" successfully marked as sold!`, 'success');

            // Refresh the folder list
            loadOrderFolders('waiting');
          } else {
            showToast('Error updating order: ' + result.message, 'error');
          }
        })
        .catch(function (error) {
          hideLoader();
          showToast('Error updating order: ' + error, 'error');
        });
    },
    'Confirm Sale'
  );
}

// Function to update order status and move files
function updateOrderStatus() {
  const status = document.getElementById('order-status').value;
  const folderId = document.getElementById('order-folder').value.trim();

  if (!folderId) {
    alert('Please enter a folder ID.');
    return;
  }

  showLoader();

  apiClient.updateOrderStatus(status, folderId)
    .then(function (result) {
      hideLoader();

      if (result.success) {
        alert('Order status updated successfully. Files moved to appropriate folder.');

        // Refresh the folder list
        loadOrderFolders(status);
      } else {
        alert('Error updating order: ' + result.message);
      }
    })
    .catch(function (error) {
      hideLoader();
      alert('Error updating order: ' + error);
    });
}

// Function to delete customer code
function deleteCustomerCode(code, customerName) {
  showConfirm(
    `Are you sure you want to delete the code "${code}" for customer "${customerName}"?`,
    function () {
      showLoader();

      apiClient.deleteCustomerCode(code)
        .then(function (result) {
          hideLoader();

          if (result.success) {
            showToast(`Code ${code} for ${customerName} successfully deleted!`, 'success');
            // Refresh the list of codes
            loadActiveCodes();
          } else {
            showToast('Error deleting code: ' + result.message, 'error');
          }
        })
        .catch(function (error) {
          hideLoader();
          showToast('Error deleting code: ' + error, 'error');
        });
    },
    'Confirm Deletion'
  );
}

// Variáveis globais para gerenciamento de acesso a categorias
// ALTERADO: Renomeamos de currentCustomerCode para editingCustomerCode para evitar conflito
let editingCustomerCode = '';
let currentCustomerName = '';
let categoryAccessData = { categoryAccess: [] };
let allCategories = [];
let categoryPrices = {};

// Função para abrir o modal de edição de acesso
function editCustomerAccess(code, name) {
  // ALTERADO: Usando editingCustomerCode em vez de currentCustomerCode
  editingCustomerCode = code;
  currentCustomerName = name;

  // Atualizar título do modal
  document.getElementById('customer-name-title').textContent = name;

  // Mostrar loader
  document.getElementById('category-access-list').innerHTML =
    '<tr><td colspan="6" class="loading-text">Loading categories...</td></tr>';

  // Abrir modal
  document.getElementById('category-access-modal').style.display = 'block';

  // Carregar dados
  loadCustomerCategoryData(code);
}

// Carregar dados de categorias e acesso do cliente
async function loadCustomerCategoryData(code) {
  showLoader();

  try {
    // Carregar todas as categorias (leaf folders) - MODIFICADO: adicionar parâmetro include_empty=true
    const leafFoldersResponse = await apiClient.getLeafFolders(true); // Incluir pastas vazias

    if (!leafFoldersResponse.success) {
      document.getElementById('category-access-list').innerHTML =
        `<tr><td colspan="6" class="loading-text">Error loading categories: ${leafFoldersResponse.message}</td></tr>`;
      hideLoader();
      return;
    }

    allCategories = leafFoldersResponse.folders || [];

    // Carregar preços padrão das categorias
    const pricesResponse = await apiClient.getCategoryPrices();

    if (pricesResponse.success) {
      const prices = pricesResponse.prices || [];
      // Converter para um mapa para fácil acesso
      categoryPrices = {};
      prices.forEach(price => {
        categoryPrices[price.folderId] = price;
      });
    }

    // Carregar configurações de acesso do cliente
    const accessResponse = await apiClient.getCustomerCategoryAccess(code);

    if (accessResponse.success) {
      categoryAccessData = accessResponse.data || { categoryAccess: [] };

      // Garantir que temos um array de acesso
      if (!categoryAccessData.categoryAccess) {
        categoryAccessData.categoryAccess = [];
      }
      
      // Log para depuração
      console.log("Configurações de acesso obtidas:", JSON.stringify(categoryAccessData));
    } else {
      categoryAccessData = { categoryAccess: [] };
      console.warn("Erro ao obter configurações de acesso, usando objeto vazio");
    }

    // Renderizar a tabela de categorias
    renderCategoryAccessTable();

  } catch (error) {
    console.error('Error loading data:', error);
    document.getElementById('category-access-list').innerHTML =
      `<tr><td colspan="6" class="loading-text">Error loading data: ${error.message}</td></tr>`;
  }

  hideLoader();
}

// Renderizar tabela de acesso a categorias
function renderCategoryAccessTable() {
  const tableBody = document.getElementById('category-access-list');

  if (allCategories.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" class="loading-text">No categories found</td></tr>';
    return;
  }

  let html = '';

  // Criar um mapa para acesso rápido às configurações
  const accessMap = {};
  categoryAccessData.categoryAccess.forEach(item => {
    accessMap[item.categoryId] = item;
  });

  // Para cada categoria, criar uma linha na tabela
  allCategories.forEach(category => {
    const categoryId = category.id;
    // MODIFICADO: Usar apenas o nome da pasta final, não o caminho completo
    const categoryName = category.name;
    // ADICIONADO: Incluir contagem de arquivos
    const fileCount = category.fileCount || 0;

    // Obter preço padrão
    const defaultPrice = categoryPrices[categoryId] ? categoryPrices[categoryId].price || 0 : 0;

    // Obter configurações de acesso ou criar um novo
    const access = accessMap[categoryId] || {
      categoryId: categoryId,
      enabled: true,
      customPrice: null,
      minQuantityForDiscount: null,
      discountPercentage: null
    };

    html += `
      <tr data-category-id="${categoryId}" data-category-name="${categoryName.toLowerCase()}">
        <td>
          <label class="toggle-switch">
            <input type="checkbox" class="category-toggle" ${access.enabled ? 'checked' : ''} 
              onchange="updateCategoryAccess('${categoryId}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td>
          <div class="category-name">${categoryName}</div>
        </td>
        <!-- ADICIONADO: Coluna para contagem de fotos -->
        <td class="file-count">
          ${fileCount} ${fileCount === 1 ? 'photo' : 'photos'}
        </td>
        <td>
          <div class="default-price">$${defaultPrice.toFixed(2)}</div>
        </td>
        <td>
          <input type="number" class="price-input" value="${access.customPrice !== null ? access.customPrice : ''}" 
            placeholder="Custom price" step="0.01" min="0"
            onchange="updateCustomPrice('${categoryId}', this.value)">
        </td>
        <td>
          <input type="number" class="quantity-input" value="${access.minQuantityForDiscount !== null ? access.minQuantityForDiscount : ''}" 
            placeholder="Min qty" step="1" min="1"
            onchange="updateMinQuantity('${categoryId}', this.value)">
        </td>
        <td>
          <input type="number" class="discount-input" value="${access.discountPercentage !== null ? access.discountPercentage : ''}" 
            placeholder="Discount %" step="0.1" min="0" max="100"
            onchange="updateDiscountPercentage('${categoryId}', this.value)">
        </td>
      </tr>
    `;
  });

  tableBody.innerHTML = html;

  // Atualizar contadores para o filtro
  document.getElementById('access-total-count').textContent = allCategories.length;
  document.getElementById('access-displayed-count').textContent = allCategories.length;
}

// Filtrar categorias na tabela de acesso
function filterAccessCategories() {
  const filterValue = document.getElementById('category-access-filter').value.toLowerCase();
  const rows = document.querySelectorAll('#category-access-list tr');
  let displayedCount = 0;

  rows.forEach(row => {
    const categoryName = row.getAttribute('data-category-name');
    if (!categoryName) return; // Pular linhas de cabeçalho ou mensagens

    if (categoryName.includes(filterValue)) {
      row.style.display = '';
      displayedCount++;
    } else {
      row.style.display = 'none';
    }
  });

  // Atualizar contador
  document.getElementById('access-displayed-count').textContent = displayedCount;
}

// Atualizar configuração de acesso para uma categoria
function updateCategoryAccess(categoryId, enabled) {
  console.log(`Atualizando acesso para categoria ${categoryId}: ${enabled ? 'habilitada' : 'desabilitada'}`);
  
  // Procurar configuração existente
  const accessIndex = categoryAccessData.categoryAccess.findIndex(item => item.categoryId === categoryId);

  if (accessIndex >= 0) {
    // Atualizar configuração existente
    categoryAccessData.categoryAccess[accessIndex].enabled = enabled;
  } else {
    // Criar nova configuração
    categoryAccessData.categoryAccess.push({
      categoryId: categoryId,
      enabled: enabled,
      customPrice: null,
      minQuantityForDiscount: null,
      discountPercentage: null
    });
  }
}

// Atualizar preço personalizado
function updateCustomPrice(categoryId, price) {
  const numPrice = price === '' ? null : parseFloat(price);

  // Procurar configuração existente
  const accessIndex = categoryAccessData.categoryAccess.findIndex(item => item.categoryId === categoryId);

  if (accessIndex >= 0) {
    // Atualizar configuração existente
    categoryAccessData.categoryAccess[accessIndex].customPrice = numPrice;
  } else {
    // Criar nova configuração
    categoryAccessData.categoryAccess.push({
      categoryId: categoryId,
      enabled: true,
      customPrice: numPrice,
      minQuantityForDiscount: null,
      discountPercentage: null
    });
  }
}

// Atualizar quantidade mínima para desconto
function updateMinQuantity(categoryId, quantity) {
  const numQuantity = quantity === '' ? null : parseInt(quantity);

  // Procurar configuração existente
  const accessIndex = categoryAccessData.categoryAccess.findIndex(item => item.categoryId === categoryId);

  if (accessIndex >= 0) {
    // Atualizar configuração existente
    categoryAccessData.categoryAccess[accessIndex].minQuantityForDiscount = numQuantity;
  } else {
    // Criar nova configuração
    categoryAccessData.categoryAccess.push({
      categoryId: categoryId,
      enabled: true,
      customPrice: null,
      minQuantityForDiscount: numQuantity,
      discountPercentage: null
    });
  }
}

// Atualizar porcentagem de desconto
function updateDiscountPercentage(categoryId, percentage) {
  const numPercentage = percentage === '' ? null : parseFloat(percentage);

  // Procurar configuração existente
  const accessIndex = categoryAccessData.categoryAccess.findIndex(item => item.categoryId === categoryId);

  if (accessIndex >= 0) {
    // Atualizar configuração existente
    categoryAccessData.categoryAccess[accessIndex].discountPercentage = numPercentage;
  } else {
    // Criar nova configuração
    categoryAccessData.categoryAccess.push({
      categoryId: categoryId,
      enabled: true,
      customPrice: null,
      minQuantityForDiscount: null,
      discountPercentage: numPercentage
    });
  }
}

// Autorizar todas as categorias
function authorizeAllCategories() {
  const toggles = document.querySelectorAll('.category-toggle');

  toggles.forEach(toggle => {
    toggle.checked = true;

    // Obter o ID da categoria do elemento pai
    const row = toggle.closest('tr');
    const categoryId = row.getAttribute('data-category-id');

    // Atualizar configuração
    updateCategoryAccess(categoryId, true);
  });

  showToast('All categories authorized', 'success');
}

// Limpar todas as categorias
function clearAllCategories() {
  const toggles = document.querySelectorAll('.category-toggle');

  toggles.forEach(toggle => {
    toggle.checked = false;

    // Obter o ID da categoria do elemento pai
    const row = toggle.closest('tr');
    const categoryId = row.getAttribute('data-category-id');

    // Atualizar configuração
    updateCategoryAccess(categoryId, false);
  });

  showToast('All categories unauthorized', 'info');
}

// Salvar configurações de acesso
async function saveCustomerCategoryAccess() {
  showLoader();

  try {
    // Verificar se há pelo menos um item habilitado para evitar bloqueio total
    const habilitados = categoryAccessData.categoryAccess.filter(item => item.enabled === true);
    if (habilitados.length === 0 && categoryAccessData.categoryAccess.length > 0) {
      showToast("Aviso: Todas as categorias foram desabilitadas. O cliente não verá nenhum conteúdo.", "warning");
    }
    
    console.log("Salvando configurações de acesso:", categoryAccessData);
    
    // Limpar cache antes de salvar para garantir dados atualizados após salvamento
    await fetch('/api/client/clear-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    // ALTERADO: Usando editingCustomerCode em vez de currentCustomerCode
    const result = await apiClient.saveCustomerCategoryAccess(
      editingCustomerCode,
      categoryAccessData
    );

    hideLoader();

    if (result.success) {
      showToast(`Access settings saved for ${currentCustomerName}`, 'success');
      closeModal('category-access-modal');
    } else {
      showToast(`Error saving access settings: ${result.message}`, 'error');
    }
  } catch (error) {
    hideLoader();
    showToast(`Error saving access settings: ${error.message}`, 'error');
  }
}

// Nova função para visualizar detalhes do pedido
async function viewOrderDetails(folderId, folderName) {
  try {
    // Mostrar modal com loader
    document.getElementById('order-details-modal').style.display = 'block';
    document.getElementById('order-loading').style.display = 'block';
    document.getElementById('order-details-content').style.display = 'none';
    
    // Extrair informações do nome da pasta (nome do cliente, qtd de itens, data)
    const orderInfo = parseOrderFolderName(folderName);
    
    // Preencher informações básicas
    document.getElementById('order-name').textContent = folderName;
    document.getElementById('order-client').textContent = orderInfo.customerName || 'N/A';
    document.getElementById('order-date').textContent = orderInfo.orderDate || 'N/A';
    document.getElementById('view-in-drive').href = `https://drive.google.com/drive/folders/${folderId}`;
    
    // Buscar informações detalhadas do pedido
    const orderDetails = await apiClient.getOrderDetails(folderId);
    
    if (!orderDetails.success) {
      showToast('Failed to load order details: ' + (orderDetails.message || 'Unknown error'), 'error');
      closeModal('order-details-modal');
      return;
    }
    
    // Mostrar comentários se existirem
    if (orderDetails.comments) {
      document.getElementById('order-comments-section').style.display = 'block';
      document.getElementById('order-comments').textContent = orderDetails.comments;
    } else {
      document.getElementById('order-comments-section').style.display = 'none';
    }
    
    // Renderizar detalhes por categoria
    const categoryBreakdownElement = document.getElementById('category-breakdown');
    categoryBreakdownElement.innerHTML = '';
    
    let totalItems = 0;
    let totalAmount = 0;
    
    if (orderDetails.categories && orderDetails.categories.length > 0) {
      orderDetails.categories.forEach(category => {
        const categoryTotal = category.items.reduce((sum, item) => sum + (item.price || 0), 0);
        totalItems += category.items.length;
        totalAmount += categoryTotal;
        
        const categoryElement = document.createElement('div');
        categoryElement.className = 'category-item';
        
        categoryElement.innerHTML = `
          <div class="category-summary">
            <div class="category-name">
              <strong>${category.name}</strong> (${category.items.length} items)
            </div>
            <div class="category-total">
              Total: $${categoryTotal.toFixed(2)}
            </div>
          </div>
        `;
        
        categoryBreakdownElement.appendChild(categoryElement);
      });
    } else {
      // Fallback para quando não temos informações de categoria
      const noDataElement = document.createElement('div');
      noDataElement.className = 'empty-message';
      noDataElement.textContent = 'No detailed category information available for this order.';
      categoryBreakdownElement.appendChild(noDataElement);
      
      // Tentar obter o total de itens a partir do nome da pasta
      totalItems = orderInfo.itemCount || 0;
    }
    
    // Atualizar totais
    document.getElementById('total-items').textContent = totalItems;
    document.getElementById('total-amount').textContent = `$${totalAmount.toFixed(2)}`;
    
    // Esconder loader e mostrar conteúdo
    document.getElementById('order-loading').style.display = 'none';
    document.getElementById('order-details-content').style.display = 'block';
    
  } catch (error) {
    console.error('Error viewing order details:', error);
    showToast('Error viewing order details: ' + error.message, 'error');
    closeModal('order-details-modal');
  }
}

// Função auxiliar para extrair informações do nome da pasta
function parseOrderFolderName(folderName) {
  try {
    // Formato esperado: "Cliente XYZ 10un May 12 2025"
    const result = {
      customerName: '',
      itemCount: 0,
      orderDate: ''
    };
    
    // Extrair nome do cliente (tudo antes do número de itens)
    const matches = folderName.match(/(.+?)\s+(\d+)un\s+(.+)/i);
    
    if (matches && matches.length >= 4) {
      result.customerName = matches[1].trim();
      result.itemCount = parseInt(matches[2]) || 0;
      result.orderDate = matches[3].trim();
    }
    
    return result;
  } catch (error) {
    console.error('Error parsing folder name:', error);
    return {
      customerName: '',
      itemCount: 0,
      orderDate: ''
    };
  }
}

function openReturnToStockModal(folderId, folderName) {
  console.log(`🔧 Opening return modal for: ${folderName} (${folderId})`);
  
  // Fechar outros modais
  const allModals = document.querySelectorAll('.modal');
  allModals.forEach(modal => {
    modal.style.display = 'none';
    modal.classList.remove('show');
  });
  
  // Armazenar informações
  window.currentReturnOrderId = folderId;
  window.currentReturnOrderName = folderName;
  
  // Atualizar título
  document.getElementById('return-order-name').textContent = folderName;
  
  // Mostrar modal
  const modal = document.getElementById('return-to-stock-modal');
  if (modal) {
    modal.style.display = 'block';
    modal.classList.add('show');
    
    // Resetar estado
    document.getElementById('return-modal-loading').style.display = 'block';
    document.getElementById('return-modal-content').style.display = 'none';
    document.getElementById('return-selected-count').textContent = '0';
    document.getElementById('process-return-btn').disabled = true;
    
    // Carregar fotos
    loadOrderPhotosForReturn(folderId);
  }
}

// Função para carregar fotos do pedido
async function loadOrderPhotosForReturn(folderId) {
  try {
    console.log(`📋 Loading photos for order: ${folderId}`);
    
    // Fazer requisição para buscar detalhes do pedido
    const response = await fetch(`/api/orders/details?folderId=${folderId}`);
    const result = await response.json();
    
    if (result.success) {
      // Esconder loading
      document.getElementById('return-modal-loading').style.display = 'none';
      
      // Renderizar categorias e fotos
      renderReturnPhotosInterface(result.categories || []);
      
      // Mostrar conteúdo
      document.getElementById('return-modal-content').style.display = 'block';
      
      console.log('✅ Photos loaded successfully!');
    } else {
      throw new Error(result.message || 'Failed to load order photos');
    }
    
  } catch (error) {
    console.error('❌ Error loading order photos:', error);
    
    // Esconder loading
    document.getElementById('return-modal-loading').style.display = 'none';
    
    // Mostrar erro
    document.getElementById('return-categories-container').innerHTML = `
      <div style="padding: 20px; text-align: center; color: red;">
        <p>❌ Error loading photos: ${error.message}</p>
        <button class="btn btn-secondary" onclick="loadOrderPhotosForReturn('${folderId}')">
          Try Again
        </button>
      </div>
    `;
    
    // Mostrar conteúdo mesmo com erro
    document.getElementById('return-modal-content').style.display = 'block';
  }
}

// NOVA FUNÇÃO: Interface hierárquica com pesquisa global
function renderReturnPhotosInterface(categories) {
  const container = document.getElementById('return-categories-container');
  
  if (!categories || categories.length === 0) {
    container.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #666;">
        <p>📋 No photos found in this order.</p>
      </div>
    `;
    return;
  }

  // Estrutura principal com pesquisa global
  let html = `
    <!-- Barra de Pesquisa Global -->
    <div class="return-search-section" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 14px; color: #666;">🔍</span>
        <input 
          type="text" 
          id="return-photo-search" 
          placeholder="Search photo by ID (e.g., 11055)" 
          style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;"
          oninput="searchReturnPhotos(this.value)"
        >
        <span id="search-results-count" style="font-size: 12px; color: #666;"></span>
      </div>
    </div>

    <!-- Categorias Colapsáveis -->
    <div class="return-categories-list">
  `;

  // Renderizar cada categoria como colapsável
  categories.forEach(category => {
    const photoCount = category.items ? category.items.length : 0;
    
    html += `
      <div class="return-category-item" data-category-id="${category.id}" style="margin-bottom: 15px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        
        <!-- Header da Categoria (Clicável) -->
        <div class="category-header-clickable" 
             onclick="toggleReturnCategory('${category.id}')" 
             style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: #f8f9fa; cursor: pointer; transition: background 0.2s;">
          
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="category-toggle-icon" id="toggle-${category.id}" style="font-size: 14px; color: #666;">▶️</span>
            <h4 style="margin: 0; color: #333; font-size: 16px;">${category.name}</h4>
            <span style="background: #e9ecef; padding: 2px 8px; border-radius: 12px; font-size: 12px; color: #666;">${photoCount} photos</span>
          </div>
          
          <label onclick="event.stopPropagation()" style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #666;">
            <input type="checkbox" class="select-all-category" onchange="toggleCategorySelection('${category.id}', this.checked)">
            Select All
          </label>
        </div>

        <!-- Lista de Fotos (Colapsada por padrão) -->
        <div class="category-photos-list" 
             id="photos-${category.id}" 
             style="display: none; padding: 0; background: white;">
    `;

    // Renderizar fotos em formato de lista
    if (category.items && category.items.length > 0) {
      category.items.forEach(item => {
        html += `
          <div class="photo-list-item" 
              data-photo-id="${item.id}"
              style="display: flex; align-items: center; padding: 10px 15px; border-bottom: 1px solid #f0f0f0; transition: background 0.2s;"
              onmouseover="this.style.background='#f8f9fa'" 
              onmouseout="this.style.background='white'">

            <input type="checkbox" 
                  class="photo-checkbox" 
                  value="${item.id}" 
                  onchange="updateReturnSelection()" 
                  style="margin-right: 12px;"
                  onclick="event.stopPropagation();">

            <div class="photo-clickable" 
                onclick="openReturnPhotoFullscreen('${item.id}')"
                style="display: flex; align-items: center; flex: 1; cursor: pointer;">
              
              <div class="photo-icon" style="width: 24px; height: 24px; background: #e9ecef; border-radius: 4px; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                <span style="font-size: 12px; color: #666;">📷</span>
              </div>
              
              <div class="photo-info" style="flex: 1;">
                <div style="font-weight: 500; color: #333; font-size: 14px;">${item.id}.webp</div>
              </div>
            </div>
          </div>
        `;
      });
    } else {
      html += `
        <div style="padding: 20px; text-align: center; color: #999; font-style: italic;">
          No photos in this category
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

// Função para expandir/colapsar categoria
function toggleReturnCategory(categoryId) {
  const photosList = document.getElementById(`photos-${categoryId}`);
  const toggleIcon = document.getElementById(`toggle-${categoryId}`);
  
  if (photosList.style.display === 'none') {
    photosList.style.display = 'block';
    toggleIcon.textContent = '🔽';
  } else {
    photosList.style.display = 'none';
    toggleIcon.textContent = '▶️';
  }
}

// Função para pesquisa global
function searchReturnPhotos(searchTerm) {
  const allPhotoItems = document.querySelectorAll('.photo-list-item');
  const resultCount = document.getElementById('search-results-count');
  let visibleCount = 0;
  
  allPhotoItems.forEach(item => {
    const photoId = item.dataset.photoId;
    const isMatch = photoId.toLowerCase().includes(searchTerm.toLowerCase());
    
    item.style.display = isMatch ? 'flex' : 'none';
    if (isMatch) visibleCount++;
  });
  
  // Expandir categorias que têm resultados se há busca
  if (searchTerm.trim()) {
    document.querySelectorAll('.return-category-item').forEach(category => {
      const hasVisiblePhotos = category.querySelectorAll('.photo-list-item[style*="flex"]').length > 0;
      if (hasVisiblePhotos) {
        const categoryId = category.dataset.categoryId;
        const photosList = document.getElementById(`photos-${categoryId}`);
        const toggleIcon = document.getElementById(`toggle-${categoryId}`);
        photosList.style.display = 'block';
        toggleIcon.textContent = '🔽';
      }
    });
    
    resultCount.textContent = `${visibleCount} results found`;
  } else {
    resultCount.textContent = '';
  }
}

// Função CORRIGIDA para abrir foto em fullscreen
function openReturnPhotoFullscreen(photoId) {
  console.log(`Opening fullscreen for: ${photoId}`);
  
  // Verificar se já existe um lightbox e remover
  const existingLightbox = document.getElementById('return-lightbox-modal');
  if (existingLightbox) {
    existingLightbox.remove();
  }
  
  // URL da foto (mesmo padrão do sistema)
  const photoUrl = `/api/photos/local/thumbnail/${photoId}`;
  
  // Criar lightbox com z-index muito alto
  const lightboxHtml = `
    <div id="return-lightbox-modal" class="modal" style="display: block !important; z-index: 999999 !important; background: rgba(0, 0, 0, 0.9);">
      <div class="lightbox-content" style="
        position: fixed; 
        top: 0; 
        left: 0; 
        width: 100vw; 
        height: 100vh; 
        display: flex; 
        flex-direction: column; 
        z-index: 999999;
        padding: 20px;
        box-sizing: border-box;
      ">
        
        <!-- Header com controles -->
        <div class="lightbox-header" style="
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          margin-bottom: 20px;
          color: white;
          z-index: 1000000;
        ">
          <h3 style="margin: 0; color: white; font-size: 18px;">${photoId}.webp</h3>
          
          <div style="display: flex; gap: 15px; align-items: center;">
            <button onclick="returnPhotoFromLightbox('${photoId}')" 
                    style="
                      padding: 8px 16px; 
                      background: #d4a574; 
                      color: white; 
                      border: none; 
                      border-radius: 4px; 
                      cursor: pointer;
                      font-size: 14px;
                    ">
              📦 Return This Photo
            </button>
            
            <button onclick="closeReturnLightbox()" 
                    style="
                      background: none; 
                      border: none; 
                      font-size: 28px; 
                      cursor: pointer; 
                      color: white;
                      line-height: 1;
                    ">
              ×
            </button>
          </div>
        </div>
        
        <!-- Área da imagem -->
        <div class="lightbox-image-container" style="
          flex: 1; 
          display: flex; 
          align-items: center; 
          justify-content: center;
          position: relative;
        ">
          <img src="${photoUrl}" 
               alt="${photoId}" 
               onload="console.log('Image loaded successfully')"
               onerror="console.error('Failed to load image:', '${photoUrl}')"
               style="
                 max-width: 90%; 
                 max-height: 90%; 
                 object-fit: contain;
                 border-radius: 8px;
                 box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
               ">
        </div>
        
        <!-- Footer com instruções -->
        <div class="lightbox-footer" style="
          text-align: center; 
          color: white; 
          font-size: 14px; 
          margin-top: 20px;
          opacity: 0.8;
        ">
          Click outside image or press × to close
        </div>
      </div>
    </div>
  `;
  
  // Adicionar ao body
  document.body.insertAdjacentHTML('beforeend', lightboxHtml);
  
  // Fechar ao clicar fora da imagem
  setTimeout(() => {
    const lightboxModal = document.getElementById('return-lightbox-modal');
    if (lightboxModal) {
      lightboxModal.addEventListener('click', function(e) {
        if (e.target === lightboxModal) {
          closeReturnLightbox();
        }
      });
    }
  }, 100);
}

// Função para fechar lightbox
function closeReturnLightbox() {
  const lightbox = document.getElementById('return-lightbox-modal');
  if (lightbox) {
    lightbox.style.opacity = '0';
    lightbox.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      lightbox.remove();
    }, 300);
  }
}

// Função para retornar foto específica do lightbox
function returnPhotoFromLightbox(photoId) {
  // Marcar a foto como selecionada
  const checkbox = document.querySelector(`input.photo-checkbox[value="${photoId}"]`);
  if (checkbox) {
    checkbox.checked = true;
    updateReturnSelection();
  }
  
  // Fechar lightbox
  closeReturnLightbox();
  
  // Mostrar feedback
  console.log(`Photo ${photoId} marked for return`);
}

// Função para alternar seleção de categoria
function toggleCategorySelection(categoryId, checked) {
  const categorySection = document.querySelector(`[data-category-id="${categoryId}"]`) || 
                         document.querySelector('.category-section');
  const checkboxes = categorySection.querySelectorAll('.photo-checkbox');
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = checked;
  });
  
  updateReturnSelection();
}

// Função para atualizar contador de seleção
function updateReturnSelection() {
  const selectedBoxes = document.querySelectorAll('.photo-checkbox:checked');
  const count = selectedBoxes.length;
  
  document.getElementById('return-selected-count').textContent = count;
  document.getElementById('process-return-btn').disabled = count === 0;
}

// FUNÇÃO CORRIGIDA com melhor debug
async function processReturnToStock() {
  // Prevenir propagação
  if (event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }
  
  const selectedPhotos = document.querySelectorAll('.photo-checkbox:checked');
  console.log(`🔄 Processing return of ${selectedPhotos.length} photos`);
  
  if (selectedPhotos.length === 0) {
    showToast('Please select at least one photo to return', 'warning');
    return;
  }

  // Coletar IDs das fotos selecionadas
  const selectedPhotoIds = Array.from(selectedPhotos).map(checkbox => checkbox.value);
  console.log(`📋 Selected photo IDs:`, selectedPhotoIds);
  console.log(`📁 Order ID:`, window.currentReturnOrderId);
  
  try {
    showLoader();
    console.log(`🚀 Making fetch request to /api/orders/return-to-stock`);
    
    // Fazer requisição para o backend
    const response = await fetch('/api/orders/return-to-stock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        folderId: window.currentReturnOrderId,
        selectedPhotoIds: selectedPhotoIds
      })
    });
    
    console.log(`📡 Response status:`, response.status);
    console.log(`📡 Response ok:`, response.ok);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`✅ Backend response:`, result);
    
    hideLoader();
    
    if (result.success) {
      showToast(
        `Successfully returned ${result.movedPhotos} photos to stock!`, 
        'success'
      );
      
      // ADICIONAR ESTA LINHA:
      closeReturnAndShowAdmin();
      
      // Atualizar lista de pedidos
      const status = document.getElementById('order-status').value;
      loadOrderFolders(status);
      
    } else {
      showToast(`Error: ${result.message}`, 'error');
    }
    
  } catch (error) {
    hideLoader();
    console.error('❌ Error processing return to stock:', error);
    showToast(`Error: ${error.message}`, 'error');
  }
}

// FUNÇÃO ESPECÍFICA para Return to Stock Modal
function closeReturnToStockModal() {
  console.log('🔒 Closing return to stock modal');
  
  const modal = document.getElementById('return-to-stock-modal');
  if (modal) {
    // Limpar TODOS os estilos inline forçados
    modal.style.display = 'none';
    modal.style.position = '';
    modal.style.top = '';
    modal.style.left = '';
    modal.style.width = '';
    modal.style.height = '';
    modal.style.zIndex = '';
    modal.style.backgroundColor = '';
    
    console.log('✅ Modal closed and styles cleared');
  }
  
  // Limpar dados temporários
  window.currentReturnOrderId = null;
  window.currentReturnOrderName = null;
}

// FUNÇÃO CORRIGIDA: Fechar Return to Stock e voltar ao Admin
function closeReturnAndShowAdmin() {
  console.log('🔒 Closing return modal and showing admin panel');
  
  // Fechar Return to Stock modal
  const returnModal = document.getElementById('return-to-stock-modal');
  if (returnModal) {
    returnModal.classList.remove('show');
    returnModal.style.display = 'none';
  }
  
  // Reabrir Admin Panel
  const adminModal = document.getElementById('admin-panel-modal');
  if (adminModal) {
    adminModal.style.display = 'block';
  }
  
  // Limpar dados temporários
  window.currentReturnOrderId = null;
  window.currentReturnOrderName = null;
  
  console.log('✅ Returned to admin panel');
}

// ==== SHIPMENT MANAGEMENT FUNCTIONS ====

// Inicializar aba de shipments
function initShipmentTab() {
  console.log('🚀 Initializing Shipment Control tab');
  loadShipments();
}

// Carregar shipments
async function loadShipments() {
  try {
    console.log('📋 Loading shipments...');
    
    const response = await fetch('/api/admin/shipments');
    const result = await response.json();
    
    if (result.success) {
      displayShipments(result.shipments);
    } else {
      console.error('Error loading shipments:', result.message);
    }
  } catch (error) {
    console.error('Error loading shipments:', error);
  }
}

// Exibir shipments na interface
function displayShipments(shipments) {
  const container = document.getElementById('shipment-control');
  if (!container) return;
  
  const adminSection = container.querySelector('.admin-section');
  if (!adminSection) return;
  
  // Organizar shipments por status
  const shipmentsByStatus = {
    'incoming-air': [],
    'incoming-sea': [],
    'warehouse': [],
    'completed': []
  };
  
  shipments.forEach(shipment => {
    if (shipmentsByStatus[shipment.status]) {
      shipmentsByStatus[shipment.status].push(shipment);
    }
  });
  
  adminSection.innerHTML = `
    <div class="shipment-header">
      <h3>Shipment Control</h3>
      <button class="btn btn-gold" onclick="createTestShipment()">Create Test Shipment</button>
    </div>
    
    <div class="shipments-kanban">
      <div class="kanban-column incoming-air">
        <h4>🛩️ Air Transit (${shipmentsByStatus['incoming-air'].length})</h4>
        <div class="kanban-items">
          ${renderKanbanCards(shipmentsByStatus['incoming-air'])}
        </div>
      </div>
      
      <div class="kanban-column incoming-sea">
        <h4>🚢 Sea Transit (${shipmentsByStatus['incoming-sea'].length})</h4>
        <div class="kanban-items">
          ${renderKanbanCards(shipmentsByStatus['incoming-sea'])}
        </div>
      </div>
      
      <div class="kanban-column warehouse">
        <h4>🏪 Warehouse (${shipmentsByStatus['warehouse'].length})</h4>
        <div class="kanban-items">
          ${renderKanbanCards(shipmentsByStatus['warehouse'])}
        </div>
      </div>
      
      <div class="kanban-column completed">
        <h4>✅ Completed (${shipmentsByStatus['completed'].length})</h4>
        <div class="kanban-items">
          ${renderKanbanCards(shipmentsByStatus['completed'])}
        </div>
      </div>
    </div>
  `;
}

// Renderizar cards do Kanban
function renderKanbanCards(shipments) {
  if (!shipments || shipments.length === 0) {
    return '<div class="kanban-empty">No shipments</div>';
  }
  
  return shipments.map(shipment => `
    <div class="kanban-card" onclick="viewShipmentDetails('${shipment._id}')">
      <div class="kanban-card-title">${shipment.name}</div>
      <div class="kanban-card-info">
        Created: ${new Date(shipment.uploadDate).toLocaleDateString()}<br>
        Photos: ${shipment.totalPhotos || 0}
      </div>
      <div class="kanban-card-actions" onclick="event.stopPropagation();">
        ${getKanbanActions(shipment)}
      </div>
    </div>
  `).join('');
}

// Ações específicas para Kanban
function getKanbanActions(shipment) {
  let actions = [];
  
  switch (shipment.status) {
    case 'incoming-air':
    case 'incoming-sea':
      actions.push(`<button class="btn btn-primary btn-sm" onclick="uploadPhotosToShipment('${shipment._id}')">📤 Upload</button>`);
      actions.push(`<button class="btn btn-gold btn-sm" onclick="moveShipmentTo('${shipment._id}', 'warehouse')">→ Warehouse</button>`);
      break;
    case 'warehouse':
      actions.push(`<button class="btn btn-success btn-sm" onclick="distributeShipment('${shipment._id}')">Distribute</button>`);
      break;
  }
  
  actions.push(`<button class="btn btn-delete btn-sm" onclick="deleteShipment('${shipment._id}')">Delete</button>`);
  
  return actions.join('');
}

// Obter ações disponíveis para cada shipment
function getShipmentActions(shipment) {
  let actions = [];
  
  // Botão de detalhes sempre disponível
  actions.push(`<button class="btn btn-secondary btn-sm" onclick="viewShipmentDetails('${shipment._id}')">Details</button>`);
  
  // Ações baseadas no status
  switch (shipment.status) {
    case 'incoming-air':
      actions.push(`<button class="btn btn-gold btn-sm" onclick="moveShipmentTo('${shipment._id}', 'warehouse')">→ Warehouse</button>`);
      break;
    case 'incoming-sea':
      actions.push(`<button class="btn btn-gold btn-sm" onclick="moveShipmentTo('${shipment._id}', 'warehouse')">→ Warehouse</button>`);
      break;
    case 'warehouse':
      actions.push(`<button class="btn btn-success btn-sm" onclick="alert('Ready for distribution!')">Distribute</button>`);
      break;
  }
  
  // Botão delete sempre disponível
  actions.push(`<button class="btn btn-delete btn-sm" onclick="deleteShipment('${shipment._id}')">Delete</button>`);
  
  return actions.join('');
}

// Mover shipment para novo status
async function moveShipmentTo(shipmentId, newStatus) {
  if (!confirm(`Move shipment to ${newStatus}?`)) return;
  
  try {
    console.log(`Moving shipment ${shipmentId} to ${newStatus}`);
    
    const response = await fetch(`/api/admin/shipments/${shipmentId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shipmentId: shipmentId,
        newStatus: newStatus
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Shipment moved successfully!');
      alert(`Shipment moved to ${newStatus}!`);
      loadShipments(); // Recarregar lista
    } else {
      console.error('Error moving shipment:', result.message);
      alert('Error: ' + result.message);
    }
  } catch (error) {
    console.error('Error moving shipment:', error);
    alert('Error moving shipment!');
  }
}

// Ver detalhes do shipment
async function viewShipmentDetails(shipmentId) {
  try {
    console.log(`Getting details for shipment: ${shipmentId}`);
    
    const response = await fetch(`/api/admin/shipments/${shipmentId}`);
    const result = await response.json();
    
    if (result.success) {
      const shipment = result.shipment;
      alert(`Shipment Details:
Name: ${shipment.name}
Status: ${shipment.status}
Created: ${new Date(shipment.uploadDate).toLocaleString()}
Photos: ${shipment.totalPhotos || 0}
Notes: ${shipment.notes || 'None'}`);
    } else {
      console.error('Error getting details:', result.message);
      alert('Error: ' + result.message);
    }
  } catch (error) {
    console.error('Error getting details:', error);
    alert('Error getting details!');
  }
}

// Criar shipment de teste
async function createTestShipment() {
  // Mostrar modal de seleção
  showCreateShipmentModal();
}

// Mostrar modal para criar shipment
function showCreateShipmentModal() {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.6); z-index: 1000; display: flex;
    align-items: center; justify-content: center;
  `;
  
  modal.innerHTML = `
    <div style="background: white; padding: 30px; border-radius: 10px; max-width: 400px; width: 90%;">
      <h3 style="margin-top: 0; color: #333;">Create New Shipment</h3>
      
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500;">Shipment Name:</label>
        <input type="text" id="shipment-name-input" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;" 
               placeholder="e.g., COURO & ARTE S21 1940-2025 250un">
      </div>
      
      <div style="margin-bottom: 25px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500;">Transit Type:</label>
        <div style="display: flex; gap: 15px;">
          <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="radio" name="transit-type" value="incoming-air" checked style="margin-right: 8px;">
            🛩️ Air Transit
          </label>
          <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="radio" name="transit-type" value="incoming-sea" style="margin-right: 8px;">
            🚢 Sea Transit
          </label>
        </div>
      </div>
      
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button onclick="closeCreateShipmentModal()" style="padding: 10px 20px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">
          Cancel
        </button>
        <button onclick="submitNewShipment()" style="padding: 10px 20px; background: #d4af37; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Create Shipment
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Focar no input de nome
  setTimeout(() => {
    document.getElementById('shipment-name-input').focus();
  }, 100);
  
  // Fechar ao clicar fora
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeCreateShipmentModal();
    }
  });
  
  // Guardar referência do modal
  window.currentShipmentModal = modal;
}

// Fechar modal de criação
function closeCreateShipmentModal() {
  if (window.currentShipmentModal) {
    document.body.removeChild(window.currentShipmentModal);
    window.currentShipmentModal = null;
  }
}

// Submeter novo shipment
async function submitNewShipment() {
  const nameInput = document.getElementById('shipment-name-input');
  const transitType = document.querySelector('input[name="transit-type"]:checked');
  
  const name = nameInput.value.trim();
  const status = transitType.value;
  
  if (!name) {
    alert('Please enter a shipment name');
    nameInput.focus();
    return;
  }
  
  try {
    console.log('Creating shipment:', { name, status });
    
    const response = await fetch('/api/admin/shipments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        status: status,
        notes: `Created via admin panel - ${status}`
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Shipment created successfully!');
      closeCreateShipmentModal();
      loadShipments(); // Recarregar lista
      
      const transitTypeName = status === 'incoming-air' ? 'Air Transit' : 'Sea Transit';
      alert(`✅ Shipment "${name}" created in ${transitTypeName}!`);
    } else {
      console.error('Error creating shipment:', result.message);
      alert('❌ Error: ' + result.message);
    }
  } catch (error) {
    console.error('Error creating shipment:', error);
    alert('❌ Error creating shipment!');
  }
}

// Deletar shipment
async function deleteShipment(shipmentId) {
  if (!confirm('Are you sure you want to delete this shipment? This action cannot be undone.')) return;
  
  try {
    console.log(`Deleting shipment: ${shipmentId}`);
    
    const response = await fetch(`/api/admin/shipments/${shipmentId}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Shipment deleted successfully!');
      alert('Shipment deleted successfully!');
      loadShipments(); // Recarregar lista
    } else {
      console.error('Error deleting shipment:', result.message);
      alert('Error: ' + result.message);
    }
  } catch (error) {
    console.error('Error deleting shipment:', error);
    alert('Error deleting shipment!');
  }
}

// SUBSTITUA a função uploadPhotosToShipment no admin.js por esta versão com debug:

async function uploadPhotosToShipment(shipmentId) {
  // Criar input file para seleção de múltiplos arquivos
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'image/*';
  input.webkitdirectory = true; // Permite seleção de pastas
  
  input.onchange = async function(event) {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) return;
    
    console.log(`📤 Uploading ${files.length} files to shipment ${shipmentId}`);
    
    // 🔍 DEBUG: Analisar arquivos no FRONTEND antes de enviar
    console.log('\n🔍 FRONTEND DEBUG: Analisando primeiros 3 arquivos...');
    files.slice(0, 3).forEach((file, index) => {
      console.log(`📁 Frontend Arquivo ${index + 1}:`);
      console.log(`   name: "${file.name}"`);
      console.log(`   webkitRelativePath: "${file.webkitRelativePath || 'undefined'}"`);
      console.log(`   size: ${file.size}`);
      console.log(`   type: "${file.type}"`);
      console.log(`   ---`);
    });
    
    // Verificar se há estrutura de pastas
    const hasStructure = files.some(file => file.webkitRelativePath && file.webkitRelativePath.includes('/'));
    console.log(`🔍 Estrutura de pastas detectada: ${hasStructure ? 'SIM' : 'NÃO'}`);
    
    if (hasStructure) {
      const uniquePaths = new Set();
      files.forEach(file => {
        if (file.webkitRelativePath && file.webkitRelativePath.includes('/')) {
          const pathParts = file.webkitRelativePath.split('/');
          if (pathParts.length >= 2) {
            uniquePaths.add(pathParts[pathParts.length - 2]);
          }
        }
      });
      console.log(`📁 Categorias detectadas no frontend: [${Array.from(uniquePaths).join(', ')}]`);
    }
    
    // Mostrar loading
    if (confirm(`Upload ${files.length} photos to this shipment?`)) {
      
      try {
        // Criar FormData
        const formData = new FormData();
        files.forEach(file => {
          formData.append('photos', file);
        });
        
        alert(`Uploading ${files.length} photos... This may take a while.`);
        
        const response = await fetch(`/api/admin/shipments/${shipmentId}/upload`, {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
          alert(`✅ Successfully uploaded ${result.processedPhotos} photos in ${result.categories.length} categories!`);
          loadShipments(); // Recarregar lista
        } else {
          alert('❌ Upload error: ' + result.message);
        }
      } catch (error) {
        console.error('Upload error:', error);
        alert('❌ Upload failed: ' + error.message);
      }
    }
  };
  
  input.click();
}

// Obter pastas de destino disponíveis
async function getDestinationFolders() {
  try {
    const response = await fetch('/api/admin/shipments/destination/folders');
    const result = await response.json();
    
    if (result.success) {
      return result.folders;
    } else {
      console.error('Error getting folders:', result.message);
      return [];
    }
  } catch (error) {
    console.error('Error getting folders:', error);
    return [];
  }
}

// Distribuir shipment - função principal
async function distributeShipment(shipmentId) {
  try {
    console.log(`🚚 Starting distribution for shipment: ${shipmentId}`);
    
    // Buscar conteúdo do shipment e pastas disponíveis
    const [shipmentData, foldersData] = await Promise.all([
      fetch(`/api/admin/shipments/${shipmentId}/content`).then(r => r.json()),
      fetch('/api/admin/shipments/destination/folders').then(r => r.json())
    ]);
    
    if (!shipmentData.success || !foldersData.success) {
      alert('Error loading shipment data');
      return;
    }
    
    showDistributionModal(shipmentData.shipment, foldersData.folders);
    
  } catch (error) {
    console.error('Error starting distribution:', error);
    alert('Error loading distribution interface');
  }
}

// Mostrar modal de distribuição
function showDistributionModal(shipment, availableFolders) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.7); z-index: 1000; display: flex;
    align-items: center; justify-content: center; overflow-y: auto;
  `;
  
  const categories = shipment.categories || [];
  
  modal.innerHTML = `
    <div style="background: white; padding: 30px; border-radius: 10px; max-width: 800px; width: 95%; max-height: 90vh; overflow-y: auto;">
      <h3 style="margin-top: 0; color: #333;">Distribute: ${shipment.name}</h3>
      <p style="color: #666;">Select destination folder for each category:</p>
      
      <div id="distribution-categories" style="margin-bottom: 25px;">
        ${categories.map((category, index) => `
          <div class="distribution-category" data-category="${category.name}" style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 6px; background: #f9f9f9;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <strong class="category-name">${category.name}</strong>
              <span style="color: #666;">${category.photoCount} photos</span>
            </div>
            <div>
              <label style="display: block; margin-bottom: 5px;">Destination folder:</label>
              <select id="destination-${index}" class="destination-select" data-category-name="${category.name}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                <option value="">Select destination...</option>
                ${generateFolderOptions(availableFolders, category.name)}
              </select>
            </div>
          </div>
        `).join('')}
      </div>
      
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button onclick="closeDistributionModal()" style="padding: 10px 20px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">
          Cancel
        </button>
        <button onclick="executeDistribution('${shipment._id}', ${categories.length})" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Distribute Photos
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Fechar ao clicar fora
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeDistributionModal();
    }
  });
  
  window.currentDistributionModal = modal;
}

// Gerar opções de pastas para o select
function generateFolderOptions(folders, categoryName) {
  let options = '';
  
  // Função recursiva para processar pastas hierárquicas
  const processFolder = (folder, depth = 0) => {
    const indent = '&nbsp;'.repeat(depth * 4);
    const folderPath = folder.fullPath || folder.name;
    
    // Smart suggestion: destacar pastas similares ao nome da categoria
    const isSuggested = categoryName && folder.name.toLowerCase().includes(categoryName.toLowerCase());
    const style = isSuggested ? 'background: #ffffcc; font-weight: bold;' : '';
    
    options += `<option value="${folderPath}" style="${style}">${indent}${folder.name}</option>`;
    
    // Processar subpastas se existirem
    if (folder.children && folder.children.length > 0) {
      folder.children.forEach(child => processFolder(child, depth + 1));
    }
  };
  
  folders.forEach(folder => processFolder(folder));
  
  return options;
}

// Executar distribuição - VERSÃO MAIS SIMPLES
async function executeDistribution(shipmentId, categoryCount) {
  const distributions = {};
  let selectedCount = 0;
  
  console.log(`🚚 Executing distribution for ${categoryCount} categories`);
  
  // Coletar seleções usando data attributes
  for (let i = 0; i < categoryCount; i++) {
    const select = document.getElementById(`destination-${i}`);
    if (select && select.value) {
      const categoryName = select.getAttribute('data-category-name');
      if (categoryName) {
        distributions[categoryName] = select.value;
        selectedCount++;
        console.log(`✅ Category "${categoryName}" → "${select.value}"`);
      }
    }
  }
  
  console.log('Final distributions:', distributions);
  
  if (selectedCount === 0) {
    alert('Please select at least one destination folder');
    return;
  }
  
  if (selectedCount < categoryCount) {
    if (!confirm(`Only ${selectedCount} of ${categoryCount} categories have destinations selected. Continue?`)) {
      return;
    }
  }
  
  try {
    console.log('🚀 Sending distribution request...');
    
    const response = await fetch('/api/admin/shipments/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shipmentId: shipmentId,
        distributions: distributions
      })
    });
    
    const result = await response.json();
    console.log('Distribution result:', result);
    
    if (result.success) {
      alert(`✅ Distribution completed! ${result.totalMoved} photos moved to their destinations.`);
      closeDistributionModal();
      loadShipments(); // Recarregar interface
    } else {
      alert('❌ Distribution error: ' + result.message);
    }
    
  } catch (error) {
    console.error('Distribution error:', error);
    alert('❌ Distribution failed: ' + error.message);
  }
}

// Fechar modal de distribuição
function closeDistributionModal() {
  if (window.currentDistributionModal) {
    document.body.removeChild(window.currentDistributionModal);
    window.currentDistributionModal = null;
  }
}