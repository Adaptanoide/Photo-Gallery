// src/services/PhotoTagService.js

const mongoose = require('mongoose');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');

class PhotoTagService {

    // ===== CONFIGURAÇÕES =====
    static USE_VIRTUAL_SYSTEM = true;

    /**
     * Reservar fotos usando TAGS (sem mover fisicamente)
     */
    static async reservePhotos(photoIds, selectionId, clientCode) {
        console.log(`🏷️ [TAG SYSTEM] Reservando ${photoIds.length} fotos para ${clientCode}`);

        try {
            const photoResult = await UnifiedProductComplete.updateMany(
                {
                    photoId: { $in: photoIds },
                    status: 'available'
                },
                {
                    $set: {
                        status: 'reserved',
                        selectionId: selectionId,
                        'reservedBy.clientCode': clientCode
                    }
                }
            );

            console.log(`✅ [TAG SYSTEM] ${photoResult.modifiedCount} fotos marcadas como reservadas`);
            console.log(`✅ [TAG SYSTEM] SEM MOVIMENTAÇÃO FÍSICA!`);

            return {
                success: true,
                photosTagged: photoResult.modifiedCount
            };

        } catch (error) {
            console.error('❌ [TAG SYSTEM] Erro ao reservar fotos:', error);
            throw error;
        }
    }

    /**
     * Aprovar seleção (marcar como vendida)
     */
    static async approveSelection(selectionId) {
        console.log(`🏷️ [TAG SYSTEM] Aprovando seleção ${selectionId}`);

        try {
            const photos = await UnifiedProductComplete.find({
                selectionId: selectionId
            });

            const photoIds = photos.map(p => p.photoId);

            const photoResult = await UnifiedProductComplete.updateMany(
                { selectionId: selectionId },
                {
                    $set: {
                        status: 'sold'
                    }
                }
            );

            console.log(`✅ [TAG SYSTEM] ${photoResult.modifiedCount} fotos marcadas como vendidas`);
            console.log(`✅ [TAG SYSTEM] SEM MOVIMENTAÇÃO FÍSICA!`);

            return {
                success: true,
                photosTagged: photoResult.modifiedCount
            };

        } catch (error) {
            console.error('❌ [TAG SYSTEM] Erro ao aprovar seleção:', error);
            throw error;
        }
    }

    /**
     * Cancelar seleção (voltar para disponível)
     */
    static async cancelSelection(selectionId) {
        console.log(`🏷️ [TAG SYSTEM] Cancelando seleção ${selectionId}`);

        try {
            const photos = await UnifiedProductComplete.find({
                selectionId: selectionId
            });

            const photoIds = photos.map(p => p.photoId);

            const photoResult = await UnifiedProductComplete.updateMany(
                { selectionId: selectionId },
                {
                    $set: {
                        status: 'available',
                        selectionId: null,
                        'reservedBy.clientCode': null
                    }
                }
            );

            console.log(`✅ [TAG SYSTEM] ${photoResult.modifiedCount} fotos voltaram para disponível`);
            console.log(`✅ [TAG SYSTEM] SEM REVERSÃO FÍSICA!`);

            return {
                success: true,
                photosTagged: photoResult.modifiedCount
            };

        } catch (error) {
            console.error('❌ [TAG SYSTEM] Erro ao cancelar seleção:', error);
            throw error;
        }
    }

    /**
     * Migrar dados existentes para sistema de tags
     * NOTA: Este método não é mais necessário pois removemos virtualStatus
     */
    static async migrateExistingData() {
        console.log('🔄 Migração não necessária - sistema simplificado');
        
        return {
            success: true,
            total: 0,
            migrated: 0,
            message: 'Sistema simplificado não requer migração'
        };
    }
}

module.exports = PhotoTagService;