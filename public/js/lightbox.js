// lightbox.js
// Nova função para abrir o lightbox por ID em vez de índice
function openLightboxById(photoId, fromCart = false) {
  // Verificar se o array de fotos existe
  if (!photos || !Array.isArray(photos) || photos.length === 0) {
    console.warn('Não há fotos carregadas para exibir no lightbox');
    showToast('Aguarde o carregamento das imagens...', 'info');
    return;
  }
  
  // Encontrar a foto pelo ID
  const index = photos.findIndex(p => p.id === photoId);
  
  // Verificar se a foto foi encontrada
  if (index === -1) {
    console.warn(`Foto com ID ${photoId} não encontrada no array global. Pode estar carregando...`);
    showToast('Aguarde o carregamento completo da imagem...', 'info');
    return;
  }
  
  // Abrir lightbox com o índice encontrado
  openLightbox(index, fromCart);
}

// Open the lightbox com visualização em duas etapas
function openLightbox(index, fromCart = false) {
  // Verificação de segurança para garantir que a foto existe
  if (index < 0 || index >= photos.length || !photos[index]) {
    console.error(`Erro: Foto no índice ${index} não encontrada`);
    showToast('Esta foto não está disponível ou ainda está carregando', 'error');
    return;
  }
  
  currentPhotoIndex = index;
  const photo = photos[index];
  viewingFromCart = fromCart;
  
  // Show or hide the return to cart button
  document.querySelector('.return-to-cart').style.display = fromCart ? 'block' : 'none';
  
  // Clear any previous content
  const lightboxImgContainer = document.querySelector('.lightbox-img-container');
  
  // Remove existing content except navigation
  Array.from(lightboxImgContainer.children).forEach(child => {
    if (!child.classList.contains('lightbox-nav')) {
      lightboxImgContainer.removeChild(child);
    }
  });
  
  // Criar container para imagem com posicionamento relativo
  const imgContainer = document.createElement('div');
  imgContainer.className = 'lightbox-img-wrapper';
  imgContainer.style.width = '100%';
  imgContainer.style.height = '100%';
  imgContainer.style.display = 'flex';
  imgContainer.style.alignItems = 'center';
  imgContainer.style.justifyContent = 'center';
  imgContainer.style.position = 'relative';
  imgContainer.style.backgroundColor = '#000';
  
  // Adicionar container antes da navegação
  const nav = lightboxImgContainer.querySelector('.lightbox-nav');
  if (nav) {
    lightboxImgContainer.insertBefore(imgContainer, nav);
  } else {
    lightboxImgContainer.appendChild(imgContainer);
  }
  
  // Criar elemento de imagem para qualidade média (carregamento rápido)
  const imgElement = document.createElement('img');
  imgElement.id = 'lightbox-img-' + Date.now();
  imgElement.className = 'zoom-img';
  imgElement.src = `https://drive.google.com/thumbnail?id=${photo.id}&sz=w1024`; // Versão de média qualidade
  imgElement.alt = photo.name;
  imgElement.style.maxWidth = '100%';
  imgElement.style.maxHeight = '100%';
  imgElement.style.objectFit = 'contain';
  imgElement.dataset.zoomSrc = getDirectImageUrl(photo.id); // URL para versão de alta qualidade
  imgElement.dataset.photoId = photo.id; // Adicionar ID da foto para referência
  imgElement.title = "Clique para ampliar. Use a roda do mouse para controlar o zoom."; // Dica visual
  
  // Adicionar imagem ao container
  imgContainer.appendChild(imgElement);
  
  // Adicionar indicador de carregamento para a versão de alta qualidade
  const loader = document.createElement('div');
  loader.className = 'highres-loader';
  loader.innerHTML = '<div class="spinner"></div><div class="loader-text">Carregando alta resolução...</div>';
  imgContainer.appendChild(loader);
  
  // Adicionar indicador de zoom
  const zoomIndicator = document.createElement('div');
  zoomIndicator.className = 'zoom-indicator';
  zoomIndicator.textContent = 'Use a roda do mouse para zoom';
  zoomIndicator.style.display = 'none';
  imgContainer.appendChild(zoomIndicator);
  
  // Configure other information (price, name, etc)
  let nameText = photo.name;
  
  // Add price information if available
  if (photo.price !== undefined) {
    const formattedPrice = `$${parseFloat(photo.price).toFixed(2)}`;
    nameText += ` - ${formattedPrice}`;
  }
  
  document.getElementById('lightbox-name').textContent = nameText;
  
  // Configure add/remove button
  const addBtn = document.getElementById('lightbox-add-btn');
  const alreadyAdded = cartIds.includes(photo.id);
  
  if (alreadyAdded) {
    addBtn.textContent = 'Remove from Selection';
    addBtn.className = 'btn btn-danger';
  } else {
    addBtn.textContent = 'Add to Selection';
    addBtn.className = 'btn btn-gold';
  }
  
  // Update the cart count in the lightbox
  updateLightboxCartCount();
  
  // Show the lightbox
  document.getElementById('lightbox').style.display = 'block';
  
  // Carregar versão de alta qualidade em background
  const highResImage = new Image();
  highResImage.onload = function() {
    // Atualizar src da imagem para alta resolução
    imgElement.src = this.src;
    
    // Remover loader
    if (loader.parentNode) {
      loader.parentNode.removeChild(loader);
    }
    
    // Inicializar zoom após carregar a versão de alta qualidade
    initializeZoom(imgElement.id);
  };
  
  // Definir handlers de erro
  highResImage.onerror = function() {
    // Se a imagem de alta resolução falhar, manter a média e inicializar zoom
    if (loader.parentNode) {
      loader.parentNode.removeChild(loader);
    }
    console.warn(`Não foi possível carregar a imagem em alta resolução para ${photo.id}`);
    // Inicializar zoom com a versão média mesmo assim
    initializeZoom(imgElement.id);
  };
  
  // Iniciar carregamento da versão de alta resolução
  highResImage.src = getDirectImageUrl(photo.id);
  
  // Pré-carregar imagens adjacentes
  preloadAdjacentImages();
}

