require('dotenv').config();
const mongoose = require('mongoose');

async function verifyCurrentState() {
    console.log('🔍 VERIFICANDO ESTADO ATUAL DA SELEÇÃO NO MONGODB\n');
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

        console.log('📋 ESTADO ATUAL NO MONGODB:\n');
        console.log(`   ID: ${selection._id}`);
        console.log(`   Cliente: ${selection.clientCode} (${selection.clientName || 'N/A'})`);
        console.log(`   Status: ${selection.status}`);
        console.log(`   Created: ${new Date(selection.createdAt).toLocaleString()}`);
        console.log(`   Updated: ${selection.updatedAt ? new Date(selection.updatedAt).toLocaleString() : 'N/A'}`);
        console.log(`   Total Items: ${selection.items.length}`);

        let totalAmount = selection.totalAmount;
        if (!totalAmount) {
            totalAmount = selection.items.reduce((sum, item) => {
                return sum + (item.subtotal || item.price || 0);
            }, 0);
        }
        console.log(`   Total Amount: $${totalAmount.toFixed(2)}\n`);

        console.log('='.repeat(70) + '\n');

        // Verificar se as fotos problemáticas ainda estão lá
        const fotosProblematicas = [
            '08223', '28639', '29170', '29202',
            '31462', '31452', '32344', '35528',
            '35529', '36517', '36520', '35497'
        ];

        console.log('🔍 VERIFICANDO FOTOS PROBLEMÁTICAS:\n');

        let aindaPresentes = [];
        let removidas = [];

        fotosProblematicas.forEach(photoNum => {
            const found = selection.items.find(item => {
                if (!item.fileName) return false;
                const num = item.fileName.match(/(\d+)/)?.[0];
                return num === photoNum;
            });

            if (found) {
                aindaPresentes.push(photoNum);
                console.log(`❌ AINDA PRESENTE: ${photoNum} (${found.category || 'N/A'})`);
            } else {
                removidas.push(photoNum);
                console.log(`✅ REMOVIDA: ${photoNum}`);
            }
        });

        console.log('');
        console.log(`Fotos ainda presentes: ${aindaPresentes.length}`);
        console.log(`Fotos removidas: ${removidas.length}\n`);

        if (aindaPresentes.length > 0) {
            console.log('⚠️ PROBLEMA: Fotos ainda estão na seleção!\n');
            console.log('   Possíveis causas:');
            console.log('   1. Script não salvou corretamente');
            console.log('   2. Erro durante o save()');
            console.log('   3. Olhando seleção diferente\n');
        } else {
            console.log('✅ SUCESSO: Todas as fotos problemáticas foram removidas!\n');
            console.log('   Se o frontend ainda mostra 85 items:');
            console.log('   1. Fazer refresh na página (F5)');
            console.log('   2. Limpar cache do browser');
            console.log('   3. Verificar se há cache no backend\n');
        }

        console.log('='.repeat(70) + '\n');

        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

verifyCurrentState();
