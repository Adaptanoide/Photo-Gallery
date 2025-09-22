#!/usr/bin/env node
const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
require('dotenv').config();

async function investigate() {
    const cde = await mysql.createConnection({
        host: '216.246.112.6',
        port: 3306,
        user: 'tzwgctib_photos',
        password: 'T14g0@photos',
        database: 'tzwgctib_inventario'
    });
    
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    // Fotos para investigar em detalhe
    const photosToCheck = ['17050', '14600', '20578', '11777', '22369'];
    
    console.log('=== INVESTIGAÇÃO DETALHADA ===\n');
    
    for (const photoNum of photosToCheck) {
        console.log(`FOTO ${photoNum}:`);
        
        // MongoDB - detalhes completos
        const mongoData = await db.collection('unified_products_complete').findOne({
            fileName: photoNum + '.webp'
        });
        
        if (mongoData) {
            console.log('  MongoDB:');
            console.log('    Status:', mongoData.status);
            console.log('    CDE Status:', mongoData.cdeStatus);
            console.log('    UpdatedAt:', mongoData.updatedAt);
            console.log('    SelectionId:', mongoData.selectionId);
            console.log('    ReservedBy:', mongoData.reservedBy);
        } else {
            console.log('  MongoDB: NÃO ENCONTRADA');
        }
        
        // CDE - detalhes completos
        const [cdeData] = await cde.execute(
            'SELECT * FROM tbinventario WHERE ATIPOETIQUETA = ?',
            [photoNum]
        );
        
        if (cdeData[0]) {
            console.log('  CDE:');
            console.log('    Status:', cdeData[0].AESTADOP);
            console.log('    Reservado:', cdeData[0].RESERVEDUSU || 'ninguém');
            console.log('    Data:', cdeData[0].AFECHA);
            console.log('    QB Item:', cdeData[0].AQBITEM);
        } else {
            console.log('  CDE: NÃO ENCONTRADA');
        }
        
        console.log('---');
    }
    
    // Ver quando foi a última sincronização
    const lastSync = await db.collection('unified_products_complete')
        .find({ status: 'available' })
        .sort({ updatedAt: -1 })
        .limit(1)
        .toArray();
    
    console.log('\nÚltima atualização de foto available:', lastSync[0]?.updatedAt);
    
    await cde.end();
    await mongoose.connection.close();
}

investigate().catch(console.error);
