// scripts/test-confirmed-cancel.js
const mongoose = require('mongoose');
const CDEWriter = require('../src/services/CDEWriter');
require('dotenv').config();

async function testConfirmedCancel() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB\n');
        console.log('=' .repeat(60));
        console.log('TESTE: Cancelamento de Fotos CONFIRMED');
        console.log('=' .repeat(60));
        
        const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
        
        // Buscar uma foto que está CONFIRMED
        const confirmedPhoto = await UnifiedProductComplete.findOne({
            cdeStatus: 'CONFIRMED'
        });
        
        if (!confirmedPhoto) {
            console.log('❌ Nenhuma foto CONFIRMED encontrada para teste');
            console.log('   Isso é bom - significa que não há fotos presas em CONFIRMED');
            return;
        }
        
        console.log(`\n📸 Foto encontrada: ${confirmedPhoto.fileName}`);
        console.log(`   Status MongoDB: ${confirmedPhoto.status}`);
        console.log(`   CDE Status: ${confirmedPhoto.cdeStatus}`);
        
        // Extrair número da foto
        const photoNumber = confirmedPhoto.fileName.replace(/\D/g, '');
        console.log(`   Número da foto: ${photoNumber}`);
        
        // Tentar liberar no CDE usando markAsAvailable
        console.log('\n🔄 Tentando liberar no CDE com markAsAvailable()...');
        
        try {
            const result = await CDEWriter.markAsAvailable(photoNumber);
            
            if (result) {
                console.log('✅ Foto liberada no CDE com sucesso');
            } else {
                console.log('⚠️ markAsAvailable retornou false - foto não foi liberada');
                console.log('   Isso confirma o bug: fotos CONFIRMED não podem ser liberadas!');
            }
            
        } catch (error) {
            console.log('❌ Erro ao tentar liberar:', error.message);
        }
        
        // Verificar status atual no CDE
        console.log('\n🔍 Verificando status atual no CDE...');
        const cdeStatus = await CDEWriter.checkStatus(photoNumber);
        
        if (cdeStatus) {
            console.log(`   Status no CDE: ${cdeStatus.status}`);
            
            if (cdeStatus.status === 'CONFIRMED') {
                console.log('\n🔴 BUG CONFIRMADO!');
                console.log('   A foto continua CONFIRMED no CDE');
                console.log('   O método markAsAvailable() não funciona para fotos CONFIRMED');
            }
        }
        
    } catch (error) {
        console.error('❌ Erro no teste:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n👋 Conexão fechada');
    }
}

testConfirmedCancel();