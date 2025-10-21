/**
 * Database Service - VERSÃO ATUALIZADA PARA UnifiedProductComplete
 * Adaptado para trabalhar com o modelo atual do sistema
 */

const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
const Cart = require('../src/models/Cart');
const Selection = require('../src/models/Selection');

/**
 * Sanitiza categoria removendo setas finais
 * CRÍTICO: Previne categorias com " → " no final que causam NO-QB
 */
function sanitizeCategory(category) {
    if (!category) return category;
    // Remove " → " ou "→" do final da string
    return category.replace(/\s*→\s*$/, '').trim();
}

class DatabaseService {
    constructor() {
        this.connected = false;
        this.dryRun = false;
    }

    // Ativar/desativar modo dry-run
    setDryRun(enabled) {
        this.dryRun = enabled;
        if (this.dryRun) {
            console.log('🔸 [DB Service] Modo DRY-RUN ativado - nenhuma alteração será salva');
        }
    }

    async connect() {
        try {
            await mongoose.connect(process.env.MONGODB_URI);
            this.connected = true;
            console.log('✅ MongoDB conectado para sync');

            // Mostrar estatísticas básicas
            const totalPhotos = await UnifiedProductComplete.countDocuments();
            const available = await UnifiedProductComplete.countDocuments({ status: 'available' });
            const sold = await UnifiedProductComplete.countDocuments({ status: 'sold' });
            console.log(`   📊 Total: ${totalPhotos} | Disponíveis: ${available} | Vendidas: ${sold}`);

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
        return await UnifiedProductComplete.find({}).select({
            photoNumber: 1,
            idhCode: 1,
            status: 1,
            cdeStatus: 1,
            selectionId: 1,
            category: 1
        });
    }

    async getPhotosByStatus(status) {
        return await UnifiedProductComplete.find({
            status: status,
            selectionId: null  // Não mexer em fotos com seleção
        });
    }

    async getPhotoByNumber(photoNumber) {
        // Padronizar número para 5 dígitos
        const paddedNumber = photoNumber.padStart(5, '0');

        return await UnifiedProductComplete.findOne({
            $or: [
                { photoNumber: photoNumber },
                { photoNumber: paddedNumber },
                { fileName: `${photoNumber}.webp` },
                { fileName: `${paddedNumber}.webp` },
                { photoId: new RegExp(photoNumber) }
            ]
        });
    }

    async createPhotoStatus(photoData) {
        let mysqlConn = null;

        try {
            // ===== NOVO: DETECTAR SE É COMING SOON =====
            const isComingSoon = photoData.isComingSoon === true;
            const qbCode = photoData.qbCode || null;

            // Se é Coming Soon, usar os dados já resolvidos
            let finalCategory = sanitizeCategory(photoData.category) || 'uncategorized';

            if (isComingSoon && !finalCategory) {
                console.log(`   ⚠️ Foto Coming Soon sem category - usando uncategorized`);
                finalCategory = 'uncategorized';
            }
            // ===== FIM DA ADIÇÃO =====

            // Extrair e padronizar número da foto
            let photoNumber = photoData.number;
            if (photoNumber.includes('/')) {
                photoNumber = photoNumber.split('/').pop().replace('.webp', '');
            }
            photoNumber = photoNumber.padStart(5, '0');

            // VERIFICAÇÃO CRÍTICA 1: Verificar se já existe
            const existingPhoto = await UnifiedProductComplete.findOne({
                photoNumber: photoNumber
            });

            if (existingPhoto) {
                // PROTEÇÃO 1: Não tocar se tem selectionId
                if (existingPhoto.selectionId) {
                    console.log(`   ⚠️ Foto ${photoNumber} está em seleção ${existingPhoto.selectionId} - MANTENDO COMO ESTÁ`);
                    return existingPhoto;
                }

                // PROTEÇÃO 2: Verificar se está em carrinho ativo
                const inCart = await Cart.findOne({
                    isActive: true,
                    'items.fileName': { $in: [`${photoNumber}.webp`, `${photoData.fileName}`] }
                });

                if (inCart) {
                    console.log(`   ⚠️ Foto ${photoNumber} está em carrinho ativo (${inCart.clientCode}) - MANTENDO COMO ESTÁ`);
                    return existingPhoto;
                }

                // PROTEÇÃO 3: Verificar se está em seleção pendente
                const inSelection = await Selection.findOne({
                    status: { $in: ['pending', 'confirmed', 'approving'] },
                    'items.fileName': { $in: [`${photoNumber}.webp`, `${photoData.fileName}`] }
                });

                if (inSelection) {
                    console.log(`   ⚠️ Foto ${photoNumber} está em seleção ${inSelection.status} - MANTENDO COMO ESTÁ`);
                    return existingPhoto;
                }
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
                    'SELECT AIDH, AESTADOP, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA = ?',
                    [photoNumber]
                );

                if (rows.length > 0) {
                    idhCode = rows[0].AIDH;
                    cdeStatus = rows[0].AESTADOP;
                    console.log(`   📋 CDE: Foto ${photoNumber} → IDH: ${idhCode}, Status: ${cdeStatus}`);

                    // Se está PRE-SELECTED no CDE, verificar se é para algum cliente nosso
                    if (cdeStatus === 'PRE-SELECTED' && rows[0].RESERVEDUSU) {
                        console.log(`      Reservada no CDE para: ${rows[0].RESERVEDUSU}`);
                    }
                } else {
                    console.log(`   ⚠️ Foto ${photoNumber} não encontrada no CDE - criando com valores padrão`);
                    idhCode = `2001${photoNumber}`;
                    cdeStatus = 'INGRESADO';
                }
            } catch (cdeError) {
                console.error(`   ⚠️ Erro ao consultar CDE:`, cdeError.message);
                // CDE offline - usar valores padrão
                idhCode = idhCode || `2001${photoNumber}`;
                cdeStatus = cdeStatus || 'INGRESADO';
            } finally {
                if (mysqlConn) {
                    await mysqlConn.end();
                }
            }

            // Determinar status MongoDB
            let mongoStatus;

            if (isComingSoon) {
                // Coming Soon não consulta CDE, sempre available inicialmente
                mongoStatus = 'available';
                cdeStatus = null; // Coming Soon não tem status CDE ainda
                idhCode = idhCode || `2001${photoNumber}`;
            } else {
                // Fotos normais - baseado no CDE
                mongoStatus =
                    cdeStatus === 'RETIRADO' ? 'sold' :
                        cdeStatus === 'PRE-SELECTED' ? 'reserved' :
                            cdeStatus === 'RESERVED' ? 'unavailable' :
                                cdeStatus === 'STANDBY' ? 'unavailable' :
                                    cdeStatus === 'INGRESADO' ? 'available' :
                                        'available';
            }

            // Se já existe, apenas atualizar campos seguros
            if (existingPhoto) {
                if (this.dryRun) {
                    console.log(`   [DRY-RUN] Atualizaria foto ${photoNumber}: ${existingPhoto.status} → ${mongoStatus}`);
                    return existingPhoto;
                }

                // Só atualizar se o status mudou significativamente
                if (existingPhoto.cdeStatus !== cdeStatus || existingPhoto.status !== mongoStatus) {
                    existingPhoto.idhCode = idhCode;
                    existingPhoto.cdeStatus = cdeStatus;
                    existingPhoto.status = mongoStatus;
                    existingPhoto.currentStatus = mongoStatus;
                    existingPhoto.virtualStatus.status = mongoStatus;
                    existingPhoto.lastCDESync = new Date();

                    await existingPhoto.save();
                    console.log(`   ✅ Foto ${photoNumber} atualizada: ${existingPhoto.status} → ${mongoStatus}`);
                }

                return existingPhoto;
            }

            // CRIAR NOVO REGISTRO
            if (this.dryRun) {
                console.log(`   [DRY-RUN] Criaria novo registro para foto ${photoNumber} (${mongoStatus})`);
                return null;
            }

            // ===== BLOCO MODIFICADO - INÍCIO =====
            const unifiedProduct = new UnifiedProductComplete({
                // === Identificação principal ===
                idhCode: idhCode,
                photoNumber: photoNumber,
                fileName: photoData.fileName || `${photoNumber}.webp`,

                // === Campos de compatibilidade ===
                driveFileId: photoData.r2Key || `${finalCategory}/${photoNumber}.webp`,
                photoId: photoData.r2Key || `${finalCategory}/${photoNumber}.webp`,

                // === Localização ===
                r2Path: photoData.r2Key,
                category: finalCategory.replace(/\//g, ' → '),
                folderPath: finalCategory,

                // === Status ===
                status: mongoStatus,
                currentStatus: mongoStatus,
                cdeStatus: cdeStatus,

                // ===== CAMPOS COMING SOON (NOVOS) =====
                transitStatus: isComingSoon ? 'coming_soon' : null,
                cdeTable: isComingSoon ? 'tbetiqueta' : 'tbinventario',
                isPreOrder: isComingSoon ? false : null,
                qbItem: qbCode,

                // === Virtual status ===
                virtualStatus: {
                    status: mongoStatus,
                    tags: isComingSoon ? ['coming_soon'] : [],
                    lastStatusChange: new Date()
                },

                // === Preços ===
                price: 0,
                basePrice: 0,
                currentPricing: {
                    currentPrice: 0,
                    hasPrice: false,
                    formattedPrice: 'No price'
                },

                // === Metadados ===
                lastCDESync: isComingSoon ? null : new Date(),
                syncedFromCDE: !isComingSoon,
                isActive: true,

                // === Localizações ===
                currentLocation: {
                    locationType: 'stock',
                    currentPath: photoData.r2Key || finalCategory,
                    currentParentId: 'r2',
                    currentCategory: finalCategory.replace(/\//g, ' → ')
                },

                originalLocation: {
                    originalPath: photoData.r2Key || finalCategory,
                    originalParentId: 'r2',
                    originalCategory: finalCategory.replace(/\//g, ' → ')
                },

                // === Metadata ===
                metadata: {
                    fileType: 'webp',
                    quality: 'standard',
                    tags: isComingSoon
                        ? ['coming_soon', `sync_${new Date().toISOString().split('T')[0]}`]
                        : [`sync_${new Date().toISOString().split('T')[0]}`]
                }
            });

            await unifiedProduct.save();

            const statusMsg = isComingSoon ? '(Coming Soon)' : `(Status: ${mongoStatus})`;
            console.log(`   ✅ Foto ${photoNumber} criada no MongoDB ${statusMsg}`);
            // ===== BLOCO MODIFICADO - FIM =====

            return unifiedProduct;

        } catch (error) {
            console.error(`   ❌ Erro ao processar foto ${photoData.number}:`, error.message);
            throw error;
        }
    }

    async updatePhotoStatus(photoId, updates) {
        // Buscar a foto primeiro para verificações
        const photo = await this.getPhotoByNumber(photoId);

        if (!photo) {
            console.log(`   ⚠️ Foto ${photoId} não encontrada`);
            return null;
        }

        // PROTEÇÃO: Não atualizar se tem selectionId
        if (photo.selectionId) {
            console.log(`   ⚠️ Foto ${photoId} tem selectionId (${photo.selectionId}) - NÃO ATUALIZANDO`);
            return photo;
        }

        // PROTEÇÃO: Verificar se está em uso
        const inCart = await Cart.findOne({
            isActive: true,
            'items.fileName': `${photo.photoNumber}.webp`
        });

        if (inCart) {
            console.log(`   ⚠️ Foto ${photoId} está em carrinho ativo - NÃO ATUALIZANDO`);
            return photo;
        }

        if (this.dryRun) {
            console.log(`   [DRY-RUN] Atualizaria foto ${photoId}`);
            return photo;
        }

        // Aplicar atualizações
        Object.keys(updates).forEach(key => {
            photo[key] = updates[key];
        });

        await photo.save();
        return photo;
    }

    async markAsSold(photoId) {
        const photo = await this.getPhotoByNumber(photoId);

        if (!photo) {
            return { success: false, error: 'Foto não encontrada' };
        }

        // Se já está vendida, não fazer nada
        if (photo.status === 'sold') {
            return { success: true, message: 'Já estava vendida' };
        }

        if (this.dryRun) {
            console.log(`   [DRY-RUN] Marcaria foto ${photoId} como vendida`);
            return { success: true, dryRun: true };
        }

        return await this.updatePhotoStatus(photoId, {
            status: 'sold',
            currentStatus: 'sold',
            cdeStatus: 'RETIRADO',
            'virtualStatus.status': 'sold',
            'virtualStatus.lastStatusChange': new Date(),
            lastCDESync: new Date(),
            soldAt: new Date()
        });
    }

    async upsertPhotoBatch(photos) {
        const results = [];
        let mysqlConn = null;

        // Tentar conectar ao CDE uma vez para todo o batch
        try {
            mysqlConn = await mysql.createConnection({
                host: process.env.CDE_HOST,
                port: parseInt(process.env.CDE_PORT),
                user: process.env.CDE_USER,
                password: process.env.CDE_PASSWORD,
                database: process.env.CDE_DATABASE
            });
            console.log('   📡 Conectado ao CDE para verificação em batch');
        } catch (error) {
            console.error('   ⚠️ CDE não disponível - usando valores padrão:', error.message);
        }

        // Processar cada foto
        for (const photo of photos) {
            try {
                // Extrair número
                let photoNumber = photo.number || photo.photoNumber;
                if (photoNumber.includes('/')) {
                    photoNumber = photoNumber.split('/').pop().replace('.webp', '');
                }
                photoNumber = photoNumber.padStart(5, '0');

                // Verificar se já existe
                const existing = await this.getPhotoByNumber(photoNumber);

                if (existing) {
                    // Se tem selectionId, pular
                    if (existing.selectionId) {
                        results.push({
                            number: photoNumber,
                            status: 'skipped',
                            reason: 'has selectionId'
                        });
                        continue;
                    }

                    // Buscar status atualizado no CDE se tiver conexão
                    if (mysqlConn && !this.dryRun) {
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
                                            cdeStatus === 'PRE-SELECTED' ? 'reserved' :
                                                'unavailable';

                                if (existing.cdeStatus !== cdeStatus || existing.status !== mongoStatus) {
                                    existing.idhCode = rows[0].AIDH;
                                    existing.cdeStatus = cdeStatus;
                                    existing.status = mongoStatus;
                                    existing.currentStatus = mongoStatus;
                                    existing.virtualStatus.status = mongoStatus;
                                    existing.lastCDESync = new Date();

                                    if (!this.dryRun) {
                                        await existing.save();
                                    }

                                    results.push({
                                        number: photoNumber,
                                        status: 'updated',
                                        newStatus: mongoStatus
                                    });
                                    continue;
                                }
                            }
                        } catch (error) {
                            console.error(`   Erro ao consultar CDE para ${photoNumber}:`, error.message);
                        }
                    }

                    // Atualizar campos básicos se necessário
                    if (photo.r2Key && existing.r2Path !== photo.r2Key) {
                        existing.r2Path = photo.r2Key;
                        existing.driveFileId = photo.r2Key;

                        if (!this.dryRun) {
                            await existing.save();
                        }
                    }

                    results.push({ number: photoNumber, status: 'exists' });
                } else {
                    // Criar novo
                    await this.createPhotoStatus(photo);
                    results.push({ number: photoNumber, success: true, action: 'created' });
                }
            } catch (error) {
                console.error(`   Erro ao processar ${photo.number}:`, error.message);
                results.push({
                    number: photo.number,
                    status: 'error',
                    error: error.message
                });
            }
        }

        // Fechar conexão MySQL se estiver aberta
        if (mysqlConn) {
            await mysqlConn.end();
        }

        // Mostrar resumo
        const created = results.filter(r => r.status === 'created').length;
        const updated = results.filter(r => r.status === 'updated').length;
        const skipped = results.filter(r => r.status === 'skipped').length;
        const errors = results.filter(r => r.status === 'error').length;

        console.log(`   📊 Batch completo: ${created} criadas, ${updated} atualizadas, ${skipped} puladas, ${errors} erros`);

        return results;
    }

    // Método auxiliar para obter estatísticas do banco
    async getStats() {
        const total = await UnifiedProductComplete.countDocuments();
        const available = await UnifiedProductComplete.countDocuments({ status: 'available' });
        const sold = await UnifiedProductComplete.countDocuments({ status: 'sold' });
        const reserved = await UnifiedProductComplete.countDocuments({ status: 'reserved' });
        const withSelection = await UnifiedProductComplete.countDocuments({
            selectionId: { $ne: null }
        });

        return {
            total,
            available,
            sold,
            reserved,
            withSelection,
            percentAvailable: ((available / total) * 100).toFixed(1),
            percentSold: ((sold / total) * 100).toFixed(1)
        };
    }
}

module.exports = DatabaseService;