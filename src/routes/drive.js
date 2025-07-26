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

module.exports = router;