// src/routes/catalog.js
/**
 * CATALOG ROUTES - Sunshine Cowhides
 * ===================================
 * Rotas para produtos de catálogo (Designer Rugs, Accessories, etc.)
 * Produtos baseados em quantidade, NÃO participam do Mix & Match.
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const AccessCode = require('../models/AccessCode');
const { getAllowedCatalogCategories, isCatalogCategoryAllowed, mapProductToDisplayCategory } = require('../config/categoryMapping');

// ============================================
// MIDDLEWARE: Verificar token do cliente (opcional)
// ============================================
// Similar ao usado em gallery.js, mas não bloqueia acesso
// Apenas identifica o cliente para aplicar filtros de permissão
const verifyClientToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (decoded.type === 'client') {
                // Buscar AccessCode atualizado do banco
                const accessCode = await AccessCode.findOne({
                    code: decoded.clientCode,
                    isActive: true
                });

                if (accessCode) {
                    req.client = {
                        clientCode: decoded.clientCode,
                        clientName: decoded.clientName,
                        accessType: accessCode.accessType || 'normal',
                        allowedCategories: accessCode.allowedCategories || [],
                        showPrices: accessCode.showPrices !== false
                    };
                    console.log(`[CATALOG] 👤 Cliente: ${req.client.clientCode}`);
                }
            }
        } catch (error) {
            console.log('[CATALOG] ⚠️ Token inválido:', error.message);
        }
    }

    next();
};

// ============================================
// CACHE SYSTEM - Resiliente com Background Refresh Automático
// ============================================
const catalogCache = {
    products: null,
    timestamp: null,
    TTL: 15 * 60 * 1000,           // 15 minutos - cache considerado "fresco"
    STALE_TTL: 60 * 60 * 1000,     // 1 hora - dados antigos ainda usáveis como fallback
    REFRESH_INTERVAL: 10 * 60 * 1000, // 10 minutos - intervalo de refresh automático
    isLoading: false,
    pendingPromise: null,
    isWarmedUp: false,
    lastError: null,
    errorCount: 0,
    refreshTimer: null,            // Timer do background refresh
    lastRefreshAttempt: null,      // Timestamp da última tentativa de refresh
    consecutiveFailures: 0,        // Falhas consecutivas no background refresh

    isValid() {
        return this.products && this.timestamp && (Date.now() - this.timestamp) < this.TTL;
    },

    // Dados antigos mas ainda usáveis como fallback
    hasStaleData() {
        return this.products && this.timestamp && (Date.now() - this.timestamp) < this.STALE_TTL;
    },

    // Verifica se está próximo de expirar (últimos 20% do TTL)
    isNearExpiry() {
        if (!this.timestamp) return true;
        const age = Date.now() - this.timestamp;
        return age > (this.TTL * 0.8); // 80% do TTL passou
    },

    async get(forceRefresh = false) {
        // Se cache válido e não forçou refresh, retorna do cache
        if (!forceRefresh && this.isValid()) {
            console.log('[CACHE] ✅ Retornando produtos do cache');

            // Stale-While-Revalidate: Se próximo de expirar, agenda refresh em background
            if (this.isNearExpiry() && !this.isLoading) {
                this.triggerBackgroundRefresh();
            }

            return this.products;
        }

        // Se já está carregando, aguarda a promise existente
        if (this.isLoading && this.pendingPromise) {
            console.log('[CACHE] ⏳ Aguardando carregamento em andamento...');

            // Se temos dados stale, retorna imediatamente (stale-while-revalidate)
            if (this.hasStaleData()) {
                console.log('[CACHE] 📦 Servindo dados stale enquanto revalida...');
                return this.products;
            }

            return this.pendingPromise;
        }

        // Se muitos erros recentes, usar dados antigos se disponíveis
        if (this.errorCount >= 3 && this.hasStaleData()) {
            console.log('[CACHE] ⚠️ Muitos erros recentes, usando dados antigos');
            return this.products;
        }

        // Inicia novo carregamento
        return this._loadProducts();
    },

    // Método interno para carregar produtos
    async _loadProducts() {
        if (this.isLoading && this.pendingPromise) {
            return this.pendingPromise;
        }

        this.isLoading = true;
        this.lastRefreshAttempt = Date.now();
        console.log('[CACHE] 🔄 Carregando produtos do CDE...');

        this.pendingPromise = (async () => {
            try {
                const queries = getCDEQueries();
                const startTime = Date.now();

                // Timeout de 10 segundos - erro rápido, fallback para dados antigos
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('CDE query timeout after 10s')), 10000)
                );

                const products = await Promise.race([
                    queries.getAllCatalogProducts(),
                    timeoutPromise
                ]);

                const elapsed = Date.now() - startTime;

                this.products = products;
                this.timestamp = Date.now();
                this.isWarmedUp = true;
                this.lastError = null;
                this.errorCount = 0;
                this.consecutiveFailures = 0;
                console.log(`[CACHE] ✅ Cache atualizado: ${products.length} produtos em ${elapsed}ms`);

                return products;
            } catch (error) {
                this.lastError = error.message;
                this.errorCount++;
                this.consecutiveFailures++;
                console.error(`[CACHE] ❌ Erro ao carregar (tentativa ${this.errorCount}):`, error.message);

                // FALLBACK 1: Se temos dados antigos, usar eles
                if (this.hasStaleData()) {
                    console.log('[CACHE] 🔄 Usando dados antigos como fallback');
                    return this.products;
                }

                // FALLBACK 2: Tentar MongoDB se CDE falhou completamente
                try {
                    console.log('[CACHE] 🔄 Tentando fallback para MongoDB...');
                    const mongoProducts = await this._loadFromMongoDB();
                    if (mongoProducts && mongoProducts.length > 0) {
                        console.log(`[CACHE] ✅ MongoDB fallback: ${mongoProducts.length} produtos`);
                        // Não cachear dados do MongoDB (são potencialmente incompletos)
                        return mongoProducts;
                    }
                } catch (mongoError) {
                    console.error('[CACHE] ❌ MongoDB fallback também falhou:', mongoError.message);
                }

                throw error;
            } finally {
                this.isLoading = false;
                this.pendingPromise = null;
            }
        })();

        return this.pendingPromise;
    },

    // Trigger refresh em background (não bloqueia)
    triggerBackgroundRefresh() {
        // Evita múltiplos refreshes simultâneos
        if (this.isLoading) {
            console.log('[CACHE] ⏭️ Background refresh ignorado - já carregando');
            return;
        }

        // Rate limiting: mínimo 2 minutos entre tentativas
        const minInterval = 2 * 60 * 1000;
        if (this.lastRefreshAttempt && (Date.now() - this.lastRefreshAttempt) < minInterval) {
            console.log('[CACHE] ⏭️ Background refresh ignorado - muito recente');
            return;
        }

        console.log('[CACHE] 🔄 Iniciando background refresh...');

        // Executa em background sem bloquear
        this._loadProducts().catch(err => {
            console.error('[CACHE] ⚠️ Background refresh falhou:', err.message);
        });
    },

    // Inicia o polling automático
    startAutoRefresh() {
        if (this.refreshTimer) {
            console.log('[CACHE] ⏭️ Auto-refresh já está rodando');
            return;
        }

        console.log(`[CACHE] 🕐 Iniciando auto-refresh a cada ${this.REFRESH_INTERVAL / 60000} minutos`);

        this.refreshTimer = setInterval(() => {
            // Se cache está fresco e sem erros, pula esta iteração
            if (this.isValid() && this.consecutiveFailures === 0) {
                const age = Math.round((Date.now() - this.timestamp) / 1000);
                console.log(`[CACHE] ⏭️ Auto-refresh: cache ainda fresco (${age}s)`);
                return;
            }

            // Backoff exponencial se muitas falhas consecutivas
            if (this.consecutiveFailures >= 5) {
                console.log('[CACHE] ⚠️ Auto-refresh pausado: muitas falhas consecutivas');
                // Tenta novamente após 30 minutos de pausa
                if (this.lastRefreshAttempt && (Date.now() - this.lastRefreshAttempt) < 30 * 60 * 1000) {
                    return;
                }
                console.log('[CACHE] 🔄 Retomando auto-refresh após pausa...');
                this.consecutiveFailures = 0; // Reset para tentar novamente
            }

            this.triggerBackgroundRefresh();
        }, this.REFRESH_INTERVAL);

        // Marca para não impedir encerramento do processo
        if (this.refreshTimer.unref) {
            this.refreshTimer.unref();
        }
    },

    // Para o polling automático
    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
            console.log('[CACHE] 🛑 Auto-refresh parado');
        }
    },

    invalidate() {
        // Não limpa os dados, apenas marca como expirado
        this.timestamp = null;
        console.log('[CACHE] 🗑️ Cache marcado como expirado (dados mantidos para fallback)');

        // Agenda refresh imediato
        this.triggerBackgroundRefresh();
    },

    // Pre-warm cache on server startup
    async warmUp() {
        if (this.isWarmedUp || this.isLoading) {
            console.log('[CACHE] ⏭️ Cache já está aquecido ou carregando');
            return;
        }

        console.log('[CACHE] 🔥 Pré-aquecendo cache de catálogo...');
        try {
            await this.get(true);
            console.log('[CACHE] ✅ Cache pré-aquecido com sucesso!');

            // Inicia auto-refresh após warmup bem-sucedido
            this.startAutoRefresh();
        } catch (error) {
            console.error('[CACHE] ❌ Erro ao pré-aquecer cache:', error.message);
            // Inicia auto-refresh mesmo com erro para tentar novamente
            this.startAutoRefresh();
        }
    },

    // Reset error count (pode ser chamado manualmente)
    resetErrors() {
        this.errorCount = 0;
        this.consecutiveFailures = 0;
        this.lastError = null;
        console.log('[CACHE] 🔄 Contagem de erros resetada');
    },

    // Retorna estatísticas do cache
    getStats() {
        const now = Date.now();
        const age = this.timestamp ? now - this.timestamp : null;

        return {
            hasData: !!this.products,
            productCount: this.products?.length || 0,
            ageMs: age,
            ageFormatted: age ? this._formatDuration(age) : null,
            isValid: this.isValid(),
            isStale: !this.isValid() && this.hasStaleData(),
            isLoading: this.isLoading,
            isWarmedUp: this.isWarmedUp,
            autoRefreshActive: !!this.refreshTimer,
            lastError: this.lastError,
            errorCount: this.errorCount,
            consecutiveFailures: this.consecutiveFailures,
            nextRefreshIn: this.timestamp
                ? this._formatDuration(Math.max(0, this.TTL - age))
                : 'N/A'
        };
    },

    _formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${Math.round(ms / 1000)}s`;
        return `${Math.round(ms / 60000)}min`;
    },

    // Fallback: carregar produtos do MongoDB quando CDE falha
    async _loadFromMongoDB() {
        const CatalogProductModel = getCatalogProduct();
        const products = await CatalogProductModel.find({
            isActive: true,
            displayCategory: { $ne: 'other', $ne: null, $exists: true }
        })
            .select('qbItem name category origin currentStock basePrice displayCategory availableStock')
            .lean();

        // Transformar para formato compatível com CDE
        return products.map(p => ({
            qbItem: p.qbItem,
            name: p.name,
            category: p.category,
            origin: p.origin,
            stock: p.currentStock || 0,
            basePrice: p.basePrice || 0,
            displayCategory: p.displayCategory,
            availableStock: p.availableStock || p.currentStock || 0,
            fromMongoDB: true // Flag para identificar origem
        }));
    }
};

// Auto-warm cache after 3 seconds (give server time to initialize)
setTimeout(() => {
    catalogCache.warmUp();
}, 3000);

// Graceful shutdown - para o timer quando o processo terminar
process.on('SIGTERM', () => catalogCache.stopAutoRefresh());
process.on('SIGINT', () => catalogCache.stopAutoRefresh());

// Lazy load para evitar dependências circulares
let cdeQueriesInstance = null;
let CatalogProduct = null;

function getCDEQueries() {
    if (!cdeQueriesInstance) {
        const CDEQueries = require('../ai/CDEQueries');
        cdeQueriesInstance = new CDEQueries();
    }
    return cdeQueriesInstance;
}

function getCatalogProduct() {
    if (!CatalogProduct) {
        CatalogProduct = require('../models/CatalogProduct');
    }
    return CatalogProduct;
}

// Mapeamento de displayCategory para categorias CDE
const CATEGORY_MAP = {
    // Patchwork/Designer Rugs - subdivided
    'chevron-rugs': 'FILTER_BY_DESCRIPTION',
    'standard-patchwork': 'FILTER_BY_DESCRIPTION',
    'runner-rugs': 'FILTER_BY_DESCRIPTION',
    'bedside-rugs': 'FILTER_BY_DESCRIPTION',
    'designer-rugs': 'FILTER_BY_DESCRIPTION',  // Legacy - all designer rugs
    'rodeo-rugs': ['RODEO RUG'],

    // Small Hides - usam filtro por nome/descrição
    'sheepskin': 'FILTER_BY_DESCRIPTION',
    'calfskin': 'FILTER_BY_DESCRIPTION',
    'goatskin': 'FILTER_BY_DESCRIPTION',
    'icelandic': ['SMALL HIDES'],
    'reindeer': ['SMALL HIDES'],

    // Accessories (exclude furniture items that are miscategorized)
    'accessories': 'FILTER_BY_DESCRIPTION',

    // Accessories subcategories
    'pillows': 'FILTER_BY_DESCRIPTION',
    'bags-purses': 'FILTER_BY_DESCRIPTION',
    'table-kitchen': 'FILTER_BY_DESCRIPTION',
    'slippers': 'FILTER_BY_DESCRIPTION',
    'scraps-diy': 'FILTER_BY_DESCRIPTION',
    'gifts-seasonal': 'FILTER_BY_DESCRIPTION',

    // Furniture - main category (all furniture)
    'furniture': 'FILTER_BY_DESCRIPTION',

    // Furniture subcategories
    'pouf-ottoman': 'FILTER_BY_DESCRIPTION',
    'leather-furniture': 'FILTER_BY_DESCRIPTION',
    'foot-stool': 'FILTER_BY_DESCRIPTION',

    // Specialty Cowhides (filtro por descrição/QB code)
    // Estes usam filtragem especial, não por ACATEGORIA
    'printed': 'FILTER_BY_DESCRIPTION',
    'metallic': 'FILTER_BY_DESCRIPTION',
    'dyed': 'FILTER_BY_DESCRIPTION'
};

// Mapeamento reverso: CDE category -> displayCategory
function getDisplayCategory(cdeCategory, productName = '') {
    const name = (productName || '').toLowerCase();
    const upper = (cdeCategory || '').toUpperCase();

    // Se category é NULL ou ACCESORIOS, tentar detectar pelo nome
    if (!cdeCategory || upper.includes('ACCESORIO')) {
        // Designer rugs - detect by name
        if (name.includes('rug designer') || name.includes('designer rug')) {
            return 'designer-rugs';
        }
        // Rodeo rugs
        if (name.includes('rodeo') && name.includes('rug')) {
            return 'rodeo-rugs';
        }
        // Furniture
        const furnitureKeywords = ['chair', 'puff', 'ottoman', 'bench', 'sofa', 'couch', 'stool'];
        if (furnitureKeywords.some(kw => name.includes(kw))) {
            return 'furniture';
        }
        // Small hides
        if (name.includes('sheep') || name.includes('calf') || name.includes('goat')) {
            return 'small-hides';
        }
        // Default to accessories if can't determine
        return 'accessories';
    }

    // Normal category detection
    if (upper.includes('DESIGNER')) return 'designer-rugs';
    if (upper.includes('RODEO')) return 'rodeo-rugs';
    if (upper.includes('SHEEPSKIN')) return 'sheepskin';
    if (upper.includes('SMALL HIDES')) return 'small-hides';
    if (upper.includes('MOBILIARIO')) return 'furniture';
    if (upper.includes('PILLOW')) return 'accessories';

    return 'accessories';
}

// Filtrar produtos por nome/descrição para subcategorias específicas
function filterBySubcategory(products, subcategory) {
    const filters = {
        // Small Hides filters
        'sheepskin': (p) => {
            const name = (p.name || '').toLowerCase();
            const category = (p.category || '').toLowerCase();

            // Excluir calfskin e goatskin
            if (name.includes('calf') || name.includes('goat')) return false;

            // EXCLUIR "Rug Bedside" - estes vão para Designer Rugs (incluindo typo "bedisde")
            if (name.includes('rug bedside') || name.includes('bedside rug') || name.includes('bedisde')) return false;

            // Incluir por categoria SHEEPSKIN ou SMALL HIDES
            if (category.includes('sheepskin') || category.includes('small hides')) {
                // Dentro de SMALL HIDES, filtrar pelos nomes corretos
                if (category.includes('small hides')) {
                    return name.includes('sheep') || name.includes('icelandic') ||
                           name.includes('himalayan') || name.includes('tibetan') ||
                           name.includes('british wild') || name.includes('lamb');
                }
                return true;
            }

            // Incluir por nome: sheep, icelandic, himalayan, tibetan, british wild, lamb
            return name.includes('sheep') || name.includes('icelandic') ||
                   name.includes('himalayan') || name.includes('tibetan') ||
                   name.includes('british wild') || name.includes('lamb');
        },
        'calfskin': (p) => {
            const name = (p.name || '').toLowerCase();
            // Calfskin = TODOS os produtos com calfskin/calf no nome
            // INCLUINDO printed, devore/metallic calfskins (agora pertencem a calfskin)
            return name.includes('calfskin') || (name.includes('calf') && name.includes('hair on'));
        },
        'goatskin': (p) => {
            const name = (p.name || '').toLowerCase();
            return name.includes('goatskin') || name.includes('goat');
        },
        'icelandic': (p) => p.name?.toLowerCase().includes('icelandic'),
        'reindeer': (p) => p.name?.toLowerCase().includes('reindeer'),

        // Designer Rugs filters - includes all designer rugs (regular sizes + runners) + Rug Bedside
        'designer-rugs': (p) => {
            const category = (p.category || '').toUpperCase();
            const name = (p.name || '').toLowerCase();

            // All products from DESIGNER RUG category
            if (category.includes('DESIGNER RUG')) return true;

            // INCLUIR "Rug Bedside" da categoria SHEEPSKIN (são rugs, não sheepskins)
            if (name.includes('rug bedside') || name.includes('bedside rug')) return true;

            return false;
        },

        // ========== PATCHWORK/DESIGNER RUGS SUBDIVISIONS ==========

        // Chevron Rugs - all products with "chevron" pattern
        'chevron-rugs': (p) => {
            const category = (p.category || '').toUpperCase();
            const name = (p.name || '').toLowerCase();

            // Must have "chevron" in name
            if (!name.includes('chevron')) return false;

            // EXCLUIR chevron RUNNERS - estes vão para Runner Rugs
            if (name.includes('runner')) return false;

            // Accept from DESIGNER RUG, NULL, or ACCESORIOS (some are miscategorized)
            if (category.includes('DESIGNER RUG')) return true;
            if (category === 'NULL' || category === '' || !p.category) {
                return name.includes('rug');
            }
            if (category.includes('ACCESORIO')) return name.includes('rug');

            return false;
        },

        // Standard Patchwork - regular designer rugs without chevron/runner/bedside
        'standard-patchwork': (p) => {
            const category = (p.category || '').toUpperCase();
            const name = (p.name || '').toLowerCase();

            // Specialty patterns - straw, stripes, terni, rope, thread
            const specialtyPatterns = ['straw', 'stripes', 'terni', 'rope', 'thread'];
            const hasSpecialtyPattern = specialtyPatterns.some(pattern => name.includes(pattern));

            if (hasSpecialtyPattern && name.includes('rug')) {
                return true;
            }

            // Must be from DESIGNER RUG category (or NULL/ACCESORIOS with "rug designer")
            const isDesignerRug = category.includes('DESIGNER RUG') ||
                                  (category.includes('ACCESORIO') && name.includes('rug designer')) ||
                                  ((category === 'NULL' || category === '' || !p.category) && name.includes('rug designer'));

            if (!isDesignerRug) return false;

            // Exclude chevron, runner, bedside, and welcome
            if (name.includes('chevron')) return false;
            if (name.includes('runner')) return false;
            if (name.includes('bedside') || name.includes('bedisde')) return false; // Include typo variant
            if (name.includes('welcome')) return false;

            return true;
        },

        // Runner Rugs - long runner rugs (INCLUDES chevron runners and size-based runners)
        'runner-rugs': (p) => {
            const category = (p.category || '').toUpperCase();
            const name = (p.name || '').toLowerCase();

            // Detect runners by name OR by size (ex: 2.5x8, 3x8, 3x10, 3x12)
            const runnerSizePattern = /(2\.5x8|2\.5x10|2x8|2x10|3x8|3x10|3x12|2\.5x12)/i;
            const hasRunnerInName = name.includes('runner');
            const hasRunnerSize = runnerSizePattern.test(name);

            if (!hasRunnerInName && !hasRunnerSize) return false;

            // Exclude table runners (these are accessories, not rugs)
            if (name.includes('table runner')) return false;

            // Accept from DESIGNER RUG, NULL, or ACCESORIOS (some are miscategorized)
            if (category.includes('DESIGNER RUG')) return true;
            if (category === 'NULL' || category === '' || !p.category) {
                return name.includes('rug');
            }
            if (category.includes('ACCESORIO')) return name.includes('rug');

            return false;
        },

        // Bedside Rugs - small bedside rugs (from DESIGNER RUG or SHEEPSKIN)
        'bedside-rugs': (p) => {
            const category = (p.category || '').toUpperCase();
            const name = (p.name || '').toLowerCase();

            // Products with "bedside" in name from DESIGNER RUG or SHEEPSKIN categories
            // INCLUIR variação com typo: "bedisde" (erro comum no CDE)
            if (name.includes('bedside') || name.includes('rug bedside') || name.includes('bedisde')) {
                return category.includes('DESIGNER RUG') || category.includes('SHEEPSKIN');
            }
            return false;
        },

        // Welcome Mats - small welcome rugs with longhorn designs
        'welcome-mats': (p) => {
            const name = (p.name || '').toLowerCase();
            // Welcome mats are rugs with "welcome" in the name
            return name.includes('welcome') && name.includes('rug');
        },

        // Specialty Cowhides filters - por descrição ou código QB
        'printed': (p) => {
            const name = (p.name || '').toLowerCase();

            // EXCLUIR calfskins e pillows (estes têm suas próprias categorias)
            if (name.includes('calfskin') || name.includes('calf skin')) return false;
            if (name.includes('pillow') || name.includes('cojin') || name.includes('cushion')) return false;

            // Printed COWHIDES = estampas de animais (zebra, tiger, leopard, etc.)
            const animalPatterns = [
                'zebra', 'tiger', 'leopard', 'jaguar', 'cheetah',
                'giraffe', 'antelope', 'bengal'
            ];
            return animalPatterns.some(pattern => name.includes(pattern));
        },
        'metallic': (p) => {
            const name = (p.name || '').toLowerCase();

            // EXCLUIR calfskins (calfskin metallic vai para categoria calfskin)
            if (name.includes('calfskin') || name.includes('calf skin')) return false;

            // EXCLUIR sheepskins (sheepskin com silver/gold no nome não é metallic)
            if (name.includes('sheepskin') || name.includes('sheep skin')) return false;

            // EXCLUIR accessories (napkin ring bronze, etc não são metallic cowhides)
            if (name.includes('napkin') || name.includes('pillow') || name.includes('bag') ||
                name.includes('coaster') || name.includes('slipper')) return false;

            // Metallic COWHIDES = devore, gold, silver, bronze
            return name.includes('metallic') || name.includes('devore') ||
                   name.includes('gold') || name.includes('silver') || name.includes('bronze');
        },
        'dyed': (p) => {
            const name = (p.name || '').toLowerCase();
            const qbCode = (p.qbItem || '').toString();

            // EXCLUIR calfskins (dyed calfskin vai para categoria calfskin)
            if (name.includes('calfskin') || name.includes('calf skin')) return false;

            // EXCLUIR produtos Devore/Metallic (estes têm "on Dyed Black" no final)
            if (name.includes('devore') || name.includes('metallic')) {
                return false;
            }

            // EXCLUIR produtos Printed (ex: "Zebra on Dyed Black" vai para printed, não dyed)
            const printedPatterns = ['zebra', 'tiger', 'leopard', 'jaguar', 'cheetah', 'giraffe', 'antelope', 'bengal'];
            if (printedPatterns.some(pattern => name.includes(pattern))) {
                return false;
            }

            // Códigos 6XXX são DYED, exceto 600X/601X/602X que são natural
            const isDyedByCode = qbCode.startsWith('6') &&
                                 !qbCode.startsWith('600') &&
                                 !qbCode.startsWith('601') &&
                                 !qbCode.startsWith('602');

            // Dyed products: nome começa com "dyed" ou contém "hair on dyed"
            // Ex: "Dyed Midnight Black Cowhide", "Cowhide Hair On Dyed Red"
            const isDyedByName = name.startsWith('dyed') ||
                                 name.includes('hair on dyed') ||
                                 (name.includes('dyed') && !name.includes(' on dyed'));

            return isDyedByCode || isDyedByName;
        },

        // Furniture - chairs, puffs, ottomans, benches, etc.
        'furniture': (p) => {
            const name = (p.name || '').toLowerCase();
            const category = (p.category || '').toUpperCase();

            // Exclude bags (some are miscategorized as MOBILIARIO)
            if (name.includes('bag') || name.includes('crossbody') || name.includes('purse') || name.includes('tote')) {
                return false;
            }

            // Include all MOBILIARIO items (after bag exclusion)
            if (category.includes('MOBILIARIO')) return true;

            // Include furniture items from other categories by name
            const furnitureKeywords = [
                'chair', 'puff', 'ottoman', 'bench', 'sofa', 'couch',
                'wingback', 'barrel', 'swivel', 'chaise', 'loveseat',
                'stool', 'desk', 'table'
            ];
            return furnitureKeywords.some(kw => name.includes(kw));
        },

        // Accessories - pillows, bags, etc. (EXCLUDE furniture items)
        'accessories': (p) => {
            const name = (p.name || '').toLowerCase();
            const category = (p.category || '').toUpperCase();

            // Exclude furniture items
            const furnitureKeywords = [
                'chair', 'puff', 'ottoman', 'bench', 'sofa', 'couch',
                'wingback', 'barrel', 'swivel', 'chaise', 'loveseat',
                'stool', 'desk', 'table'
            ];
            if (furnitureKeywords.some(kw => name.includes(kw))) return false;

            // Include bags even if in MOBILIARIO (some are miscategorized)
            if (name.includes('bag') || name.includes('crossbody') || name.includes('purse') || name.includes('tote')) {
                return true;
            }

            // Exclude MOBILIARIO (actual furniture)
            if (category.includes('MOBILIARIO')) return false;

            // Include ACCESORIOS, ACCESORIO, PILLOW categories
            return category.includes('ACCESORIO') || category.includes('PILLOW');
        },

        // ========== ACCESSORIES SUBCATEGORIES ==========

        // Pillows - cowhide pillows (EXCLUIR pillow fillers - são preenchimentos, não produtos)
        'pillows': (p) => {
            const name = (p.name || '').toLowerCase();
            // EXCLUIR pillow fillers (ex: "Pillow Filler 20x20", "Pillow Filler 10x19in")
            if (name.includes('filler')) return false;
            return name.includes('pillow');
        },

        // Bags & Purses - handbags, crossbody, shoulder bags (NOT scrap bags)
        'bags-purses': (p) => {
            const name = (p.name || '').toLowerCase();
            // Include real bags
            if (name.includes('duffle') || name.includes('handbag') || name.includes('crossbody') ||
                name.includes('shoulder bag') || name.includes('purse') || name.includes('tote')) {
                return true;
            }
            // Exclude scrap bags (those are DIY materials)
            if (name.includes('scrap')) return false;
            // Generic "bag" that's not scrap
            if (name.includes('bag') && !name.includes('scrap')) return true;
            return false;
        },

        // Table & Kitchen - coasters, place mats, napkin rings, koozies, wine accessories
        'table-kitchen': (p) => {
            const name = (p.name || '').toLowerCase();
            return name.includes('coaster') ||
                   name.includes('place mat') || name.includes('placemat') ||
                   name.includes('napkin') ||
                   name.includes('koozie') || name.includes('koozies') ||
                   name.includes('wine') || name.includes('bottle carrier');
        },

        // Slippers - shearling slippers
        'slippers': (p) => {
            const name = (p.name || '').toLowerCase();
            return name.includes('slipper');
        },

        // Scraps & DIY - cowhide scraps for crafts
        'scraps-diy': (p) => {
            const name = (p.name || '').toLowerCase();
            return name.includes('scrap');
        },

        // Gifts & Seasonal - stockings, sunshine moo, etc.
        'gifts-seasonal': (p) => {
            const name = (p.name || '').toLowerCase();
            return name.includes('stocking') ||
                   name.includes('sunshine moo') || name.includes('moo');
        },

        // ========== FURNITURE SUBCATEGORIES ==========

        // Pouf/Ottoman - cubes, poufs, ottomans
        'pouf-ottoman': (p) => {
            const name = (p.name || '').toLowerCase();

            // Exclude bags
            if (name.includes('bag') || name.includes('crossbody')) return false;

            // Include poufs and ottomans
            return name.includes('pouf') || name.includes('puff') || name.includes('ottoman');
        },

        // Leather Furniture - chairs (office, wingback, barrel, swivel, etc.)
        'leather-furniture': (p) => {
            const name = (p.name || '').toLowerCase();
            const category = (p.category || '').toUpperCase();

            // Exclude bags
            if (name.includes('bag') || name.includes('crossbody')) return false;

            // Exclude poufs/ottomans and footstools (they have their own categories)
            if (name.includes('pouf') || name.includes('puff') || name.includes('ottoman')) return false;
            if (name.includes('footstool') || name.includes('foot stool')) return false;

            // Include chairs from MOBILIARIO
            if (category.includes('MOBILIARIO') && name.includes('chair')) return true;

            // Include chairs from other categories
            const chairKeywords = [
                'chair', 'wingback', 'barrel', 'swivel', 'chaise', 'loveseat', 'sofa', 'couch'
            ];
            return chairKeywords.some(kw => name.includes(kw));
        },

        // Foot Stool - footstools with wooden legs
        'foot-stool': (p) => {
            const name = (p.name || '').toLowerCase();

            // Exclude bags
            if (name.includes('bag') || name.includes('crossbody')) return false;

            // Include footstools
            return name.includes('footstool') || name.includes('foot stool');
        }
    };

    const filterFn = filters[subcategory];
    if (filterFn) {
        return products.filter(filterFn);
    }
    return products;
}

/**
 * GET /api/catalog/products
 * Lista produtos de catálogo, opcionalmente filtrados por categoria
 * Agora com verificação de permissões do cliente
 */
