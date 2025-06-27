// Script para criar estrutura hierárquica do Colombia Cowhides
const fs = require('fs').promises;
const path = require('path');

const BASE_PATH = '/opt/render/project/storage/cache/fotos/imagens-webp/Colombia Cowhides';

// Subcategorias identificadas (cada uma terá os 4 tamanhos)
const SUBCATEGORIES = [
  'Black-White',
  'Brindle-Mix', 
  'Brown-White',
  'Tricolor-Mix',
  'Tricolor-Spotted',
  'Tricolor-Clouded',
  'Exotic-Tones'
];

// Todos os tamanhos (padronizado)
const ALL_SIZES = ['Small', 'Medium', 'Large', 'X-Large'];

async function createColombiaHierarchy() {
  console.log('🏗️ Criando estrutura hierárquica Colombia Cowhides...');
  console.log('📋 Padrão: Cor → 4 Tamanhos (Small, Medium, Large, X-Large)');
  
  for (const subcategory of SUBCATEGORIES) {
    console.log(`📁 Criando: ${subcategory}`);
    
    // Criar pasta da subcategoria
    const subcategoryPath = path.join(BASE_PATH, subcategory);
    await fs.mkdir(subcategoryPath, { recursive: true });
    
    // Criar TODOS os 4 tamanhos
    for (const size of ALL_SIZES) {
      await fs.mkdir(path.join(subcategoryPath, size), { recursive: true });
    }
    
    console.log(`  ✅ ${subcategory}: Small, Medium, Large, X-Large`);
  }
  
  console.log('\n🎉 Estrutura Colombia criada! Próximo: mover as fotos');
}

createColombiaHierarchy().catch(console.error);