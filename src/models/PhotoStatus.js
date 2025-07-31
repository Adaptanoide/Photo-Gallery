//src/models/PhotoStatus.js

const mongoose = require('mongoose');

const photoStatusSchema = new mongoose.Schema({
    // ===== IDENTIFICAÇÃO DA FOTO =====
    photoId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    fileName: {
        type: String,
        required: true,
        trim: true
    },
    
    // ===== STATUS ATUAL =====
    currentStatus: {
        type: String,
        enum: [
            'available',        // Disponível no estoque
            'reserved',         // Reservada em carrinho (120min)
            'locked',           // Bloqueada para edição admin
            'moved',            // Movida para seleção especial
            'sold',             // Vendida/finalizada
            'archived'          // Arquivada/removida
        ],
        default: 'available',
        required: true,
        index: true
    },

    // ===== LOCALIZAÇÃO ATUAL =====
    currentLocation: {
        // Tipo de localização
        locationType: {
            type: String,
            enum: ['stock', 'cart', 'special_selection', 'sold_folder', 'archived'],
            default: 'stock',
            required: true
        },
        
        // Caminho atual no Google Drive
        currentPath: {
            type: String,
            required: true
        },
        
        // ID da pasta pai atual no Google Drive
        currentParentId: {
            type: String,
            required: true
        },
        
        // Nome da categoria atual
        currentCategory: {
            type: String,
            required: true
        },

        // Se está em seleção especial, referência para ela
        specialSelectionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Selection'
        },
        
        // Se está em carrinho, referência para ele
        cartSessionId: String,
        
        // Data da última movimentação
        lastMovedAt: {
            type: Date,
            default: Date.now
        }
    },

    // ===== SISTEMA DE LOCK PARA ADMINS =====
    lockInfo: {
        // Se está bloqueada para edição
        isLocked: {
            type: Boolean,
            default: false,
            index: true
        },
        
        // Admin que bloqueou
        lockedBy: {
            type: String,
            default: null
        },
        
        // Quando foi bloqueada
        lockedAt: {
            type: Date,
            default: null
        },
        
        // Quando o lock expira (30 minutos)
        lockExpiresAt: {
            type: Date,
            default: null,
            index: true
        },
        
        // Motivo do lock
        lockReason: {
            type: String,
            enum: ['editing', 'moving', 'processing', 'manual'],
            default: 'editing'
        },
        
        // Dados extras do lock
        lockMetadata: {
            type: Object,
            default: {}
        }
    },

    // ===== INFORMAÇÕES ORIGINAIS (BACKUP) =====
    originalLocation: {
        // Localização original no estoque
        originalPath: {
            type: String,
            required: true
        },
        
        // ID da pasta original no Google Drive
        originalParentId: {
            type: String,
            required: true
        },
        
        // Categoria original
        originalCategory: {
            type: String,
            required: true
        },
        
        // Preço original (se disponível)
        originalPrice: {
            type: Number,
            default: 0
        }
    },

    // ===== INFORMAÇÕES DE PREÇO ATUAL =====
    currentPricing: {
        // Preço atual
        currentPrice: {
            type: Number,
            default: 0
        },
        
        // Se tem preço definido
        hasPrice: {
            type: Boolean,
            default: false
        },
        
        // Fonte do preço atual
        priceSource: {
            type: String,
            enum: ['category', 'custom', 'special_selection', 'discount'],
            default: 'category'
        },
        
        // Preço formatado
        formattedPrice: {
            type: String,
            default: 'No price'
        },
        
        // Data da última atualização do preço
        priceUpdatedAt: Date
    },

    // ===== RESERVA TEMPORÁRIA (CARRINHO) =====
    reservationInfo: {
        // Se está reservada
        isReserved: {
            type: Boolean,
            default: false,
            index: true
        },
        
        // Cliente que reservou
        reservedBy: {
            clientCode: String,
            clientName: String,
            sessionId: String
        },
        
        // Quando foi reservada
        reservedAt: Date,
        
        // Quando a reserva expira
        reservationExpiresAt: {
            type: Date,
            index: true
        },
        
        // Número de renovações da reserva
        renewalCount: {
            type: Number,
            default: 0
        }
    },

    // ===== HISTÓRICO COMPLETO =====
    statusHistory: [{
        // Ação realizada
        action: {
            type: String,
            enum: [
                'created',
                'moved',
                'reserved',
                'unreserved',
                'locked',
                'unlocked',
                'price_updated',
                'sold',
                'archived',
                'restored',
                'categorized',
                'selection_created',
                'selection_moved'
            ],
            required: true
        },
        
        // Status anterior
        previousStatus: String,
        
        // Novo status
        newStatus: String,
        
        // Detalhes da ação
        actionDetails: {
            type: String,
            required: true
        },
        
        // Localização anterior
        previousLocation: {
            path: String,
            parentId: String,
            category: String
        },
        
        // Nova localização
        newLocation: {
            path: String,
            parentId: String,
            category: String
        },
        
        // Quem realizou a ação
        performedBy: {
            type: String,
            required: true
        },
        
        // Tipo de usuário (admin, client, system)
        performedByType: {
            type: String,
            enum: ['admin', 'client', 'system'],
            default: 'system'
        },
        
        // Data/hora da ação
        timestamp: {
            type: Date,
            default: Date.now,
            required: true
        },
        
        // Dados extras da ação
        metadata: {
            type: Object,
            default: {}
        },
        
        // Se a ação foi bem-sucedida
        success: {
            type: Boolean,
            default: true
        },
        
        // Erro (se houver)
        error: String
    }],

    // ===== METADADOS =====
    metadata: {
        // Tipo de arquivo
        fileType: {
            type: String,
            enum: ['jpg', 'jpeg', 'png', 'webp'],
            default: 'jpg'
        },
        
        // Tamanho do arquivo (em bytes)
        fileSize: Number,
        
        // Dimensões da imagem
        dimensions: {
            width: Number,
            height: Number
        },
        
        // URL do thumbnail (se disponível)
        thumbnailUrl: String,
        
        // Tags/etiquetas
        tags: [String],
        
        // Qualidade/categoria da foto
        quality: {
            type: String,
            enum: ['premium', 'standard', 'basic'],
            default: 'standard'
        },
        
        // Popularidade (quantas vezes foi vista/reservada)
        popularity: {
            viewCount: {
                type: Number,
                default: 0
            },
            reservationCount: {
                type: Number,
                default: 0
            },
            lastViewedAt: Date
        },
        
        // Notas administrativas
        adminNotes: String
    },

    // ===== CONFIGURAÇÕES =====
    config: {
        // Se permite reserva múltipla
        allowMultipleReservations: {
            type: Boolean,
            default: false
        },
        
        // Tempo de reserva customizado (em minutos)
        customReservationTime: Number,
        
        // Se está destacada/em promoção
        isFeatured: {
            type: Boolean,
            default: false
        },
        
        // Prioridade para ordenação
        sortPriority: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true
});

