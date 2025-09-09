// src/services/CDESync.js
// Serviço de sincronização com CDE

const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
const PhotoStatus = require('../models/PhotoStatus');
const CDEBlockedPhoto = require('../models/CDEBlockedPhoto');
const Product = require('../models/Product');

class CDESync {
    constructor() {
        this.cdeConfig = {
            host: process.env.CDE_HOST,
            port: parseInt(process.env.CDE_PORT),
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        };
        this.lastSync = new Date();
        this.lastBlockedCheck = new Date();
    }

    async syncAllStates() {
        let mysqlConnection;

        // Verificar conexão MongoDB
        if (!mongoose.connection || !mongoose.connection.db) {
            console.log('[CDE Sync] MongoDB não conectado, pulando sincronização');
            return { success: false, error: 'MongoDB não conectado' };
        }
        const db = mongoose.connection.db;
        const collection = db.collection('photostatuses');

        try {
            mysqlConnection = await mysql.createConnection(this.cdeConfig);

            // Buscar RETIRADOS desde a última sincronização
            const [produtos] = await mysqlConnection.execute(
                `SELECT AIDH, AESTADOP, AFECHA, ATIPOETIQUETA
                FROM tbinventario 
                WHERE ATIPOETIQUETA != '0' 
                AND ATIPOETIQUETA != ''
                AND DATE(AFECHA) >= DATE(NOW() - INTERVAL 7 DAY)
                ORDER BY AFECHA DESC`
            );

            // Verificar também fotos bloqueadas conhecidas
            const blockedResults = await this.checkBlockedPhotos(mysqlConnection);

            // Combinar resultados
            const todosProdu7tos = [...produtos, ...blockedResults];

            console.log(`[CDE Sync] Encontrados ${produtos.length} mudanças recentes + ${blockedResults.length} bloqueadas verificadas`);

            let updatedCount = 0;

            for (const item of todosProdu7tos) {
                // Usar ATIPOETIQUETA como número da foto
                let photoNumber = item.ATIPOETIQUETA;

                // Pular se não tem foto
                if (!photoNumber || photoNumber === '0') {
                    continue;
                }

                // Determinar o novo status baseado no AESTADOP do CDE
                let newStatus = 'available';
                let newCdeStatus = item.AESTADOP;

                if (item.AESTADOP === 'RETIRADO') {
                    newStatus = 'sold';
                } else if (item.AESTADOP === 'RESERVED' || item.AESTADOP === 'STANDBY' || item.AESTADOP === 'PRE-SELECTED') {
                    newStatus = 'unavailable';
                } else if (item.AESTADOP === 'INGRESADO') {
                    newStatus = 'available';
                }

                // Gerenciar lista de bloqueados
                if (item.AESTADOP === 'RESERVED' || item.AESTADOP === 'STANDBY' || item.AESTADOP === 'PRE-SELECTED') {
                    // Adicionar à lista se não existe
                    await CDEBlockedPhoto.findOneAndUpdate(
                        { photoNumber: photoNumber },
                        {
                            photoNumber: photoNumber,
                            idhCode: item.AIDH,
                            cdeStatus: item.AESTADOP,
                            lastChecked: new Date()
                        },
                        { upsert: true }
                    );
                } else if (item.AESTADOP === 'INGRESADO' || item.AESTADOP === 'RETIRADO') {
                    // Remover da lista se voltou para INGRESADO ou foi RETIRADO (vendido)
                    await CDEBlockedPhoto.deleteOne({ photoNumber: photoNumber });
                }

                // Tentar com diferentes formatos (com e sem zeros)
                const photoId = photoNumber.padStart(5, '0');
                const photoIdNoZeros = photoNumber.replace(/^0+/, '') || '0';

                // Buscar foto atual para verificar se precisa atualizar
                const existingPhoto = await PhotoStatus.findOne({
                    $or: [
                        { photoId: photoId },
                        { photoId: photoIdNoZeros },
                        { photoId: photoNumber },
                        { fileName: `${photoId}.webp` },
                        { fileName: `${photoIdNoZeros}.webp` }
                    ]
                });

                // Se já está sincronizado com o mesmo status, pular
                if (existingPhoto &&
                    existingPhoto.cdeStatus === newCdeStatus &&
                    existingPhoto.currentStatus === newStatus) {
                    continue; // Pula para próxima foto sem fazer update
                }

                // Se não existe no MongoDB, também pular
                if (!existingPhoto) {
                    continue;
                }

                // Atualizar no MongoDB
                const result = await PhotoStatus.updateOne(
                    {
                        $or: [
                            { photoId: photoId },
                            { photoId: photoIdNoZeros },
                            { photoId: photoNumber },
                            { fileName: `${photoId}.webp` },        // com zeros
                            { fileName: `${photoIdNoZeros}.webp` }  // sem zeros
                        ]
                    },
                    {
                        $set: {
                            currentStatus: newStatus,
                            'virtualStatus.status': newStatus,
                            'virtualStatus.lastStatusChange': new Date(),
                            cdeStatus: newCdeStatus,
                            idhCode: item.AIDH,
                            photoNumber: photoNumber,
                            lastCDESync: new Date(),
                            syncedFromCDE: true
                        }
                    }
                );

                if (result.modifiedCount > 0) {
                    updatedCount++;
                    console.log(`[CDE Sync] Foto ${photoNumber} atualizada: ${newCdeStatus} → ${newStatus}`);

                    // NOVO: Também atualizar Product se existir
                    const productResult = await Product.updateOne(
                        { fileName: `${photoNumber.padStart(5, '0')}.webp` },
                        { status: newStatus }
                    );

                    if (productResult.modifiedCount > 0) {
                        console.log(`[CDE Sync] Product ${photoNumber} também atualizado`);
                    }
                }
            }

            this.lastSync = new Date();
            console.log(`[CDE Sync] Sincronização completa: ${updatedCount} fotos atualizadas`);

            return { success: true, updated: updatedCount };

        } catch (error) {
            console.error('[CDE Sync] Erro:', error.message);
            return { success: false, error: error.message };
        } finally {
            if (mysqlConnection) await mysqlConnection.end();
        }
    }

