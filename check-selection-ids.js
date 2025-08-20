require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const Selection = require('./src/models/Selection');

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Ver seleção pendente
    const selection = await Selection.findOne({ status: 'pending' });
    if (selection) {
        console.log(`\n📋 SELEÇÃO: ${selection.selectionId}`);
    }
    
    // Ver fotos reservadas e seus IDs
    const reserved = await PhotoStatus.find({ 'virtualStatus.status': 'reserved' });
    console.log(`\n🏷️ FOTOS RESERVADAS:`);
    reserved.forEach(p => {
        console.log(`  - ${p.fileName}:`);
        console.log(`    Selection ID: ${p.virtualStatus.currentSelection}`);
    });
    
    await mongoose.disconnect();
}

check();
