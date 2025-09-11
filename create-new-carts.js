// create-new-carts.js
const mongoose = require('mongoose');
require('dotenv').config();

async function createNewCarts() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const UnifiedProductComplete = require('./src/models/UnifiedProductComplete');
    const CartService = require('./src/services/CartService');
    
    // Fotos que queremos adicionar (apenas as mais prováveis de existir)
    const cartsData = {
        "2960": {  // Melissa
            name: "Melissa",
            photos: ["11998", "12008", "14785", "14806", "10629", "10609", "10703", "10710"]
        },
        "9782": {  // Trevor
            name: "Trevor",
            photos: ["11678", "11694", "16268", "16269", "16278", "16311", "16314", "16297"]
        }
    };
    
    console.log('🛒 CRIANDO NOVOS CARRINHOS\n');
    
    for (const [clientCode, data] of Object.entries(cartsData)) {
        console.log(`${data.name} (${clientCode}):`);
        
        const sessionId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        let added = 0, notAvailable = 0;
        
        for (const photoNumber of data.photos) {
            // Buscar foto com número ou fileName
            const product = await UnifiedProductComplete.findOne({
                $or: [
                    { photoNumber: photoNumber },
                    { fileName: `${photoNumber}.webp` }
                ],
                status: 'available'
            });
            
            if (product) {
                try {
                    await CartService.addToCart(
                        sessionId,
                        clientCode,
                        product.driveFileId,
                        product.category
                    );
                    console.log(`  ✅ ${photoNumber} adicionada`);
                    added++;
                } catch (error) {
                    console.log(`  ⚠️ ${photoNumber}: ${error.message}`);
                }
            } else {
                console.log(`  ❌ ${photoNumber} não disponível`);
                notAvailable++;
            }
        }
        
        console.log(`\n  Resumo: ${added} adicionadas, ${notAvailable} não disponíveis\n`);
    }
    
    mongoose.disconnect();
}

createNewCarts();