/**
 * SCRIPT DE DIAGNÓSTICO - VERIFICAR RESERVEDUSU EM FOTOS RETIRADO
 * 
 * Este script APENAS LÊ dados do CDE, não modifica nada.
 * Objetivo: Descobrir se fotos com estado RETIRADO mantêm o campo RESERVEDUSU
 * 
 * Executar: node diagnostico-retirado-reservedusu.js
 */

const mysql = require('mysql2/promise');

// Configurações do CDE (do .env)
const CDE_CONFIG = {
    host: '216.246.112.6',
    port: 3306,
    user: 'tzwgctib_photos',
    password: 'T14g0@photos',
    database: 'tzwgctib_inventario'
};

async function diagnostico() {
    let connection = null;
    
    try {
        console.log('\n' + '='.repeat(70));
        console.log('🔍 DIAGNÓSTICO: RESERVEDUSU EM FOTOS RETIRADO');
        console.log('='.repeat(70));
        console.log(`📅 Data/Hora: ${new Date().toLocaleString()}`);
        console.log('');

        // Conectar ao CDE
        console.log('🔌 Conectando ao CDE (MySQL)...');
        connection = await mysql.createConnection(CDE_CONFIG);
        console.log('✅ Conectado com sucesso!\n');

        // ============================================
        // PARTE 1: Estrutura da tabela
        // ============================================
        console.log('📋 PARTE 1: Verificando estrutura da tabela tbinventario...\n');
        
        const [columns] = await connection.execute(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'tzwgctib_inventario' 
            AND TABLE_NAME = 'tbinventario'
            AND COLUMN_NAME IN ('ATIPOETIQUETA', 'AESTADOP', 'RESERVEDUSU', 'AFECHA')
            ORDER BY ORDINAL_POSITION
        `);
        
        console.log('Colunas relevantes:');
        columns.forEach(col => {
            console.log(`   - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (nullable: ${col.IS_NULLABLE})`);
        });
        console.log('');

        // ============================================
        // PARTE 2: Contar fotos por estado
        // ============================================
        console.log('📊 PARTE 2: Contagem de fotos por estado...\n');
        
        const [estadoCount] = await connection.execute(`
            SELECT AESTADOP, COUNT(*) as total
            FROM tbinventario
            GROUP BY AESTADOP
            ORDER BY total DESC
        `);
        
        console.log('Estados encontrados:');
        estadoCount.forEach(row => {
            console.log(`   - ${row.AESTADOP || '(vazio)'}: ${row.total} fotos`);
        });
        console.log('');

        // ============================================
        // PARTE 3: Fotos RETIRADO - Análise do RESERVEDUSU
        // ============================================
        console.log('🎯 PARTE 3: Análise de fotos RETIRADO...\n');
        
        // Contar RETIRADO com e sem RESERVEDUSU
        const [retiradoAnalise] = await connection.execute(`
            SELECT 
                CASE 
                    WHEN RESERVEDUSU IS NULL OR RESERVEDUSU = '' THEN 'SEM_RESERVEDUSU'
                    ELSE 'COM_RESERVEDUSU'
                END as categoria,
                COUNT(*) as total
            FROM tbinventario
            WHERE AESTADOP = 'RETIRADO'
            GROUP BY categoria
        `);
        
        console.log('Fotos RETIRADO:');
        let totalRetirado = 0;
        let comReservedusu = 0;
        let semReservedusu = 0;
        
        retiradoAnalise.forEach(row => {
            totalRetirado += row.total;
            if (row.categoria === 'COM_RESERVEDUSU') {
                comReservedusu = row.total;
                console.log(`   ✅ COM RESERVEDUSU: ${row.total}`);
            } else {
                semReservedusu = row.total;
                console.log(`   ❌ SEM RESERVEDUSU: ${row.total}`);
            }
        });
        
        console.log(`   📈 TOTAL RETIRADO: ${totalRetirado}`);
        if (totalRetirado > 0) {
            const percentCom = ((comReservedusu / totalRetirado) * 100).toFixed(1);
            const percentSem = ((semReservedusu / totalRetirado) * 100).toFixed(1);
            console.log(`   📊 ${percentCom}% com RESERVEDUSU, ${percentSem}% sem`);
        }
        console.log('');

        // ============================================
        // PARTE 4: Exemplos de RETIRADO COM RESERVEDUSU
        // ============================================
        console.log('📝 PARTE 4: Exemplos de RETIRADO COM RESERVEDUSU (últimos 10)...\n');
        
        const [exemplosCom] = await connection.execute(`
            SELECT ATIPOETIQUETA, AESTADOP, RESERVEDUSU, AFECHA
            FROM tbinventario
            WHERE AESTADOP = 'RETIRADO'
            AND RESERVEDUSU IS NOT NULL 
            AND RESERVEDUSU != ''
            ORDER BY AFECHA DESC
            LIMIT 10
        `);
        
        if (exemplosCom.length > 0) {
            console.log('Foto #       | Estado    | RESERVEDUSU                    | Data');
            console.log('-'.repeat(75));
            exemplosCom.forEach(row => {
                const foto = String(row.ATIPOETIQUETA).padEnd(12);
                const estado = String(row.AESTADOP).padEnd(9);
                const reservedusu = String(row.RESERVEDUSU || '').substring(0, 30).padEnd(30);
                const data = row.AFECHA ? new Date(row.AFECHA).toLocaleDateString() : '-';
                console.log(`${foto} | ${estado} | ${reservedusu} | ${data}`);
            });
        } else {
            console.log('   ⚠️ Nenhuma foto RETIRADO com RESERVEDUSU encontrada');
        }
        console.log('');

        // ============================================
        // PARTE 5: Exemplos de RETIRADO SEM RESERVEDUSU
        // ============================================
        console.log('📝 PARTE 5: Exemplos de RETIRADO SEM RESERVEDUSU (últimos 10)...\n');
        
        const [exemplosSem] = await connection.execute(`
            SELECT ATIPOETIQUETA, AESTADOP, RESERVEDUSU, AFECHA
            FROM tbinventario
            WHERE AESTADOP = 'RETIRADO'
            AND (RESERVEDUSU IS NULL OR RESERVEDUSU = '')
            ORDER BY AFECHA DESC
            LIMIT 10
        `);
        
        if (exemplosSem.length > 0) {
            console.log('Foto #       | Estado    | RESERVEDUSU | Data');
            console.log('-'.repeat(55));
            exemplosSem.forEach(row => {
                const foto = String(row.ATIPOETIQUETA).padEnd(12);
                const estado = String(row.AESTADOP).padEnd(9);
                const reservedusu = row.RESERVEDUSU || '(vazio)';
                const data = row.AFECHA ? new Date(row.AFECHA).toLocaleDateString() : '-';
                console.log(`${foto} | ${estado} | ${reservedusu.padEnd(11)} | ${data}`);
            });
        } else {
            console.log('   ✅ Todas as fotos RETIRADO têm RESERVEDUSU!');
        }
        console.log('');

        // ============================================
        // PARTE 6: Comparação com outros estados
        // ============================================
        console.log('📊 PARTE 6: Comparação - RESERVEDUSU em outros estados...\n');
        
        const [comparacao] = await connection.execute(`
            SELECT 
                AESTADOP,
                COUNT(*) as total,
                SUM(CASE WHEN RESERVEDUSU IS NOT NULL AND RESERVEDUSU != '' THEN 1 ELSE 0 END) as com_reservedusu,
                SUM(CASE WHEN RESERVEDUSU IS NULL OR RESERVEDUSU = '' THEN 1 ELSE 0 END) as sem_reservedusu
            FROM tbinventario
            WHERE AESTADOP IN ('INGRESADO', 'PRE-SELECTED', 'CONFIRMED', 'RESERVED', 'RETIRADO', 'STANDBY')
            GROUP BY AESTADOP
            ORDER BY 
                CASE AESTADOP 
                    WHEN 'INGRESADO' THEN 1
                    WHEN 'PRE-SELECTED' THEN 2
                    WHEN 'CONFIRMED' THEN 3
                    WHEN 'RESERVED' THEN 4
                    WHEN 'RETIRADO' THEN 5
                    WHEN 'STANDBY' THEN 6
                    ELSE 7
                END
        `);
        
        console.log('Estado        | Total    | Com RESERVEDUSU | Sem RESERVEDUSU | % Com');
        console.log('-'.repeat(75));
        comparacao.forEach(row => {
            const estado = String(row.AESTADOP).padEnd(13);
            const total = String(row.total).padStart(8);
            const com = String(row.com_reservedusu).padStart(15);
            const sem = String(row.sem_reservedusu).padStart(15);
            const percent = row.total > 0 ? ((row.com_reservedusu / row.total) * 100).toFixed(1) : '0';
            console.log(`${estado} | ${total} | ${com} | ${sem} | ${percent}%`);
        });
        console.log('');

        // ============================================
        // CONCLUSÃO
        // ============================================
        console.log('='.repeat(70));
        console.log('📋 CONCLUSÃO');
        console.log('='.repeat(70));
        
        if (comReservedusu > 0 && semReservedusu > 0) {
            console.log(`
🔍 RESULTADO: MISTO
   - Algumas fotos RETIRADO mantêm o RESERVEDUSU (${comReservedusu})
   - Algumas fotos RETIRADO NÃO têm RESERVEDUSU (${semReservedusu})
   
💡 INTERPRETAÇÃO:
   - Fotos COM RESERVEDUSU: Provavelmente passaram pela galeria
   - Fotos SEM RESERVEDUSU: Provavelmente saíram por outro processo
   
🎯 RECOMENDAÇÃO:
   - Podemos usar RESERVEDUSU para identificar fotos da galeria
   - Fotos RETIRADO sem RESERVEDUSU devem ser tratadas como "vendidas por fora"
`);
        } else if (comReservedusu > 0) {
            console.log(`
✅ RESULTADO: TODAS as fotos RETIRADO mantêm RESERVEDUSU!
   - Podemos usar RESERVEDUSU com segurança para identificar o cliente
`);
        } else {
            console.log(`
⚠️ RESULTADO: NENHUMA foto RETIRADO tem RESERVEDUSU
   - O campo é limpo quando vai para RETIRADO
   - Precisamos de outra estratégia
`);
        }

        console.log('='.repeat(70) + '\n');

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Conexão fechada.\n');
        }
    }
}

// Executar
diagnostico();