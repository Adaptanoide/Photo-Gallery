// analyze-cde.js
require('dotenv').config();
const mysql = require('mysql2/promise');

async function analyzeCDE() {
    console.log('🔍 ANALISANDO CDE - SUNSHINE COWHIDES\n');
    console.log('='.repeat(50));
    
    try {
        // Conectar ao CDE
        const connection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });
        
        console.log('✅ Conectado ao CDE!\n');
        
        // 1. LISTAR TODAS AS TABELAS
        console.log('📋 TABELAS DISPONÍVEIS:');
        console.log('-'.repeat(30));
        const [tables] = await connection.execute('SHOW TABLES');
        tables.forEach(table => {
            const tableName = Object.values(table)[0];
            console.log(`  - ${tableName}`);
        });
        
        // 2. ANALISAR tbinventario
        console.log('\n📦 ANÁLISE DA tbinventario:');
        console.log('-'.repeat(30));
        
        // Estrutura da tabela
        const [columns] = await connection.execute('DESCRIBE tbinventario');
        console.log('Colunas:');
        columns.forEach(col => {
            console.log(`  - ${col.Field} (${col.Type})`);
        });
        
        // Contar registros por estado
        console.log('\n📊 CONTAGEM POR ESTADO:');
        const [estados] = await connection.execute(`
            SELECT AESTADOP, COUNT(*) as total 
            FROM tbinventario 
            GROUP BY AESTADOP
        `);
        estados.forEach(e => {
            console.log(`  ${e.AESTADOP}: ${e.total} produtos`);
        });
        
        // 3. ANALISAR tbetiqueta
        console.log('\n🏷️ ANÁLISE DA tbetiqueta:');
        console.log('-'.repeat(30));
        
        // Verificar se existe
        const [checkEtiqueta] = await connection.execute(`
            SELECT COUNT(*) as total FROM information_schema.tables 
            WHERE table_schema = ? AND table_name = 'tbetiqueta'
        `, [process.env.CDE_DATABASE]);
        
        if (checkEtiqueta[0].total > 0) {
            const [columnsEtiqueta] = await connection.execute('DESCRIBE tbetiqueta');
            console.log('Colunas:');
            columnsEtiqueta.forEach(col => {
                console.log(`  - ${col.Field} (${col.Type})`);
            });
            
            // Contar por estado
            const [estadosEtiqueta] = await connection.execute(`
                SELECT AESTADOP, COUNT(*) as total 
                FROM tbetiqueta 
                GROUP BY AESTADOP
            `);
            console.log('\nProdutos em trânsito:');
            estadosEtiqueta.forEach(e => {
                console.log(`  ${e.AESTADOP}: ${e.total} produtos`);
            });
        } else {
            console.log('  ⚠️ Tabela não encontrada');
        }
        
        // 4. ANÁLISE DE CATEGORIAS
        console.log('\n🏷️ CATEGORIAS (AQBITEM):');
        console.log('-'.repeat(30));
        const [categorias] = await connection.execute(`
            SELECT AQBITEM, COUNT(*) as total 
            FROM tbinventario 
            WHERE AQBITEM IS NOT NULL 
            GROUP BY AQBITEM 
            ORDER BY total DESC
            LIMIT 10
        `);
        categorias.forEach(c => {
            console.log(`  ${c.AQBITEM || 'SEM CATEGORIA'}: ${c.total} produtos`);
        });
        
        // 5. PRODUTOS MAIS ANTIGOS
        console.log('\n⏰ PRODUTOS MAIS ANTIGOS EM ESTOQUE:');
        console.log('-'.repeat(30));
        const [antigos] = await connection.execute(`
            SELECT ATIPOETIQUETA, AESTADOP, AFECHA,
                   DATEDIFF(NOW(), AFECHA) as dias_em_estoque
            FROM tbinventario 
            WHERE AESTADOP = 'INGRESADO'
            ORDER BY AFECHA ASC
            LIMIT 5
        `);
        antigos.forEach(p => {
            console.log(`  Foto ${p.ATIPOETIQUETA}: ${p.dias_em_estoque} dias`);
        });
        
        await connection.end();
        console.log('\n✅ Análise completa!');
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
        console.error('Detalhes:', error);
    }
}

analyzeCDE();