// test-new-ai.js
require('dotenv').config();
const CDEQueries = require('./src/ai/CDEQueries');

async function testNewQueries() {
    console.log('🧪 TESTANDO NOVAS QUERIES DA IA\n');
    console.log('='.repeat(60));
    
    const cde = new CDEQueries();
    
    try {
        // Teste 1 - Top Products
        console.log('\n📊 1. TOP PRODUTOS:');
        const top = await cde.getTopSellingProducts();
        console.log(`   Encontrados: ${top.length} produtos`);
        if (top[0]) {
            console.log(`   #1: ${top[0].produto} - ${top[0].vendas_total} vendas`);
        }
        
        // Teste 2 - Performance Diária
        console.log('\n📅 2. PERFORMANCE DIÁRIA:');
        const daily = await cde.getDailySalesPerformance();
        console.log(`   Últimos ${daily.length} dias`);
        if (daily[0]) {
            console.log(`   Hoje: ${daily[0].itens_vendidos} itens em ${daily[0].pedidos} pedidos`);
        }
        
        // Teste 3 - Velocidade
        console.log('\n⚡ 3. VELOCIDADE DE VENDAS:');
        const velocity = await cde.getSalesVelocity();
        console.log(`   Analisando: ${velocity.length} produtos principais`);
        
        // Teste 4 - Canais
        console.log('\n🛒 4. VENDAS POR CANAL:');
        const channels = await cde.getSalesByChannel();
        console.log(`   Canais ativos: ${channels.length}`);
        if (channels[0]) {
            console.log(`   Líder: ${channels[0].canal} com ${channels[0].pedidos} pedidos`);
        }
        
        // Teste 5 - Produtos Novos
        console.log('\n🆕 5. PRODUTOS TRENDING:');
        const trending = await cde.getTrendingNewProducts();
        console.log(`   Produtos novos: ${trending.length}`);
        
        // Teste 6 - Fluxo
        console.log('\n🔄 6. FLUXO DE INVENTÁRIO:');
        const flow = await cde.getInventoryFlow();
        console.log(`   Últimos ${flow.length} dias analisados`);
        
        console.log('\n✅ TODAS AS QUERIES FUNCIONANDO!\n');
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
        console.log('\nVerifique se você adicionou as queries no CDEQueries.js');
    }
}

testNewQueries();