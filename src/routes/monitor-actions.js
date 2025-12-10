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

        // Buscar no MongoDB - EXATAMENTE como veio da requisição
        const UnifiedProductComplete = require('../models/UnifiedProductComplete');

        // Primeiro: buscar EXATAMENTE pelo número fornecido
        let photo = await UnifiedProductComplete.findOne({ photoNumber: photoNumber });

        // Se não encontrar, NÃO tenta variações - retorna não encontrado
        // Isso evita confundir fotos diferentes como 0046 vs 00046
        if (!photo) {
            console.log(`[MONITOR ACTION API] Foto ${photoNumber} não encontrada com busca exata`);
            return res.status(404).json({
                success: false,
                message: `Foto ${photoNumber} não encontrada no MongoDB (busca exata)`
            });
        }

        // Buscar no CDE - INCLUINDO IDH para detectar colisões
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

        // Buscar TODOS os registros com este photoNumber para detectar colisões
        const [cdeData] = await cdeConnection.execute(
            `SELECT ATIPOETIQUETA, AESTADOP, AQBITEM, AIDH, AFECHA
             FROM tbinventario
             WHERE ATIPOETIQUETA = ?
             ORDER BY AFECHA DESC`,
            [actualPhotoNumber]
        );

        await cdeConnection.end();

        const cdeInfo = cdeData.length > 0 ? cdeData[0] : null;

        // Detectar colisão de IDH: mesmo photoNumber com IDHs diferentes
        const mongoIdh = String(photo.idhCode || '');
        const cdeIdh = cdeInfo ? String(cdeInfo.AIDH || '') : '';

        let isCollision = false;
        let collisionDetails = null;

        // Verificar se há múltiplos IDHs diferentes para este photoNumber
        const uniqueIdhs = [...new Set(cdeData.map(r => String(r.AIDH || '')).filter(Boolean))];
        const uniqueQbs = [...new Set(cdeData.map(r => r.AQBITEM).filter(Boolean))];

        if (uniqueIdhs.length > 1 || (mongoIdh && cdeIdh && !mongoIdh.includes(cdeIdh) && !cdeIdh.includes(mongoIdh))) {
            isCollision = true;
            collisionDetails = {
                message: '⚠️ COLISÃO DETECTADA: Este número de foto foi usado para produtos diferentes',
                mongoIdh: mongoIdh || 'N/A',
                cdeIdhs: uniqueIdhs,
                cdeQbs: uniqueQbs,
                cdeRecordCount: cdeData.length
            };
        }

        // Retornar dados combinados com informação de IDH
        return res.json({
            success: true,
            photoNumber: actualPhotoNumber,
            mongoStatus: photo.status,
            mongoQb: photo.qbItem,
            mongoIdh: mongoIdh || 'N/A',
            mongoCdeStatus: photo.cdeStatus,
            category: photo.category,
            r2Path: photo.r2Path,
            cdeStatus: cdeInfo ? cdeInfo.AESTADOP : 'N/A',
            cdeQb: cdeInfo ? cdeInfo.AQBITEM : null,
            cdeIdh: cdeIdh || 'N/A',
            cdeExists: !!cdeInfo,
            isCollision: isCollision,
            collisionDetails: collisionDetails,
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
// AÇÃO 4: IMPORTAR FOTO (SYNC PENDIENTE)
// ============================================
// POST /api/monitor-actions/import
// Body: { photoNumber: "0046", cdeQb: "5301SB" }
// Usado quando: Foto existe no R2 e CDE mas não no MongoDB
router.post('/import', async (req, res) => {
    try {
        const { photoNumber, cdeQb, adminUser } = req.body;

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

        console.log(`[MONITOR ACTION API] Importando foto ${photoNumber}`);
        console.log(`   Executado por: ${adminUser || req.user.username}`);

        const UnifiedProductComplete = require('../models/UnifiedProductComplete');
        const PhotoCategory = require('../models/PhotoCategory');

        // Verificar se já existe no MongoDB
        const existing = await UnifiedProductComplete.findOne({ photoNumber: photoNumber });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: `Foto ${photoNumber} já existe no MongoDB`
            });
        }

        // Buscar dados do CDE
        const mysql = require('mysql2/promise');
        const cdeConnection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            port: process.env.CDE_PORT,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });

        const [cdeData] = await cdeConnection.execute(
            'SELECT ATIPOETIQUETA, AESTADOP, AQBITEM, AIDH FROM tbinventario WHERE ATIPOETIQUETA = ? ORDER BY AFECHA DESC LIMIT 1',
            [photoNumber]
        );
        await cdeConnection.end();

        if (cdeData.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Foto ${photoNumber} não encontrada no CDE`
            });
        }

        const cdeRecord = cdeData[0];
        const qbItem = cdeQb || cdeRecord.AQBITEM;
        const idhCode = cdeRecord.AIDH ? String(cdeRecord.AIDH) : `IMPORT-${photoNumber}-${Date.now()}`;

        // Buscar categoria pelo QB
        const categoryDoc = await PhotoCategory.findOne({ qbItem: qbItem });
        if (!categoryDoc) {
            return res.status(400).json({
                success: false,
                message: `Categoria não encontrada para QB ${qbItem}`
            });
        }

        // Construir o path do R2 (evitar barra dupla)
        const basePath = categoryDoc.googleDrivePath.endsWith('/')
            ? categoryDoc.googleDrivePath.slice(0, -1)
            : categoryDoc.googleDrivePath;
        const r2Path = `${basePath}/${photoNumber}.webp`;

        // Verificar se existe no R2
        const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
        const s3Client = new S3Client({
            region: 'auto',
            endpoint: process.env.R2_ENDPOINT,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
            }
        });

        try {
            await s3Client.send(new HeadObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME || 'sunshine-photos',
                Key: r2Path
            }));
        } catch (err) {
            return res.status(404).json({
                success: false,
                message: `Foto ${photoNumber} não encontrada no R2 no path: ${r2Path}`
            });
        }

        // Criar documento no MongoDB com todos os campos obrigatórios
        const fileName = `${photoNumber}.webp`;
        const categoryName = categoryDoc.category || categoryDoc.googleDrivePath.split('/').pop() || qbItem;

        const newPhoto = new UnifiedProductComplete({
            // Campos obrigatórios
            idhCode: idhCode,
            photoNumber: photoNumber,
            fileName: fileName,
            photoId: photoNumber,
            category: categoryName,

            // Outros campos importantes
            qbItem: qbItem,
            googleDrivePath: categoryDoc.googleDrivePath,
            driveFileId: r2Path,
            r2Path: r2Path,
            status: cdeRecord.AESTADOP === 'INGRESADO' ? 'available' : 'sold',
            cdeStatus: cdeRecord.AESTADOP,
            currentStatus: cdeRecord.AESTADOP === 'INGRESADO' ? 'available' : 'sold',
            isActive: true,
            source: 'monitor-import',
            importedAt: new Date(),
            importedBy: adminUser || req.user.username
        });

        await newPhoto.save();

        console.log(`[MONITOR ACTION] ✅ Foto ${photoNumber} importada com sucesso`);
        console.log(`   - QB: ${qbItem}`);
        console.log(`   - Categoria: ${categoryDoc.category}`);
        console.log(`   - Status: ${newPhoto.status}`);
        console.log(`   - R2 Path: ${r2Path}`);

        return res.json({
            success: true,
            message: `Foto ${photoNumber} importada com sucesso`,
            data: {
                photoNumber: photoNumber,
                qbItem: qbItem,
                category: categoryDoc.category,
                status: newPhoto.status,
                r2Path: r2Path,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[MONITOR ACTION API] Erro ao importar foto:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno ao importar foto',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ============================================
// AÇÃO 5: RECICLAR NÚMERO (COLISÃO)
// ============================================
// POST /api/monitor-actions/reciclar
// Body: { photoNumber: "08128", adminUser: "admin@email.com" }
// Usado quando: Mesmo photoNumber foi reutilizado para produto diferente (IDHs diferentes)
// Ação: Desativa o registro antigo e cria um novo com os dados do CDE
router.post('/reciclar', async (req, res) => {
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

        console.log(`[MONITOR ACTION API] ♻️ Reciclando número ${photoNumber}`);
        console.log(`   Executado por: ${adminUser || req.user.username}`);

        const UnifiedProductComplete = require('../models/UnifiedProductComplete');
        const PhotoCategory = require('../models/PhotoCategory');

        // 1. Buscar foto existente no MongoDB
        const existingPhoto = await UnifiedProductComplete.findOne({ photoNumber: photoNumber });

        if (!existingPhoto) {
            return res.status(404).json({
                success: false,
                message: `Foto ${photoNumber} não encontrada no MongoDB`
            });
        }

        // 2. Buscar dados atuais do CDE
        const mysql = require('mysql2/promise');
        const cdeConnection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            port: process.env.CDE_PORT,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });

        // Buscar o registro mais recente INGRESADO no CDE para este photoNumber
        const [cdeData] = await cdeConnection.execute(
            `SELECT ATIPOETIQUETA, AESTADOP, AQBITEM, AIDH, AFECHA
             FROM tbinventario
             WHERE ATIPOETIQUETA = ? AND AESTADOP = 'INGRESADO'
             ORDER BY AFECHA DESC
             LIMIT 1`,
            [photoNumber]
        );

        await cdeConnection.end();

        if (cdeData.length === 0) {
            return res.status(400).json({
                success: false,
                message: `Não há registro INGRESADO no CDE para o número ${photoNumber}`
            });
        }

        const cdeRecord = cdeData[0];
        const newIdh = String(cdeRecord.AIDH);
        const newQb = cdeRecord.AQBITEM;

        // 3. Verificar se realmente é uma colisão (IDHs diferentes)
        const oldIdh = String(existingPhoto.idhCode || '');
        if (oldIdh === newIdh) {
            return res.status(400).json({
                success: false,
                message: `Não é uma colisão - mesmo IDH (${oldIdh}). Use Retorno em vez de Reciclar.`
            });
        }

        // 4. Buscar categoria do novo QB
        const categoryDoc = await PhotoCategory.findOne({ qbItem: newQb });
        if (!categoryDoc) {
            return res.status(400).json({
                success: false,
                message: `Categoria não encontrada para QB ${newQb}`
            });
        }

        // 5. Guardar dados do registro antigo para log
        const oldData = {
            idhCode: existingPhoto.idhCode,
            qbItem: existingPhoto.qbItem,
            status: existingPhoto.status,
            category: existingPhoto.category
        };

        // 6. Marcar registro antigo como inativo
        await UnifiedProductComplete.updateOne(
            { _id: existingPhoto._id },
            {
                $set: {
                    isActive: false,
                    recycledAt: new Date(),
                    recycledBy: adminUser || req.user.username,
                    recycleReason: `Número reciclado - novo IDH: ${newIdh}`
                }
            }
        );

        console.log(`[MONITOR ACTION] ⏹️ Registro antigo desativado:`);
        console.log(`   - IDH: ${oldData.idhCode}`);
        console.log(`   - QB: ${oldData.qbItem}`);
        console.log(`   - Status: ${oldData.status}`);

        // 7. Verificar se existe foto no R2 (pode ser que o novo couro tenha foto ou não)
        const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
        const s3Client = new S3Client({
            region: 'auto',
            endpoint: process.env.R2_ENDPOINT,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
            }
        });

        const basePath = categoryDoc.googleDrivePath.endsWith('/')
            ? categoryDoc.googleDrivePath.slice(0, -1)
            : categoryDoc.googleDrivePath;
        const r2Path = `${basePath}/${photoNumber}.webp`;

        let hasR2Photo = false;
        try {
            await s3Client.send(new HeadObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME || 'sunshine-photos',
                Key: r2Path
            }));
            hasR2Photo = true;
        } catch (err) {
            hasR2Photo = false;
        }

        // 8. Criar novo registro com dados do CDE (apenas se tiver foto no R2)
        let newPhotoCreated = null;
        if (hasR2Photo) {
            const fileName = `${photoNumber}.webp`;
            const categoryName = categoryDoc.category || categoryDoc.googleDrivePath.split('/').pop() || newQb;

            newPhotoCreated = new UnifiedProductComplete({
                idhCode: newIdh,
                photoNumber: photoNumber,
                fileName: fileName,
                photoId: photoNumber,
                category: categoryName,
                qbItem: newQb,
                googleDrivePath: categoryDoc.googleDrivePath,
                driveFileId: r2Path,
                r2Path: r2Path,
                status: 'available',
                cdeStatus: 'INGRESADO',
                currentStatus: 'available',
                isActive: true,
                source: 'monitor-recycle',
                recycledFrom: existingPhoto._id,
                importedAt: new Date(),
                importedBy: adminUser || req.user.username
            });

            await newPhotoCreated.save();

            console.log(`[MONITOR ACTION] ✅ Novo registro criado:`);
            console.log(`   - IDH: ${newIdh}`);
            console.log(`   - QB: ${newQb}`);
            console.log(`   - Categoria: ${categoryName}`);
            console.log(`   - R2 Path: ${r2Path}`);
        } else {
            console.log(`[MONITOR ACTION] ⚠️ Sem foto no R2 - registro antigo desativado mas novo não criado`);
        }

        // Retornar sucesso
        return res.json({
            success: true,
            message: hasR2Photo
                ? `Número ${photoNumber} reciclado: registro antigo desativado, novo criado com QB ${newQb}`
                : `Registro antigo do número ${photoNumber} desativado (sem foto no R2 para criar novo)`,
            data: {
                photoNumber: photoNumber,
                action: 'reciclar',
                oldRecord: oldData,
                newRecord: newPhotoCreated ? {
                    idhCode: newIdh,
                    qbItem: newQb,
                    category: newPhotoCreated.category,
                    status: 'available'
                } : null,
                hasR2Photo: hasR2Photo,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[MONITOR ACTION API] Erro ao reciclar número:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno ao reciclar número',
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
