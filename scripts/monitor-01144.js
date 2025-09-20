// scripts/monitor-01144.js
const mongoose = require('mongoose');
const CDEWriter = require('../src/services/CDEWriter');
require('dotenv').config();

async function monitorPhoto01144() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
    
    console.clear();
    console.log('=' .repeat(60));
    console.log('MONITORAMENTO DA FOTO 01144');
    console.log('=' .repeat(60));
    
    // Buscar a foto no MongoDB
    const photo = await UnifiedProductComplete.findOne({
        $or: [
            { fileName: '01144.webp' },
            { photoNumber: '01144' },
            { photoNumber: '1144' }
        ]
    });
    
    if (!photo) {
        console.log('❌ Foto 01144 não encontrada no MongoDB');
        await mongoose.connection.close();
        return;
    }
    
    // Verificar status no CDE também
    const cdeStatus = await CDEWriter.checkStatus('01144');
    
    console.log('\n📸 STATUS ATUAL DA FOTO 01144:\n');
    console.log('MongoDB:');
    console.log(`  status: ${photo.status}`);
    console.log(`  currentStatus: ${photo.currentStatus}`);
    console.log(`  cdeStatus: ${photo.cdeStatus}`);
    console.log(`  reservedBy: ${photo.reservedBy?.clientCode || 'ninguém'}`);
    console.log(`  selectionId: ${photo.selectionId || 'nenhuma'}`);
    
    console.log('\nCDE Real:');
    console.log(`  status: ${cdeStatus?.status || 'não encontrado'}`);
    console.log(`  reservedBy: ${cdeStatus?.reservedBy || 'ninguém'}`);
    
    // Verificar em qual carrinho está, se estiver
    if (photo.reservedBy?.sessionId) {
        const Cart = require('../src/models/Cart');
        const cart = await Cart.findOne({ sessionId: photo.reservedBy.sessionId });
        if (cart) {
            console.log('\n🛒 CARRINHO:');
            console.log(`  sessionId: ${cart.sessionId}`);
            console.log(`  clientCode: ${cart.clientCode}`);
            console.log(`  items no carrinho: ${cart.items.length}`);
        }
    }
    
    // Verificar se está em alguma seleção
    const Selection = require('../src/models/Selection');
    const selection = await Selection.findOne({
        'items.fileName': '01144.webp'
    });
    
    if (selection) {
        console.log('\n📋 SELEÇÃO:');
        console.log(`  selectionId: ${selection.selectionId}`);
        console.log(`  status: ${selection.status}`);
        console.log(`  clientCode: ${selection.clientCode}`);
    }
    
    console.log('\n' + '=' .repeat(60));
    
    await mongoose.connection.close();
}

// Executar a cada 2 segundos se passado o parâmetro --watch
if (process.argv.includes('--watch')) {
    setInterval(monitorPhoto01144, 2000);
} else {
    monitorPhoto01144();
}