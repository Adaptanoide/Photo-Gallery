/**
 * SUNSHINE COWHIDES - LOGIN PAGE
 * JavaScript da página de login
 */

class LoginPage {
  constructor() {
    this.form = null;
    this.codeInput = null;
    this.loginButton = null;
    this.errorContainer = null;
    this.contactModal = null;
    
    // Estado
    this.isLoading = false;
    this.attemptCount = 0;
    this.maxAttempts = 3;
    
    this.init();
  }
  
  /**
   * Inicializa a página
   */
  init() {
    // Verificar se já está logado
    if (window.API && window.API.isAuthenticated()) {
      this.redirectToGallery();
      return;
    }
    
    // Aguardar DOM estar pronto
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupPage());
    } else {
      this.setupPage();
    }
  }
  
  /**
   * Configura a página após DOM estar pronto
   */
  setupPage() {
    this.bindElements();
    this.bindEvents();
    this.setupAccessibility();
    this.focusCodeInput();
    
    console.log('🚀 Login page initialized');
  }
  
  /**
   * Vincula elementos do DOM
   */
  bindElements() {
    this.form = Utils.$('#loginForm');
    this.codeInput = Utils.$('#accessCode');
    this.loginButton = Utils.$('#loginButton');
    this.errorContainer = Utils.$('#errorMessage');
    this.contactModal = Utils.$('#contactModal');
    
    // Verificar se elementos essenciais existem
    if (!this.form || !this.codeInput || !this.loginButton) {
      console.error('❌ Elementos essenciais não encontrados no DOM');
      return;
    }
  }
  
  /**
   * Vincula eventos
   */
  bindEvents() {
    if (!this.form) return;
    
    // Submit do formulário
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    
    // Input do código
    if (this.codeInput) {
      // Formatação automática (apenas números)
      this.codeInput.addEventListener('input', (e) => this.handleCodeInput(e));
      
      // Enter no input
      this.codeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !this.isLoading) {
          this.handleSubmit(e);
        }
      });
      
      // Limpar erro ao digitar
      this.codeInput.addEventListener('input', () => this.clearError());
    }
    
    // Botão de contato
    const contactButton = Utils.$('#contactButton');
    if (contactButton) {
      contactButton.addEventListener('click', () => this.openContactModal());
    }
    
    // Modal de contato
    this.setupModalEvents();
    
    // Escape para fechar modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.contactModal && !Utils.hasClass(this.contactModal, 'hidden')) {
        this.closeContactModal();
      }
    });
  }
  
  /**
   * Configura eventos do modal
   */
  setupModalEvents() {
    if (!this.contactModal) return;
    
    // Botão fechar no header
    const modalClose = this.contactModal.querySelector('.modal-close');
    if (modalClose) {
      modalClose.addEventListener('click', () => this.closeContactModal());
    }
    
    // Botão fechar no footer
    const closeButton = Utils.$('#closeContactModal');
    if (closeButton) {
      closeButton.addEventListener('click', () => this.closeContactModal());
    }
    
    // Clique no backdrop
    const backdrop = this.contactModal.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => this.closeContactModal());
    }
  }
  
  /**
   * Configura acessibilidade
   */
  setupAccessibility() {
    // Anunciar página carregada para screen readers
    setTimeout(() => {
      Utils.announceToScreenReader('Página de login carregada. Digite seu código de acesso.');
    }, 500);
    
    // Trap focus no modal quando aberto
    if (this.contactModal) {
      this.setupModalFocusTrap();
    }
  }
  
  /**
   * Configura trap de foco no modal
   */
  setupModalFocusTrap() {
    const modal = this.contactModal;
    if (!modal) return;
    
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    });
  }
  
  /**
   * Lida com input do código
   */
  handleCodeInput(event) {
    const input = event.target;
    let value = input.value;
    
    // Manter apenas números
    value = value.replace(/\D/g, '');
    
    // Limitar a 4 dígitos
    if (value.length > 4) {
      value = value.slice(0, 4);
    }
    
    input.value = value;
    
    // Auto-submit quando tiver 4 dígitos (opcional)
    if (value.length === 4 && !this.isLoading) {
      // Pequeno delay para UX
      setTimeout(() => {
        if (input.value === value) { // Verificar se não mudou
          this.handleSubmit(event);
        }
      }, 500);
    }
  }
  
  /**
   * Lida com submit do formulário
   */
  async handleSubmit(event) {
    event.preventDefault();
    
    if (this.isLoading) return;
    
    const code = this.codeInput?.value?.trim();
    
    // Validação
    if (!this.validateInput(code)) {
      return;
    }
    
    try {
      this.setLoadingState(true);
      this.clearError();
      
      // Verificar código via API (usa o método correto do backend)
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
  
  /**
   * Valida input do usuário
   */
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
    
    // Verificar tentativas
    if (this.attemptCount >= this.maxAttempts) {
      this.showError('Muitas tentativas. Entre em contato conosco.');
      this.codeInput.disabled = true;
      this.loginButton.disabled = true;
      return false;
    }
    
    return true;
  }
  
  /**
   * Lida com sucesso no login
   */
  handleLoginSuccess(data) {
    console.log('✅ Login successful:', data);
    
    // Feedback visual de sucesso
    Utils.addClass(document.body, 'login-success');
    Utils.announceToScreenReader('Login realizado com sucesso. Redirecionando...');
    
    // Salvar dados extras se necessário
    if (data.user) {
      Utils.saveToStorage('user_data', data.user);
    }
    
    // Redirecionar após pequeno delay
    setTimeout(() => {
      this.redirectToGallery();
    }, 1000);
  }
  
  /**
   * Lida com erro no login
   */
  handleLoginError(message) {
    console.error('❌ Login error:', message);
    
    this.attemptCount++;
    
    // Mostrar erro específico baseado na tentativa
    let errorMessage = message;
    
    if (this.attemptCount >= this.maxAttempts) {
      errorMessage = 'Muitas tentativas incorretas. Entre em contato conosco para obter um novo código.';
      this.codeInput.disabled = true;
      this.loginButton.disabled = true;
    } else if (this.attemptCount === this.maxAttempts - 1) {
      errorMessage = `${message} (Última tentativa)`;
    }
    
    this.showError(errorMessage);
    
    // Limpar campo se não atingiu limite
    if (this.attemptCount < this.maxAttempts) {
      this.codeInput.value = '';
      this.focusCodeInput();
    }
    
    // Anunciar erro
    Utils.announceToScreenReader(errorMessage);
  }
  
  /**
   * Define estado de loading
   */
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
  
  /**
   * Mostra erro
   */
  showError(message) {
    if (this.errorContainer) {
      const errorText = this.errorContainer.querySelector('.error-text');
      if (errorText) {
        errorText.textContent = message;
      }
      
      Utils.removeClass(this.errorContainer, 'hidden');
      
      // Auto-hide após 10 segundos
      setTimeout(() => {
        this.clearError();
      }, 10000);
    }
  }
  
  /**
   * Limpa erro
   */
  clearError() {
    if (this.errorContainer) {
      Utils.addClass(this.errorContainer, 'hidden');
    }
  }
  
  /**
   * Foca no input do código
   */
  focusCodeInput() {
    if (this.codeInput && !this.codeInput.disabled) {
      setTimeout(() => {
        this.codeInput.focus();
        this.codeInput.select(); // Selecionar texto existente
      }, 100);
    }
  }
  
  /**
   * Abre modal de contato
   */
  openContactModal() {
    if (this.contactModal) {
      Utils.removeClass(this.contactModal, 'hidden');
      this.contactModal.setAttribute('aria-hidden', 'false');
      
      // Focar no botão de fechar
      const closeButton = this.contactModal.querySelector('.modal-close');
      if (closeButton) {
        closeButton.focus();
      }
      
      // Prevenir scroll do body
      Utils.addClass(document.body, 'modal-open');
      
      Utils.announceToScreenReader('Modal de contato aberto');
    }
  }
  
  /**
   * Fecha modal de contato
   */
  closeContactModal() {
    if (this.contactModal) {
      Utils.addClass(this.contactModal, 'hidden');
      this.contactModal.setAttribute('aria-hidden', 'true');
      
      // Restaurar scroll do body
      Utils.removeClass(document.body, 'modal-open');
      
      // Voltar foco para botão de contato
      const contactButton = Utils.$('#contactButton');
      if (contactButton) {
        contactButton.focus();
      }
      
      Utils.announceToScreenReader('Modal de contato fechado');
    }
  }
  
  /**
   * Redireciona para galeria
   */
  redirectToGallery() {
    // Verificar se tem parâmetro de redirecionamento
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');
    
    if (redirect) {
      window.location.href = decodeURIComponent(redirect);
    } else {
      window.location.href = '/pages/gallery.html';
    }
  }
  
  /**
   * Método de debug para testar funcionalidades
   */
  debug() {
    console.log('🔍 Login Page Debug Info:', {
      isLoading: this.isLoading,
      attemptCount: this.attemptCount,
      maxAttempts: this.maxAttempts,
      hasToken: window.API?.isAuthenticated(),
      elements: {
        form: !!this.form,
        codeInput: !!this.codeInput,
        loginButton: !!this.loginButton,
        errorContainer: !!this.errorContainer,
        contactModal: !!this.contactModal
      }
    });
  }
}

// Adicionar CSS adicional se necessário
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
  
  .slide-in {
    animation: slideIn 0.3s ease-out;
  }
  
  @keyframes slideIn {
    from { transform: translateY(-20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;

// Injetar CSS adicional
const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);

// Inicializar página
const loginPage = new LoginPage();

// Expor para debug
window.LoginPage = loginPage;

// Hot reload helper para desenvolvimento
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  window.addEventListener('keydown', (e) => {
    // Ctrl + R para reload
    if (e.ctrlKey && e.key === 'r') {
      e.preventDefault();
      window.location.reload();
    }
    
    // Ctrl + D para debug
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      loginPage.debug();
    }
  });
}