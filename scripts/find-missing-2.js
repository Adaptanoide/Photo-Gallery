require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const StorageService = require('./src/services/StorageService');

async function findMissing2() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\n🔍 PROCURANDO AS 2 FOTOS QUE FALTAM:\n');
    
    const allR2Photos = [];
    const dbFileNames = new Set();
    
    // Pegar todos os fileNames do banco
    const dbPhotos = await PhotoStatus.find({}, 'fileName');
    dbPhotos.forEach(p => dbFileNames.add(p.fileName));
    
    console.log(`📊 Fotos no banco: ${dbFileNames.size}`);
    
    // Função recursiva para pegar TODAS as fotos do R2
    async function scanFolder(prefix = '') {
        if (prefix.includes('_thumbnails')) return;
        
        const photos = await StorageService.getPhotos(prefix);
        if (photos.photos) {
            photos.photos.forEach(p => {
                const fileName = p.fileName || p.name;
                allR2Photos.push({
                    fileName: fileName,
                    path: p.r2Key || `${prefix}/${fileName}`
                });
            });
        }
        
        const folders = await StorageService.getSubfolders(prefix);
        for (const folder of folders.folders || []) {
            await scanFolder(folder.prefix || folder.id);
        }
    }
    
    await scanFolder('');
    
    console.log(`📊 Fotos no R2: ${allR2Photos.length}`);
    
    // Encontrar as que faltam
    const missing = allR2Photos.filter(photo => !dbFileNames.has(photo.fileName));
    
    console.log(`\n❌ FOTOS QUE FALTAM NO BANCO (${missing.length}):`);
    missing.forEach(photo => {
        console.log(`   - ${photo.fileName}`);
        console.log(`     Path: ${photo.path}`);
    });
    
    // Ver se tem duplicatas
    const fileNameCounts = {};
    allR2Photos.forEach(p => {
        fileNameCounts[p.fileName] = (fileNameCounts[p.fileName] || 0) + 1;
    });
    
    const duplicates = Object.entries(fileNameCounts).filter(([name, count]) => count > 1);
    
    if (duplicates.length > 0) {
        console.log(`\n⚠️ NOMES DUPLICADOS NO R2:`);
        duplicates.forEach(([name, count]) => {
            console.log(`   ${name}: aparece ${count} vezes`);
        });
    }
    
    await mongoose.disconnect();
}

findMissing2();

