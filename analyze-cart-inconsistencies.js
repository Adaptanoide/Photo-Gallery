// analyze-cart-inconsistencies.js
const mongoose = require('mongoose');
const Cart = require('./src/models/Cart');
const UnifiedProductComplete = require('./src/models/UnifiedProductComplete');
require('dotenv').config();

async function analyzeCartInconsistencies() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔍 ANÁLISE DE INCONSISTÊNCIAS NOS CARRINHOS\n');
    
    // 1. Buscar todos os carrinhos ativos
    const activeCarts = await Cart.find({ 
        isActive: true, 
        totalItems: { $gt: 0 } 
    });
    
    console.log(`📦 Total de carrinhos ativos: ${activeCarts.length}`);
    
    const problems = {
        duplicates: [],
        wrongStatus: [],
        missingInMongo: [],
        expiredButActive: [],
        wrongClient: []
    };
    
    // Mapear todas as fotos em carrinhos
    const photosInCarts = new Map();
    
    for (const cart of activeCarts) {
        console.log(`\n👤 Cliente ${cart.clientCode}: ${cart.items.length} items`);
        
        for (const item of cart.items) {
            // Verificar duplicatas
            if (photosInCarts.has(item.fileName)) {
                problems.duplicates.push({
                    fileName: item.fileName,
                    clients: [photosInCarts.get(item.fileName), cart.clientCode]
                });
            }
            photosInCarts.set(item.fileName, cart.clientCode);
            
            // Verificar expiração
            if (item.expiresAt && new Date(item.expiresAt) < new Date()) {
                problems.expiredButActive.push({
                    fileName: item.fileName,
                    client: cart.clientCode,
                    expiredAt: item.expiresAt
                });
            }
            
            // Buscar produto no MongoDB
            const product = await UnifiedProductComplete.findOne({
                $or: [
                    { fileName: item.fileName },
                    { driveFileId: item.driveFileId }
                ]
            });
            
            if (!product) {
                problems.missingInMongo.push({
                    fileName: item.fileName,
                    client: cart.clientCode
                });
                continue;
            }
            
            // Verificar status
            if (product.currentStatus !== 'reserved' && 
                product.currentStatus !== 'pre-selected') {
                problems.wrongStatus.push({
                    fileName: item.fileName,
                    client: cart.clientCode,
                    actualStatus: product.currentStatus,
                    cdeStatus: product.cdeStatus
                });
            }
            
            // Verificar se está reservado para o cliente certo
            if (product.reservedBy?.clientCode && 
                product.reservedBy.clientCode !== cart.clientCode) {
                problems.wrongClient.push({
                    fileName: item.fileName,
                    cartClient: cart.clientCode,
                    reservedForClient: product.reservedBy.clientCode
                });
            }
        }
    }
    
    // Relatório
    console.log('\n' + '='.repeat(60));
    console.log('PROBLEMAS ENCONTRADOS:');
    console.log('='.repeat(60));
    
    if (problems.duplicates.length > 0) {
        console.log(`\n❌ FOTOS EM MÚLTIPLOS CARRINHOS: ${problems.duplicates.length}`);
        problems.duplicates.forEach(d => {
            console.log(`   ${d.fileName}: ${d.clients.join(' e ')}`);
        });
    }
    
    if (problems.wrongStatus.length > 0) {
        console.log(`\n⚠️ FOTOS COM STATUS INCORRETO: ${problems.wrongStatus.length}`);
        problems.wrongStatus.slice(0, 10).forEach(w => {
            console.log(`   ${w.fileName} (${w.client}): ${w.actualStatus}/${w.cdeStatus}`);
        });
    }
    
    if (problems.expiredButActive.length > 0) {
        console.log(`\n⏰ FOTOS EXPIRADAS MAS AINDA NO CARRINHO: ${problems.expiredButActive.length}`);
        problems.expiredButActive.forEach(e => {
            console.log(`   ${e.fileName} (${e.client}): expirou ${e.expiredAt}`);
        });
    }
    
    if (problems.wrongClient.length > 0) {
        console.log(`\n🔄 FOTOS RESERVADAS PARA CLIENTE ERRADO: ${problems.wrongClient.length}`);
        problems.wrongClient.forEach(w => {
            console.log(`   ${w.fileName}: no carrinho de ${w.cartClient} mas reservado para ${w.reservedForClient}`);
        });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('RESUMO:');
    console.log(`Total de fotos em carrinhos: ${photosInCarts.size}`);
    console.log(`Problemas detectados: ${
        problems.duplicates.length + 
        problems.wrongStatus.length + 
        problems.expiredButActive.length + 
        problems.wrongClient.length
    }`);
    
    await mongoose.connection.close();
    return problems;
}

// Executar
analyzeCartInconsistencies()
    .then(() => console.log('\n✅ Análise completa'))
    .catch(console.error);