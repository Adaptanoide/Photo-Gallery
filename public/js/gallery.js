// gallery.js
// Global variables
const FOLDER_ID = "<?= FOLDER_ID ?>"; // This will need to be passed from server
let photos = [];
let categories = [];
let currentCategoryId = null;
let currentPhotoIndex = 0;

// Initialization for gallery
document.addEventListener('DOMContentLoaded', function() {
  // Add keyboard events for navigation
  document.addEventListener('keydown', handleKeyDown);
});

// Substituir a função loadPhotos existente com esta nova versão
function loadPhotos(categoryId = null) {
  showLoader();
  
  // Preparar os parâmetros para obter todas as fotos de todas as categorias
  let apiParams = {
    customer_code: currentCustomerCode
  };
  
  // Mostrar loader
  document.getElementById('content').innerHTML = '<div class="empty-message">Loading our exquisite collection...</div>';
  
  // Primeiro, carregar as categorias disponíveis para este cliente
  apiClient.getFolderStructure(`is_admin=false&customer_code=${currentCustomerCode}`)
    .then(categories => {
      // Garantir que categorias é um array
      let categoriesList = Array.isArray(categories) ? 
        categories : 
        (categories.categories || []);
      
      // Remover a categoria "All Items" da lista (vamos exibir todas as fotos em suas categorias específicas)
      categoriesList = categoriesList.filter(cat => !cat.isAll);
      
      // Se não houver categorias específicas, exibir mensagem
      if (categoriesList.length === 0) {
        document.getElementById('content').innerHTML = 
          '<div class="empty-message">No categories are available for your account. Please contact support.</div>';
        hideLoader();
        return;
      }
      
      // Para cada categoria, carregar suas fotos
      Promise.all(
        categoriesList.map(category => 
          apiClient.getPhotos({
            category_id: category.id,
            customer_code: currentCustomerCode
          })
        )
      )
      .then(results => {
        // Criar um objeto para armazenar as fotos por categoria
        const photosByCategory = {};
        
        // Processar os resultados
        results.forEach((categoryPhotos, index) => {
          const category = categoriesList[index];
          
          // Garantir que fotos é um array
          const categoryPhotosList = Array.isArray(categoryPhotos) ? categoryPhotos : [];
          
          // Armazenar as fotos desta categoria
          photosByCategory[category.id] = {
            name: category.name,
            photos: categoryPhotosList
          };
          
          // Adicionar todas as fotos ao array global de fotos
          photos = photos.concat(categoryPhotosList);
        });
        
        // Renderizar o conteúdo
        renderCategoriesWithPhotos(photosByCategory);
        hideLoader();
      })
      .catch(error => {
        console.error('Error loading category photos:', error);
        document.getElementById('content').innerHTML = 
          '<div class="empty-message">Error loading photos. Please try again later.</div>';
        hideLoader();
      });
    })
    .catch(error => {
      console.error('Error loading categories:', error);
      document.getElementById('content').innerHTML = 
        '<div class="empty-message">Error loading categories. Please try again later.</div>';
      hideLoader();
    });
}

