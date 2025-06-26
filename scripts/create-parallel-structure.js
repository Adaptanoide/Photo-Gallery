// Script para criar estrutura hierárquica paralela (SEM MEXER NA ORIGINAL)
const fs = require('fs').promises;
const path = require('path');

const BASE_PATH = '/opt/render/project/storage/cache/fotos/imagens-webp';
const NEW_STRUCTURE_PATH = path.join(BASE_PATH, 'new-structure');

// Função principal
async function createParallelStructure() {
  console.log('🏗️ Criando estrutura hierárquica paralela...');
  console.log('✅ SEGURO: Estrutura original será mantida intacta!\n');
  
  try {
    // Criar pasta principal da nova estrutura
    await createNewStructureFolder();
    
    // Processar Brazil Top Selected
    await processBrazilHierarchy();
    
    // Processar Colombia Cowhides
    await processColombiaHierarchy();
    
    console.log('\n🎉 ESTRUTURA PARALELA CRIADA COM SUCESSO!');
    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('1. Testar nova estrutura');
    console.log('2. Se funcionar → migrar gradualmente');
    console.log('3. Se quebrar → deletar new-structure/');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

// Criar pasta da nova estrutura
async function createNewStructureFolder() {
  console.log('📁 Criando pasta new-structure...');
  
  try {
    await fs.mkdir(NEW_STRUCTURE_PATH, { recursive: true });
    console.log('✅ Pasta new-structure criada');
  } catch (error) {
    if (error.code === 'EEXIST') {
      console.log('ℹ️ Pasta new-structure já existe');
    } else {
      throw error;
    }
  }
}

// Processar Brazil Top Selected
async function processBrazilHierarchy() {
  console.log('\n🇧🇷 Processando Brazil Top Selected...');
  
  const brazilOriginalPath = path.join(BASE_PATH, 'Brazil Top Selected Categories');
  const brazilNewPath = path.join(NEW_STRUCTURE_PATH, 'Brazil-Top-Selected-Hierarchical');
  
  // Criar pasta Brazil na nova estrutura
  await fs.mkdir(brazilNewPath, { recursive: true });
  
  // Mapeamento de cores
  const colorMapping = {
    'Black & White': ['Brazil Black & White', 'Brazil Black & White Reddish'],
    'Brindle': ['Brazil Brindle Grey', 'Brazil Brindle Light Grey', 'Brazil Brindle Medium Tone', 'Brazil Brindle White Backbone', 'Brazil Brindle White Belly'],
    'Salt-Pepper': ['Brazil Salt & Pepper'],
    'Brown-White': ['Brazil Brown & White'],
    'Grey': ['Brazil Grey', 'Brazil Grey Beige'],
    'Palomino': ['Brazil Palomino Exotic', 'Brazil Palomino Solid', 'Brazil Palomino'],
    'Others': ['Brazil Hereford', 'Brazil Champagne', 'Brazil Buttercream', 'Brazil Natural White', 'Brazil Taupe', 'Brazil Tricolor']
  };
  
  // Processar cada cor
  for (const [colorGroup, patterns] of Object.entries(colorMapping)) {
    console.log(`  🎨 Processando grupo: ${colorGroup}`);
    
    const colorPath = path.join(brazilNewPath, colorGroup);
    await fs.mkdir(colorPath, { recursive: true });
    
    // Criar subpastas de tamanho
    await fs.mkdir(path.join(colorPath, 'Small'), { recursive: true });
    await fs.mkdir(path.join(colorPath, 'Medium-Large'), { recursive: true });
    await fs.mkdir(path.join(colorPath, 'Extra-Large'), { recursive: true });
    
    // Copiar fotos correspondentes
    await copyBrazilPhotos(brazilOriginalPath, colorPath, patterns);
  }
}

// Copiar fotos do Brazil
async function copyBrazilPhotos(originalPath, newColorPath, patterns) {
  const sizeFolders = ['Brazil Small', 'Brazil Medium Large', 'Brazil Extra Large'];
  const sizeMapping = {
    'Brazil Small': 'Small',
    'Brazil Medium Large': 'Medium-Large', 
    'Brazil Extra Large': 'Extra-Large'
  };
  
  for (const sizeFolder of sizeFolders) {
    const sizePath = path.join(originalPath, sizeFolder);
    
    try {
      const colorFolders = await fs.readdir(sizePath);
      
      for (const colorFolder of colorFolders) {
        // Verificar se esta cor corresponde aos padrões
        const matchesPattern = patterns.some(pattern => 
          colorFolder.includes(pattern.replace('Brazil ', ''))
        );
        
        if (matchesPattern) {
          const originalColorPath = path.join(sizePath, colorFolder);
          const newSizePath = path.join(newColorPath, sizeMapping[sizeFolder]);
          
          // Copiar fotos
          await copyPhotosFromFolder(originalColorPath, newSizePath);
        }
      }
    } catch (error) {
      console.log(`    ⚠️ Pasta ${sizeFolder} não encontrada`);
    }
  }
}

// Processar Colombia Cowhides
async function processColombiaHierarchy() {
  console.log('\n🇨🇴 Processando Colombia Cowhides...');
  
  const colombiaOriginalPath = path.join(BASE_PATH, 'Colombia Cowhides');
  const colombiaNewPath = path.join(NEW_STRUCTURE_PATH, 'Colombia-Cowhides-Hierarchical');
  
  // Criar pasta Colombia na nova estrutura
  await fs.mkdir(colombiaNewPath, { recursive: true });
  
  // Mapeamento de cores Colombia
  const colorMapping = {
    'Black-White': ['Colombia Black & White'],
    'Brown-White': ['Colombia Brown & White'],
    'Tricolor': ['Colombia Tricolor Mix', 'Colombia Tricolor Spotted', 'Colombia Tricolor Clouded'],
    'Brindle': ['Colombia Brindle Mix'],
    'Exotic': ['Colombia Exotic Tones']
  };
  
  // Processar cada cor
  for (const [colorGroup, patterns] of Object.entries(colorMapping)) {
    console.log(`  🎨 Processando grupo: ${colorGroup}`);
    
    const colorPath = path.join(colombiaNewPath, colorGroup);
    await fs.mkdir(colorPath, { recursive: true });
    
    // Criar subpastas de tamanho
    await fs.mkdir(path.join(colorPath, 'Medium'), { recursive: true });
    await fs.mkdir(path.join(colorPath, 'Large'), { recursive: true });
    await fs.mkdir(path.join(colorPath, 'X-Large'), { recursive: true });
    
    // Copiar fotos correspondentes
    await copyColombiaPhotos(colombiaOriginalPath, colorPath, patterns);
  }
}

// Copiar fotos do Colombia
async function copyColombiaPhotos(originalPath, newColorPath, patterns) {
  const sizeFolders = ['Colombia Medium', 'Colombia Large', 'Colombia X-Large'];
  const sizeMapping = {
    'Colombia Medium': 'Medium',
    'Colombia Large': 'Large',
    'Colombia X-Large': 'X-Large'
  };
  
  for (const sizeFolder of sizeFolders) {
    const sizePath = path.join(originalPath, sizeFolder);
    
    try {
      const colorFolders = await fs.readdir(sizePath);
      
      for (const colorFolder of colorFolders) {
        // Verificar se esta cor corresponde aos padrões
        const matchesPattern = patterns.some(pattern => 
          colorFolder.includes(pattern.replace('Colombia ', ''))
        );
        
        if (matchesPattern) {
          const originalColorPath = path.join(sizePath, colorFolder);
          const newSizePath = path.join(newColorPath, sizeMapping[sizeFolder]);
          
          // Copiar fotos
          await copyPhotosFromFolder(originalColorPath, newSizePath);
        }
      }
    } catch (error) {
      console.log(`    ⚠️ Pasta ${sizeFolder} não encontrada`);
    }
  }
}

// Copiar fotos de uma pasta para outra
async function copyPhotosFromFolder(sourcePath, destPath) {
  try {
    const files = await fs.readdir(sourcePath);
    const photos = files.filter(file => file.endsWith('.webp'));
    
    if (photos.length > 0) {
      // Garantir que pasta destino existe
      await fs.mkdir(destPath, { recursive: true });
      
      console.log(`    📸 Copiando ${photos.length} fotos para ${path.basename(destPath)}`);
      
      // Copiar cada foto
      for (const photo of photos) {
        const sourceFile = path.join(sourcePath, photo);
        const destFile = path.join(destPath, photo);
        await fs.copyFile(sourceFile, destFile);
      }
    }
  } catch (error) {
    console.log(`    ❌ Erro ao copiar de ${sourcePath}: ${error.message}`);
  }
}

// Executar
createParallelStructure();