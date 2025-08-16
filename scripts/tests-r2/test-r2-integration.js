// test-r2-integration.js
require('dotenv').config();
const R2Service = require('./src/services/R2Service');

async function testR2Service() {
    console.log('🧪 Testando R2Service...\n');
    
    try {
        // Teste 1: Listar pastas raiz
        console.log('📁 Teste 1: Listando pastas raiz...');
        const folders = await R2Service.getSubfolders('');
        console.log('Pastas encontradas:', folders.folders.length);
        
        // Teste 2: Listar fotos raiz
        console.log('\n📸 Teste 2: Listando fotos raiz...');
        const photos = await R2Service.getPhotosFromFolder('');
        console.log('Fotos encontradas:', photos.photos.length);
        
        // Teste 3: Upload de teste
        console.log('\n📤 Teste 3: Upload de teste...');
        const testContent = Buffer.from('Teste R2 Service - ' + new Date().toISOString());
        const uploadResult = await R2Service.uploadPhoto(
            testContent,
            'test-r2-service.txt',
            'test'
        );
        console.log('Upload result:', uploadResult);
        
        // Teste 4: Verificar se existe
        console.log('\n🔍 Teste 4: Verificando existência...');
        const exists = await R2Service.objectExists('test/test-r2-service.txt');
        console.log('Arquivo existe?', exists);
        
        console.log('\n✅ Todos os testes passaram!');
        
    } catch (error) {
        console.error('❌ Erro nos testes:', error);
    }
}

testR2Service();
