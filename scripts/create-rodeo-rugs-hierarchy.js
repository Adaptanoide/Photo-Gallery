// Script para criar estrutura hierárquica do Rodeo Rugs & Round Rugs
const fs = require('fs').promises;
const path = require('path');

const BASE_PATH = '/opt/render/project/storage/cache/fotos/imagens-webp/Rodeo Rugs & Round Rugs';

// Estrutura hierárquica organizada por País-Tipo-Especificação
const HIERARCHY = {
  'Brazil-Round-Rug': ['Multi-Star-80', 'Single-Star-40', 'Single-Star-60'],
  'Colombia-Rodeo-Rug-3x5': ['Longhorns', 'Star'],
  'Colombia-Round-Rug': ['Multi-Star-60', 'Single-Star-40']
};

async function createRodeoRugsHierarchy() {
  console.log('🏗️ Criando estrutura hierárquica Rodeo Rugs & Round Rugs...');
  console.log('📋 Padrão: Categoria → País-Tipo → Especificação (3 níveis)');
  
  for (const [groupName, specifications] of Object.entries(HIERARCHY)) {
    console.log(`📁 Criando grupo: ${groupName}`);
    
    // Criar pasta do grupo
    const groupPath = path.join(BASE_PATH, groupName);
    await fs.mkdir(groupPath, { recursive: true });
    
    // Criar subpastas de especificação
    for (const specification of specifications) {
      await fs.mkdir(path.join(groupPath, specification), { recursive: true });
    }
    
    console.log(`  ✅ ${groupName}: ${specifications.join(', ')}`);
  }
  
  console.log('\n🎉 Estrutura Rodeo Rugs & Round Rugs criada!');
  console.log('📋 Próximo: executar move-rodeo-rugs-photos.js');
}

createRodeoRugsHierarchy().catch(console.error);