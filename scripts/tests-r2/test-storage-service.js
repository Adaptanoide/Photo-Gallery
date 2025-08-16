// test-storage-service.js
require('dotenv').config();
const StorageService = require('./src/services/StorageService');

async function testStorageService() {
    console.log('🧪 Testando StorageService\n');
    
    console.log('📊 Modo atual:', StorageService.getCurrentMode());
    console.log('📊 Usando R2?', StorageService.isUsingR2());
    
    // Para testar com R2, mude temporariamente
    console.log('\n🔄 Mudando para R2...');
    process.env.STORAGE_MODE = 'r2';
    
    console.log('📊 Modo atual:', StorageService.getCurrentMode());
    console.log('📊 Usando R2?', StorageService.isUsingR2());
    
    // Testar listagem
    console.log('\n📁 Testando listagem...');
    const folders = await StorageService.getSubfolders('');
    console.log('Pastas encontradas:', folders.folders?.length || 0);
    
    // Testar URLs
    console.log('\n🔗 Testando URLs...');
    const testId = 'test/images/test-cowhide.png';
    console.log('URL Full:', StorageService.getImageUrl(testId, 'full'));
    console.log('URL Thumb:', StorageService.getImageUrl(testId, 'thumb'));
    
    console.log('\n✅ StorageService funcionando!');
}

testStorageService().catch(console.error);
