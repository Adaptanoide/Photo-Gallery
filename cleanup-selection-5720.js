// Script para cancelar seleção 5720 e deletar carrinho
// USO: node cleanup-selection-5720.js

require('dotenv').config();
const mongoose = require('mongoose');

async function cleanupSelection5720() {
    console.log('🧹 LIMPEZA: Seleção e Carrinho 5720');
    console.log('==========================================\n');

    try {
        // 1. Conectar MongoDB
        console.log('📊 Conectando ao MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB conectado\n');

        const Selection = mongoose.model('Selection', new mongoose.Schema({}, { strict: false }));
        const Cart = mongoose.model('Cart', new mongoose.Schema({}, { strict: false }));

        // 2. Cancelar seleção 5720
        console.log('🔍 Buscando seleção do cliente 5720...');
        const selection = await Selection.findOne({
            clientCode: '5720',
            status: 'pending'
        }).sort({ createdAt: -1 });

        if (selection) {
            console.log(`✅ Seleção encontrada: ${selection._id}`);
            console.log(`   Criada em: ${selection.createdAt}`);
            console.log(`   Total items: ${selection.items.length}`);

            // Cancelar seleção
            selection.status = 'cancelled';
            selection.cancellationReason = 'Fotos não existem no sistema - Validação crítica falhou';
            selection.cancelledAt = new Date();
            await selection.save();

            console.log('✅ Seleção CANCELADA com sucesso\n');
        } else {
            console.log('⚠️ Seleção não encontrada (já pode ter sido cancelada)\n');
        }

        // 3. Deletar carrinho 5720
        console.log('🗑️ Buscando carrinho do cliente 5720...');
        const cart = await Cart.findOne({ clientCode: '5720' });

        if (cart) {
            console.log(`✅ Carrinho encontrado: ${cart._id}`);
            console.log(`   Total items: ${cart.items.length}`);
            console.log(`   Is Active: ${cart.isActive}`);

            await Cart.deleteOne({ _id: cart._id });
            console.log('✅ Carrinho DELETADO com sucesso\n');
        } else {
            console.log('⚠️ Carrinho não encontrado (já pode ter sido deletado)\n');
        }

        // 4. Fechar conexão
        await mongoose.connection.close();

        console.log('==========================================');
        console.log('✅ LIMPEZA CONCLUÍDA COM SUCESSO!');
        console.log('==========================================\n');
        console.log('📋 PRÓXIMOS PASSOS:');
        console.log('1. Entrar em contato com cliente 5720');
        console.log('2. Explicar que as fotos não estão mais disponíveis');
        console.log('3. Oferecer assistência para nova seleção\n');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERRO:', error);
        process.exit(1);
    }
}

// Executar
cleanupSelection5720();