// ===== ÍNDICES COMPOSTOS =====
photoStatusSchema.index({ currentStatus: 1, 'currentLocation.locationType': 1 });
photoStatusSchema.index({ 'lockInfo.isLocked': 1, 'lockInfo.lockExpiresAt': 1 });
photoStatusSchema.index({ 'reservationInfo.isReserved': 1, 'reservationInfo.reservationExpiresAt': 1 });
photoStatusSchema.index({ 'currentLocation.specialSelectionId': 1 });
photoStatusSchema.index({ currentStatus: 1, createdAt: -1 });

// ===== MÉTODOS DO MODELO =====

// ===== VERIFICAÇÕES DE STATUS =====
photoStatusSchema.methods.isAvailable = function() {
    return this.currentStatus === 'available' && !this.lockInfo.isLocked && !this.reservationInfo.isReserved;
};

photoStatusSchema.methods.isReserved = function() {
    return this.reservationInfo.isReserved && new Date() < this.reservationInfo.reservationExpiresAt;
};

photoStatusSchema.methods.isLocked = function() {
    return this.lockInfo.isLocked && new Date() < this.lockInfo.lockExpiresAt;
};

photoStatusSchema.methods.isMoved = function() {
    return this.currentStatus === 'moved';
};

photoStatusSchema.methods.isSold = function() {
    return this.currentStatus === 'sold';
};

// ===== SISTEMA DE LOCK =====
photoStatusSchema.methods.lock = function(adminUser, reason = 'editing', durationMinutes = 30, metadata = {}) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (durationMinutes * 60 * 1000));

    this.lockInfo = {
        isLocked: true,
        lockedBy: adminUser,
        lockedAt: now,
        lockExpiresAt: expiresAt,
        lockReason: reason,
        lockMetadata: metadata
    };

    this.addToHistory('locked', `Foto bloqueada por ${adminUser} (${reason})`, adminUser, 'admin', { 
        reason, 
        durationMinutes,
        expiresAt 
    });

    return this;
};

photoStatusSchema.methods.unlock = function(adminUser = null, forced = false) {
    const wasLocked = this.lockInfo.isLocked;
    
    this.lockInfo = {
        isLocked: false,
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        lockReason: 'editing',
        lockMetadata: {}
    };

    if (wasLocked) {
        const details = forced ? 
            `Lock removido forçadamente por ${adminUser}` : 
            `Lock removido por ${adminUser || 'sistema'}`;
            
        this.addToHistory('unlocked', details, adminUser || 'system', adminUser ? 'admin' : 'system', { forced });
    }

    return this;
};

