// src/routes/inventory-monitor.js - VERSÃO ESPANHOL COMPLETA
const express = require('express');
const router = express.Router();
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const Selection = require('../models/Selection');
const { authenticateToken } = require('./auth');
const mysql = require('mysql2/promise');
const syncInstance = require('../services/CDEIncrementalSync');

router.use(authenticateToken);

async function connectCDE() {
    return await mysql.createConnection({
        host: process.env.CDE_HOST,
        port: process.env.CDE_PORT,
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE
    });
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

        const issues = {
            critical: [],
            warnings: [],
            autoFixable: []
        };

        cdeConnection = await connectCDE();

        const mongoPhotos = await UnifiedProductComplete.find({
            photoNumber: {
                $exists: true,
                $ne: null,
                $ne: '0',
                $ne: '',
                $regex: /^\d{5}$/
            },
            isActive: true,
            status: { $in: ['available', 'reserved'] }
        })
            .select('photoNumber status qbItem category selectionId specialFlags')
            .lean();

        console.log(`[MONITOR] 📸 ${mongoPhotos.length} fotos MongoDB (available/reserved)`);

        const [cdeCount] = await cdeConnection.execute(
            `SELECT COUNT(*) as total
             FROM tbinventario 
             WHERE AESTADOP = 'INGRESADO'
             AND ATIPOETIQUETA REGEXP '^[0-9]{5}$'`
        );

        const totalCdeIngresado = cdeCount[0].total;
        console.log(`[MONITOR] 📦 ${totalCdeIngresado} fotos CDE (INGRESADO)`);

        const [allCdeIngresado] = await cdeConnection.execute(
            `SELECT ATIPOETIQUETA, AQBITEM
             FROM tbinventario 
             WHERE AESTADOP = 'INGRESADO'
             AND ATIPOETIQUETA REGEXP '^[0-9]{5}$'
             ORDER BY ATIPOETIQUETA`
        );

        console.log(`[MONITOR] 📋 ${allCdeIngresado.length} fotos INGRESADO para verificar`);

        const mongoMap = new Map();
        mongoPhotos.forEach(p => {
            mongoMap.set(p.photoNumber, p);
        });

        // VERIFICACIÓN: CDE → MONGODB
        for (const cdePhoto of allCdeIngresado) {
            const mongoPhoto = mongoMap.get(cdePhoto.ATIPOETIQUETA);

            if (!mongoPhoto) {
                const inactivePhoto = await UnifiedProductComplete.findOne({
                    photoNumber: cdePhoto.ATIPOETIQUETA,
                    isActive: false
                }).select('photoNumber isActive status').lean();

                if (inactivePhoto) {
                    continue;
                }

                const photoWithFlags = await UnifiedProductComplete.findOne({
                    photoNumber: cdePhoto.ATIPOETIQUETA
                }).select('specialFlags').lean();

                if (photoWithFlags?.specialFlags?.preventAutoSold) {
                    continue;
                }

                issues.critical.push({
                    photoNumber: cdePhoto.ATIPOETIQUETA,
                    severity: 'critical',
                    issue: 'Foto no aparece en la galería',
                    description: `La foto ${cdePhoto.ATIPOETIQUETA} está INGRESADO en CDE pero no está visible en la galería.`,
                    possibleCauses: [
                        { cause: 'Número reutilizado (foto antigua vendida)', probability: 'Probable' },
                        { cause: 'Error de sincronización', probability: 'Posible' },
                        { cause: 'Foto creada recientemente', probability: 'Menos probable' }
                    ],
                    suggestedActions: [
                        'Verificar si existe foto antigua vendida con mismo número',
                        'Aguardar próximo sync automático (5 min)',
                        'Verificar historial en CDE'
                    ],
                    mongoStatus: 'NO EXISTE',
                    cdeStatus: 'INGRESADO',
                    mongoQb: '-',
                    cdeQb: cdePhoto.AQBITEM || '-',
                    category: 'Desconocida',
                    syncCanFix: false,
                    needsManualReview: true
                });
            }
        }

        const photoNumbers = mongoPhotos.map(p => p.photoNumber);
        const placeholders = photoNumbers.map(() => '?').join(',');

        const [cdeResults] = await cdeConnection.execute(
            `SELECT 
                ATIPOETIQUETA,
                AESTADOP,
                AQBITEM
            FROM (
                SELECT 
                    ATIPOETIQUETA,
                    AESTADOP,
                    AQBITEM,
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
            photoNumbers
        );

        const cdeMap = new Map();
        cdeResults.forEach(row => {
            cdeMap.set(row.ATIPOETIQUETA, {
                status: row.AESTADOP,
                qbItem: row.AQBITEM
            });
        });

        const allSelections = await Selection.find({
            status: { $in: ['pending', 'confirmed', 'approving', 'finalized'] }
        }).select('_id status clientName items.fileName selectionId').lean();

        // VERIFICAR CADA FOTO MONGODB
        for (const photo of mongoPhotos) {
            const cdeData = cdeMap.get(photo.photoNumber);

            // CRÍTICO: Foto vendida apareciendo
            if (cdeData && cdeData.status === 'RETIRADO' && photo.status === 'available') {
                issues.critical.push({
                    photoNumber: photo.photoNumber,
                    severity: 'critical',
                    issue: 'Inconsistencia crítica detectada',
                    description: `Foto ${photo.photoNumber}: Sistema CDE registra como RETIRADO (vendida), pero galería muestra como disponible para compra.`,
                    possibleCauses: [
                        { cause: 'Venta reciente no sincronizada', probability: 'Probable' },
                        { cause: 'Reversión manual sin actualizar galería', probability: 'Posible' },
                        { cause: 'Error en procesamiento', probability: 'Improbable' }
                    ],
                    suggestedActions: [
                        'Aguardar próximo ciclo de sincronización (5 min)',
                        'Verificar historial de movimiento en CDE',
                        'Si persiste, investigar manualmente'
                    ],
                    mongoStatus: photo.status,
                    cdeStatus: cdeData.status,
                    mongoQb: photo.qbItem || '-',
                    cdeQb: cdeData.qbItem || '-',
                    category: photo.category,
                    syncCanFix: true,
                    needsManualReview: false
                });
            }

            // AVISO: Foto con referencia a pedido
            if (photo.selectionId) {
                const selection = allSelections.find(
                    s => s.selectionId === photo.selectionId || s._id.toString() === photo.selectionId
                );

                if (selection) {
                    if (selection.status === 'finalized') {
                        if (cdeData?.status === 'INGRESADO') {
                            issues.warnings.push({
                                photoNumber: photo.photoNumber,
                                severity: 'warning',
                                issue: 'Divergencia en pedido finalizado',
                                description: `Foto ${photo.photoNumber} consta en pedido finalizado (Cliente: ${selection.clientName}), pero sistema CDE registra estado INGRESADO en lugar de RETIRADO.`,
                                possibleCauses: [
                                    { cause: 'Foto puede haber sido sustituida durante embalaje', probability: 'Probable' },
                                    { cause: 'Posible devolución no registrada', probability: 'Posible' },
                                    { cause: 'Salida no registrada en sistema', probability: 'Menos probable' }
                                ],
                                suggestedActions: [
                                    `Verificar con almacén si foto ${photo.photoNumber} fue realmente enviada`,
                                    `Buscar registro de posible sustituta`,
                                    `Revisar documentación de salida del pedido`,
                                    `Si confirmado no-envío, considerar liberar para venta`
                                ],
                                mongoStatus: photo.status,
                                cdeStatus: cdeData.status,
                                mongoQb: photo.qbItem || '-',
                                cdeQb: cdeData ? cdeData.qbItem : '-',
                                category: photo.category,
                                selectionInfo: {
                                    client: selection.clientName,
                                    status: 'Finalizado'
                                },
                                syncCanFix: false,
                                needsManualReview: true
                            });
                        }
                    }
                } else {
                    issues.warnings.push({
                        photoNumber: photo.photoNumber,
                        severity: 'warning',
                        issue: 'Referencia a pedido no localizado',
                        description: `Foto ${photo.photoNumber} posee marcación de pedido, pero el pedido correspondiente no fue encontrado en el sistema.`,
                        possibleCauses: [
                            { cause: 'Pedido puede haber sido cancelado', probability: 'Probable' },
                            { cause: 'Posible error en limpieza tras cancelación', probability: 'Posible' },
                            { cause: 'Inconsistencia en base de datos', probability: 'Menos probable' }
                        ],
                        suggestedActions: [
                            'Verificar historial de pedidos cancelados',
                            'Considerar remover marcación de pedido',
                            'Liberar foto para venta si apropiado'
                        ],
                        mongoStatus: photo.status,
                        cdeStatus: cdeData ? cdeData.status : 'N/A',
                        mongoQb: photo.qbItem || '-',
                        cdeQb: cdeData ? cdeData.qbItem : '-',
                        category: photo.category,
                        syncCanFix: false,
                        needsManualReview: true
                    });
                }
            }

            // INFO: Categoría desactualizada
            if (cdeData && photo.qbItem && cdeData.qbItem &&
                photo.qbItem !== cdeData.qbItem &&
                cdeData.qbItem.match(/^[0-9]{4}/)) {
                issues.autoFixable.push({
                    photoNumber: photo.photoNumber,
                    severity: 'info',
                    issue: 'Categoría puede estar desactualizada',
                    description: `Foto ${photo.photoNumber}: CDE indica categoría ${cdeData.qbItem}, pero galería muestra ${photo.qbItem}.`,
                    possibleCauses: [
                        { cause: 'Cambio reciente aguardando sincronización', probability: 'Muy probable' },
                        { cause: 'Proceso de sincronización en curso', probability: 'Probable' }
                    ],
                    suggestedActions: [
                        'Aguardar ciclo de sincronización automática',
                        'Si persiste después de 15 minutos, investigar'
                    ],
                    mongoStatus: photo.status,
                    cdeStatus: cdeData.status,
                    mongoQb: photo.qbItem,
                    cdeQb: cdeData.qbItem,
                    category: photo.category,
                    syncCanFix: true,
                    needsManualReview: false
                });
            }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const difference = totalCdeIngresado - mongoPhotos.length;
        const totalIssues = issues.critical.length + issues.warnings.length + issues.autoFixable.length;

        console.log(`[MONITOR] ✅ Scan completo`);
        console.log(`[MONITOR] 📊 CDE: ${totalCdeIngresado} | MongoDB: ${mongoPhotos.length} | Diferença: ${difference}`);

        res.json({
            success: true,
            data: {
                summary: {
                    totalScanned: mongoPhotos.length,
                    totalCdeIngresado: totalCdeIngresado,
                    totalMongoAvailable: mongoPhotos.length,
                    difference: difference,
                    totalDiscrepancies: totalIssues,
                    critical: issues.critical.length,
                    medium: issues.autoFixable.length, // ← AUTO-FIX aqui
                    warnings: issues.warnings.length
                },
                critical: issues.critical,
                medium: issues.autoFixable, // ← AUTO-FIX aqui
                warnings: issues.warnings
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