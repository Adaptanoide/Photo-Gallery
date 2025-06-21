// ===== GERENCIADOR DE ABAS DE TAMANHO =====

class SizeTabManager {
    constructor() {
        this.currentGroup = null;
        this.currentSize = null;
    }

    // Definir grupo atual
    setCurrentGroup(groupData) {
        this.currentGroup = groupData;
        console.log(`📂 Grupo definido: ${groupData.displayName}`);
    }

    // Selecionar tamanho
    selectSize(size) {
        console.log(`📏 Tamanho selecionado: ${size}`);

        // Atualizar visual das abas
        this.updateTabVisual(size);

        // Carregar fotos do tamanho selecionado
        this.loadPhotosForSize(size);

        this.currentSize = size;
    }

    // Atualizar visual da aba ativa
    updateTabVisual(selectedSize) {
        const tabs = document.querySelectorAll('.size-tab');

        tabs.forEach(tab => {
            const tabSize = tab.getAttribute('data-size');

            if (tabSize === selectedSize) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        console.log(`✅ Aba visual atualizada para: ${selectedSize}`);
    }

    // Carregar fotos para o tamanho específico
    async loadPhotosForSize(size) {
        if (!this.currentGroup) {
            console.error('❌ Nenhum grupo definido');
            return;
        }

        console.log(`🔄 Carregando fotos para: ${this.currentGroup.displayName} - ${size}`);

        // Obter categorias do tamanho específico
        const categoriesForSize = window.categoryGrouper.getCategoriesForGroupAndSize(this.currentGroup, size);

        console.log(`📊 Categorias encontradas para ${size}: ${categoriesForSize.length}`);

        if (categoriesForSize.length === 0) {
            this.showEmptyMessage(size);
            return;
        }

        // ✅ MOSTRAR LOADER
        if (typeof showLoader === 'function') {
            showLoader();
        }

        try {
            // ✅ CARREGAR FOTOS DE TODAS AS CATEGORIAS DO TAMANHO
            const allPhotos = [];

            for (const category of categoriesForSize) {
                console.log(`📂 Carregando categoria: ${category.name} (ID: ${category.id})`);

                // ✅ OBTER CUSTOMER CODE DE FORMA SEGURA
                const customerCode = window.currentCustomerCode || '4484';

                const response = await fetch(`/api/photos?category_id=${category.id}&customer_code=${customerCode}&limit=100`);
                const photos = await response.json();

                if (Array.isArray(photos) && photos.length > 0) {
                    // Adicionar informação da categoria às fotos
                    photos.forEach(photo => {
                        photo.categoryInfo = {
                            id: category.id,
                            name: category.name,
                            size: size
                        };
                    });

                    allPhotos.push(...photos);
                    console.log(`✅ ${photos.length} fotos carregadas de ${category.name}`);

                    // ✅ DEBUG: Ver propriedades da primeira foto
                    if (photos.length > 0) {
                        console.log('📝 Primeira foto:', photos[0]);
                        console.log('📝 Propriedades disponíveis:', Object.keys(photos[0]));
                    }
                }
            }

            console.log(`🎯 Total de fotos carregadas para ${size}: ${allPhotos.length}`);

            // ✅ ATUALIZAR REGISTRY DE FOTOS
            if (window.photoRegistry) {
                allPhotos.forEach(photo => {
                    window.photoRegistry[photo.id] = photo;
                });
            }

            // ✅ RENDERIZAR FOTOS POR SEÇÃO DE TAMANHO
            this.renderSizeSection(size, allPhotos, categoriesForSize);

        } catch (error) {
            console.error(`❌ Erro ao carregar fotos para ${size}:`, error);
            this.showErrorMessage(size, error.message);
        } finally {
            // ✅ ESCONDER LOADER
            if (typeof hideLoader === 'function') {
                hideLoader();
            }
        }
    }

    // ✅ RENDERIZAR SEÇÃO DO TAMANHO COM FOTOS REAIS
    renderSizeSection(size, photos, categories) {
        const contentDiv = document.getElementById('content');

        if (!photos || photos.length === 0) {
            this.showEmptyMessage(size);
            return;
        }

        // ✅ CRIAR HTML DA SEÇÃO
        let html = `
    <div class="size-section" data-size="${size}">
      <div class="size-section-header">
        <h2>${size} - ${this.currentGroup.displayName}</h2>
        <p>${photos.length} photos from ${categories.length} categories</p>
      </div>
      <div class="size-section-content">
  `;

        // ✅ AGRUPAR FOTOS POR CATEGORIA PARA ORGANIZAÇÃO
        const photosByCategory = {};
        photos.forEach(photo => {
            const categoryId = photo.categoryInfo.id;
            if (!photosByCategory[categoryId]) {
                photosByCategory[categoryId] = {
                    category: photo.categoryInfo,
                    photos: []
                };
            }
            photosByCategory[categoryId].photos.push(photo);
        });

        // ✅ RENDERIZAR CADA SUBCATEGORIA
        Object.values(photosByCategory).forEach(group => {
            html += `
      <div class="subcategory-section">
        <h3 class="subcategory-title">${group.category.name}</h3>
        <div class="photos-grid">
    `;

            // ✅ RENDERIZAR FOTOS DA SUBCATEGORIA
            group.photos.forEach((photo, index) => {
                const alreadyAdded = window.cartIds && window.cartIds.includes(photo.id);
                const priceText = photo.price ? `$${photo.price.toFixed(2)}` : 'Price on request';

                html += `
        <div class="photo-item" id="photo-${photo.id}" data-photo-index="${index}">
          <div class="photo-container">
            <img src="${photo.thumbnail || photo.webpUrl || photo.originalUrl || photo.url}" 
                 alt="${photo.fileName}" 
                 loading="lazy"
                 onclick="openLightboxFromSection(${index})">
            <div class="photo-overlay">
              <div class="photo-info">
                <div class="photo-price">${priceText}</div>
                <button class="btn ${alreadyAdded ? 'btn-secondary' : 'btn-gold'} photo-select-btn" 
                        onclick="togglePhotoSelection('${photo.id}')"
                        ${alreadyAdded ? 'disabled' : ''}>
                  ${alreadyAdded ? 'Added ✓' : 'Select'}
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
            });

            html += `
        </div>
      </div>
    `;
        });

        html += `
      </div>
    </div>
  `;

        // ✅ ATUALIZAR CONTEÚDO
        contentDiv.innerHTML = html;
        contentDiv.className = 'gallery size-section-gallery';

        console.log(`✅ Seção ${size} renderizada com ${photos.length} fotos`);

        // ✅ CONFIGURAR LIGHTBOX PARA ESTA SEÇÃO
        this.setupSectionLightbox(photos);
    }

    // Mostrar mensagem vazia
    showEmptyMessage(size) {
        const contentDiv = document.getElementById('content');
        contentDiv.innerHTML = `
      <div class="empty-message">
        <h3>No photos available</h3>
        <p>No categories found for size: ${size}</p>
      </div>
    `;
    }

    // Configurar lightbox para fotos da seção
    setupSectionLightbox(photos) {
        // Atualizar variáveis globais do lightbox
        if (window.photos !== undefined) {
            window.photos = photos;
        }

        // ✅ CONFIGURAR ZOOM PARA IMAGENS (se existir)
        if (typeof window.setupImageZoom === 'function') {
            window.setupImageZoom();
        }

        console.log(`🔍 Lightbox configurado para ${photos.length} fotos`);
    }

    // Mostrar mensagem de erro
    showErrorMessage(size, errorMessage) {
        const contentDiv = document.getElementById('content');
        contentDiv.innerHTML = `
    <div class="error-message">
      <h3>Error loading ${size} photos</h3>
      <p>Could not load photos for ${this.currentGroup.displayName} - ${size}</p>
      <p class="error-details">${errorMessage}</p>
      <button class="btn btn-secondary" onclick="sizeTabManager.selectSize('${size}')">
        Try Again
      </button>
    </div>
  `;
    }
}

// Instância global
const sizeTabManager = new SizeTabManager();
window.sizeTabManager = sizeTabManager;

// ✅ FUNÇÃO SIMPLIFICADA: Abrir lightbox da seção atual
window.openLightboxFromSection = function(photoIndex = 0) {
    console.log(`🔍 Abrindo lightbox da seção atual no índice ${photoIndex}`);
    
    // Usar as fotos já carregadas globalmente
    if (window.photos && window.photos.length > 0) {
        if (typeof window.openLightbox === 'function') {
            window.openLightbox(photoIndex);
        } else {
            console.error('❌ Função openLightbox não encontrada');
        }
    } else {
        console.error('❌ Nenhuma foto disponível para o lightbox');
    }
};

// ✅ FUNÇÃO GLOBAL: Abrir lightbox com fotos específicas (CORRIGIDA)
window.openLightboxWithPhotos = function (photoIds, startIndex = 0) {
    console.log(`🔍 Abrindo lightbox com fotos específicas`);

    // ✅ DEBUG: Verificar o que está sendo passado
    console.log('📝 Photo IDs recebidos:', photoIds);
    console.log('📝 Photo Registry disponível:', Object.keys(window.photoRegistry || {}));

    // ✅ MÉTODO MAIS SEGURO: Usar as fotos já carregadas na seção atual
    const currentPhotos = window.photos || [];
    
    if (currentPhotos.length === 0) {
        console.error('❌ Nenhuma foto disponível no contexto atual');
        return;
    }

    // Usar as fotos atuais em vez de buscar no registry
    const photosToShow = currentPhotos;

    if (photosToShow.length === 0) {
        console.error('❌ Nenhuma foto encontrada para o lightbox');
        return;
    }

    // ✅ ATUALIZAR VARIÁVEIS GLOBAIS DO LIGHTBOX
    if (window.photos !== undefined) {
        window.photos = photosToShow;
    }

    // ✅ ABRIR LIGHTBOX (usando função existente)
    if (typeof window.openLightbox === 'function') {
        window.openLightbox(startIndex);
    } else {
        console.error('❌ Função openLightbox não encontrada');
    }
};