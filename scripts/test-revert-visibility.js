require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');

async function testRevertVisibility() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\\n🔍 TESTE DO REVERT:\\n');
    
    // Ver fotos com diferentes status
    const statuses = await PhotoStatus.aggregate([
        { $group: { 
            _id: '$virtualStatus.status', 
            count: { $sum: 1 },
            files: { $push: '$fileName' }
        }}
    ]);
    
    statuses.forEach(s => {
        console.log(`\\n${s._id}: ${s.count} fotos`);
        if (s._id === 'sold') {
            console.log('   Fotos vendidas:', s.files.join(', '));
            console.log('   ⚠️ Estas NÃO aparecem na interface!');
        }
        if (s._id === 'available') {
            console.log('   ✅ Estas aparecem na interface!');
        }
    });
    
    await mongoose.disconnect();
}

testRevertVisibility();
