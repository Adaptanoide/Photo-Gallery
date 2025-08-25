#!/usr/bin/env node

/**
 * POPULAR PHOTOSTATUS COM TODAS AS FOTOS DO R2
 */

require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('../../src/models/PhotoStatus');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

class PopulatePhotoStatus {
    constructor() {
        this.client = new S3Client({
            region: 'auto',
            endpoint: process.env.R2_ENDPOINT,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            }
        });
        this.stats = {
            total: 0,
            created: 0,
            skipped: 0,
            errors: 0
        };
    }

    extractPhotoNumber(filename) {
        const match = filename.match(/(\d{4,6})/);
        return match ? match[1] : null;
    }

    async getAllR2Photos() {
        console.log('📸 Buscando todas as fotos do R2...');
        const photos = [];
        let continuationToken = null;
        
        do {
            const command = new ListObjectsV2Command({
                Bucket: process.env.R2_BUCKET_NAME,
                MaxKeys: 1000,
                ContinuationToken: continuationToken
            });
            
            const response = await this.client.send(command);
            
            if (response.Contents) {
                for (const obj of response.Contents) {
                    // Ignorar thumbnails, preview, display
                    if (!obj.Key.startsWith('_thumbnails/') && 
                        !obj.Key.startsWith('_preview/') && 
                        !obj.Key.startsWith('_display/')) {
                        
                        const photoNumber = this.extractPhotoNumber(obj.Key);
                        if (photoNumber) {
                            photos.push({
                                number: photoNumber,
                                key: obj.Key,
                                fileName: obj.Key.split('/').pop(),
                                path: obj.Key
                            });
                        }
                    }
                }
            }
            
            continuationToken = response.NextContinuationToken;
        } while (continuationToken);
        
        return photos;
    }

    async createPhotoStatus(photo) {
        try {
            // Verificar se já existe
            const exists = await PhotoStatus.findOne({
                $or: [
                    { photoId: photo.number },
                    { fileName: photo.fileName }
                ]
            });
            
            if (exists) {
                this.stats.skipped++;
                return;
            }
            
            // Criar novo PhotoStatus
            await PhotoStatus.create({
                photoId: photo.number,
                fileName: photo.fileName,
                r2Key: photo.key,
                virtualStatus: {
                    status: 'available',
                    tags: ['available'],
                    lastStatusChange: new Date()
                },
                currentStatus: 'available',
                currentLocation: {
                    locationType: 'stock',
                    currentPath: photo.path,
                    currentParentId: 'r2',
                    currentCategory: photo.key.split('/')[0] || 'uncategorized'
                },
                originalLocation: {
                    originalPath: photo.path,
                    originalParentId: 'r2',
                    originalCategory: photo.key.split('/')[0] || 'uncategorized'
                }
            });
            
            this.stats.created++;
            
        } catch (error) {
            console.error(`  ❌ Erro ao criar ${photo.number}: ${error.message}`);
            this.stats.errors++;
        }
    }

    async execute() {
        try {
            console.log('\n🚀 POPULANDO PHOTOSTATUS COM FOTOS DO R2\n');
            
            // Conectar ao MongoDB
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('✅ MongoDB conectado\n');
            
            // Buscar todas as fotos do R2
            const photos = await this.getAllR2Photos();
            this.stats.total = photos.length;
            console.log(`📊 Total de fotos no R2: ${photos.length}\n`);
            
            // Criar PhotoStatus para cada foto
            console.log('⏳ Criando PhotoStatus...');
            for (let i = 0; i < photos.length; i++) {
                await this.createPhotoStatus(photos[i]);
                
                if ((i + 1) % 100 === 0) {
                    console.log(`  Processadas: ${i + 1}/${photos.length}`);
                }
            }
            
            console.log('\n' + '='.repeat(50));
            console.log('📊 RESULTADO:');
            console.log(`  Total no R2: ${this.stats.total}`);
            console.log(`  Criados: ${this.stats.created}`);
            console.log(`  Pulados: ${this.stats.skipped}`);
            console.log(`  Erros: ${this.stats.errors}`);
            console.log('='.repeat(50));
            
            // Verificar total final
            const totalPhotoStatus = await PhotoStatus.countDocuments();
            console.log(`\n✅ Total PhotoStatus no banco: ${totalPhotoStatus}`);
            
            await mongoose.disconnect();
            
        } catch (error) {
            console.error('❌ Erro fatal:', error);
            await mongoose.disconnect();
            process.exit(1);
        }
    }
}

const populator = new PopulatePhotoStatus();
populator.execute();
