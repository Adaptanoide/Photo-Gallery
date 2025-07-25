/**
 * SUNSHINE COWHIDES - API CLIENT (VERSÃO LIMPA)
 * Sistema de comunicação com o backend existente
 */

class ApiClient {
  constructor() {
    this.baseURL = window.location.origin;
    this.timeout = 30000;
    
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    this.customerCode = null;
    this.loadCustomerCode();
  }
  
  async request(endpoint, options = {}) {
    const config = {
      method: 'GET',
      headers: { ...this.defaultHeaders },
      ...options
    };
    
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        ...config,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
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
      
      return data;
      
    } catch (error) {
      if (error.name === 'AbortError') {
        error.message = 'Requisição cancelada por timeout';
      } else if (error instanceof TypeError) {
        error.message = 'Erro de rede. Verifique sua conexão.';
      }
      
      throw error;
    }
  }
  
  async get(endpoint, params = {}) {
    let url = endpoint;
    
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
  
  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  setCustomerCode(code) {
    this.customerCode = code;
    this.saveToStorage('customer_code', code);
  }
  
  loadCustomerCode() {
    const code = this.loadFromStorage('customer_code');
    if (code) {
      this.customerCode = code;
      return true;
    }
    return false;
  }
  
  clearAuth() {
    this.customerCode = null;
    this.removeFromStorage('customer_code');
    this.removeFromStorage('customer_data');
  }
  
  // Métodos auxiliares para localStorage
  saveToStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Erro ao salvar:', error);
      return false;
    }
  }
  
  loadFromStorage(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Erro ao carregar:', error);
      return defaultValue;
    }
  }
  
  removeFromStorage(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Erro ao remover:', error);
      return false;
    }
  }
}

class SunshineAPI extends ApiClient {
  constructor() {
    super();
  }
  
  // === AUTH METHODS ===
  
  async verifyCode(code) {
    try {
      const response = await this.get('/api/client/initial-data', { code });
      
      if (response && (response.success !== false)) {
        this.setCustomerCode(code);
        
        if (response.customerName) {
          this.saveToStorage('customer_data', {
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
  
  logout() {
    this.clearAuth();
  }
  
  // === CLIENT ENDPOINTS ===
  
  async getInitialData() {
    if (!this.customerCode) {
      throw new Error('Código do cliente não encontrado');
    }
    
    return await this.get('/api/client/initial-data', { 
      code: this.customerCode 
    });
  }
  
  // === PHOTOS ENDPOINTS ===
  
  async getCategories() {
    const params = {};
    
    if (this.customerCode) {
      params.customer_code = this.customerCode;
    }
    
    return await this.get('/api/photos/categories', params);
  }
  
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
  
  async getGalleryPhotos(params = {}) {
    return await this.getPhotos(params);
  }
  
  // === CLIENT SELECTIONS ===
  
  async saveSelections(selections) {
    return await this.post('/api/client/selections', {
      customer_code: this.customerCode,
      selections: selections
    });
  }
  
  // === UTILITY METHODS ===
  
  getImageUrl(imagePath, options = {}) {
    if (!imagePath) return '';
    
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    
    if (imagePath.startsWith('/api')) {
      return `${this.baseURL}${imagePath}`;
    }
    
    if (options.thumbnail) {
      return `${this.baseURL}/api/photos/local/thumbnail/${imagePath}`;
    }
    
    return `${this.baseURL}/api/photos/local/${imagePath}`;
  }
  
  isAuthenticated() {
    return !!this.customerCode;
  }
  
  getCustomerData() {
    return this.loadFromStorage('customer_data');
  }
  
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