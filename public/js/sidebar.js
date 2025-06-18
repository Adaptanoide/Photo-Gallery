// Variáveis globais para o menu de categorias
let activeCategory = null;
let categoriesLoaded = {};
let isLoadingMorePhotos = false;
let isLoadingCategory = false;
let categoryPhotoCache = {};

// ✅ FUNÇÃO QUE FALTAVA (SIMPLES)
function getCategoryCache(categoryId) {
  return categoryPhotoCache[categoryId] || null;
}

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

      // 🆕 INICIALIZAR FILTROS
      if (window.categoryFilters && specificCategories.length > 0) {
        console.log('✅ Inicializando sistema de filtros');
        window.categoryFilters.initialize(specificCategories);
      }

      // Marcar a primeira categoria como ativa se existir
      if (specificCategories.length > 0) {
        activeCategory = specificCategories[0].id;
      }

      specificCategories.forEach((category, index) => {
        const isActive = index === 0 ? 'active' : ''; // Primeira categoria ativa

        menuContainer.innerHTML += `
          <div class="category-item ${isActive}" data-category-id="${category.id}">
          ${category.name}
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
  // ✅ LIMPAR scroll do More Photos ao trocar categoria
  cleanupScrollMorePhotos();

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

// ✅ ENCONTRAR função renderPhotosForCategory e SUBSTITUIR por esta versão LIMPA:
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

  // ✅ LAYOUT ORIGINAL: Container das fotos (sem flex problemático)
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
    padding: 0 0 100px 0 !important;
    grid-auto-flow: row !important;
  `;

  // Aplicar estilos no container pai também
  contentDiv.style.cssText = `
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    display: block !important;
    padding-bottom: 1px !important;
  `;

  contentDiv.appendChild(sectionContainer);

  // Renderizar as fotos usando a função existente
  renderCategoryPhotos(sectionContainer, categoryPhotos);

  // ✅ BOTÕES: Usar nova classe CSS (será criada no CSS)
  addCategoryNavigationButtons(contentDiv, categoryId);

  // DEPOIS verificar se há mais fotos para carregar
  const categoryCache = categoryPhotoCache[categoryId];
  console.log('🔍 Cache da categoria:', categoryCache);

  // ✅ CONDIÇÃO MELHORADA: Criar botão sempre que há cache suficiente
  if (categoryCache && (categoryCache.hasMore || categoryCache.totalLoaded >= 15)) {
    fetch(`/api/photos?category_id=${categoryId}&customer_code=${currentCustomerCode}&limit=1&offset=1000`)
      .then(response => response.json())
      .then(data => {
        const categoryItem = document.querySelector(`.category-item[data-category-id="${categoryId}"]`);
        let totalPhotos = 50;

        if (categoryItem) {
          const text = categoryItem.textContent;
          const match = text.match(/\((\d+)\)/);
          if (match) {
            totalPhotos = parseInt(match[1]);
          }
        }

        const remainingPhotos = totalPhotos - categoryCache.totalLoaded;
        const nextBatchSize = Math.min(15, remainingPhotos);

        /* 
        COMENTADO - Criação do botão More Photos removida para infinite scroll
        ✅ SEMPRE CRIAR O BOTÃO se há fotos carregadas
        if (remainingPhotos > 0 || categoryCache.totalLoaded >= 15) {
          console.log('✅ Criando botão More Photos...');
          
          const loadMoreBtn = document.createElement('div');
          loadMoreBtn.className = 'load-more-btn modern';
          
          ✅ BOTÃO SEMPRE VISÍVEL (como funcionava antes)
          loadMoreBtn.style.opacity = '1';
          loadMoreBtn.style.visibility = 'visible';
          loadMoreBtn.style.transform = 'translateY(0)';
          
          if (remainingPhotos > 0) {
            loadMoreBtn.innerHTML = `
              <button class="btn-load-more" onclick="loadMorePhotosWithEffects('${categoryId}', ${categoryCache.totalLoaded}, ${nextBatchSize})">
                More Photos
              </button>
            `;
          } else {
            // Fallback: criar botão mesmo sem saber quantas fotos restam
            loadMoreBtn.innerHTML = `
              <button class="btn-load-more" onclick="loadMorePhotosWithEffects('${categoryId}', ${categoryCache.totalLoaded}, 15)">
                More Photos
              </button>
            `;
          }
          
          console.log('✅ Botão More Photos criado com classes:', loadMoreBtn.className);
          
          ✅ INSERIR: More Photos ANTES dos botões de navegação
          const navigationSection = contentDiv.querySelector('.category-navigation-section');
          if (navigationSection) {
            contentDiv.insertBefore(loadMoreBtn, navigationSection);
            console.log('✅ Botão inserido antes da navegação');
          } else {
            contentDiv.appendChild(loadMoreBtn);
            console.log('✅ Botão adicionado no final');
          }

          ✅ VERIFICAR se foi inserido corretamente e inicializar scroll
          setTimeout(() => {
            const insertedBtn = document.querySelector('.load-more-btn.modern');
            console.log('🔍 Botão no DOM após inserção:', insertedBtn);
            
            if (insertedBtn) {
              console.log('✅ Botão encontrado, inicializando scroll...');
              setTimeout(() => {
                initScrollMorePhotos();
              }, 500);
            } else {
              console.error('❌ Botão não foi inserido no DOM!');
            }
          }, 100);
        }
        */

        // ✅ NOVA LÓGICA: Inicializar infinite scroll sem botão
        setTimeout(() => {
          initScrollMorePhotos();
        }, 500);
      })
      .catch(error => {
        console.log('Could not determine total photos');

        /* 
        COMENTADO - Fallback do botão More Photos removido para infinite scroll
        ✅ CRIAR BOTÃO MESMO COM ERRO (fallback)
        if (categoryCache.totalLoaded >= 15) {
          console.log('✅ Criando botão More Photos (fallback)...');
          
          const loadMoreBtn = document.createElement('div');
          loadMoreBtn.className = 'load-more-btn modern';
          loadMoreBtn.style.opacity = '1';
          loadMoreBtn.style.visibility = 'visible';
          loadMoreBtn.style.transform = 'translateY(0)';
          
          loadMoreBtn.innerHTML = `
            <button class="btn-load-more" onclick="loadMorePhotosWithEffects('${categoryId}', ${categoryCache.totalLoaded}, 15)">
              More Photos
            </button>
          `;
          
          contentDiv.appendChild(loadMoreBtn);
          
          setTimeout(() => {
            initScrollMorePhotos();
          }, 500);
        }
        */

        // ✅ MANTER: Inicializar infinite scroll mesmo com erro
        setTimeout(() => {
          initScrollMorePhotos();
        }, 500);
      });
  }

  // Forçar atualização do layout
  setTimeout(() => {
    const computedStyle = window.getComputedStyle(sectionContainer);
    console.log('Grid aplicado:', computedStyle.display, computedStyle.gridTemplateColumns);
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
  categoriesMenu.addEventListener('scroll', function () {
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
document.addEventListener('DOMContentLoaded', function () {
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
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      this.value = '';
      this.dispatchEvent(new Event('input'));
    }
  });

  // Adicionar indicador de resultados
  searchInput.addEventListener('input', function () {
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

// ✅ NOVA FUNÇÃO: Carregar mais fotos para uma categoria específica
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
        button.parentElement.remove();
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
        const nextBatchSize = Math.min(15, remainingPhotos);

        if (remainingPhotos > 0) {
          button.textContent = `More Photos`;
          button.disabled = false;
          button.onclick = () => loadMorePhotosForCategory(categoryId, categoryCache.totalLoaded, nextBatchSize);

          // ✅ MUDANÇA: Usar área fixa para botões
          const footerArea = document.getElementById('category-footer-area');
          if (footerArea) {
            addCategoryNavigationButtons(footerArea, categoryId);
          }
        } else {
          button.parentElement.remove();

          // ✅ MUDANÇA: Usar área fixa para botões
          const footerArea = document.getElementById('category-footer-area');
          if (footerArea) {
            addCategoryNavigationButtons(footerArea, categoryId);
          }
        }
      } else {
        button.parentElement.remove();

        // ✅ MUDANÇA: Usar área fixa para botões
        const footerArea = document.getElementById('category-footer-area');
        if (footerArea) {
          addCategoryNavigationButtons(footerArea, categoryId);
        }
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

// Funções de navegação entre categorias
function getNextCategoryFromId(currentCategoryId) {
  if (!window.categories) return null;
  const specificCategories = window.categories.filter(cat => !cat.isAll);
  const currentIndex = specificCategories.findIndex(cat => cat.id === currentCategoryId);
  if (currentIndex >= 0 && currentIndex < specificCategories.length - 1) {
    return specificCategories[currentIndex + 1];
  }
  return null;
}

function getPreviousCategoryFromId(currentCategoryId) {
  if (!window.categories) return null;
  const specificCategories = window.categories.filter(cat => !cat.isAll);
  const currentIndex = specificCategories.findIndex(cat => cat.id === currentCategoryId);
  if (currentIndex > 0) {
    return specificCategories[currentIndex - 1];
  }
  return null;
}

function navigateToNextCategoryMain(currentCategoryId) {
  const nextCategory = getNextCategoryFromId(currentCategoryId);
  if (nextCategory) {
    const categoryElement = document.querySelector(`[data-category-id="${nextCategory.id}"]`);
    if (categoryElement) {
      categoryElement.click();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } else {
    showToast('This is the last category!', 'info');
  }
}

function navigateToPreviousCategoryMain(currentCategoryId) {
  const prevCategory = getPreviousCategoryFromId(currentCategoryId);
  if (prevCategory) {
    const categoryElement = document.querySelector(`[data-category-id="${prevCategory.id}"]`);
    if (categoryElement) {
      categoryElement.click();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } else {
    showToast('This is the first category!', 'info');
  }
}

// Função para adicionar/atualizar botões de navegação
function addCategoryNavigationButtons(container, categoryId) {
  // Remover botões existentes se houver
  const existingNav = container.querySelector('.category-navigation-section');
  if (existingNav) {
    existingNav.remove();
  }

  // Criar novos botões com classes CSS organizadas
  const navigationContainer = document.createElement('div');
  navigationContainer.className = 'category-navigation-section';
  navigationContainer.innerHTML = `
    <div class="category-navigation-buttons">
    <button class="category-nav-button category-nav-button--secondary" onclick="navigateToPreviousCategoryMain('${categoryId}')">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Previous Category
    </button>
    <button class="category-nav-button category-nav-button--primary" onclick="navigateToNextCategoryMain('${categoryId}')">
      Next Category
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    </div>
  `;

  container.appendChild(navigationContainer);
}

// ==================== SISTEMA DE EFEITOS VISUAIS ====================

// Variáveis globais para controle de loading
let isSequentialLoading = false;
let loadingCounter = 0;

// Função 1: Criar skeleton loading
function createSkeletonPlaceholders(container, count) {
  console.log(`🎬 Creating ${count} skeleton placeholders`);

  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'photo-skeleton';
    skeleton.dataset.skeletonIndex = i;
    container.appendChild(skeleton);
  }
}

function showLoadingCounter(current, total) {
  // DESABILITADO: Contador visual removido (mantém funcionalidade)
  return;
}

// Função 3: Esconder skeleton e mostrar foto
function replaceSkeletonWithPhoto(photo, container, index, delay = 0) {
  setTimeout(() => {
    const skeleton = container.querySelector(`[data-skeleton-index="${index}"]`);
    if (!skeleton) return;

    // Verificar se já está no carrinho
    const alreadyAdded = cartIds.includes(photo.id);
    const priceText = photo.price ? `$${photo.price}` : '';

    // Criar elemento da foto
    const photoElement = document.createElement('div');
    photoElement.className = 'photo-item loading-state';
    photoElement.id = `photo-${photo.id}`;
    photoElement.onclick = () => openLightboxById(photo.id, false);

    photoElement.innerHTML = `
      <img src="${photo.thumbnail || `/api/photos/local/thumbnail/${photo.id}`}" 
           alt="${photo.name}" 
           onload="this.parentNode.classList.add('loaded-state'); this.parentNode.classList.remove('loading-state')"
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
    `;

    // Substituir skeleton por foto
    skeleton.replaceWith(photoElement);

    // Animar entrada
    setTimeout(() => {
      photoElement.classList.add('loaded-state');
      photoElement.classList.remove('loading-state');
    }, 100);

    // Atualizar contador
    loadingCounter++;
    showLoadingCounter(loadingCounter, container.querySelectorAll('.photo-skeleton').length + loadingCounter);

  }, delay);
}

// Função 4: Carregar fotos sequencialmente
function loadPhotosSequentially(photos, container, startDelay = 150) {
  if (!photos || photos.length === 0) return;

  console.log(`🎬 Loading ${photos.length} photos sequentially`);

  isSequentialLoading = true;
  loadingCounter = 0;

  // Criar skeletons primeiro
  createSkeletonPlaceholders(container, photos.length);

  // Carregar fotos uma por vez
  photos.forEach((photo, index) => {
    const delay = index * startDelay;
    replaceSkeletonWithPhoto(photo, container, index, delay);
  });

  // Finalizar loading após todas as fotos
  setTimeout(() => {
    isSequentialLoading = false;
    // Atualizar botões do carrinho
    updateButtonsForCartItems();
  }, photos.length * startDelay + 500);
}

function enhanceMorePhotosButton(button, isLoading = false) {
  // ✅ VERIFICAR se botão existe (para infinite scroll)
  if (!button) {
    console.log('⚠️ enhanceMorePhotosButton: botão não fornecido (infinite scroll)');
    return;
  }

  if (isLoading) {
    button.innerHTML = '🔄 Loading Photos...';
    button.disabled = true;
    button.classList.add('loading-shimmer');
  } else {
    button.innerHTML = 'More Photos';
    button.disabled = false;
    button.classList.remove('loading-shimmer');
  }
}

// ✅ FUNÇÃO: Mostrar loading discreto no final da página
function showDiscreteLoadingIndicator() {
  // Remover indicador anterior se existir
  hideDiscreteLoadingIndicator();

  const contentDiv = document.getElementById('content');
  if (!contentDiv) return;

  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'discrete-loading-indicator';
  loadingDiv.innerHTML = `
    <div style="
      text-align: center;
      padding: 20px;
      color: #5D3C26;
      font-family: 'Nunito', sans-serif;
      font-size: 14px;
    ">
      <div style="
        width: 20px;
        height: 20px;
        border: 2px solid #F2ECCF;
        border-top: 2px solid #CAA545;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 10px auto;
      "></div>
      Loading more photos...
    </div>
  `;

  contentDiv.appendChild(loadingDiv);
  console.log('📡 Loading indicator discreto ativado');
}

// ✅ FUNÇÃO: Esconder loading discreto
function hideDiscreteLoadingIndicator() {
  const loadingDiv = document.getElementById('discrete-loading-indicator');
  if (loadingDiv) {
    loadingDiv.remove();
    console.log('📡 Loading indicator discreto removido');
  }
}

// ✅ FUNÇÃO LIMPA: Carregamento com detecção explícita de infinite scroll
function loadMorePhotosWithEffects(categoryId, currentOffset, batchSize, isInfiniteScroll = false) {
  // Determinar se é botão ou infinite scroll
  const button = isInfiniteScroll ? null : (typeof event !== 'undefined' && event ? event.target : null);
  
  // Buscar container correto
  let sectionContainer = document.getElementById('category-section-main');
  if (!sectionContainer) {
    const contentDiv = document.getElementById('content');
    sectionContainer = contentDiv.querySelector('.category-section') || contentDiv;
  }
  
  console.log(`🔄 Loading photos - Infinite scroll: ${isInfiniteScroll}`);
  
  // Feedback visual no botão (apenas se não for infinite scroll)
  if (button && !isInfiniteScroll) {
    enhanceMorePhotosButton(button, true);
  }
  
  // Fazer requisição
  return fetch(`/api/photos?category_id=${categoryId}&customer_code=${currentCustomerCode}&offset=${currentOffset}&limit=${batchSize}`)
    .then(response => response.json())
    .then(newPhotos => {
      if (!Array.isArray(newPhotos) || newPhotos.length === 0) {
        if (button && !isInfiniteScroll) {
          button.parentElement.remove();
        }
        console.log('📭 Não há mais fotos para carregar');
        
        return Promise.resolve();
      }
      
      console.log(`📸 Loaded ${newPhotos.length} more photos for category: ${categoryId}`);
      
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
      
      // Verificar container
      if (!sectionContainer) {
        console.error('❌ Container para fotos não encontrado');
        return Promise.reject('Container não encontrado');
      }
      
      // Carregar fotos
      loadPhotosSequentially(newPhotos, sectionContainer, 100);
      
      // Restaurar botão se não for infinite scroll
      if (button && !isInfiniteScroll) {
        enhanceMorePhotosButton(button, false);
      }
      
      return Promise.resolve();
    })
    .catch(error => {
      console.error('Error loading more photos:', error);
      if (button && !isInfiniteScroll) {
        enhanceMorePhotosButton(button, false);
        button.innerHTML = '❌ Try Again';
      }
      return Promise.reject(error);
    });
}

// Função 7: Helper para obter total de fotos
function getTotalPhotos(categoryId) {
  const categoryItem = document.querySelector(`.category-item[data-category-id="${categoryId}"]`);
  if (categoryItem) {
    const text = categoryItem.textContent;
    const match = text.match(/\((\d+)\)/);
    if (match) {
      return parseInt(match[1]);
    }
  }
  return 50; // Fallback
}

// ✅ ADICIONAR NO FINAL DO sidebar.js - Controle simples de scroll

// ✅ NOVA FUNÇÃO: Inicializar scroll no container correto
function initScrollMorePhotos() {
  const contentElement = document.getElementById('content');
  if (!contentElement) {
    console.log('❌ Container #content não encontrado para scroll');
    return;
  }

  // Remover listener anterior se existir
  contentElement.removeEventListener('scroll', handleScrollMorePhotos);

  // Adicionar novo listener NO CONTAINER
  contentElement.addEventListener('scroll', handleScrollMorePhotos);
  console.log('✅ Scroll listener adicionado ao container #content');
}

// ✅ NOVA FUNÇÃO: Infinite scroll no container correto
function handleScrollMorePhotos() {
  // Verificar se há uma categoria ativa e se não está carregando
  if (!activeCategory || isLoadingMorePhotos) {
    return;
  }

  //console.log('🔄 Verificando scroll para infinite loading...');

  // ✅ DETECTAR SCROLL DO CONTAINER CORRETO (#content)
  const contentElement = document.getElementById('content');
  if (!contentElement) {
    console.log('❌ Container #content não encontrado');
    return;
  }

  // Calcular posição do scroll DO CONTAINER
  const scrollTop = contentElement.scrollTop;
  const containerHeight = contentElement.clientHeight;
  const scrollHeight = contentElement.scrollHeight;

  // Calcular distância do final DO CONTAINER
  const distanceFromBottom = scrollHeight - (scrollTop + containerHeight);
  const triggerDistance = 300; // Carregar quando está a 300px do final

  //console.log(`📏 Container scroll - Top: ${scrollTop}, Height: ${containerHeight}, ScrollHeight: ${scrollHeight}`);
  //console.log(`📏 Distância do final: ${distanceFromBottom}px`);

  // Carregar automaticamente quando próximo do final
  if (distanceFromBottom <= triggerDistance) {
    console.log('🚀 TRIGGER: Carregando mais fotos automaticamente...');

    // Verificar se há mais fotos para carregar
    const categoryCache = getCategoryCache(activeCategory);
    if (categoryCache && categoryCache.hasMore !== false) {
      console.log(`📸 Carregando mais fotos da categoria: ${activeCategory}`);
      // ✅ IMPLEMENTAÇÃO INLINE: Evitar dependência de função externa
      (function (categoryId) {
        // Evitar múltiplos carregamentos simultâneos
        if (isLoadingMorePhotos) {
          console.log('⏳ Já está carregando fotos, aguardando...');
          return;
        }

        // Marcar como carregando
        isLoadingMorePhotos = true;
        console.log(`🔄 Iniciando carregamento automático para categoria: ${categoryId}`);

        // Obter cache da categoria
        const categoryCache = getCategoryCache(categoryId);
        if (!categoryCache) {
          console.log('❌ Cache da categoria não encontrado');
          isLoadingMorePhotos = false;
          return;
        }

        // Calcular próximo batch
        const currentOffset = categoryCache.totalLoaded || 0;
        const batchSize = 15;

        console.log(`📊 Carregando batch: offset=${currentOffset}, size=${batchSize}`);

        // Usar a função existente de carregamento com efeitos
        // ✅ FORÇAR infinite scroll mode
        window.tempEvent = undefined; // Limpar event global
        loadMorePhotosWithEffects(categoryId, currentOffset, batchSize, true)
          .then(() => {
            console.log('✅ Carregamento automático concluído');
            isLoadingMorePhotos = false;
          })
          .catch((error) => {
            console.error('❌ Erro no carregamento automático:', error);
            isLoadingMorePhotos = false;
          });
      })(activeCategory);
    } else {
      console.log('📭 Não há mais fotos para carregar nesta categoria');
    }
  }
}

// ✅ FUNÇÃO: Cleanup quando muda categoria
function cleanupScrollMorePhotos() {
  window.removeEventListener('scroll', handleScrollMorePhotos);

  const morePhotosBtn = document.querySelector('.load-more-btn.modern');
  if (morePhotosBtn) {
    morePhotosBtn.classList.remove('show');
  }
}