// price-manager.js - ENGLISH VERSION - COM CLASSES PARA ALINHAMENTO
// Global variables
let leafFolders = []; // Stores all final folders
let priceManagerCategoryPrices = {}; // Stores category prices - Renamed to avoid conflict
let isLoadingFolders = false; // Flag to control loading

// Initialization function
function initPriceManager() {
  console.log("Initializing price manager...");
  
  // Show loading message with progress indicator
  document.getElementById('category-price-container').innerHTML = 
    '<div class="loading-folders">Loading data...<div id="loading-progress">Preparing...</div></div>';
  
  isLoadingFolders = true;
  
  // First load prices (usually fast)
  loadCategoryPrices()
    .then(() => {
      // Check if we already have folders cached locally
      const cachedFolders = sessionStorage.getItem('leaf_folders');
      const cacheTimestamp = sessionStorage.getItem('leaf_folders_timestamp');
      const cacheAge = cacheTimestamp ? (Date.now() - parseInt(cacheTimestamp)) : null;
      
      // Use cache if available and fresh (less than 10 minutes)
      if (cachedFolders && cacheAge && cacheAge < 10 * 60 * 1000) {
        console.log('Using cached folders from session storage');
        leafFolders = JSON.parse(cachedFolders);
        renderCategoryPriceTable();
        updateHeaderStats(); // Atualizar estatísticas no header
        isLoadingFolders = false;
        
        // Add resize event
        setTimeout(adjustTableHeight, 100);
        window.addEventListener('resize', adjustTableHeight);
        
        // Still fetch updates in background
        backgroundRefreshFolders();
        return;
      }
      
      // If no cache, do normal loading with progress UI
      loadLeafFoldersWithProgress();
    })
    .catch(error => {
      document.getElementById('category-price-container').innerHTML = 
        `<div class="error-message">Error loading data: ${error.message}</div>`;
      isLoadingFolders = false;
    });
}

// Load folders with progress
function loadLeafFoldersWithProgress() {
  const progressElement = document.getElementById('loading-progress');
  
  // Update progress message
  if (progressElement) {
    progressElement.textContent = 'Searching categories...';
  }
  
  console.log('Making request to: /api/admin/folders/leaf?include_empty=true');
  
  // Make the request
  fetch('/api/admin/folders/leaf?include_empty=true')
    .then(response => {
      console.log('Response status:', response.status);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(result => {
      console.log('Complete API Response:', result);
      
      if (result.success) {
        leafFolders = result.folders || [];
        console.log(`Loaded ${leafFolders.length} leaf folders`);
        console.log('First 3 folders:', leafFolders.slice(0, 3));
        
        // Store in session cache
        sessionStorage.setItem('leaf_folders', JSON.stringify(leafFolders));
        sessionStorage.setItem('leaf_folders_timestamp', Date.now().toString());
        
        // Update UI
        renderCategoryPriceTable();
        updateHeaderStats(); // Atualizar estatísticas no header
        
        // Adjust table height
        setTimeout(adjustTableHeight, 100);
        
        // Add resize event
        window.addEventListener('resize', adjustTableHeight);
      } else {
        throw new Error(result.message || 'Failed to load folders');
      }
    })
    .catch(error => {
      console.error('Error loading leaf folders:', error);
      document.getElementById('category-price-container').innerHTML = 
        `<div class="error-message">Error loading categories: ${error.message}</div>`;
    })
    .finally(() => {
      isLoadingFolders = false;
    });
}

// Update folders in background without interrupting user
function backgroundRefreshFolders() {
  fetch('/api/admin/folders/leaf?include_empty=true')
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        const newFolders = result.folders || [];
        
        // Check for significant changes
        const oldLength = leafFolders.length;
        const newLength = newFolders.length;
        
        // If we have significant differences, update UI
        if (Math.abs(oldLength - newLength) > 5 || newLength === 0) {
          leafFolders = newFolders;
          sessionStorage.setItem('leaf_folders', JSON.stringify(leafFolders));
          sessionStorage.setItem('leaf_folders_timestamp', Date.now().toString());
          renderCategoryPriceTable();
          updateHeaderStats(); // Atualizar estatísticas no header
        }
      }
    })
    .catch(error => {
      console.error('Background refresh error:', error);
      // Don't show UI error for background updates
    });
}

