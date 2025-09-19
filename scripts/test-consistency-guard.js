// scripts/test-consistency-guard.js
const mongoose = require('mongoose');
const StatusConsistencyGuard = require('../src/services/StatusConsistencyGuard');
require('dotenv').config();

async function testGuard() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB\n');
        
        const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
        
        // Pegar apenas 5 fotos para testar
        const samples = await UnifiedProductComplete.find({}).limit(5);
        
        console.log(`Testando StatusConsistencyGuard em ${samples.length} fotos...\n`);
        console.log('=' .repeat(60));
        
        for (const photo of samples) {
            console.log(`\n📸 Foto: ${photo.fileName}`);
            console.log(`   Status atual: ${photo.status}`);
            console.log(`   CurrentStatus: ${photo.currentStatus}`);
            console.log(`   CDE Status: ${photo.cdeStatus}`);
            
            // Verificar se tem problemas (sem modificar)
            const issues = StatusConsistencyGuard.checkConsistency(photo);
            
            if (issues.length > 0) {
                console.log('   ⚠️ Problemas encontrados:');
                issues.forEach(issue => console.log(`      - ${issue}`));
            } else {
                console.log('   ✅ Tudo consistente');
            }
        }
        
        console.log('\n' + '=' .repeat(60));
        console.log('Teste concluído - Nenhuma modificação foi feita');
        
    } catch (error) {
        console.error('❌ Erro no teste:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n👋 Conexão fechada');
    }
}

testGuard();