// Função para pré-carregar imagens adjacentes
function preloadAdjacentImages() {
  if (currentPhotoIndex >= 0 && photos.length > 1) {
    // Determinar quais índices pré-carregar (anterior e próxima)
    const indicesToPreload = [];
    
    // Lógica diferente para carrinho vs. galeria
    if (viewingFromCart) {
      // No carrinho, navegamos pelos IDs no array cartIds
      const currentPhotoId = photos[currentPhotoIndex].id;
      const currentCartIndex = cartIds.indexOf(currentPhotoId);
      
      if (currentCartIndex > 0) {
        // Anterior no carrinho
        indicesToPreload.push(photos.findIndex(p => p.id === cartIds[currentCartIndex - 1]));
      }
      
      if (currentCartIndex < cartIds.length - 1) {
        // Próxima no carrinho
        indicesToPreload.push(photos.findIndex(p => p.id === cartIds[currentCartIndex + 1]));
      }
    } else {
      // Na galeria normal, usamos índices sequenciais
      // Verificar índice anterior
      if (currentPhotoIndex > 0) {
        indicesToPreload.push(currentPhotoIndex - 1);
      }
      
      // Verificar próximo índice
      if (currentPhotoIndex < photos.length - 1) {
        indicesToPreload.push(currentPhotoIndex + 1);
      }
    }
    
    // Pré-carregar versões médias primeiro, depois alta resolução
    indicesToPreload.forEach(index => {
      if (index >= 0 && index < photos.length) {
        const photoId = photos[index].id;
        
        // Pré-carregar versão média (para navegação rápida)
        const mediumImg = new Image();
        mediumImg.src = `https://drive.google.com/thumbnail?id=${photoId}&sz=w1024`;
        
        // Após carregar versão média, começar a carregar alta resolução
        mediumImg.onload = function() {
          setTimeout(() => {
            const highResImg = new Image();
            highResImg.src = getDirectImageUrl(photoId);
          }, 500); // Atraso para priorizar versão média primeiro
        };
      }
    });
  }
}

