require('dotenv').config();
const mongoose = require('mongoose');

async function checkAllSelections() {
    console.log('🔍 VERIFICANDO TODAS AS SELEÇÕES DO CLIENTE 5720\n');
    console.log('='.repeat(70) + '\n');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const Selection = mongoose.model('Selection', new mongoose.Schema({}, { strict: false }));

        // Buscar TODAS as seleções do cliente 5720
        const selections = await Selection.find({ clientCode: '5720' }).sort({ createdAt: -1 });

        console.log(`📋 TOTAL DE SELEÇÕES ENCONTRADAS: ${selections.length}\n`);

        selections.forEach((sel, index) => {
            let totalAmount = sel.totalAmount || sel.items.reduce((sum, item) => sum + (item.subtotal || item.price || 0), 0);

            console.log(`${index + 1}. Seleção ID: ${sel._id}`);
            console.log(`   Status: ${sel.status}`);
            console.log(`   Created: ${new Date(sel.createdAt).toLocaleString()}`);
            console.log(`   Updated: ${sel.updatedAt ? new Date(sel.updatedAt).toLocaleString() : 'N/A'}`);
            console.log(`   Total Items: ${sel.items.length}`);
            console.log(`   Total Amount: $${totalAmount.toFixed(2)}`);
            console.log(`   PO Number: ${sel.poNumber || 'N/A'}`);
            console.log('');
        });

        console.log('='.repeat(70) + '\n');
        console.log('💡 QUAL DELAS O FRONTEND ESTÁ MOSTRANDO?\n');
        console.log('   Se o frontend mostra 85 fotos e $9407.00, pode ser:');
        console.log('   1. Cache no navegador (fazer hard refresh: Ctrl+Shift+R)');
        console.log('   2. Olhando seleção errada (verificar ID no frontend)');
        console.log('   3. Backend tem cache (reiniciar servidor)\n');

        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

checkAllSelections();
