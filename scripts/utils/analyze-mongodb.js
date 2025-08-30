// scripts/analyze-mongodb.js
// Script para analisar a estrutura atual do MongoDB

const mongoose = require('mongoose');
require('dotenv').config();

// Conectar ao MongoDB
async function analyzeDatabase() {
    try {
        console.log('🔗 Conectando ao MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado!\n');

        const db = mongoose.connection.db;

        // 1. Listar todas as collections
        console.log('📋 COLLECTIONS NO BANCO:');
        console.log('========================');
        const collections = await db.listCollections().toArray();
        collections.forEach(col => {
            console.log(`  - ${col.name}`);
        });

        // 2. Analisar a collection photostatus
        const photoStatusCollection = db.collection('photostatuses');
        const totalDocs = await photoStatusCollection.countDocuments();

        console.log('\n📊 ANÁLISE DA COLLECTION photostatus:');
        console.log('=====================================');
        console.log(`Total de documentos: ${totalDocs}`);

        // 3. Pegar amostras de diferentes tamanhos de photoId
        console.log('\n🔍 AMOSTRAS DE photoId (diferentes tamanhos):');
        console.log('=============================================');

        // Buscar documentos com photoIds de diferentes tamanhos
        const samples = await photoStatusCollection.aggregate([
            {
                $project: {
                    photoId: 1,
                    photoIdLength: { $strLenCP: "$photoId" },
                    currentStatus: 1
                }
            },
            { $sort: { photoIdLength: 1 } },
            {
                $group: {
                    _id: "$photoIdLength",
                    examples: { $push: { photoId: "$photoId", status: "$currentStatus" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray();

        samples.forEach(group => {
            console.log(`\n  ${group._id} dígitos (${group.count} fotos):`);
            // Mostrar até 5 exemplos
            group.examples.slice(0, 5).forEach(ex => {
                console.log(`    - "${ex.photoId}" (${ex.status})`);
            });
        });

        // 4. Verificar padrão de zeros à esquerda
        console.log('\n🔢 ANÁLISE DE ZEROS À ESQUERDA:');
        console.log('================================');

        const withLeadingZeros = await photoStatusCollection.countDocuments({
            photoId: /^0/
        });

        console.log(`Fotos com zeros à esquerda: ${withLeadingZeros}`);

        if (withLeadingZeros > 0) {
            const examples = await photoStatusCollection.find({
                photoId: /^0/
            }).limit(5).toArray();

            console.log('Exemplos:');
            examples.forEach(doc => {
                console.log(`  - "${doc.photoId}"`);
            });
        }

        // 5. Verificar se existe campo idhCode
        console.log('\n🔍 VERIFICANDO CAMPO idhCode:');
        console.log('==============================');

        const withIDH = await photoStatusCollection.countDocuments({
            idhCode: { $exists: true, $ne: null }
        });

        console.log(`Documentos com idhCode: ${withIDH}`);

        if (withIDH > 0) {
            const examples = await photoStatusCollection.find({
                idhCode: { $exists: true, $ne: null }
            }).limit(3).toArray();

            console.log('Exemplos:');
            examples.forEach(doc => {
                console.log(`  photoId: "${doc.photoId}" → idhCode: "${doc.idhCode}"`);
            });
        }

        // 6. Status atual das fotos
        console.log('\n📈 DISTRIBUIÇÃO DE STATUS:');
        console.log('==========================');

        const statusCount = await photoStatusCollection.aggregate([
            {
                $group: {
                    _id: "$currentStatus",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]).toArray();

        statusCount.forEach(status => {
            console.log(`  ${status._id || 'null'}: ${status.count} fotos`);
        });

        // 7. Exemplo de documento completo
        console.log('\n📄 EXEMPLO DE DOCUMENTO COMPLETO:');
        console.log('=================================');
        const sampleDoc = await photoStatusCollection.findOne({});
        console.log(JSON.stringify(sampleDoc, null, 2));

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Análise concluída!');
    }
}

// Executar
analyzeDatabase();