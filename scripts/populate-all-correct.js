require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const StorageService = require('./src/services/StorageService');

async function populateAll() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\n📸 POPULANDO PHOTOSTATUS - USANDO STORAGESERVICE\n');
    
    try {
        const allPhotos = [];
        
        // 1. Buscar todas as categorias principais
        console.log('🔍 Buscando estrutura de pastas...\n');
        const mainFolders = await StorageService.getSubfolders('');
        
        // 2. Para cada categoria principal
        for (const folder of mainFolders.folders || []) {
            console.log(`📂 Processando: ${folder.name}`);
            
            // Buscar subcategorias
            const subFolders = await StorageService.getSubfolders(folder.prefix || folder.id);
            
            // Se tem subcategorias, processar cada uma
            if (subFolders.folders && subFolders.folders.length > 0) {
                for (const subFolder of subFolders.folders) {
                    const photos = await StorageService.getPhotos(subFolder.prefix || subFolder.id);
                    if (photos.photos && photos.photos.length > 0) {
                        console.log(`   📁 ${subFolder.name}: ${photos.photos.length} fotos`);
                        allPhotos.push(...photos.photos);
                    }
                }
            } else {
                // Se não tem subcategorias, buscar fotos direto
                const photos = await StorageService.getPhotos(folder.prefix || folder.id);
                if (photos.photos && photos.photos.length > 0) {
                    console.log(`   📸 ${folder.name}: ${photos.photos.length} fotos`);
                    allPhotos.push(...photos.photos);
                }
            }
        }
        
        console.log(`\n📊 Total de fotos encontradas: ${allPhotos.length}`);
        
        // 3. Buscar PhotoStatus existentes
        const existing = await PhotoStatus.find({}, 'fileName');
        const existingSet = new Set(existing.map(p => p.fileName));
        
        console.log(`📊 PhotoStatus existentes: ${existing.length}`);
        
        // 4. Criar apenas os que faltam
        const toCreate = [];
        
        for (const photo of allPhotos) {
            const fileName = photo.fileName || photo.name?.split('/').pop() || '';
            
            if (fileName && !existingSet.has(fileName)) {
                toCreate.push({
                    photoId: fileName,
                    fileName: fileName,
                    r2Key: photo.r2Key || photo.id || fileName,
                    virtualStatus: {
                        status: 'available',
                        tags: ['available'],
                        lastStatusChange: new Date()
                    }
                });
            }
        }
        
        console.log(`📝 Precisamos criar: ${toCreate.length} registros\n`);
        
        if (toCreate.length > 0) {
            // Criar em lotes
            const batchSize = 50;
            let created = 0;
            
            for (let i = 0; i < toCreate.length; i += batchSize) {
                const batch = toCreate.slice(i, i + batchSize);
                
                try {
                    await PhotoStatus.insertMany(batch, { ordered: false });
                    created += batch.length;
                    console.log(`   ✅ ${created}/${toCreate.length} criados...`);
                } catch (err) {
                    console.log(`   ⚠️ Erro no lote, continuando...`);
                }
            }
        }
        
        const finalCount = await PhotoStatus.countDocuments();
        console.log(`\n✅ COMPLETO! PhotoStatus tem ${finalCount} registros agora`);
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error(error);
    }
    
    await mongoose.disconnect();
}

// Confirmar
console.log('⚠️  ATENÇÃO:');
console.log('   - Vai buscar TODAS as fotos do R2');
console.log('   - Criar PhotoStatus para cada uma');
console.log('   - Pode demorar alguns minutos\n');

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

readline.question('Continuar? (yes/no): ', answer => {
    if (answer.toLowerCase() === 'yes') {
        console.log('\n🚀 Iniciando...\n');
        populateAll();
    } else {
        console.log('Cancelado!');
        process.exit();
    }
    readline.close();
});
