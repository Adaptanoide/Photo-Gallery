// src/routes/gallery.js - VERSÃO COM CONVERSÃO DE IDs E AUTENTICAÇÃO
const express = require('express');
const router = express.Router();
const StorageService = require('../services/StorageService');
const PhotoStatus = require('../models/PhotoStatus');
const jwt = require('jsonwebtoken');
const AccessCode = require('../models/AccessCode');

// MAPEAMENTO: Google Drive ID → R2 Path
const ID_TO_PATH_MAP = {
    // Suas categorias principais
    '1uECmXrHx7PZ3dYvTkwDiAIR0ydYHDAuK': 'Brazil Best Sellers',
    '1_8vGv29HsXaImZO-bfVf4vJLcB9ScBOK': 'Brazil Top Selected Categories',
    '1QKIYYy_Y4gJLIKTLGnfxDuoDuu-noJ89': 'Calfskins',
    '14UY4Jqq07w2jrOLImY-B436O54LUML77': 'Colombian Cowhides',
    '1yHObEYnof0XJROcYio3Z79hIu_scHObl': 'Duffle Bags Brazil',
    '1WyCJUxpHJ3ZtQ2MMPbXTh1HHGWyu4qzx': 'Rodeo Rugs',
    '1QgVUMS2qm9t6b-PbISOfHBFcC_wPnymz': 'Sheepskins'
};

// ========== NOVO MIDDLEWARE: Verificar token do cliente ==========
// ========== NOVO MIDDLEWARE: Verificar token do cliente ==========
const verifyClientToken = async (req, res, next) => {
    console.log('🔍 [DEBUG] Headers recebidos:', Object.keys(req.headers));
    console.log('🔍 [DEBUG] Authorization header:', req.headers['authorization']?.substring(0, 50));

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('🔍 [DEBUG] Token extraído:', token ? 'SIM' : 'NÃO');

    if (token) {
        try {
            // Verificar e decodificar token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('🔍 [DEBUG] Token decodificado:', decoded);

            if (decoded.type === 'client') {
                // Buscar AccessCode atualizado do banco
                const accessCode = await AccessCode.findOne({
                    code: decoded.clientCode,
                    isActive: true
                });

                console.log('🔍 [DEBUG] AccessCode encontrado:', accessCode ? 'SIM' : 'NÃO');
                console.log('🔍 [DEBUG] AccessType:', accessCode?.accessType);
                console.log('🔍 [DEBUG] SpecialSelection:', accessCode?.specialSelection);

                // Adicionar informações ao req
                req.client = {
                    clientCode: decoded.clientCode,
                    clientName: decoded.clientName,
                    accessType: accessCode?.accessType || 'normal',
                    hasSpecialSelection: accessCode?.accessType === 'special',
                    specialSelectionId: accessCode?.specialSelection?.selectionId || null
                };

                console.log(`👤 Cliente identificado: ${req.client.clientCode} (${req.client.accessType})`);
                if (req.client.hasSpecialSelection) {
                    console.log(`⭐ Cliente tem SPECIAL SELECTION ativa: ${req.client.specialSelectionId}`);
                }
            }
        } catch (error) {
            console.log('⚠️ Token inválido ou expirado:', error.message);
        }
    } else {
        console.log('⚠️ Requisição sem token - acesso anônimo');
    }

    next();
};
// ========== FIM DO MIDDLEWARE ==========

// Converter Google Drive ID para R2 Path
function convertToR2Path(idOrPath) {
    // Se já é um path (tem /)
    if (idOrPath && idOrPath.includes('/')) {
        return idOrPath;
    }

    // Se é um ID do Google Drive, converter
    if (ID_TO_PATH_MAP[idOrPath]) {
        console.log(`🔄 Convertendo: ${idOrPath} → ${ID_TO_PATH_MAP[idOrPath]}`);
        return ID_TO_PATH_MAP[idOrPath];
    }

    // Se não encontrou, retornar como está
    return idOrPath;
}

