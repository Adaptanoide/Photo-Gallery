/**
 * SUNSHINE COWHIDES - GALLERY PAGE
 * JavaScript da página da galeria
 */

class GalleryPage {
  constructor() {
    this.categoriesGrid = null;
    this.categoriesLoading = null;
    this.categoriesEmpty = null;
    this.categoriesError = null;
    this.customerNameEl = null;
    
    // Estado
    this.categories = [];
    this.customerData = null;
    this.isLoading = false;
    
    this.init();
  }
  
  /**
   * Inicializa a página
   */
  init() {
    // Verificar autenticação
    if (!window.API || !window.API.isAuthenticated()) {
      window.Router.redirectToLogin();
      return;
    }
    
    // Aguardar DOM estar pronto
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupPage());
    } else {
      this.setupPage();
    }
  }
  
  /**
   * Configura a página após DOM estar pronto
   */
  async setupPage() {
    this.bindElements();
    this.bindEvents();
    this.setupBreadcrumbs();
    
    // Carregar dados
    await this.loadCustomerData();
    await this.loadCategories();
    
    console.log('🎨 Gallery page initialized');
  }
  
  /**
   * Vincula elementos do DOM
   */
  bindElements() {
    this.categoriesGrid = Utils.$('#categoriesGrid');
    this.categoriesLoading = Utils.$('.categories-loading');
    this.categoriesEmpty = Utils.$('#categoriesEmpty');
    this.categoriesError = Utils.$('#categoriesError');
    this.customerNameEl = Utils.$('#customerName');
    
    // Verificar elementos essenciais
    if (!this.categoriesGrid) {
      console.error('❌ Elementos essenciais não encontrados no DOM');
      return;
    }
  }
  
  /**
   * Vincula eventos
   */
  bindEvents() {
    // Botão logout
    const logoutBtn = Utils.$('#logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }
    
    // Botão limpar cache
    const clearCacheBtn = Utils.$('#clearCacheBtn');
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', () => this.handleClearCache());
    }
    
    // Botão recarregar categorias
    const reloadBtn = Utils.$('#reloadCategoriesBtn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => this.loadCategories());
    }
    
    // Clique em categoria
    if (this.categoriesGrid) {
      this.categoriesGrid.addEventListener('click', (e) => {
        const categoryCard = e.target.closest('.category-card');
        if (categoryCard) {
          const categoryId = categoryCard.dataset.categoryId;
          if (categoryId) {
            this.openCategory(categoryId);
          }
        }
      });
    }
  }
  
  /**
   * Configura breadcrumbs
   */
  setupBreadcrumbs() {
    window.Breadcrumb.setContainer('#breadcrumbs');
  }
  
  /**
   * Carrega dados do cliente
   */
  async loadCustomerData() {
    try {
      // Tentar carregar do localStorage primeiro
      this.customerData = window.API.getCustomerData();
      
      if (this.customerData && this.customerData.customerName) {
        this.updateCustomerDisplay(this.customerData.customerName);
      } else {
        // Buscar dados iniciais da API
        const data = await window.API.getInitialData();
        
        if (data && data.customerName) {
          this.customerData = data;
          this.updateCustomerDisplay(data.customerName);
        }
      }
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados do cliente:', error);
      this.updateCustomerDisplay('Cliente');
    }
  }
  
  /**
   * Atualiza exibição do nome do cliente
   */
  updateCustomerDisplay(customerName) {
    if (this.customerNameEl) {
      this.customerNameEl.textContent = customerName;
    }
  }
  
  /**
   * Carrega categorias
   */
  async loadCategories() {
    if (this.isLoading) return;
    
    try {
      this.isLoading = true;
      this.showLoadingState();
      
      // Buscar categorias da API
      const categories = await window.API.getCategories();
      
      console.log('📂 Categorias carregadas:', categories);
      
      if (Array.isArray(categories) && categories.length > 0) {
        this.categories = categories;
        this.renderCategories();
      } else {
        this.showEmptyState();
      }
      
    } catch (error) {
      console.error('❌ Erro ao carregar categorias:', error);
      this.showErrorState();
    } finally {
      this.isLoading = false;
    }
  }
  
  /**
   * Mostra estado de loading
   */
  showLoadingState() {
    if (this.categoriesLoading) {
      Utils.removeClass(this.categoriesLoading, 'hidden');
    }
    
    if (this.categoriesEmpty) {
      Utils.addClass(this.categoriesEmpty, 'hidden');
    }
    
    if (this.categoriesError) {
      Utils.addClass(this.categoriesError, 'hidden');
    }
  }
  
  /**
   * Mostra estado vazio
   */
  showEmptyState() {
    if (this.categoriesLoading) {
      Utils.addClass(this.categoriesLoading, 'hidden');
    }
    
    if (this.categoriesEmpty) {
      Utils.removeClass(this.categoriesEmpty, 'hidden');
    }
    
    if (this.categoriesError) {
      Utils.addClass(this.categoriesError, 'hidden');
    }
  }
  
  /**
   * Mostra estado de erro
   */
  showErrorState() {
    if (this.categoriesLoading) {
      Utils.addClass(this.categoriesLoading, 'hidden');
    }
    
    if (this.categoriesEmpty) {
      Utils.addClass(this.categoriesEmpty, 'hidden');
    }
    
    if (this.categoriesError) {
      Utils.removeClass(this.categoriesError, 'hidden');
    }
  }
  
  /**
   * Renderiza categorias
   */
  renderCategories() {
    if (!this.categoriesGrid || !Array.isArray(this.categories)) {
      return;
    }
    
    // Esconder estados de loading/empty/error
    this.hideAllStates();
    
    // Limpar grid
    this.categoriesGrid.innerHTML = '';
    
    // Template da categoria
    const template = Utils.$('#categoryCardTemplate');
    if (!template) {
      console.error('❌ Template de categoria não encontrado');
      return;
    }
    
    // Renderizar cada categoria
    this.categories.forEach((category, index) => {
      const categoryCard = this.createCategoryCard(category, template);
      if (categoryCard) {
        this.categoriesGrid.appendChild(categoryCard);
      }
    });
    
    console.log(`✅ ${this.categories.length} categorias renderizadas`);
  }
  
  /**
   * Cria card de categoria
   */
  createCategoryCard(category, template) {
    try {
      // Clonar template
      const cardElement = template.content.cloneNode(true);
      const card = cardElement.querySelector('.category-card');
      
      if (!card) return null;
      
      // Definir dados
      card.dataset.categoryId = category.id || category.folderId;
      
      // Imagem da categoria
      const image = card.querySelector('.category-image');
      if (image) {
        // Usar primeira foto como preview ou imagem padrão
        const imageUrl = this.getCategoryImageUrl(category);
        image.src = imageUrl;
        image.alt = `Categoria ${category.name}`;
        
        // Fallback para erro de imagem
        image.onerror = () => {
          image.src = this.getDefaultCategoryImage();
        };
      }
      
      // Nome da categoria
      const name = card.querySelector('.category-name');
      if (name) {
        name.textContent = category.name || 'Categoria sem nome';
      }
      
      // Contagem de fotos
      const count = card.querySelector('.category-count');
      if (count) {
        const fileCount = category.fileCount || 0;
        count.textContent = `${fileCount} ${fileCount === 1 ? 'foto' : 'fotos'}`;
      }
      
      // Adicionar acessibilidade
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Abrir categoria ${category.name} com ${category.fileCount || 0} fotos`);
      
      // Suporte a teclado
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.openCategory(category.id || category.folderId);
        }
      });
      
      return cardElement;
      
    } catch (error) {
      console.error('❌ Erro ao criar card de categoria:', error);
      return null;
    }
  }
  
  /**
   * Obtém URL da imagem para categoria
   */
  getCategoryImageUrl(category) {
    // Se categoria tem preview image
    if (category.previewImage) {
      return window.API.getImageUrl(category.previewImage, { thumbnail: true });
    }
    
    // Se categoria tem primeira foto
    if (category.firstPhoto) {
      return window.API.getImageUrl(category.firstPhoto, { thumbnail: true });
    }
    
    // Imagem padrão
    return this.getDefaultCategoryImage();
  }
  
  /**
   * Imagem padrão para categorias
   */
  getDefaultCategoryImage() {
    // SVG placeholder
    const svg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#1e1e2e"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6c757d" font-family="Arial, sans-serif" font-size="24">
          📂
        </text>
        <text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" fill="#6c757d" font-family="Arial, sans-serif" font-size="14">
          Categoria
        </text>
      </svg>
    `)}`;
    
    return svg;
  }
  
  /**
   * Esconde todos os estados
   */
  hideAllStates() {
    if (this.categoriesLoading) {
      Utils.addClass(this.categoriesLoading, 'hidden');
    }
    if (this.categoriesEmpty) {
      Utils.addClass(this.categoriesEmpty, 'hidden');
    }
    if (this.categoriesError) {
      Utils.addClass(this.categoriesError, 'hidden');
    }
  }
  
  /**
   * Abre categoria
   */
  openCategory(categoryId) {
    if (!categoryId) return;
    
    console.log('📂 Abrindo categoria:', categoryId);
    
    // Navegar para página de categoria
    const url = `/pages/category.html?category=${encodeURIComponent(categoryId)}`;
    window.Router.navigate(url);
  }
  
  /**
   * Lida com logout
   */
  handleLogout() {
    console.log('👋 Fazendo logout...');
    
    // Confirmar logout
    if (confirm('Tem certeza que deseja sair?')) {
      window.API.logout();
      window.Router.redirectToLogin();
    }
  }
  
  /**
   * Lida com limpeza de cache
   */
  async handleClearCache() {
    try {
      Utils.setButtonLoading(Utils.$('#clearCacheBtn'), true);
      
      await window.API.clearCache();
      
      // Recarregar categorias
      await this.loadCategories();
      
      Utils.announceToScreenReader('Cache limpo com sucesso');
      
    } catch (error) {
      console.error('❌ Erro ao limpar cache:', error);
      alert('Erro ao limpar cache. Tente novamente.');
    } finally {
      Utils.setButtonLoading(Utils.$('#clearCacheBtn'), false);
    }
  }
  
  /**
   * Método de debug
   */
  debug() {
    console.log('🔍 Gallery Page Debug Info:', {
      isAuthenticated: window.API?.isAuthenticated(),
      customerCode: window.API?.customerCode,
      customerData: this.customerData,
      categoriesCount: this.categories.length,
      isLoading: this.isLoading,
      elements: {
        categoriesGrid: !!this.categoriesGrid,
        categoriesLoading: !!this.categoriesLoading,
        categoriesEmpty: !!this.categoriesEmpty,
        categoriesError: !!this.categoriesError
      }
    });
  }
}

// Inicializar página
const galleryPage = new GalleryPage();

// Expor para debug
window.GalleryPage = galleryPage;

// Hot reload helper para desenvolvimento
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  window.addEventListener('keydown', (e) => {
    // Ctrl + R para reload
    if (e.ctrlKey && e.key === 'r') {
      e.preventDefault();
      window.location.reload();
    }
    
    // Ctrl + D para debug
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      galleryPage.debug();
    }
  });
}