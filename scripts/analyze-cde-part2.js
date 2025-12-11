const mysql = require('mysql2/promise');
require('dotenv').config();

async function analyzeTransitAndMore() {
    const pool = mysql.createPool({
        host: process.env.CDE_HOST,
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE,
        port: process.env.CDE_PORT || 3306
    });

    console.log('='.repeat(70));
    console.log('📦 ANÁLISE DE PRODUTOS EM TRÂNSITO (tbetiqueta)');
    console.log('='.repeat(70));

    // Analyze tbetiqueta status
    const [etiquetaStatus] = await pool.query(`
        SELECT AESTADOP, COUNT(*) as qtd
        FROM tbetiqueta
        GROUP BY AESTADOP
        ORDER BY qtd DESC
    `);

    console.log('\n📊 STATUS DOS PRODUTOS EM TBETIQUETA:');
    etiquetaStatus.forEach(e => {
        console.log('   ' + (e.AESTADOP || 'NULL') + ': ' + e.qtd + ' itens');
    });

    // Transit products by origin
    const [transitByOrigin] = await pool.query(`
        SELECT AORIGEN, AESTADOP, COUNT(*) as qtd
        FROM tbetiqueta
        WHERE AESTADOP IN ('PRE-TRANSITO', 'TRANSITO', 'WAREHOUSE')
        GROUP BY AORIGEN, AESTADOP
        ORDER BY AORIGEN, qtd DESC
    `);

    console.log('\n🚢 PRODUTOS EM TRÂNSITO POR ORIGEM:');
    transitByOrigin.forEach(t => {
        console.log('   ' + (t.AORIGEN || 'N/A') + ' - ' + t.AESTADOP + ': ' + t.qtd + ' itens');
    });

    // Recent arrivals (products that moved from transit to ingresado)
    const [recentTransit] = await pool.query(`
        SELECT AQBITEM, COUNT(*) as qtd, MAX(AFECHA) as ultima_data
        FROM tbetiqueta
        WHERE AESTADOP IN ('PRE-TRANSITO', 'TRANSITO', 'WAREHOUSE')
        AND AQBITEM IS NOT NULL
        GROUP BY AQBITEM
        ORDER BY qtd DESC
        LIMIT 20
    `);

    console.log('\n📦 TOP 20 PRODUTOS EM TRÂNSITO:');
    for (const t of recentTransit) {
        // Get description
        const [desc] = await pool.query('SELECT ADESCRIPTION FROM items WHERE AQBITEM = ?', [t.AQBITEM]);
        const description = desc[0] ? desc[0].ADESCRIPTION : 'Sem descrição';
        console.log('   [' + t.AQBITEM + '] ' + t.qtd + ' un - ' + description.substring(0, 40));
    }

    console.log('\n' + '='.repeat(70));
    console.log('🔍 ANÁLISE DE TABELAS ÚTEIS vs NÃO USADAS');
    console.log('='.repeat(70));

    // Check tables that might have useful data we're not using
    const tablesToCheck = [
        { name: 'tbshipstationorder', desc: 'Pedidos ShipStation (45k registros)' },
        { name: 'tbetsystatement', desc: 'Extratos Etsy (22k registros)' },
        { name: 'tbcontrolamazon', desc: 'Controle Amazon (12k registros)' },
        { name: 'tbdirclient', desc: 'Diretório de Clientes (1.6k registros)' },
        { name: 'tbpases', desc: 'Passes/Transferências (2.8k registros)' },
        { name: 'tbfbareturndata', desc: 'Retornos FBA (2.7k registros)' }
    ];

    for (const table of tablesToCheck) {
        console.log('\n📋 ' + table.name.toUpperCase() + ' - ' + table.desc);

        const [sample] = await pool.query('SELECT * FROM ' + table.name + ' LIMIT 2');
        if (sample.length > 0) {
            console.log('   Campos: ' + Object.keys(sample[0]).join(', '));
            console.log('   Exemplo:');
            const firstRow = sample[0];
            Object.entries(firstRow).slice(0, 5).forEach(([key, value]) => {
                const val = value ? String(value).substring(0, 50) : 'NULL';
                console.log('      ' + key + ': ' + val);
            });
        }
    }

    // Check tbshipstationorder for sales data
    console.log('\n' + '='.repeat(70));
    console.log('💰 ANÁLISE DE DADOS DE VENDAS (tbshipstationorder)');
    console.log('='.repeat(70));

    const [shipstationSample] = await pool.query(`
        SELECT AITEM_NAME, AITEM_SKU, AITEM_QTY, AITEM_PRICE, AORDER_DATE, AMARKETPLACE
        FROM tbshipstationorder
        WHERE AITEM_PRICE IS NOT NULL AND AITEM_PRICE != ''
        ORDER BY AORDER_DATE DESC
        LIMIT 10
    `);

    console.log('\n📦 ÚLTIMAS 10 VENDAS COM PREÇO:');
    shipstationSample.forEach(s => {
        console.log('   [' + (s.AITEM_SKU || 'N/A') + '] ' +
            (s.AITEM_NAME || '').substring(0, 35) +
            ' | Qty: ' + s.AITEM_QTY +
            ' | $' + s.AITEM_PRICE +
            ' | ' + s.AMARKETPLACE);
    });

    // Sales by marketplace in shipstation
    const [salesByMp] = await pool.query(`
        SELECT AMARKETPLACE, COUNT(*) as pedidos, SUM(CAST(AITEM_QTY AS UNSIGNED)) as itens
        FROM tbshipstationorder
        WHERE AMARKETPLACE IS NOT NULL
        GROUP BY AMARKETPLACE
        ORDER BY pedidos DESC
    `);

    console.log('\n📊 VENDAS POR MARKETPLACE (tbshipstationorder):');
    salesByMp.forEach(m => {
        console.log('   ' + (m.AMARKETPLACE || 'N/A') + ': ' + m.pedidos + ' pedidos, ' + (m.itens || 0) + ' itens');
    });

    await pool.end();
}

analyzeTransitAndMore().catch(console.error);
