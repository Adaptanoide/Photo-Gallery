require('dotenv').config();
const mongoose = require('mongoose');

async function debugPhoto35497() {
    console.log('🔍 DEBUG: VERIFICANDO FOTO 35497 NA SELEÇÃO\n');
    console.log('='.repeat(70) + '\n');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const Selection = mongoose.model('Selection', new mongoose.Schema({}, { strict: false }));

        const selection = await Selection.findOne({ clientCode: '5720' }).sort({ createdAt: -1 });

        if (!selection) {
            console.log('❌ Seleção não encontrada\n');
            await mongoose.connection.close();
            return;
        }

        // Encontrar foto 35497
        const item = selection.items.find(i => {
            if (!i.fileName) return false;
            const num = i.fileName.match(/(\d+)/)?.[0];
            return num === '35497';
        });

        if (!item) {
            console.log('❌ Foto 35497 não encontrada na seleção\n');
            await mongoose.connection.close();
            return;
        }

        console.log('📸 FOTO 35497 - TODOS OS CAMPOS:\n');
        console.log(JSON.stringify(item, null, 2));

        console.log('\n' + '='.repeat(70) + '\n');
        console.log('🔍 ANÁLISE:\n');
        console.log(`   fileName: ${item.fileName}`);
        console.log(`   title: ${item.title || 'N/A'}`);
        console.log(`   category: ${item.category || 'N/A'}`);
        console.log(`   qbItem: ${item.qbItem || 'N/A'}`);
        console.log(`   qbitem: ${item.qbitem || 'N/A'} (lowercase)`);
        console.log(`   price: ${item.price}`);
        console.log(`   isCatalogProduct: ${item.isCatalogProduct}`);
        console.log('');

        if (!item.qbItem && !item.qbitem) {
            console.log('⚠️ PROBLEMA: Campo qbItem está vazio ou não existe!\n');
        } else {
            console.log('✅ Campo qbItem existe\n');
        }

        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

debugPhoto35497();