// Buscar estrutura de pastas - COM AUTENTICAÇÃO
router.get('/structure', verifyClientToken, async (req, res) => {
    try {
        let prefix = req.query.prefix || '';

        // CONVERTER ID para PATH se necessário
        prefix = convertToR2Path(prefix);

        console.log(`📂 Buscando estrutura de: ${prefix || '/'}`);

        // ========== SPECIAL SELECTION: Retornar estrutura simplificada ==========
        if (req.client && req.client.hasSpecialSelection) {
            console.log(`🌟 Cliente ${req.client.clientCode} tem Special Selection`);

            // Para Special Selection, retornar direto que tem fotos
            return res.json({
                success: true,
                structure: {
                    hasSubfolders: false,  // Sem pastas
                    folders: [],
                    hasImages: true,       // Tem fotos direto
                    totalImages: 3         // Por enquanto hardcoded
                },
                prefix: 'special_selection',
                message: 'Special Selection Active'
            });
        }
        // ========== FIM DA VERIFICAÇÃO SPECIAL ==========

        const result = await StorageService.getSubfolders(prefix);

        // Filtrar pastas que começam com _
        if (result.folders) {
            result.folders = result.folders.filter(f => !f.name.startsWith('_'));
        }

        // DEBUG: Ver o que retornou
        console.log('📊 RESULTADO DO R2:', {
            folders: result.folders?.length || 0,
            folderNames: result.folders?.map(f => f.name) || []
        });

        // SE não tem pastas, tentar buscar fotos diretamente
        if (!result.folders || result.folders.length === 0) {
            console.log('🔄 Sem subpastas, buscando fotos...');
            const photosResult = await StorageService.getPhotos(prefix);
            console.log(`📸 Encontradas ${photosResult.photos?.length || 0} fotos`);

            // Se tem fotos, retornar como hasImages
            if (photosResult.photos && photosResult.photos.length > 0) {
                return res.json({
                    success: true,
                    structure: {
                        hasSubfolders: false,
                        folders: [],
                        hasImages: true,
                        totalImages: photosResult.photos.length
                    },
                    prefix: prefix
                });
            }
        }

        // Adicionar estrutura compatível
        const structure = {
            hasSubfolders: result.folders && result.folders.length > 0,
            folders: result.folders || [],
            hasImages: false,
            totalImages: 0
        };

        res.json({
            success: true,
            structure: structure,
            prefix: prefix
        });

    } catch (error) {
        console.error('❌ Erro ao buscar estrutura:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Listar fotos - COM AUTENTICAÇÃO E FILTRO SPECIAL SELECTION
router.get('/photos', verifyClientToken, async (req, res) => {
    try {
        let prefix = req.query.prefix || '';

        // CONVERTER ID para PATH se necessário
        prefix = convertToR2Path(prefix);

        console.log(`📸 Buscando fotos de: ${prefix}`);

        // ========== SPECIAL SELECTION: Retornar apenas fotos marcadas ==========
        if (req.client && req.client.hasSpecialSelection) {
            console.log(`🌟 Retornando fotos da Special Selection para categoria: ${prefix}`);

            // Buscar a Special Selection
            const Selection = require('../models/Selection');
            const AccessCode = require('../models/AccessCode');

            const accessCode = await AccessCode.findOne({
                code: req.client.clientCode
            });

            if (accessCode?.specialSelection?.selectionId) {
                const selection = await Selection.findById(
                    accessCode.specialSelection.selectionId
                );

                // Buscar categoria específica
                const category = selection.customCategories.find(
                    cat => cat.categoryId === prefix
                );

                if (category) {
                    console.log(`📂 Categoria encontrada: ${category.categoryName} com ${category.photos.length} fotos`);

                    // Buscar apenas as fotos DESTA categoria
                    const photoIds = category.photos.map(p => p.photoId);
                    const specialPhotos = await PhotoStatus.find({
                        photoId: { $in: photoIds }
                    });

                    console.log(`📊 ${specialPhotos.length} fotos encontradas para esta categoria`);

                    // Formatar para o frontend
                    const photos = specialPhotos.map(photo => ({
                        id: photo.photoId,
                        name: photo.fileName,
                        fileName: photo.fileName,
                        webViewLink: `https://images.sunshinecowhides-gallery.com/${photo.photoId}`,  // ✅ AQUI
                        thumbnailLink: `https://images.sunshinecowhides-gallery.com/_thumbnails/${photo.photoId}`,  // ✅ AQUI
                        size: 0,
                        mimeType: 'image/jpeg',
                        customPrice: category.customPrice || category.baseCategoryPrice || 99
                    }));

                    return res.json({
                        success: true,
                        photos: photos,
                        folder: {
                            name: category.categoryDisplayName || category.categoryName
                        },
                        totalPhotos: photos.length,
                        clientType: 'special'
                    });
                }
            }

            // Fallback: retornar todas se não encontrar categoria
            console.log('⚠️ Categoria não encontrada, retornando todas');
            const specialPhotos = await PhotoStatus.find({
                'virtualStatus.clientCode': req.client.clientCode,
                'virtualStatus.status': 'reserved'
            });

            const photos = specialPhotos.map(photo => ({
                id: photo.photoId,
                name: photo.fileName,
                fileName: photo.fileName,
                webViewLink: `https://images.sunshinecowhides-gallery.com/${photo.photoId}`,  // ✅ AQUI
                thumbnailLink: `https://images.sunshinecowhides-gallery.com/_thumbnails/${photo.photoId}`,  // ✅ AQUI
                size: 0,
                mimeType: 'image/jpeg'
            }));

            return res.json({
                success: true,
                photos: photos,
                folder: {
                    name: 'Special Selection'
                },
                totalPhotos: photos.length,
                clientType: 'special'
            });
        }
        // ========== FIM DA SPECIAL SELECTION ==========

        const result = await StorageService.getPhotos(prefix);

        // FILTRAR baseado no tipo de acesso (CLIENTE NORMAL)
        // Filtrar fotos reservadas/vendidas/special
        const unavailablePhotos = await PhotoStatus.find({
            $or: [
                { 'virtualStatus.status': { $in: ['reserved', 'sold'] } },
                { 'virtualStatus.status': { $regex: /^special_/ } }
            ]
        }).select('fileName');

        const unavailableFileNames = new Set(unavailablePhotos.map(p => p.fileName));
        console.log(`🔒 Ocultando ${unavailableFileNames.size} fotos não disponíveis`);

        const filteredPhotos = result.photos.filter(photo => {
            const fileName = photo.fileName || photo.name.split('/').pop();
            return !unavailableFileNames.has(fileName);
        });

        // Processar fotos
        const photos = filteredPhotos.map(photo => ({
            id: photo.r2Key || photo.id,
            name: photo.name,
            fileName: photo.fileName,
            webViewLink: photo.url || photo.webViewLink,
            thumbnailLink: photo.thumbnailUrl,
            size: photo.size,
            mimeType: photo.mimeType
        }));

        res.json({
            success: true,
            photos: photos,
            folder: {
                name: prefix || 'Root'
            },
            totalPhotos: photos.length,
            clientType: req.client?.accessType || 'anonymous'
        });

    } catch (error) {
        console.error('❌ Erro ao buscar fotos:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
