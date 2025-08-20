require('dotenv').config();
const mongoose = require('mongoose');
const PhotoCategory = require('./src/models/PhotoCategory');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const total = await PhotoCategory.countDocuments({ isActive: true });
    const comFotos = await PhotoCategory.countDocuments({ 
        isActive: true, 
        photoCount: { $gt: 0 } 
    });
    
    console.log('📊 Total categorias ativas:', total);
    console.log('📸 Categorias com fotos:', comFotos);
    
    // Ver as primeiras 5
    const cats = await PhotoCategory.find({ isActive: true })
        .limit(5)
        .select('displayName photoCount');
    
    console.log('\n📁 Primeiras 5 categorias:');
    cats.forEach(c => console.log(`  - ${c.displayName} (${c.photoCount} fotos)`));
    
    process.exit(0);
}

test();\
