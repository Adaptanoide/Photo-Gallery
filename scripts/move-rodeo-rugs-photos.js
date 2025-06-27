// Script para mover fotos Rodeo Rugs & Round Rugs para nova estrutura hierárquica
const fs = require('fs').promises;
const path = require('path');

const BASE_PATH = '/opt/render/project/storage/cache/fotos/imagens-webp/Rodeo Rugs & Round Rugs';

// Mapeamento EXATO de cada pasta original para nova estrutura
const FOLDER_MAPPING = {
  // Brazil Round Rugs
  'Brazil Round Rug Multi Star 80': 'Brazil-Round-Rug/Multi-Star-80',
  'Brazil Round Rug Single Star 40': 'Brazil-Round-Rug/Single-Star-40',
  'Brazil Round Rug Single Star 60': 'Brazil-Round-Rug/Single-Star-60',
  
  // Colombia Rodeo Rugs 3x5
  'Colombia Rodeo Rug 3 x 5 Longhorns': 'Colombia-Rodeo-Rug-3x5/Longhorns',
  'Colombia Rodeo Rug 3 x 5 Star': 'Colombia-Rodeo-Rug-3x5/Star',
  
  // Colombia Round Rugs
  'Colombia Round Rug Multi Star 60': 'Colombia-Round-Rug/Multi-Star-60',
  'Colombia Round Rug Single Star 40': 'Colombia-Round-Rug/Single-Star-40'
};

async function moveRodeoRugsPhotos() {
  console.log('🚚 Movendo fotos Rodeo Rugs & Round Rugs para estrutura hierárquica...');
  
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
  
  console.log(`\n🎉 Movimentação Rodeo Rugs & Round Rugs concluída! Total: ${totalMoved} fotos movidas`);
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

moveRodeoRugsPhotos().catch(console.error);