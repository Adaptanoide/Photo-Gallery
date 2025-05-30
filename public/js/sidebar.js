// Variáveis globais para o menu de categorias
let activeCategory = null;
let categoriesLoaded = {};
let isLoadingCategory = false;
let categoryPhotoCache = {};


// Função de pré-carregamento de categoria
function preloadCategoryImages(categoryId) {
  // ex.: buscar thumbnails e hi-res em background
  fetch(`/api/photos?category_id=${categoryId}&customer_code=${currentCustomerCode}&limit=50`)
    .then(res => res.json())
    .then(imgs => {
      console.log(`Preloaded ${imgs.length} imgs for cat ${categoryId}`);
      // opcional: já jogar no cache global
      categoryPhotoCache[categoryId] = categoryPhotoCache[categoryId] || {};
      categoryPhotoCache[categoryId].photos = imgs;
    })
    .catch(err => console.warn('preloadCategoryImages failed', err));
}

// Carregar categorias no menu lateral - VERSÃO CORRIGIDA
function loadCategoriesMenu() {
  const menuContainer = document.getElementById('categories-menu');

  // Mostrar indicador de carregamento
  menuContainer.innerHTML = '<div class="category-loading">Loading categories...</div>';

  console.log("Carregando menu de categorias para o cliente:", currentCustomerCode);

  if (!currentCustomerCode) {
    console.error("Código de cliente não disponível ainda. Tente novamente em 2 segundos.");
    setTimeout(loadCategoriesMenu, 2000);
    return;
  }

  // Usar a mesma API que a galeria usa, em vez da API de categorias
  fetch(`/api/client/initial-data?code=${currentCustomerCode}`)
    .then(response => response.json())
    .then(data => {
      // Log para depuração
      console.log("Dados iniciais recebidos:", data);

      // Verificar se os dados são válidos
      if (!data.success || !data.categories || data.categories.length === 0) {
        menuContainer.innerHTML = '<div class="category-loading">No categories available</div>';
        return;
      }

      // Limpar o menu
      menuContainer.innerHTML = '';

      // NOVA LINHA: Tornar as categorias acessíveis globalmente para o lightbox
      window.categories = data.categories || [];
      
      // Usar as categorias dos dados iniciais
      categories = data.categories || [];

      console.log(`Total de categorias encontradas: ${categories.length}`);

      // Inicializar sem categoria ativa inicialmente
      activeCategory = null;

      // Filtrar apenas categorias reais (não All Items)
      const specificCategories = categories.filter(cat => !cat.isAll);
      console.log(`Categorias específicas encontradas: ${specificCategories.length}`);

      // Marcar a primeira categoria como ativa se existir
      if (specificCategories.length > 0) {
        activeCategory = specificCategories[0].id;
      }

      specificCategories.forEach((category, index) => {
        const isActive = index === 0 ? 'active' : ''; // Primeira categoria ativa
        
        menuContainer.innerHTML += `
          <div class="category-item ${isActive}" data-category-id="${category.id}">
            ${category.name} ${category.fileCount ? `(${category.fileCount})` : ''}
          </div>
        `;
        
        console.log(`Categoria adicionada: ${category.name} (ID: ${category.id})`);
      });

      // Adicionar event listeners aos itens do menu
      setupCategoryClickHandlers();

      // NÃO carregamos mais automaticamente em background
      // O usuário deve selecionar uma categoria manualmente
      console.log(`${categories.length} categorias carregadas no sidebar`);
    })
    .catch(error => {
      console.error('Error loading categories:', error);
      menuContainer.innerHTML = '<div class="category-loading">Error loading categories</div>';
    });
}

// Adicionar event listeners para itens de categoria
function setupCategoryClickHandlers() {
  const categoryItems = document.querySelectorAll('.category-item');

  categoryItems.forEach(item => {
    item.addEventListener('click', function () {
      const categoryId = this.getAttribute('data-category-id');

      console.log(`Clicou na categoria: ${categoryId}`);

      // Carregar categoria se for diferente da ativa
      if (categoryId) {
        loadCategoryPhotos(categoryId);
      }
    });
  });
}

