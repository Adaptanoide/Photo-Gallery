// scripts/monitor-photo.js
const mongoose = require('mongoose');
require('dotenv').config();

async function monitorPhoto(fileName) {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
    const StatusConsistencyGuard = require('../src/services/StatusConsistencyGuard');
    
    // Buscar a foto
    const photo = await UnifiedProductComplete.findOne({ 
        fileName: fileName + '.webp' 
    });
    
    if (!photo) {
        console.log('Foto não encontrada');
        return;
    }
    
    console.log('\n📸 Monitorando:', photo.fileName);
    console.log('Status:', photo.status);
    console.log('CurrentStatus:', photo.currentStatus);
    console.log('CDE Status:', photo.cdeStatus);
    console.log('Reserved by:', photo.reservedBy?.clientCode || 'Ninguém');
    
    // Verificar consistência
    const issues = StatusConsistencyGuard.checkConsistency(photo);
    if (issues.length === 0) {
        console.log('✅ Status consistentes');
    } else {
        console.log('⚠️ Inconsistências:', issues);
    }
    
    await mongoose.connection.close();
}

// Pegar o nome da foto dos argumentos
const photoName = process.argv[2];
if (!photoName) {
    console.log('Uso: node scripts/monitor-photo.js [numero-da-foto]');
    console.log('Exemplo: node scripts/monitor-photo.js 01214');
} else {
    monitorPhoto(photoName);
}