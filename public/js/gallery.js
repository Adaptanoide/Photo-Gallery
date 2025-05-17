// gallery-modified.js
// Global variables
const FOLDER_ID = "<?= FOLDER_ID ?>"; // This will need to be passed from server
let photos = [];
let categories = [];
let currentCategoryId = null;
let currentPhotoIndex = 0;
let loadedCategories = {}; // NOVO: Rastrear categorias já carregadas
let photoRegistry = {}; // NOVO: Registrar fotos por ID para acesso rápido
let allCategoriesLoaded = false; // NOVO: Flag para indicar se todas as categorias foram carregadas

// Função utilitária para verificar se um elemento existe antes de manipulá-lo
function safeDOM(selector, callback) {
  const element = document.querySelector(selector);
  if (element && typeof callback === 'function') {
    callback(element);
  }
  return element;
}

// Função para esconder categorias vazias após o carregamento
function hideEmptyCategories() {
  console.log("Verificando e ocultando categorias vazias...");
  
  // Selecionar todas as seções de categoria
  const categorySections = document.querySelectorAll('.category-section');
  
  categorySections.forEach(section => {
    // Se a seção não tem elementos filhos ou tem menos de 1 foto, ocultar
    if (!section.children || section.children.length === 0) {
      console.log(`Ocultando categoria vazia: ${section.id}`);
      
      // Encontrar o contêiner pai que inclui o título
      const categoryContainer = section.closest('.category-title-container')?.parentNode;
      if (categoryContainer) {
        categoryContainer.style.display = "none";
      } else if (section.parentNode) {
        // Se não encontrar o contêiner, ocultar a própria seção
        section.parentNode.style.display = "none";
      }
    }
  });
}

