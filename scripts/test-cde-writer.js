// IMPORTANTE: Carregar .env PRIMEIRO!
require('dotenv').config();

// Só depois importar o CDEWriter
const CDEWriter = require('../src/services/CDEWriter');

async function testCDEWriter() {
    console.log('🧪 TESTANDO ESCRITA NO CDE\n');
    
    // Verificar se as variáveis estão carregadas
    console.log('Configuração:');
    console.log(`  Host: ${process.env.CDE_HOST}`);
    console.log(`  Port: ${process.env.CDE_PORT}`);
    console.log(`  User: ${process.env.CDE_USER}`);
    console.log(`  Database: ${process.env.CDE_DATABASE}\n`);
    
    // 1. Testar conexão
    const connected = await CDEWriter.testConnection();
    if (!connected) {
        console.log('Não foi possível conectar ao CDE');
        console.log('Possíveis razões:');
        console.log('  1. Ainda não tem permissão WRITE (esperado)');
        console.log('  2. CDE está offline no fim de semana');
        console.log('  3. Firewall bloqueando conexão');
        return;
    }
    
    // 2. Testar reserva (use uma foto de teste)
    console.log('\nTestando reserva de foto...');
    await CDEWriter.markAsReserved('99999', 'TEST_IDH', 'TEST', 'test_session');
    
    // 3. Testar liberação
    console.log('\nTestando liberação de foto...');
    await CDEWriter.markAsAvailable('99999', 'TEST_IDH');
    
    console.log('\n✅ Teste concluído!');
}

testCDEWriter().catch(console.error);