// scripts/verificar-banco-completo.js
require('dotenv').config();
const mongoose = require('mongoose');
const PhotoCategory = require('../src/models/PhotoCategory');

async function verificarBanco() {
    console.log('🔍 VERIFICAÇÃO COMPLETA DO BANCO\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    
    const todas = await PhotoCategory.find({ isActive: true });
    const comPreco = todas.filter(c => c.basePrice > 0);
    const semPreco = todas.filter(c => !c.basePrice || c.basePrice === 0);
    const comFotos = todas.filter(c => c.photoCount > 0);
    const vazias = todas.filter(c => c.photoCount === 0);
    
    console.log('📊 ESTATÍSTICAS REAIS:');
    console.log(`   Total de categorias: ${todas.length}`);
    console.log(`   Com preço: ${comPreco.length}`);
    console.log(`   Sem preço: ${semPreco.length}`);
    console.log(`   Com fotos: ${comFotos.length}`);
    console.log(`   Vazias: ${vazias.length}`);
    
    console.log('\n📋 TODAS AS CATEGORIAS:');
    todas.forEach((cat, i) => {
        const preco = cat.basePrice || 0;
        const fotos = cat.photoCount || 0;
        console.log(`${i+1}. ${cat.displayName}`);
        console.log(`   Preço: $${preco} | Fotos: ${fotos}`);
    });
    
    mongoose.connection.close();
}

verificarBanco();