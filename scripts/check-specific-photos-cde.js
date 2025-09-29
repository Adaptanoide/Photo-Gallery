const mysql = require('mysql2/promise');
require('dotenv').config();

// Fotos para verificar
const PHOTOS_TO_CHECK = ['13585', '16219', '11720', '24462'];

async function checkPhotosInCDE() {
    let connection;
    
    try {
        // Conectar ao CDE
        connection = await mysql.createConnection({
            host: process.env.CDE_HOST || '216.246.112.6',
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE || 'tzwgctib_inventario'
        });

        console.log('✅ Conectado ao CDE\n');
        console.log('=' .repeat(60));
        console.log('VERIFICANDO STATUS DAS FOTOS NO CDE');
        console.log('=' .repeat(60));

        for (const photoNumber of PHOTOS_TO_CHECK) {
            const [rows] = await connection.execute(
                `SELECT 
                    ATIPOETIQUETA as photo_number,
                    AESTADOP as status,
                    RESERVEDUSU as reserved_by,
                    AFECHA as last_update,
                    AQBITEM as qb_code
                FROM tbinventario 
                WHERE ATIPOETIQUETA = ?`,
                [photoNumber]
            );

            console.log(`\n📸 FOTO: ${photoNumber}`);
            console.log('-'.repeat(40));
            
            if (rows.length > 0) {
                const photo = rows[0];
                console.log(`   Status CDE: ${photo.status || 'SEM STATUS'}`);
                console.log(`   Reservado por: ${photo.reserved_by || 'NINGUÉM'}`);
                console.log(`   Última atualização: ${photo.last_update || 'N/A'}`);
                console.log(`   QB Code: ${photo.qb_code || 'N/A'}`);
                
                // Interpretar status
                if (photo.status === 'RETIRADO') {
                    console.log(`   ⛔ VENDIDA - Não pode estar em seleção pendente!`);
                } else if (photo.status === 'CONFIRMED') {
                    console.log(`   ⚠️ CONFIRMADA - Em outra seleção!`);
                } else if (photo.status === 'PRE-SELECTED') {
                    console.log(`   🔶 PRÉ-SELECIONADA - Em carrinho`);
                } else if (photo.status === 'INGRESADO') {
                    console.log(`   ✅ DISPONÍVEL`);
                }
            } else {
                console.log(`   ❌ NÃO ENCONTRADA NO CDE`);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('RECOMENDAÇÕES:');
        console.log('1. Se alguma foto está RETIRADO ou CONFIRMED');
        console.log('   -> Remover da seleção pendente');
        console.log('2. Se está PRE-SELECTED por outro carrinho');
        console.log('   -> Verificar se é o carrinho correto');
        console.log('3. Se está INGRESADO');
        console.log('   -> Pode manter na seleção se necessário');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

// Executar
checkPhotosInCDE();