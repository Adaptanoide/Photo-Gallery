// public/js/client-chat.js

class ChatManager {
    constructor() {
        this.conversationId = null;
        this.isOpen = false;
        this.lastMessageTimestamp = null;
        this.pollingInterval = null;
        this.unreadCount = 0;
        this.clientInitial = 'Y'; // You (Cliente)
        this.salesRepInitial = 'S'; // Sales (Vendedor)
        this.init();
    }

    /**
     * Atualiza o badge de mensagens não lidas
     */
    updateBadge() {
        const badge = document.getElementById('chatUnreadBadge');
        const button = document.getElementById('chatFloatBtn');
        if (!badge) return;

        if (this.unreadCount > 0) {
            badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            badge.style.display = 'flex';
            // Adicionar animação de atenção no botão
            if (button) button.classList.add('has-notification');
        } else {
            badge.style.display = 'none';
            // Remover animação
            if (button) button.classList.remove('has-notification');
        }
    }

    /**
     * Toca som de notificação (Duplo Beep - WhatsApp style)
     */
    playNotificationSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();

            // Primeiro beep
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.frequency.value = 800;
            gain1.gain.setValueAtTime(0.3, ctx.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
            osc1.connect(gain1).connect(ctx.destination);
            osc1.start();
            osc1.stop(ctx.currentTime + 0.08);

            // Segundo beep (mais agudo)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.frequency.value = 1000;
            gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.12);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc2.connect(gain2).connect(ctx.destination);
            osc2.start(ctx.currentTime + 0.12);
            osc2.stop(ctx.currentTime + 0.2);

