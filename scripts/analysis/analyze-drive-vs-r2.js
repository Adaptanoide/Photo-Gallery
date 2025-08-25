// scripts/analyze-drive-vs-r2.js
require('dotenv').config();
const { google } = require('googleapis');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

class DriveR2Analyzer {
    constructor() {
        this.drive = null;
        this.r2Client = null;
        this.stats = {
            drivePhotos: new Set(),
            r2Photos: new Set(),
            driveByCategory: {},
            r2ByCategory: {},
            missingInR2: [],
            missingInDrive: [],
            timestamp: new Date()
        };
    }

    // Inicializar Google Drive
    async initDrive() {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
            },
            scopes: ['https://www.googleapis.com/auth/drive.readonly']
        });

        const authClient = await auth.getClient();
        this.drive = google.drive({ version: 'v3', auth: authClient });
        console.log('✅ Google Drive conectado');
    }

    // Inicializar R2
    initR2() {
        this.r2Client = new S3Client({
            region: 'auto',
            endpoint: process.env.R2_ENDPOINT,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            }
        });
        console.log('✅ R2 conectado');
    }

    // Extrair número da foto
    extractPhotoNumber(filename) {
        const match = filename.match(/(\d{4,6})/);
        return match ? match[1] : null;
    }

    // Listar fotos do Drive recursivamente
    async listDrivePhotos(folderId, folderPath = '') {
        try {
            let pageToken = null;
            let allFiles = [];

            do {
                const response = await this.drive.files.list({
                    q: `'${folderId}' in parents and trashed = false`,
                    fields: 'nextPageToken, files(id, name, mimeType)',
                    pageSize: 1000,
                    pageToken: pageToken
                });

                allFiles = allFiles.concat(response.data.files);
                pageToken = response.data.nextPageToken;
            } while (pageToken);

            for (const file of allFiles) {
                if (file.mimeType === 'application/vnd.google-apps.folder') {
                    // Recursivamente processar subpastas
                    const newPath = folderPath ? `${folderPath}/${file.name}` : file.name;
                    console.log(`   📁 Entrando em: ${newPath}`);
                    await this.listDrivePhotos(file.id, newPath);
                } else if (file.mimeType && file.mimeType.startsWith('image/')) {
                    // É uma imagem
                    const photoNumber = this.extractPhotoNumber(file.name);
                    if (photoNumber) {
                        this.stats.drivePhotos.add(photoNumber);
                        
                        // Contar por categoria
                        const category = folderPath.split('/')[0] || 'root';
                        if (!this.stats.driveByCategory[category]) {
                            this.stats.driveByCategory[category] = 0;
                        }
                        this.stats.driveByCategory[category]++;
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Erro ao listar ${folderPath}:`, error.message);
        }
    }

    // Listar fotos do R2
    async listR2Photos() {
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
                    // Ignorar thumbnails, preview, display
                    if (!obj.Key.startsWith('_thumbnails/') && 
                        !obj.Key.startsWith('_preview/') && 
                        !obj.Key.startsWith('_display/')) {
                        
                        const photoNumber = this.extractPhotoNumber(obj.Key);
                        if (photoNumber) {
                            this.stats.r2Photos.add(photoNumber);
                            
                            // Contar por categoria
                            const category = obj.Key.split('/')[0] || 'root';
                            if (!this.stats.r2ByCategory[category]) {
                                this.stats.r2ByCategory[category] = 0;
                            }
                            this.stats.r2ByCategory[category]++;
                        }
                    }
                }
            }
            
            continuationToken = response.NextContinuationToken;
        } while (continuationToken);
    }

    // Comparar e analisar
    analyze() {
        // Fotos que faltam no R2 (novas para upload)
        for (const photoNum of this.stats.drivePhotos) {
            if (!this.stats.r2Photos.has(photoNum)) {
                this.stats.missingInR2.push(photoNum);
            }
        }

        // Fotos que faltam no Drive (vendidas)
        for (const photoNum of this.stats.r2Photos) {
            if (!this.stats.drivePhotos.has(photoNum)) {
                this.stats.missingInDrive.push(photoNum);
            }
        }

        // Ordenar
        this.stats.missingInR2.sort();
        this.stats.missingInDrive.sort();
    }

    // Gerar relatório
    generateReport() {
        const report = {
            timestamp: this.stats.timestamp,
            summary: {
                totalDrive: this.stats.drivePhotos.size,
                totalR2: this.stats.r2Photos.size,
                missingInR2: this.stats.missingInR2.length,
                missingInDrive: this.stats.missingInDrive.length
            },
            byCategory: {
                drive: this.stats.driveByCategory,
                r2: this.stats.r2ByCategory
            },
            missingInR2: this.stats.missingInR2,
            missingInDrive: this.stats.missingInDrive
        };

        // Salvar JSON
        fs.writeFileSync('drive-r2-analysis.json', JSON.stringify(report, null, 2));
        
        // Mostrar resumo
        console.log('\n' + '='.repeat(60));
        console.log('📊 RELATÓRIO DE ANÁLISE DRIVE vs R2');
        console.log('='.repeat(60));
        console.log(`\n📅 Data: ${this.stats.timestamp.toLocaleString('pt-BR')}`);
        console.log(`\n✅ TOTAIS:`);
        console.log(`   Google Drive: ${this.stats.drivePhotos.size} fotos`);
        console.log(`   R2: ${this.stats.r2Photos.size} fotos`);
        console.log(`\n🆕 FOTOS NOVAS (faltam no R2): ${this.stats.missingInR2.length}`);
        console.log(`💰 FOTOS VENDIDAS (faltam no Drive): ${this.stats.missingInDrive.length}`);
        
        console.log(`\n📂 POR CATEGORIA (Drive):`);
        Object.entries(this.stats.driveByCategory)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([cat, count]) => {
                console.log(`   ${cat}: ${count} fotos`);
            });

        if (this.stats.missingInR2.length > 0) {
            console.log(`\n🆕 Primeiras 10 fotos que FALTAM NO R2:`);
            this.stats.missingInR2.slice(0, 10).forEach(num => {
                console.log(`   - ${num}`);
            });
            if (this.stats.missingInR2.length > 10) {
                console.log(`   ... e mais ${this.stats.missingInR2.length - 10} fotos`);
            }
        }

        if (this.stats.missingInDrive.length > 0) {
            console.log(`\n💰 Primeiras 10 fotos VENDIDAS:`);
            this.stats.missingInDrive.slice(0, 10).forEach(num => {
                console.log(`   - ${num}`);
            });
            if (this.stats.missingInDrive.length > 10) {
                console.log(`   ... e mais ${this.stats.missingInDrive.length - 10} fotos`);
            }
        }

        console.log('\n💾 Relatório completo salvo em: drive-r2-analysis.json\n');
    }

    // Executar análise completa
    async execute() {
        try {
            console.log('\n🚀 INICIANDO ANÁLISE DRIVE vs R2');
            console.log('='.repeat(60) + '\n');

            // 1. Conectar serviços
            await this.initDrive();
            this.initR2();

            // 2. Listar fotos do Drive
            console.log('\n📸 Listando fotos do Google Drive...');
            const driveFolderId = process.env.DRIVE_FOLDER_AVAILABLE;
            await this.listDrivePhotos(driveFolderId);
            console.log(`   ✅ ${this.stats.drivePhotos.size} fotos encontradas no Drive`);

            // 3. Listar fotos do R2
            console.log('\n📸 Listando fotos do R2...');
            await this.listR2Photos();
            console.log(`   ✅ ${this.stats.r2Photos.size} fotos encontradas no R2`);

            // 4. Analisar diferenças
            console.log('\n🔍 Analisando diferenças...');
            this.analyze();

            // 5. Gerar relatório
            this.generateReport();

        } catch (error) {
            console.error('❌ Erro:', error);
        }
    }
}

// Executar
const analyzer = new DriveR2Analyzer();
analyzer.execute();