// check-performance.js
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI);

async function checkPerformance() {
    const AccessCode = require('./src/models/AccessCode');
    const PhotoCategory = require('./src/models/PhotoCategory');
    
    console.log('\n⚡ TESTE DE PERFORMANCE DO LOGIN:\n');
    
    // Simular o que acontece no login
    const clientCode = '6753';
    
    // 1. Buscar cliente (como em /client/verify)
    console.time('1. Buscar AccessCode');
    const accessCode = await AccessCode.findOne({ code: clientCode });
    console.timeEnd('1. Buscar AccessCode');
    
    if (!accessCode) {
        console.log('Cliente não encontrado');
        mongoose.disconnect();
        return;
    }
    
    // 2. Filtrar QB items
    const qbItems = accessCode.allowedCategories.filter(item => /\d/.test(item));
    console.log(`\n📊 Cliente tem ${qbItems.length} QB items`);
    
    // 3. Buscar categorias (query pesada)
    console.time('2. Buscar categorias com $in');
    const categories = await PhotoCategory.find({
        qbItem: { $in: qbItems }
    });
    console.timeEnd('2. Buscar categorias com $in');
    
    // 4. Buscar TODAS categorias (para pricing)
    console.time('3. Buscar todas categorias');
    const allCats = await PhotoCategory.find({ 
        isActive: true 
    }).select('folderName displayName basePrice');
    console.timeEnd('3. Buscar todas categorias');
    
    console.log(`\n📈 Resultados:`);
    console.log(`  - Categorias do cliente: ${categories.length}`);
    console.log(`  - Total de categorias: ${allCats.length}`);
    
    mongoose.disconnect();
}

checkPerformance().catch(console.error);