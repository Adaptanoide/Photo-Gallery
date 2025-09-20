// scripts/monitor-01144-live.js
const mongoose = require('mongoose');
const CDEWriter = require('../src/services/CDEWriter');
require('dotenv').config();

let lastStatus = '';

async function checkStatus() {
    const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
    
    const photo = await UnifiedProductComplete.findOne({
        $or: [
            { fileName: '01144.webp' },
            { photoNumber: '01144' }
        ]
    });
    
    const cdeStatus = await CDEWriter.checkStatus('01144');
    
    const currentStatus = `MongoDB: ${photo?.cdeStatus || 'N/A'} | CDE: ${cdeStatus?.status || 'N/A'} | Reserved: ${photo?.reservedBy?.clientCode || 'none'}`;
    
    if (currentStatus !== lastStatus) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ${currentStatus}`);
        
        if (photo?.cdeStatus === 'PRE-SELECTED') {
            console.log('  ✓ Foto adicionada ao carrinho com sucesso!');
        } else if (photo?.cdeStatus === 'CONFIRMED') {
            console.log('  ✓ Seleção confirmada pelo cliente!');
        } else if (photo?.cdeStatus === 'INGRESADO' && lastStatus.includes('CONFIRMED')) {
            console.log('  ✓ Seleção cancelada, foto liberada!');
        }
        
        lastStatus = currentStatus;
    }
}

async function startMonitoring() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Monitorando foto 01144 em tempo real...');
    console.log('Pressione Ctrl+C para parar\n');
    
    setInterval(checkStatus, 1000); // Verifica a cada 1 segundo
}

startMonitoring();