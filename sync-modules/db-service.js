/**
 * Database Service
 * Gerencia todas as operações com MongoDB
 */

const mongoose = require('mongoose');

// Schema simplificado do PhotoStatus
const photoStatusSchema = new mongoose.Schema({
    photoId: { type: String, required: true, unique: true },
    fileName: String,
    r2Key: String,
    virtualStatus: {
        status: { type: String, enum: ['available', 'sold', 'reserved'], default: 'available' },
        tags: [String],
        lastStatusChange: { type: Date, default: Date.now }
    },
    currentStatus: String,
    currentLocation: {
        locationType: String,
        currentPath: String,
        currentParentId: String,
        currentCategory: String
    },
    originalLocation: {
        originalPath: String,
        originalParentId: String,
        originalCategory: String
    }
}, { timestamps: true });

class DatabaseService {
    constructor() {
        this.PhotoStatus = null;
        this.connected = false;
    }

    // Conectar ao MongoDB
    async connect() {
        try {
            await mongoose.connect(process.env.MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            
            // Registrar modelo
            this.PhotoStatus = mongoose.model('PhotoStatus', photoStatusSchema);
            this.connected = true;
        } catch (error) {
            console.error('Erro ao conectar MongoDB:', error.message);
            throw error;
        }
    }

    // Desconectar
    async disconnect() {
        if (this.connected) {
            await mongoose.disconnect();
            this.connected = false;
        }
    }

    // Buscar todas as fotos
    async getAllPhotos() {
        return await this.PhotoStatus.find({});
    }

    // Buscar fotos por status
    async getPhotosByStatus(status) {
        return await this.PhotoStatus.find({ 'virtualStatus.status': status });
    }

    // Buscar foto por número
    async getPhotoByNumber(photoNumber) {
        return await this.PhotoStatus.findOne({ photoId: photoNumber });
    }

    // Criar novo registro de foto
    async createPhotoStatus(photoData) {
        try {
            const photoStatus = new this.PhotoStatus({
                photoId: photoData.number,
                fileName: photoData.fileName.replace(/\.(jpg|jpeg|png)$/i, '.webp'),
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
            return { success: true, photo: photoStatus };
        } catch (error) {
            if (error.code === 11000) {
                // Duplicate key - já existe
                return { success: false, error: 'Photo already exists' };
            }
            return { success: false, error: error.message };
        }
    }

    // Marcar foto como vendida
    async markPhotoAsSold(photoNumber) {
        try {
            const photo = await this.PhotoStatus.findOne({ photoId: photoNumber });
            
            if (!photo) {
                // Se não existe, criar como vendida
                return await this.createPhotoStatus({
                    number: photoNumber,
                    fileName: `${photoNumber}.webp`,
                    r2Key: `unknown/${photoNumber}.webp`,
                    category: 'unknown',
                    status: 'sold'
                });
            }
            
            // Atualizar status
            photo.virtualStatus = {
                status: 'sold',
                tags: ['sold', `sold_${new Date().toISOString().split('T')[0]}`],
                lastStatusChange: new Date()
            };
            photo.currentStatus = 'sold';
            
            await photo.save();
            return { success: true, photo };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Marcar foto como disponível
    async markPhotoAsAvailable(photoNumber) {
        try {
            const photo = await this.PhotoStatus.findOne({ photoId: photoNumber });
            
            if (!photo) {
                return { success: false, error: 'Photo not found' };
            }
            
            photo.virtualStatus = {
                status: 'available',
                tags: ['available', `restored_${new Date().toISOString().split('T')[0]}`],
                lastStatusChange: new Date()
            };
            photo.currentStatus = 'available';
            
            await photo.save();
            return { success: true, photo };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Criar/Atualizar múltiplas fotos
    async upsertPhotoBatch(photos) {
        const results = [];
        
        for (const photo of photos) {
            try {
                const existing = await this.PhotoStatus.findOne({ photoId: photo.number });
                
                if (existing) {
                    // Atualizar existente
                    existing.r2Key = photo.r2Key;
                    existing.fileName = photo.fileName;
                    existing.currentLocation.currentCategory = photo.category;
                    existing.originalLocation.originalCategory = photo.category;
                    await existing.save();
                    results.push({ success: true, action: 'updated', photo: photo.number });
                } else {
                    // Criar novo
                    const result = await this.createPhotoStatus(photo);
                    if (result.success) {
                        results.push({ success: true, action: 'created', photo: photo.number });
                    } else {
                        results.push({ success: false, photo: photo.number, error: result.error });
                    }
                }
            } catch (error) {
                results.push({ success: false, photo: photo.number, error: error.message });
            }
        }
        
        return results;
    }

    // Obter estatísticas
    async getStats() {
        const total = await this.PhotoStatus.countDocuments();
        const available = await this.PhotoStatus.countDocuments({ 'virtualStatus.status': 'available' });
        const sold = await this.PhotoStatus.countDocuments({ 'virtualStatus.status': 'sold' });
        const reserved = await this.PhotoStatus.countDocuments({ 'virtualStatus.status': 'reserved' });
        
        return {
            total,
            available,
            sold,
            reserved,
            percentAvailable: total > 0 ? ((available / total) * 100).toFixed(1) : 0,
            percentSold: total > 0 ? ((sold / total) * 100).toFixed(1) : 0
        };
    }

    // Limpar registros órfãos (sem foto no R2)
    async cleanOrphanedRecords(validPhotoNumbers) {
        const validSet = new Set(validPhotoNumbers);
        const allPhotos = await this.PhotoStatus.find({});
        const toDelete = [];
        
        for (const photo of allPhotos) {
            if (!validSet.has(photo.photoId)) {
                toDelete.push(photo.photoId);
            }
        }
        
        if (toDelete.length > 0) {
            await this.PhotoStatus.deleteMany({ photoId: { $in: toDelete } });
        }
        
        return toDelete;
    }
}

module.exports = DatabaseService;