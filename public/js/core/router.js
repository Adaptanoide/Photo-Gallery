/**
 * SUNSHINE COWHIDES - ROUTER
 * Sistema de roteamento e navegação
 */

class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.previousRoute = null;
    
    // Middleware hooks
    this.beforeRouteChange = [];
    this.afterRouteChange = [];
    
    // Configurar rotas padrão
    this.setupDefaultRoutes();
    
    // Escutar mudanças na URL
    this.setupEventListeners();
  }
  
  /**
   * Configura rotas padrão
   */
  setupDefaultRoutes() {
    // Definir rotas da aplicação
    this.routes.set('/', {
      path: '/',
      redirect: '/pages/index.html',
      name: 'home'
    });
    
    this.routes.set('/pages/index.html', {
      path: '/pages/index.html',
      name: 'login',
      title: 'Login - Sunshine Cowhides Gallery',
      requiresAuth: false,
      component: 'LoginPage'
    });
    
    this.routes.set('/pages/gallery.html', {
      path: '/pages/gallery.html',
      name: 'gallery',
      title: 'Galeria - Sunshine Cowhides Gallery',
      requiresAuth: true,
      component: 'GalleryPage'
    });
    
    this.routes.set('/pages/category.html', {
      path: '/pages/category.html',
      name: 'category',
      title: 'Categoria - Sunshine Cowhides Gallery',
      requiresAuth: true,
      component: 'CategoryPage'
    });
    
    this.routes.set('/pages/cart.html', {
      path: '/pages/cart.html',
      name: 'cart',
      title: 'Carrinho - Sunshine Cowhides Gallery',
      requiresAuth: true,
      component: 'CartPage'
    });
  }
  
  /**
   * Configura event listeners
   */
  setupEventListeners() {
    // Navegação com back/forward do navegador
    window.addEventListener('popstate', (event) => {
      const route = this.getCurrentRoute();
      if (route) {
        this.navigateToRoute(route, false);
      }
    });
    
    // Interceptar cliques em links internos
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]');
      if (link && this.isInternalLink(link.href)) {
        event.preventDefault();
        this.navigate(link.href);
      }
    });
    
    // Debug: log route changes
    this.afterRouteChange.push((route) => {
      console.log(`🚀 Navegou para: ${route.name} (${route.path})`);
    });
  }
  
  /**
   * Verifica se é um link interno
   */
  isInternalLink(href) {
    try {
      const url = new URL(href, window.location.origin);
      return url.origin === window.location.origin && this.routes.has(url.pathname);
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Adiciona middleware antes da mudança de rota
   */
  addBeforeRouteChange(middleware) {
    this.beforeRouteChange.push(middleware);
  }
  
  /**
   * Adiciona middleware após mudança de rota
   */
  addAfterRouteChange(middleware) {
    this.afterRouteChange.push(middleware);
  }
  
  /**
   * Registra uma nova rota
   */
  register(path, config) {
    this.routes.set(path, {
      path,
      ...config
    });
  }
  
  /**
   * Navega para uma rota
   */
  async navigate(path, addToHistory = true) {
    const route = this.routes.get(path);
    
    if (!route) {
      console.error(`❌ Rota não encontrada: ${path}`);
      this.navigate('/pages/index.html');
      return false;
    }
    
    return await this.navigateToRoute(route, addToHistory);
  }
  
  /**
   * Navega para uma rota específica
   */
  async navigateToRoute(route, addToHistory = true) {
    try {
      // Executar middleware de before
      for (const middleware of this.beforeRouteChange) {
        const result = await middleware(route, this.currentRoute);
        if (result === false) {
          console.log('🚫 Navegação cancelada pelo middleware');
          return false;
        }
      }
      
      // Verificar autenticação
      if (route.requiresAuth && !this.isAuthenticated()) {
        console.log('🔒 Redirecionando para login - autenticação necessária');
        return this.navigate('/pages/index.html?redirect=' + encodeURIComponent(route.path));
      }
      
      // Se é um redirect, navegar para o destino
      if (route.redirect) {
        return this.navigate(route.redirect, addToHistory);
      }
      
      // Salvar rota anterior
      this.previousRoute = this.currentRoute;
      this.currentRoute = route;
      
      // Atualizar URL se necessário
      if (addToHistory && window.location.pathname !== route.path) {
        history.pushState({ route: route.name }, route.title, route.path);
      }
      
      // Atualizar título da página
      if (route.title) {
        document.title = route.title;
      }
      
      // Se já estamos na página correta, não recarregar
      if (window.location.pathname === route.path) {
        // Executar middleware de after
        for (const middleware of this.afterRouteChange) {
          await middleware(route, this.previousRoute);
        }
        return true;
      }
      
      // Redirecionar para a página
      window.location.href = route.path;
      
      return true;
      
    } catch (error) {
      console.error('❌ Erro na navegação:', error);
      return false;
    }
  }
  
  /**
   * Volta para a página anterior
   */
  back() {
    if (this.previousRoute) {
      this.navigate(this.previousRoute.path);
    } else {
      history.back();
    }
  }
  
  /**
   * Vai para a página seguinte
   */
  forward() {
    history.forward();
  }
  
  /**
   * Recarrega a página atual
   */
  reload() {
    window.location.reload();
  }
  
  /**
   * Obtém a rota atual baseada na URL
   */
  getCurrentRoute() {
    const path = window.location.pathname;
    return this.routes.get(path);
  }
  
  /**
   * Obtém parâmetros da URL
   */
  getParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const params = {};
    
    for (const [key, value] of urlParams.entries()) {
      params[key] = value;
    }
    
    return params;
  }
  
  /**
   * Adiciona parâmetro à URL atual
   */
  addParam(key, value) {
    const url = new URL(window.location);
    url.searchParams.set(key, value);
    history.replaceState({}, '', url);
  }
  
  /**
   * Remove parâmetro da URL atual
   */
  removeParam(key) {
    const url = new URL(window.location);
    url.searchParams.delete(key);
    history.replaceState({}, '', url);
  }
  
  /**
   * Verifica se usuário está autenticado
   */
  isAuthenticated() {
    return window.API && window.API.isAuthenticated();
  }
  
  /**
   * Redireciona para login
   */
  redirectToLogin(returnUrl = null) {
    const url = returnUrl ? 
      `/pages/index.html?redirect=${encodeURIComponent(returnUrl)}` : 
      '/pages/index.html';
    this.navigate(url);
  }
  
  /**
   * Redireciona para galeria
   */
  redirectToGallery() {
    this.navigate('/pages/gallery.html');
  }
  
  /**
   * Redireciona para carrinho
   */
  redirectToCart() {
    this.navigate('/pages/cart.html');
  }
  
  /**
   * Guarda de rota para autenticação
   */
  setupAuthGuard() {
    this.addBeforeRouteChange(async (toRoute, fromRoute) => {
      if (toRoute.requiresAuth && !this.isAuthenticated()) {
        console.log('🔒 Acesso negado - redirecionando para login');
        this.redirectToLogin(toRoute.path);
        return false;
      }
      return true;
    });
  }
  
  /**
   * Guarda de rota para páginas de guest (só para não logados)
   */
  setupGuestGuard() {
    this.addBeforeRouteChange(async (toRoute, fromRoute) => {
      if (toRoute.name === 'login' && this.isAuthenticated()) {
        console.log('📱 Já logado - redirecionando para galeria');
        this.redirectToGallery();
        return false;
      }
      return true;
    });
  }
  
  /**
   * Inicializa o router
   */
  init() {
    // Configurar guardas de rota
    this.setupAuthGuard();
    this.setupGuestGuard();
    
    // Processar rota atual
    const currentRoute = this.getCurrentRoute();
    if (currentRoute) {
      this.navigateToRoute(currentRoute, false);
    }
    
    console.log('🧭 Router inicializado');
  }
  
  /**
   * Debug info
   */
  debug() {
    console.log('🔍 Router Debug Info:', {
      currentRoute: this.currentRoute,
      previousRoute: this.previousRoute,
      isAuthenticated: this.isAuthenticated(),
      currentPath: window.location.pathname,
      params: this.getParams(),
      registeredRoutes: Array.from(this.routes.keys())
    });
  }
}

