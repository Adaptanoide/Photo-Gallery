// src/services/CDEIncrementalSync.js
// Serviço de Sincronização Incremental CDE - Versão Refatorada

const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const Cart = require('../models/Cart');
const Selection = require('../models/Selection');
const PhotoCategory = require('../models/PhotoCategory');

// Identificação única da instância
const INSTANCE_ID = process.env.SYNC_INSTANCE_ID || 'unknown';
console.log(`[CDE Sync] Instance ID: ${INSTANCE_ID}`);

// Função para verificar horário comercial usando variáveis do .env
function isBusinessHours() {
    const now = new Date();
    const floridaTime = new Date(now.toLocaleString("en-US", {
        timeZone: process.env.SYNC_TIMEZONE || "America/New_York"
    }));

    const day = floridaTime.getDay();
    const hour = floridaTime.getHours();
    const startHour = parseInt(process.env.SYNC_BUSINESS_START || '7');
    const endHour = parseInt(process.env.SYNC_BUSINESS_END || '17');

    // Segunda(1) a Sábado(6), dentro do horário configurado
    return (day >= 1 && day <= 6 && hour >= startHour && hour < endHour);
}

// Função para determinar o tipo de sync necessário
function getSyncStrategy() {
    const now = new Date();
    const floridaTime = new Date(now.toLocaleString("en-US", {
        timeZone: process.env.SYNC_TIMEZONE || "America/New_York"
    }));

    const day = floridaTime.getDay();
    const hour = floridaTime.getHours();
    const weeklyDay = parseInt(process.env.SYNC_WEEKLY_DAY || '0');
    const weeklyHour = parseInt(process.env.SYNC_WEEKLY_HOUR || '3');
    const nightHour = parseInt(process.env.SYNC_NIGHT_HOUR || '23');

    // Domingo 3am: sync completo com R2
    if (day === weeklyDay && hour === weeklyHour) {
        return {
            type: 'weekly_full',
            function: 'runSmartSync',
            description: 'Sync semanal completo com verificação R2'
        };
    }

    // Horário comercial: sync rápido frequente
    if (isBusinessHours()) {
        return {
            type: 'business_hours',
            function: 'runSync',
            description: 'Sync rápido sem R2 (horário comercial)'
        };
    }

    // Fora do horário: apenas às 23h
    if (hour === nightHour) {
        return {
            type: 'nightly',
            function: 'runSync',
            description: 'Sync noturno de consolidação'
        };
    }

    // Qualquer outro horário: não fazer nada
    return {
        type: 'skip',
        function: null,
        description: 'Fora do horário de sync'
    };
}

// ============================================
// SISTEMA DE LOCK PARA EVITAR CONFLITOS
// ============================================

async function acquireSyncLock() {
    try {
        const db = mongoose.connection.db;
        const now = new Date();

        // Tentar adquirir lock
        const result = await db.collection('sync_locks').findOneAndUpdate(
            {
                _id: 'cde_sync',
                $or: [
                    { expiresAt: { $lt: now } }, // Lock expirado
                    { expiresAt: { $exists: false } } // Sem lock
                ]
            },
            {
                $set: {
                    lockedBy: INSTANCE_ID,
                    lockedAt: now,
                    expiresAt: new Date(now.getTime() + 15 * 60 * 1000), // 15 minutos
                    pid: process.pid,
                    host: require('os').hostname()
                }
            },
            {
                upsert: true,
                returnDocument: 'after'
            }
        );

        if (result && result.value) {
            console.log(`🔒 [CDE Sync] Lock adquirido por ${INSTANCE_ID}`);
            return true;
        }

        // Ver quem tem o lock
        const currentLock = await db.collection('sync_locks').findOne({ _id: 'cde_sync' });
        if (currentLock) {
            console.log(`🔒 [CDE Sync] Lock em uso por ${currentLock.lockedBy} desde ${currentLock.lockedAt}`);
        }

        return false;
    } catch (error) {
        if (error.code === 11000) { // Duplicate key
            console.log(`🔒 [CDE Sync] Lock já em uso por outra instância`);
            return false;
        }
        console.error('Erro ao adquirir lock:', error);
        return false;
    }
}

async function cleanupOldLocks() {
    try {
        const db = mongoose.connection.db;
        const now = new Date();

        // Remover locks expirados há mais de 30 minutos
        const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

        const result = await db.collection('sync_locks').deleteMany({
            expiresAt: { $lt: thirtyMinutesAgo }
        });

        if (result.deletedCount > 0) {
            console.log(`🧹 [CDE Sync] ${result.deletedCount} locks antigos removidos`);
        }
    } catch (error) {
        console.error('Erro ao limpar locks antigos:', error);
    }
}

async function releaseSyncLock() {
    try {
        const db = mongoose.connection.db;
        await db.collection('sync_locks').deleteOne({
            _id: 'cde_sync',
            lockedBy: INSTANCE_ID
        });
        console.log(`🔓 [CDE Sync] Lock liberado por ${INSTANCE_ID}`);
    } catch (error) {
        console.error('Erro ao liberar lock:', error);
    }
}

class CDEIncrementalSync {
    constructor() {
        this.environment = process.env.NODE_ENV || 'development';
        this.instanceId = `${this.environment}_${process.env.HOSTNAME || 'local'}`;
        this.lastSyncTime = null;
        this.isRunning = false;
        this.syncInterval = null;
        this.mode = 'observe'; // Modo padrão: apenas observar
        this.stats = {
            totalChecked: 0,
            discrepanciesFound: 0,
            lastRun: null,
            lastReport: [],
            executionCount: 0
        };
    }

