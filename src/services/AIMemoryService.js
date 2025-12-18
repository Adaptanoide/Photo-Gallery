// src/services/AIMemoryService.js
// Serviço para gerenciar memória de longo prazo da AI

const Groq = require('groq-sdk');
const AIMemory = require('../models/AIMemory');
const AIConversation = require('../models/AIConversation');

class AIMemoryService {
    constructor() {
        this.groq = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });
    }

    /**
     * Analisa uma conversa e extrai informações para memória
     * Chamado após cada conversa significativa (5+ mensagens)
     */
    async analyzeAndLearn(userId, conversationId) {
        try {
            const conversation = await AIConversation.findById(conversationId);
            if (!conversation || conversation.messages.length < 4) {
                return null; // Conversa muito curta para analisar
            }

            console.log(`🧠 Analyzing conversation ${conversationId} for user ${userId}`);

            // Preparar mensagens para análise
            const messagesText = conversation.messages
                .map(m => `${m.role}: ${m.content}`)
                .join('\n\n');

            // Usar AI para extrair insights
            const analysis = await this.extractInsights(messagesText);

            if (analysis) {
                // Salvar resumo da conversa
                await AIMemory.addConversationSummary(
                    userId,
                    conversationId,
                    analysis.summary,
                    analysis.topics,
                    analysis.insights,
                    analysis.actions,
                    analysis.questions
                );

                // Salvar aprendizados individuais
                for (const learning of (analysis.learnings || [])) {
                    await AIMemory.addLearning(
                        userId,
                        learning.type,
                        learning.content,
                        `Conversation: ${conversation.title}`,
                        learning.confidence || 0.6
                    );
                }

                // Detectar preferências implícitas
                await this.detectPreferences(userId, conversation.messages);

                console.log(`✅ Memory updated for user ${userId}`);
            }

            return analysis;

        } catch (error) {
            console.error('❌ Error analyzing conversation:', error.message);
            return null;
        }
    }

    /**
     * Usa AI para extrair insights de uma conversa
     */
    async extractInsights(conversationText) {
        try {
            const prompt = `Analyze this business conversation and extract structured information.

CONVERSATION:
${conversationText}

Return a JSON object with:
{
    "summary": "1-2 sentence summary of what was discussed",
    "topics": ["list", "of", "main", "topics"],
    "insights": ["key insights or findings discovered"],
    "actions": ["any actions discussed or recommended"],
    "questions": ["main questions the user asked"],
    "learnings": [
        {
            "type": "preference|correction|insight|pattern",
            "content": "what was learned about user preferences or business",
            "confidence": 0.5-1.0
        }
    ],
    "detectedRole": "owner|manager|sales|warehouse|unknown",
    "language": "en|pt|es"
}

Focus on business-relevant information. Keep it concise. Return ONLY valid JSON.`;

            const completion = await this.groq.chat.completions.create({
                messages: [
                    { role: "system", content: "You are an AI analyst. Extract structured insights from conversations. Return only valid JSON." },
                    { role: "user", content: prompt }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.3,
                max_tokens: 800
            });

            const response = completion.choices[0].message.content;

            // Tentar extrair JSON da resposta
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return null;

        } catch (error) {
            console.error('Error extracting insights:', error.message);
            return null;
        }
    }

    /**
     * Detecta preferências implícitas nas mensagens
     */
    async detectPreferences(userId, messages) {
        try {
            const memory = await AIMemory.getOrCreate(userId);

            // Analisar padrões nas mensagens
            for (const msg of messages) {
                if (msg.role !== 'user') continue;

                const content = msg.content.toLowerCase();

                // Detectar idioma preferido
                if (this.isPortuguese(content)) {
                    memory.preferences.language = 'pt';
                } else if (this.isSpanish(content)) {
                    memory.preferences.language = 'es';
                }

                // Detectar se pede detalhes
                if (content.includes('detail') || content.includes('explain') || content.includes('why')) {
                    memory.preferences.detailLevel = 'detailed';
                }

                // Detectar produtos mencionados frequentemente
                const productMatches = content.match(/\b\d{4}[A-Z]*/g);
                if (productMatches) {
                    for (const product of productMatches) {
                        if (!memory.preferences.watchedProducts.includes(product)) {
                            memory.preferences.watchedProducts.push(product);
                        }
                    }
                }

                // Detectar se quer ver valores em dólar
                if (content.includes('revenue') || content.includes('dollar') || content.includes('how much')) {
                    memory.preferences.showDollarValues = true;
                }
            }

            // Limitar produtos observados
            if (memory.preferences.watchedProducts.length > 20) {
                memory.preferences.watchedProducts = memory.preferences.watchedProducts.slice(-20);
            }

            await memory.save();

        } catch (error) {
            console.error('Error detecting preferences:', error.message);
        }
    }

    /**
     * Verifica se texto é português
     */
    isPortuguese(text) {
        const ptWords = ['qual', 'quanto', 'como', 'onde', 'porque', 'voce', 'você', 'estoque', 'venda', 'cliente', 'produto', 'obrigado', 'por favor'];
        return ptWords.some(word => text.includes(word));
    }

    /**
     * Verifica se texto é espanhol
     */
    isSpanish(text) {
        const esWords = ['cuál', 'cuanto', 'cómo', 'donde', 'porque', 'usted', 'inventario', 'venta', 'cliente', 'producto', 'gracias', 'por favor'];
        return esWords.some(word => text.includes(word));
    }

    /**
     * Gera contexto de memória formatado para o prompt da AI
     */
    async getMemoryContextForPrompt(userId) {
        try {
            const context = await AIMemory.getContextForAI(userId);
            if (!context) return '';

            let memoryPrompt = '\n\n🧠 LONG-TERM MEMORY (what you know about this user):\n';

            // Preferências
            if (context.preferences) {
                memoryPrompt += `• Preferred language: ${context.preferences.language}\n`;
                memoryPrompt += `• Detail level: ${context.preferences.detailLevel}\n`;
                if (context.preferences.showDollarValues) {
                    memoryPrompt += `• User likes to see dollar values\n`;
                }
            }

            // Tópicos favoritos
            if (context.topTopics && context.topTopics.length > 0) {
                memoryPrompt += `• Most asked topics: ${context.topTopics.join(', ')}\n`;
            }

            // Produtos observados
            if (context.watchedProducts && context.watchedProducts.length > 0) {
                memoryPrompt += `• Products user tracks: ${context.watchedProducts.slice(0, 5).join(', ')}\n`;
            }

            // Resumos recentes
            if (context.recentSummaries && context.recentSummaries.length > 0) {
                memoryPrompt += '\n📝 RECENT CONVERSATIONS:\n';
                for (const summary of context.recentSummaries) {
                    const date = new Date(summary.date).toLocaleDateString();
                    memoryPrompt += `• ${date}: ${summary.summary}\n`;
                }
            }

            // Aprendizados chave
            if (context.keyLearnings && context.keyLearnings.length > 0) {
                memoryPrompt += '\n💡 KEY LEARNINGS:\n';
                for (const learning of context.keyLearnings.slice(0, 5)) {
                    memoryPrompt += `• ${learning}\n`;
                }
            }

            // Total de interações
            if (context.totalInteractions > 0) {
                memoryPrompt += `\n📊 User has had ${context.totalInteractions} conversations with you.\n`;
            }

            return memoryPrompt;

        } catch (error) {
            console.error('Error getting memory context:', error.message);
            return '';
        }
    }

    /**
     * Registra tipo de pergunta para análise de padrões
     */
    async recordQuestionType(userId, question) {
        // Detectar tipo de pergunta
        const lowerQ = question.toLowerCase();
        let questionType = 'general';

        if (lowerQ.includes('inventory') || lowerQ.includes('stock') || lowerQ.includes('estoque')) {
            questionType = 'inventory';
        } else if (lowerQ.includes('sales') || lowerQ.includes('selling') || lowerQ.includes('venda')) {
            questionType = 'sales';
        } else if (lowerQ.includes('client') || lowerQ.includes('customer') || lowerQ.includes('cliente')) {
            questionType = 'clients';
        } else if (lowerQ.includes('revenue') || lowerQ.includes('money') || lowerQ.includes('dollar')) {
            questionType = 'revenue';
        } else if (lowerQ.includes('restock') || lowerQ.includes('order') || lowerQ.includes('buy')) {
            questionType = 'purchasing';
        } else if (lowerQ.includes('photo') || lowerQ.includes('gallery') || lowerQ.includes('cart')) {
            questionType = 'gallery';
        } else if (lowerQ.includes('dashboard') || lowerQ.includes('overview') || lowerQ.includes('summary')) {
            questionType = 'analytics';
        }

        await AIMemory.recordInteraction(userId, questionType);

        return questionType;
    }

    /**
     * Processa feedback explícito do usuário
     */
    async processFeedback(userId, feedback, context) {
        try {
            // Detectar tipo de feedback
            const lowerFeedback = feedback.toLowerCase();
            let learningType = 'feedback';
            let confidence = 0.8;

            if (lowerFeedback.includes('wrong') || lowerFeedback.includes('incorrect') || lowerFeedback.includes('errado')) {
                learningType = 'correction';
                confidence = 0.9;
            } else if (lowerFeedback.includes('prefer') || lowerFeedback.includes('like') || lowerFeedback.includes('prefiro')) {
                learningType = 'preference';
                confidence = 0.85;
            }

            await AIMemory.addLearning(userId, learningType, feedback, context, confidence);

            console.log(`📝 Feedback recorded for user ${userId}: ${learningType}`);

        } catch (error) {
            console.error('Error processing feedback:', error.message);
        }
    }

    /**
     * Job para processar conversas antigas que ainda não foram analisadas
     */
    async processUnanalyzedConversations() {
        try {
            // Buscar conversas com 5+ mensagens que não têm resumo
            const conversations = await AIConversation.find({
                'messages.4': { $exists: true }  // Pelo menos 5 mensagens
            }).sort({ createdAt: -1 }).limit(20);

            let processed = 0;

            for (const conv of conversations) {
                // Verificar se já tem resumo
                const memory = await AIMemory.findOne({
                    userId: conv.userId,
                    'conversationSummaries.conversationId': conv._id
                });

                if (!memory) {
                    await this.analyzeAndLearn(conv.userId, conv._id);
                    processed++;

                    // Delay para não sobrecarregar a API
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            console.log(`🔄 Processed ${processed} unanalyzed conversations`);
            return processed;

        } catch (error) {
            console.error('Error processing unanalyzed conversations:', error.message);
            return 0;
        }
    }
}

module.exports = new AIMemoryService();