// Initialization for gallery
document.addEventListener('DOMContentLoaded', function() {
  // Add keyboard events for navigation
  document.addEventListener('keydown', handleKeyDown);
  
  // Adicionar estilos para o "carregar mais"
  if (!document.getElementById('load-more-styles')) {
    const style = document.createElement('style');
    style.id = 'load-more-styles';
    style.textContent = `
      .loading-indicator {
        text-align: center;
        padding: 20px;
      }
      .loading-indicator p {
        margin-top: 10px;
        font-style: italic;
        color: #666;
      }
      .circular {
        animation: rotate 2s linear infinite;
        height: 40px;
        width: 40px;
        margin: 0 auto;
      }
      .path {
        stroke-dasharray: 89, 200;
        stroke-dashoffset: 0;
        stroke: var(--color-gold, #d4af37);
        animation: dash 1.5s ease-in-out infinite;
      }
      @keyframes rotate {
        100% { transform: rotate(360deg); }
      }
      @keyframes dash {
        0% {
          stroke-dasharray: 1, 150;
          stroke-dashoffset: 0;
        }
        50% {
          stroke-dasharray: 90, 150;
          stroke-dashoffset: -35;
        }
        100% {
          stroke-dasharray: 90, 150;
          stroke-dashoffset: -124;
        }
      }
      .end-batch-btn {
        background: linear-gradient(45deg, var(--color-gold, #d4af37), #f0e68c);
        color: black;
        font-weight: bold;
        padding: 12px 24px;
        border-radius: 4px;
        border: none;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 3px 10px rgba(0,0,0,0.2);
        animation: pulse 2s infinite;
      }
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.7); }
        70% { box-shadow: 0 0 0 15px rgba(212, 175, 55, 0); }
        100% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0); }
      }
      .load-more-container {
        padding: 20px;
        text-align: center;
        border-top: 1px solid rgba(212, 175, 55, 0.3);
        margin-top: 20px;
      }
      .end-message {
        background: rgba(212, 175, 55, 0.1);
        padding: 20px;
        border-radius: 8px;
        text-align: center;
        margin: 20px 0;
        border: 1px solid rgba(212, 175, 55, 0.3);
      }
      .end-message p {
        margin-bottom: 15px;
        color: #333;
      }
      .lightbox-notification {
        position: absolute;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(33, 37, 41, 0.8);
        border: 1px solid var(--color-gold, #d4af37);
        border-radius: 8px;
        padding: 10px 15px;
        color: white;
        opacity: 1;
        transition: opacity 0.5s ease;
        z-index: 100;
      }
      .end-notification {
        background-color: rgba(212, 175, 55, 0.2);
        padding: 15px 20px;
      }
      .notification-content {
        display: flex;
        align-items: center;
        gap: 15px;
      }
      .btn-sm {
        padding: 5px 10px;
        font-size: 14px;
      }
    `;
    document.head.appendChild(style);
  }
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
  // CORREÇÃO: Manter a classe gallery em vez de content-vertical
  contentDiv.className = 'gallery';
  contentDiv.innerHTML = '<div class="empty-message">Loading our exquisite collection...</div>';
  
  console.log("Loading initial data for customer: " + currentCustomerCode);
  
  // ADICIONADO: Limpar cache para garantir dados atualizados
  fetch('/api/client/clear-cache', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }).catch(err => console.log("Erro ao limpar cache (não crítico):", err));
  
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
        
        // CORREÇÃO: Manter a classe gallery e aplicar estilos que respeitam o layout
        contentDiv.className = 'gallery';
        
        // AJUSTE: Adicionar estilos com !important para forçar o layout correto
        const styleElement = document.createElement('style');
        styleElement.textContent = `
          /* Garantir que a galeria tenha o layout correto */
          .gallery {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 0 !important;
            width: 100% !important;
          }
          
          /* Garantir que as seções de categoria tenham o layout correto */
          .category-section {
            display: grid !important;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)) !important;
            gap: 30px !important;
            width: 100% !important;
            margin-bottom: 40px !important;
          }
          
          /* Garantir que os títulos de categoria ocupem toda a largura */
          .category-title-container {
            grid-column: 1 / -1 !important;
            width: 100% !important;
            margin: 40px 0 20px 0 !important;
          }
          
          /* Garantir que a primeira categoria não tenha margem superior */
          .category-title-container:first-child {
            margin-top: 0 !important;
          }
          
          @media (max-width: 768px) {
            .category-section {
              grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)) !important;
              gap: 15px !important;
            }
          }
        `;
        document.head.appendChild(styleElement);
        
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
        
        // FILTRO ADICIONAL: Pular categorias sem fotos logo no início
        // Processar categorias específicas (não All Items) com arquivos
        const specificCategories = categories.filter(cat => 
          !cat.isAll && 
          (cat.fileCount > 0 || 
           (previews[cat.id] && previews[cat.id].length > 0))
        );
        
        console.log(`Filtered to ${specificCategories.length} non-empty categories`);
        
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
          categoryContainer.style.width = '100%';
          categoryContainer.style.gridColumn = '1 / -1';
          
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
          
          if (sectionContainer) {
            // CORREÇÃO: Aplicar estilos diretamente para garantir grid
            sectionContainer.style.display = 'grid';
            sectionContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
            sectionContainer.style.gap = '30px';
            sectionContainer.style.width = '100%';
            
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
          }
        });
        
        // Ocultar o loader principal - a página já está utilizável
        hideLoader();
        
        // MODIFICADO: Usar carregamento em lotes em vez do original
        loadCategoriesInBatches(specificCategories, previews);
        
        // Atualizar botões para refletir o estado do carrinho
        setTimeout(updateButtonsForCartItems, 100);
        
        // ADICIONADO: Verificar categorias vazias imediatamente e após um curto atraso
        hideEmptyCategories();
        setTimeout(hideEmptyCategories, 500);
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
  
  // CORREÇÃO: Garantir que o container tenha o estilo de grid correto
  if (container) {
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
    container.style.gap = '30px';
    container.style.width = '100%';
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
  
  // CORREÇÃO: Aplicar o HTML diretamente, sem atraso
  container.innerHTML = html;
}

