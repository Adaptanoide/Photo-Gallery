// src/services/SlackChatService.js
const axios = require('axios');
const ChatConversation = require('../models/ChatConversation');
const ChatMessage = require('../models/ChatMessage');


class SlackChatService {
    constructor() {
        // Webhook URL do Slack - você vai pegar isso no Slack
        this.webhookUrl = process.env.SLACK_CHAT_WEBHOOK_URL;

        // Bot Token (para respostas bidirecionais - vamos configurar depois)
        this.botToken = process.env.SLACK_BOT_TOKEN;

        // Canal padrão
        this.defaultChannel = 'C07V9JZV5JK'; // Seu #customer-chats
    }

    /**
     * Envia mensagem do cliente para o Slack
     */
    async sendClientMessageToSlack(conversation, message, attachments = []) {
        try {
            // Buscar info do cliente pelo código
            const AccessCode = require('../models/AccessCode');
            const clientInfo = await AccessCode.findOne({ code: conversation.clientCode });

            // Montar mensagem rica para o Slack
            const blocks = this._buildSlackMessage(conversation, message, clientInfo, attachments);

            // Enviar para o Slack
            const response = await axios.post(this.webhookUrl, {
                blocks: blocks,
                text: `New message from ${clientInfo?.name || conversation.clientCode}`
            });

            // Se é a primeira mensagem, salvar o thread_ts
            if (!conversation.slackThreadTs && response.data.ts) {
                conversation.slackThreadTs = response.data.ts;
                await conversation.save();
            }

            console.log('✅ Message sent to Slack:', response.data);
            return response.data;

        } catch (error) {
            console.error('❌ Error sending to Slack:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Monta a mensagem formatada para o Slack
     */
    _buildSlackMessage(conversation, message, clientInfo, attachments) {
        const blocks = [];

        // Header com info do cliente
        blocks.push({
            type: "header",
            text: {
                type: "plain_text",
                text: `💬 ${clientInfo?.name || 'Customer'} (${conversation.clientCode})`,
                emoji: true
            }
        });

        // Contexto (empresa, foto visualizando, etc)
        const contextElements = [];

        if (clientInfo?.company) {
            contextElements.push({
                type: "mrkdwn",
                text: `🏢 *${clientInfo.company}*`
            });
        }

        if (conversation.context?.photoId) {
            contextElements.push({
                type: "mrkdwn",
                text: `📸 Viewing: *${conversation.context.photoId}*`
            });
        }

        if (conversation.context?.category) {
            contextElements.push({
                type: "mrkdwn",
                text: `📁 ${conversation.context.category}`
            });
        }

        if (contextElements.length > 0) {
            blocks.push({
                type: "context",
                elements: contextElements
            });
        }

        // Divider
        blocks.push({ type: "divider" });

        // Mensagem do cliente
        blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*Customer says:*\n${message}`
            }
        });

        // Se tem foto anexada
        if (attachments && attachments.length > 0) {
            attachments.forEach(attachment => {
                if (attachment.type === 'photo' && attachment.photoUrl) {
                    blocks.push({
                        type: "image",
                        image_url: attachment.photoUrl,
                        alt_text: `Photo ${attachment.photoId}`
                    });
                }
            });
        }

        // Footer com instruções
        blocks.push({
            type: "context",
            elements: [{
                type: "mrkdwn",
                text: "💡 _Reply in this thread to respond to the customer_"
            }]
        });

        return blocks;
    }

    /**
     * Processa resposta do vendedor vinda do Slack
     * (Isso será chamado pelo webhook do Slack)
     */
    async processSalesRepReply(slackEvent) {
        try {
            // Verificar se é uma resposta em thread
            if (!slackEvent.thread_ts) {
                console.log('Not a thread reply, ignoring');
                return;
            }

            // Buscar conversa pelo thread_ts
            const conversation = await ChatConversation.findOne({
                slackThreadTs: slackEvent.thread_ts,
                status: 'active'
            });

            if (!conversation) {
                console.log('Conversation not found for thread:', slackEvent.thread_ts);
                return;
            }

            // Criar mensagem no banco de dados
            const newMessage = new ChatMessage({
                conversationId: conversation.conversationId,
                sender: 'salesrep',
                message: slackEvent.text,
                read: false,
                metadata: {
                    slackMessageTs: slackEvent.ts,
                    slackUser: slackEvent.user
                }
            });

            await newMessage.save();

            // Atualizar conversa
            conversation.lastMessageAt = new Date();
            conversation.unreadByClient += 1;
            await conversation.save();

            console.log('✅ Sales rep reply saved:', newMessage._id);
            return newMessage;

        } catch (error) {
            console.error('❌ Error processing Slack reply:', error);
            throw error;
        }
    }
}

module.exports = new SlackChatService();