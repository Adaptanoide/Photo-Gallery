const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
const PhotoStatus = require('../../src/models/PhotoStatus');
require('dotenv').config();

async function mapIdhCodes() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const mysqlConn = await mysql.createConnection({
        host: process.env.CDE_HOST,
        port: parseInt(process.env.CDE_PORT),
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE
    });
    
    // Buscar TODAS as fotos sem idhCode
    const photosWithoutIdh = await PhotoStatus.find(
        { idhCode: { $exists: false } },
        'photoId'
    );
    
    console.log(`\n=== MAPEAMENTO DE IDH CODES ===`);
    console.log(`Total de fotos sem IDH: ${photosWithoutIdh.length}\n`);
    
    let mapped = 0;
    let notFound = 0;
    let errors = 0;
    
    for (let i = 0; i < photosWithoutIdh.length; i++) {
        const photo = photosWithoutIdh[i];
        
        // Extrair apenas o número da foto
        let searchId = photo.photoId;
        if (searchId.includes('/')) {
            // É um path completo, extrair apenas o número
            searchId = searchId.split('/').pop().replace('.webp', '');
        }
        
        try {
            // Buscar no CDE pelo número da foto
            const [rows] = await mysqlConn.execute(
                'SELECT AIDH, ATIPOETIQUETA FROM tbinventario WHERE ATIPOETIQUETA = ?',
                [searchId]
            );
            
            if (rows.length > 0) {
                // Atualizar MongoDB com o IDH
                await PhotoStatus.updateOne(
                    { _id: photo._id },
                    { $set: { idhCode: rows[0].AIDH } }
                );
                mapped++;
                console.log(`✓ ${searchId} → IDH: ${rows[0].AIDH}`);
            } else {
                notFound++;
                console.log(`✗ ${searchId} → Não encontrado no CDE`);
            }
        } catch (error) {
            errors++;
            console.log(`⚠ ${searchId} → Erro: ${error.message}`);
        }
        
        // Mostrar progresso a cada 100 fotos
        if ((i + 1) % 100 === 0) {
            console.log(`\n--- Progresso: ${i + 1}/${photosWithoutIdh.length} processadas ---\n`);
        }
    }
    
    console.log(`\n=== RESULTADO FINAL ===`);
    console.log(`✓ ${mapped} fotos mapeadas com IDH`);
    console.log(`✗ ${notFound} fotos não encontradas no CDE`);
    console.log(`⚠ ${errors} erros durante processamento`);
    console.log(`Total processado: ${photosWithoutIdh.length}`);
    
    await mysqlConn.end();
    await mongoose.disconnect();
}

mapIdhCodes();