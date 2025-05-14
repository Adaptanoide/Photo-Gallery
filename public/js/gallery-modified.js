// gallery-modified.js

// Global variables (mantidos do original)
const FOLDER_ID = "<?= FOLDER_ID ?>"; // This will need to be passed from server
let photos = [];
let categories = [];
let currentCategoryId = null;
let currentPhotoIndex = 0;
let loadedCategories = {}; // NOVO: Rastrear categorias já carregadas
let photoRegistry = {}; // NOVO: Registrar fotos por ID para acesso rápido
let allCategoriesLoaded = false; // NOVO: Flag para indicar se todas as categorias foram carregadas

// Initialization for gallery
document.addEventListener('DOMContentLoaded', function() {
  // Add keyboard events for navigation
  document.addEventListener('keydown', handleKeyDown);
});

// NOVA FUNÇÃO: Carregamento otimizado com dados iniciais
function loadPhotos(categoryId = null) {
  showLoader();
  
  // Se o cliente não estiver logado, não tente carregar fotos
  if (!currentCustomerCode) {
    hideLoader();
    return;
  }
  
  // Limpamos a galeria e mostramos mensagem de carregamento
  const contentDiv = document.getElementById('content');
  contentDiv.className = 'content-vertical';
  contentDiv.innerHTML = '<div class="empty-message">Loading our exquisite collection...</div>';
  
  console.log("Loading initial data for customer: " + currentCustomerCode);
  
  // NOVA CHAMADA API: Obter dados iniciais do cliente
  fetch(`/api/client/initial-data?code=${currentCustomerCode}`)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Armazenar dados
        categories = data.categories || [];
        console.log(`Loaded ${categories.length} categories`);
        
        // Esvaziar a área de conteúdo e preparar para renderização
        contentDiv.innerHTML = '';
        
        // Verificar se temos categorias
        if (categories.length <= 1) { // Apenas All Items
          contentDiv.innerHTML = '<div class="empty-message">No categories are available for your account. Please contact support.</div>';
          hideLoader();
          return;
        }
        
        // Adicionar estilos inline
        contentDiv.innerHTML = `
          <style>
            .content-vertical {
              width: 100%;
              max-width: 100%;
              display: block;
            }
            .content-vertical .category-section {
              display: grid !important;
              grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)) !important;
              gap: 30px !important;
              width: 100% !important;
              margin-bottom: 40px !important;
            }
            @media (max-width: 768px) {
              .content-vertical .category-section {
                grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)) !important;
                gap: 15px !important;
              }
            }
            .skeleton-item {
              animation: pulse 1.5s infinite ease-in-out;
            }
            .skeleton-image {
              height: 300px;
              background-color: #e0e0e0;
              border-radius: 6px 6px 0 0;
            }
            .skeleton-text {
              height: 20px;
              width: 70%;
              background-color: #e0e0e0;
              margin-bottom: 10px;
              border-radius: 4px;
            }
            .skeleton-button {
              height: 36px;
              width: 100px;
              background-color: #e0e0e0;
              border-radius: 4px;
            }
            @keyframes pulse {
              0% { opacity: 0.6; }
              50% { opacity: 1; }
              100% { opacity: 0.6; }
            }
            .progress-indicator {
              position: fixed;
              top: 0;
              left: 0;
              height: 3px;
              background-color: var(--color-gold);
              width: 0%;
              transition: width 0.3s ease;
              z-index: 1000;
            }
          </style>
        `;
        
        // Criar indicador de progresso
        const progressIndicator = document.createElement('div');
        progressIndicator.className = 'progress-indicator';
        progressIndicator.id = 'loading-progress';
        document.body.appendChild(progressIndicator);
        
        // Renderizar categorias - primeiro as que têm previews, depois placeholders
        const previews = data.previews || {};
        const previewedCategories = Object.keys(previews);
        
        // Marcar categorias já carregadas
        previewedCategories.forEach(catId => {
          loadedCategories[catId] = true;
        });
        
        // Processar categorias específicas (não All Items)
        const specificCategories = categories.filter(cat => !cat.isAll);
        
        // Limpar photoRegistry e array global de fotos
        photoRegistry = {};
        photos = [];
        allCategoriesLoaded = false; // Reset da flag
        
        // Renderizar categorias com previews primeiro
        specificCategories.forEach(category => {
          const categoryId = category.id;
          const categoryPhotos = previews[categoryId] || [];
          const hasPreview = categoryPhotos.length > 0;
          
          // Criar título da categoria
          const categoryContainer = document.createElement('div');
          categoryContainer.innerHTML = `
            <div class="category-title-container">
              <h2>${category.name}</h2>
              <div class="category-divider"></div>
            </div>
            <div id="category-section-${categoryId}" class="category-section"></div>
          `;
          contentDiv.appendChild(categoryContainer);
          
          // Obter o contêiner da seção
          const sectionContainer = document.getElementById(`category-section-${categoryId}`);
          
          if (hasPreview) {
            // Registrar fotos no índice global
            categoryPhotos.forEach(photo => {
              photoRegistry[photo.id] = photo;
            });
            
            // Renderizar fotos disponíveis
            renderCategoryPhotos(sectionContainer, categoryPhotos);
            
            // Adicionar estas fotos ao array global
            photos = photos.concat(categoryPhotos);
          } else {
            // Renderizar esqueletos para categorias sem previews
            renderSkeletons(sectionContainer);
          }
        });
        
        // Ocultar o loader principal - a página já está utilizável
        hideLoader();
        
        // Iniciar carregamento em segundo plano para categorias restantes
        loadRemainingCategories(specificCategories, previews);
        
        // Atualizar botões para refletir o estado do carrinho
        setTimeout(updateButtonsForCartItems, 100);
      } else {
        contentDiv.innerHTML = `<div class="empty-message">${data.message || 'Error loading data. Please try again.'}</div>`;
        hideLoader();
      }
    })
    .catch(error => {
      console.error("Error loading initial data:", error);
      contentDiv.innerHTML = '<div class="empty-message">Sorry, we encountered a connection error. Please try again.</div>';
      hideLoader();
      
      // Remover indicador de progresso em caso de erro
      const progressIndicator = document.getElementById('loading-progress');
      if (progressIndicator) {
        progressIndicator.remove();
      }
    });
}

