// src/routes/chat.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./auth');
const ChatConversation = require('../models/ChatConversation');
const ChatMessage = require('../models/ChatMessage');
const SlackChatService = require('../services/SlackChatService');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/chat/start
 * Inicia uma nova conversa ou retorna conversa existente
 */
router.post('/start', authenticateToken, async (req, res) => {
    try {
        const { clientCode } = req.user;
        const { context } = req.body; // { photoId, category, currentPage }

        // Verificar se já existe conversa ativa
        let conversation = await ChatConversation.findOne({
            clientCode,
            status: 'active'
        });

        // Se não existe, criar nova
        if (!conversation) {
            conversation = new ChatConversation({
                conversationId: `chat_${uuidv4()}`,
                clientCode,
                clientInfo: {
                    name: req.user.name,
                    company: req.user.company,
                    email: req.user.email
                },
                context: context || {},
                status: 'active'
            });

            await conversation.save();
            console.log('✅ New conversation created:', conversation.conversationId);
        }

        // Buscar mensagens da conversa
        const messages = await ChatMessage.find({
            conversationId: conversation.conversationId
        }).sort({ createdAt: 1 }).limit(50);

        res.json({
            success: true,
            conversation: {
                conversationId: conversation.conversationId,
                status: conversation.status,
                unreadByClient: conversation.unreadByClient
            },
            messages
        });

    } catch (error) {
        console.error('Error starting chat:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/chat/send
 * Envia mensagem do cliente
 */
router.post('/send', authenticateToken, async (req, res) => {
    try {
        const { conversationId, message, attachments } = req.body;

        // Validações
        if (!message || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Message cannot be empty'
            });
        }

        if (message.length > 2000) {
            return res.status(400).json({
                success: false,
                error: 'Message too long (max 2000 characters)'
            });
        }

        // Buscar conversa
        const conversation = await ChatConversation.findOne({
            conversationId,
            clientCode: req.user.clientCode
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                error: 'Conversation not found'
            });
        }

        // Criar mensagem
        const newMessage = new ChatMessage({
            conversationId,
            sender: 'client',
            message: message.trim(),
            attachments: attachments || [],
            read: false
        });

        await newMessage.save();

        // Atualizar conversa
        conversation.lastMessageAt = new Date();
        conversation.unreadBySalesRep += 1;
        await conversation.save();

        // Enviar para o Slack
        try {
            await SlackChatService.sendClientMessageToSlack(
                conversation,
                message.trim(),
                attachments
            );
        } catch (slackError) {
            console.error('Slack send error:', slackError);
            // Não falhar a requisição se o Slack der erro
        }

        res.json({
            success: true,
            message: newMessage
        });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/chat/messages/:conversationId
 * Busca mensagens de uma conversa (para polling)
 */
router.get('/messages/:conversationId', authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { since } = req.query; // Timestamp da última mensagem que o cliente tem

        // Verificar se conversa pertence ao cliente
        const conversation = await ChatConversation.findOne({
            conversationId,
            clientCode: req.user.clientCode
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                error: 'Conversation not found'
            });
        }

        // Buscar mensagens novas
        const query = { conversationId };

        if (since) {
            query.createdAt = { $gt: new Date(since) };
        }

        const messages = await ChatMessage.find(query)
            .sort({ createdAt: 1 })
            .limit(50);

        // Marcar mensagens do vendedor como lidas
        if (messages.length > 0) {
            await ChatMessage.updateMany(
                {
                    conversationId,
                    sender: 'salesrep',
                    read: false
                },
                {
                    $set: { read: true, readAt: new Date() }
                }
            );

            // Resetar contador de não lidas
            conversation.unreadByClient = 0;
            await conversation.save();
        }

        res.json({
            success: true,
            messages,
            hasNew: messages.length > 0
        });

    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/chat/close
 * Fecha uma conversa
 */
router.post('/close/:conversationId', authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params;

        const conversation = await ChatConversation.findOne({
            conversationId,
            clientCode: req.user.clientCode
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                error: 'Conversation not found'
            });
        }

        conversation.status = 'closed';
        await conversation.save();

        res.json({ success: true });

    } catch (error) {
        console.error('Error closing chat:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/chat/slack-webhook
 * Recebe eventos do Slack (respostas dos vendedores)
 * Esta rota NÃO precisa de autenticação (vem do Slack)
 */
router.post('/slack-webhook', async (req, res) => {
    try {
        console.log('🔴 [WEBHOOK] ROTA CHAMADA!');
        console.log('🔴 [WEBHOOK] Body completo:', JSON.stringify(req.body, null, 2));
        console.log('🔴 [WEBHOOK] Headers:', JSON.stringify(req.headers, null, 2));

        const slackEvent = req.body;

        // Verificação do desafio do Slack (primeira configuração)
        if (slackEvent.type === 'url_verification') {
            console.log('✅ [WEBHOOK] Challenge recebido');
            return res.json({ challenge: slackEvent.challenge });
        }

        // Processar evento de mensagem
        if (slackEvent.event && slackEvent.event.type === 'message') {
            console.log('📨 [WEBHOOK] Evento de mensagem recebido!');
            console.log('📋 Event completo:', JSON.stringify(slackEvent.event, null, 2));

            // Ignorar mensagens de bots
            if (slackEvent.event.bot_id) {
                console.log('⚠️ [WEBHOOK] Mensagem de bot - ignorando');
                return res.json({ ok: true });
            }

            console.log('✅ [WEBHOOK] Processando resposta do vendedor...');

            // Processar resposta do vendedor
            await SlackChatService.processSalesRepReply(slackEvent.event);
        } else {
            console.log('⚠️ [WEBHOOK] Evento diferente:', slackEvent.type);
        }

        res.json({ ok: true });

    } catch (error) {
        console.error('❌ [WEBHOOK] Erro:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;