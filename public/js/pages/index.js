/**
 * SUNSHINE COWHIDES - LOGIN PAGE (VERSÃO LIMPA)
 * JavaScript da página de login
 */

class LoginPage {
  constructor() {
    this.form = null;
    this.codeInput = null;
    this.loginButton = null;
    this.errorContainer = null;
    this.contactModal = null;
    
    this.isLoading = false;
    this.attemptCount = 0;
    this.maxAttempts = 3;
    
    this.init();
  }
  
  init() {
    if (window.API && window.API.isAuthenticated()) {
      this.redirectToGallery();
      return;
    }
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupPage());
    } else {
      this.setupPage();
    }
  }
  
  setupPage() {
    this.bindElements();
    this.bindEvents();
    this.focusCodeInput();
    
    console.log('🚀 Login page initialized');
  }
  
  bindElements() {
    this.form = Utils.$('#loginForm');
    this.codeInput = Utils.$('#accessCode');
    this.loginButton = Utils.$('#loginButton');
    this.errorContainer = Utils.$('#errorMessage');
    this.contactModal = Utils.$('#contactModal');
    
    if (!this.form || !this.codeInput || !this.loginButton) {
      console.error('❌ Elementos essenciais não encontrados no DOM');
      return;
    }
  }
  
  bindEvents() {
    if (!this.form) return;
    
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    
    if (this.codeInput) {
      this.codeInput.addEventListener('input', (e) => this.handleCodeInput(e));
      
      this.codeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !this.isLoading) {
          this.handleSubmit(e);
        }
      });
      
      this.codeInput.addEventListener('input', () => this.clearError());
    }
    
    const contactButton = Utils.$('#contactButton');
    if (contactButton) {
      contactButton.addEventListener('click', () => this.openContactModal());
    }
    
    this.setupModalEvents();
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.contactModal && !Utils.hasClass(this.contactModal, 'hidden')) {
        this.closeContactModal();
      }
    });
  }
  
  setupModalEvents() {
    if (!this.contactModal) return;
    
    const modalClose = this.contactModal.querySelector('.modal-close');
    if (modalClose) {
      modalClose.addEventListener('click', () => this.closeContactModal());
    }
    
    const closeButton = Utils.$('#closeContactModal');
    if (closeButton) {
      closeButton.addEventListener('click', () => this.closeContactModal());
    }
    
    const backdrop = this.contactModal.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => this.closeContactModal());
    }
  }
  
  handleCodeInput(event) {
    const input = event.target;
    let value = input.value;
    
    value = value.replace(/\D/g, '');
    
    if (value.length > 4) {
      value = value.slice(0, 4);
    }
    
    input.value = value;
    
    if (value.length === 4 && !this.isLoading) {
      setTimeout(() => {
        if (input.value === value) {
          this.handleSubmit(event);
        }
      }, 500);
    }
  }
  
  async handleSubmit(event) {
    event.preventDefault();
    
    if (this.isLoading) return;
    
    const code = this.codeInput?.value?.trim();
    
    if (!this.validateInput(code)) {
      return;
    }
    
    try {
      this.setLoadingState(true);
      this.clearError();
      
      const response = await window.API.verifyCode(code);
      
      if (response.success) {
        this.handleLoginSuccess(response.data);
      } else {
        this.handleLoginError(response.message || 'Código inválido');
      }
      
    } catch (error) {
      console.error('Erro na verificação do código:', error);
      this.handleLoginError(error.message || 'Erro interno. Tente novamente.');
    } finally {
      this.setLoadingState(false);
    }
  }
  
  validateInput(code) {
    if (!code) {
      this.showError('Por favor, digite seu código de acesso.');
      this.focusCodeInput();
      return false;
    }
    
    if (!Utils.isValidCode(code)) {
      this.showError('O código deve ter exatamente 4 dígitos.');
      this.focusCodeInput();
      return false;
    }
    
    if (this.attemptCount >= this.maxAttempts) {
      this.showError('Muitas tentativas. Entre em contato conosco.');
      this.codeInput.disabled = true;
      this.loginButton.disabled = true;
      return false;
    }
    
    return true;
  }
  
  handleLoginSuccess(data) {
    console.log('✅ Login successful:', data);
    
    Utils.addClass(document.body, 'login-success');
    Utils.announceToScreenReader('Login realizado com sucesso. Redirecionando...');
    
    if (data.user) {
      Utils.saveToStorage('user_data', data.user);
    }
    
    setTimeout(() => {
      this.redirectToGallery();
    }, 1000);
  }
  
  handleLoginError(message) {
    console.error('❌ Login error:', message);
    
    this.attemptCount++;
    
    let errorMessage = message;
    
    if (this.attemptCount >= this.maxAttempts) {
      errorMessage = 'Muitas tentativas incorretas. Entre em contato conosco para obter um novo código.';
      this.codeInput.disabled = true;
      this.loginButton.disabled = true;
    } else if (this.attemptCount === this.maxAttempts - 1) {
      errorMessage = `${message} (Última tentativa)`;
    }
    
    this.showError(errorMessage);
    
    if (this.attemptCount < this.maxAttempts) {
      this.codeInput.value = '';
      this.focusCodeInput();
    }
    
    Utils.announceToScreenReader(errorMessage);
  }
  
  setLoadingState(loading) {
    this.isLoading = loading;
    
    if (this.loginButton) {
      Utils.setButtonLoading(this.loginButton, loading);
    }
    
    if (this.codeInput) {
      this.codeInput.disabled = loading;
    }
    
    if (this.form) {
      if (loading) {
        Utils.addClass(this.form, 'loading');
      } else {
        Utils.removeClass(this.form, 'loading');
      }
    }
  }
  
  showError(message) {
    if (this.errorContainer) {
      const errorText = this.errorContainer.querySelector('.error-text');
      if (errorText) {
        errorText.textContent = message;
      }
      
      Utils.removeClass(this.errorContainer, 'hidden');
      
      setTimeout(() => {
        this.clearError();
      }, 10000);
    }
  }
  
  clearError() {
    if (this.errorContainer) {
      Utils.addClass(this.errorContainer, 'hidden');
    }
  }
  
  focusCodeInput() {
    if (this.codeInput && !this.codeInput.disabled) {
      setTimeout(() => {
        this.codeInput.focus();
        this.codeInput.select();
      }, 100);
    }
  }
  
  openContactModal() {
    if (this.contactModal) {
      Utils.removeClass(this.contactModal, 'hidden');
      this.contactModal.setAttribute('aria-hidden', 'false');
      
      const closeButton = this.contactModal.querySelector('.modal-close');
      if (closeButton) {
        closeButton.focus();
      }
      
      Utils.addClass(document.body, 'modal-open');
      Utils.announceToScreenReader('Modal de contato aberto');
    }
  }
  
  closeContactModal() {
    if (this.contactModal) {
      Utils.addClass(this.contactModal, 'hidden');
      this.contactModal.setAttribute('aria-hidden', 'true');
      
      Utils.removeClass(document.body, 'modal-open');
      
      const contactButton = Utils.$('#contactButton');
      if (contactButton) {
        contactButton.focus();
      }
      
      Utils.announceToScreenReader('Modal de contato fechado');
    }
  }
  
  redirectToGallery() {
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');
    
    if (redirect) {
      window.location.href = decodeURIComponent(redirect);
    } else {
      window.location.href = '/pages/gallery.html';
    }
  }
}

// CSS adicional se necessário
const additionalCSS = `
  .modal-open {
    overflow: hidden;
  }
  
  .fade-in {
    animation: fadeIn 0.3s ease-out;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);

// Inicializar página
const loginPage = new LoginPage();

// Expor para debug
window.LoginPage = loginPage;