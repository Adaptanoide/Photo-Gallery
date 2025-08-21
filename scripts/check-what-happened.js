require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');

async function checkWhatHappened() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\n🔍 INVESTIGANDO O QUE ACONTECEU:\n');
    
    // 1. Quantos registros temos?
    const total = await PhotoStatus.countDocuments();
    console.log(`📊 Total de PhotoStatus: ${total}`);
    
    // 2. Ver os últimos criados
    const latest = await PhotoStatus.find()
        .sort({ _id: -1 })
        .limit(5);
    
    console.log('\n📋 Últimos 5 registros:');
    latest.forEach(p => {
        console.log(`   ${p.fileName} - criado em: ${p._id.getTimestamp()}`);
    });
    
    // 3. Ver se tem duplicatas
    const duplicates = await PhotoStatus.aggregate([
        { $group: { _id: '$fileName', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }
    ]);
    
    console.log(`\n⚠️ Duplicatas: ${duplicates.length}`);
    
    // 4. Ver se tem índice único
    const indexes = await PhotoStatus.collection.getIndexes();
    console.log('\n📑 Índices na collection:');
    Object.keys(indexes).forEach(idx => {
        if (indexes[idx].unique) {
            console.log(`   ⚠️ ÚNICO: ${idx} -> ${JSON.stringify(indexes[idx])}`);
        }
    });
    
    await mongoose.disconnect();
}

checkWhatHappened();
