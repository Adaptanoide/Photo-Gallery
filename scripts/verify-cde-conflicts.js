// scripts/verify-cde-conflicts.js
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Schema simplificado do PhotoStatus
const photoStatusSchema = new mongoose.Schema({
    photoId: String,
    fileName: String,
    currentStatus: String,
    virtualStatus: {
        status: String
    },
    cdeStatus: String  // Este campo ainda não existe, mas vamos preparar
});

const PhotoStatus = mongoose.model('PhotoStatus', photoStatusSchema, 'photostatuses');

async function verifyConflicts() {
    let mysqlConnection;
    
    try {
        // Conectar MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB\n');
        
        // Conectar MySQL do CDE
        mysqlConnection = await mysql.createConnection({
            host: '216.246.112.6',
            port: 3306,
            user: 'tzwgctib_photos',
            password: 'T14g0@photos',
            database: 'tzwgctib_inventario'
        });
        console.log('✅ Conectado ao CDE\n');

        // Buscar TODAS as fotos em STANDBY ou RESERVED no CDE
        console.log('🔍 Buscando fotos STANDBY/RESERVED no CDE...');
        const [blockedInCDE] = await mysqlConnection.execute(`
            SELECT AIDH, AESTADOP, ATIPOETIQUETA
            FROM tbinventario 
            WHERE ATIPOETIQUETA != '0' 
            AND ATIPOETIQUETA != ''
            AND AESTADOP IN ('STANDBY', 'RESERVED')
        `);
        
        console.log(`📊 Encontradas ${blockedInCDE.length} fotos bloqueadas no CDE\n`);

        // Verificar cada uma no MongoDB
        let conflicts = [];
        let notInSystem = [];
        
        for (const cdePhoto of blockedInCDE) {
            const photoNumber = cdePhoto.ATIPOETIQUETA;
            const photoIdPadded = photoNumber.padStart(5, '0');
            
            // Buscar no MongoDB
            const mongoPhoto = await PhotoStatus.findOne({
                $or: [
                    { photoId: photoNumber },
                    { photoId: photoIdPadded },
                    { fileName: `${photoIdPadded}.webp` },
                    { fileName: `${photoNumber}.webp` }
                ]
            });
            
            if (mongoPhoto) {
                // Foto existe no sistema - verificar conflito
                if (mongoPhoto.currentStatus === 'available' || 
                    mongoPhoto.virtualStatus?.status === 'available') {
                    conflicts.push({
                        photoNumber: photoNumber,
                        idhCode: cdePhoto.AIDH,
                        cdeStatus: cdePhoto.AESTADOP,
                        mongoStatus: mongoPhoto.currentStatus,
                        virtualStatus: mongoPhoto.virtualStatus?.status
                    });
                }
            } else {
                notInSystem.push({
                    photoNumber: photoNumber,
                    idhCode: cdePhoto.AIDH,
                    cdeStatus: cdePhoto.AESTADOP
                });
            }
        }

        // Mostrar resultados
        console.log('❌ CONFLITOS ENCONTRADOS (aparecem disponíveis mas não deveriam):');
        console.log('=' .repeat(60));
        
        if (conflicts.length > 0) {
            console.log(`Total: ${conflicts.length} fotos\n`);
            
            // Mostrar primeiros 10 exemplos
            conflicts.slice(0, 10).forEach(conflict => {
                console.log(`  Foto: ${conflict.photoNumber}`);
                console.log(`  - IDH: ${conflict.idhCode}`);
                console.log(`  - CDE: ${conflict.cdeStatus} ❌`);
                console.log(`  - Mongo: ${conflict.mongoStatus} / ${conflict.virtualStatus}`);
                console.log('  ---');
            });
            
            if (conflicts.length > 10) {
                console.log(`\n  ... e mais ${conflicts.length - 10} conflitos`);
            }
        } else {
            console.log('  Nenhum conflito encontrado! ✅');
        }

        console.log('\n📝 FOTOS NO CDE MAS NÃO NO SEU SISTEMA:');
        console.log('=' .repeat(60));
        console.log(`Total: ${notInSystem.length} fotos\n`);
        
        if (notInSystem.length > 0 && notInSystem.length <= 20) {
            notInSystem.forEach(photo => {
                console.log(`  Foto ${photo.photoNumber} (${photo.cdeStatus})`);
            });
        }

        // Resumo final
        console.log('\n📊 RESUMO:');
        console.log('=' .repeat(60));
        console.log(`  Fotos bloqueadas no CDE: ${blockedInCDE.length}`);
        console.log(`  Conflitos (disponíveis incorretamente): ${conflicts.length}`);
        console.log(`  Não existem no seu sistema: ${notInSystem.length}`);
        console.log(`  Corretas (bloqueadas em ambos): ${blockedInCDE.length - conflicts.length - notInSystem.length}`);

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        if (mysqlConnection) await mysqlConnection.end();
        await mongoose.disconnect();
        console.log('\n✅ Conexões fechadas');
    }
}

console.log('🔍 VERIFICAÇÃO DE CONFLITOS CDE vs MONGODB');
console.log('=' .repeat(60));
verifyConflicts();