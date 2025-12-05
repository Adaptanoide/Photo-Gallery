// analyze-mongodb-correct.js
require('dotenv').config();
const mongoose = require('mongoose');

async function analyzeMongoCorrect() {
    console.log('🔍 ANALISANDO MONGODB - VERSÃO CORRIGIDA\n');
    
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado!\n');
        
        // 1. Ver estrutura de unified_products_complete
        console.log('ESTRUTURA DE UM PRODUTO:');
        const Products = mongoose.connection.collection('unified_products_complete');
        const sample = await Products.findOne({});
        console.log('Campos disponíveis:', Object.keys(sample));
        
        // 2. Buscar produtos com categoria e preço
        console.log('\n\nPRODUTOS COM CATEGORIAS E PREÇOS:');
        const withPrices = await Products.find({
            category: { $exists: true },
            qbCode: { $exists: true }
        }).limit(5).toArray();
        
        withPrices.forEach(p => {
            console.log(`\nFoto: ${p.fileName}`);
            console.log(`Categoria: ${p.category}`);
            console.log(`QB Code: ${p.qbCode}`);
            console.log(`Preço: ${p.calculatedPrice || p.basePrice || 'sem preço'}`);
        });
        
        // 3. Ver coleção de categorias com mais detalhes
        console.log('\n\nCATEGORIAS COM QB CODES:');
        const Categories = mongoose.connection.collection('photocategories');
        const cats = await Categories.find({}).toArray();
        
        if (cats.length > 0) {
            console.log(`Total de categorias: ${cats.length}`);
            // Mostrar estrutura de uma categoria
            if (cats[0]) {
                console.log('Estrutura de categoria:', Object.keys(cats[0]));
            }
        }
        
        await mongoose.disconnect();
        
    } catch (error) {
        console.error('❌ ERRO:', error);
    }
}

analyzeMongoCorrect();