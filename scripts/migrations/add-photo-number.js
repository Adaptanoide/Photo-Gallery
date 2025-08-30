const mongoose = require('mongoose');
require('dotenv').config();
require('../../src/models/PhotoStatus')

async function addPhotoNumberField() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    console.log('=== ADICIONANDO CAMPO photoNumber ===\n');
    
    const collection = db.collection('photostatuses');
    const allPhotos = await collection.find({}).toArray();
    
    console.log(`Total de registros: ${allPhotos.length}\n`);
    
    let updated = 0;
    let errors = 0;
    
    for (const photo of allPhotos) {
        try {
            // Extrair número puro
            let photoNumber = photo.photoId;
            
            if (photoNumber && photoNumber.includes('/')) {
                // Path completo - extrair número
                photoNumber = photoNumber.split('/').pop().replace('.webp', '');
            }
            
            // Atualizar com campo normalizado
            await collection.updateOne(
                { _id: photo._id },
                { $set: { photoNumber: photoNumber } }
            );
            
            updated++;
            
            // Progresso
            if (updated % 200 === 0) {
                console.log(`Processados: ${updated}/${allPhotos.length}`);
            }
            
        } catch (error) {
            errors++;
            console.log(`Erro em ${photo.photoId}: ${error.message}`);
        }
    }
    
    console.log('\n=== RESULTADO ===');
    console.log(`✓ ${updated} registros atualizados`);
    console.log(`✗ ${errors} erros`);
    
    // Verificar resultado
    const sample = await collection.find({}).limit(5).toArray();
    console.log('\nAmostra dos resultados:');
    sample.forEach(s => {
        console.log(`  photoId: "${s.photoId}" → photoNumber: "${s.photoNumber}"`);
    });
    
    await mongoose.disconnect();
}

addPhotoNumberField();