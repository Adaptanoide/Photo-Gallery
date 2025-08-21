require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const StorageService = require('./src/services/StorageService');

async function populateAllPhotos() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\\n📸 POPULANDO PHOTOSTATUS COM TODAS AS FOTOS...\\n');
    
    // Buscar TODAS as categorias
    const structure = await StorageService.getFolderStructure('');
    let totalCreated = 0;
    
    for (const folder of structure.folders || []) {
        console.log(`\\n📂 Processando: ${folder.name}`);
        
        // Buscar fotos da categoria
        const result = await StorageService.getPhotos(folder.id);
        
        for (const photo of result.photos || []) {
            const fileName = photo.fileName || photo.name.split('/').pop();
            
            // Verificar se já existe
            const exists = await PhotoStatus.findOne({ fileName });
            
            if (!exists) {
                // Criar novo registro
                await PhotoStatus.create({
                    photoId: photo.id || fileName,
                    fileName: fileName,
                    r2Key: photo.r2Key || photo.id,
                    virtualStatus: {
                        status: 'available',
                        tags: ['available']
                    }
                });
                totalCreated++;
                
                if (totalCreated % 100 === 0) {
                    console.log(`   ✅ ${totalCreated} criadas...`);
                }
            }
        }
    }
    
    console.log(`\\n✅ TOTAL: ${totalCreated} registros criados!`);
    
    const total = await PhotoStatus.countDocuments();
    console.log(`📊 PhotoStatus agora tem: ${total} fotos`);
    
    await mongoose.disconnect();
}

// Confirmar
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

readline.question('⚠️ Criar PhotoStatus para TODAS as 3004 fotos? (yes/no): ', answer => {
    if (answer.toLowerCase() === 'yes') {
        populateAllPhotos();
    } else {
        console.log('Cancelado!');
        process.exit();
    }
    readline.close();
});
