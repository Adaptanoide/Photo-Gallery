//src/models/AccessCode.js

const mongoose = require('mongoose');

const accessCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        length: 4,
        match: /^\d{4}$/
    },
    clientName: {
        type: String,
        required: true,
        trim: true
    },
    clientEmail: {
        type: String,
        trim: true,
        lowercase: true
    },
    clientPhone: {
        type: String,
        trim: true
    },
    companyName: {
        type: String,
        trim: true
    },
    salesRep: {
        type: String,
        trim: true,
        default: 'Unassigned'
    },
    addressLine1: {
        type: String,
        trim: true
    },
    addressLine2: {
        type: String,
        trim: true
    },
    city: {
        type: String,
        trim: true
    },
    state: {
        type: String,
        trim: true
    },
    zipCode: {
        type: String,
        trim: true
    },

    // ===== TIPO DE ACESSO =====
    accessType: {
        type: String,
        enum: ['normal'],
        default: 'normal',
    },

    // ===== CONTROLE GLOBAL DE EXIBIÇÃO DE PREÇOS =====
    showPrices: {
        type: Boolean,
        default: true,
    },

    // ===== ACESSO TOTAL ILIMITADO (AUTO-ATUALIZA COM NOVAS CATEGORIAS) =====
    fullAccess: {
        type: Boolean,
        default: false,
        // Se TRUE: Cliente tem acesso a TODAS as categorias automaticamente
        // Incluindo novas categorias que forem criadas no futuro
        // Não precisa atualizar allowedCategories manualmente
    },

    // ===== PREFERÊNCIAS DO CLIENTE (MOEDA) =====
    preferences: {
        currency: {
            type: String,
            enum: ['USD', 'CAD', 'EUR'],
            default: 'USD'
        }
    },

    // ===== CONFIGURAÇÃO PARA ACESSO NORMAL (EXISTENTE) =====
    allowedCategories: [{
        type: String,
        required: function () {
            return this.accessType === 'normal';
        }
    }],

    // ===== CAMPOS EXISTENTES MANTIDOS =====
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: String,
        default: 'admin'
    },
    usageCount: {
        type: Number,
        default: 0
    },
    lastUsed: {
        type: Date
    },

    // ===== HISTÓRICO DE USO DETALHADO =====
    usageHistory: [{
        accessedAt: {
            type: Date,
            default: Date.now
        },
        accessType: {
            type: String,
            enum: ['normal'],
            default: 'normal'
        },
        selectionAccessed: {
            type: String // ID ou nome da seleção acessada
        },
        ipAddress: String,
        userAgent: String,
        sessionDuration: Number // em segundos
    }],

    // ===== NOVO: CONFIGURAÇÕES AVANÇADAS =====
    advancedConfig: {
        // Limite de uso (para códigos temporários)
        maxUsageCount: {
            type: Number,
            default: null // null = ilimitado
        },

        // Horário de acesso permitido
        accessSchedule: {
            enabled: {
                type: Boolean,
                default: false
            },
            allowedHours: {
                start: String, // "09:00"
                end: String    // "18:00"
            },
            timezone: {
                type: String,
                default: 'America/New_York'
            }
        },

        // Notificações
        notifications: {
            notifyOnAccess: {
                type: Boolean,
                default: false
            },
            notifyOnExpiry: {
                type: Boolean,
                default: false
            },
            notificationEmail: String
        }
    },

    // ===== NOVO: METADADOS =====
    metadata: {
        // Tags para organização
        tags: [String],

        // Cliente VIP?
        isVipClient: {
            type: Boolean,
            default: false
        },

        // Região/país do cliente
        clientRegion: String,

        // Notas administrativas
        adminNotes: String,

        // Última modificação
        lastModifiedBy: String,
        lastModifiedAt: Date
    },
    // ===== EMAIL MARKETING TRACKING =====
    lastMarketingEmailSent: {
        type: Date,
        default: null
    },
    // ===== MARKETING UNSUBSCRIBE =====
    marketingUnsubscribed: {
        type: Boolean,
        default: false
    },
    marketingUnsubscribedAt: {
        type: Date,
        default: null
    },
    // ===== MARKETING TRACKING =====
    marketingEmailOpened: {
        type: Boolean,
        default: false
    },
    marketingEmailOpenedAt: {
        type: Date,
        default: null
    },
    marketingEmailOpenCount: {
        type: Number,
        default: 0
    },
    marketingEmailClicked: {
        type: Boolean,
        default: false
    },
    marketingEmailClickedAt: {
        type: Date,
        default: null
    },
    marketingEmailClickCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// ===== ÍNDICES =====
accessCodeSchema.index({ code: 1 });
accessCodeSchema.index({ accessType: 1 });
accessCodeSchema.index({ isActive: 1, accessType: 1 });

// ===== MÉTODOS DO SCHEMA =====

accessCodeSchema.methods.isNormalAccess = function () {
    return this.accessType === 'normal';
};

// ===== CONFIGURAR ACESSO NORMAL =====
accessCodeSchema.methods.setNormalAccess = function (allowedCategories, adminUser = 'admin') {
    this.accessType = 'normal';
    this.allowedCategories = allowedCategories || [];

    // Atualizar metadados
    this.metadata.lastModifiedBy = adminUser;
    this.metadata.lastModifiedAt = new Date();

    return this;
};

