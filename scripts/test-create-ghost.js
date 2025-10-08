// scripts/test-create-ghost.js
// Simula detecção de ghost pelo sync - TESTE INSTANTÂNEO

require('dotenv').config();
const mongoose = require('mongoose');
const Cart = require('../src/models/Cart');

async function simulateGhostDetection() {
    try {
        console.log('🔌 Conectando ao MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado!\n');

        const clientCode = '6753';
        const photoToGhost = '08216.webp'; // ou '08216' se for sem extensão

        // ===== ANTES =====
        console.log('📊 ANTES DO GHOST:\n');
        let cart = await Cart.findOne({ clientCode, isActive: true });

        if (!cart) {
            console.error('❌ Carrinho não encontrado para cliente', clientCode);
            process.exit(1);
        }

        console.log(`   Total Items (MongoDB): ${cart.totalItems}`);
        console.log(`   Array Length: ${cart.items.length}`);
        console.log(`   Ghost Items: ${cart.items.filter(i => i.ghostStatus === 'ghost').length}`);
        console.log('\n   Fotos no carrinho:');
        cart.items.forEach((item, idx) => {
            const status = item.ghostStatus === 'ghost' ? '👻 GHOST' : '✅ ACTIVE';
            console.log(`     ${idx + 1}. ${item.fileName} - ${status}`);
        });

        // ===== SIMULAR GHOST =====
        console.log('\n🎬 SIMULANDO DETECÇÃO DE GHOST...\n');
        console.log(`   Marcando ${photoToGhost} como ghost (simulando sync)...`);

        // Encontrar o item
        const itemIndex = cart.items.findIndex(item => 
            item.fileName === photoToGhost || 
            item.fileName === photoToGhost.replace('.webp', '') ||
            item.driveFileId.includes(photoToGhost.replace('.webp', ''))
        );

        if (itemIndex === -1) {
            console.error(`❌ Foto ${photoToGhost} não encontrada no carrinho`);
            console.log('\n   Fotos disponíveis:');
            cart.items.forEach(item => console.log(`     - ${item.fileName}`));
            process.exit(1);
        }

        // Marcar como ghost (igual o sync faz)
        cart.items[itemIndex].ghostStatus = 'ghost';
        cart.items[itemIndex].ghostReason = 'Photo sold/reserved in CDE (SIMULATED TEST)';
        cart.items[itemIndex].ghostedAt = new Date();
        cart.items[itemIndex].originalPrice = cart.items[itemIndex].price || 0;
        cart.items[itemIndex].price = 0;
        cart.items[itemIndex].hasPrice = false;

        console.log(`   ✅ Item marcado como ghost\n`);

        // SALVAR - Aqui o pre-save hook vai recalcular totalItems
        console.log('💾 SALVANDO NO MONGODB...\n');
        await cart.save();

        // ===== DEPOIS =====
        console.log('📊 DEPOIS DO GHOST:\n');
        
        // Recarregar do banco para ver o valor real
        cart = await Cart.findOne({ clientCode, isActive: true });

        console.log(`   Total Items (MongoDB): ${cart.totalItems}`);
        console.log(`   Array Length: ${cart.items.length}`);
        console.log(`   Ghost Items: ${cart.items.filter(i => i.ghostStatus === 'ghost').length}`);
        console.log('\n   Fotos no carrinho:');
        cart.items.forEach((item, idx) => {
            const status = item.ghostStatus === 'ghost' ? '👻 GHOST' : '✅ ACTIVE';
            console.log(`     ${idx + 1}. ${item.fileName} - ${status}`);
        });

        // ===== RESULTADO =====
        console.log('\n' + '='.repeat(60));
        console.log('🎯 RESULTADO DO TESTE:');
        console.log('='.repeat(60));

        const validItems = cart.items.filter(i => i.ghostStatus !== 'ghost').length;
        const ghostItems = cart.items.filter(i => i.ghostStatus === 'ghost').length;

        console.log(`\n   ✅ Items VÁLIDOS: ${validItems}`);
        console.log(`   👻 Items GHOST: ${ghostItems}`);
        console.log(`   📦 Total no MongoDB: ${cart.totalItems}`);
        
        if (cart.totalItems === validItems) {
            console.log('\n   🎉 SUCESSO! Ghost NÃO está sendo contado!');
            console.log('   ✅ Badge vai mostrar apenas items válidos');
        } else {
            console.log('\n   ❌ FALHA! Ghost ainda está sendo contado!');
            console.log('   ⚠️  Badge vai mostrar valor errado');
        }

        console.log('\n' + '='.repeat(60));
        console.log('\n📌 PRÓXIMO PASSO:');
        console.log('   1. Abra o Admin Panel');
        console.log('   2. Procure cliente 6753');
        console.log(`   3. Badge deve mostrar: 🔴 ${cart.totalItems}`);
        console.log('   4. Cart Control deve mostrar mesma quantidade');
        console.log('\n' + '='.repeat(60) + '\n');

        await mongoose.disconnect();
        console.log('🔌 Desconectado do MongoDB\n');

    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

simulateGhostDetection();