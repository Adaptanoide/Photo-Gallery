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

// Listar pastas (categorias)
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

// Explorar estrutura completa recursivamente
router.get('/explore/:folderId?', async (req, res) => {
    try {
        const drive = getGoogleDriveAuth();
        const folderId = req.params.folderId || process.env.DRIVE_FOLDER_AVAILABLE || '1Ky3wSKKg_mmQihdxmiYwMuqE3-SBTcbx';
        const maxDepth = parseInt(req.query.depth) || 3; // Limitar profundidade
        
        console.log(`🔍 Explorando pasta: ${folderId}, profundidade máxima: ${maxDepth}`);
        
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

// Buscar fotos de uma pasta específica (para interface do cliente)
router.get('/photos/:folderId', async (req, res) => {
    try {
        const drive = getGoogleDriveAuth();
        const { folderId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        
        // Buscar apenas arquivos de imagem
        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false and (mimeType contains 'image' or name contains '.jpg' or name contains '.jpeg' or name contains '.png')`,
            fields: 'files(id, name, mimeType, size, modifiedTime, thumbnailLink, webViewLink)',
            orderBy: 'name',
            pageSize: limit
        });
        
        const photos = response.data.files.map(photo => ({
            id: photo.id,
            name: photo.name,
            size: photo.size,
            thumbnailLink: photo.thumbnailLink,
            webViewLink: photo.webViewLink,
            modifiedTime: photo.modifiedTime
        }));
        
        res.json({
            success: true,
            photos,
            total: photos.length,
            page,
            limit,
            folderId
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

module.exports = router;