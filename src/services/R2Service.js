// src/services/R2Service.js
const { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

class R2Service {

    // ===== CONFIGURAÇÃO =====
    static client = null;

    static getClient() {
        if (!this.client) {
            this.client = new S3Client({
                region: 'auto',
                endpoint: process.env.R2_ENDPOINT,
                credentials: {
                    accessKeyId: process.env.R2_ACCESS_KEY_ID,
                    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
                },
                forcePathStyle: true
            });
        }
        return this.client;
    }

    // ===== LISTAGEM =====

    /**
     * Listar "pastas" (prefixos) no R2
     * Compatível com GoogleDriveService.getSubfolders()
     */
    static async getSubfolders(prefix = '') {
        try {
            const client = this.getClient();

            // Garantir que prefix termine com /
            const normalizedPrefix = prefix && !prefix.endsWith('/') ? `${prefix}/` : prefix;

            const command = new ListObjectsV2Command({
                Bucket: process.env.R2_BUCKET_NAME,
                Prefix: normalizedPrefix,
                Delimiter: '/'
            });

            const response = await client.send(command);

            // CommonPrefixes contém as "pastas"
            const folders = (response.CommonPrefixes || []).map(prefix => {
                const folderPath = prefix.Prefix;
                const folderName = folderPath.replace(normalizedPrefix, '').replace('/', '');

                return {
                    id: folderPath,           // Usar path como ID
                    name: folderName,
                    path: folderPath,
                    type: 'folder',
                    hasSubfolders: true       // Assumir que pode ter subpastas
                };
            });

            console.log(`📁 [R2] ${folders.length} pastas encontradas em: ${normalizedPrefix || '/'}`);

            return {
                success: true,
                folders: folders
            };

        } catch (error) {
            console.error('❌ [R2] Erro ao listar pastas:', error);
            throw error;
        }
    }

    /**
     * Listar fotos em uma "pasta"
     * Compatível com GoogleDriveService.getPhotosFromFolder()
     */
    static async getPhotosFromFolder(prefix = '') {
        try {
            const client = this.getClient();

            // Garantir que prefix termine com /
            const normalizedPrefix = prefix && !prefix.endsWith('/') ? `${prefix}/` : prefix;

            const command = new ListObjectsV2Command({
                Bucket: process.env.R2_BUCKET_NAME,
                Prefix: normalizedPrefix,
                Delimiter: '/'
            });

            const response = await client.send(command);

            // Contents contém os arquivos (não pastas)
            const photos = (response.Contents || [])
                .filter(obj => {
                    // Filtrar apenas imagens
                    const key = obj.Key.toLowerCase();
                    return key.endsWith('.jpg') ||
                        key.endsWith('.jpeg') ||
                        key.endsWith('.png') ||
                        key.endsWith('.webp');
                })
                .map(obj => {
                    const fileName = obj.Key.split('/').pop();

                    return {
                        id: obj.Key,              // Usar Key completa como ID
                        name: fileName,
                        fileName: fileName,
                        r2Key: obj.Key,
                        size: obj.Size,
                        lastModified: obj.LastModified,
                        mimeType: this.getMimeType(fileName),

                        // URLs públicas do R2
                        thumbnailUrl: this.getThumbnailUrl(obj.Key),
                        webViewLink: this.getPublicUrl(obj.Key),

                        // Manter compatibilidade
                        driveFileId: obj.Key      // Para compatibilidade temporária
                    };
                });

            console.log(`📸 [R2] ${photos.length} fotos encontradas em: ${normalizedPrefix || '/'}`);

            // ===== ADICIONAR ESTAS 3 LINHAS AQUI =====
            console.log(`🔍 [DEBUG] Buscando em prefix: "${normalizedPrefix}"`);
            console.log(`🔍 [DEBUG] Bucket: ${process.env.R2_BUCKET_NAME}`);
            console.log(`🔍 [DEBUG] Primeiras 3 fotos:`, photos.slice(0, 3).map(p => ({ key: p.r2Key, name: p.name })));
            // ===== FIM DAS LINHAS =====
            
            return {
                success: true,
                photos: photos,
                totalPhotos: photos.length
            };

        } catch (error) {
            console.error('❌ [R2] Erro ao listar fotos:', error);
            throw error;
        }
    }

    // ===== UPLOAD =====

    /**
     * Upload de foto para R2
     */
    static async uploadPhoto(fileBuffer, fileName, folderPath = '') {
        try {
            const client = this.getClient();

            // Construir Key completa
            const key = folderPath ? `${folderPath}/${fileName}` : fileName;

            const command = new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: key,
                Body: fileBuffer,
                ContentType: this.getMimeType(fileName),

                // ===== ADICIONAR CACHE CONTROL =====
                CacheControl: 'public, max-age=31536000, immutable',  // 1 ano de cache

                // Metadata customizada
                Metadata: {
                    uploadDate: new Date().toISOString(),
                    originalName: fileName
                }
            });

            await client.send(command);

            console.log(`✅ [R2] Upload concluído: ${key}`);
            console.log(`📊 [R2] Cache-Control aplicado: 1 ano`);

            return {
                success: true,
                key: key,
                fileName: fileName,
                publicUrl: this.getPublicUrl(key),
                thumbnailUrl: this.getThumbnailUrl(key)
            };

        } catch (error) {
            console.error('❌ [R2] Erro no upload:', error);
            throw error;
        }
    }

    // ===== URLS =====

    /**
     * Gerar URL pública para imagem
     */
    static getPublicUrl(key) {
        // Usar o R2 public URL do .env
        const baseUrl = process.env.R2_PUBLIC_URL ||
            `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.dev`;

        return `${baseUrl}/${key}`;
    }

    /**
     * Gerar URL para thumbnail (por enquanto, mesma URL)
     * TODO: Implementar Cloudflare Worker para resize
     */
    static getThumbnailUrl(key) {
        // Adicionar _thumbnails no início do path
        const baseUrl = process.env.R2_PUBLIC_URL ||
            `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.dev`;

        return `${baseUrl}/_thumbnails/${key}`;
    }

    // ===== UTILITÁRIOS =====

    /**
     * Detectar MIME type pelo nome do arquivo
     */
    static getMimeType(fileName) {
        const ext = fileName.toLowerCase().split('.').pop();
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'webp': 'image/webp',
            'gif': 'image/gif'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * Verificar se objeto existe
     */
    static async objectExists(key) {
        try {
            const client = this.getClient();

            const command = new HeadObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: key
            });

            await client.send(command);
            return true;

        } catch (error) {
            if (error.name === 'NotFound') {
                return false;
            }
            throw error;
        }
    }

    /**
     * Deletar objeto
     */
    static async deleteObject(key) {
        try {
            const client = this.getClient();

            const command = new DeleteObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: key
            });

            await client.send(command);

            console.log(`🗑️ [R2] Objeto deletado: ${key}`);

            return {
                success: true,
                deletedKey: key
            };

        } catch (error) {
            console.error('❌ [R2] Erro ao deletar:', error);
            throw error;
        }
    }
}

module.exports = R2Service;
