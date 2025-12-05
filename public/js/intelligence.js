// public/js/intelligence.js - VERSÃO OTIMIZADA COM MELHOR UX
(function () {
    'use strict';

    // ========================================
    // CONFIGURAÇÕES E ESTADO GLOBAL
    // ========================================

    const CONFIG = {
        API_BASE: '/api/intelligence',
        TOKEN_KEY: 'ai_token',
        MESSAGES_KEY: 'ai_messages_cache',
        STATUS_CHECK_INTERVAL: 30000, // 30 segundos
        AUTO_SAVE_INTERVAL: 10000, // 10 segundos
        MAX_CACHED_MESSAGES: 50,
        CONNECTION_RETRY_DELAY: 3000
    };

    const STATE = {
        isConnected: false,
        isTyping: false,
        messageHistory: [],
        currentTypingId: null,
        statusCheckTimer: null,
        autoSaveTimer: null,
        editingRuleId: null,
        connectionRetries: 0,
        currentConversationId: null
    };

    // ========================================
    // CUSTOM ALERT SYSTEM
    // ========================================

    function showAlert(message, title = 'Sunshine AI', type = 'info') {
        // Remover alert anterior se existir
        const existingAlert = document.querySelector('.alert-overlay');
        if (existingAlert) existingAlert.remove();

        const overlay = document.createElement('div');
        overlay.className = 'alert-overlay';

        overlay.innerHTML = `
            <div class="custom-alert">
                <div class="custom-alert-header">${title}</div>
                <div class="custom-alert-body">${message}</div>
                <div class="custom-alert-buttons">
                    <button class="custom-alert-btn custom-alert-btn-primary">OK</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        return new Promise(resolve => {
            overlay.querySelector('.custom-alert-btn-primary').onclick = () => {
                document.body.removeChild(overlay);
                resolve(true);
            };
        });
    }

    function showConfirm(message, title = 'Confirm') {
        const existingAlert = document.querySelector('.alert-overlay');
        if (existingAlert) existingAlert.remove();

        const overlay = document.createElement('div');
        overlay.className = 'alert-overlay';

        overlay.innerHTML = `
            <div class="custom-alert">
                <div class="custom-alert-header">${title}</div>
                <div class="custom-alert-body">${message}</div>
                <div class="custom-alert-buttons">
                    <button class="custom-alert-btn custom-alert-btn-secondary">Cancel</button>
                    <button class="custom-alert-btn custom-alert-btn-primary">OK</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        return new Promise(resolve => {
            overlay.querySelector('.custom-alert-btn-primary').onclick = () => {
                document.body.removeChild(overlay);
                resolve(true);
            };

            overlay.querySelector('.custom-alert-btn-secondary').onclick = () => {
                document.body.removeChild(overlay);
                resolve(false);
            };
        });
    }

    // ========================================
    // AUTENTICAÇÃO E INICIALIZAÇÃO
    // ========================================

    function checkAuthentication() {
        const token = localStorage.getItem(CONFIG.TOKEN_KEY);
        if (!token) {
            window.location.href = '/intelligence-login.html';
            return false;
        }

        // Verificar se token ainda é válido (decodificar JWT)
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const expiry = payload.exp * 1000;

            if (Date.now() > expiry) {
                localStorage.removeItem(CONFIG.TOKEN_KEY);
                window.location.href = '/intelligence-login.html';
                return false;
            }

            // Mostrar username
            const username = payload.username;
            console.log(`👤 Logged in as ${username}`);

            return true;
        } catch (error) {
            console.error('Invalid token:', error);
            localStorage.removeItem(CONFIG.TOKEN_KEY);
            window.location.href = '/intelligence-login.html';
            return false;
        }
    }

    function initialize() {
        if (!checkAuthentication()) return;

        loadCachedMessages();
        setupEventListeners();
        startStatusMonitoring();
        startAutoSave();
        showWelcomeMessage();
        checkConnectionStatus();

        // Carregar conversas
        loadConversations();

        // Se não tem conversa ativa, criar uma
        if (!STATE.currentConversationId) {  // ← IMPORTANTE: STATE.currentConversationId
            createNewConversation();
        }

        console.log('✅ Intelligence UI initialized');
    }

    // ========================================
    // GESTÃO DE CONEXÃO
    // ========================================

    async function checkConnectionStatus() {
        const statusElement = document.getElementById('cdeStatus');

        // Mostrar estado "connecting"
        if (statusElement) {
            statusElement.className = 'status-indicator connecting';
            statusElement.textContent = 'CDE: Connecting...';
        }

        try {
            const response = await fetchWithAuth('/status');

            if (!response.ok) {
                throw new Error('Status check failed');
            }

            const data = await response.json();
            updateStatusIndicators(data);

            STATE.isConnected = data.services.cde === 'online';
            STATE.connectionRetries = 0;

        } catch (error) {
            console.error('Status check error:', error);
            STATE.isConnected = false;
            STATE.connectionRetries++;

            if (statusElement) {
                statusElement.className = 'status-indicator disabled';
                statusElement.textContent = 'CDE: Offline';
            }

            // Tentar reconectar automaticamente
            if (STATE.connectionRetries < 3) {
                setTimeout(checkConnectionStatus, CONFIG.CONNECTION_RETRY_DELAY);
            }
        }
    }

    function updateStatusIndicators(data) {
        const statusElement = document.getElementById('cdeStatus');

        if (!statusElement) return;

        // CDE Status
        if (data.services.cde === 'online') {
            statusElement.className = 'status-indicator connected';
            statusElement.textContent = `CDE: Connected`;

            // Adicionar métricas se disponível
            if (data.performance) {
                const hitRate = data.performance.cacheHitRate || 0;
                statusElement.title = `Cache Hit: ${hitRate}% | Avg: ${data.performance.avgResponseTime}ms`;
            }
        } else if (data.services.cde === 'offline') {
            statusElement.className = 'status-indicator disabled';
            statusElement.textContent = 'CDE: Offline';

            if (data.cache && data.cache.entries > 0) {
                statusElement.title = `Using cached data (${data.cache.entries} entries)`;
            }
        } else {
            statusElement.className = 'status-indicator connecting';
            statusElement.textContent = 'CDE: Connecting...';
        }
    }

    // ========================================
    // GESTÃO DE MENSAGENS E CHAT
    // ========================================

    async function sendMessage() {
        const input = document.getElementById('chatInput');
        const question = input.value.trim();

        if (!question) return;

        // Desabilitar input
        input.disabled = true;
        const sendBtn = document.querySelector('.send-btn');
        if (sendBtn) sendBtn.disabled = true;

        // Adicionar mensagem do usuário
        addMessage(question, 'user');
        input.value = '';

        // Mostrar typing
        const typingId = showTyping();

        try {
            const startTime = Date.now();

            const response = await fetchWithAuth('/chat', {
                method: 'POST',
                body: JSON.stringify({
                    question,
                    conversationId: STATE.currentConversationId
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to get response');
            }

            const data = await response.json();

            // Atualizar conversationId se nova
            if (data.conversationId && !STATE.currentConversationId) {
                STATE.currentConversationId = data.conversationId;
                await loadConversations();
            }

            const responseTime = Date.now() - startTime;

            removeTyping(typingId);

            // Adicionar resposta
            const responseText = data.response +
                (responseTime > 5000 ? `\n\n⏱️ Response time: ${(responseTime / 1000).toFixed(1)}s` : '');

            addMessage(responseText, 'assistant');

            // RECARREGAR CONVERSAS para mostrar novo título
            await loadConversations();

            smoothScrollToBottom();

        } catch (error) {
            removeTyping(typingId);

            if (error.message.includes('timeout')) {
                addMessage(
                    '⏱️ The request took too long. Try asking a simpler question.',
                    'assistant error'
                );
            } else if (error.message.includes('401')) {
                localStorage.removeItem(CONFIG.TOKEN_KEY);
                window.location.href = '/intelligence-login.html';
            } else {
                addMessage(
                    `❌ ${error.message}\n\nTry refreshing the page or asking a different question.`,
                    'assistant error'
                );
            }
        } finally {
            input.disabled = false;
            if (sendBtn) sendBtn.disabled = false;
            input.focus();
        }
    }

    function addMessage(text, sender) {
        const container = document.getElementById('messagesContainer');
        const message = document.createElement('div');
        message.className = `message ${sender}`;

        // Processar formatação do texto
        const formattedText = formatMessage(text);
        message.innerHTML = formattedText;

        // Adicionar timestamp
        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = new Date().toLocaleTimeString();
        message.appendChild(timestamp);

        container.appendChild(message);

        // Salvar no histórico
        STATE.messageHistory.push({
            text,
            sender,
            timestamp: new Date().toISOString()
        });

        // Limitar histórico
        if (STATE.messageHistory.length > CONFIG.MAX_CACHED_MESSAGES) {
            STATE.messageHistory.shift();
        }

        // Animação de entrada
        requestAnimationFrame(() => {
            message.classList.add('fade-in');
        });
    }

    function formatMessage(text) {
        // Converter bullets e formatação
        return text
            .replace(/•/g, '&bull;')
            .replace(/\n/g, '<br>')
            .replace(/📊/g, '<span class="emoji">📊</span>')
            .replace(/📈/g, '<span class="emoji">📈</span>')
            .replace(/📦/g, '<span class="emoji">📦</span>')
            .replace(/💰/g, '<span class="emoji">💰</span>')
            .replace(/🎯/g, '<span class="emoji">🎯</span>')
            .replace(/✅/g, '<span class="emoji">✅</span>')
            .replace(/⚠️/g, '<span class="emoji">⚠️</span>')
            .replace(/🔴/g, '<span class="emoji">🔴</span>')
            .replace(/🟡/g, '<span class="emoji">🟡</span>')
            .replace(/🟢/g, '<span class="emoji">🟢</span>');
    }

    function showTyping() {
        const container = document.getElementById('messagesContainer');
        const typing = document.createElement('div');
        typing.className = 'message assistant typing';
        typing.id = 'typing-' + Date.now();
        typing.innerHTML = '<span>•</span><span>•</span><span>•</span>';
        container.appendChild(typing);
        smoothScrollToBottom();
        STATE.currentTypingId = typing.id;
        return typing.id;
    }

    function removeTyping(id) {
        const typing = document.getElementById(id);
        if (typing) {
            typing.classList.add('fade-out');
            setTimeout(() => typing.remove(), 300);
        }
        STATE.currentTypingId = null;
    }

    function smoothScrollToBottom() {
        const container = document.getElementById('messagesContainer');
        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
        });
    }

    // ========================================
    // QUICK ACTIONS E SUGESTÕES
    // ========================================

    function askQuestion(button) {
        const question = button.textContent.trim();
        const input = document.getElementById('chatInput');
        input.value = question;
        input.focus();

        // Auto-enviar após pequeno delay
        setTimeout(sendMessage, 100);
    }

    function showWelcomeMessage() {
        const container = document.getElementById('messagesContainer');

        if (STATE.messageHistory.length === 0) {
            const welcomeHTML = `
                <div class="welcome-message">
                    <h3>Welcome to Sunshine Intelligence! 🤖</h3>
                    <p>I can help you analyze inventory and optimize your business.</p>
                    <div class="suggestions">
                        <button class="suggestion-chip" onclick="askQuestion(this)">What needs restocking?</button>
                        <button class="suggestion-chip" onclick="askQuestion(this)">Show top products</button>
                        <button class="suggestion-chip" onclick="askQuestion(this)">Today's sales</button>
                        <button class="suggestion-chip" onclick="askQuestion(this)">Sales by channel</button>
                    </div>
                </div>
            `;
            container.innerHTML = welcomeHTML;
        }
    }

    // ========================================
    // CACHE E PERSISTÊNCIA
    // ========================================

    function loadCachedMessages() {
        try {
            const cached = localStorage.getItem(CONFIG.MESSAGES_KEY);
            if (cached) {
                STATE.messageHistory = JSON.parse(cached);

                // Restaurar últimas mensagens
                const container = document.getElementById('messagesContainer');
                container.innerHTML = '';

                STATE.messageHistory.slice(-10).forEach(msg => {
                    addMessage(msg.text, msg.sender);
                });

                console.log(`📦 Restored ${STATE.messageHistory.length} messages from cache`);
            }
        } catch (error) {
            console.error('Failed to load cached messages:', error);
            STATE.messageHistory = [];
        }
    }

    function saveMessagesToCache() {
        try {
            localStorage.setItem(CONFIG.MESSAGES_KEY, JSON.stringify(STATE.messageHistory));
        } catch (error) {
            console.error('Failed to save messages:', error);
        }
    }

    function clearChat() {
        if (!confirm('Clear all chat history?')) return;

        STATE.messageHistory = [];
        localStorage.removeItem(CONFIG.MESSAGES_KEY);
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '';
        showWelcomeMessage();
    }

    // ========================================
    // UTILITÁRIOS
    // ========================================

    async function fetchWithAuth(url, options = {}) {
        const token = localStorage.getItem(CONFIG.TOKEN_KEY);

        return fetch(CONFIG.API_BASE + url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...options.headers
            }
        });
    }

    async function logout() {
        const confirmed = await showConfirm('Are you sure you want to logout?', 'Logout');
        if (confirmed) {
            localStorage.removeItem(CONFIG.TOKEN_KEY);
            localStorage.removeItem(CONFIG.MESSAGES_KEY);
            window.location.href = '/intelligence-login.html';
        }
    }

    // ========================================
    // EVENT LISTENERS
    // ========================================

    function setupEventListeners() {
        // Chat input
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }

        // Send button
        const sendBtn = document.querySelector('.send-btn');
        if (sendBtn) {
            sendBtn.addEventListener('click', sendMessage);
        }

        // Theme toggle
        const themeBtn = document.querySelector('.theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', toggleTheme);
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+K = focus input
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                chatInput?.focus();
            }

            // Ctrl+L = clear chat
            if (e.ctrlKey && e.key === 'l') {
                e.preventDefault();
                clearChat();
            }

            // Esc = cancel typing
            if (e.key === 'Escape' && STATE.currentTypingId) {
                removeTyping(STATE.currentTypingId);
            }
        });
    }

    // ========================================
    // TRAINING MODAL FUNCTIONS
    // ========================================

    let editingRuleId = null;

    function openTrainingModal() {
        const modal = document.getElementById('trainingModal');
        if (modal) {
            modal.style.display = 'block';
            resetTrainingForm();
        }
    }

    function closeTrainingModal() {
        const modal = document.getElementById('trainingModal');
        if (modal) {
            modal.style.display = 'none';
            resetTrainingForm();
        }
    }

    function closeSavedRulesModal() {
        const modal = document.getElementById('savedRulesModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    function resetTrainingForm() {
        const title = document.getElementById('ruleTitle');
        const type = document.getElementById('ruleType');
        const desc = document.getElementById('ruleDescription');

        if (title) title.value = '';
        if (type) type.value = 'restock';
        if (desc) desc.value = '';

        const saveBtn = document.querySelector('.save-btn');
        if (saveBtn) {
            saveBtn.innerHTML = '💾 Save Rule';
            saveBtn.setAttribute('onclick', 'saveTrainingRule()');
        }

        editingRuleId = null;
    }

    async function saveTrainingRule() {
        const title = document.getElementById('ruleTitle')?.value;
        const type = document.getElementById('ruleType')?.value;
        const description = document.getElementById('ruleDescription')?.value;

        if (!title || !description) {
            await showAlert('Please fill in all fields', 'Required Fields');
            return;
        }

        try {
            const response = await fetchWithAuth('/training-rules', {
                method: 'POST',
                body: JSON.stringify({ title, type, description, applied: false })
            });

            if (response.ok) {
                resetTrainingForm();
                await showAlert('Rule saved successfully!', 'Success');

                if (document.getElementById('savedRulesModal')?.style.display === 'block') {
                    await loadSavedRules();
                }
            }
        } catch (error) {
            await showAlert('Error saving rule: ' + error.message, 'Error');
        }
    }

    async function viewSavedRules() {
        const modal = document.getElementById('savedRulesModal');
        if (modal) {
            modal.style.display = 'block';
            await loadSavedRules();
        }
    }

    async function loadSavedRules() {
        try {
            const response = await fetchWithAuth('/training-rules');
            const data = await response.json();

            const rulesList = document.getElementById('rulesList');
            if (!rulesList) return;

            if (!data.rules || data.rules.length === 0) {
                rulesList.innerHTML = '<p style="padding: 40px; text-align: center; color: var(--text-secondary);">No rules saved yet.</p>';
            } else {
                rulesList.innerHTML = data.rules.map(rule => {
                    const typeColor = {
                        'restock': '#10b981',
                        'pricing': '#f59e0b',
                        'seasonal': '#6366f1',
                        'client': '#ec4899',
                        'general': '#6b7280'
                    }[rule.type] || '#6b7280';

                    return `
                    <div class="rule-item">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div style="flex: 1;">
                                <strong style="font-size: 16px; color: var(--text-primary);">${rule.title}</strong>
                                <span style="background: ${typeColor}20; color: ${typeColor}; padding: 3px 10px; border-radius: 6px; font-size: 11px; margin-left: 10px; font-weight: 600;">
                                    ${rule.type.toUpperCase()}
                                </span>
                                <p style="margin: 10px 0; color: var(--text-primary); line-height: 1.6;">
                                    ${rule.description}
                                </p>
                                <small style="opacity: 0.6; font-size: 12px;">
                                    Created: ${new Date(rule.createdAt).toLocaleDateString()}
                                    ${rule.applied ? '<span style="color: #10b981;"> ✓ Applied</span>' : '<span style="color: #f59e0b;"> ⏳ Pending</span>'}
                                </small>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button onclick="editRule('${rule._id}')" class="rule-action-btn rule-edit-btn">
                                    ✏️ Edit
                                </button>
                                <button onclick="deleteRule('${rule._id}')" class="rule-action-btn rule-delete-btn">
                                    🗑️ Delete
                                </button>
                            </div>
                        </div>
                    </div>
                    `;
                }).join('');
            }
        } catch (error) {
            console.error('Error loading rules:', error);
            await showAlert('Error loading rules', 'Error');
        }
    }

    async function editRule(ruleId) {
        try {
            const response = await fetchWithAuth('/training-rules');
            const data = await response.json();
            const rule = data.rules.find(r => r._id === ruleId);

            if (rule) {
                closeSavedRulesModal();
                openTrainingModal();

                document.getElementById('ruleTitle').value = rule.title;
                document.getElementById('ruleType').value = rule.type;
                document.getElementById('ruleDescription').value = rule.description;

                const saveBtn = document.querySelector('.save-btn');
                if (saveBtn) {
                    saveBtn.innerHTML = '✏️ Update Rule';
                    saveBtn.setAttribute('onclick', `updateRule('${ruleId}')`);
                }

                editingRuleId = ruleId;
            }
        } catch (error) {
            await showAlert('Error loading rule for editing', 'Error');
        }
    }

    async function updateRule(ruleId) {
        const title = document.getElementById('ruleTitle')?.value;
        const type = document.getElementById('ruleType')?.value;
        const description = document.getElementById('ruleDescription')?.value;

        if (!title || !description) {
            await showAlert('Please fill in all fields', 'Required Fields');
            return;
        }

        try {
            const response = await fetchWithAuth(`/training-rules/${ruleId}`, {
                method: 'PUT',
                body: JSON.stringify({ title, type, description })
            });

            if (response.ok) {
                resetTrainingForm();
                closeTrainingModal();
                await showAlert('Rule updated successfully!', 'Success');
                await viewSavedRules();
            }
        } catch (error) {
            await showAlert('Error updating rule: ' + error.message, 'Error');
        }
    }

    async function deleteRule(ruleId) {
        const confirmed = await showConfirm('Are you sure you want to delete this rule?', 'Delete Rule');
        if (!confirmed) return;

        try {
            const response = await fetchWithAuth(`/training-rules/${ruleId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await showAlert('Rule deleted successfully!', 'Success');
                await loadSavedRules();
            }
        } catch (error) {
            await showAlert('Error deleting rule: ' + error.message, 'Error');
        }
    }

    // ========================================
    // TIMERS E MONITORAMENTO
    // ========================================

    function startStatusMonitoring() {
        // Verificar status periodicamente
        STATE.statusCheckTimer = setInterval(checkConnectionStatus, CONFIG.STATUS_CHECK_INTERVAL);
    }

    function startAutoSave() {
        // Salvar mensagens periodicamente
        STATE.autoSaveTimer = setInterval(saveMessagesToCache, CONFIG.AUTO_SAVE_INTERVAL);
    }

    // ========================================
    // CLEANUP
    // ========================================

    function cleanup() {
        if (STATE.statusCheckTimer) {
            clearInterval(STATE.statusCheckTimer);
        }
        if (STATE.autoSaveTimer) {
            clearInterval(STATE.autoSaveTimer);
        }
        saveMessagesToCache();
    }

    // ========================================
    // INICIALIZAÇÃO
    // ========================================

    // Aguardar DOM carregar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Funções do Modal Help
    function openHelpModal() {
        document.getElementById('helpModal').style.display = 'block';
    }

    function closeHelpModal() {
        document.getElementById('helpModal').style.display = 'none';
    }

    // ========================================
    // SISTEMA DE CONVERSAS
    // ========================================

    async function loadConversations() {
        try {
            const response = await fetchWithAuth('/conversations');
            const data = await response.json();

            const listElement = document.getElementById('conversationsList');

            if (!data.conversations || data.conversations.length === 0) {
                listElement.innerHTML = `
                <div style="padding: 20px; text-align: center; opacity: 0.5;">
                    No conversations yet
                </div>
            `;
                return;
            }

            listElement.innerHTML = data.conversations.map(conv => {
                const date = new Date(conv.lastActivity).toLocaleDateString();
                const isActive = conv._id === STATE.currentConversationId;

                return `
                <div class="conversation-item ${isActive ? 'active' : ''}" 
                     onclick="loadConversation('${conv._id}')"
                     data-id="${conv._id}">
                    <div class="title">${conv.title}</div>
                    <div class="time">${date}</div>
                    <button class="conversation-delete" 
                            onclick="deleteConversation(event, '${conv._id}')">
                        Delete
                    </button>
                </div>
            `;
            }).join('');

        } catch (error) {
            console.error('Error loading conversations:', error);
        }
    }

    async function createNewConversation() {
        try {
            const response = await fetchWithAuth('/conversations', {
                method: 'POST',
                body: JSON.stringify({
                    title: 'New Chat' // Título temporário simples
                })
            });

            const data = await response.json();

            if (data.success) {
                STATE.currentConversationId = data.conversation._id;

                // Limpar mensagens
                document.getElementById('messagesContainer').innerHTML = '';
                STATE.messageHistory = [];

                // Recarregar lista
                await loadConversations();

                // Mostrar welcome
                showWelcomeMessage();
            }

        } catch (error) {
            console.error('Error creating conversation:', error);
            await showAlert('Error creating new conversation', 'Error');
        }
    }

    async function loadConversation(conversationId) {
        try {
            const response = await fetchWithAuth(`/conversations/${conversationId}`);
            const data = await response.json();

            if (data.success) {
                STATE.currentConversationId = conversationId;

                // Limpar e recarregar mensagens
                const container = document.getElementById('messagesContainer');
                container.innerHTML = '';
                STATE.messageHistory = [];

                // Adicionar mensagens da conversa
                if (data.conversation.messages) {
                    data.conversation.messages.forEach(msg => {
                        addMessage(msg.content, msg.role);
                    });
                }

                // Atualizar sidebar
                await loadConversations();
            }

        } catch (error) {
            console.error('Error loading conversation:', error);
            await showAlert('Error loading conversation', 'Error');
        }
    }

    async function deleteConversation(event, conversationId) {
        event.stopPropagation(); // Evitar abrir a conversa

        const confirmed = await showConfirm('Delete this conversation?', 'Delete');
        if (!confirmed) return;

        try {
            const response = await fetchWithAuth(`/conversations/${conversationId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                // Se deletou a conversa atual, criar nova
                if (conversationId === STATE.currentConversationId) {
                    STATE.currentConversationId = null;
                    await createNewConversation();
                } else {
                    await loadConversations();
                }
            }
        } catch (error) {
            console.error('Error deleting conversation:', error);
            await showAlert('Error deleting conversation', 'Error');
        }
    }

    // Cleanup ao sair
    window.addEventListener('beforeunload', cleanup);

    // Exportar funções globais necessárias
    window.openHelpModal = openHelpModal;
    window.closeHelpModal = closeHelpModal;
    window.loadConversation = loadConversation;
    window.createNewConversation = createNewConversation;
    window.deleteConversation = deleteConversation;  // ← ADICIONE ESTA LINHA
    window.askQuestion = askQuestion;
    window.logout = logout;
    window.clearChat = clearChat;

    // Training modal functions
    window.openTrainingModal = openTrainingModal;
    window.closeTrainingModal = closeTrainingModal;
    window.closeSavedRulesModal = closeSavedRulesModal;
    window.saveTrainingRule = saveTrainingRule;
    window.viewSavedRules = viewSavedRules;
    window.loadSavedRules = loadSavedRules;
    window.editRule = editRule;
    window.updateRule = updateRule;
    window.deleteRule = deleteRule;
    window.resetTrainingForm = resetTrainingForm;

})();