// FUNÇÃO MODIFICADA: Renderizar fotos de uma categoria com tratamento de erro
function renderCategoryPhotos(container, photos) {
  if (!photos || photos.length === 0) {
    // Se não tem fotos, podemos esconder a categoria completamente
    if (container) {
      const categoryContainer = container.closest('.category-title-container')?.parentNode;
      if (categoryContainer) {
        categoryContainer.style.display = "none";
      } else {
        container.style.display = "none";
      }
    }
    return;
  }
  
  let html = '';
  
  // Adicionar cada foto com tratamento de erro de carregamento
  photos.forEach((photo, index) => {
    const alreadyAdded = cartIds.includes(photo.id);
    const delay = (index % 10) * 0.05;
    
    // Format price if available
    let priceTag = '';
    if (photo.price !== undefined) {
      const formattedPrice = `$${parseFloat(photo.price).toFixed(2)}`;
      priceTag = `<div class="price-tag">${formattedPrice}</div>`;
    }
    
    // MODIFICADO: Adicionar onerror para tratar imagens que não podem ser carregadas
    html += `
      <div class="photo-item" id="photo-${photo.id}" onclick="openLightboxById('${photo.id}', false)" style="animation: fadeIn 0.5s ease-out ${delay}s both; width: 100%;">
        ${priceTag}
        <img src="${photo.thumbnail}" alt="${photo.name}" loading="lazy" 
             onerror="this.parentNode.remove(); checkEmptyCategory('${container.id}');">
        <div class="photo-info">
          <div class="photo-name">${photo.name}</div>
          <div class="photo-actions">
            <button class="btn ${alreadyAdded ? 'btn-danger' : 'btn-gold'}" 
              id="button-${photo.id}"
              onclick="event.stopPropagation(); ${alreadyAdded ? 'removeFromCart' : 'addToCart'}('${photo.id}')">
              ${alreadyAdded ? 'Remove' : 'Select'}
            </button>
          </div>
        </div>
      </div>
    `;
  });
  
  // Atualizar conteúdo com transição suave
  container.style.opacity = "0";
  setTimeout(() => {
    container.innerHTML = html;
    container.style.transition = "opacity 0.5s ease";
    container.style.opacity = "1";
  }, 50);
}

// NOVA FUNÇÃO: Verificar se uma categoria ficou vazia e ocultá-la
function checkEmptyCategory(containerId) {
  const container = document.getElementById(containerId);
  if (container && container.children.length === 0) {
    // Categoria está vazia, ocultar o contêiner da categoria
    const categoryContainer = container.closest('.category-title-container')?.parentNode;
    if (categoryContainer) {
      categoryContainer.style.display = "none";
    } else {
      container.style.display = "none";
    }
  }
}

