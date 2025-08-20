// scripts/pricing/verificar-e-corrigir.js
require('dotenv').config();
const mongoose = require('mongoose');
const PhotoCategory = require('../../src/models/PhotoCategory');

async function verificarECorrigir() {
    console.log('🔍 VERIFICANDO CATEGORIAS SEM PREÇO\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Buscar categorias sem preço
    const semPreco = await PhotoCategory.find({
        isActive: true,
        $or: [
            { basePrice: 0 },
            { basePrice: null },
            { basePrice: { $exists: false } }
        ]
    });
    
    console.log(`📋 CATEGORIAS SEM PREÇO (${semPreco.length}):\n`);
    
    semPreco.forEach((cat, i) => {
        console.log(`${i + 1}. ${cat.displayName}`);
        console.log(`   ID: ${cat._id}`);
        console.log(`   Fotos: ${cat.photoCount}`);
        console.log('');
    });
    
    console.log('─'.repeat(60));
    console.log('\n🔧 TENTANDO CORRIGIR...\n');
    
    // Corrigir Black and White Reddish XL
    const categoria = await PhotoCategory.findOne({
        displayName: { $regex: 'Black and White Reddish XL', $options: 'i' }
    });
    
    if (categoria) {
        console.log(`✅ Encontrada: ${categoria.displayName}`);
        
        if (!categoria.basePrice || categoria.basePrice === 0) {
            categoria.basePrice = 159; // Mesmo preço de Black & White XL
            categoria.pricingMode = 'base';
            
            if (!categoria.priceHistory) categoria.priceHistory = [];
            categoria.priceHistory.push({
                oldPrice: 0,
                newPrice: 159,
                changedBy: 'correção-manual',
                changedAt: new Date(),
                reason: 'Correção manual - mesmo preço de Black & White XL'
            });
            
            await categoria.save();
            console.log(`   💰 Preço atualizado: $159\n`);
        } else {
            console.log(`   ⚠️ Já tem preço: $${categoria.basePrice}\n`);
        }
    } else {
        console.log('❌ Categoria "Black and White Reddish XL" não encontrada\n');
    }
    
    // Status final
    const total = await PhotoCategory.countDocuments({ isActive: true });
    const comPreço = await PhotoCategory.countDocuments({ 
        isActive: true,
        basePrice: { $gt: 0 }
    });
    
    console.log('─'.repeat(60));
    console.log('\n📊 STATUS FINAL:');
    console.log(`   Total: ${total}`);
    console.log(`   Com preço: ${comPreço}`);
    console.log(`   Sem preço: ${total - comPreço}`);
    console.log(`   Porcentagem: ${((comPreço/total)*100).toFixed(1)}%\n`);
    
    // Se ainda tem categorias sem preço com fotos
    const semPrecoComFotos = await PhotoCategory.find({
        isActive: true,
        photoCount: { $gt: 0 },
        $or: [
            { basePrice: 0 },
            { basePrice: null },
            { basePrice: { $exists: false } }
        ]
    });
    
    if (semPrecoComFotos.length > 0) {
        console.log('⚠️  CATEGORIAS COM FOTOS QUE PRECISAM DE PREÇO:');
        semPrecoComFotos.forEach(cat => {
            console.log(`   - ${cat.displayName} (${cat.photoCount} fotos)`);
        });
    }
    
    mongoose.connection.close();
}

verificarECorrigir().catch(console.error);