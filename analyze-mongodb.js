// analyze-mongodb.js
require('dotenv').config();
const mongoose = require('mongoose');

async function analyzeMongoDB() {
    console.log('🔍 ANALISANDO MONGODB - GALERIA\n');
    console.log('='.repeat(50));
    
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB!\n');
        
        // 1. BUSCAR CLIENTES
        console.log('👥 CLIENTES (AccessCodes):');
        const AccessCode = mongoose.connection.collection('accesscodes');
        const clients = await AccessCode.find({}).limit(5).toArray();
        clients.forEach(c => {
            console.log(`  ${c.clientName} (${c.code}) - ${c.clientType}`);
        });
        
        // 2. BUSCAR CATEGORIAS
        console.log('\n📁 CATEGORIAS (PhotoCategories):');
        const PhotoCategory = mongoose.connection.collection('photocategories');
        const categories = await PhotoCategory.find({}).toArray();
        categories.forEach(cat => {
            console.log(`  ${cat.name}: ${cat.qbCode || 'sem QB'}`);
        });
        
        // 3. BUSCAR PREÇOS CUSTOMIZADOS
        console.log('\n💰 PREÇOS (PricingRules):');
        const PricingRules = mongoose.connection.collection('pricingrules');
        const prices = await PricingRules.find({}).limit(5).toArray();
        prices.forEach(p => {
            console.log(`  Cliente ${p.clientCode}: Regras especiais`);
        });
        
        // 4. BUSCAR PRODUTOS COM PREÇOS
        console.log('\n📦 PRODUTOS COM PREÇOS (unified_products):');
        const Products = mongoose.connection.collection('unified_products_complete');
        const productsWithPrice = await Products.find({ 
            calculatedPrice: { $exists: true, $gt: 0 } 
        }).limit(5).toArray();
        productsWithPrice.forEach(p => {
            console.log(`  Foto ${p.fileName}: $${p.calculatedPrice}`);
        });
        
        await mongoose.disconnect();
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
    }
}

analyzeMongoDB();