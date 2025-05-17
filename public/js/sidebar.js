// Variáveis globais para o menu de categorias
let activeCategory = null;
let categoriesLoaded = {};
let categoriesQueue = [];
let isLoadingCategory = false;

// Carregar categorias no menu lateral
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

      // Usar as categorias dos dados iniciais
      categories = data.categories || [];

      console.log(`Total de categorias encontradas: ${categories.length}`);

      // Adicionar categoria "All Items" primeiro
      const allItemsCategory = categories.find(cat => cat.isAll);
      if (allItemsCategory) {
        menuContainer.innerHTML += `
          <div class="category-item active" data-category-id="${allItemsCategory.id}">
            All Items
          </div>
        `;

        // Definir como categoria ativa inicialmente
        activeCategory = allItemsCategory.id;
        console.log(`Categoria All Items adicionada: ${allItemsCategory.id}`);
      }

      // Adicionar as outras categorias - MODIFICADO: remover filtro de fileCount
      const specificCategories = categories.filter(cat => !cat.isAll);
      console.log(`Categorias específicas encontradas: ${specificCategories.length}`);

      specificCategories.forEach(category => {
        menuContainer.innerHTML += `
          <div class="category-item" data-category-id="${category.id}">
            ${category.name} ${category.fileCount ? `(${category.fileCount})` : ''}
          </div>
        `;

        console.log(`Categoria adicionada: ${category.name} (ID: ${category.id})`);

        // Adicionar à fila de carregamento em background
        categoriesQueue.push(category.id);
      });

      // Adicionar event listeners aos itens do menu
      setupCategoryClickHandlers();

      // Começar a carregar a primeira categoria em background
      loadNextCategoryInBackground();
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
      const categoryText = this.textContent.trim();

      console.log(`Clicou na categoria: ${categoryId}, texto: ${categoryText}`);

      // Tratamento especial para "All Items"
      if (categoryText.includes('All Items')) {
        console.log("Clicou em All Items - Carregando todos os itens");

        // Sempre force o refresh ao clicar em All Items
        loadAllItems(true);
        return;
      }

      // Para outras categorias, continuar normalmente
      if (categoryId && categoryId !== activeCategory) {
        loadCategoryPhotos(categoryId);
      }
    });
  });
}

// Carregar fotos de uma categoria específica
// Carregar fotos de uma categoria específica
function loadCategoryPhotos(categoryId) {
  showLoader();

  console.log(`Iniciando carregamento da categoria: ${categoryId}`);

  // NOVO: Verificar se estamos lidando com All Items (pelo texto ou ID undefined)
  const isAllItems = categoryId === undefined ||
    categories.find(cat => cat.id === categoryId)?.isAll === true ||
    document.querySelector(`.category-item[data-category-id="${categoryId}"]`)?.textContent.trim() === 'All Items';

  // Se for All Items mas o ID estiver indefinido, usar o ID correto
  if (isAllItems && (categoryId === undefined || categoryId === 'undefined')) {
    const allCat = categories.find(cat => cat.isAll);
    if (allCat) {
      categoryId = allCat.id;
      console.log(`Corrigindo ID para All Items: ${categoryId}`);
    }
  }

  console.log(`Carregando categoria: ${categoryId}, isAllItems: ${isAllItems}`);

  // Definir categoria ativa
  activeCategory = categoryId;

  // Marcar item no menu como ativo
  highlightActiveCategory(categoryId);

  // Atualizar cabeçalho da categoria atual
  updateCurrentCategoryHeader(categoryId);

  // Limpar conteúdo atual
  const contentDiv = document.getElementById('content');
  contentDiv.innerHTML = '<div class="empty-message">Loading category...</div>';

  // Se for "All Items", sempre buscar da API para evitar problemas de cache
  if (isAllItems) {
    console.log("Carregando categoria All Items diretamente da API");

    // Para "All Items", usamos a API de dados iniciais que traz todos os previews
    fetch(`/api/client/initial-data?code=${currentCustomerCode}`)
      .then(response => response.json())
      .then(data => {
        if (!data.success) {
          contentDiv.innerHTML = '<div class="empty-message">Error loading data.</div>';
          hideLoader();
          return;
        }

        // Obter previews de todas as categorias
        let allPhotos = [];
        for (const catId in data.previews) {
          const catPhotos = data.previews[catId] || [];
          console.log(`Adicionando ${catPhotos.length} fotos da categoria ${catId}`);
          allPhotos = allPhotos.concat(catPhotos);
        }

        console.log(`Total de ${allPhotos.length} fotos encontradas para All Items`);

        // Se não encontrou fotos, tentar fazer uma busca direta
        if (allPhotos.length === 0) {
          fetch(`/api/photos?customer_code=${currentCustomerCode}`)
            .then(response => response.json())
            .then(photos => {
              console.log(`Busca direta encontrou ${photos.length} fotos`);
              // Atualizar o cache
              categoriesLoaded[categoryId] = photos;
              // Renderizar as fotos
              renderPhotosForCategory(photos);
            })
            .catch(err => console.error("Erro na busca direta:", err));
        } else {
          // Atualizar o cache
          categoriesLoaded[categoryId] = allPhotos;
          // Renderizar as fotos
          renderPhotosForCategory(allPhotos);
        }

        hideLoader();
      })
      .catch(error => {
        console.error(`Error loading All Items:`, error);
        contentDiv.innerHTML = '<div class="empty-message">Error loading category.</div>';
        hideLoader();
      });

    return;
  }

  // Verificar se já temos os dados desta categoria em cache
  if (categoriesLoaded[categoryId]) {
    console.log(`Using cached data for category: ${categoryId}`);
    renderPhotosForCategory(categoriesLoaded[categoryId]);
    hideLoader();
    return;
  }

  // Carregar fotos da categoria
  fetch(`/api/photos?category_id=${categoryId || ''}&customer_code=${currentCustomerCode}`)
    .then(response => response.json())
    .then(photos => {
      // Armazenar em cache
      categoriesLoaded[categoryId] = photos;

      // Atualizar o registro global e renderizar
      updatePhotoRegistryAndRender(photos);

      hideLoader();
    })
    .catch(error => {
      console.error(`Error loading photos for category ${categoryId}:`, error);
      contentDiv.innerHTML = '<div class="empty-message">Error loading category.</div>';
      hideLoader();
    });
}

