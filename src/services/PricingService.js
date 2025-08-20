// src/services/PricingService.js

const PhotoCategory = require('../models/PhotoCategory');
const R2Service = require('./R2Service');
const StorageService = require('./StorageService');

class PricingService {

    // ===== MÉTODOS PRINCIPAIS =====

    /**
     * Escanear R2 e sincronizar categorias
     * @param {boolean} forceRefresh - Forçar atualização completa
     * @returns {object} Resultado da sincronização
     */
    static async scanAndSyncR2(forceRefresh = false) {
        try {
            console.log('🔄 Iniciando sincronização com R2...');

            // USAR NOVO MÉTODO QUE DETECTA PASTAS VAZIAS TAMBÉM
            const categories = await this.buildR2StructureComplete();

            console.log(`📂 ${categories.length} categorias encontradas no R2 (incluindo vazias)`);

            // Sincronizar com MongoDB
            const syncResult = await this.syncWithDatabase(categories, forceRefresh);

            return {
                success: true,
                categoriesFound: categories.length,
                ...syncResult,
                timestamp: new Date()
            };

        } catch (error) {
            console.error('❌ Erro na sincronização R2:', error);
            throw error;
        }
    }

    /**
     * MÉTODO COMPLETO - Detecta TODAS as pastas (com ou sem fotos)
     */
    static async buildR2StructureComplete() {
        try {
            console.log('🚀 [COMPLETO] Buscando estrutura completa do R2...');

            const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

            // Configurar cliente R2
            const client = new S3Client({
                region: 'auto',
                endpoint: process.env.R2_ENDPOINT,
                credentials: {
                    accessKeyId: process.env.R2_ACCESS_KEY_ID,
                    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
                },
                forcePathStyle: true
            });

            // PASSO 1: Buscar TODAS as pastas usando Delimiter
            console.log('📁 Passo 1: Listando todas as pastas...');
            const allFolders = new Set();

            // Função recursiva para buscar pastas
            const listFoldersRecursive = async (prefix = '') => {
                let continuationToken = null;

                do {
                    const command = new ListObjectsV2Command({
                        Bucket: process.env.R2_BUCKET_NAME,
                        Prefix: prefix,
                        Delimiter: '/',
                        MaxKeys: 1000,
                        ContinuationToken: continuationToken
                    });

                    const response = await client.send(command);

                    // Adicionar subpastas encontradas
                    if (response.CommonPrefixes) {
                        for (const prefixInfo of response.CommonPrefixes) {
                            const folderPath = prefixInfo.Prefix.endsWith('/')
                                ? prefixInfo.Prefix.slice(0, -1)
                                : prefixInfo.Prefix;

                            // Ignorar pastas de sistema
                            if (!folderPath.startsWith('_')) {
                                allFolders.add(folderPath);
                                // Buscar recursivamente dentro desta pasta
                                await listFoldersRecursive(prefixInfo.Prefix);
                            }
                        }
                    }

                    continuationToken = response.NextContinuationToken;
                } while (continuationToken);
            };

            // Começar busca recursiva
            await listFoldersRecursive();
            console.log(`📂 Total de pastas encontradas: ${allFolders.size}`);

            // PASSO 2: Buscar TODOS os arquivos para contar fotos
            console.log('🖼️ Passo 2: Contando fotos em cada pasta...');
            const allObjects = [];
            let continuationToken = null;

            do {
                const command = new ListObjectsV2Command({
                    Bucket: process.env.R2_BUCKET_NAME,
                    MaxKeys: 1000,
                    ContinuationToken: continuationToken
                });

                const response = await client.send(command);
                if (response.Contents) {
                    allObjects.push(...response.Contents);
                }
                continuationToken = response.NextContinuationToken;
            } while (continuationToken);

            console.log(`📦 Total de objetos: ${allObjects.length}`);

            // PASSO 3: Contar fotos por pasta
            const photoCountByFolder = {};

            for (const obj of allObjects) {
                // Ignorar thumbnails e não-imagens
                if (obj.Key.startsWith('_thumbnails/')) continue;
                if (obj.Key.endsWith('/.keep')) continue; // Ignorar .keep
                if (!/\.(jpg|jpeg|png|webp)$/i.test(obj.Key)) continue;

                // Extrair pasta
                const lastSlash = obj.Key.lastIndexOf('/');
                if (lastSlash === -1) continue;

                const folderPath = obj.Key.substring(0, lastSlash);
                photoCountByFolder[folderPath] = (photoCountByFolder[folderPath] || 0) + 1;
            }

            // PASSO 4: Identificar pastas FINAIS (sem subpastas)
            console.log('🎯 Passo 3: Identificando pastas finais...');
            const finalCategories = [];

            for (const folder of allFolders) {
                // Verificar se é pasta final (não tem subpastas)
                const hasSubfolders = Array.from(allFolders).some(f =>
                    f !== folder && f.startsWith(folder + '/')
                );

                if (!hasSubfolders) {
                    const parts = folder.split('/');
                    const category = {
                        r2Key: folder + '/',
                        folderName: parts[parts.length - 1],
                        r2Path: folder + '/',
                        photoCount: photoCountByFolder[folder] || 0, // 0 se não tem fotos
                        level: parts.length
                    };
                    finalCategories.push(category);
                }
            }

            // Ordenar por path para melhor visualização
            finalCategories.sort((a, b) => a.r2Path.localeCompare(b.r2Path));

            // Estatísticas
            const withPhotos = finalCategories.filter(c => c.photoCount > 0).length;
            const empty = finalCategories.filter(c => c.photoCount === 0).length;

            console.log(`✅ Resultado final:`);
            console.log(`   📁 Total de categorias: ${finalCategories.length}`);
            console.log(`   🖼️ Com fotos: ${withPhotos}`);
            console.log(`   📭 Vazias: ${empty}`);

            // Log das primeiras para debug
            console.log(`\n📋 Primeiras 5 categorias:`);
            finalCategories.slice(0, 5).forEach(cat => {
                const status = cat.photoCount > 0 ? `${cat.photoCount} fotos` : 'VAZIA';
                console.log(`   • ${cat.r2Path} (${status})`);
            });

            return finalCategories;

        } catch (error) {
            console.error('❌ Erro no método completo:', error);
            throw error;
        }
    }

