require('dotenv').config();
const mongoose = require('mongoose');
const StorageService = require('./src/services/StorageService');

async function findMissingPhotos() {
    console.log('\n🔍 PROCURANDO FOTOS QUE FALTAM:\n');
    
    let totalPhotosFound = 0;
    
    // Função recursiva para buscar em TODOS os níveis
    async function scanRecursive(prefix = '', level = 0) {
        const indent = '  '.repeat(level);
        
        // Buscar fotos neste nível
        const photos = await StorageService.getPhotos(prefix);
        if (photos.photos && photos.photos.length > 0) {
            console.log(`${indent}📸 ${prefix || 'root'}: ${photos.photos.length} fotos`);
            totalPhotosFound += photos.photos.length;
        }
        
        // Buscar subpastas
        const folders = await StorageService.getSubfolders(prefix);
        
        for (const folder of folders.folders || []) {
            // Recursão para níveis mais profundos
            await scanRecursive(folder.prefix || folder.id, level + 1);
        }
    }
    
    await scanRecursive('');
    
    console.log(`\n📊 TOTAL DE FOTOS ENCONTRADAS: ${totalPhotosFound}`);
    
    // Verificar _thumbnails
    console.log('\n🔍 Verificando _thumbnails:');
    const thumbs = await StorageService.getPhotos('_thumbnails');
    console.log(`   Thumbnails: ${thumbs.photos?.length || 0} arquivos`);
    
    // Contar no banco
    await mongoose.connect(process.env.MONGODB_URI);
    const dbCount = await require('./src/models/PhotoStatus').countDocuments();
    await mongoose.disconnect();
    
    console.log(`\n📊 RESUMO:`);
    console.log(`   R2 (sem thumbnails): ${totalPhotosFound}`);
    console.log(`   PhotoStatus no banco: ${dbCount}`);
    console.log(`   DIFERENÇA: ${totalPhotosFound - dbCount}`);
}

findMissingPhotos();
