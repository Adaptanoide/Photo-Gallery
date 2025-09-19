// src/services/CartService.js
// VERSÃO SIMPLIFICADA - Todas operações são síncronas e instantâneas

const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
const Cart = require('../models/Cart');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const AccessCode = require('../models/AccessCode');
const StatusConsistencyGuard = require('./StatusConsistencyGuard');

class CartService {
    static MAX_ITEMS_PER_CART = 100;

    /**
     * Obter conexão MySQL do CDE
     */
    static async getCDEConnection() {
        return await mysql.createConnection({
            host: process.env.CDE_HOST,
            port: process.env.CDE_PORT,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });
    }

    /**
     * Extrair número da foto
     */
    static extractPhotoNumber(fileName) {
        if (!fileName) return null;
        const cleaned = fileName.replace('.webp', '').replace('.jpg', '').replace('.png', '');
        const numbers = cleaned.match(/\d+/);
        return numbers ? numbers[0].padStart(5, '0') : null;
    }

    /**
     * ADICIONAR AO CARRINHO
     * Atualiza MongoDB e CDE instantaneamente na mesma operação
     */
    static async addToCart(sessionId, clientCode, clientName, driveFileId, itemData = {}) {
        const mongoSession = await mongoose.startSession();
        let cdeConnection = null;

        try {
            // Iniciar transação MongoDB
            await mongoSession.startTransaction();

            console.log(`[CART] Adicionando ${driveFileId} ao carrinho ${clientCode}`);

            // 1. Buscar/criar produto no MongoDB
            let product = await UnifiedProductComplete.findOne({ driveFileId }).session(mongoSession);

            if (!product) {
                const photoNumber = this.extractPhotoNumber(itemData.fileName);
                product = new UnifiedProductComplete({
                    idhCode: `TEMP_${Date.now()}`,
                    photoNumber: photoNumber || 'unknown',
                    photoId: driveFileId,
                    driveFileId: driveFileId,
                    fileName: itemData.fileName || 'Produto',
                    category: itemData.category || 'Categoria',
                    status: 'available',
                    currentStatus: 'available',
                    thumbnailUrl: itemData.thumbnailUrl || null
                });
                await product.save({ session: mongoSession });
            } else {
                // NOVO BLOCO: Atualizar thumbnailUrl se necessário
                if (!product.thumbnailUrl && itemData.thumbnailUrl) {
                    product.thumbnailUrl = itemData.thumbnailUrl;
                    await product.save({ session: mongoSession });
                    console.log(`[CART] Thumbnail atualizada para produto existente: ${driveFileId}`);
                }
            }

            // 2. Verificar disponibilidade
            if (product.status !== 'available') {
                if (product.reservedBy?.clientCode === clientCode) {
                    console.log(`[CART] Produto já reservado para o mesmo cliente ${clientCode}`);
                } else {
                    throw new Error('Produto reservado para outro cliente');
                }
            }

            // 3. Buscar/criar carrinho - CORREÇÃO: verificar primeiro por sessionId
            let cart = await Cart.findOne({
                sessionId
            }).session(mongoSession);

            if (!cart) {
                // Se não existe carrinho com este sessionId, buscar por clientCode
                cart = await Cart.findOne({
                    clientCode,
                    isActive: true
                }).session(mongoSession);
            }

            if (!cart) {
                // Só criar novo se realmente não existe nenhum carrinho
                cart = new Cart({
                    sessionId,
                    clientCode,
                    clientName,
                    items: [],
                    isActive: true
                });
            } else if (!cart.isActive) {
                // Reativar carrinho existente
                cart.isActive = true;
                cart.clientCode = clientCode;
                cart.clientName = clientName;
                // Não limpar items aqui - deixar o filtro de duplicados cuidar disso
            }

            // 4. Verificar se já está no carrinho
            if (cart.hasItem(driveFileId)) {
                throw new Error('Item já está no carrinho');
            }

            // 5. Calcular expiração baseada no cliente
            const clientConfig = await AccessCode.findOne({ code: clientCode }).session(mongoSession);
            const ttlHours = clientConfig?.cartSettings?.ttlHours || 24;
            const expiresAt = new Date(Date.now() + (ttlHours * 60 * 60 * 1000));

            // 6. ATUALIZAÇÃO INSTANTÂNEA DO CDE
            const photoNumber = this.extractPhotoNumber(itemData.fileName);
            if (photoNumber) {
                cdeConnection = await this.getCDEConnection();

                const [cdeResult] = await cdeConnection.execute(
                    `UPDATE tbinventario 
                     SET AESTADOP = 'PRE-SELECTED',
                         RESERVEDUSU = ?,
                         AFECHA = NOW()
                     WHERE ATIPOETIQUETA = ?
                     AND AESTADOP = 'INGRESADO'`,
                    [`${clientName}-${clientCode}`, photoNumber]
                );

                if (cdeResult.affectedRows === 0) {
                    throw new Error('Foto não disponível no CDE');
                }

                console.log(`[CDE] Foto ${photoNumber} marcada como PRE-SELECTED`);
            }

            // 7. Atualizar produto no MongoDB
            product.cdeStatus = 'PRE-SELECTED';  // Define o CDE status primeiro
            product.reservedBy = {
                clientCode,
                sessionId,
                expiresAt
            };
            await product.save({ session: mongoSession });

            // 7. Atualizar produto no MongoDB
            product.cdeStatus = 'PRE-SELECTED';
            product.reservedBy = {
                clientCode,
                sessionId,
                expiresAt
            };
            await product.save({ session: mongoSession });

            // 7.1 Garantir que todos os status fiquem consistentes (ANTES DO COMMIT!)
            product = await StatusConsistencyGuard.ensureConsistency(product._id, mongoSession);

            // 8. Adicionar ao carrinho
            cart.items.push({
                productId: product._id,
                driveFileId: product.driveFileId,
                fileName: product.fileName,
                category: product.category,
                thumbnailUrl: product.thumbnailUrl,
                pathLevels: itemData.pathLevels || [],
                fullPath: itemData.fullPath || '',
                price: itemData.price || 0,
                basePrice: itemData.basePrice || 0,
                expiresAt,
                addedAt: new Date()
            });

            await cart.save({ session: mongoSession });

            // 9. Commit da transação
            await mongoSession.commitTransaction();

            console.log(`[CART] ✅ Item ${driveFileId} adicionado com sucesso`);

            return {
                success: true,
                message: 'Item adicionado ao carrinho',
                cart: await this.getCartSummary(sessionId),
                expiresAt,
                timeRemaining: ttlHours * 3600
            };

        } catch (error) {
            await mongoSession.abortTransaction();
            console.error(`[CART] ❌ Erro ao adicionar item:`, error.message);
            throw error;
        } finally {
            await mongoSession.endSession();
            if (cdeConnection) await cdeConnection.end();
        }
    }