// Carregar fotos de uma categoria específica - VERSÃO COM PAGINAÇÃO
function loadCategoryPhotos(categoryId) {
  showLoader();

  console.log(`Iniciando carregamento da categoria: ${categoryId}`);

  // Definir categoria ativa
  activeCategory = categoryId;

  // Marcar item no menu como ativo
  highlightActiveCategory(categoryId);

  // Atualizar cabeçalho da categoria atual
  updateCurrentCategoryHeader(categoryId);

  // Limpar conteúdo atual e mostrar feedback melhorado
  const contentDiv = document.getElementById('content');
  contentDiv.innerHTML = `
    <div class="loading-category" style="text-align: center; padding: 60px 40px; background: white; border-radius: 10px; margin-top: 30px; box-shadow: var(--shadow-soft);">
      <div class="loading-spinner" style="width: 40px; height: 40px; border: 3px solid rgba(212, 175, 55, 0.3); border-radius: 50%; border-top-color: var(--color-gold); animation: spin 1s ease infinite; margin: 0 auto 20px;"></div>
      <h3 style="color: var(--color-dark); margin-bottom: 10px; font-family: 'Playfair Display', serif;">Loading Category</h3>
      <p style="color: var(--color-taupe);">Please wait while we load the products...</p>
    </div>
  `;

  // Verificar se já temos os dados desta categoria em cache
  if (categoryPhotoCache[categoryId]) {
    console.log(`Using cached photos for category: ${categoryId}`);
    // CORREÇÃO: Extrair apenas o array de fotos do cache
    const cachedData = categoryPhotoCache[categoryId];
    const photosArray = cachedData.photos || cachedData;
    
    // CORREÇÃO CRÍTICA: Atualizar array global e registro de fotos
    photos = [...photosArray]; // Atualizar array global
    photosArray.forEach(photo => {
      photoRegistry[photo.id] = photo; // Atualizar registro
    });
    
    renderPhotosForCategory(photosArray, categoryId);
    hideLoader();
    preloadCategoryImages(categoryId);
    return;
  }

  // CORREÇÃO: Carregar fotos com limite inicial
  const INITIAL_LOAD_LIMIT = 20; // Carregar apenas 20 fotos inicialmente
  
  fetch(`/api/photos?category_id=${categoryId || ''}&customer_code=${currentCustomerCode}&limit=${INITIAL_LOAD_LIMIT}&offset=0`)
    .then(response => response.json())
    .then(photos => {
      // Armazenar APENAS as fotos carregadas no cache (não todas)
      categoryPhotoCache[categoryId] = {
        photos: photos || [],
        totalLoaded: photos.length || 0,
        hasMore: (photos.length || 0) >= INITIAL_LOAD_LIMIT
      };
      
      console.log(`Loaded ${photos.length} photos for category: ${categoryId}`);

      // Atualizar o registro global e renderizar
      updatePhotoRegistryAndRender(photos || []);

      // Renderizar com informação se há mais fotos
      renderPhotosForCategory(photos || [], categoryId);
      preloadCategoryImages(categoryId);
      hideLoader();
    })
    .catch(error => {
      console.error(`Error loading photos for category ${categoryId}:`, error);
      contentDiv.innerHTML = '<div class="empty-message">Error loading category.</div>';
      hideLoader();
    });
}

