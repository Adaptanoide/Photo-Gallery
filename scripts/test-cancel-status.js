require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const Selection = require('./src/models/Selection');

async function testCancelStatus() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\\n🔍 TESTE DO CANCEL:\\n');
    
    // Ver seleções canceladas
    const cancelledSelections = await Selection.find({ 
        status: 'cancelled' 
    }).sort({ updatedAt: -1 }).limit(1);
    
    if (cancelledSelections.length > 0) {
        const lastCancelled = cancelledSelections[0];
        console.log(`📋 Última seleção cancelada: ${lastCancelled.selectionId}`);
        console.log(`   Items: ${lastCancelled.items.length}`);
        
        // Ver status das fotos dessa seleção
        const photoIds = lastCancelled.items.map(i => i.fileName);
        const photos = await PhotoStatus.find({
            fileName: { $in: photoIds }
        });
        
        console.log('\\n📸 STATUS DAS FOTOS CANCELADAS:');
        photos.forEach(p => {
            console.log(`   ${p.fileName}: ${p.virtualStatus.status} (selection: ${p.virtualStatus.currentSelection})`);
        });
    }
    
    // Ver todas as fotos reserved
    const stillReserved = await PhotoStatus.find({
        'virtualStatus.status': 'reserved'
    });
    
    console.log(`\\n⚠️ Fotos AINDA reservadas: ${stillReserved.length}`);
    stillReserved.forEach(p => {
        console.log(`   ${p.fileName}: selection ${p.virtualStatus.currentSelection}`);
    });
    
    await mongoose.disconnect();
}

testCancelStatus();
