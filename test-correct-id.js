require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const Selection = require('./src/models/Selection');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Ver última seleção
    const selection = await Selection.findOne({}).sort({ createdAt: -1 });
    console.log(`\n📋 Última seleção: ${selection.selectionId}`);
    
    // Ver fotos reservadas
    const reserved = await PhotoStatus.find({ 'virtualStatus.status': 'reserved' });
    if (reserved.length > 0) {
        console.log(`\n🏷️ Fotos reservadas com ID:`);
        reserved.forEach(p => {
            console.log(`  - ${p.fileName}: ${p.virtualStatus.currentSelection}`);
        });
        
        // Verificar se IDs batem
        const match = reserved[0].virtualStatus.currentSelection === selection.selectionId;
        console.log(`\n${match ? '✅' : '❌'} IDs ${match ? 'CORRETOS!' : 'DIFERENTES!'}`);
    }
    
    await mongoose.disconnect();
}

test();
