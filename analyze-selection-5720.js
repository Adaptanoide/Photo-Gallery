require('dotenv').config();
const mongoose = require('mongoose');

async function analyzeSelection5720() {
    await mongoose.connect(process.env.MONGODB_URI);
    const Selection = mongoose.model('Selection', new mongoose.Schema({}, { strict: false }));
    const UnifiedProductComplete = mongoose.model('UnifiedProductComplete', new mongoose.Schema({}, { strict: false }));

    console.log('=== ANÁLISE COMPLETA DA SELEÇÃO 5720 ===\n');

    const selection = await Selection.findOne({ clientCode: '5720' }).sort({ createdAt: -1 });

    if (!selection) {
        console.log('❌ Seleção não encontrada');
        await mongoose.connection.close();
        return;
    }

    console.log('📋 INFORMAÇÕES BÁSICAS:');
    console.log('ID:', selection._id);
    console.log('Client Code:', selection.clientCode);
    console.log('Status:', selection.status);
    console.log('Created:', new Date(selection.createdAt).toLocaleString());
    console.log('Total Items:', selection.items.length);
    console.log('Total Amount:', selection.totalAmount);
    console.log('');

    // Separar por tipo
    const photos = selection.items.filter(i => !i.isCatalogProduct);
    const catalog = selection.items.filter(i => i.isCatalogProduct);

    console.log('📊 COMPOSIÇÃO:');
    console.log('Fotos únicas:', photos.length);
    console.log('Produtos catálogo:', catalog.length);
    console.log('');

    // Verificar status de cada foto no MongoDB
    console.log('🔍 VERIFICANDO STATUS DAS FOTOS NO MONGODB:\n');

    let existInMongo = 0;
    let notInMongo = 0;
    let available = 0;
    let reserved = 0;
    let sold = 0;
    let unavailable = 0;
    let inSelection = 0;

    for (const item of photos) {
        const mongoPhoto = await UnifiedProductComplete.findOne({ fileName: item.fileName });

        if (mongoPhoto) {
            existInMongo++;
            if (mongoPhoto.status === 'available') available++;
            if (mongoPhoto.status === 'reserved') reserved++;
            if (mongoPhoto.status === 'sold') sold++;
            if (mongoPhoto.status === 'unavailable') unavailable++;
            if (mongoPhoto.status === 'in_selection') inSelection++;
        } else {
            notInMongo++;
            console.log('❌ NÃO EXISTE:', item.fileName);
        }
    }

    console.log('\n📊 RESUMO STATUS MONGODB:');
    console.log('Existem no MongoDB:', existInMongo);
    console.log('NÃO existem no MongoDB:', notInMongo);
    console.log('  - Available:', available);
    console.log('  - Reserved:', reserved);
    console.log('  - Sold:', sold);
    console.log('  - Unavailable:', unavailable);
    console.log('  - In Selection:', inSelection);
    console.log('');

    console.log('🚨 PROBLEMA IDENTIFICADO:');
    console.log(notInMongo + ' fotos na seleção NÃO EXISTEM no MongoDB!');
    console.log('Isso significa que:');
    console.log('1. Foram deletadas do MongoDB mas ainda estavam no carrinho');
    console.log('2. O cliente finalizou a seleção com fotos que não existem');
    console.log('3. Quando Eddie tentou exportar para CDE, descobriu que estão RETIRADO');

    await mongoose.connection.close();
}

analyzeSelection5720().catch(console.error);
