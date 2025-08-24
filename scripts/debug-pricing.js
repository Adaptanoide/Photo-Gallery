const mongoose = require('mongoose');
require('dotenv').config();

const PhotoCategory = require('../src/models/PhotoCategory');
const AccessCode = require('../src/models/AccessCode');

async function debugPricing() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔍 DEBUG DE PREÇOS E DESCONTOS\n');
        
        // 1. Verificar categoria específica
        const categoryName = 'Best Value - Brindle Medium and Dark Tones Mix ML-XL';
        console.log(`📂 Buscando categoria: ${categoryName}`);
        
        const categories = await PhotoCategory.find({
            $or: [
                { folderName: categoryName },
                { displayName: { $regex: categoryName, $options: 'i' } }
            ]
        });
        
        console.log(`Encontradas ${categories.length} categorias\n`);
        
        for (const cat of categories) {
            console.log('CATEGORIA ENCONTRADA:');
            console.log('  ID:', cat._id);
            console.log('  FolderName:', cat.folderName);
            console.log('  DisplayName:', cat.displayName);
            console.log('  BasePrice:', cat.basePrice);
            console.log('  DiscountRules:', cat.discountRules.length, 'regras');
            
            // Verificar se tem regra VOLUME
            const volumeRule = cat.discountRules.find(r => r.clientCode === 'VOLUME');
            if (volumeRule) {
                console.log('\n  ✅ REGRA VOLUME ENCONTRADA:');
                console.log('    Ativa:', volumeRule.isActive);
                console.log('    PriceRanges:', JSON.stringify(volumeRule.priceRanges, null, 2));
            } else {
                console.log('\n  ❌ SEM REGRA VOLUME!');
            }
            
            // Verificar TODAS as regras
            console.log('\n  TODAS AS REGRAS:');
            for (const rule of cat.discountRules) {
                console.log(`    - Cliente: ${rule.clientCode} | Ativa: ${rule.isActive}`);
                if (rule.priceRanges && rule.priceRanges.length > 0) {
                    console.log(`      Ranges: ${JSON.stringify(rule.priceRanges)}`);
                }
            }
        }
        
        // 2. Verificar cliente TESTE
        console.log('\n\n📱 Verificando cliente TESTE:');
        const client = await AccessCode.findOne({ clientCode: 'TESTE' });
        if (client) {
            console.log('  Nome:', client.clientName);
            console.log('  Tipo de Acesso:', client.accessType);
            console.log('  Categorias Permitidas:', client.allowedCategories?.length || 0);
            
            // Se for special, mostrar mais detalhes
            if (client.accessType === 'special') {
                console.log('  ⚠️ CLIENTE COM SPECIAL SELECTION!');
                console.log('  Selection ID:', client.specialSelection?.selectionId);
            }
        } else {
            console.log('  ❌ Cliente TESTE não encontrado!');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugPricing();