photoStatusSchema.methods.renewLock = function(adminUser, additionalMinutes = 30) {
    if (!this.lockInfo.isLocked) {
        throw new Error('Foto não está bloqueada');
    }

    const now = new Date();
    const newExpiresAt = new Date(this.lockInfo.lockExpiresAt.getTime() + (additionalMinutes * 60 * 1000));
    
    this.lockInfo.lockExpiresAt = newExpiresAt;

    this.addToHistory('locked', `Lock renovado por ${adminUser} (+${additionalMinutes}min)`, adminUser, 'admin', { 
        additionalMinutes,
        newExpiresAt 
    });

    return this;
};

// ===== SISTEMA DE RESERVA =====
photoStatusSchema.methods.reserve = function(clientData, durationMinutes = 120) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (durationMinutes * 60 * 1000));

    this.reservationInfo = {
        isReserved: true,
        reservedBy: {
            clientCode: clientData.clientCode,
            clientName: clientData.clientName,
            sessionId: clientData.sessionId
        },
        reservedAt: now,
        reservationExpiresAt: expiresAt,
        renewalCount: 0
    };

    this.currentStatus = 'reserved';
    this.metadata.popularity.reservationCount += 1;

    this.addToHistory('reserved', `Reservada por cliente ${clientData.clientName} (${clientData.clientCode})`, 
        clientData.clientCode, 'client', { durationMinutes, expiresAt });

    return this;
};

photoStatusSchema.methods.unreserve = function(reason = 'manual') {
    const wasReserved = this.reservationInfo.isReserved;
    
    this.reservationInfo = {
        isReserved: false,
        reservedBy: {},
        reservedAt: null,
        reservationExpiresAt: null,
        renewalCount: 0
    };

    this.currentStatus = 'available';

    if (wasReserved) {
        this.addToHistory('unreserved', `Reserva removida: ${reason}`, 'system', 'system', { reason });
    }

    return this;
};

// ===== MOVIMENTAÇÃO =====
photoStatusSchema.methods.moveTo = function(newLocation, performedBy, performedByType = 'admin') {
    const previousLocation = {
        path: this.currentLocation.currentPath,
        parentId: this.currentLocation.currentParentId,
        category: this.currentLocation.currentCategory
    };

    // Atualizar localização atual
    this.currentLocation = {
        locationType: newLocation.locationType || 'stock',
        currentPath: newLocation.currentPath,
        currentParentId: newLocation.currentParentId,
        currentCategory: newLocation.currentCategory,
        specialSelectionId: newLocation.specialSelectionId || null,
        cartSessionId: newLocation.cartSessionId || null,
        lastMovedAt: new Date()
    };

    // Atualizar status baseado no tipo de localização
    switch (newLocation.locationType) {
        case 'special_selection':
            this.currentStatus = 'moved';
            break;
        case 'cart':
            this.currentStatus = 'reserved';
            break;
        case 'sold_folder':
            this.currentStatus = 'sold';
            break;
        default:
            this.currentStatus = 'available';
    }

    this.addToHistory('moved', `Movida de ${previousLocation.category} para ${newLocation.currentCategory}`, 
        performedBy, performedByType, { previousLocation, newLocation });

    return this;
};

// ===== PRICING =====
photoStatusSchema.methods.updatePrice = function(newPrice, priceSource = 'custom', performedBy = 'system') {
    const previousPrice = this.currentPricing.currentPrice;
    
    this.currentPricing = {
        currentPrice: newPrice,
        hasPrice: newPrice > 0,
        priceSource: priceSource,
        formattedPrice: newPrice > 0 ? `$${newPrice.toFixed(2)}` : 'No price',
        priceUpdatedAt: new Date()
    };

    this.addToHistory('price_updated', `Preço atualizado de $${previousPrice} para $${newPrice}`, 
        performedBy, 'admin', { previousPrice, newPrice, priceSource });

    return this;
};

// ===== HISTÓRICO =====
photoStatusSchema.methods.addToHistory = function(action, details, performedBy, performedByType = 'system', metadata = {}) {
    this.statusHistory.push({
        action: action,
        previousStatus: action === 'created' ? null : this.currentStatus,
        newStatus: this.currentStatus,
        actionDetails: details,
        previousLocation: metadata.previousLocation || null,
        newLocation: metadata.newLocation || null,
        performedBy: performedBy,
        performedByType: performedByType,
        timestamp: new Date(),
        metadata: metadata,
        success: true,
        error: null
    });
};

