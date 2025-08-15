// test-reserve-cancel.js

require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const PhotoTagService = require('./src/services/PhotoTagService');

async function testReserveAndCancel() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB\n');
        
        // 1. Mostrar estatísticas antes
        console.log('📊 ESTATÍSTICAS ANTES DO TESTE:');
        const beforeStats = await PhotoStatus.aggregate([
            { $group: { _id: '$virtualStatus.status', count: { $sum: 1 } } }
        ]);
        beforeStats.forEach(s => console.log(`   ${s._id}: ${s.count} fotos`));
        
        // 2. Buscar 2 fotos AVAILABLE para teste
        console.log('\n🔍 Buscando 2 fotos disponíveis para teste...');
        const availablePhotos = await PhotoStatus.find({
            'virtualStatus.status': 'available'
        }).limit(2);
        
        if (availablePhotos.length < 2) {
            console.log('❌ Menos de 2 fotos disponíveis!');
            return;
        }
        
        const testPhotos = availablePhotos.map(p => ({
            id: p.photoId,
            name: p.fileName
        }));
        
        console.log('📸 Fotos selecionadas:');
        testPhotos.forEach(p => console.log(`   - ${p.name}`));
        
        // 3. TESTAR RESERVA
        console.log('\n🏷️ TESTANDO RESERVA COM TAGS...');
        const photoIds = testPhotos.map(p => p.id);
        const reserveResult = await PhotoTagService.reservePhotos(
            photoIds,
            'TEST_SEL_001',
            '9999'
        );
        console.log(`✅ Resultado: ${reserveResult.photosTagged} fotos reservadas`);
        
        // 4. Verificar mudança
        console.log('\n📊 VERIFICANDO MUDANÇA:');
        const reserved = await PhotoStatus.find({
            'virtualStatus.currentSelection': 'TEST_SEL_001'
        });
        console.log(`   Fotos com tag TEST_SEL_001: ${reserved.length}`);
        reserved.forEach(r => {
            console.log(`   - ${r.fileName}: status=${r.virtualStatus.status}, tags=${r.virtualStatus.tags}`);
        });
        
        // 5. TESTAR CANCELAMENTO
        console.log('\n🏷️ TESTANDO CANCELAMENTO COM TAGS...');
        const cancelResult = await PhotoTagService.cancelSelection('TEST_SEL_001');
        console.log(`✅ Resultado: ${cancelResult.photosTagged} fotos liberadas`);
        
        // 6. Estatísticas finais
        console.log('\n📊 ESTATÍSTICAS DEPOIS DO TESTE:');
        const afterStats = await PhotoStatus.aggregate([
            { $group: { _id: '$virtualStatus.status', count: { $sum: 1 } } }
        ]);
        afterStats.forEach(s => console.log(`   ${s._id}: ${s.count} fotos`));
        
        console.log('\n✅ TESTE CONCLUÍDO!');
        console.log('As fotos foram reservadas e depois liberadas SEM MOVER ARQUIVOS!');
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Desconectado');
    }
}

console.log('🧪 TESTE DO SISTEMA DE TAGS\n');
console.log('Este teste vai:');
console.log('1. Reservar 2 fotos com tags');
console.log('2. Cancelar e liberar as fotos');
console.log('3. Tudo SEM mover arquivos!\n');

testReserveAndCancel();