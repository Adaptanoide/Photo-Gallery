// scripts/check-cde-status.js
const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkCDEStatus(photoNumbers = []) {
    let connection = null;
    
    try {
        // Se não passar números, verificar os da última seleção
        if (photoNumbers.length === 0) {
            photoNumbers = ['01144']; // Foto do teste
        }
        
        console.log('🔍 Verificando status no CDE...\n');
        console.log('=' .repeat(60));
        
        connection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            port: process.env.CDE_PORT,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });
        
        for (const photoNumber of photoNumbers) {
            const [rows] = await connection.execute(
                `SELECT ATIPOETIQUETA, AESTADOP, RESERVEDUSU, AFECHA 
                 FROM tbinventario 
                 WHERE ATIPOETIQUETA = ?`,
                [photoNumber]
            );
            
            if (rows.length > 0) {
                const photo = rows[0];
                const status = photo.AESTADOP;
                
                // Emoji baseado no status
                let emoji = '❓';
                if (status === 'CONFIRMED') emoji = '✅';
                else if (status === 'PRE-SELECTED') emoji = '🟡';
                else if (status === 'INGRESADO') emoji = '🟢';
                else if (status === 'RETIRADO') emoji = '🔴';
                
                console.log(`${emoji} Foto ${photoNumber}:`);
                console.log(`   Status: ${status}`);
                console.log(`   Reservado por: ${photo.RESERVEDUSU || 'N/A'}`);
                console.log(`   Última atualização: ${photo.AFECHA}`);
                console.log('');
            } else {
                console.log(`❌ Foto ${photoNumber}: NÃO ENCONTRADA no CDE\n`);
            }
        }
        
        console.log('=' .repeat(60));
        
        // VERIFICAR TODAS AS CONFIRMED NO CDE
        const [allConfirmed] = await connection.execute(
            `SELECT COUNT(*) as total FROM tbinventario 
             WHERE AESTADOP = 'CONFIRMED'`
        );
        
        console.log(`📊 TOTAL DE FOTOS CONFIRMED NO CDE: ${allConfirmed[0].total}`);
        
        // Listar algumas CONFIRMED
        const [confirmedSample] = await connection.execute(
            `SELECT ATIPOETIQUETA, RESERVEDUSU, AFECHA 
             FROM tbinventario 
             WHERE AESTADOP = 'CONFIRMED'
             ORDER BY AFECHA DESC
             LIMIT 5`
        );
        
        if (confirmedSample.length > 0) {
            console.log('\n📋 ÚLTIMAS CONFIRMED:');
            confirmedSample.forEach(photo => {
                console.log(`   ${photo.ATIPOETIQUETA} - ${photo.RESERVEDUSU} - ${photo.AFECHA}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        if (connection) await connection.end();
        process.exit(0);
    }
}

// Executar com argumentos da linha de comando ou padrão
const args = process.argv.slice(2);
checkCDEStatus(args.length > 0 ? args : ['01144']);