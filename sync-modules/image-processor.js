/**
 * Image Processor
 * Processa imagens gerando 4 versões WebP
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

class ImageProcessor {
    constructor(workDir) {
        this.workDir = workDir;
        this.outputDir = path.join(workDir, 'processed');

        // Configurações das 4 versões
        this.versions = {
            original: {
                prefix: '',
                resize: null,
                quality: 98,
                description: 'Original em alta qualidade'
            },
            display: {
                prefix: '_display',
                resize: { width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true },
                quality: 95,
                description: 'Display (2400px, 95%)'
            },
            preview: {
                prefix: '_preview',
                resize: { width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true },
                quality: 90,
                description: 'Preview (1400px, 90%)'
            },
            thumbnail: {
                prefix: '_thumbnails',
                resize: { width: 450, height: 450, fit: 'inside', withoutEnlargement: true },
                quality: 85,
                description: 'Thumbnail (450px, 85%)'
            }
        };
    }

    // Criar estrutura de pastas
    async init() {
        Object.values(this.versions).forEach(version => {
            const dir = path.join(this.outputDir, version.prefix);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    // Processar uma imagem
    async processImage(inputPath, relativePath) {
        try {
            // Verificar se arquivo existe
            if (!fs.existsSync(inputPath)) {
                return { success: false, error: 'File not found' };
            }

            // Ler imagem e obter metadata
            const inputBuffer = await fs.promises.readFile(inputPath);
            const metadata = await sharp(inputBuffer).metadata();

            // Nome do arquivo WebP
            const originalName = path.basename(inputPath);
            let webpName;
            if (originalName.match(/\.(jpg|jpeg|png)$/i)) {
                webpName = originalName.replace(/\.(jpg|jpeg|png)$/i, '.webp');
            } else {
                webpName = originalName.includes('.webp') ? originalName : originalName + '.webp';
            }

            // Criar pasta de destino para cada versão
            const folderPath = path.dirname(relativePath);
            const results = [];

            // Processar cada versão
            for (const [versionName, config] of Object.entries(this.versions)) {
                try {
                    // Criar pasta de destino
                    const outputFolder = path.join(this.outputDir, config.prefix, folderPath);
                    if (!fs.existsSync(outputFolder)) {
                        fs.mkdirSync(outputFolder, { recursive: true });
                    }

                    const outputPath = path.join(outputFolder, webpName);

                    // Aplicar transformações
                    let sharpInstance = sharp(inputBuffer);

                    // Resize se necessário
                    if (config.resize) {
                        sharpInstance = sharpInstance.resize(config.resize);
                    }

                    // Converter para WebP
                    const outputBuffer = await sharpInstance
                        .webp({ quality: config.quality })
                        .toBuffer();

                    // Salvar arquivo
                    await fs.promises.writeFile(outputPath, outputBuffer);

                    results.push({
                        version: versionName,
                        success: true,
                        path: outputPath,
                        size: outputBuffer.length,
                        sizeKB: (outputBuffer.length / 1024).toFixed(1)
                    });

                } catch (error) {
                    results.push({
                        version: versionName,
                        success: false,
                        error: error.message
                    });
                }
            }

            return {
                success: true,
                fileName: webpName,
                originalSize: metadata.width + 'x' + metadata.height,
                originalSizeMB: (fs.statSync(inputPath).size / 1024 / 1024).toFixed(1),
                versions: results,
                relativePath: path.join(folderPath, webpName)
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Processar múltiplas imagens
    async processBatch(photos, batchSize = 5) {
        await this.init();

        const results = [];
        let processed = 0;
        let errors = 0;

        console.log(`\n  🖼️  Processando ${photos.length} imagens...`);

        for (let i = 0; i < photos.length; i += batchSize) {
            const batch = photos.slice(i, i + batchSize);
            console.log(`  📦 Processando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(photos.length / batchSize)}`);

            const batchPromises = batch.map(photo =>
                this.processImage(photo.fullPath, photo.relativePath)
            );

            const batchResults = await Promise.all(batchPromises);

            batchResults.forEach(result => {
                if (result.success) {
                    processed++;
                    console.log(`     ✓ ${path.basename(result.fileName)} - 4 versões criadas`);
                } else {
                    errors++;
                    console.log(`     ✗ Erro: ${result.error}`);
                }
                results.push(result);
            });

            // Mostrar progresso
            console.log(`     Status: ${processed} processadas, ${errors} erros`);
        }

        // Resumo final
        console.log('\n  📊 Resumo do processamento:');
        console.log(`     ✅ Processadas: ${processed}`);
        console.log(`     ❌ Erros: ${errors}`);
        console.log(`     📁 Total de arquivos gerados: ${processed * 4}`);

        return results.filter(r => r.success);
    }

    // Limpar arquivos processados
    async cleanup() {
        if (fs.existsSync(this.outputDir)) {
            // Remover recursivamente
            const removeDir = (dirPath) => {
                if (fs.existsSync(dirPath)) {
                    fs.readdirSync(dirPath).forEach(file => {
                        const curPath = path.join(dirPath, file);
                        if (fs.lstatSync(curPath).isDirectory()) {
                            removeDir(curPath);
                        } else {
                            fs.unlinkSync(curPath);
                        }
                    });
                    fs.rmdirSync(dirPath);
                }
            };

            removeDir(this.outputDir);
        }
    }

    // Obter estatísticas dos arquivos processados
    getProcessedStats() {
        const stats = {
            total: 0,
            byVersion: {},
            totalSize: 0
        };

        if (!fs.existsSync(this.outputDir)) {
            return stats;
        }

        Object.entries(this.versions).forEach(([name, config]) => {
            const versionDir = path.join(this.outputDir, config.prefix);
            if (fs.existsSync(versionDir)) {
                const files = this.getAllFiles(versionDir);
                stats.byVersion[name] = {
                    count: files.length,
                    totalSize: files.reduce((sum, file) => sum + fs.statSync(file).size, 0)
                };
                stats.total += files.length;
                stats.totalSize += stats.byVersion[name].totalSize;
            }
        });

        return stats;
    }

    // Obter todos os arquivos de um diretório recursivamente
    getAllFiles(dirPath, arrayOfFiles = []) {
        const files = fs.readdirSync(dirPath);

        files.forEach(file => {
            const filePath = path.join(dirPath, file);
            if (fs.statSync(filePath).isDirectory()) {
                arrayOfFiles = this.getAllFiles(filePath, arrayOfFiles);
            } else {
                arrayOfFiles.push(filePath);
            }
        });

        return arrayOfFiles;
    }
}

module.exports = ImageProcessor;