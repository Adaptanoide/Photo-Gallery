require('dotenv').config();
const mongoose = require('mongoose');
const PhotoTagService = require('./src/services/PhotoTagService');
const PhotoStatus = require('./src/models/PhotoStatus');

async function testReal() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('🧪 TESTE DO SISTEMA DE TAGS\n');
    
    // 1. Pegar 3 fotos reais para teste
    const testPhotos = [
        'Brazil Best Sellers/Best Value - Brindle Medium and Dark Tones Mix ML-XL/01214.webp',
        'Brazil Best Sellers/Best Value - Brindle Medium and Dark Tones Mix ML-XL/07515.webp',
        'Brazil Best Sellers/Best Value - Brindle Medium and Dark Tones Mix ML-XL/07525.webp'
    ];
    
    console.log('📸 Fotos para teste:', testPhotos);
    
    // 2. Ver status ANTES
    console.log('\n📊 STATUS ANTES:');
    for (const photoId of testPhotos) {
        const photo = await PhotoStatus.findOne({ photoId });
        console.log(`- ${photo.fileName}: ${photo.virtualStatus.status}`);
    }
    
    // 3. ATIVAR sistema de tags temporariamente
    PhotoTagService.USE_VIRTUAL_SYSTEM = true;
    console.log('\n✅ Sistema de tags ATIVADO temporariamente');
    
    // 4. RESERVAR as fotos
    console.log('\n🏷️ Reservando fotos...');
    const reserveResult = await PhotoTagService.reservePhotos(
        testPhotos,
        'TEST_SEL_001',
        '8041'
    );
    console.log('Resultado:', reserveResult);
    
    // 5. Ver status DEPOIS
    console.log('\n📊 STATUS DEPOIS:');
    for (const photoId of testPhotos) {
        const photo = await PhotoStatus.findOne({ photoId });
        console.log(`- ${photo.fileName}: ${photo.virtualStatus.status}`);
        console.log(`  Tags: ${photo.virtualStatus.tags.join(', ')}`);
    }
    
    // 6. TESTAR APROVAÇÃO
    console.log('\n🏷️ Aprovando seleção...');
    const approveResult = await PhotoTagService.approveSelection('TEST_SEL_001');
    console.log('Resultado:', approveResult);
    
    // 7. Ver status FINAL
    console.log('\n📊 STATUS FINAL:');
    for (const photoId of testPhotos) {
        const photo = await PhotoStatus.findOne({ photoId });
        console.log(`- ${photo.fileName}: ${photo.virtualStatus.status}`);
    }
    
    // 8. REVERTER TUDO (cancelar)
    console.log('\n🔄 Revertendo para teste futuro...');
    const cancelResult = await PhotoTagService.cancelSelection('TEST_SEL_001');
    console.log('Resultado:', cancelResult);
    
    console.log('\n✅ TESTE COMPLETO!');
    
    await mongoose.disconnect();
}

testReal();