    setMode(mode) {
        if (['observe', 'safe', 'full'].includes(mode)) {
            this.mode = mode;
            console.log(`[SYNC] Modo alterado para: ${mode}`);
        }
    }

    start(intervalMinutes = 5) {
        if (this.syncInterval) {
            console.log('[SYNC] Sincronização já está rodando');
            return;
        }

        console.log(`[SYNC] Sistema iniciado - Verificando a cada ${intervalMinutes} minutos`);

        const checkAndRunSync = async () => {
            // COMENTADO: Restrição de horário removida para sync 24/7
            // const strategy = getSyncStrategy();
            // if (strategy.type === 'skip') {
            //     console.log('[SYNC] Fora do horário - pulando sync');
            //     return;
            // }

            await cleanupOldLocks(); // Limpar locks antigos antes de tentar

            // Executar sync sempre (sem restrição de horário)
            console.log('[SYNC] Executando sincronização incremental...');
            await this.runSync();
        };

        // Executar primeira vez após 30 segundos
        setTimeout(checkAndRunSync, 30000);

        // Configurar intervalo regular COM VERIFICAÇÃO
        this.syncInterval = setInterval(checkAndRunSync, intervalMinutes * 60 * 1000);
    }

    stop() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            this.isRunning = false;
            console.log('[SYNC] Sincronização parada');
        }
    }

    async runSmartSync() {
        // ADICIONE ESTAS VERIFICAÇÕES NO INÍCIO
        if (!process.env.ENABLE_CDE_SYNC || process.env.ENABLE_CDE_SYNC === 'false') {
            console.log('⏸️ [CDE Sync] Desabilitado via ENV');
            return { success: false, message: 'Sync disabled' };
        }

        if (this.isRunning) {
            console.log('[SYNC] Sincronização já em andamento, pulando...');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();
        let cdeConnection = null;

        try {
            console.log('\n' + '='.repeat(60));
            console.log('[SYNC] SMART SYNC - APENAS FOTOS REAIS NO R2');
            console.log(`[SYNC] Modo: ${this.mode.toUpperCase()}`);
            console.log(`[SYNC] Instância: ${this.instanceId}`);
            console.log('='.repeat(60));

            // Conectar ao CDE
            cdeConnection = await mysql.createConnection({
                host: process.env.CDE_HOST,
                port: process.env.CDE_PORT,
                user: process.env.CDE_USER,
                password: process.env.CDE_PASSWORD,
                database: process.env.CDE_DATABASE
            });

            // Buscar todas as fotos com driveFileId
            const allPhotos = await UnifiedProductComplete.find(
                { driveFileId: { $exists: true, $ne: null } },
                { photoNumber: 1, status: 1, cdeStatus: 1, driveFileId: 1, selectionId: 1, reservedBy: 1 }
            );

            console.log(`[SYNC] ${allPhotos.length} registros no MongoDB para verificar`);

            // Configurar S3 para verificar R2
            const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
            const s3Client = new S3Client({
                region: 'auto',
                endpoint: process.env.R2_ENDPOINT,
                credentials: {
                    accessKeyId: process.env.R2_ACCESS_KEY_ID,
                    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
                }
            });

            const discrepancies = [];
            let realPhotos = 0;
            let skippedNoR2 = 0;
            let skippedProtected = 0;

            for (const mongoPhoto of allPhotos) {
                // PRIMEIRO: Verificar se existe no R2
                let existsInR2 = false;

                try {
                    await s3Client.send(new HeadObjectCommand({
                        Bucket: 'sunshine-photos',
                        Key: mongoPhoto.driveFileId
                    }));
                    existsInR2 = true;
                    realPhotos++;
                } catch {
                    skippedNoR2++;
                    continue; // Não existe no R2, pular
                }

                // SEGUNDO: Verificar proteções
                if (mongoPhoto.selectionId || mongoPhoto.reservedBy?.clientCode) {
                    skippedProtected++;
                    continue;
                }

                // TERCEIRO: Verificar no CDE
                const [cdeResult] = await cdeConnection.execute(
                    'SELECT AESTADOP, AQBITEM FROM tbinventario WHERE ATIPOETIQUETA = ?',
                    [mongoPhoto.photoNumber]
                );

                if (cdeResult[0]) {
                    const cdeStatus = cdeResult[0].AESTADOP;

                    // Comparar apenas se diferente
                    if (mongoPhoto.cdeStatus !== cdeStatus ||
                        (cdeStatus === 'INGRESADO' && mongoPhoto.status !== 'available') ||
                        (cdeStatus === 'RETIRADO' && mongoPhoto.status !== 'sold')) {

                        discrepancies.push({
                            photoNumber: mongoPhoto.photoNumber,
                            mongoStatus: mongoPhoto.status,
                            mongoCDEStatus: mongoPhoto.cdeStatus,
                            realCDEStatus: cdeStatus,
                            action: this.determineSuggestedAction(mongoPhoto, { AESTADOP: cdeStatus })
                        });

                        // Aplicar correção se modo safe
                        if (this.mode === 'safe') {
                            const correction = await this.applyCorrection(mongoPhoto, { AESTADOP: cdeStatus });
                            if (correction.applied) {
                                console.log(`[SYNC] ✅ ${mongoPhoto.photoNumber}: ${correction.action}`);
                            }
                        }
                    }
                }

                // Mostrar progresso
                if (realPhotos % 500 === 0) {
                    console.log(`[SYNC] Progresso: ${realPhotos} fotos reais verificadas`);
                }
            }

            // ============================================
            // VERIFICAR SELEÇÕES PENDING
            // ============================================
            const selectionCheckResult = await this.verificarSelecoesPending(cdeConnection);

            // Relatório
            console.log('\n' + '='.repeat(60));
            console.log('[SYNC] RELATÓRIO DO SMART SYNC');

            // Relatório
            console.log('\n' + '='.repeat(60));
            console.log('[SYNC] RELATÓRIO DO SMART SYNC');
            console.log('='.repeat(60));
            console.log(`Total de registros no MongoDB: ${allPhotos.length}`);
            console.log(`Fotos que existem no R2: ${realPhotos}`);
            console.log(`Ignoradas (não existem no R2): ${skippedNoR2}`);
            console.log(`Protegidas (seleção/carrinho): ${skippedProtected}`);
            console.log(`Discrepâncias encontradas: ${discrepancies.length}`);

            if (discrepancies.length > 0 && discrepancies.length <= 10) {
                console.log('\nDISCREPÂNCIAS:');
                discrepancies.forEach(d => {
                    console.log(`\n${d.photoNumber}:`);
                    console.log(`  MongoDB: ${d.mongoStatus} (cdeStatus: ${d.mongoCDEStatus})`);
                    console.log(`  CDE Real: ${d.realCDEStatus}`);
                    console.log(`  Ação: ${d.action}`);
                });
            }

            const duration = Date.now() - startTime;
            console.log(`\n[SYNC] Tempo total: ${Math.round(duration / 1000)}s`);
            console.log('='.repeat(60));

            // Salvar stats
            this.stats.lastRun = new Date();
            this.stats.totalChecked = realPhotos;
            this.stats.discrepanciesFound = discrepancies.length;
            this.stats.lastReport = discrepancies;

            return {
                success: true,
                duration,
                realPhotos,
                discrepancies: discrepancies.length
            };

        } catch (error) {
            console.error('[SYNC] ERRO:', error);
            return { success: false, error: error.message };
        } finally {
            this.isRunning = false;
            if (cdeConnection) await cdeConnection.end();
        }
    }

    async runSync() {
        // ADICIONE ESTAS VERIFICAÇÕES NO INÍCIO
        if (!process.env.ENABLE_CDE_SYNC || process.env.ENABLE_CDE_SYNC === 'false') {
            console.log('⏸️ [CDE Sync] Desabilitado via ENV');
            return { success: false, message: 'Sync disabled' };
        }

        if (this.isRunning) {
            console.log('[SYNC] Sincronização já em andamento, pulando...');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();
        let cdeConnection = null;

        try {
            console.log('\n' + '='.repeat(60));
            console.log('[SYNC] INICIANDO SINCRONIZAÇÃO INCREMENTAL');
            console.log(`[SYNC] Modo: ${this.mode.toUpperCase()}`);
            console.log(`[SYNC] Timestamp: ${new Date().toISOString()}`);
            console.log(`[SYNC] Instância: ${this.instanceId}`);
            console.log('='.repeat(60));

            // Conectar ao CDE
            cdeConnection = await mysql.createConnection({
                host: process.env.CDE_HOST,
                port: process.env.CDE_PORT,
                user: process.env.CDE_USER,
                password: process.env.CDE_PASSWORD,
                database: process.env.CDE_DATABASE
            });

            // Buscar estado do sync no MongoDB
            const db = mongoose.connection.db;
            const lockDoc = await db.collection('sync_locks').findOne({ _id: 'cde_sync' });
            const executionCount = (lockDoc?.executionCount || 0) + 1;

            // Incrementar contador de execuções
            this.stats.executionCount = executionCount;

            // A cada 20 execuções (~60 minutos), fazer sync completo
            const shouldDoFullSync = executionCount % 20 === 0;

            console.log(`[SYNC] Execução #${executionCount}`);

            if (shouldDoFullSync) {
                console.log(`[SYNC] 🔄 Executando SYNC COMPLETO (a cada 20 execuções)`);

                // IMPORTANTE: Salvar o executionCount ANTES de sair para runSmartSync
                await db.collection('sync_locks').updateOne(
                    { _id: 'cde_sync' },
                    { $set: { executionCount: executionCount } },
                    { upsert: true }
                );

                // Fechar conexão do runSync antes de chamar runSmartSync
                if (cdeConnection) await cdeConnection.end();
                this.isRunning = false;
                return await this.runSmartSync();
            }

            console.log(`[SYNC] ⚡ Sync incremental - verificando fotos available`);

            // Calcular offset SEQUENCIAL com rotação automática
            const totalAvailable = await UnifiedProductComplete.countDocuments({
                status: 'available',
                photoNumber: { $exists: true, $ne: null }
            });

            // Pegar offset do lockDoc já carregado
            const lastOffset = lockDoc?.lastOffset || 0;

            // Calcular próximo offset
            let nextOffset = lastOffset + 300;

            // Se passou do total, voltar para o início
            if (nextOffset >= totalAvailable) {
                nextOffset = 0;
                console.log(`[SYNC] 🔄 Rotação completa - voltando ao início`);
            }

            // Salvar próximo offset para próxima execução
            await db.collection('sync_locks').updateOne(
                { _id: 'cde_sync' },
                { $set: { lastOffset: nextOffset, executionCount: executionCount, lastRotationAt: new Date() } },
                { upsert: true }
            );

            const mongoPhotosAvailable = await UnifiedProductComplete.find({
                status: 'available',
                photoNumber: { $exists: true, $ne: null }
            }).skip(nextOffset).limit(300).select('photoNumber');

            console.log(`[SYNC] ⚡ Verificando fotos ${nextOffset} a ${nextOffset + 300} de ${totalAvailable} (sequencial)`);
            console.log(`[SYNC] Próxima execução começará em: ${nextOffset + 300}`);
            console.log(`[SYNC] Verificando ${mongoPhotosAvailable.length} fotos available`);

            // Verificar status de cada foto no CDE
            const cdeChanges = [];

            for (const mongoPhoto of mongoPhotosAvailable) {
                // PASSO 1: Verificar em tbinventario
                const [invResult] = await cdeConnection.execute(
                    `SELECT ATIPOETIQUETA, AESTADOP, RESERVEDUSU, AQBITEM 
                FROM tbinventario 
                WHERE ATIPOETIQUETA = ?`,
                    [mongoPhoto.photoNumber]
                );

                if (invResult.length > 0) {
                    // ✅ Encontrou em tbinventario - foto aberta
                    cdeChanges.push(invResult[0]);
                }
                // Sem else! Se não encontrou em tbinventario, ignora
                // sync-sunshine.js e CDETransitSync cuidam de tbetiqueta
            }

            console.log(`[SYNC] ${cdeChanges.length} fotos verificadas no CDE`);

            // Analisar mudanças
            const discrepancies = [];
            let checkedCount = 0;
            let skippedLocked = 0;
            let skippedInCart = 0;

            for (const cdeRecord of cdeChanges) {
                const photoNumber = cdeRecord.ATIPOETIQUETA;
                const cdeStatus = cdeRecord.AESTADOP;

                // Buscar no MongoDB
                const photoNumberPadded = photoNumber.padStart(5, '0');
                const mongoPhoto = await UnifiedProductComplete.findOne({
                    $or: [
                        { photoNumber: photoNumber },
                        { photoNumber: photoNumberPadded },
                        { fileName: `${photoNumber}.webp` },
                        { fileName: `${photoNumberPadded}.webp` }
                    ]
                });

                if (!mongoPhoto) {
                    continue;
                }

                checkedCount++;

                // VERIFICAR SE ESTÁ EM CARRINHO ATIVO
                if (mongoPhoto.reservedBy?.clientCode) {
                    const activeCart = await Cart.findOne({
                        clientCode: mongoPhoto.reservedBy.clientCode,
                        'items.fileName': mongoPhoto.fileName,
                        isActive: true
                    });

                    if (activeCart) {
                        // NOVA LÓGICA: Se CDE diz RESERVED/RETIRADO, marcar como ghost
                        if (cdeStatus === 'RESERVED' || cdeStatus === 'RETIRADO' || cdeStatus === 'STANDBY') {
                            console.log(`[SYNC] ⚠️ Conflito detectado: ${photoNumber} em carrinho mas ${cdeStatus} no CDE`);

                            // Importar CartService se ainda não foi importado
                            const CartService = require('../services/CartService');

                            // Determinar mensagem baseada no status
                            let ghostReason = 'This item is no longer available';
                            if (cdeStatus === 'RESERVED') {
                                ghostReason = 'This item was reserved by another customer';
                            } else if (cdeStatus === 'RETIRADO') {
                                ghostReason = 'This item has been sold';
                            } else if (cdeStatus === 'STANDBY') {
                                ghostReason = 'This item is temporarily unavailable';
                            }

                            // Marcar como ghost no carrinho
                            const marked = await CartService.markItemAsGhost(
                                mongoPhoto.reservedBy.clientCode,
                                mongoPhoto.fileName,
                                ghostReason
                            );

                            if (marked) {
                                console.log(`[SYNC] 👻 Item marcado como ghost no carrinho`);

                                // Ainda assim, atualizar o MongoDB para refletir o status real
                                discrepancies.push({
                                    photoNumber: photoNumber,
                                    fileName: mongoPhoto.fileName,
                                    mongoStatus: mongoPhoto.cdeStatus || 'null',
                                    cdeStatus: cdeStatus,
                                    hasSelectionId: false,
                                    inCart: true,
                                    cartClient: mongoPhoto.reservedBy.clientCode,
                                    suggestedAction: 'MARCADO COMO GHOST NO CARRINHO',
                                    ghostMarked: true
                                });
                            }
                        } else {
                            // Status normal (PRE-SELECTED), pular
                            skippedInCart++;
                        }
                        continue;
                    }
                }

                // Verificar discrepância
                if (mongoPhoto.cdeStatus !== cdeStatus) {
                    const analysis = {
                        photoNumber: photoNumber,
                        fileName: mongoPhoto.fileName,
                        mongoStatus: mongoPhoto.cdeStatus || 'null',
                        cdeStatus: cdeStatus,
                        hasSelectionId: !!mongoPhoto.selectionId,
                        inCart: !!mongoPhoto.reservedBy?.clientCode,
                        cartClient: mongoPhoto.reservedBy?.clientCode || null,
                        suggestedAction: this.determineSuggestedAction(mongoPhoto, cdeRecord)
                    };

                    discrepancies.push(analysis);

                    // Aplicar correção APENAS se modo não for observe
                    if (this.mode !== 'observe') {
                        const correction = await this.applyCorrection(mongoPhoto, cdeRecord);
                        analysis.correctionApplied = correction.applied;
                        analysis.correctionResult = correction.applied ? correction.action : correction.reason;
                    }
                }
            }

            // Guardar relatório
            this.stats.lastReport = discrepancies;
            this.stats.totalChecked = checkedCount;
            this.stats.discrepanciesFound = discrepancies.length;
            this.stats.lastRun = new Date();

            // ============================================
            // VERIFICAR SELEÇÕES PENDING
            // ============================================
            const selectionCheckResult = await this.verificarSelecoesPending(cdeConnection);

            // Relatório no console
            console.log('\n' + '='.repeat(60));
            console.log('[SYNC] RELATÓRIO DA SINCRONIZAÇÃO');
            console.log('='.repeat(60));
            console.log(`Registros do CDE analisados: ${cdeChanges.length}`);
            console.log(`Fotos encontradas no MongoDB: ${checkedCount}`);
            console.log(`Fotos puladas (locked): ${skippedLocked}`);
            console.log(`Fotos puladas (em carrinho): ${skippedInCart}`);
            console.log(`Discrepâncias detectadas: ${discrepancies.length}`);

            if (discrepancies.length > 0) {
                console.log('\nPRIMEIRAS 10 DISCREPÂNCIAS:');
                discrepancies.slice(0, 10).forEach((d, i) => {
                    console.log(`\n${i + 1}. Foto ${d.photoNumber} (${d.fileName}):`);
                    console.log(`   MongoDB status: ${d.mongoStatus}`);
                    console.log(`   CDE status: ${d.cdeStatus}`);
                    console.log(`   Tem selectionId: ${d.hasSelectionId ? 'SIM' : 'NÃO'}`);
                    console.log(`   Em carrinho: ${d.inCart ? `SIM (cliente ${d.cartClient})` : 'NÃO'}`);
                    console.log(`   Ação sugerida: ${d.suggestedAction}`);

                    if (this.mode !== 'observe' && d.correctionResult) {
                        console.log(`   Correção: ${d.correctionResult}`);
                    }
                });

                if (discrepancies.length > 10) {
                    console.log(`\n... e mais ${discrepancies.length - 10} discrepâncias`);
                }
            }

            this.lastSyncTime = new Date();

            const duration = Date.now() - startTime;
            console.log(`\n[SYNC] Sincronização completa em ${duration}ms`);
            console.log('='.repeat(60) + '\n');

            return {
                success: true,
                duration,
                checked: checkedCount,
                discrepancies: discrepancies.length,
                skipped: {
                    locked: skippedLocked,
                    inCart: skippedInCart
                }
            };

        } catch (error) {
            console.error('[SYNC] ERRO na sincronização:', error);
            this.stats.lastReport = [{
                error: error.message,
                timestamp: new Date()
            }];
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.isRunning = false;
            if (cdeConnection) await cdeConnection.end();
        }
    }

    determineSuggestedAction(mongoPhoto, cdeRecord) {
        // PROTEÇÃO 1: Se tem selectionId, ignorar
        if (mongoPhoto.selectionId) {
            return 'IGNORAR - Foto em seleção confirmada';
        }

        // PROTEÇÃO 2: Se está em carrinho ativo, ignorar
        if (mongoPhoto.reservedBy?.clientCode) {
            return 'IGNORAR - Foto em carrinho ativo';
        }

        // PROTEÇÃO 3: Se MongoDB tem status de transação, proteger
        if (mongoPhoto.cdeStatus === 'CONFIRMED' || mongoPhoto.cdeStatus === 'PRE-SELECTED') {
            return 'IGNORAR - Foto em processo de venda';
        }

        const cdeStatus = cdeRecord.AESTADOP;
        const mongoStatus = mongoPhoto.status;

        // Determinar ação baseada no status do CDE vs MongoDB
        if (cdeStatus === 'RETIRADO') {
            if (mongoStatus === 'sold') {
                return 'JÁ CORRETO - sold';
            } else {
                return 'MARCAR COMO VENDIDA';
            }
        }

        if (cdeStatus === 'RESERVED' || cdeStatus === 'STANDBY') {
            if (mongoStatus === 'unavailable') {
                return 'JÁ CORRETO - unavailable';
            } else {
                return 'MARCAR COMO INDISPONÍVEL';
            }
        }

        if (cdeStatus === 'INGRESADO') {
            if (mongoStatus === 'available') {
                return 'JÁ CORRETO - available';
            } else {
                return 'MARCAR COMO DISPONÍVEL';
            }
        }

        if (cdeStatus === 'PRE-SELECTED') {
            // PRE-SELECTED sem carrinho é suspeito
            return 'VERIFICAR MANUALMENTE - PRE-SELECTED sem carrinho';
        }

        if (cdeStatus === 'CONFIRMED') {
            // CONFIRMED sem seleção é suspeito
            return 'VERIFICAR MANUALMENTE - CONFIRMED sem seleção';
        }

        return 'ANALISAR MANUALMENTE - Status desconhecido';
    }

    async applyCorrection(mongoPhoto, cdeRecord) {
        // Verificações de segurança
        if (this.mode === 'observe') {
            return { applied: false, reason: 'Modo observe - sem alterações' };
        }

        // NUNCA modificar fotos com selectionId
        if (mongoPhoto.selectionId) {
            return { applied: false, reason: 'Foto em seleção - protegida' };
        }

        // NUNCA modificar fotos em carrinho
        if (mongoPhoto.reservedBy?.clientCode) {
            return { applied: false, reason: 'Foto em carrinho - protegida' };
        }

        const cdeStatus = cdeRecord.AESTADOP;
        let updateFields = {};
        let actionTaken = '';

        // Determinar mudanças baseado no status do CDE
        switch (cdeStatus) {
            case 'RETIRADO':
                updateFields = {
                    status: 'sold',
                    cdeStatus: 'RETIRADO',
                    qbItem: cdeRecord.AQBITEM,
                };
                actionTaken = 'Marcada como vendida';
                break;

            case 'RESERVED':
            case 'STANDBY':
                updateFields = {
                    status: 'unavailable',
                    cdeStatus: cdeStatus,
                    qbItem: cdeRecord.AQBITEM,
                };
                actionTaken = 'Marcada como indisponível';
                break;

            case 'INGRESADO':
                // Só marcar como available se não estiver em uso
                if (mongoPhoto.status !== 'available') {
                    updateFields = {
                        status: 'available',
                        cdeStatus: 'INGRESADO',
                        qbItem: cdeRecord.AQBITEM,
                    };
                    actionTaken = 'Marcada como disponível';
                }
                break;

            case 'PRE-SELECTED':
            case 'CONFIRMED':
                // Não fazer nada automático para estes status
                return { applied: false, reason: `Status ${cdeStatus} requer análise manual` };

            default:
                return { applied: false, reason: 'Status desconhecido' };
        }

        // Aplicar correção se houver mudanças
        if (Object.keys(updateFields).length > 0) {
            try {
                // Usar transação para evitar conflitos
                const session = await mongoose.startSession();

                try {
                    await session.withTransaction(async () => {
                        await UnifiedProductComplete.updateOne(
                            { _id: mongoPhoto._id },
                            { $set: updateFields }
                        ).session(session);
                    });

                    console.log(`[SYNC] ✅ Correção aplicada: Foto ${mongoPhoto.photoNumber} - ${actionTaken}`);
                    return { applied: true, action: actionTaken };

                } finally {
                    await session.endSession();
                }

            } catch (error) {
                if (error.message.includes('Write conflict')) {
                    return { applied: false, reason: 'Write conflict - operação concorrente' };
                }
                console.error(`[SYNC] ❌ Erro ao corrigir foto ${mongoPhoto.photoNumber}:`, error.message);
                return { applied: false, reason: `Erro: ${error.message}` };
            }
        }

        return { applied: false, reason: 'Nenhuma correção necessária' };
    }

    // ============================================
    // RECALCULAR PREÇOS DA SELEÇÃO APÓS REMOÇÃO
    // ============================================
    async recalcularPrecosSelecao(selection) {
        console.log(`[SYNC] 🧮 Recalculando preços para seleção ${selection.selectionId}...`);

        // Categorias Mix & Match (contagem global)
        const GLOBAL_MIX_MATCH_CATEGORIES = [
            'Colombian Cowhides',
            'Brazil Best Sellers',
            'Brazil Top Selected Categories'
        ];

        const isGlobalMixMatch = (categoryPath) => {
            if (!categoryPath) return false;
            const mainCategory = categoryPath.split('/')[0].split(' → ')[0].trim();
            return GLOBAL_MIX_MATCH_CATEGORIES.some(mixCat =>
                mainCategory.includes(mixCat) || mixCat.includes(mainCategory)
            );
        };

        try {
            // Separar items em Mix & Match vs Outros
            const mixMatchItems = [];
            const otherItems = [];

            for (const item of selection.items) {
                const categoryPath = item.category || '';
                if (isGlobalMixMatch(categoryPath)) {
                    mixMatchItems.push(item);
                } else {
                    otherItems.push(item);
                }
            }

            const globalQuantity = mixMatchItems.length;
            console.log(`[SYNC]    Mix & Match: ${globalQuantity} items | Outros: ${otherItems.length} items`);

            let totalRecalculado = 0;
            let errosRecalculo = 0;

            // Recalcular preços dos items Mix & Match (tier global)
            for (const item of mixMatchItems) {
                try {
                    // Normalizar o path para busca
                    let cleanPath = (item.category || '').replace(/ → /g, '/');
                    if (cleanPath.endsWith('/')) cleanPath = cleanPath.slice(0, -1);

                    const category = await PhotoCategory.findOne({
                        $or: [
                            { googleDrivePath: cleanPath },
                            { googleDrivePath: cleanPath + '/' },
                            { displayName: item.category }
                        ]
                    });

                    if (category) {
                        const priceResult = await category.getPriceForClient(selection.clientCode, globalQuantity);
                        const oldPrice = item.price;
                        item.price = priceResult.finalPrice;
                        totalRecalculado += priceResult.finalPrice;

                        if (oldPrice !== priceResult.finalPrice) {
                            console.log(`[SYNC]    📝 ${item.fileName}: $${oldPrice} → $${priceResult.finalPrice} (${priceResult.appliedRule})`);
                        }
                    } else {
                        console.log(`[SYNC]    ⚠️ Categoria não encontrada para: ${item.category}`);
                        totalRecalculado += item.price || 0;
                        errosRecalculo++;
                    }
                } catch (err) {
                    console.error(`[SYNC]    ❌ Erro ao recalcular ${item.fileName}:`, err.message);
                    totalRecalculado += item.price || 0;
                    errosRecalculo++;
                }
            }

            // Recalcular preços dos items separados (tier próprio por categoria)
            const othersByCategory = {};
            for (const item of otherItems) {
                const cat = item.category || 'Uncategorized';
                if (!othersByCategory[cat]) othersByCategory[cat] = [];
                othersByCategory[cat].push(item);
            }

            for (const [categoryPath, items] of Object.entries(othersByCategory)) {
                const quantity = items.length;

                try {
                    let cleanPath = categoryPath.replace(/ → /g, '/');
                    if (cleanPath.endsWith('/')) cleanPath = cleanPath.slice(0, -1);

                    const category = await PhotoCategory.findOne({
                        $or: [
                            { googleDrivePath: cleanPath },
                            { googleDrivePath: cleanPath + '/' },
                            { displayName: categoryPath }
                        ]
                    });

                    if (category) {
                        const priceResult = await category.getPriceForClient(selection.clientCode, quantity);

                        for (const item of items) {
                            const oldPrice = item.price;
                            item.price = priceResult.finalPrice;
                            totalRecalculado += priceResult.finalPrice;

                            if (oldPrice !== priceResult.finalPrice) {
                                console.log(`[SYNC]    📝 ${item.fileName}: $${oldPrice} → $${priceResult.finalPrice}`);
                            }
                        }
                    } else {
                        for (const item of items) {
                            totalRecalculado += item.price || 0;
                        }
                        errosRecalculo++;
                    }
                } catch (err) {
                    console.error(`[SYNC]    ❌ Erro ao recalcular categoria ${categoryPath}:`, err.message);
                    for (const item of items) {
                        totalRecalculado += item.price || 0;
                    }
                    errosRecalculo++;
                }
            }

            return {
                success: errosRecalculo === 0,
                totalRecalculado,
                errosRecalculo,
                mixMatchCount: mixMatchItems.length,
                othersCount: otherItems.length
            };

        } catch (error) {
            console.error(`[SYNC] ❌ Erro geral no recálculo:`, error.message);
            return {
                success: false,
                totalRecalculado: selection.totalValue,
                errosRecalculo: 1,
                error: error.message
            };
        }
    }

    // ============================================
    // VERIFICAR E CORRIGIR SELEÇÕES PENDING
    // ============================================
    async verificarSelecoesPending(cdeConnection) {
        console.log(`============================================================`);
        console.log(`[SYNC] 🔍 VERIFICANDO SELEÇÕES PENDING`);
        console.log(`============================================================`);

        try {
            // Buscar seleções PENDING não deletadas
            const selecoesPending = await Selection.find({
                status: 'pending',
                isDeleted: { $ne: true }
            });

            if (selecoesPending.length === 0) {
                console.log(`[SYNC] ✅ Nenhuma seleção PENDING encontrada`);
                return { verificadas: 0, problemas: 0 };
            }

            console.log(`[SYNC] 📋 Encontradas ${selecoesPending.length} seleções PENDING`);

            let totalProblemas = 0;
            let totalCorrecoes = 0;
            const selecoesComProblemas = [];

            for (const selecao of selecoesPending) {
                const clientCode = selecao.clientCode;
                const clientName = selecao.clientName;
                const items = selecao.items || [];

                console.log(`[SYNC] 📦 Verificando: ${clientName} (${clientCode}) - ${items.length} fotos`);

                const problemasDestaSelecao = [];
                const itensParaRemover = [];

                for (const item of items) {
                    const fileName = item.fileName || '';
                    const photoNumber = fileName.match(/(\d+)/)?.[1];

                    if (!photoNumber) continue;

                    // Consultar estado no CDE
                    const [rows] = await cdeConnection.execute(
                        'SELECT AESTADOP, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA = ?',
                        [photoNumber.padStart(5, '0')]
                    );

                    if (rows.length === 0) continue;

                    const estadoCDE = rows[0].AESTADOP;
                    const reservedUsu = rows[0].RESERVEDUSU || '';

                    // Verificar se RESERVEDUSU contém o código do cliente
                    const pertenceAoCliente = reservedUsu.includes(`-${clientCode}`);

                    let problema = null;
                    let acao = null;

                    // LÓGICA DE DETECÇÃO - OPÇÃO B (CONSERVADORA)
                    // Apenas INGRESADO remove automaticamente
                    // Todo o resto apenas ALERTA para o admin decidir

                    if (estadoCDE === 'INGRESADO') {
                        // Foto voltou para estoque disponível - pode remover
                        problema = 'VOLTOU PARA INGRESADO';
                        acao = 'REMOVER';
                    } else if (estadoCDE === 'RETIRADO') {
                        // RETIRADO - pode ter sido vendida para o mesmo cliente
                        // Apenas alertar, admin decide
                        if (reservedUsu) {
                            problema = pertenceAoCliente ? 'RETIRADO (mesmo cliente)' : 'RETIRADO (verificar)';
                            acao = 'ALERTAR';
                        }
                    } else if (['CONFIRMED', 'PRE-SELECTED', 'RESERVED'].includes(estadoCDE)) {
                        // Reservado/Confirmado - pode ser do mesmo cliente por outro canal
                        // Apenas alertar, NÃO remover automaticamente
                        if (!pertenceAoCliente) {
                            problema = 'RESERVADO (verificar proprietário)';
                            acao = 'ALERTAR';
                        }
                    } else if (estadoCDE === 'STANDBY') {
                        problema = 'EM STANDBY';
                        acao = 'ALERTAR';
                    }

                    if (problema) {
                        problemasDestaSelecao.push({
                            foto: photoNumber,
                            fileName: fileName,
                            problema,
                            acao,
                            estadoCDE,
                            reservedUsu: reservedUsu || '(vazio)'
                        });

                        if (acao === 'REMOVER') {
                            itensParaRemover.push(item);
                        }
                    }
                }

                // SE HOUVER PROBLEMAS, APLICAR CORREÇÕES
                if (problemasDestaSelecao.length > 0) {
                    totalProblemas += problemasDestaSelecao.length;

                    console.log(`[SYNC] ⚠️ PROBLEMAS em ${clientName}:`);
                    problemasDestaSelecao.forEach(p => {
                        console.log(`   - Foto ${p.foto}: ${p.problema} | CDE: ${p.estadoCDE} | RESERVEDUSU: ${p.reservedUsu} | Ação: ${p.acao}`);
                    });

                    // Separar: itens para REMOVER vs itens para ALERTAR (RETIRADO)
                    const itensRetirado = problemasDestaSelecao.filter(p => p.acao === 'ALERTAR' && p.estadoCDE === 'RETIRADO');

                    // SALVAR INFO DE FOTOS RETIRADO
                    if (itensRetirado.length > 0) {
                        selecao.hasRetiredPhotos = true;
                        selecao.retiredPhotosDetails = itensRetirado.map(p => ({
                            fileName: p.fileName,
                            photoNumber: p.foto,
                            reservedUsu: p.reservedUsu,
                            detectedAt: new Date()
                        }));
                        await selecao.save();
                        console.log(`[SYNC] 📝 Salvo alerta de ${itensRetirado.length} fotos RETIRADO para ${clientName}`);
                    }

                    // APLICAR REMOÇÕES
                    if (itensParaRemover.length > 0) {
                        console.log(`[SYNC] 🔧 Removendo ${itensParaRemover.length} fotos problemáticas...`);

                        const tierAntes = this.calcularTier(items.length);

                        // Remover itens do array
                        const fileNamesToRemove = itensParaRemover.map(i => i.fileName);
                        selecao.items = selecao.items.filter(item => !fileNamesToRemove.includes(item.fileName));

                        const tierDepois = this.calcularTier(selecao.items.length);

                        // Recalcular preços
                        const recalcResult = await this.recalcularPrecosSelecao(selecao);

                        // Atualizar totais
                        selecao.totalItems = selecao.items.length;
                        selecao.totalValue = recalcResult.totalRecalculado;
                        selecao.lastAutoCorrection = new Date();

                        // Marcar para revisão se houve erros no recálculo
                        if (!recalcResult.success) {
                            selecao.priceReviewRequired = true;
                            selecao.priceReviewReason = `Recálculo automático falhou para ${recalcResult.errosRecalculo} categoria(s)`;
                        } else {
                            selecao.priceReviewRequired = false;
                            selecao.priceReviewReason = null;
                        }

                        // Adicionar ao log
                        selecao.addMovementLog(
                            'item_auto_removed',
                            `${itensParaRemover.length} foto(s) removida(s) automaticamente pelo sync. Fotos: ${fileNamesToRemove.join(', ')}. Tier: ${tierAntes} → ${tierDepois}. Novo total: $${recalcResult.totalRecalculado.toFixed(2)}`,
                            true,
                            null,
                            {
                                removedPhotos: fileNamesToRemove,
                                tierChange: { from: tierAntes, to: tierDepois },
                                recalculation: recalcResult
                            }
                        );

                        // Limpar selectionId dos produtos removidos no MongoDB
                        for (const item of itensParaRemover) {
                            await UnifiedProductComplete.updateOne(
                                { driveFileId: item.driveFileId },
                                {
                                    $set: {
                                        status: 'available',
                                        cdeStatus: 'INGRESADO'
                                    },
                                    $unset: {
                                        selectionId: 1,
                                        reservedBy: 1
                                    }
                                }
                            );
                        }

                        // Se não sobrou nenhum item, NÃO cancelar - apenas alertar
                        // Admin deve revisar e decidir manualmente
                        if (selecao.items.length === 0) {
                            selecao.priceReviewRequired = true;
                            selecao.priceReviewReason = 'Todas as fotos foram removidas - verificar se deve cancelar ou restaurar';
                            selecao.addMovementLog(
                                'prices_recalculated',
                                '⚠️ ATENÇÃO: Todas as fotos foram removidas automaticamente. Seleção precisa de revisão manual.',
                                true
                            );
                            console.log(`[SYNC] ⚠️ Seleção ${selecao.selectionId} COM 0 ITENS - precisa revisão manual (NÃO cancelada automaticamente)`);
                        }

                        // Salvar seleção
                        await selecao.save();

                        totalCorrecoes += itensParaRemover.length;
                        console.log(`[SYNC] ✅ Correção aplicada: ${itensParaRemover.length} fotos removidas, novo total: $${selecao.totalValue.toFixed(2)}`);
                    }

                    selecoesComProblemas.push({
                        clientName,
                        clientCode,
                        problemas: problemasDestaSelecao.length,
                        correcoes: itensParaRemover.length,
                        alertas: itensRetirado.length,
                        tierChange: itensParaRemover.length > 0 ?
                            `${this.calcularTier(items.length)} → ${this.calcularTier(selecao.items.length)}` : null
                    });
                } else {
                    console.log(`[SYNC] ✅ ${clientName}: Todas as ${items.length} fotos OK`);
                }
            }

            // RESUMO
            console.log(`------------------------------------------------------------`);
            console.log(`[SYNC] 📊 RESUMO DA VERIFICAÇÃO DE SELEÇÕES:`);
            console.log(`   Seleções verificadas: ${selecoesPending.length}`);
            console.log(`   Total de problemas: ${totalProblemas}`);
            console.log(`   Correções aplicadas: ${totalCorrecoes}`);

            if (selecoesComProblemas.length > 0) {
                console.log(`[SYNC] ⚠️ SELEÇÕES COM PROBLEMAS:`);
                selecoesComProblemas.forEach(s => {
                    console.log(`   - ${s.clientName} (${s.clientCode}): ${s.problemas} problemas, ${s.correcoes} correções`);
                    if (s.tierChange) {
                        console.log(`     Tier: ${s.tierChange}`);
                    }
                });
            }
            console.log(`------------------------------------------------------------`);

            return {
                verificadas: selecoesPending.length,
                problemas: totalProblemas,
                correcoes: totalCorrecoes,
                selecoesAfetadas: selecoesComProblemas
            };

        } catch (error) {
            console.error(`[SYNC] ❌ Erro ao verificar seleções:`, error.message);
            return { verificadas: 0, problemas: 0, erro: error.message };
        }
    }

    // ============================================
    // HELPER: CALCULAR TIER BASEADO NA QUANTIDADE
    // ============================================
    calcularTier(quantidade) {
        if (quantidade >= 37) return 'Tier 4 (37+)';
        if (quantidade >= 13) return 'Tier 3 (13-36)';
        if (quantidade >= 6) return 'Tier 2 (6-12)';
        return 'Tier 1 (1-5)';
    }

    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            mode: this.mode
        };
    }

    getLastReport() {
        return this.stats.lastReport;
    }
}

const syncInstance = new CDEIncrementalSync();
module.exports = syncInstance;
module.exports.isBusinessHours = isBusinessHours;