// NOVA FUNÇÃO: Renderizar esqueletos para carregamento
function renderSkeletons(container) {
  let html = '';
  
  // Renderizar 6 placeholders de esqueleto
  for (let i = 0; i < 6; i++) {
    html += `
      <div class="photo-item skeleton-item">
        <div class="skeleton-image"></div>
        <div class="photo-info">
          <div class="skeleton-text"></div>
          <div class="photo-actions">
            <div class="skeleton-button"></div>
          </div>
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

// FUNÇÃO MODIFICADA: Carregar categorias restantes em segundo plano
function loadRemainingCategories(allCategories, preloadedPreviews) {
  // Filtrar apenas categorias que ainda precisam ser carregadas
  const categoriesToLoad = allCategories.filter(category => !loadedCategories[category.id]);
  
  if (categoriesToLoad.length === 0) {
    console.log("All categories already loaded");
    allCategoriesLoaded = true; // Atualizar flag
    removeProgressIndicator();
    return;
  }
  
  console.log(`Loading ${categoriesToLoad.length} remaining categories in background`);
  
  // Preparar para atualizar o indicador de progresso
  const progressIndicator = document.getElementById('loading-progress');
  if (progressIndicator) {
    progressIndicator.style.width = '10%'; // Começar com 10%
  }
  
  // Carregar categorias uma por uma
  let currentIndex = 0;
  const totalCategories = categoriesToLoad.length;
  
  function loadNextCategory() {
    if (currentIndex >= totalCategories) {
      // Todas as categorias carregadas, remover indicador
      allCategoriesLoaded = true; // Atualizar flag
      removeProgressIndicator();
      return;
    }
    
    const category = categoriesToLoad[currentIndex];
    
    // Atualizar progresso
    if (progressIndicator) {
      const progress = 10 + (currentIndex / totalCategories * 90); // 10% - 100%
      progressIndicator.style.width = `${progress}%`;
    }
    
    // Obter fotos da categoria
    fetch(`/api/photos?category_id=${category.id}&customer_code=${currentCustomerCode}`)
      .then(response => response.json())
      .then(categoryPhotos => {
        // Verificar se é um array e tem elementos
        if (Array.isArray(categoryPhotos) && categoryPhotos.length > 0) {
          // Registrar as fotos no índice global por ID
          categoryPhotos.forEach(photo => {
            photoRegistry[photo.id] = photo;
          });
          
          // Adicionar ao array global
          photos = photos.concat(categoryPhotos);
          
          // Atualizar UI para esta categoria
          const sectionContainer = document.getElementById(`category-section-${category.id}`);
          if (sectionContainer) {
            renderCategoryPhotos(sectionContainer, categoryPhotos);
          }
          
          // Marcar como carregada
          loadedCategories[category.id] = true;
        } else {
          // Se não tiver fotos, ocultar a categoria
          const sectionContainer = document.getElementById(`category-section-${category.id}`);
          if (sectionContainer) {
            const categoryContainer = sectionContainer.closest('.category-title-container')?.parentNode;
            if (categoryContainer) {
              categoryContainer.style.display = "none";
            }
          }
        }
        
        // Atualizar índice e continuar para a próxima
        currentIndex++;
        setTimeout(loadNextCategory, 100);
      })
      .catch(error => {
        console.error(`Error loading category ${category.name}:`, error);
        // Continuar mesmo em caso de erro
        currentIndex++;
        setTimeout(loadNextCategory, 100);
      });
  }
  
  // Iniciar carregamento
  loadNextCategory();
}

// FUNÇÃO MODIFICADA: Remover indicador de progresso e notificar conclusão
function removeProgressIndicator() {
  const indicator = document.getElementById('loading-progress');
  if (indicator) {
    indicator.style.width = '100%';
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
      // Notificar que o carregamento está completo
      notifyLoadingComplete();
    }, 500);
  }
}

// NOVA FUNÇÃO: Notificar que o carregamento está completo
function notifyLoadingComplete() {
  // Disparar um evento customizado que o carrinho pode escutar
  const event = new CustomEvent('galleryLoadingComplete');
  document.dispatchEvent(event);
  console.log("Todas as categorias carregadas");
}

// FUNÇÃO ATUALIZADA: Atualiza os botões para refletir os itens no carrinho
function updateButtonsForCartItems() {
  console.log("Updating buttons to reflect cart:", cartIds);
  
  // Para cada item no carrinho
  cartIds.forEach(photoId => {
    // Encontrar o botão correspondente
    const button = document.getElementById(`button-${photoId}`);
    if (button) {
      // Atualizar o botão para mostrar "Remove" e a classe de perigo
      button.textContent = 'Remove';
      button.className = 'btn btn-danger';
      button.onclick = function(event) {
        event.stopPropagation();
        removeFromCart(photoId);
      };
    }
  });
}

// Modificar a função loadCategories para usar a nova abordagem
function loadCategories(forcedAdminStatus = null) {
  // Se for admin, continuamos com o comportamento existente original
  if (forcedAdminStatus === true) {
    // Lógica original para admin, caso necessário
    console.log("Admin mode detected, using original category loading");
    return;
  }
  
  // Limpar variáveis de estado
  photos = [];
  loadedCategories = {};
  photoRegistry = {}; // NOVO: Limpar registro de fotos
  allCategoriesLoaded = false; // Reset da flag
  
  // Para clientes, carregar com o novo método otimizado
  loadPhotos();
}

// FUNÇÃO MODIFICADA: Find photo by ID com fallback no registro
function findPhotoIndexById(photoId) {
  // Primeiro tentar encontrar no array global
  const index = photos.findIndex(photo => photo.id === photoId);
  
  // Se não encontrou, mas temos no registro, adicionar ao array global e tentar novamente
  if (index === -1 && photoRegistry[photoId]) {
    photos.push(photoRegistry[photoId]);
    return photos.length - 1;
  }
  
  return index;
}

// Obter foto por ID (NOVA FUNÇÃO AUXILIAR)
function getPhotoById(photoId) {
  // Procurar no array global
  const photo = photos.find(p => p.id === photoId);
  
  // Se não encontrou, verificar no registro
  if (!photo && photoRegistry[photoId]) {
    return photoRegistry[photoId];
  }
  
  return photo;
}

// Handle key presses (mantida do original)
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