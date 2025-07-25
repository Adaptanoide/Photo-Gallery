/**
 * SUNSHINE COWHIDES - API CLIENT
 * Sistema de comunicação com o backend existente
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
    
    // Código do cliente (salvo no localStorage)
    this.customerCode = null;
    
    // Carregar código salvo
    this.loadCustomerCode();
  }
  
  /**
   * Faz uma requisição HTTP
   */
  async request(endpoint, options = {}) {
    const config = {
      method: 'GET',
      headers: { ...this.defaultHeaders },
      ...options
    };
    
    // Construir URL completa
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
    
    try {
      // Controller para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      // Fazer requisição
      const response = await fetch(url, {
        ...config,
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
      
      return data; // Retorna dados diretamente (sem wrapper)
      
    } catch (error) {
      // Tratar diferentes tipos de erro
      if (error.name === 'AbortError') {
        error.message = 'Requisição cancelada por timeout';
      } else if (error instanceof TypeError) {
        error.message = 'Erro de rede. Verifique sua conexão.';
      }
      
      throw error;
    }
  }
  
  /**
   * GET request
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
   */
  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  /**
   * Define código do cliente
   */
  setCustomerCode(code) {
    this.customerCode = code;
    Utils.saveToStorage('customer_code', code);
  }
  
  /**
   * Carrega código do cliente do storage
   */
  loadCustomerCode() {
    const code = Utils.loadFromStorage('customer_code');
    if (code) {
      this.customerCode = code;
      return true;
    }
    return false;
  }
  
  /**
   * Limpa autenticação
   */
  clearAuth() {
    this.customerCode = null;
    Utils.removeFromStorage('customer_code');
    Utils.removeFromStorage('customer_data');
  }
}

/**
 * SUNSHINE COWHIDES API ENDPOINTS
 * Métodos específicos para as APIs existentes do sistema
 */
class SunshineAPI extends ApiClient {
  constructor() {
    super();
  }
  
  // === AUTH METHODS ===
  
  /**
   * Verifica código de acesso
   * Baseado em: mongoService.verifyCustomerCode(code)
   */
  async verifyCode(code) {
    try {
      // Usar a rota existente /api/client/initial-data
      const response = await this.get('/api/client/initial-data', { code });
      
      // Verificar se response tem estrutura de sucesso
      if (response && (response.success !== false)) {
        // Salvar código e dados do cliente
        this.setCustomerCode(code);
        
        // Salvar dados do cliente se disponível
        if (response.customerName) {
          Utils.saveToStorage('customer_data', {
            code: code,
            customerName: response.customerName,
            items: response.items || []
          });
        }
        
        return {
          success: true,
          data: response
        };
      } else {
        return {
          success: false,
          message: response.message || 'Código inválido'
        };
      }
      
    } catch (error) {
      console.error('Erro na verificação do código:', error);
      return {
        success: false,
        message: error.message || 'Erro interno. Tente novamente.'
      };
    }
  }
  
  /**
   * Faz logout
   */
  logout() {
    this.clearAuth();
  }
  
  // === CLIENT ENDPOINTS ===
  
  /**
   * Busca dados iniciais do cliente
   * Rota: /api/client/initial-data?code=1234
   */
  async getInitialData() {
    if (!this.customerCode) {
      throw new Error('Código do cliente não encontrado');
    }
    
    return await this.get('/api/client/initial-data', { 
      code: this.customerCode 
    });
  }
  
  // === PHOTOS ENDPOINTS ===
  
  /**
   * Busca categorias
   * Rota: /api/photos/categories?customer_code=1234
   */
  async getCategories() {
    const params = {};
    
    if (this.customerCode) {
      params.customer_code = this.customerCode;
    }
    
    return await this.get('/api/photos/categories', params);
  }
  
  /**
   * Busca fotos por categoria
   * Rota: /api/photos?customer_code=1234&category_id=xyz&limit=50&offset=0
   */
  async getPhotos(options = {}) {
    const params = {
      limit: options.limit || 50,
      offset: options.offset || 0
    };
    
    if (options.categoryId) {
      params.category_id = options.categoryId;
    }
    
    if (this.customerCode) {
      params.customer_code = this.customerCode;
    }
    
    if (options.preload !== undefined) {
      params.preload = options.preload;
    }
    
    return await this.get('/api/photos', params);
  }
  
  /**
   * Busca fotos para galeria (com paginação)
   */
  async getGalleryPhotos(params = {}) {
    return await this.getPhotos(params);
  }
  
  // === CLIENT SELECTIONS ===
  
  /**
   * Salva seleções do cliente
   * Rota: /api/client/selections
   */
  async saveSelections(selections) {
    return await this.post('/api/client/selections', {
      customer_code: this.customerCode,
      selections: selections
    });
  }
  
  // === UTILITY METHODS ===
  
  /**
   * Constrói URL de imagem
   */
  getImageUrl(imagePath, options = {}) {
    if (!imagePath) return '';
    
    // Se já é uma URL completa, retorna como está
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    
    // Se já começa com /api, usar como está
    if (imagePath.startsWith('/api')) {
      return `${this.baseURL}${imagePath}`;
    }
    
    // Construir URL para thumbnail ou imagem normal
    if (options.thumbnail) {
      return `${this.baseURL}/api/photos/local/thumbnail/${imagePath}`;
    }
    
    return `${this.baseURL}/api/photos/local/${imagePath}`;
  }
  
  /**
   * Verifica se está logado
   */
  isAuthenticated() {
    return !!this.customerCode;
  }
  
  /**
   * Busca dados do cliente do storage
   */
  getCustomerData() {
    return Utils.loadFromStorage('customer_data');
  }
  
  /**
   * Limpa cache
   */
  async clearCache() {
    try {
      await this.post('/api/client/clear-cache');
      console.log('✅ Cache limpo com sucesso');
    } catch (error) {
      console.error('❌ Erro ao limpar cache:', error);
    }
  }
}

// Criar instância global da API
window.API = new SunshineAPI();

// Verificar autenticação ao carregar
document.addEventListener('DOMContentLoaded', () => {
  if (window.API.isAuthenticated()) {
    console.log('✅ Cliente autenticado:', window.API.customerCode);
  } else {
    console.log('❌ Cliente não autenticado');
  }
});