// check-specific-photos.js
const mongoose = require('mongoose');
require('dotenv').config();

async function checkPhotos() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const UnifiedProductComplete = require('./src/models/UnifiedProductComplete');
    
    // Fotos que tentamos adicionar
    const photoNumbers = [
        "11998", "12008", "14785", "14806", "10629", "10609", "10703", "10710",
        "11678", "11694", "16268", "16269", "16278", "16311", "16314", "16297"
    ];
    
    console.log('📸 VERIFICANDO STATUS DAS FOTOS:\n');
    
    for (const photoNum of photoNumbers) {
        // Buscar de várias formas possíveis
        const photo = await UnifiedProductComplete.findOne({
            $or: [
                { photoNumber: photoNum },
                { fileName: `${photoNum}.webp` },
                { driveFileId: { $regex: photoNum } }
            ]
        });
        
        if (photo) {
            console.log(`${photoNum}:`);
            console.log(`  Status: ${photo.status}`);
            console.log(`  CurrentStatus: ${photo.currentStatus}`);
            console.log(`  CDE Status: ${photo.cdeStatus}`);
            if (photo.reservedBy?.clientCode) {
                console.log(`  Reservado por: ${photo.reservedBy.clientCode}`);
            }
        } else {
            console.log(`${photoNum}: NÃO ENCONTRADA no banco`);
        }
    }
    
    // Verificar também no CDE
    const CDESync = require('./src/services/CDESync');
    console.log('\n📊 Verificando no CDE...');
    
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection({
        host: process.env.CDE_HOST,
        port: process.env.CDE_PORT,
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE
    });
    
    for (const photoNum of photoNumbers.slice(0, 5)) { // Verificar apenas 5 no CDE
        const [rows] = await conn.execute(
            'SELECT ATIPOETIQUETA, AESTADOP FROM tbinventario WHERE ATIPOETIQUETA = ?',
            [photoNum]
        );
        
        if (rows.length > 0) {
            console.log(`${photoNum} no CDE: ${rows[0].AESTADOP}`);
        }
    }
    
    await conn.end();
    mongoose.disconnect();
}

checkPhotos();