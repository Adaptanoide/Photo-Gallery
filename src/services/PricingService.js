//src/services/PricingService.js

const PhotoCategory = require('../models/PhotoCategory');

class PricingService {

    // ===== CONFIGURAÇÕES =====
    static DRIVE_FOLDER_ROOT = process.env.DRIVE_FOLDER_AVAILABLE || '1Ky3wSKKg_mmQihdxmiYwMuqE3-SBTcbx';

    // ===== MÉTODOS PRINCIPAIS =====

    /**
     * Escanear R2 e identificar pastas com fotos
     * @param {boolean} forceRefresh - Forçar nova sincronização
     * @returns {object} Resultado da sincronização
     */
    static async scanAndSyncDrive(forceRefresh = false) {
        try {
            console.log('🔍 Iniciando escaneamento do R2...');

            // Usar StorageService para R2
            const StorageService = require('./StorageService');
            const result = await StorageService.getSubfolders('');

            console.log(`📂 Encontradas ${result.folders?.length || 0} pastas no R2`);

            // Por enquanto, retornar estrutura básica
            // TODO: Implementar sincronização completa com R2
            return {
                success: true,
                structure: result,
                foldersWithPhotos: [],
                sync: { created: 0, updated: 0, skipped: 0 },
                timestamp: new Date(),
                message: 'R2 sync em desenvolvimento'
            };
        } catch (error) {
            console.error('❌ Erro no escaneamento do R2:', error);
            throw error;
        }
    }

    /**
     * Extrair recursivamente todas as pastas finais (folhas da árvore)
     * @param {object} structure - Estrutura do Google Drive
     * @returns {array} Array de pastas finais (com ou sem fotos)
     */
    static extractFoldersWithPhotos(structure) {
        const foldersWithPhotos = [];

        function extract(node) {
            // Se é uma pasta final (folha), adicionar à lista independente de ter fotos
            if (node.subfolders.length === 0) {
                foldersWithPhotos.push({
                    googleDriveId: node.id,
                    folderName: node.name,
                    googleDrivePath: node.googleDrivePath,
                    photoCount: node.photoCount || 0, // Aceitar 0 fotos
                    level: node.level,
                    modifiedTime: node.modifiedTime
                });
            }

            // Processar subpastas recursivamente
            if (node.subfolders && node.subfolders.length > 0) {
                node.subfolders.forEach(subfolder => extract(subfolder));
            }
        }

        extract(structure);
        return foldersWithPhotos;
    }

    /**
     * Sincronizar pastas encontradas com banco de dados
     * @param {array} foldersWithPhotos - Pastas com fotos do Google Drive
     * @param {boolean} forceRefresh - Forçar atualização
     * @returns {object} Resultado da sincronização
     */
    static async syncWithDatabase(foldersWithPhotos, forceRefresh = false) {
        try {
            console.log('💾 Sincronizando com banco de dados...');

            let created = 0;
            let updated = 0;
            let skipped = 0;
            let errors = 0;

            for (const folderData of foldersWithPhotos) {
                try {
                    // Verificar se categoria já existe
                    let category = await PhotoCategory.findByDriveId(folderData.googleDriveId);

                    if (!category) {
                        // Criar nova categoria

                        // 🛠️ CORREÇÃO: Criar displayName explicitamente
                        const pathParts = folderData.googleDrivePath.split('/').filter(part => part.trim() !== '');
                        const displayName = pathParts.join(' → ');

                        category = new PhotoCategory({
                            googleDriveId: folderData.googleDriveId,
                            googleDrivePath: folderData.googleDrivePath,
                            displayName: displayName, // ✅ NOVA LINHA ADICIONADA
                            folderName: folderData.folderName,
                            googleDriveId: folderData.googleDriveId,
                            googleDrivePath: folderData.googleDrivePath,
                            folderName: folderData.folderName,
                            photoCount: folderData.photoCount,
                            metadata: {
                                level: folderData.level,
                                modifiedTime: folderData.modifiedTime
                            },
                            basePrice: 0, // Preço padrão
                            lastSync: new Date()
                        });

                        await category.save();
                        created++;

                        console.log(`✅ Categoria criada: ${category.displayName} (${category.photoCount} fotos)`);

                    } else {
                        // Verificar se precisa atualizar
                        const needsUpdate = forceRefresh ||
                            category.photoCount !== folderData.photoCount ||
                            category.googleDrivePath !== folderData.googleDrivePath;

                        if (needsUpdate) {
                            category.photoCount = folderData.photoCount;
                            category.googleDrivePath = folderData.googleDrivePath;
                            category.folderName = folderData.folderName;
                            category.metadata.level = folderData.level;
                            category.metadata.modifiedTime = folderData.modifiedTime;
                            category.lastSync = new Date();

                            await category.save();
                            updated++;

                            console.log(`🔄 Categoria atualizada: ${category.displayName} (${category.photoCount} fotos)`);
                        } else {
                            skipped++;
                        }
                    }

                } catch (error) {
                    console.error(`❌ Erro ao processar pasta ${folderData.folderName}:`, error);
                    errors++;
                }
            }

            // Identificar categorias removidas (que não existem mais no Drive)
            const driveIds = foldersWithPhotos.map(f => f.googleDriveId);
            const removedCategories = await PhotoCategory.find({
                googleDriveId: { $nin: driveIds },
                isActive: true
            });

            // Desativar categorias removidas (não deletar para manter histórico)
            let deactivated = 0;
            for (const category of removedCategories) {
                category.isActive = false;
                await category.save();
                deactivated++;
                console.log(`⚠️ Categoria desativada (removida do Drive): ${category.displayName}`);
            }

            const summary = {
                created,
                updated,
                skipped,
                deactivated,
                errors,
                total: foldersWithPhotos.length
            };

            console.log('✅ Sincronização concluída:', summary);

            return {
                success: true,
                summary,
                timestamp: new Date()
            };

        } catch (error) {
            console.error('❌ Erro na sincronização com banco:', error);
            throw error;
        }
    }

