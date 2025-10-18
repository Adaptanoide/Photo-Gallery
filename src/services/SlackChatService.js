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
        this.defaultChannel = 'C09MVML9G7J'; // Seu #customer-chats
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

            console.log('📤 [SLACK] Enviando mensagem...');

            // Validar thread_ts (ignorar valores de teste)
            let validThreadTs = null;
            if (conversation.slackThreadTs && !conversation.slackThreadTs.startsWith('test_')) {
                validThreadTs = conversation.slackThreadTs;
                console.log('📋 Thread TS válido:', validThreadTs);
            } else {
                console.log('📋 Thread TS: NOVA CONVERSA (thread anterior era inválido)');
                conversation.slackThreadTs = null; // Resetar
            }

            // Usar chat.postMessage em vez de webhook
            const response = await axios.post(
                'https://slack.com/api/chat.postMessage',
                {
                    channel: this.defaultChannel,
                    text: `New message from ${clientInfo?.name || conversation.clientCode}`,
                    blocks: blocks,
                    thread_ts: validThreadTs || undefined // Usar apenas se válido
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.botToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('📨 [SLACK] Resposta completa:', JSON.stringify(response.data, null, 2));

            if (!response.data.ok) {
                throw new Error(`Slack error: ${response.data.error}`);
            }

            // SEMPRE salvar o ts (seja primeira mensagem ou não)
            if (response.data.ts) {
                conversation.slackThreadTs = response.data.ts;
                await conversation.save();
                console.log('✅ [SLACK] Thread TS salvo:', response.data.ts);
            }

            console.log('✅ Message sent to Slack');
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

        // Header SIMPLES com nome + company
        const clientName = clientInfo?.name || 'Unknown Customer';
        const clientCompany = clientInfo?.company || 'No company';

        blocks.push({
            type: "header",
            text: {
                type: "plain_text",
                text: `${clientName} - ${clientCompany}`,
                emoji: true
            }
        });

        blocks.push({ type: "divider" });

        // Mensagem direto (sem "Customer says:")
        blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: message
            }
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