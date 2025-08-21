require('dotenv').config();
const StorageService = require('./src/services/StorageService');

async function checkThumbnails() {
    console.log('\n🔍 VERIFICANDO ESTRUTURA DE THUMBNAILS:\n');
    
    // Ver estrutura de _thumbnails
    const thumbFolders = await StorageService.getSubfolders('_thumbnails');
    console.log(`📁 Pastas em _thumbnails: ${thumbFolders.folders?.length || 0}`);
    
    for (const folder of thumbFolders.folders || []) {
        const subFolders = await StorageService.getSubfolders(folder.prefix);
        console.log(`\n📂 ${folder.name}:`);
        
        for (const sub of subFolders.folders || []) {
            const photos = await StorageService.getPhotos(sub.prefix);
            if (photos.photos?.length > 0) {
                console.log(`   📁 ${sub.name}: ${photos.photos.length} thumbnails`);
            }
        }
    }
}

checkThumbnails();
