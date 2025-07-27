// src/routes/drive.js
const express = require('express');
const { google } = require('googleapis');

const router = express.Router();

// Configuração Google Drive
const getGoogleDriveAuth = () => {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        },
        scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    
    return google.drive({ version: 'v3', auth });
};

// Status do Google Drive
router.get('/status', async (req, res) => {
    try {
        if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
            return res.status(500).json({
                status: 'ERROR',
                message: 'Credenciais do Google Drive não configuradas'
            });
        }
        
        const drive = getGoogleDriveAuth();
        
        // Testar acesso à pasta principal
        const response = await drive.files.get({
            fileId: process.env.DRIVE_FOLDER_AVAILABLE || '1Ky3wSKKg_mmQihdxmiYwMuqE3-SBTcbx',
            fields: 'id, name, mimeType'
        });
        
        res.json({
            status: 'OK',
            message: 'Google Drive conectado',
            folder: {
                id: response.data.id,
                name: response.data.name,
                type: response.data.mimeType
            }
        });
        
    } catch (error) {
        console.error('Erro ao verificar Google Drive:', error);
        res.status(500).json({
            status: 'ERROR',
            message: 'Erro de conexão com Google Drive',
            error: error.message
        });
    }
});

// Listar pastas (categorias) principais
router.get('/folders', async (req, res) => {
    try {
        const drive = getGoogleDriveAuth();
        const parentFolderId = process.env.DRIVE_FOLDER_AVAILABLE || '1Ky3wSKKg_mmQihdxmiYwMuqE3-SBTcbx';
        
        const response = await drive.files.list({
            q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
            fields: 'files(id, name, modifiedTime)',
            orderBy: 'name'
        });
        
        res.json({
            success: true,
            folders: response.data.files,
            parentId: parentFolderId
        });
        
    } catch (error) {
        console.error('Erro ao listar pastas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar pastas'
        });
    }
});

// Explorar pasta específica para navegação do cliente (MELHORADO)
router.get('/explore/:folderId', async (req, res) => {
    try {
        const drive = getGoogleDriveAuth();
        const { folderId } = req.params;
        const maxDepth = parseInt(req.query.depth) || 2;
        
        console.log(`📁 Explorando pasta específica: ${folderId}`);
        
        // Buscar informações da pasta atual
        const folderInfo = await drive.files.get({
            fileId: folderId,
            fields: 'id, name, mimeType, parents'
        });
        
        // Listar conteúdo da pasta
        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, size, modifiedTime, thumbnailLink)',
            orderBy: 'name'
        });
        
        const items = response.data.files;
        const folders = items.filter(item => item.mimeType === 'application/vnd.google-apps.folder');
        const files = items.filter(item => item.mimeType !== 'application/vnd.google-apps.folder');
        
        // Para cada subpasta, buscar informações detalhadas para melhor UX
        const foldersWithInfo = [];
        for (const folder of folders) {
            try {
                const subResponse = await drive.files.list({
                    q: `'${folder.id}' in parents and trashed = false`,
                    fields: 'files(mimeType)',
                    pageSize: 10
                });
                
                const subItems = subResponse.data.files;
                const hasImages = subItems.some(file => 
                    file.mimeType && (
                        file.mimeType.startsWith('image/') ||
                        /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file.name || '')
                    )
                );
                
                const hasSubfolders = subItems.some(file => 
                    file.mimeType === 'application/vnd.google-apps.folder'
                );
                
                const imageCount = subItems.filter(file => 
                    file.mimeType && (
                        file.mimeType.startsWith('image/') ||
                        /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file.name || '')
                    )
                ).length;
                
                foldersWithInfo.push({
                    id: folder.id,
                    name: folder.name,
                    hasImages,
                    hasSubfolders,
                    imageCount,
                    totalFiles: subItems.filter(f => f.mimeType !== 'application/vnd.google-apps.folder').length,
                    totalSubfolders: subItems.filter(f => f.mimeType === 'application/vnd.google-apps.folder').length,
                    modifiedTime: folder.modifiedTime
                });
                
            } catch (error) {
                console.error(`Erro ao verificar subpasta ${folder.name}:`, error.message);
                foldersWithInfo.push({
                    id: folder.id,
                    name: folder.name,
                    hasImages: false,
                    hasSubfolders: false,
                    imageCount: 0,
                    totalFiles: 0,
                    totalSubfolders: 0,
                    modifiedTime: folder.modifiedTime
                });
            }
        }
        
        // Filtrar e processar arquivos de imagem
        const imageFiles = files.filter(file => {
            const isImage = file.mimeType && (
                file.mimeType.startsWith('image/') ||
                /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file.name)
            );
            return isImage;
        }).map(file => ({
            id: file.id,
            name: file.name,
            size: file.size,
            thumbnailLink: file.thumbnailLink,
            modifiedTime: file.modifiedTime,
            mimeType: file.mimeType,
            isImage: true
        }));
        
        const structure = {
            id: folderInfo.data.id,
            name: folderInfo.data.name,
            folders: foldersWithInfo,
            files: imageFiles,
            totalSubfolders: folders.length,
            totalFiles: files.length,
            totalImages: imageFiles.length,
            hasImages: imageFiles.length > 0,
            hasSubfolders: folders.length > 0
        };
        
        console.log(`✅ Pasta explorada: ${structure.name} - ${structure.totalSubfolders} subpastas, ${structure.totalImages} imagens`);
        
        res.json({
            success: true,
            structure,
            folderId
        });
        
    } catch (error) {
        console.error('❌ Erro ao explorar pasta específica:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao explorar pasta',
            error: error.message
        });
    }
});