    /**
     * REMOVER DO CARRINHO
     * Atualiza MongoDB e CDE instantaneamente
     */
    static async removeFromCart(sessionId, driveFileId) {
        const mongoSession = await mongoose.startSession();
        let cdeConnection = null;

        try {
            await mongoSession.startTransaction();

            console.log(`[CART] Removendo ${driveFileId} do carrinho`);

            // 1. Buscar carrinho
            const cart = await Cart.findOne({
                sessionId,
                isActive: true
            }).session(mongoSession);

            if (!cart || !cart.hasItem(driveFileId)) {
                throw new Error('Item não encontrado no carrinho');
            }

            // 2. Remover do carrinho
            const removedItem = cart.items.find(i => i.driveFileId === driveFileId);
            cart.items = cart.items.filter(item => item.driveFileId !== driveFileId);

            cart.totalItems = cart.items.length;

            if (cart.items.length === 0) {
                cart.isActive = false;
            }

            await cart.save({ session: mongoSession });

            // 3. ATUALIZAÇÃO INSTANTÂNEA DO CDE
            const photoNumber = this.extractPhotoNumber(removedItem.fileName);
            if (photoNumber) {
                cdeConnection = await this.getCDEConnection();

                await cdeConnection.execute(
                    `UPDATE tbinventario 
                     SET AESTADOP = 'INGRESADO',
                         RESERVEDUSU = NULL,
                         AFECHA = NOW()
                     WHERE ATIPOETIQUETA = ?`,
                    [photoNumber]
                );

                console.log(`[CDE] Foto ${photoNumber} liberada`);
            }

            // 4. Liberar no MongoDB
            await UnifiedProductComplete.updateOne(
                { driveFileId },
                {
                    $set: {
                        status: 'available',
                        currentStatus: 'available',
                        cdeStatus: 'INGRESADO'
                    },
                    $unset: {
                        reservedBy: 1
                    }
                }
            ).session(mongoSession);

            // 4.1 Garantir consistência após liberar (ANTES DO COMMIT!)
            const updatedProduct = await UnifiedProductComplete.findOne({ driveFileId }).session(mongoSession);
            if (updatedProduct) {
                await StatusConsistencyGuard.ensureConsistency(updatedProduct._id, mongoSession);
            }

            await mongoSession.commitTransaction();

            console.log(`[CART] ✅ Item ${driveFileId} removido com sucesso`);

            return {
                success: true,
                message: 'Item removido do carrinho',
                cart: await this.getCartSummary(sessionId)
            };

        } catch (error) {
            await mongoSession.abortTransaction();
            console.error(`[CART] ❌ Erro ao remover item:`, error.message);
            throw error;
        } finally {
            await mongoSession.endSession();
            if (cdeConnection) await cdeConnection.end();
        }
    }

