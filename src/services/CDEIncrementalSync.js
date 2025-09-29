// src/services/CDEIncrementalSync.js
// Serviço de Sincronização Incremental CDE - Versão Refatorada

const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const Cart = require('../models/Cart');

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
            lastReport: []
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
            const strategy = getSyncStrategy();

            if (strategy.type === 'skip') {
                console.log('[SYNC] Fora do horário - pulando sync');
                return;
            }

            // ADICIONE ESTA LINHA:
            await cleanupOldLocks(); // Limpar locks antigos antes de tentar

            // Executar sync apropriado
            if (strategy.type === 'business_hours') {
                console.log('[SYNC] Horário comercial - sync rápido');
                await this.runSync();
            } else if (strategy.type === 'nightly') {
                console.log('[SYNC] Sync noturno');
                await this.runSync();
            } else if (strategy.type === 'weekly_full') {
                console.log('[SYNC] Sync semanal completo');
                await this.runSmartSync();
            }
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

        // Tentar adquirir lock
        const lockAcquired = await acquireSyncLock();
        if (!lockAcquired) {
            console.log('🔒 [CDE Sync] Não foi possível adquirir lock');
            return { success: false, message: 'Sync locked by another instance' };
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
                    'SELECT AESTADOP FROM tbinventario WHERE ATIPOETIQUETA = ?',
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
            await releaseSyncLock();
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

        // Tentar adquirir lock
        const lockAcquired = await acquireSyncLock();
        if (!lockAcquired) {
            console.log('🔒 [CDE Sync] Não foi possível adquirir lock');
            return { success: false, message: 'Sync locked by another instance' };
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

            // Determinar período de busca
            let checkFromTime;
            let syncDescription;

            const isFirstSync = !this.lastSyncTime ||
                (Date.now() - this.lastSyncTime.getTime()) > (7 * 24 * 60 * 60 * 1000);

            if (isFirstSync) {
                const initialDays = parseInt(process.env.SYNC_INITIAL_DAYS || '1');
                checkFromTime = new Date(Date.now() - initialDays * 24 * 60 * 60 * 1000);
                checkFromTime.setHours(0, 0, 0, 0); // Início do dia
                syncDescription = `últimos ${initialDays} dias (sincronização inicial)`;
            } else {
                // Em vez de horas específicas, buscar desde o início de ontem
                checkFromTime = new Date();
                checkFromTime.setDate(checkFromTime.getDate() - 1);
                checkFromTime.setHours(0, 0, 0, 0); // Meia-noite de ontem
                syncDescription = `desde ontem (incremental)`;
            }

            console.log(`[SYNC] Buscando mudanças dos ${syncDescription}`);
            console.log(`[SYNC] Buscando mudanças desde: ${checkFromTime.toISOString()}`);

            // Query para buscar mudanças recentes - agora COM filtro de data
            const [cdeChanges] = await cdeConnection.execute(
                `SELECT LPAD(ATIPOETIQUETA, 5, '0') as ATIPOETIQUETA, AESTADOP, RESERVEDUSU, AFECHA 
                FROM tbinventario 
                WHERE ATIPOETIQUETA != '0' 
                AND ATIPOETIQUETA != ''
                AND ATIPOETIQUETA IS NOT NULL
                AND LENGTH(ATIPOETIQUETA) > 0
                AND AFECHA >= ?
                ORDER BY AFECHA DESC`,
                [checkFromTime]  // Agora USA o parâmetro de data!
            );
            console.log(`[SYNC] ${cdeChanges.length} mudanças encontradas no CDE`);

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
            await releaseSyncLock();
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
                    // Campo removido - virtualStatus
                };
                actionTaken = 'Marcada como vendida';
                break;

            case 'RESERVED':
            case 'STANDBY':
                updateFields = {
                    status: 'unavailable',
                    cdeStatus: cdeStatus,
                    // Campo removido - virtualStatus
                };
                actionTaken = 'Marcada como indisponível';
                break;

            case 'INGRESADO':
                // Só marcar como available se não estiver em uso
                if (mongoPhoto.status !== 'available') {
                    updateFields = {
                        status: 'available',
                        cdeStatus: 'INGRESADO',
                        // Campo removido - virtualStatus
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