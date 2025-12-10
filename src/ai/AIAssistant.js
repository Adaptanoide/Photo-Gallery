// src/ai/AIAssistant.js - VERSÃO 3.0
// AI Agent com detecção de intenção avançada, alertas e contexto de negócio
const Groq = require('groq-sdk');
const CDEQueries = require('./CDEQueries');
const GalleryQueries = require('./GalleryQueries');
const ConnectionManager = require('../services/ConnectionManager');
const AITrainingRule = require('../models/AITrainingRule');

class AIAssistant {
    constructor() {
        this.groq = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });

        this.cde = new CDEQueries();
        this.gallery = new GalleryQueries();
        this.testMode = false;

        this.connectionStatus = {
            cde: 'unknown',
            gallery: 'unknown'
        };

        // Conhecimento de negócio do Sunshine Cowhides - AUTO-DESCOBERTO DO CDE
        this.businessKnowledge = {
            // Lead times por país
            leadTimes: {
                'BRA': 45, 'Brazil': 45,
                'COL': 7, 'Colombia': 7,
                'POL': 45, 'Poland': 45,
                'ARG': 30, 'Argentina': 30,
                'PERU': 21,
                'CHI': 60, 'CHINA': 60,
                'USA': 3,
                'default': 30
            },

            // Produtos críticos (coasters mais vendidos)
            criticalProducts: ['2110', '2115', '2129', '2117', '2116'],
            peakSeasonMonths: [10, 11, 12], // Out-Dez
            minimumStockAlert: 100,
            agingThresholdDays: 60,

            // Marketplaces com volume de pedidos
            marketplaces: {
                'ETSY': { name: 'Etsy', orders: 10633, rank: 1 },
                'AMAZON': { name: 'Amazon', orders: 5372, rank: 2 },
                'SHOPIFY': { name: 'Shopify', orders: 3717, rank: 3 },
                'EBAY': { name: 'eBay', orders: 2278, rank: 4 },
                'WAYFAIR': { name: 'Wayfair', orders: 624, rank: 5 },
                'FAIRE': { name: 'Faire', orders: 490, rank: 6 },
                'OVERSTOCK': { name: 'Overstock', orders: 437, rank: 7 },
                'WALMART': { name: 'Walmart', orders: 282, rank: 8 },
                'HOUZZ': { name: 'Houzz', orders: 186, rank: 9 }
            },

            // Status do inventário (AESTADOP)
            inventoryStatus: {
                'INGRESADO': 'Em estoque, disponível para venda',
                'RETIRADO': 'Vendido/Retirado do estoque',
                'STANDBY': 'Aguardando (foto ou liberação)',
                'PRE-SELECTED': 'Pré-selecionado por cliente',
                'RESERVED': 'Reservado para pedido'
            },

            // Status da ordem (AESTADO_OR)
            orderStatus: {
                'FACTURADA': 'Faturada/Paga',
                'CLOSE': 'Fechada/Concluída',
                'CANCEL': 'Cancelada',
                'PENDING': 'Pendente',
                'OPEN': 'Aberta'
            },

            // Categorias de produtos
            categories: ['COWHIDES', 'ACCESORIOS', 'DESIGNER RUG', 'SMALL HIDES', 'MOBILIARIO', 'SHEEPSKIN', 'PILLOW', 'RODEO RUG'],

            // Fornecedores principais
            suppliers: {
                'S10': { name: 'Dekoland', country: 'BRA' },
                'S11': { name: 'Minuano', country: 'BRA' },
                'S21': { name: 'C&A', country: 'BRA' },
                'S31': { name: 'Best Brasil', country: 'BRA' },
                'S32': { name: 'Curtidos de Colombia', country: 'COL' },
                'S52': { name: 'Curtinorte', country: 'COL' },
                'S62': { name: 'Grupo Tarsis', country: 'COL' },
                'S72': { name: 'Curtidos LeatherCol', country: 'COL' },
                'S92': { name: 'Pison Cowhides', country: 'COL' },
                'S94': { name: 'Pieles y Cueros', country: 'PERU' },
                'S96': { name: 'Sheep 4 You', country: 'POL' },
                'S98': { name: 'GENA', country: 'POL' }
            },

            // Origens de produtos com volume
            origins: {
                'COL': { name: 'Colombia', items: 107869, leadTime: 7 },
                'BRA': { name: 'Brazil', items: 97214, leadTime: 45 },
                'PERU': { name: 'Peru', items: 6756, leadTime: 21 },
                'CHINA': { name: 'China', items: 200, leadTime: 60 },
                'USA': { name: 'USA', items: 50, leadTime: 3 }
            },

            // Tipos de movimento (tbmovimientos.ATIPOMOV)
            movementTypes: {
                '1': 'INGRESADO - Entrada no estoque',
                '2': 'RETIRADO - Saída/Venda',
                '3': 'STANDBY - Aguardando foto/liberação'
            },

            // Nota: PRE-SELECTED e RESERVED são usados principalmente na Gallery (sistema de fotos)
            // Nem todos os produtos têm fotos (ATIPOETIQUETA pode ser vazio)
            galleryOnlyStates: ['PRE-SELECTED', 'RESERVED'],

            // ========== CONHECIMENTO DE PRODUTOS ==========
            // Estrutura: PREFIXO define categoria, SUFIXO define variação

            productPrefixes: {
                '5': { category: 'COWHIDES', description: 'Cowhides (mais importantes)', priority: 1 },
                '4': { category: 'DESIGNER RUG', description: 'Designer Rugs', priority: 2 },
                '2': { category: 'ACCESORIOS', description: 'Acessórios (coasters, pillows, placemats)', priority: 3 },
                '6': { category: 'COWHIDES DYED', description: 'Cowhides Dyed/Special Colors', priority: 4 },
                '3': { category: 'DESIGNER RUG', description: 'Designer Rugs Special', priority: 5 },
                '1': { category: 'SHEEPSKIN', description: 'Slippers, Sheepskin products', priority: 6 },
                '9': { category: 'EXOTIC', description: 'Calfskin, Exotic hides', priority: 7 },
                '8': { category: 'SHEEPSKIN', description: 'Sheepskin Rugs', priority: 8 },
                '7': { category: 'OTHER', description: 'Outros produtos', priority: 9 }
            },

            // COWHIDES (5XXX) - Estrutura detalhada
            cowhideStructure: {
                // Colombia (52XX)
                '5200': { origin: 'COL', size: 'S', sqm: '2.50-2.99' },
                '5201': { origin: 'COL', size: 'M', sqm: '3.00-3.49' },
                '5202': { origin: 'COL', size: 'L', sqm: '3.50-3.99' },
                '5203': { origin: 'COL', size: 'XL', sqm: '4.05-4.50+' },
                '5204': { origin: 'COL', size: 'S/M', sqm: '2.50-3.49', type: 'Tannery Run' },
                '5205': { origin: 'COL', size: 'L/XL', sqm: '3.50-4.50+', type: 'Tannery Run' },
                '5206': { origin: 'COL', size: 'Mini', sqm: '24x35' },
                // Brazil (53XX)
                '5300': { origin: 'BRA', size: 'XS', sqm: '1.40-2.39' },
                '5301': { origin: 'BRA', size: 'S', sqm: '2.00-2.99' },
                '5302': { origin: 'BRA', size: 'M/L', sqm: '3.00-3.79' },
                '5303': { origin: 'BRA', size: 'XL/Jumbo', sqm: '3.80-4.25+' },
                // Brazil Promo (536X, 537X)
                '5365': { origin: 'BRA', size: 'S', sqm: '2.40-2.99', type: 'Super Promo' },
                '5375': { origin: 'BRA', size: 'ML/XL', sqm: '3.00-4.20', type: 'Super Promo' },
                // Brazil Special (547X, 550X)
                '5475': { origin: 'BRA', size: 'Mixed', sqm: '3.00-4.25', type: 'Tannery Run' },
                '5500': { origin: 'BRA', size: 'Various', type: 'With Leather Binding and Lined' }
            },

            // Sufixos de Cor/Padrão para COWHIDES
            cowhideSuffixes: {
                // Padrões básicos
                'BRI': 'Brindle',
                'TRI': 'Tricolor',
                'SP': 'Salt & Pepper',
                'BLW': 'Black & White',
                'BRW': 'Brown & White',
                'EXO': 'Exotic',
                'GR': 'Solid Grey',
                'BL': 'Black',
                'BR': 'Brindle/Brown',
                'PE': 'Palomino/Exotic',
                'SB': 'Salt Black',
                'TP': 'Taupe',
                'SC': 'Special Colors',
                'LGT': 'Light (claro)',
                'DRK': 'Dark (escuro)',
                'BLK': 'Black',
                'CHO': 'Chocolate',
                // Tricolor variations
                'TRC': 'Tricolor Classic',
                'TRS': 'Tricolor Special',
                'TRD': 'Tricolor Dark',
                'TRV': 'Tricolor Vivid',
                'PIC': 'Tricolor Picasso',
                // Brindle variations
                'ABB': 'Assorted Brindle Belly',
                'ABK': 'Assorted Brindle Black',
                'ADB': 'Assorted Dark Brindle',
                'AWB': 'Assorted White Brindle',
                // ZETA codes (Amazon)
                'Z BB': 'ZETA Brindle Belly (Amazon)',
                'Z BD': 'ZETA Brindle Dark Belly (Amazon)',
                'Z BM': 'ZETA Brindle Medium (Amazon)',
                'Z BR': 'ZETA Brindle Reddish (Amazon)',
                'Z DM': 'ZETA Dark Medium (Amazon)',
                'Z PA': 'ZETA Palomino Solid (Amazon)',
                'Z GB': 'ZETA Greyish Beige (Amazon)',
                'Z DR': 'ZETA Dark Reddish (Amazon)'
            },

            // Cowhides Dyed (6XXX)
            dyedCowhides: {
                // Natural colors (not dyed)
                '6001': { color: 'Grey', size: 'S', sqm: '2.40-2.99', dyed: false },
                '6002': { color: 'Grey', size: 'M/L', sqm: '3.00-3.79', dyed: false },
                '6003': { color: 'Grey', size: 'XL', sqm: '3.80-4.25+', dyed: false },
                '6011': { color: 'Natural White', size: 'S', sqm: '2.00-2.99', dyed: false },
                '6012': { color: 'Natural White', size: 'M/L', sqm: '3.00-3.79', dyed: false },
                '6013': { color: 'Natural White', size: 'XL', sqm: '3.80-4.25+', dyed: false },
                '6021': { color: 'Butter Cream', size: 'S', dyed: false },
                '6022': { color: 'Butter Cream', size: 'M/L', dyed: false },
                '6023': { color: 'Butter Cream', size: 'XL', dyed: false },
                // Dyed colors (rest of 6XXX)
                'default': { dyed: true, description: 'Dyed Cowhide' }
            },

            // Designer Rugs (4XXX)
            designerRugs: {
                '41': { type: 'Bedside', size: '22X34' },
                '42': { type: 'Runner', size: '2.5X8' },
                '44': { type: 'Designer', size: '4X6' },
                '45': { type: 'Designer', size: '5X7' },
                '46': { type: 'Designer', size: '6X8' },
                '49': { type: 'Designer XL', size: '9X11' }
            },

            // Rug patterns
            rugPatterns: ['Plain', 'CHEVRON', 'ROPE THREAD', 'Star', 'Longhorn', 'MultiStar'],
            rugColors: ['Degrade', 'Greyish Tones', 'Off White', 'Palomino Tones Mix', 'Tricolor', 'Taupe/Champagne Mix'],

            // Coasters - Top Sellers (211X-213X)
            coasters: {
                '2110': 'Coaster Plain',
                '2115': 'Coaster TX Star',
                '2116': 'Coaster Longhorn Head',
                '2117': 'Coaster Horseshoe',
                '2119': 'Coaster Horse',
                '2129': 'Coaster TX Map',
                '2130': 'Coaster Hide Shape Plain',
                '2135': 'Coaster Hide Shape TX Star'
            },

            // ZETA = Amazon specific codes (Z prefix in suffix)
            zetaInfo: {
                description: 'Códigos ZETA são específicos para Amazon',
                pattern: 'Base code + Z + Color code',
                examples: ['5302Z BR', '5302Z DM', '5303Z PA']
            }
        };

        // Sistema de pesos para detecção de intenção
        this.intentWeights = {
            inventory: ['inventory', 'stock', 'estoque', 'available', 'how many', 'quantity'],
            restock: ['restock', 'order', 'buy', 'need', 'low stock', 'running out', 'replenish'],
            sales: ['sales', 'selling', 'sold', 'revenue', 'vendas', 'performance'],
            clients: ['client', 'customer', 'vip', 'buyer', 'cliente'],
            carts: ['cart', 'carrinho', 'shopping', 'checkout', 'reserved'],
            aging: ['aging', 'old', 'stale', 'slow moving', 'sitting', 'parado'],
            transit: ['transit', 'shipping', 'arriving', 'coming', 'transito', 'warehouse'],
            seasonal: ['season', 'holiday', 'christmas', 'peak', 'december', 'summer', 'winter'],
            channels: ['channel', 'marketplace', 'etsy', 'amazon', 'shopify', 'where'],
            trending: ['trending', 'hot', 'popular', 'best', 'top', 'fast moving'],
            forecast: ['forecast', 'predict', 'projection', 'when', 'will run out', 'estimate'],
            comparison: ['compare', 'vs', 'versus', 'difference', 'better', 'worse', 'month'],
            dashboard: ['dashboard', 'overview', 'summary', 'status', 'everything', 'general'],
            alerts: ['alert', 'warning', 'attention', 'urgent', 'critical', 'problem']
        };

        this.initializeGallery();
    }

    async initializeGallery() {
        try {
            const connected = await this.gallery.initialize();
            this.connectionStatus.gallery = connected ? 'online' : 'offline';
            console.log(`📸 Gallery connection: ${this.connectionStatus.gallery}`);
        } catch (error) {
            console.error('❌ Gallery initialization error:', error.message);
            this.connectionStatus.gallery = 'offline';
        }
    }

    async processQuery(question) {
        try {
            console.log('📊 Processing question:', question);

            const quickResponse = this.handleSimpleQueries(question);
            if (quickResponse) return quickResponse;

            const customRules = await this.getRelevantTrainingRules(question);
            const context = await this.gatherContext(question);

            if (!context || (Object.keys(context).length === 1 && context.error)) {
                return this.getFallbackResponse(question);
            }

            const response = await this.generateResponse(question, context, customRules);
            return response;

        } catch (error) {
            console.error('❌ AI Error:', error);
            return this.getErrorResponse(error);
        }
    }

    handleSimpleQueries(question) {
        const lowerQ = question.toLowerCase().trim();

        if (lowerQ.match(/^(hi|hello|hey|good morning|good afternoon|greetings?)$/)) {
            const greetings = [
                "👋 Hey Andy! Ready to dive into today's numbers?",
                "Hello Andy! What would you like to analyze today?",
                "Hi Andy! I've got fresh data from both CDE and Gallery ready for you.",
                "Good to see you, Andy! What insights can I provide today?"
            ];
            return greetings[Math.floor(Math.random() * greetings.length)];
        }

        if (lowerQ.match(/^(thanks|thank you|thx|ty)$/)) {
            return "You're welcome, Andy! Let me know if you need anything else. 📊";
        }

        if (lowerQ === 'status' || lowerQ === 'are you working') {
            const cdeStatus = this.connectionStatus.cde === 'online' ? '✅' : '❌';
            const galleryStatus = this.connectionStatus.gallery === 'online' ? '✅' : '❌';
            return `System Status:\n\n${cdeStatus} CDE (Warehouse Database)\n${galleryStatus} Gallery (Photos, Clients, Carts)\n\nAll systems ready!`;
        }

        return null;
    }

    /**
     * Detectar intenções da pergunta usando sistema de pesos
     */
    detectIntents(question) {
        const lowerQuestion = question.toLowerCase();
        const intentScores = {};

        for (const [intent, keywords] of Object.entries(this.intentWeights)) {
            let score = 0;
            for (const keyword of keywords) {
                if (lowerQuestion.includes(keyword)) {
                    score += keyword.includes(' ') ? 2 : 1; // Frases valem mais
                }
            }
            if (score > 0) {
                intentScores[intent] = score;
            }
        }

        // Ordenar por score e pegar top 3
        const sortedIntents = Object.entries(intentScores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([intent]) => intent);

        return sortedIntents.length > 0 ? sortedIntents : ['dashboard'];
    }

    async gatherContext(question) {
        const context = {};
        const lowerQuestion = question.toLowerCase();

        // Usar sistema de detecção de intenção avançado
        const intents = this.detectIntents(question);
        console.log(`🎯 Intenções detectadas: ${intents.join(', ')}`);

        try {
            // =============================================
            // DETECTAR TIPO DE PERGUNTA (compatibilidade)
            // =============================================

            const isGalleryQuestion =
                lowerQuestion.includes('photo') ||
                lowerQuestion.includes('gallery') ||
                lowerQuestion.includes('picture') ||
                lowerQuestion.includes('image');

            const isClientQuestion = intents.includes('clients') ||
                lowerQuestion.includes('client') ||
                lowerQuestion.includes('customer') ||
                lowerQuestion.includes('vip') ||
                lowerQuestion.includes('sales rep') ||
                lowerQuestion.includes('marketing');

            const isCartQuestion = intents.includes('carts') ||
                lowerQuestion.includes('cart') ||
                lowerQuestion.includes('carrinho') ||
                lowerQuestion.includes('shopping');

            const isSelectionQuestion =
                lowerQuestion.includes('selection') ||
                lowerQuestion.includes('order') ||
                lowerQuestion.includes('pedido');

            const isComingSoonQuestion = intents.includes('transit') ||
                lowerQuestion.includes('coming soon') ||
                lowerQuestion.includes('transit') ||
                lowerQuestion.includes('arriving') ||
                lowerQuestion.includes('transito');

            const isReservedQuestion =
                lowerQuestion.includes('reserved') ||
                lowerQuestion.includes('reservation') ||
                lowerQuestion.includes('reserva');

            const isPricingQuestion =
                lowerQuestion.includes('price') ||
                lowerQuestion.includes('pricing') ||
                lowerQuestion.includes('preço') ||
                lowerQuestion.includes('valor');

            const isInventoryQuestion = intents.includes('inventory') ||
                lowerQuestion.includes('inventory') ||
                lowerQuestion.includes('stock') ||
                lowerQuestion.includes('estoque');

            const isRestockQuestion = intents.includes('restock') ||
                lowerQuestion.includes('restock') ||
                lowerQuestion.includes('order') ||
                lowerQuestion.includes('buy') ||
                lowerQuestion.includes('need');

            const isSalesQuestion = intents.includes('sales') ||
                lowerQuestion.includes('sales') ||
                lowerQuestion.includes('selling') ||
                lowerQuestion.includes('vendas') ||
                lowerQuestion.includes('sold');

            const isChannelQuestion = intents.includes('channels') ||
                lowerQuestion.includes('channel') ||
                lowerQuestion.includes('marketplace') ||
                lowerQuestion.includes('etsy') ||
                lowerQuestion.includes('amazon') ||
                lowerQuestion.includes('shopify');

            const isTopQuestion = intents.includes('trending') ||
                lowerQuestion.includes('top') ||
                lowerQuestion.includes('best') ||
                lowerQuestion.includes('most') ||
                lowerQuestion.includes('popular');

            const isDashboardQuestion = intents.includes('dashboard') ||
                lowerQuestion.includes('dashboard') ||
                lowerQuestion.includes('overview') ||
                lowerQuestion.includes('summary') ||
                lowerQuestion.includes('resumo') ||
                lowerQuestion.includes('geral');

            const isExpiringQuestion =
                lowerQuestion.includes('expir') ||
                lowerQuestion.includes('expiring');

            const isForecastQuestion = intents.includes('forecast') ||
                lowerQuestion.includes('when') ||
                lowerQuestion.includes('projection') ||
                lowerQuestion.includes('run out');

            const isComparisonQuestion = intents.includes('comparison') ||
                lowerQuestion.includes('compare') ||
                lowerQuestion.includes('vs') ||
                lowerQuestion.includes('month');

            const isSeasonalQuestion = intents.includes('seasonal') ||
                lowerQuestion.includes('season') ||
                lowerQuestion.includes('holiday');

            const isAgingQuestion = intents.includes('aging') ||
                lowerQuestion.includes('aging') ||
                lowerQuestion.includes('old') ||
                lowerQuestion.includes('slow');

            // =============================================
            // GALLERY QUERIES (MongoDB)
            // =============================================

            if (this.connectionStatus.gallery === 'online') {

                // Dashboard / Overview geral
                if (isDashboardQuestion) {
                    context.fullDashboard = await ConnectionManager.executeWithCache(
                        'fullDashboard',
                        () => this.gallery.getFullDashboardData(),
                        10
                    );
                }

                // Perguntas sobre fotos
                else if (isGalleryQuestion) {
                    context.gallerySummary = await ConnectionManager.executeWithCache(
                        'gallerySummary',
                        () => this.gallery.getGallerySummary(),
                        15
                    );
                    context.photosByCategory = await ConnectionManager.executeWithCache(
                        'photosByCategory',
                        () => this.gallery.getPhotosByCategory(10),
                        30
                    );
                }

                // Perguntas sobre clientes
                else if (isClientQuestion) {
                    context.clientsSummary = await ConnectionManager.executeWithCache(
                        'clientsSummary',
                        () => this.gallery.getClientsSummary(),
                        15
                    );

                    if (isTopQuestion || lowerQuestion.includes('usage')) {
                        context.topClients = await this.gallery.getTopClientsByUsage(10);
                    }

                    if (lowerQuestion.includes('vip')) {
                        context.vipClients = await this.gallery.getVipClients();
                    }

                    if (lowerQuestion.includes('sales rep')) {
                        context.clientsBySalesRep = await this.gallery.getClientsBySalesRep();
                    }

                    if (lowerQuestion.includes('marketing') || lowerQuestion.includes('email')) {
                        context.marketingStats = await this.gallery.getMarketingStats();
                    }

                    if (lowerQuestion.includes('inactive') || lowerQuestion.includes('inativo')) {
                        context.inactiveClients = await this.gallery.getInactiveClients(30);
                    }

                    if (lowerQuestion.includes('recent') || lowerQuestion.includes('active')) {
                        context.recentlyActiveClients = await this.gallery.getRecentlyActiveClients(7);
                    }

                    if (lowerQuestion.includes('region') || lowerQuestion.includes('state')) {
                        context.clientsByRegion = await this.gallery.getClientsByRegion();
                    }

                    // Buscar cliente específico
                    const clientMatch = lowerQuestion.match(/client\s+([a-z0-9]{4})/i);
                    if (clientMatch) {
                        const clientCode = clientMatch[1].toUpperCase();
                        context.specificClient = await this.gallery.getClientByCode(clientCode);
                        context.clientSelections = await this.gallery.getSelectionsByClient(clientCode);
                        context.clientCart = await this.gallery.getCartByClient(clientCode);
                    }
                }

                // Perguntas sobre carrinhos
                else if (isCartQuestion) {
                    context.cartsSummary = await ConnectionManager.executeWithCache(
                        'cartsSummary',
                        () => this.gallery.getActiveCartsSummary(),
                        5
                    );

                    if (isTopQuestion || lowerQuestion.includes('most items')) {
                        context.topCarts = await this.gallery.getCartsWithMostItems(10);
                    }

                    if (isExpiringQuestion) {
                        context.expiringCarts = await this.gallery.getCartsExpiringSoon(6);
                    }

                    if (isComingSoonQuestion) {
                        context.comingSoonInCarts = await this.gallery.getComingSoonItemsInCarts();
                    }

                    if (lowerQuestion.includes('ghost') || lowerQuestion.includes('conflict')) {
                        context.ghostItems = await this.gallery.getGhostItemsInCarts();
                    }
                }

                // Perguntas sobre seleções
                else if (isSelectionQuestion) {
                    context.activeSelections = await this.gallery.getActiveSelections();
                    context.selectionStats = await this.gallery.getSelectionStats();
                }

                // Perguntas sobre Coming Soon
                else if (isComingSoonQuestion) {
                    context.comingSoonPhotos = await ConnectionManager.executeWithCache(
                        'comingSoonPhotos',
                        () => this.gallery.getComingSoonPhotos(),
                        30
                    );
                }

                // Perguntas sobre reservas
                else if (isReservedQuestion) {
                    context.reservedPhotos = await this.gallery.getReservedPhotos();

                    if (isExpiringQuestion) {
                        context.expiringPhotos = await this.gallery.getPhotosExpiringSoon(24);
                    }
                }

                // Perguntas sobre preços (Gallery)
                else if (isPricingQuestion) {
                    context.categoriesWithPricing = await this.gallery.getCategoriesWithPricing();
                    context.pricingAnalysis = await this.gallery.getPricingAnalysis();
                }
            }

            // =============================================
            // CDE QUERIES (MySQL)
            // =============================================

            if (isInventoryQuestion) {
                context.totalInventory = await ConnectionManager.executeWithCache(
                    'totalInventory',
                    () => this.cde.getTotalInventoryAnalysis(),
                    30
                );

                if (lowerQuestion.includes('detail')) {
                    context.inventoryDetails = await this.cde.getCurrentInventory();
                }
            }

            if (isRestockQuestion) {
                context.restocking = await ConnectionManager.executeWithCache(
                    'restocking',
                    () => this.cde.getRestockingNeeds(),
                    15
                );

                if (lowerQuestion.includes('aging') || lowerQuestion.includes('old')) {
                    context.aging = await this.cde.getAgingProducts();
                }
            }

            if (isSalesQuestion || isTopQuestion) {
                context.topProducts = await ConnectionManager.executeWithCache(
                    'topProducts',
                    () => this.cde.getTopSellingProducts(),
                    60
                );

                if (lowerQuestion.includes('today') || lowerQuestion.includes('daily')) {
                    context.dailyPerformance = await this.cde.getDailySalesPerformance();
                }

                context.recentSales = await this.cde.getRecentSales();
            }

            if (isChannelQuestion) {
                context.salesByChannel = await ConnectionManager.executeWithCache(
                    'salesByChannel',
                    () => this.cde.getSalesByChannel(),
                    120
                );
            }

            if (lowerQuestion.includes('velocity') || lowerQuestion.includes('speed')) {
                context.salesVelocity = await ConnectionManager.executeWithCache(
                    'salesVelocity',
                    () => this.cde.getSalesVelocity(),
                    30
                );
            }

            if (lowerQuestion.includes('flow') || lowerQuestion.includes('movement')) {
                context.inventoryFlow = await this.cde.getInventoryFlow();
            }

            if (lowerQuestion.includes('trending') || lowerQuestion.includes('new product')) {
                context.trendingProducts = await this.cde.getTrendingNewProducts();
            }

            // =============================================
            // NOVAS QUERIES AVANÇADAS (V3.0)
            // =============================================

            // Análise de sazonalidade
            if (isSeasonalQuestion) {
                context.seasonalTrends = await ConnectionManager.executeWithCache(
                    'seasonalTrends',
                    () => this.cde.getSeasonalTrends(),
                    120
                );
            }

            // Previsão de estoque / quando vai acabar
            if (isForecastQuestion || lowerQuestion.includes('projection')) {
                context.stockProjection = await ConnectionManager.executeWithCache(
                    'stockProjection',
                    () => this.cde.getStockProjection(),
                    30
                );
            }

            // Comparativo mensal
            if (isComparisonQuestion || lowerQuestion.includes('this month')) {
                context.monthlyComparison = await ConnectionManager.executeWithCache(
                    'monthlyComparison',
                    () => this.cde.getMonthlyComparison(),
                    60
                );
            }

            // Produtos aging / inativos
            if (isAgingQuestion) {
                context.agingProducts = await this.cde.getAgingProducts();
                context.inactiveProducts = await this.cde.getInactiveProducts(60);
            }

            // Análise de lead times
            if (isComingSoonQuestion || lowerQuestion.includes('lead time')) {
                context.leadTimeAnalysis = await ConnectionManager.executeWithCache(
                    'leadTimeAnalysis',
                    () => this.cde.getLeadTimeAnalysis(),
                    60
                );
                context.detailedTransit = await this.cde.getDetailedTransitProducts();
            }

            // Estoque crítico
            if (isRestockQuestion || lowerQuestion.includes('critical') || lowerQuestion.includes('urgent')) {
                context.criticalStock = await ConnectionManager.executeWithCache(
                    'criticalStock',
                    () => this.cde.getCriticalStock(),
                    15
                );
            }

            // Produtos por origem / fornecedor
            if (lowerQuestion.includes('origin') || lowerQuestion.includes('supplier') || lowerQuestion.includes('brazil') || lowerQuestion.includes('colombia')) {
                context.productsByOrigin = await ConnectionManager.executeWithCache(
                    'productsByOrigin',
                    () => this.cde.getProductsByOrigin(),
                    60
                );
            }

            // Vendas por cliente
            if (isClientQuestion && isSalesQuestion) {
                context.salesByClient = await this.cde.getSalesByClient();
            }

            // Análise de preço vs velocidade
            if (isPricingQuestion || lowerQuestion.includes('velocity')) {
                context.priceVelocity = await ConnectionManager.executeWithCache(
                    'priceVelocity',
                    () => this.cde.getPriceVelocityAnalysis(),
                    60
                );
            }

            // Se nenhuma query específica, buscar dados básicos
            if (Object.keys(context).length === 0) {
                context.basicInfo = await ConnectionManager.executeWithCache(
                    'basicInfo',
                    async () => ({
                        inventory: await this.cde.getTotalInventoryAnalysis(),
                        topProducts: await this.cde.getTopSellingProducts()
                    }),
                    60
                );

                if (this.connectionStatus.gallery === 'online') {
                    context.gallerySummary = await ConnectionManager.executeWithCache(
                        'gallerySummary',
                        () => this.gallery.getGallerySummary(),
                        15
                    );
                }
            }

            // Adicionar conhecimento de negócio ao contexto
            context.businessKnowledge = this.businessKnowledge;

        } catch (error) {
            console.error('⚠️ Erro ao buscar contexto:', error.message);
            context.error = 'Some data sources are temporarily unavailable.';
        }

        return context;
    }

    async generateResponse(question, context, customRules = []) {
        if (context.error && Object.keys(context).length === 1) {
            return this.getErrorResponse();
        }

        // Construir regras customizadas com detalhes estruturados
        let customRulesText = '';
        if (customRules.length > 0) {
            customRulesText = '\n\n📋 CUSTOM BUSINESS RULES FROM ANDY:\n';
            customRules.forEach(rule => {
                customRulesText += `• ${rule.type.toUpperCase()}: ${rule.description}`;
                if (rule.trigger_value && rule.trigger_comparison) {
                    customRulesText += ` [Trigger: when value ${rule.trigger_comparison} ${rule.trigger_value}]`;
                }
                if (rule.product_codes && rule.product_codes.length > 0) {
                    customRulesText += ` [Products: ${rule.product_codes.join(', ')}]`;
                }
                if (rule.lead_time_days) {
                    customRulesText += ` [Lead time: ${rule.lead_time_days} days]`;
                }
                if (rule.reorder_quantity) {
                    customRulesText += ` [Reorder: ${rule.reorder_quantity} units]`;
                }
                if (rule.action_recommended) {
                    customRulesText += ` [Action: ${rule.action_recommended}]`;
                }
                customRulesText += '\n';
            });
        }

        // Verificar se estamos em período sazonal
        const currentMonth = new Date().getMonth() + 1;
        const isPeakSeason = this.businessKnowledge.peakSeasonMonths.includes(currentMonth);
        const seasonalContext = isPeakSeason ?
            '\n⚠️ SEASONAL ALERT: We are in PEAK SEASON (Oct-Dec). Stock levels should be 30% higher than normal.\n' : '';

        const systemPrompt = `You are SUNSHINE AI, an intelligent business assistant for Andy, owner of Sunshine Cowhides - a B2B wholesale cowhide and leather goods company.

🎯 YOUR ROLE:
You are not just a chatbot - you are Andy's analytical partner who:
• Understands the cowhide business deeply
• Proactively identifies opportunities and risks
• Provides actionable insights, not just data dumps
• Thinks ahead and anticipates Andy's needs

📊 CORE PRINCIPLES:
1. BE ANALYTICAL - When you have data, analyze it deeply. Find patterns, anomalies, trends.
2. BE PROACTIVE - Don't wait to be asked. If you see a problem, mention it.
3. BE SPECIFIC - Use actual numbers from the data. Never invent statistics.
4. BE ACTIONABLE - Every insight should lead to a possible action.
5. BE HONEST - If data is limited or unavailable, say so clearly.

🏢 SUNSHINE COWHIDES BUSINESS CONTEXT:
• Product focus: Cowhides, coasters (top sellers: 2110, 2115, 2129), leather goods
• Categories: COWHIDES, ACCESORIOS, DESIGNER RUG, SMALL HIDES, MOBILIARIO, SHEEPSKIN, PILLOW
• Critical threshold: Products below 100 units need attention
• Aging threshold: Products sitting 60+ days need review
${seasonalContext}
🛒 MARKETPLACES (by order volume):
1. Etsy: ~10,600 orders (TOP CHANNEL - 44%)
2. Amazon: ~5,400 orders (22%)
3. Shopify: ~3,700 orders (15%)
4. eBay: ~2,300 orders (9%)
5. Others: Wayfair, Faire, Overstock, Walmart, Houzz (~10%)

🌍 SUPPLIERS & LEAD TIMES:
• Colombia (COL): 7 days - Curtidos de Colombia, Curtinorte, Grupo Tarsis, Pison Cowhides
• Brazil (BRA): 45 days - Dekoland, Minuano, C&A, Best Brasil
• Peru (PERU): 21 days - Pieles y Cueros
• Poland (POL): 45 days - Sheep 4 You, GENA
• China (CHI): 60 days

📝 TERMINOLOGY & STATUS CODES:
• "QBITEMs" or "product codes" = product types (like 2110, 2115)
• "units" or "pieces" = individual inventory items
• INVENTORY STATUS (AESTADOP):
  - INGRESADO = in stock, available for sale
  - RETIRADO = sold/shipped out
  - STANDBY = waiting for photo or release
  - PRE-SELECTED = pre-selected by client
  - RESERVED = reserved for order
• ORDER STATUS (AESTADO_OR):
  - FACTURADA = invoiced/paid
  - CLOSE = completed
  - PENDING = pending
  - CANCEL = cancelled

🏷️ PRODUCT CODE STRUCTURE (QBITEM):
• First digit defines category:
  - 5XXX = COWHIDES (most important!) - Brazil & Colombia
  - 4XXX = DESIGNER RUGS
  - 2XXX = ACCESSORIES (coasters 211X-213X are top sellers)
  - 6XXX = DYED COWHIDES (except 600X/601X/602X which are natural colors)
  - 3XXX = SPECIAL DESIGNER RUGS
  - 1XXX = SLIPPERS/SHEEPSKIN
  - 9XXX = CALFSKIN/EXOTIC

• COWHIDES (5XXX) structure:
  - 520X = Colombia (S/M/L/XL by last digit: 0=S, 1=M, 2=L, 3=XL)
  - 530X = Brazil (same size pattern)
  - 5365 = Brazil Super Promo Small
  - 5375 = Brazil Super Promo ML/XL
  - 5475 = Brazil Tannery Run

• COWHIDE SUFFIXES (color/pattern):
  - BRI = Brindle, TRI = Tricolor, SP = Salt & Pepper
  - BLW = Black & White, BRW = Brown & White
  - LGT = Light, DRK = Dark, EXO = Exotic
  - Z XX = ZETA codes (Amazon specific): Z BR=Brindle Reddish, Z DM=Dark Medium, Z BB=Brindle Belly, Z PA=Palomino

• DESIGNER RUGS (4XXX):
  - 41XX = Bedside 22X34, 42XX = Runner 2.5X8
  - 44XX = 4X6, 45XX = 5X7, 46XX = 6X8, 49XX = 9X11

• TOP COASTERS (2110-2135):
  - 2110 = Plain, 2115 = TX Star, 2116 = Longhorn, 2117 = Horseshoe, 2129 = TX Map

📋 RESPONSE FORMAT:
• Use emojis purposefully: 📊📈📦💰🎯✅⚠️🟢🟡🔴🚨
• Use bullet points (•) for lists
• Use numbers (1, 2, 3) for priorities or action steps
• Add clear section breaks for readability
• NO markdown formatting (no ** or ## or __)
• Keep responses focused but comprehensive
• Start with the most important insight

🔍 DATA SOURCES:
• CDE (MySQL): Warehouse inventory, sales history, orders, products in transit
• Gallery (MongoDB): Photos, clients, carts, selections, pricing
• Training Rules: Custom business logic defined by Andy

⚡ ANALYSIS APPROACH:
When analyzing data:
1. Identify the KEY INSIGHT first
2. Support with specific numbers
3. Compare to benchmarks when possible (last month, average, etc.)
4. Highlight anomalies or concerns
5. Suggest concrete next steps

❌ NEVER DO:
• Never invent numbers or percentages not in the data
• Never give generic advice - be specific to Sunshine's situation
• Never ignore warning signs in the data
• Never be overly apologetic - be confident and helpful
${customRulesText}
Remember: Andy relies on you to help run his business. Be the analytical partner he needs.`;

        const userMessage = `Question: ${question}

Available Data:
${JSON.stringify(context, null, 2)}

Analyze this data and provide helpful, actionable insights. Be specific and use the actual numbers from the data.`;

        const completion = await this.groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.5,
            max_tokens: 1200
        });

        return completion.choices[0].message.content;
    }

    async getRelevantTrainingRules(question) {
        try {
            const rules = await AITrainingRule.find({ applied: true });
            const lowerQ = question.toLowerCase();

            return rules.filter(rule => {
                if (rule.type === 'general') return true;
                if (rule.type === 'restock' && lowerQ.includes('restock')) return true;
                if (rule.type === 'pricing' && lowerQ.includes('price')) return true;
                if (rule.type === 'seasonal' && (lowerQ.includes('season') || lowerQ.includes('holiday'))) return true;
                if (rule.type === 'client' && lowerQ.includes('client')) return true;
                return false;
            });
        } catch (error) {
            console.error('Error fetching training rules:', error);
            return [];
        }
    }

    getFallbackResponse(question) {
        return `👋 Hey Andy! I can help you analyze:

📦 Inventory & Stock
  • Current inventory levels
  • Restocking needs
  • Aging products
  • Products in transit

📈 Sales & Performance
  • Top selling products
  • Sales by channel
  • Daily performance
  • Sales velocity

📸 Gallery & Photos
  • Available photos
  • Reserved photos
  • Coming soon items
  • Photos by category

👥 Clients
  • Client list & activity
  • VIP clients
  • Clients by sales rep
  • Marketing stats

🛒 Carts & Selections
  • Active carts
  • Client selections
  • Expiring items

What would you like to know?`;
    }

    getErrorResponse(error = null) {
        if (error && error.message && error.message.includes('timeout')) {
            return `⏱️ The database is taking longer than usual to respond.

Try:
1. A simpler, more specific question
2. Asking about one thing at a time
3. Waiting a moment and trying again

What specific data do you need?`;
        }

        return `⚠️ I'm having trouble accessing some data right now.

I can still try to help! What would you like to know about?
• Inventory
• Sales
• Gallery photos
• Clients
• Carts`;
    }

    async getMetrics() {
        try {
            const metrics = await ConnectionManager.executeWithCache(
                'dashboardMetrics',
                async () => {
                    const inventory = await this.cde.getCurrentInventory();
                    const transit = await this.cde.getProductsInTransit();
                    const sales = await this.cde.getRecentSales();

                    const totalInventory = inventory.reduce((sum, item) => sum + item.quantity, 0);
                    const totalTransit = transit.reduce((sum, item) => sum + item.quantity, 0);
                    const totalSales = sales.reduce((sum, day) => sum + day.quantity, 0);

                    let galleryMetrics = {};
                    if (this.connectionStatus.gallery === 'online') {
                        try {
                            const gallerySummary = await this.gallery.getGallerySummary();
                            const clientsSummary = await this.gallery.getClientsSummary();
                            const cartsSummary = await this.gallery.getActiveCartsSummary();

                            galleryMetrics = {
                                galleryPhotos: gallerySummary.available,
                                reservedPhotos: gallerySummary.reserved,
                                comingSoonPhotos: gallerySummary.comingSoon,
                                activeClients: clientsSummary.activeClients,
                                activeCarts: cartsSummary.activeCarts
                            };
                        } catch (e) {
                            console.error('Gallery metrics error:', e);
                        }
                    }

                    return {
                        totalInventory: totalInventory.toString(),
                        inTransit: totalTransit.toString(),
                        avgVelocity: Math.round(totalSales / 7).toString() + '/day',
                        monthSales: totalSales.toString(),
                        ...galleryMetrics
                    };
                },
                10
            );

            return metrics;

        } catch (error) {
            console.error('Metrics error:', error);
            return {
                totalInventory: "N/A",
                inTransit: "N/A",
                avgVelocity: "N/A",
                monthSales: "N/A"
            };
        }
    }

    getConnectionStatus() {
        return {
            cde: this.connectionStatus.cde,
            gallery: this.connectionStatus.gallery,
            timestamp: new Date().toISOString()
        };
    }

    async testGalleryConnection() {
        try {
            const connected = await this.gallery.testConnection();
            this.connectionStatus.gallery = connected ? 'online' : 'offline';
            return connected;
        } catch (error) {
            this.connectionStatus.gallery = 'offline';
            return false;
        }
    }
}

module.exports = AIAssistant;