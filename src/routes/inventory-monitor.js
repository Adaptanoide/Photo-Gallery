// src/routes/inventory-monitor.js
const express = require('express');
const router = express.Router();
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const { authenticateToken } = require('./auth');
const mysql = require('mysql2/promise');

// Proteger rota - apenas admins
router.use(authenticateToken);

// ===== ROTA DE TESTE: Scan Básico =====
router.get('/scan', async (req, res) => {
    let cdeConnection = null;

    try {
        console.log('[INVENTORY-MONITOR] 🔍 Iniciando scan básico...');

        // 1. Conectar no CDE
        cdeConnection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            port: process.env.CDE_PORT,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });

        console.log('[INVENTORY-MONITOR] ✅ Conectado ao CDE');

        // 2. Buscar 10 fotos available no MongoDB (para teste)
        const mongoPhotos = await UnifiedProductComplete.find({
            status: 'available',
            photoNumber: { $exists: true, $ne: null, $ne: '0', $ne: '' },
            isActive: true
        })
            .select('photoNumber status cdeStatus qbItem category fileName');

        console.log(`[INVENTORY-MONITOR] 📸 Encontradas ${mongoPhotos.length} fotos no MongoDB`);

        // 3. Preparar lista de números de fotos
        const photoNumbers = mongoPhotos.map(p => p.photoNumber);
        console.log(`[INVENTORY-MONITOR] 🔍 Buscando ${photoNumbers.length} fotos no CDE...`);

        // 4. Buscar TODAS de uma vez no CDE (Query Única)
        const placeholders = photoNumbers.map(() => '?').join(',');
        const [cdeResults] = await cdeConnection.execute(
            `SELECT ATIPOETIQUETA, AESTADOP, RESERVEDUSU, AQBITEM 
             FROM tbinventario 
             WHERE ATIPOETIQUETA IN (${placeholders})
             AND ATIPOETIQUETA != '0'
             AND ATIPOETIQUETA != ''
             AND ATIPOETIQUETA IS NOT NULL`,
            photoNumbers
        );

        console.log(`[INVENTORY-MONITOR] 📊 CDE retornou ${cdeResults.length} registros`);

        // 5. Criar mapa para lookup rápido (APENAS photoNumber como chave)
        const cdeMap = new Map();
        cdeResults.forEach(row => {
            const key = row.ATIPOETIQUETA;  // ← Chave = apenas número da foto

            // Se não existe, criar array vazio
            if (!cdeMap.has(key)) {
                cdeMap.set(key, []);
            }

            // Adicionar ao array (pode ter múltiplas entradas)
            cdeMap.get(key).push({
                photoNumber: row.ATIPOETIQUETA,
                status: row.AESTADOP,
                reservedBy: row.RESERVEDUSU,
                qbItem: row.AQBITEM
            });
        });

        // 6. Array para guardar divergências
        const discrepancies = [];

        // 7. Comparar cada foto do MongoDB com o CDE
        for (const mongoPhoto of mongoPhotos) {
            // Buscar por photoNumber apenas
            const cdeDataArray = cdeMap.get(mongoPhoto.photoNumber);

            if (!cdeDataArray || cdeDataArray.length === 0) {
                // Foto existe no MongoDB mas não encontrada no CDE
                console.log(`[INVENTORY-MONITOR] ⚠️ Foto ${mongoPhoto.photoNumber} não encontrada no CDE`);
                continue;
            }

            // Tentar encontrar match exato por qbItem
            let cdeData;
            if (mongoPhoto.qbItem) {
                // MongoDB tem qbItem, buscar match exato
                cdeData = cdeDataArray.find(d => d.qbItem === mongoPhoto.qbItem);

                if (!cdeData) {
                    // Não achou match, pegar o primeiro (mas marcar como warning)
                    cdeData = cdeDataArray[0];
                }
            } else {
                // MongoDB não tem qbItem, pegar o primeiro do CDE
                cdeData = cdeDataArray[0];
            }

            // Agora verificar divergências
            const cdeStatus = cdeData.status;
            let hasProblem = false;
            let severity = 'ok';
            let issue = '';

            // 🔴 CRÍTICAS - Status
            if (cdeStatus === 'RETIRADO') {
                hasProblem = true;
                severity = 'critical';
                issue = 'Sold in CDE but available in gallery';
            }

            // 🟡 MÉDIAS - Status
            if (cdeStatus === 'STANDBY') {
                hasProblem = true;
                severity = 'medium';
                issue = 'Standby in CDE but available in gallery';
            }

            if (cdeStatus === 'PRE-SELECTED') {
                hasProblem = true;
                severity = 'medium';
                issue = 'In cart (CDE) but available in MongoDB';
            }

            if (cdeStatus === 'CONFIRMED' || cdeStatus === 'RESERVED') {
                hasProblem = true;
                severity = 'medium';
                issue = 'Selection confirmed but available in gallery';
            }

            // ⚠️ AVISOS - QB Item
            if (!mongoPhoto.qbItem && cdeData.qbItem) {
                hasProblem = true;
                severity = 'warning';
                issue = `QB Item missing in MongoDB (CDE has ${cdeData.qbItem})`;
            }

            if (mongoPhoto.qbItem && cdeData.qbItem && mongoPhoto.qbItem !== cdeData.qbItem) {
                hasProblem = true;
                severity = 'warning';
                issue = `QB Item mismatch: MongoDB=${mongoPhoto.qbItem} vs CDE=${cdeData.qbItem}`;
            }

            // Se tem problema, adicionar à lista
            if (hasProblem) {
                discrepancies.push({
                    photoNumber: mongoPhoto.photoNumber,
                    fileName: mongoPhoto.fileName,
                    mongoStatus: mongoPhoto.status,
                    mongoQbItem: mongoPhoto.qbItem || 'null',
                    cdeStatus: cdeStatus,
                    cdeQbItem: cdeData.qbItem || 'null',
                    category: mongoPhoto.category,
                    severity: severity,
                    issue: issue
                });
            }
        }

        console.log(`[INVENTORY-MONITOR] ✅ Scan completo. ${discrepancies.length} divergências encontradas`);

        // 8. Agrupar por severidade
        const bySeverity = {
            critical: discrepancies.filter(d => d.severity === 'critical'),
            medium: discrepancies.filter(d => d.severity === 'medium'),
            warning: discrepancies.filter(d => d.severity === 'warning')
        };

        // 9. Agrupar por QB Item (categoria)
        const byCategory = {};
        discrepancies.forEach(d => {
            const qb = d.cdeQbItem || 'Unknown';
            if (!byCategory[qb]) {
                byCategory[qb] = {
                    qbItem: qb,
                    count: 0,
                    photos: []
                };
            }
            byCategory[qb].count++;
            byCategory[qb].photos.push(d);
        });

        // 10. Retornar resultado completo
        res.json({
            success: true,
            data: {
                summary: {
                    totalScanned: mongoPhotos.length,
                    totalDiscrepancies: discrepancies.length,
                    critical: bySeverity.critical.length,
                    medium: bySeverity.medium.length,
                    warning: bySeverity.warning.length,
                    scanTime: new Date().toISOString()
                },
                bySeverity: bySeverity,
                byCategory: byCategory,
                discrepancies: discrepancies
            }
        });

    } catch (error) {
        console.error('[INVENTORY-MONITOR] ❌ Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Error scanning inventory',
            error: error.message
        });
    } finally {
        if (cdeConnection) {
            await cdeConnection.end();
        }
    }
});

module.exports = router;