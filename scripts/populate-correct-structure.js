require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const StorageService = require('./src/services/StorageService');

async function populateCorrectly() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\n📸 POPULANDO COM ESTRUTURA CORRETA\n');
    
    try {
        let totalCreated = 0;
        let totalSkipped = 0;
        let totalErrors = 0;
        
        // Buscar categorias principais
        const mainFolders = await StorageService.getSubfolders('');
        
        for (const mainFolder of mainFolders.folders || []) {
            console.log(`\n📂 ${mainFolder.name}:`);
            
            // Buscar subcategorias
            const subFolders = await StorageService.getSubfolders(mainFolder.prefix || mainFolder.id);
            
            for (const subFolder of subFolders.folders || []) {
                const photos = await StorageService.getPhotos(subFolder.prefix || subFolder.id);
                
                if (!photos.photos || photos.photos.length === 0) continue;
                
                console.log(`   📁 ${subFolder.name}: ${photos.photos.length} fotos`);
                
                for (const photo of photos.photos) {
                    const fileName = photo.fileName || photo.name;
                    const fullPath = photo.r2Key || `${subFolder.prefix}/${fileName}`;
                    
                    // Verificar se já existe
                    const exists = await PhotoStatus.findOne({ fileName });
                    
                    if (exists) {
                        totalSkipped++;
                        continue;
                    }
                    
                    try {
                        // CRIAR COM MESMA ESTRUTURA DOS 40 EXISTENTES
                        await PhotoStatus.create({
                            photoId: fullPath,
                            fileName: fileName,
                            r2Key: fullPath,
                            originalLocation: {
                                originalPath: fullPath,
                                originalParentId: subFolder.name,
                                originalCategory: subFolder.name
                            },
                            currentLocation: {
                                currentPath: fullPath,
                                currentParentId: subFolder.name,
                                currentCategory: subFolder.name,
                                currentStatus: 'stock'
                            },
                            virtualStatus: {
                                status: 'available',
                                tags: ['available'],
                                lastStatusChange: new Date()
                            },
                            status: 'available'
                        });
                        
                        totalCreated++;
                        
                        if (totalCreated % 50 === 0) {
                            console.log(`      ✅ ${totalCreated} criados até agora...`);
                        }
                        
                    } catch (error) {
                        totalErrors++;
                        if (totalErrors === 1) {
                            console.log('      ❌ Erro:', error.message);
                        }
                    }
                }
            }
        }
        
        console.log('\n📊 RESUMO FINAL:');
        console.log(`   ✅ Criados: ${totalCreated}`);
        console.log(`   ⏭️ Pulados (já existiam): ${totalSkipped}`);
        console.log(`   ❌ Erros: ${totalErrors}`);
        
        const total = await PhotoStatus.countDocuments();
        console.log(`\n📊 TOTAL NO BANCO: ${total} registros`);
        
    } catch (error) {
        console.error('❌ Erro geral:', error);
    }
    
    await mongoose.disconnect();
}

// Perguntar antes
console.log('⚠️ Este script vai:');
console.log('   1. Criar PhotoStatus para todas as fotos');
console.log('   2. Usar a mesma estrutura dos 40 existentes');
console.log('   3. Pode demorar alguns minutos\n');

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

readline.question('Continuar? (yes/no): ', answer => {
    if (answer.toLowerCase() === 'yes') {
        console.log('\n🚀 Iniciando...\n');
        populateCorrectly();
    } else {
        console.log('Cancelado!');
        process.exit();
    }
    readline.close();
});
