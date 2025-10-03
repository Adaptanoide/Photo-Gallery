/**
 * Sync Engine
 * Motor principal que coordena toda a sincronização
 */

const path = require('path');
const CategoryChecker = require('./category-checker');
const fs = require('fs');

class SyncEngine {
    constructor(services, state) {
        this.drive = services.drive;
        this.r2 = services.r2;
        this.db = services.db;
        this.processor = services.processor;
        this.state = state;
        this.categoryChecker = new CategoryChecker();

        this.analysis = {
            drivePhotos: [],
            r2Photos: [],
            dbPhotos: [],
            newPhotos: [],
            soldPhotos: [],
            availablePhotos: []
        };
    }

    // Extrair número da foto
    extractPhotoNumber(filename) {
        const match = filename.match(/(\d{4,6})/);
        return match ? match[1] : null;
    }

    // Análise completa
    async analyze() {
        console.log('  📷 Listando fotos do Google Drive...');
        this.analysis.drivePhotos = await this.drive.listAllPhotos();
        const driveNumbers = new Set(this.analysis.drivePhotos.map(p => p.number));
        console.log(`     ✔ ${this.analysis.drivePhotos.length} fotos encontradas`);

        console.log('  ☁️  Listando fotos do R2...');
        this.analysis.r2Photos = await this.r2.listAllPhotos();
        const r2Numbers = new Set(this.analysis.r2Photos.map(p => p.number));
        console.log(`     ✔ ${this.analysis.r2Photos.length} fotos encontradas`);

        console.log('  💾 Listando registros do banco...');
        const dbRecords = await this.db.getAllPhotos();
        this.analysis.dbPhotos = dbRecords.map(record => ({
            number: record.photoId,
            status: record.virtualStatus.status
        }));
        console.log(`     ✔ ${this.analysis.dbPhotos.length} registros encontrados`);

        // Análise de diferenças
        console.log('  🔍 Analisando diferenças...');

        // Fotos NOVAS (no Drive mas não no R2)
        this.analysis.newPhotos = this.analysis.drivePhotos.filter(
            photo => !r2Numbers.has(photo.number)
        );

        // Criar mapa de status do banco
        const dbStatusMap = new Map();
        this.analysis.dbPhotos.forEach(photo => {
            dbStatusMap.set(photo.number, photo.status);
        });

        // Fotos VENDIDAS - apenas as que estão "available" no banco mas não no Drive
        this.analysis.soldPhotos = [];
        for (const photo of this.analysis.r2Photos) {
            const dbStatus = dbStatusMap.get(photo.number);

            // Só marca como vendida se:
            // 1. Está no R2
            // 2. NÃO está no Drive  
            // 3. Está marcada como "available" no banco (não foi vendida antes)
            if (!driveNumbers.has(photo.number) && dbStatus === 'available') {
                this.analysis.soldPhotos.push(photo);
            }
        }

        // Fotos já vendidas anteriormente (ignoradas)
        this.analysis.previouslySold = this.analysis.r2Photos.filter(photo => {
            const dbStatus = dbStatusMap.get(photo.number);
            return dbStatus === 'sold';
        });

        // Fotos DISPONÍVEIS (em ambos)
        this.analysis.availablePhotos = this.analysis.drivePhotos.filter(
            photo => r2Numbers.has(photo.number)
        );

        // Criar mapa para acesso rápido
        this.analysis.driveMap = new Map(
            this.analysis.drivePhotos.map(p => [p.number, p])
        );
        this.analysis.r2Map = new Map(
            this.analysis.r2Photos.map(p => [p.number, p])
        );

        return {
            driveCount: this.analysis.drivePhotos.length,
            r2Count: this.analysis.r2Photos.length,
            dbCount: this.analysis.dbPhotos.length,
            newPhotos: this.analysis.newPhotos,
            soldPhotos: this.analysis.soldPhotos,
            availablePhotos: this.analysis.availablePhotos,
            previouslySold: this.analysis.previouslySold.length,
            totalPhotos: new Set([...driveNumbers, ...r2Numbers]).size
        };
    }

    // Download de fotos novas
    async downloadPhotos(newPhotos) {
        if (newPhotos.length === 0) return [];

        const downloadDir = path.join(this.processor.workDir, 'downloads');
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        console.log(`\n  📥 Baixando ${newPhotos.length} fotos...`);
        const results = await this.drive.downloadBatch(newPhotos, downloadDir, 10);

        // Filtrar apenas sucessos
        const successful = results.filter(r => r.success && !r.skipped);
        console.log(`  ✅ ${successful.length} fotos baixadas com sucesso`);

        // Preparar dados para próxima etapa
        return successful.map(result => ({
            ...newPhotos.find(p => result.path.includes(p.fileName)),
            fullPath: result.path,
            relativePath: result.localPath
        }));
    }

    // Processar imagens (gerar 4 versões)
    async processPhotos(downloadedPhotos) {
        if (downloadedPhotos.length === 0) return [];

        console.log(`\n  🎨 Gerando 4 versões WebP para ${downloadedPhotos.length} fotos...`);

        const results = await this.processor.processBatch(downloadedPhotos, 5);

        // Adicionar informações necessárias para upload
        const processedPhotos = results.map(result => ({
            number: this.extractPhotoNumber(result.fileName),
            fileName: result.fileName,
            path: path.dirname(result.relativePath),
            category: path.dirname(result.relativePath) || 'uncategorized',
            processedPath: this.processor.outputDir,
            relativePath: result.relativePath
        }));

        // Verificar e criar categorias novas
        console.log('\n' + '='.repeat(60));
        console.log('VERIFICACAO DE CATEGORIAS');
        console.log('='.repeat(60));

        const categoriesOk = await this.categoryChecker.checkAndCreateCategories(processedPhotos);

        if (!categoriesOk) {
            throw new Error('Categorias nao criadas - upload abortado');
        }

        return processedPhotos;
    }

