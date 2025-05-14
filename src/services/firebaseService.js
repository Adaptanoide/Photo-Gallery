// services/firebaseService.js
const { db } = require('../config/firebase');

// Verificar código de cliente
async function verifyCustomerCode(code) {
  try {
    const docRef = db.collection('customerCodes').doc(code);
    const doc = await docRef.get();
    
    if (doc.exists) {
      // Atualizar último acesso
      await docRef.update({
        lastAccess: new Date()
      });
      
      return {
        success: true,
        code: code,
        customerName: doc.data().customerName,
        items: doc.data().items || []
      };
    } else {
      return {
        success: false,
        message: 'Código inválido'
      };
    }
  } catch (error) {
    console.error('Erro ao verificar código:', error);
    return {
      success: false,
      message: `Erro ao verificar código: ${error.message}`
    };
  }
}

// Verificar credenciais de admin
async function verifyAdminCredentials(email, password) {
  // Nota: Aqui estamos usando credenciais fixas para corresponder ao seu código original
  // Em produção, você deve usar um método mais seguro como bcrypt
  const ADMIN_EMAIL = "sales.sunshinecowhides@gmail.com";
  const ADMIN_PASSWORD = "SUNcow1!";
  
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    return { success: true };
  } else {
    return { success: false, message: "Credenciais inválidas" };
  }
}

// Gerar novo código de cliente
async function generateCustomerCode(customerName) {
  try {
    // Gerar código aleatório de 4 dígitos
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Verificar se o código já existe
    const docRef = db.collection('customerCodes').doc(code);
    const doc = await docRef.get();
    
    if (doc.exists) {
      // Se existir, tentar novamente com outro código
      return generateCustomerCode(customerName);
    }
    
    // Salvar novo código
    await docRef.set({
      code: code,
      customerName: customerName,
      createdAt: new Date(),
      items: []
    });
    
    return {
      success: true,
      code: code
    };
  } catch (error) {
    console.error('Erro ao gerar código:', error);
    return {
      success: false,
      message: `Erro ao gerar código: ${error.message}`
    };
  }
}

// Carregar códigos ativos
async function getActiveCodes() {
  try {
    const snapshot = await db.collection('customerCodes')
      .orderBy('createdAt', 'desc')
      .get();
    
    const codes = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      codes.push({
        code: data.code,
        customerName: data.customerName || 'Anônimo',
        createdAt: data.createdAt ? data.createdAt.toDate() : new Date()
      });
    });
    
    return {
      success: true,
      codes: codes
    };
  } catch (error) {
    console.error('Erro ao carregar códigos:', error);
    return {
      success: false,
      message: `Erro ao carregar códigos: ${error.message}`
    };
  }
}

// Salvar seleções do cliente
async function saveCustomerSelections(code, items) {
  try {
    const docRef = db.collection('customerCodes').doc(code);
    await docRef.update({
      items: items,
      lastUpdated: new Date()
    });
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Erro ao salvar seleções:', error);
    return {
      success: false,
      message: `Erro ao salvar seleções: ${error.message}`
    };
  }
}

// Deletar código de cliente
async function deleteCustomerCode(code) {
  try {
    const docRef = db.collection('customerCodes').doc(code);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return {
        success: false,
        message: 'Código não encontrado'
      };
    }
    
    await docRef.delete();
    
    return {
      success: true,
      message: 'Código excluído com sucesso'
    };
  } catch (error) {
    console.error('Erro ao deletar código:', error);
    return {
      success: false,
      message: `Erro ao deletar código: ${error.message}`
    };
  }
}

// Obter configurações de acesso a categorias para um cliente
async function getCustomerCategoryAccess(customerCode) {
  try {
    const docRef = db.collection('customerCategoryAccess').doc(customerCode);
    const doc = await docRef.get();
    
    if (doc.exists) {
      return {
        success: true,
        data: doc.data()
      };
    } else {
      // Se não existir, retornar um objeto vazio (todas as categorias permitidas por padrão)
      return {
        success: true,
        data: {
          categoryAccess: []
        }
      };
    }
  } catch (error) {
    console.error('Erro ao obter configurações de acesso:', error);
    return {
      success: false,
      message: `Erro ao obter configurações de acesso: ${error.message}`
    };
  }
}

// Salvar configurações de acesso a categorias para um cliente
async function saveCustomerCategoryAccess(customerCode, categoryAccessData) {
  try {
    const docRef = db.collection('customerCategoryAccess').doc(customerCode);
    await docRef.set(categoryAccessData, { merge: true });
    
    return {
      success: true,
      message: 'Configurações de acesso salvas com sucesso'
    };
  } catch (error) {
    console.error('Erro ao salvar configurações de acesso:', error);
    return {
      success: false,
      message: `Erro ao salvar configurações de acesso: ${error.message}`
    };
  }
}


module.exports = {
  verifyCustomerCode,
  verifyAdminCredentials,
  generateCustomerCode,
  getActiveCodes,
  deleteCustomerCode,
  saveCustomerSelections,
  getCustomerCategoryAccess,
  saveCustomerCategoryAccess
};