// Classe para gerenciar breadcrumbs
class Breadcrumb {
  constructor(router) {
    this.router = router;
    this.container = null;
    this.breadcrumbs = [];
    
    // Escutar mudanças de rota
    this.router.addAfterRouteChange((route) => {
      this.updateBreadcrumbs(route);
    });
  }
  
  /**
   * Define container dos breadcrumbs
   */
  setContainer(selector) {
    this.container = Utils.$(selector);
  }
  
  /**
   * Adiciona breadcrumb
   */
  add(name, path = null, icon = null) {
    this.breadcrumbs.push({ name, path, icon });
    this.render();
  }
  
  /**
   * Limpa breadcrumbs
   */
  clear() {
    this.breadcrumbs = [];
    this.render();
  }
  
  /**
   * Atualiza breadcrumbs baseado na rota
   */
  updateBreadcrumbs(route) {
    this.clear();
    
    // Adicionar breadcrumbs baseado na rota
    switch (route.name) {
      case 'login':
        this.add('Login');
        break;
        
      case 'gallery':
        this.add('Início', '/pages/gallery.html', '🏠');
        this.add('Galeria');
        break;
        
      case 'category':
        this.add('Início', '/pages/gallery.html', '🏠');
        this.add('Galeria', '/pages/gallery.html');
        
        // Adicionar categoria atual se disponível
        const params = this.router.getParams();
        if (params.category) {
          this.add(decodeURIComponent(params.category));
        }
        break;
        
      case 'cart':
        this.add('Início', '/pages/gallery.html', '🏠');
        this.add('Carrinho', null, '🛒');
        break;
    }
  }
  
  /**
   * Renderiza breadcrumbs
   */
  render() {
    if (!this.container) return;
    
    if (this.breadcrumbs.length === 0) {
      this.container.innerHTML = '';
      return;
    }
    
    const breadcrumbsHTML = this.breadcrumbs.map((crumb, index) => {
      const isLast = index === this.breadcrumbs.length - 1;
      const icon = crumb.icon ? `<span class="breadcrumb-icon">${crumb.icon}</span>` : '';
      
      if (isLast || !crumb.path) {
        return `
          <span class="breadcrumb-item current">
            ${icon}
            <span class="breadcrumb-text">${Utils.sanitizeString(crumb.name)}</span>
          </span>
        `;
      }
      
      return `
        <a href="${crumb.path}" class="breadcrumb-item">
          ${icon}
          <span class="breadcrumb-text">${Utils.sanitizeString(crumb.name)}</span>
        </a>
        <span class="breadcrumb-separator">›</span>
      `;
    }).join('');
    
    this.container.innerHTML = `<nav class="breadcrumb" aria-label="Breadcrumb">${breadcrumbsHTML}</nav>`;
  }
}

// Criar instância global do router
window.Router = new Router();

// Criar instância global do breadcrumb
window.Breadcrumb = new Breadcrumb(window.Router);

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.Router.init();
  });
} else {
  window.Router.init();
}