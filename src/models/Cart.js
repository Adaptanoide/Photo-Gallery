//src/models/Cart.js

const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    clientCode: {
        type: String,
        required: true,
        index: true
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
        price: { type: Number, default: 0 },
        formattedPrice: { type: String, default: 'Sem preço' },
        hasPrice: { type: Boolean, default: false },
        addedAt: {
            type: Date,
            default: Date.now
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true
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
        index: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
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
    const validItems = this.items.filter(item => item.expiresAt > now);

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
        item.expiresAt > new Date()
    );
};

// Método para obter item específico
cartSchema.methods.getItem = function (driveFileId) {
    return this.items.find(item =>
        item.driveFileId === driveFileId &&
        item.expiresAt > new Date()
    );
};

// Método para calcular tempo restante de reserva
cartSchema.methods.getTimeRemaining = function (driveFileId) {
    const item = this.getItem(driveFileId);
    if (!item) return 0;

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
    }).populate('items.productId');
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
    // Atualizar contadores automaticamente
    this.totalItems = this.items.length;
    this.lastActivity = new Date();
    next();
});

// ===== MIDDLEWARE POST-SAVE =====
cartSchema.post('save', function () {
    console.log(`📦 Carrinho ${this.sessionId} salvo - ${this.totalItems} itens`);
});

module.exports = mongoose.model('Cart', cartSchema);