// scripts/check-client-carts.js
// Verificar carrinhos de clientes específicos

require('dotenv').config();
const mongoose = require('mongoose');
const Cart = require('../src/models/Cart');

async function checkClientCarts() {
    try {
        console.log('🔧 Conectando ao MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado!\n');

        // Clientes com fotos no carrinho (do print)
        const clientCodes = ['7017', '8812', '7279', '8640'];

        for (const code of clientCodes) {
            console.log(`\n📦 Cliente ${code}:`);

            const carts = await Cart.find({ clientCode: code });

            if (carts.length === 0) {
                console.log(`   ❌ Nenhum carrinho encontrado`);
                continue;
            }

            for (const cart of carts) {
                const validItems = cart.items.filter(item =>
                    !item.ghostStatus || item.ghostStatus !== 'ghost'
                );

                console.log(`   📋 SessionId: ${cart.sessionId.substring(0, 20)}...`);
                console.log(`   📊 isActive: ${cart.isActive}`);
                console.log(`   📊 totalItems: ${cart.totalItems}`);
                console.log(`   📊 items.length: ${cart.items.length}`);
                console.log(`   📊 validItems: ${validItems.length}`);

                // Verificar se há problema
                if (cart.totalItems !== validItems.length) {
                    console.log(`   ⚠️ PROBLEMA: totalItems (${cart.totalItems}) != validItems (${validItems.length})`);
                } else if (cart.isActive && cart.totalItems > 0) {
                    console.log(`   ✅ OK - Pode finalizar seleção!`);
                } else if (!cart.isActive) {
                    console.log(`   ⚠️ Carrinho inativo`);
                } else {
                    console.log(`   ⚠️ Carrinho vazio`);
                }
            }
        }

        // Mostrar todos os carrinhos ativos com itens
        console.log('\n\n📋 TODOS OS CARRINHOS ATIVOS COM ITENS:');
        const activeCarts = await Cart.find({ isActive: true, totalItems: { $gt: 0 } });

        for (const cart of activeCarts) {
            console.log(`   - Cliente ${cart.clientCode}: ${cart.totalItems} items (items.length: ${cart.items.length})`);
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

checkClientCarts();
