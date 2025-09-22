// src/services/CDEIncrementalSync.js
// Serviço de Sincronização Incremental CDE - Versão Refatorada

const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const Cart = require('../models/Cart');

class CDEIncrementalSync {
    constructor() {
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

    start(intervalMinutes = 2) {
        if (this.syncInterval) {
            console.log('[SYNC] Sincronização já está rodando');
            return;
        }

        console.log(`[SYNC] Iniciando sincronização incremental a cada ${intervalMinutes} minutos em modo ${this.mode}`);

        // Executar primeira sincronização após 30 segundos (dar tempo para sistema inicializar)
        setTimeout(() => this.runSync(), 30000);

        // Configurar intervalo regular
        this.syncInterval = setInterval(
            () => this.runSync(),
            intervalMinutes * 60 * 1000
        );
    }

    stop() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            this.isRunning = false;
            console.log('[SYNC] Sincronização parada');
        }
    }

    async runSync() {
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
                (Date.now() - this.lastSyncTime.getTime()) > (24 * 60 * 60 * 1000);

            if (isFirstSync) {
                const initialDays = parseInt(process.env.SYNC_INITIAL_DAYS || '7');
                checkFromTime = new Date(Date.now() - initialDays * 24 * 60 * 60 * 1000);
                syncDescription = `últimos ${initialDays} dias (sincronização inicial)`;
            } else {
                const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES || '2');
                const lookbackMinutes = intervalMinutes * 3;
                checkFromTime = new Date(Date.now() - lookbackMinutes * 60 * 1000);
                syncDescription = `últimos ${lookbackMinutes} minutos (incremental)`;
            }

            console.log(`[SYNC] Buscando mudanças dos ${syncDescription}`);
            console.log(`[SYNC] Buscando mudanças desde: ${checkFromTime.toISOString()}`);

            // Query para buscar mudanças recentes
            const [cdeChanges] = await cdeConnection.execute(
                `SELECT ATIPOETIQUETA, AESTADOP, RESERVEDUSU, AFECHA 
                 FROM tbinventario 
                 WHERE ATIPOETIQUETA != '0' 
                 AND ATIPOETIQUETA != ''
                 AND AFECHA >= ?
                 ORDER BY AFECHA DESC
                 LIMIT 500`,
                [checkFromTime]
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

                // NOVO: Verificar se está em carrinho ativo
                if (mongoPhoto.reservedBy?.clientCode) {
                    // Verificar se realmente está em um carrinho ativo
                    const activeCart = await Cart.findOne({
                        clientCode: mongoPhoto.reservedBy.clientCode,
                        'items.fileName': mongoPhoto.fileName,
                        isActive: true
                    });

                    if (activeCart) {
                        skippedInCart++;
                        continue; // NUNCA mexer em fotos que estão em carrinho ativo
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
        }
    }

    determineSuggestedAction(mongoPhoto, cdeRecord) {
        // Se tem selectionId, ignorar
        if (mongoPhoto.selectionId) {
            return 'IGNORAR - Foto em seleção confirmada';
        }

        // Se está em carrinho, ignorar
        if (mongoPhoto.reservedBy?.clientCode) {
            return 'IGNORAR - Foto em carrinho ativo';
        }

        const cdeStatus = cdeRecord.AESTADOP;

        // Determinar ação baseada no status do CDE
        if (cdeStatus === 'RETIRADO') {
            return 'MARCAR COMO VENDIDA';
        }

        if (cdeStatus === 'RESERVED' || cdeStatus === 'STANDBY') {
            return 'MARCAR COMO INDISPONÍVEL';
        }

        if (cdeStatus === 'INGRESADO') {
            return 'MARCAR COMO DISPONÍVEL';
        }

        if (cdeStatus === 'PRE-SELECTED') {
            return 'VERIFICAR MANUALMENTE - PRE-SELECTED sem carrinho';
        }

        if (cdeStatus === 'CONFIRMED') {
            return 'VERIFICAR MANUALMENTE - CONFIRMED sem seleção';
        }

        return 'ANALISAR MANUALMENTE';
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
                    currentStatus: 'sold',
                    cdeStatus: 'RETIRADO',
                    'virtualStatus.status': 'sold'
                };
                actionTaken = 'Marcada como vendida';
                break;

            case 'RESERVED':
            case 'STANDBY':
                updateFields = {
                    status: 'unavailable',
                    currentStatus: 'unavailable',
                    cdeStatus: cdeStatus,
                    'virtualStatus.status': 'unavailable'
                };
                actionTaken = 'Marcada como indisponível';
                break;

            case 'INGRESADO':
                // Só marcar como available se não estiver em uso
                if (mongoPhoto.status !== 'available') {
                    updateFields = {
                        status: 'available',
                        currentStatus: 'available',
                        cdeStatus: 'INGRESADO',
                        'virtualStatus.status': 'available'
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

module.exports = new CDEIncrementalSync();