// Script para mover fotos Colombia Best Value para nova estrutura hierárquica
const fs = require('fs').promises;
const path = require('path');

const BASE_PATH = '/opt/render/project/storage/cache/fotos/imagens-webp/Colombia Best Value';

// Mapeamento EXATO de cada pasta original para nova estrutura
const FOLDER_MAPPING = {
  'Value Tricolor Dark Tones & Creamish White Small-ML': 'Tricolor-Dark-Tones-Creamish-White/Small-ML',
  'Value Tricolor Dark Tones & Creamish White Large-XL': 'Tricolor-Dark-Tones-Creamish-White/Large-XL'
};

async function moveColombiaBestValuePhotos() {
  console.log('🚚 Movendo fotos Colombia Best Value para estrutura hierárquica...');
  
  let totalMoved = 0;
  
  try {
    const categories = await fs.readdir(BASE_PATH);
    
    for (const category of categories) {
      const categoryPath = path.join(BASE_PATH, category);
      const stat = await fs.stat(categoryPath);
      
      if (stat.isDirectory()) {
        const newPath = FOLDER_MAPPING[category];
        
        if (newPath) {
          const destPath = path.join(BASE_PATH, newPath);
          const moved = await moveAllPhotos(categoryPath, destPath);
          totalMoved += moved;
          console.log(`✅ ${category}`);
          console.log(`   → ${newPath} (${moved} fotos)`);
        } else {
          console.log(`⚠️ Não mapeado: ${category}`);
        }
      }
    }
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
  }
  
  console.log(`\n🎉 Movimentação Colombia Best Value concluída! Total: ${totalMoved} fotos movidas`);
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

moveColombiaBestValuePhotos().catch(console.error);