// test-r2-image.js
require('dotenv').config();
const R2Service = require('./src/services/R2Service');

async function testImageUpload() {
    console.log('🖼️ Teste Upload de Imagem\n');
    
    try {
        // Criar imagem PNG de teste (1x1 pixel vermelho)
        const redPixel = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx8gAAAABJRU5ErkJggg==',
            'base64'
        );
        
        // Upload
        console.log('📤 Fazendo upload...');
        const result = await R2Service.uploadPhoto(
            redPixel,
            'test-cowhide.png',
            'test/images'
        );
        
        console.log('\n✅ Upload concluído!');
        console.log('🔗 URL pública:', result.publicUrl);
        
        console.log('\n🌐 TESTE NO NAVEGADOR:');
        console.log('Abra esta URL:', result.publicUrl);
        
        // Testar headers de cache
        console.log('\n📊 Testando headers...');
        console.log('Execute: curl -I', result.publicUrl);
        
    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

testImageUpload();
