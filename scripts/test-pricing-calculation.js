const mongoose = require('mongoose');
require('dotenv').config();
const PhotoCategory = require('../src/models/PhotoCategory');

async function testPricing() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('🧮 TESTANDO CÁLCULO DE PREÇOS\n');
        
        // Buscar a categoria
        const category = await PhotoCategory.findOne({
            folderName: 'Best Value - Brindle Medium and Dark Tones Mix ML-XL'
        });
        
        if (!category) {
            console.log('❌ Categoria não encontrada!');
            return;
        }
        
        console.log('📂 Categoria:', category.displayName);
        console.log('💰 Base Price:', category.basePrice);
        console.log('\n');
        
        // Testar cálculo para cliente 8041 com diferentes quantidades
        const clientCode = '8041';
        const quantities = [1, 10, 11, 20, 21];
        
        console.log(`🧮 Testando preços para cliente ${clientCode}:\n`);
        
        for (const qty of quantities) {
            const result = await category.getPriceForClient(clientCode, qty);
            console.log(`Quantidade ${qty}:`);
            console.log(`  Preço Final: $${result.finalPrice}`);
            console.log(`  Regra Aplicada: ${result.appliedRule}`);
            if (result.ruleDetails?.appliedRange) {
                console.log(`  Range: ${result.ruleDetails.appliedRange.min}-${result.ruleDetails.appliedRange.max || '+'}`);
            }
            console.log('---');
        }
        
        // Testar também para cliente genérico (VOLUME)
        console.log('\n🧮 Testando preços VOLUME (cliente genérico):\n');
        
        for (const qty of quantities) {
            const result = await category.getPriceForClient('9999', qty); // Cliente que não tem regra específica
            console.log(`Quantidade ${qty}:`);
            console.log(`  Preço Final: $${result.finalPrice}`);
            console.log(`  Regra Aplicada: ${result.appliedRule}`);
            console.log('---');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.disconnect();
    }
}

testPricing();
