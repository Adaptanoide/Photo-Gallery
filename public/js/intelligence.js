// public/js/intelligence.js

let currentTheme = 'light';

async function sendQuestion() {
    const input = document.getElementById('questionInput');
    const question = input.value.trim();

    if (!question) return;

    // Adicionar mensagem do usuário
    addMessage(question, 'user');
    input.value = '';

    // Mostrar typing indicator
    const typingId = showTyping();

    try {
        const response = await fetch('/api/intelligence/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question })
        });

        const data = await response.json();
        removeTyping(typingId);
        addMessage(data.response, 'assistant');

    } catch (error) {
        removeTyping(typingId);
        addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
    }
}

function addMessage(text, type) {
    const container = document.getElementById('messagesContainer');
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
}

function handleEnter(event) {
    if (event.key === 'Enter') {
        sendQuestion();
    }
}

function askQuestion(button) {
    const question = button.textContent.trim();
    document.getElementById('questionInput').value = question;
    sendQuestion();
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.querySelector('.theme-toggle').textContent =
        currentTheme === 'light' ? '🌙' : '☀️';
}

// Carregar métricas ao iniciar
async function loadMetrics() {
    try {
        const response = await fetch('/api/intelligence/metrics');
        const data = await response.json();

        // Verificar se os elementos existem antes de atualizar
        const totalInventoryEl = document.getElementById('totalInventory');
        const inTransitEl = document.getElementById('inTransit');
        const avgVelocityEl = document.getElementById('avgVelocity');
        const monthSalesEl = document.getElementById('monthSales');

        // Só atualizar se os elementos existirem (não temos mais eles no HTML)
        if (totalInventoryEl) totalInventoryEl.textContent = data.totalInventory || '--';
        if (inTransitEl) inTransitEl.textContent = data.inTransit || '--';
        if (avgVelocityEl) avgVelocityEl.textContent = data.avgVelocity || '--';
        if (monthSalesEl) monthSalesEl.textContent = data.monthSales || '--';

    } catch (error) {
        // Silenciar erro se não encontrar métricas
        console.log('Metrics not available');
    }
}

function showTyping() {
    const container = document.getElementById('messagesContainer');
    const typing = document.createElement('div');
    typing.className = 'message assistant typing';
    typing.id = 'typing-' + Date.now();
    typing.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(typing);
    return typing.id;
}

function removeTyping(id) {
    const element = document.getElementById(id);
    if (element) element.remove();
}

// Upload de dados externos
async function uploadData() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        z-index: 1000;
        max-width: 400px;
    `;

    modal.innerHTML = `
        <h3 style="margin-top: 0; color: #333;">📊 Upload Data - Coming Soon</h3>
        <p style="color: #666; line-height: 1.6;">
            This feature is under development and will allow you to:
            • Import Excel/CSV files with pricing data
            • Upload QuickBooks exports
            • Add custom product information
            • Enhance AI training with historical data
        </p>
        <button onclick="this.parentElement.remove()" style="
            background: #2563eb;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            margin-top: 10px;
        ">Got it!</button>
    `;

    document.body.appendChild(modal);
}

// Export de relatórios
function exportReport() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        z-index: 1000;
        max-width: 400px;
    `;

    modal.innerHTML = `
        <h3 style="margin-top: 0; color: #333;">📈 Export Report - Coming Soon</h3>
        <p style="color: #666; line-height: 1.6;">
            This feature will generate professional reports including:
            • Inventory analysis with aging metrics
            • Sales trends and velocity reports
            • AI predictions and recommendations
            • Custom PDF/Excel formats
        </p>
        <button onclick="this.parentElement.remove()" style="
            background: #2563eb;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            margin-top: 10px;
        ">Got it!</button>
    `;

    document.body.appendChild(modal);
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    // loadMetrics();  // COMENTAR ou REMOVER esta linha
    // setInterval(loadMetrics, 30000); // COMENTAR ou REMOVER esta linha também
});