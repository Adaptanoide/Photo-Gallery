// src/config/categoryMapping.js
// =====================================================
// MAPEAMENTO DE CATEGORIAS PRINCIPAIS
// =====================================================
// Define a estrutura hierárquica das 6 categorias principais
// e seus tipos (photo, stock, mixed)

/**
 * MAIN_CATEGORY_MAPPING
 * Mapeia as 6 categorias principais para suas subcategorias
 *
 * type: 'photo' = apenas fotos únicas (R2/Drive)
 * type: 'stock' = apenas produtos de catálogo (CatalogProduct)
 * type: 'mixed' = ambos (fotos + catálogo)
 */
const MAIN_CATEGORY_MAPPING = {
    'Natural Cowhides': {
        key: 'natural-cowhides',
        type: 'photo',
        description: 'Premium quality natural cowhide rugs from Brazil and Colombia',
        subcategories: [
            {
                key: 'brazil-best-sellers',
                name: 'Brazil Best Sellers',
                type: 'photo',
                hasMixMatch: true,
                photoCategoryPath: 'Sunshine Cowhides Actual Pictures'
            },
            {
                key: 'brazil-top-categories',
                name: 'Brazil Top Selected Categories',
                type: 'photo',
                photoCategoryPath: 'Sunshine Cowhides Actual Pictures'
            },
            {
                key: 'colombian-cowhides',
                name: 'Colombian Cowhides',
                type: 'photo',
                photoCategoryPath: 'Colombian'
            }
        ]
    },

    'Specialty Cowhides': {
        key: 'specialty-cowhides',
        type: 'mixed',
        description: 'Unique printed, metallic and dyed cowhide designs',
        subcategories: [
            {
                key: 'cowhide-with-binding',
                name: 'Cowhide with Leather Binding',
                type: 'photo',
                photoCategoryPath: 'Cowhide with Binding'
            },
            {
                key: 'printed',
                name: 'Printed Cowhides',
                type: 'stock',
                catalogCategory: 'printed'
            },
            {
                key: 'metallic',
                name: 'Devore Metallic Cowhides',
                type: 'stock',
                catalogCategory: 'metallic'
            },
            {
                key: 'dyed',
                name: 'Dyed Cowhides',
                type: 'stock',
                catalogCategory: 'dyed'
            }
        ]
    },

    'Small Accent Hides': {
        key: 'small-accent-hides',
        type: 'stock',
        description: 'Sheepskins, calfskins and other small accent pieces',
        subcategories: [
            {
                key: 'sheepskin',
                name: 'Sheepskins',
                type: 'mixed',
                catalogCategory: 'sheepskin',
                photoCategoryPath: 'Sheepskin'
            },
            {
                key: 'calfskin',
                name: 'Calfskins',
                type: 'stock',
                catalogCategory: 'calfskin'
            },
            {
                key: 'goatskin',
                name: 'Goatskins',
                type: 'stock',
                catalogCategory: 'goatskin'
            }
        ]
    },

    'Patchwork Rugs': {
        key: 'patchwork-rugs',
        type: 'mixed',
        description: 'Handcrafted patchwork and designer rugs',
        subcategories: [
            {
                key: 'chevron-rugs',
                name: 'Chevron Rugs',
                type: 'stock',
                catalogCategory: 'chevron-rugs'
            },
            {
                key: 'standard-patchwork',
                name: 'Square Rugs',
                type: 'stock',
                catalogCategory: 'standard-patchwork'
            },
            {
                key: 'runner-rugs',
                name: 'Runner Rugs',
                type: 'stock',
                catalogCategory: 'runner-rugs'
            },
            {
                key: 'bedside-rugs',
                name: 'Bedside Rugs',
                type: 'stock',
                catalogCategory: 'bedside-rugs'
            },
            {
                key: 'rodeo-rugs',
                name: 'Rodeo Rugs',
                type: 'photo',
                photoCategoryPath: 'Rodeo Rugs'
            }
        ]
    },

    'Accessories': {
        key: 'accessories',
        type: 'stock',
        description: 'Pillows, bags and leather accessories',
        subcategories: [
            {
                key: 'pillows',
                name: 'Pillows',
                type: 'stock',
                catalogCategory: 'pillows'
            },
            {
                key: 'bags-purses',
                name: 'Bags & Purses',
                type: 'stock',
                catalogCategory: 'bags-purses'
            },
            {
                key: 'table-kitchen',
                name: 'Table & Kitchen',
                type: 'stock',
                catalogCategory: 'table-kitchen'
            },
            {
                key: 'slippers',
                name: 'Slippers',
                type: 'stock',
                catalogCategory: 'slippers'
            },
            {
                key: 'scraps-diy',
                name: 'Scraps & DIY',
                type: 'stock',
                catalogCategory: 'scraps-diy'
            },
            {
                key: 'gifts-seasonal',
                name: 'Gifts & Seasonal',
                type: 'stock',
                catalogCategory: 'gifts-seasonal'
            }
        ]
    },

    'Furniture': {
        key: 'furniture',
        type: 'stock',
        description: 'Leather furniture and home decor',
        subcategories: [
            {
                key: 'pouf-ottoman',
                name: 'Pouf / Ottoman',
                type: 'stock',
                catalogCategory: 'pouf-ottoman'
            },
            {
                key: 'leather-furniture',
                name: 'Leather Furniture',
                type: 'stock',
                catalogCategory: 'leather-furniture'
            },
            {
                key: 'foot-stool',
                name: 'Foot Stool',
                type: 'stock',
                catalogCategory: 'foot-stool'
            }
        ]
    }
};