router.get('/products', verifyClientToken, async (req, res) => {
    try {
        const { category, refresh } = req.query;

        console.log(`[CATALOG] Buscando produtos${category ? ` para categoria: ${category}` : ''}`);

        // Usar cache para evitar query lenta de 9.5s
        const forceRefresh = refresh === 'true';
        let products = await catalogCache.get(forceRefresh);

        // ============================================
        // FILTRO: EXCLUIR PRODUTOS OCULTOS (displayCategory: 'other' ou null)
        // ============================================
        const beforeHiddenFilter = products.length;

        // Lista de qbItems que devem ser ocultados
        const hiddenQbItems = new Set(['0000MET', '0000DYE', '9040', '4252']);

        products = products.filter(p => {
            // Excluir produtos na lista de ocultos
            if (hiddenQbItems.has(p.qbItem)) {
                return false;
            }

            const displayCat = mapProductToDisplayCategory({
                name: p.name,
                category: p.category || '',
                qbItem: p.qbItem || ''
            });
            // Excluir produtos sem categoria (null) ou marcados como 'other'
            return displayCat && displayCat !== 'other';
        });

        if (beforeHiddenFilter !== products.length) {
            console.log(`[CATALOG] 🚫 Produtos ocultos removidos: ${beforeHiddenFilter} → ${products.length}`);
        }

        // ============================================
        // FILTRO DE PERMISSÕES DO CLIENTE
        // ============================================
        if (req.client && req.client.allowedCategories && req.client.allowedCategories.length > 0) {
            const allowedCatalogCats = getAllowedCatalogCategories(req.client.allowedCategories);

            // Se tem restrições e a lista de permitidas não está vazia
            if (allowedCatalogCats.size > 0) {
                const beforeCount = products.length;

                products = products.filter(p => {
                    const productDisplayCat = getDisplayCategory(p.category, p.name);
                    return allowedCatalogCats.has(productDisplayCat);
                });

                console.log(`[CATALOG] 🔐 Filtro de permissões: ${beforeCount} → ${products.length} produtos`);
            }
        }

        // Filtrar por categoria solicitada
        if (category) {
            const mapping = CATEGORY_MAP[category];

            if (mapping === 'FILTER_BY_DESCRIPTION') {
                // Filtros especiais para Specialty Cowhides (printed, metallic, dyed)
                // Não filtra por ACATEGORIA, apenas por descrição/código QB
                console.log(`[CATALOG] Aplicando filtro especial para: ${category}`);
                products = filterBySubcategory(products, category);
            } else if (Array.isArray(mapping)) {
                // Filtro normal por ACATEGORIA
                products = products.filter(p => {
                    const cat = (p.category || '').toUpperCase();
                    return mapping.some(vc => cat.includes(vc.toUpperCase()));
                });
                // Aplicar filtro adicional por subcategoria (calfskin, goatskin, etc)
                products = filterBySubcategory(products, category);
            }
            // Se mapping não existe, retorna todos os produtos
        }

        // Adicionar displayCategory a cada produto
        products = products.map(p => ({
            ...p,
            displayCategory: getDisplayCategory(p.category, p.name),
            currentStock: p.stock || 0
        }));

        // ===== MERGE COM PREÇOS E ESTOQUE LÓGICO DO MONGODB =====
        // Buscar preços e estoque lógico cadastrados no CatalogProduct
        try {
            const CatalogProductModel = getCatalogProduct();
            const qbItems = products.map(p => p.qbItem).filter(Boolean);

            if (qbItems.length > 0) {
                const catalogProducts = await CatalogProductModel.find(
                    { qbItem: { $in: qbItems } },
                    { qbItem: 1, basePrice: 1, reservedInCarts: 1, confirmedInSelections: 1, availableStock: 1 }
                ).lean();

                // Criar mapa para lookup rápido
                const catalogMap = {};
                catalogProducts.forEach(cp => {
                    catalogMap[cp.qbItem] = {
                        basePrice: cp.basePrice || 0,
                        reservedInCarts: cp.reservedInCarts || 0,
                        confirmedInSelections: cp.confirmedInSelections || 0,
                        availableStock: cp.availableStock
                    };
                });

                // Merge preços e estoque lógico nos produtos
                products = products.map(p => {
                    const catalogData = catalogMap[p.qbItem];
                    const basePrice = catalogData?.basePrice || 0;
                    const physicalStock = p.stock || 0;

                    // Calcular estoque disponível
                    let availableStock;
                    if (catalogData) {
                        // Se existe no MongoDB, usa o estoque lógico
                        availableStock = catalogData.availableStock ?? (physicalStock - (catalogData.reservedInCarts || 0) - (catalogData.confirmedInSelections || 0));
                    } else {
                        // Se não existe no MongoDB, estoque disponível = físico
                        availableStock = physicalStock;
                    }

                    return {
                        ...p,
                        basePrice,
                        hasPrice: basePrice > 0,
                        formattedPrice: basePrice > 0 ? `$${basePrice.toFixed(2)}` : 'Contact for Price',
                        // ✅ ESTOQUE LÓGICO
                        reservedInCarts: catalogData?.reservedInCarts || 0,
                        confirmedInSelections: catalogData?.confirmedInSelections || 0,
                        availableStock: Math.max(0, availableStock),
                        // Manter stock original do CDE para referência
                        physicalStock: physicalStock
                    };
                });

                console.log(`[CATALOG] Preços e estoque lógico carregados: ${catalogProducts.length} produtos`);
            }
        } catch (priceError) {
            console.error('[CATALOG] Erro ao buscar preços/estoque (continuando sem dados):', priceError.message);
            // Em caso de erro, continua com estoque físico apenas
            products = products.map(p => ({
                ...p,
                basePrice: 0,
                hasPrice: false,
                formattedPrice: 'Contact for Price',
                reservedInCarts: 0,
                confirmedInSelections: 0,
                availableStock: p.stock || 0,
                physicalStock: p.stock || 0
            }));
        }

        // ============================================
        // OCULTAR PREÇOS SE showPrices = false
        // ============================================
        if (req.client && req.client.showPrices === false) {
            products = products.map(p => ({
                ...p,
                basePrice: 0,
                hasPrice: false,
                formattedPrice: 'Contact for Price',
                priceHidden: true
            }));
            console.log(`[CATALOG] 💰 Preços ocultados para cliente ${req.client.clientCode}`);
        }

        console.log(`[CATALOG] Retornando ${products.length} produtos`);

        res.json({
            success: true,
            products,
            count: products.length,
            category: category || 'all',
            showPrices: req.client?.showPrices !== false
        });

    } catch (error) {
        console.error('[CATALOG] Erro ao buscar produtos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar produtos do catálogo',
            error: error.message
        });
    }
});

