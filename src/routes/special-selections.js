//src/routes/special-selections.js

const express = require('express');
const mongoose = require('mongoose');
const SpecialSelectionService = require('../services/SpecialSelectionService');
const Selection = require('../models/Selection');
const AccessCode = require('../models/AccessCode');
const PhotoStatus = require('../models/PhotoStatus');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Todas as rotas precisam de autenticação admin
router.use(authenticateToken);

// ===== ROTAS PRINCIPAIS =====

/**
 * GET /api/special-selections
 * Listar todas as seleções especiais
 */
router.get('/', async (req, res) => {
    try {
        console.log('📋 Listando seleções especiais...');

        const {
            status,
            clientCode,
            isActive,
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const filters = {};
        if (status) filters.status = status;
        if (clientCode) filters.clientCode = clientCode;
        if (isActive !== undefined) filters.isActive = isActive === 'true';

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sortBy,
            sortOrder
        };

        const result = await SpecialSelectionService.listSpecialSelections(filters, options);

        res.json({
            success: true,
            data: result.selections,
            pagination: result.pagination,
            message: `${result.selections.length} seleções especiais encontradas`
        });

    } catch (error) {
        console.error('❌ Erro ao listar seleções especiais:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * POST /api/special-selections
 * Criar nova seleção especial
 */
router.post('/', async (req, res) => {
    try {
        console.log('🎯 Criando nova seleção especial...');

        const {
            clientCode,
            selectionName,
            description,
            showPrices = true,
            allowGlobalDiscount = false,
            globalDiscountPercent = 0,
            quantityDiscountsEnabled = false,
            quantityDiscountRules = [],
            expiresAt
        } = req.body;

        // Validação básica
        if (!clientCode || !selectionName) {
            return res.status(400).json({
                success: false,
                message: 'Código do cliente e nome da seleção são obrigatórios',
                required: ['clientCode', 'selectionName']
            });
        }

        const adminUser = req.user?.username || 'admin';

        const selectionData = {
            clientCode,
            selectionName,
            description,
            showPrices,
            allowGlobalDiscount,
            globalDiscountPercent: allowGlobalDiscount ? globalDiscountPercent : 0,
            quantityDiscountsEnabled,
            quantityDiscountRules: quantityDiscountsEnabled ? quantityDiscountRules : [],
            expiresAt: expiresAt ? new Date(expiresAt) : null
        };

        const result = await SpecialSelectionService.createSpecialSelection(selectionData, adminUser);

        res.status(201).json({
            success: true,
            data: {
                selectionId: result.selectionId,
                selectionName: selectionName,
                clientCode: clientCode,
                googleDriveInfo: result.googleDriveInfo,
                status: 'created'
            },
            message: 'Seleção especial criada com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao criar seleção especial:', error);
        
        let statusCode = 500;
        if (error.message.includes('não encontrado')) statusCode = 404;
        if (error.message.includes('obrigatório')) statusCode = 400;

        res.status(statusCode).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * GET /api/special-selections/:selectionId
 * Obter detalhes de uma seleção especial
 */
router.get('/:selectionId', async (req, res) => {
    try {
        const { selectionId } = req.params;
        console.log(`📋 Buscando detalhes da seleção ${selectionId}...`);

        const result = await SpecialSelectionService.getSpecialSelectionDetails(selectionId);

        res.json({
            success: true,
            data: result,
            message: 'Detalhes da seleção especial obtidos com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao obter detalhes da seleção especial:', error);
        
        let statusCode = 500;
        if (error.message.includes('não encontrada')) statusCode = 404;

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * DELETE /api/special-selections/:selectionId
 * Deletar seleção especial (com opção de devolver fotos)
 */
router.delete('/:selectionId', async (req, res) => {
    try {
        const { selectionId } = req.params;
        const { returnPhotos = true } = req.query;
        const adminUser = req.user?.username || 'admin';

        console.log(`🗑️ Deletando seleção especial ${selectionId}...`);

        const result = await SpecialSelectionService.deactivateSpecialSelection(
            selectionId, 
            adminUser, 
            returnPhotos === 'true'
        );

        res.json({
            success: true,
            data: result,
            message: 'Seleção especial deletada com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao deletar seleção especial:', error);
        
        let statusCode = 500;
        if (error.message.includes('não encontrada')) statusCode = 404;

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

// ===== ROTAS DE CATEGORIAS =====

/**
 * POST /api/special-selections/:selectionId/categories
 * Adicionar categoria customizada
 */
router.post('/:selectionId/categories', async (req, res) => {
    try {
        const { selectionId } = req.params;
        const {
            categoryName,
            categoryDisplayName,
            baseCategoryPrice = 0,
            originalCategoryInfo = {}
        } = req.body;

        if (!categoryName) {
            return res.status(400).json({
                success: false,
                message: 'Nome da categoria é obrigatório'
            });
        }

        const adminUser = req.user?.username || 'admin';

        console.log(`📁 Adicionando categoria ${categoryName} à seleção ${selectionId}...`);

        const categoryData = {
            categoryName,
            categoryDisplayName: categoryDisplayName || categoryName,
            baseCategoryPrice: Number(baseCategoryPrice),
            originalCategoryInfo
        };

        const result = await SpecialSelectionService.addCustomCategory(selectionId, categoryData, adminUser);

        res.status(201).json({
            success: true,
            data: result,
            message: 'Categoria customizada adicionada com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao adicionar categoria:', error);
        
        let statusCode = 500;
        if (error.message.includes('não encontrada')) statusCode = 404;
        if (error.message.includes('obrigatório')) statusCode = 400;

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * DELETE /api/special-selections/:selectionId/categories/:categoryId
 * Remover categoria customizada
 */
router.delete('/:selectionId/categories/:categoryId', async (req, res) => {
    try {
        const { selectionId, categoryId } = req.params;
        const adminUser = req.user?.username || 'admin';

        console.log(`🗑️ Removendo categoria ${categoryId} da seleção ${selectionId}...`);

        const result = await SpecialSelectionService.removeCustomCategory(selectionId, categoryId, adminUser);

        res.json({
            success: true,
            data: result,
            message: 'Categoria removida com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao remover categoria:', error);
        
        let statusCode = 500;
        if (error.message.includes('não encontrada')) statusCode = 404;

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

// ===== ROTAS DE FOTOS =====

/**
 * POST /api/special-selections/:selectionId/photos/move
 * Mover foto para categoria customizada
 */
router.post('/:selectionId/photos/move', async (req, res) => {
    try {
        const { selectionId } = req.params;
        const {
            photoId,
            fileName,
            categoryId,
            originalPath,
            originalParentId,
            originalCategory,
            originalPrice = 0,
            customPrice
        } = req.body;

        // Validação básica
        if (!photoId || !fileName || !categoryId) {
            return res.status(400).json({
                success: false,
                message: 'photoId, fileName e categoryId são obrigatórios',
                required: ['photoId', 'fileName', 'categoryId']
            });
        }

        const adminUser = req.user?.username || 'admin';

        console.log(`📸 Movendo foto ${fileName} para categoria ${categoryId}...`);

        const photoData = {
            photoId,
            fileName,
            originalPath,
            originalParentId,
            originalCategory,
            originalPrice: Number(originalPrice),
            customPrice: customPrice ? Number(customPrice) : null
        };

        const result = await SpecialSelectionService.movePhotoToCustomCategory(
            selectionId, 
            photoData, 
            categoryId, 
            adminUser
        );

        res.json({
            success: true,
            data: result,
            message: 'Foto movida com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao mover foto:', error);
        
        let statusCode = 500;
        if (error.message.includes('não encontrada')) statusCode = 404;
        if (error.message.includes('não está disponível')) statusCode = 409; // Conflict
        if (error.message.includes('obrigatório')) statusCode = 400;

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/special-selections/:selectionId/photos/:photoId/return
 * Devolver foto ao estoque original
 */
router.post('/:selectionId/photos/:photoId/return', async (req, res) => {
    try {
        const { photoId } = req.params;
        const adminUser = req.user?.username || 'admin';

        console.log(`🔄 Devolvendo foto ${photoId} ao estoque...`);

        const result = await SpecialSelectionService.returnPhotoToOriginalLocation(photoId, adminUser);

        res.json({
            success: true,
            data: result,
            message: 'Foto devolvida ao estoque com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao devolver foto:', error);
        
        let statusCode = 500;
        if (error.message.includes('não encontrada')) statusCode = 404;

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

// ===== ROTAS DE ATIVAÇÃO =====

/**
 * POST /api/special-selections/:selectionId/activate
 * Ativar seleção especial para acesso do cliente
 */
router.post('/:selectionId/activate', async (req, res) => {
    try {
        const { selectionId } = req.params;
        const adminUser = req.user?.username || 'admin';

        console.log(`🚀 Ativando seleção especial ${selectionId}...`);

        const result = await SpecialSelectionService.activateSpecialSelection(selectionId, adminUser);

        res.json({
            success: true,
            data: result,
            message: 'Seleção especial ativada com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao ativar seleção especial:', error);
        
        let statusCode = 500;
        if (error.message.includes('não encontrada')) statusCode = 404;
        if (error.message.includes('não tem fotos')) statusCode = 400;

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/special-selections/:selectionId/deactivate
 * Desativar seleção especial (voltar cliente para acesso normal)
 */
router.post('/:selectionId/deactivate', async (req, res) => {
    try {
        const { selectionId } = req.params;
        const { returnPhotos = false } = req.body;
        const adminUser = req.user?.username || 'admin';

        console.log(`⏸️ Desativando seleção especial ${selectionId}...`);

        const result = await SpecialSelectionService.deactivateSpecialSelection(
            selectionId, 
            adminUser, 
            returnPhotos
        );

        res.json({
            success: true,
            data: result,
            message: 'Seleção especial desativada com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao desativar seleção especial:', error);
        
        let statusCode = 500;
        if (error.message.includes('não encontrada')) statusCode = 404;

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

// ===== ROTAS DE UTILITÁRIOS =====

/**
 * GET /api/special-selections/stats
 * Obter estatísticas das seleções especiais
 */
router.get('/stats/overview', async (req, res) => {
    try {
        console.log('📊 Obtendo estatísticas das seleções especiais...');

        const result = await SpecialSelectionService.getStatistics();

        res.json({
            success: true,
            data: result.stats,
            timestamp: result.timestamp,
            message: 'Estatísticas obtidas com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao obter estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * POST /api/special-selections/cleanup
 * Limpeza de recursos temporários
 */
router.post('/cleanup', async (req, res) => {
    try {
        console.log('🧹 Iniciando limpeza de recursos...');

        const result = await SpecialSelectionService.cleanup();

        res.json({
            success: true,
            data: result,
            message: 'Limpeza realizada com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro na limpeza:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// ===== ROTAS DE STATUS DE FOTOS =====

/**
 * GET /api/special-selections/photos/status
 * Obter status de fotos
 */
router.get('/photos/status', async (req, res) => {
    try {
        const { photoIds } = req.query;
        console.log('📸 Verificando status de fotos...');

        if (!photoIds) {
            return res.status(400).json({
                success: false,
                message: 'photoIds é obrigatório'
            });
        }

        const ids = Array.isArray(photoIds) ? photoIds : photoIds.split(',');
        const photoStatuses = await PhotoStatus.find({ photoId: { $in: ids } });

        const statusMap = photoStatuses.reduce((acc, status) => {
            acc[status.photoId] = {
                currentStatus: status.currentStatus,
                isLocked: status.isLocked(),
                isReserved: status.isReserved(),
                lockedBy: status.lockInfo.lockedBy,
                currentLocation: status.currentLocation
            };
            return acc;
        }, {});

        res.json({
            success: true,
            data: statusMap,
            message: `Status de ${Object.keys(statusMap).length} fotos obtido`
        });

    } catch (error) {
        console.error('❌ Erro ao obter status das fotos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * POST /api/special-selections/photos/:photoId/lock
 * Bloquear foto para edição
 */
router.post('/photos/:photoId/lock', async (req, res) => {
    try {
        const { photoId } = req.params;
        const { reason = 'editing', durationMinutes = 30 } = req.body;
        const adminUser = req.user?.username || 'admin';

        console.log(`🔒 Bloqueando foto ${photoId} para ${adminUser}...`);

        let photoStatus = await PhotoStatus.findOne({ photoId });
        
        if (!photoStatus) {
            return res.status(404).json({
                success: false,
                message: 'Foto não encontrada'
            });
        }

        if (photoStatus.isLocked()) {
            return res.status(409).json({
                success: false,
                message: `Foto já está bloqueada por ${photoStatus.lockInfo.lockedBy}`,
                lockedBy: photoStatus.lockInfo.lockedBy,
                lockExpiresAt: photoStatus.lockInfo.lockExpiresAt
            });
        }

        photoStatus.lock(adminUser, reason, durationMinutes);
        await photoStatus.save();

        res.json({
            success: true,
            data: {
                photoId,
                lockedBy: adminUser,
                lockExpiresAt: photoStatus.lockInfo.lockExpiresAt,
                reason
            },
            message: 'Foto bloqueada com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao bloquear foto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * DELETE /api/special-selections/photos/:photoId/lock
 * Desbloquear foto
 */
router.delete('/photos/:photoId/lock', async (req, res) => {
    try {
        const { photoId } = req.params;
        const { forced = false } = req.body;
        const adminUser = req.user?.username || 'admin';

        console.log(`🔓 Desbloqueando foto ${photoId}...`);

        let photoStatus = await PhotoStatus.findOne({ photoId });
        
        if (!photoStatus) {
            return res.status(404).json({
                success: false,
                message: 'Foto não encontrada'
            });
        }

        if (!photoStatus.isLocked()) {
            return res.status(400).json({
                success: false,
                message: 'Foto não está bloqueada'
            });
        }

        // Verificar se é o mesmo admin que bloqueou (ou se é forçado)
        if (!forced && photoStatus.lockInfo.lockedBy !== adminUser) {
            return res.status(403).json({
                success: false,
                message: `Foto foi bloqueada por ${photoStatus.lockInfo.lockedBy}. Use forced=true para forçar desbloqueio.`,
                lockedBy: photoStatus.lockInfo.lockedBy
            });
        }

        photoStatus.unlock(adminUser, forced);
        await photoStatus.save();

        res.json({
            success: true,
            data: {
                photoId,
                unlockedBy: adminUser,
                forced
            },
            message: 'Foto desbloqueada com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao desbloquear foto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

module.exports = router;