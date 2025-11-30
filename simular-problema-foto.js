/**
 * SCRIPT DE SIMULAÇÃO - MUDAR ESTADO DE FOTO NO CDE
 * 
 * ⚠️ ATENÇÃO: Este script MODIFICA dados no CDE!
 * Usar apenas para testes e SEMPRE reverter depois.
 * 
 * Uso:
 *   node simular-problema-foto.js simular    → Muda foto para INGRESADO
 *   node simular-problema-foto.js reverter   → Volta foto para CONFIRMED
 *   node simular-problema-foto.js status     → Mostra estado atual
 */

const mysql = require('mysql2/promise');

// Configurações do CDE
const CDE_CONFIG = {
    host: '216.246.112.6',
    port: 3306,
    user: 'tzwgctib_photos',
    password: 'T14g0@photos',
    database: 'tzwgctib_inventario'
};

// ============================================
// CONFIGURAÇÃO DA FOTO PARA TESTE
// ============================================
// Usando a foto 26696 da seleção da GENA
const FOTO_TESTE = {
    numero: '26696',
    estadoOriginal: 'CONFIRMED',
    reservedusuOriginal: 'GENA-5188(karen)',
    clientCode: '5188'
};

async function mostrarStatus(connection) {
    console.log('\n📊 ESTADO ATUAL DA FOTO NO CDE:');
    console.log('-'.repeat(50));
    
    const [result] = await connection.execute(
        'SELECT ATIPOETIQUETA, AESTADOP, RESERVEDUSU, AFECHA FROM tbinventario WHERE ATIPOETIQUETA = ?',
        [FOTO_TESTE.numero]
    );
    
    if (result.length === 0) {
        console.log(`❌ Foto ${FOTO_TESTE.numero} não encontrada no CDE!`);
        return null;
    }
    
    const foto = result[0];
    console.log(`   Foto #:      ${foto.ATIPOETIQUETA}`);
    console.log(`   Estado:      ${foto.AESTADOP}`);
    console.log(`   RESERVEDUSU: ${foto.RESERVEDUSU || '(vazio)'}`);
    console.log(`   Data:        ${foto.AFECHA ? new Date(foto.AFECHA).toLocaleDateString() : '-'}`);
    console.log('-'.repeat(50));
    
    return foto;
}

async function simularProblema(connection) {
    console.log('\n' + '='.repeat(60));
    console.log('⚠️  SIMULANDO PROBLEMA - MUDANDO FOTO PARA INGRESADO');
    console.log('='.repeat(60));
    
    // Mostrar estado atual
    const estadoAtual = await mostrarStatus(connection);
    if (!estadoAtual) return;
    
    if (estadoAtual.AESTADOP === 'INGRESADO') {
        console.log('\n⚠️ Foto já está em INGRESADO! Nada a fazer.');
        return;
    }
    
    console.log('\n🔄 Mudando estado...');
    console.log(`   DE: ${estadoAtual.AESTADOP} | ${estadoAtual.RESERVEDUSU}`);
    console.log(`   PARA: INGRESADO | (vazio)`);
    
    // Executar mudança
    await connection.execute(
        'UPDATE tbinventario SET AESTADOP = ?, RESERVEDUSU = ? WHERE ATIPOETIQUETA = ?',
        ['INGRESADO', '', FOTO_TESTE.numero]
    );
    
    console.log('\n✅ MUDANÇA APLICADA!');
    
    // Mostrar novo estado
    await mostrarStatus(connection);
    
    console.log(`
📋 PRÓXIMOS PASSOS:
   1. Execute o diagnóstico: node diagnostico-selecao-gena.js
   2. Verifique se a foto 26696 aparece como "REMOVER"
   3. IMPORTANTE: Depois execute: node simular-problema-foto.js reverter
`);
}

async function reverterProblema(connection) {
    console.log('\n' + '='.repeat(60));
    console.log('🔄 REVERTENDO - VOLTANDO FOTO PARA CONFIRMED');
    console.log('='.repeat(60));
    
    // Mostrar estado atual
    const estadoAtual = await mostrarStatus(connection);
    if (!estadoAtual) return;
    
    if (estadoAtual.AESTADOP === 'CONFIRMED' && estadoAtual.RESERVEDUSU === FOTO_TESTE.reservedusuOriginal) {
        console.log('\n✅ Foto já está no estado original! Nada a fazer.');
        return;
    }
    
    console.log('\n🔄 Revertendo estado...');
    console.log(`   DE: ${estadoAtual.AESTADOP} | ${estadoAtual.RESERVEDUSU || '(vazio)'}`);
    console.log(`   PARA: ${FOTO_TESTE.estadoOriginal} | ${FOTO_TESTE.reservedusuOriginal}`);
    
    // Executar reversão
    await connection.execute(
        'UPDATE tbinventario SET AESTADOP = ?, RESERVEDUSU = ? WHERE ATIPOETIQUETA = ?',
        [FOTO_TESTE.estadoOriginal, FOTO_TESTE.reservedusuOriginal, FOTO_TESTE.numero]
    );
    
    console.log('\n✅ REVERSÃO APLICADA!');
    
    // Mostrar novo estado
    await mostrarStatus(connection);
}

async function main() {
    const comando = process.argv[2];
    
    if (!comando || !['simular', 'reverter', 'status'].includes(comando)) {
        console.log(`
╔════════════════════════════════════════════════════════════╗
║  SCRIPT DE SIMULAÇÃO - MUDAR ESTADO DE FOTO NO CDE         ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Uso:                                                      ║
║    node simular-problema-foto.js simular                   ║
║         → Muda foto 26696 para INGRESADO (simula problema) ║
║                                                            ║
║    node simular-problema-foto.js reverter                  ║
║         → Volta foto 26696 para CONFIRMED (estado original)║
║                                                            ║
║    node simular-problema-foto.js status                    ║
║         → Mostra estado atual da foto                      ║
║                                                            ║
║  ⚠️  ATENÇÃO: Este script MODIFICA dados reais no CDE!     ║
║      Sempre reverta após os testes!                        ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);
        return;
    }
    
    let connection = null;
    
    try {
        console.log('\n🔌 Conectando ao CDE...');
        connection = await mysql.createConnection(CDE_CONFIG);
        console.log('✅ Conectado!');
        
        switch (comando) {
            case 'simular':
                await simularProblema(connection);
                break;
            case 'reverter':
                await reverterProblema(connection);
                break;
            case 'status':
                await mostrarStatus(connection);
                break;
        }
        
    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Conexão fechada.');
        }
    }
}

// Executar
main();