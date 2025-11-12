// public/js/admin-marketing.js
// Email Marketing Module for Admin Panel

/**
 * EMAIL MARKETING - Sunshine Cowhides
 * Sends mass marketing emails to clients
 */

console.log('📧 admin-marketing.js loaded');

// ===== GLOBAL STATE =====
let marketingRecipientsCount = 0;
let marketingIsSending = false;
let marketingEmailStats = null;

// ===== AUTHENTICATION =====
function getMarketingSession() {
    const saved = localStorage.getItem('sunshineSession');
    return saved ? JSON.parse(saved) : null;
}

function getMarketingAuthHeaders() {
    const session = getMarketingSession();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`
    };
}

// ===== INITIALIZATION =====
async function initializeMarketing() {
    try {
        console.log('📧 Initializing Email Marketing module...');

        // Load recipients count
        await loadMarketingStats();

        console.log('✅ Email Marketing initialized');

    } catch (error) {
        console.error('❌ Error initializing Marketing:', error);
        showMarketingNotification('Error initializing Email Marketing', 'error');
    }
}

// ===== LOAD STATISTICS =====
async function loadMarketingStats() {
    try {
        console.log('📊 Loading marketing statistics...');

        // Chamar NOVA rota de estatísticas de marketing
        const response = await fetch('/api/admin/marketing/marketing-stats', {
            headers: getMarketingAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load marketing stats');
        }

        const data = await response.json();

        if (data.success) {
            const stats = data.stats;

            // Atualizar contador de recipients
            marketingRecipientsCount = stats.totalRecipients;

            // Atualizar cards
            const recipientsEl = document.getElementById('marketingRecipientsCount');
            if (recipientsEl) {
                recipientsEl.textContent = stats.totalRecipients;
            }

            const withoutEmailEl = document.getElementById('marketingWithoutEmail');
            if (withoutEmailEl) {
                const withoutEmail = 279 - stats.totalRecipients; // Total ativos - Com email válido
                withoutEmailEl.textContent = withoutEmail;
            }

            const totalSentEl = document.getElementById('marketingTotalSent');
            if (totalSentEl) {
                totalSentEl.textContent = stats.totalMarketingEmailsSent || 0;
            }

            const lastSentEl = document.getElementById('marketingLastSent');
            if (lastSentEl) {
                if (stats.lastCampaignDate) {
                    const lastDate = new Date(stats.lastCampaignDate);
                    lastSentEl.textContent = lastDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                } else {
                    lastSentEl.textContent = 'Never';
                }
            }

            // Atualizar contador do botão final
            const finalCountEl = document.getElementById('marketingFinalCount');
            if (finalCountEl) {
                finalCountEl.textContent = stats.availableToSend; // Mostra quantos VÃO receber (não os já protegidos)
            }

            // ===== ATUALIZAR CARDS DE TRACKING =====

            // Open Rate Card
            const openRateEl = document.getElementById('trackingOpenRate');
            if (openRateEl) {
                openRateEl.textContent = stats.openRate + '%';
            }
            const emailsOpenedEl = document.getElementById('trackingEmailsOpened');
            if (emailsOpenedEl) {
                emailsOpenedEl.textContent = stats.emailsOpened || 0;
            }
            const totalSent1El = document.getElementById('trackingTotalSent1');
            if (totalSent1El) {
                totalSent1El.textContent = stats.totalMarketingEmailsSent || 0;
            }

            // Click Rate Card
            const clickRateEl = document.getElementById('trackingClickRate');
            if (clickRateEl) {
                clickRateEl.textContent = stats.clickRate + '%';
            }
            const emailsClickedEl = document.getElementById('trackingEmailsClicked');
            if (emailsClickedEl) {
                emailsClickedEl.textContent = stats.emailsClicked || 0;
            }
            const totalSent2El = document.getElementById('trackingTotalSent2');
            if (totalSent2El) {
                totalSent2El.textContent = stats.totalMarketingEmailsSent || 0;
            }

            // Unsubscribe Card
            const unsubscribeRateEl = document.getElementById('trackingUnsubscribeRate');
            if (unsubscribeRateEl) {
                unsubscribeRateEl.textContent = stats.unsubscribeRate + '%';
            }
            const unsubscribedEl = document.getElementById('trackingUnsubscribed');
            if (unsubscribedEl) {
                unsubscribedEl.textContent = stats.unsubscribedCount || 0;
            }

            console.log('✅ Marketing stats loaded:', stats);
        } else {
            throw new Error(data.message || 'Failed to load stats');
        }

    } catch (error) {
        console.error('❌ Error loading stats:', error);
        UISystem.showToast('error', 'Error loading marketing statistics');
    }
}

// ===== EMAIL PREVIEW =====
async function generateEmailPreview() {
    try {
        const subject = document.getElementById('marketingEmailSubject').value.trim();
        const message = document.getElementById('marketingEmailMessage').value.trim();

        if (!subject) {
            showMarketingNotification('Please enter a subject line', 'warning');
            return;
        }

        if (!message) {
            showMarketingNotification('Please enter a message', 'warning');
            return;
        }

        console.log('👁️ Generating email preview...');

        const response = await fetch('/api/admin/marketing/preview', {
            method: 'POST',
            headers: getMarketingAuthHeaders(),
            body: JSON.stringify({ subject, message })
        });

        const data = await response.json();

        if (data.success) {
            // Show preview area
            document.getElementById('marketingPreviewArea').style.display = 'block';

            // Insert HTML preview
            document.getElementById('marketingPreviewContent').innerHTML = data.preview.html;

            // Scroll to preview
            document.getElementById('marketingPreviewArea').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            console.log('✅ Preview generated');
        } else {
            throw new Error(data.message || 'Failed to generate preview');
        }

    } catch (error) {
        console.error('❌ Error generating preview:', error);
        showMarketingNotification('Error generating preview: ' + error.message, 'error');
    }
}

// ===== SEND TEST EMAIL =====
async function sendTestEmail() {
    try {
        const subject = document.getElementById('marketingEmailSubject').value.trim();
        const message = document.getElementById('marketingEmailMessage').value.trim();
        const testEmail = document.getElementById('marketingTestEmail').value.trim();

        // Validation
        if (!subject) {
            showMarketingNotification('Please enter a subject line', 'warning');
            document.getElementById('marketingEmailSubject').focus();
            return;
        }

        if (!message) {
            showMarketingNotification('Please enter a message', 'warning');
            document.getElementById('marketingEmailMessage').focus();
            return;
        }

        if (!testEmail) {
            showMarketingNotification('Please enter a test email address', 'warning');
            document.getElementById('marketingTestEmail').focus();
            return;
        }

        // Validar formato do email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(testEmail)) {
            showMarketingNotification('Please enter a valid email address', 'warning');
            document.getElementById('marketingTestEmail').focus();
            return;
        }

        // Show loading overlay
        showMarketingLoading('Sending Test Email', 'Preparing to send...');

        // Disable button
        const btn = document.getElementById('marketingSendTestBtn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        console.log(`🧪 Sending test email to ${testEmail}...`);

        // Show status
        showMarketingStatus('sending', `Sending test email to ${testEmail}...`);

        const response = await fetch('/api/admin/marketing/send-test-email', {
            method: 'POST',
            headers: getMarketingAuthHeaders(),
            body: JSON.stringify({
                subject: subject,
                message: message,
                testEmail: testEmail
            })
        });

        const data = await response.json();

        if (data.success) {
            console.log(`✅ Test email sent to ${testEmail}`);
            showMarketingStatus('success', `✅ Test email sent successfully to ${testEmail}!`);
            showMarketingNotification(`Test email sent to ${testEmail}!`, 'success');

            // Reload stats
            await loadMarketingStats();
        } else {
            throw new Error(data.message || 'Failed to send test email');
        }

    } catch (error) {
        console.error('❌ Error sending test:', error);
        showMarketingStatus('error', `❌ Error: ${error.message}`);
        showMarketingNotification('Error sending test email: ' + error.message, 'error');
    } finally {
        // Hide loading overlay
        hideMarketingLoading();

        // Re-enable button
        const btn = document.getElementById('marketingSendTestBtn');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Test';
    }
}

async function confirmSendToAll() {
    const subject = document.getElementById('marketingEmailSubject').value.trim();
    const message = document.getElementById('marketingEmailMessage').value.trim();

    if (!subject || !message) {
        UISystem.showToast('warning', 'Please enter subject and message');
        return;
    }

    // Usar UISystem.confirm (retorna Promise)
    const confirmed = await UISystem.confirm(
        `You are about to send this email to ALL ${marketingRecipientsCount} clients with registered email.`,
        `Subject: ${subject}\n\nThis action cannot be undone. Are you SURE you want to proceed?`
    );

    if (confirmed) {
        await sendMassEmailToAll();
    }
}

async function sendMassEmailToAll() {
    try {
        const subject = document.getElementById('marketingEmailSubject').value.trim();
        const message = document.getElementById('marketingEmailMessage').value.trim();

        // Disable button
        const btn = document.getElementById('marketingSendAllBtn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

        // Show loading
        showMarketingLoading(
            `Sending to All Clients`,
            `Preparing to send to ${marketingRecipientsCount} clients...`
        );

        console.log(`📧 Sending mass email to ALL clients...`);

        const response = await fetch('/api/admin/marketing/send-mass-email', {
            method: 'POST',
            headers: getMarketingAuthHeaders(),
            body: JSON.stringify({
                subject: subject,
                message: message,
                sendToAll: true,
                limit: 'all' // Sempre enviar para todos
            })
        });

        const data = await response.json();

        // Hide loading
        hideMarketingLoading();

        if (data.success) {
            console.log(`✅ Mass email sent: ${data.stats.sent} sent, ${data.stats.failed} failed`);

            // Show result usando ui-system se disponível
            const resultMessage =
                `✅ Campaign Completed!\n\n` +
                `Successfully sent: ${data.stats.sent}/${data.stats.total}\n` +
                `Failed: ${data.stats.failed}`;

            showMarketingStatus('success', resultMessage);

            if (window.showNotification) {
                UISystem.showToast('success', `Campaign sent to ${data.stats.sent} clients!`);
            }

            // Reload stats
            await loadMarketingStats();
        } else {
            throw new Error(data.message || 'Failed to send mass email');
        }

    } catch (error) {
        console.error('❌ Error sending mass email:', error);
        hideMarketingLoading();
        showMarketingStatus('error', `❌ Error: ${error.message}`);

        if (window.showNotification) {
            UISystem.showToast('error', 'Error sending campaign: ' + error.message);
        }
    } finally {
        // Re-enable button
        const btn = document.getElementById('marketingSendAllBtn');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-rocket"></i> Send to All Clients Now';
    }
}

// ===== STATUS MESSAGES =====
function showMarketingStatus(type, message) {
    const statusDiv = document.getElementById('marketingStatus');

    let bgColor, borderColor, icon;

    switch (type) {
        case 'sending':
            bgColor = '#e3f2fd';
            borderColor = '#2196F3';
            icon = '<i class="fas fa-spinner fa-spin"></i>';
            break;
        case 'success':
            bgColor = '#d4edda';
            borderColor = '#28a745';
            bgColor = 'black'
            icon = '<i class="fas fa-check-circle"></i>';
            break;
        case 'error':
            bgColor = '#f8d7da';
            borderColor = '#dc3545';
            icon = '<i class="fas fa-exclamation-circle"></i>';
            break;
        default:
            bgColor = '#fff3cd';
            borderColor = '#ffc107';
            icon = '<i class="fas fa-info-circle"></i>';
    }

    statusDiv.innerHTML = `
        <div style="background: ${bgColor}; padding: 20px; border-radius: 8px; border-left: 4px solid ${borderColor};">
            ${icon} <span style="margin-left: 10px; white-space: pre-line;">${message}</span>
        </div>
    `;

    statusDiv.style.display = 'block';

    // Scroll to status
    statusDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ===== NOTIFICATIONS =====
function showMarketingNotification(message, type) {
    UISystem.showToast(type, message);
}

// ===== SECTION VISIBILITY HANDLER =====
// Initialize when marketing section becomes visible
document.addEventListener('DOMContentLoaded', () => {
    // Observe section visibility changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const section = document.getElementById('section-marketing');
                if (section && section.style.display !== 'none') {
                    // Marketing section is now visible
                    console.log('📧 Marketing section activated');
                    initializeMarketing();
                }
            }
        });
    });

    // Start observing the marketing section
    const marketingSection = document.getElementById('section-marketing');
    if (marketingSection) {
        observer.observe(marketingSection, {
            attributes: true,
            attributeFilter: ['style']
        });

        // Also initialize if section is already visible
        if (marketingSection.style.display !== 'none') {
            initializeMarketing();
        }
    }
});

// ===== LOADING OVERLAY =====
function showMarketingLoading(title, text) {
    const overlay = document.getElementById('marketingLoadingOverlay');
    document.getElementById('marketingLoadingTitle').textContent = title || 'Processing...';
    document.getElementById('marketingLoadingText').textContent = text || 'Please wait...';
    overlay.style.display = 'flex';
}

function hideMarketingLoading() {
    const overlay = document.getElementById('marketingLoadingOverlay');
    overlay.style.display = 'none';
}

// ===== RECIPIENTS LIST =====
async function loadRecipientsList() {
    const container = document.getElementById('recipientsListContainer');
    const btn = document.getElementById('loadRecipientsBtn');

    // Se já está aberto, apenas fechar (toggle)
    if (container.style.display === 'block') {
        container.style.display = 'none';
        btn.innerHTML = '<i class="fas fa-list"></i> View First 50 Clients';
        return;
    }

    // Se está fechado, abrir e carregar
    try {
        const loading = document.getElementById('recipientsListLoading');
        const content = document.getElementById('recipientsListContent');

        // Show container and loading
        container.style.display = 'block';
        loading.style.display = 'block';
        content.style.display = 'none';

        // Mudar texto do botão
        btn.innerHTML = '<i class="fas fa-times"></i> Hide List';

        console.log('📋 Loading recipients list...');

        const response = await fetch('/api/admin/marketing/recipients-list?limit=50', {
            headers: getMarketingAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            // Populate table
            const tbody = document.getElementById('recipientsTableBody');
            tbody.innerHTML = data.recipients.map(recipient => `
                <tr>
                    <td><strong>${recipient.code}</strong></td>
                    <td>${recipient.name}</td>
                    <td style="color: #2196F3;">${recipient.email}</td>
                    <td style="color: #666;">${recipient.company}</td>
                </tr>
            `).join('');

            // Update counts
            document.getElementById('recipientsShowingCount').textContent = data.showing;
            document.getElementById('recipientsTotalCount').textContent = marketingRecipientsCount;

            // Hide loading, show content
            loading.style.display = 'none';
            content.style.display = 'block';

            console.log(`✅ Loaded ${data.recipients.length} recipients`);

        } else {
            throw new Error(data.message || 'Failed to load recipients');
        }

    } catch (error) {
        console.error('❌ Error loading recipients:', error);
        UISystem.showToast('error', 'Error loading recipients list');
        container.style.display = 'none';
        btn.innerHTML = '<i class="fas fa-list"></i> View First 50 Clients';
    }
}

function hideRecipientsList() {
    document.getElementById('recipientsListContainer').style.display = 'none';
    const btn = document.getElementById('loadRecipientsBtn');
    btn.innerHTML = '<i class="fas fa-list"></i> View First 50 Clients';
}

console.log('📧 Email Marketing module ready');