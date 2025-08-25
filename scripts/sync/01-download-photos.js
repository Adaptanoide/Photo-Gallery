#!/usr/bin/env node

/**
 * DOWNLOAD DE FOTOS DO GOOGLE DRIVE
 * Baixa as fotos faltantes em lotes com controle de progresso
 */

const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
require('dotenv').config();

class PhotoDownloader {
    constructor() {
        this.drive = null;
        this.downloadDir = path.join(__dirname, '../../../sync-workspace/downloads');
        this.progressFile = path.join(__dirname, '../../../sync-workspace/logs/download-progress.json');
        this.stats = {
            total: 0,
            downloaded: 0,
            skipped: 0,
            errors: 0,
            startTime: Date.now()
        };
        this.batchSize = 10; // Baixar 10 por vez
    }

    async init() {
        // Criar pasta de downloads se não existir
        if (!fs.existsSync(this.downloadDir)) {
            fs.mkdirSync(this.downloadDir, { recursive: true });
        }

        // Carregar progresso anterior se existir
        if (fs.existsSync(this.progressFile)) {
            const progress = JSON.parse(fs.readFileSync(this.progressFile));
            console.log(`📊 Continuando download anterior: ${progress.downloaded}/${progress.total}`);
            this.stats = progress;
        }

        // Inicializar Google Drive
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

    async loadPhotosToDownload() {
        const locationsFile = path.join(__dirname, '../../../sync-workspace/reports/missing-photos-locations.json');
        if (!fs.existsSync(locationsFile)) {
            throw new Error('Arquivo missing-photos-locations.json não encontrado! Execute find-missing-photos primeiro.');
        }

        const data = JSON.parse(fs.readFileSync(locationsFile));
        this.stats.total = data.photos.length;
        
        // Filtrar apenas as que ainda não foram baixadas
        const progress = this.loadProgress();
        const toDownload = data.photos.filter(p => !progress.completed.includes(p.number));
        
        console.log(`📊 Total: ${this.stats.total} | Já baixadas: ${progress.completed.length} | Faltam: ${toDownload.length}`);
        return toDownload;
    }

    loadProgress() {
        if (fs.existsSync(this.progressFile)) {
            return JSON.parse(fs.readFileSync(this.progressFile));
        }
        return { completed: [], failed: [] };
    }

    saveProgress() {
        const progress = {
            ...this.stats,
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync(this.progressFile, JSON.stringify(progress, null, 2));
    }

    async downloadPhoto(photo) {
        try {
            // Criar estrutura de pastas
            const folderPath = path.join(this.downloadDir, photo.path);
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }

            const filePath = path.join(folderPath, photo.fileName);
            
            // Verificar se já existe
            if (fs.existsSync(filePath)) {
                console.log(`⏭️  Já existe: ${photo.fileName}`);
                this.stats.skipped++;
                return true;
            }

            // Baixar arquivo
            console.log(`�� Baixando: ${photo.path}/${photo.fileName}`);
            const response = await this.drive.files.get(
                { fileId: photo.driveId, alt: 'media' },
                { responseType: 'stream' }
            );

            // Salvar arquivo
            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    this.stats.downloaded++;
                    console.log(`  ✅ Salvo: ${filePath}`);
                    resolve(true);
                });
                writer.on('error', reject);
            });

        } catch (error) {
            console.error(`  ❌ Erro ao baixar ${photo.fileName}: ${error.message}`);
            this.stats.errors++;
            return false;
        }
    }

    async downloadBatch(photos) {
        const results = await Promise.all(
            photos.map(photo => this.downloadPhoto(photo))
        );
        return results;
    }

    showStats() {
        const elapsed = (Date.now() - this.stats.startTime) / 1000 / 60;
        const rate = this.stats.downloaded / elapsed;
        const remaining = (this.stats.total - this.stats.downloaded) / rate;

        console.log('\n' + '='.repeat(50));
        console.log('📊 ESTATÍSTICAS:');
        console.log(`  Total: ${this.stats.total}`);
        console.log(`  Baixadas: ${this.stats.downloaded}`);
        console.log(`  Puladas: ${this.stats.skipped}`);
        console.log(`  Erros: ${this.stats.errors}`);
        console.log(`  Tempo: ${elapsed.toFixed(1)} min`);
        console.log(`  Velocidade: ${rate.toFixed(1)} fotos/min`);
        console.log(`  Tempo restante: ${remaining.toFixed(1)} min`);
        console.log('='.repeat(50));
    }

    async execute() {
        try {
            console.log('\n🚀 INICIANDO DOWNLOAD DE FOTOS DO DRIVE\n');
            
            await this.init();
            const photos = await this.loadPhotosToDownload();

            if (photos.length === 0) {
                console.log('✅ Todas as fotos já foram baixadas!');
                return;
            }

            console.log(`\n📥 Baixando ${photos.length} fotos em lotes de ${this.batchSize}...\n`);

            // Processar em lotes
            for (let i = 0; i < photos.length; i += this.batchSize) {
                const batch = photos.slice(i, i + this.batchSize);
                console.log(`\n📦 Lote ${Math.floor(i/this.batchSize) + 1}/${Math.ceil(photos.length/this.batchSize)}`);
                
                await this.downloadBatch(batch);
                
                // Salvar progresso a cada lote
                this.saveProgress();
                
                // Mostrar estatísticas a cada 50 fotos
                if ((i + this.batchSize) % 50 === 0) {
                    this.showStats();
                }
            }

            this.showStats();
            console.log('\n✅ DOWNLOAD CONCLUÍDO!');

        } catch (error) {
            console.error('❌ Erro fatal:', error);
            this.saveProgress();
            process.exit(1);
        }
    }
}

// Perguntar confirmação
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('\n⚠️  ATENÇÃO: Vamos baixar 641 fotos do Google Drive!');
console.log('📊 Isso pode levar ~30-60 minutos');
console.log('💾 Espaço necessário: ~6.4GB\n');

readline.question('Deseja continuar? (yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes') {
        const downloader = new PhotoDownloader();
        downloader.execute();
    } else {
        console.log('❌ Cancelado pelo usuário');
        process.exit(0);
    }
    readline.close();
});