// Nova função para renderizar categorias como seções
function renderCategoriesWithPhotos(photosByCategory) {
  const contentDiv = document.getElementById('content');
  let html = '';
  
  // Para cada categoria, criar uma seção
  Object.keys(photosByCategory).forEach(categoryId => {
    const category = photosByCategory[categoryId];
    const categoryPhotos = category.photos;
    
    // Pular categorias sem fotos
    if (!categoryPhotos || categoryPhotos.length === 0) return;
    
    // Adicionar título da categoria
    html += `
      <div class="category-title-container">
        <h2>${category.name}</h2>
        <div class="category-divider"></div>
      </div>
    `;
    
    // Abrir contêiner de fotos para esta categoria
    html += '<div class="category-section">';
    
    // Adicionar cada foto
    categoryPhotos.forEach(function(item, index) {
      const alreadyAdded = cartIds.includes(item.id);
      const delay = (index % 10) * 0.05;
      
      // Format price if available
      let priceTag = '';
      if (item.price !== undefined) {
        const formattedPrice = `$${parseFloat(item.price).toFixed(2)}`;
        priceTag = `<div class="price-tag">${formattedPrice}</div>`;
      }
      
      html += `
        <div class="photo-item" id="photo-${item.id}" onclick="openLightbox(${findPhotoIndexById(item.id)}, false)" style="animation: fadeIn 0.5s ease-out ${delay}s both;">
          ${priceTag}
          <img src="${item.thumbnail}" alt="${item.name}">
          <div class="photo-info">
            <div class="photo-name">${item.name}</div>
            <div class="photo-actions">
              <button class="btn ${alreadyAdded ? 'btn-danger' : 'btn-gold'}" 
                onclick="event.stopPropagation(); ${alreadyAdded ? 'removeFromCart' : 'addToCart'}('${item.id}')">
                ${alreadyAdded ? 'Remove' : 'Select'}
              </button>
            </div>
          </div>
        </div>
      `;
    });
    
    // Fechar contêiner de fotos desta categoria
    html += '</div>';
  });
  
  // Se não houver nenhuma categoria com fotos
  if (html === '') {
    html = '<div class="empty-message">No items found in our collection.</div>';
  }
  
  contentDiv.innerHTML = html;
}

// Modificar a função loadCategories para não renderizar mais as abas
function loadCategories(forcedAdminStatus = null) {
  // Se for admin, continuamos com o comportamento existente
  if (forcedAdminStatus === true) {
    // Manter código existente para admin...
    return;
  }
  
  // Para clientes, simplificar para apenas carregar as fotos em formato de seções
  loadPhotos(); // Chama a nova versão que carrega tudo
}

// Nova função para renderizar categorias como seções
function renderCategoriesWithPhotos(photosByCategory, categoryNames) {
  const contentDiv = document.getElementById('content');
  let html = '';
  
  // Para cada categoria, criar uma seção
  Object.keys(photosByCategory).forEach(categoryId => {
    const categoryPhotos = photosByCategory[categoryId];
    
    // Pular categorias sem fotos
    if (categoryPhotos.length === 0) return;
    
    // Adicionar título da categoria (com estilo similar ao da imagem de referência)
    html += `
      <div class="category-title-container">
        <h2 class="category-title">${categoryNames[categoryId]}</h2>
        <div class="category-divider"></div>
      </div>
    `;
    
    // Abrir contêiner de fotos para esta categoria
    html += '<div class="category-photos">';
    
    // Adicionar cada foto
    categoryPhotos.forEach(function(item, index) {
      const alreadyAdded = cartIds.includes(item.id);
      const delay = (index % 10) * 0.05;
      
      // Format price if available
      let priceTag = '';
      if (item.price !== undefined) {
        const formattedPrice = `$${parseFloat(item.price).toFixed(2)}`;
        priceTag = `<div class="price-tag">${formattedPrice}</div>`;
      }
      
      html += `
        <div class="photo-item" id="photo-${item.id}" onclick="openLightbox(${findPhotoIndexById(item.id)}, false)" style="animation: fadeIn 0.5s ease-out ${delay}s both;">
          ${priceTag}
          <img src="${item.thumbnail}" alt="${item.name}">
          <div class="photo-info">
            <div class="photo-name">${item.name}</div>
            <div class="photo-actions">
              <button class="btn ${alreadyAdded ? 'btn-danger' : 'btn-gold'}" 
                onclick="event.stopPropagation(); ${alreadyAdded ? 'removeFromCart' : 'addToCart'}('${item.id}')">
                ${alreadyAdded ? 'Remove' : 'Select'}
              </button>
            </div>
          </div>
        </div>
      `;
    });
    
    // Fechar contêiner de fotos desta categoria
    html += '</div>';
  });
  
  // Se não houver nenhuma categoria com fotos
  if (html === '') {
    html = '<div class="empty-message">No items found in our collection.</div>';
  }
  
  contentDiv.innerHTML = html;
}

