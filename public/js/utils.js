// utils.js
// Show the loader
function showLoader() {
  document.getElementById('loader').style.display = 'block';
}

// Hide the loader
function hideLoader() {
  document.getElementById('loader').style.display = 'none';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
  
  if (modalId === 'cart-modal') {
    cartModalOpen = false;
  }
  
  // ✅ CORREÇÃO: Ao cancelar admin login, voltar para página de login
  if (modalId === 'admin-login-modal') {
    document.getElementById('code-entry-modal').style.display = 'block';
  }
}

// Custom toast notification system
let toastTimeout;
function showToast(message, type = 'success', duration = 4000) {
  // Clear any existing timeout
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  const toast = document.getElementById('custom-toast');
  const toastTitle = document.getElementById('toast-title');
  const toastIcon = document.getElementById('toast-icon');
  const toastBody = document.getElementById('toast-body');
  const toastProgress = document.getElementById('toast-progress');

  // Configure based on type
  if (type === 'success') {
    toast.style.backgroundColor = 'var(--color-dark)';
    toastTitle.textContent = 'Success';
    toastIcon.textContent = '✓';
    toastProgress.style.backgroundColor = 'var(--color-gold)';
  } else if (type === 'error') {
    toast.style.backgroundColor = 'var(--color-danger)';
    toastTitle.textContent = 'Error';
    toastIcon.textContent = '!';
    toastProgress.style.backgroundColor = '#ff6b6b';
  } else if (type === 'info') {
    toast.style.backgroundColor = 'var(--color-charcoal)';
    toastTitle.textContent = 'Information';
    toastIcon.textContent = 'ℹ';
    toastProgress.style.backgroundColor = 'var(--color-gold-light)';
  }

  // Set message
  toastBody.textContent = message;

  // Show toast
  toast.style.display = 'block';

  // Animate progress bar
  toastProgress.style.width = '100%';
  toastProgress.style.transition = `width ${duration}ms linear`;
  setTimeout(() => {
    toastProgress.style.width = '0';
  }, 10); // Small delay to ensure transition works

  // Auto hide after duration
  toastTimeout = setTimeout(hideToast, duration);
}

function hideToast() {
  const toast = document.getElementById('custom-toast');

  // Add fade-out effect
  toast.style.opacity = '0';
  toast.style.transition = 'opacity 0.3s ease';

  // Hide after animation
  setTimeout(() => {
    toast.style.display = 'none';
    toast.style.opacity = '1';
    toast.style.transition = '';
  }, 300);
}

// Custom confirmation dialog
let confirmCallback = null;

function showConfirm(message, onConfirm, title = 'Confirmation') {
  // Store callback
  confirmCallback = onConfirm;

  // Set content
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;

  // Show dialog
  document.getElementById('custom-confirm').style.display = 'block';
}

function handleConfirmResponse(confirmed) {
  // Hide dialog
  document.getElementById('custom-confirm').style.display = 'none';

  // Call callback if it exists
  if (confirmed && typeof confirmCallback === 'function') {
    confirmCallback();
  }

  // Reset callback
  confirmCallback = null;
}

// Main initialization function
document.addEventListener('DOMContentLoaded', function () {
  // Initialize categories and photos
  loadCategories();

  // Add keyboard events for navigation
  document.addEventListener('keydown', handleKeyDown);

  // Hide container until code is entered
  document.querySelector('.container').style.display = 'none';

  // Show code entry modal
  document.getElementById('code-entry-modal').style.display = 'block';

  // Add event listener for enter key on code input
  document.getElementById('access-code').addEventListener('keyup', function (event) {
    if (event.key === 'Enter') {
      accessGallery();
    }
  });

  // MODIFICAÇÃO: Verificar se admin está logado usando localStorage
  const isAdminLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
  if (isAdminLoggedIn) {
    closeModal('code-entry-modal');
    loadAdminPanel();
  }
});

// Função para detectar suporte a WebP
function browserSupportsWebP() {
  const canvas = document.createElement('canvas');
  if (canvas.getContext && canvas.getContext('2d')) {
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }
  return false;
}

// Exportar função para uso global
window.browserSupportsWebP = browserSupportsWebP;