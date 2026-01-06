// src/services/SlackChatService.js
const axios = require('axios');
const ChatConversation = require('../models/ChatConversation');
const ChatMessage = require('../models/ChatMessage');


class SlackChatService {
    constructor() {
        // Webhook URL do Slack
        this.webhookUrl = process.env.SLACK_CHAT_WEBHOOK_URL;

        // Bot Token (para respostas bidirecionais)
        this.botToken = process.env.SLACK_BOT_TOKEN;

        // Canal padrão
        this.defaultChannel = 'C09N46UKT96'; // Canal #gallery-chat

        // Configuração de retry
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 segundo

        // Validar token ao iniciar
        this.validateToken();
    }

    /**
     * Valida se o bot token está configurado
     */
    validateToken() {
        if (!this.botToken) {
            console.error('❌ [SLACK] SLACK_BOT_TOKEN não está configurado no .env!');
            console.error('⚠️  [SLACK] Chat não funcionará sem o token!');
        } else if (!this.botToken.startsWith('xoxb-')) {
            console.error('❌ [SLACK] SLACK_BOT_TOKEN inválido! Deve começar com "xoxb-"');
        } else {
            console.log('✅ [SLACK] Bot Token configurado corretamente');
        }
    }

    /**
     * Health check - Verifica se o Slack está acessível
     */
    async healthCheck() {
        try {
            if (!this.botToken) {
                return {
                    status: 'error',
                    message: 'Bot token não configurado',
                    error: 'SLACK_BOT_TOKEN missing in .env'
                };
            }

            // Testar conexão com Slack API
            const response = await axios.post(
                'https://slack.com/api/auth.test',
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${this.botToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000
                }
            );

            if (response.data.ok) {
                return {
                    status: 'healthy',
                    message: 'Slack conectado',
                    data: {
                        team: response.data.team,
                        user: response.data.user,
                        bot_id: response.data.bot_id
                    }
                };
            } else {
                return {
                    status: 'error',
                    message: 'Token inválido ou expirado',
                    error: response.data.error
                };
            }

        } catch (error) {
            return {
                status: 'error',
                message: 'Falha ao conectar com Slack',
                error: error.message
            };
        }
    }

    /**
     * Envia mensagem do cliente para o Slack (com retry automático)
     */
    async sendClientMessageToSlack(conversation, message, attachments = []) {
        return await this._retryOperation(async () => {
            try {
                // Validar token
                if (!this.botToken) {
                    throw new Error('SLACK_BOT_TOKEN não configurado');
                }

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
                        text: `New message from ${clientInfo?.clientName || conversation.clientCode}`,
                        blocks: blocks,
                        thread_ts: validThreadTs || undefined // Usar apenas se válido
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${this.botToken}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000 // 10 segundos timeout
                    }
                );

                console.log('📨 [SLACK] Resposta:', response.data.ok ? '✅ Sucesso' : `❌ ${response.data.error}`);

                if (!response.data.ok) {
                    throw new Error(`Slack API error: ${response.data.error}`);
                }

            // 🔧 DETECTAR SE SLACK CRIOU NOVA THREAD
            const returnedThreadTs = response.data.message?.thread_ts || response.data.ts;

            // Caso 1: Primeira mensagem
            if (!conversation.slackThreadTs && returnedThreadTs) {
                conversation.slackThreadTs = returnedThreadTs;
                await conversation.save();
                console.log('✅ [SLACK] Thread TS salvo (primeira mensagem):', returnedThreadTs);
            }
            // Caso 2: Thread existente - verificar se mudou
            else if (conversation.slackThreadTs && returnedThreadTs) {
                if (returnedThreadTs !== validThreadTs && returnedThreadTs !== conversation.slackThreadTs) {
                    console.log('⚠️  [SLACK] NOVA THREAD DETECTADA!');
                    console.log(`   Thread antiga: ${conversation.slackThreadTs}`);
                    console.log(`   Thread nova: ${returnedThreadTs}`);

                    conversation.slackThreadTs = returnedThreadTs;
                    await conversation.save();

                    console.log('✅ [SLACK] Thread atualizada!');
                } else {
                    console.log('📌 [SLACK] Usando thread existente:', conversation.slackThreadTs);
                }
            }

            console.log('✅ Message sent to Slack');
            return response.data;

            } catch (error) {
                console.error('❌ Error sending to Slack:', error.response?.data || error.message);
                throw error;
            }
        });
    }

    /**
     * Monta a mensagem formatada para o Slack
     */
    _buildSlackMessage(conversation, message, clientInfo, attachments) {
        const blocks = [];

        // Header SIMPLES com nome + company
        const clientName = clientInfo?.clientName || 'Unknown Customer';
        const clientCompany = clientInfo?.companyName || 'No company';

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

    /**
     * Retry automático para operações do Slack
     */
    async _retryOperation(operation, attempt = 1) {
        try {
            return await operation();
        } catch (error) {
            if (attempt < this.maxRetries) {
                console.log(`⚠️  [SLACK] Tentativa ${attempt} falhou, tentando novamente em ${this.retryDelay}ms...`);
                console.log(`   Erro: ${error.message}`);

                // Aguardar antes de tentar novamente
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));

                // Tentar novamente
                return await this._retryOperation(operation, attempt + 1);
            } else {
                console.error(`❌ [SLACK] Falhou após ${this.maxRetries} tentativas`);
                throw error;
            }
        }
    }

    /**
     * Delay helper
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new SlackChatService();