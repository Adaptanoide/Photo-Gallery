const mongoose = require('mongoose');

/**
 * AIMemory - Sistema de memória de longo prazo para a AI
 * Guarda preferências, aprendizados e contexto histórico por usuário
 */
const aiMemorySchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },

    // ========== PREFERÊNCIAS DO USUÁRIO ==========
    preferences: {
        // Idioma preferido para respostas
        language: {
            type: String,
            enum: ['en', 'pt', 'es'],
            default: 'en'
        },
        // Nível de detalhe nas respostas
        detailLevel: {
            type: String,
            enum: ['brief', 'normal', 'detailed'],
            default: 'normal'
        },
        // Mostrar valores em dólar por padrão?
        showDollarValues: {
            type: Boolean,
            default: false
        },
        // Tópicos mais consultados (para priorizar)
        favoriteTopics: [{
            topic: String,
            count: { type: Number, default: 1 }
        }],
        // Produtos/SKUs que o usuário acompanha
        watchedProducts: [String],
        // Clientes que o usuário acompanha
        watchedClients: [String]
    },

    // ========== CONTEXTO DE NEGÓCIO APRENDIDO ==========
    businessContext: {
        // Papel do usuário no negócio (detectado das conversas)
        role: {
            type: String,
            enum: ['owner', 'manager', 'sales', 'warehouse', 'unknown'],
            default: 'unknown'
        },
        // Áreas de responsabilidade detectadas
        responsibilities: [String],
        // Decisões importantes mencionadas
        keyDecisions: [{
            date: Date,
            summary: String,
            topic: String
        }]
    },

    // ========== RESUMOS DE CONVERSAS ANTERIORES ==========
    conversationSummaries: [{
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'AIConversation'
        },
        date: {
            type: Date,
            default: Date.now
        },
        // Resumo curto da conversa (gerado pela AI)
        summary: String,
        // Tópicos principais discutidos
        topics: [String],
        // Insights importantes extraídos
        keyInsights: [String],
        // Ações recomendadas que foram discutidas
        actionsDiscussed: [String],
        // Perguntas feitas pelo usuário
        questionsAsked: [String]
    }],

    // ========== PADRÕES DE USO ==========
    usagePatterns: {
        // Horários mais ativos
        activeHours: [{
            hour: Number,  // 0-23
            count: Number
        }],
        // Dias mais ativos
        activeDays: [{
            day: Number,  // 0-6 (domingo-sábado)
            count: Number
        }],
        // Tipos de perguntas mais frequentes
        questionTypes: [{
            type: { type: String },  // inventory, sales, clients, etc.
            count: { type: Number, default: 1 }
        }],
        // Total de interações
        totalInteractions: {
            type: Number,
            default: 0
        },
        // Primeira interação
        firstInteraction: Date,
        // Última interação
        lastInteraction: Date
    },

    // ========== APRENDIZADOS ESPECÍFICOS ==========
    learnings: [{
        date: {
            type: Date,
            default: Date.now
        },
        // Tipo de aprendizado
        type: {
            type: String,
            enum: ['preference', 'correction', 'insight', 'feedback', 'pattern']
        },
        // O que foi aprendido
        content: String,
        // Contexto (de onde veio)
        context: String,
        // Nível de confiança (0-1)
        confidence: {
            type: Number,
            default: 0.5
        },
        // Quantas vezes foi confirmado
        confirmations: {
            type: Number,
            default: 0
        }
    }],

    // ========== ALERTAS PERSONALIZADOS ==========
    customAlerts: [{
        // Tipo de alerta
        type: {
            type: String,
            enum: ['low_stock', 'slow_sales', 'client_inactive', 'custom']
        },
        // Condição (em texto)
        condition: String,
        // Produtos/clientes específicos
        targets: [String],
        // Está ativo?
        active: {
            type: Boolean,
            default: true
        },
        // Última vez que foi acionado
        lastTriggered: Date
    }],

    // ========== METADADOS ==========
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Índices
aiMemorySchema.index({ userId: 1 });
aiMemorySchema.index({ 'conversationSummaries.date': -1 });
aiMemorySchema.index({ updatedAt: -1 });

// Atualizar updatedAt automaticamente
aiMemorySchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// ========== MÉTODOS ESTÁTICOS ==========

/**
 * Busca ou cria memória para um usuário
 */
aiMemorySchema.statics.getOrCreate = async function(userId) {
    let memory = await this.findOne({ userId });
    if (!memory) {
        memory = new this({ userId });
        await memory.save();
    }
    return memory;
};

