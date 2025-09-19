// scripts/clean-test-data.js
const mongoose = require('mongoose');
require('dotenv').config();

async function cleanTestData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB\n');
        
        const Cart = require('../src/models/Cart');
        const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
        
        // Limpar carrinhos de teste
        console.log('🧹 Limpando carrinhos de teste...');
        const testCarts = await Cart.deleteMany({
            $or: [
                { sessionId: { $regex: /^test_session/ } },
                { clientCode: 'TEST' }
            ]
        });
        console.log(`   Removidos ${testCarts.deletedCount} carrinhos de teste`);
        
        // Limpar reservas de teste que ficaram presas
        console.log('\n🧹 Limpando reservas de teste...');
        const testReservations = await UnifiedProductComplete.updateMany(
            { 'reservedBy.clientCode': 'TEST' },
            {
                $set: {
                    status: 'available',
                    currentStatus: 'available',
                    cdeStatus: 'INGRESADO'
                },
                $unset: {
                    reservedBy: 1,
                    selectionId: 1
                }
            }
        );
        console.log(`   Liberadas ${testReservations.modifiedCount} fotos reservadas por TEST`);
        
        console.log('\n✅ Limpeza concluída!');
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n👋 Conexão fechada');
    }
}

cleanTestData();