// ===== REGISTRAR USO =====
accessCodeSchema.methods.recordUsage = function (extraData = {}) {
    this.usageCount += 1;
    this.lastUsed = new Date();

    // Adicionar ao histórico detalhado
    this.usageHistory.push({
        accessedAt: new Date(),
        accessType: this.accessType,
        selectionAccessed: 'normal_access',
        ipAddress: extraData.ipAddress || null,
        userAgent: extraData.userAgent || null,
        sessionDuration: extraData.sessionDuration || null
    });

    return this;
};

// ===== NOVO: VERIFICAR SE PODE ACESSAR =====
accessCodeSchema.methods.canAccess = function () {
    // Verificar se está ativo
    if (!this.isActive) {
        return { allowed: false, reason: 'Access code is inactive' };
    }

    // Verificar limite de uso
    if (this.advancedConfig?.maxUsageCount && this.usageCount >= this.advancedConfig.maxUsageCount) {
        return { allowed: false, reason: 'Maximum usage count reached' };
    }

    // Verificar horário de acesso (se habilitado)
    if (this.advancedConfig?.accessSchedule?.enabled) {
        const now = new Date();
        const currentHour = now.toLocaleString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            timeZone: this.advancedConfig.accessSchedule.timezone
        });

        const startTime = this.advancedConfig.accessSchedule.allowedHours.start;
        const endTime = this.advancedConfig.accessSchedule.allowedHours.end;

        if (currentHour < startTime || currentHour > endTime) {
            return {
                allowed: false,
                reason: `Access allowed only between ${startTime} and ${endTime}`
            };
        }
    }

    return { allowed: true, reason: null };
};

// ===== OBTER CONFIGURAÇÃO PARA CLIENTE =====
accessCodeSchema.methods.getClientConfig = function () {
    return {
        code: this.code,
        clientName: this.clientName,
        accessType: this.accessType,
        isActive: this.isActive,
        allowedCategories: this.allowedCategories
    };
};

// ===== OBTER RESUMO PARA ADMIN =====
accessCodeSchema.methods.getAdminSummary = function () {
    return {
        code: this.code,
        clientName: this.clientName,
        clientEmail: this.clientEmail,
        accessType: this.accessType,
        isActive: this.isActive,
        usageCount: this.usageCount,

        // Configuração de acesso
        configuration: {
            type: 'normal',
            allowedCategories: this.allowedCategories,
            categoriesCount: this.allowedCategories.length
        },

        // Metadados
        metadata: this.metadata,

        // Estatísticas de uso
        usageStats: {
            totalAccesses: this.usageCount,
            recentAccesses: this.usageHistory.slice(-5), // Últimos 5 acessos
            avgSessionDuration: this.calculateAvgSessionDuration()
        }
    };
};

// ===== NOVO: CALCULAR DURAÇÃO MÉDIA DA SESSÃO =====
accessCodeSchema.methods.calculateAvgSessionDuration = function () {
    const validSessions = this.usageHistory.filter(usage => usage.sessionDuration && usage.sessionDuration > 0);

    if (validSessions.length === 0) return 0;

    const totalDuration = validSessions.reduce((sum, usage) => sum + usage.sessionDuration, 0);
    return Math.round(totalDuration / validSessions.length);
};

// ===== MÉTODOS ESTÁTICOS =====

// ===== NOVO: BUSCAR POR TIPO DE ACESSO =====
accessCodeSchema.statics.findByAccessType = function (accessType, options = {}) {
    const query = { accessType };

    if (options.isActive !== undefined) {
        query.isActive = options.isActive;
    }

    return this.find(query).sort({ createdAt: -1 });
};

// ===== ESTATÍSTICAS =====
accessCodeSchema.statics.getStatistics = async function () {
    const totalCodes = await this.countDocuments();
    const activeCodes = await this.countDocuments({ isActive: true });
    const normalCodes = await this.countDocuments({ accessType: 'normal' });

    const usageStats = await this.aggregate([
        {
            $group: {
                _id: null,
                totalUsages: { $sum: '$usageCount' },
                avgUsagePerCode: { $avg: '$usageCount' },
                maxUsage: { $max: '$usageCount' }
            }
        }
    ]);

    return {
        totalCodes,
        activeCodes,
        inactiveCodes: totalCodes - activeCodes,
        accessTypes: {
            normal: normalCodes
        },
        usage: usageStats[0] || {
            totalUsages: 0,
            avgUsagePerCode: 0,
            maxUsage: 0
        },
        timestamp: new Date()
    };
};

// ===== MIDDLEWARE =====

// Pre-save: validações e defaults
accessCodeSchema.pre('save', function (next) {
    // Garantir que metadados existam
    if (!this.metadata) {
        this.metadata = {};
    }

    // Garantir que advancedConfig exista
    if (!this.advancedConfig) {
        this.advancedConfig = {};
    }

    next();
});

// Post-save: log
accessCodeSchema.post('save', function () {
    const config = `${this.allowedCategories.length} categorias`;
    console.log(`🔑 Código de acesso ${this.code} salvo - ${config} - ${this.clientName}`);
});

module.exports = mongoose.model('AccessCode', accessCodeSchema);