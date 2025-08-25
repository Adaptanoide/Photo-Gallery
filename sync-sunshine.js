#!/usr/bin/env node

/**
 * SUNSHINE SYNC - Sistema Unificado de Sincronização
 * Um único comando para sincronizar Google Drive ↔ R2
 * 
 * Execução: node sync-sunshine.js
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
const SyncEngine = require('./sync-modules/sync-engine');

class SunshineSync {
    constructor() {
        this.workDir = path.join(__dirname, 'sync-data');
        this.stateFile = path.join(this.workDir, 'state.json');
        this.tempDir = path.join(this.workDir, 'temp');
        this.logsDir = path.join(this.workDir, 'logs');

        this.services = {
            drive: null,
            r2: null,
            db: null,
            processor: null,
            engine: null
        };

        this.state = {
            lastSync: null,
            inProgress: false,
            currentStep: null,
            stats: {
                photosAnalyzed: 0,
                newPhotosFound: 0,
                soldPhotosFound: 0,
                photosDownloaded: 0,
                photosProcessed: 0,
                photosUploaded: 0,
                photosMarkedSold: 0,
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

        // Carregar estado anterior se existir
        if (fs.existsSync(this.stateFile)) {
            const previousState = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
            if (previousState.inProgress) {
                console.log('⚠️  Sincronização anterior não foi concluída.');
                const answer = await this.askUser('Deseja continuar de onde parou? (s/n): ');
                if (answer.toLowerCase() === 's') {
                    this.state = previousState;
                } else {
                    await this.cleanupTemp();
                }
            }
        }
    }

    // Limpar arquivos temporários
    async cleanupTemp() {
        if (fs.existsSync(this.tempDir)) {
            // Remover recursivamente todo o conteúdo
            fs.rmSync(this.tempDir, { recursive: true, force: true });
            // Recriar a pasta vazia
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
        this.state.inProgress = false;
        this.saveState();
    }

    // Salvar estado
    saveState() {
        fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
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

    // Inicializar serviços
    async initServices() {
        console.log('\n🔧 Inicializando serviços...');

        try {
            // Inicializar cada serviço
            this.services.drive = new DriveService();
            await this.services.drive.init();
            console.log('  ✅ Google Drive conectado');

            this.services.r2 = new R2Service();
            await this.services.r2.init();
            console.log('  ✅ Cloudflare R2 conectado');

            this.services.db = new DatabaseService();
            await this.services.db.connect();
            console.log('  ✅ MongoDB conectado');

            this.services.processor = new ImageProcessor(this.tempDir);
            console.log('  ✅ Processador de imagens pronto');

            this.services.engine = new SyncEngine(this.services, this.state);
            console.log('  ✅ Motor de sincronização pronto');

            return true;
        } catch (error) {
            console.error('❌ Erro ao inicializar:', error.message);
            return false;
        }
    }

    // Mostrar cabeçalho
    showHeader() {
        console.clear();
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║         🌟 SUNSHINE COWHIDES - SINCRONIZAÇÃO 🌟           ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        console.log(`📅 Data: ${new Date().toLocaleString('pt-BR')}`);
        if (this.state.lastSync) {
            console.log(`🕐 Última sync: ${new Date(this.state.lastSync).toLocaleString('pt-BR')}`);
        }
        console.log('');
    }

    // Executar análise
    async runAnalysis() {
        this.state.currentStep = 'analysis';
        this.state.inProgress = true;
        this.saveState();

        console.log('\n📊 FASE 1: ANÁLISE\n');
        console.log('Comparando Google Drive com R2...');

        const startTime = Date.now();
        const analysis = await this.services.engine.analyze();
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        // Atualizar estatísticas
        this.state.stats.photosAnalyzed = analysis.totalPhotos;
        this.state.stats.newPhotosFound = analysis.newPhotos.length;
        this.state.stats.soldPhotosFound = analysis.soldPhotos.length;
        this.saveState();

        // Mostrar resultado
        console.log('\n' + '─'.repeat(50));
        console.log('📈 RESULTADO DA ANÁLISE:');
        console.log('─'.repeat(50));
        console.log(`📸 Total no Drive: ${analysis.driveCount} fotos`);
        console.log(`☁️  Total no R2: ${analysis.r2Count} fotos`);
        console.log(`🟢 Fotos NOVAS para upload: ${analysis.newPhotos.length}`);
        console.log(`🔴 Fotos VENDIDAS para marcar: ${analysis.soldPhotos.length}`);
        console.log(`⚪ Vendidas anteriormente (ignoradas): ${analysis.previouslySold || 0}`);
        console.log(`⚡ Tempo de análise: ${elapsed}s`);
        console.log('─'.repeat(50));

        return analysis;
    }

    // Processar fotos vendidas
    async processSoldPhotos(soldPhotos) {
        if (soldPhotos.length === 0) {
            console.log('\n✅ Nenhuma foto vendida para processar');
            return;
        }

        this.state.currentStep = 'marking_sold';
        this.saveState();

        console.log('\n🔴 FASE 2: MARCAR FOTOS VENDIDAS\n');
        console.log(`Marcando ${soldPhotos.length} fotos como vendidas...`);

        // Mostrar primeiras 5
        console.log('\nPrimeiras fotos:');
        soldPhotos.slice(0, 5).forEach(photo => {
            console.log(`  - ${photo.number} (${photo.category})`);
        });
        if (soldPhotos.length > 5) {
            console.log(`  ... e mais ${soldPhotos.length - 5} fotos`);
        }

        const confirm = await this.askUser('\nConfirmar marcação como vendidas? (s/n): ');
        if (confirm.toLowerCase() !== 's') {
            console.log('⚠️  Marcação cancelada');
            return;
        }

        const startTime = Date.now();
        let marked = 0;
        let errors = 0;

        for (const photo of soldPhotos) {
            try {
                await this.services.db.markPhotoAsSold(photo.number);
                marked++;

                // Mostrar progresso a cada 50
                if (marked % 50 === 0) {
                    console.log(`  ✓ ${marked}/${soldPhotos.length} marcadas...`);
                }
            } catch (error) {
                errors++;
                this.state.stats.errors.push({
                    photo: photo.number,
                    error: error.message
                });
            }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        this.state.stats.photosMarkedSold = marked;
        this.saveState();

        console.log(`\n✅ ${marked} fotos marcadas como vendidas em ${elapsed}s`);
        if (errors > 0) {
            console.log(`⚠️  ${errors} erros durante marcação`);
        }
    }

    // Processar fotos novas
    async processNewPhotos(newPhotos) {
        if (newPhotos.length === 0) {
            console.log('\n✅ Nenhuma foto nova para processar');
            return;
        }

        console.log('\n🟢 FASE 3: PROCESSAR FOTOS NOVAS\n');
        console.log(`${newPhotos.length} fotos novas encontradas`);

        const estimatedTime = (newPhotos.length * 0.5); // ~30s por foto
        console.log(`⏱️  Tempo estimado: ${Math.ceil(estimatedTime)} minutos`);

        const confirm = await this.askUser('\nIniciar processamento? (s/n): ');
        if (confirm.toLowerCase() !== 's') {
            console.log('⚠️  Processamento cancelado');
            return;
        }

        // 3.1 - Download
        this.state.currentStep = 'downloading';
        this.saveState();
        console.log('\n📥 Baixando fotos do Drive...');

        const downloaded = await this.services.engine.downloadPhotos(newPhotos);
        this.state.stats.photosDownloaded = downloaded.length;
        this.saveState();

        console.log(`✅ ${downloaded.length} fotos baixadas`);

        // 3.2 - Processar (4 versões)
        this.state.currentStep = 'processing';
        this.saveState();
        console.log('\n🖼️  Processando imagens (4 versões)...');

        const processed = await this.services.engine.processPhotos(downloaded);
        this.state.stats.photosProcessed = processed.length;
        this.saveState();

        console.log(`✅ ${processed.length} fotos processadas`);

        // 3.3 - Upload para R2
        this.state.currentStep = 'uploading';
        this.saveState();
        console.log('\n☁️  Enviando para R2...');

        const uploaded = await this.services.engine.uploadPhotos(processed);
        this.state.stats.photosUploaded = uploaded.length;
        this.saveState();

        console.log(`✅ ${uploaded.length} fotos enviadas`);

        // 3.4 - Atualizar banco
        this.state.currentStep = 'updating_db';
        this.saveState();
        console.log('\n💾 Atualizando banco de dados...');

        await this.services.engine.updateDatabase(uploaded);
        console.log('✅ Banco de dados atualizado');
    }

    // Gerar relatório final
    generateReport() {
        const duration = this.state.startTime ?
            ((Date.now() - this.state.startTime) / 1000 / 60).toFixed(1) : 0;

        console.log('\n' + '═'.repeat(60));
        console.log('📊 RELATÓRIO FINAL');
        console.log('═'.repeat(60));
        console.log(`📅 Data: ${new Date().toLocaleString('pt-BR')}`);
        console.log(`⏱️  Duração total: ${duration} minutos`);
        console.log('\nRESULTADOS:');
        console.log(`  📸 Fotos analisadas: ${this.state.stats.photosAnalyzed}`);
        console.log(`  🟢 Novas encontradas: ${this.state.stats.newPhotosFound}`);
        console.log(`  🔴 Vendidas encontradas: ${this.state.stats.soldPhotosFound}`);

        if (this.state.stats.photosDownloaded > 0) {
            console.log('\nPROCESSAMENTO:');
            console.log(`  📥 Baixadas: ${this.state.stats.photosDownloaded}`);
            console.log(`  🖼️  Processadas: ${this.state.stats.photosProcessed}`);
            console.log(`  ☁️  Enviadas: ${this.state.stats.photosUploaded}`);
        }

        if (this.state.stats.photosMarkedSold > 0) {
            console.log(`  💰 Marcadas como vendidas: ${this.state.stats.photosMarkedSold}`);
        }

        if (this.state.stats.errors.length > 0) {
            console.log(`\n⚠️  ERROS: ${this.state.stats.errors.length}`);
            this.state.stats.errors.slice(0, 5).forEach(err => {
                console.log(`  - ${err.photo}: ${err.error}`);
            });
        }

        console.log('═'.repeat(60));
        console.log('✅ SINCRONIZAÇÃO COMPLETA!\n');

        // Salvar log completo
        const logFile = path.join(
            this.logsDir,
            `sync-${new Date().toISOString().split('T')[0]}.json`
        );
        fs.writeFileSync(logFile, JSON.stringify(this.state, null, 2));
        console.log(`📄 Log salvo em: ${logFile}\n`);
    }

    // Executar sincronização completa
    async run() {
        try {
            this.showHeader();

            // Inicializar
            await this.initWorkspace();

            // Conectar serviços
            const servicesOk = await this.initServices();
            if (!servicesOk) {
                console.error('❌ Falha ao inicializar serviços');
                process.exit(1);
            }

            // Marcar início
            this.state.startTime = Date.now();

            // 1. Análise
            const analysis = await this.runAnalysis();

            // Verificar se há trabalho a fazer
            if (analysis.newPhotos.length === 0 && analysis.soldPhotos.length === 0) {
                console.log('\n✅ Sistema já está sincronizado!');
                console.log('   Nada para fazer.\n');
                await this.cleanup();
                return;
            }

            // 2. Processar vendidas (rápido)
            await this.processSoldPhotos(analysis.soldPhotos);

            // 3. Processar novas (demorado)
            await this.processNewPhotos(analysis.newPhotos);

            // 4. Relatório final
            this.generateReport();

            // 5. Limpar e finalizar
            await this.cleanup();

        } catch (error) {
            console.error('\n❌ ERRO FATAL:', error);
            console.error(error.stack);
            this.state.stats.errors.push({
                fatal: true,
                error: error.message
            });
            this.saveState();
            process.exit(1);
        }
    }

    // Limpar e desconectar
    async cleanup() {
        console.log('🧹 Limpando...');

        // Limpar temporários
        await this.cleanupTemp();

        // Desconectar serviços
        if (this.services.db) {
            await this.services.db.disconnect();
        }

        // Marcar como concluído
        this.state.inProgress = false;
        this.state.lastSync = new Date();
        this.state.currentStep = 'completed';
        this.saveState();

        console.log('✅ Pronto!\n');
    }
}

// ========================================
// EXECUTAR
// ========================================
if (require.main === module) {
    console.log('🌟 SUNSHINE SYNC - Iniciando...\n');

    const sync = new SunshineSync();

    // Capturar CTRL+C
    process.on('SIGINT', async () => {
        console.log('\n\n⚠️  Interrompido pelo usuário');
        await sync.cleanup();
        process.exit(0);
    });

    // Executar
    sync.run();
}