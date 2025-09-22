#!/usr/bin/env node
const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
require('dotenv').config();

async function fullAnalysis() {
    const cde = await mysql.createConnection({
        host: '216.246.112.6',
        port: 3306,
        user: 'tzwgctib_photos',
        password: 'T14g0@photos',
        database: 'tzwgctib_inventario'
    });
    
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    console.log('=== ANÁLISE COMPLETA DE STATUS ===\n');
    
    // 1. Estatísticas gerais
    const mongoStats = await db.collection('unified_products_complete').aggregate([
        { $group: { 
            _id: { 
                status: '$status', 
                cdeStatus: '$cdeStatus' 
            }, 
            count: { $sum: 1 } 
        }},
        { $sort: { count: -1 }}
    ]).toArray();
    
    console.log('COMBINAÇÕES DE STATUS NO MONGODB:');
    mongoStats.forEach(s => {
        console.log(`  status="${s._id.status}" + cdeStatus="${s._id.cdeStatus}": ${s.count} fotos`);
    });
    
    // 2. Verificar fotos available com cdeStatus=INGRESADO
    const availableIngresado = await db.collection('unified_products_complete').find({
        status: 'available',
        cdeStatus: 'INGRESADO'
    }).limit(20).toArray();
    
    console.log(`\nVERIFICANDO ${availableIngresado.length} FOTOS (available + INGRESADO):\n`);
    
    let aligned = 0;
    let notAligned = [];
    
    for (const photo of availableIngresado) {
        const photoNum = photo.fileName.replace('.webp', '');
        const [cdeCheck] = await cde.execute(
            'SELECT AESTADOP, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA = ?',
            [photoNum]
        );
        
        if (cdeCheck[0]) {
            if (cdeCheck[0].AESTADOP === 'INGRESADO') {
                aligned++;
            } else {
                notAligned.push({
                    photo: photoNum,
                    mongoDB: 'available/INGRESADO',
                    cdeReal: cdeCheck[0].AESTADOP,
                    reserved: cdeCheck[0].RESERVEDUSU
                });
            }
        }
    }
    
    console.log(`✅ Alinhadas corretamente: ${aligned}`);
    console.log(`❌ Desalinhadas: ${notAligned.length}`);
    
    if (notAligned.length > 0) {
        console.log('\nFOTOS DESALINHADAS:');
        notAligned.forEach(p => {
            console.log(`  ${p.photo}: MongoDB diz INGRESADO mas CDE diz ${p.cdeReal} (${p.reserved || 'sem reserva'})`);
        });
    }
    
    // 3. Ver quando essas fotos foram modificadas
    if (notAligned.length > 0) {
        console.log('\nQUANDO FORAM MODIFICADAS NO MONGODB:');
        for (const item of notAligned.slice(0, 3)) {
            const mongoPhoto = await db.collection('unified_products_complete').findOne({
                fileName: item.photo + '.webp'
            });
            console.log(`  ${item.photo}: última atualização MongoDB em ${mongoPhoto.updatedAt}`);
        }
    }
    
    await cde.end();
    await mongoose.connection.close();
}

fullAnalysis().catch(console.error);
