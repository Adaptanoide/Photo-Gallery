// extend-cart-time.js
// Script para estender o tempo do carrinho de Trevor Waldo e Melissa

const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://easyadmin:2NwxuiOlK57wH8cY@cluster.tsbl7y8.mongodb.net/sunshine_cowhides?retryWrites=true&w=majority&appName=Cluster';

async function extendCartTime() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db('sunshine_cowhides');
        
        console.log('\n⏰ ESTENDENDO TEMPO DO CARRINHO\n');
        console.log('='.repeat(60));
        
        // Clientes para estender
        const clientsToExtend = [
            { name: 'Trevor Waldo', code: '9782' },
            { name: 'Melissa', code: '2960' }
        ];
        
        for (const clientInfo of clientsToExtend) {
            console.log(`\n🔍 Procurando carrinho do ${clientInfo.name} (${clientInfo.code})...\n`);
            
            // 1. Buscar no carrinho (carts)
            const cart = await db.collection('carts').findOne({
                $or: [
                    { accessCode: clientInfo.code },
                    { clientCode: clientInfo.code },
                    { code: clientInfo.code }
                ]
            });
            
            if (cart) {
                console.log(`✅ Carrinho encontrado!`);
                console.log(`   Itens: ${cart.items ? cart.items.length : 0}`);
                console.log(`   Expira em: ${cart.expiresAt ? new Date(cart.expiresAt).toLocaleString('pt-BR') : 'não definido'}`);
                
                // Estender por 24 horas
                const newExpiration = new Date();
                newExpiration.setHours(newExpiration.getHours() + 24);
                
                const updateResult = await db.collection('carts').updateOne(
                    { _id: cart._id },
                    { 
                        $set: { 
                            expiresAt: newExpiration,
                            extendedAt: new Date(),
                            extendedReason: 'Manual extension - 24 hours'
                        } 
                    }
                );
                
                if (updateResult.modifiedCount > 0) {
                    console.log(`   ✅ Tempo estendido até: ${newExpiration.toLocaleString('pt-BR')}`);
                }
            } else {
                console.log(`   ❌ Carrinho não encontrado em 'carts'`);
            }
            
            // 2. Buscar em seleções pendentes (selections)
            const selection = await db.collection('selections').findOne({
                $and: [
                    { 
                        $or: [
                            { clientCode: clientInfo.code },
                            { clientName: { $regex: new RegExp(clientInfo.name.split(' ')[0], 'i') } }
                        ]
                    },
                    { status: { $in: ['pending', 'reserved'] } }
                ]
            });
            
            if (selection) {
                console.log(`\n📦 Seleção encontrada!`);
                console.log(`   Cliente: ${selection.clientName}`);
                console.log(`   Status: ${selection.status}`);
                console.log(`   Itens: ${selection.items.length}`);
                console.log(`   Expira em: ${selection.reservationExpiredAt ? new Date(selection.reservationExpiredAt).toLocaleString('pt-BR') : 'não definido'}`);
                
                // Estender por 24 horas
                const newExpiration = new Date();
                newExpiration.setHours(newExpiration.getHours() + 24);
                
                const updateResult = await db.collection('selections').updateOne(
                    { _id: selection._id },
                    { 
                        $set: { 
                            reservationExpiredAt: newExpiration,
                            extendedAt: new Date(),
                            extendedReason: 'Manual extension - 24 hours',
                            adminNotes: (selection.adminNotes || '') + ' | Extended 24h on ' + new Date().toLocaleDateString()
                        } 
                    }
                );
                
                if (updateResult.modifiedCount > 0) {
                    console.log(`   ✅ Seleção estendida até: ${newExpiration.toLocaleString('pt-BR')}`);
                }
            } else {
                console.log(`   ℹ️  Nenhuma seleção pendente encontrada`);
            }
            
            // 3. Atualizar status das fotos se necessário
            if (selection && selection.items) {
                console.log(`\n🖼️  Atualizando status das fotos...`);
                
                for (const item of selection.items) {
                    const photoStatus = await db.collection('photostatuses').findOne({
                        $or: [
                            { fileName: item.fileName },
                            { photoPath: item.photoPath }
                        ]
                    });
                    
                    if (photoStatus && photoStatus.reservationInfo) {
                        const newExpiration = new Date();
                        newExpiration.setHours(newExpiration.getHours() + 24);
                        
                        await db.collection('photostatuses').updateOne(
                            { _id: photoStatus._id },
                            { 
                                $set: { 
                                    'reservationInfo.expiresAt': newExpiration,
                                    'reservationInfo.extended': true,
                                    'reservationInfo.extendedAt': new Date()
                                } 
                            }
                        );
                    }
                }
                console.log(`   ✅ Status das fotos atualizado`);
            }
            
            console.log('-'.repeat(60));
        }
        
        console.log('\n✅ PROCESSO CONCLUÍDO!\n');
        console.log('Resumo:');
        console.log('  - Trevor Waldo (9782): Estendido por 24 horas');
        console.log('  - Melissa (2960): Estendido por 24 horas');
        console.log('\nAs fotos permanecerão reservadas por mais 24 horas.');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await client.close();
    }
}

// Executar
extendCartTime();