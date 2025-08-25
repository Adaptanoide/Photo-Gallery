#!/usr/bin/env node

/**
 * PROCESSAMENTO DE IMAGENS - GERA 4 VERSÕES
 * Original, Display, Preview e Thumbnail
 */

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

class ImageProcessor {
    constructor() {
        this.inputDir = path.join(__dirname, '../../../sync-workspace/downloads');
        this.outputDir = path.join(__dirname, '../../../sync-workspace/ready');
        this.progressFile = path.join(__dirname, '../../../sync-workspace/logs/processing-progress.json');
        this.stats = {
            total: 0,
            processed: 0,
            skipped: 0,
            errors: 0,
            startTime: Date.now()
        };
        this.batchSize = 5; // Processar 5 por vez (20 arquivos totais)
    }

    async init() {
        // Criar estrutura de saída
        ['', '_thumbnails', '_preview', '_display'].forEach(prefix => {
            const dir = path.join(this.outputDir, prefix);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        console.log('✅ Estrutura de pastas criada');
    }

    findAllImages(dir, baseDir = dir) {
        let images = [];
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                images = images.concat(this.findAllImages(fullPath, baseDir));
            } else if (item.match(/\.(jpg|jpeg|png)$/i)) {
                const relativePath = path.relative(baseDir, fullPath);
                images.push({
                    fullPath,
                    relativePath,
                    fileName: item,
                    dirPath: path.dirname(relativePath)
                });
            }
        }
        
        return images;
    }

