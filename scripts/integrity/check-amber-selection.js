#!/usr/bin/env node
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const db = mongoose.connection.db;
    
    console.log('=== VERIFICANDO SELEÇÕES DA AMBER ===\n');
    
    // Buscar seleções da Amber
    const selections = await db.collection('selections').find({
        $or: [
            { clientName: /AMBER/i },
            { clientCode: '9907' }
        ]
    }).toArray();
    
    console.log(`Encontradas ${selections.length} seleções da Amber\n`);
    
    selections.forEach(sel => {
        console.log(`Seleção ${sel.selectionId}:`);
        console.log(`  Status: ${sel.status}`);
        console.log(`  Data: ${sel.createdAt}`);
        console.log(`  Itens: ${sel.items?.length || 0}`);
        
        // Verificar se tem a foto 17050
        const has17050 = sel.items?.some(item => 
            item.fileName === '17050.webp' || 
            item.photoId?.includes('17050')
        );
        
        if (has17050) {
            console.log(`  ✅ CONTÉM FOTO 17050`);
        }
        console.log('---');
    });
    
    // Verificar status da foto 17050 no MongoDB
    const photo17050 = await db.collection('unified_products_complete').findOne({
        fileName: '17050.webp'
    });
    
    console.log('\nFoto 17050 no MongoDB:');
    console.log('  Status:', photo17050?.status);
    console.log('  SelectionId:', photo17050?.selectionId);
    console.log('  CDE Status:', photo17050?.cdeStatus);
    
    mongoose.connection.close();
});