// Buscar fotos de uma pasta específica - OTIMIZADO PARA GALERIA
router.get('/photos/:folderId', async (req, res) => {
    try {
        const drive = getGoogleDriveAuth();
        const { folderId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const page = parseInt(req.query.page) || 1;
        
        console.log(`🖼️ Buscando fotos da pasta: ${folderId}, limite: ${limit}, página: ${page}`);
        
        // Buscar informações da pasta
        const folderInfo = await drive.files.get({
            fileId: folderId,
            fields: 'id, name'
        });
        
        // Buscar arquivos de imagem com filtro otimizado
        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false and (mimeType contains 'image/' or name contains '.jpg' or name contains '.jpeg' or name contains '.png' or name contains '.gif' or name contains '.bmp' or name contains '.webp' or name contains '.JPG' or name contains '.JPEG')`,
            fields: 'files(id, name, mimeType, size, modifiedTime, thumbnailLink, webViewLink, imageMediaMetadata)',
            orderBy: 'name',
            pageSize: limit
        });
        
        const photos = response.data.files.map((photo, index) => ({
            id: photo.id,
            name: photo.name,
            size: photo.size,
            thumbnailLink: photo.thumbnailLink,
            webViewLink: photo.webViewLink,
            modifiedTime: photo.modifiedTime,
            mimeType: photo.mimeType,
            index: index,
            // URLs otimizadas para diferentes tamanhos
            thumbnailSmall: photo.thumbnailLink ? photo.thumbnailLink.replace('=s220', '=s150') : null,
            thumbnailMedium: photo.thumbnailLink ? photo.thumbnailLink.replace('=s220', '=s400') : null,
            thumbnailLarge: photo.thumbnailLink ? photo.thumbnailLink.replace('=s220', '=s800') : null,
            // Metadados de imagem se disponível
            dimensions: photo.imageMediaMetadata ? {
                width: photo.imageMediaMetadata.width,
                height: photo.imageMediaMetadata.height
            } : null
        }));
        
        console.log(`✅ Encontradas ${photos.length} fotos na pasta: ${folderInfo.data.name}`);
        
        res.json({
            success: true,
            photos,
            pagination: {
                total: photos.length,
                page,
                limit,
                hasMore: photos.length === limit
            },
            folder: {
                id: folderId,
                name: folderInfo.data.name
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar fotos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar fotos da pasta',
            error: error.message
        });
    }
});

// Buscar foto específica para visualização fullscreen
router.get('/photo/:photoId', async (req, res) => {
    try {
        const drive = getGoogleDriveAuth();
        const { photoId } = req.params;
        const size = req.query.size || 'large'; // small, medium, large, original
        
        console.log(`🔍 Buscando foto específica: ${photoId}, tamanho: ${size}`);
        
        // Buscar informações da foto
        const response = await drive.files.get({
            fileId: photoId,
            fields: 'id, name, mimeType, size, modifiedTime, thumbnailLink, webViewLink, imageMediaMetadata, parents'
        });
        
        const photo = response.data;
        
        // Gerar URLs em diferentes resoluções
        let imageUrl = photo.thumbnailLink;
        if (photo.thumbnailLink) {
            switch (size) {
                case 'small':
                    imageUrl = photo.thumbnailLink.replace('=s220', '=s300');
                    break;
                case 'medium':
                    imageUrl = photo.thumbnailLink.replace('=s220', '=s600');
                    break;
                case 'large':
                    imageUrl = photo.thumbnailLink.replace('=s220', '=s1200');
                    break;
                case 'original':
                    imageUrl = photo.thumbnailLink.replace('=s220', '=s2048');
                    break;
                default:
                    imageUrl = photo.thumbnailLink.replace('=s220', '=s800');
            }
        }
        
        res.json({
            success: true,
            photo: {
                id: photo.id,
                name: photo.name,
                size: photo.size,
                mimeType: photo.mimeType,
                modifiedTime: photo.modifiedTime,
                imageUrl,
                webViewLink: photo.webViewLink,
                dimensions: photo.imageMediaMetadata ? {
                    width: photo.imageMediaMetadata.width,
                    height: photo.imageMediaMetadata.height
                } : null,
                parent: photo.parents ? photo.parents[0] : null
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar foto específica:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar foto',
            error: error.message
        });
    }
});

// Buscar fotos adjacentes para navegação (anterior/próxima)
router.get('/photos/:folderId/navigation/:currentPhotoId', async (req, res) => {
    try {
        const drive = getGoogleDriveAuth();
        const { folderId, currentPhotoId } = req.params;
        
        console.log(`🧭 Buscando navegação para foto: ${currentPhotoId} na pasta: ${folderId}`);
        
        // Buscar todas as fotos da pasta ordenadas
        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false and (mimeType contains 'image/' or name contains '.jpg' or name contains '.jpeg' or name contains '.png' or name contains '.gif' or name contains '.bmp' or name contains '.webp')`,
            fields: 'files(id, name, thumbnailLink)',
            orderBy: 'name',
            pageSize: 1000 // Limite alto para pegar todas as fotos
        });
        
        const allPhotos = response.data.files;
        const currentIndex = allPhotos.findIndex(photo => photo.id === currentPhotoId);
        
        if (currentIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Foto não encontrada'
            });
        }
        
        const previousPhoto = currentIndex > 0 ? allPhotos[currentIndex - 1] : null;
        const nextPhoto = currentIndex < allPhotos.length - 1 ? allPhotos[currentIndex + 1] : null;
        
        res.json({
            success: true,
            navigation: {
                current: {
                    index: currentIndex,
                    total: allPhotos.length
                },
                previous: previousPhoto ? {
                    id: previousPhoto.id,
                    name: previousPhoto.name,
                    thumbnailLink: previousPhoto.thumbnailLink
                } : null,
                next: nextPhoto ? {
                    id: nextPhoto.id,
                    name: nextPhoto.name,
                    thumbnailLink: nextPhoto.thumbnailLink
                } : null
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar navegação de fotos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar navegação',
            error: error.message
        });
    }
});

