const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
const PhotoStatus = require('../src/models/PhotoStatus');
require('dotenv').config();

async function alignInitial() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const mysqlConn = await mysql.createConnection({
        host: process.env.CDE_HOST,
        port: parseInt(process.env.CDE_PORT),
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE
    });
    
    // Buscar TODAS as fotos com número no CDE
    const [cdePhotos] = await mysqlConn.execute(`
        SELECT ATIPOETIQUETA, AESTADOP, AIDH
        FROM tbinventario 
        WHERE ATIPOETIQUETA != '0' 
        AND ATIPOETIQUETA != ''
    `);
    
    console.log(`Verificando ${cdePhotos.length} fotos do CDE...`);
    
    let corrections = 0;
    for (const cdePhoto of cdePhotos) {
        // Verificar no MongoDB
        const mongoPhoto = await PhotoStatus.findOne({
            $or: [
                { photoId: cdePhoto.ATIPOETIQUETA },
                { fileName: `${cdePhoto.ATIPOETIQUETA}.webp` }
            ]
        });
        
        if (mongoPhoto) {
            const expectedStatus = 
                cdePhoto.AESTADOP === 'RETIRADO' ? 'sold' :
                cdePhoto.AESTADOP === 'INGRESADO' ? 'available' : 
                'unavailable';
            
            if (mongoPhoto.currentStatus !== expectedStatus) {
                console.log(`Corrigindo ${cdePhoto.ATIPOETIQUETA}: ${mongoPhoto.currentStatus} → ${expectedStatus}`);
                corrections++;
                
                // APLICAR CORREÇÃO REAL
                await PhotoStatus.updateOne(
                    { _id: mongoPhoto._id },
                    { 
                        $set: { 
                            currentStatus: expectedStatus,
                            'virtualStatus.status': expectedStatus,
                            cdeStatus: cdePhoto.AESTADOP,
                            lastCDESync: new Date()
                        }
                    }
                );
            }
        }
    }
    
    console.log(`Total de correções aplicadas: ${corrections}`);
    await mysqlConn.end();
    await mongoose.disconnect();
}

alignInitial();