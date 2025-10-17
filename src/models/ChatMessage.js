// src/models/ChatMessage.js
const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  // ID da conversa a qual pertence
  conversationId: {
    type: String,
    required: true,
    index: true
  },
  
  // Quem enviou: 'client' ou 'salesrep'
  sender: {
    type: String,
    enum: ['client', 'salesrep'],
    required: true
  },
  
  // Conteúdo da mensagem
  message: {
    type: String,
    required: true,
    trim: true
  },
  
  // Anexos (foto que o cliente estava vendo)
  attachments: [{
    type: {
      type: String,
      enum: ['photo', 'link']
    },
    photoId: String,
    photoUrl: String,
    category: String
  }],
  
  // Status de leitura
  read: {
    type: Boolean,
    default: false
  },
  
  // Timestamp de quando foi lida
  readAt: {
    type: Date
  },
  
  // Metadados
  metadata: {
    userAgent: String,
    ipAddress: String,
    slackMessageTs: String  // Timestamp da mensagem no Slack
  }
  
}, {
  timestamps: true
});

// Índices para queries rápidas
chatMessageSchema.index({ conversationId: 1, createdAt: -1 });
chatMessageSchema.index({ conversationId: 1, read: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);