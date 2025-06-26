// Script para mover fotos para estrutura hierárquica detalhada
const fs = require('fs').promises;
const path = require('path');

const BASE_PATH = '/opt/render/project/storage/cache/fotos/imagens-webp/Brazil Top Selected Categories';

// Mapeamento EXATO de cada pasta original para nova estrutura
const FOLDER_MAPPING = {
  // Black & White
  'Brazil Black & White Small': 'Black-White/Small',
  'Brazil Black & White ML': 'Black-White/Medium-Large',
  'Brazil Black & White XL': 'Black-White/Extra-Large',
  'Brazil Black & White Reddish Small': 'Black-White-Reddish/Small',
  'Brazil Black & White Reddish ML': 'Black-White-Reddish/Medium-Large',
  
  // Brindle
  'Brazil Brindle Grey ML': 'Brindle-Grey/Medium-Large',
  'Brazil Brindle Grey XL': 'Brindle-Grey/Extra-Large',
  'Brazil Brindle Light Grey-Beige Small': 'Brindle-Light-Grey-Beige/Small',
  'Brazil Brindle Light Grey - Beige Small': 'Brindle-Light-Grey-Beige/Small',
  'Brazil Brindle Light Grey-Beige ML': 'Brindle-Light-Grey-Beige/Medium-Large',
  'Brazil Brindle Light Grey-Beige XL': 'Brindle-Light-Grey-Beige/Extra-Large',
  'Brazil Brindle White Backbone Small': 'Brindle-White-Backbone/Small',
  'Brazil Brindle White Backbone ML': 'Brindle-White-Backbone/Medium-Large',
  'Brazil Brindle White Backbone XL': 'Brindle-White-Backbone/Extra-Large',
  'Brazil Brindle White Belly Small': 'Brindle-White-Belly/Small',
  'Brazil Brindle White Belly ML': 'Brindle-White-Belly/Medium-Large',
  'Brazil Brindle White Belly XL': 'Brindle-White-Belly/Extra-Large',
  'Brazil Brindle Medium Tone Small': 'Brindle-Medium-Tone/Small',
  
  // Salt & Pepper
  'Brazil Salt & Pepper - Tricolor - Brown and White Small': 'Salt-Pepper-Tricolor-Brown-White/Small',
  'Brazil Salt & Pepper - Tricolor - Brown and White ML': 'Salt-Pepper-Tricolor-Brown-White/Medium-Large',
  'Brazil Salt & Pepper - Tricolor - Brown and White XL': 'Salt-Pepper-Tricolor-Brown-White/Extra-Large',
  'Brazil Salt & Pepper - Tricolor - Brown and White Medium ML': 'Salt-Pepper-Tricolor-Brown-White-Medium/Medium-Large',
  'Brazil Salt & Pepper Black and White Small': 'Salt-Pepper-Black-White/Small',
  'Brazil Salt & Pepper Black and White ML': 'Salt-Pepper-Black-White/Medium-Large',
  'Brazil Salt & Pepper Black and White XL': 'Salt-Pepper-Black-White/Extra-Large',
  'Brazil Salt & Pepper Chocolate and White ML': 'Salt-Pepper-Chocolate-White/Medium-Large',
  'Brazil Salt & Pepper Chocolate and White XL': 'Salt-Pepper-Chocolate-White/Extra-Large',
  
  // Outros
  'Brazil Brown & White Small': 'Brown-White/Small',
  'Brazil Brown & White ML': 'Brown-White/Medium-Large',
  'Brazil Brown & White XL': 'Brown-White/Extra-Large',
  'Brazil Buttercream ML': 'Buttercream/Medium-Large',
  'Brazil Buttercream XL': 'Buttercream/Extra-Large',
  'Brazil Champagne Small': 'Champagne/Small',
  'Brazil Champagne ML': 'Champagne/Medium-Large',
  'Brazil Champagne XL': 'Champagne/Extra-Large',
  'Brazil Grey Beige Small': 'Grey-Beige/Small',
  'Brazil Grey Beige ML': 'Grey-Beige/Medium-Large',
  'Brazil Grey Beige XL': 'Grey-Beige/Extra-Large',
  'Brazil Grey Small': 'Grey/Small',
  'Brazil Grey ML': 'Grey/Medium-Large',
  'Brazil Grey XL': 'Grey/Extra-Large',
  'Brazil Hereford Small': 'Hereford/Small',
  'Brazil Hereford ML': 'Hereford/Medium-Large',
  'Brazil Hereford XL': 'Hereford/Extra-Large',
  'Brazil Natural White Small': 'Natural-White/Small',
  'Brazil Natural White ML': 'Natural-White/Medium-Large',
  'Brazil Natural White XL': 'Natural-White/Extra-Large',
  'Brazil Palomino Exotic Small': 'Palomino-Exotic/Small',
  'Brazil Palomino Exotic ML': 'Palomino-Exotic/Medium-Large',
  'Brazil Palomino Exotic XL': 'Palomino-Exotic/Extra-Large',
  'Brazil Palomino Solid XL': 'Palomino-Solid/Extra-Large',
  'Brazil Palomino ML': 'Palomino/Medium-Large',
  'Brazil Taupe Small': 'Taupe/Small',
  'Brazil Taupe ML': 'Taupe/Medium-Large',
  'Brazil Taupe XL': 'Taupe/Extra-Large',
  'Brazil Tricolor Small': 'Tricolor/Small',
  'Brazil Tricolor ML': 'Tricolor/Medium-Large',
  'Brazil Tricolor XL': 'Tricolor/Extra-Large'
};

async function movePhotos() {
  console.log('🚚 Movendo fotos para estrutura hierárquica detalhada...');
  
  const sizeFolders = ['Brazil Small', 'Brazil Medium Large', 'Brazil Extra Large'];
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
  
  console.log(`\n🎉 Movimentação concluída! Total: ${totalMoved} fotos movidas`);
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

movePhotos().catch(console.error);