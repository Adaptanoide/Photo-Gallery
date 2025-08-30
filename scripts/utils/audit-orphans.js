const mysql = require('mysql2/promise');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config();

async function auditOrphans() {
    // Conectar CDE
    const conn = await mysql.createConnection({
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
    
    console.log('AUDITORIA DE REGISTROS ÓRFÃOS NO CDE\n');
    console.log('======================================\n');
    
    // 1. Buscar todas as INGRESADAS válidas do CDE
    const [ingresadas] = await conn.execute(
        `SELECT ATIPOETIQUETA, AIDH FROM tbinventario 
         WHERE AESTADOP = 'INGRESADO' 
         AND ATIPOETIQUETA NOT IN ('0', '', '00', '000')
         AND LENGTH(ATIPOETIQUETA) >= 3`
    );
    
    console.log(`1. Total de fotos INGRESADAS no CDE: ${ingresadas.length}\n`);
    
    // 2. Buscar todas as fotos do R2
    let r2Photos = new Set();
    let continuationToken;
    
    do {
        const command = new ListObjectsV2Command({
            Bucket: 'sunshine-photos',
            ContinuationToken: continuationToken
        });
        const data = await s3Client.send(command);
        if (data.Contents) {
            data.Contents.forEach(obj => {
                if (obj.Key.endsWith('.webp') && !obj.Key.includes('_')) {
                    const id = obj.Key.split('/').pop().replace('.webp', '');
                    r2Photos.add(id);
                }
            });
        }
        continuationToken = data.NextContinuationToken;
    } while (continuationToken);
    
    console.log(`2. Total de arquivos físicos no R2: ${r2Photos.size}\n`);
    
    // 3. Encontrar órfãos
    const orphans = [];
    const existing = [];
    
    for (const record of ingresadas) {
        const photoId = record.ATIPOETIQUETA;
        if (!r2Photos.has(photoId)) {
            orphans.push({
                photoId: photoId,
                idhCode: record.AIDH
            });
        } else {
            existing.push(photoId);
        }
    }
    
    console.log(`3. ANÁLISE:\n`);
    console.log(`   ✓ ${existing.length} fotos INGRESADAS com arquivo físico`);
    console.log(`   ✗ ${orphans.length} registros ÓRFÃOS (sem arquivo físico)\n`);
    
    // 4. Mostrar amostra de órfãos
    console.log(`4. AMOSTRA DE REGISTROS ÓRFÃOS (primeiros 50):\n`);
    orphans.slice(0, 50).forEach(o => {
        console.log(`   ${o.photoId} (IDH: ${o.idhCode})`);
    });
    
    // 5. Criar arquivo CSV para Ingrid
    const fs = require('fs');
    let csv = 'ATIPOETIQUETA,AIDH,STATUS,OBSERVACAO\n';
    orphans.forEach(o => {
        csv += `${o.photoId},${o.idhCode},INGRESADO,Arquivo não existe no sistema\n`;
    });
    
    fs.writeFileSync('registros_orfaos_cde.csv', csv);
    console.log(`\n5. ARQUIVO CRIADO: registros_orfaos_cde.csv`);
    console.log(`   Este arquivo contém ${orphans.length} registros órfãos para revisão\n`);
    
    // 6. Estatísticas por faixa de número
    const ranges = {
        '00001-09999': 0,
        '10000-19999': 0,
        '20000-29999': 0,
        '30000-39999': 0,
        '40000-49999': 0,
        '50000-59999': 0,
        '60000-69999': 0,
        '70000-79999': 0,
        '80000-89999': 0,
        '90000-99999': 0
    };
    
    orphans.forEach(o => {
        const num = parseInt(o.photoId);
        if (num < 10000) ranges['00001-09999']++;
        else if (num < 20000) ranges['10000-19999']++;
        else if (num < 30000) ranges['20000-29999']++;
        else if (num < 40000) ranges['30000-39999']++;
        else if (num < 50000) ranges['40000-49999']++;
        else if (num < 60000) ranges['50000-59999']++;
        else if (num < 70000) ranges['60000-69999']++;
        else if (num < 80000) ranges['70000-79999']++;
        else if (num < 90000) ranges['80000-89999']++;
        else ranges['90000-99999']++;
    });
    
    console.log('6. DISTRIBUIÇÃO DOS ÓRFÃOS POR FAIXA:\n');
    Object.entries(ranges).forEach(([range, count]) => {
        if (count > 0) {
            console.log(`   ${range}: ${count} registros`);
        }
    });
    
    await conn.end();
}

auditOrphans();