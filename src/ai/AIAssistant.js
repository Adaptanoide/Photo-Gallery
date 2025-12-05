// src/ai/AIAssistant.js - VERSÃO COM DADOS REAIS
const Groq = require('groq-sdk');
const CDEQueries = require('./CDEQueries');

class AIAssistant {
    constructor() {
        this.groq = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });

        this.cde = new CDEQueries();

        // MUDOU PARA FALSE - Vamos usar dados REAIS!
        this.testMode = false;
    }

    async processQuery(question) {
        try {
            console.log('📊 Processing question:', question);

            // Buscar dados reais do CDE
            const context = await this.gatherContext(question);

            // Gerar resposta com IA
            const response = await this.generateResponse(question, context);

            return response;

        } catch (error) {
            console.error('AI Error:', error);
            return 'I encountered an error accessing the database. Please try again.';
        }
    }

    async gatherContext(question) {
        const context = {};
        const lowerQuestion = question.toLowerCase();

        // SEMPRE buscar informações básicas
        context.totalInventory = await this.cde.getTotalInventoryAnalysis();

        // Análises específicas baseadas na pergunta
        if (lowerQuestion.includes('inventory') || lowerQuestion.includes('stock')) {
            context.inventory = await this.cde.getCurrentInventory();
            context.restocking = await this.cde.getRestockingNeeds();
        }

        if (lowerQuestion.includes('restock') || lowerQuestion.includes('order') || lowerQuestion.includes('buy')) {
            context.restocking = await this.cde.getRestockingNeeds();
            context.aging = await this.cde.getAgingProducts();
        }

        if (lowerQuestion.includes('priorities') || lowerQuestion.includes('today') || lowerQuestion.includes('focus')) {
            context.restocking = await this.cde.getRestockingNeeds();
            context.carts = await this.cde.getProductsInCart();
            context.aging = await this.cde.getAgingProducts();
            context.sales = await this.cde.getRecentSales();
        }

        if (lowerQuestion.includes('velocity') || lowerQuestion.includes('selling') || lowerQuestion.includes('sales')) {
            context.sales = await this.cde.getSalesAnalysis(7);
            context.salesMonth = await this.cde.getSalesAnalysis(30);
        }

        return context;
    }

    async generateResponse(question, context) {
        const systemPrompt = `You are Andy's business intelligence assistant for Sunshine Cowhides.
        
        You have access to REAL-TIME data from the CDE warehouse system.
        
        FORMATTING RULES:
        - Use bullet points (•) for lists
        - Use line breaks for better readability
        - Keep responses concise and well-organized
        - Use numbers (1, 2, 3) for multiple items
        - Don't use HTML tags, just plain text formatting
        
        IMPORTANT: 
        - Pricing information is not yet integrated. If asked about prices, say: "Pricing data is currently managed in QuickBooks and not yet integrated."
        - QB codes (like 2129, 5475BR) are product identifiers
        - Each photo number represents a unique product
        
        Provide clear, actionable insights with good formatting.`;

        const completion = await this.groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: `Question: ${question}
                    
                    Current Data from CDE:
                    ${JSON.stringify(context, null, 2)}
                    
                    Provide a well-formatted response with proper line breaks and structure.`
                }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.5,
            max_tokens: 1000
        });

        // APENAS RETORNAR A RESPOSTA PURA, SEM CONVERSÃO
        return completion.choices[0].message.content;
    }

    async getMetrics() {
        try {
            const inventory = await this.cde.getCurrentInventory();
            const transit = await this.cde.getProductsInTransit();
            const sales = await this.cde.getRecentSales();

            const totalInventory = inventory.reduce((sum, item) => sum + item.quantity, 0);
            const totalTransit = transit.reduce((sum, item) => sum + item.quantity, 0);
            const totalSales = sales.reduce((sum, day) => sum + day.quantity, 0);

            return {
                totalInventory: totalInventory.toString(),
                inTransit: totalTransit.toString(),
                avgVelocity: "Calculating...",
                monthSales: totalSales.toString()
            };
        } catch (error) {
            console.error('Metrics error:', error);
            return {
                totalInventory: "Error",
                inTransit: "Error",
                avgVelocity: "Error",
                monthSales: "Error"
            };
        }
    }
}

module.exports = AIAssistant;