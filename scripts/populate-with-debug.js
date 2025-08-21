require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');

async function testCreate() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\n🧪 TESTE DE CRIAÇÃO:\n');
    
    try {
        // Tentar criar um registro teste
        const testPhoto = {
            photoId: 'TEST_' + Date.now(),
            fileName: 'TEST_' + Date.now() + '.webp',
            r2Key: 'test/key',
            virtualStatus: {
                status: 'available',
                tags: ['available']
            }
        };
        
        console.log('Tentando criar:', testPhoto);
        
        const created = await PhotoStatus.create(testPhoto);
        console.log('✅ Criado com sucesso!', created._id);
        
        // Deletar o teste
        await PhotoStatus.deleteOne({ _id: created._id });
        console.log('🗑️ Teste deletado');
        
    } catch (error) {
        console.error('❌ ERRO ao criar:', error.message);
        console.error('Detalhes:', error);
    }
    
    await mongoose.disconnect();
}

testCreate();