    // ===== GESTÃO DE PREÇOS =====

    /**
     * Buscar todas as categorias para interface admin
     * @param {object} filters - Filtros opcionais
     * @returns {array} Lista de categorias
     */
    static async getAdminCategoriesList(filters = {}) {
        try {
            const query = { isActive: true, photoCount: { $gte: 0 } };

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
                    { googleDrivePath: { $regex: filters.search, $options: 'i' } }
                ];
            }

            const categories = await PhotoCategory.find(query)
                .sort({ displayName: 1 })
                .lean();

            return categories.map(category => ({
                ...category,
                formattedPrice: category.basePrice > 0 ?
                    `R$ ${category.basePrice.toFixed(2)}` : 'Sem preço',
                hasCustomRules: category.discountRules && category.discountRules.length > 0
            }));

        } catch (error) {
            console.error('❌ Erro ao buscar categorias para admin:', error);
            throw error;
        }
    }

    /**
     * Definir preço para uma categoria
     * @param {string} categoryId - ID da categoria
     * @param {number} price - Novo preço
     * @param {string} adminUser - Usuário admin
     * @param {string} reason - Motivo da alteração
     * @returns {object} Resultado da operação
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

            console.log(`💰 Preço atualizado: ${category.displayName} → R$ ${price}`);

            return {
                success: true,
                category: category.getSummary(),
                oldPrice: category.priceHistory[category.priceHistory.length - 1]?.oldPrice || 0,
                newPrice: price,
                message: `Preço atualizado para R$ ${price.toFixed(2)}`
            };

        } catch (error) {
            console.error('❌ Erro ao definir preço:', error);
            throw error;
        }
    }

    /**
     * Obter preço para cliente específico com hierarquia inteligente
     * @param {string} googleDriveId - ID da pasta no Google Drive
     * @param {string} clientCode - Código do cliente
     * @param {number} quantity - Quantidade de fotos (padrão: 1)
     * @returns {object} Informações detalhadas de preço
     */
    static async getPriceForClient(googleDriveId, clientCode, quantity = 1) {
        try {
            const category = await PhotoCategory.findByDriveId(googleDriveId);

            if (!category || !category.isActive) {
                return {
                    hasPrice: false,
                    price: 0,
                    message: 'Categoria não encontrada ou inativa'
                };
            }

            // Usar novo método com hierarquia
            const priceResult = await category.getPriceForClient(clientCode, quantity);
            const hasDiscount = priceResult.finalPrice < category.basePrice;

            return {
                hasPrice: priceResult.finalPrice > 0,
                price: priceResult.finalPrice,
                basePrice: category.basePrice,
                hasDiscount,
                discountAmount: hasDiscount ? category.basePrice - priceResult.finalPrice : 0,

                // 🆕 NOVAS INFORMAÇÕES HIERÁRQUICAS
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
            console.error('❌ Erro ao buscar preço para cliente:', error);
            throw error;
        }
    }

    /**
     * Explicação da hierarquia aplicada
     * @param {string} appliedRule - Regra aplicada
     * @returns {object} Explicação da hierarquia
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

    // ===== RELATÓRIOS E ESTATÍSTICAS =====

    /**
     * Gerar relatório completo de preços
     * @returns {object} Relatório detalhado
     */
    static async generatePricingReport() {
        try {
            const stats = await PhotoCategory.getPricingStats();

            // Categorias sem preço
            const withoutPrice = await PhotoCategory.find({
                isActive: true,
                photoCount: { $gt: 0 },
                basePrice: { $lte: 0 }
            }).select('displayName photoCount').lean();

            // Categorias com mais descontos personalizados
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

    /**
     * Validar estrutura de preços antes de aplicar
     * @param {array} pricesData - Array com dados de preços
     * @returns {object} Resultado da validação
     */
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
                    errors.push(`Item ${index}: preço deve ser um número não negativo`);
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