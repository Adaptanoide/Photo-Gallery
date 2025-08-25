/**
 * Google Drive Service
 * Gerencia todas as operações com o Google Drive
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class DriveService {
    constructor() {
        this.drive = null;
        this.folderId = process.env.DRIVE_FOLDER_AVAILABLE;
    }

    // Inicializar conexão
    async init() {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
            },
            scopes: ['https://www.googleapis.com/auth/drive.readonly']
        });

        const authClient = await auth.getClient();
        this.drive = google.drive({ version: 'v3', auth: authClient });
    }

    // Extrair número da foto
    extractPhotoNumber(filename) {
        const match = filename.match(/(\d{4,6})/);
        return match ? match[1] : null;
    }

    // Listar todas as fotos recursivamente
    async listAllPhotos(folderId = this.folderId, folderPath = '') {
        const photos = [];
        let pageToken = null;

        do {
            const response = await this.drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'nextPageToken, files(id, name, mimeType)',
                pageSize: 1000,
                pageToken: pageToken
            });

            for (const file of response.data.files) {
                if (file.mimeType === 'application/vnd.google-apps.folder') {
                    // Processar subpasta recursivamente
                    const subPath = folderPath ? `${folderPath}/${file.name}` : file.name;
                    const subPhotos = await this.listAllPhotos(file.id, subPath);
                    photos.push(...subPhotos);
                } else if (file.mimeType && file.mimeType.startsWith('image/')) {
                    // É uma imagem
                    const photoNumber = this.extractPhotoNumber(file.name);
                    if (photoNumber) {
                        photos.push({
                            number: photoNumber,
                            driveId: file.id,
                            fileName: file.name,
                            path: folderPath,
                            category: folderPath.split('/')[0] || 'uncategorized',
                            mimeType: file.mimeType
                        });
                    }
                }
            }

            pageToken = response.data.nextPageToken;
        } while (pageToken);

        return photos;
    }

    // Baixar foto específica
    async downloadPhoto(photo, targetDir) {
        try {
            // Criar estrutura de pastas
            const folderPath = path.join(targetDir, photo.path);
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }

            const filePath = path.join(folderPath, photo.fileName);
            
            // Se já existe, pular
            if (fs.existsSync(filePath)) {
                return { success: true, skipped: true, path: filePath };
            }

            // Baixar arquivo
            const response = await this.drive.files.get(
                { fileId: photo.driveId, alt: 'media' },
                { responseType: 'stream' }
            );

            // Salvar arquivo
            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    resolve({ 
                        success: true, 
                        skipped: false, 
                        path: filePath,
                        localPath: path.join(photo.path, photo.fileName)
                    });
                });
                writer.on('error', (error) => {
                    reject({ success: false, error: error.message });
                });
            });

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Baixar múltiplas fotos em lote
    async downloadBatch(photos, targetDir, batchSize = 10) {
        const results = [];
        
        for (let i = 0; i < photos.length; i += batchSize) {
            const batch = photos.slice(i, i + batchSize);
            console.log(`  📦 Baixando lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(photos.length/batchSize)}`);
            
            const batchResults = await Promise.all(
                batch.map(photo => this.downloadPhoto(photo, targetDir))
            );
            
            results.push(...batchResults);
            
            // Mostrar progresso
            const downloaded = results.filter(r => r.success && !r.skipped).length;
            const skipped = results.filter(r => r.success && r.skipped).length;
            console.log(`     ✓ ${downloaded} baixadas, ${skipped} já existentes`);
        }
        
        return results;
    }

    // Obter estatísticas
    async getStats() {
        const photos = await this.listAllPhotos();
        const byCategory = {};
        
        photos.forEach(photo => {
            if (!byCategory[photo.category]) {
                byCategory[photo.category] = 0;
            }
            byCategory[photo.category]++;
        });
        
        return {
            total: photos.length,
            byCategory
        };
    }
}

module.exports = DriveService;