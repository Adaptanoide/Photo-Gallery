// === SISTEMA DE FILTROS DE CATEGORIA ===

// Variáveis globais dos filtros
let activeFilters = {
  country: '',
  productType: '',
  size: '',
  price: '',
  sort: ''
};

let allCategoryItems = []; // Cache dos itens originais
let categoryPriceData = {}; // Cache dos preços das categorias

// Inicializar sistema de filtros
function initCategoryFilters() {
  console.log('🔍 Inicializando sistema de filtros...');

  // Aguardar categorias carregarem
  setTimeout(() => {
    cacheAllCategoryItems();
    loadCategoryFiltersData();
    enableFilterControls();
  }, 3000);
}

// Cachear todos os itens de categoria
function cacheAllCategoryItems() {
  allCategoryItems = Array.from(document.querySelectorAll('.category-item'));
  console.log(`📦 Cached ${allCategoryItems.length} category items`);
}

// Carregar preços das categorias (usando dados já existentes)
function loadCategoryFiltersData() {
  // Tentar pegar preços do sistema existente
  if (window.categories && Array.isArray(window.categories)) {
    window.categories.forEach(category => {
      if (category.price) {
        categoryPriceData[category.id] = parseFloat(category.price);
      }
    });
    console.log(`💰 Loaded prices for ${Object.keys(categoryPriceData).length} categories`);
  }
}

// Habilitar controles dos filtros
function enableFilterControls() {
  const controls = ['country-filter', 'product-type-filter', 'size-filter', 'price-filter', 'sort-filter'];

  controls.forEach(controlId => {
    const element = document.getElementById(controlId);
    if (element) {
      element.disabled = false;
      element.addEventListener('change', applyFilters);
    }
  });

  // Habilitar botão clear
  const clearBtn = document.querySelector('.clear-filters-btn');
  if (clearBtn) {
    clearBtn.disabled = false;
    clearBtn.onclick = clearAllFilters;
  }

  console.log('✅ Filter controls enabled');
}

// Aplicar filtros
function applyFilters() {
  console.log('🔍 Applying filters...');

  // Atualizar filtros ativos
  activeFilters.country = document.getElementById('country-filter').value;
  activeFilters.productType = document.getElementById('product-type-filter').value;
  activeFilters.size = document.getElementById('size-filter').value;
  activeFilters.price = document.getElementById('price-filter').value;
  activeFilters.sort = document.getElementById('sort-filter').value;

  // Filtrar categorias
  let filteredItems = filterCategories();

  // Aplicar ordenação
  if (activeFilters.sort) {
    filteredItems = sortCategories(filteredItems);
  }

  // Atualizar exibição
  updateCategoryDisplay(filteredItems);

  // Atualizar badges de filtros ativos
  updateActiveFiltersBadges();

  console.log(`📊 Showing ${filteredItems.length} of ${allCategoryItems.length} categories`);
}

// Filtrar categorias
function filterCategories() {
  return allCategoryItems.filter(item => {
    const categoryName = item.textContent.trim().toLowerCase();

    // Filtro por país
    if (activeFilters.country) {
      if (activeFilters.country === 'brazil' && !categoryName.includes('brazil')) return false;
      if (activeFilters.country === 'colombia' && !categoryName.includes('colombia')) return false;
    }

    // Filtro por tipo de produto
    if (activeFilters.productType) {
      switch (activeFilters.productType) {
        case 'cowhides':
          if (categoryName.includes('rug') || categoryName.includes('sheepskin') || categoryName.includes('calfskin')) return false;
          break;
        case 'rugs':
          if (!categoryName.includes('rug')) return false;
          break;
        case 'sheepskins':
          if (!categoryName.includes('sheepskin')) return false;
          break;
        case 'calfskins':
          if (!categoryName.includes('calfskin')) return false;
          break;
      }
    }

    // Filtro por tamanho
    if (activeFilters.size) {
      switch (activeFilters.size) {
        case 'small':
          if (!categoryName.includes('small') && !categoryName.includes('extra small')) return false;
          break;
        case 'medium':
          if (!categoryName.includes('medium') && !categoryName.includes(' ml') && !categoryName.includes(' m ')) return false;
          break;
        case 'large':
          if ((!categoryName.includes('large') && !categoryName.includes(' l ')) || categoryName.includes('xl') || categoryName.includes('extra')) return false;
          break;
        case 'xl':
          if (!categoryName.includes('xl') && !categoryName.includes('extra large')) return false;
          break;
      }
    }

    // Filtro por preço (se temos dados de preço)
    if (activeFilters.price && categoryPriceData[item.getAttribute('data-category-id')]) {
      const price = categoryPriceData[item.getAttribute('data-category-id')];
      const [min, max] = parseFilterPrice(activeFilters.price);

      if (max && (price < min || price > max)) return false;
      if (!max && price < min) return false; // Para casos como "200+"
    }

    return true;
  });
}

