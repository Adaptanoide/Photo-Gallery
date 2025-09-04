// debug-initial-load.js
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI);

async function debugInitialLoad() {
    console.log('\n🔍 ANALISANDO CARREGAMENTO INICIAL...\n');
    
    const AccessCode = require('./src/models/AccessCode');
    const PhotoCategory = require('./src/models/PhotoCategory');
    const ClientPermissionsCache = require('./src/models/ClientPermissionsCache');
    
    // Simular login do cliente 6753
    const clientCode = '6753';
    
    console.time('⏱️ TOTAL');
    
    // 1. Buscar AccessCode
    console.time('  1. Buscar AccessCode');
    const accessCode = await AccessCode.findOne({ code: clientCode });
    console.timeEnd('  1. Buscar AccessCode');
    
    // 2. Ver quantos QB items tem
    const qbItems = accessCode.allowedCategories.filter(item => /[\d\w\s-]+/.test(item));
    console.log(`  📊 Cliente tem ${qbItems.length} QB items`);
    
    // 3. Simular cálculo de cache
    console.time('  3. Calcular permissões');
    const categories = await PhotoCategory.find({
        qbItem: { $in: qbItems }
    });
    console.timeEnd('  3. Calcular permissões');
    console.log(`  📂 Encontradas ${categories.length} categorias`);
    
    // 4. Ver se já tem cache
    console.time('  4. Verificar cache existente');
    const existingCache = await ClientPermissionsCache.findOne({
        clientCode: clientCode,
        expiresAt: { $gt: new Date() }
    });
    console.timeEnd('  4. Verificar cache existente');
    console.log(`  💾 Cache existe? ${!!existingCache}`);
    
    // 5. Buscar TODAS as categorias (para pricing)
    console.time('  5. Buscar todas categorias com preços');
    const allCategories = await PhotoCategory.find({
        isActive: true,
        photoCount: { $gt: 0 }
    }).select('folderName displayName basePrice photoCount qbItem');
    console.timeEnd('  5. Buscar todas categorias com preços');
    console.log(`  💰 Total de categorias com preços: ${allCategories.length}`);
    
    console.timeEnd('⏱️ TOTAL');
    
    mongoose.disconnect();
}

debugInitialLoad().catch(console.error);