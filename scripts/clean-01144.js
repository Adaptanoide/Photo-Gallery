// scripts/clean-01144.js
const mongoose = require('mongoose');
const CDEWriter = require('../src/services/CDEWriter');
require('dotenv').config();

async function clean01144() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB\n');
        
        console.log('🧹 Limpando inconsistência da foto 01144...\n');
        
        // Tentar liberar no CDE (agora que o CDEWriter foi corrigido)
        console.log('Liberando no CDE...');
        const result = await CDEWriter.markAsAvailable('01144');
        
        if (result) {
            console.log('✅ Foto 01144 liberada no CDE com sucesso');
            console.log('   Agora está INGRESADO em ambos os sistemas');
        } else {
            console.log('⚠️ CDE reportou que a foto já estava liberada');
        }
        
        // Verificar status final
        const cdeStatus = await CDEWriter.checkStatus('01144');
        console.log('\n📊 Status Final no CDE:');
        console.log(`   Status: ${cdeStatus?.status}`);
        console.log(`   ReservedBy: ${cdeStatus?.reservedBy || 'ninguém'}`);
        
        if (cdeStatus?.status === 'INGRESADO') {
            console.log('\n✅ Foto 01144 está limpa e pronta para o teste!');
        } else {
            console.log('\n⚠️ Algo não está certo, verifique manualmente');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.connection.close();
    }
}

clean01144();