// Parse do filtro de preço
function parseFilterPrice(priceFilter) {
  switch (priceFilter) {
    case '0-50': return [0, 50];
    case '50-100': return [50, 100];
    case '100-150': return [100, 150];
    case '150-200': return [150, 200];
    case '200+': return [200, null];
    default: return [0, null];
  }
}

// Ordenar categorias
function sortCategories(items) {
  return items.sort((a, b) => {
    const aName = a.textContent.trim();
    const bName = b.textContent.trim();
    const aId = a.getAttribute('data-category-id');
    const bId = b.getAttribute('data-category-id');

    switch (activeFilters.sort) {
      case 'price-low':
        return (categoryPriceData[aId] || 0) - (categoryPriceData[bId] || 0);
      case 'price-high':
        return (categoryPriceData[bId] || 0) - (categoryPriceData[aId] || 0);
      case 'name':
        return aName.localeCompare(bName);
      case 'photos':
        const aPhotos = parseInt(aName.match(/\((\d+) fotos?\)/)?.[1] || 0);
        const bPhotos = parseInt(bName.match(/\((\d+) fotos?\)/)?.[1] || 0);
        return bPhotos - aPhotos;
      default:
        return 0;
    }
  });
}

// Atualizar exibição das categorias
function updateCategoryDisplay(filteredItems) {
  // Esconder todos os itens
  allCategoryItems.forEach(item => item.style.display = 'none');

  // Mostrar apenas os filtrados
  filteredItems.forEach(item => item.style.display = 'block');

  // Mostrar mensagem se nenhum resultado
  showNoResultsMessage(filteredItems.length === 0);
}

// Atualizar badges de filtros ativos
function updateActiveFiltersBadges() {
  const badgesContainer = document.getElementById('active-filters');
  badgesContainer.innerHTML = '';

  const filterLabels = {
    country: { brazil: 'Brazil', colombia: 'Colombia' },
    productType: { cowhides: 'Cowhides', rugs: 'Rugs', sheepskins: 'Sheepskins', calfskins: 'Calfskins' },
    size: { small: 'Small', medium: 'Medium', large: 'Large', xl: 'Extra Large' },
    price: { '0-50': 'Under $50', '50-100': '$50-100', '100-150': '$100-150', '150-200': '$150-200', '200+': '$200+' },
    sort: { 'price-low': 'Price ↑', 'price-high': 'Price ↓', 'name': 'Name A-Z', 'photos': 'Most Photos' }
  };

  Object.keys(activeFilters).forEach(filterType => {
    const value = activeFilters[filterType];
    if (value) {
      const label = filterLabels[filterType]?.[value] || value;
      const badge = document.createElement('span');
      badge.className = 'filter-badge';
      badge.innerHTML = `${label} <button onclick="removeFilter('${filterType}')">×</button>`;
      badgesContainer.appendChild(badge);
    }
  });
}

// Mostrar mensagem de "sem resultados"
function showNoResultsMessage(show) {
  let noResultsMsg = document.getElementById('no-results-msg');

  if (show && !noResultsMsg) {
    noResultsMsg = document.createElement('div');
    noResultsMsg.id = 'no-results-msg';
    noResultsMsg.className = 'no-results-message';
    noResultsMsg.innerHTML = `
      <p>No categories match your filters</p>
      <button onclick="clearAllFilters()" class="btn btn-secondary btn-sm">Clear Filters</button>
    `;
    document.getElementById('categories-menu').appendChild(noResultsMsg);
  } else if (!show && noResultsMsg) {
    noResultsMsg.remove();
  }
}

// Remover filtro específico
function removeFilter(filterType) {
  activeFilters[filterType] = '';
  const elementId = filterType === 'productType' ? 'product-type-filter' : `${filterType}-filter`;
  const element = document.getElementById(elementId);
  if (element) element.value = '';

  applyFilters();
}

// Limpar todos os filtros
function clearAllFilters() {
  activeFilters = { country: '', productType: '', size: '', price: '', sort: '' };

  // Limpar selects
  ['country-filter', 'product-type-filter', 'size-filter', 'price-filter', 'sort-filter'].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });

  // Mostrar todas as categorias
  allCategoryItems.forEach(item => item.style.display = 'block');

  // Limpar badges e mensagem
  document.getElementById('active-filters').innerHTML = '';
  showNoResultsMessage(false);

  console.log('🧹 All filters cleared');
}

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initCategoryFilters, 1000);
});

// Disponibilizar funções globalmente
window.removeFilter = removeFilter;
window.clearAllFilters = clearAllFilters;