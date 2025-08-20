// script-limpar-regras.js
const mongoose = require('mongoose');
require('dotenv').config();

async function limparRegras() {
    await mongoose.connect(process.env.MONGODB_URI);
    const PhotoCategory = require('./src/models/PhotoCategory');
    
    console.log('🧹 LIMPANDO REGRAS DE TODAS AS CATEGORIAS\n');
    
    const categorias = await PhotoCategory.find({});
    
    for (const cat of categorias) {
        // Remover TODAS as regras exceto DEFAULT e clientes específicos importantes
        const regrasParaManter = cat.discountRules.filter(rule => 
            rule.clientCode === '8041' // Cliente TESTE - manter
        );
        
        cat.discountRules = regrasParaManter;
        await cat.save();
        
        console.log(`✅ ${cat.displayName}: ${regrasParaManter.length} regras mantidas`);
    }
    
    console.log('\n✅ Limpeza concluída!');
    process.exit();
}

limparRegras().catch(console.error);