// backup-before-migration.js
const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

async function backupEverything() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const PhotoStatus = require('./src/models/PhotoStatus');
    const Product = require('./src/models/Product');
    const Cart = require('./src/models/Cart');
    const Selection = require('./src/models/Selection');
    
    console.log('📦 Fazendo backup completo...\n');
    
    const backup = {
        timestamp: new Date().toISOString(),
        photostatuses: await PhotoStatus.find({}).lean(),
        products: await Product.find({}).lean(),
        carts: await Cart.find({ isActive: true }).lean(),
        selections: await Selection.find({ status: { $in: ['pending', 'confirmed'] } }).lean()
    };
    
    const fileName = `backup-completo-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(fileName, JSON.stringify(backup, null, 2));
    
    console.log(`✅ Backup salvo em: ${fileName}`);
    console.log(`   PhotoStatus: ${backup.photostatuses.length}`);
    console.log(`   Products: ${backup.products.length}`);
    console.log(`   Carts ativos: ${backup.carts.length}`);
    console.log(`   Selections: ${backup.selections.length}`);
    
    mongoose.disconnect();
}

backupEverything();