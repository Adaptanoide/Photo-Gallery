// scripts/check-photo-status.js
const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkPhotoStatus() {
    const connection = await mysql.createConnection({
        host: process.env.CDE_HOST,
        port: process.env.CDE_PORT,
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE
    });

    try {
        console.log('🔍 VERIFICANDO FOTOS NO CDE\n');
        console.log('=' .repeat(50));
        
        // Verificar múltiplas fotos
        const photosToCheck = ['21929', '21930', '21931', '21932', '21933'];
        
        console.log('\n📸 STATUS DAS FOTOS:');
        for (const photo of photosToCheck) {
            const [result] = await connection.execute(
                'SELECT ATIPOETIQUETA, AESTADOP, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA = ?',
                [photo]
            );
            
            if (result.length > 0) {
                const status = result[0].AESTADOP;
                const reserved = result[0].RESERVEDUSU || 'VAZIO';
                const emoji = status === 'INGRESADO' ? '✅' : status === 'RESERVED' ? '🔒' : '❌';
                console.log(`  ${emoji} ${photo}: ${status} | RESERVEDUSU: ${reserved}`);
            } else {
                console.log(`  ❓ ${photo}: NÃO EXISTE NO CDE`);
            }
        }
        
        // Ver fotos INGRESADO disponíveis para teste
        console.log('\n📋 FOTOS INGRESADO DISPONÍVEIS (para teste):');
        const [available] = await connection.execute(`
            SELECT ATIPOETIQUETA 
            FROM tbinventario 
            WHERE AESTADOP = 'INGRESADO'
            AND ATIPOETIQUETA LIKE '2%'
            AND LENGTH(ATIPOETIQUETA) = 5
            LIMIT 5
        `);
        
        available.forEach(row => {
            console.log(`  ✅ ${row.ATIPOETIQUETA} - disponível para teste`);
        });
        
    } finally {
        await connection.end();
    }
}

checkPhotoStatus().catch(console.error);