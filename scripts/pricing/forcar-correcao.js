// scripts/pricing/forcar-correcao.js
require('dotenv').config();
const mongoose = require('mongoose');
const PhotoCategory = require('../../src/models/PhotoCategory');

async function forcarCorrecao() {
    console.log('🔧 FORÇANDO CORREÇÃO DE PREÇOS\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Buscar a categoria problemática pelo ID
    const categoriaProblema = await PhotoCategory.findById('68a1a764a46998ff87c1c051');
    
    if (categoriaProblema) {
        console.log(`📋 Categoria encontrada: ${categoriaProblema.displayName}`);
        console.log(`   Preço atual no banco: $${categoriaProblema.basePrice}`);
        console.log(`   Fotos: ${categoriaProblema.photoCount}`);
        console.log(`   Tipo do preço: ${typeof categoriaProblema.basePrice}`);
        
        // Verificar se o preço está como string ou tem algum problema
        if (categoriaProblema.basePrice === 159 || categoriaProblema.basePrice === '159') {
            console.log('\n⚠️  PREÇO JÁ ESTÁ DEFINIDO!');
            console.log('   Pode ser um problema de cache ou índice no MongoDB\n');
            
            // Forçar atualização
            await PhotoCategory.updateOne(
                { _id: categoriaProblema._id },
                { $set: { basePrice: 159, pricingMode: 'base' } }
            );
            console.log('✅ Forçada atualização direta no banco\n');
            
        } else {
            console.log('\n🔧 Corrigindo preço...');
            
            // Definir preço corretamente
            await PhotoCategory.updateOne(
                { _id: categoriaProblema._id },
                { 
                    $set: { 
                        basePrice: 159, 
                        pricingMode: 'base',
                        updatedAt: new Date()
                    },
                    $push: {
                        priceHistory: {
                            oldPrice: categoriaProblema.basePrice || 0,
                            newPrice: 159,
                            changedBy: 'forcado-script',
                            changedAt: new Date(),
                            reason: 'Correção forçada - Black & White Reddish XL'
                        }
                    }
                }
            );
            
            console.log('✅ Preço corrigido para $159\n');
        }
    }
    
    // Aguardar um pouco para garantir que salvou
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verificar novamente
    console.log('📊 VERIFICANDO RESULTADO:\n');
    
    const semPreco = await PhotoCategory.find({
        isActive: true,
        $or: [
            { basePrice: 0 },
            { basePrice: null },
            { basePrice: { $exists: false } }
        ]
    });
    
    console.log(`Categorias sem preço: ${semPreco.length}`);
    semPreco.forEach(cat => {
        console.log(`   - ${cat.displayName} (${cat.photoCount} fotos)`);
    });
    
    // Status final
    const total = await PhotoCategory.countDocuments({ isActive: true });
    const comPreco = await PhotoCategory.countDocuments({ 
        isActive: true,
        basePrice: { $gt: 0 }
    });
    
    console.log('\n📊 STATUS FINAL:');
    console.log(`   Total: ${total}`);
    console.log(`   Com preço: ${comPreco}`);
    console.log(`   Sem preço: ${total - comPreco}`);
    console.log(`   Porcentagem: ${((comPreco/total)*100).toFixed(1)}%\n`);
    
    mongoose.connection.close();
}

forcarCorrecao().catch(console.error);