require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkPhotosInCDE() {
    console.log('🔍 VERIFICANDO FOTOS 5500PE NO CDE\n');
    console.log('='.repeat(70) + '\n');

    try {
        // Conectar CDE
        const cdeConnection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });

        console.log('✅ Conectado ao CDE\n');

        // Buscar fotos específicas
        const photoNumbers = ['31122', '31125', '31126', '31142', '25651'];

        console.log('📸 Buscando fotos específicas no CDE:\n');

        for (const photoNum of photoNumbers) {
            const paddedNum = photoNum.padStart(5, '0');

            const [rows] = await cdeConnection.execute(`
                SELECT
                    ATIPOETIQUETA as photoNumber,
                    AQBITEM as qbItem,
                    AESTADOP as status,
                    AORIGEN as origin,
                    AFECHA as date,
                    RESERVEDUSU as reservedBy
                FROM tbinventario
                WHERE ATIPOETIQUETA = ?
            `, [paddedNum]);

            if (rows.length > 0) {
                const row = rows[0];
                console.log(`✅ Foto ${photoNum} ENCONTRADA no CDE:`);
                console.log(`   QB Item: ${row.qbItem}`);
                console.log(`   Status: ${row.status}`);
                console.log(`   Origem: ${row.origin}`);
                console.log(`   Data: ${row.date}`);
                console.log(`   Reserved By: ${row.reservedBy || 'N/A'}`);
            } else {
                console.log(`❌ Foto ${photoNum} NÃO encontrada no CDE`);
            }
            console.log('');
        }

        // Buscar TODAS as fotos 5500PE no CDE
        console.log('='.repeat(70));
        console.log('📊 Buscando TODAS as fotos com QBITEM = 5500PE:\n');

        const [allPhotos] = await cdeConnection.execute(`
            SELECT
                ATIPOETIQUETA as photoNumber,
                AQBITEM as qbItem,
                AESTADOP as status,
                AORIGEN as origin,
                AFECHA as date,
                RESERVEDUSU as reservedBy
            FROM tbinventario
            WHERE AQBITEM = '5500PE'
            ORDER BY ATIPOETIQUETA DESC
        `);

        console.log(`Total de fotos 5500PE no CDE: ${allPhotos.length}\n`);

        if (allPhotos.length > 0) {
            // Agrupar por status
            const byStatus = {};
            allPhotos.forEach(photo => {
                byStatus[photo.status] = (byStatus[photo.status] || 0) + 1;
            });

            console.log('Por Status:');
            Object.entries(byStatus).forEach(([status, count]) => {
                console.log(`   ${status.padEnd(15)}: ${count}`);
            });
            console.log('');

            // Listar todas
            console.log('Lista completa:');
            console.log('-'.repeat(70));
            allPhotos.forEach(photo => {
                console.log(`   ${photo.photoNumber} | ${photo.status.padEnd(12)} | ${photo.origin} | ${photo.date || 'N/A'}`);
            });
        }

        console.log('\n' + '='.repeat(70));
        console.log('💡 CONCLUSÃO:\n');
        console.log(`   Fotos específicas encontradas no CDE: ${photoNumbers.filter(async num => {
            const [r] = await cdeConnection.execute('SELECT ATIPOETIQUETA FROM tbinventario WHERE ATIPOETIQUETA = ?', [num.padStart(5, '0')]);
            return r.length > 0;
        }).length}`);
        console.log(`   Total de fotos 5500PE no CDE: ${allPhotos.length}`);
        console.log('\n' + '='.repeat(70) + '\n');

        await cdeConnection.end();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

checkPhotosInCDE();