/**
 * Adiciona um aprendizado
 */
aiMemorySchema.statics.addLearning = async function(userId, type, content, context, confidence = 0.5) {
    const memory = await this.getOrCreate(userId);

    // Verificar se já existe aprendizado similar
    const existing = memory.learnings.find(l =>
        l.type === type && l.content.toLowerCase() === content.toLowerCase()
    );

    if (existing) {
        existing.confirmations++;
        existing.confidence = Math.min(1, existing.confidence + 0.1);
    } else {
        memory.learnings.push({ type, content, context, confidence });
    }

    // Manter apenas os últimos 100 aprendizados
    if (memory.learnings.length > 100) {
        memory.learnings = memory.learnings
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 100);
    }

    await memory.save();
    return memory;
};

/**
 * Registra uma interação (para padrões de uso)
 */
aiMemorySchema.statics.recordInteraction = async function(userId, questionType) {
    const memory = await this.getOrCreate(userId);
    const now = new Date();

    // Atualizar contadores
    memory.usagePatterns.totalInteractions++;
    memory.usagePatterns.lastInteraction = now;
    if (!memory.usagePatterns.firstInteraction) {
        memory.usagePatterns.firstInteraction = now;
    }

    // Registrar hora
    const hour = now.getHours();
    const hourEntry = memory.usagePatterns.activeHours.find(h => h.hour === hour);
    if (hourEntry) {
        hourEntry.count++;
    } else {
        memory.usagePatterns.activeHours.push({ hour, count: 1 });
    }

    // Registrar dia
    const day = now.getDay();
    const dayEntry = memory.usagePatterns.activeDays.find(d => d.day === day);
    if (dayEntry) {
        dayEntry.count++;
    } else {
        memory.usagePatterns.activeDays.push({ day, count: 1 });
    }

    // Registrar tipo de pergunta
    if (questionType) {
        const typeEntry = memory.usagePatterns.questionTypes.find(t => t.type === questionType);
        if (typeEntry) {
            typeEntry.count++;
        } else {
            memory.usagePatterns.questionTypes.push({ type: questionType, count: 1 });
        }
    }

    await memory.save();
    return memory;
};

/**
 * Adiciona resumo de conversa
 */
aiMemorySchema.statics.addConversationSummary = async function(userId, conversationId, summary, topics, insights, actions, questions) {
    const memory = await this.getOrCreate(userId);

    memory.conversationSummaries.push({
        conversationId,
        summary,
        topics: topics || [],
        keyInsights: insights || [],
        actionsDiscussed: actions || [],
        questionsAsked: questions || []
    });

    // Manter apenas os últimos 50 resumos
    if (memory.conversationSummaries.length > 50) {
        memory.conversationSummaries = memory.conversationSummaries
            .sort((a, b) => b.date - a.date)
            .slice(0, 50);
    }

    // Atualizar tópicos favoritos
    for (const topic of (topics || [])) {
        const existing = memory.preferences.favoriteTopics.find(t => t.topic === topic);
        if (existing) {
            existing.count++;
        } else {
            memory.preferences.favoriteTopics.push({ topic, count: 1 });
        }
    }

    await memory.save();
    return memory;
};

/**
 * Retorna contexto de memória para usar no prompt da AI
 */
aiMemorySchema.statics.getContextForAI = async function(userId) {
    const memory = await this.findOne({ userId });
    if (!memory) return null;

    // Construir contexto otimizado para a AI
    const context = {
        preferences: {
            language: memory.preferences.language,
            detailLevel: memory.preferences.detailLevel,
            showDollarValues: memory.preferences.showDollarValues
        },
        role: memory.businessContext.role,
        topTopics: memory.preferences.favoriteTopics
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map(t => t.topic),
        recentSummaries: memory.conversationSummaries
            .sort((a, b) => b.date - a.date)
            .slice(0, 3)
            .map(s => ({
                date: s.date,
                summary: s.summary,
                topics: s.topics
            })),
        keyLearnings: memory.learnings
            .filter(l => l.confidence >= 0.6)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 10)
            .map(l => l.content),
        totalInteractions: memory.usagePatterns.totalInteractions,
        watchedProducts: memory.preferences.watchedProducts,
        watchedClients: memory.preferences.watchedClients
    };

    return context;
};

module.exports = mongoose.model('AIMemory', aiMemorySchema);
