// check-indexes.js
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI);

async function checkIndexes() {
    const AccessCode = require('./src/models/AccessCode');
    const PhotoCategory = require('./src/models/PhotoCategory');
    
    console.log('\n📊 ÍNDICES DO MONGODB:\n');
    
    // Índices do AccessCode
    const accessIndexes = await AccessCode.collection.getIndexes();
    console.log('AccessCode indexes:');
    accessIndexes.forEach(idx => {
        console.log(`  - ${JSON.stringify(idx.key)} ${idx.unique ? '(unique)' : ''}`);
    });
    
    // Índices do PhotoCategory
    const photoIndexes = await PhotoCategory.collection.getIndexes();
    console.log('\nPhotoCategory indexes:');
    photoIndexes.forEach(idx => {
        console.log(`  - ${JSON.stringify(idx.key)}`);
    });
    
    // Contar documentos
    const accessCount = await AccessCode.countDocuments();
    const photoCount = await PhotoCategory.countDocuments();
    
    console.log(`\n📈 ESTATÍSTICAS:`);
    console.log(`  AccessCodes: ${accessCount} documentos`);
    console.log(`  PhotoCategories: ${photoCount} documentos`);
    
    mongoose.disconnect();
}

checkIndexes().catch(console.error);