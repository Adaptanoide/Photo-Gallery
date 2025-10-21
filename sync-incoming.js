#!/usr/bin/env node

/**
 * SUNSHINE INCOMING SYNC - Processar fotos Coming Soon
 * Processa fotos da pasta INCOMING (em trânsito)
 * 
 * Execução: node sync-incoming.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Importar módulos
const DriveService = require('./sync-modules/drive-service');
const R2Service = require('./sync-modules/r2-service');
const DatabaseService = require('./sync-modules/db-service');
const ImageProcessor = require('./sync-modules/image-processor');
const PhotoCategory = require('./src/models/PhotoCategory');
const mongoose = require('mongoose');

/**
 * Sanitiza categoria removendo setas finais
 * CRÍTICO: Previne categorias com " → " no final que causam NO-QB
 */
function sanitizeCategory(category) {
    if (!category) return category;
    // Remove " → " ou "→" do final da string
    return category.replace(/\s*→\s*$/, '').trim();
}

class IncomingSync {
    constructor() {
        this.workDir = path.join(__dirname, 'sync-data');
        this.stateFile = path.join(this.workDir, 'state-incoming.json');
        this.tempDir = path.join(this.workDir, 'temp-incoming');
        this.logsDir = path.join(this.workDir, 'logs');

        this.services = {
            drive: null,
            r2: null,
            db: null,
            processor: null
        };

        this.state = {
            lastSync: null,
            inProgress: false,
            currentStep: null,
            stats: {
                incomingPhotos: 0,
                newPhotos: 0,
                photosDownloaded: 0,
                photosProcessed: 0,
                photosUploaded: 0,
                qbCodesProcessed: [],
                errors: []
            }
        };
    }

