// check-database.js
const mongoose = require('mongoose');
require('dotenv').config();

async function checkDatabase() {
    try {
        // Conectar
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB');
        
        // Importar o modelo
        const PhotoCategory = require('./src/models/PhotoCategory');
        
        // Contar quantas categorias existem
        const total = await PhotoCategory.countDocuments();
        console.log(`📊 Total de categorias: ${total}`);
        
        // Ver uma categoria de exemplo
        const exemplo = await PhotoCategory.findOne();
        if (exemplo) {
            console.log('\n📦 Exemplo de categoria:');
            console.log('Nome:', exemplo.displayName);
            console.log('Preço base:', exemplo.basePrice);
            console.log('Modo de preço:', exemplo.pricingMode);
        }
        
        // Ver quantas têm preço
        const comPreco = await PhotoCategory.countDocuments({ basePrice: { $gt: 0 } });
        console.log(`\n💰 Categorias com preço: ${comPreco}`);
        console.log(`❌ Categorias sem preço: ${total - comPreco}`);
        
        // Listar 5 categorias sem preço
        const semPreco = await PhotoCategory.find({ basePrice: 0 }).limit(5);
        console.log('\n📋 Algumas categorias sem preço:');
        semPreco.forEach(cat => {
            console.log(`  - ${cat.displayName}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Erro:', error);
        process.exit(1);
    }
}

checkDatabase();
