// Script para mover fotos Colombia para nova estrutura hierárquica
const fs = require('fs').promises;
const path = require('path');

const BASE_PATH = '/opt/render/project/storage/cache/fotos/imagens-webp/Colombia Cowhides';

// Mapeamento EXATO de cada pasta original para nova estrutura
const FOLDER_MAPPING = {
  // Medium
  'Colombia Black & White M': 'Black-White/Medium',
  'Colombia Brindle Mix M': 'Brindle-Mix/Medium',
  'Colombia Brown & White M': 'Brown-White/Medium',
  'Colombia Tricolor Mix M': 'Tricolor-Mix/Medium',
  'Colombia Tricolor Spotted M': 'Tricolor-Spotted/Medium',
  
  // Large
  'Colombia Black & White L': 'Black-White/Large',
  'Colombia Brindle Mix L': 'Brindle-Mix/Large',
  'Colombia Brown & White': 'Brown-White/Large', // Este não tem L no final
  'Colombia Tricolor Clouded L': 'Tricolor-Clouded/Large',
  'Colombia Tricolor Mix L': 'Tricolor-Mix/Large',
  'Colombia Tricolor Spotted L': 'Tricolor-Spotted/Large',
  
  // X-Large
  'Colombia Black & White XL': 'Black-White/X-Large',
  'Colombia Brindle Mix XL': 'Brindle-Mix/X-Large',
  'Colombia Brown & White XL': 'Brown-White/X-Large',
  'Colombia Exotic Tones XL': 'Exotic-Tones/X-Large',
  'Colombia Tricolor Clouded XL': 'Tricolor-Clouded/X-Large',
  'Colombia Tricolor Mix XL': 'Tricolor-Mix/X-Large',
  'Colombia Tricolor Spotted XL': 'Tricolor-Spotted/X-Large'
};

async function moveColombiaPhotos() {
  console.log('🚚 Movendo fotos Colombia para estrutura hierárquica...');
  
  const sizeFolders = ['Colombia Medium', 'Colombia Large', 'Colombia X-Large'];
  let totalMoved = 0;
  
  for (const sizeFolder of sizeFolders) {
    console.log(`\n📂 Processando: ${sizeFolder}`);
    const sizePath = path.join(BASE_PATH, sizeFolder);
    
    try {
      const categories = await fs.readdir(sizePath);
      
      for (const category of categories) {
        const categoryPath = path.join(sizePath, category);
        const stat = await fs.stat(categoryPath);
        
        if (stat.isDirectory()) {
          const newPath = FOLDER_MAPPING[category];
          
          if (newPath) {
            const destPath = path.join(BASE_PATH, newPath);
            const moved = await moveAllPhotos(categoryPath, destPath);
            totalMoved += moved;
            console.log(`  ✅ ${category} → ${newPath} (${moved} fotos)`);
          } else {
            console.log(`  ⚠️ Não mapeado: ${category}`);
          }
        }
      }
    } catch (error) {
      console.log(`  ❌ Erro: ${error.message}`);
    }
  }
  
  console.log(`\n🎉 Movimentação Colombia concluída! Total: ${totalMoved} fotos movidas`);
}

async function moveAllPhotos(sourcePath, destPath) {
  try {
    const files = await fs.readdir(sourcePath);
    const photos = files.filter(file => file.endsWith('.webp'));
    
    for (const photo of photos) {
      await fs.rename(
        path.join(sourcePath, photo),
        path.join(destPath, photo)
      );
    }
    
    return photos.length;
  } catch (error) {
    console.log(`    ❌ ${error.message}`);
    return 0;
  }
}

moveColombiaPhotos().catch(console.error);