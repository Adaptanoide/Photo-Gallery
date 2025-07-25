/**
 * SUNSHINE COWHIDES - API CLIENT
 * Sistema de comunicação com o backend
 */

class ApiClient {
  constructor() {
    this.baseURL = window.location.origin;
    this.timeout = 30000; // 30 segundos
    
    // Headers padrão
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Token de autenticação (será definido após login)
    this.authToken = null;
    
    // Interceptors
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    
    // Configurar interceptors padrão
    this.setupDefaultInterceptors();
  }
  
  /**
   * Configura interceptors padrão
   */
  setupDefaultInterceptors() {
    // Request interceptor para adicionar token
    this.addRequestInterceptor((config) => {
      if (this.authToken) {
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${this.authToken}`
        };
      }
      return config;
    });
    
    // Response interceptor para tratamento de erros
    this.addResponseInterceptor(
      (response) => response,
      (error) => {
        console.error('API Error:', error);
        
        // Se erro 401, limpar token e redirecionar para login
        if (error.status === 401) {
          this.clearAuth();
          if (window.location.pathname !== '/pages/index.html') {
            window.location.href = '/pages/index.html';
          }
        }
        
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Adiciona interceptor de request
   * @param {Function} interceptor 
   */
  addRequestInterceptor(interceptor) {
    this.requestInterceptors.push(interceptor);
  }
  
  /**
   * Adiciona interceptor de response
   * @param {Function} onFulfilled 
   * @param {Function} onRejected 
   */
  addResponseInterceptor(onFulfilled, onRejected) {
    this.responseInterceptors.push({ onFulfilled, onRejected });
  }
  
  /**
   * Processa interceptors de request
   * @param {Object} config 
   * @returns {Object}
   */
  processRequestInterceptors(config) {
    return this.requestInterceptors.reduce((config, interceptor) => {
      return interceptor(config) || config;
    }, config);
  }
  
  /**
   * Processa interceptors de response
   * @param {Response|Error} response 
   * @param {boolean} isError 
   * @returns {Promise}
   */
  async processResponseInterceptors(response, isError = false) {
    let result = response;
    
    for (const interceptor of this.responseInterceptors) {
      try {
        if (isError && interceptor.onRejected) {
          result = await interceptor.onRejected(result);
        } else if (!isError && interceptor.onFulfilled) {
          result = await interceptor.onFulfilled(result);
        }
      } catch (error) {
        result = error;
        isError = true;
      }
    }
    
    if (isError) {
      throw result;
    }
    
    return result;
  }
  
  /**
   * Faz uma requisição HTTP
   * @param {string} endpoint 
   * @param {Object} options 
   * @returns {Promise}
   */
  async request(endpoint, options = {}) {
    const config = {
      method: 'GET',
      headers: { ...this.defaultHeaders },
      ...options
    };
    
    // Processar interceptors de request
    const processedConfig = this.processRequestInterceptors(config);
    
    // Construir URL completa
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
    
    try {
      // Controller para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      // Fazer requisição
      const response = await fetch(url, {
        ...processedConfig,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Processar response
      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
      
      if (!response.ok) {
        const error = new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }
      
      const result = { data, status: response.status, headers: response.headers };
      
      // Processar interceptors de response
      return await this.processResponseInterceptors(result);
      
    } catch (error) {
      // Tratar diferentes tipos de erro
      if (error.name === 'AbortError') {
        error.message = 'Requisição cancelada por timeout';
      } else if (error instanceof TypeError) {
        error.message = 'Erro de rede. Verifique sua conexão.';
      }
      
      // Processar interceptors de error
      return await this.processResponseInterceptors(error, true);
    }
  }
  
  /**
   * GET request
   * @param {string} endpoint 
   * @param {Object} params 
   * @returns {Promise}
   */
  async get(endpoint, params = {}) {
    let url = endpoint;
    
    // Adicionar parâmetros de query
    if (Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          searchParams.append(key, value);
        }
      });
      url += '?' + searchParams.toString();
    }
    
    return this.request(url, { method: 'GET' });
  }
  
  /**
   * POST request
   * @param {string} endpoint 
   * @param {Object} data 
   * @returns {Promise}
   */
  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  /**
   * PUT request
   * @param {string} endpoint 
   * @param {Object} data 
   * @returns {Promise}
   */
  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
  
  /**
   * DELETE request
   * @param {string} endpoint 
   * @returns {Promise}
   */
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
  
  /**
   * Upload de arquivo
   * @param {string} endpoint 
   * @param {FormData} formData 
   * @returns {Promise}
   */
  async upload(endpoint, formData) {
    return this.request(endpoint, {
      method: 'POST',
      body: formData,
      headers: {} // Remove Content-Type para FormData
    });
  }
  
  /**
   * Define token de autenticação
   * @param {string} token 
   */
  setAuthToken(token) {
    this.authToken = token;
    Utils.saveToStorage('auth_token', token);
  }
  
  /**
   * Carrega token de autenticação do storage
   */
  loadAuthToken() {
    const token = Utils.loadFromStorage('auth_token');
    if (token) {
      this.authToken = token;
      return true;
    }
    return false;
  }
  
  /**
   * Limpa autenticação
   */
  clearAuth() {
    this.authToken = null;
    Utils.removeFromStorage('auth_token');
    Utils.removeFromStorage('user_data');
  }
}

/**
 * SUNSHINE COWHIDES API ENDPOINTS
 * Métodos específicos para as APIs do sistema
 */
class SunshineAPI extends ApiClient {
  constructor() {
    super();
    this.loadAuthToken();
  }
  
  // === AUTH ENDPOINTS ===
  
  /**
   * Faz login com código de acesso
   * @param {string} code 
   * @returns {Promise}
   */
  async login(code) {
    try {
      const response = await this.post('/api/auth/login', { code });
      
      if (response.data.token) {
        this.setAuthToken(response.data.token);
        
        // Salvar dados do usuário
        if (response.data.user) {
          Utils.saveToStorage('user_data', response.data.user);
        }
      }
      
      return response;
    } catch (error) {
      console.error('Erro no login:', error);
      throw error;
    }
  }
  
  /**
   * Faz logout
   * @returns {Promise}
   */
  async logout() {
    try {
      await this.post('/api/auth/logout');
    } catch (error) {
      console.error('Erro no logout:', error);
    } finally {
      this.clearAuth();
    }
  }
  
  /**
   * Verifica se o token ainda é válido
   * @returns {Promise}
   */
  async verifyToken() {
    try {
      const response = await this.get('/api/auth/verify');
      return response.data.valid;
    } catch (error) {
      this.clearAuth();
      return false;
    }
  }
  
  // === CLIENT ENDPOINTS ===
  
  /**
   * Busca dados iniciais do cliente
   * @returns {Promise}
   */
  async getInitialData() {
    const response = await this.get('/api/client/initial-data');
    return response.data;
  }
  
  /**
   * Busca categorias principais
   * @returns {Promise}
   */
  async getCategories() {
    const response = await this.get('/api/client/categories');
    return response.data;
  }
  
  /**
   * Busca subcategorias de uma categoria
   * @param {string} categoryId 
   * @returns {Promise}
   */
  async getSubcategories(categoryId) {
    const response = await this.get(`/api/client/categories/${categoryId}/subcategories`);
    return response.data;
  }
  
  // === PHOTOS ENDPOINTS ===
  
  /**
   * Busca fotos por categoria
   * @param {string} categoryId 
   * @param {Object} options 
   * @returns {Promise}
   */
  async getPhotos(categoryId, options = {}) {
    const params = {
      category_id: categoryId,
      page: options.page || 1,
      limit: options.limit || 20,
      sort: options.sort || 'name',
      ...options.filters
    };
    
    const response = await this.get('/api/photos', params);
    return response.data;
  }
  
  /**
   * Busca foto específica por ID
   * @param {string} photoId 
   * @returns {Promise}
   */
  async getPhoto(photoId) {
    const response = await this.get(`/api/photos/${photoId}`);
    return response.data;
  }
  
  /**
   * Busca fotos para galeria (com lazy loading)
   * @param {Object} params 
   * @returns {Promise}
   */
  async getGalleryPhotos(params = {}) {
    const defaultParams = {
      page: 1,
      limit: 20,
      format: 'webp',
      size: 'medium'
    };
    
    const response = await this.get('/api/gallery/photos', { ...defaultParams, ...params });
    return response.data;
  }
  
  // === CART ENDPOINTS ===
  
  /**
   * Busca itens do carrinho
   * @returns {Promise}
   */
  async getCart() {
    const response = await this.get('/api/cart');
    return response.data;
  }
  
  /**
   * Adiciona item ao carrinho
   * @param {string} photoId 
   * @param {Object} options 
   * @returns {Promise}
   */
  async addToCart(photoId, options = {}) {
    const response = await this.post('/api/cart/add', {
      photo_id: photoId,
      ...options
    });
    return response.data;
  }
  
  /**
   * Remove item do carrinho
   * @param {string} itemId 
   * @returns {Promise}
   */
  async removeFromCart(itemId) {
    const response = await this.delete(`/api/cart/items/${itemId}`);
    return response.data;
  }
  
  /**
   * Atualiza quantidade no carrinho
   * @param {string} itemId 
   * @param {number} quantity 
   * @returns {Promise}
   */
  async updateCartItem(itemId, quantity) {
    const response = await this.put(`/api/cart/items/${itemId}`, { quantity });
    return response.data;
  }
  
  /**
   * Limpa carrinho
   * @returns {Promise}
   */
  async clearCart() {
    const response = await this.delete('/api/cart/clear');
    return response.data;
  }
  
  // === ORDER ENDPOINTS ===
  
  /**
   * Cria pedido
   * @param {Object} orderData 
   * @returns {Promise}
   */
  async createOrder(orderData) {
    const response = await this.post('/api/orders', orderData);
    return response.data;
  }
  
  /**
   * Busca pedidos do cliente
   * @returns {Promise}
   */
  async getOrders() {
    const response = await this.get('/api/orders');
    return response.data;
  }
  
  /**
   * Busca pedido específico
   * @param {string} orderId 
   * @returns {Promise}
   */
  async getOrder(orderId) {
    const response = await this.get(`/api/orders/${orderId}`);
    return response.data;
  }
  
  // === UTILITY METHODS ===
  
  /**
   * Constrói URL de imagem otimizada
   * @param {string} imagePath 
   * @param {Object} options 
   * @returns {string}
   */
  getImageUrl(imagePath, options = {}) {
    if (!imagePath) return '';
    
    const { size = 'medium', format = 'webp', quality = 80 } = options;
    
    // Se já é uma URL completa, retorna como está
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    
    // Constrói URL otimizada
    const params = new URLSearchParams({
      size,
      format,
      quality: quality.toString()
    });
    
    return `${this.baseURL}/api/images/${encodeURIComponent(imagePath)}?${params}`;
  }
  
  /**
   * Verifica se está logado
   * @returns {boolean}
   */
  isAuthenticated() {
    return !!this.authToken;
  }
  
  /**
   * Busca dados do usuário do storage
   * @returns {Object|null}
   */
  getUserData() {
    return Utils.loadFromStorage('user_data');
  }
}

// Criar instância global da API
window.API = new SunshineAPI();

// Verificar autenticação ao carregar
document.addEventListener('DOMContentLoaded', async () => {
  if (window.API.isAuthenticated()) {
    try {
      const isValid = await window.API.verifyToken();
      if (!isValid) {
        console.log('Token inválido, redirecionando para login...');
        if (window.location.pathname !== '/pages/index.html') {
          window.location.href = '/pages/index.html';
        }
      }
    } catch (error) {
      console.error('Erro ao verificar token:', error);
    }
  }
});