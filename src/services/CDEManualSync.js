// src/services/CDEManualSync.js
// Sincronização manual e sob demanda com o CDE

const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const Cart = require('../models/Cart');
const CDEWriter = require('./CDEWriter');

class CDEManualSync {
    /**
     * Sincronizar agora - chamado manualmente quando necessário
     * Verifica discrepâncias entre MongoDB e CDE e corrige
     */
    static async syncNow() {
        let connection = null;
        const results = {
            checked: 0,
            updated: 0,
            errors: [],
            removedFromCarts: 0,
            startTime: new Date(),
            endTime: null
        };

        try {
            console.log('[SYNC] Iniciando sincronização manual');

            // Conectar ao CDE
            connection = await mysql.createConnection({
                host: process.env.CDE_HOST,
                port: process.env.CDE_PORT,
                user: process.env.CDE_USER,
                password: process.env.CDE_PASSWORD,
                database: process.env.CDE_DATABASE
            });

            // Buscar todas as fotos do CDE que mudaram recentemente
            const [cdePhotos] = await connection.execute(
                `SELECT ATIPOETIQUETA, AESTADOP, RESERVEDUSU, AFECHA 
                 FROM tbinventario 
                 WHERE ATIPOETIQUETA != '0' 
                 AND ATIPOETIQUETA != ''
                 AND DATE(AFECHA) >= DATE(NOW() - INTERVAL 7 DAY)
                 ORDER BY AFECHA DESC`
            );

            console.log(`[SYNC] Verificando ${cdePhotos.length} fotos do CDE`);

            // Processar cada foto
            for (const cdePhoto of cdePhotos) {
                results.checked++;

                const photoNumber = cdePhoto.ATIPOETIQUETA;
                const cdeStatus = cdePhoto.AESTADOP;

                // Buscar no MongoDB
                const mongoPhoto = await UnifiedProductComplete.findOne({
                    $or: [
                        { photoNumber: photoNumber },
                        { photoNumber: photoNumber.padStart(5, '0') },
                        { fileName: `${photoNumber}.webp` },
                        { fileName: `${photoNumber.padStart(5, '0')}.webp` }
                    ]
                });

                if (!mongoPhoto) {
                    continue; // Foto não existe no MongoDB, pular
                }

                // Determinar o status correto baseado no CDE
                let newMongoStatus = 'available';

                if (cdeStatus === 'RETIRADO') {
                    newMongoStatus = 'sold';
                } else if (cdeStatus === 'RESERVED' || cdeStatus === 'STANDBY') {
                    newMongoStatus = 'unavailable';
                } else if (cdeStatus === 'PRE-SELECTED') {
                    // Verificar se ainda tem reserva válida
                    if (mongoPhoto.reservedBy && new Date(mongoPhoto.reservedBy.expiresAt) > new Date()) {
                        newMongoStatus = 'reserved';
                    } else {
                        // Reserva expirada mas CDE ainda tem PRE-SELECTED - liberar
                        await CDEWriter.markAsAvailable(photoNumber);
                        newMongoStatus = 'available';
                        console.log(`[SYNC] Liberada foto ${photoNumber} com reserva expirada`);
                    }
                } else if (cdeStatus === 'INGRESADO') {
                    newMongoStatus = 'available';
                }

                // Atualizar MongoDB se necessário
                if (mongoPhoto.status !== newMongoStatus || mongoPhoto.cdeStatus !== cdeStatus) {
                    await UnifiedProductComplete.updateOne(
                        { _id: mongoPhoto._id },
                        {
                            $set: {
                                status: newMongoStatus,
                                currentStatus: newMongoStatus,
                                cdeStatus: cdeStatus,
                                lastCDESync: new Date()
                            }
                        }
                    );
                    results.updated++;
                    console.log(`[SYNC] Atualizado: ${photoNumber} - ${cdeStatus} → ${newMongoStatus}`);
                }

                // Se foto foi vendida ou reservada fisicamente, remover de carrinhos
                if (cdeStatus === 'RETIRADO' || cdeStatus === 'RESERVED' || cdeStatus === 'STANDBY') {
                    const cartsWithPhoto = await Cart.find({
                        'items.fileName': `${photoNumber}.webp`,
                        isActive: true
                    });

                    for (const cart of cartsWithPhoto) {
                        await Cart.updateOne(
                            { _id: cart._id },
                            {
                                $pull: { items: { fileName: `${photoNumber}.webp` } },
                                $inc: { totalItems: -1 }
                            }
                        );
                        results.removedFromCarts++;
                        console.log(`[SYNC] Removida foto ${photoNumber} do carrinho ${cart.clientCode}`);
                    }
                }
            }

            results.endTime = new Date();
            results.duration = (results.endTime - results.startTime) / 1000; // segundos

            console.log(`[SYNC] Sincronização concluída em ${results.duration}s`);
            console.log(`[SYNC] ${results.checked} verificadas, ${results.updated} atualizadas`);

            return results;

        } catch (error) {
            console.error('[SYNC] Erro na sincronização:', error);
            results.errors.push(error.message);
            throw error;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * Verificar status de uma foto específica
     */
    static async checkPhotoStatus(photoNumber) {
        try {
            // Verificar no CDE
            const cdeStatus = await CDEWriter.checkStatus(photoNumber);

            // Verificar no MongoDB
            const mongoPhoto = await UnifiedProductComplete.findOne({
                $or: [
                    { photoNumber: photoNumber },
                    { fileName: `${photoNumber}.webp` }
                ]
            });

            // Verificar em carrinhos
            const inCarts = await Cart.find({
                'items.fileName': `${photoNumber}.webp`
            }).select('clientCode clientName');

            return {
                photoNumber,
                cde: cdeStatus,
                mongodb: mongoPhoto ? {
                    status: mongoPhoto.status,
                    cdeStatus: mongoPhoto.cdeStatus,
                    reservedBy: mongoPhoto.reservedBy
                } : null,
                inCarts: inCarts.map(c => ({
                    clientCode: c.clientCode,
                    clientName: c.clientName
                })),
                synced: cdeStatus?.status === mongoPhoto?.cdeStatus
            };

        } catch (error) {
            console.error('[SYNC] Erro ao verificar foto:', error);
            throw error;
        }
    }

    /**
     * Limpar inconsistências conhecidas
     */
    static async cleanInconsistencies() {
        const results = {
            photosFixed: 0,
            cartsFixed: 0,
            errors: []
        };

        try {
            // 1. Buscar fotos com PRE-SELECTED mas sem reservedBy
            const orphanedPreSelected = await UnifiedProductComplete.find({
                cdeStatus: 'PRE-SELECTED',
                reservedBy: { $exists: false }
            });

            for (const photo of orphanedPreSelected) {
                await CDEWriter.markAsAvailable(photo.photoNumber);
                await UnifiedProductComplete.updateOne(
                    { _id: photo._id },
                    {
                        $set: {
                            status: 'available',
                            cdeStatus: 'INGRESADO'
                        }
                    }
                );
                results.photosFixed++;
                console.log(`[CLEAN] Liberada foto órfã ${photo.photoNumber}`);
            }

            // 2. Buscar carrinhos com itens expirados
            const now = new Date();
            const cartsWithExpired = await Cart.find({
                isActive: true,
                'items.expiresAt': { $lt: now }
            });

            for (const cart of cartsWithExpired) {
                const CartService = require('./CartService');
                const expiredItems = cart.items.filter(item =>
                    item.expiresAt && new Date(item.expiresAt) < now
                );

                for (const item of expiredItems) {
                    await CartService.processExpiredItem(item, cart);
                }
                results.cartsFixed++;
            }

            console.log(`[CLEAN] ${results.photosFixed} fotos e ${results.cartsFixed} carrinhos corrigidos`);
            return results;

        } catch (error) {
            console.error('[CLEAN] Erro na limpeza:', error);
            results.errors.push(error.message);
            throw error;
        }
    }
}

module.exports = CDEManualSync;