require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const R2Service = require('./src/services/R2Service');

async function checkR2vsPhotoStatus() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\\n🔍 ANÁLISE R2 vs PHOTOSTATUS:\\n');
    
    // 1. Contar no PhotoStatus
    const photoStatusCount = await PhotoStatus.countDocuments();
    console.log(`📸 PhotoStatus: ${photoStatusCount} registros`);
    
    // 2. Contar no R2
    try {
        const allCategories = await R2Service.listFolders('');
        let totalR2Photos = 0;
        
        console.log('\\n📂 Categorias no R2:');
        for (const category of allCategories.slice(0, 5)) {
            const photos = await R2Service.listPhotos(category.prefix);
            console.log(`   ${category.name}: ${photos.length} fotos`);
            totalR2Photos += photos.length;
        }
        
        console.log(`\\n⚠️ PROBLEMA: R2 tem MILHARES de fotos mas PhotoStatus tem apenas ${photoStatusCount}!`);
    } catch (error) {
        console.log('Erro ao contar R2:', error.message);
    }
    
    // 3. Ver se PhotoStatus tem apenas teste
    const samples = await PhotoStatus.find().limit(10);
    console.log('\\n📋 Amostra do PhotoStatus:');
    samples.forEach(p => {
        console.log(`   ${p.fileName} - ${p.virtualStatus.status}`);
    });
    
    await mongoose.disconnect();
}

checkR2vsPhotoStatus();
