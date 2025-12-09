// src/routes/monitor-actions.js
// ROTAS DE AÇÕES DO INVENTORY MONITOR
// Permite que admins executem correções detectadas pelo monitor

const express = require('express');
const router = express.Router();
const MonitorActionService = require('../services/MonitorActionService');
const { authenticateToken } = require('./auth');

// Todas as rotas requerem autenticação de admin
router.use(authenticateToken);

// ============================================
// AÇÃO 1: CORRIGIR RETORNO
// ============================================
// POST /api/monitor-actions/retorno
// Body: { photoNumber: "00026", adminUser: "admin@email.com" }
router.post('/retorno', async (req, res) => {
    try {
        const { photoNumber, adminUser } = req.body;

        // Validação
        if (!photoNumber) {
            return res.status(400).json({
                success: false,
                message: 'Campo photoNumber é obrigatório'
            });
        }

        // Validar que é admin autenticado
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Apenas administradores podem executar esta ação'
            });
        }

        // Log da ação
        console.log(`[MONITOR ACTION API] Corrigindo retorno da foto ${photoNumber}`);
        console.log(`   Executado por: ${adminUser || req.user.username}`);

        // Executar ação
        const result = await MonitorActionService.corrigirRetorno(
            photoNumber,
            adminUser || req.user.username
        );

        // Retornar resultado
        if (result.success) {
            return res.json({
                success: true,
                message: result.message,
                data: {
                    photoNumber,
                    action: 'retorno',
                    changes: result.changes,
                    timestamp: new Date().toISOString()
                }
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.message,
                photoNumber
            });
        }

    } catch (error) {
        console.error('[MONITOR ACTION API] Erro ao corrigir retorno:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno ao processar ação',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ============================================
// AÇÃO 2: APLICAR PASE (SEMPRE MOVE NO R2!)
// ============================================
// POST /api/monitor-actions/pase
// Body: { photoNumber: "00026", adminUser: "admin@email.com" }
router.post('/pase', async (req, res) => {
    try {
        const { photoNumber, adminUser } = req.body;

        // Validação
        if (!photoNumber) {
            return res.status(400).json({
                success: false,
                message: 'Campo photoNumber é obrigatório'
            });
        }

        // Validar que é admin autenticado
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Apenas administradores podem executar esta ação'
            });
        }

        // Log da ação
        console.log(`[MONITOR ACTION API] Aplicando pase da foto ${photoNumber}`);
        console.log(`   Executado por: ${adminUser || req.user.username}`);

        // Executar ação
        const result = await MonitorActionService.aplicarPase(
            photoNumber,
            adminUser || req.user.username
        );

        // Retornar resultado
        if (result.success) {
            return res.json({
                success: true,
                message: result.message,
                data: {
                    photoNumber,
                    action: 'pase',
                    changes: result.changes,
                    timestamp: new Date().toISOString()
                }
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.message,
                photoNumber
            });
        }

    } catch (error) {
        console.error('[MONITOR ACTION API] Erro ao aplicar pase:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno ao processar ação',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ============================================
// BUSCAR INFORMAÇÕES COMPLETAS DA FOTO
// ============================================
// GET /api/monitor-actions/photo-info/:photoNumber
// Busca dados do MongoDB + CDE para análise antes de ação
router.get('/photo-info/:photoNumber', async (req, res) => {
    try {
        const { photoNumber } = req.params;

        // Validar que é admin autenticado
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Apenas administradores podem acessar esta informação'
            });
        }

        console.log(`[MONITOR ACTION API] Buscando info da foto ${photoNumber}`);

        // Buscar no MongoDB
        const UnifiedProductComplete = require('../models/UnifiedProductComplete');
        const photo = await UnifiedProductComplete.findOne({
            $or: [
                { photoNumber: photoNumber },
                { photoNumber: photoNumber.padStart(5, '0') }
            ]
        });

        if (!photo) {
            return res.status(404).json({
                success: false,
                message: `Foto ${photoNumber} não encontrada no MongoDB`
            });
        }

        // Buscar no CDE
        const mysql = require('mysql2/promise');
        const cdeConnection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            port: process.env.CDE_PORT,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });

        // Usar o photoNumber EXATO do MongoDB para buscar no CDE
        const actualPhotoNumber = photo.photoNumber;

        const [cdeData] = await cdeConnection.execute(
            'SELECT ATIPOETIQUETA, AESTADOP, AQBITEM FROM tbinventario WHERE ATIPOETIQUETA = ? ORDER BY AFECHA DESC LIMIT 1',
            [actualPhotoNumber]
        );

        await cdeConnection.end();

        const cdeInfo = cdeData.length > 0 ? cdeData[0] : null;

        // Retornar dados combinados
        return res.json({
            success: true,
            photoNumber: actualPhotoNumber,
            mongoStatus: photo.status,
            mongoQb: photo.qbItem,
            mongoCdeStatus: photo.cdeStatus,
            category: photo.category,
            r2Path: photo.r2Path,
            cdeStatus: cdeInfo ? cdeInfo.AESTADOP : 'N/A',
            cdeQb: cdeInfo ? cdeInfo.AQBITEM : null,
            cdeExists: !!cdeInfo,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[MONITOR ACTION API] Erro ao buscar info da foto:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno ao buscar informações',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ============================================
// AÇÃO 3: MARCAR COMO VENDIDA (CRÍTICO)
// ============================================
// POST /api/monitor-actions/vendida
// Body: { photoNumber: "00046", adminUser: "admin@email.com" }
// Usado quando: MongoDB=available mas CDE=RETIRADO
router.post('/vendida', async (req, res) => {
    try {
        const { photoNumber, adminUser } = req.body;

        // Validação
        if (!photoNumber) {
            return res.status(400).json({
                success: false,
                message: 'Campo photoNumber é obrigatório'
            });
        }

        // Validar que é admin autenticado
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Apenas administradores podem executar esta ação'
            });
        }

        // Log da ação
        console.log(`[MONITOR ACTION API] Marcando foto ${photoNumber} como vendida`);
        console.log(`   Executado por: ${adminUser || req.user.username}`);

        // Buscar foto no MongoDB
        const UnifiedProductComplete = require('../models/UnifiedProductComplete');
        const photo = await UnifiedProductComplete.findOne({
            $or: [
                { photoNumber: photoNumber },
                { photoNumber: photoNumber.padStart(5, '0') }
            ]
        });

        if (!photo) {
            return res.status(404).json({
                success: false,
                message: `Foto ${photoNumber} não encontrada no MongoDB`
            });
        }

        // Usar o photoNumber exato do MongoDB
        const actualPhotoNumber = photo.photoNumber;

        // Guardar estado anterior
        const before = {
            status: photo.status,
            cdeStatus: photo.cdeStatus,
            qbItem: photo.qbItem
        };

        // Atualizar para vendida
        const updates = {
            status: 'sold',
            cdeStatus: 'RETIRADO',
            currentStatus: 'sold'
        };

        await UnifiedProductComplete.updateOne(
            { _id: photo._id },
            { $set: updates }
        );

        console.log(`[MONITOR ACTION] ✅ Foto ${actualPhotoNumber} marcada como vendida`);
        console.log(`   - Status: ${before.status} → sold`);
        console.log(`   - CDE Status: ${before.cdeStatus} → RETIRADO`);

        // Retornar sucesso
        return res.json({
            success: true,
            message: `Foto ${actualPhotoNumber} marcada como vendida`,
            data: {
                photoNumber: actualPhotoNumber,
                action: 'vendida',
                changes: {
                    before,
                    after: updates
                },
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[MONITOR ACTION API] Erro ao marcar como vendida:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno ao processar ação',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ============================================
// ROTA DE STATUS (OPCIONAL)
// ============================================
// GET /api/monitor-actions/status
// Retorna informações sobre as ações disponíveis
router.get('/status', async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Monitor Actions API operacional',
            availableActions: [
                {
                    endpoint: '/api/monitor-actions/retorno',
                    method: 'POST',
                    description: 'Corrige retornos (sold → available + limpa selectionId)',
                    requiredFields: ['photoNumber'],
                    optionalFields: ['adminUser']
                },
                {
                    endpoint: '/api/monitor-actions/pase',
                    method: 'POST',
                    description: 'Aplica PASE (busca QB do CDE + move 4 versões no R2 + atualiza MongoDB)',
                    requiredFields: ['photoNumber'],
                    optionalFields: ['adminUser'],
                    note: 'QB de destino é buscado automaticamente do CDE'
                }
            ],
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