// Explorar estrutura completa recursivamente (MANTIDO DO ORIGINAL)
router.get('/explore/:folderId?', async (req, res) => {
    try {
        const drive = getGoogleDriveAuth();
        const folderId = req.params.folderId || process.env.DRIVE_FOLDER_AVAILABLE || '1Ky3wSKKg_mmQihdxmiYwMuqE3-SBTcbx';
        const maxDepth = parseInt(req.query.depth) || 3; // Limitar profundidade
        
        console.log(`🔍 Explorando pasta completa: ${folderId}, profundidade máxima: ${maxDepth}`);
        
        // Função recursiva para explorar estrutura
        async function exploreFolder(currentFolderId, currentDepth = 0, path = []) {
            if (currentDepth > maxDepth) {
                return { tooDeep: true, depth: currentDepth };
            }
            
            try {
                // Buscar informações da pasta atual
                const folderInfo = await drive.files.get({
                    fileId: currentFolderId,
                    fields: 'id, name, mimeType, parents, modifiedTime'
                });
                
                // Listar conteúdo da pasta
                const response = await drive.files.list({
                    q: `'${currentFolderId}' in parents and trashed = false`,
                    fields: 'files(id, name, mimeType, size, modifiedTime, thumbnailLink)',
                    orderBy: 'name'
                });
                
                const items = response.data.files;
                const folders = items.filter(item => item.mimeType === 'application/vnd.google-apps.folder');
                const files = items.filter(item => item.mimeType !== 'application/vnd.google-apps.folder');
                
                const currentPath = [...path, folderInfo.data.name];
                
                console.log(`📁 Pasta: ${currentPath.join(' > ')} - ${folders.length} subpastas, ${files.length} arquivos`);
                
                // Explorar subpastas recursivamente
                const subfolders = [];
                for (const folder of folders) {
                    const subfolder = await exploreFolder(folder.id, currentDepth + 1, currentPath);
                    subfolders.push({
                        id: folder.id,
                        name: folder.name,
                        path: [...currentPath, folder.name],
                        ...subfolder
                    });
                }
                
                return {
                    id: folderInfo.data.id,
                    name: folderInfo.data.name,
                    path: currentPath,
                    depth: currentDepth,
                    folders: subfolders,
                    files: files.map(file => ({
                        id: file.id,
                        name: file.name,
                        size: file.size,
                        thumbnailLink: file.thumbnailLink,
                        modifiedTime: file.modifiedTime,
                        path: [...currentPath, file.name],
                        isImage: /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file.name)
                    })),
                    totalSubfolders: folders.length,
                    totalFiles: files.length,
                    hasImages: files.some(file => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file.name))
                };
                
            } catch (error) {
                console.error(`❌ Erro ao explorar pasta ${currentFolderId}:`, error.message);
                return {
                    error: error.message,
                    id: currentFolderId,
                    depth: currentDepth
                };
            }
        }
        
        // Iniciar exploração
        const structure = await exploreFolder(folderId);
        
        // Estatísticas gerais
        function getStats(node) {
            let totalFolders = 0;
            let totalFiles = 0;
            let totalImages = 0;
            let maxDepth = node.depth || 0;
            
            if (node.files) {
                totalFiles += node.files.length;
                totalImages += node.files.filter(f => f.isImage).length;
            }
            
            if (node.folders) {
                totalFolders += node.folders.length;
                for (const folder of node.folders) {
                    const stats = getStats(folder);
                    totalFolders += stats.totalFolders;
                    totalFiles += stats.totalFiles;
                    totalImages += stats.totalImages;
                    maxDepth = Math.max(maxDepth, stats.maxDepth);
                }
            }
            
            return { totalFolders, totalFiles, totalImages, maxDepth };
        }
        
        const stats = getStats(structure);
        
        res.json({
            success: true,
            message: 'Estrutura explorada com sucesso',
            rootFolder: folderId,
            exploredDepth: maxDepth,
            structure,
            statistics: {
                ...stats,
                explorationDate: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao explorar estrutura:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao explorar estrutura do Google Drive',
            error: error.message
        });
    }
});

module.exports = router;