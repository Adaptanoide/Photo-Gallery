// lightbox.js
let currentCategoryIndex = 0; // Índice da categoria atual
let isTransitioningCategory = false; // Flag para evitar múltiplas transições

function preloadNextImages(count) {
  for (let i = 1; i <= count; i++) {
    const idx = currentPhotoIndex + i;
    if (idx < photos.length) {
      const id = photos[idx].id;
      // PRELOAD DIRETO da alta resolução (sem thumbnail)
      const hi = new Image();
      hi.src = getDirectImageUrl(id);
    }
  }
}

function openLightboxById(photoId, fromCart = false) {
  // Verificar se o array de fotos existe
  if (!photos || !Array.isArray(photos) || photos.length === 0) {
    console.warn('Não há fotos carregadas para exibir no lightbox');
    showToast('Aguarde o carregamento das imagens...', 'info');
    return;
  }

  // 🔍 NOVA VERIFICAÇÃO: Checar se foto ainda está disponível
  checkPhotoAvailabilityBeforeLightbox(photoId, fromCart);
}

// 🔍 NOVA FUNÇÃO: Verificar disponibilidade antes de abrir lightbox
async function checkPhotoAvailabilityBeforeLightbox(photoId, fromCart) {
  try {
    console.log(`🔍 Verificando disponibilidade da foto: ${photoId}`);
    
    const response = await fetch('/api/photos/check-availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoIds: [photoId] })
    });
    
    const result = await response.json();
    
    if (!result.success || !result.results[photoId] || !result.results[photoId].available) {
      // Foto não está mais disponível
      console.log(`❌ Foto ${photoId} não está mais disponível`);
      showSoldPhotoLightbox(photoId);
      return;
    }
    
    // Foto disponível, continuar normalmente
    console.log(`✅ Foto ${photoId} está disponível`);
    openLightboxNormal(photoId, fromCart);
    
  } catch (error) {
    console.error('Erro ao verificar disponibilidade:', error);
    // Em caso de erro, abrir normalmente (fallback)
    openLightboxNormal(photoId, fromCart);
  }
}

// 🔍 FUNÇÃO AUXILIAR: Abrir lightbox normalmente (versão original)
function openLightboxNormal(photoId, fromCart = false) {
  // Encontrar a foto pelo ID
  const index = photos.findIndex(p => p.id === photoId);

  // Verificar se a foto foi encontrada
  if (index === -1) {
    console.warn(`Foto com ID ${photoId} não encontrada no array global. Pode estar carregando...`);
    showToast('Aguarde o carregamento completo da imagem...', 'info');
    return;
  }

  // Abrir lightbox com o índice encontrado (usando função original)
  openLightbox(index, fromCart);
}

// 🚫 FUNÇÃO CORRIGIDA: Mostrar lightbox para foto vendida (preservando navegação)
function showSoldPhotoLightbox(photoId) {
  // Encontrar índice da foto para navegação
  const index = photos.findIndex(p => p.id === photoId);
  if (index !== -1) {
    currentPhotoIndex = index;
  }
  
  // Mostrar lightbox básico normalmente PRIMEIRO
  document.getElementById('lightbox').style.display = 'block';
  
  // Configurar informações básicas
  document.getElementById('lightbox-name').innerHTML = 'Item No Longer Available';
  
  // Obter container de imagem
  const lightboxImgContainer = document.querySelector('.lightbox-img-container');
  
  // PRESERVAR navegação existente
  const existingNav = lightboxImgContainer.querySelector('.lightbox-nav');
  
  // Limpar apenas conteúdo de imagem (NÃO a navegação)
  Array.from(lightboxImgContainer.children).forEach(child => {
    if (!child.classList.contains('lightbox-nav')) {
      lightboxImgContainer.removeChild(child);
    }
  });
  
  // Criar overlay mantendo navegação
  const overlay = document.createElement('div');
  overlay.className = 'lightbox-sold-overlay';
  overlay.innerHTML = `
    <div class="lightbox-sold-message">
      <h3>⚠️ Already Sold</h3>
      <p>This item has been purchased by another customer and is no longer available.</p>
      <div style="margin-top: 20px;">
        <button class="btn btn-secondary" onclick="closeLightbox(); updateGalleryAfterSold()">Close</button>
      </div>
    </div>
  `;
  
  // Adicionar overlay ANTES da navegação (se existir)
  if (existingNav) {
    lightboxImgContainer.insertBefore(overlay, existingNav);
  } else {
    lightboxImgContainer.appendChild(overlay);
  }
  
  // Ocultar botão de adicionar temporariamente
  const addBtn = document.getElementById('lightbox-add-btn');
  if (addBtn) {
    addBtn.style.display = 'none';
  }
  
  // Atualizar contador do carrinho
  updateLightboxCartCount();
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
  imgElement.src = `/api/photos/local/thumbnail/${photo.id}`;
  imgElement.alt = photo.name;
  imgElement.style.maxWidth = '100%';
  imgElement.style.maxHeight = '100%';
  imgElement.style.objectFit = 'contain';
  imgElement.style.transition = 'opacity 0.3s ease-in-out';
  imgElement.dataset.zoomSrc = `/api/photos/local/image/${photo.id}`;
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

  // Configure other information (category name, price, etc)
  let nameText = '';

  // NOVA LÓGICA: Encontrar o nome da categoria a partir do foto.folderId
  const categoryName = getCategoryNameFromFolderId(photo.folderId || photo.categoryId);
  nameText = categoryName || 'Unknown Category';

  // Configurar o nome da categoria
  document.getElementById('lightbox-name').innerHTML = nameText;

  // Add price information if available (agora separadamente com estilo preto)
  if (photo.price !== undefined) {
    const formattedPrice = `$${parseFloat(photo.price).toFixed(2)}`;
    document.getElementById('lightbox-name').innerHTML = nameText + ` <span class="lightbox-price">${formattedPrice}</span>`;
  }

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

  // 🔧 GARANTIR que o botão esteja visível
  addBtn.style.display = 'block';

  // Update the cart count in the lightbox
  updateLightboxCartCount();

  // Show the lightbox
  document.getElementById('lightbox').style.display = 'block';

  // Carregar versão de alta qualidade em background
  const highResImage = new Image();
  highResImage.onload = function () {
    // TRANSIÇÃO SUAVE: Fade out
    imgElement.style.opacity = '0.6';

    setTimeout(() => {
      // Atualizar src da imagem para alta resolução
      imgElement.src = this.src;

      // Fade in
      imgElement.style.opacity = '1';

      // Remover loader
      if (loader.parentNode) {
        loader.parentNode.removeChild(loader);
      }

      // Inicializar zoom após transição
      setTimeout(() => {
        initializeZoom(imgElement.id);
      }, 200);
    }, 100);
  };

  // Definir handlers de erro
  highResImage.onerror = function () {
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

  preloadAdjacentImages();
  preloadNextImages(3);
  checkAndLoadMorePhotos();
}

// NOVA FUNÇÃO: Verificar se precisamos carregar mais fotos
function checkAndLoadMorePhotos() {
  // Se estamos perto do fim das fotos carregadas (últimas 5 fotos)
  if (currentPhotoIndex >= photos.length - 5) {
    // Identificar a categoria atual
    const currentPhoto = photos[currentPhotoIndex];
    if (!currentPhoto) return;

    const categoryId = currentPhoto.folderId;
    if (!categoryId) return;

    // Verificar se já temos fotos suficientes carregadas nesta categoria
    const photosInCategory = photos.filter(p => p.folderId === categoryId).length;

    // Carregar mais fotos se necessário
    fetch(`/api/photos?category_id=${categoryId}&customer_code=${currentCustomerCode}&offset=${photosInCategory}&limit=50`)
      .then(response => response.json())
      .then(data => {
        const morePhotos = data.photos || [];
        const pagination = data.pagination || {};

        if (morePhotos.length === 0) return;

        // Registrar novas fotos e adicionar ao array global
        morePhotos.forEach(photo => {
          photoRegistry[photo.id] = photo;
        });

        // Adicionar ao array global
        photos = photos.concat(morePhotos);

        // Mostrar notificação discreta
        if (pagination.hasMore) {
          showLoadMoreNotification(pagination.remaining);
        } else if (pagination.remaining === 0) {
          showEndOfCategoryNotification();
        }
      })
      .catch(error => {
        console.error('Erro ao carregar mais fotos no lightbox:', error);
      });
  }
}

// NOVAS FUNÇÕES: Notificações no lightbox
function showLoadMoreNotification(remaining) {
  const notification = document.createElement('div');
  notification.className = 'lightbox-notification';
  notification.innerHTML = `
    <div class="notification-content">
      <span>Mais ${remaining} fotos disponíveis</span>
    </div>
  `;
  document.querySelector('.lightbox-content').appendChild(notification);

  // Remover após alguns segundos
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 500);
  }, 3000);
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
        mediumImg.src = `/api/photos/local/thumbnail/${photoId}`;

        // Após carregar versão média, começar a carregar alta resolução
        mediumImg.onload = function () {
          setTimeout(() => {
            const highResImg = new Image();
            highResImg.src = getDirectImageUrl(photoId);
          }, 500); // Atraso para priorizar versão média primeiro
        };
      }
    });
  }
}