// Função para obter URL de imagem direta do Google Drive
function getDirectImageUrl(fileId) {
  // Usar nossa nova API de imagens otimizadas em vez da URL direta do Google Drive
  return `/api/orders/highres-image/${fileId}?quality=92`; // Aumentar qualidade para 92
}

// Função para inicializar o zoom
function initializeZoom(imgId) {
  const img = document.getElementById(imgId);
  if (!img) return;
  
  // Vamos usar direto o zoom nativo para maior controle e simplicidade
  initializeNativeZoom(img);
}

// Função de fallback para zoom nativo
function initializeNativeZoom(img) {
  // Estado inicial
  let scale = 1;
  let panning = false;
  let pointX = 0;
  let pointY = 0;
  let start = { x: 0, y: 0 };
  
  // Função para aplicar transformação
  function setTransform() {
    img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
    
    // Se estiver em zoom, mudar o cursor para indicar que pode arrastar
    if (scale > 1) {
      img.style.cursor = 'grab';
    } else {
      img.style.cursor = 'zoom-in';
    }
  }
  
  // Função para centralizar corretamente a imagem
  function centerImageOnPoint(targetScale) {
    // Obter dimensões do container e da imagem
    const imgRect = img.getBoundingClientRect();
    const containerRect = img.parentElement.getBoundingClientRect();
    
    // Calcular o centro da imagem visível
    const centerX = imgRect.width / 2;
    const centerY = imgRect.height / 2;
    
    // Calcular a diferença entre o centro do container e o centro da imagem
    const offsetX = (containerRect.width - imgRect.width) / 2;
    const offsetY = (containerRect.height - imgRect.height) / 2;
    
    // Calcular quanto a imagem vai crescer
    const growthFactor = targetScale - 1;
    
    // Ajustar o ponto X e Y para manter o centro no zoom
    pointX = -centerX * growthFactor + offsetX * targetScale;
    pointY = -centerY * growthFactor + offsetY * targetScale;
    
    // Aplicar a transformação
    scale = targetScale;
    setTransform();
  }
  
  // Centralizar a imagem em tamanho normal
  function resetZoom() {
    scale = 1;
    pointX = 0;
    pointY = 0;
    setTransform();
  }
  
  // Evento de clique do mouse (para arrastar a imagem)
  img.addEventListener('mousedown', function(e) {
    e.preventDefault();
    if (scale > 1) {
      start = { x: e.clientX - pointX, y: e.clientY - pointY };
      panning = true;
      img.style.cursor = 'grabbing';
    }
  });
  
  // Soltar o botão do mouse
  img.addEventListener('mouseup', function(e) {
    panning = false;
    if (scale > 1) {
      img.style.cursor = 'grab';
    } else {
      img.style.cursor = 'zoom-in';
    }
  });
  
  // Sair do elemento com o mouse
  img.addEventListener('mouseleave', function(e) {
    panning = false;
  });
  
  // Movimento do mouse para arrastar
  img.addEventListener('mousemove', function(e) {
    e.preventDefault();
    if (!panning) return;
    
    pointX = (e.clientX - start.x);
    pointY = (e.clientY - start.y);
    setTransform();
  });
  
  // Evento de roda do mouse para zoom
  img.addEventListener('wheel', function(e) {
    e.preventDefault();
    
    // Se estamos no nível de zoom normal, use o método de centralização
    if (Math.abs(scale - 1) < 0.05) {
      // Determinar direção e aplicar zoom mais suave
      const delta = -e.deltaY * 0.001; // Sensibilidade reduzida
      
      // Aplicar zoom com limites mais baixos
      const newScale = Math.min(Math.max(1, scale + delta * 5), 2.5);
      
      // Se estamos aumentando o zoom do nível normal
      if (newScale > 1) {
        centerImageOnPoint(newScale);
      }
    } else {
      // Já estamos com algum zoom, fazer ajustes finos
      
      // Obter coordenadas da imagem
      const rect = img.getBoundingClientRect();
      
      // Calcular a posição do mouse em relação à imagem
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calcular ponto de referência antes do zoom
      const x = (mouseX - pointX) / scale;
      const y = (mouseY - pointY) / scale;
      
      // Determinar fator de zoom (mais suave)
      const delta = -e.deltaY * 0.0008;
      
      // Aplicar zoom com limite
      const prevScale = scale;
      scale = Math.min(Math.max(1, scale + delta * scale), 2.5);
      
      // Se voltamos ao zoom normal
      if (Math.abs(scale - 1) < 0.05) {
        resetZoom();
      } else {
        // Ajustar posição para manter foco no ponto
        pointX = e.clientX - rect.left - x * scale;
        pointY = e.clientY - rect.top - y * scale;
        setTransform();
      }
    }
    
    // Atualizar indicador de zoom
    updateZoomIndicator();
  }, { passive: false });
  
  // Função para atualizar o indicador de zoom
  function updateZoomIndicator() {
    const zoomIndicator = document.querySelector('.zoom-indicator');
    if (zoomIndicator) {
      if (scale > 1.05) {
        zoomIndicator.style.display = 'block';
        zoomIndicator.textContent = `Zoom: ${Math.round(scale * 100)}%`;
      } else {
        zoomIndicator.style.display = 'none';
      }
    }
  }
  
  // Adicionar dblclick para centralizar zoom
  img.addEventListener('dblclick', function(e) {
    if (scale > 1.05) {
      // Se já tiver zoom, voltar ao normal
      resetZoom();
    } else {
      // Aplicar zoom médio centralizado
      centerImageOnPoint(2);
    }
    
    // Atualizar indicador
    updateZoomIndicator();
  });
  
  // Definir estado inicial
  setTransform();
  
  // Adicionar um indicador de nível de zoom se não existir
  let zoomIndicator = document.querySelector('.zoom-indicator');
  if (!zoomIndicator) {
    zoomIndicator = document.createElement('div');
    zoomIndicator.className = 'zoom-indicator';
    zoomIndicator.textContent = 'Zoom: 100%';
    zoomIndicator.style.display = 'none';
    img.parentElement.appendChild(zoomIndicator);
  }
}

