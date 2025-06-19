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

  // Filtrar categorias por categoria principal (baseado nos nomes reorganizados)
  filterCategoriesByMain(mainCategoryKey) {
    switch (mainCategoryKey) {
      case 'brazil-best-sellers':
        // Filtro específico: Brazil + (Best/Super OU os 3 tipos específicos)
        return this.allCategories.filter(cat => {
          const name = cat.name;
          return name.includes('Brazil') &&
            (name.includes('Best') ||
              name.includes('Super') ||
              name.includes('Dark Tones Mix') ||      // ✅ ADICIONAR específico
              name.includes('Exotic Tones') ||        // ✅ ADICIONAR específico  
              name.includes('Light Tones Mix'));      // ✅ ADICIONAR específico
        });

      case 'brazil-top-selected':
        // Retornar estrutura hierárquica dos 3 grupos de tamanho
        return this.createHierarchicalGroups();

      case 'calfskins':
        // Filtro simples: Calfskin + Metallica
        return this.allCategories.filter(cat => {
          const name = cat.name;
          return name.includes('Calfskin') && name.includes('Metallica');
        });

      case 'colombian-cowhides':
        // Estrutura mista: grupos de tamanho + categorias diretas
        return this.createColombianStructure();

      case 'rodeo-rugs':
        // Filtro simples: Round Rug OU Rodeo Rug
        return this.allCategories.filter(cat => {
          const name = cat.name;
          return name.includes('Round Rug') || name.includes('Rodeo Rug');
        });

      case 'sheepskins':
        // Filtro simples: Sheepskin
        return this.allCategories.filter(cat => {
          const name = cat.name;
          return name.includes('Sheepskin');
        });

      default:
        return [];
    }
  }

  // Criar grupos hierárquicos para Brazil Top Selected
  createHierarchicalGroups() {
    // Filtrar todas as categorias que começam com "Brazil" e têm tamanhos XL, ML, Small
    const brazilCategories = this.allCategories.filter(cat => {
      const name = cat.name;
      return name.includes('Brazil') &&
        (name.includes(' XL') || name.includes(' ML') || name.includes(' Small')) &&
        !name.includes('Best') &&
        !name.includes('Super');
    });

    // Agrupar por tamanho
    const groups = {
      'XL': {
        name: 'Brazil Extra Large',
        key: 'brazil-xl',
        isGroup: true,
        categories: brazilCategories.filter(cat => cat.name.includes(' XL'))
      },
      'ML': {
        name: 'Brazil Medium Large',
        key: 'brazil-ml',
        isGroup: true,
        categories: brazilCategories.filter(cat => cat.name.includes(' ML') && !cat.name.includes(' ML-XL'))
      },
      'Small': {
        name: 'Brazil Small',
        key: 'brazil-small',
        isGroup: true,
        categories: brazilCategories.filter(cat => cat.name.includes(' Small'))
      }
    };

    console.log('📂 Grupos criados:');
    Object.values(groups).forEach(group => {
      console.log(`  ${group.name}: ${group.categories.length} categorias`);
    });

    return Object.values(groups);
  }

  // Criar estrutura de grupos para Colombian Cowhides (todos grupos agora)
  createColombianStructure() {
    // Filtrar todas as categorias Colombia
    const colombiaCategories = this.allCategories.filter(cat => {
      const name = cat.name;
      return name.includes('Colombia');
    });

    console.log(`🇨🇴 Colombia total: ${colombiaCategories.length} categorias`);

    // Criar todos os grupos (agora uniforme)
    const groups = [
      {
        name: 'Colombia Large',
        key: 'colombia-large',
        isGroup: true,
        categories: colombiaCategories.filter(cat => cat.name.endsWith(' L'))
      },
      {
        name: 'Colombia Medium',
        key: 'colombia-medium',
        isGroup: true,
        categories: colombiaCategories.filter(cat => cat.name.endsWith(' M'))
      },
      {
        name: 'Colombia X-Large',
        key: 'colombia-xl',
        isGroup: true,
        categories: colombiaCategories.filter(cat => cat.name.endsWith(' XL'))
      },
      {
        name: 'Colombia Value',
        key: 'colombia-value',
        isGroup: true,
        categories: colombiaCategories.filter(cat => cat.name.includes('Value'))
      }
    ];

    // Filtrar grupos que têm categorias
    const validGroups = groups.filter(group => group.categories.length > 0);

    console.log('📂 Grupos Colombia (todos uniformes):');
    validGroups.forEach(group => {
      console.log(`  ${group.name}: ${group.categories.length} categorias`);
    });

    return validGroups;
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

  // Atualizar sidebar com categorias filtradas (suporte a grupos)
  updateSidebar(categories) {
    const menuContainer = document.getElementById('categories-menu');
    if (!menuContainer) return;

    if (categories.length === 0) {
      menuContainer.innerHTML = '<div class="category-loading">No categories available</div>';
      return;
    }

    let html = '';

    // Verificar se são grupos hierárquicos ou categorias normais
    const hasGroups = categories.some(cat => cat.isGroup);

    if (hasGroups) {
      // Renderizar interface mista: grupos + categorias diretas
      categories.forEach((item, index) => {
        if (item.isGroup) {
          // Renderizar grupo expansível
          html += `
        <div class="category-group" data-group-key="${item.key}">
          <div class="category-group-header" onclick="headerNavigation.toggleGroup('${item.key}')">
            <span class="group-toggle">▶</span>
            <span class="group-name">${item.name}</span>
            <span class="group-count">(${item.categories.length})</span>
          </div>
          <div class="category-group-content" id="group-${item.key}" style="display: none;">
            ${item.categories.map(cat => `
              <div class="category-item" data-category-id="${cat.id}">
                ${cat.name}
              </div>
            `).join('')}
          </div>
        </div>
        `;
        } else {
          // Renderizar categoria direta
          const isActive = index === 0 ? 'active' : '';
          html += `
        <div class="category-item direct-category ${isActive}" data-category-id="${item.id}">
          <span class="direct-icon">📄</span>
          ${item.name}
        </div>
        `;
        }
      });
    } else {
      // Renderizar categorias normais (Brazil Best Sellers, Calfskins)
      categories.forEach((category, index) => {
        const isActive = index === 0 ? 'active' : '';
        html += `
        <div class="category-item ${isActive}" data-category-id="${category.id}">
          ${category.name}
        </div>
      `;
      });
    }

    menuContainer.innerHTML = html;

    // Reconfigurar event listeners
    if (window.setupCategoryClickHandlers) {
      window.setupCategoryClickHandlers();
    }

    console.log(`✅ Sidebar atualizado com ${categories.length} ${hasGroups ? 'grupos' : 'categorias'}`);
  }

  // Toggle para expandir/colapsar grupos
  toggleGroup(groupKey) {
    const groupContent = document.getElementById(`group-${groupKey}`);
    const groupHeader = document.querySelector(`[data-group-key="${groupKey}"] .group-toggle`);

    if (!groupContent || !groupHeader) return;

    if (groupContent.style.display === 'none') {
      // Expandir
      groupContent.style.display = 'block';
      groupHeader.textContent = '▼';

      // Auto-carregar primeira categoria do grupo
      const firstCategory = groupContent.querySelector('.category-item');
      if (firstCategory) {
        setTimeout(() => {
          firstCategory.click();
        }, 100);
      }

      console.log(`📂 Grupo ${groupKey} expandido`);
    } else {
      // Colapsar
      groupContent.style.display = 'none';
      groupHeader.textContent = '▶';
      console.log(`📂 Grupo ${groupKey} colapsado`);
    }
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