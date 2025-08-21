require('dotenv').config();
const StorageService = require('./src/services/StorageService');

async function investigate() {
    console.log('\n🔍 INVESTIGAÇÃO DETALHADA:\n');
    
    let originalPhotos = 0;
    let thumbnailPhotos = 0;
    let photosByFolder = {};
    
    // Função recursiva melhorada
    async function scanFolder(prefix = '', level = 0) {
        const indent = '  '.repeat(level);
        
        // Pular thumbnails
        if (prefix.includes('_thumbnails')) {
            const photos = await StorageService.getPhotos(prefix);
            thumbnailPhotos += photos.photos?.length || 0;
            return;
        }
        
        // Buscar fotos
        const photos = await StorageService.getPhotos(prefix);
        if (photos.photos && photos.photos.length > 0) {
            originalPhotos += photos.photos.length;
            photosByFolder[prefix || 'root'] = photos.photos.length;
            
            // Mostrar apenas pastas com fotos
            if (photos.photos.length > 0) {
                console.log(`${indent}📸 ${prefix || 'root'}: ${photos.photos.length} fotos`);
            }
        }
        
        // Buscar subpastas
        const folders = await StorageService.getSubfolders(prefix);
        for (const folder of folders.folders || []) {
            await scanFolder(folder.prefix || folder.id, level + 1);
        }
    }
    
    await scanFolder('');
    
    console.log('\n📊 RESUMO CORRETO:');
    console.log(`   Fotos ORIGINAIS: ${originalPhotos}`);
    console.log(`   Thumbnails: ${thumbnailPhotos}`);
    console.log(`   TOTAL: ${originalPhotos + thumbnailPhotos}`);
    
    console.log('\n📁 TOP 10 PASTAS COM MAIS FOTOS:');
    const sorted = Object.entries(photosByFolder)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    sorted.forEach(([folder, count]) => {
        console.log(`   ${folder}: ${count} fotos`);
    });
}

investigate();
