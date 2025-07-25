/**
 * SUNSHINE COWHIDES - UTILITIES (VERSÃO LIMPA)
 * Funções utilitárias reutilizáveis
 */

// === DOM UTILITIES ===

function $(selector, parent = document) {
  return parent.querySelector(selector);
}

function $$(selector, parent = document) {
  return parent.querySelectorAll(selector);
}

function createElement(tag, attributes = {}, children = []) {
  const element = document.createElement(tag);
  
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = dataValue;
      });
    } else {
      element.setAttribute(key, value);
    }
  });
  
  if (typeof children === 'string') {
    element.textContent = children;
  } else if (children instanceof Element) {
    element.appendChild(children);
  } else if (Array.isArray(children)) {
    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Element) {
        element.appendChild(child);
      }
    });
  }
  
  return element;
}

// === CLASS UTILITIES ===

function addClass(element, ...classes) {
  if (element) {
    element.classList.add(...classes);
  }
}

function removeClass(element, ...classes) {
  if (element) {
    element.classList.remove(...classes);
  }
}

function toggleClass(element, className) {
  if (element) {
    return element.classList.toggle(className);
  }
  return false;
}

function hasClass(element, className) {
  return element ? element.classList.contains(className) : false;
}

// === VALIDATION UTILITIES ===

function isValidCode(code) {
  return /^\d{4}$/.test(code);
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function sanitizeString(str) {
  return str ? str.toString().trim().replace(/[<>\"'&]/g, '') : '';
}

// === LOADING UTILITIES ===

function setButtonLoading(button, loading = true) {
  if (!button) return;
  
  const btnText = button.querySelector('.btn-text');
  const btnLoading = button.querySelector('.btn-loading');
  
  if (loading) {
    button.disabled = true;
    addClass(button, 'loading');
    if (btnText) addClass(btnText, 'hidden');
    if (btnLoading) removeClass(btnLoading, 'hidden');
  } else {
    button.disabled = false;
    removeClass(button, 'loading');
    if (btnText) removeClass(btnText, 'hidden');
    if (btnLoading) addClass(btnLoading, 'hidden');
  }
}

function toggleElement(element, show = true) {
  if (!element) return;
  
  if (show) {
    removeClass(element, 'hidden');
    element.setAttribute('aria-hidden', 'false');
  } else {
    addClass(element, 'hidden');
    element.setAttribute('aria-hidden', 'true');
  }
}

// === ERROR HANDLING ===

function showError(container, message, duration = 5000) {
  if (!container) return;
  
  const errorElement = container.querySelector('.error-message');
  if (errorElement) {
    const errorText = errorElement.querySelector('.error-text');
    if (errorText) {
      errorText.textContent = message;
    }
    
    toggleElement(errorElement, true);
    
    if (duration > 0) {
      setTimeout(() => {
        toggleElement(errorElement, false);
      }, duration);
    }
  }
}

function hideError(container) {
  if (!container) return;
  
  const errorElement = container.querySelector('.error-message');
  if (errorElement) {
    toggleElement(errorElement, false);
  }
}

// === LOCAL STORAGE UTILITIES ===

function saveToStorage(key, data) {
  try {
    const serializedData = JSON.stringify(data);
    localStorage.setItem(key, serializedData);
    return true;
  } catch (error) {
    console.error('Erro ao salvar no localStorage:', error);
    return false;
  }
}

function loadFromStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Erro ao carregar do localStorage:', error);
    return defaultValue;
  }
}

function removeFromStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Erro ao remover do localStorage:', error);
    return false;
  }
}

// === PERFORMANCE UTILITIES ===

function debounce(func, delay = 300) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

function throttle(func, delay = 100) {
  let lastCall = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return func.apply(this, args);
    }
  };
}

// === ACCESSIBILITY UTILITIES ===

function announceToScreenReader(message) {
  const announcement = createElement('div', {
    'aria-live': 'polite',
    'aria-atomic': 'true',
    className: 'sr-only'
  }, message);
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

// === EXPORTAR PARA USO GLOBAL ===
window.Utils = {
  $,
  $$,
  createElement,
  addClass,
  removeClass,
  toggleClass,
  hasClass,
  isValidCode,
  isValidEmail,
  sanitizeString,
  setButtonLoading,
  toggleElement,
  showError,
  hideError,
  saveToStorage,
  loadFromStorage,
  removeFromStorage,
  debounce,
  throttle,
  announceToScreenReader
};