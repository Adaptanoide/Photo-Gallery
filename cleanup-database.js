// SCRIPT DE LIMPEZA DO BANCO DE DADOS
// Manter apenas cliente 6544 e limpar todos os dados de teste
require('dotenv').config();
const mongoose = require('mongoose');
const AccessCode = require('./src/models/AccessCode');
const Selection = require('./src/models/Selection');
const PhotoStatus = require('./src/models/PhotoStatus');
const Cart = require('./src/models/Cart');
async function cleanupDatabase() {
    try {
        console.log('🧹 INICIANDO LIMPEZA COMPLETA...');

        // 1. DELETAR TODOS OS CLIENTES (inclusive 6544)
        console.log('🗑️ Removendo TODOS os clientes...');
        const deletedClients = await AccessCode.deleteMany({});
        console.log(`✅ ${deletedClients.deletedCount} clientes removidos`);

        // 2. DELETAR TODAS AS SELEÇÕES  
        console.log('🗑️ Removendo TODAS as seleções...');
        const deletedSelections = await Selection.deleteMany({});
        console.log(`✅ ${deletedSelections.deletedCount} seleções removidas`);

        // 3. LIMPAR PHOTO STATUS
        console.log('🗑️ Removendo photo status...');
        const deletedPhotoStatus = await PhotoStatus.deleteMany({});
        console.log(`✅ ${deletedPhotoStatus.deletedCount} photo status removidos`);

        // 4. LIMPAR TODOS OS CARRINHOS
        console.log('🗑️ Removendo TODOS os carrinhos...');
        const deletedCarts = await Cart.deleteMany({});
        console.log(`✅ ${deletedCarts.deletedCount} carrinhos removidos`);

        console.log('✅ MANTIDOS: PhotoCategory (preços), QuantityDiscount, EmailConfig');
        console.log('🎉 LIMPEZA COMPLETA CONCLUÍDA!');

        return { success: true };

    } catch (error) {
        console.error('❌ ERRO:', error);
        return { success: false, error: error.message };
    }
}

// EXECUTAR LIMPEZA
async function runCleanup() {
    console.log('🚀 SCRIPT DE LIMPEZA DO SUNSHINE COWHIDES');
    console.log('⚠️ ATENÇÃO: Esta operação é IRREVERSÍVEL');
    console.log('📋 Vai deletar TODOS os dados exceto preços (PhotoCategory)\n');

    // Conectar ao MongoDB se não estiver conectado
    if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔗 Conectado ao MongoDB');
    }

    const result = await cleanupDatabase();

    if (result.success) {
        console.log('\n📈 PRÓXIMOS PASSOS:');
        console.log('1. Verificar dashboard (deve mostrar 0 clientes)');
        console.log('2. Criar novos clientes para testes');
        console.log('3. Testar Special Selections do zero');
        console.log('4. Price Management mantido intacto ✅');
    }

    return result;
}

module.exports = { cleanupDatabase, runCleanup };

// EXECUTAR SE CHAMADO DIRETAMENTE
if (require.main === module) {
    runCleanup().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('❌ Erro fatal:', error);
        process.exit(1);
    });
}
