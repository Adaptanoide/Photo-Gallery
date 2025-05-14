// cart.js
// Global variables
let cartIds = [];
let cartModalOpen = false;
let viewingFromCart = false;

// Variáveis adicionais para controle de persistência
let selectionRestorationAttempts = 0;
let pendingSelections = []; // IDs de fotos selecionadas que ainda não foram carregadas
let selectionRestorationComplete = false;

// Add a photo to the cart
function addToCart(photoId) {
  if (!cartIds.includes(photoId)) {
    cartIds.push(photoId);
    updateCartCounter();
    updatePhotoButton(photoId, true);
    
    // Update the lightbox cart count if the lightbox is open
    if (document.getElementById('lightbox').style.display === 'block') {
      updateLightboxCartCount();
    }
    
    // Update cart view if it's open
    if (cartModalOpen) {
      updateCartView();
    }
    
    // Save customer selections to Firebase
    if (currentCustomerCode) {
      saveCustomerSelections();
    }
  }
}

// Remove a photo from the cart
function removeFromCart(photoId) {
  const photoIndex = cartIds.indexOf(photoId);
  if (photoIndex !== -1) {
    // Get the photo name for notification
    const photo = getPhotoById(photoId);
    if (photo) {
      showRemovedNotification(photo.name);
    }
    
    // Remove from array
    cartIds.splice(photoIndex, 1);
    updateCartCounter();
    updatePhotoButton(photoId, false);
    
    // Update the lightbox cart count if the lightbox is open
    if (document.getElementById('lightbox').style.display === 'block') {
      updateLightboxCartCount();
    }
    
    // Update cart view if it's open but not already being updated visually
    if (cartModalOpen && !viewingFromCart) {
      updateCartView();
    }
    
    // Save customer selections to Firebase
    if (currentCustomerCode) {
      saveCustomerSelections();
    }
  }
}

// Update a photo button
function updatePhotoButton(photoId, added) {
  const photoItem = document.getElementById(`photo-${photoId}`);
  if (photoItem) {
    const button = photoItem.querySelector('button');
    if (button) {
      if (added) {
        button.className = 'btn btn-danger';
        button.innerText = 'Remove';
        button.onclick = function(event) {
          event.stopPropagation();
          removeFromCart(photoId);
        };
      } else {
        button.className = 'btn btn-gold';
        button.innerText = 'Select';
        button.onclick = function(event) {
          event.stopPropagation();
          addToCart(photoId);
        };
      }
    }
  }
}

// Update the cart counter
function updateCartCounter() {
  const countElement = document.getElementById('cart-count');
  if (countElement) {
    countElement.innerText = cartIds.length;
  }
  
  const cartPanel = document.getElementById('cart-panel');
  if (cartPanel) {
    if (cartIds.length > 0) {
      cartPanel.style.display = 'block';
    } else {
      cartPanel.style.display = 'none';
    }
  }
}

// Rebuild the cart view
function updateCartView() {
  const cartItemsElement = document.getElementById('cart-items');
  if (!cartItemsElement) return;
  
  if (cartIds.length === 0) {
    cartItemsElement.innerHTML = '<div class="empty-cart-message">Your selection is empty</div>';
    // Atualizar total mesmo quando vazio
    updateCartTotal(0);
    return;
  }
  
  let html = '';
  let totalPrice = 0;
  
  // Add selected photos
  cartIds.forEach(function(photoId) {
    const photo = getPhotoById(photoId);
    if (photo) {
      // Get price if available
      let priceHtml = '';
      if (photo.price !== undefined) {
        const price = parseFloat(photo.price);
        const formattedPrice = `$${price.toFixed(2)}`;
        priceHtml = `<div class="cart-item-price">${formattedPrice}</div>`;
        
        // Add to total
        totalPrice += price;
      }
      
      html += `
        <div id="cart-item-${photoId}" class="cart-item">
          <div class="cart-item-img-container">
            <img src="${photo.thumbnail}" alt="${photo.name}" class="cart-item-img" 
                 onclick="openLightboxById('${photoId}', true)">
            <div class="preview-badge">Click to view</div>
          </div>
          <div style="flex-grow: 1;">
            <div>${photo.name}</div>
            ${priceHtml}
          </div>
          <button class="btn btn-danger" style="width: auto; padding: 6px 10px;" onclick="removeFromCartAndUpdate('${photoId}')">×</button>
        </div>
      `;
    }
  });
  
  cartItemsElement.innerHTML = html;
  
  // Atualizar o total - agora sem adicionar div.cart-summary dentro do container de itens
  updateCartTotal(totalPrice);
}

