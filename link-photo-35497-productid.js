require('dotenv').config();
const mongoose = require('mongoose');

async function linkPhoto35497ProductId() {
    console.log('🔗 LINKANDO FOTO 35497 COM productId\n');
    console.log('='.repeat(70) + '\n');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const Selection = mongoose.model('Selection', new mongoose.Schema({}, { strict: false }));
        const UnifiedProductComplete = mongoose.model('UnifiedProductComplete', new mongoose.Schema({}, { strict: false }));

        // 1. Buscar foto no UnifiedProductComplete
        const photo = await UnifiedProductComplete.findOne({ fileName: '35497.webp' });

        if (!photo) {
            console.log('❌ Foto 35497 não encontrada no UnifiedProductComplete\n');
            await mongoose.connection.close();
            return;
        }

        console.log('✅ Foto encontrada no MongoDB:');
        console.log(`   _id: ${photo._id}`);
        console.log(`   fileName: ${photo.fileName}`);
        console.log(`   qbItem: ${photo.qbItem}\n`);

        // 2. Buscar seleção
        const selection = await Selection.findOne({ clientCode: '5720' }).sort({ createdAt: -1 });

        if (!selection) {
            console.log('❌ Seleção não encontrada\n');
            await mongoose.connection.close();
            return;
        }

        // 3. Encontrar item da foto 35497
        const itemIndex = selection.items.findIndex(item => {
            if (!item.fileName) return false;
            const num = item.fileName.match(/(\d+)/)?.[0];
            return num === '35497';
        });

        if (itemIndex === -1) {
            console.log('❌ Foto 35497 não encontrada na seleção\n');
            await mongoose.connection.close();
            return;
        }

        const item = selection.items[itemIndex];

        console.log('📸 Item na seleção ANTES:');
        console.log(`   fileName: ${item.fileName}`);
        console.log(`   productId: ${item.productId || 'N/A (FALTANDO!)'}\n`);

        // 4. Atualizar item com productId
        console.log('🔧 Adicionando productId ao item...\n');

        const updateResult = await Selection.updateOne(
            { _id: selection._id },
            {
                $set: {
                    [`items.${itemIndex}.productId`]: photo._id,
                    updatedAt: new Date()
                }
            }
        );

        console.log(`   Update: ${updateResult.modifiedCount > 0 ? '✅ SUCESSO' : '❌ FALHOU'}\n`);

        // 5. Verificar
        const updatedSelection = await Selection.findById(selection._id);
        const updatedItem = updatedSelection.items[itemIndex];

        console.log('='.repeat(70) + '\n');
        console.log('📸 Item na seleção DEPOIS:\n');
        console.log(`   fileName: ${updatedItem.fileName}`);
        console.log(`   productId: ${updatedItem.productId || 'N/A'}`);
        console.log(`   qbItem (direto): ${updatedItem.qbItem}\n`);

        if (updatedItem.productId) {
            console.log('✅ productId ADICIONADO COM SUCESSO!\n');
            console.log('🎯 Agora o populate vai funcionar e o frontend vai mostrar:');
            console.log(`   QBITEM: 5202BLW (não mais NO-QB)\n`);
            console.log('   Recarregue a página (F5)\n');
        } else {
            console.log('❌ ERRO: productId ainda não foi adicionado\n');
        }

        console.log('='.repeat(70) + '\n');

        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

linkPhoto35497ProductId();
