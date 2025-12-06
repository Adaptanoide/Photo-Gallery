// src/ai/AIAssistant.js - VERSÃO 2.0
// Sem dados hardcoded, prompt flexível, mais analítico
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

    async gatherContext(question) {
        const context = {};
        const lowerQuestion = question.toLowerCase();

        try {
            // =============================================
            // DETECTAR TIPO DE PERGUNTA
            // =============================================

            const isGalleryQuestion =
                lowerQuestion.includes('photo') ||
                lowerQuestion.includes('gallery') ||
                lowerQuestion.includes('picture') ||
                lowerQuestion.includes('image');

            const isClientQuestion =
                lowerQuestion.includes('client') ||
                lowerQuestion.includes('customer') ||
                lowerQuestion.includes('vip') ||
                lowerQuestion.includes('sales rep') ||
                lowerQuestion.includes('marketing');

            const isCartQuestion =
                lowerQuestion.includes('cart') ||
                lowerQuestion.includes('carrinho') ||
                lowerQuestion.includes('shopping');

            const isSelectionQuestion =
                lowerQuestion.includes('selection') ||
                lowerQuestion.includes('order') ||
                lowerQuestion.includes('pedido');

            const isComingSoonQuestion =
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

            const isInventoryQuestion =
                lowerQuestion.includes('inventory') ||
                lowerQuestion.includes('stock') ||
                lowerQuestion.includes('estoque');

            const isRestockQuestion =
                lowerQuestion.includes('restock') ||
                lowerQuestion.includes('order') ||
                lowerQuestion.includes('buy') ||
                lowerQuestion.includes('need');

            const isSalesQuestion =
                lowerQuestion.includes('sales') ||
                lowerQuestion.includes('selling') ||
                lowerQuestion.includes('vendas') ||
                lowerQuestion.includes('sold');

            const isChannelQuestion =
                lowerQuestion.includes('channel') ||
                lowerQuestion.includes('marketplace') ||
                lowerQuestion.includes('etsy') ||
                lowerQuestion.includes('amazon') ||
                lowerQuestion.includes('shopify');

            const isTopQuestion =
                lowerQuestion.includes('top') ||
                lowerQuestion.includes('best') ||
                lowerQuestion.includes('most') ||
                lowerQuestion.includes('popular');

            const isDashboardQuestion =
                lowerQuestion.includes('dashboard') ||
                lowerQuestion.includes('overview') ||
                lowerQuestion.includes('summary') ||
                lowerQuestion.includes('resumo') ||
                lowerQuestion.includes('geral');

            const isExpiringQuestion =
                lowerQuestion.includes('expir') ||
                lowerQuestion.includes('expiring');

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

        // Construir regras customizadas
        const customRulesText = customRules.length > 0
            ? `\nCUSTOM BUSINESS RULES:\n${customRules.map(rule => `• ${rule.type.toUpperCase()}: ${rule.description}`).join('\n')}`
            : '';

        const systemPrompt = `You are a business intelligence assistant for Andy, owner of Sunshine Cowhides (wholesale cowhide business).

CORE PRINCIPLES:
• Be CONSERVATIVE with claims - only state what the data shows
• Be ANALYTICAL - when you have real data, analyze it deeply and find patterns
• Be ACTIONABLE - give insights Andy can act on, not just numbers
• Be CONVERSATIONAL - talk like a helpful colleague, not a robot

RESPONSE STYLE:
• Use emojis sparingly but effectively (📊 📈 📦 💰 🎯 ✅ ⚠️ 🟢 🟡 🔴 📸 👥 🛒)
• Use bullet points (•) for lists
• Use numbers (1, 2, 3) for priorities or steps
• Add line breaks for readability
• NO markdown formatting (no ** or ##)
• Keep responses focused but thorough

DATA SOURCES AVAILABLE:
• CDE (MySQL): Warehouse inventory, sales, orders, products in transit
• Gallery (MongoDB): Photos, clients, carts, selections, pricing, marketing

WHAT TO DO:
• Analyze the actual data provided - find trends, anomalies, opportunities
• Compare numbers when relevant (e.g., "up from last week", "higher than average")
• Highlight important insights first
• Suggest actions when appropriate
• If data is limited, say so honestly

WHAT NOT TO DO:
• Never invent or assume data that isn't provided
• Never state percentages or specific numbers without data backing it
• Never give generic advice - be specific based on the data
• Don't apologize excessively - just be helpful
${customRulesText}

Remember: Andy wants real insights from real data to make business decisions.`;

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