// FUNÇÃO ATUALIZADA: Atualiza apenas o total no carrinho
function updateCartTotal(totalPrice) {
  // Agora vamos colocar o total em um container dedicado
  const totalContainer = document.getElementById('cart-total-container');
  
  if (!totalContainer) return;
  
  if (totalPrice > 0) {
    // Criar ou atualizar o resumo - removendo caixa flutuante e reduzindo espaçamento
    totalContainer.innerHTML = `
      <div class="cart-summary" style="margin-top: 5px; margin-bottom: 0;">
        <div class="luxury-divider"></div>
        <div class="cart-total" style="display: flex; justify-content: space-between; padding: 8px 5px 5px 5px;">
          <span style="font-weight: bold;">Total:</span>
          <span style="font-weight: bold;">$${totalPrice.toFixed(2)}</span>
        </div>
      </div>
    `;
  } else {
    // Se o total é zero, limpar o container
    totalContainer.innerHTML = '';
  }
}

// Show the cart
function showCart() {
  cartModalOpen = true;
  
  if (cartIds.length === 0) {
    document.getElementById('cart-items').innerHTML = '<div class="empty-cart-message">Your selection is empty</div>';
    document.getElementById('cart-modal').style.display = 'block';
    return;
  }
  
  updateCartView();
  document.getElementById('cart-modal').style.display = 'block';
}

// Remove an item from cart and update display
function removeFromCartAndUpdate(photoId) {
  removeItemFromCartVisually(photoId);
  
  // Short delay to let animation start before updating data model
  setTimeout(() => {
    removeFromCart(photoId);
    
    // If that was the last item, show empty message
    if (cartIds.length === 0) {
      document.getElementById('cart-items').innerHTML = '<div class="empty-cart-message">Your selection is empty</div>';
    }
  }, 100);
}

// Remove item from cart visually with animation
function removeItemFromCartVisually(photoId) {
  const cartItem = document.getElementById(`cart-item-${photoId}`);
  if (cartItem) {
    cartItem.style.animation = 'fadeOut 0.3s ease-out forwards';
    
    // Remove the element after animation completes
    setTimeout(() => {
      if (cartItem.parentNode) {
        cartItem.parentNode.removeChild(cartItem);
      }
      
      // If cart is now empty, show message
      if (cartIds.length <= 1) { // We're checking <= a because we haven't updated cartIds yet
        const cartItemsContainer = document.getElementById('cart-items');
        cartItemsContainer.innerHTML = '<div class="empty-cart-message">Your selection is empty</div>';
      }
    }, 300);
  }
}

// Show notification for item removed
function showRemovedNotification(photoName) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'item-removed-notification';
  notification.textContent = `"${photoName}" removed from selection`;
  document.body.appendChild(notification);
  
  // Fade in
  setTimeout(() => {
    notification.style.opacity = "1";
  }, 10);
  
  // Fade out and remove after delay
  setTimeout(() => {
    notification.style.opacity = "0";
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 500);
  }, 2000);
}

// Submit order
function submitOrder() {
  const comments = document.getElementById('observations').value.trim();
  let customerName = ''; // Will be filled from Firebase
  
  if (!currentCustomerCode) {
    alert('Session error. Please refresh the page and try again.');
    return;
  }
  
  if (cartIds.length === 0) {
    alert('Please select at least one item to proceed.');
    return;
  }
  
  showLoader();
  
  // Get customer name from Firebase
  db.collection('customerCodes').doc(currentCustomerCode).get()
    .then((doc) => {
      if (doc.exists) {
        customerName = doc.data().customerName || 'Unknown Customer';
        
        // Now process the order with the retrieved name
        processOrder(customerName, comments);
      } else {
        hideLoader();
        alert('Error: Customer information not found. Please contact support.');
      }
    })
    .catch((error) => {
      hideLoader();
      alert('Error retrieving customer information: ' + error.message);
    });
}

// FUNÇÃO MODIFICADA: Process order com resposta mais rápida
function processOrder(customerName, comments) {
  apiClient.sendOrder(customerName, comments, cartIds)
  .then(function(result) {
    hideLoader();
    closeModal('cart-modal');
    
    if (result.success) {
      // Limpar seleções na interface (a API já cuidará de limpar no Firebase)
      cartIds = [];
      updateCartCounter();
      
      // MODIFICAÇÃO: Limpar seleções no Firebase localmente, o backend também faz isso
      if (currentCustomerCode) {
        db.collection('customerCodes').doc(currentCustomerCode).update({
          items: []  // Clear the items array
        }).catch(err => console.error("Erro ao limpar itens localmente:", err));
      }
      
      // MODIFICAÇÃO: Atualizar mensagem de sucesso para indicar processamento em segundo plano
      const successMessage = document.querySelector('#success-modal p');
      if (successMessage) {
        successMessage.innerHTML = `Your selection has been submitted to our sales team. The images are being processed and a representative will contact you shortly to discuss your selected premium hides.<br><br>You can close this page now, the processing will continue in the background.`;
      }
      
      // Display success modal
      document.getElementById('success-modal').style.display = 'block';
    } else {
      alert('Error sending order: ' + result.message);
    }
  })
  .catch(function(error) {
    hideLoader();
    alert('Error sending order: ' + error);
  });
}

