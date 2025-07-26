// =====================================================
// CATEGORY DETECTOR MODULE - Detecção Inteligente de Categorias
// =====================================================

/**
 * Estratégias por categoria
 */
const CATEGORY_STRATEGIES = {
  'Brazil Best Sellers': {
    type: 'qb-based',
    hasSubcategories: true,
    hasTabs: false,
    navigation: 'simple',
    subcategories: ['Best-Value', 'Super-Promo', 'Tones-Mix']
  },
  'Brazil Top Selected Categories': {
    type: 'standard',
    hasSubcategories: true,
    hasTabs: true,
    navigation: 'tabs'
  },
  'Colombia Cowhides': {
    type: 'standard',
    hasSubcategories: true,
    hasTabs: true,
    navigation: 'tabs'
  },
  'Colombia Best Value': {
    type: 'standard',
    hasSubcategories: true,
    hasTabs: true,
    navigation: 'tabs'
  },
  'Rodeo Rugs & Round Rugs': {
    type: 'standard',
    hasSubcategories: true,
    hasTabs: true,
    navigation: 'tabs'
  },
  'Sheepskins': {
    type: 'simple',
    hasSubcategories: true,
    hasTabs: false,
    navigation: 'simple'
  },
  'Calfskins': {
    type: 'simple',
    hasSubcategories: true,
    hasTabs: false,
    navigation: 'simple'
  }
};

/**
 * Normalizar nomes de categorias (remover espaços extras)
 */
function normalizeCategory(categoryName) {
  if (!categoryName) return '';
  return categoryName.replace(/\s+/g, ' ').trim();
}

/**
 * FUNÇÃO PRINCIPAL: Detectar se categoria precisa de abas
 */
function needsSizeTabs(mainCategoryName) {
  const normalized = normalizeCategory(mainCategoryName);
  const strategy = CATEGORY_STRATEGIES[normalized];
  
  if (strategy) {
    console.log(`🎯 [DETECTOR] ${normalized}: ${strategy.hasTabs ? 'COM abas' : 'SEM abas'} (${strategy.type})`);
    return strategy.hasTabs;
  }
  
  // Fallback: detectar automaticamente por hierarquia
  return detectTabsByHierarchy(normalized);
}

/**
 * Detectar abas baseado na hierarquia (fallback)
 */
function detectTabsByHierarchy(mainCategoryName) {
  if (!window.categories || !Array.isArray(window.categories)) {
    console.log('❌ [DETECTOR] window.categories não disponível');
    return false;
  }

  const subcategoriesMap = new Map();
  let maxLevels = 0;

  window.categories.forEach(cat => {
    if (cat.isAll) return;

    const fullPath = cat.fullPath || cat.name;
    const pathParts = fullPath.split(' → ').map(part => normalizeCategory(part));

    if (pathParts[0] === mainCategoryName) {
      maxLevels = Math.max(maxLevels, pathParts.length);
      
      if (pathParts.length >= 2) {
        const subcategory = pathParts[1];
        if (!subcategoriesMap.has(subcategory)) {
          subcategoriesMap.set(subcategory, new Set());
        }
        
        if (pathParts.length >= 3) {
          const variation = pathParts[2];
          subcategoriesMap.get(subcategory).add(variation);
        }
      }
    }
  });

  const hasVariations = Array.from(subcategoriesMap.values()).some(variations => variations.size > 1);
  const needsTabs = maxLevels >= 3 && hasVariations;
  
  console.log(`🔍 [DETECTOR] ${mainCategoryName}: ${maxLevels} níveis, ${hasVariations ? 'tem' : 'não tem'} variações → ${needsTabs ? 'COM abas' : 'SEM abas'}`);
  
  return needsTabs;
}

/**
 * FUNÇÃO PRINCIPAL: Extrair tamanhos/abas disponíveis
 */
function extractAvailableSizes(mainCategory, subcategory) {
  const normalized = normalizeCategory(mainCategory);
  const strategy = CATEGORY_STRATEGIES[normalized];
  
  console.log(`📏 [DETECTOR] Extraindo abas para: ${normalized} → ${subcategory}`);
  
  if (strategy && strategy.type === 'qb-based') {
    return extractSizesForQBCategory(normalized, subcategory);
  }
  
  return extractSizesFromHierarchy(normalized, subcategory);
}

/**
 * Extrair abas para categorias baseadas em QB (Brazil Best Sellers)
 */
