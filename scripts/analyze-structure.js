require('dotenv').config();
const mongoose = require('mongoose');
const StorageService = require('./src/services/StorageService');
const PhotoStatus = require('./src/models/PhotoStatus');

async function analyzeStructure() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\n📊 ANÁLISE DA ESTRUTURA:\n');
    
    // 1. Ver quantas categorias existem
    const folders = await StorageService.getSubfolders('');
    console.log(`📂 Categorias principais: ${folders.folders?.length || 0}`);
    
    // 2. Contar fotos em algumas categorias
    let totalPhotos = 0;
    for (const folder of (folders.folders || []).slice(0, 3)) {
        const photos = await StorageService.getPhotos(folder.prefix || folder.id);
        console.log(`   ${folder.name}: ${photos.photos?.length || 0} fotos`);
        totalPhotos += photos.photos?.length || 0;
    }
    
    // 3. Ver PhotoStatus atual
    const photoStatusCount = await PhotoStatus.countDocuments();
    console.log(`\n📸 PhotoStatus atual: ${photoStatusCount} registros`);
    
    // 4. Estimar total
    console.log(`\n⚠️ ESTIMATIVA: ~3004 fotos no R2`);
    console.log(`❓ Criar ${3004 - photoStatusCount} novos registros no MongoDB Atlas?`);
    
    await mongoose.disconnect();
}

analyzeStructure();
