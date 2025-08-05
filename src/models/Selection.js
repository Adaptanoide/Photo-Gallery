//src/models/Selection.js

const mongoose = require('mongoose');

const selectionSchema = new mongoose.Schema({
    selectionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    clientCode: {
        type: String,
        required: true,
        length: 4
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

    // ===== NOVO: TIPO DE SELEÇÃO =====
    selectionType: {
        type: String,
        enum: ['normal', 'special'],
        default: 'normal',
        index: true
    },

    // ===== NOVO: CONFIGURAÇÕES PARA SELEÇÕES ESPECIAIS =====
    specialSelectionConfig: {
        // Informações básicas da seleção especial
        selectionName: {
            type: String,
            trim: true
        },
        description: {
            type: String,
            trim: true
        },

        // Configurações de preços
        pricingConfig: {
            showPrices: {
                type: Boolean,
                default: true
            },
            allowGlobalDiscount: {
                type: Boolean,
                default: false
            },
            globalDiscountPercent: {
                type: Number,
                min: 0,
                max: 100,
                default: 0
            }
        },

        // Sistema de descontos por quantidade
        quantityDiscounts: {
            enabled: {
                type: Boolean,
                default: false
            },
            rules: [{
                minQuantity: {
                    type: Number,
                    min: 1
                },
                discountPercent: {
                    type: Number,
                    min: 0,
                    max: 100
                },
                applyTo: {
                    type: String,
                    enum: ['total', 'category'],
                    default: 'total'
                },
                categoryId: String // Para descontos por categoria específica
            }]
        },

        // Configurações de acesso
        accessConfig: {
            isActive: {
                type: Boolean,
                default: true
            },
            expiresAt: Date,
            restrictedAccess: {
                type: Boolean,
                default: true
            }
        }
    },

    // ===== NOVO: CATEGORIAS CUSTOMIZADAS (PARA SELEÇÕES ESPECIAIS) =====
    customCategories: [{
        categoryId: {
            type: String,
            required: true,
            default: () => `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        },
        categoryName: {
            type: String,
            required: true
        },
        categoryDisplayName: {
            type: String,
            default: function () { return this.categoryName; }
        },
        baseCategoryPrice: {
            type: Number,
            default: 0
        },
        // ✅ NOVOS CAMPOS PARA GOOGLE DRIVE
        googleDriveFolderId: {
            type: String,
            default: null
        },
        googleDriveFolderName: {
            type: String,
            default: null
        },
        originalCategoryInfo: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        photos: [{
            photoId: {
                type: String,
                required: true
            },
            fileName: {
                type: String,
                required: true
            },
            originalLocation: {
                path: String,
                categoryName: String,
                price: Number
            },
            customPrice: {
                type: Number,
                default: null
            },
            addedAt: {
                type: Date,
                default: Date.now
            }
        }],
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],

    // ===== ITEMS EXISTENTES (MANTIDOS COMO ESTÃO) =====
    items: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        driveFileId: {
            type: String,
            required: true
        },
        fileName: {
            type: String,
            required: true
        },
        category: {
            type: String,
            required: true
        },
        thumbnailUrl: {
            type: String
        },
        originalPath: {
            type: String // Caminho original no Google Drive
        },
        newPath: {
            type: String // Novo caminho após movimentação
        },
        price: {
            type: Number,
            default: 0
        },
        selectedAt: {
            type: Date,
            default: Date.now
        },
        movedAt: {
            type: Date
        }
    }],
    totalItems: {
        type: Number,
        required: true,
        default: 0,
        validate: {
            validator: function (value) {
                // Para seleções especiais: permitir 0 ou mais
                if (this.selectionType === 'special') {
                    return value >= 0;
                }
                // Para seleções normais: exigir 1 ou mais
                else {
                    return value >= 1;
                }
            },
            message: function (props) {
                const selectionType = props.instance.selectionType || 'normal';
                if (selectionType === 'special') {
                    return 'Special selections must have 0 or more items (got {VALUE})';
                } else {
                    return 'Normal selections must have at least 1 item (got {VALUE})';
                }
            }
        }
    },
    totalValue: {
        type: Number,
        default: 0,
        min: 0
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'finalized', 'cancelled'],
        default: 'pending',
        index: true
    },
    googleDriveInfo: {
        clientFolderId: {
            type: String // ID da pasta criada para o cliente
        },
        clientFolderName: {
            type: String // Nome da pasta criada
        },
        clientFolderPath: {
            type: String // Caminho completo da pasta
        },
        categorySubfolders: {
            type: Object, // Objeto simples em vez de Map
            default: {}
        },
        finalFolderId: {
            type: String // ID da pasta final (quando finalizada)
        },

        // ===== NOVO: INFORMAÇÕES ESPECIAIS PARA SELEÇÕES ESPECIAIS =====
        specialSelectionInfo: {
            specialFolderId: String,        // ID da pasta da seleção especial
            specialFolderName: String,      // Nome da pasta especial
            originalPhotosBackup: [{        // Backup para restore
                photoId: String,
                originalPath: String,
                originalParentId: String
            }]
        }
    },
    movementLog: [{
        action: {
            type: String,
            enum: [
                'created',
                'moved',
                'reverted',
                'finalized',
                'email_sent',
                'email_failed',
                'approved',
                'moved_to_sold',
                'cancelled',
                'photos_reverted',
                // ===== NOVO: AÇÕES PARA SELEÇÕES ESPECIAIS =====
                'special_selection_created',
                'photo_recategorized',
                'category_created',
                'price_customized',
                'discount_applied',
                'special_selection_activated',
                'special_selection_deactivated',
                'photo_returned'  // ✅ ADICIONE ESTA LINHA!
            ],
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        details: {
            type: String
        },
        success: {
            type: Boolean,
            default: true
        },
        error: {
            type: String
        },
        // ===== NOVO: DADOS EXTRAS PARA TRACKING =====
        extraData: {
            type: Object,
            default: {}
        }
    }],
    adminNotes: {
        type: String,
        trim: true
    },
    createdBy: {
        type: String,
        default: 'client'
    },
    processedBy: {
        type: String // Admin que processou
    },
    processedAt: {
        type: Date
    },
    reservationExpiredAt: {
        type: Date,
        index: true
    },
    finalizedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// ===== ÍNDICES COMPOSTOS (EXISTENTES + NOVOS) =====
selectionSchema.index({ clientCode: 1, status: 1 });
selectionSchema.index({ status: 1, createdAt: -1 });
selectionSchema.index({ sessionId: 1, status: 1 });
selectionSchema.index({ reservationExpiredAt: 1 });

// ===== NOVOS ÍNDICES PARA SELEÇÕES ESPECIAIS =====
selectionSchema.index({ selectionType: 1, status: 1 });
selectionSchema.index({ 'specialSelectionConfig.accessConfig.isActive': 1 });
selectionSchema.index({ 'specialSelectionConfig.accessConfig.expiresAt': 1 });

// ===== MÉTODOS DO SCHEMA (EXISTENTES MANTIDOS) =====

// Método para adicionar log de movimento
selectionSchema.methods.addMovementLog = function (action, details, success = true, error = null, extraData = {}) {
    this.movementLog.push({
        action,
        details,
        success,
        error,
        extraData,
        timestamp: new Date()
    });
};

// Método para calcular valor total
selectionSchema.methods.calculateTotalValue = function () {
    this.totalValue = this.items.reduce((total, item) => total + (item.price || 0), 0);
    return this.totalValue;
};

// ===== NOVO: MÉTODO PARA CALCULAR VALOR TOTAL COM DESCONTOS =====
selectionSchema.methods.calculateTotalValueWithDiscounts = function () {
    let subtotal = this.calculateTotalValue();
    let totalDiscount = 0;
    let appliedDiscounts = [];

    // Se for seleção especial com descontos habilitados
    if (this.selectionType === 'special' && this.specialSelectionConfig) {
        const config = this.specialSelectionConfig;

        // Desconto global
        if (config.pricingConfig.allowGlobalDiscount && config.pricingConfig.globalDiscountPercent > 0) {
            const globalDiscount = (subtotal * config.pricingConfig.globalDiscountPercent) / 100;
            totalDiscount += globalDiscount;
            appliedDiscounts.push({
                type: 'global',
                percent: config.pricingConfig.globalDiscountPercent,
                amount: globalDiscount
            });
        }

        // Descontos por quantidade
        if (config.quantityDiscounts.enabled && config.quantityDiscounts.rules.length > 0) {
            for (const rule of config.quantityDiscounts.rules) {
                if (this.totalItems >= rule.minQuantity) {
                    const quantityDiscount = (subtotal * rule.discountPercent) / 100;
                    totalDiscount += quantityDiscount;
                    appliedDiscounts.push({
                        type: 'quantity',
                        minQuantity: rule.minQuantity,
                        percent: rule.discountPercent,
                        amount: quantityDiscount
                    });
                }
            }
        }
    }

    return {
        subtotal: subtotal,
        totalDiscount: totalDiscount,
        finalTotal: subtotal - totalDiscount,
        appliedDiscounts: appliedDiscounts
    };
};

// ===== NOVO: MÉTODOS PARA SELEÇÕES ESPECIAIS =====

// Verificar se é seleção especial
selectionSchema.methods.isSpecialSelection = function () {
    return this.selectionType === 'special';
};

// Adicionar categoria customizada
selectionSchema.methods.addCustomCategory = function (categoryData) {
    const categoryId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const newCategory = {
        categoryId: categoryId,
        categoryName: categoryData.categoryName,
        categoryDisplayName: categoryData.categoryDisplayName || categoryData.categoryName,
        baseCategoryPrice: categoryData.baseCategoryPrice || 0,
        originalCategoryInfo: categoryData.originalCategoryInfo || {},
        // ✅ NOVOS CAMPOS PARA GOOGLE DRIVE
        googleDriveFolderId: categoryData.googleDriveFolderId || null,
        googleDriveFolderName: categoryData.googleDriveFolderName || null,
        photos: [],
        createdAt: new Date()
    };

    this.customCategories.push(newCategory);

    // ✅ LOG MELHORADO COM INFO DO GOOGLE DRIVE
    this.addMovementLog(
        'category_created',
        `Categoria customizada criada: ${categoryData.categoryName}`,
        true,
        null,
        {
            categoryId,
            categoryName: categoryData.categoryName,
            googleDriveFolderId: categoryData.googleDriveFolderId,
            googleDriveFolderName: categoryData.googleDriveFolderName
        }
    );

    return categoryId;
};

// Mover foto para categoria customizada
selectionSchema.methods.movePhotoToCustomCategory = function (photoData, categoryId) {
    const category = this.customCategories.find(cat => cat.categoryId === categoryId);
    if (!category) {
        throw new Error(`Categoria ${categoryId} não encontrada`);
    }

    // Remover foto de outras categorias (se existir)
    this.customCategories.forEach(cat => {
        cat.photos = cat.photos.filter(photo => photo.photoId !== photoData.photoId);
    });

    // Adicionar à categoria de destino
    category.photos.push({
        photoId: photoData.photoId,
        fileName: photoData.fileName,
        originalLocation: photoData.originalLocation || {},
        customPrice: photoData.customPrice,
        movedAt: new Date()
    });

    this.addMovementLog('photo_recategorized',
        `Foto ${photoData.fileName} movida para categoria ${category.categoryName}`,
        true, null, {
        photoId: photoData.photoId,
        categoryId: categoryId,
        categoryName: category.categoryName
    }
    );
};

// Obter resumo da seleção especial
selectionSchema.methods.getSpecialSelectionSummary = function () {
    if (!this.isSpecialSelection()) {
        return null;
    }

    const totalCustomPhotos = this.customCategories.reduce((total, cat) => total + cat.photos.length, 0);
    const pricing = this.calculateTotalValueWithDiscounts();

    return {
        selectionId: this.selectionId,
        selectionName: this.specialSelectionConfig?.selectionName || 'Unnamed Special Selection',
        clientCode: this.clientCode,
        clientName: this.clientName,
        totalCustomCategories: this.customCategories.length,
        totalCustomPhotos: totalCustomPhotos,
        pricing: pricing,
        status: this.status,
        isActive: this.specialSelectionConfig?.accessConfig?.isActive || false,
        expiresAt: this.specialSelectionConfig?.accessConfig?.expiresAt,
        createdAt: this.createdAt
    };
};

// Verificar se seleção expirou
selectionSchema.methods.isExpired = function () {
    if (!this.reservationExpiredAt) return false;
    return new Date() > this.reservationExpiredAt;
};

// ===== MÉTODOS EXISTENTES MANTIDOS =====
selectionSchema.methods.getSummary = function () {
    const categoryCounts = {};

    this.items.forEach(item => {
        categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    });

    return {
        selectionId: this.selectionId,
        clientCode: this.clientCode,
        clientName: this.clientName,
        totalItems: this.totalItems,
        totalValue: this.totalValue,
        status: this.status,
        categories: categoryCounts,
        createdAt: this.createdAt,
        isExpired: this.isExpired(),
        selectionType: this.selectionType // NOVO
    };
};

// Método para marcar como confirmada
selectionSchema.methods.confirm = function () {
    this.status = 'confirmed';
    this.addMovementLog('confirmed', 'Seleção confirmada pelo cliente');
};

// Método para finalizar
selectionSchema.methods.finalize = function (adminUser) {
    this.status = 'finalized';
    this.processedBy = adminUser;
    this.processedAt = new Date();
    this.finalizedAt = new Date();
    this.addMovementLog('finalized', `Seleção finalizada por ${adminUser}`);
};

// Método para cancelar
selectionSchema.methods.cancel = function (reason, adminUser = null) {
    this.status = 'cancelled';
    if (adminUser) {
        this.processedBy = adminUser;
        this.processedAt = new Date();
    }
    this.addMovementLog('cancelled', `Seleção cancelada: ${reason}`);
};

// ===== MÉTODOS ESTÁTICOS (EXISTENTES + NOVOS) =====

// Gerar ID único de seleção
selectionSchema.statics.generateSelectionId = function () {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `SEL_${timestamp}_${random}`.toUpperCase();
};

// ===== NOVO: GERAR ID ÚNICO PARA SELEÇÃO ESPECIAL =====
selectionSchema.statics.generateSpecialSelectionId = function () {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `SPEC_${timestamp}_${random}`.toUpperCase();
};

// Buscar seleções por status
selectionSchema.statics.findByStatus = function (status, limit = 50) {
    return this.find({ status })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('items.productId');
};

// ===== NOVO: BUSCAR SELEÇÕES ESPECIAIS =====
selectionSchema.statics.findSpecialSelections = function (filters = {}, limit = 50) {
    const query = { selectionType: 'special' };

    if (filters.status) query.status = filters.status;
    if (filters.clientCode) query.clientCode = filters.clientCode;
    if (filters.isActive !== undefined) {
        query['specialSelectionConfig.accessConfig.isActive'] = filters.isActive;
    }

    return this.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('items.productId');
};

// Buscar seleções de um cliente
selectionSchema.statics.findByClient = function (clientCode, limit = 10) {
    return this.find({ clientCode })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('items.productId');
};

// Buscar seleções expiradas
selectionSchema.statics.findExpired = function () {
    const now = new Date();
    return this.find({
        status: 'pending',
        reservationExpiredAt: { $lt: now }
    });
};

// Estatísticas de seleções
selectionSchema.statics.getStatistics = async function () {
    const stats = await this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalItems: { $sum: '$totalItems' },
                totalValue: { $sum: '$totalValue' }
            }
        }
    ]);

    // ===== NOVO: ESTATÍSTICAS SEPARADAS PARA SELEÇÕES ESPECIAIS =====
    const specialStats = await this.aggregate([
        { $match: { selectionType: 'special' } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalItems: { $sum: '$totalItems' },
                totalValue: { $sum: '$totalValue' }
            }
        }
    ]);

    const totalSelections = await this.countDocuments();
    const totalSpecialSelections = await this.countDocuments({ selectionType: 'special' });

    const avgItemsPerSelection = await this.aggregate([
        {
            $group: {
                _id: null,
                avgItems: { $avg: '$totalItems' }
            }
        }
    ]);

    return {
        byStatus: stats,
        specialSelections: {
            byStatus: specialStats,
            total: totalSpecialSelections
        },
        totalSelections,
        avgItemsPerSelection: avgItemsPerSelection[0]?.avgItems || 0,
        timestamp: new Date()
    };
};

// ===== MIDDLEWARE (EXISTENTE + NOVO) =====

// Pre-save: calcular valores
selectionSchema.pre('save', function (next) {
    // Atualizar contagem de itens baseado no tipo de seleção
    if (this.selectionType === 'special') {
        // Para seleções especiais: contar fotos nas categorias customizadas
        this.totalItems = this.customCategories.reduce((total, category) => {
            return total + (category.photos ? category.photos.length : 0);
        }, 0);
    } else {
        // Para seleções normais: contar items como sempre
        this.totalItems = this.items.length;
    }

    // Calcular valor total
    this.calculateTotalValue();

    // Definir data de expiração se for nova seleção
    if (this.isNew && !this.reservationExpiredAt) {
        this.reservationExpiredAt = new Date(Date.now() + (2 * 60 * 60 * 1000)); // 2 horas
    }

    // ===== NOVO: VALIDAÇÕES PARA SELEÇÕES ESPECIAIS =====
    if (this.selectionType === 'special') {
        // Garantir que seleção especial tenha configuração mínima
        if (!this.specialSelectionConfig) {
            this.specialSelectionConfig = {
                pricingConfig: {
                    showPrices: true,
                    allowGlobalDiscount: false,
                    globalDiscountPercent: 0
                },
                quantityDiscounts: {
                    enabled: false,
                    rules: []
                },
                accessConfig: {
                    isActive: true,
                    restrictedAccess: true
                }
            };
        }
    }

    next();
});

// Post-save: log
selectionSchema.post('save', function () {
    const type = this.selectionType === 'special' ? 'ESPECIAL' : 'NORMAL';
    console.log(`📋 Seleção ${type} ${this.selectionId} salva - ${this.totalItems} itens, status: ${this.status}`);
});

module.exports = mongoose.model('Selection', selectionSchema);