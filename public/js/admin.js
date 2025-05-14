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

  db.collection('customerCodes').orderBy('createdAt', 'desc').get()
    .then((snapshot) => {
      if (snapshot.empty) {
        codesList.innerHTML = '<p>No active codes found.</p>';
        return;
      }

      let html = '<table style="width: 100%; border-collapse: collapse;">';
      html += '<tr><th style="text-align: left; padding: 8px;">Code</th><th style="text-align: left; padding: 8px;">Customer</th><th style="text-align: left; padding: 8px;">Created</th><th style="text-align: center; padding: 8px;">Actions</th></tr>';

      snapshot.forEach(doc => {
        const data = doc.data();
        const date = data.createdAt ? data.createdAt.toDate() : new Date();
        const formattedDate = date.toLocaleDateString();

        html += `<tr>
          <td style="padding: 8px;">${data.code}</td>
          <td style="padding: 8px;">${data.customerName || 'Anonymous'}</td>
          <td style="padding: 8px;">${formattedDate}</td>
          <td style="padding: 8px; text-align: center;">
            <div class="action-buttons-container" style="display: flex; justify-content: center; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-gold action-btn" style="background-color: #D4AF37; color: #212529; margin: 2px; min-width: 90px;" onclick="editCustomerAccess('${data.code}', '${data.customerName || 'Anonymous'}')">Edit Access</button>
              <button class="btn btn-danger action-btn" style="background-color: #A52A2A; color: white; margin: 2px; min-width: 90px;" onclick="deleteCustomerCode('${data.code}', '${data.customerName || 'Anonymous'}')">Delete</button>
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

  // Generate a random 4-digit code
  const code = Math.floor(1000 + Math.random() * 9000).toString();

  db.collection('customerCodes').doc(code).set({
    code: code,
    customerName: customerName,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    items: []
  })
    .then(() => {
      document.getElementById('new-code').textContent = code;
      document.getElementById('generated-code').style.display = 'block';
      document.getElementById('customer-name').value = '';

      // Show notification
      showToast(`New customer code ${code} has been generated successfully`, 'success');

      // Refresh the list of codes
      loadActiveCodes();
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
            <button class="btn btn-secondary" style="padding: 4px 8px; margin-right: 5px;" 
              onclick="viewOrderDetails('${folder.id}', '${folder.name}')">View Details</button>
            <button class="btn btn-gold" style="padding: 4px 8px;" 
              onclick="moveOrderToSold('${folder.id}', '${folder.name}')">Mark as Sold</button>
          `;
        } else if (status === 'paid') {
          actionButtons = `
            <button class="btn btn-secondary" style="padding: 4px 8px;" 
              onclick="viewOrderDetails('${folder.id}', '${folder.name}')">View Details</button>
          `;
        }

        html += `<tr>
          <td style="padding: 8px;">${folder.name}</td>
          <td style="padding: 8px;">${formattedDate}</td>
          <td style="padding: 8px; white-space: nowrap;">
            ${actionButtons}
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

            // If we have file IDs, clean up Firebase data
            if (result.fileIds && result.fileIds.length > 0) {
              // Get all customer codes
              db.collection('customerCodes').get().then((snapshot) => {
                snapshot.forEach(doc => {
                  const customerData = doc.data();
                  if (customerData.items && customerData.items.length > 0) {
                    // Remove the sold file IDs from customer selections
                    const updatedItems = customerData.items.filter(itemId =>
                      !result.fileIds.includes(itemId)
                    );

                    // Only update if there was a change
                    if (updatedItems.length !== customerData.items.length) {
                      db.collection('customerCodes').doc(doc.id).update({
                        items: updatedItems,
                        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                      });
                    }
                  }
                });
              });
            }

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

        // If status is 'paid', clean up Firebase data
        if (status === 'paid' && result.fileIds && result.fileIds.length > 0) {
          // Get all customer codes
          db.collection('customerCodes').get().then((snapshot) => {
            snapshot.forEach(doc => {
              const customerData = doc.data();
              if (customerData.items && customerData.items.length > 0) {
                // Remove the sold file IDs from customer selections
                const updatedItems = customerData.items.filter(itemId =>
                  !result.fileIds.includes(itemId)
                );

                // Only update if there was a change
                if (updatedItems.length !== customerData.items.length) {
                  db.collection('customerCodes').doc(doc.id).update({
                    items: updatedItems,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                  });
                }
              }
            });
          });
        }

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
    } else {
      categoryAccessData = { categoryAccess: [] };
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
          <div class="category-header">
            <h4>${category.name} (${category.items.length} items)</h4>
            <div class="category-total">Total: $${categoryTotal.toFixed(2)}</div>
          </div>
          <div class="category-photos">
            ${category.items.map(item => `
              <div class="category-photo" title="${item.name}">
                <img src="https://drive.google.com/thumbnail?id=${item.id}&sz=w100-h100" alt="${item.name}">
              </div>
            `).join('')}
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