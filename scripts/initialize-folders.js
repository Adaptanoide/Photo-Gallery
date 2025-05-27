// scripts/initialize-folders.js
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function initializeFolders() {
  console.log('🚀 Inicializando estrutura de pastas...');
  
  const baseDir = process.env.CACHE_STORAGE_PATH || '/opt/render/project/storage/cache';
  
  const folders = [
    path.join(baseDir, 'webp/hd'),
    path.join(baseDir, 'thumbnails/small'),
    path.join(baseDir, 'thumbnails/medium'),
    path.join(baseDir, 'thumbnails/large'),
    path.join(baseDir, 'persistent'),
    path.join(baseDir, 'temp'),
    path.join(baseDir, 'metadata'),
    path.join(baseDir, 'fotos/imagens-webp'),
    path.join(baseDir, 'fotos/imagens-webp/Waiting Payment'),
    path.join(baseDir, 'fotos/imagens-webp/Sold'),
  ];
  
  for (const folder of folders) {
    try {
      await fs.mkdir(folder, { recursive: true });
      console.log(`✓ Pasta criada: ${folder}`);
    } catch (error) {
      console.error(`✗ Erro ao criar pasta ${folder}:`, error.message);
    }
  }
  
  console.log('✅ Estrutura de pastas inicializada com sucesso!');
}

initializeFolders().catch(console.error);