require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./src/models/Product');
const Cart = require('./src/models/Cart');

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Ver carrinho ativo
    const cart = await Cart.findOne({ isActive: true });
    if (cart) {
        console.log('\n🛒 CARRINHO ATIVO:');
        console.log(`- Session: ${cart.sessionId}`);
        console.log(`- Items: ${cart.totalItems}`);
        console.log(`- IDs dos produtos:`);
        cart.items.forEach(item => {
            console.log(`  - ${item.driveFileId}`);
        });
        
        // Ver status dos produtos no carrinho
        console.log('\n📦 STATUS DOS PRODUTOS NO CARRINHO:');
        for (const item of cart.items) {
            const product = await Product.findById(item.productId);
            if (product) {
                console.log(`- ${product.fileName}: status=${product.status}`);
            }
        }
    } else {
        console.log('❌ Nenhum carrinho ativo');
    }
    
    await mongoose.disconnect();
}

check();