// Substitua a função de animação de mensagens por esta versão mais confiável
function animateLoaderMessages() {
  // Obter todas as mensagens
  const messages = document.querySelectorAll('.loader-messages .message');
  
  // Se não há mensagens, retornar
  if (!messages || messages.length === 0) return;
  
  // Garantir que apenas a primeira mensagem está ativa inicialmente
  messages.forEach(msg => msg.classList.remove('active'));
  messages[0].classList.add('active');
  
  let currentIndex = 0;
  
  // Criar uma função de transição
  function transitionToNextMessage() {
    // Remover classe active da mensagem atual
    messages[currentIndex].classList.remove('active');
    
    // Avançar para próxima mensagem
    currentIndex = (currentIndex + 1) % messages.length;
    
    // Adicionar classe active à próxima mensagem
    messages[currentIndex].classList.add('active');
  }
  
  // Iniciar a transição automática
  return setInterval(transitionToNextMessage, 1000);
}

// Quando o documento carregar, inicializar animações
document.addEventListener('DOMContentLoaded', function() {
  // Armazenar o intervalo para poder limpar depois
  window.messageInterval = animateLoaderMessages();
  
  // ADICIONADO: Limpar cache do servidor para garantir dados frescos
  forceServerCacheClean();
  
  // ADICIONADO: Executar a verificação de categorias vazias várias vezes
  // para garantir que pegue conteúdo carregado dinamicamente
  setTimeout(hideEmptyCategories, 500);
  setTimeout(hideEmptyCategories, 2000);
  setTimeout(hideEmptyCategories, 5000);
});

