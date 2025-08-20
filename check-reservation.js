require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const Selection = require('./src/models/Selection');

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Ver fotos reservadas
    const reserved = await PhotoStatus.find({ 'virtualStatus.status': 'reserved' });
    console.log(`\n🏷️ FOTOS RESERVADAS: ${reserved.length}`);
    reserved.forEach(p => {
        console.log(`- ${p.fileName}: ${p.virtualStatus.clientCode} | ${p.virtualStatus.currentSelection}`);
    });
    
    // Ver seleções pendentes
    const selections = await Selection.find({ status: 'pending' });
    console.log(`\n📋 SELEÇÕES PENDENTES: ${selections.length}`);
    selections.forEach(s => {
        console.log(`- ${s.selectionId}: ${s.clientName} | ${s.totalItems} items`);
    });
    
    await mongoose.disconnect();
}

check();
