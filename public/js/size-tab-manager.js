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

  // Mostrar seção do tamanho
  showSizeSection(size, categories) {
    const contentDiv = document.getElementById('content');
    
    let html = `
      <div class="size-section" data-size="${size}">
        <div class="size-section-header">
          <h2>${size} - ${this.currentGroup.displayName}</h2>
          <p>${categories.length} categories available</p>
        </div>
        <div class="size-section-content">
          <div class="placeholder-message">
            📸 Carregamento de fotos será implementado no próximo passo!
            <br><br>
            <strong>Categorias neste tamanho:</strong>
            <ul>
              ${categories.map(cat => `<li>${cat.name}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
    `;
    
    contentDiv.innerHTML = html;
    console.log(`✅ Seção ${size} exibida com ${categories.length} categorias`);
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
}

// Instância global
const sizeTabManager = new SizeTabManager();
window.sizeTabManager = sizeTabManager;