// FUNÇÃO CORRIGIDA: Renderizar fotos para a categoria com paginação
function renderPhotosForCategory(categoryPhotos, categoryId) {
  const contentDiv = document.getElementById('content');
  contentDiv.innerHTML = '';
  
  if (!categoryPhotos || categoryPhotos.length === 0) {
    contentDiv.innerHTML = '<div class="empty-message">No photos in this category.</div>';
    return;
  }
  
  // RESTAURAR: Criar título da categoria
  if (activeCategory) {
    const categoryItem = document.querySelector(`.category-item[data-category-id="${activeCategory}"]`);
    if (categoryItem) {
      const categoryText = categoryItem.textContent.trim();
      const cleanCategoryName = categoryText.replace(/\s*\(\d+\)\s*$/, '');
      
      // Criar container para título e linha divisória
      const titleContainer = document.createElement('div');
      titleContainer.className = 'category-title-container';
      titleContainer.innerHTML = `
        <h2>${cleanCategoryName}</h2>
        <div class="category-divider"></div>
      `;
      contentDiv.appendChild(titleContainer);
    }
  }
  
  // Criar o container da seção com aplicação forçada de estilos
  const sectionContainer = document.createElement('div');
  sectionContainer.id = 'category-section-main';
  sectionContainer.className = 'category-section';

  // FORÇAR estilos de grid diretamente no elemento
  sectionContainer.style.cssText = `
    display: grid !important;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)) !important;
    gap: 30px !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    padding: 0 !important;
    grid-auto-flow: row !important;
  `;

  // Aplicar estilos no container pai também
  contentDiv.style.cssText = `
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    display: block !important;
  `;

  contentDiv.appendChild(sectionContainer);
  
  // Renderizar as fotos usando a função existente
  renderCategoryPhotos(sectionContainer, categoryPhotos);
  
  // NOVO: Verificar se há mais fotos para carregar
  const categoryCache = categoryPhotoCache[categoryId];
  if (categoryCache && categoryCache.hasMore) {
    // Fazer uma requisição rápida para saber quantas fotos há no total
    fetch(`/api/photos?category_id=${categoryId}&customer_code=${currentCustomerCode}&limit=1&offset=1000`)
      .then(response => response.json())
      .then(data => {
        // Se retornou dados, significa que há mais fotos do que esperávamos
        // Vamos estimar o total baseado na categoria
        const categoryItem = document.querySelector(`.category-item[data-category-id="${categoryId}"]`);
        let totalPhotos = 50; // Estimativa padrão
        
        if (categoryItem) {
          const text = categoryItem.textContent;
          const match = text.match(/\((\d+)\)/);
          if (match) {
            totalPhotos = parseInt(match[1]);
          }
        }
        
        const remainingPhotos = totalPhotos - categoryCache.totalLoaded;
        const nextBatchSize = Math.min(30, remainingPhotos); // Carregar máximo 30 por vez
        
        // Criar botão "More +XX photos"
        if (remainingPhotos > 0) {
          const loadMoreBtn = document.createElement('div');
          loadMoreBtn.className = 'load-more-btn modern';
          loadMoreBtn.style.gridColumn = '1 / -1';
          loadMoreBtn.innerHTML = `
            <button class="btn-load-more" onclick="loadMorePhotosForCategory('${categoryId}', ${categoryCache.totalLoaded}, ${nextBatchSize})">
              More +${nextBatchSize} photos
            </button>
          `;
          sectionContainer.appendChild(loadMoreBtn);
        }
      })
      .catch(error => {
        console.log('Could not determine total photos, using default button');
        // Fallback: botão padrão
        const loadMoreBtn = document.createElement('div');
        loadMoreBtn.className = 'load-more-btn modern';
        loadMoreBtn.style.gridColumn = '1 / -1';
        loadMoreBtn.innerHTML = `
          <button class="btn-load-more" onclick="loadMorePhotosForCategory('${categoryId}', ${categoryCache.totalLoaded}, 30)">
            More +30 photos
          </button>
        `;
        sectionContainer.appendChild(loadMoreBtn);
      });
  }
  
  // Forçar atualização do layout
  setTimeout(() => {
    // Verificar se o grid foi aplicado corretamente
    const computedStyle = window.getComputedStyle(sectionContainer);
    console.log('Grid aplicado:', computedStyle.display, computedStyle.gridTemplateColumns);
    
    // Atualizar botões do carrinho
    updateButtonsForCartItems();
  }, 100);
}

// ADIÇÃO: Função auxiliar para obter o nome da categoria atual
function getCurrentCategoryName() {
  if (!activeCategory) return 'All Items';
  
  const activeItem = document.querySelector('.category-item.active');
  if (activeItem) {
    const text = activeItem.textContent.trim();
    // Remover contadores entre parênteses
    return text.replace(/\s*\(\d+\)\s*$/, '');
  }
  
  // Fallback
  const category = categories.find(cat => cat.id === activeCategory);
  return category ? category.name : 'All Items';
}

// Atualizar registro de fotos e renderizar - VERSÃO CORRIGIDA
function updatePhotoRegistryAndRender(newPhotos) {
  if (!Array.isArray(newPhotos)) return;

  // Registrar novas fotos no photoRegistry
  newPhotos.forEach(photo => {
    photoRegistry[photo.id] = photo;
  });

  // MODIFICAÇÃO: Não concatenar, mas substituir o array de fotos
  // para evitar misturar fotos de categorias diferentes
  photos = [...newPhotos];

  console.log(`Updated photo registry with ${newPhotos.length} photos from current category`);

  // Renderizar
  renderPhotosForCategory(newPhotos);
}

// Destacar categoria ativa no menu
function highlightActiveCategory(categoryId) {
  // Remover destaque de todos os itens
  const categoryItems = document.querySelectorAll('.category-item');
  categoryItems.forEach(item => {
    item.classList.remove('active');
  });

  // Adicionar destaque ao item selecionado
  const selectedItem = document.querySelector(`.category-item[data-category-id="${categoryId}"]`);
  if (selectedItem) {
    selectedItem.classList.add('active');
  }
}

