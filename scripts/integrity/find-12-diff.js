#!/usr/bin/env node
const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
require('dotenv').config();

async function find12Diff() {
    const cde = await mysql.createConnection({
        host: '216.246.112.6',
        port: 3306,
        user: 'tzwgctib_photos',
        password: 'T14g0@photos',
        database: 'tzwgctib_inventario'
    });
    
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    console.log('=== IDENTIFICANDO AS 12 FOTOS DE DIFERENÇA ===\n');
    
    // Buscar todas as fotos available no MongoDB
    const mongoAvailable = await db.collection('unified_products_complete')
        .find({ status: 'available' }, { fileName: 1 })
        .toArray();
    
    console.log(`MongoDB: ${mongoAvailable.length} fotos available\n`);
    
    let notIngresado = [];
    let notInCDE = [];
    
    // Verificar cada uma no CDE
    for (const photo of mongoAvailable) {
        const photoNum = photo.fileName.replace('.webp', '');
        
        const [cdeResult] = await cde.execute(
            'SELECT AESTADOP FROM tbinventario WHERE ATIPOETIQUETA = ?',
            [photoNum]
        );
        
        if (!cdeResult[0]) {
            notInCDE.push(photoNum);
        } else if (cdeResult[0].AESTADOP !== 'INGRESADO') {
            notIngresado.push({
                photo: photoNum,
                cdeStatus: cdeResult[0].AESTADOP
            });
        }
        
        // Mostrar progresso a cada 100
        if ((notIngresado.length + notInCDE.length) % 5 === 0) {
            process.stdout.write('.');
        }
    }
    
    console.log('\n\n=== RESULTADOS ===\n');
    
    if (notInCDE.length > 0) {
        console.log(`${notInCDE.length} fotos NÃO EXISTEM no CDE:`);
        notInCDE.forEach(p => console.log(`  - ${p}`));
    }
    
    if (notIngresado.length > 0) {
        console.log(`\n${notIngresado.length} fotos com status DIFERENTE no CDE:`);
        notIngresado.slice(0, 20).forEach(p => 
            console.log(`  - ${p.photo}: CDE=${p.cdeStatus} mas MongoDB=available`)
        );
        if (notIngresado.length > 20) {
            console.log(`  ... e mais ${notIngresado.length - 20} fotos`);
        }
    }
    
    console.log('\n=== RESUMO ===');
    console.log('Não existem no CDE:', notInCDE.length);
    console.log('Status diferente:', notIngresado.length);
    console.log('Total de diferenças:', notInCDE.length + notIngresado.length);
    
    await cde.end();
    await mongoose.connection.close();
}

find12Diff().catch(console.error);
