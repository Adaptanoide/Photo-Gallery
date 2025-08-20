// setup-default-tiers.js
const mongoose = require('mongoose');
require('dotenv').config();

async function setupDefaultTiers() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const PhotoCategory = require('./src/models/PhotoCategory');
    
    console.log('🔧 CONFIGURANDO FAIXAS PADRÃO DAS CATEGORIAS\n');
    
    // Configurar Brindle
    const brindle = await PhotoCategory.findOne({ displayName: /Brindle/i });
    if (brindle) {
        // Remover regra DEFAULT antiga se existir
        brindle.discountRules = brindle.discountRules.filter(r => r.clientCode !== 'DEFAULT');
        
        // Adicionar nova regra DEFAULT
        brindle.discountRules.push({
            clientCode: 'DEFAULT',
            clientName: 'Faixas Padrão',
            discountPercent: 0,
            priceRanges: [
                { min: 1, max: 12, price: 109 },    // 1-12: $109
                { min: 13, max: 36, price: 105 },   // 13-36: $105
                { min: 37, max: null, price: 99 }   // 37+: $99
            ],
            customPrice: null,
            isActive: true
        });
        
        await brindle.save();
        console.log('✅ Brindle configurado:');
        console.log('   1-12: $109 | 13-36: $105 | 37+: $99\n');
    }
    
    // Configurar Exotic
    const exotic = await PhotoCategory.findOne({ displayName: /Exotic/i });
    if (exotic) {
        exotic.discountRules = exotic.discountRules.filter(r => r.clientCode !== 'DEFAULT');
        
        exotic.discountRules.push({
            clientCode: 'DEFAULT',
            clientName: 'Faixas Padrão',
            discountPercent: 0,
            priceRanges: [
                { min: 1, max: 12, price: 105 },    // 1-12: $105
                { min: 13, max: 36, price: 99 },    // 13-36: $99
                { min: 37, max: null, price: 95 }   // 37+: $95
            ],
            customPrice: null,
            isActive: true
        });
        
        await exotic.save();
        console.log('✅ Exotic configurado:');
        console.log('   1-12: $105 | 13-36: $99 | 37+: $95\n');
    }
    
    process.exit();
}

setupDefaultTiers().catch(console.error);