    /**
     * PROCESSAR ITEM EXPIRADO
     * Quando detecta que um item expirou, libera instantaneamente
     */
    static async processExpiredItem(item, cart) {
        let cdeConnection = null;

        try {
            console.log(`[EXPIRE] Processando item expirado: ${item.fileName}`);

            // 1. ATUALIZAÇÃO INSTANTÂNEA DO CDE
            const photoNumber = this.extractPhotoNumber(item.fileName);
            if (photoNumber) {
                cdeConnection = await this.getCDEConnection();

                await cdeConnection.execute(
                    `UPDATE tbinventario 
                     SET AESTADOP = 'INGRESADO',
                         RESERVEDUSU = NULL,
                         AFECHA = NOW()
                     WHERE ATIPOETIQUETA = ?`,
                    [photoNumber]
                );

                console.log(`[CDE] Foto ${photoNumber} liberada por expiração`);
            }

            // 2. Atualizar MongoDB
            await UnifiedProductComplete.updateOne(
                { fileName: item.fileName },
                {
                    $set: {
                        status: 'available',
                        currentStatus: 'available',
                        cdeStatus: 'INGRESADO'
                    },
                    $unset: {
                        reservedBy: 1
                    }
                }
            );

            // 3. Remover do carrinho
            await Cart.updateOne(
                { _id: cart._id },
                {
                    $pull: { items: { fileName: item.fileName } },
                    $inc: { totalItems: -1 }
                }
            );

            console.log(`[EXPIRE] ✅ Item ${item.fileName} liberado por expiração`);
            return true;

        } catch (error) {
            console.error(`[EXPIRE] ❌ Erro ao processar expiração:`, error.message);
            return false;
        } finally {
            if (cdeConnection) await cdeConnection.end();
        }
    }

    /**
     * BUSCAR CARRINHO
     * Processa expirações em tempo real ao buscar
     */
    static async getCart(sessionId) {
        try {
            const cart = await Cart.findOne({
                sessionId,
                isActive: true
            });

            if (!cart) return null;

            // Processar expirações em tempo real
            const now = new Date();
            const expiredItems = cart.items.filter(item =>
                item.expiresAt && new Date(item.expiresAt) < now
            );

            // Liberar itens expirados instantaneamente
            for (const expiredItem of expiredItems) {
                await this.processExpiredItem(expiredItem, cart);
            }

            // Recarregar carrinho atualizado
            return await Cart.findOne({
                sessionId,
                isActive: true
            });

        } catch (error) {
            console.error(`[CART] Erro ao buscar carrinho:`, error);
            throw error;
        }
    }