/**
 * Lista de todos os displayCategories válidos do CatalogProduct
 */
const VALID_CATALOG_CATEGORIES = [
    // Specialty Cowhides
    'printed', 'metallic', 'dyed',
    // Small Accent Hides
    'sheepskin', 'calfskin', 'goatskin',
    // Patchwork Rugs
    'chevron-rugs', 'standard-patchwork', 'runner-rugs', 'bedside-rugs',
    // Accessories
    'pillows', 'bags-purses', 'table-kitchen', 'slippers', 'scraps-diy', 'gifts-seasonal',
    // Furniture
    'pouf-ottoman', 'leather-furniture', 'foot-stool',
    // Legacy
    'designer-rugs', 'accessories', 'other'
];

/**
 * Mapeia displayCategory para categoria principal
 */
const CATALOG_TO_MAIN_CATEGORY = {
    // Specialty Cowhides
    'printed': 'Specialty Cowhides',
    'metallic': 'Specialty Cowhides',
    'dyed': 'Specialty Cowhides',
    // Small Accent Hides
    'sheepskin': 'Small Accent Hides',
    'calfskin': 'Small Accent Hides',
    'goatskin': 'Small Accent Hides',
    // Patchwork Rugs
    'chevron-rugs': 'Patchwork Rugs',
    'standard-patchwork': 'Patchwork Rugs',
    'runner-rugs': 'Patchwork Rugs',
    'bedside-rugs': 'Patchwork Rugs',
    // Accessories
    'pillows': 'Accessories',
    'bags-purses': 'Accessories',
    'table-kitchen': 'Accessories',
    'slippers': 'Accessories',
    'scraps-diy': 'Accessories',
    'gifts-seasonal': 'Accessories',
    // Furniture
    'pouf-ottoman': 'Furniture',
    'leather-furniture': 'Furniture',
    'foot-stool': 'Furniture',
    // Legacy
    'designer-rugs': 'Patchwork Rugs',
    'accessories': 'Accessories',
    'other': 'Accessories'
};

/**
 * Obtém todas as categorias de catálogo permitidas a partir de allowedCategories
 * @param {string[]} allowedCategories - Array de categorias permitidas
 * @returns {Set<string>} Set de displayCategories permitidos
 */
function getAllowedCatalogCategories(allowedCategories) {
    if (!allowedCategories || allowedCategories.length === 0) {
        // Sem restrições = todas permitidas
        return new Set(VALID_CATALOG_CATEGORIES);
    }

    const allowed = new Set();

    for (const item of allowedCategories) {
        // 1. Se é uma categoria principal (ex: "Accessories")
        if (MAIN_CATEGORY_MAPPING[item]) {
            const mainCat = MAIN_CATEGORY_MAPPING[item];
            for (const sub of mainCat.subcategories) {
                if (sub.catalogCategory) {
                    allowed.add(sub.catalogCategory);
                }
            }
            continue;
        }

        // 2. Se é um displayCategory válido (ex: "pillows")
        if (VALID_CATALOG_CATEGORIES.includes(item)) {
            allowed.add(item);
            continue;
        }

        // 3. Se é um key de subcategoria (ex: "bags-purses")
        for (const mainName of Object.keys(MAIN_CATEGORY_MAPPING)) {
            const mainCat = MAIN_CATEGORY_MAPPING[mainName];
            const sub = mainCat.subcategories.find(s => s.key === item);
            if (sub && sub.catalogCategory) {
                allowed.add(sub.catalogCategory);
                break;
            }
        }
    }

    return allowed;
}

/**
 * Verifica se um displayCategory é permitido
 * @param {string} displayCategory - A categoria a verificar
 * @param {string[]} allowedCategories - Lista de permissões do cliente
 * @returns {boolean}
 */
function isCatalogCategoryAllowed(displayCategory, allowedCategories) {
    if (!allowedCategories || allowedCategories.length === 0) {
        return true; // Sem restrições
    }

    const allowed = getAllowedCatalogCategories(allowedCategories);
    return allowed.has(displayCategory);
}

/**
 * Obtém o nome da categoria principal a partir de um displayCategory
 * @param {string} displayCategory
 * @returns {string|null}
 */
function getMainCategoryName(displayCategory) {
    return CATALOG_TO_MAIN_CATEGORY[displayCategory] || null;
}

module.exports = {
    MAIN_CATEGORY_MAPPING,
    VALID_CATALOG_CATEGORIES,
    CATALOG_TO_MAIN_CATEGORY,
    getAllowedCatalogCategories,
    isCatalogCategoryAllowed,
    getMainCategoryName
};
