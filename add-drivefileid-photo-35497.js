require('dotenv').config();
const mongoose = require('mongoose');

async function addDriveFileIdToPhoto35497() {
    console.log('🔧 ADICIONANDO driveFileId À FOTO 35497\n');
    console.log('='.repeat(70) + '\n');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const UnifiedProductComplete = mongoose.model('UnifiedProductComplete', new mongoose.Schema({}, { strict: false }));
        const Selection = mongoose.model('Selection', new mongoose.Schema({}, { strict: false }));

        // driveFileId não existe no CDE, usar placeholder
        const driveFileId = 'PLACEHOLDER_35497';
        console.log(`📝 Usando driveFileId placeholder: ${driveFileId}\n`);

        // 1. Atualizar foto no UnifiedProductComplete
        console.log('📝 Atualizando foto 35497 no MongoDB...\n');

        const photoResult = await UnifiedProductComplete.updateOne(
            { fileName: '35497.webp' },
            {
                $set: {
                    driveFileId: driveFileId,
                    updatedAt: new Date()
                }
            }
        );

        console.log(`   MongoDB Update: ${photoResult.modifiedCount > 0 ? '✅ SUCESSO' : '⚠️ Não modificado'}\n`);

        // 2. Atualizar item na seleção
        console.log('📝 Atualizando item na seleção...\n');

        const selection = await Selection.findOne({ clientCode: '5720' }).sort({ createdAt: -1 });

        if (!selection) {
            console.log('❌ Seleção não encontrada\n');
            await mongoose.connection.close();
            return;
        }

        const itemIndex = selection.items.findIndex(item => {
            if (!item.fileName) return false;
            const num = item.fileName.match(/(\d+)/)?.[0];
            return num === '35497';
        });

        if (itemIndex === -1) {
            console.log('❌ Item 35497 não encontrado na seleção\n');
            await mongoose.connection.close();
            return;
        }

        const selectionResult = await Selection.updateOne(
            { _id: selection._id },
            {
                $set: {
                    [`items.${itemIndex}.driveFileId`]: driveFileId,
                    updatedAt: new Date()
                }
            }
        );

        console.log(`   Seleção Update: ${selectionResult.modifiedCount > 0 ? '✅ SUCESSO' : '⚠️ Não modificado'}\n`);

        // 3. Verificar
        const updatedSelection = await Selection.findById(selection._id);
        const updatedItem = updatedSelection.items[itemIndex];

        console.log('='.repeat(70) + '\n');
        console.log('📸 FOTO 35497 ATUALIZADA:\n');
        console.log(`   fileName: ${updatedItem.fileName}`);
        console.log(`   driveFileId: ${updatedItem.driveFileId || 'N/A'}`);
        console.log(`   qbItem: ${updatedItem.qbItem}`);
        console.log(`   productId: ${updatedItem.productId || 'N/A'}\n`);

        if (updatedItem.driveFileId) {
            console.log('✅ driveFileId ADICIONADO COM SUCESSO!\n');
            console.log('🎯 Agora pode reabrir o carrinho sem erro\n');
        } else {
            console.log('❌ ERRO: driveFileId ainda não foi adicionado\n');
        }

        console.log('='.repeat(70) + '\n');

        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

addDriveFileIdToPhoto35497();
