// src/services/CDESync.js
// Serviço de sincronização com CDE

const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const CDEBlockedPhoto = require('../models/CDEBlockedPhoto');

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
        const collection = db.collection('unified_products_complete');

        try {
            mysqlConnection = await mysql.createConnection(this.cdeConfig);

            // Buscar mudanças recentes do CDE
            const [produtos] = await mysqlConnection.execute(
                `SELECT AIDH, AESTADOP, AFECHA, ATIPOETIQUETA
            FROM tbinventario 
            WHERE ATIPOETIQUETA != '0' 
            AND ATIPOETIQUETA != ''
            AND DATE(AFECHA) >= DATE(NOW() - INTERVAL 7 DAY)
            ORDER BY AFECHA DESC`
            );

            // Verificar fotos bloqueadas conhecidas
            const blockedResults = await this.checkBlockedPhotos(mysqlConnection);

            // CORREÇÃO 1: Deduplicar antes de processar
            const photoMap = new Map();

            // Adicionar produtos das mudanças recentes
            produtos.forEach(item => {
                if (item.ATIPOETIQUETA && item.ATIPOETIQUETA !== '0') {
                    photoMap.set(item.ATIPOETIQUETA, item);
                }
            });

            // Adicionar/atualizar com blocked results (sem duplicar)
            blockedResults.forEach(item => {
                if (item.ATIPOETIQUETA && item.ATIPOETIQUETA !== '0') {
                    const existing = photoMap.get(item.ATIPOETIQUETA);
                    // Se já existe, manter o mais recente
                    if (!existing || new Date(item.AFECHA) > new Date(existing.AFECHA)) {
                        photoMap.set(item.ATIPOETIQUETA, item);
                    }
                }
            });

            const uniqueProducts = Array.from(photoMap.values());
            console.log(`[CDE Sync] Processando ${uniqueProducts.length} produtos únicos (de ${produtos.length + blockedResults.length} registros totais)`);

            let updatedCount = 0;
            let skippedCount = 0;

            for (const item of uniqueProducts) {
                let photoNumber = item.ATIPOETIQUETA;

                if (!photoNumber || photoNumber === '0') {
                    continue;
                }

                // MUDANÇA CRÍTICA: Buscar a foto PRIMEIRO, antes de determinar qualquer status
                const photoId = photoNumber.padStart(5, '0');
                const photoIdNoZeros = photoNumber.replace(/^0+/, '') || '0';

                const existingPhoto = await collection.findOne({
                    $or: [
                        { photoNumber: photoNumber },
                        { photoNumber: photoId },
                        { photoNumber: photoIdNoZeros },
                        { fileName: `${photoId}.webp` },
                        { fileName: `${photoIdNoZeros}.webp` }
                    ]
                });

                if (!existingPhoto) {
                    continue;
                }

                // MUDANÇA CRÍTICA: Verificar selectionId IMEDIATAMENTE após encontrar a foto
                if (existingPhoto.selectionId) {
                    // Verificar se o cdeStatus está incorreto e corrigir se necessário
                    if (existingPhoto.cdeStatus !== item.AESTADOP && item.AESTADOP === 'PRE-SELECTED') {
                        // O CDE diz que está PRE-SELECTED mas nosso banco tem outro status - corrigir
                        await collection.updateOne(
                            { _id: existingPhoto._id },
                            { $set: { cdeStatus: 'PRE-SELECTED' } }
                        );
                        console.log(`[CDE Sync] Foto ${photoNumber} em seleção ${existingPhoto.selectionId} - cdeStatus corrigido de ${existingPhoto.cdeStatus} para PRE-SELECTED`);
                    } else {
                        console.log(`[CDE Sync] Foto ${photoNumber} está em seleção ${existingPhoto.selectionId} - preservando status`);
                    }
                    continue; // Pula TODO o processamento se tiver selectionId
                }

                // AGORA sim determinar o novo status baseado no CDE
                let newStatus = 'available';
                let newCdeStatus = item.AESTADOP;

                // Lógica de status simplificada e consistente
                if (item.AESTADOP === 'RETIRADO') {
                    newStatus = 'sold';
                } else if (item.AESTADOP === 'RESERVED' || item.AESTADOP === 'STANDBY') {
                    newStatus = 'unavailable';
                } else if (item.AESTADOP === 'PRE-SELECTED') {
                    // Vamos verificar se tem reserva no MongoDB antes de decidir
                    newStatus = 'reserved'; // Será ajustado abaixo se necessário
                } else if (item.AESTADOP === 'INGRESADO') {
                    newStatus = 'available';
                }

                // Gerenciar lista de bloqueados
                if (item.AESTADOP === 'RESERVED' || item.AESTADOP === 'STANDBY' || item.AESTADOP === 'PRE-SELECTED') {
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
                    await CDEBlockedPhoto.deleteOne({ photoNumber: photoNumber });
                }

                // Atualização consistente de TODOS os campos de status
                let updateFields = {
                    cdeStatus: newCdeStatus,
                    idhCode: item.AIDH,
                    photoNumber: photoNumber,
                    lastCDESync: new Date(),
                    syncedFromCDE: true
                };

                // Lógica especial para PRE-SELECTED com reserva existente
                if (item.AESTADOP === 'PRE-SELECTED' && existingPhoto.reservedBy && existingPhoto.reservedBy.clientCode) {
                    // Verificar se a reserva ainda é válida
                    if (new Date(existingPhoto.reservedBy.expiresAt) > new Date()) {
                        updateFields.status = 'reserved';
                        updateFields.currentStatus = 'reserved';
                        updateFields['virtualStatus.status'] = 'reserved';
                        updateFields['reservationInfo.isReserved'] = true;
                        console.log(`[CDE Sync] Mantendo reserva válida da foto ${photoNumber} para cliente ${existingPhoto.reservedBy.clientCode}`);
                    } else {
                        // Reserva expirada - NÃO PROCESSAR AQUI
                        // Deixar para o sistema de limpeza que notifica o CDE
                        console.log(`[CDE Sync] Foto ${photoNumber} tem reserva expirada - pulando (será processada pela limpeza)`);
                        skippedCount++;
                        continue;
                    }
                } else {
                    // Atualização normal - garantir consistência
                    updateFields.status = newStatus;
                    updateFields.currentStatus = newStatus;
                    updateFields['virtualStatus.status'] = newStatus;
                    updateFields['virtualStatus.lastStatusChange'] = new Date();
                    updateFields['reservationInfo.isReserved'] = (newStatus === 'reserved');
                }

                // CRITICAL FIX: Preservar selectionId sempre
                if (existingPhoto.selectionId) {
                    updateFields.selectionId = existingPhoto.selectionId;
                }

                // Verificar se realmente precisa atualizar
                if (existingPhoto.cdeStatus === newCdeStatus &&
                    existingPhoto.status === updateFields.status &&
                    existingPhoto.currentStatus === updateFields.currentStatus) {
                    skippedCount++;
                    continue;
                }

                // FORÇAR LIMPEZA DE CARRINHO PARA STATUS CRÍTICOS
                if (item.AESTADOP === 'RETIRADO' || item.AESTADOP === 'RESERVED' || item.AESTADOP === 'STANDBY') {
                    console.log(`[CDE Sync] ATENÇÃO: Foto ${photoNumber} está ${item.AESTADOP} no CDE!`);
                    const Cart = require('../models/Cart');
                    const carrinhos = await Cart.find({ 'items.fileName': `${photoNumber}.webp` });

                    for (const cart of carrinhos) {
                        await Cart.updateOne(
                            { _id: cart._id },
                            {
                                $pull: { items: { fileName: `${photoNumber}.webp` } },
                                $inc: { totalItems: -1 }
                            }
                        );
                        console.log(`[CDE Sync] REMOVIDA foto ${photoNumber} do carrinho ${cart.clientCode} porque está ${item.AESTADOP}`);
                    }
                }

                // Aplicar atualização
                const updateOperation = { $set: updateFields };
                if (updateFields.$unset) {
                    updateOperation.$unset = updateFields.$unset;
                    delete updateFields.$unset;
                }

                // LÓGICA AMPLIADA: Remover dos carrinhos quando necessário
                // MUDANÇA AQUI - Adicionando condição para INGRESADO quando vem de PRE-SELECTED
                const deveRemoverDoCarrinho =
                    newCdeStatus === 'RETIRADO' ||
                    newCdeStatus === 'RESERVED' ||
                    newCdeStatus === 'STANDBY' ||
                    (newCdeStatus === 'INGRESADO' && existingPhoto.cdeStatus === 'PRE-SELECTED');

                // DEBUG COMPLETO
                if (photoNumber === '08206' || photoNumber === '8206') {
                    console.log(`[CDE DEBUG 08206]:`);
                    console.log(`  - Status no CDE: ${newCdeStatus}`);
                    console.log(`  - Status anterior MongoDB: ${existingPhoto?.cdeStatus}`);
                    console.log(`  - Deve remover? ${deveRemoverDoCarrinho}`);
                }

                if (deveRemoverDoCarrinho) {
                    // Logo depois da linha que define deveRemoverDoCarrinho
                    console.log(`[CDE Sync DEBUG] Foto ${photoNumber}: cdeStatus anterior=${existingPhoto?.cdeStatus}, novo=${newCdeStatus}, deveRemover=${deveRemoverDoCarrinho}`);
                    try {
                        const Cart = require('../models/Cart');

                        // Verificar se esta foto está em algum carrinho ativo
                        const cartsWithThisPhoto = await Cart.find({
                            'items.fileName': `${photoNumber}.webp`,
                            isActive: true
                        });

                        if (cartsWithThisPhoto.length > 0) {
                            console.log(`[CDE Sync] ⚠️ Foto ${photoNumber} mudou de ${existingPhoto.cdeStatus} para ${newCdeStatus} - encontrada em ${cartsWithThisPhoto.length} carrinho(s)`);

                            for (const cart of cartsWithThisPhoto) {
                                // Contar quantos desta foto estão no carrinho (geralmente 1)
                                const countBeforeRemoval = cart.items.filter(item =>
                                    item.fileName === `${photoNumber}.webp`
                                ).length;

                                // Remover a foto
                                await Cart.updateOne(
                                    { _id: cart._id },
                                    {
                                        $pull: { items: { fileName: `${photoNumber}.webp` } },
                                        $inc: { totalItems: -countBeforeRemoval }
                                    }
                                );

                                console.log(`[CDE Sync] ✅ Removida foto ${photoNumber} do carrinho ${cart.clientCode} (${cart.clientName})`);
                            }
                        }
                    } catch (cartCleanupError) {
                        console.error(`[CDE Sync] Erro ao limpar carrinhos para foto ${photoNumber}:`, cartCleanupError.message);
                        // Não interromper o sync por causa de erro na limpeza de carrinho
                    }
                }

                const result = await collection.updateOne(
                    { _id: existingPhoto._id },
                    updateOperation
                );

                if (result.modifiedCount > 0) {
                    updatedCount++;
                    console.log(`[CDE Sync] Foto ${photoNumber} atualizada: ${newCdeStatus} → ${updateFields.status}`);
                }
            }

            this.lastSync = new Date();
            console.log(`[CDE Sync] Sincronização completa: ${updatedCount} fotos atualizadas, ${skippedCount} já estavam sincronizadas`);

            return { success: true, updated: updatedCount, skipped: skippedCount };

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
        const unifiedProducts = db.collection('unified_products_complete');

        const since = new Date(Date.now() - (minutes * 60000));

        // Buscar mudanças em photostatuses (CDE/sold)
        const changes = await unifiedProducts.find({
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
        const reserved = await unifiedProducts.find({
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