    // Upload para R2
    async uploadPhotos(processedPhotos) {
        if (processedPhotos.length === 0) return [];

        console.log(`\n  ☁️  Enviando ${processedPhotos.length} fotos para R2 (4 versões cada)...`);

        const results = await this.r2.uploadBatch(
            processedPhotos,
            this.processor.outputDir,
            3
        );

        // Filtrar apenas sucessos completos
        const successful = results.filter(r =>
            r.versions.every(v => v.success)
        );

        console.log(`  ✅ ${successful.length} fotos enviadas com sucesso`);

        // Preparar dados para banco
        return successful.map(result => {
            const photo = processedPhotos.find(p => p.number === result.photo);
            const originalVersion = result.versions.find(v => v.type === 'original');

            return {
                number: result.photo,
                fileName: photo.fileName,
                r2Key: originalVersion.key,
                category: photo.category
            };
        });
    }

    // Atualizar banco de dados
    async updateDatabase(uploadedPhotos) {
        if (uploadedPhotos.length === 0) return;

        console.log(`  💾 Atualizando ${uploadedPhotos.length} registros no banco...`);

        const results = await this.db.upsertPhotoBatch(uploadedPhotos);

        const created = results.filter(r => r.success && r.action === 'created').length;
        const updated = results.filter(r => r.success && r.action === 'updated').length;
        const errors = results.filter(r => !r.success).length;

        console.log(`     ✓ ${created} criados, ${updated} atualizados`);
        if (errors > 0) {
            console.log(`     ⚠️  ${errors} erros`);
        }
    }

    // Marcar fotos como vendidas
    async markPhotosAsSold(soldPhotos) {
        const results = [];
        let processed = 0;

        for (const photo of soldPhotos) {
            const result = await this.db.markPhotoAsSold(photo.number);
            results.push(result);
            processed++;

            // Mostrar progresso a cada 50
            if (processed % 50 === 0) {
                console.log(`     ✓ ${processed}/${soldPhotos.length} processadas...`);
            }
        }

        const successful = results.filter(r => r.success).length;
        console.log(`  ✅ ${successful} fotos marcadas como vendidas`);

        return results;
    }

    // Verificar integridade do sistema
    async verifyIntegrity() {
        console.log('\n  🔍 Verificando integridade do sistema...');

        // Obter estatísticas
        const driveStats = await this.drive.getStats();
        const r2Stats = await this.r2.getStats();
        const dbStats = await this.db.getStats();

        console.log('\n  📊 ESTATÍSTICAS DO SISTEMA:');
        console.log('  ─────────────────────────');
        console.log(`  Google Drive: ${driveStats.total} fotos`);
        console.log(`  Cloudflare R2: ${r2Stats.total} fotos (${r2Stats.totalSize})`);
        console.log(`  MongoDB: ${dbStats.total} registros`);
        console.log(`    • Disponíveis: ${dbStats.available} (${dbStats.percentAvailable}%)`);
        console.log(`    • Vendidas: ${dbStats.sold} (${dbStats.percentSold}%)`);
        console.log(`    • Reservadas: ${dbStats.reserved}`);

        // Verificar consistência
        const issues = [];

        // Fotos no R2 sem registro no banco
        const dbNumbers = new Set(this.analysis.dbPhotos.map(p => p.number));
        const r2WithoutDb = this.analysis.r2Photos.filter(p => !dbNumbers.has(p.number));
        if (r2WithoutDb.length > 0) {
            issues.push(`${r2WithoutDb.length} fotos no R2 sem registro no banco`);
        }

        // Registros no banco sem foto no R2
        const r2Numbers = new Set(this.analysis.r2Photos.map(p => p.number));
        const dbWithoutR2 = this.analysis.dbPhotos.filter(p => !r2Numbers.has(p.number));
        if (dbWithoutR2.length > 0) {
            issues.push(`${dbWithoutR2.length} registros no banco sem foto no R2`);
        }

        if (issues.length > 0) {
            console.log('\n  ⚠️  PROBLEMAS ENCONTRADOS:');
            issues.forEach(issue => console.log(`     • ${issue}`));
        } else {
            console.log('\n  ✅ Sistema 100% íntegro!');
        }

        return {
            driveStats,
            r2Stats,
            dbStats,
            issues
        };
    }

    // Limpar arquivos temporários
    async cleanup() {
        console.log('  🧹 Limpando arquivos temporários...');

        // Limpar downloads
        const downloadDir = path.join(this.processor.workDir, 'downloads');
        if (fs.existsSync(downloadDir)) {
            this.removeDirectory(downloadDir);
        }

        // Limpar processados
        await this.processor.cleanup();

        console.log('     ✓ Arquivos temporários removidos');
    }

    // Remover diretório recursivamente
    removeDirectory(dirPath) {
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach(file => {
                const curPath = path.join(dirPath, file);
                if (fs.lstatSync(curPath).isDirectory()) {
                    this.removeDirectory(curPath);
                } else {
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(dirPath);
        }
    }
}

module.exports = SyncEngine;