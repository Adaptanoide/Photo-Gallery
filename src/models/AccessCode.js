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

    // ===== NOVO: TIPO DE ACESSO =====
    accessType: {
        type: String,
        enum: ['normal', 'special'],
        default: 'normal',
    },

    // ===== CONTROLE GLOBAL DE EXIBIÇÃO DE PREÇOS =====
    showPrices: {
        type: Boolean,
        default: true,
    },

    // ===== CONFIGURAÇÃO PARA ACESSO NORMAL (EXISTENTE) =====
    allowedCategories: [{
        type: String,
        required: function () {
            return this.accessType === 'normal';
        }
    }],

    // ===== NOVO: CONFIGURAÇÃO PARA ACESSO ESPECIAL =====
    specialSelection: {
        // Referência à seleção especial
        selectionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Selection',
            required: function () {
                return this.accessType === 'special';
            }
        },

        // Código da seleção especial (para facilitar busca)
        selectionCode: {
            type: String,
            required: function () {
                return this.accessType === 'special';
            }
        },

        // Nome da seleção (para exibição)
        selectionName: {
            type: String,
            trim: true
        },

        // Configurações específicas de acesso
        accessConfig: {
            // Se cliente pode ver preços
            showPrices: {
                type: Boolean,
                default: true
            },

            // Se cliente pode ver informações de desconto
            showDiscountInfo: {
                type: Boolean,
                default: false
            },

            // Mensagem personalizada para o cliente
            welcomeMessage: {
                type: String,
                trim: true
            },

            // Configurações de interface
            interfaceConfig: {
                hideOriginalCategories: {
                    type: Boolean,
                    default: true
                },
                customBranding: {
                    type: String,
                    trim: true
                }
            }
        },

        // Data de criação da associação
        assignedAt: {
            type: Date,
            default: Date.now
        },

        // Admin que fez a associação
        assignedBy: {
            type: String,
            default: 'admin'
        }
    },

    // ===== CAMPOS EXISTENTES MANTIDOS =====
    isActive: {
        type: Boolean,
        default: true
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
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

    // ===== NOVO: HISTÓRICO DE USO DETALHADO =====
    usageHistory: [{
        accessedAt: {
            type: Date,
            default: Date.now
        },
        accessType: {
            type: String,
            enum: ['normal', 'special']
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
    }
}, {
    timestamps: true
});

// ===== ÍNDICES =====
accessCodeSchema.index({ code: 1 });
accessCodeSchema.index({ expiresAt: 1 });
accessCodeSchema.index({ accessType: 1 });
accessCodeSchema.index({ isActive: 1, accessType: 1 });
accessCodeSchema.index({ 'specialSelection.selectionId': 1 });
accessCodeSchema.index({ 'specialSelection.selectionCode': 1 });

// ===== MÉTODOS DO SCHEMA =====

// ===== NOVO: VERIFICAR TIPO DE ACESSO =====
accessCodeSchema.methods.isSpecialAccess = function () {
    return this.accessType === 'special';
};

accessCodeSchema.methods.isNormalAccess = function () {
    return this.accessType === 'normal';
};

// ===== NOVO: CONFIGURAR ACESSO ESPECIAL =====
accessCodeSchema.methods.setSpecialAccess = function (selectionData, adminUser = 'admin') {
    this.accessType = 'special';
    this.specialSelection = {
        selectionId: selectionData.selectionId,
        selectionCode: selectionData.selectionCode,
        selectionName: selectionData.selectionName,
        accessConfig: {
            showPrices: selectionData.showPrices !== false,
            showDiscountInfo: selectionData.showDiscountInfo || false,
            welcomeMessage: selectionData.welcomeMessage || '',
            interfaceConfig: {
                hideOriginalCategories: selectionData.hideOriginalCategories !== false,
                customBranding: selectionData.customBranding || ''
            }
        },
        assignedAt: new Date(),
        assignedBy: adminUser
    };

    // Limpar categorias normais se estavam configuradas
    this.allowedCategories = [];

    // Atualizar metadados
    this.metadata.lastModifiedBy = adminUser;
    this.metadata.lastModifiedAt = new Date();

    return this;
};

// ===== NOVO: VOLTAR PARA ACESSO NORMAL =====
accessCodeSchema.methods.setNormalAccess = function (allowedCategories, adminUser = 'admin') {
    this.accessType = 'normal';
    this.allowedCategories = allowedCategories || [];

    // Limpar configurações especiais
    this.specialSelection = undefined;

    // Atualizar metadados
    this.metadata.lastModifiedBy = adminUser;
    this.metadata.lastModifiedAt = new Date();

    return this;
};

// ===== NOVO: REGISTRAR USO =====
accessCodeSchema.methods.recordUsage = function (extraData = {}) {
    this.usageCount += 1;
    this.lastUsed = new Date();

    // Adicionar ao histórico detalhado
    this.usageHistory.push({
        accessedAt: new Date(),
        accessType: this.accessType,
        selectionAccessed: this.isSpecialAccess() ? this.specialSelection.selectionCode : 'normal_access',
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

    // Verificar expiração
    if (this.expiresAt && new Date() > this.expiresAt) {
        return { allowed: false, reason: 'Access code has expired' };
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

// ===== NOVO: OBTER CONFIGURAÇÃO PARA CLIENTE =====
accessCodeSchema.methods.getClientConfig = function () {
    const baseConfig = {
        code: this.code,
        clientName: this.clientName,
        accessType: this.accessType,
        isActive: this.isActive,
        expiresAt: this.expiresAt
    };

    if (this.isNormalAccess()) {
        return {
            ...baseConfig,
            allowedCategories: this.allowedCategories
        };
    } else {
        return {
            ...baseConfig,
            specialSelection: {
                selectionId: this.specialSelection.selectionId,
                selectionCode: this.specialSelection.selectionCode,
                selectionName: this.specialSelection.selectionName,
                showPrices: this.specialSelection.accessConfig.showPrices,
                showDiscountInfo: this.specialSelection.accessConfig.showDiscountInfo,
                welcomeMessage: this.specialSelection.accessConfig.welcomeMessage,
                customBranding: this.specialSelection.accessConfig.interfaceConfig.customBranding
            }
        };
    }
};

// ===== NOVO: OBTER RESUMO PARA ADMIN =====
accessCodeSchema.methods.getAdminSummary = function () {
    return {
        code: this.code,
        clientName: this.clientName,
        clientEmail: this.clientEmail,
        accessType: this.accessType,
        isActive: this.isActive,
        expiresAt: this.expiresAt,
        usageCount: this.usageCount,
        lastUsed: this.lastUsed,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,

        // Configuração específica do tipo de acesso
        configuration: this.isNormalAccess() ? {
            type: 'normal',
            allowedCategories: this.allowedCategories,
            categoriesCount: this.allowedCategories.length
        } : {
            type: 'special',
            selectionCode: this.specialSelection.selectionCode,
            selectionName: this.specialSelection.selectionName,
            assignedBy: this.specialSelection.assignedBy,
            assignedAt: this.specialSelection.assignedAt
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

    if (options.notExpired) {
        query.expiresAt = { $gt: new Date() };
    }

    return this.find(query).sort({ createdAt: -1 });
};

// ===== NOVO: BUSCAR CÓDIGOS COM SELEÇÕES ESPECIAIS =====
accessCodeSchema.statics.findWithSpecialSelections = function () {
    return this.find({
        accessType: 'special',
        'specialSelection.selectionId': { $exists: true }
    }).populate('specialSelection.selectionId');
};

// ===== NOVO: ESTATÍSTICAS =====
accessCodeSchema.statics.getStatistics = async function () {
    const totalCodes = await this.countDocuments();
    const activeCodes = await this.countDocuments({ isActive: true });
    const normalCodes = await this.countDocuments({ accessType: 'normal' });
    const specialCodes = await this.countDocuments({ accessType: 'special' });

    const expiredCodes = await this.countDocuments({
        expiresAt: { $lt: new Date() }
    });

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
        expiredCodes,
        accessTypes: {
            normal: normalCodes,
            special: specialCodes
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

    // Validar configuração de acesso especial
    if (this.accessType === 'special') {
        if (!this.specialSelection || !this.specialSelection.selectionId) {
            return next(new Error('Special access requires a valid selection ID'));
        }

        // Limpar allowedCategories para acesso especial
        this.allowedCategories = [];
    }

    // Validar configuração de acesso normal
    if (this.accessType === 'normal') {
        // COMENTADO - Categorias podem ser configuradas depois
        // if (!this.allowedCategories || this.allowedCategories.length === 0) {
        //     return next(new Error('Normal access requires at least one allowed category'));
        // }

        // Limpar specialSelection para acesso normal
        this.specialSelection = undefined;
    }

    next();
});

// Post-save: log
accessCodeSchema.post('save', function () {
    const type = this.accessType.toUpperCase();
    const config = this.isNormalAccess()
        ? `${this.allowedCategories.length} categorias`
        : `seleção ${this.specialSelection.selectionCode}`;

    console.log(`🔑 Código de acesso ${type} ${this.code} salvo - ${config} - ${this.clientName}`);
});

module.exports = mongoose.model('AccessCode', accessCodeSchema);