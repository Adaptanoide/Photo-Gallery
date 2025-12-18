// public/js/intelligence.js - VERSÃO CORRIGIDA - Fluxo de Conversas
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
        currentConversationId: null,
        // File attachment state
        attachedFile: null,      // { fileId, fileName, fileType, summary }
        isUploading: false
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

        // NÃO carregar mensagens do cache - cada conversa tem suas próprias mensagens
        // loadCachedMessages(); // REMOVIDO - era fonte de confusão

        setupEventListeners();
        startStatusMonitoring();
        startAutoSave();
        checkConnectionStatus();

        // Carregar lista de conversas existentes
        loadConversations();

        // ============================================
        // CORREÇÃO PRINCIPAL: NÃO criar conversa automaticamente
        // Apenas mostrar a tela de boas-vindas
        // ============================================
        showWelcomeMessage();

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
        // =====================
        // CDE Status
        // =====================
        const cdeElement = document.getElementById('cdeStatus');

        if (cdeElement) {
            if (data.services.cde === 'online') {
                cdeElement.className = 'status-indicator connected';
                cdeElement.textContent = 'CDE: Connected';

                if (data.performance) {
                    const hitRate = data.performance.cacheHitRate || 0;
                    cdeElement.title = `Cache Hit: ${hitRate}% | Avg: ${data.performance.avgResponseTime}ms`;
                }
            } else if (data.services.cde === 'offline') {
                cdeElement.className = 'status-indicator disabled';
                cdeElement.textContent = 'CDE: Offline';

                if (data.cache && data.cache.entries > 0) {
                    cdeElement.title = `Using cached data (${data.cache.entries} entries)`;
                }
            } else {
                cdeElement.className = 'status-indicator connecting';
                cdeElement.textContent = 'CDE: Connecting...';
            }
        }

        // =====================
        // Gallery Status (NOVO)
        // =====================
        const galleryElement = document.getElementById('galleryStatus');

        if (galleryElement) {
            if (data.services.gallery === 'online') {
                galleryElement.className = 'status-indicator connected';
                galleryElement.textContent = 'Gallery: Connected';
                galleryElement.title = 'MongoDB Gallery connected';
            } else if (data.services.gallery === 'offline') {
                galleryElement.className = 'status-indicator disabled';
                galleryElement.textContent = 'Gallery: Offline';
                galleryElement.title = 'Gallery database not available';
            } else {
                galleryElement.className = 'status-indicator connecting';
                galleryElement.textContent = 'Gallery: Connecting...';
            }
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

        // ============================================
        // CORREÇÃO: Criar conversa APENAS no primeiro prompt
        // ============================================
        if (!STATE.currentConversationId) {
            try {
                const convResponse = await fetchWithAuth('/conversations', {
                    method: 'POST',
                    body: JSON.stringify({
                        title: 'New Chat' // Título temporário, será atualizado pelo backend
                    })
                });

                const convData = await convResponse.json();

                if (convData.success) {
                    STATE.currentConversationId = convData.conversation._id;
                    console.log('📝 New conversation created:', STATE.currentConversationId);
                } else {
                    throw new Error('Failed to create conversation');
                }
            } catch (error) {
                console.error('Error creating conversation:', error);
                await showAlert('Error starting conversation. Please try again.', 'Error');
                input.disabled = false;
                if (sendBtn) sendBtn.disabled = false;
                return;
            }
        }

        // Limpar welcome message se ainda estiver visível
        const welcomeMsg = document.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }

        // Adicionar mensagem do usuário
        addMessage(question, 'user');
        input.value = '';

        // Mostrar typing
        const typingId = showTyping();

        try {
            const startTime = Date.now();

            // Incluir fileId se houver arquivo anexado
            const requestBody = {
                question,
                conversationId: STATE.currentConversationId
            };

            if (STATE.attachedFile) {
                requestBody.fileId = STATE.attachedFile.fileId;
                console.log('📎 Sending with file:', STATE.attachedFile.fileName);
            }

            const response = await fetchWithAuth('/chat', {
                method: 'POST',
                body: JSON.stringify(requestBody)
            });

            // Limpar arquivo após enviar
            if (STATE.attachedFile) {
                clearAttachedFile();
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to get response');
            }

            const data = await response.json();

            // Atualizar conversationId se retornado
            if (data.conversationId) {
                STATE.currentConversationId = data.conversationId;
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

    // ========================================
    // GESTÃO DE ARQUIVOS ANEXADOS
    // ========================================

    async function uploadFile(file) {
        if (STATE.isUploading) return;

        STATE.isUploading = true;
        showFileUploadProgress(file.name);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const token = localStorage.getItem(CONFIG.TOKEN_KEY);
            const response = await fetch(`${CONFIG.API_BASE}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Upload failed');
            }

            // Salvar referência do arquivo
            STATE.attachedFile = {
                fileId: data.fileId,
                fileName: data.fileName,
                fileType: data.fileType,
                summary: data.summary
            };

            showAttachedFileIndicator();
            console.log('📎 File attached:', STATE.attachedFile);

        } catch (error) {
            console.error('Upload error:', error);
            await showAlert(`Error uploading file: ${error.message}`, 'Upload Error');
        } finally {
            STATE.isUploading = false;
            hideFileUploadProgress();
        }
    }

    function showFileUploadProgress(fileName) {
        const indicator = document.getElementById('fileUploadIndicator');
        if (indicator) {
            indicator.innerHTML = `
                <span class="file-upload-spinner"></span>
                <span>Uploading ${fileName}...</span>
            `;
            indicator.style.display = 'flex';
        }
    }

    function hideFileUploadProgress() {
        const indicator = document.getElementById('fileUploadIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    function showAttachedFileIndicator() {
        if (!STATE.attachedFile) return;

        const indicator = document.getElementById('fileUploadIndicator');
        if (indicator) {
            const icon = getFileIcon(STATE.attachedFile.fileType);
            indicator.innerHTML = `
                <span class="attached-file-icon">${icon}</span>
                <span class="attached-file-name">${STATE.attachedFile.fileName}</span>
                <button class="attached-file-remove" onclick="window.clearAttachedFile()" title="Remove file">&times;</button>
            `;
            indicator.style.display = 'flex';
            indicator.classList.add('has-file');
        }
    }

    function clearAttachedFile() {
        STATE.attachedFile = null;
        const indicator = document.getElementById('fileUploadIndicator');
        if (indicator) {
            indicator.style.display = 'none';
            indicator.classList.remove('has-file');
            indicator.innerHTML = '';
        }
        // Limpar input file
        const fileInput = document.getElementById('fileInput');
        if (fileInput) fileInput.value = '';
    }

    function getFileIcon(fileType) {
        const icons = {
            'pdf': '📄',
            'excel': '📊',
            'csv': '📋',
            'text': '📝'
        };
        return icons[fileType] || '📎';
    }

    function triggerFileUpload() {
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.click();
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

        // Atualizar visibilidade da sticky bar
        updateStickyVisibility();
    }

    function formatMessage(text) {
        // Escape HTML first (security)
        let formatted = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Parse markdown-style formatting
        // Bold: **text** or __text__
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/__([^_]+)__/g, '<strong>$1</strong>');

        // Italic: *text* or _text_ (but not inside words)
        formatted = formatted.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '<em>$1</em>');
        formatted = formatted.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>');

        // Code: `text`
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Detect and format sections (lines ending with :)
        formatted = formatted.replace(/^([A-Za-z][^:\n]{2,30}):$/gm, '<div class="msg-section-title">$1</div>');

        // Convert bullet points to proper list items
        // First, find groups of bullet lines and wrap them
        formatted = formatted.replace(/((?:^[•\-\*]\s.+$\n?)+)/gm, (match) => {
            const items = match.trim().split('\n').map(line => {
                const content = line.replace(/^[•\-\*]\s*/, '');
                return `<li>${content}</li>`;
            }).join('');
            return `<ul class="msg-list">${items}</ul>`;
        });

        // Convert numbered lists (1. 2. 3.)
        formatted = formatted.replace(/((?:^\d+[\.\)]\s.+$\n?)+)/gm, (match) => {
            const items = match.trim().split('\n').map(line => {
                const content = line.replace(/^\d+[\.\)]\s*/, '');
                return `<li>${content}</li>`;
            }).join('');
            return `<ol class="msg-list">${items}</ol>`;
        });

        // Highlight numbers with currency or percentages
        formatted = formatted.replace(/(\$[\d,]+(?:\.\d{2})?(?:K|M|B)?)/g, '<span class="msg-number">$1</span>');
        formatted = formatted.replace(/(\d+(?:,\d{3})*(?:\.\d+)?%)/g, '<span class="msg-percent">$1</span>');
        formatted = formatted.replace(/(\d{1,3}(?:,\d{3})+)/g, '<span class="msg-number">$1</span>');

        // Convert remaining newlines to breaks (but not inside lists)
        formatted = formatted.replace(/\n(?![<])/g, '<br>');

        // Clean up extra breaks
        formatted = formatted.replace(/<br><br><br>/g, '<br><br>');
        formatted = formatted.replace(/<br>(<ul|<ol|<div class="msg-section)/g, '$1');
        formatted = formatted.replace(/(<\/ul>|<\/ol>|<\/div>)<br>/g, '$1');

        return formatted;
    }

    // Typing indicator messages - sequential, stops at last one
    const TYPING_MESSAGES = [
        { text: 'Processing your question...', icon: '💭' },
        { text: 'Analyzing context...', icon: '🔍' },
        { text: 'Gathering data...', icon: '📊' },
        { text: 'Querying the database...', icon: '🗄️' }
    ];

    let typingMessageIndex = 0;
    let typingInterval = null;

    function showTyping() {
        const container = document.getElementById('messagesContainer');
        const typing = document.createElement('div');
        typing.className = 'message assistant typing';
        typing.id = 'typing-' + Date.now();

        typingMessageIndex = 0;
        const firstMsg = TYPING_MESSAGES[0];

        typing.innerHTML = `
            <div class="typing-content">
                <div class="typing-spinner"></div>
                <div class="typing-info">
                    <span class="typing-icon">${firstMsg.icon}</span>
                    <span class="typing-text">${firstMsg.text}</span>
                </div>
            </div>
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
        `;

        container.appendChild(typing);
        smoothScrollToBottom();
        STATE.currentTypingId = typing.id;

        // Advance messages every 4 seconds, stop at last one
        typingInterval = setInterval(() => {
            // Stop if we're at the last message
            if (typingMessageIndex >= TYPING_MESSAGES.length - 1) {
                clearInterval(typingInterval);
                typingInterval = null;
                return;
            }

            typingMessageIndex++;
            const msg = TYPING_MESSAGES[typingMessageIndex];
            const iconEl = typing.querySelector('.typing-icon');
            const textEl = typing.querySelector('.typing-text');

            if (iconEl && textEl) {
                // Fade out
                iconEl.style.opacity = '0';
                textEl.style.opacity = '0';

                setTimeout(() => {
                    iconEl.textContent = msg.icon;
                    textEl.textContent = msg.text;
                    // Fade in
                    iconEl.style.opacity = '1';
                    textEl.style.opacity = '1';
                }, 200);
            }
        }, 4000);

        return typing.id;
    }

    function removeTyping(id) {
        // Clear the rotating messages interval
        if (typingInterval) {
            clearInterval(typingInterval);
            typingInterval = null;
        }

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

        // Fechar dropdowns (welcome e sticky)
        closeAllDropdowns();
        closeStickyDropdown();

        // Auto-enviar após pequeno delay
        setTimeout(sendMessage, 100);
    }

    function toggleCategory(button) {
        const category = button.parentElement;
        const dropdown = category.querySelector('.category-dropdown');
        const wasOpen = dropdown.classList.contains('show');

        // Fechar todos os outros dropdowns
        closeAllDropdowns();

        // Toggle do dropdown atual
        if (!wasOpen) {
            dropdown.classList.add('show');
            button.classList.add('active');
        }
    }

    function closeAllDropdowns() {
        document.querySelectorAll('.category-dropdown').forEach(d => d.classList.remove('show'));
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    }

    // Fechar dropdowns ao clicar fora
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.suggestion-category')) {
            closeAllDropdowns();
        }
        // Também fechar sticky dropdown se clicar fora
        if (!e.target.closest('.sticky-suggestions')) {
            closeStickyDropdown();
        }
    });

    // ========================================
    // STICKY SUGGESTIONS BAR
    // ========================================

    const STICKY_QUESTIONS = {
        inventory: [
            "What's the current inventory status?",
            "Show aging products (60+ days)",
            "What products are in transit?",
            "Show inventory by category",
            "What's the stock projection?",
            "Show low stock alerts",
            "Products arriving this week"
        ],
        sales: [
            "What are the top selling products?",
            "Show sales by channel",
            "What's the sales velocity?",
            "Compare this month vs last month",
            "Show daily sales performance",
            "Best sellers this week",
            "Slow moving products"
        ],
        revenue: [
            "What's the total revenue this year?",
            "Who are the top customers by revenue?",
            "Compare 2024 vs 2023 revenue",
            "What are the best selling months?",
            "Show revenue trends",
            "Average order value",
            "Revenue by product category"
        ],
        clients: [
            "Show client summary",
            "Who are the VIP clients?",
            "Show inactive clients (30+ days)",
            "New clients this month",
            "Clients with pending orders",
            "Top buyers last 90 days",
            "Client retention rate"
        ],
        purchasing: [
            "What needs restocking?",
            "Show critical stock alerts",
            "What should we order from Brazil?",
            "What should we order from Colombia?",
            "Show lead time analysis",
            "Pending supplier orders",
            "Reorder recommendations"
        ],
        analytics: [
            "Show business dashboard",
            "Performance overview",
            "Sales vs inventory trends",
            "Channel comparison report",
            "Year-over-year growth",
            "Product profitability",
            "Seasonal patterns"
        ],
        gallery: [
            "Show gallery summary",
            "Photos by category",
            "What's reserved?",
            "Show active carts",
            "Coming soon items",
            "Recently added photos",
            "Photos pending approval"
        ]
    };

    function toggleStickyCategory(button) {
        const category = button.dataset.category;
        const wrapper = button.parentElement;
        const dropdown = wrapper.querySelector('.sticky-dropdown');
        const wasActive = button.classList.contains('active');

        // Fechar todos os dropdowns primeiro
        closeStickyDropdown();

        if (!wasActive) {
            // Abrir dropdown com as perguntas da categoria
            button.classList.add('active');
            const questions = STICKY_QUESTIONS[category] || [];

            dropdown.innerHTML = questions.map(q =>
                `<button class="suggestion-item" onclick="askQuestion(this)">${q}</button>`
            ).join('');

            dropdown.classList.add('show');
        }
    }

    function closeStickyDropdown() {
        document.querySelectorAll('.sticky-dropdown').forEach(d => {
            d.classList.remove('show');
            d.innerHTML = '';
        });
        document.querySelectorAll('.sticky-cat-btn').forEach(b => b.classList.remove('active'));
    }

    function updateStickyVisibility() {
        const stickyBar = document.getElementById('stickySuggestions');
        const welcomeMessage = document.querySelector('.welcome-message');

        if (!stickyBar) return;

        // Mostrar sticky bar quando a welcome message não está visível
        // (ou seja, quando há uma conversa ativa)
        if (!welcomeMessage && STATE.messageHistory.length > 0) {
            stickyBar.classList.add('visible');
        } else {
            stickyBar.classList.remove('visible');
            closeStickyDropdown();
        }
    }

    // Função helper para limpar container de mensagens
    function clearMessagesContainer() {
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '';
    }

    // Exportar para window
    window.toggleStickyCategory = toggleStickyCategory;

    function showWelcomeMessage() {
        const container = document.getElementById('messagesContainer');

        // Sempre mostrar welcome se não tem conversa ativa
        if (!STATE.currentConversationId || STATE.messageHistory.length === 0) {
            const welcomeHTML = `
                <div class="welcome-message">
                    <h3>Welcome to Sunshine Intelligence!</h3>
                    <p>I can help you analyze inventory and optimize your business.</p>

                    <!-- Menu de Sugestões por Categoria -->
                    <div class="suggestions-menu">
                        <!-- Inventory -->
                        <div class="suggestion-category">
                            <button class="category-btn" onclick="toggleCategory(this)">
                                <span class="category-icon">📦</span>
                                <span class="category-name">Inventory</span>
                                <span class="category-arrow">▼</span>
                            </button>
                            <div class="category-dropdown">
                                <button class="suggestion-item" onclick="askQuestion(this)">What's the current inventory status?</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Show aging products (60+ days)</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">What products are in transit?</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Show inventory by category</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">What's the stock projection?</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Show low stock alerts</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Products arriving this week</button>
                            </div>
                        </div>

                        <!-- Sales -->
                        <div class="suggestion-category">
                            <button class="category-btn" onclick="toggleCategory(this)">
                                <span class="category-icon">📈</span>
                                <span class="category-name">Sales</span>
                                <span class="category-arrow">▼</span>
                            </button>
                            <div class="category-dropdown">
                                <button class="suggestion-item" onclick="askQuestion(this)">What are the top selling products?</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Show sales by channel</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">What's the sales velocity?</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Compare this month vs last month</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Show daily sales performance</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Best sellers this week</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Slow moving products</button>
                            </div>
                        </div>

                        <!-- Revenue -->
                        <div class="suggestion-category">
                            <button class="category-btn" onclick="toggleCategory(this)">
                                <span class="category-icon">💰</span>
                                <span class="category-name">Revenue</span>
                                <span class="category-arrow">▼</span>
                            </button>
                            <div class="category-dropdown">
                                <button class="suggestion-item" onclick="askQuestion(this)">What's the total revenue this year?</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Who are the top customers by revenue?</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Compare 2024 vs 2023 revenue</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">What are the best selling months?</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Show revenue trends</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Average order value</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Revenue by product category</button>
                            </div>
                        </div>

                        <!-- Clients -->
                        <div class="suggestion-category">
                            <button class="category-btn" onclick="toggleCategory(this)">
                                <span class="category-icon">👥</span>
                                <span class="category-name">Clients</span>
                                <span class="category-arrow">▼</span>
                            </button>
                            <div class="category-dropdown">
                                <button class="suggestion-item" onclick="askQuestion(this)">Show client summary</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Who are the VIP clients?</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Show inactive clients (30+ days)</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">New clients this month</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Clients with pending orders</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Top buyers last 90 days</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Client retention rate</button>
                            </div>
                        </div>

                        <!-- Purchasing -->
                        <div class="suggestion-category">
                            <button class="category-btn" onclick="toggleCategory(this)">
                                <span class="category-icon">🛒</span>
                                <span class="category-name">Purchasing</span>
                                <span class="category-arrow">▼</span>
                            </button>
                            <div class="category-dropdown">
                                <button class="suggestion-item" onclick="askQuestion(this)">What needs restocking?</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Show critical stock alerts</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">What should we order from Brazil?</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">What should we order from Colombia?</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Show lead time analysis</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Pending supplier orders</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Reorder recommendations</button>
                            </div>
                        </div>

                        <!-- Analytics -->
                        <div class="suggestion-category">
                            <button class="category-btn" onclick="toggleCategory(this)">
                                <span class="category-icon">📊</span>
                                <span class="category-name">Analytics</span>
                                <span class="category-arrow">▼</span>
                            </button>
                            <div class="category-dropdown">
                                <button class="suggestion-item" onclick="askQuestion(this)">Show business dashboard</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Performance overview</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Sales vs inventory trends</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Channel comparison report</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Year-over-year growth</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Product profitability</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Seasonal patterns</button>
                            </div>
                        </div>

                        <!-- Gallery -->
                        <div class="suggestion-category">
                            <button class="category-btn" onclick="toggleCategory(this)">
                                <span class="category-icon">📸</span>
                                <span class="category-name">Gallery</span>
                                <span class="category-arrow">▼</span>
                            </button>
                            <div class="category-dropdown">
                                <button class="suggestion-item" onclick="askQuestion(this)">Show gallery summary</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Photos by category</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">What's reserved?</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Show active carts</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Coming soon items</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Recently added photos</button>
                                <button class="suggestion-item" onclick="askQuestion(this)">Photos pending approval</button>
                            </div>
                        </div>
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
        // NOTA: Esta função foi simplificada
        // As mensagens agora vêm das conversas salvas no MongoDB
        // O cache local é apenas para backup temporário
        try {
            const cached = localStorage.getItem(CONFIG.MESSAGES_KEY);
            if (cached) {
                const messages = JSON.parse(cached);
                // Apenas restaurar se tiver uma conversa ativa
                if (STATE.currentConversationId && messages.length > 0) {
                    STATE.messageHistory = messages;
                    console.log(`📦 Restored ${messages.length} messages from local cache`);
                }
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
        STATE.currentConversationId = null;
        localStorage.removeItem(CONFIG.MESSAGES_KEY);
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '';
        showWelcomeMessage();
        loadConversations(); // Atualizar sidebar
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

        // File input
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    uploadFile(file);
                }
            });
        }

        // Attach button
        const attachBtn = document.querySelector('.attach-btn');
        if (attachBtn) {
            attachBtn.addEventListener('click', triggerFileUpload);
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

    // ============================================
    // CORREÇÃO: createNewConversation agora é usado
    // apenas pelo botão "New Chat" e limpa a tela
    // ============================================
    async function createNewConversation() {
        // Limpar estado atual
        STATE.currentConversationId = null;
        STATE.messageHistory = [];

        // Limpar container de mensagens (mantém sticky bar)
        clearMessagesContainer();

        // Mostrar welcome
        showWelcomeMessage();

        // Esconder sticky bar (não há conversa)
        updateStickyVisibility();

        // Atualizar sidebar (remover seleção ativa)
        await loadConversations();

        // Focar no input
        const input = document.getElementById('chatInput');
        if (input) {
            input.value = '';
            input.focus();
        }

        console.log('🆕 Ready for new conversation');
    }

    async function loadConversation(conversationId) {
        try {
            const response = await fetchWithAuth(`/conversations/${conversationId}`);
            const data = await response.json();

            if (data.success) {
                STATE.currentConversationId = conversationId;

                // Limpar e recarregar mensagens (mantém sticky bar)
                clearMessagesContainer();
                STATE.messageHistory = [];

                // Adicionar mensagens da conversa
                if (data.conversation.messages && data.conversation.messages.length > 0) {
                    data.conversation.messages.forEach(msg => {
                        addMessage(msg.content, msg.role);
                    });
                } else {
                    // Se conversa sem mensagens, mostrar welcome
                    showWelcomeMessage();
                }

                // Atualizar sticky bar
                updateStickyVisibility();

                // Atualizar sidebar
                await loadConversations();

                // Scroll para o final
                smoothScrollToBottom();
            }

        } catch (error) {
            console.error('Error loading conversation:', error);
            await showAlert('Error loading conversation', 'Error');
        }
    }

    // ============================================
    // CORREÇÃO: deleteConversation NÃO cria nova conversa
    // automaticamente - apenas mostra o welcome
    // ============================================
    async function deleteConversation(event, conversationId) {
        event.stopPropagation(); // Evitar abrir a conversa

        const confirmed = await showConfirm('Delete this conversation?', 'Delete');
        if (!confirmed) return;

        try {
            const response = await fetchWithAuth(`/conversations/${conversationId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                // Se deletou a conversa atual, voltar para o estado inicial
                if (conversationId === STATE.currentConversationId) {
                    STATE.currentConversationId = null;
                    STATE.messageHistory = [];
                    clearMessagesContainer();
                    showWelcomeMessage();
                    updateStickyVisibility();
                }

                // Atualizar lista de conversas
                await loadConversations();
            }
        } catch (error) {
            console.error('Error deleting conversation:', error);
            await showAlert('Error deleting conversation', 'Error');
        }
    }

    // Cleanup ao sair
    window.addEventListener('beforeunload', cleanup);

    // ========================================
    // DASHBOARD FUNCTIONS - V2 PROFESSIONAL
    // ========================================

    let currentView = 'chat';
    let dashboardData = null;
    let dashboardRefreshInterval = null;
    let salesTrendChart = null;
    let categoryPieChart = null;
    let marketplaceChart = null;
    let agingChart = null;
    let topProductsChart = null;

    function switchView(view) {
        currentView = view;

        // Update tab states
        document.querySelectorAll('.view-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === view);
        });

        // Toggle view visibility
        const chatElements = [
            document.getElementById('stickySuggestions'),
            document.getElementById('messagesContainer'),
            document.getElementById('fileUploadIndicator'),
            document.querySelector('.input-container')
        ];

        const dashboardView = document.getElementById('dashboardView');

        if (view === 'dashboard') {
            chatElements.forEach(el => { if (el) el.style.display = 'none'; });
            if (dashboardView) {
                dashboardView.style.display = 'block';
                loadDashboardData();
            }
        } else {
            chatElements.forEach(el => {
                if (el) {
                    if (el.classList.contains('input-container')) {
                        el.style.display = 'flex';
                    } else if (el.id === 'fileUploadIndicator') {
                        // Keep hidden unless file attached
                    } else {
                        el.style.display = '';
                    }
                }
            });
            if (dashboardView) dashboardView.style.display = 'none';
        }

        console.log(`📊 Switched to ${view} view`);
    }

    async function loadDashboardData() {
        try {
            updateAgentMessage('Analyzing your business data...');
            updateAgentState('analyzing');

            const response = await fetchWithAuth('/dashboard');
            const data = await response.json();

            if (data.success) {
                dashboardData = data;
                renderDashboard(data);
                updateAgentMessage(data.agentMessage || 'Analysis complete. Here are your latest insights.');
                updateAgentState('active');
            } else {
                throw new Error(data.error || 'Failed to load dashboard');
            }
        } catch (error) {
            console.error('Dashboard error:', error);
            updateAgentMessage('Unable to load dashboard data. Please try again.');
            updateAgentState('error');
        }
    }

    function renderDashboard(data) {
        // ========== Update KPIs (5 cards) ==========
        updateKPI('kpiInventoryValue', formatNumber(data.kpis?.inventory || 0));
        updateKPI('kpiInventoryItems', `${data.kpis?.inventoryItems || 0} categories`);

        updateKPI('kpiInventoryValueTotal', formatCurrency(data.kpis?.inventoryValue || 0));
        updateKPI('kpiAvgPrice', `Avg: $${(data.kpis?.avgPrice || 0).toFixed(2)}/unit`);

        updateKPI('kpiSalesValue', formatCurrency(data.kpis?.monthlySales || 0));
        const trendEl = document.getElementById('kpiSalesTrend');
        if (trendEl) {
            const trend = data.kpis?.salesTrend || 0;
            trendEl.className = `kpi-trend ${trend >= 0 ? 'up' : 'down'}`;
            trendEl.textContent = `${trend >= 0 ? '▲' : '▼'} ${Math.abs(trend)}% vs last month`;
        }

        updateKPI('kpiTransitValue', formatNumber(data.kpis?.inTransit || 0));
        updateKPI('kpiTransitEta', `ETA: ${data.kpis?.transitEta || '--'}`);

        updateKPI('kpiAgingValue', data.kpis?.aging || 0);
        updateKPI('kpiAgingPercent', `${data.kpis?.agingPercent || 0}% of inventory`);

        // ========== Render All Charts ==========
        renderSalesTrendChart(data.charts?.salesTrend || []);
        renderCategoryPieChart(data.charts?.categoryDistribution || []);
        renderMarketplaceChart(data.charts?.marketplaceChart || []);
        renderAgingChart(data.charts?.agingDistribution || []);
        renderTopProductsBarChart(data.charts?.topProductsChart || []);

        // ========== Render Alerts ==========
        renderAlerts(data.alerts?.items || []);
        updateKPI('alertsCriticalCount', data.alerts?.criticalCount || 0);
        updateKPI('alertsWarningCount', data.alerts?.warningCount || 0);

        // ========== Render Suppliers ==========
        renderSuppliers(data.suppliers || []);

        // ========== Render Stock Health ==========
        renderStockHealth(data.stockHealth || {});

        // ========== Render Price Analysis ==========
        renderPriceAnalysis(data.priceAnalysis || {});

        // ========== Render Top Products ==========
        renderTopProducts(data.topProducts || []);

        // ========== Render Top Customers ==========
        renderTopCustomers(data.topCustomers || []);

        // ========== Render Insights ==========
        renderInsights(data.insights || []);

        // ========== Update Last Update Time ==========
        const lastUpdate = document.getElementById('dashboardLastUpdate');
        if (lastUpdate) {
            lastUpdate.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
        }
    }

    // ========== CHART RENDERING ==========

    function renderSalesTrendChart(salesData) {
        const ctx = document.getElementById('salesTrendChart');
        if (!ctx) return;

        // Destroy existing chart
        if (salesTrendChart) {
            salesTrendChart.destroy();
        }

        const labels = salesData.map(d => d.month);
        const salesValues = salesData.map(d => d.sales);
        const unitsValues = salesData.map(d => d.units);

        salesTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Revenue ($)',
                        data: salesValues,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Units Sold',
                        data: unitsValues,
                        borderColor: '#6366f1',
                        backgroundColor: 'transparent',
                        borderDash: [5, 5],
                        tension: 0.4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#9ca3af', font: { size: 11 } }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#9ca3af' }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: {
                            color: '#9ca3af',
                            callback: (v) => '$' + (v / 1000) + 'K'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { color: '#6366f1' }
                    }
                }
            }
        });
    }

    function renderCategoryPieChart(categoryData) {
        const ctx = document.getElementById('categoryPieChart');
        if (!ctx) return;

        // Destroy existing chart
        if (categoryPieChart) {
            categoryPieChart.destroy();
        }

        const labels = categoryData.map(d => d.name);
        const values = categoryData.map(d => d.value);
        const colors = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];

        categoryPieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: '#1a1a2e',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#9ca3af',
                            font: { size: 11 },
                            padding: 15,
                            usePointStyle: true
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }

    function renderMarketplaceChart(marketplaceData) {
        const ctx = document.getElementById('marketplaceChart');
        if (!ctx) return;

        if (marketplaceChart) {
            marketplaceChart.destroy();
        }

        const labels = marketplaceData.map(d => d.name);
        const values = marketplaceData.map(d => d.revenue);
        const colors = marketplaceData.map(d => d.color);

        marketplaceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Revenue ($)',
                    data: values,
                    backgroundColor: colors,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: {
                            color: '#9ca3af',
                            callback: (v) => '$' + (v / 1000) + 'K'
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#e5e7eb', font: { weight: 500 } }
                    }
                }
            }
        });
    }

    function renderAgingChart(agingData) {
        const ctx = document.getElementById('agingChart');
        if (!ctx) return;

        if (agingChart) {
            agingChart.destroy();
        }

        const labels = agingData.map(d => d.range);
        const values = agingData.map(d => d.count);
        const colors = agingData.map(d => d.color);

        agingChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Units',
                    data: values,
                    backgroundColor: colors,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#9ca3af' }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#9ca3af' }
                    }
                }
            }
        });
    }

    function renderTopProductsBarChart(productsData) {
        const ctx = document.getElementById('topProductsChart');
        if (!ctx) return;

        if (topProductsChart) {
            topProductsChart.destroy();
        }

        const labels = productsData.map(d => d.name);
        const values = productsData.map(d => d.revenue);

        topProductsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Revenue ($)',
                    data: values,
                    backgroundColor: 'rgba(99, 102, 241, 0.8)',
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: {
                            color: '#9ca3af',
                            callback: (v) => '$' + formatNumber(v)
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#9ca3af', font: { size: 10 } }
                    }
                }
            }
        });
    }

    function renderStockHealth(healthData) {
        const score = healthData.score || 0;
        updateKPI('healthScore', score + '%');

        // Update health score color based on value
        const scoreEl = document.getElementById('healthScore');
        if (scoreEl) {
            if (score >= 70) {
                scoreEl.style.color = '#10b981';
            } else if (score >= 50) {
                scoreEl.style.color = '#f59e0b';
            } else {
                scoreEl.style.color = '#ef4444';
            }
        }

        updateKPI('wellStockedCount', formatNumber(healthData.wellStocked || 0));
        updateKPI('lowStockCount', formatNumber(healthData.lowStock || 0));
        updateKPI('outOfStockCount', formatNumber(healthData.outOfStock || 0));
        updateKPI('needRestockCount', healthData.needRestock || 0);
    }

    // ========== COMPONENT RENDERING ==========

    function updateKPI(elementId, value) {
        const el = document.getElementById(elementId);
        if (el) el.textContent = value;
    }

    function formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toLocaleString();
    }

    function formatCurrency(num) {
        return '$' + formatNumber(num);
    }

    function renderAlerts(alerts) {
        const container = document.getElementById('alertsList');
        if (!container) return;

        if (alerts.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <div class="no-data-icon">✅</div>
                    <p>No active alerts</p>
                </div>
            `;
            return;
        }

        container.innerHTML = alerts.map(alert => `
            <div class="alert-item ${alert.severity || 'info'}">
                <div class="alert-icon">${getAlertIcon(alert.severity)}</div>
                <div class="alert-content">
                    <div class="alert-title">${alert.title}</div>
                    <div class="alert-description">${alert.description}</div>
                    <div class="alert-time">${alert.time || 'Just now'}</div>
                </div>
            </div>
        `).join('');
    }

    function getAlertIcon(severity) {
        const icons = {
            critical: '🚨',
            warning: '⚠️',
            info: '💡'
        };
        return icons[severity] || '🔔';
    }

    function renderSuppliers(suppliers) {
        const container = document.getElementById('suppliersList');
        if (!container) return;

        updateKPI('suppliersCount', suppliers.length);

        if (suppliers.length === 0) {
            container.innerHTML = '<div class="no-data"><p>No supplier data</p></div>';
            return;
        }

        container.innerHTML = suppliers.map(supplier => `
            <div class="supplier-item ${supplier.status}">
                <div class="supplier-flag">${supplier.country}</div>
                <div class="supplier-info">
                    <div class="supplier-name">${supplier.name}</div>
                    <div class="supplier-meta">
                        ${supplier.activeShipments > 0
                            ? `<span class="active">${supplier.activeShipments} active shipments</span>`
                            : '<span class="inactive">No active shipments</span>'}
                    </div>
                </div>
                <div class="supplier-stats">
                    <div class="stat-value">${supplier.totalUnitsInTransit}</div>
                    <div class="stat-label">units</div>
                </div>
            </div>
        `).join('');
    }

    function renderPriceAnalysis(priceData) {
        updateKPI('avgPrice', '$' + (priceData.avgPrice || 0).toFixed(2));
        updateKPI('inventoryValue', formatCurrency(priceData.inventoryValue || 0));
        updateKPI('avgOrderValue', '$' + (priceData.avgOrderValue || 0).toFixed(2));

        const container = document.getElementById('priceByCategory');
        if (!container || !priceData.byCategory) return;

        container.innerHTML = priceData.byCategory.slice(0, 4).map(cat => `
            <div class="price-category">
                <span class="cat-name">${cat.category}</span>
                <span class="cat-value">$${formatNumber(cat.totalValue)}</span>
            </div>
        `).join('');
    }

    function renderTopProducts(products) {
        const container = document.getElementById('topProductsList');
        if (!container) return;

        if (products.length === 0) {
            container.innerHTML = '<div class="no-data"><p>No product data available</p></div>';
            return;
        }

        container.innerHTML = products.slice(0, 8).map(product => `
            <div class="product-item">
                <div class="product-rank">${product.rank}</div>
                <div class="product-info">
                    <div class="product-name">${product.code}</div>
                    <div class="product-meta">${product.category}</div>
                </div>
                <div class="product-stats">
                    <div class="product-qty">${product.quantity} units</div>
                    <div class="product-trend ${product.trend}">
                        ${product.trend === 'up' ? '▲' : '▼'} ${product.change}%
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderTopCustomers(customers) {
        const container = document.getElementById('topCustomersList');
        if (!container) return;

        if (customers.length === 0) {
            container.innerHTML = '<div class="no-data"><p>No customer data</p></div>';
            return;
        }

        container.innerHTML = customers.slice(0, 6).map(customer => `
            <div class="customer-item">
                <div class="customer-rank">${customer.rank}</div>
                <div class="customer-info">
                    <div class="customer-name">${customer.name}</div>
                    <div class="customer-meta">${customer.orders} orders</div>
                </div>
                <div class="customer-revenue">$${formatNumber(customer.revenue)}</div>
            </div>
        `).join('');
    }

    function renderMarketplaces(marketplaces) {
        const container = document.getElementById('marketplacesList');
        if (!container) return;

        if (marketplaces.length === 0) {
            container.innerHTML = '<div class="no-data"><p>No marketplace data</p></div>';
            return;
        }

        container.innerHTML = marketplaces.map(mp => `
            <div class="marketplace-item">
                <div class="marketplace-header">
                    <span class="marketplace-icon">${mp.icon}</span>
                    <span class="marketplace-name">${mp.name}</span>
                    <span class="marketplace-trend ${mp.trend}">${mp.trend === 'up' ? '↑' : mp.trend === 'down' ? '↓' : '→'}</span>
                </div>
                <div class="marketplace-stats">
                    <span class="mp-revenue">$${formatNumber(mp.revenue)}</span>
                    <span class="mp-sales">${mp.sales} sales</span>
                </div>
                <div class="marketplace-bar">
                    <div class="bar-fill" style="width: ${mp.percentOfTotal}%"></div>
                </div>
                <div class="marketplace-percent">${mp.percentOfTotal}% of total</div>
            </div>
        `).join('');
    }

    function renderInsights(insights) {
        const container = document.getElementById('insightsList');
        if (!container) return;

        if (insights.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <div class="no-data-icon">🔍</div>
                    <p>Analyzing data for insights...</p>
                </div>
            `;
            return;
        }

        container.innerHTML = insights.map(insight => `
            <div class="insight-card ${insight.type || ''}">
                <div class="insight-icon">${insight.icon || '💡'}</div>
                <div class="insight-content">
                    <div class="insight-title">${insight.title || ''}</div>
                    <div class="insight-text">${insight.text}</div>
                    ${insight.action ? `
                        <button class="insight-action-btn" onclick="askAboutInsight('${insight.query}')">
                            ${insight.action} →
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    // ========== AGENT STATUS ==========

    function updateAgentMessage(message) {
        const el = document.getElementById('agentMessage');
        if (el) el.textContent = message;
    }

    function updateAgentState(state) {
        const el = document.getElementById('agentState');
        if (!el) return;

        const states = {
            active: { text: '● Active', class: 'active' },
            analyzing: { text: '◉ Analyzing...', class: 'analyzing' },
            error: { text: '○ Error', class: 'error' }
        };

        const s = states[state] || states.active;
        el.textContent = s.text;
        el.className = `agent-state ${s.class}`;
    }

    // ========== DASHBOARD ACTIONS ==========

    function refreshDashboard() {
        loadDashboardData();
    }

    function askAgentAboutAlerts() {
        switchView('chat');
        const input = document.getElementById('chatInput');
        if (input) {
            input.value = 'Tell me about the current alerts and what actions I should take.';
            sendMessage();
        }
    }

    function askAboutInsight(query) {
        switchView('chat');
        const input = document.getElementById('chatInput');
        if (input) {
            input.value = query;
            sendMessage();
        }
    }

    function updateTopProducts() {
        const filter = document.getElementById('topProductsFilter')?.value || 'quantity';
        // Reload with new filter - could add API param
        if (dashboardData) {
            renderTopProducts(dashboardData.topProducts || []);
        }
    }

    function markAllAlertsRead() {
        console.log('Marking all alerts as read');
        // Could add API call here
    }

    function toggleEmailAlerts() {
        const enabled = document.getElementById('emailAlertsToggle')?.checked;
        console.log('Email alerts:', enabled ? 'enabled' : 'disabled');
        // Could add API call here
    }

    function openAlertSettings() {
        console.log('Opening alert settings');
        // Could open modal here
    }

    function openAgentSettings() {
        console.log('Opening agent settings');
        // Could open modal here
    }

    function generateNewInsights() {
        updateAgentMessage('Generating new AI insights...');
        loadDashboardData();
    }

    // Exportar funções globais necessárias
    window.openHelpModal = openHelpModal;
    window.closeHelpModal = closeHelpModal;
    window.loadConversation = loadConversation;
    window.createNewConversation = createNewConversation;
    window.deleteConversation = deleteConversation;
    window.askQuestion = askQuestion;
    window.toggleCategory = toggleCategory;
    window.logout = logout;
    window.clearChat = clearChat;
    window.sendMessage = sendMessage;

    // File upload functions
    window.uploadFile = uploadFile;
    window.clearAttachedFile = clearAttachedFile;
    window.triggerFileUpload = triggerFileUpload;

    // Dashboard functions
    window.switchView = switchView;
    window.refreshDashboard = refreshDashboard;
    window.askAgentAboutAlerts = askAgentAboutAlerts;
    window.askAboutInsight = askAboutInsight;
    window.updateTopProducts = updateTopProducts;
    window.markAllAlertsRead = markAllAlertsRead;
    window.toggleEmailAlerts = toggleEmailAlerts;
    window.openAlertSettings = openAlertSettings;
    window.openAgentSettings = openAgentSettings;
    window.generateNewInsights = generateNewInsights;

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