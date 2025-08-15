// test-tag-system.js

require('dotenv').config();
const mongoose = require('mongoose');
const PhotoTagService = require('./src/services/PhotoTagService');

async function testTagSystem() {
    try {
        // Conectar ao banco
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB');
        
        // 1. Testar migração
        console.log('\n📊 INICIANDO MIGRAÇÃO DOS DADOS...');
        console.log('(Isso vai adicionar virtualStatus aos PhotoStatus existentes)');
        
        const migrationResult = await PhotoTagService.migrateExistingData();
        console.log('Resultado da migração:', migrationResult);
        
        console.log('\n✅ TESTE DE MIGRAÇÃO CONCLUÍDO!');
        console.log('Os PhotoStatus agora têm o campo virtualStatus');
        
    } catch (error) {
        console.error('❌ Erro no teste:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Desconectado do MongoDB');
    }
}

// Executar teste
console.log('🚀 TESTANDO SISTEMA DE TAGS...\n');
testTagSystem();