    /**
     * Sincronizar categorias R2 com MongoDB
     */
    static async syncWithDatabase(categories, forceRefresh = false) {
        try {
            let created = 0;
            let updated = 0;
            let skipped = 0;
            let deactivated = 0;

            for (const categoryData of categories) {
                try {
                    // Buscar categoria existente (usando r2Key como ID único)
                    let category = await PhotoCategory.findOne({
                        googleDriveId: categoryData.r2Key // Usando campo existente temporariamente
                    });

                    if (!category) {
                        // Criar nova categoria
                        const displayName = categoryData.r2Path
                            .split('/')
                            .filter(p => p)
                            .join(' → ');

                        category = new PhotoCategory({
                            googleDriveId: categoryData.r2Key, // Usar r2Key como ID
                            googleDrivePath: categoryData.r2Path,
                            displayName: displayName,
                            folderName: categoryData.folderName,
                            photoCount: categoryData.photoCount,
                            basePrice: 0,
                            metadata: {
                                level: categoryData.level,
                                modifiedTime: new Date()
                            },
                            lastSync: new Date()
                        });

                        await category.save();
                        created++;
                        const status = categoryData.photoCount > 0 ? `${categoryData.photoCount} fotos` : 'VAZIA';
                        console.log(`✅ Nova categoria: ${displayName} (${status})`);

                    } else if (forceRefresh || category.photoCount !== categoryData.photoCount) {
                        // Atualizar categoria existente
                        category.photoCount = categoryData.photoCount;
                        category.lastSync = new Date();

                        await category.save();
                        updated++;
                        const status = categoryData.photoCount > 0 ? `${categoryData.photoCount} fotos` : 'VAZIA';
                        console.log(`🔄 Atualizada: ${category.displayName} (${status})`);

                    } else {
                        skipped++;
                    }

                } catch (error) {
                    console.error(`❌ Erro ao processar categoria ${categoryData.folderName}:`, error);
                }
            }

            // Desativar categorias que não existem mais no R2
            const r2Keys = categories.map(c => c.r2Key);
            const removed = await PhotoCategory.updateMany(
                {
                    googleDriveId: { $nin: r2Keys },
                    isActive: true
                },
                {
                    isActive: false
                }
            );

            deactivated = removed.modifiedCount || 0;

            const summary = {
                created,
                updated,
                skipped,
                deactivated,
                total: categories.length
            };

            console.log('✅ Sincronização concluída:', summary);
            return summary;

        } catch (error) {
            console.error('❌ Erro na sincronização com MongoDB:', error);
            throw error;
        }
    }