// Load category prices
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
        priceManagerCategoryPrices = {};
        
        // Transform array to object for easy access
        (result.prices || []).forEach(price => {
          priceManagerCategoryPrices[price.folderId] = price;
        });
        
        console.log(`Loaded ${Object.keys(priceManagerCategoryPrices).length} category prices`);
        return priceManagerCategoryPrices;
      } else {
        throw new Error(result.message || 'Failed to load prices');
      }
    });
}

// NOVA FUNÇÃO: Atualizar estatísticas no header
function updateHeaderStats() {
  const headerStatsElement = document.getElementById('price-header-stats');
  if (headerStatsElement) {
    headerStatsElement.textContent = `${leafFolders.length} categories`;
  }
}

// MAIN FUNCTION - COM CLASSES CORRETAS PARA ALINHAMENTO PERFEITO
function renderCategoryPriceTable() {
  const container = document.getElementById('category-price-container');
  
  if (!leafFolders || leafFolders.length === 0) {
    if (isLoadingFolders) {
      container.innerHTML = '<div class="loading-folders">Loading categories...<div id="loading-progress">Please wait...</div></div>';
    } else {
      container.innerHTML = '<div class="empty-folder-message">No categories found.</div>';
    }
    return;
  }
  
  let html = `
    <div class="bulk-actions">
      <h4>Bulk Update</h4>
      <div class="bulk-form">
        <select id="bulk-update-type" class="form-control">
          <option value="fixed">Set Fixed Price</option>
          <option value="percentage">Adjust by Percentage</option>
        </select>
        <input type="number" id="bulk-value" class="form-control" placeholder="Value" step="0.01">
        <button class="btn btn-gold" onclick="applyBulkUpdate()">Apply to Selected</button>
      </div>
    </div>
    
    <div class="table-filter-simple">
      <input type="text" id="category-filter" class="form-control" placeholder="Filter categories..." onkeyup="filterCategories()">
    </div>
    
    <div class="price-table-container">
      <table class="price-table">
        <thead>
          <tr>
            <th class="checkbox-column"><input type="checkbox" id="select-all" onclick="toggleSelectAll()"></th>
            <th class="category-column">Category</th>
            <th class="photos-column">Photos</th>
            <th class="price-column">Price</th>
            <th class="actions-column">Actions</th>
          </tr>
        </thead>
        <tbody id="price-table-body">
  `;
  
  // Render ALL folders at once - COM CLASSES PARA ALINHAMENTO
  leafFolders.forEach(folder => {
    const price = priceManagerCategoryPrices[folder.id] ? priceManagerCategoryPrices[folder.id].price : '';
    const formattedPrice = price ? '$' + parseFloat(price).toFixed(2) : '-';
    const hasPrice = price !== '';
    
    html += `
      <tr data-folder-id="${folder.id}" data-folder-name="${folder.name.toLowerCase()}">
        <td class="checkbox-column"><input type="checkbox" class="category-checkbox" value="${folder.id}"></td>
        <td class="category-column">${folder.name}</td>
        <td class="photos-column">${folder.fileCount || '0'}</td>
        <td class="price-column">
          <span class="price-display">${formattedPrice}</span>
          <input type="number" class="price-input form-control" value="${price}" style="display: none;" step="0.01">
        </td>
        <td class="actions-column">
          <button class="action-btn edit-price-btn" onclick="togglePriceEdit('${folder.id}')">
            ${hasPrice ? 'Edit Price' : 'Set Price'}
          </button>
          <button class="action-btn save-price-btn" onclick="savePrice('${folder.id}')" style="display: none;">Save</button>
        </td>
      </tr>
    `;
  });
  
  html += `
        </tbody>
      </table>
    </div>
  `;
  
  // SET HTML ONLY ONCE
  container.innerHTML = html;
}