// MELHORADO: Sistema robusto para salvar seleções do cliente no Firebase
function saveCustomerSelections() {
  if (!currentCustomerCode) return;
  
  // Se estamos no meio de restaurar seleções, não sobrescrever o Firebase
  if (!selectionRestorationComplete && selectionRestorationAttempts > 0) {
    console.log("Ignorando salvamento durante restauração de seleções");
    return;
  }
  
  console.log(`Salvando ${cartIds.length} itens no Firebase`);
  
  // Implementar retry em caso de falha
  function attemptSave(retryCount = 0) {
    db.collection('customerCodes').doc(currentCustomerCode).update({
      items: cartIds,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
      console.log("Seleções salvas com sucesso no Firebase");
      // Não mostrar toast a cada salvamento para não irritar o usuário
    })
    .catch((error) => {
      console.error("Erro ao salvar seleções:", error);
      
      // Retry lógico em caso de erro (até 3 tentativas)
      if (retryCount < 3) {
        console.log(`Tentando novamente (${retryCount + 1}/3)...`);
        setTimeout(() => attemptSave(retryCount + 1), 1000 * (retryCount + 1));
      } else {
        showToast("Não foi possível salvar suas seleções. Verifique sua conexão.", "error");
      }
    });
  }
  
  // Iniciar processo de salvamento
  attemptSave();
}