    async processImage(image) {
        try {
            console.log(`\n🖼️ Processando: ${image.relativePath}`);
            
            // Ler imagem original
            const inputBuffer = await fs.promises.readFile(image.fullPath);
            const metadata = await sharp(inputBuffer).metadata();
            console.log(`  📏 Original: ${metadata.width}x${metadata.height} (${(fs.statSync(image.fullPath).size / 1024 / 1024).toFixed(1)}MB)`);
            
            // Nome base sem extensão
            const baseName = path.basename(image.fileName, path.extname(image.fileName));
            const outputName = `${baseName}.webp`;
            
            // Criar pastas de saída
            const outputPaths = {
                original: path.join(this.outputDir, image.dirPath),
                thumbnail: path.join(this.outputDir, '_thumbnails', image.dirPath),
                preview: path.join(this.outputDir, '_preview', image.dirPath),
                display: path.join(this.outputDir, '_display', image.dirPath)
            };
            
            // Criar todas as pastas necessárias
            Object.values(outputPaths).forEach(dir => {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
            });
            
            // 1. ORIGINAL - WebP 98%
            console.log('  📦 Gerando original...');
            const originalBuffer = await sharp(inputBuffer)
                .webp({ quality: 98 })
                .toBuffer();
            await fs.promises.writeFile(
                path.join(outputPaths.original, outputName),
                originalBuffer
            );
            console.log(`    ✅ Original: ${(originalBuffer.length / 1024 / 1024).toFixed(1)}MB`);
            
            // 2. DISPLAY - 2400px, 95%
            console.log('  📦 Gerando display...');
            const displayBuffer = await sharp(inputBuffer)
                .resize(2400, 2400, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .webp({ quality: 95 })
                .toBuffer();
            await fs.promises.writeFile(
                path.join(outputPaths.display, outputName),
                displayBuffer
            );
            console.log(`    ✅ Display: ${(displayBuffer.length / 1024).toFixed(0)}KB`);
            
            // 3. PREVIEW - 1400px, 90%
            console.log('  📦 Gerando preview...');
            const previewBuffer = await sharp(inputBuffer)
                .resize(1400, 1400, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .webp({ quality: 90 })
                .toBuffer();
            await fs.promises.writeFile(
                path.join(outputPaths.preview, outputName),
                previewBuffer
            );
            console.log(`    ✅ Preview: ${(previewBuffer.length / 1024).toFixed(0)}KB`);
            
            // 4. THUMBNAIL - 450px, 85%
            console.log('  📦 Gerando thumbnail...');
            const thumbnailBuffer = await sharp(inputBuffer)
                .resize(450, 450, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .webp({ quality: 85 })
                .toBuffer();
            await fs.promises.writeFile(
                path.join(outputPaths.thumbnail, outputName),
                thumbnailBuffer
            );
            console.log(`    ✅ Thumbnail: ${(thumbnailBuffer.length / 1024).toFixed(0)}KB`);
            
            this.stats.processed++;
            return true;
            
        } catch (error) {
            console.error(`  ❌ Erro: ${error.message}`);
            this.stats.errors++;
            return false;
        }
    }

    async processBatch(images) {
        const results = await Promise.all(
            images.map(image => this.processImage(image))
        );
        return results;
    }

    showStats() {
        const elapsed = (Date.now() - this.stats.startTime) / 1000 / 60;
        const rate = this.stats.processed / elapsed;
        const remaining = (this.stats.total - this.stats.processed) / rate;

        console.log('\n' + '='.repeat(50));
        console.log('📊 ESTATÍSTICAS:');
        console.log(`  Total: ${this.stats.total}`);
        console.log(`  Processadas: ${this.stats.processed}`);
        console.log(`  Erros: ${this.stats.errors}`);
        console.log(`  Tempo: ${elapsed.toFixed(1)} min`);
        console.log(`  Velocidade: ${rate.toFixed(1)} fotos/min`);
        console.log(`  Tempo restante: ${remaining.toFixed(1)} min`);
        console.log(`  Arquivos gerados: ${this.stats.processed * 4}`);
        console.log('='.repeat(50));
    }

    async execute() {
        try {
            console.log('\n🚀 INICIANDO PROCESSAMENTO DE IMAGENS\n');
            
            await this.init();
            
            // Encontrar todas as imagens baixadas
            const images = this.findAllImages(this.inputDir);
            this.stats.total = images.length;
            
            console.log(`�� Encontradas ${images.length} imagens para processar`);
            console.log(`📦 Serão gerados ${images.length * 4} arquivos WebP\n`);
            
            // Processar em lotes
            for (let i = 0; i < images.length; i += this.batchSize) {
                const batch = images.slice(i, i + this.batchSize);
                console.log(`\n📦 Lote ${Math.floor(i/this.batchSize) + 1}/${Math.ceil(images.length/this.batchSize)}`);
                
                await this.processBatch(batch);
                
                // Mostrar estatísticas a cada 20 fotos
                if ((i + this.batchSize) % 20 === 0) {
                    this.showStats();
                }
            }
            
            this.showStats();
            console.log('\n✅ PROCESSAMENTO CONCLUÍDO!');
            console.log(`📁 Arquivos prontos em: ${this.outputDir}`);
            
        } catch (error) {
            console.error('❌ Erro fatal:', error);
            process.exit(1);
        }
    }
}

// Verificar se tem imagens para processar
const downloadDir = path.join(__dirname, '../../../sync-workspace/downloads');
if (!fs.existsSync(downloadDir)) {
    console.log('❌ Pasta de downloads não encontrada! Execute o download primeiro.');
    process.exit(1);
}

const files = fs.readdirSync(downloadDir);
if (files.length === 0) {
    console.log('❌ Nenhuma imagem encontrada para processar!');
    process.exit(1);
}

console.log('\n⚠️  ATENÇÃO: Vamos processar as imagens baixadas!');
console.log('📊 Cada imagem gerará 4 versões WebP');
console.log('⏱️  Isso pode levar 30-60 minutos\n');

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

readline.question('Deseja continuar? (yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes') {
        const processor = new ImageProcessor();
        processor.execute();
    } else {
        console.log('❌ Cancelado pelo usuário');
        process.exit(0);
    }
    readline.close();
});
