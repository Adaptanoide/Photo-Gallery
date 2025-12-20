// src/routes/catalog.js
/**
 * CATALOG ROUTES - Sunshine Cowhides
 * ===================================
 * Rotas para produtos de catálogo (Designer Rugs, Accessories, etc.)
 * Estes produtos são baseados em quantidade, não em foto individual.
 */

const express = require('express');
const router = express.Router();
const CatalogProduct = require('../models/CatalogProduct');
const CDEQueries = require('../ai/CDEQueries');

// Instância do CDEQueries
const cdeQueries = new CDEQueries();

/**
 * Mapear displayCategory para categorias do CDE
 */
const CATEGORY_MAP = {
    'designer-rugs': ['DESIGNER RUG', 'RODEO RUG'],
    'accessories': ['ACCESORIOS', 'ACCESORIO', 'PILLOW', 'SHEEPSKIN', 'SMALL HIDES']
};

/**
 * Mapear categoria CDE para displayCategory
 */
function mapToDisplayCategory(cdeCategory) {
    if (!cdeCategory) return 'accessories';
    const upper = cdeCategory.toUpperCase();
    if (upper.includes('DESIGNER') || upper.includes('RODEO')) return 'designer-rugs';
    return 'accessories';
}

// ============================================
// GET /api/catalog/products
// Listar produtos de catálogo
// ============================================
router.get('/products', async (req, res) => {
    try {
        const { category } = req.query;

        console.log(`📦 [CATALOG] Fetching products for category: ${category || 'ALL'}`);

        // Buscar produtos do MongoDB primeiro
        let products = await CatalogProduct.find({
            currentStock: { $gt: 0 }
        }).sort({ category: 1, name: 1 });

        // Se não houver no MongoDB, buscar do CDE
        if (products.length === 0) {
            console.log('📦 No products in MongoDB, fetching from CDE...');

            const cdeProducts = await cdeQueries.getAllCatalogProducts();

            if (cdeProducts && cdeProducts.length > 0) {
                // Mapear e salvar no MongoDB
                const bulkOps = cdeProducts.map(p => ({
                    updateOne: {
                        filter: { qbItem: p.qbItem },
                        update: {
                            $set: {
                                qbItem: p.qbItem,
                                name: p.name || p.qbItem,
                                category: p.category || 'General',
                                origin: p.origin || null,
                                displayCategory: mapToDisplayCategory(p.category),
                                currentStock: parseInt(p.stock) || 0,
                                basePrice: parseFloat(p.basePrice) || 0,
                                lastCDESync: new Date()
                            }
                        },
                        upsert: true
                    }
                }));

                await CatalogProduct.bulkWrite(bulkOps);
                console.log(`📦 Synced ${cdeProducts.length} products to MongoDB`);

                // Recarregar do MongoDB
                products = await CatalogProduct.find({
                    currentStock: { $gt: 0 }
                }).sort({ category: 1, name: 1 });
            }
        }

        // Filtrar por categoria se especificada
        if (category && CATEGORY_MAP[category]) {
            const allowedCategories = CATEGORY_MAP[category];
            products = products.filter(p =>
                allowedCategories.some(c =>
                    (p.category || '').toUpperCase().includes(c.toUpperCase())
                )
            );
        }

        console.log(`📦 [CATALOG] Returning ${products.length} products`);

        res.json({
            success: true,
            products: products.map(p => ({
                qbItem: p.qbItem,
                name: p.name,
                category: p.category,
                origin: p.origin,
                displayCategory: p.displayCategory,
                currentStock: p.currentStock,
                basePrice: p.basePrice,
                imageUrl: p.imageUrl || null,
                participatesInMixMatch: false // Catálogo NUNCA participa
            })),
            total: products.length,
            category: category || 'all'
        });

    } catch (error) {
        console.error('❌ Error fetching catalog products:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================
// GET /api/catalog/products/:qbItem
// Detalhes de um produto específico
// ============================================
router.get('/products/:qbItem', async (req, res) => {
    try {
        const { qbItem } = req.params;

        let product = await CatalogProduct.findOne({ qbItem });

        if (!product) {
            // Tentar buscar do CDE
            const cdeProduct = await cdeQueries.getCatalogProductDetails(qbItem);

            if (cdeProduct) {
                product = await CatalogProduct.findOneAndUpdate(
                    { qbItem },
                    {
                        $set: {
                            qbItem: cdeProduct.qbItem,
                            name: cdeProduct.name || cdeProduct.qbItem,
                            category: cdeProduct.category,
                            origin: cdeProduct.origin,
                            displayCategory: mapToDisplayCategory(cdeProduct.category),
                            currentStock: cdeProduct.availableStock || 0,
                            basePrice: cdeProduct.basePrice || 0,
                            lastCDESync: new Date()
                        }
                    },
                    { upsert: true, new: true }
                );
            }
        }

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            product: {
                qbItem: product.qbItem,
                name: product.name,
                category: product.category,
                origin: product.origin,
                displayCategory: product.displayCategory,
                currentStock: product.currentStock,
                basePrice: product.basePrice,
                imageUrl: product.imageUrl || null,
                participatesInMixMatch: false
            }
        });

    } catch (error) {
        console.error('❌ Error fetching catalog product:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================
// GET /api/catalog/stock/:qbItem
// Verificar estoque em tempo real
// ============================================
router.get('/stock/:qbItem', async (req, res) => {
    try {
        const { qbItem } = req.params;

        // Buscar direto do CDE para ter dados atualizados
        const stockInfo = await cdeQueries.getCatalogProductStock(qbItem);

        // Atualizar MongoDB
        await CatalogProduct.updateOne(
            { qbItem },
            {
                $set: {
                    currentStock: stockInfo.available || 0,
                    lastCDESync: new Date()
                }
            }
        );

        res.json({
            success: true,
            qbItem,
            stock: stockInfo.available || 0,
            reserved: stockInfo.reserved || 0,
            total: stockInfo.stock || 0
        });

    } catch (error) {
        console.error('❌ Error checking stock:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================
// GET /api/catalog/categories
// Listar categorias disponíveis
// ============================================
router.get('/categories', async (req, res) => {
    try {
        const categories = await cdeQueries.getCatalogCategories();

        res.json({
            success: true,
            categories: categories.map(c => ({
                name: c.category,
                productCount: c.productCount,
                totalStock: c.totalStock,
                displayCategory: mapToDisplayCategory(c.category)
            }))
        });

    } catch (error) {
        console.error('❌ Error fetching categories:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================
// POST /api/catalog/sync
// Forçar sincronização do CDE (admin only)
// ============================================
router.post('/sync', async (req, res) => {
    try {
        console.log('🔄 [CATALOG] Starting manual sync from CDE...');

        const cdeProducts = await cdeQueries.getAllCatalogProducts();

        if (!cdeProducts || cdeProducts.length === 0) {
            return res.json({
                success: true,
                message: 'No products found in CDE',
                synced: 0
            });
        }

        const bulkOps = cdeProducts.map(p => ({
            updateOne: {
                filter: { qbItem: p.qbItem },
                update: {
                    $set: {
                        qbItem: p.qbItem,
                        name: p.name || p.qbItem,
                        category: p.category || 'General',
                        origin: p.origin || null,
                        displayCategory: mapToDisplayCategory(p.category),
                        currentStock: parseInt(p.stock) || 0,
                        basePrice: parseFloat(p.basePrice) || 0,
                        lastCDESync: new Date()
                    }
                },
                upsert: true
            }
        }));

        const result = await CatalogProduct.bulkWrite(bulkOps);

        console.log(`✅ [CATALOG] Synced ${cdeProducts.length} products`);

        res.json({
            success: true,
            message: `Synced ${cdeProducts.length} products from CDE`,
            synced: cdeProducts.length,
            upserted: result.upsertedCount,
            modified: result.modifiedCount
        });

    } catch (error) {
        console.error('❌ Error syncing catalog:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
