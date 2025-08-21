require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const Product = require('./src/models/Product');

async function analyzeVisibility() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\\n🔍 ANÁLISE DO PROBLEMA DE VISIBILIDADE:\\n');
    
    // 1. Quantas fotos estão reservadas mas ainda visíveis?
    const reservedPhotos = await PhotoStatus.find({ 
        'virtualStatus.status': 'reserved' 
    });
    
    const reservedProducts = await Product.find({ 
        status: 'reserved_pending' 
    });
    
    console.log(`📸 PhotoStatus reservados: ${reservedPhotos.length}`);
    console.log(`📦 Products reserved_pending: ${reservedProducts.length}`);
    
    // 2. Ver se a API está filtrando corretamente
    console.log('\\n🔍 DETALHES DAS FOTOS RESERVADAS:');
    reservedPhotos.forEach(p => {
        console.log(`   ${p.fileName}:`);
        console.log(`      Status: ${p.virtualStatus.status}`);
        console.log(`      Cliente: ${p.virtualStatus.clientCode}`);
        console.log(`      Seleção: ${p.virtualStatus.currentSelection}`);
    });
    
    // 3. Testar query que DEVERIA ser usada
    console.log('\\n✅ FOTOS QUE DEVERIAM APARECER (query correta):');
    const availableOnly = await PhotoStatus.find({
        $or: [
            { 'virtualStatus.status': 'available' },
            { 'virtualStatus.status': { $exists: false } }
        ]
    }).countDocuments();
    
    console.log(`   Apenas disponíveis: ${availableOnly} fotos`);
    
    await mongoose.disconnect();
}

analyzeVisibility();
