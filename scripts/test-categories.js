// Teste de categorias
const mongoose = require('mongoose');
const PhotoCategory = require('./src/models/PhotoCategory');

async function testCategories() {
    await mongoose.connect('mongodb://localhost:27017/sunshine-cowhides');
    
    const testNames = [
        "Dark Tones Mix ML-XL",
        "Best Value - Brindle Medium and Dark Tones Mix ML-XL"
    ];
    
    for (const name of testNames) {
        console.log(`\nTestando: "${name}"`);
        
        const result = await PhotoCategory.findOne({
            $or: [
                { folderName: name },
                { displayName: { $regex: ` → ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$` } },
                { displayName: name }
            ]
        });
        
        if (result) {
            console.log(`  ✅ Encontrou: ${result.displayName}`);
            console.log(`     FolderName: ${result.folderName}`);
        } else {
            console.log(`  ❌ NÃO ENCONTROU!`);
        }
    }
    
    mongoose.connection.close();
}

testCategories();
