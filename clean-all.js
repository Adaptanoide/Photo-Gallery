require('dotenv').config();
const mongoose = require('mongoose');
const Cart = require('./src/models/Cart');
const Product = require('./src/models/Product');

async function clean() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Limpar todos os carrinhos
    await Cart.deleteMany({});
    console.log('✅ Carrinhos limpos');
    
    // Resetar todos os produtos
    await Product.updateMany(
        { status: { $ne: 'available' } },
        { 
            $set: { status: 'available' },
            $unset: { reservedBy: 1, cartAddedAt: 1 }
        }
    );
    console.log('✅ Produtos resetados');
    
    await mongoose.disconnect();
}

clean();