// Renderizar fotos para a categoria
function renderPhotosForCategory(categoryPhotos) {
  const contentDiv = document.getElementById('content');
  contentDiv.innerHTML = '';

  if (!categoryPhotos || categoryPhotos.length === 0) {
    contentDiv.innerHTML = '<div class="empty-message">No photos in this category.</div>';
    return;
  }

  // Cria o container da seção
  const sectionContainer = document.createElement('div');
  sectionContainer.id = `category-section-main`;
  sectionContainer.className = 'category-section';
  sectionContainer.style.display = 'grid';
  sectionContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
  sectionContainer.style.gap = '30px';
  sectionContainer.style.width = '100%';

  contentDiv.appendChild(sectionContainer);

  // Renderiza as fotos
  renderCategoryPhotos(sectionContainer, categoryPhotos);

  // Se temos muitas fotos, adicionar botão para carregar mais
  if (categoryPhotos.length >= 20) {
    const loadMoreBtn = document.createElement('div');
    loadMoreBtn.className = 'load-more-btn';
    loadMoreBtn.innerHTML = `
      <button class="btn btn-secondary" onclick="loadMoreForCategory('${activeCategory}', ${categoryPhotos.length})">
        Ver mais fotos
      </button>
    `;
    sectionContainer.appendChild(loadMoreBtn);
  }

  // Atualizar botões do carrinho
  setTimeout(updateButtonsForCartItems, 100);
}

// Atualizar registro de fotos e renderizar
function updatePhotoRegistryAndRender(newPhotos) {
  if (!Array.isArray(newPhotos)) return;

  // Registrar novas fotos no photoRegistry
  newPhotos.forEach(photo => {
    photoRegistry[photo.id] = photo;
  });

  // Adicionar ao array global
  photos = photos.concat(newPhotos);

  // Renderizar
  renderPhotosForCategory(newPhotos);
}

