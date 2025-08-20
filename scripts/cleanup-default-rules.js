// cleanup-default-rules.js
const mongoose = require('mongoose');
require('dotenv').config();

async function limparRegrasDefault() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const PhotoCategory = require('./src/models/PhotoCategory');
    
    console.log('🧹 LIMPANDO REGRAS DEFAULT CRIADAS INCORRETAMENTE\n');
    
    // Buscar TODAS as categorias
    const categorias = await PhotoCategory.find({});
    
    let limpos = 0;
    
    for (const cat of categorias) {
        const regrasAntes = cat.discountRules.length;
        
        // REMOVER regras DEFAULT e Faixas Padrão
        cat.discountRules = cat.discountRules.filter(r => 
            r.clientCode !== 'DEFAULT' && 
            r.clientName !== 'Faixas Padrão'
        );
        
        const regrasDepois = cat.discountRules.length;
        
        if (regrasAntes !== regrasDepois) {
            await cat.save();
            limpos++;
            console.log(`✅ ${cat.displayName}`);
            console.log(`   Removidas: ${regrasAntes - regrasDepois} regras\n`);
        }
    }
    
    console.log(`\n🎯 RESUMO:`);
    console.log(`Total de categorias: ${categorias.length}`);
    console.log(`Categorias limpas: ${limpos}`);
    
    // Mostrar Volume Discount Global atual
    const QuantityDiscount = require('./src/models/QuantityDiscount');
    const volumeRules = await QuantityDiscount.find({ isActive: true });
    
    console.log(`\n📊 VOLUME DISCOUNT GLOBAL (QuantityDiscount):`);
    volumeRules.forEach(r => {
        console.log(`   ${r.minQuantity}-${r.maxQuantity || '+'}: $${r.fixedPrice || r.discountPercent + '%'}`);
    });
    
    process.exit();
}

limparRegrasDefault().catch(console.error);