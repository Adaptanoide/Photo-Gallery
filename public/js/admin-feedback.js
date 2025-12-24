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

    if (!feedback || feedback.length === 0) {
        feedbackList.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 60px 20px; color: #6b7280;">
                <i class="fas fa-inbox" style="font-size: 48px; color: #d1d5db; margin-bottom: 16px;"></i>
                <p style="font-size: 1.1rem; font-weight: 500;">No feedback found</p>
                <p style="font-size: 0.9rem; color: #9ca3af;">Client feedback will appear here</p>
            </div>
        `;
        return;
    }

    feedbackList.innerHTML = feedback.map(fb => renderFeedbackCard(fb)).join('');
}

// Render single feedback card
function renderFeedbackCard(fb) {
    const typeIcons = {
        suggestion: { icon: 'lightbulb', color: '#10b981', label: 'Suggestion' },
        issue: { icon: 'exclamation-triangle', color: '#f59e0b', label: 'Issue' },
        question: { icon: 'question-circle', color: '#3b82f6', label: 'Question' },
        praise: { icon: 'star', color: '#8b5cf6', label: 'Praise' },
        general: { icon: 'comment', color: '#6b7280', label: 'General' }
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
            background: white;
            border: 1px solid #e5e7eb;
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
                        <h4 style="margin: 0; font-size: 1rem; color: #1f2937; font-weight: 600;">${fb.clientName}</h4>
                        <p style="margin: 2px 0 0; font-size: 0.8rem; color: #9ca3af;">${fb.clientCode || 'No code'} &bull; ${date}</p>
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
                    background: #f9fafb;
                    border-radius: 8px;
                    padding: 14px;
                    margin-bottom: 12px;
                ">
                    <p style="margin: 0; font-size: 0.9rem; color: #374151; line-height: 1.5;">${fb.message}</p>
                </div>
            ` : ''}

            ${fb.adminNotes ? `
                <div style="
                    background: #fffbeb;
                    border: 1px solid #fde68a;
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 12px;
                ">
                    <p style="margin: 0 0 4px; font-size: 0.75rem; color: #92400e; font-weight: 600;">
                        <i class="fas fa-sticky-note"></i> Admin Notes
                    </p>
                    <p style="margin: 0; font-size: 0.85rem; color: #78350f;">${fb.adminNotes}</p>
                </div>
            ` : ''}

            <div style="display: flex; gap: 8px; padding-top: 8px; border-top: 1px solid #f3f4f6;">
                ${fb.status === 'new' ? `
                    <button onclick="updateFeedbackStatus('${fb._id}', 'read')" style="
                        padding: 6px 12px;
                        background: #e0e7ff;
                        color: #4338ca;
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
                        background: #dcfce7;
                        color: #166534;
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
                    background: #f3f4f6;
                    color: #374151;
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
                        background: #f3f4f6;
                        color: #6b7280;
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
    const modalHTML = `
        <div id="notesModal" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        ">
            <div style="
                background: white;
                border-radius: 12px;
                padding: 24px;
                width: 90%;
                max-width: 450px;
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
            ">
                <h3 style="margin: 0 0 16px; font-size: 1.1rem; color: #1f2937;">
                    <i class="fas fa-sticky-note" style="color: #B87333;"></i> Admin Notes
                </h3>
                <textarea id="notesTextarea" style="
                    width: 100%;
                    min-height: 120px;
                    padding: 12px;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    font-size: 0.9rem;
                    font-family: inherit;
                    resize: vertical;
                    margin-bottom: 16px;
                " placeholder="Add notes about this feedback...">${currentNotes}</textarea>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="closeNotesModal()" style="
                        padding: 10px 20px;
                        background: #f3f4f6;
                        color: #374151;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 500;
                    ">Cancel</button>
                    <button onclick="saveNotes('${id}')" style="
                        padding: 10px 20px;
                        background: linear-gradient(135deg, #B87333, #A0522D);
                        color: white;
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