// Modificar a função loadCategories para não renderizar mais as abas
function loadCategories(forcedAdminStatus = null) {
  // Se for admin, continuamos com o comportamento existente
  if (forcedAdminStatus === true) {
    // [manter código existente para admin]
    return;
  }
  
  // Para clientes, simplificar para apenas carregar as fotos em formato de seções
  loadPhotos(); // Chama a nova versão que carrega tudo
}

// Render photos
function renderPhotos() {
  const contentDiv = document.getElementById('content');
  
  // Verificar se photos é um array válido
  if (!photos || !Array.isArray(photos) || photos.length === 0) {
    contentDiv.innerHTML = '<div class="empty-message">No items found in our collection.</div>';
    return;
  }
  
  let html = '';
  
  // Render each item (photo or divider)
  photos.forEach(function(item, index) {
    if (item.isDivider) {
      // This is a category divider
      html += `
        <div class="category-divider">
          <span>${item.name}</span>
        </div>
      `;
    } else {
      // This is a regular photo
      const alreadyAdded = cartIds.includes(item.id);
      const delay = (index % 10) * 0.05;
      
      // Format price if available
      let priceTag = '';
      if (item.price !== undefined) {
        const formattedPrice = `$${parseFloat(item.price).toFixed(2)}`;
        priceTag = `<div class="price-tag">${formattedPrice}</div>`;
      }
      
      html += `
        <div class="photo-item" id="photo-${item.id}" onclick="openLightbox(${index}, false)" style="animation: fadeIn 0.5s ease-out ${delay}s both;">
          ${priceTag}
          <img src="${item.thumbnail}" alt="${item.name}">
          <div class="photo-info">
            <div class="photo-name">${item.name}</div>
            <div class="photo-actions">
              <button class="btn ${alreadyAdded ? 'btn-danger' : 'btn-gold'}" 
                onclick="event.stopPropagation(); ${alreadyAdded ? 'removeFromCart' : 'addToCart'}('${item.id}')">
                ${alreadyAdded ? 'Remove' : 'Select'}
              </button>
            </div>
          </div>
        </div>
      `;
    }
  });
  
  contentDiv.innerHTML = html;
}

// Helper function to render a photo item (to avoid duplicating code)
function renderPhotoItem(photo, alreadyAdded, delay) {
  return `
    <div class="photo-item" id="photo-${photo.id}" onclick="openLightbox(${findPhotoIndexById(photo.id)}, false)" style="animation: fadeIn 0.5s ease-out ${delay}s both;">
      <img src="${photo.thumbnail}" alt="${photo.name}">
      <div class="photo-info">
        <div class="photo-name">${photo.name}</div>
        <div class="photo-actions">
          <button class="btn ${alreadyAdded ? 'btn-danger' : 'btn-gold'}" 
            onclick="event.stopPropagation(); ${alreadyAdded ? 'removeFromCart' : 'addToCart'}('${photo.id}')">
            ${alreadyAdded ? 'Remove' : 'Select'}
          </button>
        </div>
      </div>
    </div>
  `;
}

// Find index of photo by ID
function findPhotoIndexById(photoId) {
  return photos.findIndex(photo => photo.id === photoId);
}

