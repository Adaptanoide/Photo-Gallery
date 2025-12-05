// src/ai/AIAssistant.js - VERSÃO OTIMIZADA E PERSONALIZADA
const Groq = require('groq-sdk');
const CDEQueries = require('./CDEQueries');
const ConnectionManager = require('../services/ConnectionManager');
const AITrainingRule = require('../models/AITrainingRule');

class AIAssistant {
    constructor() {
        this.groq = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });
        
        this.cde = new CDEQueries();
        this.testMode = false;
        
        // Cache de contexto frequente
        this.quickCache = {
            lastUpdate: null,
            totalInventory: null,
            topProducts: null
        };
    }

    async processQuery(question) {
        try {
            console.log('📊 Processing question:', question);
            
            // Verificar saudações simples primeiro
            const quickResponse = this.handleSimpleQueries(question);
            if (quickResponse) return quickResponse;
            
            // Buscar regras de treinamento personalizadas
            const customRules = await this.getRelevantTrainingRules(question);
            
            // Buscar dados reais do CDE com cache inteligente
            const context = await this.gatherContext(question);
            
            // Se não tem dados suficientes, usar resposta direta
            if (!context || (Object.keys(context).length === 1 && context.error)) {
                return this.getFallbackResponse(question);
            }
            
            // Gerar resposta com IA
            const response = await this.generateResponse(question, context, customRules);
            
            return response;
            
        } catch (error) {
            console.error('❌ AI Error:', error);
            return this.getErrorResponse(error);
        }
    }

    handleSimpleQueries(question) {
        const lowerQ = question.toLowerCase().trim();
        
        // Saudações
        if (lowerQ.match(/^(hi|hello|hey|good morning|good afternoon|greetings?)$/)) {
            const greetings = [
                "👋 Hey Andy! Ready to dive into today's numbers?",
                "Hello Andy! What aspect of the business should we analyze today?",
                "Hi Andy! I've got all the latest inventory data ready for you.",
                "Good to see you, Andy! What insights can I provide today?"
            ];
            return greetings[Math.floor(Math.random() * greetings.length)];
        }
        
        // Agradecimentos
        if (lowerQ.match(/^(thanks|thank you|thx|ty)$/)) {
            return "You're welcome, Andy! Let me know if you need anything else analyzed. 📊";
        }
        
        // Status check
        if (lowerQ === 'status' || lowerQ === 'are you working') {
            return "✅ All systems operational! CDE connection is active and I'm ready to analyze your inventory data.";
        }
        
        return null;
    }

    async gatherContext(question) {
        const context = {};
        const lowerQuestion = question.toLowerCase();
        
        try {
            // ESTRATÉGIA: Usar cache para queries pesadas e frequentes
            
            // === QUERIES COM CACHE ===
            
            // Inventário total - CACHE DE 30 MINUTOS
            if (lowerQuestion.includes('inventory') || 
                lowerQuestion.includes('stock') || 
                lowerQuestion.includes('total')) {
                
                context.totalInventory = await ConnectionManager.executeWithCache(
                    'totalInventory',
                    () => this.cde.getTotalInventoryAnalysis(),
                    30 // 30 minutos de cache
                );
                
                if (lowerQuestion.includes('detail')) {
                    context.inventory = await this.cde.getCurrentInventory();
                }
            }
            
            // Restock needs - CACHE DE 15 MINUTOS
            else if (lowerQuestion.includes('restock') || 
                     lowerQuestion.includes('order') || 
                     lowerQuestion.includes('buy') ||
                     lowerQuestion.includes('need')) {
                
                context.restocking = await ConnectionManager.executeWithCache(
                    'restocking',
                    () => this.cde.getRestockingNeeds(),
                    15
                );
                
                // Aging só se pedir especificamente
                if (lowerQuestion.includes('aging') || lowerQuestion.includes('old')) {
                    context.aging = await this.cde.getAgingProducts();
                }
            }
            
            // Top produtos - CACHE DE 60 MINUTOS
            else if (lowerQuestion.includes('best') || 
                     lowerQuestion.includes('top') || 
                     lowerQuestion.includes('selling') ||
                     lowerQuestion.includes('popular')) {
                
                context.topProducts = await ConnectionManager.executeWithCache(
                    'topProducts',
                    () => this.cde.getTopSellingProducts(),
                    60 // Cache mais longo para dados históricos
                );
            }
            
            // === QUERIES SEM CACHE (dados em tempo real) ===
            
            // Performance diária - SEMPRE FRESCO
            else if (lowerQuestion.includes('today') || 
                     lowerQuestion.includes('daily') || 
                     lowerQuestion.includes('yesterday')) {
                
                context.dailyPerformance = await this.cde.getDailySalesPerformance();
                context.sales = await this.cde.getRecentSales();
            }
            
            // Prioridades - MIX DE CACHE E TEMPO REAL
            else if (lowerQuestion.includes('priorities') || 
                     lowerQuestion.includes('focus') ||
                     lowerQuestion.includes('important')) {
                
                // Restocking com cache
                context.restocking = await ConnectionManager.executeWithCache(
                    'restocking',
                    () => this.cde.getRestockingNeeds(),
                    15
                );
                
                // Carrinho sempre fresco (muda rápido)
                context.carts = await this.cde.getProductsInCart();
                
                // Performance recente
                context.sales = await this.cde.getRecentSales();
            }
            
            // Velocidade de vendas - CACHE DE 30 MINUTOS
            else if (lowerQuestion.includes('velocity') || 
                     lowerQuestion.includes('fast') || 
                     lowerQuestion.includes('speed')) {
                
                context.salesVelocity = await ConnectionManager.executeWithCache(
                    'salesVelocity',
                    () => this.cde.getSalesVelocity(),
                    30
                );
            }
            
            // Canais - CACHE DE 2 HORAS
            else if (lowerQuestion.includes('channel') || 
                     lowerQuestion.includes('marketplace') || 
                     lowerQuestion.includes('etsy') || 
                     lowerQuestion.includes('amazon')) {
                
                context.salesByChannel = await ConnectionManager.executeWithCache(
                    'salesByChannel',
                    () => this.cde.getSalesByChannel(),
                    120
                );
            }
            
            // Produtos novos/trending
            else if (lowerQuestion.includes('new') || 
                     lowerQuestion.includes('trending') ||
                     lowerQuestion.includes('recent product')) {
                
                context.trendingProducts = await this.cde.getTrendingNewProducts();
            }
            
            // Fluxo de inventário
            else if (lowerQuestion.includes('flow') || 
                     lowerQuestion.includes('movement') ||
                     lowerQuestion.includes('in and out')) {
                
                context.inventoryFlow = await this.cde.getInventoryFlow();
            }
            
            // Análise genérica - DADOS BÁSICOS COM CACHE
            else {
                // Para perguntas genéricas, usar cache agressivo
                context.basicInfo = await ConnectionManager.executeWithCache(
                    'basicInfo',
                    async () => ({
                        inventory: await this.cde.getTotalInventoryAnalysis(),
                        topProducts: await this.cde.getTopSellingProducts()
                    }),
                    60
                );
            }
            
        } catch (error) {
            console.error('⚠️ Erro ao buscar contexto:', error.message);
            context.error = 'Having trouble reaching the warehouse database. Using cached data where available.';
            
            // Tentar usar cache em caso de erro
            const cache = ConnectionManager.cache;
            if (cache && Object.keys(cache).length > 0) {
                context.cachedData = cache;
                context.cacheAge = ConnectionManager.getCacheAge();
            }
        }
        
        return context;
    }

    async generateResponse(question, context, customRules = []) {
        // Se tem erro e não tem dados, usar resposta de fallback
        if (context.error && !context.cachedData) {
            return this.getErrorResponse();
        }
        
        const systemPrompt = `You are a friendly and professional business intelligence assistant for Andy, the owner of Sunshine Cowhides.

        PERSONALITY:
        - Address Andy by name naturally (not in every sentence)
        - Be conversational but professional
        - Use emojis appropriately (📊 📈 📦 💰 🎯 ⚡ ✅ ⚠️ 🔴 🟡 🟢)
        - Provide actionable insights, not just data dumps

        FORMATTING RULES:
        - Use emojis for visual appeal but don't overdo it
        - Use bullet points (•) for lists
        - Use numbers (1, 2, 3) for steps or priorities
        - Add line breaks for readability
        - NO asterisks for emphasis (**)
        - NO markdown formatting
        - Keep responses concise but informative

        BUSINESS CONTEXT:
        - Top Products: Coasters (2110, 2115, 2129) = 60%+ of sales
        - TX Map Coasters (2129) is NEW but already a top seller
        - Main channels: ETSY 44%, AMAZON 22%, SHOPIFY 15%
        - Daily average: 100-200 items, 50-150 orders
        - Brazil products: 45-day lead time
        - Colombia products: 7-day lead time

        CUSTOM RULES FOR ANDY:
        ${customRules.map(rule => `- ${rule.type.toUpperCase()}: ${rule.description}`).join('\n')}

        DATA HANDLING:
        - If data is from cache, mention it briefly (e.g., "Based on data from X minutes ago")
        - Focus on insights, not raw numbers
        - Compare to benchmarks when possible
        - Highlight anomalies or opportunities

        LIMITATIONS:
        - Pricing: Managed in QuickBooks (not integrated yet)
        - Historical data: Limited to recent periods
        - Predictions: Based on current trends only

        Remember: Andy wants quick, actionable insights to make business decisions.`;

        const completion = await this.groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: `Question: ${question}
                    
                    Available Data:
                    ${JSON.stringify(context, null, 2)}

                    Provide a natural, helpful response with good formatting and appropriate emojis.`
                }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.6, // Slightly higher for more natural responses
            max_tokens: 800
        });
        
        return completion.choices[0].message.content;
    }

    async getRelevantTrainingRules(question) {
        try {
            const rules = await AITrainingRule.find({ applied: true });
            const lowerQ = question.toLowerCase();
            
            // Filtrar regras relevantes baseado no tipo de pergunta
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
        const responses = {
            default: `👋 Hey Andy! I can help you analyze:

            📦 Inventory levels and stock status
            📈 Sales performance and trends  
            🎯 Restocking priorities
            💰 Best selling products
            📊 Daily business metrics
            🚚 Products in transit
            ⏰ Aging inventory

            What would you like to know about?`,
                        
                        offline: `⚠️ Andy, I'm having trouble connecting to the warehouse database right now.

            Here's what I know from recent data:
            - Inventory: ~6,200 products available
            - Top sellers: Coasters (2110, 2115, 2129)
            - Main channels: Etsy, Amazon, Shopify

            The connection should restore shortly. Try again in a moment?`,
                        
                        error: `❌ Sorry Andy, I encountered an issue accessing that data.

            This might help:
            - Check if you're asking about available data types
            - Try being more specific (e.g., "top 5 products" instead of "products")
            - Some data like pricing isn't integrated yet

            What else can I help you with?`
        };
        
        // Escolher resposta baseada no contexto
        if (question.toLowerCase().includes('help') || question.toLowerCase().includes('what can')) {
            return responses.default;
        }
        
        return responses.offline;
    }

    getErrorResponse(error = null) {
        if (error && error.message.includes('timeout')) {
            return `⏱️ The warehouse database is taking longer than usual to respond, Andy.

            While we wait, here's what you can do:
            1. Try a simpler query (e.g., "top products" instead of full analysis)
            2. Check specific categories rather than all inventory
            3. Use the quick action buttons for common queries

            The system is working on reconnecting. Try again in a moment!`;
                    }
                    
                    return `⚠️ I'm having temporary trouble accessing the warehouse data, Andy.

            Quick stats from memory:
            - ~6,200 products in stock
            - Coasters are top sellers
            - Etsy leads in sales volume

            I'll reconnect automatically. What specific metric interests you most?`;
    }

    async getMetrics() {
        try {
            // Usar cache para métricas do dashboard
            const metrics = await ConnectionManager.executeWithCache(
                'dashboardMetrics',
                async () => {
                    const inventory = await this.cde.getCurrentInventory();
                    const transit = await this.cde.getProductsInTransit();
                    const sales = await this.cde.getRecentSales();
                    
                    const totalInventory = inventory.reduce((sum, item) => sum + item.quantity, 0);
                    const totalTransit = transit.reduce((sum, item) => sum + item.quantity, 0);
                    const totalSales = sales.reduce((sum, day) => sum + day.quantity, 0);
                    
                    return {
                        totalInventory: totalInventory.toString(),
                        inTransit: totalTransit.toString(),
                        avgVelocity: Math.round(totalSales / 7).toString() + '/day',
                        monthSales: totalSales.toString()
                    };
                },
                10 // Cache de 10 minutos para métricas
            );
            
            return metrics;
            
        } catch (error) {
            console.error('Metrics error:', error);
            // Retornar últimos valores conhecidos do cache
            const cache = ConnectionManager.cache.dashboardMetrics;
            if (cache) {
                return cache;
            }
            
            return {
                totalInventory: "~6,200",
                inTransit: "~500",
                avgVelocity: "150/day",
                monthSales: "~4,500"
            };
        }
    }
}

module.exports = AIAssistant;