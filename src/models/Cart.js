//src/models/Cart.js

const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
    },
    clientCode: {
        type: String,
        required: true,
    },
    clientName: {
        type: String,
        required: true
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
        basePrice: { type: Number, default: 0 },
        price: { type: Number, default: 0 },
        formattedPrice: { type: String, default: 'Sem preço' },
        hasPrice: { type: Boolean, default: false },
        // Sistema de Ghost Items - para conflitos CDE
        ghostStatus: {
            type: String,
            enum: ['active', 'ghost', null],
            default: null
        },
        ghostReason: {
            type: String,
            default: null
        },
        ghostedAt: {
            type: Date,
            default: null
        },
        originalPrice: {
            type: Number,
            default: 0
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        expiresAt: {
            type: Date,
            required: false,  // ✅ MODIFICADO: Opcional para Coming Soon
            default: null,     // ✅ MODIFICADO: Null por padrão
            index: true
        },

        // ===== CAMPOS COMING SOON (TRANSIT MANAGEMENT) =====
        transitStatus: {
            type: String,
            enum: ['coming_soon', null],
            default: null,
            comment: 'Flag para identificar fotos em trânsito'
        },
        cdeTable: {
            type: String,
            enum: ['tbinventario', 'tbetiqueta'],
            default: 'tbinventario',
            comment: 'Tabela CDE onde a foto está registrada'
        },
        isComingSoon: {
            type: Boolean,
            default: false,
            comment: 'Indicador rápido se item é Coming Soon'
        },
        pathLevels: {
            type: [String],
            default: [],
            comment: 'Caminho completo da categoria'
        },
        fullPath: {
            type: String,
            default: '',
            comment: 'Path formatado para display'
        }
    }],
    totalItems: {
        type: Number,
        default: 0,
        min: 0
    },
    lastActivity: {
        type: Date,
        default: Date.now,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    // ===== CONTROLE DE NOTIFICAÇÃO DE EXPIRAÇÃO =====
    expirationWarningSet: {
        type: Boolean,
        default: false
    },
    expirationWarningSentAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// ===== ÍNDICES COMPOSTOS PARA PERFORMANCE =====
cartSchema.index({ sessionId: 1, isActive: 1 });
cartSchema.index({ clientCode: 1, isActive: 1 });
cartSchema.index({ 'items.expiresAt': 1 });
cartSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 86400 }); // 24h TTL

// ===== MÉTODOS DO SCHEMA =====

// Método para limpar itens expirados
cartSchema.methods.cleanExpiredItems = function () {
    const now = new Date();
    // ✅ MODIFICADO: Itens sem expiresAt (Coming Soon) NUNCA expiram
    const validItems = this.items.filter(item =>
        !item.expiresAt || item.expiresAt > now
    );

    if (validItems.length !== this.items.length) {
        this.items = validItems;
        this.totalItems = validItems.length;
        this.lastActivity = now;
        return true; // Indica que houve limpeza
    }

    return false; // Nenhum item foi removido
};

// Método para verificar se item específico está no carrinho
cartSchema.methods.hasItem = function (driveFileId) {
    return this.items.some(item =>
        item.driveFileId === driveFileId &&
        (!item.expiresAt || item.expiresAt > new Date())  // ✅ MODIFICADO: Coming Soon sempre válido
    );
};

// Método para obter item específico
cartSchema.methods.getItem = function (driveFileId) {
    return this.items.find(item =>
        item.driveFileId === driveFileId &&
        (!item.expiresAt || item.expiresAt > new Date())  // ✅ MODIFICADO: Coming Soon sempre válido
    );
};

// Método para calcular tempo restante de reserva
cartSchema.methods.getTimeRemaining = function (driveFileId) {
    const item = this.getItem(driveFileId);
    if (!item) return 0;

    // ✅ MODIFICADO: Coming Soon não tem expiração
    if (!item.expiresAt) return null;

    const now = new Date();
    const remaining = item.expiresAt.getTime() - now.getTime();
    return Math.max(0, Math.floor(remaining / 1000)); // segundos
};

// ===== MÉTODOS ESTÁTICOS =====

// Buscar carrinho ativo por sessão
cartSchema.statics.findActiveBySession = function (sessionId) {
    return this.findOne({
        sessionId,
        isActive: true
    });
};

// Buscar carrinho ativo por cliente
cartSchema.statics.findActiveByClient = function (clientCode) {
    return this.findOne({
        clientCode,
        isActive: true
    }).populate('items.productId');
};

// Limpar todos os carrinhos expirados
cartSchema.statics.cleanupExpiredCarts = async function () {
    const now = new Date();

    // Buscar carrinhos com itens expirados
    const expiredCarts = await this.find({
        isActive: true,
        'items.expiresAt': { $lt: now }
    });

    let cleanedCount = 0;

    for (const cart of expiredCarts) {
        const hadExpiredItems = cart.cleanExpiredItems();

        if (hadExpiredItems) {
            if (cart.totalItems === 0) {
                // Se carrinho ficou vazio, desativar
                cart.isActive = false;
            }

            await cart.save();
            cleanedCount++;
        }
    }

    return cleanedCount;
};

// ===== MIDDLEWARE PRE-SAVE =====
cartSchema.pre('save', function (next) {
    // Atualizar contadores - EXCLUIR GHOSTS
    const validItems = this.items.filter(item =>
        !item.ghostStatus || item.ghostStatus !== 'ghost'
    );
    this.totalItems = validItems.length;
    this.lastActivity = new Date();
    next();
});

// ===== MIDDLEWARE POST-SAVE =====
cartSchema.post('save', function () {
    console.log(`📦 Carrinho ${this.sessionId} salvo - ${this.totalItems} itens`);
});

module.exports = mongoose.model('Cart', cartSchema);