require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const Selection = require('./src/models/Selection');

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\n📋 NOVA SELEÇÃO:\n');
    
    // Ver última seleção
    const selection = await Selection.findOne({ status: 'pending' }).sort({ createdAt: -1 });
    if (selection) {
        console.log(`✅ Seleção encontrada: ${selection.selectionId}`);
        console.log(`   Cliente: ${selection.clientName} (${selection.clientCode})`);
        console.log(`   Items: ${selection.totalItems}`);
        console.log(`   Status: ${selection.status}`);
    }
    
    // Ver fotos reservadas
    const reserved = await PhotoStatus.find({ 'virtualStatus.status': 'reserved' });
    console.log(`\n🏷️ Fotos RESERVADAS: ${reserved.length}`);
    reserved.forEach(p => {
        console.log(`  - ${p.fileName}: ${p.virtualStatus.currentSelection || 'sem selection'}`);
    });
    
    await mongoose.disconnect();
}

check();
