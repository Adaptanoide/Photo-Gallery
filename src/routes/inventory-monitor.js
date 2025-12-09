// src/routes/inventory-monitor.js - VERSÃO COMPLETA COM TODAS VERIFICAÇÕES
const express = require('express');
const router = express.Router();
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const Selection = require('../models/Selection');
const { authenticateToken } = require('./auth');
const mysql = require('mysql2/promise');
const syncInstance = require('../services/CDEIncrementalSync');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

router.use(authenticateToken);

// Configurar cliente R2
const r2Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'sunshine-photos';

async function connectCDE() {
    return await mysql.createConnection({
        host: process.env.CDE_HOST,
        port: process.env.CDE_PORT,
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE
    });
}

// Cache de fotos no R2 (atualizado a cada scan)
let r2PhotosCache = new Set();
let r2CacheTimestamp = null;

async function loadR2PhotosCache() {
    console.log('[MONITOR] 📂 Carregando lista de fotos do R2...');
    const startTime = Date.now();
    r2PhotosCache = new Set();

    const prefixes = [
        'Brazil Best Sellers/',
        'Brazil Top Selected Categories/'
    ];

    for (const prefix of prefixes) {
        let continuationToken = null;

        do {
            const command = new ListObjectsV2Command({
                Bucket: BUCKET_NAME,
                Prefix: prefix,
                MaxKeys: 1000,
                ContinuationToken: continuationToken
            });

            const response = await r2Client.send(command);

            if (response.Contents) {
                for (const obj of response.Contents) {
                    // Extrair número da foto do path
                    const match = obj.Key.match(/\/(\d+)\.webp$/);
                    if (match) {
                        r2PhotosCache.add(match[1]);
                        // Também adicionar com zeros à esquerda
                        r2PhotosCache.add(match[1].padStart(5, '0'));
                    }
                }
            }

            continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
        } while (continuationToken);
    }

    r2CacheTimestamp = new Date();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[MONITOR] ✅ ${r2PhotosCache.size} fotos encontradas no R2 (${elapsed}s)`);
}

function photoExistsInR2(photoNumber) {
    if (!photoNumber) return false;

    // Verificar várias formas
    const variations = [
        photoNumber,
        photoNumber.padStart(5, '0'),
        String(parseInt(photoNumber, 10))
    ];

    return variations.some(v => r2PhotosCache.has(v));
}

router.get('/sync-status', async (req, res) => {
    try {
        const stats = syncInstance.getStats();

        res.json({
            success: true,
            data: {
                isRunning: stats.isRunning,
                lastRun: stats.lastRun,
                nextRun: stats.lastRun ?
                    new Date(stats.lastRun.getTime() + 5 * 60 * 1000) : null,
                totalChecked: stats.totalChecked,
                discrepanciesFound: stats.discrepanciesFound,
                mode: stats.mode,
                executionCount: stats.executionCount
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/scan', async (req, res) => {
    let cdeConnection = null;
    const startTime = Date.now();

    try {
        console.log('[MONITOR] 🔍 Scan iniciado...');

        // Estrutura de issues com TODAS as categorias
        const issues = {
            critical: [],      // 🔴 Risco de venda dupla
            warnings: [],      // 🟡 Requer investigação
            pendingSync: [],   // 🔄 Foto existe no R2 mas não no MongoDB
            noPhoto: [],       // 📷 Couro sem foto
            autoFixable: [],   // 🔧 Sync vai resolver
            pass: [],          // 🔄 Múltiplos registros (PASS)
            standby: []        // ⏸️ Fotos em STANDBY no CDE
        };

        // 1. Conectar ao CDE
        cdeConnection = await connectCDE();
        console.log('[MONITOR] ✅ CDE conectado');

        // 2. Carregar cache de fotos R2
        await loadR2PhotosCache();

        // 3. Buscar fotos no MongoDB (todas ativas)
        const mongoPhotos = await UnifiedProductComplete.find({
            photoNumber: {
                $exists: true,
                $ne: null,
                $ne: '0',
                $ne: ''
            },
            isActive: true,
            status: { $in: ['available', 'reserved'] }
        })
            .select('photoNumber status qbItem category selectionId specialFlags')
            .lean();

        console.log(`[MONITOR] 📸 ${mongoPhotos.length} fotos MongoDB (available/reserved)`);

        // 4. Buscar TODAS as fotos INGRESADO no CDE
        const [allCdeIngresado] = await cdeConnection.execute(
            `SELECT ATIPOETIQUETA, AQBITEM, AIDH, AFECHA
             FROM tbinventario 
             WHERE AESTADOP = 'INGRESADO'
             AND ATIPOETIQUETA IS NOT NULL
             AND ATIPOETIQUETA != ''
             AND ATIPOETIQUETA != '0'
             AND ATIPOETIQUETA REGEXP '^[0-9]+$'
             AND LENGTH(ATIPOETIQUETA) >= 3
             ORDER BY ATIPOETIQUETA`
        );

        const totalCdeIngresado = allCdeIngresado.length;
        console.log(`[MONITOR] 📦 ${totalCdeIngresado} fotos CDE (INGRESADO)`);

        // 5. Criar mapas para comparação
        const mongoMapExact = new Map();
        const mongoMapNumeric = new Map();

        mongoPhotos.forEach(p => {
            if (p.photoNumber) {
                mongoMapExact.set(p.photoNumber, p);
                const numericKey = String(parseInt(p.photoNumber, 10));
                if (!mongoMapNumeric.has(numericKey)) {
                    mongoMapNumeric.set(numericKey, p);
                }
            }
        });

        // ============================================================
        // VERIFICAÇÃO 1: CDE INGRESADO → MongoDB (fotos no CDE que não estão no MongoDB)
        // ============================================================
        console.log('[MONITOR] 🔍 Verificando CDE → MongoDB...');

        for (const cdePhoto of allCdeIngresado) {
            const atipoetiqueta = cdePhoto.ATIPOETIQUETA;

            // Tentar encontrar no MongoDB
            let mongoPhoto = mongoMapExact.get(atipoetiqueta);
            if (!mongoPhoto) {
                const numericKey = String(parseInt(atipoetiqueta, 10));
                mongoPhoto = mongoMapNumeric.get(numericKey);
            }
            if (!mongoPhoto) {
                const padded = atipoetiqueta.padStart(5, '0');
                mongoPhoto = mongoMapExact.get(padded);
            }

            if (!mongoPhoto) {
                // Verificar se existe como inativa ou sold
                const existingPhoto = await UnifiedProductComplete.findOne({
                    $or: [
                        { photoNumber: atipoetiqueta },
                        { photoNumber: atipoetiqueta.padStart(5, '0') },
                        { photoNumber: String(parseInt(atipoetiqueta, 10)) }
                    ]
                }).select('photoNumber isActive status specialFlags').lean();

                // Se existe como inativa, ignorar
                if (existingPhoto?.isActive === false) {
                    continue;
                }

                // Se tem flag de proteção, ignorar
                if (existingPhoto?.specialFlags?.preventAutoSold) {
                    continue;
                }

                // Se existe como SOLD + CDE INGRESADO = possível retorno
                if (existingPhoto?.status === 'sold') {
                    issues.warnings.push({
                        photoNumber: cdePhoto.ATIPOETIQUETA,
                        severity: 'warning',
                        issue: 'Posible retorno de mercadería',
                        description: `La foto ${cdePhoto.ATIPOETIQUETA} está marcada como vendida en MongoDB pero aparece INGRESADO en CDE. Puede ser un retorno o cancelación.`,
                        mongoStatus: 'sold',
                        cdeStatus: 'INGRESADO',
                        mongoQb: existingPhoto.qbItem || '-',
                        cdeQb: cdePhoto.AQBITEM || '-',
                        cdeAidh: cdePhoto.AIDH,
                        syncCanFix: false,
                        needsManualReview: true
                    });
                    continue;
                }

                // Foto NÃO existe no MongoDB - verificar se tem imagem no R2
                const hasR2Photo = photoExistsInR2(atipoetiqueta);

                if (hasR2Photo) {
                    // 🔄 PENDIENTE SYNC: Foto existe no R2 mas não foi importada
                    issues.pendingSync.push({
                        photoNumber: cdePhoto.ATIPOETIQUETA,
                        severity: 'sync',
                        issue: 'Foto pendiente de sincronización',
                        description: `La foto ${cdePhoto.ATIPOETIQUETA} existe en R2 y está INGRESADO en CDE, pero no fue importada al MongoDB. El sync debería importarla.`,
                        mongoStatus: 'NO EXISTE',
                        cdeStatus: 'INGRESADO',
                        mongoQb: '-',
                        cdeQb: cdePhoto.AQBITEM || '-',
                        cdeAidh: cdePhoto.AIDH,
                        hasR2Photo: true,
                        syncCanFix: true,
                        needsManualReview: false
                    });
                } else {
                    // 📷 SIN FOTO: Couro no warehouse sem foto
                    issues.noPhoto.push({
                        photoNumber: cdePhoto.ATIPOETIQUETA,
                        severity: 'nophoto',
                        issue: 'Couro sin foto en galería',
                        description: `La foto ${cdePhoto.ATIPOETIQUETA} está INGRESADO en CDE pero no tiene imagen en R2. El couro necesita ser fotografiado.`,
                        mongoStatus: 'NO EXISTE',
                        cdeStatus: 'INGRESADO',
                        mongoQb: '-',
                        cdeQb: cdePhoto.AQBITEM || '-',
                        cdeAidh: cdePhoto.AIDH,
                        hasR2Photo: false,
                        syncCanFix: false,
                        needsManualReview: true
                    });
                }
            }
        }

        // ============================================================
        // VERIFICAÇÃO 2: Buscar fotos com MÚLTIPLOS REGISTROS no CDE (PASS)
        // ============================================================
        console.log('[MONITOR] 🔍 Verificando PASS (múltiplos registros)...');

        const [duplicatesInCde] = await cdeConnection.execute(`
            SELECT 
                ATIPOETIQUETA,
                COUNT(*) as total,
                GROUP_CONCAT(DISTINCT AESTADOP ORDER BY AESTADOP) as estados,
                GROUP_CONCAT(DISTINCT AQBITEM ORDER BY AQBITEM) as categorias
            FROM tbinventario
            WHERE ATIPOETIQUETA IS NOT NULL
            AND ATIPOETIQUETA != ''
            AND ATIPOETIQUETA != '0'
            AND ATIPOETIQUETA REGEXP '^[0-9]+$'
            AND LENGTH(ATIPOETIQUETA) >= 3
            GROUP BY ATIPOETIQUETA
            HAVING COUNT(*) > 1
        `);

        for (const dup of duplicatesInCde) {
            const qbs = (dup.categorias || '').split(',').filter(q => q);
            const estados = (dup.estados || '').split(',');

            // 1. Se não tem múltiplos QBs, não é PASS
            if (qbs.length <= 1) {
                continue;
            }

            // 2. Se NÃO tem INGRESADO, ignorar (todos vendidos - não importa)
            if (!estados.includes('INGRESADO')) {
                continue;
            }

            // 3. Buscar foto no MongoDB
            const mongoPhoto = mongoMapExact.get(dup.ATIPOETIQUETA) ||
                mongoMapExact.get(dup.ATIPOETIQUETA.padStart(5, '0')) ||
                mongoMapNumeric.get(String(parseInt(dup.ATIPOETIQUETA, 10)));

            // 4. Se MongoDB não existe ou não está ativo, não é PASS
            if (!mongoPhoto) {
                continue;
            }

            // 5. Buscar QB do registro INGRESADO no CDE
            const [ingresadoData] = await cdeConnection.execute(`
                SELECT AQBITEM FROM tbinventario 
                WHERE ATIPOETIQUETA = ? AND AESTADOP = 'INGRESADO'
                ORDER BY AFECHA DESC LIMIT 1
            `, [dup.ATIPOETIQUETA]);

            if (ingresadoData.length === 0) {
                continue;
            }

            const ingresadoQb = ingresadoData[0].AQBITEM;

            // 6. SÓ É PASS se QB do MongoDB ≠ QB do INGRESADO
            if (mongoPhoto.qbItem === ingresadoQb) {
                continue; // MongoDB já está correto
            }

            // 🔀 PASS REAL: MongoDB tem QB diferente do CDE INGRESADO
            issues.pass.push({
                photoNumber: dup.ATIPOETIQUETA,
                severity: 'pass',
                issue: 'PASS - Categoría cambió en CDE',
                description: `La foto ${dup.ATIPOETIQUETA} necesita actualización: MongoDB tiene ${mongoPhoto.qbItem}, pero CDE INGRESADO tiene ${ingresadoQb}. Requiere mover la imagen en R2.`,
                mongoStatus: mongoPhoto.status,
                mongoQb: mongoPhoto.qbItem,
                cdeStatus: 'INGRESADO',
                cdeQb: ingresadoQb,
                passDetails: {
                    totalRegistros: dup.total,
                    categorias: qbs,
                    estados: estados,
                    mongoQb: mongoPhoto.qbItem,
                    cdeIngresadoQb: ingresadoQb
                },
                hasR2Photo: photoExistsInR2(dup.ATIPOETIQUETA),
                syncCanFix: false,
                needsManualReview: true
            });
        }

        // ============================================================
        // VERIFICAÇÃO 3: MongoDB → CDE (fotos no MongoDB com problemas no CDE)
        // ============================================================
        console.log('[MONITOR] 🔍 Verificando MongoDB → CDE...');

        const photoNumbers = mongoPhotos.map(p => p.photoNumber);

        // Processar em lotes
        const batchSize = 500;
        const cdeMap = new Map();

        for (let i = 0; i < photoNumbers.length; i += batchSize) {
            const batch = photoNumbers.slice(i, i + batchSize);
            if (batch.length === 0) continue;

            const placeholders = batch.map(() => '?').join(',');

            const [cdeResults] = await cdeConnection.execute(
                `SELECT 
                    ATIPOETIQUETA,
                    AESTADOP,
                    AQBITEM,
                    AIDH
                FROM (
                    SELECT 
                        ATIPOETIQUETA,
                        AESTADOP,
                        AQBITEM,
                        AIDH,
                        ROW_NUMBER() OVER (
                            PARTITION BY ATIPOETIQUETA 
                            ORDER BY 
                                CASE AESTADOP 
                                    WHEN 'INGRESADO' THEN 1
                                    WHEN 'PRE-SELECTED' THEN 2
                                    WHEN 'CONFIRMED' THEN 3
                                    WHEN 'RETIRADO' THEN 4
                                    ELSE 5
                                END,
                                AFECHA DESC
                        ) as rn
                    FROM tbinventario 
                    WHERE ATIPOETIQUETA IN (${placeholders})
                ) ranked
                WHERE rn = 1`,
                batch
            );

            cdeResults.forEach(row => {
                cdeMap.set(row.ATIPOETIQUETA, {
                    status: row.AESTADOP,
                    qbItem: row.AQBITEM,
                    aidh: row.AIDH
                });
            });
        }

        // Buscar seleções para verificar fotos em pedidos
        const allSelections = await Selection.find({
            status: { $in: ['pending', 'confirmed', 'approving', 'finalized'] }
        }).select('_id status clientName items.fileName selectionId').lean();

        // Verificar cada foto do MongoDB
        for (const photo of mongoPhotos) {
            const cdeData = cdeMap.get(photo.photoNumber);

            // 🔴 CRÍTICO: RETIRADO no CDE + available no MongoDB
            if (cdeData && cdeData.status === 'RETIRADO' && photo.status === 'available') {
                issues.critical.push({
                    photoNumber: photo.photoNumber,
                    severity: 'critical',
                    issue: '¡RIESGO DE VENTA DUPLICADA!',
                    description: `La foto ${photo.photoNumber} está RETIRADO (vendida) en CDE pero aparece disponible en la galería. ¡Puede venderse nuevamente!`,
                    mongoStatus: photo.status,
                    cdeStatus: cdeData.status,
                    mongoQb: photo.qbItem || '-',
                    cdeQb: cdeData.qbItem || '-',
                    syncCanFix: true,
                    needsManualReview: false
                });
            }

            // 🔴 CRÍTICO: RESERVED/STANDBY no CDE + available no MongoDB
            if (cdeData && ['RESERVED', 'STANDBY'].includes(cdeData.status) && photo.status === 'available') {
                issues.critical.push({
                    photoNumber: photo.photoNumber,
                    severity: 'critical',
                    issue: 'Foto reservada aparece disponible',
                    description: `La foto ${photo.photoNumber} está ${cdeData.status} en CDE pero aparece disponible en la galería.`,
                    mongoStatus: photo.status,
                    cdeStatus: cdeData.status,
                    mongoQb: photo.qbItem || '-',
                    cdeQb: cdeData.qbItem || '-',
                    syncCanFix: true,
                    needsManualReview: false
                });
            }

            // 🟡 WARNING: Foto em seleção finalizada + CDE INGRESADO
            if (photo.selectionId) {
                const selection = allSelections.find(
                    s => s.selectionId === photo.selectionId || s._id.toString() === photo.selectionId
                );

                if (selection) {
                    if (selection.status === 'finalized' && cdeData?.status === 'INGRESADO') {
                        issues.warnings.push({
                            photoNumber: photo.photoNumber,
                            severity: 'warning',
                            issue: 'Foto en pedido finalizado pero no retirada',
                            description: `La foto ${photo.photoNumber} está en pedido finalizado (Cliente: ${selection.clientName}) pero CDE muestra INGRESADO. Puede ser sustitución o error.`,
                            mongoStatus: photo.status,
                            cdeStatus: cdeData.status,
                            mongoQb: photo.qbItem || '-',
                            cdeQb: cdeData.qbItem || '-',
                            selectionInfo: {
                                client: selection.clientName,
                                status: selection.status,
                                selectionId: selection.selectionId
                            },
                            syncCanFix: false,
                            needsManualReview: true
                        });
                    }
                } else {
                    // Referência a pedido que não existe
                    issues.warnings.push({
                        photoNumber: photo.photoNumber,
                        severity: 'warning',
                        issue: 'Referencia a pedido no localizado',
                        description: `La foto ${photo.photoNumber} tiene marcación de pedido (${photo.selectionId}) pero el pedido no fue encontrado.`,
                        mongoStatus: photo.status,
                        cdeStatus: cdeData ? cdeData.status : 'N/A',
                        mongoQb: photo.qbItem || '-',
                        cdeQb: cdeData ? cdeData.qbItem : '-',
                        syncCanFix: false,
                        needsManualReview: true
                    });
                }
            }

            // 🔧 AUTO-CORRECCIÓN: QB diferente
            if (cdeData && photo.qbItem && cdeData.qbItem &&
                photo.qbItem !== cdeData.qbItem &&
                cdeData.qbItem.match(/^[0-9]{4}/)) {
                issues.autoFixable.push({
                    photoNumber: photo.photoNumber,
                    severity: 'autofix',
                    issue: 'Categoría desactualizada',
                    description: `La foto ${photo.photoNumber}: MongoDB tiene ${photo.qbItem}, CDE tiene ${cdeData.qbItem}. El sync automático corregirá.`,
                    mongoStatus: photo.status,
                    cdeStatus: cdeData.status,
                    mongoQb: photo.qbItem,
                    cdeQb: cdeData.qbItem,
                    syncCanFix: true,
                    needsManualReview: false
                });
            }
        }

        // ============================================================
        // VERIFICAÇÃO 5: FOTOS EM STANDBY NO CDE
        // ============================================================
        console.log('[MONITOR] 🔍 Verificando fotos em STANDBY...');

        const [standbyPhotos] = await cdeConnection.execute(
            `SELECT ATIPOETIQUETA, AQBITEM, AIDH
             FROM tbinventario
             WHERE AESTADOP = 'STANDBY'
             AND ATIPOETIQUETA IS NOT NULL
             AND ATIPOETIQUETA != ''
             AND ATIPOETIQUETA != '0'
             AND ATIPOETIQUETA REGEXP '^[0-9]+$'
             AND LENGTH(ATIPOETIQUETA) >= 3
             ORDER BY AQBITEM, ATIPOETIQUETA`
        );

        for (const standbyPhoto of standbyPhotos) {
            const photoNum = standbyPhoto.ATIPOETIQUETA;
            const existsInR2 = photoExistsInR2(photoNum);

            issues.standby.push({
                photoNumber: photoNum,
                severity: 'standby',
                issue: 'Foto en STANDBY',
                description: `La foto ${photoNum} está en STANDBY en el CDE. No aparece en la galería hasta que sea liberada.`,
                mongoStatus: 'N/A',
                cdeStatus: 'STANDBY',
                mongoQb: '-',
                cdeQb: standbyPhoto.AQBITEM || '-',
                existsInR2: existsInR2,
                needsManualReview: false
            });
        }

        console.log(`[MONITOR] ⏸️ ${issues.standby.length} fotos en STANDBY`);

        // ============================================================
        // RESULTADO FINAL
        // ============================================================
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const totalIssues =
            issues.critical.length +
            issues.warnings.length +
            issues.pendingSync.length +
            issues.noPhoto.length +
            issues.autoFixable.length +
            issues.pass.length +
            issues.standby.length;

        console.log(`[MONITOR] ✅ Scan completo em ${elapsed}s`);
        console.log(`[MONITOR] 📊 Resultados:`);
        console.log(`   🔴 Crítico: ${issues.critical.length}`);
        console.log(`   🟡 Warning: ${issues.warnings.length}`);
        console.log(`   🔄 Pendiente Sync: ${issues.pendingSync.length}`);
        console.log(`   📷 Sin Foto: ${issues.noPhoto.length}`);
        console.log(`   🔧 Auto-corrección: ${issues.autoFixable.length}`);
        console.log(`   🔄 PASS: ${issues.pass.length}`);
        console.log(`   ⏸️ STANDBY: ${issues.standby.length}`);

        res.json({
            success: true,
            data: {
                summary: {
                    totalScanned: mongoPhotos.length,
                    totalCdeIngresado: totalCdeIngresado,
                    totalR2Photos: r2PhotosCache.size,
                    r2CacheTime: r2CacheTimestamp,
                    scanTime: elapsed,
                    totalDiscrepancies: totalIssues,
                    critical: issues.critical.length,
                    warnings: issues.warnings.length,
                    pendingSync: issues.pendingSync.length,
                    noPhoto: issues.noPhoto.length,
                    autoFixable: issues.autoFixable.length,
                    pass: issues.pass.length,
                    standby: issues.standby.length
                },
                critical: issues.critical,
                warnings: issues.warnings,
                pendingSync: issues.pendingSync,
                noPhoto: issues.noPhoto,
                autoFixable: issues.autoFixable,
                pass: issues.pass,
                standby: issues.standby
            }
        });

    } catch (error) {
        console.error('[MONITOR] ❌ Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Error al escanear',
            error: error.message
        });
    } finally {
        if (cdeConnection) {
            await cdeConnection.end();
        }
    }
});

module.exports = router;