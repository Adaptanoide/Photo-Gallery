// test-all-status.js - Teste completo de mudanças de status
const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
require('dotenv').config();

async function testarMudancaStatus(photoNumber, novoStatus) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TESTANDO: Foto ${photoNumber} → ${novoStatus}`);
    console.log('='.repeat(60));
    
    let connection;
    try {
        // 1. Conectar ao CDE
        connection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            port: process.env.CDE_PORT,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });
        
        // 2. Ver estado atual no CDE
        const [antes] = await connection.execute(
            'SELECT ATIPOETIQUETA, AESTADOP, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA = ?',
            [photoNumber]
        );
        
        if (antes.length === 0) {
            console.log('❌ Foto não encontrada no CDE');
            return false;
        }
        
        console.log('\n📸 Estado ANTES no CDE:');
        console.log(`   Status: ${antes[0].AESTADOP}`);
        console.log(`   ReservedBy: ${antes[0].RESERVEDUSU || 'NULL'}`);
        
        // 3. Verificar se está em algum carrinho
        await mongoose.connect(process.env.MONGODB_URI);
        const Cart = require('./src/models/Cart');
        const carrinhos = await Cart.find(
            { 'items.fileName': `${photoNumber}.webp` },
            { clientCode: 1, clientName: 1, totalItems: 1 }
        );
        
        console.log(`\n🛒 Carrinhos com esta foto: ${carrinhos.length}`);
        if (carrinhos.length > 0) {
            carrinhos.forEach(c => {
                console.log(`   - Cliente ${c.clientCode} (${c.clientName}) - ${c.totalItems} items total`);
            });
        }
        
        // 4. Fazer a mudança no CDE
        console.log(`\n🔄 Mudando para ${novoStatus} no CDE...`);
        
        let updateQuery;
        if (novoStatus === 'INGRESADO') {
            // Para INGRESADO, limpar RESERVEDUSU
            updateQuery = `UPDATE tbinventario 
                          SET AESTADOP = ?, RESERVEDUSU = NULL, AFECHA = NOW()
                          WHERE ATIPOETIQUETA = ?`;
        } else {
            // Para outros estados, manter ou criar RESERVEDUSU
            updateQuery = `UPDATE tbinventario 
                          SET AESTADOP = ?, 
                              RESERVEDUSU = CASE 
                                  WHEN RESERVEDUSU IS NULL THEN 'SISTEMA-TEST'
                                  ELSE RESERVEDUSU
                              END,
                              AFECHA = NOW()
                          WHERE ATIPOETIQUETA = ?`;
        }
        
        const [result] = await connection.execute(updateQuery, [novoStatus, photoNumber]);
        
        if (result.affectedRows > 0) {
            console.log('✅ Status mudado com sucesso no CDE');
            
            // 5. Verificar novo estado
            const [depois] = await connection.execute(
                'SELECT AESTADOP, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA = ?',
                [photoNumber]
            );
            
            console.log('\n📸 Estado DEPOIS no CDE:');
            console.log(`   Status: ${depois[0].AESTADOP}`);
            console.log(`   ReservedBy: ${depois[0].RESERVEDUSU || 'NULL'}`);
            
            console.log('\n⏰ Agora aguarde o CDESync rodar (máximo 5 minutos)');
            console.log('   Depois verifique se a foto foi removida dos carrinhos');
            
            return true;
        } else {
            console.log('❌ Nenhuma mudança realizada');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        return false;
    } finally {
        if (connection) await connection.end();
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
    }
}

// Menu de teste
async function menuTeste() {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    console.log('\n🧪 TESTE DE MUDANÇA DE STATUS CDE\n');
    console.log('Primeiro, adicione uma foto ao carrinho do cliente teste.');
    console.log('Depois escolha o teste que quer fazer:\n');
    console.log('1. Testar RETIRADO (vendido)');
    console.log('2. Testar RESERVED (reservado fisicamente)');
    console.log('3. Testar STANDBY (em espera)');
    console.log('4. Testar INGRESADO (liberado manualmente)');
    console.log('5. Voltar para PRE-SELECTED (resetar para novo teste)\n');
    
    readline.question('Digite o número da foto para testar: ', (photoNumber) => {
        readline.question('Digite a opção (1-5): ', async (opcao) => {
            
            let novoStatus;
            switch(opcao) {
                case '1': novoStatus = 'RETIRADO'; break;
                case '2': novoStatus = 'RESERVED'; break;
                case '3': novoStatus = 'STANDBY'; break;
                case '4': novoStatus = 'INGRESADO'; break;
                case '5': novoStatus = 'PRE-SELECTED'; break;
                default:
                    console.log('Opção inválida');
                    readline.close();
                    return;
            }
            
            await testarMudancaStatus(photoNumber, novoStatus);
            readline.close();
        });
    });
}

// Executar menu
menuTeste();