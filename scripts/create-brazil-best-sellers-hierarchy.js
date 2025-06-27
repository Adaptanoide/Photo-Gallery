// Script para criar estrutura hierárquica do Brazil Best Sellers
const fs = require('fs').promises;
const path = require('path');

const BASE_PATH = '/opt/render/project/storage/cache/fotos/imagens-webp/Brazil  Best Sellers';

// Estrutura hierárquica organizada por grupos
const HIERARCHY = {
  'Best-Value': {
    'Salt-Pepper-Black-White': ['Medium-Large-XL'],
    'Salt-Pepper-Brown-White-Tricolor': ['Medium-Large-XL'],
    'Salt-Pepper-Chocolate-White': ['Medium-Large-XL'],
    'Brindle-Medium-Dark-Tones': ['Medium-Large-XL']
  },
  'Tones-Mix': {
    'Dark-Tones': ['Medium-Large-XL'],
    'Exotic-Tones': ['Medium-Large-XL'],
    'Light-Tones': ['Medium-Large-XL']
  },
  'Super-Promo': {
    'Assorted-Natural-Tones': ['Small'],
    'Assorted-Tones': ['Extra-Small']
  }
};

async function createBrazilBestSellersHierarchy() {
  console.log('🏗️ Criando estrutura hierárquica Brazil Best Sellers...');
  console.log('📋 Padrão: Categoria → Tipo → Cor → Tamanho-Misturado');
  
  for (const [groupName, subcategories] of Object.entries(HIERARCHY)) {
    console.log(`\n📁 Criando grupo: ${groupName}`);
    
    // Criar pasta do grupo
    const groupPath = path.join(BASE_PATH, groupName);
    await fs.mkdir(groupPath, { recursive: true });
    
    for (const [subcategoryName, sizes] of Object.entries(subcategories)) {
      console.log(`  🎨 Criando: ${subcategoryName}`);
      
      // Criar pasta da subcategoria
      const subcategoryPath = path.join(groupPath, subcategoryName);
      await fs.mkdir(subcategoryPath, { recursive: true });
      
      // Criar pastas de tamanho
      for (const size of sizes) {
        await fs.mkdir(path.join(subcategoryPath, size), { recursive: true });
      }
      
      console.log(`    ✅ ${subcategoryName}: ${sizes.join(', ')}`);
    }
  }
  
  console.log('\n🎉 Estrutura Brazil Best Sellers criada!');
  console.log('📋 Próximo: executar move-brazil-best-sellers-photos.js');
}

createBrazilBestSellersHierarchy().catch(console.error);