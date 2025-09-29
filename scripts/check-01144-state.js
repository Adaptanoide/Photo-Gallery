// scripts/check-01144-state.js
const mongoose = require('mongoose');
require('dotenv').config();

async function check01144() {
    await mongoose.connect(process.env.MONGODB_URI);
    const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
    
    const photo = await UnifiedProductComplete.findOne(
        { fileName: '01144.webp' },
        { fileName: 1, status: 1, cdeStatus: 1, reservedBy: 1, ghostStatus: 1 }
    );
    
    console.log('\n📸 Estado atual da 01144:');
    console.log('  status:', photo.status);
    console.log('  cdeStatus:', photo.cdeStatus);
    console.log('  reservedBy:', photo.reservedBy || 'LIMPO ✓');
    console.log('  ghostStatus:', photo.ghostStatus || 'LIMPO ✓');
    
    if (photo.status === 'unavailable' && photo.cdeStatus === 'RESERVED' && !photo.reservedBy) {
        console.log('\n✅ PERFEITO! Foto está corretamente configurada!');
    }
    
    await mongoose.disconnect();
}

check01144();