// Close the lightbox
function closeLightbox() {
  // Remover instâncias de zoom se existirem
  if (typeof mediumZoom === 'function') {
    // Remover todas as instâncias Medium Zoom
    const zoomInstances = document.querySelectorAll('.zoom-img');
    zoomInstances.forEach(img => {
      const zoom = mediumZoom(img);
      if (zoom && typeof zoom.detach === 'function') {
        zoom.detach();
      }
    });
  }
  
  // Esconder o lightbox
  document.getElementById('lightbox').style.display = 'none';
  
  // Se estava visualizando a partir do carrinho, atualizar o modal
  if (viewingFromCart && cartModalOpen) {
    // Forçar reconstrução completa do modal
    updateCartView();
    
    // Recalcular total
    let newTotal = 0;
    cartIds.forEach(id => {
      const photo = getPhotoById(id);
      if (photo && photo.price) {
        newTotal += parseFloat(photo.price);
      }
    });
    
    // Atualizar o total
    updateCartTotal(newTotal);
  }
  
  viewingFromCart = false;
}

// Modificado para usar IDs para navegação entre fotos
function navigatePhotos(direction) {
  // Verificação de segurança
  if (currentPhotoIndex < 0 || currentPhotoIndex >= photos.length) {
    return;
  }
  
  // If viewing from cart, only navigate through cart items
  if (viewingFromCart) {
    const currentPhotoId = photos[currentPhotoIndex].id;
    const currentCartIndex = cartIds.indexOf(currentPhotoId);
    if (currentCartIndex === -1) return; // Safety check

    const newCartIndex = currentCartIndex + direction;
    if (newCartIndex >= 0 && newCartIndex < cartIds.length) {
      // Usar ID em vez de índice para maior segurança
      const newIndex = photos.findIndex(p => p.id === cartIds[newCartIndex]);
      if (newIndex >= 0) {
        openLightbox(newIndex, true);
      }
    }
  } else {
    // Normal gallery navigation
    const newIndex = currentPhotoIndex + direction;
    if (newIndex >= 0 && newIndex < photos.length) {
      openLightbox(newIndex, false);
    }
  }
}