/**
 * GET /api/catalog/products/:qbItem
 * Detalhes de um produto específico
 * Agora com verificação de permissões
 */
router.get('/products/:qbItem', verifyClientToken, async (req, res) => {
    try {
        const { qbItem } = req.params;
        const queries = getCDEQueries();

        const product = await queries.getCatalogProductDetails(qbItem);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado'
            });
        }

        // Adicionar displayCategory
        product.displayCategory = getDisplayCategory(product.category, product.name);
        product.currentStock = product.availableStock || 0;

        // Verificar permissão para este produto
        if (req.client && req.client.allowedCategories && req.client.allowedCategories.length > 0) {
            if (!isCatalogCategoryAllowed(product.displayCategory, req.client.allowedCategories)) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado a este produto'
                });
            }
        }

        // ===== MERGE COM PREÇO DO MONGODB =====
        try {
            const CatalogProductModel = getCatalogProduct();
            const catalogProduct = await CatalogProductModel.findOne(
                { qbItem },
                { basePrice: 1 }
            ).lean();

            if (catalogProduct) {
                product.basePrice = catalogProduct.basePrice || 0;
                product.hasPrice = product.basePrice > 0;
                product.formattedPrice = product.basePrice > 0
                    ? `$${product.basePrice.toFixed(2)}`
                    : 'Contact for Price';
            } else {
                product.basePrice = 0;
                product.hasPrice = false;
                product.formattedPrice = 'Contact for Price';
            }
        } catch (priceError) {
            console.error('[CATALOG] Erro ao buscar preço:', priceError.message);
            product.basePrice = 0;
            product.hasPrice = false;
            product.formattedPrice = 'Contact for Price';
        }

        res.json({
            success: true,
            product
        });

    } catch (error) {
        console.error('[CATALOG] Erro ao buscar produto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar detalhes do produto',
            error: error.message
        });
    }
});

