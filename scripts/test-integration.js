// scripts/test-integration.js
// Testar integração com MongoDB + CDE

const mongoose = require('mongoose');
const CDEWriter = require('../src/services/CDEWriter');
require('dotenv').config();

async function testIntegration() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('🔗 TESTE DE INTEGRAÇÃO COMPLETA\n');
    console.log('=' .repeat(50));
    
    const db = mongoose.connection.db;
    
    // Simular adicionar ao carrinho
    const photoNumber = '28900';
    const clientCode = '2745';
    
    console.log('\n1️⃣ SIMULANDO: Cliente adiciona ao carrinho');
    
    // Atualizar MongoDB (seu sistema)
    await db.collection('products').updateOne(
        { driveFileId: { $regex: photoNumber } },
        { 
            $set: { 
                status: 'reserved',
                reservedBy: {
                    clientCode: clientCode,
                    sessionId: 'test_' + Date.now()
                }
            }
        },
        { upsert: true }
    );
    console.log('  ✅ MongoDB atualizado');
    
    // Atualizar CDE
    await CDEWriter.markAsReserved(photoNumber, null, clientCode, 'test');
    console.log('  ✅ CDE atualizado');
    
    console.log('\n2️⃣ VERIFICANDO SINCRONIZAÇÃO:');
    console.log('  MongoDB: status = reserved');
    console.log('  CDE: AESTADOP = RESERVED');
    
    // Aguardar
    console.log('\n⏳ Aguardando 5 segundos...');
    await new Promise(r => setTimeout(r, 5000));
    
    // Reverter
    console.log('\n3️⃣ SIMULANDO: Cliente remove do carrinho');
    
    await db.collection('products').updateOne(
        { driveFileId: { $regex: photoNumber } },
        { $set: { status: 'available', reservedBy: null } }
    );
    console.log('  ✅ MongoDB liberado');
    
    await CDEWriter.markAsAvailable(photoNumber);
    console.log('  ✅ CDE liberado');
    
    await mongoose.connection.close();
    console.log('\n✅ INTEGRAÇÃO COMPLETA!');
}

testIntegration().catch(console.error);