// COMPLETAMENTE REESCRITA: Função de carregamento de seleções do cliente
function loadCustomerSelections(code) {
  if (!code) return;
  
  // Mostrar indicador de carregamento no painel do carrinho (se visível)
  updateCartPanelMessage("Restaurando sua seleção anterior...");
  
  // Reset dos contadores e flags
  selectionRestorationAttempts = 0;
  pendingSelections = [];
  selectionRestorationComplete = false;
  
  // Registrar evento para quando carregamento completo terminar
  document.addEventListener('galleryLoadingComplete', onGalleryLoadingComplete, { once: true });
  
  // Função principal de carregamento
  function attemptLoadSelections() {
    console.log(`Tentativa ${selectionRestorationAttempts + 1} de restaurar seleções do usuário`);
    
    // Verificar número máximo de tentativas (12 tentativas = 1 minuto)
    if (selectionRestorationAttempts >= 12) {
      console.warn("Número máximo de tentativas alcançado. Algumas seleções podem não ter sido restauradas.");
      finishRestorationProcess();
      return;
    }
    
    selectionRestorationAttempts++;
    
    // Carregar do Firebase
    db.collection('customerCodes').doc(code).get()
      .then((doc) => {
        if (doc.exists && doc.data().items) {
          // Obter IDs salvos
          const savedItems = doc.data().items || [];
          console.log(`${savedItems.length} itens encontrados no Firebase`);
          
          // Se não há itens salvos, finalizar processo
          if (savedItems.length === 0) {
            finishRestorationProcess();
            return;
          }
          
          // Separar os itens em disponíveis e pendentes
          const availableItems = [];
          pendingSelections = [];
          
          savedItems.forEach(itemId => {
            // Verificar se a foto já está disponível
            if (getPhotoById(itemId)) {
              availableItems.push(itemId);
            } else {
              // Guardar para verificação futura
              pendingSelections.push(itemId);
            }
          });
          
          console.log(`${availableItems.length} itens disponíveis, ${pendingSelections.length} pendentes`);
          
          // Atualizar o carrinho com os itens já disponíveis
          cartIds = [...availableItems];
          updateCartCounter();
          updateButtonsForCartItems();
          
          // Se ainda há itens pendentes e algumas categorias não foram carregadas
          if (pendingSelections.length > 0 && !allCategoriesLoaded()) {
            // Agendar próxima verificação
            setTimeout(attemptLoadSelections, 5000); // Verificar a cada 5 segundos
          } else {
            // Concluir o processo
            finishRestorationProcess();
          }
        } else {
          // Documento não existe ou não tem itens
          finishRestorationProcess();
        }
      })
      .catch(error => {
        console.error("Error loading customer selections:", error);
        // Em caso de erro, tentar novamente em 5 segundos
        setTimeout(attemptLoadSelections, 5000);
      });
  }
  
  // Quando a galeria terminar de carregar todas as categorias
  function onGalleryLoadingComplete() {
    console.log("Evento galleryLoadingComplete recebido - verificando seleções pendentes");
    
    // Se ainda temos itens pendentes, verificar se agora estão disponíveis
    if (pendingSelections.length > 0) {
      const newlyAvailable = pendingSelections.filter(itemId => getPhotoById(itemId));
      
      if (newlyAvailable.length > 0) {
        console.log(`${newlyAvailable.length} novos itens agora disponíveis`);
        
        // Adicionar ao carrinho
        cartIds = [...cartIds, ...newlyAvailable];
        
        // Remover dos pendentes
        pendingSelections = pendingSelections.filter(id => !newlyAvailable.includes(id));
        
        // Atualizar UI
        updateCartCounter();
        updateButtonsForCartItems();
        
        if (pendingSelections.length === 0) {
          finishRestorationProcess();
        }
      }
    }
  }
  
  // Finalizar o processo de restauração
  function finishRestorationProcess() {
    selectionRestorationComplete = true;
    
    // Atualizar Firebase com itens realmente disponíveis
    if (cartIds.length > 0 || pendingSelections.length > 0) {
      // Se ainda há itens pendentes, adicionar mensagem
      if (pendingSelections.length > 0) {
        console.warn(`${pendingSelections.length} itens selecionados não puderam ser restaurados`);
        showToast(`${cartIds.length} itens restaurados. Alguns itens podem não estar mais disponíveis.`, 'info');
      } else if (cartIds.length > 0) {
        showToast(`${cartIds.length} itens de sua seleção anterior foram restaurados`, 'success');
      }
      
      // Atualizar Firebase com o que foi realmente restaurado
      saveCustomerSelections();
    }
    
    // Atualizar a UI
    updateCartCounter();
    updateButtonsForCartItems();
    updateCartPanelMessage("");
  }
  
  // Verificar se todas as categorias foram carregadas
  function allCategoriesLoaded() {
    // Se estamos usando carregamento progressivo, verificar loadedCategories
    if (typeof loadedCategories !== 'undefined' && typeof categories !== 'undefined') {
      const totalCategories = categories.filter(cat => !cat.isAll).length;
      const loadedCount = Object.keys(loadedCategories).length;
      return loadedCount >= totalCategories;
    }
    
    return true; // Assumir que sim se não temos como verificar
  }
  
  // Atualizar mensagem no painel do carrinho
  function updateCartPanelMessage(message) {
    const cartPanel = document.getElementById('cart-panel');
    if (!cartPanel) return;
    
    const messageEl = cartPanel.querySelector('.loading-message');
    
    if (message) {
      // Criar ou atualizar elemento de mensagem
      if (messageEl) {
        messageEl.textContent = message;
      } else {
        const newMessageEl = document.createElement('div');
        newMessageEl.className = 'loading-message';
        newMessageEl.style.fontSize = '12px';
        newMessageEl.style.fontStyle = 'italic';
        newMessageEl.style.marginTop = '5px';
        newMessageEl.textContent = message;
        cartPanel.appendChild(newMessageEl);
      }
    } else if (messageEl) {
      // Remover mensagem se vazia
      messageEl.remove();
    }
  }
  
  // Iniciar o processo após um pequeno delay para dar tempo às fotos iniciais carregarem
  setTimeout(attemptLoadSelections, 1000);
}

// NOVA FUNÇÃO: Registrar event listener para salvar seleções antes de fechar a página
function registerBeforeUnloadHandler() {
  window.addEventListener('beforeunload', function() {
    // Só salva se houver alterações não salvas
    if (cartIds.length > 0) {
      saveCustomerSelections();
    }
  });
}

// NOVA FUNÇÃO: Atualizar botões para refletir os itens no carrinho
function updateButtonsForCartItems() {
  console.log("Atualizando botões para refletir o carrinho:", cartIds);
  
  // Para cada item no carrinho
  cartIds.forEach(photoId => {
    // Encontrar o botão correspondente
    const button = document.getElementById(`button-${photoId}`);
    if (button) {
      // Atualizar o botão para mostrar "Remove" e a classe de perigo
      button.textContent = 'Remove';
      button.className = 'btn btn-danger';
      button.onclick = function(event) {
        event.stopPropagation();
        removeFromCart(photoId);
      };
    }
  });
}

// Inicializar o handler beforeUnload quando a página carrega
document.addEventListener('DOMContentLoaded', function() {
  registerBeforeUnloadHandler();
});