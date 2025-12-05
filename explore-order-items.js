// explore-order-items.js
require('dotenv').config();
const mysql = require('mysql2/promise');

async function exploreOrderItems() {
    console.log('📦 EXPLORANDO TABELA DE ITENS DOS PEDIDOS\n');
    console.log('='.repeat(60));
    
    try {
        const connection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });
        
        // 1. Estrutura
        console.log('📋 ESTRUTURA DA tbitem_pedido:\n');
        const [structure] = await connection.execute('DESCRIBE tbitem_pedido');
        structure.forEach(col => {
            console.log(`  ${col.Field}: ${col.Type}`);
        });
        
        // 2. Produtos mais vendidos
        console.log('\n🏆 TOP 10 PRODUTOS MAIS VENDIDOS:\n');
        const [topProducts] = await connection.execute(`
            SELECT 
                AQBITEM_ITEMPEDIDO,
                COUNT(*) as vendas_totais,
                COUNT(DISTINCT DATE(AFECHA_ITEMPEDIDO)) as dias_vendidos
            FROM tbitem_pedido
            WHERE AQBITEM_ITEMPEDIDO IS NOT NULL
            GROUP BY AQBITEM_ITEMPEDIDO
            ORDER BY vendas_totais DESC
            LIMIT 10
        `);
        topProducts.forEach((p, i) => {
            console.log(`  ${i+1}. ${p.AQBITEM_ITEMPEDIDO}: ${p.vendas_totais} vendas em ${p.dias_vendidos} dias`);
        });
        
        // 3. Vendas por período
        console.log('\n📅 VENDAS ÚLTIMOS 30 DIAS:\n');
        const [recent] = await connection.execute(`
            SELECT 
                DATE(AFECHA_ITEMPEDIDO) as data,
                COUNT(*) as itens_vendidos,
                COUNT(DISTINCT AQR_ITEMPEDIO) as pedidos_unicos
            FROM tbitem_pedido
            WHERE AFECHA_ITEMPEDIDO >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(AFECHA_ITEMPEDIDO)
            ORDER BY data DESC
            LIMIT 7
        `);
        recent.forEach(r => {
            console.log(`  ${r.data}: ${r.itens_vendidos} itens em ${r.pedidos_unicos} pedidos`);
        });
        
        // 4. Exemplo de item recente
        console.log('\n📄 EXEMPLO DE ITEM RECENTE:\n');
        const [example] = await connection.execute(`
            SELECT * FROM tbitem_pedido
            ORDER BY AFECHA_ITEMPEDIDO DESC
            LIMIT 1
        `);
        if (example[0]) {
            console.log('Campos e valores:');
            Object.keys(example[0]).forEach(key => {
                if (example[0][key]) {
                    console.log(`  ${key}: ${example[0][key]}`);
                }
            });
        }
        
        // 5. Relação com produtos
        console.log('\n🔗 PRODUTOS COM DESCRIÇÃO:\n');
        const [withDesc] = await connection.execute(`
            SELECT 
                ip.AQBITEM_ITEMPEDIDO,
                i.ADESCRIPTION,
                COUNT(*) as vendas
            FROM tbitem_pedido ip
            LEFT JOIN items i ON ip.AQBITEM_ITEMPEDIDO = i.AQBITEM
            WHERE i.ADESCRIPTION IS NOT NULL
            GROUP BY ip.AQBITEM_ITEMPEDIDO, i.ADESCRIPTION
            ORDER BY vendas DESC
            LIMIT 5
        `);
        withDesc.forEach(w => {
            console.log(`  ${w.AQBITEM_ITEMPEDIDO}: ${w.ADESCRIPTION}`);
            console.log(`    Vendas: ${w.vendas}\n`);
        });
        
        await connection.end();
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
    }
}

exploreOrderItems();