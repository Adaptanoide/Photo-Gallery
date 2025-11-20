// src/services/StorageService.js
// VERSÃO 100% R2 - SEM GOOGLE DRIVE!

const R2Service = require('./R2Service');

class StorageService {

    /**
     * SEMPRE usar R2
     */
    static getService() {
        return R2Service;
    }

    /**
     * Listar pastas
     */
    static async getSubfolders(prefix) {
        return await R2Service.getSubfolders(prefix);
    }

    /**
     * Listar fotos
     */
    static async getPhotos(prefix) {
        return await R2Service.getPhotosFromFolder(prefix);
    }

    /**
     * Gerar URL da imagem
     */
    static getImageUrl(photoKey, type = 'full') {
        if (type === 'thumb') {
            return R2Service.getThumbnailUrl(photoKey);
        } else {
            return R2Service.getPublicUrl(photoKey);
        }
    }

    /**
     * Upload de arquivo
     */
    static async uploadFile(buffer, fileName, folder = '') {
        return await R2Service.uploadPhoto(buffer, fileName, folder);
    }

    /**
     * Verificar modo (sempre R2 agora)
     */
    static getCurrentMode() {
        return 'r2';
    }

    /**
     * Sempre true agora
     */
    static isUsingR2() {
        return true;
    }

    /**
     * Deletar arquivo
     */
    static async deleteFile(key) {
        return await R2Service.deleteObject(key);
    }

    /**
     * Verificar se existe
     */
    static async fileExists(key) {
        return await R2Service.objectExists(key);
    }

    // src/services/StorageService.js - ADICIONAR este método

    /**
     * Criar nova pasta com .keep automático
     * @param {string} folderPath - Caminho da pasta sem / final
     * @returns {boolean} Sucesso
     */
    static async createFolderWithKeep(folderPath) {
        try {
            const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
            const client = R2Service.getClient();

            // Garantir que não tem / no final
            const cleanPath = folderPath.replace(/\/$/, '');

            // Criar arquivo .keep
            const keepKey = `${cleanPath}/.keep`;

            const command = new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: keepKey,
                Body: 'Folder structure keeper - Created automatically',
                ContentType: 'text/plain',
                Metadata: {
                    'purpose': 'folder-structure',
                    'created': new Date().toISOString(),
                    'auto-created': 'true'
                }
            });

            await client.send(command);
            console.log(`✅ Pasta criada com .keep: ${cleanPath}/`);

            return true;
        } catch (error) {
            console.error('❌ Erro ao criar pasta com .keep:', error);
            throw error;
        }
    }

    /**
     * Verificar se pasta existe (tem .keep ou arquivos)
     * @param {string} folderPath 
     * @returns {boolean}
     */
    static async folderExists(folderPath) {
        try {
            const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
            const client = R2Service.getClient();

            const cleanPath = folderPath.replace(/\/$/, '');

            const command = new ListObjectsV2Command({
                Bucket: process.env.R2_BUCKET_NAME,
                Prefix: `${cleanPath}/`,
                MaxKeys: 1
            });

            const response = await client.send(command);
            return response.Contents && response.Contents.length > 0;

        } catch (error) {
            console.error('❌ Erro ao verificar pasta:', error);
            return false;
        }
    }

    /**
     * Upload de foto garantindo .keep na pasta
     * @param {string} folderPath 
     * @param {string} fileName 
     * @param {Buffer} fileBuffer 
     * @param {string} contentType 
     */
    static async uploadPhotoWithKeep(folderPath, fileName, fileBuffer, contentType) {
        try {
            const cleanPath = folderPath.replace(/\/$/, '');

            // Verificar se pasta existe
            const exists = await this.folderExists(cleanPath);

            // Se não existe, criar com .keep
            if (!exists) {
                await this.createFolderWithKeep(cleanPath);
            }

            // Upload da foto
            const photoKey = `${cleanPath}/${fileName}`;
            const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
            const client = R2Service.getClient();

            const command = new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: photoKey,
                Body: fileBuffer,
                ContentType: contentType
            });

            await client.send(command);
            console.log(`✅ Foto uploaded: ${photoKey}`);

            return photoKey;

        } catch (error) {
            console.error('❌ Erro no upload:', error);
            throw error;
        }
    }

}

module.exports = StorageService;