// src/routes/gallery.js - VERSÃO COM CONVERSÃO DE IDs
const express = require('express');
const router = express.Router();
const StorageService = require('../services/StorageService');

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

router.get('/structure', async (req, res) => {
    try {
        let prefix = req.query.prefix || '';
        
        // CONVERTER ID para PATH se necessário
        prefix = convertToR2Path(prefix);
        
        console.log(`📂 Buscando estrutura de: ${prefix || '/'}`);
        
        const result = await StorageService.getSubfolders(prefix);
        
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

// Listar fotos
router.get('/photos', async (req, res) => {
    try {
        let prefix = req.query.prefix || '';
        
        // CONVERTER ID para PATH se necessário
        prefix = convertToR2Path(prefix);
        
        console.log(`📸 Buscando fotos de: ${prefix}`);
        
        const result = await StorageService.getPhotos(prefix);
        
        // Processar fotos
        const photos = result.photos.map(photo => ({
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
            totalPhotos: photos.length
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
