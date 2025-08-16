// test-r2-cache.js
require('dotenv').config();
const R2Service = require('./src/services/R2Service');

async function testCacheUpload() {
    console.log('🔄 Teste de Upload com Cache Headers\n');
    
    try {
        // Criar imagem azul de teste
        const bluePixel = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYwAAAABJRU5ErkJggg==',
            'base64'
        );
        
        // Upload com cache headers
        console.log('📤 Upload com Cache-Control...');
        const result = await R2Service.uploadPhoto(
            bluePixel,
            'test-cache-image.png',
            'test/cache'
        );
        
        console.log('✅ Upload concluído!');
        console.log('🔗 URL:', result.publicUrl);
        console.log('\n⏱️ Aguarde 3 segundos para propagar...');
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('\n📊 VERIFIQUE OS HEADERS:');
        console.log('Execute:');
        console.log(`curl -I ${result.publicUrl}`);
        
    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

testCacheUpload();
