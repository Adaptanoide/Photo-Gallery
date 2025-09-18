// src/services/CDEIncrementalSync.js
// Serviço de Sincronização Incremental CDE - Fase 1 (Observação)

const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');

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

        // Executar primeira sincronização após 10 segundos
        setTimeout(() => this.runSync(), 10000);

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

            // Determinar período de busca baseado em se é primeira sync ou incremental
            let checkFromTime;
            let syncDescription;

            // Verificar se é a primeira sincronização (lastSyncTime é null ou muito antigo)
            const isFirstSync = !this.lastSyncTime ||
                (Date.now() - this.lastSyncTime.getTime()) > (24 * 60 * 60 * 1000);

            if (isFirstSync) {
                // Primeira sync ou após longo período - usar SYNC_INITIAL_DAYS
                const initialDays = parseInt(process.env.SYNC_INITIAL_DAYS || '7');
                checkFromTime = new Date(Date.now() - initialDays * 24 * 60 * 60 * 1000);
                syncDescription = `últimos ${initialDays} dias (sincronização inicial)`;
            } else {
                // Sincronização incremental - buscar apenas mudanças recentes
                const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES || '2');
                // Buscar o triplo do intervalo para garantir que não perdemos nada
                const lookbackMinutes = intervalMinutes * 3;
                checkFromTime = new Date(Date.now() - lookbackMinutes * 60 * 1000);
                syncDescription = `últimos ${lookbackMinutes} minutos (incremental)`;
            }

            console.log(`[SYNC] Buscando mudanças dos ${syncDescription}`);
            console.log(`[SYNC] Buscando mudanças desde: ${checkFromTime.toISOString()}`);

            // Query otimizada para buscar apenas mudanças recentes
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

            // Analisar cada mudança
            const discrepancies = [];
            let checkedCount = 0;

            for (const cdeRecord of cdeChanges) {
                const photoNumber = cdeRecord.ATIPOETIQUETA;
                const cdeStatus = cdeRecord.AESTADOP;

                // Buscar no MongoDB - adicionar padding de zeros
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
                    continue; // Foto não existe no MongoDB, pular
                }

                checkedCount++;

                // Verificar se há discrepância
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

                    // Aplicar correção se não estiver em modo observe
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
                });

                if (discrepancies.length > 10) {
                    console.log(`\n... e mais ${discrepancies.length - 10} discrepâncias`);
                }
            }

            // Atualizar timestamp para próxima execução
            this.lastSyncTime = new Date();

            const duration = Date.now() - startTime;
            console.log(`\n[SYNC] Sincronização completa em ${duration}ms`);
            console.log('='.repeat(60) + '\n');

            return {
                success: true,
                duration,
                checked: checkedCount,
                discrepancies: discrepancies.length
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
        // Se tem selectionId, sempre ignorar
        if (mongoPhoto.selectionId) {
            return 'IGNORAR - Foto em seleção confirmada';
        }

        const cdeStatus = cdeRecord.AESTADOP;
        const mongoStatus = mongoPhoto.cdeStatus;

        // Foto vendida no CDE
        if (cdeStatus === 'RETIRADO') {
            return 'MARCAR COMO VENDIDA E REMOVER DA GALERIA';
        }

        // Foto reservada fisicamente no CDE
        if (cdeStatus === 'RESERVED' || cdeStatus === 'STANDBY') {
            return 'MARCAR COMO INDISPONÍVEL E REMOVER DA GALERIA';
        }

        // Foto liberada no CDE mas marcada diferente no MongoDB
        if (cdeStatus === 'INGRESADO') {
            if (mongoPhoto.reservedBy?.clientCode) {
                return 'VERIFICAR - Está em carrinho mas CDE diz que está disponível';
            }
            return 'MARCAR COMO DISPONÍVEL';
        }

        // Foto PRE-SELECTED no CDE
        if (cdeStatus === 'PRE-SELECTED') {
            if (!mongoPhoto.reservedBy?.clientCode) {
                return 'VERIFICAR - CDE diz PRE-SELECTED mas não está em carrinho';
            }
            return 'MANTER - Consistente com carrinho';
        }

        return 'ANALISAR MANUALMENTE';
    }

    async applyCorrection(mongoPhoto, cdeRecord) {
        // Só aplica correções se estiver em modo safe ou full
        if (this.mode === 'observe') {
            return { applied: false, reason: 'Modo observe - sem alterações' };
        }

        // NUNCA tocar em fotos com selectionId (em seleções confirmadas)
        if (mongoPhoto.selectionId) {
            return { applied: false, reason: 'Foto em seleção confirmada - protegida' };
        }

        const cdeStatus = cdeRecord.AESTADOP;
        let updateFields = {};
        let actionTaken = '';

        // Determinar as mudanças necessárias baseado no status do CDE
        if (cdeStatus === 'RETIRADO') {
            updateFields = {
                status: 'sold',
                currentStatus: 'sold',
                cdeStatus: 'RETIRADO',
                'virtualStatus.status': 'sold'
            };
            actionTaken = 'Marcada como vendida';

        } else if (cdeStatus === 'RESERVED' || cdeStatus === 'STANDBY') {
            updateFields = {
                status: 'unavailable',
                currentStatus: 'unavailable',
                cdeStatus: cdeStatus,
                'virtualStatus.status': 'unavailable',
                reservedBy: null,  // Limpar reserva do carrinho
                'reservationInfo.isReserved': false
            };
            actionTaken = 'Marcada como indisponível e removida de carrinhos';

            // Também precisamos remover de carrinhos
            const Cart = require('../models/Cart');
            await Cart.updateMany(
                { 'items.fileName': mongoPhoto.fileName },
                { $pull: { items: { fileName: mongoPhoto.fileName } } }
            );

        } else if (cdeStatus === 'INGRESADO') {
            updateFields = {
                status: 'available',
                currentStatus: 'available',
                cdeStatus: 'INGRESADO',
                'virtualStatus.status': 'available'
            };
            actionTaken = 'Marcada como disponível';

        } else if (cdeStatus === 'PRE-SELECTED') {
            // PRE-SELECTED é mais complexo - só atualizar o cdeStatus
            updateFields = {
                cdeStatus: 'PRE-SELECTED'
            };
            actionTaken = 'Status CDE atualizado para PRE-SELECTED';
        }

        // Aplicar a correção se houver mudanças
        if (Object.keys(updateFields).length > 0) {
            try {
                await UnifiedProductComplete.updateOne(
                    { _id: mongoPhoto._id },
                    { $set: updateFields }
                );

                console.log(`[SYNC] ✅ Correção aplicada: Foto ${mongoPhoto.photoNumber} - ${actionTaken}`);
                return { applied: true, action: actionTaken };

            } catch (error) {
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