//src/models/Selection.js

const mongoose = require('mongoose');

const selectionSchema = new mongoose.Schema({
    selectionId: {
        type: String,
        required: true,
        unique: true,
    },
    sessionId: {
        type: String,
        required: true,
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
    salesRep: {
        type: String,
        trim: true,
        default: 'Unassigned'
    },
    clientCompany: {
        type: String,
        trim: true,
        default: null
    },
    customerNotes: {
        type: String,
        trim: true,
        default: null
    },
    // ===== MOEDA DO CLIENTE =====
    clientCurrency: {
        type: String,
        enum: ['USD', 'CAD', 'EUR'],
        default: 'USD'
    },
    currencyRate: {
        type: Number,
        default: 1
    },
    convertedValue: {
        type: Number,
        default: null
    },
    // ===== TIPO DE SELEÇÃO =====
    selectionType: {
        type: String,
        enum: ['normal'],
        default: 'normal',
    },

    // ===== NOVO: TIPO DE GALERIA (COMING SOON vs AVAILABLE) =====
    galleryType: {
        type: String,
        enum: ['available', 'coming_soon'],
        default: 'available',
        comment: 'Indica se seleção é de galeria normal ou Coming Soon'
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
        // ADICIONAR AQUI O RATE RULES:
        rateRules: [{
            from: {
                type: Number,
                required: true,
                min: 1
            },
            to: {
                type: Number,
                default: null  // null = unlimited (21+)
            },
            price: {
                type: Number,
                required: true,
                min: 0
            }
        }],
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

    // ===== ITEMS (FOTOS ÚNICAS + PRODUTOS DE CATÁLOGO) =====
    items: [{
        // Flag para diferenciar tipo de item
        isCatalogProduct: {
            type: Boolean,
            default: false,
            comment: 'true = Stock Product (catalog), false = Unique Photo'
        },

        // ===== CAMPOS PARA FOTOS ÚNICAS =====
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: function() { return !this.isCatalogProduct; }
        },
        driveFileId: {
            type: String,
            required: function() { return !this.isCatalogProduct; }
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
        movedAt: {
            type: Date
        },
        transitStatus: {
            type: String,
            enum: ['coming_soon', null],
            default: null,
            comment: 'Flag para items em trânsito'
        },
        cdeTable: {
            type: String,
            enum: ['tbinventario', 'tbetiqueta', null],
            default: null,
            comment: 'Tabela CDE onde item está registrado'
        },

        // ===== CAMPOS PARA PRODUTOS DE CATÁLOGO =====
        qbItem: {
            type: String,
            comment: 'QB Item code for catalog products'
        },
        productName: {
            type: String,
            comment: 'Product name for catalog products'
        },
        quantity: {
            type: Number,
            default: 1,
            min: 1,
            comment: 'Quantity for catalog products'
        },
        unitPrice: {
            type: Number,
            default: 0,
            comment: 'Unit price for catalog products'
        },
        reservedIDHs: [{
            type: String,
            comment: 'Reserved IDH codes for catalog products'
        }],

        // ===== CAMPOS COMUNS =====
        fileName: {
            type: String,
            required: true
        },
        category: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            default: 0,
            comment: 'Total price (for photos = unit, for catalog = qty * unitPrice)'
        },
        selectedAt: {
            type: Date,
            default: Date.now
        }
    }],
    totalItems: {
        type: Number,
        required: true,
        default: 0,
        validate: {
            validator: function (value) {
                // NOVO: Se está sendo cancelada, permitir 0 items
                if (this.status === 'cancelled' || this.status === 'cancelling') {
                    return true;
                }
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
                // NOVO: Verificar se props.instance existe
                if (!props || !props.instance) {
                    return 'Selection must have at least 1 item';
                }
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
        enum: ['pending', 'confirmed', 'finalized', 'cancelled', 'cancelling', 'approving', 'deleting', 'reverted'],
        default: 'pending',
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
                'special_selection_created',
                'photo_recategorized',
                'category_created',
                'price_customized',
                'discount_applied',
                'special_selection_activated',
                'special_selection_deactivated',
                'photo_returned',
                'auto_return',
                'item_auto_removed',
                'prices_recalculated'
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
    },
    finalizedAt: {
        type: Date
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    },
    reopenedAt: {
        type: Date,
        default: null
    },
    reopenedBy: {
        type: String,
        default: null
    },
    reopenCount: {
        type: Number,
        default: 0
    },
    // ===== FLAG PARA REVISÃO DE PREÇOS =====
    priceReviewRequired: {
        type: Boolean,
        default: false
    },
    priceReviewReason: {
        type: String,
        default: null
    },
    lastAutoCorrection: {
        type: Date,
        default: null
    },
    // ===== FOTOS RETIRADO (vendidas mas não finalizadas) =====
    hasRetiredPhotos: {
        type: Boolean,
        default: false
    },
    retiredPhotosDetails: [{
        fileName: String,
        photoNumber: String,
        reservedUsu: String,
        detectedAt: { type: Date, default: Date.now }
    }],
    // ===== DOWNLOAD TOKEN PARA CLIENTE =====
    downloadToken: {
        type: String,
        default: null
    },
    downloadTokenCreatedAt: {
        type: Date,
        default: null
    },
    downloadLinkSentAt: {
        type: Date,
        default: null
    },
    downloadLinkSentTo: {
        type: String,
        default: null
    },
    downloadCount: {
        type: Number,
        default: 0
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

// Método para calcular valor total (suporta fotos + catálogo)
selectionSchema.methods.calculateTotalValue = function () {
    this.totalValue = this.items.reduce((total, item) => {
        if (item.isCatalogProduct) {
            // Catalog: usar unitPrice * quantity ou price já calculado
            return total + (item.price || ((item.unitPrice || 0) * (item.quantity || 1)));
        } else {
            // Photo: usar price direto
            return total + (item.price || 0);
        }
    }, 0);
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

// Verificar se é seleção especial (deprecated - always returns false)
selectionSchema.methods.isSpecialSelection = function () {
    return false;
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
        selectionType: this.selectionType,
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
        selectionType: this.selectionType,
        customerNotes: this.customerNotes
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

// ===== MIDDLEWARE =====

// Pre-save: calcular valores
selectionSchema.pre('save', function (next) {
    // Atualizar contagem de itens
    this.totalItems = this.items.length;

    // Calcular valor total
    this.calculateTotalValue();

    // Definir data de expiração se for nova seleção
    if (this.isNew && !this.reservationExpiredAt) {
        this.reservationExpiredAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 horas
    }

    next();
});

// Post-save: log
selectionSchema.post('save', function () {
    console.log(`📋 Seleção ${this.selectionId} salva - ${this.totalItems} itens, status: ${this.status}`);
});

module.exports = mongoose.model('Selection', selectionSchema);