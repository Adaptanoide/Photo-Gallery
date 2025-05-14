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
    auth.signOut().then(() => {
      closeModal('admin-panel-modal');
      document.getElementById('code-entry-modal').style.display = 'block';
      
      // If customer was logged in before admin login, reload categories as customer
      if (currentCustomerCode) {
        loadCategories(); // This will now pass false for isAdmin
      }
    });
  }
  
// Access gallery with code
function accessGallery() {
  const code = document.getElementById('access-code').value.trim();
  
  if (code.length !== 4 || isNaN(code)) {
    alert('Please enter a valid 4-digit code.');
    return;
  }
  
  showLoader();
  
  // NOVO: Limpar cache no servidor
  fetch('/api/client/clear-cache', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }).catch(err => console.error("Erro ao limpar cache:", err));

  // Check if code exists
  db.collection('customerCodes').doc(code).get()
    .then((doc) => {
      hideLoader();
      
      if (doc.exists) {
        // Make sure admin status is cleared for client login
        localStorage.removeItem('isAdmin');
        
        currentCustomerCode = code;
        closeModal('code-entry-modal');
        
        // Load the customer's saved selections
        loadCustomerSelections(code);
        
        // Show the main content
        document.querySelector('.container').style.display = 'block';
        
        // Load categories explicitly as non-admin
        loadCategories(false);
      } else {
        alert('Invalid code. Please check your code and try again.');
      }
    })
    .catch((error) => {
      hideLoader();
      alert('Error accessing gallery: ' + error.message);
    });
}
  
  // Function to return to login screen after order completion
  function returnToLogin() {
    // Clear the cart locally
    cartIds = [];
    updateCartCounter();
    
    // Clear selections in Firebase
    if (currentCustomerCode) {
      db.collection('customerCodes').doc(currentCustomerCode).update({
        items: [],  // Clear the items array
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      })
      .catch((error) => {
        console.error("Error clearing selections in Firebase:", error);
      });
    }
    
    // Close the success modal
    closeModal('success-modal');
    
    // Hide the main container
    document.querySelector('.container').style.display = 'none';
    
    // Reset the customer code (do this after clearing Firebase)
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
    
    // Check if admin is already logged in
    auth.onAuthStateChanged(function(user) {
      if (user) {
        // Admin is logged in, hide entry screen and show admin panel
        closeModal('code-entry-modal');
        loadAdminPanel();
      }
    });
    
    // Add event listener for enter key on code input
    document.getElementById('access-code').addEventListener('keyup', function(event) {
      if (event.key === 'Enter') {
        accessGallery();
      }
    });
  });