    async checkBlockedPhotos(mysqlConnection) {
        try {
            // Buscar todos os produtos bloqueados conhecidos
            const blockedPhotos = await CDEBlockedPhoto.find({});

            if (blockedPhotos.length === 0) {
                return [];
            }

            const photoNumbers = blockedPhotos.map(p => p.photoNumber);
            console.log(`[CDE Sync] Verificando ${photoNumbers.length} fotos bloqueadas conhecidas`);

            // Query apenas essas fotos específicas
            const placeholders = photoNumbers.map(() => '?').join(',');
            const [produtos] = await mysqlConnection.execute(
                `SELECT AIDH, AESTADOP, AFECHA, ATIPOETIQUETA
                 FROM tbinventario 
                 WHERE ATIPOETIQUETA IN (${placeholders})`,
                photoNumbers
            );

            // Atualizar lastChecked
            await CDEBlockedPhoto.updateMany(
                { photoNumber: { $in: photoNumbers } },
                { $set: { lastChecked: new Date(), $inc: { checkCount: 1 } } }
            );

            return produtos;
        } catch (error) {
            console.error('[CDE Sync] Erro ao verificar bloqueados:', error.message);
            return [];
        }
    }

    // Método para obter mudanças recentes (para o frontend)
    async getRecentChanges(minutes = 5) {
        const db = mongoose.connection.db;
        const photostatuses = db.collection('photostatuses');
        const products = db.collection('products');

        const since = new Date(Date.now() - (minutes * 60000));

        // Buscar mudanças em photostatuses (CDE/sold)
        const changes = await photostatuses.find({
            $or: [
                { lastCDESync: { $gte: since } },
                { 'virtualStatus.lastStatusChange': { $gte: since } }
            ]
        }).project({
            photoId: 1,
            currentStatus: 1,
            'virtualStatus.status': 1
        }).toArray();

        // Buscar reservas em products
        const reserved = await products.find({
            status: 'reserved'
        }).project({
            driveFileId: 1,
            status: 1
        }).toArray();

        // Combinar resultados
        const result = changes.map(photo => ({
            id: photo.photoId,
            status: photo.currentStatus === 'sold' ? 'sold' : 'available'
        }));

        // Adicionar reserved products
        reserved.forEach(product => {
            const fileName = product.driveFileId.split('/').pop().replace('.webp', '');
            result.push({
                id: fileName,
                status: 'reserved'
            });
        });

        return result;
    }
}

module.exports = new CDESync();