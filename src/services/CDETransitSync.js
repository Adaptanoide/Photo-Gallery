// src/services/CDETransitSync.js
// Serviço de Sincronização de Fotos em Trânsito (Coming Soon)

const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const CDEWriter = require('./CDEWriter');

// Identificação única da instância
const INSTANCE_ID = process.env.SYNC_INSTANCE_ID || 'unknown';
console.log(`[Transit Sync] Instance ID: ${INSTANCE_ID}`);

class CDETransitSync {
    constructor() {
        this.environment = process.env.NODE_ENV || 'development';
        this.instanceId = `transit_${this.environment}_${process.env.HOSTNAME || 'local'}`;
        this.lastSyncTime = null;
        this.isRunning = false;
        this.syncInterval = null;

        this.stats = {
            totalTransitPhotos: 0,
            newPhotosAdded: 0,
            photosArrived: 0,
            statusCorrected: 0,
            lastRun: null,
            lastReport: []
        };

        console.log('[Transit Sync] Serviço inicializado');
    }

    // Iniciar sincronização periódica
    start(intervalMinutes = 5) {
        if (this.syncInterval) {
            console.log('[Transit Sync] Sincronização já está rodando');
            return;
        }

        console.log(`[Transit Sync] Sistema iniciado - Verificando a cada ${intervalMinutes} minutos`);

        // Executar primeira vez após 1 minuto
        setTimeout(() => this.runSync(), 60000);

        // Configurar intervalo regular
        this.syncInterval = setInterval(() => {
            this.runSync();
        }, intervalMinutes * 60 * 1000);
    }