// Carregar próxima categoria em background
function loadNextCategoryInBackground() {
  // Se já estamos carregando ou não há mais categorias na fila, retornar
  if (isLoadingCategory || categoriesQueue.length === 0) {
    return;
  }

  // Marcar como carregando
  isLoadingCategory = true;

  // Pegar próxima categoria da fila
  const nextCategoryId = categoriesQueue.shift();

  console.log(`Background loading category: ${nextCategoryId}`);

  // Carregar fotos da categoria em background
  fetch(`/api/photos?category_id=${nextCategoryId}&customer_code=${currentCustomerCode}`)
    .then(response => response.json())
    .then(categoryPhotos => {
      // Armazenar em cache
      if (Array.isArray(categoryPhotos) && categoryPhotos.length > 0) {
        categoriesLoaded[nextCategoryId] = categoryPhotos;

        // Registrar fotos no índice global
        categoryPhotos.forEach(photo => {
          photoRegistry[photo.id] = photo;
        });

        console.log(`Background loaded category: ${nextCategoryId} with ${categoryPhotos.length} photos`);
      }

      // Marcar como não carregando
      isLoadingCategory = false;

      // Continuar com a próxima categoria
      loadNextCategoryInBackground();
    })
    .catch(error => {
      console.error(`Error background loading category ${nextCategoryId}:`, error);

      // Marcar como não carregando
      isLoadingCategory = false;

      // Continuar com a próxima categoria
      loadNextCategoryInBackground();
    });
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

// Atualizar cabeçalho da categoria atual
function updateCurrentCategoryHeader(categoryId) {
  const headerDiv = document.getElementById('current-category-header');

  if (!headerDiv) return;

  // Se for a categoria "All Items" ou nenhuma
  if (!categoryId) {
    headerDiv.innerHTML = '<h2>All Items</h2>';
    return;
  }

  // Encontrar nome da categoria
  const categoryItem = document.querySelector(`.category-item[data-category-id="${categoryId}"]`);

  if (categoryItem) {
    headerDiv.innerHTML = `<h2>${categoryItem.textContent.trim()}</h2>`;
  } else {
    // Se não encontrou no menu, buscar na lista global
    const category = categories.find(cat => cat.id === categoryId);
    if (category) {
      headerDiv.innerHTML = `<h2>${category.name}</h2>`;
    } else {
      headerDiv.innerHTML = '<h2>Selected Category</h2>';
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

// Função para carregar todos os itens (All Items)
function loadAllItems(forceRefresh = true) {
  showLoader();
  
  // Encontrar a categoria All Items
  const allItemsCategory = categories.find(cat => cat.isAll);
  const allItemsId = allItemsCategory ? allItemsCategory.id : null;
  
  console.log(`Carregando All Items com ID: ${allItemsId}, forceRefresh: ${forceRefresh}`);
  
  // Marcar item no menu como ativo
  highlightActiveCategory(allItemsId);
  
  // Atualizar cabeçalho
  updateCurrentCategoryHeader(allItemsId);
  activeCategory = allItemsId;
  
  // Limpar conteúdo atual
  const contentDiv = document.getElementById('content');
  contentDiv.innerHTML = '<div class="empty-message">Loading all items...</div>';
  
  // NOVA ABORDAGEM: Verificar se temos categorias previamente carregadas
  const loadedCategoryIds = Object.keys(categoriesLoaded).filter(id => id !== allItemsId);
  
  if (loadedCategoryIds.length > 0) {
    console.log(`Encontradas ${loadedCategoryIds.length} categorias previamente carregadas`);
    
    // Preparar objeto para armazenar fotos por categoria
    const photosByCategory = {};
    
    // Preencher com as categorias já carregadas
    loadedCategoryIds.forEach(catId => {
      // Encontrar o nome da categoria
      const categoryInfo = categories.find(cat => cat.id === catId);
      const categoryName = categoryInfo ? categoryInfo.name : 'Categoria ' + catId;
      
      photosByCategory[catId] = {
        name: categoryName,
        photos: categoriesLoaded[catId]
      };
    });
    
    // Renderizar as fotos organizadas por categoria
    renderPhotosByCategory(photosByCategory);
    
    // Adicionar botão para recarregar o catálogo completo
    const reloadBtn = document.createElement('div');
    reloadBtn.className = 'reload-btn';
    reloadBtn.style.textAlign = 'center';
    reloadBtn.style.marginTop = '30px';
    reloadBtn.style.marginBottom = '40px';
    reloadBtn.innerHTML = `
      <button class="btn btn-gold" onclick="loadAllPhotosFromAPI()">
        Atualizar Catálogo Completo
      </button>
    `;
    contentDiv.appendChild(reloadBtn);
    
    hideLoader();
    return;
  }
  
  // Se não temos categorias carregadas, usar a abordagem de carregamento completo
  loadAllPhotosFromAPI();
}

// Função para carregar mais fotos no All Items
function loadMoreAllItems(offset) {
  console.log(`Carregando mais itens para All Items a partir do offset ${offset}`);

  // Mostrar feedback de carregamento
  const loadMoreBtn = document.querySelector('.load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.innerHTML = `
      <div class="loading-indicator">
        <svg class="circular" viewBox="25 25 50 50">
          <circle class="path" cx="50" cy="50" r="20" fill="none" stroke-width="4" stroke-miterlimit="10"/>
        </svg>
        <p>Carregando mais fotos exquisitas...</p>
      </div>
    `;
  }

  // Parâmetro para evitar cache
  const cacheParam = `&nocache=${Date.now()}`;

  // Fazer requisição para obter mais fotos com flag para forçar retorno
  fetch(`/api/photos?customer_code=${currentCustomerCode}&offset=${offset}&limit=50${cacheParam}&force_all=true`)
    .then(response => response.json())
    .then(newPhotos => {
      if (!Array.isArray(newPhotos) || newPhotos.length === 0) {
        if (loadMoreBtn) {
          // Se não recebemos mais fotos, sugerir carregar todas
          loadMoreBtn.innerHTML = `
            <button class="btn btn-gold" onclick="loadAllPhotosFromAPI()">
              Carregar Galeria Completa
            </button>
          `;
        }
        return;
      }

      console.log(`Carregadas mais ${newPhotos.length} fotos para All Items`);

      // Registrar novas fotos
      newPhotos.forEach(photo => {
        photoRegistry[photo.id] = photo;
      });

      // Adicionar ao array global
      photos = photos.concat(newPhotos);

      // Adicionar ao cache
      const allItemsCategory = categories.find(cat => cat.isAll);
      const allItemsId = allItemsCategory ? allItemsCategory.id : null;

      if (allItemsId && categoriesLoaded[allItemsId]) {
        categoriesLoaded[allItemsId] = categoriesLoaded[allItemsId].concat(newPhotos);
      }

      // Obter o container da seção
      const sectionContainer = document.getElementById('category-section-main');
      if (!sectionContainer) return;

      // Criar container temporário
      const tempContainer = document.createElement('div');

      // Renderizar novas fotos no container temporário
      renderCategoryPhotos(tempContainer, newPhotos);

      // Obter todos os items do container temporário
      const newItems = Array.from(tempContainer.children);

      // Adicionar cada novo item antes do botão "carregar mais"
      newItems.forEach(item => {
        if (loadMoreBtn) {
          sectionContainer.insertBefore(item, loadMoreBtn);
        } else {
          sectionContainer.appendChild(item);
        }
      });

      // Atualizar botão "carregar mais"
      if (loadMoreBtn) {
        if (newPhotos.length >= 50) {
          loadMoreBtn.innerHTML = `
            <button class="btn btn-secondary" onclick="loadMoreAllItems(${offset + newPhotos.length})">
              Carregar mais fotos
            </button>
          `;
        } else {
          loadMoreBtn.innerHTML = `
            <div class="end-message">
              <p>Fim da galeria. Todas as fotos foram carregadas!</p>
            </div>
          `;
        }
      }

      // Atualizar botões do carrinho
      setTimeout(updateButtonsForCartItems, 100);
    })
    .catch(error => {
      console.error(`Erro ao carregar mais fotos para All Items:`, error);
      if (loadMoreBtn) {
        loadMoreBtn.innerHTML = `
          <button class="btn btn-danger">
            Erro ao carregar mais fotos
          </button>
          <button class="btn btn-gold" onclick="loadAllPhotosFromAPI()">
            Tentar Carregar Galeria Completa
          </button>
        `;
      }
    });
}

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

// Função para renderizar fotos agrupadas por categoria
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
    sectionContainer.style.display = 'grid';
    sectionContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
    sectionContainer.style.gap = '30px';
    sectionContainer.style.width = '100%';
    sectionContainer.style.marginBottom = '40px';
    contentDiv.appendChild(sectionContainer);

    // Renderizar fotos desta categoria
    renderCategoryPhotos(sectionContainer, category.photos);
  });

  // Atualizar botões do carrinho
  setTimeout(updateButtonsForCartItems, 100);
}