function extractSizesForQBCategory(mainCategory, subcategory) {
  if (mainCategory === 'Brazil Best Sellers') {
    const qbMappings = {
      'Best-Value': ['Brindle-Medium-Dark-Tones', 'Salt-Pepper-Black-White', 'Salt-Pepper-Brown-White-Tricolor', 'Salt-Pepper-Chocolate-White'],
      'Super-Promo': ['Extra-Small', 'Small'],
      'Tones-Mix': ['Dark-Tones', 'Exotic-Tones', 'Light-Tones']
    };
    
    const sizes = qbMappings[subcategory] || [];
    console.log(`🎯 [DETECTOR] QB-based abas para ${subcategory}: [${sizes.join(', ')}]`);
    return sizes;
  }
  
  return [];
}

/**
 * Extrair abas da hierarquia real (categorias padrão)
 */
function extractSizesFromHierarchy(mainCategory, subcategory) {
  if (!window.categories || !Array.isArray(window.categories)) {
    console.log('❌ [DETECTOR] window.categories não disponível');
    return [];
  }

  const sizes = new Set();

  window.categories.forEach(cat => {
    if (cat.isAll) return;

    const fullPath = cat.fullPath || cat.name;
    const pathParts = fullPath.split(' → ');

    if (pathParts.length >= 3 &&
        normalizeCategory(pathParts[0]) === mainCategory &&
        normalizeCategory(pathParts[1]) === normalizeCategory(subcategory)) {

      const size = normalizeCategory(pathParts[2]);
      sizes.add(size);
    }
  });

  const sortedSizes = Array.from(sizes).sort((a, b) => {
    const sizeOrder = {
      'Small': 1,
      'Medium': 2,
      'Medium-Large': 3,
      'Large': 4,
      'Extra-Large': 5,
      'X-Large': 6
    };
    return (sizeOrder[a] || 999) - (sizeOrder[b] || 999);
  });

  console.log(`📐 [DETECTOR] Hierarquia abas para ${subcategory}: [${sortedSizes.join(', ')}]`);
  return sortedSizes;
}

/**
 * Obter estratégia completa de uma categoria
 */
function getCategoryStrategy(mainCategoryName) {
  const normalized = normalizeCategory(mainCategoryName);
  return CATEGORY_STRATEGIES[normalized] || {
    type: 'auto-detected',
    hasSubcategories: true,
    hasTabs: detectTabsByHierarchy(normalized),
    navigation: detectTabsByHierarchy(normalized) ? 'tabs' : 'simple'
  };
}

/**
 * Obter subcategorias de uma categoria principal
 */
function getSubcategoriesForMain(mainCategoryName) {
  const normalized = normalizeCategory(mainCategoryName);
  const strategy = CATEGORY_STRATEGIES[normalized];
  
  // Se tem subcategorias predefinidas, usar elas
  if (strategy && strategy.subcategories) {
    console.log(`🎯 [DETECTOR] Subcategorias predefinidas para ${normalized}: [${strategy.subcategories.join(', ')}]`);
    return strategy.subcategories;
  }
  
  // Caso contrário, extrair da hierarquia
  return extractSubcategoriesFromHierarchy(normalized);
}

/**
 * Extrair subcategorias da hierarquia
 */
function extractSubcategoriesFromHierarchy(mainCategoryName) {
  if (!window.categories || !Array.isArray(window.categories)) {
    return [];
  }

  const subcategories = [];

  window.categories.forEach(cat => {
    if (cat.isAll) return;

    const fullPath = cat.fullPath || cat.name;
    const pathParts = fullPath.split(' → ');

    if (normalizeCategory(pathParts[0]) === mainCategoryName) {
      const subcategory = pathParts[1]?.replace(/\s+/g, ' ').trim();
      if (subcategory && !subcategories.includes(subcategory)) {
        subcategories.push(subcategory);
      }
    }
  });

  console.log(`📋 [DETECTOR] Subcategorias extraídas para ${mainCategoryName}: [${subcategories.join(', ')}]`);
  return subcategories;
}

/**
 * Verificar se categoria usa subcategorias genéricas
 */
function usesGenericSubcategories(mainCategoryName) {
  const normalized = normalizeCategory(mainCategoryName);
  const strategy = CATEGORY_STRATEGIES[normalized];
  
  return strategy && strategy.type === 'qb-based';
}

// =====================================================
// EXPORTAR FUNÇÕES
// =====================================================
export {
  needsSizeTabs,
  extractAvailableSizes,
  getCategoryStrategy,
  getSubcategoriesForMain,
  usesGenericSubcategories,
  normalizeCategory,
  CATEGORY_STRATEGIES
};

// Para compatibilidade com sistema atual (window globals)
if (typeof window !== 'undefined') {
  window.CategoryDetector = {
    needsSizeTabs,
    extractAvailableSizes,
    getCategoryStrategy,
    getSubcategoriesForMain,
    usesGenericSubcategories,
    normalizeCategory,
    CATEGORY_STRATEGIES
  };
}