// Load categories
function loadCategories(forcedAdminStatus = null) {
  showLoader();
  
  // If admin status is explicitly passed, use it
  // Otherwise check based on UI state
  let isAdmin;
  if (forcedAdminStatus !== null) {
    isAdmin = forcedAdminStatus;
  } else {
    const adminPanel = document.getElementById('admin-panel-modal');
    isAdmin = adminPanel && adminPanel.style.display === 'block';
  }
  
  // Always log the admin status for debugging
  console.log("Loading categories with admin status:", isAdmin);
  
  // Prepare query parameters
  let queryParams = `is_admin=${isAdmin}`;
  
  // Add customer code if a client is logged in
  if (currentCustomerCode && !isAdmin) {
    queryParams += `&customer_code=${currentCustomerCode}`;
  }
  
  // Make the API call with query parameters
  apiClient.getFolderStructure(queryParams)
    .then(function(result) {
      console.log("Categories response:", result);
      
      // Garantir que categories é sempre um array
      if (Array.isArray(result)) {
        categories = result;
      } else if (result && Array.isArray(result.categories)) {
        categories = result.categories;
      } else {
        // Caso a resposta não seja um array ou um objeto com campo categories
        categories = [];
        console.warn("API returned invalid categories format:", result);
      }
      
      console.log("Categories processed:", categories.length);
      renderCategories();
      
      // NOVA LÓGICA: Priorizar categorias específicas, não a primeira da lista
      if (categories.length > 0) {
        // Se não for admin e tiver categorias específicas, carregar uma não-All Items
        if (!isAdmin && currentCustomerCode && categories.length > 1) {
          // Encontrar a primeira categoria que não seja "All Items"
          const specificCategory = categories.find(cat => !cat.isAll);
          
          if (specificCategory) {
            console.log("Carregando categoria específica:", specificCategory.name, specificCategory.id);
            loadPhotos(specificCategory.id);
          } else {
            // Se só tiver All Items, carrega normalmente
            console.log("Só há All Items, carregando a primeira categoria:", categories[0].name, categories[0].id);
            loadPhotos(categories[0].id);
          }
        } else {
          // Para admin ou cliente sem configurações específicas, carrega a primeira
          console.log("Carregando primeira categoria:", categories[0].name, categories[0].id);
          loadPhotos(categories[0].id);
        }
      } else {
        // Se não tiver categorias, limpar a área de fotos
        document.getElementById('content').innerHTML = 
          '<div class="empty-message">No categories available for your account. Please contact support.</div>';
        hideLoader();
      }
    })
    .catch(function(error) {
      console.error('Error loading categories:', error);
      document.getElementById('content').innerHTML = 
        '<div class="empty-message">We apologize, but we couldn\'t load the collection. Please try again.</div>';
      hideLoader();
    });
}

// Render category tabs
function renderCategories() {
  const tabsContainer = document.querySelector('.category-tabs');
  const dropdownContainer = document.createElement('div');
  dropdownContainer.className = 'category-dropdown';
  
  // Create tabs
  let tabsHtml = '';
  categories.forEach(function(category, index) {
    const isActive = index === 0 ? 'active' : '';
    tabsHtml += `
      <div class="category-tab ${isActive}" onclick="switchCategory('${category.id}', this)">
        ${category.name}
      </div>
    `;
  });
  
  tabsContainer.innerHTML = tabsHtml;
  
  // Create dropdown for mobile
  let selectHtml = '<select class="category-select" onchange="switchCategoryFromDropdown(this.value)">';
  categories.forEach(function(category, index) {
    selectHtml += `<option value="${category.id}">${category.name}</option>`;
  });
  selectHtml += '</select>';
  
  dropdownContainer.innerHTML = selectHtml;
  tabsContainer.after(dropdownContainer);
}

// Switch category
function switchCategory(categoryId, element) {
  // Update current category
  currentCategoryId = categoryId;
  
  // Update active tab
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  if (element) element.classList.add('active');
  
  // Update dropdown selection (for mobile)
  const dropdown = document.querySelector('.category-select');
  if (dropdown) dropdown.value = categoryId;
  
  // Load photos for the selected category
  loadPhotos(categoryId);
}

// Switch category from dropdown
function switchCategoryFromDropdown(categoryId) {
  // Find the corresponding tab and activate it
  const tabs = document.querySelectorAll('.category-tab');
  let selectedTab = null;
  
  tabs.forEach(tab => {
    if (tab.getAttribute('onclick').includes(categoryId)) {
      selectedTab = tab;
    }
  });
  
  switchCategory(categoryId, selectedTab);
}

// Handle key presses
function handleKeyDown(e) {
  // Only process if lightbox is open
  if (document.getElementById('lightbox').style.display !== 'block') return;
  
  switch(e.key) {
    case 'ArrowLeft':
      navigatePhotos(-1);
      break;
    case 'ArrowRight':
      navigatePhotos(1);
      break;
    case 'Escape':
      closeLightbox();
      break;
  }
}