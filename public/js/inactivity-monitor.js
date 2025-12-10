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
     * Perform logout due to inactivity
     */
    function performInactivityLogout() {
        console.log('Session expired due to inactivity (30 minutes)');

        // Clear session data
        localStorage.removeItem('sunshineSession');
        localStorage.removeItem('galleryMode');
        localStorage.removeItem(STORAGE_KEY);

        // Show notification if function exists
        if (typeof showNotification === 'function') {
            showNotification('Session expired due to inactivity. Please login again.', 'warning');
        }

        // Redirect to home after brief delay
        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
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
