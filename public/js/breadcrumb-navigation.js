// ===== SISTEMA DE NAVEGAÇÃO BREADCRUMB + ABAS =====

class BreadcrumbNavigation {
    constructor() {
        this.navigationStack = [];
        this.currentSizes = [];
        this.activeSizeTab = null;
    }

    // Inicializar sistema
    initialize() {
        console.log('🧭 Inicializando Breadcrumb Navigation');
        this.hideBreadcrumb();
        this.hideSizeTabs();
    }

    // Ir para Home (Dashboard)
    goToHome() {
        this.navigationStack = [{ type: 'home', label: 'Home', data: null }];
        this.hideBreadcrumb();
        this.hideSizeTabs();

        // Limpar seleção de botões ativos
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Marcar botão home como ativo
        const homeBtn = document.querySelector('.home-btn');
        if (homeBtn) {
            homeBtn.classList.add('active');
        }

        // Mostrar dashboard diretamente
        if (window.showDashboard) {
            window.showDashboard();
        }

        // Limpar sidebar
        const categoriesMenu = document.getElementById('categories-menu');
        if (categoriesMenu) {
            categoriesMenu.innerHTML = '<div class="category-loading">Select a category from the dashboard to start browsing</div>';
        }
    }

    // Navegar para categoria principal (ex: Brazil Top Selected)
    navigateToMainCategory(categoryKey, categoryName) {
        console.log(`🧭 Navegando para categoria principal: ${categoryName}`);

        this.navigationStack = [
            { type: 'home', label: 'Home', data: null },
            { type: 'main-category', label: categoryName, data: categoryKey }
        ];

        this.updateBreadcrumb();
        this.hideSizeTabs();

        // Usar navegação existente
        if (window.headerNavigation) {
            window.headerNavigation.loadCategory(categoryKey);
        }
    }

    // Navegar para subcategoria (ex: Black & White)
    navigateToSubcategory(subcategoryId, subcategoryName, hasSize = false) {
        console.log(`🧭 Navegando para subcategoria: ${subcategoryName}`);

        // Adicionar subcategoria ao stack
        const subcategoryItem = {
            type: 'subcategory',
            label: subcategoryName,
            data: { id: subcategoryId, hasSize }
        };

        // Se já existe subcategoria, substituir. Senão, adicionar
        const subcategoryIndex = this.navigationStack.findIndex(item => item.type === 'subcategory');
        if (subcategoryIndex !== -1) {
            this.navigationStack = this.navigationStack.slice(0, subcategoryIndex);
        }
        this.navigationStack.push(subcategoryItem);

        this.updateBreadcrumb();

        if (hasSize) {
            this.loadSizeTabs(subcategoryId, subcategoryName);
        } else {
            this.hideSizeTabs();
            this.loadPhotosDirectly(subcategoryId, subcategoryName);
        }
    }

    // Carregar abas de tamanho
    loadSizeTabs(subcategoryId, subcategoryName) {
        console.log(`📏 Carregando abas de tamanho para: ${subcategoryName}`);

        // Buscar dados da subcategoria para identificar tamanhos
        this.identifySizesForSubcategory(subcategoryId)
            .then(sizes => {
                if (sizes.length > 0) {
                    this.currentSizes = sizes;
                    this.renderSizeTabs();
                    this.showSizeTabs();

                    // Auto-selecionar primeira aba
                    this.selectSizeTab(sizes[0].key, sizes[0].name);
                } else {
                    this.hideSizeTabs();
                    this.loadPhotosDirectly(subcategoryId, subcategoryName);
                }
            })
            .catch(error => {
                console.error('Erro ao carregar tamanhos:', error);
                this.hideSizeTabs();
                this.loadPhotosDirectly(subcategoryId, subcategoryName);
            });
    }

