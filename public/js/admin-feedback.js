// public/js/admin-feedback.js
// Admin Feedback Management

let allFeedback = [];

// Load feedback when section is shown
async function loadFeedback() {
    const status = document.getElementById('filterFeedbackStatus')?.value || '';
    const type = document.getElementById('filterFeedbackType')?.value || '';

    const feedbackList = document.getElementById('feedbackList');
    if (!feedbackList) return;

    feedbackList.innerHTML = `
        <div class="loading-section">
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
            </div>
            <p>Loading feedback...</p>
        </div>
    `;

    try {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (type) params.append('type', type);

        const response = await fetch(`/api/feedback?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            allFeedback = data.feedback;
            renderFeedbackList(allFeedback);
            loadFeedbackStats();
        } else {
            feedbackList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Error loading feedback</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading feedback:', error);
        feedbackList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading feedback</p>
            </div>
        `;
    }
}

// Load statistics
async function loadFeedbackStats() {
    try {
        const response = await fetch('/api/feedback/stats');
        const data = await response.json();

        if (data.success) {
            document.getElementById('totalFeedback').textContent = data.total || 0;
            document.getElementById('newFeedback').textContent = data.newCount || 0;
            document.getElementById('suggestionFeedback').textContent = data.byType?.suggestion || 0;

            // Update sidebar badge
            const badge = document.getElementById('sidebarFeedbackBadge');
            if (badge) {
                if (data.newCount > 0) {
                    badge.textContent = data.newCount;
                    badge.style.display = 'inline-flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        }
    } catch (error) {
        console.error('Error loading feedback stats:', error);
    }
}

// Render feedback list
function renderFeedbackList(feedback) {
    const feedbackList = document.getElementById('feedbackList');
    if (!feedbackList) return;

    // Detectar tema atual
    const isLightTheme = document.body.classList.contains('admin-light-theme');
    const emptyTextColor = isLightTheme ? '#6b7280' : '#c0c0c8';
    const emptyIconColor = isLightTheme ? '#d1d5db' : '#6a6a72';
    const emptySubColor = isLightTheme ? '#9ca3af' : '#a0a0a8';

    if (!feedback || feedback.length === 0) {
        feedbackList.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 60px 20px; color: ${emptyTextColor};">
                <i class="fas fa-inbox" style="font-size: 48px; color: ${emptyIconColor}; margin-bottom: 16px;"></i>
                <p style="font-size: 1.1rem; font-weight: 500;">No feedback found</p>
                <p style="font-size: 0.9rem; color: ${emptySubColor};">Client feedback will appear here</p>
            </div>
        `;
        return;
    }

    feedbackList.innerHTML = feedback.map(fb => renderFeedbackCard(fb)).join('');
}

// Render single feedback card
function renderFeedbackCard(fb) {
    // Detectar tema atual
    const isLightTheme = document.body.classList.contains('admin-light-theme');

    // Cores adaptativas (dark = padrão, light = alternativo)
    // Dark theme: cores mais claras e vibrantes para melhor legibilidade
    const colors = {
        cardBg: isLightTheme ? '#ffffff' : '#3a3a44',
        cardBorder: isLightTheme ? '#e5e7eb' : '#4a4a54',
        textPrimary: isLightTheme ? '#1f2937' : '#f0f0f0',
        textSecondary: isLightTheme ? '#9ca3af' : '#b0b0b8',
        textMuted: isLightTheme ? '#6b7280' : '#c0c0c8',
        messageBg: isLightTheme ? '#f9fafb' : '#2a2a32',
        messageBorder: isLightTheme ? '#e5e7eb' : '#4a4a54',
        notesBg: isLightTheme ? '#fffbeb' : '#4a4030',
        notesBorder: isLightTheme ? '#fde68a' : '#8a7a4a',
        notesText: isLightTheme ? '#78350f' : '#f0d080',
        notesLabel: isLightTheme ? '#92400e' : '#e0c060',
        buttonBg: isLightTheme ? '#f3f4f6' : '#4a4a54',
        buttonText: isLightTheme ? '#374151' : '#f0f0f0',
        dividerColor: isLightTheme ? '#f3f4f6' : '#4a4a54'
    };

    const typeIcons = {
        suggestion: { icon: 'lightbulb', color: '#10b981', label: 'Suggestion' },
        issue: { icon: 'exclamation-triangle', color: '#f59e0b', label: 'Issue' },
        question: { icon: 'question-circle', color: '#3b82f6', label: 'Question' },
        praise: { icon: 'star', color: '#8b5cf6', label: 'Praise' },
        general: { icon: 'comment', color: '#6b7280', label: 'General' },
        // Selection completion feedback types
        variety: { icon: 'layer-group', color: '#06b6d4', label: 'Variety' },
        quality: { icon: 'gem', color: '#ec4899', label: 'Quality' },
        easy: { icon: 'hand-pointer', color: '#22c55e', label: 'Easy' },
        found_it: { icon: 'search', color: '#f97316', label: 'Found it' }
    };

    const statusColors = {
        new: { bg: '#dbeafe', color: '#1d4ed8', label: 'New' },
        read: { bg: '#e0e7ff', color: '#4338ca', label: 'Read' },
        resolved: { bg: '#dcfce7', color: '#166534', label: 'Resolved' },
        archived: { bg: '#f3f4f6', color: '#6b7280', label: 'Archived' }
    };

    const typeInfo = typeIcons[fb.type] || typeIcons.general;
    const statusInfo = statusColors[fb.status] || statusColors.new;
    const date = new Date(fb.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return `
        <div class="feedback-card" data-id="${fb._id}" style="
            background: ${colors.cardBg};
            border: 1px solid ${colors.cardBorder};
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 12px;
            ${fb.status === 'new' ? 'border-left: 4px solid #3b82f6;' : ''}
        ">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="
                        width: 40px;
                        height: 40px;
                        background: ${typeInfo.color}15;
                        border-radius: 10px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">
                        <i class="fas fa-${typeInfo.icon}" style="color: ${typeInfo.color}; font-size: 16px;"></i>
                    </div>
                    <div>
                        <h4 style="margin: 0; font-size: 1rem; color: ${colors.textPrimary}; font-weight: 600;">${fb.clientName}</h4>
                        <p style="margin: 2px 0 0; font-size: 0.8rem; color: ${colors.textSecondary};">${fb.clientCode || 'No code'} &bull; ${date}</p>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="
                        padding: 4px 10px;
                        background: ${typeInfo.color}15;
                        color: ${typeInfo.color};
                        font-size: 0.75rem;
                        font-weight: 500;
                        border-radius: 20px;
                    ">${typeInfo.label}</span>
                    <span style="
                        padding: 4px 10px;
                        background: ${statusInfo.bg};
                        color: ${statusInfo.color};
                        font-size: 0.75rem;
                        font-weight: 500;
                        border-radius: 20px;
                    ">${statusInfo.label}</span>
                </div>
            </div>

            ${fb.message ? `
                <div style="
                    background: ${colors.messageBg};
                    border: 1px solid ${colors.messageBorder};
                    border-radius: 8px;
                    padding: 14px;
                    margin-bottom: 12px;
                ">
                    <p style="margin: 0; font-size: 0.9rem; color: ${colors.textPrimary}; line-height: 1.5;">${fb.message}</p>
                </div>
            ` : ''}

            ${fb.adminNotes ? `
                <div style="
                    background: ${colors.notesBg};
                    border: 1px solid ${colors.notesBorder};
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 12px;
                ">
                    <p style="margin: 0 0 4px; font-size: 0.75rem; color: ${colors.notesLabel}; font-weight: 600;">
                        <i class="fas fa-sticky-note"></i> Admin Notes
                    </p>
                    <p style="margin: 0; font-size: 0.85rem; color: ${colors.notesText};">${fb.adminNotes}</p>
                </div>
            ` : ''}

            <div style="display: flex; gap: 8px; padding-top: 8px; border-top: 1px solid ${colors.dividerColor};">
                ${fb.status === 'new' ? `
                    <button onclick="updateFeedbackStatus('${fb._id}', 'read')" style="
                        padding: 6px 12px;
                        background: #3b82f620;
                        color: #3b82f6;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 0.8rem;
                        font-weight: 500;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    "><i class="fas fa-eye"></i> Mark Read</button>
                ` : ''}
                ${fb.status !== 'resolved' && fb.status !== 'archived' ? `
                    <button onclick="updateFeedbackStatus('${fb._id}', 'resolved')" style="
                        padding: 6px 12px;
                        background: #22c55e20;
                        color: #22c55e;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 0.8rem;
                        font-weight: 500;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    "><i class="fas fa-check"></i> Resolve</button>
                ` : ''}
                <button onclick="openNotesModal('${fb._id}', '${(fb.adminNotes || '').replace(/'/g, "\\'")}')" style="
                    padding: 6px 12px;
                    background: ${colors.buttonBg};
                    color: ${colors.buttonText};
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.8rem;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                "><i class="fas fa-edit"></i> Notes</button>
                ${fb.status !== 'archived' ? `
                    <button onclick="updateFeedbackStatus('${fb._id}', 'archived')" style="
                        padding: 6px 12px;
                        background: ${colors.buttonBg};
                        color: ${colors.textMuted};
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 0.8rem;
                        font-weight: 500;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        margin-left: auto;
                    "><i class="fas fa-archive"></i> Archive</button>
                ` : ''}
                <button onclick="deleteFeedback('${fb._id}')" style="
                    padding: 6px 12px;
                    background: #fee2e2;
                    color: #dc2626;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.8rem;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    ${fb.status !== 'archived' ? '' : 'margin-left: auto;'}
                "><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `;
}

// Update feedback status
async function updateFeedbackStatus(id, status) {
    try {
        const response = await fetch(`/api/feedback/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        const data = await response.json();
        if (data.success) {
            loadFeedback();
        } else {
            alert('Error updating feedback');
        }
    } catch (error) {
        console.error('Error updating feedback:', error);
        alert('Error updating feedback');
    }
}

// Open notes modal
function openNotesModal(id, currentNotes) {
    // Detectar tema atual
    const isLightTheme = document.body.classList.contains('admin-light-theme');

    const modalColors = {
        backdrop: isLightTheme ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.7)',
        bg: isLightTheme ? '#ffffff' : '#3a3a44',
        border: isLightTheme ? '#e5e7eb' : '#5a5a64',
        text: isLightTheme ? '#1f2937' : '#f0f0f0',
        inputBg: isLightTheme ? '#ffffff' : '#2a2a32',
        inputBorder: isLightTheme ? '#e5e7eb' : '#5a5a64',
        inputText: isLightTheme ? '#1f2937' : '#f0f0f0',
        cancelBg: isLightTheme ? '#f3f4f6' : '#4a4a54',
        cancelText: isLightTheme ? '#374151' : '#f0f0f0',
        accentColor: isLightTheme ? '#B87333' : '#e0c050'
    };

    const modalHTML = `
        <div id="notesModal" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: ${modalColors.backdrop};
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        ">
            <div style="
                background: ${modalColors.bg};
                border: 1px solid ${modalColors.border};
                border-radius: 12px;
                padding: 24px;
                width: 90%;
                max-width: 450px;
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.35);
            ">
                <h3 style="margin: 0 0 16px; font-size: 1.1rem; color: ${modalColors.text};">
                    <i class="fas fa-sticky-note" style="color: ${modalColors.accentColor};"></i> Admin Notes
                </h3>
                <textarea id="notesTextarea" style="
                    width: 100%;
                    min-height: 120px;
                    padding: 12px;
                    background: ${modalColors.inputBg};
                    border: 1px solid ${modalColors.inputBorder};
                    border-radius: 8px;
                    font-size: 0.9rem;
                    font-family: inherit;
                    resize: vertical;
                    margin-bottom: 16px;
                    color: ${modalColors.inputText};
                " placeholder="Add notes about this feedback...">${currentNotes}</textarea>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="closeNotesModal()" style="
                        padding: 10px 20px;
                        background: ${modalColors.cancelBg};
                        color: ${modalColors.cancelText};
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 500;
                    ">Cancel</button>
                    <button onclick="saveNotes('${id}')" style="
                        padding: 10px 20px;
                        background: linear-gradient(135deg, ${modalColors.accentColor}, ${isLightTheme ? '#A0522D' : '#b8941f'});
                        color: ${isLightTheme ? 'white' : '#1a1a1a'};
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 500;
                    ">Save Notes</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeNotesModal() {
    const modal = document.getElementById('notesModal');
    if (modal) modal.remove();
}

async function saveNotes(id) {
    const notes = document.getElementById('notesTextarea')?.value || '';

    try {
        const response = await fetch(`/api/feedback/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminNotes: notes })
        });

        const data = await response.json();
        if (data.success) {
            closeNotesModal();
            loadFeedback();
        } else {
            alert('Error saving notes');
        }
    } catch (error) {
        console.error('Error saving notes:', error);
        alert('Error saving notes');
    }
}

// Delete feedback - show styled confirmation modal
function deleteFeedback(id) {
    showConfirmModal({
        title: 'Delete Feedback',
        message: 'Are you sure you want to delete this feedback? This action cannot be undone.',
        icon: 'trash-alt',
        iconColor: '#dc2626',
        confirmText: 'Delete',
        confirmColor: '#dc2626',
        onConfirm: async () => {
            try {
                const response = await fetch(`/api/feedback/${id}`, {
                    method: 'DELETE'
                });

                const data = await response.json();
                if (data.success) {
                    loadFeedback();
                } else {
                    alert('Error deleting feedback');
                }
            } catch (error) {
                console.error('Error deleting feedback:', error);
                alert('Error deleting feedback');
            }
        }
    });
}

// Generic styled confirmation modal using UISystem pattern
function showConfirmModal({ title, message, icon, iconColor, confirmText, confirmColor, onConfirm }) {
    const modalId = 'confirmModal-' + Date.now();
    const modal = document.createElement('div');
    modal.className = 'ui-modal-backdrop';
    modal.id = modalId;
    modal.innerHTML = `
        <div class="ui-modal">
            <div class="ui-modal-header">
                <span class="modal-icon">⚠️</span>
                <h3>${title}</h3>
                <button class="modal-close" onclick="closeConfirmModal('${modalId}')">✕</button>
            </div>
            <div class="ui-modal-body">
                <p class="confirm-message">${message}</p>
            </div>
            <div class="ui-modal-footer">
                <button class="btn-secondary" onclick="closeConfirmModal('${modalId}')">
                    Cancel
                </button>
                <button class="btn-primary btn-danger" id="${modalId}-confirm">
                    ${confirmText}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add click handler for confirm button
    document.getElementById(`${modalId}-confirm`).onclick = () => {
        closeConfirmModal(modalId);
        if (onConfirm) onConfirm();
    };

    // Close on backdrop click
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeConfirmModal(modalId);
        }
    };
}

function closeConfirmModal(modalId) {
    const modal = document.getElementById(modalId || 'confirmModal');
    if (modal) modal.remove();
}

// Initialize when section is shown
function initFeedbackSection() {
    loadFeedback();
}

// Load badge count on page load
document.addEventListener('DOMContentLoaded', () => {
    // Load stats to show badge in sidebar
    loadFeedbackStats();
});

// Expose functions globally
window.loadFeedback = loadFeedback;
window.loadFeedbackStats = loadFeedbackStats;
window.updateFeedbackStatus = updateFeedbackStatus;
window.openNotesModal = openNotesModal;
window.closeNotesModal = closeNotesModal;
window.saveNotes = saveNotes;
window.deleteFeedback = deleteFeedback;
window.initFeedbackSection = initFeedbackSection;
window.showConfirmModal = showConfirmModal;
window.closeConfirmModal = closeConfirmModal;
