/**
 * Database Service
 * Usa o modelo PhotoStatus real do sistema
 */

const mongoose = require('mongoose');
const PhotoStatus = require('../src/models/PhotoStatus');

class DatabaseService {
    constructor() {
        this.connected = false;
    }

    async connect() {
        try {
            await mongoose.connect(process.env.MONGODB_URI);
            this.connected = true;
            console.log('✅ MongoDB conectado para sync');
        } catch (error) {
            console.error('Erro ao conectar MongoDB:', error.message);
            throw error;
        }
    }

    async disconnect() {
        if (this.connected) {
            await mongoose.disconnect();
            this.connected = false;
        }
    }

    async getAllPhotos() {
        return await PhotoStatus.find({});
    }

    async getPhotosByStatus(status) {
        return await PhotoStatus.find({ 'virtualStatus.status': status });
    }

    async getPhotoByNumber(photoNumber) {
        return await PhotoStatus.findOne({
            $or: [
                { photoNumber: photoNumber },
                { photoId: photoNumber }
            ]
        });
    }

    async createPhotoStatus(photoData) {
        try {
            // Extrair apenas o número
            let photoNumber = photoData.number;
            if (photoNumber.includes('/')) {
                photoNumber = photoNumber.split('/').pop().replace('.webp', '');
            }

            const photoStatus = new PhotoStatus({
                photoId: photoData.number,
                photoNumber: photoNumber,  // CAMPO NORMALIZADO
                fileName: photoData.fileName.replace(/\.(jpg|jpeg|png)$/i, '.webp'),
                r2Key: photoData.r2Key,
                virtualStatus: {
                    status: 'available',
                    tags: ['available', `added_${new Date().toISOString().split('T')[0]}`],
                    lastStatusChange: new Date()
                },
                currentStatus: 'available',
                currentLocation: {
                    locationType: 'stock',
                    currentPath: photoData.r2Key,
                    currentParentId: 'r2',
                    currentCategory: photoData.category || 'uncategorized'
                },
                originalLocation: {
                    originalPath: photoData.r2Key,
                    originalParentId: 'r2',
                    originalCategory: photoData.category || 'uncategorized'
                }
            });

            await photoStatus.save();
            console.log(`✅ Foto ${photoNumber} adicionada ao MongoDB`);
            return photoStatus;
        } catch (error) {
            console.error(`Erro ao criar registro para ${photoData.number}:`, error.message);
            throw error;
        }
    }

    async updatePhotoStatus(photoId, updates) {
        return await PhotoStatus.findOneAndUpdate(
            { $or: [{ photoNumber: photoId }, { photoId: photoId }] },
            updates,
            { new: true }
        );
    }

    async markAsSold(photoId) {
        return await this.updatePhotoStatus(photoId, {
            'virtualStatus.status': 'sold',
            currentStatus: 'sold',
            'virtualStatus.lastStatusChange': new Date()
        });
    }

    async upsertPhotoBatch(photos) {
        const results = [];
        for (const photo of photos) {
            try {
                // Extrair número puro
                let photoNumber = photo.number;
                if (photoNumber.includes('/')) {
                    photoNumber = photoNumber.split('/').pop().replace('.webp', '');
                }

                // Verificar se já existe
                const existing = await PhotoStatus.findOne({
                    $or: [
                        { photoNumber: photoNumber },
                        { photoId: photo.number }
                    ]
                });

                if (existing) {
                    // Atualizar existente
                    existing.r2Key = photo.r2Key;
                    existing.updatedAt = new Date();
                    await existing.save();
                    results.push({ number: photo.number, status: 'updated' });
                } else {
                    // Criar novo
                    await this.createPhotoStatus(photo);
                    results.push({ number: photo.number, status: 'created' });
                }
            } catch (error) {
                console.error(`Erro ao processar ${photo.number}:`, error.message);
                results.push({ number: photo.number, status: 'error', error: error.message });
            }
        }
        return results;
    }
}

module.exports = DatabaseService;