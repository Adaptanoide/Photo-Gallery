// Script temporário para analisar seleção
const mongoose = require('mongoose');
require('dotenv').config();

async function analyze() {
    await mongoose.connect(process.env.MONGODB_URI);

    const Selection = mongoose.model('Selection', new mongoose.Schema({}, { strict: false }));

    const sel = await Selection.findOne({ selectionId: 'SEL_MJ2VZPDD_58RRT' });

    if (!sel) {
        console.log('Selection not found');
        process.exit(1);
    }

    console.log('========================================');
    console.log('ANÁLISE DA SELEÇÃO: SEL_MJ2VZPDD_58RRT');
    console.log('========================================');
    console.log('Total items:', sel.items?.length);
    console.log('');

    // Classificar items por formato de thumbnailUrl
    const correctFormat = []; // URL completa com https://
    const wrongFormat = [];   // URL relativa ou com →

    sel.items?.forEach(item => {
        if (item.thumbnailUrl?.startsWith('https://')) {
            correctFormat.push(item);
        } else {
            wrongFormat.push(item);
        }
    });

    console.log('FORMATO DAS URLs:');
    console.log(`  ✅ URLs corretas (https://...): ${correctFormat.length}`);
    console.log(`  ❌ URLs incorretas: ${wrongFormat.length}`);

    if (wrongFormat.length > 0) {
        console.log('\nITEMS COM URL INCORRETA:');
        wrongFormat.forEach(item => {
            console.log(`  - ${item.fileName}`);
            console.log(`    category: ${item.category}`);
            console.log(`    thumbnailUrl: ${item.thumbnailUrl}`);
        });
    }

    await mongoose.disconnect();
}

analyze().catch(e => { console.error(e); process.exit(1); });