// Return to cart view
function returnToCart() {
  closeLightbox();

  // If cart modal isn't visible, show it
  if (document.getElementById('cart-modal').style.display !== 'block') {
    showCart();
  }
}

// Add or remove from cart through lightbox
function addRemoveLightbox() {
  // Verificação de segurança
  if (currentPhotoIndex < 0 || currentPhotoIndex >= photos.length) {
    console.error('Erro: Índice de foto inválido');
    return;
  }
  
  const photo = photos[currentPhotoIndex];
  const alreadyAdded = cartIds.includes(photo.id);

  if (alreadyAdded) {
    // If we're viewing from cart and removing an item
    if (viewingFromCart) {
      // First remove the item from the cart visually if the cart is open
      if (cartModalOpen) {
        removeItemFromCartVisually(photo.id);
      }

      // Then remove it from the data model
      removeFromCart(photo.id);

      // If this was the last item, return to cart view which will show empty message
      if (cartIds.length === 0) {
        closeLightbox();
        if (cartModalOpen) {
          showCart(); // Refresh cart view to show empty state
        }
        return;
      }

      // Otherwise navigate to the next item in cart, or close if none left
      const nextCartIndex = cartIds.length > 0 ? 0 : -1;
      if (nextCartIndex >= 0) {
        // Usar ID em vez de índice
        openLightboxById(cartIds[nextCartIndex], true);
        return;
      }

      // If we couldn't find a next item, close lightbox
      closeLightbox();

    } else {
      // Regular removal from gallery view
      removeFromCart(photo.id);
      
      // Atualizar UI do lightbox
      document.getElementById('lightbox-add-btn').textContent = 'Add to Selection';
      document.getElementById('lightbox-add-btn').className = 'btn btn-gold';
      
      // Atualizar o modal do carrinho se estiver aberto
      if (cartModalOpen) {
        updateCartView();
        
        // Recalcular o total
        let newTotal = 0;
        cartIds.forEach(id => {
          const photo = getPhotoById(id);
          if (photo && photo.price) {
            newTotal += parseFloat(photo.price);
          }
        });
        
        // Atualizar o total no modal
        updateCartTotal(newTotal);
      }
    }
  } else {
    // Adding to cart
    addToCart(photo.id);
    
    // Atualizar UI do lightbox
    document.getElementById('lightbox-add-btn').textContent = 'Remove from Selection';
    document.getElementById('lightbox-add-btn').className = 'btn btn-danger';
    
    // Atualizar o modal do carrinho se estiver aberto
    if (cartModalOpen) {
      updateCartView();
      
      // Recalcular o total
      let newTotal = 0;
      cartIds.forEach(id => {
        const photo = getPhotoById(id);
        if (photo && photo.price) {
          newTotal += parseFloat(photo.price);
        }
      });
      
      // Atualizar o total no modal
      updateCartTotal(newTotal);
    }
  }

  // Update the cart count in the lightbox
  updateLightboxCartCount();
}

// Update the cart count in the lightbox
function updateLightboxCartCount() {
  document.getElementById('lightbox-cart-count').innerText = cartIds.length;
}