// Atualizar cabeçalho da categoria atual - FUNÇÃO MODIFICADA
function updateCurrentCategoryHeader(categoryId) {
  // MUDANÇA: Não mostrar header separado, deixar apenas o título da galeria
  const headerDiv = document.getElementById('current-category-header');
  
  if (headerDiv) {
    headerDiv.style.display = 'none'; // Esconder completamente
  }
  
  // ADIÇÃO: Atualizar o título principal da galeria
  const mainCategoryTitle = document.querySelector('.category-title-container h2');
  if (mainCategoryTitle) {
    // Se for All Items ou nenhuma categoria específica
    if (!categoryId || categoryId === document.querySelector('.category-item[data-category-id] .active')?.getAttribute('data-category-id')) {
      const categoryItem = document.querySelector(`.category-item[data-category-id="${categoryId}"]`);
      if (categoryItem) {
        const categoryText = categoryItem.textContent.trim();
        // Remover contadores entre parênteses para um visual mais limpo
        const cleanCategoryName = categoryText.replace(/\s*\(\d+\)\s*$/, '');
        mainCategoryTitle.textContent = cleanCategoryName;
      } else {
        mainCategoryTitle.textContent = 'All Items';
      }
    }
  }
}

// Função para pesquisar categorias
function setupCategorySearch() {
  const searchInput = document.getElementById('category-search-input');

  if (!searchInput) return;

  searchInput.addEventListener('input', function () {
    const searchTerm = this.value.toLowerCase();
    const categoryItems = document.querySelectorAll('.category-item');

    categoryItems.forEach(item => {
      const categoryName = item.textContent.trim().toLowerCase();

      if (categoryName.includes(searchTerm)) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }
    });
  });
}

// Inicializar quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', function () {
  // Configurar pesquisa de categorias
  setupCategorySearch();
});

// Função para diagnosticar problemas com a API de categorias
function debugCategoriesAPI() {
  console.log("Iniciando diagnóstico de categorias...");

  // Verificar o código do cliente atual
  console.log("Código de cliente atual:", currentCustomerCode);

  // Testar a API diretamente
  fetch(`/api/photos/categories?customer_code=${currentCustomerCode}`)
    .then(response => {
      console.log("Status da resposta:", response.status);
      return response.json();
    })
    .then(data => {
      console.log("Dados completos recebidos da API:", data);

      if (Array.isArray(data)) {
        console.log(`Total de categorias: ${data.length}`);

        // Listar todas as categorias
        data.forEach((cat, index) => {
          console.log(`Categoria ${index + 1}: ${cat.name}, ID: ${cat.id}, isAll: ${cat.isAll}, fileCount: ${cat.fileCount || 'N/A'}`);
        });
      } else {
        console.log("A resposta da API não é um array:", data);
      }
    })
    .catch(error => {
      console.error("Erro ao chamar a API:", error);
    });
}

// Chamar essa função após carregar o menu para diagnosticar
// Você pode remover após resolver o problema
setTimeout(debugCategoriesAPI, 2000);

// Verificar se os elementos estão sendo realmente adicionados ao DOM
function inspectCategoryDom() {
  console.log("Inspecionando DOM de categorias...");

  const categoriesMenu = document.getElementById('categories-menu');
  if (!categoriesMenu) {
    console.log("Elemento #categories-menu não encontrado!");
    return;
  }

  console.log("Conteúdo HTML do menu:", categoriesMenu.innerHTML);

  const categoryItems = categoriesMenu.querySelectorAll('.category-item');
  console.log(`Número de itens de categoria no DOM: ${categoryItems.length}`);

  categoryItems.forEach((item, i) => {
    console.log(`Item ${i + 1}: ID=${item.getAttribute('data-category-id')}, Texto=${item.textContent.trim()}, Display=${window.getComputedStyle(item).display}`);
  });
}

// Chamar após um tempo para garantir que o DOM foi atualizado
setTimeout(inspectCategoryDom, 3000);