/**
 * GET /api/catalog/stock/:qbItem
 * Verificar estoque de um produto
 */
router.get('/stock/:qbItem', async (req, res) => {
    try {
        const { qbItem } = req.params;
        const queries = getCDEQueries();

        const stockInfo = await queries.getCatalogProductStock(qbItem);

        res.json({
            success: true,
            qbItem,
            ...stockInfo
        });

    } catch (error) {
        console.error('[CATALOG] Erro ao verificar estoque:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao verificar estoque',
            error: error.message
        });
    }
});

/**
 * GET /api/catalog/categories
 * Lista categorias disponíveis
 */
router.get('/categories', async (req, res) => {
    try {
        // Usar cache para evitar query lenta
        const products = await catalogCache.get();

        const categoryStats = {};
        products.forEach(p => {
            const cat = p.category || 'Other';
            if (!categoryStats[cat]) {
                categoryStats[cat] = { count: 0, stock: 0 };
            }
            categoryStats[cat].count++;
            categoryStats[cat].stock += (p.stock || 0);
        });

        const categories = Object.entries(categoryStats).map(([name, stats]) => ({
            name,
            displayCategory: getDisplayCategory(name),
            productCount: stats.count,
            totalStock: stats.stock
        }));

        res.json({
            success: true,
            categories: categories.sort((a, b) => b.totalStock - a.totalStock)
        });

    } catch (error) {
        console.error('[CATALOG] Erro ao buscar categorias:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar categorias',
            error: error.message
        });
    }
});

