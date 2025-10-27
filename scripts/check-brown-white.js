require('dotenv').config();
const mongoose = require('mongoose');
const PhotoCategory = require('../src/models/PhotoCategory');

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const path = "Cowhide Hair On BRA With Leather Binding And Lined/Brown & White/";
    
    console.log('🔍 Procurando:', path);
    
    const results = await PhotoCategory.find({
        $or: [
            { googleDrivePath: path },
            { googleDrivePath: path.slice(0, -1) },
            { displayName: { $regex: 'Brown.*White', $options: 'i' } }
        ]
    });
    
    console.log(`\n📊 Encontradas ${results.length} entradas:\n`);
    
    results.forEach((cat, i) => {
        console.log(`Entrada ${i + 1}:`);
        console.log(`  _id: ${cat._id}`);
        console.log(`  googleDrivePath: ${cat.googleDrivePath}`);
        console.log(`  displayName: ${cat.displayName}`);
        console.log(`  qbItem: ${cat.qbItem || '(vazio)'}`);
        console.log(`  basePrice: $${cat.basePrice}`);
        console.log(`  participatesInMixMatch: ${cat.participatesInMixMatch}`);
        console.log('');
    });
    
    await mongoose.disconnect();
}

check().catch(console.error);
