/**
 * Database Service
 * Usa o modelo PhotoStatus real do sistema
 */

const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
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
        let mysqlConn = null;

        try {
            // Extrair apenas o número
            let photoNumber = photoData.number;
            if (photoNumber.includes('/')) {
                photoNumber = photoNumber.split('/').pop().replace('.webp', '');
            }

            // Buscar informações no CDE
            let idhCode = null;
            let cdeStatus = null;

            try {
                mysqlConn = await mysql.createConnection({
                    host: process.env.CDE_HOST,
                    port: parseInt(process.env.CDE_PORT),
                    user: process.env.CDE_USER,
                    password: process.env.CDE_PASSWORD,
                    database: process.env.CDE_DATABASE
                });

                const [rows] = await mysqlConn.execute(
                    'SELECT AIDH, AESTADOP FROM tbinventario WHERE ATIPOETIQUETA = ?',
                    [photoNumber]
                );

                if (rows.length > 0) {
                    idhCode = rows[0].AIDH;
                    cdeStatus = rows[0].AESTADOP;
                    console.log(`📋 CDE: Foto ${photoNumber} → IDH: ${idhCode}, Status: ${cdeStatus}`);
                } else {
                    console.log(`⚠️ Foto ${photoNumber} não encontrada no CDE`);
                }
            } catch (cdeError) {
                console.error(`⚠️ Erro ao consultar CDE para foto ${photoNumber}:`, cdeError.message);
                // Continua sem dados do CDE
            } finally {
                if (mysqlConn) {
                    await mysqlConn.end();
                }
            }

            // Determinar status MongoDB baseado no CDE
            const mongoStatus =
                cdeStatus === 'RETIRADO' ? 'sold' :
                    cdeStatus === 'INGRESADO' ? 'available' :
                        (cdeStatus === 'STANDBY' || cdeStatus === 'RESERVED') ? 'unavailable' :
                            'available'; // default se não existir no CDE

            const photoStatus = new PhotoStatus({
                photoId: photoNumber,              // Usar número simples, não path
                photoNumber: photoNumber,          // Campo normalizado
                fileName: photoData.fileName.replace(/\.(jpg|jpeg|png)$/i, '.webp'),
                r2Key: photoData.r2Key,
                idhCode: idhCode,                  // IDH do CDE
                cdeStatus: cdeStatus,              // Status do CDE
                lastCDESync: cdeStatus ? new Date() : null,
                virtualStatus: {
                    status: mongoStatus,
                    tags: [mongoStatus, `added_${new Date().toISOString().split('T')[0]}`],
                    lastStatusChange: new Date()
                },
                currentStatus: mongoStatus,
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
            console.log(`✅ Foto ${photoNumber} adicionada ao MongoDB (Status: ${mongoStatus})`);
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
            cdeStatus: 'RETIRADO',
            'virtualStatus.lastStatusChange': new Date(),
            lastCDESync: new Date()
        });
    }

    async upsertPhotoBatch(photos) {
        const results = [];

        // Criar conexão MySQL única para o batch
        let mysqlConn = null;
        try {
            mysqlConn = await mysql.createConnection({
                host: process.env.CDE_HOST,
                port: parseInt(process.env.CDE_PORT),
                user: process.env.CDE_USER,
                password: process.env.CDE_PASSWORD,
                database: process.env.CDE_DATABASE
            });
        } catch (error) {
            console.error('⚠️ Não foi possível conectar ao CDE:', error.message);
        }

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
                        { photoId: photoNumber }
                    ]
                });

                if (existing) {
                    // Buscar status atualizado no CDE se tiver conexão
                    if (mysqlConn) {
                        try {
                            const [rows] = await mysqlConn.execute(
                                'SELECT AIDH, AESTADOP FROM tbinventario WHERE ATIPOETIQUETA = ?',
                                [photoNumber]
                            );

                            if (rows.length > 0) {
                                const cdeStatus = rows[0].AESTADOP;
                                const mongoStatus =
                                    cdeStatus === 'RETIRADO' ? 'sold' :
                                        cdeStatus === 'INGRESADO' ? 'available' :
                                            (cdeStatus === 'STANDBY' || cdeStatus === 'RESERVED') ? 'unavailable' :
                                                existing.currentStatus;

                                existing.idhCode = rows[0].AIDH;
                                existing.cdeStatus = cdeStatus;
                                existing.currentStatus = mongoStatus;
                                existing.virtualStatus.status = mongoStatus;
                                existing.lastCDESync = new Date();
                            }
                        } catch (error) {
                            console.error(`⚠️ Erro ao consultar CDE para ${photoNumber}:`, error.message);
                        }
                    }

                    // Atualizar r2Key
                    existing.r2Key = photo.r2Key;
                    existing.updatedAt = new Date();
                    await existing.save();
                    results.push({ number: photo.number, status: 'updated' });
                } else {
                    // Criar novo (vai buscar do CDE internamente)
                    await this.createPhotoStatus(photo);
                    results.push({ number: photo.number, status: 'created' });
                }
            } catch (error) {
                console.error(`Erro ao processar ${photo.number}:`, error.message);
                results.push({ number: photo.number, status: 'error', error: error.message });
            }
        }

        // Fechar conexão MySQL se estiver aberta
        if (mysqlConn) {
            await mysqlConn.end();
        }

        return results;
    }
}

module.exports = DatabaseService;