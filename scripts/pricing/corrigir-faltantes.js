// scripts/pricing/corrigir-faltantes.js
require('dotenv').config();
const mongoose = require('mongoose');
const PhotoCategory = require('../../src/models/PhotoCategory');

async function corrigirFaltantes() {
    console.log('🔧 CORREÇÃO DE CATEGORIAS FALTANTES\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    
    const correções = [
        {
            nome: 'Black and White Reddish XL',
            preço: 159,
            motivo: 'Mesmo preço de Black & White XL'
        }
        // As outras 2 são pastas vazias, não precisam de preço agora
    ];
    
    for (const item of correções) {
        const categoria = await PhotoCategory.findOne({
            displayName: { $regex: item.nome, $options: 'i' }
        });
        
        if (categoria && !categoria.basePrice) {
            categoria.basePrice = item.preço;
            categoria.pricingMode = 'base';
            
            if (!categoria.priceHistory) categoria.priceHistory = [];
            categoria.priceHistory.push({
                oldPrice: 0,
                newPrice: item.preço,
                changedBy: 'correção-manual',
                changedAt: new Date(),
                reason: item.motivo
            });
            
            await categoria.save();
            console.log(`✅ ${item.nome}: $${item.preço}`);
        }
    }
    
    // Verificar status final
    const total = await PhotoCategory.countDocuments({ isActive: true });
    const comPreço = await PhotoCategory.countDocuments({ 
        isActive: true,
        basePrice: { $gt: 0 }
    });
    
    console.log(`\n📊 STATUS FINAL:`);
    console.log(`   Total: ${total}`);
    console.log(`   Com preço: ${comPreço}`);
    console.log(`   Sem preço: ${total - comPreço}`);
    console.log(`   Porcentagem: ${((comPreço/total)*100).toFixed(1)}%`);
    
    mongoose.connection.close();
}

corrigirFaltantes().catch(console.error);