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
    loadPhotosForSize(size) {
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

        // TODO: Implementar carregamento de fotos por seções
        // Por enquanto, vamos mostrar um placeholder
        this.showSizeSection(size, categoriesForSize);
    }

    // ✅ NOVO MÉTODO: Renderizar seção do tamanho com fotos reais
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
            <img src="${photo.thumbnailUrl || photo.url}" 
                 alt="${photo.fileName}" 
                 loading="lazy"
                 onclick="openLightboxWithPhotos([${group.photos.map(p => `'${p.id}'`).join(',')}], ${index})">
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
// ✅ FUNÇÃO GLOBAL: Abrir lightbox com fotos específicas
window.openLightboxWithPhotos = function (photoIds, startIndex = 0) {
    console.log(`🔍 Abrindo lightbox com ${photoIds.length} fotos, iniciando no índice ${startIndex}`);

    // Obter fotos completas do registry
    const photosToShow = photoIds.map(id => window.photoRegistry[id]).filter(Boolean);

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