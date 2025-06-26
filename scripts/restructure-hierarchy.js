// Script para reorganizar Brasil e Colombia: de "Tamanho→Cor" para "Cor→Tamanho"
const fs = require('fs').promises;
const path = require('path');

const BASE_PATH = '/opt/render/project/storage/cache/fotos/imagens-webp';

// Função principal
async function restructureHierarchy() {
  console.log('🔄 Iniciando reorganização da estrutura hierárquica...');
  
  try {
    // Analisar estrutura atual
    console.log('\n📊 ANALISANDO ESTRUTURA ATUAL:');
    await analyzeBrazilStructure();
    await analyzeColombiaStructure();
    
    console.log('\n🚀 Para aplicar as mudanças, execute com --apply');
    console.log('   node src/scripts/restructure-hierarchy.js --apply');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

// Analisar Brazil Top Selected
async function analyzeBrazilStructure() {
  const brazilPath = path.join(BASE_PATH, 'Brazil Top Selected Categories');
  
  try {
    const sizeFolders = await fs.readdir(brazilPath);
    console.log('\n📁 Brazil Top Selected - Estrutura Atual:');
    
    for (const sizeFolder of sizeFolders) {
      const sizePath = path.join(brazilPath, sizeFolder);
      const stat = await fs.stat(sizePath);
      
      if (stat.isDirectory()) {
        console.log(`\n  📂 ${sizeFolder}:`);
        
        try {
          const colorFolders = await fs.readdir(sizePath);
          for (const colorFolder of colorFolders) {
            const colorPath = path.join(sizePath, colorFolder);
            const colorStat = await fs.stat(colorPath);
            
            if (colorStat.isDirectory()) {
              // Contar fotos
              const photos = await fs.readdir(colorPath);
              const photoCount = photos.filter(f => f.endsWith('.webp')).length;
              
              console.log(`    🎨 ${colorFolder} (${photoCount} fotos)`);
            }
          }
        } catch (err) {
          console.log(`    ⚠️ Erro ao ler: ${err.message}`);
        }
      }
    }
  } catch (error) {
    console.log(`❌ Erro ao analisar Brazil: ${error.message}`);
  }
}

// Analisar Colombia Cowhides
async function analyzeColombiaStructure() {
  const colombiaPath = path.join(BASE_PATH, 'Colombia Cowhides');
  
  try {
    const sizeFolders = await fs.readdir(colombiaPath);
    console.log('\n📁 Colombia Cowhides - Estrutura Atual:');
    
    for (const sizeFolder of sizeFolders) {
      const sizePath = path.join(colombiaPath, sizeFolder);
      const stat = await fs.stat(sizePath);
      
      if (stat.isDirectory()) {
        console.log(`\n  📂 ${sizeFolder}:`);
        
        try {
          const colorFolders = await fs.readdir(sizePath);
          for (const colorFolder of colorFolders) {
            const colorPath = path.join(sizePath, colorFolder);
            const colorStat = await fs.stat(colorPath);
            
            if (colorStat.isDirectory()) {
              // Contar fotos
              const photos = await fs.readdir(colorPath);
              const photoCount = photos.filter(f => f.endsWith('.webp')).length;
              
              console.log(`    🎨 ${colorFolder} (${photoCount} fotos)`);
            }
          }
        } catch (err) {
          console.log(`    ⚠️ Erro ao ler: ${err.message}`);
        }
      }
    }
  } catch (error) {
    console.log(`❌ Erro ao analisar Colombia: ${error.message}`);
  }
}

// Executar
restructureHierarchy();