            console.log('🔔 Som duplo beep tocado');
        } catch (error) {
            console.log('🔇 Erro ao tocar som:', error);
        }
    }

    /**
     * Shows tutorial tooltip (every time user logs in)
     */
    showTooltipTutorial() {
        const tooltip = document.getElementById('chatTooltip');
        if (!tooltip) return;

        // Show after 3 seconds
        setTimeout(() => {
            tooltip.classList.add('show');

            // Hide after 5 seconds
            setTimeout(() => {
                tooltip.classList.remove('show');

                // Remove from DOM after animation
                setTimeout(() => {
                    tooltip.remove();
                }, 500);
            }, 5000);
        }, 3000);
    }

    /**
     * Zera o contador de não lidas
     */
    resetUnreadCount() {
        this.unreadCount = 0;
        this.updateBadge();
        // Remover animação ao abrir chat
        const button = document.getElementById('chatFloatBtn');
        if (button) button.classList.remove('has-notification');
    }

    /**
     * Inicializa o chat
     */
    async init() {
        console.log('💬 [CHAT] Inicializando...');

        // Criar elementos do chat
        this.createChatElements();

        // Adicionar event listeners
        this.attachEventListeners();

        // Tentar carregar conversa existente
        await this.loadExistingConversation();

        // Mostrar tooltip tutorial
        this.showTooltipTutorial();

        console.log('✅ [CHAT] Inicializado com sucesso');
    }

    /**
     * Cria os elementos HTML do chat
     */
    createChatElements() {
        // Criar HTML do chat
        const chatHTML = `
            <!-- Botão flutuante -->
            <button class="chat-float-button" id="chatFloatBtn">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                </svg>
                <span class="chat-unread-badge" id="chatUnreadBadge" style="display: none;">0</span>
            </button>
            
            <!-- Janela do chat -->
            <div class="chat-window" id="chatWindow">
                <!-- Header -->
                <div class="chat-header">
                    <div class="chat-header-title">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                        <div>
                            <h3>Sales Support</h3>
                            <div class="chat-header-subtitle">We're here to help</div>
                        </div>
                    </div>
                    <button class="chat-close-btn" id="chatCloseBtn">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>
                
                <!-- Mensagens -->
                <div class="chat-messages" id="chatMessages">
                    <div class="chat-empty">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                        </svg>
                        <p>Start a conversation with our sales team!</p>
                    </div>
                </div>
                
                <!-- Input -->
                <div class="chat-input-area">
                    <div class="chat-input-wrapper">
                        <textarea 
                            class="chat-textarea" 
                            id="chatInput" 
                            placeholder="Type your message..."
                            rows="1"
                        ></textarea>
                        <button class="chat-send-btn" id="chatSendBtn">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Adicionar ao body
        document.body.insertAdjacentHTML('beforeend', chatHTML);

        console.log('✅ [CHAT] Elementos criados');

        // Adicionar tooltip tutorial
        const tooltipHTML = `
            <div class="chat-tooltip" id="chatTooltip">
                <p class="chat-tooltip-text">💬 Need help? Click here to chat with us!</p>
                <div class="chat-tooltip-arrow"></div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', tooltipHTML);
    }

    /**
     * Adiciona event listeners
     */
    attachEventListeners() {
        // Botão de abrir/fechar
        document.getElementById('chatFloatBtn').addEventListener('click', () => {
            this.toggleChat();
        });

        document.getElementById('chatCloseBtn').addEventListener('click', () => {
            this.closeChat();
        });

        // Enviar mensagem
        document.getElementById('chatSendBtn').addEventListener('click', () => {
            this.sendMessage();
        });

        // Enter para enviar (Shift+Enter para nova linha)
        document.getElementById('chatInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize do textarea
        document.getElementById('chatInput').addEventListener('input', (e) => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
        });
    }

    /**
     * Abre/fecha o chat
     */
    toggleChat() {
        if (this.isOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }

    /**
     * Abre o chat
     */
    async openChat() {
        const chatWindow = document.getElementById('chatWindow');
        chatWindow.classList.add('open');
        this.isOpen = true;
        this.resetUnreadCount();

        // Focar no input
        document.getElementById('chatInput').focus();

        // Iniciar conversa se não existir
        if (!this.conversationId) {
            await this.startConversation();
        }

        // Iniciar polling
        this.startPolling();

        console.log('📖 [CHAT] Chat aberto');
    }

    /**
     * Fecha o chat
     */
    closeChat() {
        const chatWindow = document.getElementById('chatWindow');
        chatWindow.classList.remove('open');
        this.isOpen = false;

        // NÃO parar polling - continua rodando para detectar novas mensagens!

        console.log('📕 [CHAT] Chat fechado');
    }

    /**
     * Carrega conversa existente
     */
    async loadExistingConversation() {
        console.log('💾 [CHAT] Carregando/criando conversa automaticamente...');

        try {
            // Iniciar ou buscar conversa existente
            await this.startConversation();
            console.log('✅ [CHAT] Conversa pronta:', this.conversationId);
        } catch (error) {
            console.error('❌ [CHAT] Erro ao carregar conversa:', error);
        }

        // Iniciar polling (agora com conversationId válido)
        this.startPolling();
    }

    /**
     * Inicia uma nova conversa
     */
    async startConversation() {
        try {
            console.log('🆕 [CHAT] Iniciando conversa...');

            const session = localStorage.getItem('sunshineSession');
            const token = session ? JSON.parse(session).token : null; if (!token) {
                throw new Error('Not authenticated');
            }

            // Contexto da página atual
            const context = {
                currentPage: window.location.pathname,
                photoId: this.getCurrentPhotoId(),
                category: this.getCurrentCategory()
            };

            const response = await fetch('/api/chat/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ context })
            });

            const data = await response.json();

            if (data.success) {
                this.conversationId = data.conversation.conversationId;
                console.log('✅ [CHAT] Conversa iniciada:', this.conversationId);

                // Carregar mensagens existentes
                if (data.messages && data.messages.length > 0) {
                    this.renderMessages(data.messages);
                }
            } else {
                throw new Error(data.error || 'Failed to start conversation');
            }

        } catch (error) {
            console.error('❌ [CHAT] Erro ao iniciar conversa:', error);
            this.showError('Failed to start conversation. Please try again.');
        }
    }

    /**
     * Envia uma mensagem
     */
    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();

        if (!message) return;

        // Verificar se tem conversa ativa
        if (!this.conversationId) {
            await this.startConversation();
            if (!this.conversationId) return;
        }

        try {
            console.log('📤 [CHAT] Enviando mensagem...');

            // Desabilitar input enquanto envia
            input.disabled = true;
            document.getElementById('chatSendBtn').disabled = true;

            const session = localStorage.getItem('sunshineSession');
            const token = session ? JSON.parse(session).token : null;
            const response = await fetch('/api/chat/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    conversationId: this.conversationId,
                    message: message,
                    attachments: []
                })
            });

            const data = await response.json();

            if (data.success) {
                // Adicionar mensagem na tela
                this.addMessage(data.message);

                // Limpar input
                input.value = '';
                input.style.height = 'auto';

                // Atualizar timestamp
                this.lastMessageTimestamp = data.message.createdAt;

                console.log('✅ [CHAT] Mensagem enviada');
            } else {
                throw new Error(data.error || 'Failed to send message');
            }

        } catch (error) {
            console.error('❌ [CHAT] Erro ao enviar:', error);
            this.showError('Failed to send message. Please try again.');
        } finally {
            // Re-habilitar input
            input.disabled = false;
            document.getElementById('chatSendBtn').disabled = false;
            input.focus();
        }
    }

    /**
     * Renderiza múltiplas mensagens
     */
    renderMessages(messages) {
        const container = document.getElementById('chatMessages');

        // Remover mensagem de "vazio"
        const emptyMsg = container.querySelector('.chat-empty');
        if (emptyMsg) emptyMsg.remove();

        // Adicionar cada mensagem
        messages.forEach(msg => this.addMessage(msg, false));

        // Scroll para o final
        this.scrollToBottom();
    }

    /**
     * Adiciona uma mensagem na tela
     */
    addMessage(message, scroll = true) {
        const container = document.getElementById('chatMessages');

        // Remover mensagem de "vazio" se existir
        const emptyMsg = container.querySelector('.chat-empty');
        if (emptyMsg) emptyMsg.remove();

        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${message.sender}`;

        const isClient = message.sender === 'client'; // ADICIONAR ESTA LINHA
        const avatar = isClient ? this.clientInitial : this.salesRepInitial;
        const time = this.formatTime(message.createdAt);

        messageEl.innerHTML = `
            <div class="chat-message-avatar">${avatar}</div>
            <div class="chat-message-bubble">
                <p class="chat-message-text">${this.escapeHtml(message.message)}</p>
                <span class="chat-message-time">${time}</span>
            </div>
        `;

        container.appendChild(messageEl);

        if (scroll) {
            this.scrollToBottom();
        }
    }

    /**
     * Scroll para o final das mensagens
     */
    scrollToBottom() {
        const container = document.getElementById('chatMessages');
        container.scrollTop = container.scrollHeight;
    }

    /**
     * Inicia polling para novas mensagens
     */
    startPolling() {
        if (this.pollingInterval) return;

        console.log('🔄 [CHAT] Iniciando polling...');

        // Poll a cada 3 segundos
        this.pollingInterval = setInterval(() => {
            this.checkNewMessages();
        }, 3000);
    }

    /**
     * Para o polling
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            console.log('⏸️ [CHAT] Polling parado');
        }
    }

    /**
     * Verifica novas mensagens
     */
    async checkNewMessages() {
        if (!this.conversationId) return;

        try {
            const session = localStorage.getItem('sunshineSession');
            const token = session ? JSON.parse(session).token : null; const url = `/api/chat/messages/${this.conversationId}${this.lastMessageTimestamp ? `?since=${this.lastMessageTimestamp}` : ''
                }`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success && data.hasNew) {
                console.log(`📨 [CHAT] ${data.messages.length} nova(s) mensagem(ns)`);

                // Contar mensagens do vendedor
                let newVendorMessages = 0;

                data.messages.forEach(msg => {
                    this.addMessage(msg);
                    this.lastMessageTimestamp = msg.createdAt;

                    // Contar apenas mensagens NÃO LIDAS do vendedor
                    if (msg.sender === 'salesrep' && !this.isOpen && msg.read === false) {
                        newVendorMessages++;
                    }
                });

                // Atualizar badge e tocar som UMA VEZ (se tiver mensagens novas)
                if (newVendorMessages > 0 && !this.isOpen) {
                    this.unreadCount += newVendorMessages;
                    this.updateUnreadBadge();
                    this.playNotificationSound();
                    console.log(`🔔 [CHAT] ${newVendorMessages} nova(s) mensagem(ns) do vendedor. Total não lidas: ${this.unreadCount}`);
                }
            }

        } catch (error) {
            console.error('❌ [CHAT] Erro ao verificar mensagens:', error);
        }
    }

    /**
     * Atualiza badge de não lidas
     */
    updateUnreadBadge() {
        const badge = document.getElementById('chatUnreadBadge');
        if (this.unreadCount > 0) {
            badge.textContent = this.unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    /**
     * Mostra mensagem de erro
     */
    showError(message) {
        // Por enquanto apenas console
        console.error('❌ [CHAT]', message);

        // TODO: Adicionar toast notification
        alert(message);
    }

    /**
     * Helpers
     */
    getCurrentPhotoId() {
        // Tentar pegar da URL ou do estado atual
        // TODO: Implementar lógica específica do seu sistema
        return null;
    }

    getCurrentCategory() {
        // Tentar pegar da seleção atual
        // TODO: Implementar lógica específica do seu sistema
        return null;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔍 [CHAT] Tentando inicializar...');
    console.log('🔑 Token existe?', !!localStorage.getItem('token'));

    const session = localStorage.getItem('sunshineSession');
    if (session) {
        console.log('✅ [CHAT] Sessão encontrada, iniciando...');
        window.chatManager = new ChatManager();
    } else {
        console.log('❌ [CHAT] Sem sessão');
    }
});