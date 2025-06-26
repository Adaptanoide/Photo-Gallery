// Script para criar estrutura hierárquica correta - OPÇÃO A (subcategorias separadas)
const fs = require('fs').promises;
const path = require('path');

const BASE_PATH = '/opt/render/project/storage/cache/fotos/imagens-webp/Brazil Top Selected Categories';

// Mapeamento EXATO de cada subcategoria específica
const SUBCATEGORIES = [
  // Black & White
  { name: 'Black-White', sizes: ['Small', 'Medium-Large', 'Extra-Large'] },
  { name: 'Black-White-Reddish', sizes: ['Small', 'Medium-Large'] },
  
  // Brindle
  { name: 'Brindle-Grey', sizes: ['Medium-Large', 'Extra-Large'] },
  { name: 'Brindle-Light-Grey-Beige', sizes: ['Small', 'Medium-Large', 'Extra-Large'] },
  { name: 'Brindle-White-Backbone', sizes: ['Small', 'Medium-Large', 'Extra-Large'] },
  { name: 'Brindle-White-Belly', sizes: ['Small', 'Medium-Large', 'Extra-Large'] },
  { name: 'Brindle-Medium-Tone', sizes: ['Small'] },
  
  // Salt & Pepper
  { name: 'Salt-Pepper-Tricolor-Brown-White', sizes: ['Small', 'Medium-Large', 'Extra-Large'] },
  { name: 'Salt-Pepper-Tricolor-Brown-White-Medium', sizes: ['Medium-Large'] },
  { name: 'Salt-Pepper-Black-White', sizes: ['Small', 'Medium-Large', 'Extra-Large'] },
  { name: 'Salt-Pepper-Chocolate-White', sizes: ['Medium-Large', 'Extra-Large'] },
  
  // Outros
  { name: 'Brown-White', sizes: ['Small', 'Medium-Large', 'Extra-Large'] },
  { name: 'Buttercream', sizes: ['Medium-Large', 'Extra-Large'] },
  { name: 'Champagne', sizes: ['Small', 'Medium-Large', 'Extra-Large'] },
  { name: 'Grey-Beige', sizes: ['Small', 'Medium-Large', 'Extra-Large'] },
  { name: 'Grey', sizes: ['Small', 'Medium-Large', 'Extra-Large'] },
  { name: 'Hereford', sizes: ['Small', 'Medium-Large', 'Extra-Large'] },
  { name: 'Natural-White', sizes: ['Small', 'Medium-Large', 'Extra-Large'] },
  { name: 'Palomino-Exotic', sizes: ['Small', 'Medium-Large', 'Extra-Large'] },
  { name: 'Palomino-Solid', sizes: ['Extra-Large'] },
  { name: 'Palomino', sizes: ['Medium-Large'] },
  { name: 'Taupe', sizes: ['Small', 'Medium-Large', 'Extra-Large'] },
  { name: 'Tricolor', sizes: ['Small', 'Medium-Large', 'Extra-Large'] }
];

async function createCorrectHierarchy() {
  console.log('🏗️ Criando estrutura hierárquica CORRETA - cada subcategoria separada...');
  
  for (const subcategory of SUBCATEGORIES) {
    console.log(`📁 Criando: ${subcategory.name}`);
    
    // Criar pasta da subcategoria
    const subcategoryPath = path.join(BASE_PATH, subcategory.name);
    await fs.mkdir(subcategoryPath, { recursive: true });
    
    // Criar apenas os tamanhos que essa subcategoria tem
    for (const size of subcategory.sizes) {
      await fs.mkdir(path.join(subcategoryPath, size), { recursive: true });
    }
    
    console.log(`  ✅ ${subcategory.name}: ${subcategory.sizes.join(', ')}`);
  }
  
  console.log('\n🎉 Estrutura correta criada! Cada subcategoria tem sua própria pasta.');
  console.log('📋 Próximo: executar move-brazil-photos.js');
}

createCorrectHierarchy().catch(console.error);