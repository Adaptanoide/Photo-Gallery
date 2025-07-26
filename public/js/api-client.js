// api-client.js
const apiClient = {
  // Admin functions
  verifyAdminCredentials: async function(email, password) {
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const result = await response.json();
      
      // Se login bem sucedido, salvar no localStorage
      if (result.success) {
        localStorage.setItem('adminLoggedIn', 'true');
      }
      
      return result;
    } catch (error) {
      console.error('API error:', error);
      return { success: false, message: error.message };
    }
  },
  
  getPhotos: async function(params = {}) {
    try {
      // Construir a query string a partir dos parâmetros
      const queryParams = [];
      
      if (params.category_id) {
        queryParams.push(`category_id=${params.category_id}`);
      }
      
      if (params.customer_code) {
        queryParams.push(`customer_code=${params.customer_code}`);
      }
      
      // Construir a URL com os parâmetros
      let url = '/api/photos';
      if (queryParams.length > 0) {
        url += '?' + queryParams.join('&');
      }
      
      console.log("Fetching photos with URL:", url); // Log para depuração
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API error:', error);
      return [];
    }
  },
  
  getFolderStructure: async function(queryParams) {
    try {
      console.log("Fetching folder structure with params:", queryParams); // Log para depuração
      
      const response = await fetch(`/api/photos/categories?${queryParams}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API error:', error);
      return [];
    }
  },
  
  getFolderStructure: async function(isAdmin = false) {
    try {
      const response = await fetch(`/api/photos/categories?is_admin=${isAdmin}`);
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      return [];
    }
  },
  
  // Order functions
  sendOrder: async function(customerName, comments, photoIds) {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: currentCustomerCode,
          comments: comments,
          photoIds: photoIds
        })
      });
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      return { success: false, message: error.message };
    }
  },
  
  listOrderFolders: async function(status) {
    try {
      const response = await fetch(`/api/orders/folders?status=${status}`);
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      return { success: false, folders: [], message: error.message };
    }
  },
  
  updateOrderStatus: async function(status, folderId) {
    try {
      const response = await fetch('/api/orders/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, folderId })
      });
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      return { success: false, message: error.message };
    }
  },
  
  listFoldersByStatus: async function(status) {
    // This is an alternative/fallback method
    return this.listOrderFolders(status);
  },

  deleteCustomerCode: async function(code) {
    try {
      const response = await fetch(`/api/admin/code/${code}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      return { success: false, message: error.message };
    }
  },

  getLeafFolders: async function(includeEmpty = false) {
    try {
      // Adicionar o parâmetro include_empty à URL
      const queryParam = includeEmpty ? '?include_empty=true' : '';
      const response = await fetch('/api/admin/folders/leaf' + queryParam);
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      return { success: false, message: error.message };
    }
  },

  getCategoryPrices: async function() {
    try {
      const response = await fetch('/api/admin/categories/prices');
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      return { success: false, message: error.message };
    }
  },

  setCategoryPrice: async function(folderId, price) {
    try {
      const response = await fetch(`/api/admin/categories/${folderId}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price })
      });
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      return { success: false, message: error.message };
    }
  },

  bulkUpdatePrices: async function(updateData) {
    try {
      const response = await fetch('/api/admin/categories/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      return { success: false, message: error.message };
    }
  },

  // Função de teste para verificar a conexão com o backend
  testBackendConnection: async function() {
    try {
      // Tente acessar uma rota existente e confiável
      const response = await fetch('/api/admin/codes');
      const data = await response.json();
      console.log("Conexão com backend OK:", data);
      return { success: true, message: "Conexão com backend OK" };
    } catch (error) {
      console.error("Erro de conexão com backend:", error);
      return { success: false, message: error.message };
    }
  },

  // Obter configurações de acesso a categorias para um cliente
  getCustomerCategoryAccess: async function(customerCode) {
    try {
      const response = await fetch(`/api/admin/customers/${customerCode}/category-access`);
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      return { success: false, message: error.message };
    }
  },

  // Salvar configurações de acesso a categorias para um cliente
  saveCustomerCategoryAccess: async function(customerCode, categoryAccessData) {
    try {
      const response = await fetch(`/api/admin/customers/${customerCode}/category-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryAccessData)
      });
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      return { success: false, message: error.message };
    }
  },

  // Nova função para obter detalhes do pedido
  getOrderDetails: async function(folderId) {
    try {
      const response = await fetch(`/api/orders/details?folderId=${folderId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      return { 
        success: false, 
        message: error.message,
        categories: [],
        comments: ''
      };
    }
  },
  
  // NOVAS FUNÇÕES PARA SUBSTITUIR O FIREBASE
  
  // Salvar seleções do cliente no MongoDB
  saveCustomerSelections: async function(customerCode, items) {
    try {
      const response = await fetch('/api/client/selections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: customerCode,
          items: items
        })
      });
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      return { success: false, message: error.message };
    }
  },

  // Obter dados do cliente do MongoDB
  getCustomerData: async function(customerCode) {
    try {
      const response = await fetch(`/api/db/customerCodes/${customerCode}`);
      if (!response.ok) {
        throw new Error('Customer code not found');
      }
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      return { success: false, message: error.message };
    }
  },
  
  // Encerrar a sessão do administrador
  adminLogout: function() {
    localStorage.removeItem('adminLoggedIn');
    return Promise.resolve({ success: true });
  },
  
  // Verificar estado de login do administrador
  isAdminLoggedIn: function() {
    return localStorage.getItem('adminLoggedIn') === 'true';
  }
};