// Modificar a função hideLoader para limpar o intervalo
function hideLoader() {
  document.getElementById('loader').style.display = 'none';
  
  // Limpar o intervalo de transição de mensagens
  if (window.messageInterval) {
    clearInterval(window.messageInterval);
    window.messageInterval = null;
  }
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

// NOVA FUNÇÃO: Carregamento em lotes para melhor performance
function loadCategoriesInBatches(specificCategories, previews) {
  const BATCH_SIZE = 1; // Carregar apenas 1 categorias por vez
  const MAX_IMAGES_PER_CATEGORY = 12; // Aumento para 12 fotos por vez
  
  console.log(`Iniciando carregamento em lotes de ${specificCategories.length} categorias`);
  
  // 1. Priorizar categorias com mais imagens/mais importantes
  // Ordenar categorias por número de arquivos (do maior para o menor)
  const sortedCategories = [...specificCategories].sort((a, b) => {
    // Primeiro critério: ter preview (mais importante)
    const aHasPreview = previews[a.id] && previews[a.id].length > 0;
    const bHasPreview = previews[b.id] && previews[b.id].length > 0;
    
    if (aHasPreview && !bHasPreview) return -1;
    if (!aHasPreview && bHasPreview) return 1;
    
    // Segundo critério: número de arquivos
    return (b.fileCount || 0) - (a.fileCount || 0);
  });
  
  // 2. Dividir em lotes
  const batches = [];
  for (let i = 0; i < sortedCategories.length; i += BATCH_SIZE) {
    batches.push(sortedCategories.slice(i, i + BATCH_SIZE));
  }
  
  console.log(`Dividido em ${batches.length} lotes para carregamento otimizado`);
  
  // 3. Carregar lotes sequencialmente
  let currentBatch = 0;
  
  function loadNextBatch() {
    if (currentBatch >= batches.length) {
      console.log("Todos os lotes carregados com sucesso");
      allCategoriesLoaded = true;
      removeProgressIndicator();
      hideEmptyCategories(); // Verificação final
      return;
    }
    
    const batch = batches[currentBatch];
    console.log(`Carregando lote ${currentBatch + 1}/${batches.length} com ${batch.length} categorias`);
    
    // Atualizar indicador de progresso
    const progressIndicator = document.getElementById('loading-progress');
    if (progressIndicator) {
      const progress = (currentBatch / batches.length) * 100;
      progressIndicator.style.width = `${progress}%`;
    }
    
    // Carregar cada categoria no lote em paralelo
    const batchPromises = batch.map(category => {
      return new Promise((resolve) => {
        // Verificar se já temos preview desta categoria
        if (previews[category.id] && previews[category.id].length > 0) {
          console.log(`Categoria ${category.name} já tem preview, pulando`);
          resolve();
          return;
        }
        
        // Buscar fotos da categoria com limite para melhor performance
        fetch(`/api/photos?category_id=${category.id}&customer_code=${currentCustomerCode}&limit=${MAX_IMAGES_PER_CATEGORY}`)
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
                
                // Se carregamos mais que um certo número de fotos, adicionar botão "carregar mais"
                if (categoryPhotos.length >= MAX_IMAGES_PER_CATEGORY) {
                  const loadMoreBtn = document.createElement('div');
                  loadMoreBtn.className = 'load-more-btn';
                  loadMoreBtn.innerHTML = `
                    <button class="btn btn-secondary" onclick="loadMoreForCategory('${category.id}', ${categoryPhotos.length})">
                      Ver mais fotos
                    </button>
                  `;
                  sectionContainer.appendChild(loadMoreBtn);
                }
              }
              
              // Marcar como carregada
              loadedCategories[category.id] = true;
            } else {
              // Se não tiver fotos, ocultar a categoria
              const sectionContainer = document.getElementById(`category-section-${category.id}`);
              if (sectionContainer) {
                const categoryContainer = sectionContainer.closest('.category-title-container')?.parentNode;
                if (categoryContainer) {
                  console.log(`Ocultando categoria vazia: ${category.name}`);
                  categoryContainer.style.display = "none";
                }
              }
            }
            
            resolve();
          })
          .catch(error => {
            console.error(`Error loading category ${category.name}:`, error);
            resolve(); // Continuar mesmo com erro
          });
      });
    });
    
    // Quando todos no lote terminarem, passar para próximo lote
    Promise.all(batchPromises).then(() => {
      currentBatch++;
      // Pausa entre lotes para melhorar responsividade da UI
      setTimeout(loadNextBatch, 300);
    });
  }
  
  // Iniciar carregamento do primeiro lote
  loadNextBatch();
  // Pré-carregar próxima categoria se houver
  if (specificCategories.length > 0) {
    preloadNextCategoryImages(0); // Pré-carregar a próxima após a primeira
  }
}

