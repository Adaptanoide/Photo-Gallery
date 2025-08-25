#!/usr/bin/env node

/**
 * LIMPEZA DO BANCO PARA PRODUÇÃO
 * Remove dados de teste mas PRESERVA configurações importantes
 */

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

async function cleanupDatabase() {
    try {
        console.log('\n🧹 LIMPEZA DO BANCO PARA PRODUÇÃO\n');
        console.log('⚠️  ESTE SCRIPT VAI:');
        console.log('  ✅ Remover seleções de teste');
        console.log('  ✅ Remover carrinhos antigos');
        console.log('  ✅ Remover clientes de teste');
        console.log('  ✅ Limpar PhotoStatus');
        console.log('  ✅ Remover produtos bugados\n');
        
        console.log('🔒 VAI PRESERVAR:');
        console.log('  ✅ Admins');
        console.log('  ✅ Configurações de Email');
        console.log('  ✅ PhotoCategory (com preços)');
        console.log('  ✅ QuantityDiscount (regras de desconto)\n');
        
        // Conectar ao MongoDB Atlas
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB Atlas\n');
        
        // Importar modelos
        const AccessCode = require('../../src/models/AccessCode');
        const Selection = require('../../src/models/Selection');
        const PhotoStatus = require('../../src/models/PhotoStatus');
        const Cart = require('../../src/models/Cart');
        const Product = require('../../src/models/Product');
        const PhotoCategory = require('../../src/models/PhotoCategory');
        const Admin = require('../../src/models/Admin');
        const EmailConfig = require('../../src/models/EmailConfig');
        
        // Estatísticas antes
        console.log('📊 ESTADO ATUAL DO BANCO:');
        console.log(`  Admins: ${await Admin.countDocuments()}`);
        console.log(`  Clientes: ${await AccessCode.countDocuments()}`);
        console.log(`  Seleções: ${await Selection.countDocuments()}`);
        console.log(`  Carrinhos: ${await Cart.countDocuments()}`);
        console.log(`  Produtos: ${await Product.countDocuments()}`);
        console.log(`  PhotoStatus: ${await PhotoStatus.countDocuments()}`);
        console.log(`  Categorias: ${await PhotoCategory.countDocuments()}`);
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('\n🗑️ INICIANDO LIMPEZA...\n');
        
        // 1. Limpar Products
        console.log('1️⃣ Limpando produtos...');
        const delProducts = await Product.deleteMany({});
        console.log(`   ✅ ${delProducts.deletedCount} produtos removidos`);
        
        // 2. Limpar Carrinhos
        console.log('2️⃣ Limpando carrinhos...');
        const delCarts = await Cart.deleteMany({});
        console.log(`   ✅ ${delCarts.deletedCount} carrinhos removidos`);
        
        // 3. Limpar Seleções
        console.log('3️⃣ Limpando seleções...');
        const delSelections = await Selection.deleteMany({});
        console.log(`   ✅ ${delSelections.deletedCount} seleções removidas`);
        
        // 4. Limpar Clientes
        console.log('4️⃣ Limpando clientes...');
        const delClients = await AccessCode.deleteMany({});
        console.log(`   ✅ ${delClients.deletedCount} clientes removidos`);
        
        // 5. Limpar PhotoStatus
        console.log('5️⃣ Limpando PhotoStatus...');
        const delPhotoStatus = await PhotoStatus.deleteMany({});
        console.log(`   ✅ ${delPhotoStatus.deletedCount} photo status removidos`);
        
        console.log('\n✅ PRESERVADOS:');
        console.log(`  Admins: ${await Admin.countDocuments()}`);
        console.log(`  Email Config: ${await EmailConfig.countDocuments()}`);
        console.log(`  Categorias: ${await PhotoCategory.countDocuments()}`);
        
        console.log('\n✅ BANCO LIMPO!');
        await mongoose.disconnect();
        
    } catch (error) {
        console.error('❌ Erro:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('\n⚠️  ATENÇÃO: Este script vai LIMPAR o banco!');
console.log('MongoDB Atlas: ' + process.env.MONGODB_URI.split('@')[1].split('/')[0]);

rl.question('\nDigite "LIMPAR" para confirmar: ', (answer) => {
    if (answer === 'LIMPAR') {
        cleanupDatabase();
    } else {
        console.log('❌ Cancelado');
        process.exit(0);
    }
    rl.close();
});
