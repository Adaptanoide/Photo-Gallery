require('dotenv').config();
const mongoose = require('mongoose');

async function checkAndFixPhoto35497() {
    console.log('🔍 VERIFICANDO E CORRIGINDO FOTO 35497\n');
    console.log('='.repeat(70) + '\n');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const Selection = mongoose.model('Selection', new mongoose.Schema({}, { strict: false }));

        // Buscar seleção
        const selection = await Selection.findOne({ clientCode: '5720' }).sort({ createdAt: -1 });

        if (!selection) {
            console.log('❌ Seleção não encontrada\n');
            await mongoose.connection.close();
            return;
        }

        let totalAmount = selection.totalAmount || selection.items.reduce((sum, item) => sum + (item.subtotal || item.price || 0), 0);

        console.log('📋 ESTADO ATUAL:');
        console.log(`   ID: ${selection._id}`);
        console.log(`   Total Items: ${selection.items.length}`);
        console.log(`   Total Amount: $${totalAmount.toFixed(2)}\n`);

        // Verificar se foto 35497 está na seleção
        const foto35497 = selection.items.find(item => {
            if (!item.fileName) return false;
            const num = item.fileName.match(/(\d+)/)?.[0];
            return num === '35497';
        });

        if (foto35497) {
            console.log('✅ Foto 35497 JÁ está na seleção');
            console.log(`   Category: ${foto35497.category}`);
            console.log(`   Price: $${foto35497.price}\n`);
        } else {
            console.log('❌ Foto 35497 NÃO está na seleção');
            console.log('   Vou adicionar de volta...\n');

            // Adicionar foto 35497 de volta
            const newItem = {
                fileName: '35497.webp',
                title: '35497',
                category: 'Colombian Cowhides → 2. Large → Brown & White',
                qbItem: '5202BRW', // ERRADO, mas vamos corrigir depois
                price: 85.00,
                quantity: 1,
                subtotal: 85.00,
                isCatalogProduct: false
            };

            await Selection.updateOne(
                { _id: selection._id },
                {
                    $push: { items: newItem },
                    $set: {
                        totalAmount: totalAmount + 85.00,
                        updatedAt: new Date()
                    }
                }
            );

            console.log('✅ Foto 35497 adicionada de volta!');
            console.log(`   Novo total: $${(totalAmount + 85.00).toFixed(2)}\n`);
        }

        // Verificar resultado final
        const finalSelection = await Selection.findById(selection._id);
        let finalTotal = finalSelection.totalAmount || finalSelection.items.reduce((sum, item) => sum + (item.subtotal || item.price || 0), 0);

        console.log('='.repeat(70) + '\n');
        console.log('📊 RESULTADO FINAL:\n');
        console.log(`   Total Items: ${finalSelection.items.length} (deveria ser 74)`);
        console.log(`   Total Amount: $${finalTotal.toFixed(2)} (deveria ser $8124.00)\n`);

        if (finalSelection.items.length === 74) {
            console.log('✅ CORRETO: 74 fotos na seleção\n');
        } else {
            console.log(`⚠️ ATENÇÃO: Esperado 74, atual ${finalSelection.items.length}\n`);
        }

        console.log('='.repeat(70) + '\n');

        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

checkAndFixPhoto35497();