// Nova função para carregar todas as fotos diretamente das categorias
function loadAllPhotosFromAPI() {
  showLoader();

  // Botão de carregamento
  const loadMoreBtn = document.querySelector('.load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.innerHTML = `
      <div class="loading-indicator">
        <svg class="circular" viewBox="25 25 50 50">
          <circle class="path" cx="50" cy="50" r="20" fill="none" stroke-width="4" stroke-miterlimit="10"/>
        </svg>
        <p>Carregando todas as fotos do catálogo...</p>
      </div>
    `;
  }

  // Encontrar todas as categorias carregadas (exceto All Items)
  const allCategories = categories.filter(cat => !cat.isAll && cat.fileCount > 0);
  console.log(`Iniciando carregamento de todas as ${allCategories.length} categorias`);

  // Objeto para armazenar fotos por categoria
  const photosByCategory = {};
  let categoriesLoaded = 0;

  // Função para processar uma categoria por vez (para evitar sobrecarga)
  function processNextCategory(index) {
    if (index >= allCategories.length) {
      // Todas as categorias foram processadas
      finishLoading();
      return;
    }

    const category = allCategories[index];

    // Verificar se já temos essa categoria em cache
    if (window.categoriesLoaded && window.categoriesLoaded[category.id]) {
      const photos = window.categoriesLoaded[category.id];
      console.log(`Usando ${photos.length} fotos em cache da categoria ${category.name}`);

      // Armazenar fotos por categoria
      if (!photosByCategory[category.id]) {
        photosByCategory[category.id] = {
          name: category.name,
          photos: [...photos]
        };
      }

      categoriesLoaded++;

      // Atualizar mensagem de carregamento
      if (loadMoreBtn) {
        loadMoreBtn.innerHTML = `
          <div class="loading-indicator">
            <svg class="circular" viewBox="25 25 50 50">
              <circle class="path" cx="50" cy="50" r="20" fill="none" stroke-width="4" stroke-miterlimit="10"/>
            </svg>
            <p>Carregando catálogo... (${categoriesLoaded}/${allCategories.length})</p>
          </div>
        `;
      }

      // Processar a próxima categoria
      setTimeout(() => processNextCategory(index + 1), 50);
      return;
    }

    // Buscar os dados da categoria
    console.log(`Buscando fotos da categoria ${category.name} (ID: ${category.id})`);

    fetch(`/api/photos?category_id=${category.id}&customer_code=${currentCustomerCode}&limit=100`)
      .then(response => response.json())
      .then(photos => {
        if (Array.isArray(photos) && photos.length > 0) {
          console.log(`Recebidas ${photos.length} fotos da categoria ${category.name}`);

          // Armazenar fotos por categoria
          if (!photosByCategory[category.id]) {
            photosByCategory[category.id] = {
              name: category.name,
              photos: [...photos]
            };
          }

          // Armazenar em cache
          if (!window.categoriesLoaded) window.categoriesLoaded = {};
          window.categoriesLoaded[category.id] = photos;
        }

        categoriesLoaded++;

        // Atualizar mensagem de carregamento
        if (loadMoreBtn) {
          loadMoreBtn.innerHTML = `
            <div class="loading-indicator">
              <svg class="circular" viewBox="25 25 50 50">
                <circle class="path" cx="50" cy="50" r="20" fill="none" stroke-width="4" stroke-miterlimit="10"/>
              </svg>
              <p>Carregando catálogo... (${categoriesLoaded}/${allCategories.length})</p>
            </div>
          `;
        }

        // Processar a próxima categoria
        setTimeout(() => processNextCategory(index + 1), 50);
      })
      .catch(error => {
        console.error(`Erro ao carregar categoria ${category.name}:`, error);
        categoriesLoaded++;

        // Continuar mesmo com erro
        setTimeout(() => processNextCategory(index + 1), 50);
      });
  }

  // Função para finalizar o carregamento
  function finishLoading() {
    console.log(`Carregamento completo! Fotos carregadas de ${Object.keys(photosByCategory).length} categorias`);

    // Obter o total de fotos
    let totalPhotos = 0;
    Object.values(photosByCategory).forEach(category => {
      totalPhotos += category.photos.length;
    });

    console.log(`Total de ${totalPhotos} fotos carregadas`);

    // Armazenar todas as fotos no registry
    const allPhotos = [];
    Object.values(photosByCategory).forEach(category => {
      category.photos.forEach(photo => {
        photoRegistry[photo.id] = photo;
        allPhotos.push(photo);
      });
    });

    // Armazenar em cache
    const allItemsCategory = categories.find(cat => cat.isAll);
    const allItemsId = allItemsCategory ? allItemsCategory.id : null;

    if (allItemsId) {
      categoriesLoaded[allItemsId] = allPhotos;
    }

    // Atualizar o array global
    window.photos = allPhotos;

    // Renderizar as fotos organizadas por categoria
    renderPhotosByCategory(photosByCategory);

    // Atualizar o botão para mostrar que terminou
    if (loadMoreBtn) {
      const loadMoreContainer = loadMoreBtn.closest('.load-more-btn');
      if (loadMoreContainer) {
        loadMoreContainer.remove(); // Remover o botão de carregar mais
      }
    }

    hideLoader();
  }

  // Iniciar o processo
  processNextCategory(0);
}

// Função para renderizar fotos agrupadas por categoria - VERSÃO CORRIGIDA
function renderPhotosByCategory(photosByCategory) {
  const contentDiv = document.getElementById('content');
  contentDiv.innerHTML = '';

  // Se não houver fotos, mostrar mensagem
  if (Object.keys(photosByCategory).length === 0) {
    contentDiv.innerHTML = '<div class="empty-message">No photos available.</div>';
    return;
  }

  // Ordenar categorias por nome
  const sortedCategories = Object.values(photosByCategory).sort((a, b) => {
    return a.name.localeCompare(b.name);
  });

  // Adicionar título "All Items" primeiro
  const titleElement = document.createElement('h1');
  titleElement.textContent = 'All Items';
  titleElement.style.marginBottom = '20px';
  contentDiv.appendChild(titleElement);

  // Adicionar linha dourada sob o título
  const goldLine = document.createElement('div');
  goldLine.style.width = '100px';
  goldLine.style.height = '3px';
  goldLine.style.backgroundColor = '#D4AF37';
  goldLine.style.marginBottom = '40px';
  contentDiv.appendChild(goldLine);

  // Para cada categoria, adicionar título e fotos
  sortedCategories.forEach(category => {
    // Verificar se há fotos nesta categoria
    if (!Array.isArray(category.photos) || category.photos.length === 0) {
      return; // Pular categorias sem fotos
    }

    // Criar título da categoria
    const categoryTitle = document.createElement('h2');
    categoryTitle.textContent = category.name;
    categoryTitle.style.marginTop = '40px';
    categoryTitle.style.marginBottom = '20px';
    contentDiv.appendChild(categoryTitle);

    // Adicionar linha decorativa
    const categoryDivider = document.createElement('div');
    categoryDivider.className = 'category-divider';
    categoryDivider.style.width = '100%';
    categoryDivider.style.height = '1px';
    categoryDivider.style.background = 'linear-gradient(90deg, #D4AF37 0%, #D4AF37 70%, transparent 100%)';
    categoryDivider.style.marginBottom = '20px';
    contentDiv.appendChild(categoryDivider);

    // Criar container para fotos desta categoria
    const sectionContainer = document.createElement('div');
    sectionContainer.id = `category-section-${category.name.replace(/\s+/g, '-').toLowerCase()}`;
    sectionContainer.className = 'category-section';
    
    // APLICAR: Estilos de grid com força
    sectionContainer.style.cssText = `
      display: grid !important;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)) !important;
      gap: 30px !important;
      width: 100% !important;
      margin-bottom: 40px !important;
      box-sizing: border-box !important;
    `;
    
    contentDiv.appendChild(sectionContainer);

    // MODIFICADO: Renderizar fotos desta categoria com novo layout
    renderCategoryPhotosNewLayout(sectionContainer, category.photos);
  });

  // Atualizar botões do carrinho
  setTimeout(updateButtonsForCartItems, 100);
}

// NOVA FUNÇÃO: Renderizar fotos com o novo layout (sem mostrar nome do arquivo)
function renderCategoryPhotosNewLayout(container, photos) {
  if (!photos || photos.length === 0) {
    if (container) {
      container.style.display = "none";
    }
    return;
  }
  
  // Aplicar estilos de grid de forma mais agressiva
  if (container) {
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
    container.style.gap = '30px';
    container.style.width = '100%';
    container.style.maxWidth = '100%';
    container.style.boxSizing = 'border-box';
    container.classList.add('category-section');
    container.setAttribute('data-grid-applied', 'true');
  }
  
  let html = '';
  
  // Adicionar cada foto com o NOVO LAYOUT
  photos.forEach((photo, index) => {
    const alreadyAdded = cartIds.includes(photo.id);
    const delay = (index % 10) * 0.05;
    
    // Format price if available (agora será usado na parte inferior)
    let priceText = '';
    if (photo.price !== undefined) {
      const formattedPrice = `$${parseFloat(photo.price).toFixed(2)}`;
      priceText = formattedPrice;
    }

    // NOVA ESTRUTURA: Sem nome do arquivo, com preço ao lado do botão
    html += `
      <div class="photo-item" id="photo-${photo.id}" onclick="openLightboxById('${photo.id}', false)" 
          style="animation: fadeIn 0.5s ease-out ${delay}s both;">
        <img src="${photo.thumbnail}" alt="${photo.name}" loading="lazy"
            style="width: 100%; height: auto;"
            onerror="this.parentNode.remove(); checkEmptyCategory('${container.id}');">
        <div class="photo-info">
          <div class="photo-actions-container">
            <button class="btn ${alreadyAdded ? 'btn-danger' : 'btn-gold'}" 
              id="button-${photo.id}"
              onclick="event.stopPropagation(); ${alreadyAdded ? 'removeFromCart' : 'addToCart'}('${photo.id}')">
              ${alreadyAdded ? 'Remove' : 'Select'}
            </button>
            ${priceText ? `<span class="price-inline">${priceText}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  });
  
  // Aplicar o HTML
  container.innerHTML = html;
  
  // Verificação final: Forçar recálculo do layout
  setTimeout(() => {
    const computedStyle = window.getComputedStyle(container);
    console.log('Container grid check:', {
      display: computedStyle.display,
      gridTemplateColumns: computedStyle.gridTemplateColumns,
      width: computedStyle.width,
      photosCount: photos.length
    });
    
    // Se o grid não foi aplicado, tentar novamente
    if (computedStyle.display !== 'grid') {
      console.warn('Grid não aplicado, reforçando...');
      container.style.cssText += 'display: grid !important;';
    }
  }, 50);
}

// Função para melhorar o comportamento do sidebar sticky
function initializeStickysidebar() {
  const sidebar = document.querySelector('.category-sidebar');
  const categoriesMenu = document.querySelector('.categories-menu');
  
  if (!sidebar || !categoriesMenu) return;
  
  // Detectar quando o usuário está rolando dentro do menu de categorias
  let scrollTimeout;
  categoriesMenu.addEventListener('scroll', function() {
    this.classList.add('scrolling');
    
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      this.classList.remove('scrolling');
    }, 150);
  });
  
  // Ajustar altura do sidebar baseado na viewport
  function adjustSidebarHeight() {
    const viewportHeight = window.innerHeight;
    const sidebarTop = sidebar.getBoundingClientRect().top;
    const maxHeight = viewportHeight - sidebarTop - 40; // 40px de margem
    
    sidebar.style.maxHeight = `${maxHeight}px`;
    categoriesMenu.style.maxHeight = `${maxHeight - 120}px`; // Subtraindo espaço do header e search
  }
  
  // Ajustar na inicialização e quando redimensionar a janela
  adjustSidebarHeight();
  window.addEventListener('resize', adjustSidebarHeight);
  
  // Observar mudanças no DOM que possam afetar o layout
  const resizeObserver = new ResizeObserver(adjustSidebarHeight);
  resizeObserver.observe(document.body);
}

// Chamar a função quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
  // Aguardar um pouco para garantir que todos os elementos foram carregados
  setTimeout(initializeStickysidebar, 100);
  
  // Configurar pesquisa de categorias (se ainda não estiver configurado)
  setupCategorySearch();
});

// Melhorar a função de pesquisa existente
function setupCategorySearch() {
  const searchInput = document.getElementById('category-search-input');
  
  if (!searchInput) return;
  
  // Limpar pesquisa com ESC
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      this.value = '';
      this.dispatchEvent(new Event('input'));
    }
  });
  
  // Adicionar indicador de resultados
  searchInput.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    const categoryItems = document.querySelectorAll('.category-item');
    let visibleCount = 0;
    
    categoryItems.forEach(item => {
      const categoryName = item.textContent.trim().toLowerCase();
      
      if (categoryName.includes(searchTerm)) {
        item.style.display = 'block';
        visibleCount++;
      } else {
        item.style.display = 'none';
      }
    });
    
    // Mostrar feedback visual se não encontrar resultados
    const categoriesMenu = document.querySelector('.categories-menu');
    let noResultsMsg = categoriesMenu.querySelector('.no-results-message');
    
    if (visibleCount === 0 && searchTerm.length > 0) {
      if (!noResultsMsg) {
        noResultsMsg = document.createElement('div');
        noResultsMsg.className = 'no-results-message category-loading';
        noResultsMsg.textContent = 'Nenhuma categoria encontrada';
        categoriesMenu.appendChild(noResultsMsg);
      }
      noResultsMsg.style.display = 'block';
    } else if (noResultsMsg) {
      noResultsMsg.style.display = 'none';
    }
  });
}

// NOVA FUNÇÃO: Carregar mais fotos para uma categoria específica
function loadMorePhotosForCategory(categoryId, currentOffset, batchSize) {
  const button = event.target;
  const originalText = button.textContent;
  
  // Mostrar loading
  button.textContent = 'Loading...';
  button.disabled = true;
  
  fetch(`/api/photos?category_id=${categoryId}&customer_code=${currentCustomerCode}&offset=${currentOffset}&limit=${batchSize}`)
    .then(response => response.json())
    .then(newPhotos => {
      if (!Array.isArray(newPhotos) || newPhotos.length === 0) {
        // Não há mais fotos
        button.parentElement.innerHTML = `
          <div class="end-message">
            <p>✨ That's all photos in this category!</p>
          </div>
        `;
        return;
      }
      
      console.log(`Loaded ${newPhotos.length} more photos for category: ${categoryId}`);
      
      // Atualizar cache
      const categoryCache = categoryPhotoCache[categoryId];
      if (categoryCache) {
        categoryCache.photos = categoryCache.photos.concat(newPhotos);
        categoryCache.totalLoaded += newPhotos.length;
        categoryCache.hasMore = newPhotos.length >= batchSize;
      }
      
      // Registrar novas fotos
      newPhotos.forEach(photo => {
        photoRegistry[photo.id] = photo;
        photos.push(photo);
      });
      
      // Encontrar container da categoria
      const sectionContainer = document.getElementById('category-section-main');
      const loadMoreBtn = sectionContainer.querySelector('.load-more-btn');
      
      // Adicionar novas fotos antes do botão
      newPhotos.forEach((photo, index) => {
        const alreadyAdded = cartIds.includes(photo.id);
        const delay = (index % 10) * 0.05;
        
        let priceText = '';
        if (photo.price !== undefined) {
          const formattedPrice = `$${parseFloat(photo.price).toFixed(2)}`;
          priceText = formattedPrice;
        }

        const photoDiv = document.createElement('div');
        photoDiv.className = 'photo-item';
        photoDiv.id = `photo-${photo.id}`;
        photoDiv.style.animation = `fadeIn 0.5s ease-out ${delay}s both`;
        photoDiv.onclick = () => openLightboxById(photo.id, false);
        
        photoDiv.innerHTML = `
          <img src="${photo.thumbnail}" alt="${photo.name}" loading="lazy"
              style="width: 100%; height: auto;">
          <div class="photo-info">
            <div class="photo-actions-container">
              <button class="btn ${alreadyAdded ? 'btn-danger' : 'btn-gold'}" 
                id="button-${photo.id}"
                onclick="event.stopPropagation(); ${alreadyAdded ? 'removeFromCart' : 'addToCart'}('${photo.id}')">
                ${alreadyAdded ? 'Remove' : 'Select'}
              </button>
              ${priceText ? `<span class="price-inline">${priceText}</span>` : ''}
            </div>
          </div>
        `;
        
        sectionContainer.insertBefore(photoDiv, loadMoreBtn);
      });
      
      // Atualizar botão ou remover se não há mais fotos
      if (categoryCache && categoryCache.hasMore) {
        // Calcular próximo batch
        const categoryItem = document.querySelector(`.category-item[data-category-id="${categoryId}"]`);
        let totalPhotos = categoryCache.totalLoaded + 50; // Estimativa
        
        if (categoryItem) {
          const text = categoryItem.textContent;
          const match = text.match(/\((\d+)\)/);
          if (match) {
            totalPhotos = parseInt(match[1]);
          }
        }
        
        const remainingPhotos = Math.max(0, totalPhotos - categoryCache.totalLoaded);
        const nextBatchSize = Math.min(30, remainingPhotos);
        
        if (remainingPhotos > 0) {
          button.textContent = `More +${nextBatchSize} photos`;
          button.disabled = false;
          button.onclick = () => loadMorePhotosForCategory(categoryId, categoryCache.totalLoaded, nextBatchSize);
        } else {
          button.parentElement.innerHTML = `
            <div class="end-message">
              <p>✨ That's all photos in this category!</p>
            </div>
          `;
        }
      } else {
        button.parentElement.innerHTML = `
          <div class="end-message">
            <p>✨ That's all photos in this category!</p>
          </div>
        `;
      }
      
      // Atualizar botões do carrinho
      updateButtonsForCartItems();
    })
    .catch(error => {
      console.error('Error loading more photos:', error);
      button.textContent = originalText;
      button.disabled = false;
    });
}