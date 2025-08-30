const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
const PhotoStatus = require('../src/models/PhotoStatus');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config();

async function auditSystems() {
    // Conectar MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Conectar CDE
    const mysqlConn = await mysql.createConnection({
        host: process.env.CDE_HOST,
        port: parseInt(process.env.CDE_PORT),
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE
    });
    
    // Configurar R2
    const s3Client = new S3Client({
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        region: 'auto',
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
        }
    });
    
    console.log('1. COLETANDO DADOS DO CDE...');
    const [cdePhotos] = await mysqlConn.execute(
        `SELECT ATIPOETIQUETA, AESTADOP FROM tbinventario 
         WHERE ATIPOETIQUETA != '0' AND ATIPOETIQUETA != ''`
    );
    console.log(`   ${cdePhotos.length} fotos no CDE`);
    
    console.log('\n2. COLETANDO DADOS DO MONGODB...');
    const mongoPhotos = await PhotoStatus.find({}, 'photoId currentStatus').lean();
    console.log(`   ${mongoPhotos.length} fotos no MongoDB`);
    
    console.log('\n3. COLETANDO FOTOS DO R2...');
    let r2Photos = [];
    let continuationToken;
    do {
        const command = new ListObjectsV2Command({
            Bucket: 'sunshine-photos',
            ContinuationToken: continuationToken
        });
        const data = await s3Client.send(command);
        if (data.Contents) {
            const photos = data.Contents.filter(obj => 
                obj.Key.endsWith('.webp') && 
                !obj.Key.includes('_thumbnails') &&
                !obj.Key.includes('_preview') &&
                !obj.Key.includes('_display')
            );
            r2Photos = r2Photos.concat(photos);
        }
        continuationToken = data.NextContinuationToken;
    } while (continuationToken);
    console.log(`   ${r2Photos.length} fotos no R2`);
    
    // Criar mapas para comparação
    const cdeMap = new Map();
    cdePhotos.forEach(p => cdeMap.set(p.ATIPOETIQUETA, p.AESTADOP));
    
    const mongoMap = new Map();
    mongoPhotos.forEach(p => mongoMap.set(p.photoId, p.currentStatus));
    
    const r2Set = new Set();
    r2Photos.forEach(p => {
        const id = p.Key.split('/').pop().replace('.webp', '');
        r2Set.add(id);
    });
    
    console.log('\n4. ANÁLISE DE DISCREPÂNCIAS:');
    
    // Fotos no CDE mas não no R2 (fantasmas)
    console.log('\n   FOTOS FANTASMA (CDE tem registro mas arquivo não existe):');
    let phantoms = 0;
    for (const [photoId, status] of cdeMap) {
        if (!r2Set.has(photoId) && status === 'INGRESADO') {
            console.log(`   - ${photoId}: ${status} no CDE mas não existe arquivo`);
            phantoms++;
            if (phantoms >= 10) {
                console.log('   ... (mostrando apenas 10 primeiras)');
                break;
            }
        }
    }
    
    // Fotos no R2 mas não no MongoDB
    console.log('\n   FOTOS SEM REGISTRO MongoDB:');
    let noMongo = 0;
    for (const photoId of r2Set) {
        if (!mongoMap.has(photoId)) {
            console.log(`   - ${photoId}: existe no R2 mas não no MongoDB`);
            noMongo++;
            if (noMongo >= 10) {
                console.log('   ... (mostrando apenas 10 primeiras)');
                break;
            }
        }
    }
    
    // Status conflitantes
    console.log('\n   CONFLITOS DE STATUS (MongoDB vs CDE):');
    let conflicts = 0;
    for (const [photoId, mongoStatus] of mongoMap) {
        if (cdeMap.has(photoId)) {
            const cdeStatus = cdeMap.get(photoId);
            const expectedStatus = 
                cdeStatus === 'RETIRADO' ? 'sold' :
                cdeStatus === 'INGRESADO' ? 'available' :
                'unavailable';
            
            if (mongoStatus !== expectedStatus && r2Set.has(photoId)) {
                console.log(`   - ${photoId}: MongoDB=${mongoStatus}, CDE=${cdeStatus}`);
                conflicts++;
                if (conflicts >= 10) {
                    console.log('   ... (mostrando apenas 10 primeiros)');
                    break;
                }
            }
        }
    }
    
    console.log('\n5. RESUMO FINAL:');
    console.log(`   Total CDE: ${cdeMap.size}`);
    console.log(`   Total MongoDB: ${mongoMap.size}`);
    console.log(`   Total R2: ${r2Set.size}`);
    console.log(`   Fotos fantasma no CDE: ${phantoms}+`);
    console.log(`   Fotos sem registro MongoDB: ${noMongo}+`);
    console.log(`   Conflitos de status: ${conflicts}+`);
    
    await mysqlConn.end();
    await mongoose.disconnect();
}

auditSystems();