    // Identificar tamanhos disponíveis para uma subcategoria
    async identifySizesForSubcategory(subcategoryId) {
        try {
            // Usar categorias já carregadas
            const allCategories = window.headerNavigation?.allCategories || [];

            // Buscar categorias que pertencem a esta subcategoria
            const relatedCategories = allCategories.filter(cat => {
                const name = cat.name.toLowerCase();
                const subcategory = document.querySelector(`[data-category-id="${subcategoryId}"]`)?.textContent || '';
                const subcategoryWords = subcategory.toLowerCase().split(' ');

                // Verificar se categoria contém palavras da subcategoria
                return subcategoryWords.some(word => name.includes(word.toLowerCase()));
            });

            // Identificar tamanhos únicos
            const sizeMap = new Map();

            relatedCategories.forEach(cat => {
                const name = cat.name;
                let sizeKey = null;
                let sizeName = null;

                if (name.includes(' XL')) {
                    sizeKey = 'xl';
                    sizeName = 'Extra Large';
                } else if (name.includes(' ML')) {
                    sizeKey = 'ml';
                    sizeName = 'Medium Large';
                } else if (name.includes(' L') && !name.includes(' ML')) {
                    sizeKey = 'l';
                    sizeName = 'Large';
                } else if (name.includes(' M') && !name.includes(' ML')) {
                    sizeKey = 'm';
                    sizeName = 'Medium';
                } else if (name.includes(' Small')) {
                    sizeKey = 'small';
                    sizeName = 'Small';
                }

                if (sizeKey && !sizeMap.has(sizeKey)) {
                    sizeMap.set(sizeKey, {
                        key: sizeKey,
                        name: sizeName,
                        categories: []
                    });
                }

                if (sizeKey) {
                    sizeMap.get(sizeKey).categories.push(cat);
                }
            });

            // Ordenar tamanhos (Small → Medium → Large → Extra Large)
            const sizeOrder = ['small', 'm', 'l', 'ml', 'xl'];
            const sortedSizes = Array.from(sizeMap.values()).sort((a, b) => {
                return sizeOrder.indexOf(a.key) - sizeOrder.indexOf(b.key);
            });

            return sortedSizes;
        } catch (error) {
            console.error('Erro ao identificar tamanhos:', error);
            return [];
        }
    }

    // Renderizar abas de tamanho
    renderSizeTabs() {
        const tabsContainer = document.getElementById('size-tabs');
        if (!tabsContainer) return;

        let html = '';
        this.currentSizes.forEach((size, index) => {
            const isActive = index === 0 ? 'active' : '';
            html += `
        <button class="size-tab ${isActive}" 
                onclick="breadcrumbNavigation.selectSizeTab('${size.key}', '${size.name}')"
                data-size="${size.key}">
          ${size.name}
          <span class="size-tab-count">(${size.categories.length})</span>
        </button>
      `;
        });

        tabsContainer.innerHTML = html;
    }

