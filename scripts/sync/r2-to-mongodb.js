const mongoose = require('mongoose');
const PhotoStatus = require('../src/models/PhotoStatus');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config();

async function syncR2ToMongoDB() {
    await mongoose.connect(process.env.MONGODB_URI);

    // Configurar R2
    const s3Client = new S3Client({
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        region: 'auto',
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
        }
    });

    console.log('Listando todas as fotos do R2...');

    let continuationToken;
    let allPhotos = [];

    do {
        const command = new ListObjectsV2Command({
            Bucket: 'sunshine-photos',
            ContinuationToken: continuationToken
        });

        const data = await s3Client.send(command);
        if (data.Contents) {
            const photos = data.Contents.filter(obj => obj.Key.endsWith('.webp') && !obj.Key.includes('_thumbnails'));
            allPhotos = allPhotos.concat(photos);
        }
        continuationToken = data.NextContinuationToken;
    } while (continuationToken);

    console.log(`Total de fotos no R2: ${allPhotos.length}`);

    let missing = 0;
    let created = 0;

    for (const photo of allPhotos) {
        const photoNumber = photo.Key.split('/').pop().replace('.webp', '');

        // Verificar se existe no MongoDB
        const exists = await PhotoStatus.findOne({
            $or: [
                { photoId: photoNumber },
                { fileName: `${photoNumber}.webp` }
            ]
        });

        if (!exists) {
            // Ignorar pastas _preview e _display
            if (!photo.Key.includes('_preview') && !photo.Key.includes('_display') && !photo.Key.includes('_thumbnails')) {
                missing++;
                console.log(`FALTANDO: ${photo.Key}`);

                // Criar registro
                try {
                    const fullPath = photo.Key;
                    const pathParts = fullPath.split('/');
                    const category = pathParts[0]; // Primeira pasta é a categoria principal

                    const newPhoto = await PhotoStatus.create({
                        photoId: photoNumber,
                        fileName: `${photoNumber}.webp`,
                        currentStatus: 'available',
                        'virtualStatus.status': 'available',
                        originalLocation: {
                            originalPath: fullPath,
                            originalParentId: 'r2',
                            originalCategory: category,
                            originalPrice: 0
                        },
                        currentLocation: {
                            locationType: 'stock',
                            currentPath: fullPath,
                            currentParentId: 'r2',
                            currentCategory: category,
                            lastMovedAt: new Date()
                        },
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                    created++;
                    console.log(`  ✓ Criado registro para ${photoNumber}`);
                } catch (error) {
                    console.log(`  ✗ Erro ao criar ${photoNumber}:`, error.message);
                }
            }
        }
    }

    console.log(`\nRESULTADO:`);
    console.log(`${missing} fotos faltando no MongoDB`);
    console.log(`${created} registros criados`);
    console.log(`${allPhotos.length} fotos no R2`);
    console.log(`${allPhotos.length - missing} fotos já sincronizadas`);

    await mongoose.disconnect();
}

syncR2ToMongoDB();