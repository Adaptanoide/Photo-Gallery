// src/services/CartService.js
// VERSÃO SIMPLIFICADA - Todas operações são síncronas e instantâneas

const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
const Cart = require('../models/Cart');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const AccessCode = require('../models/AccessCode');
const CDEWriter = require('./CDEWriter');

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

    static async addToCart(sessionId, clientCode, clientName, driveFileId, itemData = {}) {
        const CDEWriter = require('./CDEWriter');

        try {
            console.log(`[CART] Adicionando ${driveFileId} ao carrinho ${clientCode} - VERSÃO SIMPLIFICADA`);

            // 1. Buscar ou criar produto
            let product = await UnifiedProductComplete.findOne({ driveFileId });

            if (!product) {
                const photoNumber = itemData.fileName?.match(/(\d+)/)?.[1] || 'unknown';
                product = new UnifiedProductComplete({
                    idhCode: `TEMP_${Date.now()}`,
                    photoNumber: photoNumber,
                    photoId: driveFileId,
                    driveFileId: driveFileId,
                    fileName: itemData.fileName || 'Produto',
                    category: itemData.category || 'Categoria',
                    status: 'available',
                    // REMOVIDO: currentStatus: 'available',
                    thumbnailUrl: itemData.thumbnailUrl || null
                });
                await product.save();
            }

            // 2. Verificar disponibilidade
            if (product.status !== 'available') {
                if (product.reservedBy?.clientCode !== clientCode) {
                    throw new Error('Produto não disponível');
                }
            }

            // 3. Buscar ou criar carrinho
            let cart = await Cart.findOne({ sessionId }) ||
                await Cart.findOne({ clientCode, isActive: true });

            if (!cart) {
                cart = new Cart({
                    sessionId,
                    clientCode,
                    clientName,
                    items: [],
                    isActive: true
                });
            }

            // 4. Verificar duplicata
            if (cart.hasItem(driveFileId)) {
                throw new Error('Item já está no carrinho');
            }

            // 5. Configurar expiração
            const clientConfig = await AccessCode.findOne({ code: clientCode });
            const ttlHours = clientConfig?.cartSettings?.ttlHours || 24;
            const expiresAt = new Date(Date.now() + (ttlHours * 60 * 60 * 1000));

            // 6. Adicionar ao carrinho
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

            await cart.save();
            console.log(`[CART] Carrinho salvo - ${cart.items.length} items`);

            // 7. Marcar produto como reservado
            product.status = 'reserved';
            // REMOVIDO: product.currentStatus = 'reserved';
            product.cdeStatus = 'PRE-SELECTED';
            product.reservedBy = {
                clientCode,
                sessionId,
                expiresAt
            };
            await product.save();
            console.log(`[CART] Produto reservado`);

            // 8. Atualizar CDE
            const photoNumber = itemData.fileName?.match(/(\d+)/)?.[1];
            if (photoNumber) {
                try {
                    await CDEWriter.markAsReserved(photoNumber, clientCode, clientName);
                    console.log(`[CART] CDE atualizado`);
                } catch (cdeError) {
                    console.error(`[CART] Erro no CDE: ${cdeError.message}`);
                    // Continua mesmo se CDE falhar - o sync corrige depois
                }
            }

            return {
                success: true,
                message: 'Item adicionado ao carrinho',
                cart: await this.getCartSummary(sessionId),
                expiresAt,
                timeRemaining: ttlHours * 3600
            };

        } catch (error) {
            console.error(`[CART] Erro: ${error.message}`);
            throw error;
        }
    }

    static async removeFromCart(sessionId, driveFileId) {
        try {
            console.log(`[CART] Removendo ${driveFileId} - VERSÃO SIMPLIFICADA`);

            // 1. Buscar e atualizar carrinho
            const cart = await Cart.findOne({ sessionId, isActive: true });
            if (!cart) throw new Error('Carrinho não encontrado');

            cart.items = cart.items.filter(item => item.driveFileId !== driveFileId);
            await cart.save();
            console.log(`[CART] Carrinho atualizado - ${cart.items.length} items`);

            // 2. Liberar produto
            await UnifiedProductComplete.updateOne(
                { driveFileId },
                {
                    $set: {
                        status: 'available',
                        // REMOVIDO: currentStatus: 'available',
                        cdeStatus: 'INGRESADO'
                    },
                    $unset: { reservedBy: 1 }
                }
            );
            console.log(`[CART] Produto liberado`);

            // 3. Atualizar CDE
            const photoNumber = driveFileId.match(/(\d+)/)?.[1];
            if (photoNumber) {
                await CDEWriter.markAsAvailable(photoNumber);
                console.log(`[CART] CDE atualizado`);
            }

            return {
                success: true,
                message: 'Item removido',
                cart: await this.getCartSummary(sessionId)
            };

        } catch (error) {
            console.error(`[CART] Erro: ${error.message}`);
            throw error;
        }
    }

    /**
     * PROCESSAR ITEM EXPIRADO
     * Quando detecta que um item expirou, libera instantaneamente
     */
    static async processExpiredItem(item, cart) {
        let cdeConnection = null;
        const photoNumber = this.extractPhotoNumber(item.fileName);

        try {
            console.log(`[EXPIRE] Processando item expirado: ${item.fileName}`);

            // 1. ATUALIZAÇÃO INSTANTÂNEA DO CDE
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
                        // REMOVIDO: currentStatus: 'available',
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
            let cart = await Cart.findOne({
                sessionId,
                isActive: true
            });

            if (!cart) {
                // Verificar se existe mas está inativo
                const inactiveCart = await Cart.findOne({ sessionId });

                if (inactiveCart) {
                    // Se tem items mas está inativo, REATIVAR!
                    if (inactiveCart.items && inactiveCart.items.length > 0) {
                        inactiveCart.isActive = true;
                        inactiveCart.notes = undefined;
                        await inactiveCart.save();
                        cart = inactiveCart; // Usar o cart reativado
                    }
                } else {
                    // Debug: mostrar carts ativos
                    const allCarts = await Cart.find({ isActive: true }).limit(5);
                }
            }

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

            // ADICIONE ESTE DEBUG
            if (cart) {
            }

            if (!cart) {
                return {
                    totalItems: 0,
                    items: [],
                    isEmpty: true
                };
            }

            return {
                totalItems: cart.totalItems || cart.items.length, // MUDE ESTA LINHA
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