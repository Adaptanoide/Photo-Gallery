// auth.js
// Show admin login
function showAdminLogin() {
    closeModal('code-entry-modal');
    document.getElementById('admin-login-modal').style.display = 'block';
}

// Admin login function
function adminLogin() {
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  
  if (!email || !password) {
    alert('Please enter both email and password.');
    return;
  }
  
  showLoader();
  
  // Call server-side function to verify credentials
  apiClient.verifyAdminCredentials(email, password)
  .then(function(result) {
    hideLoader();
    if (result.success) {
      // NOVO: Salvar estado no localStorage
      localStorage.setItem('adminLoggedIn', 'true');
      
      closeModal('admin-login-modal');
      loadAdminPanel();
      // Reload categories with admin privileges
      loadCategories();
    } else {
      alert('Login failed: ' + (result.message || 'Invalid credentials'));
    }
  })
  .catch(function(error) {
    hideLoader();
    alert('Login error: ' + error);
  });
}

// Admin logout function
function adminLogout() {
  // NOVO: Remover estado do localStorage
  localStorage.removeItem('adminLoggedIn');
  
  closeModal('admin-panel-modal');
  document.getElementById('code-entry-modal').style.display = 'block';
  
  // If customer was logged in before admin login, reload categories as customer
  if (currentCustomerCode) {
    loadCategories(); // This will now pass false for isAdmin
  }
}

// ENCONTRE a função accessGallery() e ADICIONE melhor tratamento de erro:
function accessGallery() {
  const code = document.getElementById('access-code').value.trim();
  
  if (code.length !== 4 || isNaN(code)) {
    alert('Please enter a valid 4-digit code.');
    return;
  }
  
  showLoader();
  
  // ADICIONE este console.log para debug:
  console.log(`Attempting to validate customer code: ${code}`);
  
  // Verificar código usando API MongoDB em vez de Firebase
  fetch(`/api/db/customerCodes/${code}`)
    .then(response => {
      console.log(`Response status: ${response.status}`); // ADICIONE este log
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('INVALID_CODE');
        }
        throw new Error(`Server error: ${response.status}`);
      }
      return response.json();
    })
    .then(doc => {
      hideLoader();
      
      console.log(`Customer validated: ${doc.customerName}`); // ADICIONE este log
      
      // Code exists and is valid
      localStorage.removeItem('isAdmin');
      
      currentCustomerCode = code;
      closeModal('code-entry-modal');
      
      // Load the customer's saved selections
      loadCustomerSelections(code);
      
      // Show the main content
      document.querySelector('.container').style.display = 'block';
      
      // MODIFICAÇÃO: Chamar a nova função de inicialização
      initializeGallery();
    })
    .catch((error) => {
      hideLoader();
      console.error('Login error:', error); // ADICIONE este log
      
      if (error.message === 'INVALID_CODE') {
        alert('Invalid code. Please check your code and try again.');
      } else {
        alert('Connection error. Please try again later.');
      }
    });
}

// Function to return to login screen after order completion
function returnToLogin() {
  document.body.classList.remove('gallery-active');
  // Clear the cart locally
  cartIds = [];
  updateCartCounter();
  
  // NOVO: Limpar seleções via API em vez de Firebase
  if (currentCustomerCode) {
    apiClient.saveCustomerSelections(currentCustomerCode, [])
      .catch((error) => {
        console.error("Error clearing selections:", error);
      });
  }
  
  // Close the success modal
  closeModal('success-modal');
  
  // Hide the main container
  document.querySelector('.container').style.display = 'none';
  
  // Reset the customer code
  currentCustomerCode = null;
  
  // Show the code entry modal
  document.getElementById('code-entry-modal').style.display = 'block';
  
  // Clear the access code input field
  document.getElementById('access-code').value = '';
}

// Initialize authentication
document.addEventListener('DOMContentLoaded', function() {
  // Hide container until code is entered
  document.querySelector('.container').style.display = 'none';
  
  // Show code entry modal
  document.getElementById('code-entry-modal').style.display = 'block';
  
  // NOVO: Verificar se admin já está logado usando localStorage
  const isAdminLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
  if (isAdminLoggedIn) {
    closeModal('code-entry-modal');
    loadAdminPanel();
  }
  
  // Add event listener for enter key on code input
  document.getElementById('access-code').addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {
      accessGallery();
    }
  });
});