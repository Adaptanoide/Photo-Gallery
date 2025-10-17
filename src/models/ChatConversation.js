// src/models/ChatConversation.js
const mongoose = require('mongoose');

const chatConversationSchema = new mongoose.Schema({
  // Identificador único da conversa
  conversationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Código de acesso do cliente
  clientCode: {
    type: String,
    required: true,
    index: true
  },
  
  // Informações do cliente
  clientInfo: {
    name: String,
    company: String,
    email: String,
    phone: String
  },
  
  // Status da conversa
  status: {
    type: String,
    enum: ['active', 'closed', 'archived'],
    default: 'active',
    index: true
  },
  
  // ID do thread no Slack (para respostas)
  slackThreadTs: {
    type: String,
    index: true
  },
  
  // Canal do Slack onde a conversa está
  slackChannel: {
    type: String,
    default: 'C07V9JZV5JK' // Seu canal #customer-chats
  },
  
  // Última mensagem enviada
  lastMessageAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Contexto da conversa
  context: {
    photoId: String,           // Foto que o cliente estava vendo
    category: String,          // Categoria da foto
    currentPage: String        // Página onde iniciou o chat
  },
  
  // Contador de mensagens não lidas pelo cliente
  unreadByClient: {
    type: Number,
    default: 0
  },
  
  // Contador de mensagens não lidas pelo vendedor
  unreadBySalesRep: {
    type: Number,
    default: 0
  }
  
}, {
  timestamps: true // Cria createdAt e updatedAt automaticamente
});

// Índices compostos para queries rápidas
chatConversationSchema.index({ clientCode: 1, status: 1 });
chatConversationSchema.index({ status: 1, lastMessageAt: -1 });

module.exports = mongoose.model('ChatConversation', chatConversationSchema);