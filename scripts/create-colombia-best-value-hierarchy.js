// Script para criar estrutura hierárquica do Colombia Best Value
const fs = require('fs').promises;
const path = require('path');

const BASE_PATH = '/opt/render/project/storage/cache/fotos/imagens-webp/Colombia Best Value';

// Estrutura hierárquica simples (3 níveis)
const HIERARCHY = {
  'Tricolor-Dark-Tones-Creamish-White': ['Small-ML', 'Large-XL']
};

async function createColombiaBestValueHierarchy() {
  console.log('🏗️ Criando estrutura hierárquica Colombia Best Value...');
  console.log('📋 Padrão: Categoria → Subcategoria → Tamanho-Misturado (3 níveis)');
  
  for (const [subcategoryName, sizes] of Object.entries(HIERARCHY)) {
    console.log(`📁 Criando: ${subcategoryName}`);
    
    // Criar pasta da subcategoria
    const subcategoryPath = path.join(BASE_PATH, subcategoryName);
    await fs.mkdir(subcategoryPath, { recursive: true });
    
    // Criar pastas de tamanho
    for (const size of sizes) {
      await fs.mkdir(path.join(subcategoryPath, size), { recursive: true });
    }
    
    console.log(`  ✅ ${subcategoryName}: ${sizes.join(', ')}`);
  }
  
  console.log('\n🎉 Estrutura Colombia Best Value criada!');
  console.log('📋 Próximo: executar move-colombia-best-value-photos.js');
}

createColombiaBestValueHierarchy().catch(console.error);