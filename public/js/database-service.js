// database-service.js
// Esta camada de abstração permite comunicação com o MongoDB via API REST

let db = null;
let auth = null;
let currentCustomerCode = null; // Mantemos esta variável global

// Classe para emular comportamento do Firebase para compatibilidade
class Database {
  constructor() {
    this.collections = {};
    this.isInitialized = false;
  }
  
  collection(name) {
    if (!this.collections[name]) {
      this.collections[name] = new Collection(name);
    }
    return this.collections[name];
  }
}

class Collection {
  constructor(name) {
    this.name = name;
  }
  
  doc(id) {
    return new Document(this.name, id);
  }
  
  async get() {
    try {
      const response = await fetch(`/api/db/${this.name}`);
      const data = await response.json();
      
      return {
        empty: data.length === 0,
        size: data.length,
        docs: data.map(item => {
          return {
            id: item.code || item._id,
            data: () => {
              const { _id, __v, ...rest } = item;
              return rest;
            },
            exists: true
          };
        }),
        forEach: function(callback) {
          this.docs.forEach(callback);
        }
      };
    } catch (error) {
      console.error(`Error getting collection ${this.name}:`, error);
      throw error;
    }
  }
  
  orderBy(field, direction = 'asc') {
    // Implementação simples - na prática, isso seria armazenado e usado na requisição
    return this;
  }
}

class Document {
  constructor(collection, id) {
    this.collection = collection;
    this.id = id;
  }
  
  async get() {
    try {
      const response = await fetch(`/api/db/${this.collection}/${this.id}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return {
            exists: false,
            data: () => null,
            id: this.id
          };
        }
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        exists: true,
        data: () => {
          const { _id, __v, ...rest } = data;
          return rest;
        },
        id: this.id
      };
    } catch (error) {
      console.error(`Error getting document ${this.id}:`, error);
      return {
        exists: false,
        data: () => null,
        id: this.id
      };
    }
  }
  
  async update(data) {
    try {
      // Para CustomerCode com items, usamos um endpoint especial para salvar seleções
      if (this.collection === 'customerCodes' && data.items !== undefined) {
        const response = await fetch(`/api/client/selections`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            code: this.id,
            items: data.items
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        
        return true;
      }
      
      // Para outros casos, usar o endpoint genérico
      const response = await fetch(`/api/db/${this.collection}/${this.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      return true;
    } catch (error) {
      console.error(`Error updating document ${this.id}:`, error);
      throw error;
    }
  }
}

// Classe para emular Authentication
class Auth {
  constructor() {
    this.user = null;
  }
  
  onAuthStateChanged(callback) {
    // Simples para compatibilidade
    setTimeout(() => {
      callback(this.user);
    }, 0);
    
    return () => {}; // função para desinscrição
  }
  
  async signOut() {
    this.user = null;
    return true;
  }
}

// Inicializar
db = new Database();
auth = new Auth();

// Compatibilidade com código existente
window.db = db;
window.auth = auth;

console.log('Database service initialized');