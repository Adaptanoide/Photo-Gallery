// src/services/PhotoExpirationService.js
// Serviço automático para processar fotos expiradas SEM depender de acesso do cliente

const mongoose = require('mongoose');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const Cart = require('../models/Cart');
const CDEWriter = require('./CDEWriter');

class PhotoExpirationService {
    constructor() {
        this.isRunning = false;
        this.lastRun = null;
        this.stats = {
            totalProcessed: 0,
            photosFreed: 0,
            errors: 0,
            lastResults: []
        };
    }

    /**
     * Processar todas as fotos expiradas no sistema
     * Independente de acesso dos clientes
     */
    async processExpiredPhotos() {
        if (this.isRunning) {
            console.log('[EXPIRATION] Já está rodando, pulando...');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();
        const now = new Date();
        
        console.log('\n' + '='.repeat(60));
        console.log('[EXPIRATION] PROCESSANDO FOTOS EXPIRADAS');
        console.log(`[EXPIRATION] Timestamp: ${now.toISOString()}`);
        console.log('='.repeat(60));

        try {
            // 1. Buscar fotos com reservedBy.expiresAt no passado
            const expiredPhotos = await UnifiedProductComplete.find({
                'reservedBy.expiresAt': { $lt: now },
                'reservedBy.clientCode': { $exists: true }
            }).limit(50); // Processar 50 por vez

            console.log(`[EXPIRATION] ${expiredPhotos.length} fotos expiradas encontradas`);

            if (expiredPhotos.length === 0) {
                console.log('[EXPIRATION] Nenhuma foto expirada. Sistema limpo.');
                console.log('='.repeat(60) + '\n');
                this.isRunning = false;
                return;
            }

            const results = [];
            let freed = 0;
            let errors = 0;

            // 2. Processar cada foto
            for (const photo of expiredPhotos) {
                try {
                    // Proteção: NUNCA mexer em fotos com selectionId
                    if (photo.selectionId) {
                        console.log(`[EXPIRATION] Pulando ${photo.photoNumber} - tem selectionId`);
                        continue;
                    }

                    const photoNumber = photo.photoNumber;
                    const clientCode = photo.reservedBy?.clientCode;

                    console.log(`[EXPIRATION] Processando ${photoNumber} (cliente ${clientCode})`);

                    // 2.1 Atualizar CDE
                    if (photoNumber) {
                        await CDEWriter.markAsAvailable(photoNumber);
                        console.log(`[EXPIRATION] CDE atualizado: ${photoNumber}`);
                    }

                    // 2.2 Atualizar MongoDB
                    photo.status = 'available';
                    photo.cdeStatus = 'INGRESADO';
                    photo.reservedBy = undefined; // Remove campo
                    await photo.save();

                    console.log(`[EXPIRATION] MongoDB atualizado: ${photoNumber}`);

                    // 2.3 Remover do carrinho se ainda estiver lá
                    const cartUpdate = await Cart.updateMany(
                        {
                            'items.fileName': photo.fileName,
                            isActive: true
                        },
                        {
                            $pull: { items: { fileName: photo.fileName } }
                        }
                    );

                    if (cartUpdate.modifiedCount > 0) {
                        console.log(`[EXPIRATION] Removido de ${cartUpdate.modifiedCount} carrinho(s)`);
                        
                        // Atualizar totalItems dos carrinhos afetados
                        await Cart.updateMany(
                            { isActive: true },
                            [{ $set: { totalItems: { $size: "$items" } } }]
                        );
                    }

                    freed++;
                    results.push({
                        photoNumber,
                        clientCode,
                        success: true
                    });

                } catch (error) {
                    errors++;
                    console.error(`[EXPIRATION] Erro ao processar ${photo.photoNumber}:`, error.message);
                    results.push({
                        photoNumber: photo.photoNumber,
                        success: false,
                        error: error.message
                    });
                }
            }

            // 3. Estatísticas
            this.stats.totalProcessed += expiredPhotos.length;
            this.stats.photosFreed += freed;
            this.stats.errors += errors;
            this.stats.lastResults = results;
            this.lastRun = new Date();

            const duration = Date.now() - startTime;

            console.log('\n' + '='.repeat(60));
            console.log('[EXPIRATION] RESULTADO');
            console.log('='.repeat(60));
            console.log(`Total processado: ${expiredPhotos.length}`);
            console.log(`Fotos liberadas: ${freed}`);
            console.log(`Erros: ${errors}`);
            console.log(`Duração: ${duration}ms`);
            console.log('='.repeat(60) + '\n');

        } catch (error) {
            console.error('[EXPIRATION] ERRO CRÍTICO:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Obter estatísticas
     */
    getStats() {
        return {
            ...this.stats,
            lastRun: this.lastRun,
            isRunning: this.isRunning
        };
    }
}

module.exports = new PhotoExpirationService();