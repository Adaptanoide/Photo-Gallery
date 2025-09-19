// scripts/diagnose-detailed.js
const mongoose = require('mongoose');
require('dotenv').config();

async function diagnoseFull() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
    
    const stats = {
        total: 0,
        consistent: 0,
        inconsistent: 0,
        byStatus: {},
        issues: []
    };
    
    const allPhotos = await UnifiedProductComplete.find({});
    stats.total = allPhotos.length;
    
    for (const photo of allPhotos) {
        // Contar por cdeStatus
        if (!stats.byStatus[photo.cdeStatus]) {
            stats.byStatus[photo.cdeStatus] = 0;
        }
        stats.byStatus[photo.cdeStatus]++;
        
        // Verificar consistência
        const StatusConsistencyGuard = require('../src/services/StatusConsistencyGuard');
        const issues = StatusConsistencyGuard.checkConsistency(photo);
        
        if (issues.length > 0) {
            stats.inconsistent++;
            stats.issues.push({
                fileName: photo.fileName,
                issues: issues
            });
        } else {
            stats.consistent++;
        }
    }
    
    // Relatório
    console.log('\n' + '='.repeat(60));
    console.log('DIAGNÓSTICO DO SISTEMA');
    console.log('='.repeat(60));
    console.log(`Total de fotos: ${stats.total}`);
    console.log(`Consistentes: ${stats.consistent} (${(stats.consistent/stats.total*100).toFixed(1)}%)`);
    console.log(`Inconsistentes: ${stats.inconsistent} (${(stats.inconsistent/stats.total*100).toFixed(1)}%)`);
    
    console.log('\nDistribuição por CDE Status:');
    Object.entries(stats.byStatus).forEach(([status, count]) => {
        console.log(`  ${status || 'NULL'}: ${count} fotos`);
    });
    
    if (stats.inconsistent > 0) {
        console.log('\nPrimeiras 10 inconsistências:');
        stats.issues.slice(0, 10).forEach(item => {
            console.log(`  ${item.fileName}:`);
            item.issues.forEach(issue => console.log(`    - ${issue}`));
        });
    }
    
    console.log('='.repeat(60));
    
    await mongoose.connection.close();
}

diagnoseFull();