    /**
     * Obter estatísticas em tempo real do R2
     */
    static async getR2Statistics() {
        try {
            // Buscar do MongoDB (já sincronizado)
            const stats = await PhotoCategory.getPricingStats();

            // Adicionar informação de sincronização
            const lastSync = await PhotoCategory.findOne()
                .sort({ lastSync: -1 })
                .select('lastSync');

            return {
                ...stats,
                lastSyncDate: lastSync?.lastSync || null,
                syncStatus: 'automatic',
                needsSync: false
            };

        } catch (error) {
            console.error('❌ Erro ao buscar estatísticas:', error);
            throw error;
        }
    }

    // ===== GESTÃO DE PREÇOS =====

    /**
     * Buscar todas as categorias para interface admin
     */
    static async getAdminCategoriesList(filters = {}) {
        try {
            const query = { isActive: true };

            // Aplicar filtros
            if (filters.hasPrice !== undefined) {
                if (filters.hasPrice) {
                    query.basePrice = { $gt: 0 };
                } else {
                    query.basePrice = { $lte: 0 };
                }
            }

            if (filters.search) {
                query.$or = [
                    { displayName: { $regex: filters.search, $options: 'i' } },
                    { folderName: { $regex: filters.search, $options: 'i' } },
                    { qbItem: { $regex: filters.search, $options: 'i' } }
                ];
            }

            const categories = await PhotoCategory.find(query)
                .sort({ displayName: 1 })
                .lean();

            return categories.map(category => ({
                ...category,
                formattedPrice: category.basePrice > 0 ?
                    `$${category.basePrice.toFixed(2)}` : 'No price',
                hasCustomRules: category.discountRules && category.discountRules.length > 0
            }));

        } catch (error) {
            console.error('❌ Erro ao buscar categorias:', error);
            throw error;
        }
    }

    /**
     * Definir preço para uma categoria
     */
    static async setPriceForCategory(categoryId, price, adminUser, reason = '') {
        try {
            const category = await PhotoCategory.findById(categoryId);

            if (!category) {
                throw new Error('Categoria não encontrada');
            }

            if (!category.isActive) {
                throw new Error('Categoria inativa');
            }

            if (price < 0) {
                throw new Error('Preço não pode ser negativo');
            }

            // Atualizar preço com histórico
            category.updatePrice(price, adminUser, reason);
            await category.save();

            console.log(`💰 Preço atualizado: ${category.displayName} → $${price}`);

            return {
                success: true,
                category: category.getSummary(),
                oldPrice: category.priceHistory[category.priceHistory.length - 1]?.oldPrice || 0,
                newPrice: price,
                message: `Preço atualizado para $${price.toFixed(2)}`
            };

        } catch (error) {
            console.error('❌ Erro ao definir preço:', error);
            throw error;
        }
    }

