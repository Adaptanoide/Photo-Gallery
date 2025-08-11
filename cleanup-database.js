// SCRIPT DE LIMPEZA COMPLETA DO BANCO DE DADOS
// MANTÉM APENAS ADMINS - LIMPA TODO O RESTO
require('dotenv').config();
const mongoose = require('mongoose');

async function cleanupDatabase() {
    try {
        console.log('🧹 INICIANDO LIMPEZA TOTAL DO BANCO...');
        console.log('⚠️  AVISO: Isto vai ZERAR o banco (exceto admins)!\n');

        // Importar TODOS os modelos
        const AccessCode = require('./src/models/AccessCode');
        const Selection = require('./src/models/Selection');
        const PhotoStatus = require('./src/models/PhotoStatus');
        const Cart = require('./src/models/Cart');
        const Product = require('./src/models/Product');
        const PhotoCategory = require('./src/models/PhotoCategory');
        const QuantityDiscount = require('./src/models/QuantityDiscount');
        const EmailConfig = require('./src/models/EmailConfig');

        // Tentar importar Sale se existir
        let Sale;
        try {
            Sale = require('./src/models/Sale');
        } catch (e) {
            console.log('📌 Modelo Sale não encontrado (normal)');
        }

        // 1. LIMPAR PRODUCTS (IMPORTANTE - RESOLVE O BUG!)
        console.log('🗑️ Limpando PRODUCTS e reservas bugadas...');
        const deletedProducts = await Product.deleteMany({});
        console.log(`✅ ${deletedProducts.deletedCount} produtos removidos`);

        // 2. LIMPAR CARRINHOS
        console.log('🗑️ Limpando todos os carrinhos...');
        const deletedCarts = await Cart.deleteMany({});
        console.log(`✅ ${deletedCarts.deletedCount} carrinhos removidos`);

        // 3. LIMPAR SELEÇÕES
        console.log('🗑️ Limpando todas as seleções...');
        const deletedSelections = await Selection.deleteMany({});
        console.log(`✅ ${deletedSelections.deletedCount} seleções removidas`);

        // 4. LIMPAR CLIENTES
        console.log('🗑️ Limpando todos os clientes...');
        const deletedClients = await AccessCode.deleteMany({});
        console.log(`✅ ${deletedClients.deletedCount} clientes removidos`);

        // 5. LIMPAR PHOTO STATUS
        console.log('🗑️ Limpando photo status...');
        const deletedPhotoStatus = await PhotoStatus.deleteMany({});
        console.log(`✅ ${deletedPhotoStatus.deletedCount} photo status removidos`);

        // 6. LIMPAR SALES (se existir)
        if (Sale) {
            console.log('🗑️ Limpando vendas...');
            const deletedSales = await Sale.deleteMany({});
            console.log(`✅ ${deletedSales.deletedCount} vendas removidas`);
        }

        // 7. LIMPAR PREÇOS E CATEGORIAS
        console.log('🗑️ Limpando categorias de preços...');
        const deletedCategories = await PhotoCategory.deleteMany({});
        console.log(`✅ ${deletedCategories.deletedCount} categorias de preços removidas`);

        // 8. LIMPAR DESCONTOS
        console.log('🗑️ Limpando regras de desconto...');
        const deletedDiscounts = await QuantityDiscount.deleteMany({});
        console.log(`✅ ${deletedDiscounts.deletedCount} descontos removidos`);

        // 9. MANTER CONFIGURAÇÕES DE EMAIL
        console.log('✅ MANTIDO: Configurações de Email (para não perder SMTP)');

        // VERIFICAR O QUE FOI MANTIDO
        console.log('\n✅ MANTIDO: Admins (para você fazer login)');
        console.log('✅ MANTIDO: EmailConfig (configurações SMTP)');

        // Contar admins mantidos
        const Admin = require('./src/models/Admin');
        const adminCount = await Admin.countDocuments({});
        console.log(`📊 ${adminCount} admin(s) mantido(s) no sistema`);

        console.log('\n🎉 LIMPEZA CONCLUÍDA COM SUCESSO!');
        console.log('📊 Banco de dados está ZERADO (exceto admins)!');

        // Verificar se ainda há produtos com reserva (não deveria ter)
        const remainingProducts = await Product.countDocuments({});
        if (remainingProducts > 0) {
            console.log(`⚠️  ERRO: ${remainingProducts} produtos ainda existem!`);
        } else {
            console.log('✅ Todos os produtos foram limpos');
            console.log('✅ Foto 16482 e todas as outras estão livres agora!');
        }

        return { success: true };

    } catch (error) {
        console.error('❌ ERRO:', error);
        return { success: false, error: error.message };
    }
}

// EXECUTAR LIMPEZA
async function runCleanup() {
    console.log('🚀 SUNSHINE COWHIDES - LIMPEZA TOTAL');
    console.log('='.repeat(50));
    console.log('⚠️  ESTA OPERAÇÃO É IRREVERSÍVEL!');
    console.log('✅ Mantém apenas: ADMINS');
    console.log('🗑️  Remove: Clientes, Produtos, Carrinhos, Seleções,');
    console.log('           Preços, Descontos, Emails, Photo Status');
    console.log('='.repeat(50));
    console.log('');

    // Conectar ao MongoDB
    if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔗 Conectado ao MongoDB\n');
    }

    const result = await cleanupDatabase();

    if (result.success) {
        console.log('\n📋 PRÓXIMOS PASSOS:');
        console.log('1. ✅ Você pode fazer login como admin');
        console.log('2. 📝 Criar novos clientes de teste');
        console.log('3. 💰 Reconfigurar preços se necessário');
        console.log('4. 📸 Todas as fotos estão 100% livres');
        console.log('5. 🧪 Sistema pronto para testes limpos');
    }

    // Desconectar
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado do MongoDB');

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