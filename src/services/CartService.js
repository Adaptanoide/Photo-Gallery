// src/services/CartService.js
// ✅ VERSÃO ATUALIZADA - Busca Sales Rep e passa para CDEWriter
// MODIFICAÇÃO PRINCIPAL: Linha ~65 - Buscar AccessCode para obter salesRep

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

            // Extrair número da foto UMA ÚNICA VEZ
            const photoNumber = itemData.fileName?.match(/(\d+)/)?.[1] || 'unknown';

            // 🆕 BUSCAR ACCESSCODE UMA ÚNICA VEZ E PEGAR TUDO
            console.log(`[CART] 🔍 Buscando configurações do cliente ${clientCode}...`);
            const accessCode = await AccessCode.findOne({ code: clientCode });
            const salesRep = accessCode?.salesRep || 'Unassigned';
            const ttlHours = accessCode?.cartSettings?.ttlHours || 24; // 🆕 JÁ PEGA AQUI!
            console.log(`[CART] 👤 Sales Rep: ${salesRep} | TTL: ${ttlHours}h`);

            // 1. Buscar ou criar produto
            let product = await UnifiedProductComplete.findOne({ driveFileId });

            // ✅ NOVO: Detectar se é Coming Soon
            const isComingSoon = product?.transitStatus === 'coming_soon';
            const cdeTable = product?.cdeTable || 'tbinventario';
            console.log(`[CART] 📦 Tipo: ${isComingSoon ? 'COMING SOON' : 'AVAILABLE'} | Tabela: ${cdeTable}`);

            if (!product) {
                product = new UnifiedProductComplete({
                    idhCode: `TEMP_${Date.now()}`,
                    photoNumber: photoNumber,
                    photoId: driveFileId,
                    driveFileId: driveFileId,
                    fileName: itemData.fileName || 'Produto',
                    category: itemData.category || 'Categoria',
                    status: 'available',
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

            // 4. Verificar duplicata (3 formas - mais robusto)

            const isDuplicate = cart.items.some(item =>
                item.driveFileId === driveFileId ||
                item.fileName === product.fileName ||
                (photoNumber && item.fileName?.includes(photoNumber))
            );

            if (isDuplicate) {
                console.log(`[CART] ✅ Duplicata ignorada: ${product.fileName}`);

                // Retorna sucesso (não é erro para o cliente)
                const validItems = cart.items.filter(i => !i.ghostStatus || i.ghostStatus !== 'ghost');
                return {
                    success: true,
                    message: 'Item já está no carrinho',
                    isDuplicate: true,
                    cart: {
                        totalItems: validItems.length,
                        items: cart.items,
                        isEmpty: validItems.length === 0
                    }
                };
            }

            // 5. 🆕 DEFINIR EXPIRAÇÃO (Coming Soon = null)
            const expiresAt = isComingSoon ? null : new Date(Date.now() + (ttlHours * 60 * 60 * 1000));
            console.log(`[CART] Expiração: ${expiresAt ? expiresAt.toISOString() : 'SEM EXPIRAÇÃO (Coming Soon)'}`);

            // 6. Adicionar ao carrinho
            cart.items.push({
                productId: product._id,
                driveFileId: product.driveFileId,
                fileName: product.fileName,
                category: (itemData.category || product.category || '').replace(/\//g, ' → '),
                thumbnailUrl: itemData.thumbnailUrl || product.thumbnailUrl || `https://images.sunshinecowhides-gallery.com/_thumbnails/${product.driveFileId}`,
                pathLevels: itemData.pathLevels || [],
                fullPath: itemData.fullPath || '',
                price: itemData.price || 0,
                basePrice: itemData.basePrice || 0,
                expiresAt,
                addedAt: new Date(),
                // ✅ NOVO: Campos Coming Soon
                transitStatus: product.transitStatus === 'coming_soon' ? 'coming_soon' : null,
                cdeTable: cdeTable,
                isComingSoon: isComingSoon,
            });

            await cart.save();
            console.log(`[CART] Carrinho salvo - ${cart.items.length} items`);

            // 7. Marcar produto como reservado
            product.status = 'reserved';
            product.cdeStatus = 'PRE-SELECTED';
            product.reservedBy = {
                clientCode,
                sessionId,
                expiresAt
            };
            await product.save();
            console.log(`[CART] Produto reservado`);

            // 8. 🆕 Atualizar CDE EM BACKGROUND COM SALES REP
            if (photoNumber) {
                console.log(`[CART] 🎯 Vai reservar foto ${photoNumber} em ${cdeTable}`);  // ← ADICIONAR
                // 🚀 EXECUÇÃO ASSÍNCRONA - NÃO ESPERA RESPOSTA!
                CDEWriter.markAsReserved(photoNumber, clientCode, clientName, salesRep, cdeTable)
                    .then(() => {
                        console.log(`[CDE] ✅ Foto ${photoNumber} reservada em background para ${clientName}(${salesRep})`);
                    })
                    .catch(cdeError => {
                        console.error(`[CDE] ⚠️ Erro em background: ${cdeError.message}`);
                        // Sync vai corrigir depois
                    });

                console.log(`[CART] CDE será atualizado em background com Sales Rep: ${salesRep}`);
            }

            // 9. 🆕 RETORNAR DADOS DIRETOS (sem getCartSummary!)
            const validItems = cart.items.filter(i => !i.ghostStatus || i.ghostStatus !== 'ghost');

            return {
                success: true,
                message: 'Item adicionado ao carrinho',
                // 🆕 DADOS CALCULADOS DIRETO (sem query extra!)
                cart: {
                    totalItems: validItems.length,
                    items: cart.items.map(item => ({
                        driveFileId: item.driveFileId,
                        fileName: item.fileName,
                        category: item.category,
                        thumbnailUrl: item.thumbnailUrl,
                        price: item.price,
                        basePrice: item.basePrice,
                        expiresAt: item.expiresAt,
                        timeRemaining: Math.max(0, Math.floor((new Date(item.expiresAt) - new Date()) / 1000)),
                        ghostStatus: item.ghostStatus || null
                    })),
                    isEmpty: validItems.length === 0,
                    lastActivity: cart.lastActivity
                },
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

            // 1. Buscar carrinho e verificar se é um ghost item
            const cart = await Cart.findOne({ sessionId, isActive: true });
            if (!cart) throw new Error('Carrinho não encontrado');

            // Encontrar o item específico para verificar se é ghost
            const itemToRemove = cart.items.find(item => item.driveFileId === driveFileId);
            const isGhostItem = itemToRemove && itemToRemove.ghostStatus === 'ghost';

            if (isGhostItem) {
                console.log(`[CART] Item é um ghost - removendo sem alterar CDE`);
            }

            // 2. Remover do carrinho
            cart.items = cart.items.filter(item => item.driveFileId !== driveFileId);
            await cart.save();
            console.log(`[CART] Carrinho atualizado - ${cart.items.length} items`);

            // 3. APENAS SE NÃO FOR GHOST: Liberar produto e atualizar CDE
            if (!isGhostItem) {
                // ✅ DETECTAR SE É COMING SOON
                const isComingSoonItem = itemToRemove?.transitStatus === 'coming_soon';
                const correctCDEStatus = isComingSoonItem ? 'PRE-TRANSITO' : 'INGRESADO';

                // Liberar no MongoDB
                await UnifiedProductComplete.updateOne(
                    { driveFileId },
                    {
                        $set: {
                            status: 'available',
                            cdeStatus: correctCDEStatus  // ✅ MUDOU AQUI!
                        },
                        $unset: { reservedBy: 1 }
                    }
                );
                console.log(`[CART] Produto liberado com status: ${correctCDEStatus}`);  // ✅ MUDOU AQUI!

                // 🚀 Atualizar CDE EM BACKGROUND (não esperar)
                const fileName = driveFileId.split('/').pop();
                const photoNumber = fileName.match(/(\d+)/)?.[1];
                if (photoNumber) {
                    // ✅ DETECTAR TABELA DO ITEM REMOVIDO
                    const cdeTable = itemToRemove?.cdeTable || 'tbinventario';
                    console.log(`[CART] 🎯 Vai liberar foto ${photoNumber} em ${cdeTable}`);

                    // EXECUÇÃO ASSÍNCRONA - NÃO ESPERA RESPOSTA!
                    CDEWriter.markAsAvailable(photoNumber, cdeTable)  // ✅ PASSAR TABELA
                        .then(() => {
                            console.log(`[CDE] ✅ Foto ${photoNumber} liberada em background de ${cdeTable}`);
                        })
                        .catch(cdeError => {
                            console.error(`[CDE] ⚠️ Erro ao liberar em background: ${cdeError.message}`);
                            // Sync vai corrigir depois
                        });

                    console.log(`[CART] CDE será liberado em background de ${cdeTable}`);
                }
            } else {
                // Para ghost items, apenas limpar a reserva local sem mudar status
                await UnifiedProductComplete.updateOne(
                    { driveFileId },
                    {
                        $unset: {
                            reservedBy: 1,
                            ghostNotification: 1
                        }
                    }
                );
                console.log(`[CART] Ghost item removido - CDE mantido como ${itemToRemove.ghostReason}`);
            }

            return {
                success: true,
                message: isGhostItem ? 'Ghost item acknowledged and removed' : 'Item removed',
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
 * Limpar duplicatas do carrinho (mantém apenas primeira ocorrência)
 * Retorna: { cleaned: boolean, removedCount: number, uniqueItems: array }
 */
    static cleanDuplicates(items) {
        const seen = new Map(); // fileName -> primeira ocorrência
        const uniqueItems = [];
        let removedCount = 0;

        items.forEach(item => {
            const key = item.fileName;

            if (!seen.has(key)) {
                // Primeira vez vendo esta foto - manter
                seen.set(key, true);
                uniqueItems.push(item);
            } else {
                // Duplicata - contar mas não adicionar
                removedCount++;
                console.log(`[CART-CLEAN] 🧹 Duplicata removida: ${item.fileName}`);
            }
        });

        return {
            cleaned: removedCount > 0,
            removedCount,
            uniqueItems
        };
    }

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

            // 🆕 AUTO-LIMPEZA DE DUPLICATAS
            const cleanResult = this.cleanDuplicates(cart.items);

            if (cleanResult.cleaned) {
                console.log(`[CART-CLEAN] 🧹 ${cleanResult.removedCount} duplicatas removidas do carrinho`);
                cart.items = cleanResult.uniqueItems;
                await cart.save();
                console.log(`[CART-CLEAN] ✅ Carrinho limpo e salvo - ${cart.items.length} items únicos`);
            }

            // ✅ FILTRAR GHOST ITEMS PARA CONTAGEM
            const validItems = cart.items.filter(item =>
                !item.ghostStatus || item.ghostStatus !== 'ghost'
            );

            return {
                totalItems: validItems.length, // ✅ CORRIGIDO - conta só válidos
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
                        Math.max(0, Math.floor((new Date(item.expiresAt) - new Date()) / 1000)) : 0,
                    ghostStatus: item.ghostStatus || null,
                    ghostReason: item.ghostReason || null,
                    ghostedAt: item.ghostedAt || null,
                    hasPrice: item.hasPrice || false,
                    formattedPrice: item.formattedPrice || ''
                })),
                isEmpty: validItems.length === 0, // ✅ baseado em items válidos
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
     * MARCAR ITEM COMO GHOST
     * Usado quando o sync detecta conflito com CDE
     */
    static async markItemAsGhost(clientCode, fileName, reason = 'Item reserved by another channel') {
        try {
            console.log(`[GHOST] Marcando ${fileName} como ghost para cliente ${clientCode}`);

            // Buscar carrinho ativo do cliente
            const cart = await Cart.findOne({
                clientCode,
                isActive: true,
                'items.fileName': fileName
            });

            if (!cart) {
                console.log(`[GHOST] Carrinho não encontrado para ${clientCode}`);
                return false;
            }

            // Encontrar e marcar o item específico
            let itemMarked = false;
            cart.items = cart.items.map(item => {
                if (item.fileName === fileName) {
                    item.ghostStatus = 'ghost';
                    item.ghostReason = reason;
                    item.ghostedAt = new Date();
                    item.originalPrice = item.price || item.basePrice;
                    // Zerar preço para não contar no total
                    item.price = 0;
                    item.hasPrice = false;
                    itemMarked = true;
                    console.log(`[GHOST] ✔ Item ${fileName} marcado como ghost`);
                }
                return item;
            });

            if (itemMarked) {
                await cart.save();

                // Notificar o frontend através de uma flag especial
                // que será detectada no próximo polling
                await UnifiedProductComplete.updateOne(
                    { fileName },
                    {
                        $set: {
                            ghostNotification: {
                                clientCode,
                                timestamp: new Date(),
                                reason
                            }
                        }
                    }
                );

                return true;
            }

            return false;

        } catch (error) {
            console.error(`[GHOST] Erro ao marcar item como ghost:`, error);
            return false;
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