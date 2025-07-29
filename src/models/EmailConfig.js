const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const emailConfigSchema = new mongoose.Schema({
    // Identificador único (só pode ter 1 config ativa)
    configName: {
        type: String,
        default: 'default',
        unique: true
    },
    
    // Status da configuração
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    
    // Configurações SMTP
    smtp: {
        host: {
            type: String,
            required: true,
            trim: true
        },
        port: {
            type: Number,
            required: true,
            min: 1,
            max: 65535
        },
        secure: {
            type: Boolean,
            default: false // true para 465, false para outras portas
        },
        auth: {
            user: {
                type: String,
                required: true,
                trim: true
            },
            pass: {
                type: String,
                required: true // Será criptografada
            }
        }
    },
    
    // Configurações de envio
    sender: {
        name: {
            type: String,
            required: true,
            trim: true,
            default: 'Sunshine Cowhides'
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        }
    },
    
    // Destinatários para notificações
    notifications: {
        newSelection: {
            enabled: {
                type: Boolean,
                default: true
            },
            recipients: [{
                name: String,
                email: {
                    type: String,
                    trim: true,
                    lowercase: true
                }
            }]
        },
        selectionConfirmed: {
            enabled: {
                type: Boolean,
                default: true
            },
            recipients: [{
                name: String,
                email: {
                    type: String,
                    trim: true,
                    lowercase: true
                }
            }]
        },
        selectionCancelled: {
            enabled: {
                type: Boolean,
                default: false
            },
            recipients: [{
                name: String,
                email: {
                    type: String,
                    trim: true,
                    lowercase: true
                }
            }]
        }
    },
    
    // Templates de email
    templates: {
        newSelection: {
            subject: {
                type: String,
                default: '[Sunshine Cowhides] Nova Seleção de Cliente'
            },
            body: {
                type: String,
                default: `Olá!

Uma nova seleção foi criada por um cliente:

Cliente: {{clientName}} ({{clientCode}})
Itens: {{totalItems}} fotos
Valor: {{totalValue}}
Pasta: {{folderName}}

Acesse o painel administrativo para processar esta seleção.

Atenciosamente,
Sistema Sunshine Cowhides`
            }
        }
    },
    
    // Configurações de teste
    testMode: {
        enabled: {
            type: Boolean,
            default: false
        },
        testEmail: {
            type: String,
            trim: true,
            lowercase: true
        }
    },
    
    // Estatísticas
    stats: {
        totalEmailsSent: {
            type: Number,
            default: 0
        },
        lastEmailSent: {
            type: Date
        },
        lastTestAt: {
            type: Date
        }
    },
    
    // Metadados
    createdBy: {
        type: String,
        required: true
    },
    
    lastModifiedBy: {
        type: String
    }
}, {
    timestamps: true
});

// ===== ÍNDICES =====
emailConfigSchema.index({ isActive: 1 });
emailConfigSchema.index({ configName: 1 });

// ===== MÉTODOS DO SCHEMA =====

// Método para testar configuração
emailConfigSchema.methods.testConnection = async function() {
    const nodemailer = require('nodemailer');
    
    try {
        const transporter = nodemailer.createTransport({
            host: this.smtp.host,
            port: this.smtp.port,
            secure: this.smtp.secure,
            auth: {
                user: this.smtp.auth.user,
                pass: this.smtp.auth.pass // Usar senha já descriptografada
            }
        });
        
        await transporter.verify();
        
        // Atualizar estatísticas
        this.stats.lastTestAt = new Date();
        await this.save();
        
        return { success: true, message: 'Conexão SMTP testada com sucesso' };
        
    } catch (error) {
        return { 
            success: false, 
            message: 'Erro na conexão SMTP', 
            error: error.message 
        };
    }
};

// Método para incrementar contador de emails
emailConfigSchema.methods.incrementEmailCounter = function() {
    this.stats.totalEmailsSent += 1;
    this.stats.lastEmailSent = new Date();
    return this.save();
};

// Método para obter resumo da configuração
emailConfigSchema.methods.getSummary = function() {
    return {
        configName: this.configName,
        isActive: this.isActive,
        smtp: {
            host: this.smtp.host,
            port: this.smtp.port,
            secure: this.smtp.secure,
            user: this.smtp.auth.user
            // Não retornar senha
        },
        sender: this.sender,
        notifications: {
            newSelection: this.notifications.newSelection.enabled,
            selectionConfirmed: this.notifications.selectionConfirmed.enabled,
            selectionCancelled: this.notifications.selectionCancelled.enabled
        },
        stats: this.stats,
        updatedAt: this.updatedAt
    };
};

// ===== MÉTODOS ESTÁTICOS =====

// Buscar configuração ativa
emailConfigSchema.statics.findActiveConfig = function() {
    return this.findOne({ isActive: true });
};

// Criar configuração padrão
emailConfigSchema.statics.createDefaultConfig = function(adminUser) {
    return new this({
        configName: 'default',
        isActive: true,
        smtp: {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: '',
                pass: ''
            }
        },
        sender: {
            name: 'Sunshine Cowhides',
            email: ''
        },
        notifications: {
            newSelection: {
                enabled: true,
                recipients: []
            },
            selectionConfirmed: {
                enabled: true,
                recipients: []
            },
            selectionCancelled: {
                enabled: false,
                recipients: []
            }
        },
        testMode: {
            enabled: false,
            testEmail: ''
        },
        createdBy: adminUser
    });
};

// ===== MIDDLEWARE =====

// Post-save: log
emailConfigSchema.post('save', function() {
    console.log(`📧 Configuração de email salva: ${this.configName} (ativa: ${this.isActive})`);
});

module.exports = mongoose.model('EmailConfig', emailConfigSchema);