    /**
     * RESUMO DO CARRINHO
     */
    static async getCartSummary(sessionId) {
        try {
            const cart = await this.getCart(sessionId);

            if (!cart) {
                return {
                    totalItems: 0,
                    items: [],
                    isEmpty: true
                };
            }

            return {
                totalItems: cart.totalItems,
                items: cart.items.map(item => ({
                    driveFileId: item.driveFileId,
                    fileName: item.fileName,
                    category: item.category,
                    thumbnailUrl: item.thumbnailUrl,
                    pathLevels: item.pathLevels || [],
                    fullPath: item.fullPath || '',
                    price: item.price,
                    basePrice: item.basePrice,
                    expiresAt: item.expiresAt,
                    timeRemaining: item.expiresAt ?
                        Math.max(0, Math.floor((new Date(item.expiresAt) - new Date()) / 1000)) : 0
                })),
                isEmpty: cart.totalItems === 0,
                lastActivity: cart.lastActivity
            };

        } catch (error) {
            console.error(`[CART] Erro ao buscar resumo:`, error);
            return {
                totalItems: 0,
                items: [],
                isEmpty: true,
                error: error.message
            };
        }
    }

    /**
     * VERIFICAR STATUS NO CDE EM TEMPO REAL
     * Usado para validar antes de operações críticas
     */
    static async checkCDEStatus(photoNumber) {
        let connection = null;

        try {
            connection = await this.getCDEConnection();

            const [rows] = await connection.execute(
                'SELECT AESTADOP, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA = ?',
                [photoNumber]
            );

            return rows[0] || null;

        } catch (error) {
            console.error(`[CDE] Erro ao verificar status:`, error);
            return null;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * ESTENDER TEMPO DO CARRINHO
     * Atualização instantânea sem complexidade
     */
    static async extendCartTime(clientCode, hours, extendedBy = 'admin') {
        const mongoSession = await mongoose.startSession();

        try {
            await mongoSession.startTransaction();

            const newExpiration = new Date(Date.now() + (hours * 60 * 60 * 1000));

            // Atualizar carrinho
            const cart = await Cart.findOne({
                clientCode,
                isActive: true
            }).session(mongoSession);

            if (!cart) {
                throw new Error('Carrinho não encontrado');
            }

            // Atualizar todos os itens
            cart.items.forEach(item => {
                item.expiresAt = newExpiration;
            });

            cart.extendedAt = new Date();
            cart.extendedBy = extendedBy;
            await cart.save({ session: mongoSession });

            // Atualizar produtos
            const fileNames = cart.items.map(item => item.fileName);
            await UnifiedProductComplete.updateMany(
                {
                    fileName: { $in: fileNames },
                    'reservedBy.clientCode': clientCode
                },
                {
                    $set: {
                        'reservedBy.expiresAt': newExpiration,
                        extendedAt: new Date(),
                        extendedBy
                    }
                },
                { session: mongoSession }
            );

            await mongoSession.commitTransaction();

            return {
                success: true,
                newExpiration,
                itemsUpdated: cart.items.length
            };

        } catch (error) {
            await mongoSession.abortTransaction();
            throw error;
        } finally {
            await mongoSession.endSession();
        }
    }

    /**
     * ESTATÍSTICAS DO SISTEMA (simples, sem complexidade)
     */
    static async getSystemStats() {
        try {
            const stats = await Promise.all([
                Cart.countDocuments({ isActive: true }),
                UnifiedProductComplete.countDocuments({ status: 'available' }),
                UnifiedProductComplete.countDocuments({ status: 'reserved' }),
                UnifiedProductComplete.countDocuments({ status: 'sold' })
            ]);

            return {
                activeCarts: stats[0],
                availableProducts: stats[1],
                reservedProducts: stats[2],
                soldProducts: stats[3],
                timestamp: new Date()
            };

        } catch (error) {
            console.error(`[STATS] Erro:`, error);
            throw error;
        }
    }
}

module.exports = CartService;