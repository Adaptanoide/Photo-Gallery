// Script para mover fotos Brazil Best Sellers para nova estrutura hierárquica
const fs = require('fs').promises;
const path = require('path');

const BASE_PATH = '/opt/render/project/storage/cache/fotos/imagens-webp/Brazil  Best Sellers';

// Mapeamento EXATO de cada pasta original para nova estrutura
const FOLDER_MAPPING = {
  // Best Value
  'Brazil Best Value - Brindle Medium & Dark Tones Mix - ML - XL': 'Best-Value/Brindle-Medium-Dark-Tones/Medium-Large-XL',
  'Brazil Best Value - Salt & Pepper Mix - Black & White  - ML - XL': 'Best-Value/Salt-Pepper-Black-White/Medium-Large-XL',
  'Brazil Best Value - Salt & Pepper Mix - Brown & White Tricolor - ML - XL': 'Best-Value/Salt-Pepper-Brown-White-Tricolor/Medium-Large-XL',
  'Brazil Best Value - Salt & Pepper Mix - Chocolate & White - ML - XL': 'Best-Value/Salt-Pepper-Chocolate-White/Medium-Large-XL',
  
  // Tones Mix
  'Brazil Dark Tones Mix  - ML - XL': 'Tones-Mix/Dark-Tones/Medium-Large-XL',
  'Brazil Exotic Tones Mix - ML - XL': 'Tones-Mix/Exotic-Tones/Medium-Large-XL',
  'Brazil Light Tones Mix  - ML - XL': 'Tones-Mix/Light-Tones/Medium-Large-XL',
  
  // Super Promo
  'Brazil Super Promo  - Assorted Natural Tones - Small': 'Super-Promo/Assorted-Natural-Tones/Small',
  'Brazil Super Promo  - Assorted Tones - Extra Small': 'Super-Promo/Assorted-Tones/Extra-Small'
};

async function moveBrazilBestSellersPhotos() {
  console.log('🚚 Movendo fotos Brazil Best Sellers para estrutura hierárquica...');
  
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
  
  console.log(`\n🎉 Movimentação Brazil Best Sellers concluída! Total: ${totalMoved} fotos movidas`);
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

moveBrazilBestSellersPhotos().catch(console.error);