// src/routes/inventory-monitor.js - COM COMPARAÇÃO DE TOTAIS
const express = require('express');
const router = express.Router();
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const Selection = require('../models/Selection');
const { authenticateToken } = require('./auth');
const mysql = require('mysql2/promise');

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

router.get('/scan', async (req, res) => {
    let cdeConnection = null;
    const startTime = Date.now();

    try {
        console.log('[MONITOR] 🔍 Scan iniciado...');

        const critical = [];
        const medium = [];
        const warnings = [];

        cdeConnection = await connectCDE();

        // ===== BUSCAR FOTOS AVAILABLE/RESERVED NO MONGODB =====
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
            .select('photoNumber status qbItem category selectionId')
            .lean();

        console.log(`[MONITOR] 📸 ${mongoPhotos.length} fotos MongoDB (available/reserved)`);

        // ===== BUSCAR TOTAIS NO CDE =====
        const [cdeCount] = await cdeConnection.execute(
            `SELECT COUNT(*) as total
             FROM tbinventario 
             WHERE AESTADOP = 'INGRESADO'
             AND ATIPOETIQUETA REGEXP '^[0-9]{5}$'`
        );

        const totalCdeIngresado = cdeCount[0].total;
        console.log(`[MONITOR] 📦 ${totalCdeIngresado} fotos CDE (INGRESADO)`);

        // ===== BUSCAR FOTOS INGRESADO NO CDE =====
        const [allCdeIngresado] = await cdeConnection.execute(
            `SELECT ATIPOETIQUETA, AQBITEM
             FROM tbinventario 
             WHERE AESTADOP = 'INGRESADO'
             AND ATIPOETIQUETA REGEXP '^[0-9]{5}$'
             ORDER BY ATIPOETIQUETA`
        );

        console.log(`[MONITOR] 📋 ${allCdeIngresado.length} fotos INGRESADO para verificar`);

        // Criar mapa MongoDB (rápido)
        const mongoMap = new Map();
        mongoPhotos.forEach(p => {
            mongoMap.set(p.photoNumber, p);
        });

        // ===== VERIFICAÇÃO: CDE → MONGODB =====
        const missingInMongo = [];

        for (const cdePhoto of allCdeIngresado) {
            const mongoPhoto = mongoMap.get(cdePhoto.ATIPOETIQUETA);

            if (!mongoPhoto) {
                missingInMongo.push({
                    photoNumber: cdePhoto.ATIPOETIQUETA,
                    issue: 'Foto existe mas não aparece',
                    description: 'CDE tem INGRESADO mas MongoDB não tem available',
                    mongoStatus: 'NÃO EXISTE',
                    cdeStatus: 'INGRESADO',
                    mongoQb: '-',
                    cdeQb: cdePhoto.AQBITEM || '-',
                    category: 'Desconhecida'
                });
            }
        }

        console.log(`[MONITOR] ⚠️ ${missingInMongo.length} fotos INGRESADO não aparecem na galeria`);

        // Adicionar aos críticos
        critical.push(...missingInMongo);

        // ===== BUSCAR NO CDE (BATCH PARA FOTOS MONGODB) =====
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

        // ===== BUSCAR SELEÇÕES ATIVAS =====
        const activeSelections = await Selection.find({
            status: { $in: ['pending', 'confirmed', 'approving'] }
        }).select('_id items.fileName').lean();

        // ===== VERIFICAR CADA FOTO MONGODB =====
        for (const photo of mongoPhotos) {
            const cdeData = cdeMap.get(photo.photoNumber);

            // 🔴 CRÍTICO: Foto vendida aparecendo
            if (cdeData && cdeData.status === 'RETIRADO' && photo.status === 'available') {
                critical.push({
                    photoNumber: photo.photoNumber,
                    issue: 'Foto vendida aparecendo disponível',
                    description: 'Cliente pode comprar foto que já foi vendida',
                    mongoStatus: photo.status,
                    cdeStatus: cdeData.status,
                    mongoQb: photo.qbItem || '-',
                    cdeQb: cdeData.qbItem || '-',
                    category: photo.category
                });
            }

            // 🔴 CRÍTICO: Seleção órfã
            if (photo.selectionId) {
                const selectionExists = activeSelections.find(
                    s => s._id.toString() === photo.selectionId
                );
                if (!selectionExists) {
                    critical.push({
                        photoNumber: photo.photoNumber,
                        issue: 'Foto travada em seleção cancelada',
                        description: 'Foto não liberou depois que seleção foi cancelada',
                        mongoStatus: photo.status,
                        cdeStatus: cdeData ? cdeData.status : 'N/A',
                        mongoQb: photo.qbItem || '-',
                        cdeQb: cdeData ? cdeData.qbItem : '-',
                        category: photo.category
                    });
                }
            }

            // 🟡 MÉDIO: Pass pendente
            if (cdeData && photo.qbItem && cdeData.qbItem &&
                photo.qbItem !== cdeData.qbItem &&
                cdeData.qbItem.match(/^[0-9]{4}/)) {
                medium.push({
                    photoNumber: photo.photoNumber,
                    issue: 'Foto mudou de categoria (Pass pendente)',
                    description: 'Foto passou para outra categoria mas sistema não atualizou',
                    mongoStatus: photo.status,
                    cdeStatus: cdeData.status,
                    mongoQb: photo.qbItem,
                    cdeQb: cdeData.qbItem,
                    category: photo.category
                });
            }

            // 🟢 AVISO: Sem QB Code
            if (!photo.qbItem && cdeData && cdeData.qbItem &&
                cdeData.qbItem.match(/^[0-9]{4}/)) {
                warnings.push({
                    photoNumber: photo.photoNumber,
                    issue: 'Foto sem preço definido',
                    description: 'MongoDB não tem QB Code mas CDE tem',
                    mongoStatus: photo.status,
                    cdeStatus: cdeData ? cdeData.status : 'N/A',
                    mongoQb: 'NULL',
                    cdeQb: cdeData.qbItem,
                    category: photo.category
                });
            }
        }

        // ===== RESULTADO =====
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const difference = totalCdeIngresado - mongoPhotos.length;

        console.log(`[MONITOR] ✅ Scan completo`);
        console.log(`[MONITOR] 📊 CDE: ${totalCdeIngresado} | MongoDB: ${mongoPhotos.length} | Diferença: ${difference}`);
        console.log(`[MONITOR] 🔴 ${critical.length} críticos | 🟡 ${medium.length} médios | 🟢 ${warnings.length} avisos`);

        res.json({
            success: true,
            data: {
                summary: {
                    totalScanned: mongoPhotos.length,
                    totalCdeIngresado: totalCdeIngresado,
                    totalMongoAvailable: mongoPhotos.length,
                    difference: difference,
                    totalDiscrepancies: critical.length + medium.length + warnings.length,
                    critical: critical.length,
                    medium: medium.length,
                    warnings: warnings.length,
                    scanTime: new Date().toISOString(),
                    duration: `${elapsed}s`
                },
                critical,
                medium,
                warnings
            }
        });

    } catch (error) {
        console.error('[MONITOR] ❌ Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao escanear',
            error: error.message
        });
    } finally {
        if (cdeConnection) {
            await cdeConnection.end();
        }
    }
});

module.exports = router;