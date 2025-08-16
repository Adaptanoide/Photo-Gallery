// listar-sem-preco.js
const mongoose = require('mongoose');
require('dotenv').config();

async function listarSemPreco() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB\n');
        
        const PhotoCategory = require('./src/models/PhotoCategory');
        
        // Buscar TODAS sem preço
        const semPreco = await PhotoCategory.find({ 
            $or: [
                { basePrice: 0 },
                { basePrice: null },
                { basePrice: { $exists: false } }
            ]
        }).sort('displayName');
        
        console.log(`📊 Total de categorias sem preço: ${semPreco.length}\n`);
        console.log('📋 LISTA COMPLETA:\n');
        
        semPreco.forEach((cat, index) => {
            console.log(`${index + 1}. ${cat.displayName}`);
            console.log(`   ID: ${cat.googleDriveId}`);
            console.log(`   Fotos: ${cat.photoCount}`);
            console.log('');
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Erro:', error);
        process.exit(1);
    }
}

listarSemPreco();

