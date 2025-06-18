// ===== SISTEMA DE FILTROS PARA CATEGORIAS =====

class CategoryFilters {
  constructor() {
    this.allCategories = [];
    this.filteredCategories = [];
    this.activeFilters = {
      size: [],
      price: [],
      color: [],
      search: ''
    };
  }

  // Inicializar filtros
  initialize(categories) {
    this.allCategories = categories.filter(cat => !cat.isAll);
    this.filteredCategories = [...this.allCategories];
    
    console.log(`🔧 Filtros inicializados com ${this.allCategories.length} categorias`);
    
    this.renderFilterUI();
    this.setupEventListeners();
  }

  // Extrair tamanho do nome da categoria
  extractSize(categoryName) {
    const name = categoryName.toLowerCase();
    
    if (name.includes('ml-xl')) return 'ML-XL';
    if (name.includes('xl')) return 'XL';
    if (name.includes('ml') && !name.includes('ml-xl')) return 'ML';
    if (name.includes('large')) return 'Large';
    if (name.includes('medium')) return 'Medium';
    if (name.includes('small')) return 'Small';
    if (name.includes('xs')) return 'XS';
    
    return 'Mixed';
  }

  // Extrair categoria de preço
  extractPriceCategory(categoryName) {
    const name = categoryName.toLowerCase();
    
    if (name.includes('best value')) return 'Best Value';
    if (name.includes('super promo')) return 'Promotional';
    if (name.includes('top selected')) return 'Premium';
    
    return 'Standard';
  }

  // Renderizar interface de filtros
  renderFilterUI() {
    const sidebar = document.querySelector('.category-sidebar');
    
    // Criar container de filtros
    const filtersHTML = `
      <div class="category-filters">
        <h4>Filters</h4>
        
        <div class="filter-group">
          <label>Size:</label>
          <div class="filter-options" id="size-filters">
            <!-- Opções serão adicionadas aqui -->
          </div>
        </div>
        
        <div class="filter-group">
          <label>Type:</label>
          <div class="filter-options" id="price-filters">
            <!-- Opções serão adicionadas aqui -->
          </div>
        </div>
        
        <div class="filter-actions">
          <button class="btn-clear-filters" onclick="categoryFilters.clearAllFilters()">Clear All</button>
        </div>
      </div>
    `;
    
    // Inserir depois do search
    const searchDiv = sidebar.querySelector('.category-search');
    searchDiv.insertAdjacentHTML('afterend', filtersHTML);
    
    this.populateFilterOptions();
  }

  // Popular opções de filtros
  populateFilterOptions() {
    this.populateSizeFilters();
    this.populatePriceFilters();
  }

  // Popular filtros de tamanho
  populateSizeFilters() {
    const sizeCount = {};
    
    this.allCategories.forEach(cat => {
      const size = this.extractSize(cat.name);
      sizeCount[size] = (sizeCount[size] || 0) + 1;
    });
    
    const sizeContainer = document.getElementById('size-filters');
    let html = '';
    
    Object.entries(sizeCount)
      .sort(([,a], [,b]) => b - a)
      .forEach(([size, count]) => {
        html += `
          <label class="filter-option">
            <input type="checkbox" value="${size}" onchange="categoryFilters.updateFilters()">
            ${size} (${count})
          </label>
        `;
      });
    
    sizeContainer.innerHTML = html;
  }

  // Popular filtros de preço
  populatePriceFilters() {
    const priceCount = {};
    
    this.allCategories.forEach(cat => {
      const price = this.extractPriceCategory(cat.name);
      priceCount[price] = (priceCount[price] || 0) + 1;
    });
    
    const priceContainer = document.getElementById('price-filters');
    let html = '';
    
    Object.entries(priceCount)
      .sort(([,a], [,b]) => b - a)
      .forEach(([price, count]) => {
        html += `
          <label class="filter-option">
            <input type="checkbox" value="${price}" onchange="categoryFilters.updateFilters()">
            ${price} (${count})
          </label>
        `;
      });
    
    priceContainer.innerHTML = html;
  }

  // Configurar event listeners
  setupEventListeners() {
    // Integrar com busca existente
    const searchInput = document.getElementById('category-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.activeFilters.search = searchInput.value;
        this.updateFilters();
      });
    }
  }

  // Atualizar filtros
  updateFilters() {
    // Coletar filtros ativos
    this.activeFilters.size = this.getCheckedValues('size-filters');
    this.activeFilters.price = this.getCheckedValues('price-filters');
    
    // Aplicar filtros
    this.filteredCategories = this.allCategories.filter(cat => {
      return this.matchesFilters(cat);
    });
    
    console.log(`🔍 Filtros aplicados: ${this.filteredCategories.length} de ${this.allCategories.length} categorias`);
    
    // Atualizar interface
    this.updateCategoryList();
  }

  // Verificar se categoria atende aos filtros
  matchesFilters(category) {
    const name = category.name;
    
    // Filtro de busca
    if (this.activeFilters.search && !name.toLowerCase().includes(this.activeFilters.search.toLowerCase())) {
      return false;
    }
    
    // Filtro de tamanho
    if (this.activeFilters.size.length > 0) {
      const categorySize = this.extractSize(name);
      if (!this.activeFilters.size.includes(categorySize)) {
        return false;
      }
    }
    
    // Filtro de preço
    if (this.activeFilters.price.length > 0) {
      const categoryPrice = this.extractPriceCategory(name);
      if (!this.activeFilters.price.includes(categoryPrice)) {
        return false;
      }
    }
    
    return true;
  }

  // Obter valores selecionados
  getCheckedValues(containerId) {
    const container = document.getElementById(containerId);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
  }

  // Atualizar lista de categorias
  updateCategoryList() {
    const menuContainer = document.getElementById('categories-menu');
    
    if (this.filteredCategories.length === 0) {
      menuContainer.innerHTML = '<div class="category-loading">No categories match filters</div>';
      return;
    }
    
    let html = '';
    this.filteredCategories.forEach((category, index) => {
      const isActive = index === 0 ? 'active' : '';
      html += `
        <div class="category-item ${isActive}" data-category-id="${category.id}">
          ${category.name}
        </div>
      `;
    });
    
    menuContainer.innerHTML = html;
    
    // Reconfigurar event listeners
    if (window.setupCategoryClickHandlers) {
      setupCategoryClickHandlers();
    }
  }

  // Limpar todos os filtros
  clearAllFilters() {
    // Desmarcar checkboxes
    document.querySelectorAll('.filter-options input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });
    
    // Limpar busca
    const searchInput = document.getElementById('category-search-input');
    if (searchInput) {
      searchInput.value = '';
    }
    
    // Reset filtros
    this.activeFilters = {
      size: [],
      price: [],
      color: [],
      search: ''
    };
    
    this.updateFilters();
  }
}

// Instância global
const categoryFilters = new CategoryFilters();
window.categoryFilters = categoryFilters;