// Em getDirectImageUrl() - linha ~175
// TROCAR TODA A FUNÇÃO:
function getDirectImageUrl(fileId) {
  return `/api/photos/local/image/${fileId}`;
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
  img.addEventListener('mousedown', function (e) {
    e.preventDefault();
    if (scale > 1) {
      start = { x: e.clientX - pointX, y: e.clientY - pointY };
      panning = true;
      img.style.cursor = 'grabbing';
    }
  });

  // Soltar o botão do mouse
  img.addEventListener('mouseup', function (e) {
    panning = false;
    if (scale > 1) {
      img.style.cursor = 'grab';
    } else {
      img.style.cursor = 'zoom-in';
    }
  });

  // Sair do elemento com o mouse
  img.addEventListener('mouseleave', function (e) {
    panning = false;
  });

  // Movimento do mouse para arrastar
  img.addEventListener('mousemove', function (e) {
    e.preventDefault();
    if (!panning) return;

    pointX = (e.clientX - start.x);
    pointY = (e.clientY - start.y);
    setTransform();
  });

  // Evento de roda do mouse para zoom
  img.addEventListener('wheel', function (e) {
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
  img.addEventListener('dblclick', function (e) {
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

// ✅ FUNÇÃO closeLightbox CORRIGIDA - Sincroniza categoria automaticamente
function closeLightbox() {
  // 🔧 NOVA LÓGICA: Verificar e remover fotos vendidas da interface
  checkAndRemoveSoldPhotosFromInterface();
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

  // Limpar flags de transição
  isTransitioningCategory = false;

  // Remover qualquer overlay de navegação
  removeNavigationOverlay();

  // ✅ NOVA LÓGICA: Verificar se categoria mudou durante navegação do lightbox
  const interfaceCategory = detectCurrentCategoryInInterface();
  
  console.log(`🔄 [SYNC] Checking category sync: Interface=${interfaceCategory}, Lightbox=${activeCategory}`);
  
  if (activeCategory && interfaceCategory !== activeCategory) {
    console.log(`🔄 [SYNC] Category changed during lightbox navigation: ${interfaceCategory} → ${activeCategory}`);
    
    // Sincronizar interface com categoria do lightbox
    syncInterfaceWithLightboxCategory();
  } else {
    console.log(`✅ [SYNC] Categories are in sync, no update needed`);
  }

  // ✅ CÓDIGO ORIGINAL (manter intacto)
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

// 🔧 NOVA FUNÇÃO: Verificar e remover fotos vendidas da interface
async function checkAndRemoveSoldPhotosFromInterface() {
  const visiblePhotos = document.querySelectorAll('.photo-item[id^="photo-"]');
  const photoIds = Array.from(visiblePhotos).map(el => el.id.replace('photo-', ''));
  
  if (photoIds.length === 0) return;
  
  try {
    const response = await fetch('/api/photos/check-availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoIds })
    });
    
    const result = await response.json();
    
    if (result.success) {
      photoIds.forEach(photoId => {
        const availability = result.results[photoId];
        if (!availability || !availability.available) {
          // Marcar como vendida primeiro
          markPhotoAsSoldInInterface(photoId);
          
          // REMOVER a thumbnail após um pequeno delay para efeito visual
          setTimeout(() => {
            const photoElement = document.getElementById(`photo-${photoId}`);
            if (photoElement) {
              photoElement.style.transition = 'opacity 0.3s ease-out';
              photoElement.style.opacity = '0';
              
              setTimeout(() => {
                photoElement.remove();
              }, 300);
            }
          }, 100);
        }
      });
    }
  } catch (error) {
    console.error('Erro ao verificar fotos vendidas:', error);
  }
}

// ✅ FUNÇÃO AUXILIAR: Detectar categoria atual da interface
function detectCurrentCategoryInInterface() {
  try {
    // Método 1: Procurar por fotos visíveis na interface
    const contentDiv = document.getElementById('content');
    if (!contentDiv) return null;
    
    const firstVisiblePhoto = contentDiv.querySelector('.photo-item[id^="photo-"]');
    if (firstVisiblePhoto) {
      const photoId = firstVisiblePhoto.id.replace('photo-', '');
      const photo = photoRegistry[photoId];
      if (photo && photo.folderId) {
        console.log(`📱 [SYNC] Detected interface category from photo: ${photo.folderId}`);
        return photo.folderId;
      }
    }
    
    // Método 2: Verificar categoria ativa no sidebar
    const activeMenuItem = document.querySelector('.category-item.active');
    if (activeMenuItem) {
      const categoryId = activeMenuItem.getAttribute('data-category-id');
      if (categoryId) {
        console.log(`📱 [SYNC] Detected interface category from sidebar: ${categoryId}`);
        return categoryId;
      }
    }
    
    // Método 3: Verificar cabeçalho da categoria atual
    const categoryHeader = document.querySelector('[data-current-category]');
    if (categoryHeader) {
      const categoryId = categoryHeader.getAttribute('data-current-category');
      if (categoryId) {
        console.log(`📱 [SYNC] Detected interface category from header: ${categoryId}`);
        return categoryId;
      }
    }
    
    console.log(`⚠️ [SYNC] Could not detect current interface category`);
    return null;
    
  } catch (error) {
    console.error(`❌ [SYNC] Error detecting interface category:`, error);
    return null;
  }
}

// ✅ FUNÇÃO AUXILIAR: Sincronizar interface com categoria do lightbox  
function syncInterfaceWithLightboxCategory() {
  try {
    if (!activeCategory) {
      console.log(`⚠️ [SYNC] No active category to sync to`);
      return;
    }
    
    console.log(`🔄 [SYNC] Synchronizing interface to category: ${activeCategory}`);
    
    // ✅ MÉTODO SEGURO: Usar função existente loadCategoryPhotos
    if (typeof loadCategoryPhotos === 'function') {
      console.log(`✅ [SYNC] Using existing loadCategoryPhotos function`);
      
      // Carregar categoria com pequeno delay para não conflitar com fechamento do lightbox
      setTimeout(() => {
        loadCategoryPhotos(activeCategory);
        console.log(`✅ [SYNC] Interface synchronized to category: ${activeCategory}`);
      }, 200);
      
    } else {
      // ✅ FALLBACK: Atualizar apenas o sidebar se função principal não existir
      console.log(`🔧 [SYNC] Using fallback: updating sidebar only`);
      
      if (typeof highlightActiveCategory === 'function') {
        highlightActiveCategory(activeCategory);
      }
      
      // Mostrar mensagem para usuário
      const contentDiv = document.getElementById('content');
      if (contentDiv) {
        contentDiv.innerHTML = `
          <div style="text-align: center; padding: 40px; background: white; border-radius: 10px; margin-top: 30px;">
            <h3>Category Changed</h3>
            <p>Click on the highlighted category in the sidebar to load photos.</p>
          </div>
        `;
      }
    }
    
  } catch (error) {
    console.error(`❌ [SYNC] Error synchronizing interface:`, error);
    
    // Fallback silencioso: pelo menos atualizar sidebar
    try {
      if (typeof highlightActiveCategory === 'function') {
        highlightActiveCategory(activeCategory);
      }
    } catch (fallbackError) {
      console.error(`❌ [SYNC] Fallback also failed:`, fallbackError);
    }
  }
}

function navigatePhotos(direction) {
  // Verificação de segurança
  if (currentPhotoIndex < 0 || currentPhotoIndex >= photos.length) {
    return;
  }

  // Se estiver transitioning, ignorar navegação
  if (isTransitioningCategory) {
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
    return;
  }

  // Normal gallery navigation
  const newIndex = currentPhotoIndex + direction;

  // NOVO: Verificar se precisa pré-carregar mais fotos (apenas indo para frente)
  if (direction > 0 && newIndex >= photos.length - 5) {
    preloadMorePhotosInLightbox();
  }

  // Verificar se chegamos ao final de uma categoria (navegando para frente)
  if (direction > 0 && newIndex >= photos.length) {
    // Chegamos ao final da categoria atual
    showNextCategoryOption();
    return;
  }

  // Verificar se chegamos ao início de uma categoria (navegando para trás)
  if (direction < 0 && newIndex < 0) {
    // Chegamos ao início da categoria atual
    showPreviousCategoryOption();
    return;
  }

  // Navegação normal dentro da categoria
  if (newIndex >= 0 && newIndex < photos.length) {
    openLightbox(newIndex, false);
  }

  // Verificar se precisamos carregar mais fotos
  checkAndLoadMorePhotos();
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

// NOVA FUNÇÃO: Verificar se precisamos carregar mais fotos
function checkAndLoadMorePhotos() {
  // Se estamos perto do fim das fotos carregadas (últimas 5 fotos)
  if (currentPhotoIndex >= photos.length - 5) {
    // Identificar a categoria atual
    const currentPhoto = photos[currentPhotoIndex];
    if (!currentPhoto) return;

    const categoryId = currentPhoto.folderId;
    if (!categoryId) return;

    // Verificar se já temos fotos suficientes carregadas nesta categoria
    const photosInCategory = photos.filter(p => p.folderId === categoryId).length;

    // Carregar mais fotos se necessário
    fetch(`/api/photos?category_id=${categoryId}&customer_code=${currentCustomerCode}&offset=${photosInCategory}&limit=50`)
      .then(response => response.json())
      .then(data => {
        const morePhotos = data.photos || [];
        const pagination = data.pagination || {};

        if (morePhotos.length === 0) return;

        // Registrar novas fotos e adicionar ao array global
        morePhotos.forEach(photo => {
          photoRegistry[photo.id] = photo;
        });

        // Adicionar ao array global
        photos = photos.concat(morePhotos);

        // Mostrar notificação discreta
        if (pagination.hasMore) {
          showLoadMoreNotification(pagination.remaining);
        } else if (pagination.remaining === 0) {
          showEndOfCategoryNotification();
        }
      })
      .catch(error => {
        console.error('Erro ao carregar mais fotos no lightbox:', error);
      });
  }
}

// Adicionar estas duas funções para notificações
function showLoadMoreNotification(remaining) {
  const notification = document.createElement('div');
  notification.className = 'lightbox-notification';
  notification.innerHTML = `
    <div class="notification-content">
      <span>Mais ${remaining} fotos disponíveis</span>
    </div>
  `;
  document.querySelector('.lightbox-content').appendChild(notification);

  // Remover após alguns segundos
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

// Função para obter o nome da categoria a partir do folderId
function getCategoryNameFromFolderId(folderId) {
  // Verificar se temos as categorias carregadas globalmente
  if (window.categories && Array.isArray(window.categories)) {
    const category = window.categories.find(cat => cat.id === folderId);
    if (category) {
      return category.name;
    }
  }

  // Fallback: verificar se estamos numa categoria específica
  if (window.activeCategory) {
    // Buscar nos elementos da sidebar
    const activeCategoryElement = document.querySelector('.category-item.active');
    if (activeCategoryElement) {
      // Extrair nome da categoria (remover contadores entre parênteses)
      const fullText = activeCategoryElement.textContent.trim();
      return fullText.replace(/\s*\(\d+\)\s*$/, '');
    }
  }

  // Se não conseguir encontrar, retornar um nome padrão
  return 'Current Category';
}

// Mostrar opção para ir para próxima categoria
function showNextCategoryOption() {
  // Remover qualquer overlay existente
  removeNavigationOverlay();

  // Encontrar a próxima categoria
  const nextCategory = getNextCategory();

  if (!nextCategory) {
    // Não há próxima categoria
    showEndOfGalleryMessage();
    return;
  }

  // Criar overlay para próxima categoria
  const overlay = document.createElement('div');
  overlay.className = 'category-navigation-overlay';
  overlay.innerHTML = `
    <div class="category-nav-content">
      <div class="category-nav-icon">→</div>
      <h3>End of Category</h3>
      <p>Continue to <strong>${nextCategory.name}</strong>?</p>
      <div class="category-nav-buttons">
        <button class="btn btn-secondary" onclick="removeNavigationOverlay()">Stay Here</button>
        <button class="btn btn-gold" onclick="navigateToNextCategory()">Next Category</button>
      </div>
    </div>
  `;

  document.querySelector('.lightbox-content').appendChild(overlay);
}

// Mostrar opção para ir para categoria anterior
function showPreviousCategoryOption() {
  // Remover qualquer overlay existente
  removeNavigationOverlay();

  // Encontrar a categoria anterior
  const previousCategory = getPreviousCategory();

  if (!previousCategory) {
    // Não há categoria anterior
    showBeginningOfGalleryMessage();
    return;
  }

  // Criar overlay para categoria anterior
  const overlay = document.createElement('div');
  overlay.className = 'category-navigation-overlay';
  overlay.innerHTML = `
    <div class="category-nav-content">
      <div class="category-nav-icon">←</div>
      <h3>Beginning of Category</h3>
      <p>Go back to <strong>${previousCategory.name}</strong>?</p>
      <div class="category-nav-buttons">
        <button class="btn btn-secondary" onclick="removeNavigationOverlay()">Stay Here</button>
        <button class="btn btn-gold" onclick="navigateToPreviousCategory()">Previous Category</button>
      </div>
    </div>
  `;

  document.querySelector('.lightbox-content').appendChild(overlay);
}

// Obter próxima categoria - VERSÃO COM MAIS LOGS
function getNextCategory() {
  if (!window.categories || !Array.isArray(window.categories)) {
    console.log('No categories available in window.categories');
    return null;
  }

  // Filtrar apenas categorias específicas (não "All Items")
  const specificCategories = window.categories.filter(cat => !cat.isAll);
  console.log(`Found ${specificCategories.length} specific categories`);

  // Encontrar índice da categoria atual
  if (activeCategory) {
    currentCategoryIndex = specificCategories.findIndex(cat => cat.id === activeCategory);
    console.log(`Current category index: ${currentCategoryIndex} (ID: ${activeCategory})`);
  }

  // Obter próxima categoria
  const nextIndex = currentCategoryIndex + 1;
  console.log(`Next category index would be: ${nextIndex}`);

  if (nextIndex < specificCategories.length) {
    const nextCategory = specificCategories[nextIndex];
    console.log(`Next category found: ${nextCategory.name} (ID: ${nextCategory.id})`);
    return nextCategory;
  }

  console.log('No next category available');
  return null; // Não há próxima categoria
}

// Obter categoria anterior
function getPreviousCategory() {
  if (!window.categories || !Array.isArray(window.categories)) {
    return null;
  }

  // Filtrar apenas categorias específicas (não "All Items")
  const specificCategories = window.categories.filter(cat => !cat.isAll);

  // Encontrar índice da categoria atual
  if (activeCategory) {
    currentCategoryIndex = specificCategories.findIndex(cat => cat.id === activeCategory);
  }

  // Obter categoria anterior
  const previousIndex = currentCategoryIndex - 1;
  if (previousIndex >= 0) {
    return specificCategories[previousIndex];
  }

  return null; // Não há categoria anterior
}

// Navegar para próxima categoria - VERSÃO COM MAIS LOGS
function navigateToNextCategory() {
  const nextCategory = getNextCategory();
  if (!nextCategory) {
    console.log('No next category found');
    return;
  }

  console.log(`Navigating to next category: ${nextCategory.name} (ID: ${nextCategory.id})`);

  isTransitioningCategory = true;
  removeNavigationOverlay();

  // Mostrar loader temporário
  showCategoryTransitionLoader('Loading next category...');

  // Carregar próxima categoria
  loadCategoryInLightbox(nextCategory);
}

// Navegar para categoria anterior
function navigateToPreviousCategory() {
  const previousCategory = getPreviousCategory();
  if (!previousCategory) return;

  isTransitioningCategory = true;
  removeNavigationOverlay();

  // Mostrar loader temporário
  showCategoryTransitionLoader('Loading previous category...');

  // Carregar categoria anterior
  loadCategoryInLightbox(previousCategory);
}

// Carregar categoria no lightbox
function loadCategoryInLightbox(category) {
  // ADICIONE ESTA VERIFICAÇÃO AQUI - NO INÍCIO DA FUNÇÃO
  if (!category || !category.id) {
    console.error('Invalid category provided to loadCategoryInLightbox:', category);
    isTransitioningCategory = false;
    removeNavigationOverlay();
    return;
  }

  // Atualizar categoria ativa
  activeCategory = category.id;

  // Atualizar sidebar
  if (typeof highlightActiveCategory === 'function') {
    highlightActiveCategory(category.id);
  }

  // Verificar se já temos as fotos desta categoria em cache
  if (categoryPhotoCache && categoryPhotoCache[category.id]) {
    console.log(`Using cached photos for category: ${category.name}`);

    // Usar fotos do cache COM VERIFICAÇÃO ROBUSTA PARA DIFERENTES ESTRUTURAS
    let cachedData = categoryPhotoCache[category.id];
    let categoryPhotos = [];

    // VERIFICAÇÃO DE SEGURANÇA PARA DIFERENTES ESTRUTURAS DE CACHE
    if (Array.isArray(cachedData)) {
      // Cache direto é um array
      categoryPhotos = cachedData;
    } else if (cachedData && typeof cachedData === 'object') {
      // Cache é um objeto com propriedade photos
      if (Array.isArray(cachedData.photos)) {
        categoryPhotos = cachedData.photos;
      } else {
        console.warn('Cache object found but no valid photos array:', cachedData);
        categoryPhotos = [];
      }
    } else {
      console.warn('Cached data is in unexpected format:', cachedData);
      categoryPhotos = [];
    }

    // Verificação final se encontramos fotos válidas
    if (!Array.isArray(categoryPhotos) || categoryPhotos.length === 0) {
      console.log('No valid photos in cache, will refetch from API');
      // Se cache não tem fotos válidas, limpar e continuar para buscar da API
      delete categoryPhotoCache[category.id];
    } else {
      console.log(`Found ${categoryPhotos.length} photos in cache for category: ${category.name}`);

      // Resetar o array de fotos atual para a nova categoria
      photos = [];

      // Atualizar registro de fotos
      categoryPhotos.forEach(photo => {
        if (photo && photo.id) {
          photoRegistry[photo.id] = photo;
          photos.push(photo);
        }
      });

      // Ir para primeira foto da nova categoria
      currentPhotoIndex = 0;
      openLightbox(currentPhotoIndex, false);

      isTransitioningCategory = false;
      removeNavigationOverlay();
      return;
    }
  }

  // Carregar fotos da categoria via API - SEMPRE com offset=0 para nova categoria
  fetch(`/api/photos?category_id=${category.id}&customer_code=${currentCustomerCode}&offset=0&limit=50`)
    .then(response => response.json())
    .then(data => {
      removeNavigationOverlay(); // Remover loader

      // CORREÇÃO ROBUSTA: Garantir que categoryPhotos seja sempre um array
      let categoryPhotos = [];

      // Log para debug
      console.log('API Response for category:', category.name, data);

      try {
        // Verificar todos os possíveis formatos de resposta
        if (Array.isArray(data)) {
          // Resposta é um array direto
          categoryPhotos = data;
        } else if (data && typeof data === 'object') {
          // Resposta é um objeto, tentar extrair array
          if (Array.isArray(data.photos)) {
            categoryPhotos = data.photos;
          } else if (Array.isArray(data.data)) {
            categoryPhotos = data.data;
          } else if (data.success && Array.isArray(data.result)) {
            categoryPhotos = data.result;
          } else if (data.items && Array.isArray(data.items)) {
            categoryPhotos = data.items;
          } else {
            // Se nenhum formato conhecido foi encontrado, criar array vazio
            console.warn('Unrecognized API response format:', data);
            categoryPhotos = [];
          }
        } else {
          // Dados não são nem array nem objeto válido
          console.warn('Invalid API response:', data);
          categoryPhotos = [];
        }

        // VERIFICAÇÃO FINAL OBRIGATÓRIA
        if (!Array.isArray(categoryPhotos)) {
          console.error('Failed to extract valid photo array, forcing empty array');
          categoryPhotos = [];
        }

        // VERIFICAÇÃO ADICIONAL: garantir que cada item do array é válido
        categoryPhotos = categoryPhotos.filter(photo => {
          return photo && typeof photo === 'object' && photo.id;
        });

      } catch (error) {
        console.error('Error processing API response:', error);
        categoryPhotos = [];
      }

      // Verificar se encontramos fotos
      if (categoryPhotos.length === 0) {
        showToast(`Category "${category.name}" has no photos`, 'info');
        isTransitioningCategory = false;
        return;
      }

      console.log(`Successfully loaded ${categoryPhotos.length} photos from category: ${category.name}`);

      // Armazenar em cache
      if (!categoryPhotoCache) categoryPhotoCache = {};
      categoryPhotoCache[category.id] = categoryPhotos;

      // Resetar o array de fotos atual para a nova categoria
      photos = [];

      // Atualizar registro de fotos com verificação extra de segurança
      categoryPhotos.forEach(photo => {
        if (photo && photo.id) {
          photoRegistry[photo.id] = photo;
          photos.push(photo);
        }
      });

      // Ir para primeira foto da nova categoria
      currentPhotoIndex = 0;
      openLightbox(currentPhotoIndex, false);

      isTransitioningCategory = false;
    })
    .catch(error => {
      console.error(`Error loading category ${category.name}:`, error);
      removeNavigationOverlay();
      showToast(`Error loading category "${category.name}"`, 'error');
      isTransitioningCategory = false;
    });
}

// Mostrar loader durante transição de categoria
function showCategoryTransitionLoader(message) {
  removeNavigationOverlay(); // Remover overlay existente primeiro

  const overlay = document.createElement('div');
  overlay.className = 'category-navigation-overlay transition-loader';
  overlay.innerHTML = `
    <div class="category-nav-content">
      <div class="loading-spinner"></div>
      <p>${message}</p>
    </div>
  `;

  document.querySelector('.lightbox-content').appendChild(overlay);
}

// Remover overlay de navegação
function removeNavigationOverlay() {
  const overlay = document.querySelector('.category-navigation-overlay');
  if (overlay) {
    overlay.remove();
  }
}

// Mostrar mensagem de final da galeria
function showEndOfGalleryMessage() {
  const overlay = document.createElement('div');
  overlay.className = 'category-navigation-overlay';
  overlay.innerHTML = `
    <div class="category-nav-content">
      <div class="category-nav-icon">🏁</div>
      <h3>End of Gallery</h3>
      <p>You've reached the end of all categories!</p>
      <div class="category-nav-buttons">
        <button class="btn btn-gold" onclick="returnToCart()">View Selection</button>
        <button class="btn btn-secondary" onclick="removeNavigationOverlay()">Close</button>
      </div>
    </div>
  `;

  document.querySelector('.lightbox-content').appendChild(overlay);
}

// Mostrar mensagem de início da galeria
function showBeginningOfGalleryMessage() {
  const overlay = document.createElement('div');
  overlay.className = 'category-navigation-overlay';
  overlay.innerHTML = `
    <div class="category-nav-content">
      <div class="category-nav-icon">🏁</div>
      <h3>Beginning of Gallery</h3>
      <p>You're at the beginning of all categories!</p>
      <div class="category-nav-buttons">
        <button class="btn btn-secondary" onclick="removeNavigationOverlay()">Close</button>
      </div>
    </div>
  `;

  document.querySelector('.lightbox-content').appendChild(overlay);
}

// ✅ SUBSTITUIR a função preloadMorePhotosInLightbox() existente por esta versão

// NOVA FUNÇÃO: Pré-carregar mais fotos automaticamente no lightbox (versão silenciosa + sync)
function preloadMorePhotosInLightbox() {
  console.log(`🔄 [SYNC] Preloading more photos at lightbox index ${currentPhotoIndex}`);
  
  // Evitar múltiplas requisições simultâneas
  if (window.isPreloadingLightbox) {
    console.log(`⏳ [SYNC] Already preloading, skipping`);
    return;
  }
  window.isPreloadingLightbox = true;

  // Identificar categoria atual
  const currentPhoto = photos[currentPhotoIndex];
  if (!currentPhoto || !currentPhoto.folderId) {
    console.log(`❌ [SYNC] No current photo or folderId found`);
    window.isPreloadingLightbox = false;
    return;
  }

  const categoryId = currentPhoto.folderId;
  console.log(`📂 [SYNC] Current category: ${categoryId}`);

  // Verificar cache para saber quantas fotos já carregamos
  const categoryCache = categoryPhotoCache[categoryId];
  if (!categoryCache) {
    console.log(`❌ [SYNC] No cache found for category ${categoryId}`);
    window.isPreloadingLightbox = false;
    return;
  }

  const currentOffset = categoryCache.totalLoaded || photos.length;
  const batchSize = 15; // Carregar 15 fotos por vez
  
  console.log(`📊 [SYNC] Loading ${batchSize} more photos from offset ${currentOffset}`);

  // Carregar mais fotos (sem avisos visuais no lightbox)
  fetch(`/api/photos?category_id=${categoryId}&customer_code=${currentCustomerCode}&offset=${currentOffset}&limit=${batchSize}`)
    .then(response => response.json())
    .then(newPhotos => {
      if (!Array.isArray(newPhotos) || newPhotos.length === 0) {
        console.log(`✅ [SYNC] No more photos available for category ${categoryId}`);
        window.isPreloadingLightbox = false;
        return;
      }

      console.log(`📸 [SYNC] Loaded ${newPhotos.length} new photos silently`);

      // ✅ ATUALIZAR ARRAYS GLOBAIS (para lightbox continuar funcionando)
      newPhotos.forEach(photo => {
        if (photo && photo.id) {
          photoRegistry[photo.id] = photo;
          // Só adicionar se não existir já
          if (!photos.find(p => p.id === photo.id)) {
            photos.push(photo);
          }
        }
      });

      // ✅ ATUALIZAR CACHE DA CATEGORIA
      if (categoryCache.photos) {
        categoryCache.photos = categoryCache.photos.concat(newPhotos);
      } else {
        categoryCache.photos = newPhotos;
      }
      categoryCache.totalLoaded = (categoryCache.totalLoaded || 0) + newPhotos.length;
      categoryCache.hasMore = newPhotos.length >= batchSize;

      console.log(`✅ [SYNC] Cache updated. Total loaded: ${categoryCache.totalLoaded}`);

      // ✅ SINCRONIZAR THUMBNAILS NA INTERFACE (se categoria estiver visível)
      syncThumbnailsFromLightbox(categoryId, newPhotos);

      window.isPreloadingLightbox = false;
    })
    .catch(error => {
      console.error(`❌ [SYNC] Error preloading photos:`, error);
      window.isPreloadingLightbox = false;
    });
}

// ✅ SUBSTITUIR apenas a função syncThumbnailsFromLightbox por esta versão corrigida

// ✅ FUNÇÃO CORRIGIDA: Sincronizar thumbnails a partir do lightbox
function syncThumbnailsFromLightbox(categoryId, newPhotos) {
  // Verificar se esta categoria está sendo exibida atualmente na interface
  const contentDiv = document.getElementById('content');
  if (!contentDiv) {
    console.log(`📱 [SYNC] No content div found`);
    return;
  }

  const currentSection = contentDiv.querySelector('#category-section-main');
  if (!currentSection) {
    console.log(`📱 [SYNC] Category not currently displayed, skipping thumbnail sync`);
    return;
  }

  // Verificar se é a categoria correta (olhar primeira foto visível)
  const firstVisiblePhoto = currentSection.querySelector('.photo-item[id^="photo-"]');
  if (!firstVisiblePhoto) {
    console.log(`📱 [SYNC] No photos visible in section, skipping sync`);
    return;
  }

  const firstPhotoId = firstVisiblePhoto.id.replace('photo-', '');
  const firstPhoto = photos.find(p => p.id === firstPhotoId);
  
  if (!firstPhoto || firstPhoto.folderId !== categoryId) {
    console.log(`📱 [SYNC] Different category displayed (${firstPhoto?.folderId} vs ${categoryId}), skipping sync`);
    return;
  }

  console.log(`🎨 [SYNC] Adding ${newPhotos.length} thumbnails to interface silently`);

  // ✅ ABORDAGEM MAIS SEGURA: Verificar se loadPhotosSequentially existe
  if (typeof loadPhotosSequentially === 'function') {
    console.log(`🎨 [SYNC] Using visual effects for thumbnail sync`);
    
    // ✅ MÉTODO SEGURO: Adicionar diretamente ao currentSection
    try {
      // Encontrar ponto de inserção ANTES de criar elementos
      const navigationSection = contentDiv.querySelector('.category-navigation-section');
      const moreButton = contentDiv.querySelector('.load-more-btn');
      const insertionPoint = moreButton || navigationSection || null;
      
      // ✅ USAR ABORDAGEM MAIS DIRETA: Adicionar elementos um por um
      newPhotos.forEach((photo, index) => {
        setTimeout(() => {
          try {
            // Verificar se ainda estamos na categoria correta
            const currentFirstPhoto = currentSection.querySelector('.photo-item[id^="photo-"]');
            if (!currentFirstPhoto) return;
            
            const currentFirstPhotoId = currentFirstPhoto.id.replace('photo-', '');
            const currentFirst = photos.find(p => p.id === currentFirstPhotoId);
            if (!currentFirst || currentFirst.folderId !== categoryId) {
              console.log(`📱 [SYNC] Category changed during sync, stopping`);
              return;
            }
            
            // Criar elemento da foto
            const photoElement = createThumbnailElement(photo);
            
            // ✅ INSERÇÃO SEGURA
            if (insertionPoint && insertionPoint.parentNode === currentSection) {
              currentSection.insertBefore(photoElement, insertionPoint);
            } else {
              // Fallback: adicionar no final
              currentSection.appendChild(photoElement);
            }
            
            // Animar entrada
            photoElement.style.opacity = '0';
            photoElement.style.transform = 'translateY(20px)';
            photoElement.style.transition = 'all 0.4s ease';
            
            setTimeout(() => {
              photoElement.style.opacity = '1';
              photoElement.style.transform = 'translateY(0)';
            }, 50);
            
            // Se for a última foto, atualizar botão e botões do carrinho
            if (index === newPhotos.length - 1) {
              setTimeout(() => {
                updateMorePhotosButtonAfterLightboxSync(categoryId);
                if (typeof updateButtonsForCartItems === 'function') {
                  updateButtonsForCartItems();
                }
                console.log(`✅ [SYNC] Successfully synced ${newPhotos.length} thumbnails`);
              }, 100);
            }
            
          } catch (error) {
            console.error(`❌ [SYNC] Error adding thumbnail ${index}:`, error);
          }
        }, index * 80); // Delay escalonado para efeito visual
      });
      
    } catch (error) {
      console.error(`❌ [SYNC] Error in visual sync:`, error);
      // Fallback para método direto
      addThumbnailsDirectlyFromLightbox(currentSection, newPhotos);
    }
    
  } else {
    // Fallback: adicionar sem efeitos visuais
    console.log(`📱 [SYNC] Adding thumbnails without visual effects (fallback)`);
    addThumbnailsDirectlyFromLightbox(currentSection, newPhotos);
  }
}

// ✅ FUNÇÃO AUXILIAR: Criar elemento thumbnail de forma segura
function createThumbnailElement(photo) {
  const alreadyAdded = cartIds && cartIds.includes(photo.id);
  const priceText = photo.price ? `$${photo.price}` : '';
  
  const photoElement = document.createElement('div');
  photoElement.className = 'photo-item';
  photoElement.id = `photo-${photo.id}`;
  photoElement.onclick = () => openLightboxById(photo.id, false);
  
  photoElement.innerHTML = `
    <img src="${photo.thumbnail || `/api/photos/local/thumbnail/${photo.id}`}" 
         alt="${photo.name}" 
         loading="lazy"
         onerror="this.parentNode.remove();">
    <div class="photo-info">
      <div class="photo-actions-container">
        <button class="btn ${alreadyAdded ? 'btn-danger' : 'btn-gold'}" 
                id="button-${photo.id}"
                onclick="event.stopPropagation(); ${alreadyAdded ? 'removeFromCart' : 'addToCart'}('${photo.id}')">
          ${alreadyAdded ? 'Remove' : 'Select'}
        </button>
        ${priceText ? `<span class="price-inline">${priceText}</span>` : ''}
      </div>
    </div>
  `;
  
  return photoElement;
}

// ✅ FUNÇÃO AUXILIAR: Atualizar botão "More Photos" após sync do lightbox
function updateMorePhotosButtonAfterLightboxSync(categoryId) {
  const contentDiv = document.getElementById('content');
  const moreButton = contentDiv.querySelector('.btn-load-more');
  
  if (!moreButton) {
    console.log(`🔘 [SYNC] No "More Photos" button found`);
    return;
  }
  
  const categoryCache = categoryPhotoCache[categoryId];
  if (!categoryCache) return;
  
  // Calcular fotos restantes
  const totalPhotos = getTotalPhotosForLightboxSync(categoryId);
  const remainingPhotos = Math.max(0, totalPhotos - categoryCache.totalLoaded);
  
  console.log(`🔘 [SYNC] Remaining photos: ${remainingPhotos} of ${totalPhotos}`);
  
  if (remainingPhotos <= 0) {
    // Não há mais fotos, remover botão suavemente
    moreButton.style.transition = 'opacity 0.3s ease';
    moreButton.style.opacity = '0';
    setTimeout(() => {
      if (moreButton.parentElement) {
        moreButton.parentElement.remove();
      }
    }, 300);
    console.log(`🗑️ [SYNC] Removed "More Photos" button - no more photos`);
  } else {
    // Atualizar onclick para próximo lote
    const nextBatchSize = Math.min(15, remainingPhotos);
    moreButton.onclick = () => {
      if (typeof loadMorePhotosWithEffects === 'function') {
        loadMorePhotosWithEffects(categoryId, categoryCache.totalLoaded, nextBatchSize);
      } else if (typeof loadMorePhotosForCategory === 'function') {
        loadMorePhotosForCategory(categoryId, categoryCache.totalLoaded, nextBatchSize);
      }
    };
    console.log(`🔄 [SYNC] Updated "More Photos" button for ${remainingPhotos} remaining`);
  }
}

// ✅ FUNÇÃO AUXILIAR: Obter total de fotos para sync do lightbox
function getTotalPhotosForLightboxSync(categoryId) {
  const categoryItem = document.querySelector(`.category-item[data-category-id="${categoryId}"]`);
  if (categoryItem) {
    const text = categoryItem.textContent;
    const match = text.match(/\((\d+)\)/);
    if (match) {
      return parseInt(match[1]);
    }
  }
  return 100; // Fallback conservador
}

// ✅ SUBSTITUIR também a função addThumbnailsDirectlyFromLightbox por esta versão melhorada

// ✅ FUNÇÃO FALLBACK MELHORADA: Adicionar thumbnails diretamente (sem efeitos)
function addThumbnailsDirectlyFromLightbox(container, newPhotos) {
  console.log(`🔧 [SYNC] Using fallback method to add ${newPhotos.length} thumbnails`);
  
  try {
    // ✅ VERIFICAÇÕES DE SEGURANÇA
    if (!container || !container.appendChild) {
      console.error(`❌ [SYNC] Invalid container provided`);
      return;
    }
    
    if (!Array.isArray(newPhotos) || newPhotos.length === 0) {
      console.log(`📱 [SYNC] No photos to add`);
      return;
    }
    
    // Encontrar pontos de inserção com verificação
    const navigationSection = container.querySelector('.category-navigation-section');
    const moreButton = container.querySelector('.load-more-btn');
    
    newPhotos.forEach((photo, index) => {
      try {
        if (!photo || !photo.id) {
          console.warn(`⚠️ [SYNC] Invalid photo at index ${index}:`, photo);
          return;
        }
        
        // Verificar se a foto já existe (evitar duplicatas)
        const existingPhoto = container.querySelector(`#photo-${photo.id}`);
        if (existingPhoto) {
          console.log(`📱 [SYNC] Photo ${photo.id} already exists, skipping`);
          return;
        }
        
        const photoElement = createThumbnailElement(photo);
        photoElement.style.opacity = '0';
        
        // ✅ INSERÇÃO SEGURA COM VERIFICAÇÕES
        let inserted = false;
        
        // Tentar inserir antes do botão More
        if (moreButton && moreButton.parentNode === container) {
          try {
            container.insertBefore(photoElement, moreButton);
            inserted = true;
          } catch (error) {
            console.warn(`⚠️ [SYNC] Failed to insert before more button:`, error);
          }
        }
        
        // Se não conseguiu, tentar antes da navegação
        if (!inserted && navigationSection && navigationSection.parentNode === container) {
          try {
            container.insertBefore(photoElement, navigationSection);
            inserted = true;
          } catch (error) {
            console.warn(`⚠️ [SYNC] Failed to insert before navigation:`, error);
          }
        }
        
        // Fallback final: adicionar no final
        if (!inserted) {
          try {
            container.appendChild(photoElement);
            inserted = true;
          } catch (error) {
            console.error(`❌ [SYNC] Failed to append photo ${photo.id}:`, error);
            return;
          }
        }
        
        // Animar entrada com delay
        setTimeout(() => {
          photoElement.style.transition = 'opacity 0.4s ease';
          photoElement.style.opacity = '1';
        }, index * 60);
        
      } catch (error) {
        console.error(`❌ [SYNC] Error processing photo ${index}:`, error);
      }
    });
    
    // Atualizar botões após todas as fotos
    setTimeout(() => {
      try {
        if (typeof updateButtonsForCartItems === 'function') {
          updateButtonsForCartItems();
        }
        console.log(`✅ [SYNC] Fallback method completed successfully`);
      } catch (error) {
        console.error(`❌ [SYNC] Error updating buttons:`, error);
      }
    }, newPhotos.length * 60 + 200);
    
  } catch (error) {
    console.error(`❌ [SYNC] Critical error in fallback method:`, error);
  }
}

// 🔧 NOVA FUNÇÃO: Atualizar galeria sem refresh
function updateGalleryAfterSold() {
  // Verificar e remover todas as fotos vendidas
  checkAndRemoveSoldPhotosFromInterface();
  
  // Mostrar notificação suave
  showToast('Gallery updated - sold items removed', 'info');
}