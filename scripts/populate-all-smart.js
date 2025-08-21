require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const R2Service = require('./src/services/R2Service');

async function populateAll() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\n📸 POPULANDO PHOTOSTATUS - VERSÃO OTIMIZADA\n');
    
    try {
        // 1. Listar TODAS as fotos do R2 de uma vez
        console.log('🔍 Buscando todas as fotos do R2...');
        
        const allPhotos = [];
        
        // Buscar recursivamente
        async function scanFolder(prefix = '') {
            const result = await R2Service.listPhotos(prefix);
            
            if (result && result.length > 0) {
                console.log(`   📂 ${prefix || 'root'}: ${result.length} fotos`);
                allPhotos.push(...result);
            }
            
            // Buscar subpastas
            const folders = await R2Service.listFolders(prefix);
            for (const folder of folders || []) {
                await scanFolder(folder.prefix);
            }
        }
        
        await scanFolder('');
        
        console.log(`\n📊 Total de fotos no R2: ${allPhotos.length}`);
        
        // 2. Buscar todos os PhotoStatus existentes
        const existing = await PhotoStatus.find({}, 'fileName');
        const existingSet = new Set(existing.map(p => p.fileName));
        
        console.log(`📊 PhotoStatus existentes: ${existing.length}`);
        
        // 3. Criar apenas os que faltam
        const toCreate = allPhotos.filter(photo => {
            const fileName = photo.name.split('/').pop();
            return !existingSet.has(fileName);
        });
        
        console.log(`📝 Precisamos criar: ${toCreate.length} registros\n`);
        
        if (toCreate.length > 0) {
            // Criar em lotes para não sobrecarregar
            const batchSize = 100;
            let created = 0;
            
            for (let i = 0; i < toCreate.length; i += batchSize) {
                const batch = toCreate.slice(i, i + batchSize);
                
                const documents = batch.map(photo => {
                    const fileName = photo.name.split('/').pop();
                    return {
                        photoId: fileName,
                        fileName: fileName,
                        r2Key: photo.key || photo.name,
                        virtualStatus: {
                            status: 'available',
                            tags: ['available']
                        }
                    };
                });
                
                await PhotoStatus.insertMany(documents, { ordered: false });
                created += batch.length;
                
                console.log(`   ✅ ${created}/${toCreate.length} criados...`);
            }
        }
        
        const finalCount = await PhotoStatus.countDocuments();
        console.log(`\n✅ COMPLETO! PhotoStatus tem ${finalCount} registros`);
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
    
    await mongoose.disconnect();
}

// Confirmar
console.log('⚠️  ATENÇÃO:');
console.log('   - Vai criar ~3000 registros no MongoDB Atlas');
console.log('   - Pode demorar 5-10 minutos');
console.log('   - NÃO afetará performance depois');
console.log('   - Melhora performance futura\n');

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
