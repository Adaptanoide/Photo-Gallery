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
        min: 1
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
                'approved',      // ← ADICIONAR
                'moved_to_sold', // ← ADICIONAR
                'cancelled'      // ← ADICIONAR (para futuro)
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

// ===== ÍNDICES COMPOSTOS =====
selectionSchema.index({ clientCode: 1, status: 1 });
selectionSchema.index({ status: 1, createdAt: -1 });
selectionSchema.index({ sessionId: 1, status: 1 });
selectionSchema.index({ reservationExpiredAt: 1 });

// ===== MÉTODOS DO SCHEMA =====

// Método para adicionar log de movimento
selectionSchema.methods.addMovementLog = function (action, details, success = true, error = null) {
    this.movementLog.push({
        action,
        details,
        success,
        error,
        timestamp: new Date()
    });
};

// Método para calcular valor total
selectionSchema.methods.calculateTotalValue = function () {
    this.totalValue = this.items.reduce((total, item) => total + (item.price || 0), 0);
    return this.totalValue;
};

// Método para verificar se seleção expirou
selectionSchema.methods.isExpired = function () {
    if (!this.reservationExpiredAt) return false;
    return new Date() > this.reservationExpiredAt;
};

// Método para obter resumo da seleção
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
        isExpired: this.isExpired()
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

// ===== MÉTODOS ESTÁTICOS =====

// Gerar ID único de seleção
selectionSchema.statics.generateSelectionId = function () {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `SEL_${timestamp}_${random}`.toUpperCase();
};

// Buscar seleções por status
selectionSchema.statics.findByStatus = function (status, limit = 50) {
    return this.find({ status })
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

    const totalSelections = await this.countDocuments();
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
        this.reservationExpiredAt = new Date(Date.now() + (2 * 60 * 60 * 1000)); // 2 horas
    }

    next();
});

// Post-save: log
selectionSchema.post('save', function () {
    console.log(`📋 Seleção ${this.selectionId} salva - ${this.totalItems} itens, status: ${this.status}`);
});

module.exports = mongoose.model('Selection', selectionSchema);