    stop() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            this.isRunning = false;
            console.log('[Transit Sync] Sincronização parada');
        }
    }

    async runSync() {
        if (this.isRunning) {
            console.log('[Transit Sync] Sincronização já em andamento, pulando...');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();
        let cdeConnection = null;

        try {
            console.log('\n' + '='.repeat(60));
            console.log('[Transit Sync] INICIANDO SINCRONIZAÇÃO DE TRÂNSITO');
            console.log(`[Transit Sync] Timestamp: ${new Date().toISOString()}`);
            console.log('='.repeat(60));

            // Conectar ao CDE
            cdeConnection = await mysql.createConnection({
                host: process.env.CDE_HOST,
                port: process.env.CDE_PORT,
                user: process.env.CDE_USER,
                password: process.env.CDE_PASSWORD,
                database: process.env.CDE_DATABASE
            });

            // ===== ETAPA 1: BUSCAR FOTOS EM TRÂNSITO NO CDE =====
            console.log('\n[Transit Sync] Etapa 1: Buscando fotos em trânsito na tbetiqueta...');

            const [transitPhotos] = await cdeConnection.execute(`
                SELECT 
                    LPAD(ATIPOETIQUETA, 5, '0') as ATIPOETIQUETA,
                    AESTADOP,
                    AQBITEM,
                    AINVOICE,
                    AFECHA
                FROM tbetiqueta 
                WHERE ATIPOETIQUETA IS NOT NULL 
                AND ATIPOETIQUETA != '' 
                AND ATIPOETIQUETA != '0'
                AND (AESTADOP = 'PRE-TRANSITO' OR AESTADOP = 'WAREHOUSE')
                ORDER BY AFECHA DESC
            `);

            console.log(`[Transit Sync] ✅ ${transitPhotos.length} fotos em trânsito encontradas no CDE`);
            this.stats.totalTransitPhotos = transitPhotos.length;

            // ===== ETAPA 2: SINCRONIZAR COM MONGODB =====
            console.log('\n[Transit Sync] Etapa 2: Sincronizando com MongoDB...');

            let newPhotos = 0;
            let updatedPhotos = 0;

            for (const cdePhoto of transitPhotos) {
                const photoNumber = cdePhoto.ATIPOETIQUETA;

                // Buscar no MongoDB
                const mongoPhoto = await UnifiedProductComplete.findOne({
                    $or: [
                        { photoNumber: photoNumber },
                        { fileName: `${photoNumber}.webp` }
                    ]
                });

                if (!mongoPhoto) {
                    // Foto não existe no MongoDB - pode ser que não tenha sido processada ainda
                    // Não fazemos nada, deixamos o sync-incoming ou outro processo cuidar
                    continue;
                }

                // Verificar se já está marcada corretamente como coming_soon
                if (mongoPhoto.transitStatus === 'coming_soon' &&
                    mongoPhoto.cdeTable === 'tbetiqueta') {
                    // Já está correto, pular
                    continue;
                }

                // Atualizar para marcar como coming soon
                await UnifiedProductComplete.updateOne(
                    { _id: mongoPhoto._id },
                    {
                        $set: {
                            transitStatus: 'coming_soon',
                            cdeTable: 'tbetiqueta',
                            cdeStatus: cdePhoto.AESTADOP,
                            qbItem: cdePhoto.AQBITEM,
                            lastCDESync: new Date()
                        }
                    }
                );

                if (!mongoPhoto.transitStatus) {
                    newPhotos++;
                } else {
                    updatedPhotos++;
                }
            }

            console.log(`[Transit Sync] ✅ ${newPhotos} novas fotos marcadas como coming soon`);
            console.log(`[Transit Sync] ✅ ${updatedPhotos} fotos atualizadas`);
            this.stats.newPhotosAdded = newPhotos;

            // ===== ETAPA 3: DETECTAR FOTOS QUE CHEGARAM =====
            console.log('\n[Transit Sync] Etapa 3: Detectando fotos que chegaram...');

            const comingSoonPhotos = await UnifiedProductComplete.find({
                transitStatus: 'coming_soon',
                cdeTable: 'tbetiqueta'
            }).read('primary');  // ← FORÇA LER DO PRIMARY!

            // ===== DEBUG LOG - TEMPORÁRIO =====
            console.log(`[Transit Sync] 📊 Query retornou ${comingSoonPhotos.length} fotos`);

            // Se 28541 está na lista, logar detalhes
            const photo28541 = comingSoonPhotos.find(p => p.photoNumber === '28541');
            if (photo28541) {
                console.log('[Transit Sync] ⚠️ FOTO 28541 ENCONTRADA NA QUERY!');
                console.log(`   transitStatus: ${photo28541.transitStatus}`);
                console.log(`   cdeTable: ${photo28541.cdeTable}`);
                console.log(`   status: ${photo28541.status}`);
                console.log(`   _id: ${photo28541._id}`);
            }
            // ===== FIM DEBUG =====

            console.log(`[Transit Sync] Verificando ${comingSoonPhotos.length} fotos coming soon...`);

            let arrivedCount = 0;
            let correctedCount = 0;

            for (const mongoPhoto of comingSoonPhotos) {
                // Verificar se apareceu na tbinventario
                const [inventarioResult] = await cdeConnection.execute(
                    'SELECT AESTADOP, AQBITEM FROM tbinventario WHERE ATIPOETIQUETA = ?',
                    [mongoPhoto.photoNumber]
                );

                if (inventarioResult.length > 0) {
                    // FOTO CHEGOU! Está na tbinventario
                    arrivedCount++;

                    const currentCDEStatus = inventarioResult[0].AESTADOP;

                    console.log(`\n[Transit Sync] 📦 FOTO CHEGOU: ${mongoPhoto.photoNumber}`);
                    console.log(`   Status atual no CDE: ${currentCDEStatus}`);
                    console.log(`   Verificando reservas...`);

                    // Determinar status correto baseado NO STATUS DO CDE PRIMEIRO
                    let correctStatus = null;
                    let mongoStatus = null;
                    let reason = '';

                    // PRIORIDADE 1: Se CDE diz RETIRADO → foto vendida!
                    if (currentCDEStatus === 'RETIRADO') {
                        correctStatus = 'RETIRADO';
                        mongoStatus = 'sold';
                        reason = 'Foto vendida no CDE (RETIRADO)';
                    }
                    // PRIORIDADE 2: Se CDE diz STANDBY/RESERVED → indisponível
                    else if (currentCDEStatus === 'STANDBY' || currentCDEStatus === 'RESERVED') {
                        correctStatus = currentCDEStatus;
                        mongoStatus = 'unavailable';
                        reason = `Foto ${currentCDEStatus} no CDE`;
                    }
                    // PRIORIDADE 3: CDE diz INGRESADO → verificar reservas MongoDB
                    else if (currentCDEStatus === 'INGRESADO') {
                        // Se tem seleção confirmada
                        if (mongoPhoto.selectionId) {
                            correctStatus = 'CONFIRMED';
                            mongoStatus = 'in_selection';
                            reason = `Foto tem selectionId: ${mongoPhoto.selectionId}`;
                        }
                        // Se tem reserva (carrinho ativo)
                        else if (mongoPhoto.reservedBy?.clientCode) {
                            correctStatus = 'PRE-SELECTED';
                            mongoStatus = 'reserved';
                            reason = `Foto reservada por cliente: ${mongoPhoto.reservedBy.clientCode}`;
                        }
                        // Sem reserva - deixar disponível
                        else {
                            correctStatus = 'INGRESADO';
                            mongoStatus = 'available';
                            reason = 'Sem reserva - disponível';
                        }
                    }
                    // Qualquer outro status do CDE
                    else {
                        correctStatus = currentCDEStatus;
                        mongoStatus = 'unavailable';
                        reason = `Status desconhecido no CDE: ${currentCDEStatus}`;
                    }

                    console.log(`   Decisão: ${reason}`);

                    // Corrigir no CDE se necessário
                    if (correctStatus && currentCDEStatus !== correctStatus) {
                        console.log(`   Corrigindo no CDE: ${currentCDEStatus} → ${correctStatus}`);

                        try {
                            // Usar CDEWriter com os métodos corretos
                            if (correctStatus === 'CONFIRMED') {
                                // Buscar info do cliente para incluir nome e sales rep
                                const clientCode = mongoPhoto.reservedBy?.clientCode || '';
                                const clientName = mongoPhoto.reservedBy?.clientName || 'Client';

                                await CDEWriter.markAsConfirmed(
                                    mongoPhoto.photoNumber,
                                    clientCode,
                                    clientName,
                                    'system' // Sales rep = system (transição automática)
                                );
                            } else if (correctStatus === 'PRE-SELECTED') {
                                const clientCode = mongoPhoto.reservedBy?.clientCode || '';
                                const clientName = mongoPhoto.reservedBy?.clientName || 'Client';

                                await CDEWriter.markAsReserved(
                                    mongoPhoto.photoNumber,
                                    clientCode,
                                    clientName,
                                    'system' // Sales rep = system (transição automática)
                                );
                            }

                            correctedCount++;
                            console.log(`   ✅ Status corrigido no CDE`);
                        } catch (error) {
                            console.error(`   ❌ Erro ao corrigir status no CDE:`, error.message);
                        }
                    } else if (correctStatus) {
                        console.log(`   ✅ Status já correto no CDE: ${correctStatus}`);
                    }

                    // Atualizar MongoDB - remover flags de trânsito
                    await UnifiedProductComplete.updateOne(
                        { _id: mongoPhoto._id },
                        {
                            $set: {
                                transitStatus: null,
                                cdeTable: 'tbinventario',
                                cdeStatus: correctStatus || currentCDEStatus,
                                status: mongoStatus,  // ✅ Usa status determinado pela lógica
                                currentStatus: mongoStatus,
                                'virtualStatus.status': mongoStatus,
                                lastCDESync: new Date()
                            }
                        }
                    );

                    console.log(`   ✅ MongoDB atualizado - foto agora disponível`);
                }
            }

            console.log(`\n[Transit Sync] ✅ ${arrivedCount} fotos detectadas como chegadas`);
            console.log(`[Transit Sync] ✅ ${correctedCount} fotos tiveram status corrigido no CDE`);

            this.stats.photosArrived = arrivedCount;
            this.stats.statusCorrected = correctedCount;

            // ===== RELATÓRIO FINAL =====
            const duration = Date.now() - startTime;
            console.log('\n' + '='.repeat(60));
            console.log('[Transit Sync] SINCRONIZAÇÃO CONCLUÍDA');
            console.log('='.repeat(60));
            console.log(`Fotos em trânsito no CDE: ${transitPhotos.length}`);
            console.log(`Novas fotos marcadas: ${newPhotos}`);
            console.log(`Fotos atualizadas: ${updatedPhotos}`);
            console.log(`Fotos que chegaram: ${arrivedCount}`);
            console.log(`Status corrigidos no CDE: ${correctedCount}`);
            console.log(`Duração: ${duration}ms`);
            console.log('='.repeat(60) + '\n');

            this.lastSyncTime = new Date();
            this.stats.lastRun = new Date();

            return {
                success: true,
                duration,
                transitPhotos: transitPhotos.length,
                newPhotos,
                arrived: arrivedCount,
                corrected: correctedCount
            };

        } catch (error) {
            console.error('\n[Transit Sync] ❌ ERRO na sincronização:', error);
            console.error(error.stack);

            return {
                success: false,
                error: error.message
            };
        } finally {
            this.isRunning = false;
            if (cdeConnection) await cdeConnection.end();
        }
    }

    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            lastSyncTime: this.lastSyncTime
        };
    }
}

const transitSyncInstance = new CDETransitSync();
module.exports = transitSyncInstance;