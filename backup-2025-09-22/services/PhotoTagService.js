// src/services/PhotoTagService.js

const mongoose = require('mongoose');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
class PhotoTagService {

    // ===== CONFIGURAÇÕES =====
    static USE_VIRTUAL_SYSTEM = true; // Começa DESLIGADO para não quebrar nada

    // Métodos virão aqui...
    // ===== MÉTODOS PRINCIPAIS =====

    /**
     * Reservar fotos usando TAGS (sem mover fisicamente)
     */
    static async reservePhotos(photoIds, selectionId, clientCode) {
        console.log(`🏷️ [TAG SYSTEM] Reservando ${photoIds.length} fotos para ${clientCode}`);

        try {
            // 1. Atualizar PhotoStatus com tags
            const photoResult = await UnifiedProductComplete.updateMany(
                {
                    photoId: { $in: photoIds },
                    'virtualStatus.status': 'available'
                },
                {
                    $set: {
                        'virtualStatus.status': 'reserved',
                        'virtualStatus.currentSelection': selectionId,
                        'virtualStatus.clientCode': clientCode,
                        'virtualStatus.lastStatusChange': new Date()
                    },
                    $addToSet: {
                        'virtualStatus.tags': [
                            `client_${clientCode}`,
                            `selection_${selectionId}`,
                            'reserved'
                        ]
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
            // 1. Buscar fotos da seleção
            const photos = await UnifiedProductComplete.find({
                'virtualStatus.currentSelection': selectionId
            });

            const photoIds = photos.map(p => p.photoId);

            // 2. Marcar como vendidas
            const photoResult = await UnifiedProductComplete.updateMany(
                { 'virtualStatus.currentSelection': selectionId },
                {
                    $set: {
                        'virtualStatus.status': 'sold',
                        'virtualStatus.lastStatusChange': new Date()
                    },
                    $addToSet: {
                        'virtualStatus.tags': ['sold', `sold_${new Date().toISOString().split('T')[0]}`]
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
            // 1. Buscar fotos da seleção
            const photos = await UnifiedProductComplete.find({
                'virtualStatus.currentSelection': selectionId
            });

            const photoIds = photos.map(p => p.photoId);

            // 2. Voltar para disponível
            const photoResult = await UnifiedProductComplete.updateMany(
                { 'virtualStatus.currentSelection': selectionId },
                {
                    $set: {
                        'virtualStatus.status': 'available',
                        'virtualStatus.currentSelection': null,
                        'virtualStatus.clientCode': null,
                        'virtualStatus.lastStatusChange': new Date()
                    },
                    $pull: {
                        'virtualStatus.tags': {
                            $in: [
                                `selection_${selectionId}`,
                                'reserved',
                                /^client_/
                            ]
                        }
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

    // ===== MIGRAÇÃO =====

    /**
     * Migrar dados existentes para sistema de tags
     */
    static async migrateExistingData() {
        console.log('🔄 Iniciando migração para sistema de tags...');

        try {
            // 1. Buscar todos os PhotoStatus
            const allPhotos = await UnifiedProductComplete.find({});
            console.log(`📊 ${allPhotos.length} fotos para verificar`);

            let migrated = 0;

            for (const photo of allPhotos) {
                // Pular se já tem virtualStatus configurado
                if (photo.virtualStatus && photo.virtualStatus.status) {
                    continue;
                }

                // Determinar status virtual baseado no status atual
                let virtualStatus = 'available';
                let tags = [];

                if (photo.currentStatus === 'sold') {
                    virtualStatus = 'sold';
                    tags.push('sold');
                } else if (photo.currentStatus === 'reserved' || photo.isReserved()) {
                    virtualStatus = 'reserved';
                    tags.push('reserved');
                }

                // Atualizar apenas virtualStatus
                photo.virtualStatus = {
                    status: virtualStatus,
                    currentSelection: null,
                    clientCode: null,
                    tags: tags,
                    lastStatusChange: new Date()
                };

                await photo.save();
                migrated++;

                if (migrated % 10 === 0) {
                    console.log(`📦 ${migrated} fotos migradas...`);
                }
            }

            console.log(`✅ Migração concluída: ${migrated} fotos atualizadas`);

            return {
                success: true,
                total: allPhotos.length,
                migrated: migrated
            };

        } catch (error) {
            console.error('❌ Erro na migração:', error);
            throw error;
        }
    }

}

module.exports = PhotoTagService;