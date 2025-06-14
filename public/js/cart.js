// cart.js
// Global variables
let cartIds = [];
let cartModalOpen = false;
let viewingFromCart = false;

// Variáveis adicionais para controle de persistência
let selectionRestorationAttempts = 0;
let pendingSelections = []; // IDs de fotos selecionadas que ainda não foram carregadas
let selectionRestorationComplete = false;

// Função para buscar volume discounts do cliente atual
async function getCustomerVolumeDiscounts() {
  if (!currentCustomerCode) return [];
  
  try {
    const response = await fetch(`/api/admin/customers/${currentCustomerCode}/category-access`);
    if (!response.ok) return [];
    
    const result = await response.json();
    if (result.success && result.data) {
      return result.data.volumeDiscounts || [];
    }
    return [];
  } catch (error) {
    console.error('Erro ao buscar volume discounts:', error);
    return [];
  }
}

// Função para calcular desconto baseado na quantidade
function calculateVolumeDiscount(quantity, volumeDiscounts) {
  if (!volumeDiscounts || volumeDiscounts.length === 0) return 0;
  
  // Encontrar o range aplicável
  let applicableDiscount = 0;
  
  for (const discount of volumeDiscounts) {
    const minQty = discount.minQuantity;
    const maxQty = discount.maxQuantity;
    
    // Verificar se a quantidade está no range
    if (quantity >= minQty && (maxQty === null || quantity <= maxQty)) {
      applicableDiscount = Math.max(applicableDiscount, discount.discountPercent);
    }
  }
  
  return applicableDiscount;
}

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

  // Iniciar monitoramento se for o primeiro item
    if (cartIds.length === 1) {
      startCartMonitoring();
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
    
    // Parar monitoramento se carrinho ficou vazio
    if (cartIds.length === 0) {
      stopCartMonitoring();
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
async function updateCartView() {
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
  await updateCartTotal(totalPrice);
}

// FUNÇÃO ATUALIZADA: Atualiza o total no carrinho COM volume discounts
async function updateCartTotal(totalPrice) {
  const totalContainer = document.getElementById('cart-total-container');
  
  if (!totalContainer) return;
  
  if (totalPrice > 0) {
    // Buscar volume discounts do cliente
    const volumeDiscounts = await getCustomerVolumeDiscounts();
    
    // Calcular desconto baseado na quantidade de fotos
    const photoQuantity = cartIds.length;
    const discountPercent = calculateVolumeDiscount(photoQuantity, volumeDiscounts);
    
    // Calcular valores
    const discountAmount = (totalPrice * discountPercent) / 100;
    const finalPrice = totalPrice - discountAmount;
    
    // Criar HTML do resumo
    let summaryHtml = `
      <div class="cart-summary" style="margin-top: 5px; margin-bottom: 0;">
        <div class="luxury-divider"></div>
        <div style="display: flex; justify-content: space-between; padding: 4px 5px; color: #666;">
          <span>Subtotal (${photoQuantity} photos):</span>
          <span>$${totalPrice.toFixed(2)}</span>
        </div>
    `;
    
    // Mostrar desconto apenas se houver
    if (discountPercent > 0) {
      summaryHtml += `
        <div style="display: flex; justify-content: space-between; padding: 4px 5px; color: #e74c3c;">
          <span>Volume Discount (${discountPercent}%):</span>
          <span>-$${discountAmount.toFixed(2)}</span>
        </div>
      `;
    }
    
    // Total final
    summaryHtml += `
        <div class="cart-total" style="display: flex; justify-content: space-between; padding: 8px 5px 5px 5px;">
          <span style="font-weight: bold;">Total:</span>
          <span style="font-weight: bold;">$${finalPrice.toFixed(2)}</span>
        </div>
      </div>
    `;
    
    totalContainer.innerHTML = summaryHtml;
  } else {
    // Se o total é zero, limpar o container
    totalContainer.innerHTML = '';
  }
}

// Show the cart
function showCart() {
  cartModalOpen = true;
  
  // Iniciar pulso quando carrinho abre
  setTimeout(startDetailsPulse, 500);

  if (cartIds.length === 0) {
    document.getElementById('cart-items').innerHTML = '<div class="empty-cart-message">Your selection is empty</div>';
    document.getElementById('cart-modal').style.display = 'block';
    document.body.classList.add('cart-open');
    return;
  }
  
  // ✅ PRELOAD SEGURO das fotos do carrinho
  ensureCartPhotosAvailable();
  
  updateCartView();
  document.getElementById('cart-modal').style.display = 'block';
  document.body.classList.add('cart-open');
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
  const comments = ''; // Removed special instructions functionality
  
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
      
      // 🔧 LÓGICA DE CONFLITOS - TRADUZIDA PARA INGLÊS
      let successMessage = '';
      
      if (result.removedPhotos && result.removedPhotos > 0) {
        // Houve conflitos - algumas fotos foram removidas
        successMessage = `
          <div style="margin-bottom: 15px;">
            <strong>✅ Order submitted successfully!</strong>
          </div>
          
          <div style="background: rgba(255, 193, 7, 0.1); padding: 10px; border-radius: 5px; margin-bottom: 15px; border-left: 4px solid #ffc107;">
            <strong>⚠️ Notice:</strong> ${result.removedPhotos} photo(s) had already been sold to other customers and were automatically removed from your selection.
          </div>
          
          <div>
            <strong>📦 Your order has been processed with ${result.processedPhotos} photos.</strong><br><br>
            Our sales team will contact you shortly to discuss the selected products.
          </div>
          
          <div style="margin-top: 15px; font-size: 14px; color: #666;">
            You can close this page now. Processing will continue in the background.
          </div>
        `;
      } else {
        // Sem conflitos - usar o HTML inglês existente (não sobrescrever)
        // O modal já tem o conteúdo correto em inglês
        successMessage = null; // Não sobrescrever o HTML existente
      }
      
      // Atualizar modal de sucesso APENAS se houver conflitos
      if (successMessage) {
        const successMessageElement = document.querySelector('#success-modal .modal-content > div');
        if (successMessageElement) {
          successMessageElement.innerHTML = successMessage;
        }
      }
      
      // Mostrar modal de sucesso
      document.getElementById('success-modal').style.display = 'block';
      document.body.classList.add('success-open');
      
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

// 🔍 VERIFICAÇÃO INTELIGENTE DO CARRINHO
let cartCheckInterval = null;

// Iniciar verificação periódica (só se carrinho não vazio)
function startCartMonitoring() {
  // Parar monitoramento anterior se existir
  if (cartCheckInterval) {
    clearInterval(cartCheckInterval);
  }
  
  // Só monitorar se há itens no carrinho
  if (cartIds.length === 0) {
    console.log('🔍 Carrinho vazio, não iniciando monitoramento');
    return;
  }
  
  console.log(`🔍 Iniciando monitoramento de ${cartIds.length} itens no carrinho`);
  
  // Verificar a cada 3 minutos
  cartCheckInterval = setInterval(() => {
    if (cartIds.length > 0) {
      checkCartAvailability();
    } else {
      stopCartMonitoring();
    }
  }, 3 * 60 * 1000); // 3 minutos
}

// Parar verificação periódica
function stopCartMonitoring() {
  if (cartCheckInterval) {
    clearInterval(cartCheckInterval);
    cartCheckInterval = null;
    console.log('🔍 Monitoramento do carrinho parado');
  }
}

// Verificar disponibilidade dos itens no carrinho
async function checkCartAvailability() {
  if (cartIds.length === 0) return;
  
  try {
    console.log(`🔍 Verificando disponibilidade de ${cartIds.length} itens do carrinho...`);
    
    const response = await fetch('/api/photos/check-availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoIds: cartIds })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      console.error('Erro na verificação do carrinho:', result.message);
      return;
    }
    
    const unavailableItems = [];
    
    // Verificar cada item
    cartIds.forEach(photoId => {
      const availability = result.results[photoId];
      if (!availability || !availability.available) {
        unavailableItems.push(photoId);
      }
    });
    
    // Se há itens indisponíveis, remover e avisar
    if (unavailableItems.length > 0) {
      console.log(`⚠️ ${unavailableItems.length} itens do carrinho já foram vendidos`);
      
      // Remover itens indisponíveis
      unavailableItems.forEach(photoId => {
        removeFromCart(photoId);
        markPhotoAsSoldInInterface(photoId);
      });
      
      // Mostrar notificação
      showCartUpdateNotification(unavailableItems.length);
    } else {
      console.log('✅ Todos os itens do carrinho ainda estão disponíveis');
    }
    
  } catch (error) {
    console.error('Erro ao verificar disponibilidade do carrinho:', error);
  }
}

// 🎨 Marcar foto como vendida na interface
function markPhotoAsSoldInInterface(photoId) {
  const photoElement = document.getElementById(`photo-${photoId}`);
  if (photoElement) {
    photoElement.classList.add('sold');
    
    // Desabilitar clique
    photoElement.onclick = null;
    photoElement.style.cursor = 'not-allowed';
    
    // Desabilitar botão
    const button = photoElement.querySelector('button');
    if (button) {
      button.disabled = true;
      button.textContent = 'SOLD';
      button.onclick = null;
    }
    
    console.log(`🎨 Foto ${photoId} marcada como vendida na interface`);
  }
}

// 🔧 NOVA FUNÇÃO: Notificação elegante para itens removidos
function showCartUpdateNotification(removedCount) {
  // Criar overlay
  const overlay = document.createElement('div');
  overlay.className = 'cart-notification-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;
  
  // Criar modal
  const modal = document.createElement('div');
  modal.className = 'cart-notification-modal';
  modal.style.cssText = `
    background: white;
    padding: 30px;
    border-radius: 10px;
    max-width: 400px;
    text-align: center;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  `;
  
  modal.innerHTML = `
    <h3 style="color: #ff6b6b; margin-bottom: 15px;">⚠️ Cart Updated</h3>
    <p style="color: #333; margin-bottom: 20px;">
      ${removedCount} item(s) were removed from your cart because they were purchased by other customers.
    </p>
    <button class="btn btn-gold" onclick="closeCartNotification(this)">
      Close & Update Gallery
    </button>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// Função auxiliar para fechar notificação
function closeCartNotification(button) {
  const overlay = button.closest('.cart-notification-overlay');
  if (overlay) {
    overlay.remove();
  }
  
  // Atualizar interface removendo thumbnails vendidas
  if (typeof checkAndRemoveSoldPhotosFromInterface === 'function') {
    checkAndRemoveSoldPhotosFromInterface();
  }
}

// Inicializar o handler beforeUnload quando a página carrega
document.addEventListener('DOMContentLoaded', function() {
  registerBeforeUnloadHandler();
});

// Função para mostrar breakdown detalhado do pedido
function showOrderBreakdown() {
  const breakdown = calculateOrderBreakdown();
  renderBreakdownModal(breakdown);
  document.getElementById('order-breakdown-modal').style.display = 'block';
}

// Função para calcular breakdown por categoria
function calculateOrderBreakdown() {
  const categoryBreakdown = {};
  let totalPrice = 0;
  let totalPhotos = 0;
  
  // Agrupar fotos por categoria
  cartIds.forEach(photoId => {
    const photo = getPhotoById(photoId);
    if (!photo) return;
    
    const folderId = photo.folderId || 'uncategorized';
    const price = parseFloat(photo.price) || 0;
    
    if (!categoryBreakdown[folderId]) {
      categoryBreakdown[folderId] = {
        name: getCategoryNameById(folderId),
        photos: [],
        count: 0,
        totalPrice: 0
      };
    }
    
    categoryBreakdown[folderId].photos.push(photo);
    categoryBreakdown[folderId].count++;
    categoryBreakdown[folderId].totalPrice += price;
    
    totalPrice += price;
    totalPhotos++;
  });
  
  return {
    categories: categoryBreakdown,
    totalPrice,
    totalPhotos
  };
}

// Função para obter nome da categoria pelo ID
function getCategoryNameById(folderId) {
  if (folderId === 'uncategorized') {
    return 'Uncategorized';
  }
  
  if (typeof categories !== 'undefined' && categories.length > 0) {
    const category = categories.find(cat => cat.id === folderId);
    return category ? category.name : `Category ${folderId.substring(0, 8)}...`;
  }
  
  return `Category ${folderId.substring(0, 8)}...`;
}

// Função para renderizar o modal de breakdown
async function renderBreakdownModal(breakdown) {
  const container = document.getElementById('breakdown-content');
  
  // Buscar volume discounts para mostrar desconto aplicado
  const volumeDiscounts = await getCustomerVolumeDiscounts();
  const discountPercent = calculateVolumeDiscount(breakdown.totalPhotos, volumeDiscounts);
  const discountAmount = (breakdown.totalPrice * discountPercent) / 100;
  const finalPrice = breakdown.totalPrice - discountAmount;
  
  let html = `
    <div style="max-height: 400px; overflow-y: auto; margin-bottom: 20px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background-color: #f8f9fa; border-bottom: 2px solid #ddd;">
            <th style="padding: 12px 8px; text-align: left; border-right: 1px solid #ddd;">Category</th>
            <th style="padding: 12px 8px; text-align: center; border-right: 1px solid #ddd;">Photos</th>
            <th style="padding: 12px 8px; text-align: right;">Price</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  // Ordenar categorias por preço (maior primeiro)
  const sortedCategories = Object.entries(breakdown.categories)
    .sort(([,a], [,b]) => b.totalPrice - a.totalPrice);
  
  sortedCategories.forEach(([folderId, category]) => {
    html += `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px 8px; border-right: 1px solid #eee;">
          <strong>${category.name}</strong>
        </td>
        <td style="padding: 10px 8px; text-align: center; border-right: 1px solid #eee;">
          ${category.count}
        </td>
        <td style="padding: 10px 8px; text-align: right;">
          <strong>$${category.totalPrice.toFixed(2)}</strong>
        </td>
      </tr>
    `;
  });
  
  html += `
        </tbody>
      </table>
    </div>
    
    <div style="border-top: 2px solid #ddd; padding-top: 15px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span><strong>Subtotal (${breakdown.totalPhotos} photos):</strong></span>
        <span><strong>$${breakdown.totalPrice.toFixed(2)}</strong></span>
      </div>
  `;
  
  if (discountPercent > 0) {
    html += `
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #e74c3c;">
        <span>Volume Discount (${discountPercent}%):</span>
        <span>-$${discountAmount.toFixed(2)}</span>
      </div>
    `;
  }
  
  html += `
      <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; border-top: 1px solid #ddd; padding-top: 10px;">
        <span>Final Total:</span>
        <span>$${finalPrice.toFixed(2)}</span>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

// CONTROLE BÁSICO DO PULSO DO BOTÃO DETAILS
function startDetailsPulse() {
  const detailsBtn = document.getElementById('details-btn');
  if (detailsBtn) {
    detailsBtn.classList.add('details-pulse');
  }
}

function stopDetailsPulse() {
  const detailsBtn = document.getElementById('details-btn');
  if (detailsBtn) {
    detailsBtn.classList.remove('details-pulse');
  }
}