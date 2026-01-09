require('dotenv').config();
const mongoose = require('mongoose');

async function checkPhoto35497Structure() {
    console.log('🔍 VERIFICANDO ESTRUTURA DA FOTO 35497 NO MONGODB\n');
    console.log('='.repeat(70) + '\n');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const UnifiedProductComplete = mongoose.model('UnifiedProductComplete', new mongoose.Schema({}, { strict: false }));

        // Buscar foto 35497
        const photo = await UnifiedProductComplete.findOne({
            fileName: /35497\.(webp|jpg|jpeg|png)/i
        });

        if (!photo) {
            console.log('❌ Foto 35497 não encontrada no MongoDB\n');
            console.log('   Isso significa que a foto só existe na seleção,');
            console.log('   não na coleção principal de fotos.\n');
            await mongoose.connection.close();
            return;
        }

        console.log('📸 FOTO 35497 ENCONTRADA:\n');
        console.log('Fields disponíveis:');
        console.log(JSON.stringify(photo.toObject(), null, 2));

        console.log('\n' + '='.repeat(70) + '\n');

        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

checkPhoto35497Structure();
