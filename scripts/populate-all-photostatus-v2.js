require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const StorageService = require('./src/services/StorageService');

async function populateAllPhotos() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\\n📸 POPULANDO PHOTOSTATUS COM TODAS AS FOTOS...\\n');
    
    try {
        // Usar o método correto - getCategories
        const categoriesResult = await StorageService.getCategories();
        const categories = categoriesResult.categories || [];
        
        console.log(`📂 Encontradas ${categories.length} categorias\\n`);
        
        let totalCreated = 0;
        let totalExisting = 0;
        
        // Processar cada categoria
        for (const category of categories) {
            console.log(`\\n📂 Processando: ${category.name}`);
            
            // Buscar fotos da categoria
            const photosResult = await StorageService.getPhotos(category.id || category.prefix);
            const photos = photosResult.photos || [];
            
            console.log(`   📸 ${photos.length} fotos na categoria`);
            
            for (const photo of photos) {
                const fileName = photo.fileName || photo.name.split('/').pop();
                
                // Verificar se já existe
                const exists = await PhotoStatus.findOne({ fileName });
                
                if (!exists) {
                    // Criar novo registro
                    await PhotoStatus.create({
                        photoId: fileName,
                        fileName: fileName,
                        r2Key: photo.r2Key || photo.id,
                        virtualStatus: {
                            status: 'available',
                            tags: ['available']
                        }
                    });
                    totalCreated++;
                    
                    if (totalCreated % 50 === 0) {
                        console.log(`   ✅ ${totalCreated} criadas até agora...`);
                    }
                } else {
                    totalExisting++;
                }
            }
        }
        
        console.log(`\\n✅ RESUMO:`);
        console.log(`   Novos registros: ${totalCreated}`);
        console.log(`   Já existentes: ${totalExisting}`);
        
        const total = await PhotoStatus.countDocuments();
        console.log(`\\n📊 PhotoStatus agora tem: ${total} fotos (deve ser ~3004)`);
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.log('\\n🔍 Tentando método alternativo...');
        
        // Método alternativo: buscar diretamente no R2
        const R2Service = require('./src/services/R2Service');
        const folders = await R2Service.listAllFolders();
        console.log(`📂 Encontradas ${folders.length} pastas no R2`);
    }
    
    await mongoose.disconnect();
}

// Confirmar
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

readline.question('⚠️ Criar PhotoStatus para TODAS as fotos? (yes/no): ', answer => {
    if (answer.toLowerCase() === 'yes') {
        populateAllPhotos();
    } else {
        console.log('Cancelado!');
        process.exit();
    }
    readline.close();
});
