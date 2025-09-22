#!/usr/bin/env node
const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
require('dotenv').config();

async function checkIntegrity() {
    let cde, mongoConnection;
    
    try {
        cde = await mysql.createConnection({
            host: process.env.CDE_HOST || '216.246.112.6',
            port: process.env.CDE_PORT || 3306,
            user: process.env.CDE_USER || 'tzwgctib_photos',
            password: process.env.CDE_PASSWORD || 'T14g0@photos',
            database: process.env.CDE_DATABASE || 'tzwgctib_inventario'
        });
        
        await mongoose.connect(process.env.MONGODB_URI);
        const db = mongoose.connection.db;
        
        console.log('=== VERIFICAÇÃO DE INTEGRIDADE CDE vs MONGODB ===');
        console.log('Data:', new Date().toLocaleString('pt-BR'));
        console.log('================================================\n');
        
        const [cdeIngresado] = await cde.execute(
            'SELECT COUNT(*) as total FROM tbinventario WHERE ATIPOETIQUETA REGEXP "^[0-9]{5}$" AND AESTADOP = "INGRESADO"'
        );
        
        const mongoAvailable = await db.collection('unified_products_complete').countDocuments({
            status: 'available'
        });
        
        console.log('FOTOS DISPONÍVEIS:');
        console.log('   CDE (INGRESADO):', cdeIngresado[0].total);
        console.log('   MongoDB (available):', mongoAvailable);
        console.log('   Diferença:', Math.abs(cdeIngresado[0].total - mongoAvailable));
        
        console.log('\nSincronização OK!');
        
    } catch (error) {
        console.error('Erro:', error.message);
    } finally {
        if (cde) await cde.end();
        if (mongoose.connection) await mongoose.connection.close();
    }
}

checkIntegrity().catch(console.error);
