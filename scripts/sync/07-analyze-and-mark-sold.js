#!/usr/bin/env node

/**
 * ANÁLISE FINAL E MARCAÇÃO DE FOTOS VENDIDAS
 */

require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('../../src/models/PhotoStatus');
const { google } = require('googleapis');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

class AnalyzeAndMarkSold {
    constructor() {
        this.drive = null;
        this.r2Client = null;
        this.drivePhotos = new Set();
        this.r2Photos = new Set();
        this.photoStatusRecords = new Map();
    }

    async initServices() {
        // Google Drive
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
            },
            scopes: ['https://www.googleapis.com/auth/drive.readonly']
        });
        const authClient = await auth.getClient();
        this.drive = google.drive({ version: 'v3', auth: authClient });
        
        // R2
        this.r2Client = new S3Client({
            region: 'auto',
            endpoint: process.env.R2_ENDPOINT,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            }
        });
        
        // MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('✅ Todos os serviços conectados\n');
    }

    extractPhotoNumber(filename) {
        const match = filename.match(/(\d{4,6})/);
        return match ? match[1] : null;
    }

    async getDrivePhotos(folderId, path = '') {
        let pageToken = null;
        do {
            const response = await this.drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'nextPageToken, files(id, name, mimeType)',
                pageSize: 1000,
                pageToken: pageToken
            });

            for (const file of response.data.files) {
                if (file.mimeType === 'application/vnd.google-apps.folder') {
                    await this.getDrivePhotos(file.id, `${path}/${file.name}`);
                } else if (file.mimeType && file.mimeType.startsWith('image/')) {
                    const photoNumber = this.extractPhotoNumber(file.name);
                    if (photoNumber) {
                        this.drivePhotos.add(photoNumber);
                    }
                }
            }
            pageToken = response.data.nextPageToken;
        } while (pageToken);
    }

    async getR2Photos() {
        let continuationToken = null;
        do {
            const command = new ListObjectsV2Command({
                Bucket: process.env.R2_BUCKET_NAME,
                MaxKeys: 1000,
                ContinuationToken: continuationToken
            });
            
            const response = await this.r2Client.send(command);
            
            if (response.Contents) {
                for (const obj of response.Contents) {
                    if (!obj.Key.startsWith('_thumbnails/') && 
                        !obj.Key.startsWith('_preview/') && 
                        !obj.Key.startsWith('_display/')) {
                        const photoNumber = this.extractPhotoNumber(obj.Key);
                        if (photoNumber) {
                            this.r2Photos.add(photoNumber);
                        }
                    }
                }
            }
            continuationToken = response.NextContinuationToken;
        } while (continuationToken);
    }

    async getPhotoStatusRecords() {
        const records = await PhotoStatus.find({});
        records.forEach(record => {
            const photoNumber = this.extractPhotoNumber(record.fileName);
            if (photoNumber) {
                this.photoStatusRecords.set(photoNumber, record);
            }
        });
    }

    async execute() {
        try {
            console.log('\n🔍 ANÁLISE COMPLETA PARA MARCAR VENDIDAS\n');
            
            await this.initServices();
            
            // 1. Buscar fotos do Drive
            console.log('📸 Analisando Google Drive...');
            await this.getDrivePhotos(process.env.DRIVE_FOLDER_AVAILABLE);
            console.log(`  ✅ ${this.drivePhotos.size} fotos no Drive`);
            
            // 2. Buscar fotos do R2
            console.log('📸 Analisando R2...');
            await this.getR2Photos();
            console.log(`  ✅ ${this.r2Photos.size} fotos no R2`);
            
            // 3. Buscar PhotoStatus
            console.log('📸 Analisando PhotoStatus...');
            await this.getPhotoStatusRecords();
            console.log(`  ✅ ${this.photoStatusRecords.size} registros no banco\n`);
            
            // 4. Identificar vendidas (no R2 mas não no Drive)
            const soldPhotos = [];
            for (const photoNum of this.r2Photos) {
                if (!this.drivePhotos.has(photoNum)) {
                    soldPhotos.push(photoNum);
                }
            }
            
            console.log('=' + '='.repeat(50));
            console.log('📊 RESULTADO DA ANÁLISE:');
            console.log(`  Fotos no Drive: ${this.drivePhotos.size}`);
            console.log(`  Fotos no R2: ${this.r2Photos.size}`);
            console.log(`  PhotoStatus: ${this.photoStatusRecords.size}`);
            console.log(`  VENDIDAS (no R2 mas não no Drive): ${soldPhotos.length}`);
            console.log('=' + '='.repeat(50));
            
            if (soldPhotos.length === 0) {
                console.log('\n✅ Nenhuma foto para marcar como vendida!');
                await mongoose.disconnect();
                return;
            }
            
            // Perguntar se quer marcar
            console.log('\n📝 Primeiras 10 fotos vendidas:');
            soldPhotos.slice(0, 10).forEach(num => console.log(`  - ${num}`));
            if (soldPhotos.length > 10) {
                console.log(`  ... e mais ${soldPhotos.length - 10} fotos`);
            }
            
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            readline.question(`\n⚠️ Marcar ${soldPhotos.length} fotos como VENDIDAS? (yes/no): `, async (answer) => {
                if (answer.toLowerCase() === 'yes') {
                    // Marcar como vendidas
                    let marked = 0;
                    let notFound = 0;
                    
                    for (const photoNum of soldPhotos) {
                        const record = this.photoStatusRecords.get(photoNum);
                        if (record) {
                            record.virtualStatus = {
                                status: 'sold',
                                tags: ['sold', `sold_${new Date().toISOString().split('T')[0]}`],
                                lastStatusChange: new Date()
                            };
                            await record.save();
                            marked++;
                            
                            if (marked % 50 === 0) {
                                console.log(`  ✅ ${marked} fotos marcadas...`);
                            }
                        } else {
                            notFound++;
                        }
                    }
                    
                    console.log('\n' + '='.repeat(50));
                    console.log('✅ CONCLUÍDO:');
                    console.log(`  Marcadas como vendidas: ${marked}`);
                    console.log(`  Não encontradas no banco: ${notFound}`);
                    console.log('='.repeat(50));
                }
                
                await mongoose.disconnect();
                readline.close();
            });
            
        } catch (error) {
            console.error('❌ Erro:', error);
            await mongoose.disconnect();
            process.exit(1);
        }
    }
}

const analyzer = new AnalyzeAndMarkSold();
analyzer.execute();
