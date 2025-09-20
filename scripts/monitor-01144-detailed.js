// scripts/monitor-01144-detailed.js
const mongoose = require('mongoose');
const CDEWriter = require('../src/services/CDEWriter');
require('dotenv').config();

let lastStatus = '';

async function checkStatus() {
    const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
    const Selection = require('../src/models/Selection');
    
    const photo = await UnifiedProductComplete.findOne({
        $or: [
            { fileName: '01144.webp' },
            { photoNumber: '01144' }
        ]
    });
    
    const cdeStatus = await CDEWriter.checkStatus('01144');
    
    // Buscar seleção ativa
    const selection = await Selection.findOne({
        'items.fileName': '01144.webp',
        status: { $ne: 'cancelled' }
    });
    
    const selectionInfo = selection ? ` | Selection: ${selection.status.toUpperCase()}` : ' | No selection';
    
    const currentStatus = `MongoDB: ${photo?.status || 'N/A'} | CDE: ${cdeStatus?.status || 'N/A'}${selectionInfo}`;
    
    if (currentStatus !== lastStatus) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`\n[${timestamp}]`);
        console.log(`  MongoDB Status: ${photo?.status} (cdeStatus: ${photo?.cdeStatus})`);
        console.log(`  CDE Real: ${cdeStatus?.status}`);
        if (selection) {
            console.log(`  Selection: ${selection.selectionId} - Status: ${selection.status}`);
        }
        
        // Análise do que aconteceu
        if (photo?.cdeStatus === 'PRE-SELECTED') {
            console.log('  ➡️ Foto no carrinho');
        } else if (photo?.cdeStatus === 'CONFIRMED' && selection?.status === 'pending') {
            console.log('  ➡️ Seleção confirmada, aguardando aprovação');
        } else if (photo?.status === 'sold' && cdeStatus?.status === 'CONFIRMED') {
            console.log('  ➡️ VENDIDA no sistema mas CDE ainda CONFIRMED (correto!)');
        } else if (photo?.cdeStatus === 'INGRESADO' && lastStatus.includes('sold')) {
            console.log('  ➡️ Venda cancelada, foto liberada!');
        }
        
        lastStatus = currentStatus;
    }
}

async function startMonitoring() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Monitorando foto 01144 com detalhes da seleção...');
    console.log('Pressione Ctrl+C para parar\n');
    
    setInterval(checkStatus, 1000);
}

startMonitoring();