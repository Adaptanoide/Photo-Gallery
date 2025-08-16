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
}

module.exports = StorageService;