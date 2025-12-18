// src/ai/AIAssistant.js - VERSÃO 3.2
// AI Agent com detecção de intenção avançada, alertas, contexto de negócio, dados QuickBooks e MEMÓRIA DE LONGO PRAZO
const Groq = require('groq-sdk');
const CDEQueries = require('./CDEQueries');
const GalleryQueries = require('./GalleryQueries');
const ConnectionManager = require('../services/ConnectionManager');
const AITrainingRule = require('../models/AITrainingRule');
const AIMemoryService = require('../services/AIMemoryService');
const fs = require('fs');
const path = require('path');

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

        // Carregar dados do QuickBooks (vendas históricas)
        this.quickbooksData = this.loadQuickBooksData();

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

    /**
     * Carrega dados processados do QuickBooks (vendas históricas por cliente)
     */
    loadQuickBooksData() {
        try {
            const summaryPath = path.join(__dirname, '../../data/training/quickbooks-summary.json');

            if (fs.existsSync(summaryPath)) {
                const data = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
                console.log(`📊 QuickBooks data loaded: ${data.summary?.totalCustomers || 0} customers, $${(data.summary?.totalSalesAllTime || 0).toLocaleString()} total sales`);
                return data;
            } else {
                console.warn('⚠️ QuickBooks data not found - run scripts/analyze-quickbooks.js');
                return null;
            }
        } catch (error) {
            console.error('❌ Error loading QuickBooks data:', error.message);
            return null;
        }
    }

    /**
     * Busca cliente no QuickBooks por nome (busca parcial)
     */
    findQuickBooksCustomer(searchName) {
        if (!this.quickbooksData?.allCustomers) return null;

        const searchLower = searchName.toLowerCase();
        return this.quickbooksData.allCustomers.find(c =>
            c.name.toLowerCase().includes(searchLower)
        );
    }

    /**
     * Retorna top clientes do QuickBooks
     * IMPORTANTE: Todos os valores são em USD (dólares), NÃO unidades!
     */
    getTopQuickBooksCustomers(limit = 20) {
        if (!this.quickbooksData?.topCustomers) return [];
        return {
            _NOTE: "⚠️ ALL VALUES ARE IN USD DOLLARS! totalSales and avgMonthly are REVENUE, not units sold",
            customers: this.quickbooksData.topCustomers.slice(0, limit).map(c => ({
                name: c.name,
                totalSales_USD: c.totalSales,
                avgMonthly_USD: c.avgMonthly,
                _currency: "USD"
            }))
        };
    }

    /**
     * Retorna resumo de vendas do QuickBooks
     * IMPORTANTE: Todos os valores são em USD (dólares), NÃO unidades!
     */
    getQuickBooksSalesSummary() {
        if (!this.quickbooksData) return null;
        return {
            _NOTE: "⚠️ ALL VALUES ARE IN USD DOLLARS, NOT UNITS! totalSales=dollars, avgMonthlySales=dollars/month",
            period: this.quickbooksData.period,
            summary: {
                ...this.quickbooksData.summary,
                _currency: "USD",
                _explanation: "totalSalesAllTime is total REVENUE in dollars, avgMonthlySales is average monthly REVENUE in dollars"
            },
            topMonths: this.quickbooksData.topMonths?.map(m => ({
                ...m,
                sales_USD: m.sales,
                _note: "sales value is in USD dollars (revenue)"
            }))
        };
    }

    async processQuery(question, conversationHistory = [], userId = null) {
        try {
            console.log('📊 Processing question:', question);
            console.log('🧠 Conversation history:', conversationHistory.length, 'messages');
            console.log('👤 User ID:', userId || 'anonymous');

            // Registrar tipo de pergunta para análise de padrões (memória de longo prazo)
            if (userId) {
                await AIMemoryService.recordQuestionType(userId, question);
            }

            const quickResponse = this.handleSimpleQueries(question);
            if (quickResponse) return quickResponse;

            const customRules = await this.getRelevantTrainingRules(question);
            const context = await this.gatherContext(question);

            if (!context || (Object.keys(context).length === 1 && context.error)) {
                return this.getFallbackResponse(question);
            }

            // Obter contexto de memória de longo prazo
            let longTermMemory = '';
            if (userId) {
                longTermMemory = await AIMemoryService.getMemoryContextForPrompt(userId);
            }

            const response = await this.generateResponse(question, context, customRules, conversationHistory, longTermMemory);
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
                "👋 Hey! Ready to dive into today's numbers?",
                "Hello! What would you like to analyze today?",
                "Hi! I've got fresh data from both CDE and Gallery ready for you.",
                "Good to see you! What insights can I provide today?"
            ];
            return greetings[Math.floor(Math.random() * greetings.length)];
        }

        if (lowerQ.match(/^(thanks|thank you|thx|ty)$/)) {
            return "You're welcome! Let me know if you need anything else. 📊";
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

            // Perguntas sobre histórico de vendas (QuickBooks)
            const isHistoricalSalesQuestion =
                lowerQuestion.includes('historical') ||
                lowerQuestion.includes('history') ||
                lowerQuestion.includes('histórico') ||
                lowerQuestion.includes('2021') ||
                lowerQuestion.includes('2022') ||
                lowerQuestion.includes('2023') ||
                lowerQuestion.includes('2024') ||
                lowerQuestion.includes('by year') ||
                lowerQuestion.includes('annual') ||
                lowerQuestion.includes('yearly') ||
                (isSalesQuestion && lowerQuestion.includes('total'));

            // =============================================
            // QUICKBOOKS DATA (Sales History)
            // =============================================

            if (this.quickbooksData) {
                // Sempre incluir resumo de vendas para perguntas de vendas/clientes
                if (isSalesQuestion || isClientQuestion || isHistoricalSalesQuestion || isDashboardQuestion) {
                    context.quickbooksSalesSummary = this.getQuickBooksSalesSummary();
                }

                // Top clientes históricos
                if (isClientQuestion || isTopQuestion || isHistoricalSalesQuestion) {
                    context.quickbooksTopCustomers = this.getTopQuickBooksCustomers(20);
                }

                // Busca específica de cliente
                const customerMatch = lowerQuestion.match(/(?:customer|cliente|client)\s+["']?([^"']+)["']?/i);
                if (customerMatch) {
                    const customerSearch = customerMatch[1].trim();
                    context.quickbooksCustomerData = this.findQuickBooksCustomer(customerSearch);
                }
            }

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

            // =============================================
            // BUSCA POR PRODUTO ESPECÍFICO (V3.1)
            // =============================================

            // Detectar código de produto na pergunta (ex: 5375, 5302, 2110)
            const productCodeMatch = question.match(/\b(\d{4}[A-Z]*(?:\s?[A-Z]{2})?)\b/i);
            if (productCodeMatch) {
                const productCode = productCodeMatch[1].toUpperCase();
                console.log('🔍 Código de produto detectado:', productCode);

                // Buscar dados específicos do produto
                context.specificProduct = await this.cde.getProductsByCode(productCode);
                context.productTransit = await this.cde.getTransitByCode(productCode);

                // Se for um código exato (4 dígitos), buscar resumo completo
                if (productCode.match(/^\d{4}$/)) {
                    context.productSummary = await this.cde.getProductSummary(productCode);
                }
            }

            // Detectar sufixos de cor/padrão (TRI, BRI, SP, ZETA, etc)
            const suffixPatterns = ['tricolor', 'brindle', 'salt pepper', 'black white', 'exotic', 'zeta'];
            const suffixCodes = {
                'tricolor': 'TRI', 'brindle': 'BRI', 'salt pepper': 'SP',
                'black white': 'BLW', 'exotic': 'EXO', 'zeta': 'Z'
            };

            for (const pattern of suffixPatterns) {
                if (lowerQuestion.includes(pattern)) {
                    const suffix = suffixCodes[pattern];
                    console.log('🎨 Sufixo de padrão detectado:', suffix);
                    context.productsBySuffix = await this.cde.getProductsBySuffix(suffix);
                    break;
                }
            }

            // Detectar busca por origem específica
            if (lowerQuestion.includes('brazil') || lowerQuestion.includes('brasil') || lowerQuestion.includes('bra ')) {
                console.log('🌍 Origem detectada: Brazil');
                context.stockByOrigin = await this.cde.getStockByOrigin('BRA');
            } else if (lowerQuestion.includes('colombia') || lowerQuestion.includes('col ')) {
                console.log('🌍 Origem detectada: Colombia');
                context.stockByOrigin = await this.cde.getStockByOrigin('COL');
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

    async generateResponse(question, context, customRules = [], conversationHistory = [], longTermMemory = '') {
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

        // Memória de longo prazo (se disponível)
        const longTermMemorySection = longTermMemory ? longTermMemory : '';

        // Verificar se estamos em período sazonal
        const currentMonth = new Date().getMonth() + 1;
        const isPeakSeason = this.businessKnowledge.peakSeasonMonths.includes(currentMonth);
        const seasonalContext = isPeakSeason ?
            '\n⚠️ SEASONAL ALERT: We are in PEAK SEASON (Oct-Dec). Stock levels should be 30% higher than normal.\n' : '';

        const systemPrompt = `You are Sunshine - a friendly, smart business assistant for a cowhide wholesale company.

🎨 YOUR PERSONALITY:
• Talk like a helpful colleague, not a robot
• Be warm and conversational - use natural language
• Get straight to the point - no fluff
• Use emojis naturally 🎯📊📦✅⚠️
• If you don't know something, say so briefly

📝 RESPONSE STYLE:
• SHORT and PUNCHY - users are busy!
• Use emojis to make responses visual
• Use bullet points (• or -) for lists
• Use numbered lists (1. 2. 3.) for rankings
• Section headers: "Section Name:" on its own line
• NEVER use markdown like ** or ## or __
• Start with the key insight

🔒 DATA PRIVACY - IMPORTANT:
• NEVER show exact dollar amounts unless user specifically asks "how much" or "what's the revenue"
• Use relative terms: "strong sales", "top performer", "growing", "declining"
• For rankings, show position without exact values: "#1 seller", "top 3"
• Only show percentages and units (not dollars) by default
• If user asks specifically for revenue/money data, then show it

📦 INVENTORY FOCUS (default):
• Show units, quantities, stock levels freely
• Highlight low stock, aging, critical items
• Lead times: Colombia 7 days, Brazil 45 days
• Critical threshold: below 100 units

💵 QUICKBOOKS DATA - CRITICAL:
• ALL QuickBooks values are in USD DOLLARS, NOT units!
• "totalSales: 1551286" means $1,551,286 revenue, NOT 1.5M products sold
• "avgMonthlySales: 955161" means $955,161/month revenue
• Never confuse dollar amounts with unit quantities
• CDE inventory data = units/quantities
• QuickBooks data = dollar revenue
${seasonalContext}
🚫 DON'T - CRITICAL:
• Don't show dollar values unless asked
• Don't be overly formal or apologetic
• Don't explain product codes unless asked
• Don't pad responses with general info
• Don't repeat the question back

⚠️ ACCURACY RULES - VERY IMPORTANT:
• NEVER invent numbers - only use data provided in "Available Data"
• If data is missing, say "I don't have data for that" - don't guess!
• If asked about something not in the data, be honest: "That's not in my current dataset"
• Double-check calculations before presenting them
• When comparing periods, verify both periods exist in the data
• If a number seems unusual, mention it: "This seems high/low - worth verifying"
${customRulesText}
🧠 CONVERSATION MEMORY:
You have access to the conversation history. Use it to:
• Remember what was discussed earlier
• Refer back to previous topics naturally
• Avoid repeating information already given
• Build on previous answers
${longTermMemorySection}
Be helpful, be brief, be human! 🌟`;

        // Build messages array with conversation history
        const messages = [
            { role: "system", content: systemPrompt }
        ];

        // Add conversation history (last 10 messages max to save tokens)
        const recentHistory = conversationHistory.slice(-10);
        for (const msg of recentHistory) {
            messages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            });
        }

        // Add current question with context
        const userMessage = `Question: ${question}

Available Data:
${JSON.stringify(context, null, 2)}

INSTRUCTIONS:
1. Answer ONLY using the data provided above
2. If you can't find the answer in the data, say "I don't have that information"
3. Use exact numbers from the data - don't round or estimate
4. Be specific and factual - no guessing!`;

        messages.push({ role: "user", content: userMessage });

        const completion = await this.groq.chat.completions.create({
            messages: messages,
            model: "llama-3.3-70b-versatile",
            temperature: 0.3,  // Lower = more precise, less creative/hallucination
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
        return `👋 Hey! I can help you analyze:

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

    // ============================================
    // DASHBOARD HELPER METHODS
    // ============================================

    /**
     * Get inventory summary for dashboard
     */
    async getInventorySummary() {
        try {
            const inventory = await this.cde.getCurrentInventory();
            const totalUnits = inventory?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;

            // Group by category
            const byCategory = {};
            if (inventory) {
                for (const item of inventory) {
                    const cat = item.category || 'OTHER';
                    if (!byCategory[cat]) {
                        byCategory[cat] = { units: 0, items: 0 };
                    }
                    byCategory[cat].units += item.quantity || 1;
                    byCategory[cat].items++;
                }
            }

            return { totalUnits, byCategory, rawData: inventory };
        } catch (error) {
            console.error('getInventorySummary error:', error.message);
            return { totalUnits: 0, byCategory: {} };
        }
    }

    /**
     * Get top products for dashboard
     */
    async getTopProducts(limit = 10) {
        try {
            const products = await this.cde.getTopSellingProducts();
            return (products || []).slice(0, limit).map(p => ({
                code: p.QBITEM || p.code,
                name: p.QBITEM || p.name,
                category: p.category || '',
                quantity: p.quantity || p.total || 0
            }));
        } catch (error) {
            console.error('getTopProducts error:', error.message);
            return [];
        }
    }

    /**
     * Get transit summary for dashboard
     */
    async getTransitSummary() {
        try {
            const transit = await this.cde.getProductsInTransit();
            return {
                totalInTransit: transit?.length || 0,
                products: transit || []
            };
        } catch (error) {
            console.error('getTransitSummary error:', error.message);
            return { totalInTransit: 0, products: [] };
        }
    }

    /**
     * Get aging products for dashboard
     */
    async getAgingProducts(days = 60) {
        try {
            const aging = await this.cde.getAgingProducts();
            // Filter by days if needed
            return aging || [];
        } catch (error) {
            console.error('getAgingProducts error:', error.message);
            return [];
        }
    }

    /**
     * Get QuickBooks summary for dashboard
     */
    getQuickBooksSalesSummary() {
        if (!this.quickbooksData) return { summary: { avgMonthly: 0 } };

        return {
            summary: {
                totalSalesAllTime: this.quickbooksData.summary?.totalSalesAllTime || 0,
                avgMonthly: this.quickbooksData.summary?.avgMonthly || 0,
                customerCount: this.quickbooksData.summary?.customerCount || 0
            }
        };
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