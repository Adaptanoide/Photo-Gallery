const mongoose = require('mongoose');
require('dotenv').config();

async function dailyCheck() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const Product = require('../src/models/Product');
    const PhotoStatus = require('../src/models/PhotoStatus');
    
    const products = await Product.find({});
    let conflicts = 0;
    
    for (const product of products) {
        if (!product.fileName) continue;
        const ps = await PhotoStatus.findOne({ fileName: product.fileName });
        
        if (ps && product.status !== ps.currentStatus) {
            if (!(product.status === 'reserved' && ps.currentStatus === 'unavailable')) {
                conflicts++;
                console.log(`Conflito: ${product.fileName}`);
            }
        }
    }
    
    if (conflicts > 0) {
        console.log(`⚠️ ALERTA: ${conflicts} conflitos detectados!`);
        // Enviar email ou notificação
    } else {
        console.log('✅ Sistema alinhado');
    }
    
    await mongoose.connection.close();
}

dailyCheck();
