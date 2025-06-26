// Script para criar estrutura hierárquica do Brazil Top Selected
const fs = require('fs').promises;
const path = require('path');

const BASE_PATH = '/opt/render/project/storage/cache/fotos/imagens-webp/Brazil Top Selected Categories';

// Mapeamento de cores (agrupando variações)
const COLOR_GROUPS = {
  'Black-White': [
    'Brazil Black & White',
    'Brazil Black & White Reddish'
  ],
  'Brindle': [
    'Brazil Brindle Grey',
    'Brazil Brindle Light Grey-Beige',
    'Brazil Brindle Light Grey - Beige',
    'Brazil Brindle Medium Tone',
    'Brazil Brindle White Backbone',
    'Brazil Brindle White Belly'
  ],
  'Salt-Pepper': [
    'Brazil Salt & Pepper - Tricolor - Brown and White',
    'Brazil Salt & Pepper Black and White',
    'Brazil Salt & Pepper Chocolate and White'
  ],
  'Brown-White': ['Brazil Brown & White'],
  'Grey': ['Brazil Grey', 'Brazil Grey Beige'],
  'Palomino': ['Brazil Palomino Exotic', 'Brazil Palomino Solid', 'Brazil Palomino'],
  'Hereford': ['Brazil Hereford'],
  'Champagne': ['Brazil Champagne'],
  'Buttercream': ['Brazil Buttercream'],
  'Natural-White': ['Brazil Natural White'],
  'Taupe': ['Brazil Taupe'],
  'Tricolor': ['Brazil Tricolor']
};

async function createHierarchy() {
  console.log('🏗️ Criando nova estrutura hierárquica Brazil Top Selected...');
  
  // Criar estrutura para cada cor
  for (const colorGroup of Object.keys(COLOR_GROUPS)) {
    console.log(`📁 Criando grupo: ${colorGroup}`);
    
    // Criar pasta da cor
    const colorPath = path.join(BASE_PATH, colorGroup);
    await fs.mkdir(colorPath, { recursive: true });
    
    // Criar subpastas de tamanho
    await fs.mkdir(path.join(colorPath, 'Small'), { recursive: true });
    await fs.mkdir(path.join(colorPath, 'Medium-Large'), { recursive: true });
    await fs.mkdir(path.join(colorPath, 'Extra-Large'), { recursive: true });
    
    console.log(`  ✅ ${colorGroup}: Small, Medium-Large, Extra-Large`);
  }
  
  console.log('\n🎉 Estrutura criada! Próximo: mover as fotos');
}

createHierarchy().catch(console.error);