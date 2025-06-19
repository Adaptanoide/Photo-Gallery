// ===== NAVEGAÇÃO DAS 6 CATEGORIAS PRINCIPAIS =====

class HeaderNavigation {
  constructor() {
    this.allCategories = [];
    this.isInitialized = false;
    this.activeCategory = null;
  }

  // Inicializar sistema
  initialize(categories) {
    if (this.isInitialized) return;

    console.log('🎯 Inicializando Header Navigation com 6 categorias principais');

    this.allCategories = categories.filter(cat => !cat.isAll);
    this.removeOldFilters();
    this.isInitialized = true;

    console.log(`📊 Total de categorias disponíveis: ${this.allCategories.length}`);
  }

  // Carregar categorias de uma categoria principal
  loadCategory(mainCategoryKey) {
    console.log(`🎯 Carregando categoria principal: ${mainCategoryKey}`);

    // Marcar botão como ativo
    this.setActiveButton(mainCategoryKey);

    // Filtrar categorias desta categoria principal
    const filteredCategories = this.filterCategoriesByMain(mainCategoryKey);

    console.log(`📂 ${mainCategoryKey}: ${filteredCategories.length} categorias encontradas`);

    // Atualizar sidebar
    this.updateSidebar(filteredCategories);

    // Carregar primeira categoria automaticamente
    if (filteredCategories.length > 0) {
      setTimeout(() => {
        this.loadFirstCategory(filteredCategories[0]);
      }, 100);
    }
  }

  // Filtrar categorias por categoria principal (baseado nos dados reais)
  filterCategoriesByMain(mainCategoryKey) {
    switch (mainCategoryKey) {
      case 'brazil-best-sellers':
        // 6 categorias: Best Value + Super Promo
        return this.allCategories.filter(cat =>
          cat.name.includes('Best Value') ||
          cat.name.includes('Super Promo')
        );

      case 'brazil-top-selected':
        // 66 categorias: XL/ML/Small (EXCETO Best Value)
        return this.allCategories.filter(cat => {
          const name = cat.name;
          return (name.includes('XL') || name.includes('ML') || name.includes('Small') || name.includes('Medium')) &&
            !name.includes('Best Value') &&
            !name.includes('Super Promo');
        });

      case 'rodeo-rugs':
        // 9 categorias: Round + Star
        return this.allCategories.filter(cat =>
          cat.name.includes('Round') ||
          cat.name.includes('Star')
        );

      case 'specialty':
        // 16 categorias: Metallica + Others
        return this.allCategories.filter(cat =>
          cat.name.includes('Metallica') ||
          (!cat.name.includes('Best') &&
            !cat.name.includes('Super') &&
            !cat.name.includes('XL') &&
            !cat.name.includes('ML') &&
            !cat.name.includes('Small') &&
            !cat.name.includes('Round') &&
            !cat.name.includes('Star'))
        );

      case 'calfskins':
      case 'colombian-cowhides':
      case 'sheepskins':
        // Por enquanto vazio (cliente não tem acesso)
        return [];

      default:
        return [];
    }
  }

  // Marcar botão como ativo
  setActiveButton(mainCategoryKey) {
    // Remover active de todos
    document.querySelectorAll('.category-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    // Adicionar active no clicado
    const activeBtn = document.querySelector(`[data-category="${mainCategoryKey}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
      this.activeCategory = mainCategoryKey;
    }
  }

  // Atualizar sidebar com categorias filtradas
  updateSidebar(categories) {
    const menuContainer = document.getElementById('categories-menu');
    if (!menuContainer) return;

    if (categories.length === 0) {
      menuContainer.innerHTML = '<div class="category-loading">No categories available</div>';
      return;
    }

    let html = '';
    categories.forEach((category, index) => {
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
      window.setupCategoryClickHandlers();
    }

    console.log(`✅ Sidebar atualizado com ${categories.length} categorias`);
  }

  // Carregar primeira categoria automaticamente
  loadFirstCategory(category) {
    console.log(`🚀 Auto-carregando primeira categoria: ${category.name}`);

    // Trigger click na primeira categoria
    const firstCategoryElement = document.querySelector(`[data-category-id="${category.id}"]`);
    if (firstCategoryElement) {
      firstCategoryElement.click();
    }
  }

  // Remover filtros antigos
  removeOldFilters() {
    const filtersElement = document.querySelector('.category-filters');
    if (filtersElement) {
      filtersElement.remove();
      console.log('🗑️ Filtros antigos removidos do sidebar');
    }
  }

  // Debug: mostrar distribuição de categorias
  debugCategoryDistribution() {
    const categories = ['brazil-best-sellers', 'brazil-top-selected', 'calfskins', 'colombian-cowhides', 'rodeo-rugs', 'sheepskins'];

    console.log('📊 Distribuição das categorias:');
    categories.forEach(cat => {
      const filtered = this.filterCategoriesByMain(cat);
      console.log(`${cat}: ${filtered.length} categorias`);
      filtered.slice(0, 3).forEach(item => console.log(`  - ${item.name}`));
    });
  }
}

// Instância global
const headerNavigation = new HeaderNavigation();
window.headerNavigation = headerNavigation;