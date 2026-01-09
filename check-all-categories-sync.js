require('dotenv').config();
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');

async function checkAllCategories() {
    console.log('🔍 VERIFICANDO SINCRONIZAÇÃO DE TODAS AS CATEGORIAS\n');
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

        // Buscar TODAS as categorias de fotos (não catálogo)
        const categories = await PhotoCategory.find({
            qbItem: { $exists: true, $ne: null, $regex: /^\d/ }  // QB items que começam com número
        }).sort({ qbItem: 1 });

        console.log(`📂 Encontradas ${categories.length} categorias para verificar\n`);
        console.log('='.repeat(80) + '\n');

        const issues = [];
        let checkedCount = 0;

        for (const category of categories) {
            const qbItem = category.qbItem;
            const displayName = category.displayName;

            console.log(`🔍 ${qbItem.padEnd(10)} - ${displayName}`);

            try {
                // Contar no CDE
                const [cdeRows] = await cdeConnection.execute(`
                    SELECT COUNT(*) as total
                    FROM tbinventario
                    WHERE AQBITEM = ? AND AESTADOP = 'INGRESADO'
                `, [qbItem]);

                const cdeCount = cdeRows[0].total;

                // Contar no MongoDB (fotos available dessa categoria)
                const mongoCount = await UnifiedProductComplete.countDocuments({
                    category: displayName,
                    status: 'available',
                    isActive: true
                });

                console.log(`   CDE: ${cdeCount} INGRESADO | MongoDB: ${mongoCount} available`);

                // Se houver diferença, registrar
                if (cdeCount !== mongoCount) {
                    const diff = cdeCount - mongoCount;
                    const severity = diff > 0 ? '🔴 FALTAM' : '⚠️  SOBRAM';

                    console.log(`   ${severity} ${Math.abs(diff)} fotos no MongoDB!`);

                    issues.push({
                        qbItem,
                        displayName,
                        cdeCount,
                        mongoCount,
                        diff
                    });
                }

                console.log('');
                checkedCount++;

            } catch (error) {
                console.log(`   ❌ Erro: ${error.message}`);
                console.log('');
            }
        }

        // RESUMO
        console.log('='.repeat(80));
        console.log('📊 RESUMO FINAL\n');
        console.log(`   ✅ Categorias verificadas: ${checkedCount}`);
        console.log(`   ⚠️  Problemas encontrados: ${issues.length}\n`);

        if (issues.length > 0) {
            console.log('🔴 CATEGORIAS COM PROBLEMAS:\n');

            // Ordenar por diferença (maior primeiro)
            issues.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

            issues.forEach(issue => {
                const type = issue.diff > 0 ? 'FALTAM' : 'SOBRAM';
                const diff = Math.abs(issue.diff);

                console.log(`   ${issue.qbItem.padEnd(10)} | ${type} ${diff.toString().padStart(3)} fotos | CDE: ${issue.cdeCount} | Mongo: ${issue.mongoCount}`);
                console.log(`   └─ ${issue.displayName}`);
                console.log('');
            });

            console.log('\n💡 RECOMENDAÇÃO:\n');
            console.log('   Execute o script de sincronização para cada categoria problemática');
            console.log('   ou crie um script de sincronização em massa.\n');

            // Salvar relatório em JSON
            const fs = require('fs');
            const reportPath = './category-sync-issues.json';
            fs.writeFileSync(reportPath, JSON.stringify(issues, null, 2));
            console.log(`   📄 Relatório salvo em: ${reportPath}\n`);
        } else {
            console.log('   ✅ Nenhum problema encontrado! Todas as categorias estão sincronizadas.\n');
        }

        console.log('='.repeat(80) + '\n');

        await cdeConnection.end();
        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

checkAllCategories();
