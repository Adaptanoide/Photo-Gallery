// src/config/constants.js
// Constantes centralizadas para evitar duplicação e magic numbers

// ============================================
// TEMPO E EXPIRAÇÃO
// ============================================
const TIME = {
    SECONDS_IN_MINUTE: 60,
    MINUTES_IN_HOUR: 60,
    HOURS_IN_DAY: 24,
    DAYS_IN_WEEK: 7,

    // Milissegundos
    MS_PER_SECOND: 1000,
    MS_PER_MINUTE: 60 * 1000,
    MS_PER_HOUR: 60 * 60 * 1000,
    MS_PER_DAY: 24 * 60 * 60 * 1000,
    MS_PER_WEEK: 7 * 24 * 60 * 60 * 1000,
    MS_30_DAYS: 30 * 24 * 60 * 60 * 1000,
};

// ============================================
// CARRINHO
// ============================================
const CART = {
    DEFAULT_TTL_HOURS: 24,
    DEFAULT_EXPIRATION_MS: 24 * 60 * 60 * 1000,
    MAX_ITEMS: 1000,
};

// ============================================
// SELEÇÕES
// ============================================
const SELECTION = {
    RESERVATION_EXPIRATION_MS: 24 * 60 * 60 * 1000,
    DOWNLOAD_TOKEN_EXPIRATION_MS: 7 * 24 * 60 * 60 * 1000,
    DOWNLOAD_TOKEN_EXPIRATION_DAYS: 7,
};

// ============================================
// MIX & MATCH - Categorias Globais
// ============================================
const MIX_MATCH = {
    GLOBAL_CATEGORIES: [
        'Colombian Cowhides',
        'Brazil Best Sellers',
        'Brazil Top Selected Categories'
    ],

    // Verifica se categoria participa do Mix & Match global
    isGlobalCategory: function(categoryPath) {
        if (!categoryPath) return false;
        const mainCategory = categoryPath.split('/')[0].trim();
        return this.GLOBAL_CATEGORIES.some(mixCat =>
            mainCategory.includes(mixCat) || mixCat.includes(mainCategory)
        );
    }
};

// ============================================
// TIERS DE PREÇO
// ============================================
const PRICE_TIERS = {
    TIER_1: { min: 1, max: 5, name: 'Tier 1' },
    TIER_2: { min: 6, max: 12, name: 'Tier 2' },
    TIER_3: { min: 13, max: 36, name: 'Tier 3' },
    TIER_4: { min: 37, max: 999, name: 'Tier 4' },

    // Calcula tier baseado na quantidade
    getTier: function(quantity) {
        if (quantity >= 37) return this.TIER_4;
        if (quantity >= 13) return this.TIER_3;
        if (quantity >= 6) return this.TIER_2;
        return this.TIER_1;
    },

    // Retorna nome do tier
    getTierName: function(quantity) {
        return this.getTier(quantity).name;
    }
};

// ============================================
// STATUS DE PRODUTOS (CDE)
// ============================================
const CDE_STATUS = {
    INGRESADO: 'INGRESADO',
    PRE_SELECTED: 'PRE-SELECTED',
    CONFIRMED: 'CONFIRMED',
    RESERVED: 'RESERVED',
    RETIRADO: 'RETIRADO',
    STANDBY: 'STANDBY',
    PRE_TRANSITO: 'PRE-TRANSITO',
    TRANSITO: 'TRANSITO',
    WAREHOUSE: 'WAREHOUSE',

    // Status que indicam disponível
    AVAILABLE_STATUSES: ['INGRESADO', 'WAREHOUSE', 'PRE-TRANSITO', 'TRANSITO'],

    // Status que indicam reservado/em uso
    RESERVED_STATUSES: ['PRE-SELECTED', 'RESERVED', 'CONFIRMED'],
};

// ============================================
// STATUS DE PRODUTOS (MongoDB)
// ============================================
const PRODUCT_STATUS = {
    AVAILABLE: 'available',
    RESERVED: 'reserved',
    RESERVED_PENDING: 'reserved_pending',
    SOLD: 'sold',
    UNAVAILABLE: 'unavailable',
    IN_SELECTION: 'in_selection',
};

// ============================================
// STATUS DE SELEÇÃO
// ============================================
const SELECTION_STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    FINALIZED: 'finalized',
    CANCELLED: 'cancelled',
    REVERTED: 'reverted',
    APPROVING: 'approving',
    DELETING: 'deleting',
};

// ============================================
// TABELAS CDE
// ============================================
const CDE_TABLES = {
    INVENTARIO: 'tbinventario',
    ETIQUETA: 'tbetiqueta',
};

// ============================================
// SYNC
// ============================================
const SYNC = {
    DEFAULT_INTERVAL_MINUTES: 5,
    LOCK_EXPIRATION_MS: 15 * 60 * 1000, // 15 minutos
    LOCK_CLEANUP_THRESHOLD_MS: 30 * 60 * 1000, // 30 minutos
    BATCH_SIZE: 300,
};

// ============================================
// CACHE
// ============================================
const CACHE = {
    DEFAULT_DURATION_MS: 5 * 60 * 1000, // 5 minutos
    CLEANUP_INTERVAL_MS: 60 * 1000, // 1 minuto
    CONNECTION_CACHE_MS: 10 * 60 * 1000, // 10 minutos
};

// ============================================
// RATE LIMITING
// ============================================
const RATE_LIMIT = {
    INTELLIGENCE_REQUESTS_PER_MINUTE: 30,
    WINDOW_MS: 60 * 1000,
};

// ============================================
// RETAIL SALES REPS (determinam status RESERVED vs CONFIRMED)
// ============================================
const SALES_REPS = {
    RETAIL: ['Vicky', 'Eduarda', 'Vicky / Eduarda'],

    isRetail: function(salesRep) {
        const normalized = (salesRep || '').trim().toLowerCase();
        return this.RETAIL.some(rep => normalized === rep.toLowerCase());
    }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
    TIME,
    CART,
    SELECTION,
    MIX_MATCH,
    PRICE_TIERS,
    CDE_STATUS,
    PRODUCT_STATUS,
    SELECTION_STATUS,
    CDE_TABLES,
    SYNC,
    CACHE,
    RATE_LIMIT,
    SALES_REPS,
};