/**
 * GET /api/catalog/analyze
 * Analisar produtos do CDE para diagnóstico
 * Retorna descrições únicas para identificar tipos (PRINTED, DEVORE, DYED, etc.)
 */
router.get('/analyze', async (req, res) => {
    try {
        console.log('[CATALOG] Analisando produtos do CDE...');

        // Usar cache para evitar query lenta
        const products = await catalogCache.get();

        // Agrupar por categoria e analisar descrições
        const analysis = {
            totalProducts: products.length,
            byCategory: {},
            byQBPrefix: {},
            keywords: {
                printed: [],
                devore: [],
                dyed: [],
                metallic: [],
                exotic: [],
                binding: []
            }
        };

        // Palavras-chave para identificar tipos
        const keywordPatterns = {
            printed: /print|stamped|stencil/i,
            devore: /devore|devour/i,
            dyed: /dyed|dye|colored|tint/i,
            metallic: /metallic|metal|gold|silver|bronze/i,
            exotic: /exotic|zebra|tiger|leopard|palomino/i,
            binding: /binding|bound|edge/i
        };

        products.forEach(p => {
            const cat = p.category || 'Unknown';
            const qbPrefix = (p.qbItem || '').toString().charAt(0);
            const name = (p.name || '').toLowerCase();

            // Agrupar por categoria
            if (!analysis.byCategory[cat]) {
                analysis.byCategory[cat] = { count: 0, stock: 0, samples: [] };
            }
            analysis.byCategory[cat].count++;
            analysis.byCategory[cat].stock += (p.stock || 0);
            if (analysis.byCategory[cat].samples.length < 5) {
                analysis.byCategory[cat].samples.push({
                    qbItem: p.qbItem,
                    name: p.name,
                    stock: p.stock
                });
            }

            // Agrupar por prefixo QB
            if (!analysis.byQBPrefix[qbPrefix]) {
                analysis.byQBPrefix[qbPrefix] = { count: 0, stock: 0, samples: [] };
            }
            analysis.byQBPrefix[qbPrefix].count++;
            analysis.byQBPrefix[qbPrefix].stock += (p.stock || 0);
            if (analysis.byQBPrefix[qbPrefix].samples.length < 5) {
                analysis.byQBPrefix[qbPrefix].samples.push({
                    qbItem: p.qbItem,
                    name: p.name,
                    category: p.category
                });
            }

            // Identificar por palavras-chave na descrição
            Object.entries(keywordPatterns).forEach(([type, pattern]) => {
                if (pattern.test(name) || pattern.test(cat)) {
                    if (analysis.keywords[type].length < 10) {
                        analysis.keywords[type].push({
                            qbItem: p.qbItem,
                            name: p.name,
                            category: p.category,
                            stock: p.stock
                        });
                    }
                }
            });
        });

        console.log(`[CATALOG] Análise concluída: ${products.length} produtos analisados`);

        res.json({
            success: true,
            analysis
        });

    } catch (error) {
        console.error('[CATALOG] Erro na análise:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao analisar produtos',
            error: error.message
        });
    }
});

