// src/services/mongoService.js
const CustomerCode = require('../models/customerCode');
const CategoryAccess = require('../models/categoryAccess');
const CategoryPrice = require('../models/categoryPrice');
const Order = require('../models/order');
const Admin = require('../models/admin');
const bcrypt = require('bcrypt');

// Verificar código de cliente
async function verifyCustomerCode(code) {
  try {
    const customer = await CustomerCode.findOne({ code });
    
    if (customer) {
      // Atualizar último acesso
      customer.lastAccess = new Date();
      await customer.save();
      
      return {
        success: true,
        code: code,
        customerName: customer.customerName,
        items: customer.items || []
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
  try {
    // Usar credenciais fixas para compatibilidade com código original
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "sales.sunshinecowhides@gmail.com";
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "SUNcow1!";
    
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      // Verificar se há admin no banco de dados, se não, criar
      const adminCount = await Admin.countDocuments();
      
      if (adminCount === 0) {
        // Criar o primeiro admin
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);
        
        await Admin.create({
          email: ADMIN_EMAIL,
          password: hashedPassword
        });
        
        console.log('Admin inicial criado com sucesso');
      }
      
      return { success: true };
    }
    
    // Verificar no banco de dados para mais flexibilidade
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return { success: false, message: "Credenciais inválidas" };
    }
    
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return { success: false, message: "Credenciais inválidas" };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Erro ao verificar credenciais:', error);
    return { 
      success: false, 
      message: `Erro ao verificar credenciais: ${error.message}` 
    };
  }
}

// Gerar novo código de cliente
async function generateCustomerCode(customerName) {
  try {
    // Gerar código aleatório de 4 dígitos
    const generateCode = () => Math.floor(1000 + Math.random() * 9000).toString();
    
    let code = generateCode();
    let existingCode = await CustomerCode.findOne({ code });
    
    // Garantir que não haja duplicação de código
    while (existingCode) {
      code = generateCode();
      existingCode = await CustomerCode.findOne({ code });
    }
    
    // Criar novo código
    await CustomerCode.create({
      code,
      customerName,
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
    const codes = await CustomerCode.find()
      .sort({ createdAt: -1 });
    
    return {
      success: true,
      codes: codes.map(code => ({
        code: code.code,
        customerName: code.customerName || 'Anônimo',
        createdAt: code.createdAt || new Date()
      }))
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
    await CustomerCode.findOneAndUpdate(
      { code },
      { 
        items,
        lastUpdated: new Date()
      }
    );
    
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
    const result = await CustomerCode.findOneAndDelete({ code });
    
    if (!result) {
      return {
        success: false,
        message: 'Código não encontrado'
      };
    }
    
    // Também remover configurações de acesso relacionadas
    await CategoryAccess.findOneAndDelete({ customerCode: code });
    
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
    const access = await CategoryAccess.findOne({ customerCode });
    
    if (access) {
      return {
        success: true,
        data: access
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
    await CategoryAccess.findOneAndUpdate(
      { customerCode },
      categoryAccessData,
      { upsert: true } // Criar se não existir
    );
    
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