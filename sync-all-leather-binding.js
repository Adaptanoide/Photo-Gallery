require('dotenv').config();
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');

async function syncAllLeatherBinding() {
    console.log('🔄 SINCRONIZANDO TODAS AS FOTOS LEATHER BINDING\n');
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
        const leatherBindingCategories = await PhotoCategory.find({
            qbItem: /^5500/
        }).sort({ qbItem: 1 });

        console.log(`📂 Encontradas ${leatherBindingCategories.length} categorias Leather Binding\n`);
        console.log('='.repeat(80) + '\n');

        let totalSynced = 0;
        let totalErrors = 0;
        let totalSkipped = 0;

        for (const category of leatherBindingCategories) {
            const qbItem = category.qbItem;
            const displayName = category.displayName;
            const googleDrivePath = category.googleDrivePath;
            const basePrice = category.basePrice || 299;

            console.log(`\n🔍 ${qbItem} - ${displayName.split('→')[1]?.trim() || displayName}`);

            // Buscar fotos INGRESADO do CDE
            const [cdePhotos] = await cdeConnection.execute(`
                SELECT
                    ATIPOETIQUETA as photoNumber,
                    AQBITEM as qbItem,
                    AESTADOP as status,
                    AORIGEN as origin,
                    AIDH as idhCode,
                    AFECHA as date
                FROM tbinventario
                WHERE AQBITEM = ? AND AESTADOP = 'INGRESADO'
                ORDER BY ATIPOETIQUETA
            `, [qbItem]);

            if (cdePhotos.length === 0) {
                console.log(`   ⏭️  Sem fotos INGRESADO - pulando`);
                totalSkipped++;
                continue;
            }

            console.log(`   📸 ${cdePhotos.length} fotos INGRESADO no CDE`);

            let synced = 0;
            let errors = 0;

            for (const cdePhoto of cdePhotos) {
                try {
                    const photoNumber = cdePhoto.photoNumber.toString();
                    const fileName = `${photoNumber}.webp`;
                    const idhCode = cdePhoto.idhCode || `${qbItem}${photoNumber}`;
                    const r2Path = googleDrivePath + fileName;

                    // Verificar se já existe
                    const existing = await UnifiedProductComplete.findOne({ photoNumber });

                    if (existing) {
                        console.log(`      ${photoNumber} - ⏭️  Já existe (pulando)`);
                        continue;
                    }

                    // Criar novo registro
                    await UnifiedProductComplete.create({
                        photoNumber,
                        fileName,
                        idhCode,
                        category: displayName,
                        subcategory: displayName.split('→')[1]?.trim() || qbItem,
                        r2Path,
                        status: 'available',
                        currentStatus: 'available',
                        cdeStatus: 'INGRESADO',
                        cdeTable: 'tbinventario',
                        isActive: true,
                        basePrice: basePrice,
                        qbItem: qbItem,
                        price: basePrice,
                        lastCDESync: new Date(),
                        createdAt: new Date(),
                        // Campos legados para compatibilidade
                        driveFileId: idhCode,
                        photoId: idhCode,
                        // Current location
                        currentLocation: {
                            locationType: 'stock',
                            currentPath: googleDrivePath,
                            currentCategory: displayName
                        },
                        // Original location
                        originalLocation: {
                            originalPath: googleDrivePath,
                            originalCategory: displayName,
                            originalPrice: basePrice
                        },
                        // Virtual status
                        virtualStatus: {
                            status: 'available',
                            tags: [],
                            lastStatusChange: new Date()
                        },
                        // Metadata
                        metadata: {
                            fileType: 'webp',
                            quality: 'standard',
                            popularity: {
                                viewCount: 0,
                                reservationCount: 0
                            }
                        },
                        // História
                        statusHistory: [{
                            action: 'created',
                            newStatus: 'available',
                            actionDetails: 'Sincronizado do CDE (Leather Binding)',
                            performedBy: 'system',
                            performedByType: 'system',
                            timestamp: new Date()
                        }]
                    });

                    console.log(`      ${photoNumber} - ✅ Sincronizado`);
                    synced++;
                    totalSynced++;

                } catch (error) {
                    console.error(`      ${cdePhoto.photoNumber} - ❌ Erro: ${error.message}`);
                    errors++;
                    totalErrors++;
                }
            }

            console.log(`   📊 Resultado: ${synced} sincronizadas, ${errors} erros`);
        }

        // RESUMO FINAL
        console.log('\n' + '='.repeat(80));
        console.log('📊 RESUMO FINAL\n');

        console.log(`   ✅ Fotos sincronizadas: ${totalSynced}`);
        console.log(`   ❌ Erros: ${totalErrors}`);
        console.log(`   ⏭️  Categorias sem fotos: ${totalSkipped}\n`);

        // Verificar resultado final
        const finalCount = await UnifiedProductComplete.countDocuments({
            qbItem: /^5500/,
            status: 'available',
            isActive: true
        });

        console.log(`   💾 Total de fotos Leather Binding no MongoDB agora: ${finalCount}\n`);

        console.log('='.repeat(80));
        console.log('\n💡 PRÓXIMOS PASSOS:\n');
        console.log('   1. ✅ Verificar se as fotos aparecem na galeria');
        console.log('   2. ✅ Testar a navegação: Back > Specialty Cowhides > Cowhide with Leather Binding');
        console.log('   3. ✅ Confirmar que os cards mostram o número correto de fotos\n');

        console.log('   Para re-verificar, execute: node analyze-leather-binding-complete.js\n');
        console.log('='.repeat(80) + '\n');

        await cdeConnection.end();
        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

syncAllLeatherBinding();
