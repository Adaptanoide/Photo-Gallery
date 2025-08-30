// scripts/cde-01-analyze-structure.js
// Script para descobrir onde está o campo NoFoto no banco CDE

const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuração da conexão CDE
const cdeConfig = {
    host: '216.246.112.6',
    port: 3306,
    user: 'tzwgctib_photos',
    password: 'T14g0@photos',
    database: 'tzwgctib_inventario',
    connectTimeout: 30000
};

async function analyzeDatabase() {
    let connection;
    
    try {
        console.log('🔗 Conectando ao CDE...');
        connection = await mysql.createConnection(cdeConfig);
        console.log('✅ Conectado ao CDE!\n');

        // 1. Listar todas as tabelas
        console.log('📋 TABELAS DISPONÍVEIS NO BANCO:');
        console.log('================================');
        const [tables] = await connection.execute(
            'SHOW TABLES'
        );
        
        for (const table of tables) {
            const tableName = Object.values(table)[0];
            console.log(`  - ${tableName}`);
        }

        // 2. Analisar estrutura da tbinventario
        console.log('\n📊 ESTRUTURA DA TABELA tbinventario:');
        console.log('=====================================');
        const [inventarioCols] = await connection.execute(
            'DESCRIBE tbinventario'
        );
        
        console.log('\nColunas encontradas:');
        for (const col of inventarioCols) {
            console.log(`  ${col.Field} (${col.Type}) - ${col.Key ? 'KEY' : ''}`);
            
            // Procurar por campos que possam ser NoFoto
            if (col.Field.toLowerCase().includes('foto') || 
                col.Field.toLowerCase().includes('photo') ||
                col.Field.toLowerCase().includes('imagen')) {
                console.log(`    ⚠️ POSSÍVEL CAMPO DE FOTO!`);
            }
        }

        // 3. Buscar amostra de dados para entender melhor
        console.log('\n📌 AMOSTRA DE DADOS (5 registros INGRESADO):');
        console.log('============================================');
        const [sampleData] = await connection.execute(
            'SELECT * FROM tbinventario WHERE AESTADOP = "INGRESADO" LIMIT 5'
        );
        
        if (sampleData.length > 0) {
            // Mostrar primeiro registro completo
            console.log('\nPrimeiro registro completo:');
            console.log(JSON.stringify(sampleData[0], null, 2));
            
            // Procurar campos que pareçam números de foto
            console.log('\n🔍 Procurando campos com números (possível NoFoto):');
            for (const [key, value] of Object.entries(sampleData[0])) {
                if (value && /^\d+$/.test(value.toString())) {
                    console.log(`  ${key}: ${value}`);
                }
            }
        }

        // 4. Procurar em todas as colunas por algo que pareça número de foto
        console.log('\n🔎 PROCURANDO POR CAMPOS COM PADRÃO DE NÚMERO DE FOTO:');
        console.log('========================================================');
        
        // Buscar registros com diferentes comprimentos de números
        for (const col of inventarioCols) {
            const fieldName = col.Field;
            try {
                const [testData] = await connection.execute(
                    `SELECT DISTINCT ${fieldName} FROM tbinventario 
                     WHERE ${fieldName} REGEXP '^[0-9]+$' 
                     AND LENGTH(${fieldName}) BETWEEN 2 AND 6
                     LIMIT 10`
                );
                
                if (testData.length > 0) {
                    console.log(`\n  Campo ${fieldName} tem números de 2-6 dígitos:`);
                    testData.forEach(row => {
                        console.log(`    - ${row[fieldName]}`);
                    });
                }
            } catch (err) {
                // Ignorar erros de campos não numéricos
            }
        }

        // 5. Verificar se existe alguma outra tabela com "foto" no nome
        console.log('\n🔍 PROCURANDO TABELAS COM "FOTO" NO NOME:');
        console.log('=========================================');
        const [photoTables] = await connection.execute(
            `SELECT TABLE_NAME FROM information_schema.TABLES 
             WHERE TABLE_SCHEMA = 'tzwgctib_inventario' 
             AND (TABLE_NAME LIKE '%foto%' OR TABLE_NAME LIKE '%photo%')`
        );
        
        if (photoTables.length > 0) {
            for (const table of photoTables) {
                console.log(`\n  Tabela encontrada: ${table.TABLE_NAME}`);
                
                // Mostrar estrutura desta tabela
                const [cols] = await connection.execute(
                    `DESCRIBE ${table.TABLE_NAME}`
                );
                console.log('  Colunas:');
                for (const col of cols) {
                    console.log(`    - ${col.Field} (${col.Type})`);
                }
            }
        } else {
            console.log('  Nenhuma tabela com "foto" no nome encontrada.');
        }

        // 6. Verificar tbetiqueta também
        console.log('\n📊 ESTRUTURA DA TABELA tbetiqueta:');
        console.log('===================================');
        const [etiquetaCols] = await connection.execute(
            'DESCRIBE tbetiqueta'
        );
        
        console.log('Colunas encontradas:');
        for (const col of etiquetaCols) {
            console.log(`  ${col.Field} (${col.Type})`);
            if (col.Field.toLowerCase().includes('foto') || 
                col.Field.toLowerCase().includes('num')) {
                console.log(`    ⚠️ POSSÍVEL CAMPO!`);
            }
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n✅ Conexão fechada.');
        }
    }
}

// Executar análise
analyzeDatabase();