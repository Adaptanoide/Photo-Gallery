// scripts/check-all-inconsistencies.js
const mongoose = require('mongoose');
const StatusConsistencyGuard = require('../src/services/StatusConsistencyGuard');
require('dotenv').config();

async function checkAll() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB\n');
        
        const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
        
        // Buscar TODAS as fotos
        console.log('🔍 Buscando todas as fotos...');
        const allPhotos = await UnifiedProductComplete.find({});
        
        console.log(`📊 Total de fotos no banco: ${allPhotos.length}\n`);
        console.log('Verificando consistência...\n');
        
        let consistent = 0;
        let inconsistent = 0;
        const problems = [];
        
        for (const photo of allPhotos) {
            const issues = StatusConsistencyGuard.checkConsistency(photo);
            
            if (issues.length > 0) {
                inconsistent++;
                problems.push({
                    fileName: photo.fileName,
                    cdeStatus: photo.cdeStatus,
                    status: photo.status,
                    issues: issues
                });
            } else {
                consistent++;
            }
        }
        
        // Mostrar resultado
        console.log('=' .repeat(60));
        console.log('📊 RESULTADO DA VERIFICAÇÃO:');
        console.log('=' .repeat(60));
        console.log(`✅ Fotos consistentes: ${consistent} (${(consistent/allPhotos.length*100).toFixed(1)}%)`);
        console.log(`⚠️  Fotos com problemas: ${inconsistent} (${(inconsistent/allPhotos.length*100).toFixed(1)}%)`);
        
        if (inconsistent > 0) {
            console.log('\n🔴 PRIMEIRAS 10 INCONSISTÊNCIAS:');
            problems.slice(0, 10).forEach((p, i) => {
                console.log(`\n${i+1}. ${p.fileName}`);
                console.log(`   CDE: ${p.cdeStatus} | MongoDB: ${p.status}`);
                console.log(`   Problemas:`);
                p.issues.forEach(issue => console.log(`     - ${issue}`));
            });
            
            if (problems.length > 10) {
                console.log(`\n... e mais ${problems.length - 10} inconsistências`);
            }
        }
        
        console.log('\n' + '=' .repeat(60));
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n👋 Conexão fechada');
    }
}

checkAll();