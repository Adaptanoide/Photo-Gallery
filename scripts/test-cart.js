// test-cart.js
const mongoose = require('mongoose');
require('dotenv').config();

async function testarCarrinho() {
    await mongoose.connect(process.env.MONGODB_URI);

    const Cart = require('./src/models/Cart');
    const PhotoCategory = require('./src/models/PhotoCategory');

    // Criar carrinho de teste
    const sessionId = 'test_multiple_' + Date.now();

    // Buscar categorias reais
    const brindle = await PhotoCategory.findOne({ displayName: /Brindle/i });
    const exotic = await PhotoCategory.findOne({ displayName: /Exotic/i });

    console.log('🔍 Categorias encontradas:');
    console.log('- Brindle:', brindle ? brindle.displayName : 'NÃO ENCONTRADA');
    console.log('- Exotic:', exotic ? exotic.displayName : 'NÃO ENCONTRADA');

    // Tempo de expiração (5 horas)
    const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000);

    // Criar carrinho com campos obrigatórios
    const cart = new Cart({
        sessionId: sessionId,
        clientCode: '8041',
        clientName: 'TESTE',
        items: [
            // 13 itens Brindle
            ...Array(13).fill().map((_, i) => ({
                productId: new mongoose.Types.ObjectId(), // ID fake
                driveFileId: `brindle_${i + 1}`,
                fileName: `Brindle Item ${i + 1}`,
                category: brindle ? brindle.displayName : 'Brindle',
                price: 50,
                hasPrice: true,
                formattedPrice: '$50.00',
                expiresAt: expiresAt, // CAMPO OBRIGATÓRIO
                addedAt: new Date()
            })),
            // 5 itens Exotic  
            ...Array(5).fill().map((_, i) => ({
                productId: new mongoose.Types.ObjectId(), // ID fake
                driveFileId: `exotic_${i + 1}`,
                fileName: `Exotic Item ${i + 1}`,
                category: exotic ? exotic.displayName : 'Exotic',
                price: 99,
                hasPrice: true,
                formattedPrice: '$99.00',
                expiresAt: expiresAt, // CAMPO OBRIGATÓRIO
                addedAt: new Date()
            }))
        ]
    });

    await cart.save();
    console.log(`\n✅ Carrinho criado: ${sessionId}`);
    console.log(`📦 Total de itens: ${cart.items.length}`);

    // Calcular subtotal
    let subtotal = 0;
    let itemsWithPrice = 0;
    cart.items.forEach(item => {
        if (item.hasPrice && item.price > 0) {
            subtotal += item.price;
            itemsWithPrice++;
        }
    });

    console.log(`\n💰 Subtotal inicial: $${subtotal}`);
    console.log(`📊 Items com preço: ${itemsWithPrice}`);
    console.log(`\n🧮 Calculando com nova função...\n`);

    // Importar e executar a nova função
    const { calculateDiscountWithHierarchy } = require('./src/routes/cart');

    // Chamar nova função
    const resultado = await calculateDiscountWithHierarchy(cart, itemsWithPrice, subtotal);

    console.log('\n🎯 RESULTADO FINAL:');
    console.log('=====================================');
    console.log(`Fonte: ${resultado.source}`);
    console.log(`Descrição: ${resultado.description}`);
    console.log(`Total Final: $${resultado.finalTotal || subtotal}`);

    if (resultado.detalhesCompletos) {
        console.log('\n📋 DETALHES POR CATEGORIA:');
        resultado.detalhesCompletos.forEach(d => {
            console.log(`\n📁 ${d.categoria}:`);
            console.log(`   Quantidade: ${d.quantidade} itens`);
            console.log(`   Preço unitário: $${d.precoUnitario}`);
            console.log(`   Subtotal: $${d.subtotal}`);
            console.log(`   Fonte do preço: ${d.fonte}`);
            if (d.regra) {
                console.log(`   Regra aplicada: ${JSON.stringify(d.regra)}`);
            }
        });
    }

    process.exit();
}

testarCarrinho().catch(console.error);