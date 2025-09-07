// src/jobs/updatePhotoCounters.js
const PhotoCategory = require('../models/PhotoCategory');
const PhotoStatus = require('../models/PhotoStatus');
const FolderStats = require('../models/FolderStats');

class UpdatePhotoCounters {
    static async updateCounters() {
        const startTime = Date.now();
        console.log('[📊 COUNTERS] Iniciando atualização de contadores...');
        
        try {
            // Buscar todas as categorias ativas
            const categories = await PhotoCategory.find({ 
                isActive: true 
            });
            
            console.log(`[📊 COUNTERS] ${categories.length} categorias para atualizar`);
            
            let updated = 0;
            
            for (const category of categories) {
                // Extrair o path limpo
                const folderName = category.folderName;
                const folderPath = category.googleDrivePath;
                
                // Contar fotos DISPONÍVEIS no PhotoStatus
                const availableCount = await PhotoStatus.countDocuments({
                    'virtualStatus.status': 'available',
                    $or: [
                        { 'currentLocation.currentPath': { $regex: folderName, $options: 'i' } },
                        { 'originalLocation.originalPath': { $regex: folderName, $options: 'i' } }
                    ]
                });
                
                // Contar TOTAL de fotos
                const totalCount = await PhotoStatus.countDocuments({
                    $or: [
                        { 'currentLocation.currentPath': { $regex: folderName, $options: 'i' } },
                        { 'originalLocation.originalPath': { $regex: folderName, $options: 'i' } }
                    ]
                });
                
                // Atualizar ou criar FolderStats
                await FolderStats.findOneAndUpdate(
                    { folderPath: folderPath },
                    {
                        folderPath: folderPath,
                        folderName: folderName,
                        totalPhotos: totalCount,
                        availablePhotos: availableCount,
                        soldPhotos: totalCount - availableCount,
                        lastUpdated: new Date()
                    },
                    { upsert: true, new: true }
                );
                
                // Atualizar também o PhotoCategory
                if (category.photoCount !== availableCount) {
                    category.photoCount = availableCount;
                    await category.save();
                    updated++;
                }
            }
            
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`[📊 COUNTERS] ✅ Atualização completa: ${updated} categorias em ${duration}s`);
            
            return { success: true, updated, duration };
            
        } catch (error) {
            console.error('[📊 COUNTERS] ❌ Erro:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = UpdatePhotoCounters;