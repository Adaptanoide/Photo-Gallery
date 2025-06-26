// Script para mover fotos para nova estrutura hierárquica
const fs = require('fs').promises;
const path = require('path');

const BASE_PATH = '/opt/render/project/storage/cache/fotos/imagens-webp/Brazil Top Selected Categories';

// Mesmo mapeamento de cores
const COLOR_GROUPS = {
  'Black-White': ['Brazil Black & White', 'Brazil Black & White Reddish'],
  'Brindle': ['Brazil Brindle Grey', 'Brazil Brindle Light Grey-Beige', 'Brazil Brindle Light Grey - Beige', 'Brazil Brindle Medium Tone', 'Brazil Brindle White Backbone', 'Brazil Brindle White Belly'],
  'Salt-Pepper': ['Brazil Salt & Pepper - Tricolor - Brown and White', 'Brazil Salt & Pepper Black and White', 'Brazil Salt & Pepper Chocolate and White'],
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

async function movePhotos() {
  console.log('🚚 Movendo fotos para nova estrutura...');
  
  const sizeFolders = ['Brazil Small', 'Brazil Medium Large', 'Brazil Extra Large'];
  
  for (const sizeFolder of sizeFolders) {
    console.log(`\n📂 ${sizeFolder}:`);
    const sizePath = path.join(BASE_PATH, sizeFolder);
    
    try {
      const categories = await fs.readdir(sizePath);
      
      for (const category of categories) {
        const categoryPath = path.join(sizePath, category);
        const stat = await fs.stat(categoryPath);
        
        if (stat.isDirectory()) {
          const { colorGroup, size } = categorizeFolder(category);
          
          if (colorGroup && size) {
            const destPath = path.join(BASE_PATH, colorGroup, size);
            await moveAllPhotos(categoryPath, destPath);
            console.log(`  ✅ ${category} → ${colorGroup}/${size}`);
          }
        }
      }
    } catch (error) {
      console.log(`  ❌ Erro: ${error.message}`);
    }
  }
  
  console.log('\n🎉 Movimentação concluída!');
}

function categorizeFolder(folderName) {
  let size = null;
  if (folderName.includes(' Small')) size = 'Small';
  else if (folderName.includes(' ML')) size = 'Medium-Large';  
  else if (folderName.includes(' XL')) size = 'Extra-Large';
  
  let colorGroup = null;
  for (const [group, patterns] of Object.entries(COLOR_GROUPS)) {
    for (const pattern of patterns) {
      if (folderName.includes(pattern)) {
        colorGroup = group;
        break;
      }
    }
    if (colorGroup) break;
  }
  
  return { colorGroup, size };
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
  } catch (error) {
    console.log(`    ❌ ${error.message}`);
  }
}

movePhotos().catch(console.error);