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

        // Clear all session data
        localStorage.removeItem('sunshineSession');
        localStorage.removeItem('galleryMode');
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('sessionStartTime');
        localStorage.removeItem('cartCollapsed'); // Also clear cart preference

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
     * Validate if session token is still valid (quick check)
     * Returns false if clearly invalid, true if possibly valid
     */
    function isSessionPossiblyValid(session) {
        try {
            const sessionData = JSON.parse(session);
            // Check if has required fields
            if (!sessionData.token || !sessionData.clientId) {
                return false;
            }
            // Check if token looks valid (basic format check)
            if (typeof sessionData.token !== 'string' || sessionData.token.length < 10) {
                return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Initialize the inactivity monitor
     */
    function init() {
        // Only run if user is logged in
        const session = localStorage.getItem('sunshineSession');
        if (!session) {
            // No session - clear any old activity data
            localStorage.removeItem(STORAGE_KEY);
            return;
        }

        // Note: We don't validate session format here anymore
        // The backend will handle invalid sessions with proper 401 responses
        // This monitor only handles INACTIVITY timeouts, not session validation

        // Get last activity and session start time
        const lastActivity = localStorage.getItem(STORAGE_KEY);
        const sessionStartKey = 'sessionStartTime';
        const sessionStart = localStorage.getItem(sessionStartKey);

        // If no session start time recorded, this is a new/fresh session
        // Set it now and update activity
        if (!sessionStart) {
            localStorage.setItem(sessionStartKey, Date.now().toString());
            updateActivity();
            setupActivityListeners();
            console.log('Inactivity monitor initialized - new session');
            return;
        }

        // Check if already inactive on page load/focus
        // Only show expired modal if there WAS activity recorded before
        if (lastActivity && checkInactivity()) {
            performInactivityLogout();
            return;
        }

        // Update activity on page load
        updateActivity();
        setupActivityListeners();
        console.log('Inactivity monitor initialized (30 min timeout)');
    }

    /**
     * Setup activity event listeners
     */
    function setupActivityListeners() {
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

        // Start the timeout
        resetTimeout();
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