// ===== MÉTODOS DE ANÁLISE =====
photoStatusSchema.methods.getTimeline = function() {
    return this.statusHistory.map(entry => ({
        date: entry.timestamp,
        action: entry.action,
        details: entry.actionDetails,
        performedBy: entry.performedBy,
        success: entry.success
    })).sort((a, b) => b.date - a.date);
};

photoStatusSchema.methods.getLocationHistory = function() {
    return this.statusHistory
        .filter(entry => entry.action === 'moved')
        .map(entry => ({
            date: entry.timestamp,
            from: entry.previousLocation,
            to: entry.newLocation,
            performedBy: entry.performedBy
        }));
};

// ===== MÉTODOS ESTÁTICOS =====

// Criar registro para nova foto
photoStatusSchema.statics.createForPhoto = function(photoData) {
    return new this({
        photoId: photoData.photoId,
        fileName: photoData.fileName,
        currentStatus: 'available',
        currentLocation: {
            locationType: 'stock',
            currentPath: photoData.currentPath,
            currentParentId: photoData.currentParentId,
            currentCategory: photoData.currentCategory,
            lastMovedAt: new Date()
        },
        originalLocation: {
            originalPath: photoData.currentPath,
            originalParentId: photoData.currentParentId,
            originalCategory: photoData.currentCategory,
            originalPrice: photoData.originalPrice || 0
        },
        currentPricing: {
            currentPrice: photoData.currentPrice || 0,
            hasPrice: (photoData.currentPrice || 0) > 0,
            priceSource: 'category',
            formattedPrice: (photoData.currentPrice || 0) > 0 ? `$${photoData.currentPrice.toFixed(2)}` : 'No price',
            priceUpdatedAt: new Date()
        },
        metadata: {
            fileType: photoData.fileName.split('.').pop().toLowerCase(),
            thumbnailUrl: photoData.thumbnailUrl || null
        }
    });
};

// Buscar fotos disponíveis
photoStatusSchema.statics.findAvailable = function(filters = {}) {
    const query = { 
        currentStatus: 'available',
        'lockInfo.isLocked': false,
        'reservationInfo.isReserved': false
    };

    if (filters.category) {
        query['currentLocation.currentCategory'] = filters.category;
    }

    if (filters.locationType) {
        query['currentLocation.locationType'] = filters.locationType;
    }

    return this.find(query).sort({ createdAt: -1 });
};

// Limpar locks e reservas expiradas
photoStatusSchema.statics.cleanupExpired = async function() {
    const now = new Date();
    let cleanedCount = 0;

    // Limpar locks expirados
    const expiredLocks = await this.find({
        'lockInfo.isLocked': true,
        'lockInfo.lockExpiresAt': { $lt: now }
    });

    for (const photo of expiredLocks) {
        photo.unlock('system', false);
        await photo.save();
        cleanedCount++;
    }

    // Limpar reservas expiradas
    const expiredReservations = await this.find({
        'reservationInfo.isReserved': true,
        'reservationInfo.reservationExpiresAt': { $lt: now }
    });

    for (const photo of expiredReservations) {
        photo.unreserve('expired');
        await photo.save();
        cleanedCount++;
    }

    return cleanedCount;
};

// Estatísticas
photoStatusSchema.statics.getStatistics = async function() {
    const stats = await this.aggregate([
        {
            $group: {
                _id: '$currentStatus',
                count: { $sum: 1 }
            }
        }
    ]);

    const lockedCount = await this.countDocuments({ 'lockInfo.isLocked': true });
    const reservedCount = await this.countDocuments({ 'reservationInfo.isReserved': true });
    const totalPhotos = await this.countDocuments();

    return {
        totalPhotos,
        byStatus: stats.reduce((acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
        }, {}),
        currentlyLocked: lockedCount,
        currentlyReserved: reservedCount,
        timestamp: new Date()
    };
};

// ===== MIDDLEWARE =====

// Pre-save: limpeza e validações
photoStatusSchema.pre('save', function(next) {
    // Limpar locks expirados automaticamente
    if (this.lockInfo.isLocked && this.lockInfo.lockExpiresAt && new Date() > this.lockInfo.lockExpiresAt) {
        this.unlock('system', false);
    }

    // Limpar reservas expiradas automaticamente
    if (this.reservationInfo.isReserved && this.reservationInfo.reservationExpiresAt && new Date() > this.reservationInfo.reservationExpiresAt) {
        this.unreserve('expired');
    }

    next();
});

// Post-save: log
photoStatusSchema.post('save', function() {
    const status = this.currentStatus.toUpperCase();
    const location = this.currentLocation.currentCategory;
    console.log(`📸 PhotoStatus ${this.fileName} - ${status} em ${location}`);
});

module.exports = mongoose.model('PhotoStatus', photoStatusSchema);