// Sistema Unificado de UI
class UISystem {

    // TOAST - Centro Superior (como você quer)
    static showToast(type, message, duration = 3000) {
        // Remove toast anterior
        const existing = document.querySelector('.ui-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `ui-toast ui-toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                ${type === 'success' ? '✅' :
                type === 'error' ? '❌' :
                    type === 'warning' ? '⚠️' : 'ℹ️'}
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(toast);

        // Auto remover
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.add('ui-toast-exit');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }

        return toast;
    }

    // MODAL PADRONIZADO (como Edit Access Code)
    static showModal(options) {
        const modal = document.createElement('div');
        modal.className = 'ui-modal-backdrop';
        modal.innerHTML = `
            <div class="ui-modal">
                <div class="ui-modal-header">
                    ${options.icon ? `<span class="modal-icon">${options.icon}</span>` : ''}
                    <h3>${options.title}</h3>
                    <button class="modal-close" onclick="this.closest('.ui-modal-backdrop').remove()">✕</button>
                </div>
                <div class="ui-modal-body">
                    ${options.content}
                </div>
                ${options.footer ? `
                    <div class="ui-modal-footer">
                        ${options.footer}
                    </div>
                ` : ''}
            </div>
        `;

        document.body.appendChild(modal);
        return modal;
    }

    // CONFIRM PADRONIZADO
    static confirm(message, details = '') {
        return new Promise((resolve) => {
            const modal = this.showModal({
                icon: '⚠️',
                title: 'Confirmation Required',
                content: `
                    <p class="confirm-message">${message}</p>
                    ${details ? `<p class="confirm-details">${details}</p>` : ''}
                `,
                footer: `
                    <button class="btn-secondary" onclick="this.closest('.ui-modal-backdrop').remove()">
                        Cancel
                    </button>
                    <button class="btn-primary" id="confirmBtn">
                        Confirm
                    </button>
                `
            });

            modal.querySelector('#confirmBtn').onclick = () => {
                modal.remove();
                resolve(true);
            };

            modal.querySelector('.btn-secondary').onclick = () => {
                resolve(false);
            };
        });
    }

    // NOVO SISTEMA DE STATUS INLINE (não trava a tela!)
    static updateTableStatus(row, status, message) {
        // Procura a célula de status na linha
        const statusCell = row.querySelector('.status-cell');
        if (!statusCell) {
            console.error('Status cell not found');
            return;
        }

        // Cria o badge com status
        let badgeHTML = '';

        if (status === 'processing' || status === 'cancelling' || status === 'moving') {
            // Com spinner
            badgeHTML = `
                <span class="badge badge-${status}">
                    <span class="spinner-inline"></span>
                    ${message}
                </span>
            `;
        } else {
            // Sem spinner
            badgeHTML = `
                <span class="badge badge-${status}">
                    ${message}
                </span>
            `;
        }

        statusCell.innerHTML = badgeHTML;
    }

    // UPDATE PROGRESS
    static updateProgress(current, total) {
        const overlay = document.querySelector('.processing-overlay');
        if (!overlay) return;

        const progressDiv = overlay.querySelector('.processing-progress');
        const progressFill = overlay.querySelector('.progress-fill');
        const progressText = overlay.querySelector('.progress-text');

        if (progressDiv) {
            progressDiv.style.display = 'block';
            const percentage = Math.round((current / total) * 100);
            progressFill.style.width = `${percentage}%`;
            progressText.textContent = `${current}/${total}`;
        }
    }
}

// Tornar global
window.UISystem = UISystem;