    /**
     * Obter preço para cliente específico
     */
    static async getPriceForClient(r2Key, clientCode, quantity = 1) {
        try {
            // Buscar categoria
            const category = await PhotoCategory.findOne({
                googleDriveId: r2Key, // Ainda usando este campo temporariamente
                isActive: true
            });

            if (!category) {
                return {
                    hasPrice: false,
                    price: 0,
                    message: 'Categoria não encontrada'
                };
            }

            // Usar método do modelo para calcular preço
            const priceResult = await category.getPriceForClient(clientCode, quantity);
            const hasDiscount = priceResult.finalPrice < category.basePrice;

            return {
                hasPrice: priceResult.finalPrice > 0,
                price: priceResult.finalPrice,
                basePrice: category.basePrice,
                hasDiscount,
                discountAmount: hasDiscount ? category.basePrice - priceResult.finalPrice : 0,
                appliedRule: priceResult.appliedRule,
                ruleDetails: priceResult.ruleDetails,
                hierarchy: this.getHierarchyExplanation(priceResult.appliedRule),
                category: {
                    id: category._id,
                    displayName: category.displayName,
                    photoCount: category.photoCount
                }
            };

        } catch (error) {
            console.error('❌ Erro ao buscar preço:', error);
            throw error;
        }
    }

    /**
     * Explicação da hierarquia aplicada
     */
    static getHierarchyExplanation(appliedRule) {
        const explanations = {
            'client-custom-price': {
                priority: 1,
                badge: '🥇 CLIENT RULE',
                description: 'Custom price for this specific client',
                color: '#d4af37'
            },
            'client-discount': {
                priority: 1,
                badge: '🥇 CLIENT RULE',
                description: 'Percentage discount for this specific client',
                color: '#d4af37'
            },
            'quantity-discount': {
                priority: 2,
                badge: '🥈 QUANTITY RULE',
                description: 'Volume discount based on photo quantity',
                color: '#c0c0c0'
            },
            'base-price': {
                priority: 3,
                badge: '🥉 BASE PRICE',
                description: 'Standard category price',
                color: '#cd7f32'
            }
        };

        return explanations[appliedRule] || explanations['base-price'];
    }

    // ===== RELATÓRIOS =====

    static async generatePricingReport() {
        try {
            const stats = await PhotoCategory.getPricingStats();

            const withoutPrice = await PhotoCategory.find({
                isActive: true,
                photoCount: { $gte: 0 }, // Mudado de $gt para $gte para incluir vazias
                basePrice: { $lte: 0 }
            }).select('displayName photoCount').lean();

            const withMostDiscounts = await PhotoCategory.find({
                isActive: true,
                'discountRules.0': { $exists: true }
            }).sort({ 'discountRules': -1 }).limit(10).lean();

            return {
                statistics: stats,
                categoriesWithoutPrice: withoutPrice,
                categoriesWithMostDiscounts: withMostDiscounts,
                generatedAt: new Date()
            };

        } catch (error) {
            console.error('❌ Erro ao gerar relatório:', error);
            throw error;
        }
    }

    // ===== UTILITÁRIOS =====

    static validatePricingData(pricesData) {
        const errors = [];
        const valid = [];

        pricesData.forEach((item, index) => {
            try {
                if (!item.categoryId) {
                    errors.push(`Item ${index}: categoryId é obrigatório`);
                    return;
                }

                if (typeof item.price !== 'number' || item.price < 0) {
                    errors.push(`Item ${index}: preço deve ser número não negativo`);
                    return;
                }

                valid.push(item);

            } catch (error) {
                errors.push(`Item ${index}: ${error.message}`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors,
            validItems: valid,
            summary: {
                total: pricesData.length,
                valid: valid.length,
                errors: errors.length
            }
        };
    }
}

module.exports = PricingService;