// Analisador simples de categorias
function debugCategoryStructure() {
  console.log('🔍 Analisando estrutura de categorias...');
  
  // Buscar categorias do sistema atual
  if (window.categories && window.categories.length > 0) {
    const categories = window.categories.filter(cat => !cat.isAll);
    console.log(`📊 Total de categorias: ${categories.length}`);
    
    // Contar padrões
    let hierarchical = 0;
    let nameWithSize = 0;
    
    categories.forEach(cat => {
      const name = cat.name || '';
      if (name.includes('ML-XL') || name.includes('XL') || name.includes('Small')) {
        nameWithSize++;
      }
      if (name === 'Extra Large' || name === 'Small' || name === 'Medium Large') {
        hierarchical++;
      }
    });
    
    console.log(`📂 Categoras hierárquicas (pastas de tamanho): ${hierarchical}`);
    console.log(`🏷️ Categorias com tamanho no nome: ${nameWithSize}`);
    
    return { total: categories.length, hierarchical, nameWithSize };
  } else {
    console.log('❌ Nenhuma categoria encontrada');
    return null;
  }
}

// Disponibilizar globalmente
window.debugCategoryStructure = debugCategoryStructure;