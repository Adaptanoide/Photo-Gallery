const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
require('dotenv').config();

async function checkTiming() {
    const cde = await mysql.createConnection({
        host: '216.246.112.6',
        port: 3306,
        user: 'tzwgctib_photos',
        password: 'T14g0@photos',
        database: 'tzwgctib_inventario'
    });
    
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    console.log('=== ANÁLISE TEMPORAL ===\n');
    
    // Verificar todas as fotos available que foram atualizadas em 21/09 às 12:49
    const suspectPhotos = await db.collection('unified_products_complete').find({
        status: 'available',
        updatedAt: {
            $gte: new Date('2025-09-21T12:48:00'),
            $lte: new Date('2025-09-21T12:50:00')
        }
    }).toArray();
    
    console.log(`Fotos marcadas como available em 21/09 às 12:49: ${suspectPhotos.length}\n`);
    
    let problems = 0;
    for (const photo of suspectPhotos.slice(0, 10)) {
        const photoNum = photo.fileName.replace('.webp', '');
        const [cde] = await cde.execute(
            'SELECT AESTADOP, AFECHA FROM tbinventario WHERE ATIPOETIQUETA = ?',
            [photoNum]
        );
        
        if (cde[0] && cde[0].AESTADOP !== 'INGRESADO') {
            console.log(`${photoNum}: MongoDB=available mas CDE=${cde[0].AESTADOP} (desde ${cde[0].AFECHA})`);
            problems++;
        }
    }
    
    console.log(`\nProblemas encontrados: ${problems} de 10 verificadas`);
    
    await cde.end();
    await mongoose.connection.close();
}

checkTiming().catch(console.error);
