// urgent-check-eddie-photos.js
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function urgentCheck() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const UnifiedProductComplete = require('./src/models/UnifiedProductComplete');
    
    // Fotos que Eddie disse estarem vendidas mas aparecem
    const eddiePhotos = ["08227", "17055", "20557", "20522", "20531"];
    
    console.log('🚨 VERIFICAÇÃO URGENTE - FOTOS DO EDDIE\n');
    
    // Conectar CDE
    const conn = await mysql.createConnection({
        host: process.env.CDE_HOST,
        port: process.env.CDE_PORT,
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE
    });
    
    for (const photoNum of eddiePhotos) {
        console.log(`\n📸 ${photoNum}:`);
        
        // Status no MongoDB
        const mongoPhoto = await UnifiedProductComplete.findOne({
            $or: [
                { photoNumber: photoNum },
                { fileName: `${photoNum}.webp` }
            ]
        });
        
        if (mongoPhoto) {
            console.log(`  MongoDB status: ${mongoPhoto.status}`);
            console.log(`  MongoDB cdeStatus: ${mongoPhoto.cdeStatus}`);
        } else {
            console.log(`  MongoDB: NÃO ENCONTRADA`);
        }
        
        // Status no CDE
        const [cdeRows] = await conn.execute(
            'SELECT AESTADOP, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA = ?',
            [photoNum]
        );
        
        if (cdeRows.length > 0) {
            console.log(`  CDE status: ${cdeRows[0].AESTADOP}`);
            
            // Se está RETIRADO no CDE mas available no MongoDB, CORRIGIR!
            if (cdeRows[0].AESTADOP === 'RETIRADO' && mongoPhoto?.status === 'available') {
                console.log(`  ⚠️ DESALINHADO! Corrigindo...`);
                
                await UnifiedProductComplete.updateOne(
                    { _id: mongoPhoto._id },
                    {
                        $set: {
                            status: 'sold',
                            currentStatus: 'sold',
                            'virtualStatus.status': 'sold',
                            cdeStatus: 'RETIRADO'
                        }
                    }
                );
                console.log(`  ✅ CORRIGIDO para sold`);
            }
        }
    }
    
    await conn.end();
    mongoose.disconnect();
}

urgentCheck();