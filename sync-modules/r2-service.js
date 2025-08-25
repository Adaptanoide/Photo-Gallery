/**
 * R2 Service
 * Gerencia todas as operações com Cloudflare R2
 */

const { S3Client, ListObjectsV2Command, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

class R2Service {
    constructor() {
        this.client = null;
        this.bucketName = process.env.R2_BUCKET_NAME;
    }

    // Inicializar conexão
    async init() {
        this.client = new S3Client({
            region: 'auto',
            endpoint: process.env.R2_ENDPOINT,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            }
        });
    }

    // Extrair número da foto
    extractPhotoNumber(filename) {
        const match = filename.match(/(\d{4,6})/);
        return match ? match[1] : null;
    }

    // Listar todas as fotos (excluindo thumbnails, preview, display)
    async listAllPhotos() {
        const photos = [];
        let continuationToken = null;

        do {
            const command = new ListObjectsV2Command({
                Bucket: this.bucketName,
                MaxKeys: 1000,
                ContinuationToken: continuationToken
            });

            const response = await this.client.send(command);

            if (response.Contents) {
                for (const obj of response.Contents) {
                    // Ignorar versões alternativas
                    if (!obj.Key.startsWith('_thumbnails/') && 
                        !obj.Key.startsWith('_preview/') && 
                        !obj.Key.startsWith('_display/')) {
                        
                        const photoNumber = this.extractPhotoNumber(obj.Key);
                        if (photoNumber) {
                            photos.push({
                                number: photoNumber,
                                key: obj.Key,
                                fileName: path.basename(obj.Key),
                                path: path.dirname(obj.Key),
                                category: obj.Key.split('/')[0] || 'uncategorized',
                                size: obj.Size,
                                lastModified: obj.LastModified
                            });
                        }
                    }
                }
            }

            continuationToken = response.NextContinuationToken;
        } while (continuationToken);

        return photos;
    }

    // Verificar se arquivo existe
    async exists(key) {
        try {
            await this.client.send(new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: key
            }));
            return true;
        } catch {
            return false;
        }
    }

    // Upload de arquivo único
    async uploadFile(filePath, r2Key, contentType = 'image/webp') {
        try {
            // Verificar se já existe
            if (await this.exists(r2Key)) {
                return { success: true, skipped: true, key: r2Key };
            }

            // Ler arquivo
            const fileBuffer = await fs.promises.readFile(filePath);

            // Upload
            await this.client.send(new PutObjectCommand({
                Bucket: this.bucketName,
                Key: r2Key,
                Body: fileBuffer,
                ContentType: contentType,
                CacheControl: 'public, max-age=31536000, immutable'
            }));

            return { success: true, skipped: false, key: r2Key };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Upload das 4 versões de uma foto
    async uploadPhotoVersions(basePath, photoPath, photoName) {
        const results = [];
        const baseNameWebP = photoName.replace(/\.(jpg|jpeg|png)$/i, '.webp');
        
        // Estrutura das 4 versões
        const versions = [
            { 
                localPath: path.join(basePath, photoPath, baseNameWebP),
                r2Key: path.join(photoPath, baseNameWebP).replace(/\\/g, '/'),
                type: 'original'
            },
            { 
                localPath: path.join(basePath, '_display', photoPath, baseNameWebP),
                r2Key: path.join('_display', photoPath, baseNameWebP).replace(/\\/g, '/'),
                type: 'display'
            },
            { 
                localPath: path.join(basePath, '_preview', photoPath, baseNameWebP),
                r2Key: path.join('_preview', photoPath, baseNameWebP).replace(/\\/g, '/'),
                type: 'preview'
            },
            { 
                localPath: path.join(basePath, '_thumbnails', photoPath, baseNameWebP),
                r2Key: path.join('_thumbnails', photoPath, baseNameWebP).replace(/\\/g, '/'),
                type: 'thumbnail'
            }
        ];

        // Upload cada versão
        for (const version of versions) {
            if (fs.existsSync(version.localPath)) {
                const result = await this.uploadFile(version.localPath, version.r2Key);
                results.push({
                    ...result,
                    type: version.type,
                    key: version.r2Key
                });
            } else {
                results.push({
                    success: false,
                    type: version.type,
                    error: `Arquivo não encontrado: ${version.localPath}`
                });
            }
        }

        return results;
    }

    // Upload em lote
    async uploadBatch(photos, basePath, batchSize = 5) {
        const results = [];
        
        for (let i = 0; i < photos.length; i += batchSize) {
            const batch = photos.slice(i, i + batchSize);
            console.log(`  📦 Enviando lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(photos.length/batchSize)}`);
            
            for (const photo of batch) {
                const photoResults = await this.uploadPhotoVersions(
                    basePath,
                    photo.path,
                    photo.fileName
                );
                
                results.push({
                    photo: photo.number,
                    versions: photoResults
                });
            }
            
            // Mostrar progresso
            const successful = results.filter(r => 
                r.versions.every(v => v.success)
            ).length;
            console.log(`     ✓ ${successful}/${results.length} fotos completas (4 versões cada)`);
        }
        
        return results;
    }

    // Obter estatísticas
    async getStats() {
        const photos = await this.listAllPhotos();
        const byCategory = {};
        let totalSize = 0;
        
        photos.forEach(photo => {
            if (!byCategory[photo.category]) {
                byCategory[photo.category] = { count: 0, size: 0 };
            }
            byCategory[photo.category].count++;
            byCategory[photo.category].size += photo.size;
            totalSize += photo.size;
        });
        
        return {
            total: photos.length,
            totalSize: (totalSize / 1024 / 1024 / 1024).toFixed(2) + ' GB',
            byCategory
        };
    }
}

module.exports = R2Service;