require('dotenv').config();
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');

async function analyzeLeatherBinding() {
    console.log('🔍 ANÁLISE COMPLETA: LEATHER BINDING (5500XX)\n');
    console.log('='.repeat(80) + '\n');

    try {
        // Conectar MongoDB e CDE
        await mongoose.connect(process.env.MONGODB_URI);
        const UnifiedProductComplete = mongoose.model('UnifiedProductComplete', new mongoose.Schema({}, { strict: false }));
        const PhotoCategory = mongoose.model('PhotoCategory', new mongoose.Schema({}, { strict: false }));

        const cdeConnection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });

        console.log('✅ Conectado ao MongoDB e CDE\n');

        // Buscar TODAS as categorias 5500XX (Leather Binding)
        console.log('📂 Buscando todas as categorias Leather Binding (5500XX)...\n');

        const leatherBindingCategories = await PhotoCategory.find({
            qbItem: /^5500/
        }).sort({ qbItem: 1 });

        console.log(`Encontradas ${leatherBindingCategories.length} categorias Leather Binding\n`);
        console.log('='.repeat(80) + '\n');

        const results = [];
        let totalCDE = 0;
        let totalMongo = 0;
        let totalMissing = 0;

        for (const category of leatherBindingCategories) {
            const qbItem = category.qbItem;
            const displayName = category.displayName;
            const googleDrivePath = category.googleDrivePath;

            console.log(`🔍 ${qbItem} - ${displayName.split('→')[1]?.trim() || displayName}`);
            console.log(`   Path: ${googleDrivePath}`);

            // 1. Contar no CDE (INGRESADO)
            const [cdeRows] = await cdeConnection.execute(`
                SELECT
                    ATIPOETIQUETA as photoNumber,
                    AESTADOP as status,
                    AFECHA as date
                FROM tbinventario
                WHERE AQBITEM = ? AND AESTADOP = 'INGRESADO'
                ORDER BY ATIPOETIQUETA
            `, [qbItem]);

            const cdeCount = cdeRows.length;

            // 2. Contar no MongoDB (available)
            const mongoPhotos = await UnifiedProductComplete.find({
                category: displayName,
                status: 'available',
                isActive: true
            }).select('photoNumber fileName r2Path');

            const mongoCount = mongoPhotos.length;

            // 3. Calcular diferença
            const missing = cdeCount - mongoCount;

            totalCDE += cdeCount;
            totalMongo += mongoCount;
            totalMissing += Math.abs(missing);

            console.log(`   📊 CDE: ${cdeCount} INGRESADO | MongoDB: ${mongoCount} available`);

            if (missing !== 0) {
                const status = missing > 0 ? '🔴 FALTAM' : '⚠️  SOBRAM';
                console.log(`   ${status} ${Math.abs(missing)} fotos no MongoDB!`);

                // Listar quais fotos faltam
                if (missing > 0) {
                    const cdePhotoNumbers = new Set(cdeRows.map(r => r.photoNumber.toString()));
                    const mongoPhotoNumbers = new Set(mongoPhotos.map(p => p.photoNumber.toString()));

                    const missingPhotos = [...cdePhotoNumbers].filter(num => !mongoPhotoNumbers.has(num));

                    console.log(`   📸 Fotos faltando: ${missingPhotos.join(', ')}`);
                }
            } else {
                console.log(`   ✅ Sincronizado!`);
            }

            console.log('');

            // Salvar resultado
            results.push({
                qbItem,
                displayName: displayName.split('→')[1]?.trim() || displayName,
                googleDrivePath,
                cdeCount,
                mongoCount,
                missing,
                missingPhotos: missing > 0 ? [...new Set(cdeRows.map(r => r.photoNumber.toString()))].filter(num =>
                    !mongoPhotos.some(p => p.photoNumber.toString() === num)
                ) : []
            });
        }

        // RESUMO GERAL
        console.log('='.repeat(80));
        console.log('📊 RESUMO GERAL - LEATHER BINDING\n');

        console.log(`   Total de categorias: ${leatherBindingCategories.length}`);
        console.log(`   📸 Total CDE (INGRESADO): ${totalCDE} fotos`);
        console.log(`   💾 Total MongoDB (available): ${totalMongo} fotos`);
        console.log(`   🔴 Total faltando: ${totalMissing} fotos\n`);

        const percentSynced = totalCDE > 0 ? ((totalMongo / totalCDE) * 100).toFixed(1) : 0;
        console.log(`   📈 Taxa de sincronização: ${percentSynced}%\n`);

        // Categorias com problemas
        const problematic = results.filter(r => r.missing !== 0);

        if (problematic.length > 0) {
            console.log('='.repeat(80));
            console.log('🔴 CATEGORIAS COM FOTOS FALTANDO:\n');

            problematic.sort((a, b) => Math.abs(b.missing) - Math.abs(a.missing));

            problematic.forEach(cat => {
                if (cat.missing > 0) {
                    console.log(`   ${cat.qbItem} | FALTAM ${cat.missing} fotos`);
                    console.log(`   └─ ${cat.displayName}`);
                    console.log(`   📸 Fotos: ${cat.missingPhotos.join(', ')}`);
                    console.log('');
                }
            });
        } else {
            console.log('   ✅ Todas as categorias estão sincronizadas!\n');
        }

        console.log('='.repeat(80));
        console.log('\n💡 PRÓXIMA AÇÃO:\n');

        if (totalMissing > 0) {
            console.log('   Sincronizar as fotos faltando do CDE para o MongoDB');
            console.log(`   Total a sincronizar: ${totalMissing} fotos\n`);
            console.log('   Executar: node sync-all-leather-binding.js\n');
        } else {
            console.log('   ✅ Nenhuma ação necessária - tudo sincronizado!\n');
        }

        // Salvar relatório JSON
        const fs = require('fs');
        const reportPath = './leather-binding-analysis.json';
        fs.writeFileSync(reportPath, JSON.stringify({
            summary: {
                totalCategories: leatherBindingCategories.length,
                totalCDE,
                totalMongo,
                totalMissing,
                percentSynced
            },
            categories: results
        }, null, 2));

        console.log(`   📄 Relatório detalhado salvo em: ${reportPath}\n`);
        console.log('='.repeat(80) + '\n');

        await cdeConnection.end();
        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

analyzeLeatherBinding();
