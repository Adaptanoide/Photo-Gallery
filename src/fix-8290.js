const mongoose = require('mongoose');
const CategoryAccess = require('./src/models/categoryAccess');
require('dotenv').config({ path: '.env.local' });

async function fix8290() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado ao MongoDB');
    
    // Buscar o registro atual
    const record = await CategoryAccess.findOne({ customerCode: '8290' });
    
    if (record) {
      // Filtrar apenas categorias com configurações reais
      const filtered = record.categoryAccess.filter(item => 
        item.customPrice > 0 || 
        item.enabled === false ||
        item.minQuantityForDiscount > 0
      );
      
      console.log(`Antes: ${record.categoryAccess.length} categorias`);
      console.log(`Depois: ${filtered.length} categorias`);
      
      // Atualizar com apenas as configuradas
      record.categoryAccess = filtered;
      await record.save();
      
      console.log('✅ Corrigido!');
    } else {
      console.log('Registro não encontrado');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Erro:', error);
  }
}

fix8290();