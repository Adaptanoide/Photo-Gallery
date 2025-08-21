require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const StorageService = require('./src/services/StorageService');

async function populateAllRecursive() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\n📸 POPULANDO TODAS AS 3004 FOTOS - RECURSIVO\n');
    
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    // Função RECURSIVA para varrer TODOS os níveis
    async function processFolder(prefix = '', parentPath = '') {
        // Pular thumbnails
        if (prefix.includes('_thumbnails')) return;
        
        // Buscar fotos neste nível
        const photosResult = await StorageService.getPhotos(prefix);
        
        if (photosResult.photos && photosResult.photos.length > 0) {
            console.log(`\n📁 ${prefix || 'root'}: ${photosResult.photos.length} fotos`);
            
            for (const photo of photosResult.photos) {
                const fileName = photo.fileName || photo.name;
                const fullPath = photo.r2Key || `${prefix}/${fileName}`;
                
                // Verificar se já existe
                const exists = await PhotoStatus.findOne({ fileName });
                
                if (exists) {
                    totalSkipped++;
                    continue;
                }
                
                try {
                    // Extrair nome da categoria do path
                    const pathParts = prefix.split('/').filter(p => p);
                    const categoryName = pathParts[pathParts.length - 1] || pathParts[0] || 'root';
                    
                    await PhotoStatus.create({
                        photoId: fullPath,
                        fileName: fileName,
                        r2Key: fullPath,
                        originalLocation: {
                            originalPath: fullPath,
                            originalParentId: categoryName,
                            originalCategory: categoryName
                        },
                        currentLocation: {
                            currentPath: fullPath,
                            currentParentId: categoryName,
                            currentCategory: categoryName,
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
                    
                    if (totalCreated % 100 === 0) {
                        console.log(`   ✅ ${totalCreated} criados até agora...`);
                    }
                    
                } catch (error) {
                    totalErrors++;
                    if (totalErrors === 1) {
                        console.log('   ❌ Primeiro erro:', error.message);
                    }
                }
            }
        }
        
        // RECURSÃO: Buscar TODAS as subpastas
        const subFolders = await StorageService.getSubfolders(prefix);
        
        for (const folder of subFolders.folders || []) {
            // Chamar recursivamente para TODOS os níveis
            await processFolder(folder.prefix || folder.id, prefix);
        }
    }
    
    // Iniciar recursão da raiz
    await processFolder('');
    
    console.log('\n📊 RESULTADO FINAL:');
    console.log(`   ✅ Criados: ${totalCreated}`);
    console.log(`   ⏭️ Já existiam: ${totalSkipped}`);
    console.log(`   ❌ Erros: ${totalErrors}`);
    
    const total = await PhotoStatus.countDocuments();
    console.log(`\n📊 TOTAL NO BANCO: ${total} registros`);
    console.log(`   Meta: 3004 fotos`);
    console.log(`   ${total === 3004 ? '✅ COMPLETO!' : `⚠️ Faltam: ${3004 - total}`}`);
    
    await mongoose.disconnect();
}

console.log('⚠️ Este script vai criar PhotoStatus para TODAS as fotos faltantes');
console.log('   Usando busca RECURSIVA em TODOS os níveis\n');

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

readline.question('Continuar? (yes/no): ', answer => {
    if (answer.toLowerCase() === 'yes') {
        console.log('\n�� Iniciando busca recursiva...\n');
        populateAllRecursive();
    } else {
        console.log('Cancelado!');
        process.exit();
    }
    readline.close();
});
