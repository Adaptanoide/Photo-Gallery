// src/routes/gallery.js - VERSÃO COM CONVERSÃO DE IDs E AUTENTICAÇÃO
const express = require('express');
const router = express.Router();
const StorageService = require('../services/StorageService');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const jwt = require('jsonwebtoken');
const AccessCode = require('../models/AccessCode');
// TEMPORÁRIO - Desabilitar preços durante desenvolvimento
const FORCE_HIDE_PRICES = true;

// ============================================
// CACHE INTELIGENTE POR CLIENTE
// Implementado em: 15/09/2025
// Objetivo: Melhorar performance sem contaminar dados entre clientes
// Cada cliente tem seu próprio cache isolado
// ============================================

const structureCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos de cache

// Limpar entradas expiradas a cada minuto
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, value] of structureCache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
            structureCache.delete(key);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.log(`🧹 Cache limpo: ${cleaned} entradas expiradas removidas`);
    }
}, 60 * 1000);

console.log('✅ Sistema de cache inteligente inicializado');

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
const verifyClientToken = async (req, res, next) => {

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            // Verificar e decodificar token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (decoded.type === 'client') {
                // Buscar AccessCode atualizado do banco
                const accessCode = await AccessCode.findOne({
                    code: decoded.clientCode,
                    isActive: true
                });

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

/**
 * Enriquecer pastas com contador de fotos AVAILABLE
 * Conta apenas fotos com status 'available' no MongoDB
 */
async function enrichFoldersWithAvailableCounts(folders, prefix = '') {
    if (!folders || folders.length === 0) {
        return folders;
    }

    const PhotoCategory = require('../models/PhotoCategory');
    const startTime = Date.now();

    const enrichedFolders = await Promise.all(
        folders.map(async (folder) => {
            try {
                // ✅ SÓ CONTAR SE FOR NÍVEL FINAL (não tem subpastas)
                if (folder.hasSubfolders) {
                    console.log(`[ENRICH] ${folder.name}: TEM SUBPASTAS - não conta`);
                    return {
                        ...folder,
                        availableCount: 0,
                        hasAvailablePhotos: false,
                        hasSubfolders: true
                    };
                }

                // ✅ NORMALIZAR prefix (remover barra(s) do final se houver)
                const normalizedPrefix = prefix ? prefix.replace(/\/+$/, '') : '';

                // ✅ MONTAR googleDrivePath corretamente (sempre UMA barra no final)
                const googleDrivePath = normalizedPrefix
                    ? `${normalizedPrefix}/${folder.name}/`
                    : `${folder.name}/`;

                console.log(`[ENRICH] ${folder.name}: Buscando googleDrivePath="${googleDrivePath}"`);

                // ✅ BUSCAR POR googleDrivePath
                const category = await PhotoCategory.findOne({
                    googleDrivePath: googleDrivePath
                });

                let availableCount = 0;

                if (category) {
                    // ✅ CONTAR usando o displayName da categoria encontrada
                    availableCount = await UnifiedProductComplete.countDocuments({
                        category: category.displayName,
                        status: 'available',
                        transitStatus: { $ne: 'coming_soon' },
                        cdeTable: { $ne: 'tbetiqueta' },
                        isActive: true
                    });

                    console.log(`[ENRICH] ${folder.name}: ✅ Encontrado! ${availableCount} fotos available (qbItem: ${category.qbItem}, price: $${category.basePrice})`);
                } else {
                    console.log(`[ENRICH] ${folder.name}: ⚠️ NÃO encontrado no PhotoCategory`);
                }

                return {
                    ...folder,
                    availableCount: availableCount,
                    hasAvailablePhotos: availableCount > 0,
                    hasSubfolders: false,
                    price: category?.basePrice || null,
                    description: category?.description || null
                };

            } catch (error) {
                console.error(`Erro ao contar fotos para ${folder.name}:`, error);
                return {
                    ...folder,
                    availableCount: 0,
                    hasAvailablePhotos: false,
                    hasSubfolders: folder.hasSubfolders || false,
                    price: null,
                    description: null
                };
            }
        })
    );

    const duration = Date.now() - startTime;
    console.log(`✅ Contadores calculados para ${folders.length} pastas em ${duration}ms`);

    return enrichedFolders;
}

// Buscar estrutura de pastas - COM AUTENTICAÇÃO
router.get('/structure', verifyClientToken, async (req, res) => {
    try {
        let prefix = req.query.prefix || '';

        // CONVERTER ID para PATH se necessário
        prefix = convertToR2Path(prefix);

        console.log(`📂 Buscando estrutura de: ${prefix || '/'}`);

        // TEMPORÁRIO - Desabilitar preços durante desenvolvimento
        const FORCE_HIDE_PRICES = true;

        // ============================================
        // VERIFICAR CACHE INTELIGENTE
        // ============================================
        const noCache = req.query.nocache === 'true';

        if (req.client && req.client.clientCode && !noCache) {
            const cacheKey = `${req.client.clientCode}:${prefix || 'root'}`;
            const cached = structureCache.get(cacheKey);

            if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
                console.log('📦 Retornando do cache');
                return res.json(cached.data);
            }
        }

        if (noCache) {
            console.log('🚫 Cache desabilitado - buscando direto do R2');
        }

        // ========== FILTRAR POR ALLOWED CATEGORIES ==========
        let allowedToSee = true;  // Por padrão, permitir tudo

        if (req.client && req.client.clientCode) {
            // Buscar categorias permitidas do cliente
            const accessCode = await AccessCode.findOne({
                code: req.client.clientCode
            });

            if (accessCode && accessCode.allowedCategories && accessCode.allowedCategories.length > 0) {
                console.log(`🔐 Cliente tem restrições:`, accessCode.allowedCategories.length, 'categorias');

                // NOVO: Tentar cache primeiro
                const ClientPermissionsCache = require('../models/ClientPermissionsCache');
                let allowedPaths = new Set();

                const cached = await ClientPermissionsCache.findOne({
                    clientCode: req.client.clientCode,
                    expiresAt: { $gt: new Date() }
                });

                if (cached && cached.allowedPaths) {
                    allowedPaths = new Set(cached.allowedPaths);
                } else {
                    const startCalc = Date.now();

                    // Buscar mapeamento de QB items - OTIMIZADO
                    const PhotoCategory = require('../models/PhotoCategory');

                    // Separar QB items de categorias diretas
                    const qbItems = [];
                    const directCategories = [];

                    for (const item of accessCode.allowedCategories) {
                        if (/\d/.test(item)) {
                            qbItems.push(item);
                        } else {
                            directCategories.push(item);
                            allowedPaths.add(item);
                            allowedPaths.add(item + '/');
                        }
                    }

                    // Buscar TODOS os QB items de uma vez
                    if (qbItems.length > 0) {
                        const categories = await PhotoCategory.find({
                            qbItem: { $in: qbItems }
                        });

                        // Processar paths
                        for (const cat of categories) {
                            if (cat.googleDrivePath) {
                                const pathParts = cat.googleDrivePath.split('/').filter(p => p);

                                // Adicionar TODOS os níveis do path
                                if (pathParts[0]) {
                                    allowedPaths.add(pathParts[0]);
                                    allowedPaths.add(pathParts[0] + '/');
                                }

                                if (pathParts[1]) {
                                    const subPath = pathParts[0] + '/' + pathParts[1];
                                    allowedPaths.add(subPath);
                                    allowedPaths.add(subPath + '/');
                                }

                                if (pathParts[2]) {
                                    const fullPath = pathParts[0] + '/' + pathParts[1] + '/' + pathParts[2];
                                    allowedPaths.add(fullPath);
                                    allowedPaths.add(fullPath + '/');
                                }

                                allowedPaths.add(cat.googleDrivePath);
                            }
                        }
                    }

                    // Salvar no cache para próximas requisições
                    await ClientPermissionsCache.findOneAndUpdate(
                        { clientCode: req.client.clientCode },
                        {
                            clientCode: req.client.clientCode,
                            allowedPaths: Array.from(allowedPaths),
                            processedAt: new Date(),
                            expiresAt: new Date(Date.now() + 30 * 60 * 1000)
                        },
                        { upsert: true, new: true }
                    );
                }

                // Se estamos no root, filtrar categorias
                if (!prefix || prefix === '') {
                    const result = await StorageService.getSubfolders(prefix);

                    result.folders = result.folders.filter(f =>
                        !f.name.startsWith('_') && allowedPaths.has(f.name)
                    );

                    // ✅ ADICIONAR contadores de fotos available
                    result.folders = await enrichFoldersWithAvailableCounts(result.folders, prefix);

                    console.log(`📁 Mostrando ${result.folders.length} categorias permitidas com contadores`);

                    // 🆕 INVALIDAR CACHE se houver fotos reserved pelo cliente
                    if (req.client?.clientCode) {
                        const cacheKey = `${req.client.clientCode}:${prefix || 'root'}`;
                        structureCache.delete(cacheKey);
                        console.log(`🗑️ Cache invalidado para cliente ${req.client.clientCode}`);
                    }

                    // Preparar resposta para cache - categorias do root
                    const responseData = {
                        success: true,
                        structure: {
                            hasSubfolders: result.folders.length > 0,
                            folders: result.folders,
                            hasImages: false,
                            totalImages: 0
                        },
                        prefix: prefix
                    };

                    // Salvar no cache para este cliente
                    if (req.client && req.client.clientCode) {
                        const cacheKey = `${req.client.clientCode}:${prefix || 'root'}`;
                        structureCache.set(cacheKey, {
                            data: responseData,
                            timestamp: Date.now()
                        });
                    }

                    return res.json(responseData);
                }

                // Verificar se a categoria atual é permitida
                const currentCategory = prefix.split('/')[0];
                if (!allowedPaths.has(currentCategory)) {
                    console.log(`🚫 Categoria ${currentCategory} não permitida`);
                    return res.status(403).json({
                        success: false,
                        message: 'Category not allowed'
                    });
                }

                // FILTRAR SUBCATEGORIAS - Também usando cache
                if (prefix) {

                    const allowedSubfolders = new Set();

                    // Usar allowedPaths do cache para filtrar
                    for (const path of allowedPaths) {
                        if (path.startsWith(prefix + '/') || path.startsWith(prefix)) {
                            const prefixLength = prefix.endsWith('/') ? prefix.length : prefix.length + 1;
                            const remainingPath = path.substring(prefixLength);

                            if (remainingPath) {
                                const nextLevel = remainingPath.split('/')[0];
                                if (nextLevel) {
                                    allowedSubfolders.add(nextLevel);
                                }
                            }
                        }
                    }

                    if (allowedSubfolders.size > 0) {
                        const result = await StorageService.getSubfolders(prefix);
                        const originalCount = result.folders ? result.folders.length : 0;

                        if (result.folders) {
                            result.folders = result.folders.filter(f => {
                                const startsWithUnderscore = f.name.startsWith('_');
                                const isInAllowed = allowedSubfolders.has(f.name);
                                return !startsWithUnderscore && isInAllowed;
                            });

                            // ✅ ADICIONAR contadores de fotos available
                            result.folders = await enrichFoldersWithAvailableCounts(result.folders, prefix);
                        }

                        // Verificar se ao invés de pastas, temos fotos direto
                        if ((!result.folders || result.folders.length === 0) && allowedSubfolders.size > 0) {
                            const photosResult = await StorageService.getPhotos(prefix);
                            if (photosResult.photos && photosResult.photos.length > 0) {
                                // Preparar resposta quando há fotos mas não subpastas
                                const responseData = {
                                    success: true,
                                    structure: {
                                        hasSubfolders: false,
                                        folders: [],
                                        hasImages: true,
                                        totalImages: photosResult.photos.length
                                    },
                                    prefix: prefix
                                };

                                // Salvar no cache
                                if (req.client && req.client.clientCode) {
                                    const cacheKey = `${req.client.clientCode}:${prefix || 'root'}`;
                                    structureCache.set(cacheKey, {
                                        data: responseData,
                                        timestamp: Date.now()
                                    });
                                }

                                return res.json(responseData);
                            }
                        }

                        // Preparar resposta com subcategorias filtradas
                        const responseData = {
                            success: true,
                            structure: {
                                hasSubfolders: result.folders && result.folders.length > 0,
                                folders: result.folders || [],
                                hasImages: false,
                                totalImages: 0
                            },
                            prefix: prefix
                        };

                        // Salvar no cache
                        if (req.client && req.client.clientCode) {
                            const cacheKey = `${req.client.clientCode}:${prefix || 'root'}`;
                            structureCache.set(cacheKey, {
                                data: responseData,
                                timestamp: Date.now()
                            });
                        }

                        return res.json(responseData);
                    }
                }
            }
        }
        // ========== FIM DO FILTRO ==========

        // ========== SPECIAL SELECTION: Retornar estrutura simplificada ==========
        if (req.client && req.client.hasSpecialSelection) {
            console.log(`🌟 Cliente ${req.client.clientCode} tem Special Selection`);

            // Preparar resposta para Special Selection
            const responseData = {
                success: true,
                structure: {
                    hasSubfolders: false,
                    folders: [],
                    hasImages: true,
                    totalImages: 3
                },
                prefix: 'special_selection',
                message: 'Special Selection Active'
            };

            // Cache específico para Special Selection
            if (req.client && req.client.clientCode) {
                const cacheKey = `${req.client.clientCode}:special_selection`;
                structureCache.set(cacheKey, {
                    data: responseData,
                    timestamp: Date.now()
                });
                console.log(`💾 [CACHE SAVE] Special Selection - Cliente ${req.client.clientCode}`);
            }

            return res.json(responseData);
        }
        // ========== FIM DA VERIFICAÇÃO SPECIAL ==========

        const result = await StorageService.getSubfolders(prefix);

        if (result.folders) {
            result.folders = result.folders.filter(f => !f.name.startsWith('_'));

            // ✅ ADICIONAR contadores de fotos available
            result.folders = await enrichFoldersWithAvailableCounts(result.folders, prefix);
        }

        if (!result.folders || result.folders.length === 0) {
            const photosResult = await StorageService.getPhotos(prefix);

            if (photosResult.photos && photosResult.photos.length > 0) {
                // Preparar resposta quando há fotos após verificar folders
                const responseData = {
                    success: true,
                    structure: {
                        hasSubfolders: false,
                        folders: [],
                        hasImages: true,
                        totalImages: photosResult.photos.length
                    },
                    prefix: prefix
                };

                // Salvar no cache
                if (req.client && req.client.clientCode) {
                    const cacheKey = `${req.client.clientCode}:${prefix || 'root'}`;
                    structureCache.set(cacheKey, {
                        data: responseData,
                        timestamp: Date.now()
                    });
                    console.log(`💾 [CACHE SAVE] Fotos após folders - Cliente ${req.client.clientCode} - ${prefix} - ${photosResult.photos.length} fotos`);
                }

                return res.json(responseData);
            }
        }

        const structure = {
            hasSubfolders: result.folders && result.folders.length > 0,
            folders: result.folders || [],
            hasImages: false,
            totalImages: 0
        };

        // Preparar resposta final (caso geral - sem filtros)
        const responseData = {
            success: true,
            structure: structure,
            prefix: prefix
        };

        // Salvar no cache mesmo para usuários anônimos (com chave diferente)
        const cacheKey = req.client && req.client.clientCode
            ? `${req.client.clientCode}:${prefix || 'root'}`
            : `anonymous:${prefix || 'root'}`;

        structureCache.set(cacheKey, {
            data: responseData,
            timestamp: Date.now()
        });

        res.json(responseData);  // Note que aqui não tem return porque é o fim da função

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

                    // Usar fotos direto da categoria (NÃO buscar no PhotoStatus)
                    console.log(`📊 ${category.photos.length} fotos encontradas direto da categoria`);

                    // Formatar direto das fotos da categoria
                    const photos = category.photos.map(photo => ({
                        id: photo.photoId,
                        name: photo.fileName,
                        fileName: photo.fileName,
                        webViewLink: `https://images.sunshinecowhides-gallery.com/${photo.photoId}`,
                        thumbnailLink: `https://images.sunshinecowhides-gallery.com/_thumbnails/${photo.photoId}`,
                        size: 0,
                        mimeType: 'image/webp',
                        customPrice: photo.customPrice || category.baseCategoryPrice || 99
                    }));

                    return res.json({
                        success: true,
                        photos: photos,
                        folder: {
                            name: category.categoryDisplayName || category.categoryName
                        },
                        totalPhotos: photos.length,
                        clientType: 'special',
                        // ADICIONAR RATE RULES SE EXISTIR
                        rateRules: category.rateRules && category.rateRules.length > 0 ? category.rateRules : null,
                        baseCategoryPrice: category.baseCategoryPrice || category.customPrice || 99
                    });
                }
            }

            // Fallback: retornar todas se não encontrar categoria
            console.log('⚠️ Categoria não encontrada, retornando todas');
            const specialPhotos = await PhotoStatus.find({
                'reservedBy.clientCode': req.client.clientCode,
                status: 'reserved'
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

        // NOVA ABORDAGEM: Buscar direto do MongoDB apenas fotos available
        console.log(`🔍 Buscando fotos available do MongoDB para: ${prefix}`);

        // Preparar busca - EXCLUIR Coming Soon
        let searchQuery = {
            $and: [
                {
                    $or: [
                        {
                            status: 'available',
                            // ===== NOVO: EXCLUIR COMING SOON =====
                            $or: [
                                { transitStatus: 'available' },
                                { transitStatus: { $exists: false } },
                                { transitStatus: null }
                            ],
                            // ===== EXCLUIR tbetiqueta =====
                            $and: [
                                { $or: [
                                    { cdeTable: { $ne: 'tbetiqueta' } },
                                    { cdeTable: { $exists: false } },
                                    { cdeTable: null }
                                ]}
                            ]
                        },
                        // Mostrar fotos reservadas pelo próprio cliente
                        {
                            status: 'reserved',
                            'reservedBy.clientCode': req.client?.clientCode
                        }
                    ]
                },
                {
                    $or: [
                        { selectionId: { $exists: false } },
                        { selectionId: null }
                    ]
                }
            ]
        };

        // Se não há cliente autenticado, mostrar apenas available
        if (!req.client?.clientCode) {
            searchQuery = {
                status: 'available',
                transitStatus: { $ne: 'coming_soon' },
                cdeTable: { $ne: 'tbetiqueta' },
                $or: [
                    { selectionId: { $exists: false } },
                    { selectionId: null }
                ]
            };
        }
        // Adicionar filtro de path se especificado
        if (prefix) {
            // Escapar TODOS os caracteres especiais incluindo aspas
            const escapedPrefix = prefix
                .replace(/[.*+?^${}()|[\]\\'"]/g, '\\$&');  // Adicionei ' e "
            searchQuery.driveFileId = { $regex: escapedPrefix, $options: 'i' };
        }

        // Buscar apenas fotos disponíveis - COM ORDENAÇÃO
        const availablePhotos = await UnifiedProductComplete.find(searchQuery)
            .sort({ fileName: 1 })  // 🆕 ORDENAR por nome do arquivo
            .select('fileName driveFileId photoNumber photoId r2Path status reservedBy');

        // Formatar para compatibilidade
        const filteredPhotos = availablePhotos.map(photo => {
            // VERIFICAR SE É RESERVA PRÓPRIA
            const isOwnReservation = photo.status === 'reserved' &&
                photo.reservedBy?.clientCode === req.client?.clientCode;

            return {
                id: photo.driveFileId || photo.r2Path,
                name: photo.fileName,
                fileName: photo.fileName,
                r2Key: photo.driveFileId || photo.r2Path,
                thumbnailUrl: `https://images.sunshinecowhides-gallery.com/_thumbnails/${photo.driveFileId || photo.r2Path}`,
                webViewLink: `https://images.sunshinecowhides-gallery.com/${photo.driveFileId || photo.r2Path}`,
                size: 0,
                mimeType: 'image/webp',
                isOwnReservation: isOwnReservation,  // NOVA FLAG
                actualStatus: photo.status           // STATUS REAL
            };
        });

        // Buscar status de todas as fotos
        const photoIds = filteredPhotos.map(photo => {
            const name = photo.fileName || photo.name.split('/').pop();
            return name.replace('.webp', '');
        });

        const photoStatuses = await UnifiedProductComplete.find({
            photoId: { $in: photoIds }
        }).select('photoId status');

        const statusMap = {};
        photoStatuses.forEach(ps => {
            // 🆕 Se é reserva própria, tratar como available no mapa
            if (ps.status === 'reserved' &&
                ps.reservedBy?.clientCode === req.client?.clientCode) {
                statusMap[ps.photoId] = 'available';  // ← Truque: força available!
            } else {
                statusMap[ps.photoId] = ps.status;
            }
        });

        // Processar fotos
        const photos = filteredPhotos.map(photo => {
            const fileName = photo.fileName || photo.name.split('/').pop();
            const photoId = fileName.replace('.webp', '');

            return {
                id: photo.r2Key || photo.id,
                name: photo.name,
                fileName: photo.fileName,
                webViewLink: photo.url || photo.webViewLink,
                thumbnailLink: photo.thumbnailUrl,
                size: photo.size,
                mimeType: photo.mimeType,
                status: statusMap[photoId] || 'available',
                // ✅ ADICIONAR: Manter flags importantes
                isOwnReservation: photo.isOwnReservation || false,
                actualStatus: photo.actualStatus || photo.status
            };
        });

        // Limpar preços se necessário
        if (FORCE_HIDE_PRICES) {
            photos.forEach(photo => {
                delete photo.customPrice;
                delete photo.price;
                delete photo.formattedPrice;
            });
        }

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

// Endpoint para verificar mudanças de status - COM AUTENTICAÇÃO
router.get('/status-updates', verifyClientToken, async (req, res) => {
    try {
        const StatusMonitor = require('../services/StatusMonitor');
        const changes = await StatusMonitor.getRecentChanges(1);

        // 🆕 ENRIQUECER mudanças com informação de própria reserva
        const enrichedChanges = await Promise.all(changes.map(async change => {
            // Se é uma foto reservada, verificar se é do próprio cliente
            if (change.status === 'reserved' && req.client?.clientCode) {
                // 🔍 BUSCAR foto no banco para pegar o reservedBy
                const photoStatus = await UnifiedProductComplete.findOne({
                    photoId: change.id.replace('.webp', '')
                }).select('reservedBy');

                if (photoStatus?.reservedBy?.clientCode) {
                    const isOwnReservation = photoStatus.reservedBy.clientCode === req.client.clientCode;

                    return {
                        ...change,
                        isOwnReservation: isOwnReservation,
                        clientCode: photoStatus.reservedBy.clientCode
                    };
                }
            }

            return change;
        }));

        if (enrichedChanges.length > 0) {
            // console.log(`📊 Status updates: ${enrichedChanges.length} mudanças detectadas`);
            // enrichedChanges.forEach(c => {
            //     const ownTag = c.isOwnReservation ? ' (própria reserva)' : '';
            //     const sourceTag = c.source ? ` [${c.source}]` : '';
            //     console.log(`  - Foto ${c.id}: ${c.status}${ownTag}${sourceTag}`);
            // });
        }

        res.json({ success: true, changes: enrichedChanges });
    } catch (error) {
        console.error('Erro ao buscar status updates:', error);
        res.json({ success: false, changes: [] });
    }
});

// Listar TODAS as categorias (sem filtro de pricing)
router.get('/categories-all', verifyClientToken, async (req, res) => {
    try {
        const PhotoCategory = require('../models/PhotoCategory');

        const categories = await PhotoCategory.find({
            isActive: true,
            photoCount: { $gt: 0 }
        }).select('displayName qbItem photoCount googleDrivePath');

        res.json({
            success: true,
            categories: categories.map(c => ({
                name: c.displayName,
                qbItem: c.qbItem,
                photoCount: c.photoCount,
                id: c.googleDrivePath
            }))
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// ROTAS PARA GALERIA COMING SOON (TRÂNSITO)
// ============================================

// Contar fotos em trânsito
router.get('/transit/count', verifyClientToken, async (req, res) => {
    try {
        console.log('📊 Contando fotos em trânsito...');

        // Buscar fotos com transitStatus = 'coming_soon'
        const count = await UnifiedProductComplete.countDocuments({
            transitStatus: 'coming_soon',
            cdeTable: 'tbetiqueta'
        });

        console.log(`✅ Total de fotos em trânsito: ${count}`);

        res.json({
            success: true,
            count: count
        });

    } catch (error) {
        console.error('❌ Erro ao contar fotos em trânsito:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// NOVA ROTA: /transit/structure COM HIERARQUIA
// ============================================
// Substitua a rota existente (linha 816-883 do gallery.js) por esta versão

// ============================================
// VERSÃO SIMPLIFICADA - /transit/structure
// ============================================
// Substitua a rota existente no gallery.js (linha ~816) por esta versão

router.get('/transit/structure', verifyClientToken, async (req, res) => {
    try {
        const prefix = req.query.prefix || '';
        console.log(`🚢 Buscando estrutura Coming Soon: ${prefix || 'raiz'}`);

        // 1. Buscar fotos Coming Soon
        const photos = await UnifiedProductComplete.find({
            transitStatus: 'coming_soon',
            cdeTable: 'tbetiqueta'
        }).select('qbItem photoNumber');

        if (photos.length === 0) {
            return res.json({
                success: true,
                structure: { hasSubfolders: false, folders: [], hasImages: false, totalImages: 0 },
                isTransit: true
            });
        }

        // 2. Buscar categorias completas
        const PhotoCategory = require('../models/PhotoCategory');
        const qbItems = [...new Set(photos.map(p => p.qbItem))];
        const categories = await PhotoCategory.find({
            qbItem: { $in: qbItems }
        }).select('qbItem displayName googleDrivePath folderName');

        // 3. Criar mapa qbItem → categoria
        const categoryMap = new Map();
        categories.forEach(cat => {
            if (cat.googleDrivePath) {
                const photoCount = photos.filter(p => p.qbItem === cat.qbItem).length;
                categoryMap.set(cat.qbItem, {
                    qbItem: cat.qbItem,
                    path: cat.googleDrivePath,
                    displayName: cat.displayName,
                    folderName: cat.folderName,
                    photoCount: photoCount
                });
            }
        });

        // 4. Filtrar por prefix se necessário
        let relevantCategories = Array.from(categoryMap.values());

        if (prefix) {
            // Tem prefix → filtrar categorias que começam com ele
            relevantCategories = relevantCategories.filter(cat =>
                cat.path.startsWith(prefix + '/')
            );
        }

        console.log(`📊 ${relevantCategories.length} categorias após filtro de prefix`);

        // 5. Agrupar por próximo nível de path
        const levelMap = new Map();

        relevantCategories.forEach(cat => {
            let pathParts = cat.path.split('/').filter(p => p);

            if (prefix) {
                // Remover o prefix do path
                const prefixParts = prefix.split('/').filter(p => p);
                pathParts = pathParts.slice(prefixParts.length);
            }

            if (pathParts.length === 0) return;

            // Próximo nível
            const nextLevel = pathParts[0];

            if (!levelMap.has(nextLevel)) {
                levelMap.set(nextLevel, {
                    name: nextLevel,
                    photoCount: 0,
                    categories: []
                });
            }

            const level = levelMap.get(nextLevel);
            level.photoCount += cat.photoCount;
            level.categories.push(cat);
        });

        // 6. Criar folders
        const folders = Array.from(levelMap.values()).map(level => {
            // Determinar se é categoria final (tem fotos diretas) ou tem subníveis
            const isFinal = level.categories.length === 1 &&
                level.categories[0].path.split('/').filter(p => p).length ===
                (prefix ? prefix.split('/').filter(p => p).length + 1 : 1);

            const fullPath = prefix ? `${prefix}/${level.name}` : level.name;

            return {
                name: level.name,
                id: isFinal ? level.categories[0].qbItem : fullPath,
                photoCount: level.photoCount,
                hasSubfolders: !isFinal,
                thumbnailUrl: null,
                isTransit: true
            };
        });

        console.log(`✅ ${folders.length} folders no nível atual`);
        folders.forEach(f => {
            console.log(`   - ${f.name}: ${f.photoCount} fotos (${f.hasSubfolders ? 'tem sub' : 'final'})`);
        });

        res.json({
            success: true,
            structure: {
                hasSubfolders: folders.length > 0,
                folders: folders,
                hasImages: false,
                totalImages: 0
            },
            isTransit: true,
            currentPrefix: prefix
        });

    } catch (error) {
        console.error('❌ Erro ao buscar estrutura de trânsito:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// Para buscar subcategorias de uma categoria principal
// ============================================

router.get('/transit/subcategories', verifyClientToken, async (req, res) => {
    try {
        const mainCategory = req.query.category;
        console.log(`🚢 Buscando subcategorias de: ${mainCategory}`);

        // Buscar todas categorias que começam com este prefixo
        const PhotoCategory = require('../models/PhotoCategory');
        const categories = await PhotoCategory.find({
            googleDrivePath: new RegExp(`^${mainCategory}/`)
        }).select('qbItem displayName googleDrivePath');

        // Buscar fotos de cada categoria
        const qbItems = categories.map(c => c.qbItem);
        const photoCounts = await UnifiedProductComplete.aggregate([
            {
                $match: {
                    transitStatus: 'coming_soon',
                    cdeTable: 'tbetiqueta',
                    qbItem: { $in: qbItems }
                }
            },
            {
                $group: {
                    _id: '$qbItem',
                    count: { $sum: 1 },
                    firstPhoto: { $first: '$driveFileId' }
                }
            }
        ]);

        const countMap = {};
        photoCounts.forEach(pc => {
            countMap[pc._id] = {
                count: pc.count,
                firstPhoto: pc.firstPhoto
            };
        });

        // Montar folders
        const folders = categories
            .filter(cat => countMap[cat.qbItem])
            .map(cat => ({
                name: cat.displayName,
                id: cat.qbItem,
                photoCount: countMap[cat.qbItem].count,
                thumbnailUrl: `https://images.sunshinecowhides-gallery.com/_thumbnails/${countMap[cat.qbItem].firstPhoto}`
            }));

        console.log(`✅ ${folders.length} subcategorias encontradas`);

        res.json({
            success: true,
            structure: {
                hasSubfolders: folders.length > 0,
                folders: folders,
                hasImages: false,
                totalImages: 0
            },
            isTransit: true
        });

    } catch (error) {
        console.error('❌ Erro ao buscar subcategorias:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Buscar fotos em trânsito de uma categoria
router.get('/transit/photos', verifyClientToken, async (req, res) => {
    try {
        const qbItem = req.query.qbItem || req.query.prefix;
        console.log(`🚢 Buscando fotos em trânsito da categoria: ${qbItem}`);

        // Buscar fotos
        const photos = await UnifiedProductComplete.find({
            transitStatus: 'coming_soon',
            cdeTable: 'tbetiqueta',
            qbItem: qbItem
        }).sort({ fileName: 1 });

        // Buscar nome da categoria
        const PhotoCategory = require('../models/PhotoCategory');
        const category = await PhotoCategory.findOne({ qbItem: qbItem });

        // Formatar fotos
        const formattedPhotos = photos.map(photo => ({
            id: photo.driveFileId || photo.photoId,
            name: photo.fileName,
            fileName: photo.fileName,
            webViewLink: `https://images.sunshinecowhides-gallery.com/${photo.driveFileId || photo.photoId}`,
            thumbnailLink: `https://images.sunshinecowhides-gallery.com/_thumbnails/${photo.driveFileId || photo.photoId}`,
            size: 0,
            mimeType: 'image/webp',
            status: 'coming_soon',
            transitStatus: 'coming_soon',
            cdeStatus: photo.cdeStatus
        }));

        console.log(`✅ ${formattedPhotos.length} fotos encontradas`);

        res.json({
            success: true,
            photos: formattedPhotos,
            folder: {
                name: category?.displayName || qbItem || 'Coming Soon'
            },
            totalPhotos: formattedPhotos.length,
            isTransit: true
        });

    } catch (error) {
        console.error('❌ Erro ao buscar fotos em trânsito:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// FIM DAS ROTAS DE COMING SOON
// ============================================

module.exports = router;