/**
 * POST /api/catalog/sync
 * Forçar sincronização com CDE - VERSÃO ROBUSTA
 * Usa queries por categoria para evitar timeout
 */
router.post('/sync', async (req, res) => {
    try {
        const queries = getCDEQueries();
        const CatalogProductModel = getCatalogProduct();

        console.log('[CATALOG] Iniciando sincronização ROBUSTA com CDE...');

        // Categorias CDE para sincronizar
        const cdeCategories = [
            'SHEEPSKIN',
            'SMALL HIDES',
            'DESIGNER RUG',
            'ACCESORIOS',
            'ACCESORIO',
            'MOBILIARIO',
            'PILLOW',
            'RODEO RUG'
        ];

        let synced = 0;
        let created = 0;
        let updated = 0;
        let errors = [];

        // Sincronizar por categoria (queries menores, mais rápidas)
        for (const category of cdeCategories) {
            try {
                console.log(`[CATALOG] Sincronizando categoria: ${category}`);

                // Query simples por categoria com timeout de 15s
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Timeout ao buscar ${category}`)), 15000)
                );

                const categoryProducts = await Promise.race([
                    queries.getCatalogProductsByCategory(category),
                    timeoutPromise
                ]);

                console.log(`[CATALOG] ${category}: ${categoryProducts.length} produtos`);

                for (const product of categoryProducts) {
                    const displayCategory = getDisplayCategory(product.category);

                    const result = await CatalogProductModel.findOneAndUpdate(
                        { qbItem: product.qbItem },
                        {
                            $set: {
                                name: product.name || `Product ${product.qbItem}`,
                                category: product.category || 'General',
                                origin: product.origin,
                                displayCategory,
                                currentStock: product.stock || 0,
                                lastCDESync: new Date(),
                                isActive: (product.stock || 0) > 0
                            }
                        },
                        { upsert: true, new: true }
                    );

                    synced++;
                    if (result.isNew) created++;
                    else updated++;
                }
            } catch (catError) {
                console.warn(`[CATALOG] Erro na categoria ${category}:`, catError.message);
                errors.push({ category, error: catError.message });
            }
        }

        // Se temos produtos no cache, também sincronizar eles
        if (catalogCache.hasStaleData() || catalogCache.isValid()) {
            console.log('[CATALOG] Sincronizando produtos do cache...');
            const cachedProducts = catalogCache.products || [];

            for (const product of cachedProducts) {
                if (!product.qbItem) continue;

                const displayCategory = getDisplayCategory(product.category);

                try {
                    const result = await CatalogProductModel.findOneAndUpdate(
                        { qbItem: product.qbItem },
                        {
                            $set: {
                                name: product.name || `Product ${product.qbItem}`,
                                category: product.category || 'General',
                                origin: product.origin,
                                displayCategory,
                                currentStock: product.stock || 0,
                                lastCDESync: new Date(),
                                isActive: true
                            }
                        },
                        { upsert: true, new: true }
                    );

                    synced++;
                    if (result.isNew) created++;
                    else updated++;
                } catch (prodError) {
                    // Ignorar erros individuais
                }
            }
        }

        console.log(`[CATALOG] Sincronização concluída: ${synced} produtos (${created} novos, ${updated} atualizados)`);
        if (errors.length > 0) {
            console.warn(`[CATALOG] ${errors.length} categorias com erro`);
        }

        res.json({
            success: true,
            message: 'Sincronização concluída',
            stats: {
                total: synced,
                created,
                updated,
                errors: errors.length
            },
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('[CATALOG] Erro na sincronização:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao sincronizar catálogo',
            error: error.message
        });
    }
});

/**
 * GET /api/catalog/cache/status
 * Retorna status detalhado do cache
 */
router.get('/cache/status', (req, res) => {
    res.json({
        success: true,
        cache: catalogCache.getStats()
    });
});

/**
 * POST /api/catalog/cache/refresh
 * Força atualização do cache
 */
router.post('/cache/refresh', async (req, res) => {
    try {
        console.log('[CACHE] 🔄 Refresh manual solicitado...');
        const startTime = Date.now();
        const products = await catalogCache.get(true);
        const elapsed = Date.now() - startTime;

        res.json({
            success: true,
            message: 'Cache atualizado com sucesso',
            productCount: products.length,
            elapsed: elapsed + 'ms'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar cache',
            error: error.message
        });
    }
});

// ============================================
// LOGICAL STOCK ENDPOINTS - Para teste e debug
// ============================================

const CatalogSyncService = require('../services/CatalogSyncService');
// CatalogProduct já importado acima

/**
 * GET /api/catalog/logical-stock/:qbItem
 * Verificar estoque lógico de um produto específico
 */
router.get('/logical-stock/:qbItem', async (req, res) => {
    try {
        const { qbItem } = req.params;
        const catalogSyncService = CatalogSyncService.getInstance();

        // Buscar status do estoque
        const status = await catalogSyncService.getStockStatus(qbItem);

        if (!status) {
            return res.status(404).json({
                success: false,
                message: `Produto ${qbItem} não encontrado`
            });
        }

        res.json({
            success: true,
            product: status
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/catalog/sync-now
 * Forçar sincronização de estoque lógico de todos os produtos
 */
router.post('/sync-now', async (req, res) => {
    try {
        console.log('[CATALOG] 🔄 Sincronização manual de estoque lógico...');
        const catalogSyncService = CatalogSyncService.getInstance();

        const result = await catalogSyncService.syncAllCatalogStock();

        res.json({
            success: true,
            message: 'Sincronização concluída',
            ...result
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/catalog/sync-product/:qbItem
 * Sincronizar estoque lógico de um produto específico
 */
router.post('/sync-product/:qbItem', async (req, res) => {
    try {
        const { qbItem } = req.params;
        console.log(`[CATALOG] 🔄 Sincronizando estoque de ${qbItem}...`);

        const catalogSyncService = CatalogSyncService.getInstance();
        const product = await catalogSyncService.syncSingleProduct(qbItem);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: `Produto ${qbItem} não encontrado`
            });
        }

        res.json({
            success: true,
            message: `Estoque de ${qbItem} sincronizado`,
            product: {
                qbItem: product.qbItem,
                name: product.name,
                physicalStock: product.currentStock,
                reservedInCarts: product.reservedInCarts,
                confirmedInSelections: product.confirmedInSelections,
                availableStock: product.availableStock
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/catalog/stock-summary
 * Resumo do estoque lógico de todos os produtos
 */
router.get('/stock-summary', async (req, res) => {
    try {
        const CatalogProductModel = getCatalogProduct();
        const products = await CatalogProductModel.find({ isActive: true })
            .select('qbItem name currentStock reservedInCarts confirmedInSelections availableStock lastLogicalSync')
            .sort({ availableStock: -1 });

        const summary = {
            totalProducts: products.length,
            totalPhysicalStock: products.reduce((sum, p) => sum + (p.currentStock || 0), 0),
            totalReservedInCarts: products.reduce((sum, p) => sum + (p.reservedInCarts || 0), 0),
            totalConfirmedInSelections: products.reduce((sum, p) => sum + (p.confirmedInSelections || 0), 0),
            totalAvailableStock: products.reduce((sum, p) => sum + (p.availableStock || 0), 0),
            outOfStock: products.filter(p => (p.availableStock || 0) <= 0).length,
            lowStock: products.filter(p => (p.availableStock || 0) > 0 && (p.availableStock || 0) <= 3).length
        };

        res.json({
            success: true,
            summary,
            products: products.slice(0, 20) // Top 20 por disponibilidade
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Export both router and cache for access from other modules
router.catalogCache = catalogCache;
module.exports = router;
