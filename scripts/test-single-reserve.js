require('dotenv').config();
const mongoose = require('mongoose');
const PhotoTagService = require('./src/services/PhotoTagService');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Ativar sistema temporariamente
    PhotoTagService.USE_VIRTUAL_SYSTEM = true;
    
    // Testar com UMA foto fake
    const result = await PhotoTagService.reservePhotos(
        ['TEST_PHOTO_001'], 
        'TEST_SELECTION_001',
        'TEST'
    );
    
    console.log('Resultado:', result);
    
    await mongoose.disconnect();
}

test();