// NOVA FUNÇÃO MODIFICADA: Carregar mais fotos para uma categoria específica
// FUNÇÃO MODIFICADA: Carregar mais fotos para uma categoria específica
function loadMoreForCategory(categoryId, offset) {
  console.log(`Carregando mais fotos para categoria ${categoryId}, offset=${offset}`);
  const BATCH_SIZE = 50; // Usar esta constante local ou ajuste para um valor apropriado
  
  const sectionContainer = document.getElementById(`category-section-${categoryId}`);
  if (!sectionContainer) return;
  
  // Crie ou encontre o botão "carregar mais"
  let loadMoreBtn = sectionContainer.querySelector('.load-more-btn');
  if (!loadMoreBtn) {
    loadMoreBtn = document.createElement('div');
    loadMoreBtn.className = 'load-more-btn';
    sectionContainer.appendChild(loadMoreBtn);
  }
  
  // Mostrar feedback de carregamento
  loadMoreBtn.innerHTML = `
    <div class="loading-indicator">
      <svg class="circular" viewBox="25 25 50 50">
        <circle class="path" cx="50" cy="50" r="20" fill="none" stroke-width="4" stroke-miterlimit="10"/>
      </svg>
      <p>Carregando mais fotos exquisitas...</p>
    </div>
  `;
  
  // Fazer requisição para obter mais fotos
  console.log(`Buscando mais fotos: /api/photos?category_id=${categoryId}&customer_code=${currentCustomerCode}&offset=${offset}&limit=${BATCH_SIZE}`);
  
  fetch(`/api/photos?category_id=${categoryId}&customer_code=${currentCustomerCode}&offset=${offset}&limit=${BATCH_SIZE}`)
    .then(response => response.json())
    .then(categoryPhotos => {
      if (!Array.isArray(categoryPhotos) || categoryPhotos.length === 0) {
        loadMoreBtn.innerHTML = `
          <div class="end-message">
            <p>Não há mais itens nesta categoria. Explore outras categorias para mais opções!</p>
          </div>
        `;
        return;
      }
      
      // Registrar novas fotos
      categoryPhotos.forEach(photo => {
        photoRegistry[photo.id] = photo;
      });
      
      // Adicionar ao array global
      photos = photos.concat(categoryPhotos);
      
      // Renderizar novas fotos
      const newPhotosContainer = document.createElement('div');
      newPhotosContainer.className = 'new-photos-container';
      sectionContainer.appendChild(newPhotosContainer);
      
      renderCategoryPhotos(newPhotosContainer, categoryPhotos);
      
      // Remover container temporário e mesclar conteúdo
      const newPhotoDivs = Array.from(newPhotosContainer.children);
      newPhotosContainer.remove();
      
      // Adicionar cada nova foto antes do botão "ver mais"
      newPhotoDivs.forEach(div => {
        if (loadMoreBtn) {
          sectionContainer.insertBefore(div, loadMoreBtn);
        } else {
          sectionContainer.appendChild(div);
        }
      });
      
      // Verificar se precisamos de um novo botão "ver mais"
      const newOffset = offset + categoryPhotos.length;
      const moreToLoad = categoryPhotos.length >= BATCH_SIZE;
      
      if (moreToLoad) {
        loadMoreBtn.innerHTML = `
          <button class="btn btn-secondary" onclick="loadMoreForCategory('${categoryId}', ${newOffset})">
            Ver mais fotos
          </button>
        `;
      } else {
        // Não tem mais fotos, mostrar mensagem final
        loadMoreBtn.innerHTML = `
          <div class="end-message">
            <p>Fim desta categoria. Explore outras categorias para mais opções!</p>
          </div>
        `;
      }
      
      // Atualizar botões para refletir o estado do carrinho
      setTimeout(updateButtonsForCartItems, 100);
      
      // Ativar lazy loading para as novas imagens
      if (typeof enhanceLazyLoading === 'function') {
        enhanceLazyLoading();
      }
      
      // Disparar evento para indicar que a galeria foi atualizada
      document.dispatchEvent(new CustomEvent('galleryUpdated'));
    })
    .catch(error => {
      console.error(`Erro ao carregar mais fotos para categoria ${categoryId}:`, error);
      loadMoreBtn.innerHTML = '<button class="btn btn-danger">Erro ao carregar mais fotos. Tente novamente.</button>';
      
      // Adicionar botão de tentar novamente
      const retryBtn = document.createElement('button');
      retryBtn.className = 'btn btn-secondary';
      retryBtn.style.marginLeft = '10px';
      retryBtn.textContent = 'Tentar Novamente';
      retryBtn.onclick = () => loadMoreForCategory(categoryId, offset);
      
      loadMoreBtn.appendChild(retryBtn);
    });
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
      
      // ADICIONADO: Executar verificação final de categorias vazias
      hideEmptyCategories();
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

// Função para forçar limpeza do cache do servidor
function forceServerCacheClean() {
  fetch('/api/client/clear-cache', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(response => response.json())
  .then(data => {
    console.log("Cache do servidor limpo:", data);
  })
  .catch(err => console.error("Erro ao limpar cache:", err));
}

// Função para melhorar o lazy loading com Intersection Observer
function enhanceLazyLoading() {
  // Apenas execute se o navegador suportar
  if ('IntersectionObserver' in window) {
    // Criar o observer uma única vez e reutilizá-lo
    if (!window.imageObserver) {
      window.imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            
            // Adicionar classe de transição se não existir
            if (!img.classList.contains('loading') && !img.classList.contains('loaded')) {
              img.classList.add('loading');
            }
            
            // Monitorar quando a imagem for completamente carregada
            img.onload = () => {
              img.classList.remove('loading');
              img.classList.add('loaded');
              img.dataset.loaded = 'true';
            };
            
            // Parar de observar depois que a imagem entrar na viewport
            window.imageObserver.unobserve(img);
          }
        });
      }, {
        rootMargin: '100px' // Começar a carregar quando estiver a 100px da viewport
      });
    }
    
    // Observar todas as imagens da galeria que ainda não foram processadas
    document.querySelectorAll('.photo-item img:not([data-observed="true"])').forEach(img => {
      img.dataset.observed = 'true';
      window.imageObserver.observe(img);
    });
  }
}