// Function to adjust table height
function adjustTableHeight() {
  const container = document.querySelector('.price-table-container');
  if (!container) return;
  
  const windowHeight = window.innerHeight;
  const containerPosition = container.getBoundingClientRect().top;
  const footerHeight = 100; // Estimated footer space
  
  const availableHeight = windowHeight - containerPosition - footerHeight;
  container.style.height = `${Math.max(400, availableHeight)}px`;
}

// Function to filter categories - ATUALIZADA
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
  
  // Atualizar contador no header
  const headerStatsElement = document.getElementById('price-header-stats');
  if (headerStatsElement) {
    if (filterValue) {
      headerStatsElement.textContent = `${displayedCount} of ${leafFolders.length} categories`;
    } else {
      headerStatsElement.textContent = `${leafFolders.length} categories`;
    }
  }
}

// Toggle price editing
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

// Save price
function savePrice(folderId) {
  const row = document.querySelector(`tr[data-folder-id="${folderId}"]`);
  const priceInput = row.querySelector('.price-input');
  const price = parseFloat(priceInput.value);
  
  if (isNaN(price) || price < 0) {
    showToast('Please enter a valid price', 'error');
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
      showToast('Price updated successfully', 'success');
      
      // Update price in local object
      if (priceManagerCategoryPrices[folderId]) {
        priceManagerCategoryPrices[folderId].price = price;
      } else {
        priceManagerCategoryPrices[folderId] = {
          folderId: folderId,
          price: price
        };
      }
      
      // Update UI
      const priceDisplay = row.querySelector('.price-display');
      priceDisplay.textContent = '$' + price.toFixed(2);
      priceDisplay.style.display = 'block';
      priceInput.style.display = 'none';
      
      // Update button text, now it's "Edit Price" because we have a price
      const editBtn = row.querySelector('.edit-price-btn');
      editBtn.textContent = 'Edit Price';
      editBtn.style.display = 'inline-block';
      
      row.querySelector('.save-price-btn').style.display = 'none';
    } else {
      showToast('Error updating price: ' + result.message, 'error');
    }
  })
  .catch(error => {
    hideLoader();
    showToast('Error updating price: ' + error.message, 'error');
  });
}

// Apply bulk update
function applyBulkUpdate() {
  const updateType = document.getElementById('bulk-update-type').value;
  const valueInput = document.getElementById('bulk-value');
  const value = parseFloat(valueInput.value);
  
  if (isNaN(value)) {
    showToast('Please enter a valid value', 'error');
    return;
  }
  
  // Get all selected categories
  const selectedCheckboxes = document.querySelectorAll('.category-checkbox:checked');
  if (selectedCheckboxes.length === 0) {
    showToast('Please select at least one category', 'error');
    return;
  }
  
  const selectedFolderIds = Array.from(selectedCheckboxes).map(cb => cb.value);
  
  // Prepare data for bulk update
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
      showToast(`Prices updated for ${selectedFolderIds.length} categories`, 'success');
      
      // Reload prices
      loadCategoryPrices().then(() => {
        renderCategoryPriceTable();
      });
    } else {
      showToast('Error updating prices: ' + result.message, 'error');
    }
  })
  .catch(error => {
    hideLoader();
    showToast('Error updating prices: ' + error.message, 'error');
  });
}

// Toggle selection of all categories
function toggleSelectAll() {
  const selectAllCheckbox = document.getElementById('select-all');
  const checkboxes = document.querySelectorAll('.category-checkbox');
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = selectAllCheckbox.checked;
  });
}

// Extend existing switchTab function to initialize price manager when needed
(function() {
  // Store original function
  const currentSwitchTabFunc = window.switchTab;
  
  // Define new function that extends the original
  window.switchTab = function(tabId) {
    // Call original function
    if (typeof currentSwitchTabFunc === 'function') {
      currentSwitchTabFunc(tabId);
    }
    
    // Add extra behavior only for price tab
    if (tabId === 'price-management') {
      console.log("Initializing price manager...");
      initPriceManager();
    }
  };
})();