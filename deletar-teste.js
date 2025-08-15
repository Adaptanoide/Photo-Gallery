// deletar-teste.js
const mongoose = require('mongoose');
require('dotenv').config();

async function deletarTeste() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const PhotoCategory = require('./src/models/PhotoCategory');
        
        const teste = await PhotoCategory.findOne({ displayName: /TESTE WEBP/i });
        
        if (teste) {
            await PhotoCategory.deleteOne({ _id: teste._id });
            console.log('✅ Categoria TESTE WEBP deletada!');
        } else {
            console.log('❌ Categoria TESTE WEBP não encontrada');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Erro:', error);
        process.exit(1);
    }
}

deletarTeste();
