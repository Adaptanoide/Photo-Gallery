// test-queries-cde.js - VERSÃO CORRIGIDA
require('dotenv').config();
const mysql = require('mysql2/promise');

async function testQueries() {
    console.log('🧪 TESTANDO QUERIES REAIS DO CDE\n');
    
    try {
        const connection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });
        
        // QUERY 1: Inventário atual disponível
        console.log('📦 INVENTÁRIO DISPONÍVEL POR CATEGORIA:');
        const [inventory] = await connection.execute(`
            SELECT AQBITEM as categoria,
                   COUNT(*) as quantidade
            FROM tbinventario 
            WHERE AESTADOP = 'INGRESADO'
            AND AQBITEM IS NOT NULL
            GROUP BY AQBITEM
            ORDER BY quantidade DESC
            LIMIT 10
        `);
        inventory.forEach(item => {
            console.log(`  ${item.categoria}: ${item.quantidade} unidades`);
        });
        
        // QUERY 2: Produtos vendidos últimos 30 dias
        console.log('\n💰 VENDAS ÚLTIMOS 30 DIAS:');
        const [vendas] = await connection.execute(`
            SELECT COUNT(*) as total_vendido,
                   DATE(AFECHA) as data
            FROM tbinventario 
            WHERE AESTADOP = 'RETIRADO'
            AND AFECHA >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(AFECHA)
            ORDER BY data DESC
            LIMIT 5
        `);
        console.log(`  Total geral: ${vendas.reduce((sum, v) => sum + v.total_vendido, 0)} produtos`);
        vendas.forEach(v => {
            console.log(`  ${v.data?.toLocaleDateString()}: ${v.total_vendido} vendidos`);
        });
        
        // QUERY 3: Produtos em reserva/carrinho
        console.log('\n🛒 PRODUTOS EM CARRINHO (PRE-SELECTED):');
        const [reservados] = await connection.execute(`
            SELECT RESERVEDUSU as cliente, 
                   COUNT(*) as total,
                   GROUP_CONCAT(ATIPOETIQUETA SEPARATOR ', ') as fotos
            FROM tbinventario 
            WHERE AESTADOP = 'PRE-SELECTED'
            GROUP BY RESERVEDUSU
        `);
        if (reservados.length > 0) {
            reservados.forEach(r => {
                console.log(`  Cliente ${r.cliente}: ${r.total} produtos`);
                console.log(`    Fotos: ${r.fotos}`);
            });
        } else {
            console.log('  Nenhum produto em carrinho no momento');
        }
        
        // QUERY 4: Produtos em trânsito
        console.log('\n🚚 PRODUTOS EM TRÂNSITO (tbetiqueta):');
        const [transito] = await connection.execute(`
            SELECT AESTADOP as estado,
                   COUNT(*) as total
            FROM tbetiqueta 
            WHERE AESTADOP IN ('PRE-TRANSITO', 'TRANSITO', 'WAREHOUSE')
            GROUP BY AESTADOP
        `);
        transito.forEach(t => {
            console.log(`  ${t.estado}: ${t.total} produtos`);
        });
        
        // QUERY 5: Velocidade de venda (últimos produtos vendidos)
        console.log('\n⚡ VELOCIDADE DE VENDA (últimos 10 vendidos):');
        const [velocidade] = await connection.execute(`
            SELECT ATIPOETIQUETA as foto,
                   AQBITEM as categoria,
                   AFECHA as data_venda,
                   DATEDIFF(AFECHA, (
                       SELECT MIN(AFECHA) FROM tbinventario t2 
                       WHERE t2.ATIPOETIQUETA = tbinventario.ATIPOETIQUETA
                   )) as dias_para_vender
            FROM tbinventario 
            WHERE AESTADOP = 'RETIRADO'
            AND AFECHA IS NOT NULL
            ORDER BY AFECHA DESC
            LIMIT 10
        `);
        velocidade.forEach(v => {
            console.log(`  Foto ${v.foto} (${v.categoria}): vendido em ${v.dias_para_vender || '?'} dias`);
        });
        
        // QUERY 6: Produtos mais antigos em estoque
        console.log('\n📅 PRODUTOS PARADOS HÁ MAIS DE 60 DIAS:');
        const [parados] = await connection.execute(`
            SELECT AQBITEM as categoria,
                   COUNT(*) as quantidade,
                   AVG(DATEDIFF(NOW(), AFECHA)) as media_dias
            FROM tbinventario 
            WHERE AESTADOP = 'INGRESADO'
            AND AFECHA < DATE_SUB(NOW(), INTERVAL 60 DAY)
            AND AQBITEM IS NOT NULL
            GROUP BY AQBITEM
            HAVING quantidade > 5
            ORDER BY media_dias DESC
            LIMIT 5
        `);
        parados.forEach(p => {
            console.log(`  ${p.categoria}: ${p.quantidade} produtos (média ${Math.round(p.media_dias)} dias)`);
        });
        
        await connection.end();
        console.log('\n✅ Análise de queries completa!');
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
    }
}

testQueries();