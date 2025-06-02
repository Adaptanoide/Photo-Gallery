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
  
  // ✅ PRELOAD SEGURO das fotos do carrinho
  ensureCartPhotosAvailable();
  
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

// MODIFIED: Submit order function - replace Firebase doc.get() 
function submitOrder() {
  const comments = document.getElementById('observations').value.trim();
  
  if (!currentCustomerCode) {
    alert('Session error. Please refresh the page and try again.');
    return;
  }
  
  if (cartIds.length === 0) {
    alert('Please select at least one item to proceed.');
    return;
  }
  
  showLoader();
  
  // MODIFIED: Get customer name from MongoDB instead of Firebase
  fetch(`/api/db/customerCodes/${currentCustomerCode}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to retrieve customer information');
      }
      return response.json();
    })
    .then(doc => {
      const customerName = doc.customerName || 'Unknown Customer';
      
      // Now process the order with the retrieved name
      processOrder(customerName, comments);
    })
    .catch((error) => {
      hideLoader();
      alert('Error retrieving customer information: ' + error.message);
    });
}

function processOrder(customerName, comments) {
  apiClient.sendOrder(customerName, comments, cartIds)
  .then(function(result) {
    hideLoader();
    closeModal('cart-modal');
    
    if (result.success) {
      // Limpar seleções na interface
      cartIds = [];
      updateCartCounter();
      
      // Limpar seleções no MongoDB
      if (currentCustomerCode) {
        apiClient.saveCustomerSelections(currentCustomerCode, [])
          .catch(err => console.error("Erro ao limpar seleções:", err));
      }
      
      // 🔧 NOVA LÓGICA: Verificar se houve conflitos
      let successMessage = '';
      
      if (result.removedPhotos && result.removedPhotos > 0) {
        // Houve conflitos - algumas fotos foram removidas
        successMessage = `
          <div style="margin-bottom: 15px;">
            <strong>✅ Pedido enviado com sucesso!</strong>
          </div>
          
          <div style="background: rgba(255, 193, 7, 0.1); padding: 10px; border-radius: 5px; margin-bottom: 15px; border-left: 4px solid #ffc107;">
            <strong>⚠️ Atenção:</strong> ${result.removedPhotos} foto(s) já haviam sido vendidas por outros clientes e foram removidas automaticamente da sua seleção.
          </div>
          
          <div>
            <strong>📦 Seu pedido foi processado com ${result.processedPhotos} fotos.</strong><br><br>
            Nossa equipe de vendas entrará em contato em breve para discutir os produtos selecionados.
          </div>
          
          <div style="margin-top: 15px; font-size: 14px; color: #666;">
            Você pode fechar esta página agora. O processamento continuará em segundo plano.
          </div>
        `;
      } else {
        // Sem conflitos - mensagem normal
        successMessage = `
          <div>
            <strong>✅ Pedido enviado com sucesso!</strong><br><br>
            Todas as ${result.processedPhotos} fotos selecionadas estão sendo processadas. 
            Nossa equipe de vendas entrará em contato em breve.
          </div>
          
          <div style="margin-top: 15px; font-size: 14px; color: #666;">
            Você pode fechar esta página agora. O processamento continuará em segundo plano.
          </div>
        `;
      }
      
      // Atualizar modal de sucesso
      const successMessageElement = document.querySelector('#success-modal p');
      if (successMessageElement) {
        successMessageElement.innerHTML = successMessage;
      }
      
      // Mostrar modal de sucesso
      document.getElementById('success-modal').style.display = 'block';
      
    } else {
      // Erro no processamento
      handleOrderError(result);
    }
  })
  .catch(function(error) {
    hideLoader();
    handleOrderError(error);
  });
}

// 🔧 NOVA FUNÇÃO: Tratar erros de pedido
function handleOrderError(error) {
  console.error('Order error:', error);
  
  // Verificar se é erro de conflito total
  if (error.conflictType === 'all_unavailable') {
    // Todas as fotos foram vendidas
    alert(`❌ Todas as fotos selecionadas já foram vendidas por outros clientes.\n\nSua seleção foi limpa automaticamente.\n\nPor favor, selecione outras fotos e tente novamente.`);
    
    // Limpar carrinho local
    cartIds = [];
    updateCartCounter();
    
    // Recarregar página para mostrar estado atualizado
    setTimeout(() => {
      window.location.reload();
    }, 2000);
    
  } else {
    // Outros tipos de erro
    const message = error.message || 'Erro desconhecido ao processar pedido';
    alert(`❌ Erro ao enviar pedido:\n\n${message}\n\nTente novamente.`);
  }
}

// MODIFIED: Save customer selections - replace Firebase update()
function saveCustomerSelections() {
  if (!currentCustomerCode) return;
  
  // If we're in the middle of restoring selections, don't overwrite
  if (!selectionRestorationComplete && selectionRestorationAttempts > 0) {
    console.log("Ignoring save during selection restoration");
    return;
  }
  
  console.log(`Saving ${cartIds.length} items to MongoDB`);
  
  // Implement retry logic for API call
  function attemptSave(retryCount = 0) {
    // MODIFIED: Use API endpoint instead of Firebase
    apiClient.saveCustomerSelections(currentCustomerCode, cartIds)
      .then(() => {
        console.log("Selections saved successfully");
      })
      .catch((error) => {
        console.error("Error saving selections:", error);
        
        // Retry logic (up to 3 attempts)
        if (retryCount < 3) {
          console.log(`Retrying (${retryCount + 1}/3)...`);
          setTimeout(() => attemptSave(retryCount + 1), 1000 * (retryCount + 1));
        } else {
          showToast("Unable to save your selections. Please check your connection.", "error");
        }
      });
  }
  
  // Start the save process
  attemptSave();
}

// MODIFIED: Load customer selections - replace Firebase doc.get()
function loadCustomerSelections(code) {
  if (!code) return;
  
  // Show loading indicator in cart panel (if visible)
  updateCartPanelMessage("Restoring your previous selection...");
  
  // Reset counters and flags
  selectionRestorationAttempts = 0;
  pendingSelections = [];
  selectionRestorationComplete = false;
  
  // Register event for when gallery loading completes
  document.addEventListener('galleryLoadingComplete', onGalleryLoadingComplete, { once: true });
  
  // Main loading function
  function attemptLoadSelections() {
    console.log(`Attempt ${selectionRestorationAttempts + 1} to restore user selections`);
    
    // Check maximum attempts (12 attempts = 1 minute)
      if (selectionRestorationAttempts >= 3) { // ✅ REDUZIR de 12 para 3 tentativas
      console.warn("Maximum number of attempts reached. Some selections may not have been restored.");
      finishRestorationProcess();
      return;
    }
    
    selectionRestorationAttempts++;
    
    // MODIFIED: Load from MongoDB instead of Firebase
    fetch(`/api/db/customerCodes/${code}`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to retrieve customer data');
        }
        return response.json();
      })
      .then(doc => {
        const savedItems = doc.items || [];
        console.log(`${savedItems.length} items found in database`);
        
        // If no saved items, finish process
        if (savedItems.length === 0) {
          finishRestorationProcess();
          return;
        }
        
        // Separate items into available and pending
        const availableItems = [];
        pendingSelections = [];
        
        savedItems.forEach(itemId => {
          // Check if photo is already available
          if (getPhotoById(itemId)) {
            availableItems.push(itemId);
          } else {
            // Store for future checks
            pendingSelections.push(itemId);
          }
        });
        
        console.log(`${availableItems.length} items available, ${pendingSelections.length} pending`);
        
        // Update cart with available items
        cartIds = [...availableItems];
        updateCartCounter();
        updateButtonsForCartItems();
        
        // If there are still pending items and some categories haven't loaded
        if (pendingSelections.length > 0 && !allCategoriesLoaded()) {
          // Schedule next check
          setTimeout(attemptLoadSelections, 5000); // Check every 5 seconds
        } else {
          // Complete the process
          finishRestorationProcess();
        }
      })
      .catch(error => {
        console.error("Error loading customer selections:", error);
        // On error, try again in 5 seconds
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

// ✅ FUNÇÃO PROTEGIDA: Atualizar botões com proteção contra múltiplos cliques
function updateButtonsForCartItems() {
  console.log("Atualizando botões para refletir o carrinho:", cartIds);
  
  // ✅ PROTEÇÃO: Não atualizar durante restauração ativa
  if (!selectionRestorationComplete && selectionRestorationAttempts > 0) {
    console.log("Aguardando restauração completar antes de atualizar botões...");
    setTimeout(() => updateButtonsForCartItems(), 1000);
    return;
  }
  
  // Para cada item no carrinho
  cartIds.forEach(photoId => {
    // Encontrar o botão correspondente
    const button = document.getElementById(`button-${photoId}`);
    if (button) {
      try {
        // Atualizar o botão para mostrar "Remove" e a classe de perigo
        button.textContent = 'Remove';
        button.className = 'btn btn-danger';
        
        // ✅ PROTEÇÃO COMPLETA: Debounce + disabled state
        button.onclick = function(event) {
          event.stopPropagation();
          
          // Verificar se botão já está processando
          if (button.disabled || button.dataset.processing === 'true') {
            console.log(`Button ${photoId} already processing, ignoring click`);
            return;
          }
          
          // Marcar como processando
          button.disabled = true;
          button.dataset.processing = 'true';
          button.textContent = 'Removing...';
          
          // Executar remoção
          removeFromCart(photoId);
          
          // Limpar estado após processamento
          setTimeout(() => {
            if (button) {
              button.disabled = false;
              button.dataset.processing = 'false';
              // Texto será atualizado pela próxima chamada updateButtonsForCartItems
            }
          }, 800);
        };
        
        // Garantir que botão está habilitado inicialmente
        button.disabled = false;
        button.dataset.processing = 'false';
        
      } catch (error) {
        console.error(`Erro ao atualizar botão ${photoId}:`, error);
      }
    }
  });
}

// ✅ FUNÇÃO CORRIGIDA: Garantir que fotos do carrinho estejam disponíveis
function ensureCartPhotosAvailable() {
  cartIds.forEach(photoId => {
    // Verificar se foto está no photoRegistry E no array global photos
    const inRegistry = getPhotoById && getPhotoById(photoId);
    const inGlobalArray = typeof photos !== 'undefined' && photos.find(p => p.id === photoId);
    
    if (!inRegistry || !inGlobalArray) {
      console.log(`Ensuring cart photo availability: ${photoId}`);
      
      // Criar objeto foto padrão
      const photoData = {
        id: photoId,
        thumbnail: `/api/photos/local/thumbnail/${photoId}`,
        name: `Photo ${photoId}`,
        price: 0,
        folderId: null
      };
      
      // ✅ CRÍTICO: Adicionar ao photoRegistry se não existir
      if (typeof photoRegistry !== 'undefined' && !inRegistry) {
        photoRegistry[photoId] = photoData;
        console.log(`Added photo ${photoId} to photoRegistry`);
      }
      
      // ✅ SUPER CRÍTICO: Adicionar ao array global photos para lightbox funcionar
      if (typeof photos !== 'undefined' && !inGlobalArray) {
        photos.push(photoData);
        console.log(`Added photo ${photoId} to global photos array for lightbox`);
      }
    }
  });
}

// ✅ FUNÇÃO PARA ABRIR LIGHTBOX EXCLUSIVO DO CARRINHO
function openCartLightbox(photoId) {
  console.log(`[CART] Opening cart lightbox for photo: ${photoId}`);
  
  // Criar array apenas com fotos do carrinho
  const cartPhotosData = cartIds.map(id => {
    // Se a foto já está no registry, usar ela
    let photo = getPhotoById(id);
    
    // Se não está disponível, criar objeto básico
    if (!photo) {
      photo = {
        id: id,
        thumbnail: `/api/photos/local/thumbnail/${id}`,
        name: `Photo ${id}`,
        price: 0
      };
    }
    
    return photo;
  });
  
  // Encontrar índice da foto clicada
  const photoIndex = cartIds.indexOf(photoId);
  
  // Abrir lightbox específico do carrinho
  if (typeof openCartOnlyLightbox === 'function') {
    openCartOnlyLightbox(cartPhotosData, photoIndex);
  } else {
    console.error('[CART] Cart lightbox function not found in lightbox.js');
  }
}

// Inicializar o handler beforeUnload quando a página carrega
document.addEventListener('DOMContentLoaded', function() {
  registerBeforeUnloadHandler();
});