    // Selecionar aba de tamanho
    selectSizeTab(sizeKey, sizeName) {
        console.log(`📏 Selecionando tamanho: ${sizeName}`);

        // Atualizar visual das abas
        document.querySelectorAll('.size-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-size="${sizeKey}"]`).classList.add('active');

        // Atualizar breadcrumb com tamanho
        this.updateBreadcrumbWithSize(sizeName);

        // Carregar fotos do tamanho selecionado
        this.loadPhotosForSize(sizeKey, sizeName);

        this.activeSizeTab = sizeKey;
    }

    // Atualizar breadcrumb
    updateBreadcrumb() {
        const container = document.getElementById('breadcrumb-container');
        const itemsContainer = document.getElementById('breadcrumb-items');
        const standaloneHome = document.getElementById('standalone-home-btn');

        if (!container || !itemsContainer) return;

        let html = '';
        this.navigationStack.forEach((item, index) => {
            const isLast = index === this.navigationStack.length - 1;
            const linkClass = isLast ? 'breadcrumb-link current' : 'breadcrumb-link';

            // Ícone especial para Home
            const icon = item.type === 'home' ? '<span class="home-icon">🏠</span>' : '';

            html += `
      <div class="breadcrumb-item">
        <span class="${linkClass}" onclick="breadcrumbNavigation.navigateToStackItem(${index})">
          ${icon} ${item.label}
        </span>
      </div>
    `;

            if (!isLast) {
                html += `
        <div class="breadcrumb-separator">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9.29 6.71a.996.996 0 000 1.41L13.17 12l-3.88 3.88a.996.996 0 101.41 1.41l4.59-4.59a.996.996 0 000-1.41L10.7 6.71a.996.996 0 00-1.41 0z"/>
          </svg>
        </div>
      `;
            }
        });

        itemsContainer.innerHTML = html;
        this.showBreadcrumb();

        // Esconder botão Home standalone quando breadcrumb está ativo
        if (standaloneHome) {
            standaloneHome.style.display = 'none';
        }
    }

    // Atualizar breadcrumb com tamanho
    updateBreadcrumbWithSize(sizeName) {
        // Remover tamanho anterior se existe
        const sizeIndex = this.navigationStack.findIndex(item => item.type === 'size');
        if (sizeIndex !== -1) {
            this.navigationStack = this.navigationStack.slice(0, sizeIndex);
        }

        // Adicionar novo tamanho
        this.navigationStack.push({
            type: 'size',
            label: sizeName,
            data: this.activeSizeTab
        });

        this.updateBreadcrumb();
    }

    // Navegar para item específico do stack
    navigateToStackItem(index) {
        const item = this.navigationStack[index];
        if (!item) return;

        console.log(`🧭 Navegando para: ${item.label}`);

        switch (item.type) {
            case 'home':
                this.goToHome();
                break;
            case 'main-category':
                this.navigateToMainCategory(item.data, item.label);
                break;
            case 'subcategory':
                this.navigateToSubcategory(item.data.id, item.label, item.data.hasSize);
                break;
        }
    }

    // Carregar fotos diretamente (sem tamanhos)
    loadPhotosDirectly(categoryId, categoryName) {
        console.log(`📷 Carregando fotos diretamente: ${categoryName}`);

        // Usar função direta de carregamento de fotos
        if (window.loadPhotosForCategory) {
            showLoader();
            window.loadPhotosForCategory(categoryId, categoryName).finally(() => {
                hideLoader();
            });
        } else {
            // Fallback: simular click
            const categoryElement = document.querySelector(`[data-category-id="${categoryId}"]`);
            if (categoryElement) {
                // Remover interceptação temporariamente
                const originalHandler = window.handleCategoryClick;
                window.handleCategoryClick = null;

                categoryElement.click();

                // Restaurar interceptação
                setTimeout(() => {
                    window.handleCategoryClick = originalHandler;
                }, 100);
            }
        }
    }

    // Carregar fotos para tamanho específico
    loadPhotosForSize(sizeKey, sizeName) {
        console.log(`📷 Carregando fotos para tamanho: ${sizeName}`);

        const sizeData = this.currentSizes.find(s => s.key === sizeKey);
        if (!sizeData) return;

        // Carregar primeira categoria do tamanho
        if (sizeData.categories.length > 0) {
            const firstCategory = sizeData.categories[0];

            // Simular click na categoria
            const categoryElement = document.querySelector(`[data-category-id="${firstCategory.id}"]`);
            if (categoryElement) {
                categoryElement.click();
            }
        }
    }

    // Mostrar/esconder breadcrumb
    showBreadcrumb() {
        const container = document.getElementById('breadcrumb-container');
        const contentArea = document.querySelector('.content-area');

        if (container) {
            container.style.display = 'block';
            container.classList.add('slide-in');
        }

        if (contentArea) {
            contentArea.classList.add('with-navigation');
        }
    }

    hideBreadcrumb() {
        const container = document.getElementById('breadcrumb-container');
        const contentArea = document.querySelector('.content-area');
        const standaloneHome = document.getElementById('standalone-home-btn');

        if (container) {
            container.style.display = 'none';
        }

        if (contentArea) {
            contentArea.classList.remove('with-navigation');
        }

        // Mostrar botão Home standalone quando breadcrumb está escondido
        if (standaloneHome) {
            standaloneHome.style.display = 'block';
        }
    }

    // Mostrar/esconder abas de tamanho
    showSizeTabs() {
        const container = document.getElementById('size-tabs-container');
        if (container) {
            container.style.display = 'block';
            container.classList.add('slide-in');
        }
    }

    hideSizeTabs() {
        const container = document.getElementById('size-tabs-container');
        if (container) {
            container.style.display = 'none';
        }
    }
}

// Instância global
const breadcrumbNavigation = new BreadcrumbNavigation();
window.breadcrumbNavigation = breadcrumbNavigation;

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    breadcrumbNavigation.initialize();
});