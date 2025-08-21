require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const Selection = require('./src/models/Selection');

async function showStuckPhotos() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\\n🔍 FOTOS PRESAS (ÓRFÃS):\\n');
    
    // Fotos reservadas
    const reserved = await PhotoStatus.find({
        'virtualStatus.status': 'reserved'
    });
    
    console.log(`📸 Total de fotos reservadas: ${reserved.length}\\n`);
    
    // Agrupar por seleção
    const bySelection = {};
    reserved.forEach(p => {
        const sel = p.virtualStatus.currentSelection || 'SEM_SELECTION';
        if (!bySelection[sel]) bySelection[sel] = [];
        bySelection[sel].push(p.fileName);
    });
    
    // Verificar se as seleções existem
    for (const [selId, photos] of Object.entries(bySelection)) {
        const selection = await Selection.findOne({ selectionId: selId });
        console.log(`📋 Seleção ${selId}:`);
        console.log(`   Status: ${selection ? selection.status : '❌ NÃO EXISTE'}`);
        console.log(`   Fotos: ${photos.join(', ')}`);
        
        if (!selection || selection.status === 'cancelled') {
            console.log(`   ⚠️ PODE SER LIBERADA!\\n`);
        } else {
            console.log(`   ✅ Seleção válida\\n`);
        }
    }
    
    await mongoose.disconnect();
}

showStuckPhotos();
