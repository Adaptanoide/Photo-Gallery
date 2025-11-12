// check-photo.js
require('dotenv').config();
const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
const UnifiedProductComplete = require('./src/models/UnifiedProductComplete');

async function checkPhoto(photoNumber) {
    let cdeConnection = null;

    try {
        console.log(`\n🔍 Verificando foto ${photoNumber}...\n`);

        // 1. Conectar MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB conectado');

        // 2. Buscar no MongoDB
        const mongoPhoto = await UnifiedProductComplete.findOne({ 
            photoNumber: photoNumber 
        });

        console.log('\n📦 MONGODB:');
        console.log('  Status:', mongoPhoto?.status);
        console.log('  CDE Status (campo):', mongoPhoto?.cdeStatus);
        console.log('  QB Item:', mongoPhoto?.qbItem);
        console.log('  Categoria:', mongoPhoto?.category);
        console.log('  isActive:', mongoPhoto?.isActive);
        console.log('  currentStatus:', mongoPhoto?.currentStatus);

        // 3. Conectar CDE
        cdeConnection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            port: process.env.CDE_PORT,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });

        console.log('✅ CDE conectado');

        // 4. Buscar no CDE
        const [cdeResult] = await cdeConnection.execute(
            `SELECT ATIPOETIQUETA, AESTADOP, AQBITEM, RESERVEDUSU, AFECHA 
             FROM tbinventario 
             WHERE ATIPOETIQUETA = ?`,
            [photoNumber]
        );

        console.log('\n🏢 CDE (tbinventario):');
        if (cdeResult.length > 0) {
            console.log('  ATIPOETIQUETA:', cdeResult[0].ATIPOETIQUETA);
            console.log('  AESTADOP:', cdeResult[0].AESTADOP);
            console.log('  AQBITEM:', cdeResult[0].AQBITEM);
            console.log('  RESERVEDUSU:', cdeResult[0].RESERVEDUSU);
            console.log('  AFECHA:', cdeResult[0].AFECHA);
        } else {
            console.log('  ⚠️ NÃO ENCONTRADA');
        }

        // 5. Comparar
        console.log('\n🔍 COMPARAÇÃO:');
        if (cdeResult.length > 0) {
            const match = mongoPhoto.status === 'available' && cdeResult[0].AESTADOP === 'INGRESADO';
            console.log('  MongoDB status:', mongoPhoto.status);
            console.log('  CDE AESTADOP:', cdeResult[0].AESTADOP);
            console.log('  Match:', match ? '✅ OK' : '❌ DIVERGÊNCIA');
            
            if (!match) {
                console.log('\n  ⚠️ PROBLEMA DETECTADO:');
                if (mongoPhoto.status === 'available' && cdeResult[0].AESTADOP === 'RETIRADO') {
                    console.log('  🔴 CRÍTICO: Foto vendida aparece como disponível!');
                }
            }
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        if (cdeConnection) await cdeConnection.end();
        await mongoose.disconnect();
        process.exit(0);
    }
}

// Pegar número da foto dos argumentos
const photoNumber = process.argv[2];

if (!photoNumber) {
    console.log('❌ Use: node check-photo.js <numero_da_foto>');
    console.log('Exemplo: node check-photo.js 16576');
    process.exit(1);
}

checkPhoto(photoNumber);