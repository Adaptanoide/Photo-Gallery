/**
 * SUNSHINE COWHIDES - CATEGORY PAGE
 * JavaScript da página de categoria
 */

class CategoryPage {
  constructor() {
    this.photosGrid = null;
    this.photosLoading = null;
    this.photosEmpty = null;
    this.photosError = null;
    this.loadMoreContainer = null;
    this.loadMoreBtn = null;
    this.customerNameEl = null;
    this.categoryTitleEl = null;
    
    // Estado
    this.categoryId = null;
    this.categoryName = null;
    this.isMainCategory = false;
    this.mainCategoryName = null;
    this.photos = [];
    this.currentPage = 1;
    this.hasMorePages = true;
    this.isLoading = false;
    this.photosPerPage = 20;
    
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
    
    // Obter categoria da URL
    this.categoryId = this.getCategoryFromUrl();
    if (!this.categoryId) {
      console.error('❌ ID da categoria não encontrado na URL');
      this.goBack();
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
   * Obtém categoria da URL
   */
  getCategoryFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Verificar se é categoria principal agrupada
    const mainCategory = urlParams.get('main_category');
    if (mainCategory) {
      this.isMainCategory = true;
      this.mainCategoryName = mainCategory;
      return `main_${mainCategory}`;
    }
    
    // Categoria normal
    this.isMainCategory = false;
    return urlParams.get('category');
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
    await this.loadPhotos();
    
    console.log('📷 Category page initialized');
  }
  
  /**
   * Vincula elementos do DOM
   */
  bindElements() {
    this.photosGrid = Utils.$('#photosGrid');
    this.photosLoading = Utils.$('#photosLoading');
    this.photosEmpty = Utils.$('#photosEmpty');
    this.photosError = Utils.$('#photosError');
    this.loadMoreContainer = Utils.$('#loadMoreContainer');
    this.loadMoreBtn = Utils.$('#loadMoreBtn');
    this.customerNameEl = Utils.$('#customerName');
    this.categoryTitleEl = Utils.$('#categoryTitle');
    
    // Verificar elementos essenciais
    if (!this.photosGrid) {
      console.error('❌ Elementos essenciais não encontrados no DOM');
      return;
    }
  }
  
  /**
   * Vincula eventos
   */
  bindEvents() {
    // Botão voltar
    const backBtn = Utils.$('#backBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.goBack());
    }
    
    // Botão logout
    const logoutBtn = Utils.$('#logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }
    
    // Botão recarregar fotos
    const reloadBtn = Utils.$('#reloadPhotosBtn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => this.reloadPhotos());
    }
    
    // Botão carregar mais
    if (this.loadMoreBtn) {
      this.loadMoreBtn.addEventListener('click', () => this.loadMorePhotos());
    }
    
    // Clique em foto
    if (this.photosGrid) {
      this.photosGrid.addEventListener('click', (e) => {
        const photoCard = e.target.closest('.photo-card');
        if (photoCard) {
          const photoId = photoCard.dataset.photoId;
          if (photoId) {
            this.openPhoto(photoId);
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
      const customerData = window.API.getCustomerData();
      
      if (customerData && customerData.customerName) {
        this.updateCustomerDisplay(customerData.customerName);
      } else {
        this.updateCustomerDisplay('Cliente');
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
   * Carrega conteúdo da categoria (subcategorias OU fotos)
   */
  async loadPhotos(reset = true) {
    if (this.isLoading) return;
    
    try {
      this.isLoading = true;
      
      if (reset) {
        this.currentPage = 1;
        this.photos = [];
        this.showLoadingState();
      }
      
      // PRIMEIRO: Tentar buscar subcategorias
      const subcategories = await this.loadSubcategories();
      
      if (subcategories && subcategories.length > 0) {
        // Tem subcategorias - mostrar elas
        console.log(`📂 Mostrando ${subcategories.length} subcategorias`);
        this.renderSubcategories(subcategories);
        return;
      }
      
      // NÃO tem subcategorias - buscar fotos finais
      console.log('📷 Carregando fotos finais...');
      await this.loadFinalPhotos(reset);
      
    } catch (error) {
      console.error('❌ Erro ao carregar conteúdo:', error);
      this.showErrorState();
    } finally {
      this.isLoading = false;
    }
  }
  
  /**
   * Tenta carregar subcategorias da categoria atual
   */
  async loadSubcategories() {
    try {
      // Buscar todas as categorias
      const allCategories = await window.API.getCategories();
      
      if (!Array.isArray(allCategories)) return [];
      
      let subcategories = [];
      
      if (this.isMainCategory) {
        // Para categoria principal, buscar todas que começam com esse nome
        subcategories = allCategories.filter(cat => {
          const path = cat.relativePath || '';
          return path.startsWith(this.mainCategoryName);
        });
        
        // Agrupar por segundo nível (subcategorias principais)
        const grouped = {};
        subcategories.forEach(cat => {
          const parts = cat.relativePath.split('/').filter(Boolean);
          if (parts.length >= 2) {
            const secondLevel = parts[1];
            if (!grouped[secondLevel]) {
              grouped[secondLevel] = {
                id: `${this.mainCategoryName}_${secondLevel}`.replace(/\s+/g, '_'),
                name: secondLevel,
                relativePath: `${this.mainCategoryName}/${secondLevel}`,
                photoCount: 0,
                subcategories: []
              };
            }
            grouped[secondLevel].photoCount += cat.photoCount || 0;
            grouped[secondLevel].subcategories.push(cat);
          }
        });
        
        subcategories = Object.values(grouped);
        
      } else {
        // Categoria normal - buscar filhos diretos
        const currentPath = this.getCurrentCategoryPath(allCategories);
        
        if (currentPath) {
          subcategories = allCategories.filter(cat => {
            const path = cat.relativePath || '';
            if (path.startsWith(currentPath)) {
              const relativePart = path.replace(currentPath, '').replace(/^\//, '');
              const levels = relativePart.split('/').filter(Boolean);
              return levels.length === 1; // Apenas 1 nível abaixo = filho direto
            }
            return false;
          });
        }
      }
      
      console.log(`🔍 Encontradas ${subcategories.length} subcategorias para ${this.categoryId}`);
      return subcategories;
      
    } catch (error) {
      console.error('❌ Erro ao buscar subcategorias:', error);
      return [];
    }
  }
  
  /**
   * Obtém o caminho da categoria atual
   */
  getCurrentCategoryPath(allCategories) {
    const currentCategory = allCategories.find(cat => 
      (cat.id || cat.folderId) === this.categoryId
    );
    
    return currentCategory ? currentCategory.relativePath : null;
  }
  
  /**
   * Carrega fotos finais (quando não há subcategorias)
   */
  async loadFinalPhotos(reset) {
    const photos = await window.API.getPhotos({
      categoryId: this.categoryId,
      limit: this.photosPerPage,
      offset: (this.currentPage - 1) * this.photosPerPage
    });
    
    console.log(`📷 Fotos carregadas:`, photos);
    
    if (Array.isArray(photos)) {
      if (reset) {
        this.photos = photos;
      } else {
        this.photos.push(...photos);
      }
      
      this.hasMorePages = photos.length === this.photosPerPage;
      
      if (this.photos.length > 0) {
        this.renderPhotos();
        this.updateLoadMoreButton();
      } else {
        this.showEmptyState();
      }
      
      // Atualizar título se disponível
      if (photos.length > 0 && photos[0].categoryName) {
        this.updateCategoryTitle(photos[0].categoryName);
      }
    } else {
      this.showEmptyState();
    }
  }
  
  /**
   * Renderiza subcategorias como cards
   */
  renderSubcategories(subcategories) {
    if (!this.photosGrid) return;
    
    // Mostrar grid
    this.hideAllStates();
    Utils.removeClass(this.photosGrid, 'hidden');
    
    // Limpar grid
    this.photosGrid.innerHTML = '';
    
    // Adicionar classe especial para subcategorias
    Utils.addClass(this.photosGrid, 'subcategories-grid');
    
    // Renderizar cada subcategoria como card
    subcategories.forEach(subcategory => {
      const subcategoryCard = this.createSubcategoryCard(subcategory);
      if (subcategoryCard) {
        this.photosGrid.appendChild(subcategoryCard);
      }
    });
    
    // Esconder botão "carregar mais"
    if (this.loadMoreContainer) {
      Utils.addClass(this.loadMoreContainer, 'hidden');
    }
    
    console.log(`✅ ${subcategories.length} subcategorias renderizadas`);
  }
  
  /**
   * Cria card de subcategoria
   */
  createSubcategoryCard(subcategory) {
    try {
      const card = Utils.createElement('div', {
        className: 'subcategory-card',
        'data-category-id': subcategory.id || subcategory.folderId
      });
      
      // Container da imagem
      const imageContainer = Utils.createElement('div', {
        className: 'subcategory-image-container'
      });
      
      // Placeholder da imagem (pode carregar preview depois)
      const placeholder = Utils.createElement('div', {
        className: 'subcategory-placeholder'
      }, '📂');
      
      // Informações
      const info = Utils.createElement('div', {
        className: 'subcategory-info'
      }, [
        Utils.createElement('h4', {
          className: 'subcategory-name'
        }, subcategory.name || 'Subcategoria'),
        Utils.createElement('p', {
          className: 'subcategory-count'
        }, `${subcategory.photoCount || 0} fotos`)
      ]);
      
      // Ação
      const action = Utils.createElement('div', {
        className: 'subcategory-action'
      }, [
        Utils.createElement('span', {
          className: 'btn btn-primary btn-sm'
        }, 'Explorar')
      ]);
      
      imageContainer.appendChild(placeholder);
      card.appendChild(imageContainer);
      card.appendChild(info);
      card.appendChild(action);
      
      // Eventos
      card.addEventListener('click', () => {
        this.openSubcategory(subcategory.id || subcategory.folderId);
      });
      
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.openSubcategory(subcategory.id || subcategory.folderId);
        }
      });
      
      // Acessibilidade
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Explorar ${subcategory.name}`);
      
      return card;
      
    } catch (error) {
      console.error('❌ Erro ao criar card de subcategoria:', error);
      return null;
    }
  }
  
  /**
   * Abre subcategoria
   */
  openSubcategory(subcategoryId) {
    if (!subcategoryId) return;
    
    console.log('📂 Abrindo subcategoria:', subcategoryId);
    
    // Navegar para a mesma página mas com nova categoria
    const url = `/pages/category.html?category=${encodeURIComponent(subcategoryId)}`;
    window.location.href = url;
  }
  
  /**
   * Carrega mais fotos (paginação)
   */
  async loadMorePhotos() {
    if (!this.hasMorePages || this.isLoading) return;
    
    Utils.setButtonLoading(this.loadMoreBtn, true);
    
    this.currentPage++;
    await this.loadFinalPhotos(false);
    
    Utils.setButtonLoading(this.loadMoreBtn, false);
  }
  
  /**
   * Recarrega fotos
   */
  async reloadPhotos() {
    await this.loadPhotos(true);
  }
  
  /**
   * Mostra estado de loading
   */
  showLoadingState() {
    if (this.photosLoading) {
      Utils.removeClass(this.photosLoading, 'hidden');
    }
    
    if (this.photosGrid) {
      Utils.addClass(this.photosGrid, 'hidden');
    }
    
    if (this.photosEmpty) {
      Utils.addClass(this.photosEmpty, 'hidden');
    }
    
    if (this.photosError) {
      Utils.addClass(this.photosError, 'hidden');
    }
    
    if (this.loadMoreContainer) {
      Utils.addClass(this.loadMoreContainer, 'hidden');
    }
  }
  
  /**
   * Mostra estado vazio
   */
  showEmptyState() {
    if (this.photosLoading) {
      Utils.addClass(this.photosLoading, 'hidden');
    }
    
    if (this.photosGrid) {
      Utils.addClass(this.photosGrid, 'hidden');
    }
    
    if (this.photosEmpty) {
      Utils.removeClass(this.photosEmpty, 'hidden');
    }
    
    if (this.photosError) {
      Utils.addClass(this.photosError, 'hidden');
    }
    
    if (this.loadMoreContainer) {
      Utils.addClass(this.loadMoreContainer, 'hidden');
    }
  }
  
  /**
   * Mostra estado de erro
   */
  showErrorState() {
    if (this.photosLoading) {
      Utils.addClass(this.photosLoading, 'hidden');
    }
    
    if (this.photosGrid) {
      Utils.addClass(this.photosGrid, 'hidden');
    }
    
    if (this.photosEmpty) {
      Utils.addClass(this.photosEmpty, 'hidden');
    }
    
    if (this.photosError) {
      Utils.removeClass(this.photosError, 'hidden');
    }
    
    if (this.loadMoreContainer) {
      Utils.addClass(this.loadMoreContainer, 'hidden');
    }
  }
  
  /**
   * Renderiza fotos com lazy loading
   */
  renderPhotos() {
    if (!this.photosGrid || !Array.isArray(this.photos)) {
      return;
    }
    
    // Mostrar grid
    this.hideAllStates();
    Utils.removeClass(this.photosGrid, 'hidden');
    
    // Remover classe de subcategorias se existir
    Utils.removeClass(this.photosGrid, 'subcategories-grid');
    
    // Template da foto
    const template = Utils.$('#photoCardTemplate');
    if (!template) {
      console.error('❌ Template de foto não encontrado');
      return;
    }
    
    // Limpar grid se for primeira página
    if (this.currentPage === 1) {
      this.photosGrid.innerHTML = '';
    }
    
    // Renderizar apenas fotos novas (para paginação)
    const startIndex = (this.currentPage - 1) * this.photosPerPage;
    const photosToRender = this.photos.slice(startIndex);
    
    photosToRender.forEach((photo, index) => {
      const photoCard = this.createPhotoCard(photo, template);
      if (photoCard) {
        this.photosGrid.appendChild(photoCard);
      }
    });
    
    // Implementar lazy loading para as imagens recém-adicionadas
    this.setupLazyLoading();
    
    console.log(`✅ ${photosToRender.length} fotos renderizadas (página ${this.currentPage})`);
  }
  
  /**
   * Configura lazy loading para imagens
   */
  setupLazyLoading() {
    const images = this.photosGrid.querySelectorAll('img[data-src]');
    
    if (images.length === 0) return;
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.dataset.src;
          
          if (src) {
            // Mostrar placeholder de loading
            Utils.addClass(img.parentElement, 'loading');
            
            img.src = src;
            img.removeAttribute('data-src');
            
            img.onload = () => {
              Utils.removeClass(img.parentElement, 'loading');
              Utils.addClass(img, 'loaded');
            };
            
            img.onerror = () => {
              Utils.removeClass(img.parentElement, 'loading');
              img.src = this.getDefaultPhotoImage();
            };
            
            observer.unobserve(img);
          }
        }
      });
    }, {
      root: null,
      rootMargin: '50px',
      threshold: 0.1
    });
    
    images.forEach(img => {
      imageObserver.observe(img);
    });
  }
  
  /**
   * Cria card de foto com lazy loading
   */
  createPhotoCard(photo, template) {
    try {
      // Clonar template
      const cardElement = template.content.cloneNode(true);
      const card = cardElement.querySelector('.photo-card');
      
      if (!card) return null;
      
      // Definir dados
      card.dataset.photoId = photo.id || photo.photoId;
      
      // Imagem da foto com lazy loading
      const image = card.querySelector('.photo-image');
      if (image) {
        const imageUrl = this.getPhotoImageUrl(photo);
        
        // Usar data-src para lazy loading
        image.dataset.src = imageUrl;
        image.alt = photo.name || 'Foto da galeria';
        
        // Placeholder inicial
        image.src = this.getPlaceholderImage();
      }
      
      // Título da foto
      const title = card.querySelector('.photo-title');
      if (title) {
        title.textContent = photo.name || photo.filename || 'Foto sem nome';
      }
      
      // Preço da foto
      const price = card.querySelector('.photo-price');
      if (price) {
        if (photo.price !== undefined && photo.price !== null) {
          price.textContent = this.formatPrice(photo.price);
        } else {
          price.textContent = 'Consulte preço';
        }
      }
      
      // Adicionar acessibilidade
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Ver detalhes da foto ${photo.name || 'sem nome'}`);
      
      // Suporte a teclado
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.openPhoto(photo.id || photo.photoId);
        }
      });
      
      return cardElement;
      
    } catch (error) {
      console.error('❌ Erro ao criar card de foto:', error);
      return null;
    }
  }
  
  /**
   * Imagem placeholder para lazy loading
   */
  getPlaceholderImage() {
    const svg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#252542"/>
        <circle cx="200" cy="150" r="30" fill="#4c6ef5" opacity="0.3">
          <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        <text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" fill="#6c757d" font-family="Arial, sans-serif" font-size="12">
          Carregando...
        </text>
      </svg>
    `)}`;
    
    return svg;
  }
  
  /**
   * Cria card de foto
   */
  createPhotoCard(photo, template) {
    try {
      // Clonar template
      const cardElement = template.content.cloneNode(true);
      const card = cardElement.querySelector('.photo-card');
      
      if (!card) return null;
      
      // Definir dados
      card.dataset.photoId = photo.id || photo.photoId;
      
      // Imagem da foto
      const image = card.querySelector('.photo-image');
      if (image) {
        const imageUrl = this.getPhotoImageUrl(photo);
        image.src = imageUrl;
        image.alt = photo.name || 'Foto da galeria';
        
        // Fallback para erro de imagem
        image.onerror = () => {
          image.src = this.getDefaultPhotoImage();
        };
      }
      
      // Título da foto
      const title = card.querySelector('.photo-title');
      if (title) {
        title.textContent = photo.name || photo.filename || 'Foto sem nome';
      }
      
      // Preço da foto
      const price = card.querySelector('.photo-price');
      if (price) {
        if (photo.price !== undefined && photo.price !== null) {
          price.textContent = this.formatPrice(photo.price);
        } else {
          price.textContent = 'Consulte preço';
        }
      }
      
      // Adicionar acessibilidade
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Ver detalhes da foto ${photo.name || 'sem nome'}`);
      
      // Suporte a teclado
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.openPhoto(photo.id || photo.photoId);
        }
      });
      
      return cardElement;
      
    } catch (error) {
      console.error('❌ Erro ao criar card de foto:', error);
      return null;
    }
  }
  
  /**
   * Obtém URL da imagem para foto
   */
  getPhotoImageUrl(photo) {
    // Se foto tem thumbnail
    if (photo.thumbnail) {
      return window.API.getImageUrl(photo.thumbnail);
    }
    
    // Se foto tem highres (usar thumbnail)
    if (photo.highres) {
      return window.API.getImageUrl(photo.highres, { thumbnail: true });
    }
    
    // Se tem ID, construir URL
    if (photo.id) {
      return window.API.getImageUrl(photo.id, { thumbnail: true });
    }
    
    // Imagem padrão
    return this.getDefaultPhotoImage();
  }
  
  /**
   * Imagem padrão para fotos
   */
  getDefaultPhotoImage() {
    const svg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#1e1e2e"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6c757d" font-family="Arial, sans-serif" font-size="24">
          📷
        </text>
        <text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" fill="#6c757d" font-family="Arial, sans-serif" font-size="14">
          Foto
        </text>
      </svg>
    `)}`;
    
    return svg;
  }
  
  /**
   * Formata preço
   */
  formatPrice(price) {
    if (typeof price === 'number') {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(price);
    }
    
    return `R$ ${price}`;
  }
  
  /**
   * Atualiza botão carregar mais
   */
  updateLoadMoreButton() {
    if (!this.loadMoreContainer || !this.loadMoreBtn) return;
    
    if (this.hasMorePages) {
      Utils.removeClass(this.loadMoreContainer, 'hidden');
      Utils.setButtonLoading(this.loadMoreBtn, false);
    } else {
      Utils.addClass(this.loadMoreContainer, 'hidden');
    }
  }
  
  /**
   * Atualiza título da categoria
   */
  updateCategoryTitle(categoryName) {
    this.categoryName = categoryName;
    
    if (this.categoryTitleEl) {
      this.categoryTitleEl.textContent = categoryName;
    }
  }
  
  /**
   * Esconde todos os estados
   */
  hideAllStates() {
    if (this.photosLoading) {
      Utils.addClass(this.photosLoading, 'hidden');
    }
    if (this.photosEmpty) {
      Utils.addClass(this.photosEmpty, 'hidden');
    }
    if (this.photosError) {
      Utils.addClass(this.photosError, 'hidden');
    }
  }
  
  /**
   * Abre foto
   */
  openPhoto(photoId) {
    if (!photoId) return;
    
    console.log('📷 Abrindo foto:', photoId);
    
    // Por enquanto, apenas log
    // Futuramente pode abrir modal ou página de detalhes
    alert(`Foto ID: ${photoId}\n\nEm breve: visualização detalhada da foto!`);
  }
  
  /**
   * Volta para galeria
   */
  goBack() {
    window.history.back();
  }
  
  /**
   * Lida com logout
   */
  handleLogout() {
    console.log('👋 Fazendo logout...');
    
    if (confirm('Tem certeza que deseja sair?')) {
      window.API.logout();
      window.Router.redirectToLogin();
    }
  }
  
  /**
   * Método de debug
   */
  debug() {
    console.log('🔍 Category Page Debug Info:', {
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      photosCount: this.photos.length,
      currentPage: this.currentPage,
      hasMorePages: this.hasMorePages,
      isLoading: this.isLoading,
      isAuthenticated: window.API?.isAuthenticated(),
      customerCode: window.API?.customerCode
    });
  }
}

// Inicializar página
const categoryPage = new CategoryPage();

// Expor para debug
window.CategoryPage = categoryPage;