// ========== CUSTOM ALERT/CONFIRM SYSTEM ==========
function customAlert(message, title = 'Sunshine AI') {
    return new Promise((resolve) => {
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

        overlay.querySelector('.custom-alert-btn-primary').onclick = () => {
            document.body.removeChild(overlay);
            resolve(true);
        };
    });
}

function customConfirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
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

// ========== CHAT FUNCTIONS ==========
async function sendMessage() {
    const input = document.getElementById('chatInput');
    const question = input.value.trim();

    if (!question) return;

    // Adicionar mensagem do usuário
    addMessage(question, 'user');

    // Limpar input
    input.value = '';

    // Mostrar typing
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

        // Remover typing
        removeTyping(typingId);

        // Adicionar resposta
        addMessage(data.response, 'assistant');

    } catch (error) {
        removeTyping(typingId);
        addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
    }
}

function addMessage(text, sender) {
    const container = document.getElementById('messagesContainer');
    const message = document.createElement('div');
    message.className = `message ${sender}`;
    message.innerHTML = text;
    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
}

function showTyping() {
    const container = document.getElementById('messagesContainer');
    const typing = document.createElement('div');
    typing.className = 'message assistant typing';
    typing.id = 'typing-' + Date.now();
    typing.innerHTML = '<span>•</span><span>•</span><span>•</span>';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
    return typing.id;
}

function removeTyping(id) {
    const typing = document.getElementById(id);
    if (typing) typing.remove();
}

function askQuestion(button) {
    const question = button.textContent.trim();
    document.getElementById('chatInput').value = question;
    sendMessage();
}

// ========== TRAINING MODAL FUNCTIONS ==========
let editingRuleId = null;

function openTrainingModal() {
    document.getElementById('trainingModal').style.display = 'block';
    resetForm();
}

function closeTrainingModal() {
    document.getElementById('trainingModal').style.display = 'none';
    resetForm();
}

function closeSavedRulesModal() {
    document.getElementById('savedRulesModal').style.display = 'none';
}

function resetForm() {
    document.getElementById('ruleTitle').value = '';
    document.getElementById('ruleType').value = 'restock';
    document.getElementById('ruleDescription').value = '';

    const saveBtn = document.querySelector('.save-btn');
    if (saveBtn) {
        saveBtn.innerHTML = '💾 Save Rule';
        saveBtn.setAttribute('onclick', 'saveTrainingRule()');
    }

    editingRuleId = null;
}

async function saveTrainingRule() {
    const title = document.getElementById('ruleTitle').value;
    const type = document.getElementById('ruleType').value;
    const description = document.getElementById('ruleDescription').value;

    if (!title || !description) {
        await customAlert('Please fill in all fields', 'Required Fields');
        return;
    }

    try {
        const response = await fetch('/api/intelligence/training-rules', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                type,
                description
            })
        });

        const data = await response.json();

        if (data.success) {
            resetForm();
            await customAlert('Rule saved successfully!', 'Success');

            // Se o modal de saved rules estiver aberto, atualizar
            if (document.getElementById('savedRulesModal').style.display === 'block') {
                await loadSavedRules();
            }
        }
    } catch (error) {
        await customAlert('Error saving rule: ' + error.message, 'Error');
    }
}

async function viewSavedRules() {
    // Abrir o modal de saved rules
    document.getElementById('savedRulesModal').style.display = 'block';
    await loadSavedRules();
}

async function loadSavedRules() {
    try {
        const response = await fetch('/api/intelligence/training-rules');
        const data = await response.json();

        const rulesList = document.getElementById('rulesList');

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
                                Created: ${new Date(rule.createdAt).toLocaleDateString()} at ${new Date(rule.createdAt).toLocaleTimeString()} 
                                ${rule.applied ? '<span style="color: #10b981;">✓ Applied</span>' : '<span style="color: #f59e0b;">⏳ Pending</span>'}
                            </small>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button onclick="editRule('${rule._id}')" class="rule-action-btn rule-edit-btn">
                                ✏️ Edit
                            </button>
                            <button onclick="deleteRule('${rule._id}')" class="rule-action-btn rule-delete-btn">
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                </div>
            `}).join('');
        }
    } catch (error) {
        console.error('Error loading rules:', error);
        await customAlert('Error loading rules', 'Error');
    }
}

async function editRule(ruleId) {
    try {
        const response = await fetch('/api/intelligence/training-rules');
        const data = await response.json();
        const rule = data.rules.find(r => r._id === ruleId);

        if (rule) {
            // Fechar modal de saved rules
            closeSavedRulesModal();

            // Abrir modal de training com dados
            openTrainingModal();

            // Preencher formulário
            document.getElementById('ruleTitle').value = rule.title;
            document.getElementById('ruleType').value = rule.type;
            document.getElementById('ruleDescription').value = rule.description;

            // Mudar botão para update
            const saveBtn = document.querySelector('.save-btn');
            saveBtn.innerHTML = '✏️ Update Rule';
            saveBtn.setAttribute('onclick', `updateRule('${ruleId}')`);

            editingRuleId = ruleId;
        }
    } catch (error) {
        console.error('Error editing rule:', error);
        await customAlert('Error loading rule for editing', 'Error');
    }
}

async function updateRule(ruleId) {
    const title = document.getElementById('ruleTitle').value;
    const type = document.getElementById('ruleType').value;
    const description = document.getElementById('ruleDescription').value;

    if (!title || !description) {
        await customAlert('Please fill in all fields', 'Required Fields');
        return;
    }

    try {
        const response = await fetch(`/api/intelligence/training-rules/${ruleId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                type,
                description
            })
        });

        const data = await response.json();

        if (data.success) {
            resetForm();
            closeTrainingModal();
            await customAlert('Rule updated successfully!', 'Success');

            // Reabrir saved rules e atualizar
            await viewSavedRules();
        }
    } catch (error) {
        await customAlert('Error updating rule: ' + error.message, 'Error');
    }
}

async function deleteRule(ruleId) {
    const confirmed = await customConfirm('Are you sure you want to delete this rule?', 'Delete Rule');
    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`/api/intelligence/training-rules/${ruleId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            await customAlert('Rule deleted successfully!', 'Success');
            await loadSavedRules(); // Recarregar lista
        }
    } catch (error) {
        await customAlert('Error deleting rule: ' + error.message, 'Error');
    }
}

// ========== EVENT LISTENERS ==========
window.onclick = function (event) {
    // Fechar modais ao clicar fora
    const trainingModal = document.getElementById('trainingModal');
    const savedRulesModal = document.getElementById('savedRulesModal');

    if (event.target == trainingModal) {
        closeTrainingModal();
    }
    if (event.target == savedRulesModal) {
        closeSavedRulesModal();
    }
}

// Theme toggle
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Enter key for chat
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
});