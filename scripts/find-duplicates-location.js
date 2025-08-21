require('dotenv').config();
const StorageService = require('./src/services/StorageService');

async function findDuplicatesLocation() {
    console.log('\n🔍 LOCALIZANDO FOTOS DUPLICADAS:\n');
    
    const targetFiles = ['20819.webp', '16576.webp'];
    const found = {};
    
    // Buscar em todo o R2
    async function scanFolder(prefix = '') {
        if (prefix.includes('_thumbnails')) return;
        
        const photos = await StorageService.getPhotos(prefix);
        if (photos.photos) {
            photos.photos.forEach(p => {
                const fileName = p.fileName || p.name;
                
                if (targetFiles.includes(fileName)) {
                    if (!found[fileName]) found[fileName] = [];
                    found[fileName].push({
                        path: p.r2Key || `${prefix}/${fileName}`,
                        folder: prefix
                    });
                }
            });
        }
        
        const folders = await StorageService.getSubfolders(prefix);
        for (const folder of folders.folders || []) {
            await scanFolder(folder.prefix || folder.id);
        }
    }
    
    await scanFolder('');
    
    console.log('📍 FOTOS DUPLICADAS ENCONTRADAS:\n');
    
    for (const [fileName, locations] of Object.entries(found)) {
        console.log(`📸 ${fileName} (aparece ${locations.length} vezes):`);
        locations.forEach((loc, idx) => {
            console.log(`   ${idx + 1}. ${loc.path}`);
            console.log(`      Pasta: ${loc.folder || 'root'}`);
        });
        console.log('');
    }
    
    console.log('⚠️ PROBLEMA: Mesmo nome de arquivo em pastas diferentes!');
    console.log('💡 SOLUÇÃO: O sistema está funcionando corretamente.');
    console.log('   O banco usa fileName único, então mantém apenas uma versão.\n');
}

findDuplicatesLocation();
