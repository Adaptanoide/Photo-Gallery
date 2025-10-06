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
        if (req.client && req.client.clientCode) {
            const cacheKey = `${req.client.clientCode}:${prefix || 'root'}`;
            const cached = structureCache.get(cacheKey);

            if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
                console.log(`📦 [CACHE HIT] Cliente ${req.client.clientCode} - ${prefix || '/'}`);
                console.log(`   ⏱️ Idade do cache: ${Math.round((Date.now() - cached.timestamp) / 1000)}s`);
                return res.json(cached.data);
            } else {
                console.log(`🔄 [CACHE MISS] Cliente ${req.client.clientCode} - ${prefix || '/'} - Buscando dados novos`);
            }
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
                    console.log('📦 Usando cache de permissões (economizando 100+ queries)');
                    allowedPaths = new Set(cached.allowedPaths);
                } else {
                    console.log('🔄 Cache não encontrado, calculando permissões...');
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

                        console.log(`📊 Encontradas ${categories.length} categorias para ${qbItems.length} QB items`);

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

                    console.log(`✅ Permissões calculadas e cacheadas em ${Date.now() - startCalc}ms`);
                }

                console.log(`📊 Total de paths permitidos: ${allowedPaths.size}`);

                // Se estamos no root, filtrar categorias
                if (!prefix || prefix === '') {
                    const result = await StorageService.getSubfolders(prefix);

                    result.folders = result.folders.filter(f =>
                        !f.name.startsWith('_') && allowedPaths.has(f.name)
                    );

                    console.log(`📁 Mostrando ${result.folders.length} categorias permitidas`);

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
                        console.log(`💾 [CACHE SAVE] Root filtrado - Cliente ${req.client.clientCode} - ${result.folders.length} categorias`);
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
                    console.log(`🔍 Filtrando subcategorias para: ${prefix}`);

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
                            // Filtrar pastas permitidas (sem logs verbosos)
                            result.folders = result.folders.filter(f => {
                                const startsWithUnderscore = f.name.startsWith('_');
                                const isInAllowed = allowedSubfolders.has(f.name);
                                return !startsWithUnderscore && isInAllowed;
                            });
                        }

                        // Log resumido (opcional - comente se quiser zero logs)
                        if (process.env.NODE_ENV === 'development') {
                            console.log(`📊 ${result.folders?.length || 0}/${originalCount} subcategorias permitidas em ${prefix}`);
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

        console.log(`💾 [CACHE SAVE] Geral - Cliente ${req.client?.clientCode || 'anônimo'} - ${prefix || '/'} - ${result.folders?.length || 0} pastas`);

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

        // Buscar apenas fotos disponíveis
        const availablePhotos = await UnifiedProductComplete.find(searchQuery)
            .select('fileName driveFileId photoNumber photoId r2Path status reservedBy');

        console.log(`✅ ${availablePhotos.length} fotos available encontradas`);

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
            statusMap[ps.photoId] = ps.status;
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
                status: statusMap[photoId] || 'available'  // ADICIONE ESTA LINHA
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

// Endpoint para verificar mudanças de status
router.get('/status-updates', async (req, res) => {
    try {
        const StatusMonitor = require('../services/StatusMonitor');
        const changes = await StatusMonitor.getRecentChanges(1);

        if (changes.length > 0) {
            console.log(`📊 Status updates: ${changes.length} mudanças detectadas`);
            changes.forEach(c => {
                console.log(`  - Foto ${c.id}: ${c.status} (${c.source})`);
            });
        }

        res.json({ success: true, changes });
    } catch (error) {
        console.error('Erro ao buscar status updates:', error);
        res.json({ success: false, changes: [] });
    }
});

module.exports = router;