// Chamar quando novas imagens forem adicionadas
document.addEventListener('galleryUpdated', enhanceLazyLoading);

// Chamar na inicialização com estilos de transição
document.addEventListener('DOMContentLoaded', function() {
  // Criar elemento de estilo
  const style = document.createElement('style');
  style.textContent = `
    .photo-item img {
      transition: transform 0.2s ease;
    }
    .photo-item img.loaded {
      transform: translateZ(0); /* Pequeno hack para forçar aceleração de hardware */
    }
  `;
  document.head.appendChild(style);
  
  // Iniciar lazy loading
  enhanceLazyLoading();
});

// Em gallery.js - adicionar função de pré-carregamento
function preloadNextCategoryImages(currentCategoryIndex) {
  // Tentar pré-carregar a próxima categoria se existir
  if (categories && categories[currentCategoryIndex + 1]) {
    const nextCategory = categories[currentCategoryIndex + 1];
    if (!nextCategory.isAll) {
      console.log(`Pré-carregando thumbnails para próxima categoria: ${nextCategory.name}`);
      
      // Carregar em segundo plano, mas não renderizar
      fetch(`/api/photos?category_id=${nextCategory.id}&customer_code=${currentCustomerCode}&limit=6`)
        .then(response => response.json())
        .then(data => {
          console.log(`Pré-carregados ${data.length} thumbnails da próxima categoria`);
          
          // Opcionalmente pré-carregar as imagens reais
          if (Array.isArray(data)) {
            data.forEach(photo => {
              const img = new Image();
              img.src = photo.thumbnail;
            });
          }
        })
        .catch(err => {
          console.log("Erro no pré-carregamento (não crítico):", err);
        });
    }
  }
}

// Função para limpar imagens antigas do cache local
function cleanupImageCache() {
  // Limpar photoRegistry se ficar muito grande
  const maxCacheSize = 500;
  const photoRegistryKeys = Object.keys(photoRegistry);
  
  if (photoRegistryKeys.length > maxCacheSize) {
    console.log(`Limpando cache de imagens (${photoRegistryKeys.length} items)`);
    // Manter apenas imagens em categorias atualmente visíveis
    const visibleCategories = categories
      .filter(cat => !cat.isAll)
      .map(cat => cat.id)
      .filter(id => document.getElementById(`category-section-${id}`)?.offsetParent !== null);
    
    // Criar novo objeto com apenas as imagens necessárias
    const newRegistry = {};
    for (const photoId of photoRegistryKeys) {
      const photo = photoRegistry[photoId];
      // Manter fotos do carrinho e das categorias visíveis
      if (cartIds.includes(photoId) || 
          (photo.folderId && visibleCategories.includes(photo.folderId))) {
        newRegistry[photoId] = photo;
      }
    }
    
    photoRegistry = newRegistry;
    console.log(`Cache reduzido para ${Object.keys(photoRegistry).length} items`);
  }
}

// Chamar periodicamente (a cada 5 minutos)
setInterval(cleanupImageCache, 5 * 60 * 1000);