/**
 * Inactivity Monitor - Auto-logout after 30 minutes of inactivity
 * Sunshine Cowhides Gallery System
 */

(function() {
    'use strict';

    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
    const STORAGE_KEY = 'lastActivityTime';

    let activityTimeout = null;

    /**
     * Update the last activity timestamp
     */
    function updateActivity() {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
        resetTimeout();
    }

    /**
     * Check if user has been inactive for too long
     * Returns true if should logout
     */
    function checkInactivity() {
        const lastActivity = localStorage.getItem(STORAGE_KEY);
        if (!lastActivity) {
            updateActivity();
            return false;
        }

        const elapsed = Date.now() - parseInt(lastActivity, 10);
        return elapsed >= INACTIVITY_TIMEOUT;
    }

    /**
     * Create and show the session expired modal
     */
    function showSessionExpiredModal() {
        // Remove existing modal if any
        const existing = document.getElementById('sessionExpiredModal');
        if (existing) existing.remove();

        // Create modal HTML
        const modal = document.createElement('div');
        modal.id = 'sessionExpiredModal';
        modal.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                animation: fadeIn 0.3s ease;
            ">
                <div style="
                    background: white;
                    border-radius: 16px;
                    padding: 2.5rem;
                    max-width: 400px;
                    width: 90%;
                    text-align: center;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    animation: slideUp 0.3s ease;
                ">
                    <div style="
                        width: 70px;
                        height: 70px;
                        background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 1.5rem;
                    ">
                        <i class="fas fa-clock" style="font-size: 32px; color: white;"></i>
                    </div>
                    <h2 style="
                        color: #333;
                        margin: 0 0 1rem;
                        font-size: 1.5rem;
                        font-weight: 600;
                    ">Session Expired</h2>
                    <p style="
                        color: #666;
                        margin: 0 0 1.5rem;
                        font-size: 1rem;
                        line-height: 1.6;
                    ">Your session has expired due to inactivity.<br>Please login again to continue.</p>
                    <button id="sessionExpiredOkBtn" style="
                        background: linear-gradient(135deg, #d4af37, #b8941f);
                        color: white;
                        border: none;
                        padding: 14px 40px;
                        font-size: 1rem;
                        font-weight: 600;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 15px rgba(212, 175, 55, 0.4);
                    ">
                        <i class="fas fa-sign-in-alt" style="margin-right: 8px;"></i>
                        OK, Login Again
                    </button>
                </div>
            </div>
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                #sessionExpiredOkBtn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(212, 175, 55, 0.5);
                }
            </style>
        `;

        document.body.appendChild(modal);

        // Handle button click
        document.getElementById('sessionExpiredOkBtn').addEventListener('click', () => {
            window.location.href = '/';
        });
    }

    /**
     * Perform logout due to inactivity
     */
    function performInactivityLogout() {
        console.log('Session expired due to inactivity (30 minutes)');

        // Clear session data
        localStorage.removeItem('sunshineSession');
        localStorage.removeItem('galleryMode');
        localStorage.removeItem(STORAGE_KEY);

        // Show modal instead of notification
        showSessionExpiredModal();
    }

    /**
     * Reset the inactivity timeout
     */
    function resetTimeout() {
        if (activityTimeout) {
            clearTimeout(activityTimeout);
        }
        activityTimeout = setTimeout(() => {
            performInactivityLogout();
        }, INACTIVITY_TIMEOUT);
    }

    /**
     * Initialize the inactivity monitor
     */
    function init() {
        // Only run if user is logged in
        const session = localStorage.getItem('sunshineSession');
        if (!session) {
            return;
        }

        // Check if already inactive on page load/focus
        if (checkInactivity()) {
            performInactivityLogout();
            return;
        }

        // Update activity on page load
        updateActivity();

        // Listen for user activity events
        const activityEvents = [
            'mousedown',
            'mousemove',
            'keydown',
            'scroll',
            'touchstart',
            'click',
            'focus'
        ];

        // Throttle activity updates to avoid too frequent localStorage writes
        let lastUpdate = 0;
        const throttleMs = 10000; // Update max every 10 seconds

        const handleActivity = () => {
            const now = Date.now();
            if (now - lastUpdate > throttleMs) {
                lastUpdate = now;
                updateActivity();
            }
        };

        activityEvents.forEach(event => {
            document.addEventListener(event, handleActivity, { passive: true });
        });

        // Check inactivity when page becomes visible (user returns to tab)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                if (checkInactivity()) {
                    performInactivityLogout();
                } else {
                    updateActivity();
                }
            }
        });

        // Also check on window focus
        window.addEventListener('focus', () => {
            if (checkInactivity()) {
                performInactivityLogout();
            } else {
                updateActivity();
            }
        });

        console.log('Inactivity monitor initialized (30 min timeout)');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
