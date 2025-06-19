// ===== HEADER DROPDOWNS SYSTEM =====

class HeaderDropdowns {
  constructor() {
    this.categoryGroups = {};
    this.isInitialized = false;
  }

  // Inicializar sistema de dropdowns
  initialize(categories) {
    if (this.isInitialized) return;
    
    console.log('🎯 Inicializando Header Dropdowns');
    
    // Agrupar categorias
    this.groupCategories(categories);
    
    // Popular dropdowns
    this.populateDropdowns();
    
    // Configurar eventos
    this.setupEvents();
    
    // Remover filtros antigos do sidebar
    this.removeOldFilters();
    
    this.isInitialized = true;
  }

  // Agrupar categorias conforme análise
  groupCategories(categories) {
    this.categoryGroups = {
      'bestSellers': [],
      'topSelected': { 'XL': [], 'ML': [], 'Small': [], 'Medium': [] },
      'specialty': []
    };

    categories.filter(cat => !cat.isAll).forEach(cat => {
      const name = cat.name;
      
      if (name.includes('Best Value') || name.includes('Super Promo')) {
        this.categoryGroups.bestSellers.push(cat);
      } else if (name.includes('XL') || name.includes('ML') || name.includes('Small') || name.includes('Medium')) {
        // Brazil Top Selected por tamanho
        if (name.includes('XL')) this.categoryGroups.topSelected.XL.push(cat);
        else if (name.includes('ML')) this.categoryGroups.topSelected.ML.push(cat);
        else if (name.includes('Medium')) this.categoryGroups.topSelected.Medium.push(cat);
        else if (name.includes('Small')) this.categoryGroups.topSelected.Small.push(cat);
      } else {
        this.categoryGroups.specialty.push(cat);
      }
    });

    console.log('📊 Categorias agrupadas:', {
      bestSellers: this.categoryGroups.bestSellers.length,
      topSelected: Object.values(this.categoryGroups.topSelected).reduce((sum, arr) => sum + arr.length, 0),
      specialty: this.categoryGroups.specialty.length
    });
  }

  // Popular conteúdo dos dropdowns
  populateDropdowns() {
    // Best Sellers
    this.populateSimpleDropdown('content-best-sellers', this.categoryGroups.bestSellers);
    
    // Top Selected (submenus)
    this.populateTopSelectedSubmenus();
    
    // Specialty
    this.populateSimpleDropdown('content-specialty', this.categoryGroups.specialty);
  }

  // Popular dropdown simples
  populateSimpleDropdown(containerId, categories) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = '';
    categories.forEach(cat => {
      html += `
        <div class="dropdown-item" data-category-id="${cat.id}" onclick="headerDropdowns.selectCategory('${cat.id}')">
          ${cat.name}
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // Popular submenus do Top Selected
  populateTopSelectedSubmenus() {
    Object.entries(this.categoryGroups.topSelected).forEach(([size, categories]) => {
      const submenuId = `submenu-${size.toLowerCase()}`;
      const container = document.getElementById(submenuId);
      
      if (container && categories.length > 0) {
        let html = '';
        categories.forEach(cat => {
          html += `
            <div class="dropdown-item" data-category-id="${cat.id}" onclick="headerDropdowns.selectCategory('${cat.id}')">
              ${cat.name.replace(/\s*(XL|ML|Small|Medium)\s*/g, '')}
            </div>
          `;
        });
        container.innerHTML = html;
      }
    });
  }

  // Configurar eventos
  setupEvents() {
    // Clique nos botões principais
    document.querySelectorAll('.dropdown-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = btn.closest('.dropdown');
        this.toggleDropdown(dropdown);
      });
    });

    // Hover nos submenus
    document.querySelectorAll('.dropdown-submenu').forEach(submenu => {
      submenu.addEventListener('mouseenter', () => {
        submenu.classList.add('active');
      });
      
      submenu.addEventListener('mouseleave', () => {
        submenu.classList.remove('active');
      });
    });

    // Fechar ao clicar fora
    document.addEventListener('click', () => {
      this.closeAllDropdowns();
    });
  }

  // Alternar dropdown
  toggleDropdown(dropdown) {
    const isActive = dropdown.classList.contains('active');
    
    // Fechar todos
    this.closeAllDropdowns();
    
    // Abrir o clicado se não estava ativo
    if (!isActive) {
      dropdown.classList.add('active');
    }
  }

  // Fechar todos os dropdowns
  closeAllDropdowns() {
    document.querySelectorAll('.dropdown').forEach(dropdown => {
      dropdown.classList.remove('active');
    });
  }

  // Selecionar categoria
  selectCategory(categoryId) {
    console.log(`🎯 Categoria selecionada: ${categoryId}`);
    
    // Fechar dropdowns
    this.closeAllDropdowns();
    
    // Encontrar categoria
    const category = this.findCategoryById(categoryId);
    if (!category) return;

    // Atualizar sidebar para mostrar apenas esta categoria
    this.updateSidebarWithCategory(category);
    
    // Carregar fotos desta categoria automaticamente
    if (window.loadCategoryPhotos) {
      window.loadCategoryPhotos(categoryId);
    }
  }

  // Encontrar categoria por ID
  findCategoryById(categoryId) {
    const allCategories = [
      ...this.categoryGroups.bestSellers,
      ...Object.values(this.categoryGroups.topSelected).flat(),
      ...this.categoryGroups.specialty
    ];
    
    return allCategories.find(cat => cat.id === categoryId);
  }

  // Atualizar sidebar com categoria selecionada
  updateSidebarWithCategory(category) {
    const menuContainer = document.getElementById('categories-menu');
    if (!menuContainer) return;

    // Mostrar apenas a categoria selecionada no sidebar
    menuContainer.innerHTML = `
      <div class="category-item active" data-category-id="${category.id}">
        ${category.name}
      </div>
    `;

    // Reconfigurar event listeners
    if (window.setupCategoryClickHandlers) {
      window.setupCategoryClickHandlers();
    }
  }

  // Remover filtros antigos do sidebar
  removeOldFilters() {
    const filtersElement = document.querySelector('.category-filters');
    if (filtersElement) {
      filtersElement.remove();
      console.log('🗑️ Filtros antigos removidos do sidebar');
    }
  }

  // Carregar todas as categorias (para mostrar tudo)
  loadAllCategories() {
    if (window.loadCategoriesMenu) {
      window.loadCategoriesMenu();
    }
  }
}

// Instância global
const headerDropdowns = new HeaderDropdowns();
window.headerDropdowns = headerDropdowns;