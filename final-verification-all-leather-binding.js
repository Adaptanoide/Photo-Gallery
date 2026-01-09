require('dotenv').config();
const mongoose = require('mongoose');
const { S3Client, HeadObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

async function finalVerification() {
    console.log('✅ VERIFICAÇÃO FINAL - TODAS AS CATEGORIAS LEATHER BINDING\n');
    console.log('='.repeat(80) + '\n');

    try {
        // Conectar MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        const UnifiedProductComplete = mongoose.model('UnifiedProductComplete', new mongoose.Schema({}, { strict: false }));
        const PhotoCategory = mongoose.model('PhotoCategory', new mongoose.Schema({}, { strict: false }));

        // Configurar R2
        const s3Client = new S3Client({
            region: 'auto',
            endpoint: process.env.R2_ENDPOINT,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            },
        });

        const bucketName = process.env.R2_BUCKET_NAME;

        console.log('📂 Verificando todas as categorias Leather Binding (5500XX)...\n');
        console.log('='.repeat(80) + '\n');

        // Buscar TODAS as categorias 5500XX
        const categories = await PhotoCategory.find({
            qbItem: /^5500/
        }).sort({ qbItem: 1 });

        let totalMongo = 0;
        let totalR2 = 0;
        let totalMissing = 0;
        const missingInR2 = [];

        for (const category of categories) {
            const qbItem = category.qbItem;
            const displayName = category.displayName.split('→')[1]?.trim() || category.displayName;
            const basePath = category.googleDrivePath;

            console.log(`🔍 ${qbItem} - ${displayName}`);

            // 1. Buscar no MongoDB
            const mongoPhotos = await UnifiedProductComplete.find({
                category: category.displayName,
                status: 'available',
                isActive: true
            }).select('photoNumber fileName r2Path').sort({ photoNumber: 1 });

            const mongoCount = mongoPhotos.length;
            totalMongo += mongoCount;

            console.log(`   💾 MongoDB: ${mongoCount} fotos`);

            if (mongoCount === 0) {
                console.log(`   ⏭️  Sem fotos - pulando\n`);
                continue;
            }

            // 2. Verificar no R2
            let r2Found = 0;
            let r2Missing = [];

            for (const photo of mongoPhotos) {
                try {
                    const command = new HeadObjectCommand({
                        Bucket: bucketName,
                        Key: photo.r2Path
                    });

                    await s3Client.send(command);
                    r2Found++;

                } catch (error) {
                    if (error.name === 'NotFound') {
                        r2Missing.push(photo.photoNumber);
                        missingInR2.push({
                            qbItem,
                            displayName,
                            photoNumber: photo.photoNumber,
                            expectedPath: photo.r2Path
                        });
                    }
                }
            }

            totalR2 += r2Found;
            totalMissing += r2Missing.length;

            console.log(`   🌐 R2: ${r2Found}/${mongoCount} encontradas`);

            if (r2Missing.length > 0) {
                console.log(`   ❌ Faltam no R2: ${r2Missing.join(', ')}`);
            } else {
                console.log(`   ✅ Todas no R2!`);
            }

            console.log('');
        }

        // RESUMO FINAL
        console.log('='.repeat(80));
        console.log('📊 RESUMO FINAL\n');

        console.log(`   📂 Categorias verificadas: ${categories.length}`);
        console.log(`   💾 Total MongoDB: ${totalMongo} fotos`);
        console.log(`   🌐 Total R2: ${totalR2} fotos`);
        console.log(`   ❌ Faltando no R2: ${totalMissing} fotos\n`);

        const percentR2 = totalMongo > 0 ? ((totalR2 / totalMongo) * 100).toFixed(1) : 0;
        console.log(`   📈 Taxa de fotos no R2: ${percentR2}%\n`);

        if (missingInR2.length > 0) {
            console.log('='.repeat(80));
            console.log('❌ FOTOS FALTANDO NO R2:\n');

            const byCategory = {};
            missingInR2.forEach(item => {
                if (!byCategory[item.qbItem]) {
                    byCategory[item.qbItem] = {
                        displayName: item.displayName,
                        photos: []
                    };
                }
                byCategory[item.qbItem].photos.push(item.photoNumber);
            });

            Object.entries(byCategory).forEach(([qbItem, data]) => {
                console.log(`   ${qbItem} - ${data.displayName}`);
                console.log(`   📸 Fotos: ${data.photos.join(', ')}\n`);
            });

            console.log('💡 AÇÃO NECESSÁRIA:\n');
            console.log('   Estas fotos existem no MongoDB mas NÃO no R2');
            console.log('   Você precisa fazer upload manual dessas fotos para o R2');
            console.log('   ou verificar se estão no Google Drive para migração\n');

        } else {
            console.log('   🎉 PERFEITO! Todas as fotos estão no R2!\n');
            console.log('   A galeria agora deve exibir todas as fotos corretamente:\n');
            console.log('   📍 Navegação: Back > Specialty Cowhides > Cowhide with Leather Binding\n');
            console.log('   ✅ Cada categoria deve mostrar o número correto de fotos nos cards');
            console.log('   ✅ Ao abrir cada categoria, todas as fotos devem aparecer\n');
        }

        console.log('='.repeat(80) + '\n');

        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

finalVerification();