    // Criar estrutura de diretórios
    async initWorkspace() {
        const dirs = [this.workDir, this.tempDir, this.logsDir];
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    // Limpar arquivos temporários
    async cleanupTemp() {
        if (fs.existsSync(this.tempDir)) {
            fs.rmSync(this.tempDir, { recursive: true, force: true });
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    // Perguntar ao usuário
    askUser(question) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise(resolve => {
            rl.question(question, answer => {
                rl.close();
                resolve(answer);
            });
        });
    }

    // Salvar estado
    saveState() {
        fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
    }

    // Inicializar serviços
    async initServices() {
        console.log('\nInicializando serviços...');

        try {
            // Drive
            this.services.drive = new DriveService();
            await this.services.drive.init();
            console.log('  ✅ Google Drive conectado');

            // R2
            this.services.r2 = new R2Service();
            await this.services.r2.init();
            console.log('  ✅ Cloudflare R2 conectado');

            // MongoDB
            await mongoose.connect(process.env.MONGODB_URI);
            this.services.db = new DatabaseService();
            await this.services.db.connect();
            console.log('  ✅ MongoDB conectado');

            // Processador
            this.services.processor = new ImageProcessor(this.tempDir);
            console.log('  ✅ Processador de imagens pronto');

            return true;
        } catch (error) {
            console.error('❌ Erro ao inicializar:', error.message);
            return false;
        }
    }

    // Resolver QB code para path completo
    async resolveQBCodeToPath(qbCode) {
        const category = await PhotoCategory.findOne({
            qbItem: qbCode,
            isActive: true
        });

        if (category) {
            // Remover prefixo se existir
            let path = category.googleDrivePath;
            if (path.startsWith('Sunshine Cowhides Actual Pictures/')) {
                path = path.replace('Sunshine Cowhides Actual Pictures/', '');
            }
            return sanitizeCategory(path);
        }

        return null;
    }

    // Listar fotos INCOMING
    async listIncomingPhotos() {
        console.log('\nListando fotos INCOMING...');

        const incomingId = process.env.DRIVE_FOLDER_INCOMING;
        const photos = [];

        // Listar AIR e SEA
        const transportFolders = await this.services.drive.drive.files.list({
            q: `'${incomingId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`,
            fields: 'files(id, name)'
        });

        for (const transportFolder of transportFolders.data.files) {
            const transportType = transportFolder.name;
            console.log(`\n  📦 ${transportType}/`);

            // Listar invoices
            const invoices = await this.services.drive.drive.files.list({
                q: `'${transportFolder.id}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`,
                fields: 'files(id, name)'
            });

            console.log(`     ${invoices.data.files.length} invoices encontradas`);

            for (const invoice of invoices.data.files) {

                // ✅ VERIFICAR SE JÁ FOI PROCESSADO
                const alreadyProcessed = await isInvoiceProcessed(invoice.name);

                if (alreadyProcessed) {
                    console.log(`     ✅ ${invoice.name} já processado - pulando\n`);
                    continue;
                }

                console.log(`     📦 Processando invoice: ${invoice.name}`);

                // Listar QB folders
                const qbFolders = await this.services.drive.drive.files.list({
                    q: `'${invoice.id}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`,
                    fields: 'files(id, name)'
                });

                for (const qbFolder of qbFolders.data.files) {
                    const qbCode = qbFolder.name;

                    // Resolver path
                    const fullPath = await this.resolveQBCodeToPath(qbCode);

                    if (!fullPath) {
                        console.log(`     ⚠️  QB ${qbCode} não encontrado no MongoDB - pulando`);
                        continue;
                    }

                    // Listar fotos
                    const photoFiles = await this.services.drive.drive.files.list({
                        q: `'${qbFolder.id}' in parents and trashed = false and mimeType contains 'image/'`,
                        fields: 'files(id, name, mimeType)'
                    });

                    for (const file of photoFiles.data.files) {
                        const photoNumber = this.services.drive.extractPhotoNumber(file.name);
                        if (photoNumber) {
                            photos.push({
                                number: photoNumber,
                                driveId: file.id,
                                fileName: file.name,
                                qbCode: qbCode,
                                category: fullPath,
                                path: fullPath,
                                invoiceNumber: invoice.name,
                                transportType: transportType,
                                isComingSoon: true,
                                mimeType: file.mimeType
                            });
                        }
                    }
                }
            }
        }

        return photos;
    }

    // Processar fotos
    async processIncomingPhotos(photos) {
        if (photos.length === 0) {
            console.log('\n✅ Nenhuma foto nova para processar');
            return;
        }

        console.log(`\n📸 ${photos.length} fotos encontradas`);
        console.log(`⏱️  Tempo estimado: ${Math.ceil(photos.length * 0.5)} minutos`);

        const confirm = await this.askUser('\nIniciar processamento? (s/n): ');
        if (confirm.toLowerCase() !== 's') {
            console.log('⚠️  Processamento cancelado');
            return;
        }

        // Download
        console.log('\n📥 Baixando fotos...');
        const downloadDir = path.join(this.tempDir, 'downloads');
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        const downloaded = await this.services.drive.downloadBatch(photos, downloadDir, 5);
        console.log(`✅ ${downloaded.filter(d => d.success).length} fotos baixadas`);

        // Processar (4 versões)
        console.log('\n🎨 Processando imagens...');
        const downloadedPhotos = downloaded
            .filter(r => r.success && !r.skipped)
            .map(result => ({
                ...photos.find(p => result.path.includes(p.fileName)),
                fullPath: result.path,
                relativePath: result.localPath
            }));

        const processed = await this.services.processor.processBatch(downloadedPhotos, 3);
        console.log(`✅ ${processed.length} fotos processadas`);

        // Upload R2
        console.log('\n☁️  Enviando para R2...');

        // ===== CORREÇÃO: Extrair número do fileName e buscar dados originais =====
        const processedWithCategory = processed.map(p => {
            // Extrair número do fileName (5 dígitos)
            const numberMatch = p.fileName.match(/(\d{5})/);
            if (!numberMatch) {
                console.log(`   ⚠️ Arquivo sem número válido: ${p.fileName}`);
                return null;
            }
            const photoNumber = numberMatch[1];

            // Buscar foto original na lista photos
            const originalPhoto = photos.find(ph =>
                ph.number.toString().padStart(5, '0') === photoNumber
            );

            if (!originalPhoto) {
                console.log(`   ⚠️ Foto ${photoNumber} não encontrada na lista original`);
                return null;
            }

            return {
                number: photoNumber,
                fileName: p.fileName,
                path: originalPhoto.path,
                category: originalPhoto.category,
                qbCode: originalPhoto.qbCode,
                isComingSoon: true,
                processedPath: this.services.processor.outputDir,
                relativePath: p.relativePath
            };
        }).filter(p => p !== null);
        // ===== FIM DA CORREÇÃO =====

        const uploaded = await this.services.r2.uploadBatch(
            processedWithCategory,
            this.services.processor.outputDir,
            3
        );
        console.log(`✅ ${uploaded.length} fotos enviadas`);

        // Atualizar MongoDB
        console.log('\n💾 Cadastrando no MongoDB...');
        const toDatabase = uploaded.map(result => {
            const photo = processedWithCategory.find(p => p.number === result.photo);
            const originalVersion = result.versions.find(v => v.type === 'original');

            return {
                number: result.photo,
                fileName: `${result.photo}.webp`,
                r2Key: originalVersion.key,
                category: sanitizeCategory(photo.category),
                qbCode: photo.qbCode,
                isComingSoon: true
            };
        });

        await this.services.db.upsertPhotoBatch(toDatabase);
        console.log('✅ MongoDB atualizado');
    }

    // Executar
    async run() {
        try {
            console.clear();
            console.log('╔══════════════════════════════════════════════════════╗');
            console.log('║     🌟 SUNSHINE INCOMING SYNC - Coming Soon 🌟      ║');
            console.log('╚══════════════════════════════════════════════════════╝');
            console.log(`📅 ${new Date().toLocaleString('pt-BR')}\n`);

            await this.initWorkspace();

            const servicesOk = await this.initServices();
            if (!servicesOk) {
                console.error('❌ Falha ao inicializar');
                process.exit(1);
            }

            this.state.startTime = Date.now();

            const photos = await this.listIncomingPhotos();
            this.state.stats.incomingPhotos = photos.length;

            console.log(`\n📊 Total de fotos INCOMING: ${photos.length}`);

            const qbCodes = [...new Set(photos.map(p => p.qbCode))];
            console.log(`📦 QB Codes encontrados: ${qbCodes.join(', ')}`);

            await this.processIncomingPhotos(photos);

            const duration = ((Date.now() - this.state.startTime) / 1000 / 60).toFixed(1);
            console.log('\n' + '='.repeat(60));
            console.log('✅ SINCRONIZAÇÃO INCOMING COMPLETA!');
            console.log(`⏱️  Duração: ${duration} minutos`);
            console.log('='.repeat(60));

            await this.cleanupTemp();
            await mongoose.disconnect();

        } catch (error) {
            console.error('\n❌ ERRO:', error);
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// ============================================
// FUNÇÃO PARA VERIFICAR SE INVOICE JÁ FOI PROCESSADO
// ============================================
async function isInvoiceProcessed(invoiceName) {
    try {
        const mysql = require('mysql2/promise');
        const cde = await mysql.createConnection({
            host: process.env.CDE_HOST,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE,
            port: process.env.CDE_PORT
        });

        // Buscar fotos deste invoice no CDE
        const [cdePhotos] = await cde.query(`
            SELECT LPAD(ATIPOETIQUETA, 5, '0') as photoNumber
            FROM tbetiqueta
            WHERE AINVOICE = ?
            AND ATIPOETIQUETA IS NOT NULL
            AND ATIPOETIQUETA != ''
            AND ATIPOETIQUETA != '0'
        `, [invoiceName]);

        await cde.end();

        if (cdePhotos.length === 0) {
            console.log(`   ⚠️  Invoice ${invoiceName} não encontrado no CDE`);
            return false;
        }

        // Buscar quantas dessas fotos existem no MongoDB
        const UnifiedProductComplete = require('./src/models/UnifiedProductComplete');
        const photoNumbers = cdePhotos.map(p => p.photoNumber);

        const mongoCount = await UnifiedProductComplete.countDocuments({
            photoNumber: { $in: photoNumbers },
            transitStatus: 'coming_soon',
            cdeTable: 'tbetiqueta'
        });

        const processed = mongoCount === photoNumbers.length;

        console.log(`   📊 Invoice ${invoiceName}: ${mongoCount}/${photoNumbers.length} fotos ${processed ? '✅ PROCESSADO' : '❌ FALTAM'}`);

        return processed;

    } catch (error) {
        console.error(`   ❌ Erro ao verificar invoice ${invoiceName}:`, error.message);
        return false;
    }
}

// Executar
if (require.main === module) {
    const sync = new IncomingSync();

    process.on('SIGINT', async () => {
        console.log('\n\n⚠️  Interrompido');
        await sync.cleanupTemp();
        process.exit(0);
    });

    sync.run();
}