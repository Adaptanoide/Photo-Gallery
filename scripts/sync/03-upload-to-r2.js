#!/usr/bin/env node

/**
 * UPLOAD PARA R2 - CLOUDFLARE
 * Upload das 4 versões de cada foto mantendo estrutura
 */

const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

class R2Uploader {
    constructor() {
        this.client = new S3Client({
            region: 'auto',
            endpoint: process.env.R2_ENDPOINT,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            }
        });
        
        this.readyDir = path.join(__dirname, '../../../sync-workspace/ready');
        this.progressFile = path.join(__dirname, '../../../sync-workspace/logs/upload-progress.json');
        this.stats = {
            total: 0,
            uploaded: 0,
            skipped: 0,
            errors: 0,
            startTime: Date.now()
        };
        this.batchSize = 20; // Upload 20 arquivos por vez
    }

    loadProgress() {
        if (fs.existsSync(this.progressFile)) {
            return JSON.parse(fs.readFileSync(this.progressFile));
        }
        return { completed: [], failed: [] };
    }

    saveProgress(completed, failed) {
        const progress = {
            completed,
            failed,
            stats: this.stats,
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync(this.progressFile, JSON.stringify(progress, null, 2));
    }

    async checkIfExists(key) {
        try {
            await this.client.send(new HeadObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: key
            }));
            return true;
        } catch {
            return false;
        }
    }

    async uploadFile(filePath, r2Key, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                // Verificar se já existe
                const exists = await this.checkIfExists(r2Key);
                if (exists) {
                    console.log(`  ⏭️  Já existe: ${r2Key}`);
                    this.stats.skipped++;
                    return { success: true, skipped: true };
                }

                // Ler arquivo
                const fileBuffer = await fs.promises.readFile(filePath);
                const fileSize = (fileBuffer.length / 1024).toFixed(0);

                // Upload
                console.log(`  �� Enviando: ${r2Key} (${fileSize}KB)`);
                await this.client.send(new PutObjectCommand({
                    Bucket: process.env.R2_BUCKET_NAME,
                    Key: r2Key,
                    Body: fileBuffer,
                    ContentType: 'image/webp',
                    CacheControl: 'public, max-age=31536000, immutable'
                }));

                console.log(`    ✅ Enviado: ${r2Key}`);
                this.stats.uploaded++;
                return { success: true, skipped: false };

            } catch (error) {
                console.error(`    ❌ Tentativa ${attempt}/${retries} falhou: ${error.message}`);
                if (attempt === retries) {
                    this.stats.errors++;
                    return { success: false, error: error.message };
                }
                // Esperar antes de tentar novamente
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    findAllFiles() {
        const files = [];
        const prefixes = ['', '_thumbnails', '_preview', '_display'];
        
        prefixes.forEach(prefix => {
            const dir = path.join(this.readyDir, prefix);
            if (!fs.existsSync(dir)) {
                console.log(`⚠️  Pasta não encontrada: ${dir}`);
                return;
            }
            
            // Buscar todos os arquivos .webp recursivamente
            const findFiles = (currentDir, baseDir) => {
                const items = fs.readdirSync(currentDir);
                items.forEach(item => {
                    const fullPath = path.join(currentDir, item);
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isDirectory()) {
                        findFiles(fullPath, baseDir);
                    } else if (item.endsWith('.webp')) {
                        const relativePath = path.relative(baseDir, fullPath);
                        const r2Key = prefix ? `${prefix}/${relativePath}` : relativePath;
                        
                        files.push({
                            localPath: fullPath,
                            r2Key: r2Key.replace(/\\/g, '/'), // Windows compatibility
                            prefix: prefix || 'original',
                            size: stat.size
                        });
                    }
                });
            };
            
            findFiles(dir, dir);
        });
        
        return files;
    }

    async uploadBatch(files) {
        const results = await Promise.all(
            files.map(file => this.uploadFile(file.localPath, file.r2Key))
        );
        return results;
    }

    showStats() {
        const elapsed = (Date.now() - this.stats.startTime) / 1000 / 60;
        const rate = this.stats.uploaded / elapsed;
        const remaining = (this.stats.total - this.stats.uploaded - this.stats.skipped) / rate;

        console.log('\n' + '='.repeat(50));
        console.log('📊 ESTATÍSTICAS:');
        console.log(`  Total: ${this.stats.total}`);
        console.log(`  Enviados: ${this.stats.uploaded}`);
        console.log(`  Pulados: ${this.stats.skipped}`);
        console.log(`  Erros: ${this.stats.errors}`);
        console.log(`  Tempo: ${elapsed.toFixed(1)} min`);
        console.log(`  Velocidade: ${rate.toFixed(1)} arquivos/min`);
        console.log(`  Tempo restante: ${remaining.toFixed(1)} min`);
        console.log('='.repeat(50));
    }

    groupFilesByPhoto(files) {
        const photos = {};
        
        files.forEach(file => {
            // Extrair número da foto
            const match = file.r2Key.match(/(\d{4,6})\.webp/);
            if (match) {
                const photoNum = match[1];
                if (!photos[photoNum]) {
                    photos[photoNum] = [];
                }
                photos[photoNum].push(file);
            }
        });
        
        return photos;
    }

    async execute() {
        try {
            console.log('\n🚀 INICIANDO UPLOAD PARA R2\n');
            
            // Encontrar todos os arquivos
            const files = this.findAllFiles();
            this.stats.total = files.length;
            
            if (files.length === 0) {
                console.log('❌ Nenhum arquivo encontrado para upload!');
                console.log('   Verifique se o processamento foi concluído.');
                return;
            }
            
            // Agrupar por foto
            const photoGroups = this.groupFilesByPhoto(files);
            const totalPhotos = Object.keys(photoGroups).length;
            
            console.log(`📊 Encontrados ${files.length} arquivos`);
            console.log(`📸 Total de ${totalPhotos} fotos (4 versões cada)`);
            console.log(`📦 Upload em lotes de ${this.batchSize} arquivos\n`);
            
            // Carregar progresso anterior
            const progress = this.loadProgress();
            const completed = new Set(progress.completed);
            const failed = new Set(progress.failed);
            
            // Filtrar arquivos já processados
            const toUpload = files.filter(f => !completed.has(f.r2Key) && !failed.has(f.r2Key));
            
            if (toUpload.length === 0) {
                console.log('✅ Todos os arquivos já foram enviados!');
                return;
            }
            
            console.log(`📤 Enviando ${toUpload.length} arquivos...\n`);
            
            // Upload em lotes
            for (let i = 0; i < toUpload.length; i += this.batchSize) {
                const batch = toUpload.slice(i, i + this.batchSize);
                console.log(`\n📦 Lote ${Math.floor(i/this.batchSize) + 1}/${Math.ceil(toUpload.length/this.batchSize)}`);
                
                const results = await this.uploadBatch(batch);
                
                // Atualizar progresso
                batch.forEach((file, index) => {
                    if (results[index].success) {
                        completed.add(file.r2Key);
                    } else {
                        failed.add(file.r2Key);
                    }
                });
                
                // Salvar progresso
                this.saveProgress(Array.from(completed), Array.from(failed));
                
                // Mostrar estatísticas a cada 100 arquivos
                if ((i + this.batchSize) % 100 === 0) {
                    this.showStats();
                }
            }
            
            this.showStats();
            
            if (this.stats.errors > 0) {
                console.log(`\n⚠️  ${this.stats.errors} arquivos falharam.`);
                console.log('   Execute novamente para tentar reenviar.');
            } else {
                console.log('\n✅ UPLOAD CONCLUÍDO COM SUCESSO!');
            }
            
            // Resumo final
            console.log('\n📊 RESUMO FINAL:');
            console.log(`  Fotos processadas: ${totalPhotos}`);
            console.log(`  Arquivos enviados: ${this.stats.uploaded}`);
            console.log(`  URL base: https://images.sunshinecowhides-gallery.com/`);
            
        } catch (error) {
            console.error('❌ Erro fatal:', error);
            this.saveProgress([], []);
            process.exit(1);
        }
    }
}

// Verificar se tem arquivos prontos
const readyDir = path.join(__dirname, '../../../sync-workspace/ready');
if (!fs.existsSync(readyDir)) {
    console.log('❌ Pasta ready não encontrada! Execute o processamento primeiro.');
    process.exit(1);
}

console.log('\n⚠️  ATENÇÃO: Vamos fazer upload para R2!');
console.log('📊 Isso enviará as 4 versões de cada foto');
console.log('🌐 Destino: r2:sunshine-photos');
console.log('⏱️  Tempo estimado: 30-60 minutos\n');

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

readline.question('Deseja continuar? (yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes') {
        const uploader = new R2Uploader();
        uploader.execute();
    } else {
        console.log('❌ Cancelado pelo usuário');
        process.exit(0);
    }
    readline.close();
});
