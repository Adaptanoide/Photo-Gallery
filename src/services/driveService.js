const { getDriveInstance } = require('../config/google.drive');

// Constantes das pastas (substituir pelos seus IDs reais)
const FOLDER_ID = process.env.DRIVE_FOLDER_ID; // ID da pasta principal
const WAITING_PAYMENT_FOLDER_ID = process.env.WAITING_PAYMENT_FOLDER_ID;
const SOLD_FOLDER_ID = process.env.SOLD_FOLDER_ID;

// NOVO: Sistema de cache em memória
const CACHE = {
  leafFolders: null,
  leafFoldersTimestamp: null,
  photosCache: {}, // Cache por ID de pasta
  photosCacheTimestamp: {}
};

// Obter fotos de uma pasta
async function getPhotos(folderId = FOLDER_ID) {
  try {
    console.log(`driveService.getPhotos - Buscando fotos na pasta ${folderId}`);
    
    // Se não houver ID de pasta, usar a pasta raiz
    if (!folderId) {
      console.log(`driveService.getPhotos - ID de pasta não fornecido, usando pasta raiz ${FOLDER_ID}`);
      folderId = FOLDER_ID;
    }
    
    const drive = await getDriveInstance();
    
    // Verificar se a pasta existe
    try {
      const folderCheck = await drive.files.get({
        fileId: folderId,
        fields: 'id, name'
      });
      console.log(`driveService.getPhotos - Pasta encontrada: ${folderCheck.data.name} (${folderCheck.data.id})`);
    } catch (err) {
      console.error(`driveService.getPhotos - ERRO: Pasta ${folderId} não encontrada!`, err.message);
    }
    
    // Query para buscar imagens na pasta específica
    const query = `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`;
    console.log(`driveService.getPhotos - Query: ${query}`);
    
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType)'
    });
    
    // Log detalhado dos resultados
    console.log(`driveService.getPhotos - Encontradas ${response.data.files.length} fotos`);
    
    if (response.data.files.length === 0) {
      // Verificar se há outros tipos de arquivo na pasta
      const allFilesQuery = `'${folderId}' in parents and trashed = false`;
      const allFilesResponse = await drive.files.list({
        q: allFilesQuery,
        fields: 'files(id, name, mimeType)'
      });
      
      console.log(`driveService.getPhotos - A pasta contém ${allFilesResponse.data.files.length} arquivos no total`);
      
      if (allFilesResponse.data.files.length > 0) {
        console.log(`driveService.getPhotos - Tipos de arquivos na pasta:`, 
          allFilesResponse.data.files.map(f => f.mimeType).filter((v, i, a) => a.indexOf(v) === i));
      }
    }
    
    // Mapear os arquivos para o formato de resposta
    const photos = response.data.files.map(file => ({
      id: file.id,
      name: file.name,
      folderId: folderId, // Adicionar o ID da pasta para uso posterior
      thumbnail: `/api/orders/thumbnail/${file.id}`, // URL para o novo endpoint de thumbnail
      embedUrl: `https://drive.google.com/file/d/${file.id}/preview`,
      viewUrl: `https://drive.google.com/file/d/${file.id}/view?usp=sharing`
    }));
    
    return photos;
  } catch (error) {
    console.error('Erro ao obter fotos:', error);
    return [];
  }
}

// Obter fotos com cache
async function getPhotosCached(folderId = FOLDER_ID) {
  try {
    console.log(`[driveService] Buscando fotos em cache para pasta ${folderId}`);
    
    // Verificar cache
    const cacheAge = CACHE.photosCacheTimestamp[folderId] ? 
        (Date.now() - CACHE.photosCacheTimestamp[folderId]) : null;
    
    // Cache válido (menos de 10 minutos)
    if (CACHE.photosCache[folderId] && cacheAge < 10 * 60 * 1000) {
      console.log(`[driveService] Servindo ${CACHE.photosCache[folderId].length} fotos do cache para pasta ${folderId}`);
      return CACHE.photosCache[folderId];
    }
    
    // Buscar fotos do Google Drive
    console.log(`[driveService] Cache miss para pasta ${folderId}, buscando do Google Drive`);
    const photos = await getPhotos(folderId);
    
    // Armazenar em cache
    CACHE.photosCache[folderId] = photos;
    CACHE.photosCacheTimestamp[folderId] = Date.now();
    
    console.log(`[driveService] Armazenadas ${photos.length} fotos em cache para pasta ${folderId}`);
    return photos;
  } catch (error) {
    console.error('[driveService] Erro ao obter fotos (cached):', error);
    return [];
  }
}

// Obter estrutura de pastas
async function getFolderStructure(isAdmin = false, useLeafFolders = true) {
  try {
    console.log(`driveService.getFolderStructure - Buscando estrutura para isAdmin=${isAdmin}, useLeafFolders=${useLeafFolders}`);
    
    // Se precisamos buscar todas as pastas folha
    if (useLeafFolders && !isAdmin) {
      console.log(`driveService.getFolderStructure - Usando getAllLeafFoldersCached para cliente`);
      
      // MODIFICADO: Usar cache para pastas folha
      const leafFoldersResult = await getAllLeafFoldersCached(FOLDER_ID);
      
      if (!leafFoldersResult.success) {
        console.error('Erro ao obter pastas folha:', leafFoldersResult.message);
        return [];
      }
      
      const leafFolders = leafFoldersResult.folders || [];
      console.log(`driveService.getFolderStructure - Encontradas ${leafFolders.length} pastas folha`);
      
      // Transformar em formato consistente com o restante do código
      const categories = leafFolders.map(folder => ({
        id: folder.id,
        name: folder.name,
        path: folder.path,
        fullPath: folder.fullPath,
        isAll: false,
        isLeaf: true
      }));
      
      // Adicionar categoria "All Items" no início
      categories.unshift({
        id: FOLDER_ID,
        name: "All Items",
        isAll: true,
        isLeaf: false
      });
      
      return categories;
    }
    
    // Código existente para admin ou quando não usamos folhas
    const drive = await getDriveInstance();
    
    const response = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      orderBy: 'name'
    });
    
    let categories = [];
    
    // Explicitly define admin-only folders - make sure spelling exactly matches folder names
    const adminOnlyFolders = ["Sold", "Waiting Payment"];
    
    // Adicionar outras categorias
    for (const folder of response.data.files) {
      // Skip admin folders for regular users
      if (!isAdmin && adminOnlyFolders.includes(folder.name)) {
        console.log(`Skipping admin folder ${folder.name} for non-admin user`);
        continue;
      }
      
      categories.push({
        id: folder.id,
        name: folder.name,
        isAll: false
      });
    }
    
    console.log(`driveService.getFolderStructure - Retornando ${categories.length} categorias de nível superior`);
    return categories;
  } catch (error) {
    console.error('Erro ao obter estrutura de pastas:', error);
    throw error;
  }
}

// Criar pasta
async function createFolder(parentFolderId, folderName) {
  try {
    const drive = await getDriveInstance();
    
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId]
    };
    
    const response = await drive.files.create({
      resource: fileMetadata,
      fields: 'id, name'
    });
    
    return {
      success: true,
      folderId: response.data.id,
      folderName: response.data.name
    };
  } catch (error) {
    console.error('Erro ao criar pasta:', error);
    return {
      success: false,
      message: `Erro ao criar pasta: ${error.message}`
    };
  }
}

// Mover arquivos para pasta
async function moveFilesToFolder(fileIds, destinationFolderId) {
  try {
    console.log(`Tentando mover ${fileIds.length} arquivos para pasta ${destinationFolderId}`);
    const drive = await getDriveInstance();
    const results = {
      success: true,
      moved: [],
      failed: []
    };
    
    for (const fileId of fileIds) {
      try {
        console.log(`Processando arquivo: ${fileId}`);
        
        // Obter arquivo
        const file = await drive.files.get({
          fileId: fileId,
          fields: 'id, name, parents'
        });
        
        console.log(`Arquivo encontrado: ${file.data.name} (${file.data.id})`);
        console.log(`Pais atuais: ${file.data.parents.join(', ')}`);
        
        // Verificar se o arquivo já não está na pasta de destino
        if (file.data.parents.includes(destinationFolderId)) {
          console.log(`O arquivo já está na pasta de destino: ${file.data.name}`);
          results.moved.push({
            id: fileId,
            name: file.data.name
          });
          continue;
        }
        
        // PARTE ALTERADA: Mover em uma única operação
        try {
          // Mover o arquivo em uma única operação, removendo os pais antigos e adicionando o novo pai
          await drive.files.update({
            fileId: fileId,
            removeParents: file.data.parents.join(','),
            addParents: destinationFolderId,
            fields: 'id, name, parents'
          });
          
          console.log(`Arquivo ${file.data.name} movido para pasta ${destinationFolderId}`);
          
          // Verificar se o arquivo agora está na pasta de destino
          const updatedFile = await drive.files.get({
            fileId: fileId,
            fields: 'parents'
          });
          
          if (updatedFile.data.parents.includes(destinationFolderId)) {
            console.log(`Confirmado: Arquivo ${file.data.name} agora está na pasta ${destinationFolderId}`);
            results.moved.push({
              id: fileId,
              name: file.data.name
            });
          } else {
            console.error(`Erro: Arquivo ${file.data.name} não foi movido para a pasta ${destinationFolderId}`);
            results.failed.push({
              id: fileId,
              error: 'Arquivo não foi movido para destino'
            });
            results.success = false;
          }
        } catch (updateError) {
          console.error(`Erro ao mover arquivo ${file.data.name}: ${updateError}`);
          throw updateError;
        }
      } catch (e) {
        console.error(`Falha ao processar arquivo ${fileId}: ${e.toString()}`);
        results.failed.push({
          id: fileId,
          error: e.toString()
        });
        results.success = false;
      }
    }
    
    return results;
  } catch (error) {
    console.error('Erro ao mover arquivos:', error);
    return {
      success: false,
      message: `Erro ao mover arquivos: ${error.message}`
    };
  }
}

async function processOrderFiles(name, photoIds, status) {
  try {
    console.log(`processOrderFiles: Iniciando processamento para ${name}, ${photoIds.length} fotos, status ${status}`);
    
    // Definir pasta destino com base no status
    const targetFolderId = (status === 'paid') ? SOLD_FOLDER_ID : WAITING_PAYMENT_FOLDER_ID;
    console.log(`Pasta destino baseada no status: ${targetFolderId}`);
    
    // Criar nome da pasta com formato: "Nome QTDun Mês Dia Ano"
    const today = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const folderName = `${name} ${photoIds.length}un ${months[today.getMonth()]} ${today.getDate()} ${today.getFullYear()}`;
    console.log(`Nome da pasta do cliente: ${folderName}`);
    
    // Criar pasta do cliente dentro da pasta destino
    console.log(`Criando pasta em ${targetFolderId}...`);
    const customerFolder = await createFolder(targetFolderId, folderName);
    
    if (!customerFolder.success) {
      console.error(`Falha ao criar pasta do cliente: ${JSON.stringify(customerFolder)}`);
      return customerFolder; // Retornar erro se falhou
    }
    
    console.log(`Pasta do cliente criada com sucesso: ${customerFolder.folderId}`);
    
    // Mover arquivos selecionados para a pasta do cliente
    console.log(`Movendo ${photoIds.length} fotos para pasta ${customerFolder.folderId}...`);
    const moveResult = await moveFilesToFolder(photoIds, customerFolder.folderId);
    console.log(`Resultado do movimento: ${JSON.stringify(moveResult)}`);
    
    // Verificar se as fotos foram movidas corretamente
    if (moveResult.moved.length !== photoIds.length) {
      console.warn(`Atenção: Apenas ${moveResult.moved.length} de ${photoIds.length} fotos foram movidas com sucesso.`);
    }
    
    // Invalidar cache relacionado às fotos movidas
    invalidatePhotoCache();
    
    return {
      success: true,
      folderName: folderName,
      folderId: customerFolder.folderId,
      moveResults: moveResult
    };
  } catch (error) {
    console.error('Erro ao processar arquivos do pedido:', error);
    return {
      success: false,
      message: `Erro ao processar arquivos do pedido: ${error.message}`
    };
  }
}

// FUNÇÃO MODIFICADA: Invalidar caches após movimentação de arquivos
function invalidatePhotoCache() {
  CACHE.photosCache = {};
  CACHE.photosCacheTimestamp = {};
  
  // ADICIONAR: Invalidação do cache de pastas folha também
  CACHE.leafFolders = null;
  CACHE.leafFoldersTimestamp = null;
  
  console.log('Complete cache invalidation due to file operations');
}

// Atualizar status do pedido
async function updateOrderStatus(status, folderId) {
  try {
    const drive = await getDriveInstance();
    
    // Definir pasta destino com base no status
    const targetFolderId = (status === 'paid') ? SOLD_FOLDER_ID : WAITING_PAYMENT_FOLDER_ID;
    
    console.log(`Moving folder ${folderId} to ${targetFolderId}`);
    
    // Get folder information first
    const folder = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, parents'
    });
    
    const folderName = folder.data.name || 'Unknown';
    console.log(`Found folder: ${folderName}`);
    
    // Get all files in the folder to return their IDs
    const filesResponse = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name)'
    });
    
    const fileIds = filesResponse.data.files.map(file => file.id) || [];
    console.log(`Found ${fileIds.length} files in folder`);
    
    // With proper permissions, we can just update the parent
    // This is the simple, fast approach we wanted originally
    if (folder.data.parents && folder.data.parents.length > 0) {
      console.log(`Moving folder from parent ${folder.data.parents[0]} to ${targetFolderId}`);
      
      await drive.files.update({
        fileId: folderId,
        removeParents: folder.data.parents.join(','),
        addParents: targetFolderId,
        fields: 'id, name, parents'
      });
      
      console.log(`Successfully moved folder to ${status === 'paid' ? 'SOLD' : 'WAITING PAYMENT'}`);
    } else {
      return {
        success: false,
        message: 'Não foi possível determinar a pasta pai atual'
      };
    }
    
    // Invalidar cache após alterações
    invalidatePhotoCache();
    
    return {
      success: true,
      message: `Pedido marcado como ${status === 'paid' ? 'vendido' : 'pendente'} com sucesso`,
      folderName: folderName,
      fileIds: fileIds
    };
  } catch (error) {
    console.error('Erro ao atualizar status do pedido:', error);
    return {
      success: false,
      message: `Erro ao atualizar status do pedido: ${error.message}`
    };
  }
}

// Listar pastas de pedidos
async function listOrderFolders(status) {
  try {
    const drive = await getDriveInstance();
    
    // Definir pasta alvo com base no status
    const targetFolderId = (status === 'paid' || status === 'sold') 
      ? SOLD_FOLDER_ID 
      : WAITING_PAYMENT_FOLDER_ID;
    
    // Obter todas as subpastas
    const response = await drive.files.list({
      q: `'${targetFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name, createdTime)'
    });
    
    const folderList = response.data.files.map(folder => ({
      id: folder.id,
      name: folder.name,
      dateCreated: new Date(folder.createdTime).getTime()
    }));
    
    // Ordenar por data (mais recentes primeiro)
    folderList.sort((a, b) => b.dateCreated - a.dateCreated);
    
    return {
      success: true,
      folders: folderList,
      message: `${folderList.length} pastas encontradas`
    };
  } catch (error) {
    console.error('Erro ao listar pastas de pedidos:', error);
    return {
      success: false,
      folders: [],
      message: `Erro crítico ao listar pastas: ${error.message}`
    };
  }
}

// Obter ID da pasta raiz (Sunshine Cowhides Actual Pictures)
async function getRootFolderId() {
  try {
    // MODIFICAÇÃO: Usar diretamente o ID da pasta definido nas variáveis de ambiente
    const rootFolderId = process.env.DRIVE_FOLDER_ID;
    
    if (!rootFolderId) {
      return {
        success: false,
        message: 'DRIVE_FOLDER_ID não encontrado nas variáveis de ambiente'
      };
    }
    
    // Verificar se a pasta existe
    const drive = await getDriveInstance();
    try {
      const folder = await drive.files.get({
        fileId: rootFolderId,
        fields: 'id, name'
      });
      
      return {
        success: true,
        folderId: rootFolderId,
        folderName: folder.data.name
      };
    } catch (error) {
      console.error('Erro ao verificar pasta raiz:', error);
      return {
        success: false,
        message: `Pasta raiz com ID ${rootFolderId} não encontrada ou sem permissão: ${error.message}`
      };
    }
  } catch (error) {
    console.error('Error getting root folder ID:', error);
    return {
      success: false,
      message: `Error getting root folder ID: ${error.message}`
    };
  }
}

// Obter conteúdo de uma pasta
async function getFolderContents(folderId) {
  try {
    const drive = await getDriveInstance();
    
    // Buscar apenas subpastas (não arquivos)
    const foldersQuery = `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    
    const foldersResponse = await drive.files.list({
      q: foldersQuery,
      fields: 'files(id, name)',
      orderBy: 'name'
    });
    
    // Preparar resultado com pastas e contagem de arquivos
    const folders = [];
    
    // Processar cada pasta para obter a contagem de arquivos
    for (const folder of foldersResponse.data.files) {
      // Verificar quantos arquivos (não pastas) estão nesta pasta
      const filesQuery = `'${folder.id}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
      const filesResponse = await drive.files.list({
        q: filesQuery,
        fields: 'files(id)'
      });
      
      folders.push({
        id: folder.id,
        name: folder.name,
        fileCount: filesResponse.data.files.length
      });
    }
    
    return {
      success: true,
      folders: folders
    };
  } catch (error) {
    console.error('Error getting folder contents:', error);
    return {
      success: false,
      message: `Error getting folder contents: ${error.message}`
    };
  }
}

// Renomear pasta
async function renameFolder(folderId, newName) {
  try {
    const drive = await getDriveInstance();
    
    const response = await drive.files.update({
      fileId: folderId,
      resource: {
        name: newName
      },
      fields: 'id, name'
    });
    
    // Invalidar cache após alterações na estrutura
    CACHE.leafFolders = null;
    
    return {
      success: true,
      folder: {
        id: response.data.id,
        name: response.data.name
      }
    };
  } catch (error) {
    console.error('Error renaming folder:', error);
    return {
      success: false,
      message: `Error renaming folder: ${error.message}`
    };
  }
}

// Excluir pasta
async function deleteFolder(folderId) {
  try {
    const drive = await getDriveInstance();
    
    // Excluir pasta (move para lixeira)
    await drive.files.delete({
      fileId: folderId
    });
    
    // Invalidar cache após alterações na estrutura
    CACHE.leafFolders = null;
    
    return {
      success: true,
      message: 'Folder deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting folder:', error);
    return {
      success: false,
      message: `Error deleting folder: ${error.message}`
    };
  }
}

// Obter informações de uma pasta
async function getFolderInfo(folderId) {
  try {
    const drive = await getDriveInstance();
    
    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, parents'
    });
    
    return {
      success: true,
      id: response.data.id,
      name: response.data.name,
      parents: response.data.parents
    };
  } catch (error) {
    console.error('Error getting folder info:', error);
    return {
      success: false,
      message: `Error getting folder info: ${error.message}`
    };
  }
}


// Verificar se uma pasta contém arquivos (mas não subpastas)
async function checkFolderHasFiles(folderId) {
  try {
    const drive = await getDriveInstance();
    
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id)',
      pageSize: 1 // Só precisamos saber se existe pelo menos um arquivo
    });
    
    return response.data.files.length > 0;
  } catch (error) {
    console.error('Error checking if folder has files:', error);
    throw error;
  }
}


// Obter todas as pastas folha com otimização
async function getAllLeafFoldersOptimized(rootFolderId, includeEmptyFolders = false) {
  try {
    const drive = await getDriveInstance();
    
    // MODIFICAÇÃO: Verificar se o rootFolderId está definido
    if (!rootFolderId) {
      console.log('ID da pasta raiz não fornecido para getAllLeafFoldersOptimized, usando variável de ambiente');
      rootFolderId = process.env.DRIVE_FOLDER_ID; // Usar valor da variável de ambiente como fallback
      
      if (!rootFolderId) {
        console.error('DRIVE_FOLDER_ID não está definido nas variáveis de ambiente');
        return {
          success: false,
          message: 'ID da pasta raiz não encontrado'
        };
      }
    }
    
    console.log(`Buscando pastas folha a partir da pasta raiz: ${rootFolderId}`);
    let leafFolders = [];
    
    // 1. Buscar todas as pastas em uma única consulta (sem filtrar por uma pasta raiz específica)
    // Desta forma, obtemos todas as pastas e filtramos posteriormente
    try {
      const response = await drive.files.list({
        q: `mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name, parents)',
        pageSize: 1000
      });
      
      const allFolders = response.data.files || [];
      console.log(`Found ${allFolders.length} total folders`);
      
      // 2. Construir uma árvore de pastas em memória
      const folderMap = {};
      const childrenMap = {};
      
      // Inicializar os mapas
      allFolders.forEach(folder => {
        folderMap[folder.id] = folder;
        childrenMap[folder.id] = [];
      });
      
      // Preencher o mapa de filhos
      allFolders.forEach(folder => {
        if (folder.parents && folder.parents.length > 0) {
          const parentId = folder.parents[0];
          if (childrenMap[parentId]) {
            childrenMap[parentId].push(folder.id);
          }
        }
      });
      
      // 3. Identificar pastas "folha" (não têm subpastas)
      const potentialLeafFolders = allFolders.filter(folder => {
        // Uma pasta é "folha" se não tem filhos no mapa de filhos
        return !childrenMap[folder.id] || childrenMap[folder.id].length === 0;
      });
      
      console.log(`Found ${potentialLeafFolders.length} potential leaf folders`);
      
      // Lista explícita de pastas administrativas (nomes exatos)
      // MODIFICAÇÃO: Obter nomes das variáveis de ambiente se disponíveis
      const adminFolderNames = ['Waiting Payment', 'Sold', 'Developing'];
      
      // Adicionar outros nomes administrativos se necessário (baseado em outras variáveis de ambiente)
      if (process.env.ADMIN_FOLDER_NAMES) {
        try {
          const extraNames = process.env.ADMIN_FOLDER_NAMES.split(',').map(n => n.trim());
          adminFolderNames.push(...extraNames);
        } catch (e) {
          console.error('Erro ao processar ADMIN_FOLDER_NAMES:', e.message);
        }
      }
      
      // 4. FILTRO MELHORADO: Remover pastas específicas
      const filteredLeafFolders = [];
      
      for (const folder of potentialLeafFolders) {
        // Pular pastas com nome administrativo diretamente
        if (adminFolderNames.includes(folder.name)) {
          continue;
        }
        
        // Pular pastas com padrão de nome de pedido
        const orderPattern = /\d+un\s+\w+\s+\d+\s+\d+/i;
        if (orderPattern.test(folder.name)) {
          continue;
        }
        
        // Verificar se esta pasta está dentro de uma pasta administrativa
        let isInAdminFolder = false;
        let currentFolder = folder;
        let iterations = 0;
        const maxIterations = 10; // Proteção contra loops infinitos
        
        while (currentFolder && iterations < maxIterations) {
          if (!currentFolder.parents || currentFolder.parents.length === 0) {
            break;
          }
          
          const parentId = currentFolder.parents[0];
          const parentFolder = folderMap[parentId];
          
          if (!parentFolder) {
            break;
          }
          
          // Verificar se o pai é uma pasta administrativa
          if (adminFolderNames.includes(parentFolder.name)) {
            isInAdminFolder = true;
            break;
          }
          
          // Ir para o próximo pai
          currentFolder = parentFolder;
          iterations++;
        }
        
        // Pular esta pasta se estiver dentro de uma pasta administrativa
        if (isInAdminFolder) {
          continue;
        }
        
        // MODIFICAÇÃO: Verificar se está na árvore da pasta raiz especificada (opcional)
        // Isso pode ser desativado se quisermos mostrar todas as pastas folha do Drive
        let isInRootTree = false;
        currentFolder = folder;
        iterations = 0;
        
        // MODIFICAÇÃO: Tornar esta verificação opcional
        if (rootFolderId !== 'all') {  // Permitir um valor especial 'all' para mostrar tudo
          while (currentFolder && iterations < maxIterations) {
            if (!currentFolder.parents || currentFolder.parents.length === 0) {
              break;
            }
            
            if (currentFolder.id === rootFolderId) {
              isInRootTree = true;
              break;
            }
            
            const parentId = currentFolder.parents[0];
            if (parentId === rootFolderId) {
              isInRootTree = true;
              break;
            }
            
            currentFolder = folderMap[parentId];
            if (!currentFolder) break;
            
            iterations++;
          }
          
          // Pular se não estiver na árvore da pasta raiz (opcional)
          // MODIFICAÇÃO: Esta verificação agora é OPCIONAL - descomente se quiser usá-la
          if (!isInRootTree) continue;
        }
        
        // Adicionar a pasta à lista filtrada (passou em todas as verificações)
        filteredLeafFolders.push(folder);
      }
      
      console.log(`After filtering, ${filteredLeafFolders.length} leaf folders remain`);
      
      // 5. Verificar quais pastas folha têm arquivos (em lotes)
      const BATCH_SIZE = 10;
      const batches = [];
      
      for (let i = 0; i < filteredLeafFolders.length; i += BATCH_SIZE) {
        batches.push(filteredLeafFolders.slice(i, i + BATCH_SIZE));
      }
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchPromises = batch.map(async (folder) => {
          try {
            // Verificar e contar imagens na pasta
            const fileResponse = await drive.files.list({
              q: `'${folder.id}' in parents and mimeType contains 'image/' and trashed = false`,
              fields: 'files(id)'
            });
            
            // Contar imagens
            const fileCount = fileResponse.data.files.length;
            
            // MODIFICAÇÃO: Incluir pastas vazias se solicitado OU sempre incluir em modo admin
            if (includeEmptyFolders || fileCount > 0) {
              try {
                // Construir o caminho completo da pasta
                const path = await buildFolderPath(folder.id, folderMap);
                
                leafFolders.push({
                  id: folder.id,
                  name: folder.name,
                  path: path,
                  fullPath: path.join(' → '),
                  fileCount: fileCount
                });
              } catch (pathError) {
                console.error(`Error building path for folder ${folder.id}:`, pathError);
                // Mesmo com erro no caminho, incluir com informações básicas
                leafFolders.push({
                  id: folder.id,
                  name: folder.name,
                  path: [folder.name],
                  fullPath: folder.name,
                  fileCount: fileCount
                });
              }
            }
          } catch (error) {
            console.error(`Error processing folder ${folder.id}:`, error);
            // MODIFICAÇÃO: Adicionar a pasta mesmo com erro, para mostrar no painel
            if (includeEmptyFolders) {
              leafFolders.push({
                id: folder.id,
                name: folder.name,
                path: [folder.name],
                fullPath: folder.name,
                fileCount: 0,
                error: error.message
              });
            }
          }
        });
        
        // MODIFICAÇÃO: Tratar erros nas promessas em lote
        try {
          await Promise.all(batchPromises);
        } catch (batchError) {
          console.error(`Error processing batch ${i+1}:`, batchError);
        }
        
        console.log(`Processed batch ${i+1}/${batches.length}, found ${leafFolders.length} leaf folders so far`);
      }
      
    } catch (listError) {
      console.error('Error listing folders:', listError);
      // MODIFICAÇÃO: Continuar com pastas vazias no caso de erro parcial
      return {
        success: true, // Retorna sucesso parcial
        folders: leafFolders,
        message: `Carregamento parcial: ${listError.message}`
      };
    }
    
    // Se chegamos aqui, conseguimos pelo menos algumas pastas
    return {
      success: true,
      folders: leafFolders
    };
    
  } catch (error) {
    console.error('Error in getAllLeafFoldersOptimized:', error);
    return {
      success: false,
      message: `Error getting leaf folders: ${error.message}`,
      folders: [] // Retorna array vazio em vez de undefined
    };
  }
}

// NOVA FUNÇÃO: Obter pastas folha com cache
async function getAllLeafFoldersCached(rootFolderId, includeEmptyFolders = false) {
  // Criar chave de cache única para cada combinação de parâmetros
  const cacheKey = includeEmptyFolders ? 'leaf_folders_all' : 'leaf_folders';
  
  // Verificar cache em memória
  const cacheAge = CACHE[cacheKey + '_timestamp'] ? (Date.now() - CACHE[cacheKey + '_timestamp']) : null;
  
  // Se temos cache válido (menos de 30 minutos), use-o
  if (CACHE[cacheKey] && cacheAge < 30 * 60 * 1000) {
    console.log(`Serving leaf folders from memory cache (includeEmptyFolders=${includeEmptyFolders})`);
    return CACHE[cacheKey];
  }
  
  // Cache expirado ou não existe, buscar novas pastas
  console.log(`Cache miss for leaf folders, fetching from Google Drive (includeEmptyFolders=${includeEmptyFolders})`);
  const result = await getAllLeafFoldersOptimized(rootFolderId, includeEmptyFolders);
  
  // Armazenar em cache se for bem-sucedido
  if (result.success) {
    CACHE[cacheKey] = result;
    CACHE[cacheKey + '_timestamp'] = Date.now();
  }
  
  return result;
}

// Função auxiliar para construir o caminho completo de uma pasta
async function buildFolderPath(folderId, folderMap) {
  const path = [];
  let currentId = folderId;
  
  // Limitar a profundidade para evitar loops infinitos
  const MAX_DEPTH = 10;
  let depth = 0;
  
  while (currentId && depth < MAX_DEPTH) {
    const folder = folderMap[currentId];
    if (!folder) break;
    
    path.unshift(folder.name);
    
    if (!folder.parents || folder.parents.length === 0) break;
    currentId = folder.parents[0];
    depth++;
  }
  
  return path;
}

// NOVA FUNÇÃO: Limpar caches
function clearAllCaches() {
  CACHE.leafFolders = null;
  CACHE.leafFoldersTimestamp = null;
  CACHE.photosCache = {};
  CACHE.photosCacheTimestamp = {};
  console.log('All caches cleared');
}

// Nova função para processar pedidos com separação por categorias
async function processOrderFilesWithCategories(customerName, photosByCategory, status) {
  try {
    console.log(`processOrderFilesWithCategories: Iniciando processamento para ${customerName}, status ${status}`);
    
    // Definir pasta destino com base no status
    const targetFolderId = (status === 'paid') ? SOLD_FOLDER_ID : WAITING_PAYMENT_FOLDER_ID;
    console.log(`Pasta destino baseada no status: ${targetFolderId}`);
    
    // Calcular quantidade total de fotos para o nome da pasta
    let totalPhotos = 0;
    Object.values(photosByCategory).forEach(photos => {
      totalPhotos += photos.length;
    });
    
    // Criar nome da pasta com formato: "Nome QTDun Mês Dia Ano"
    const today = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const folderName = `${customerName} ${totalPhotos}un ${months[today.getMonth()]} ${today.getDate()} ${today.getFullYear()}`;
    console.log(`Nome da pasta do cliente: ${folderName}`);
    
    // Criar pasta principal do cliente dentro da pasta destino
    console.log(`Criando pasta principal em ${targetFolderId}...`);
    const customerFolder = await createFolder(targetFolderId, folderName);
    
    if (!customerFolder.success) {
      console.error(`Falha ao criar pasta principal do cliente: ${JSON.stringify(customerFolder)}`);
      return customerFolder; // Retornar erro se falhou
    }
    
    const customerFolderId = customerFolder.folderId;
    console.log(`Pasta principal do cliente criada com sucesso: ${customerFolderId}`);
    
    // Array para armazenar todos os IDs de arquivos processados
    const allProcessedFileIds = [];
    
    // Para cada categoria, criar uma subpasta e mover as fotos
    for (const categoryName in photosByCategory) {
      const photos = photosByCategory[categoryName];
      
      if (!photos || photos.length === 0) {
        console.log(`Categoria ${categoryName} está vazia, pulando`);
        continue;
      }
      
      // Criar subpasta para a categoria dentro da pasta principal
      console.log(`Criando subpasta para categoria "${categoryName}"...`);
      const categoryFolder = await createFolder(customerFolderId, categoryName);
      
      if (!categoryFolder.success) {
        console.error(`Falha ao criar subpasta para categoria ${categoryName}: ${JSON.stringify(categoryFolder)}`);
        continue; // Continuar com outras categorias mesmo se esta falhar
      }
      
      const categoryFolderId = categoryFolder.folderId;
      console.log(`Subpasta para categoria "${categoryName}" criada com ID: ${categoryFolderId}`);
      
      // Extrair IDs das fotos desta categoria
      const categoryPhotoIds = photos.map(photo => photo.id);
      console.log(`Movendo ${categoryPhotoIds.length} fotos para subpasta ${categoryName}...`);
      
      // Mover arquivos para a subpasta da categoria
      const moveResult = await moveFilesToFolder(categoryPhotoIds, categoryFolderId);
      
      if (moveResult.success) {
        console.log(`Fotos movidas com sucesso para subpasta ${categoryName}`);
        // Adicionar IDs processados ao array global
        allProcessedFileIds.push(...categoryPhotoIds);
      } else {
        console.error(`Erro ao mover fotos para subpasta ${categoryName}: ${JSON.stringify(moveResult)}`);
      }
    }
    
    // Invalidar cache relacionado às fotos movidas
    invalidatePhotoCache();
    
    return {
      success: true,
      folderName: folderName,
      folderId: customerFolderId,
      fileIds: allProcessedFileIds
    };
  } catch (error) {
    console.error('Erro ao processar arquivos do pedido com categorias:', error);
    return {
      success: false,
      message: `Erro ao processar arquivos do pedido: ${error.message}`
    };
  }
}

// Sistema de pre-warming de cache
async function prewarmCache() {
  if (process.env.CACHE_PRELOAD_ON_START !== 'true') return;
  
  console.log('🔥 Starting cache pre-warming...');
  
  try {
    // 1. Obter categorias mais populares baseado nas estatísticas do cache
    const SmartCache = require('./smartCache');
    const cache = new SmartCache(50);
    const status = cache.getStatus();
    const popularCategories = status.topCategories || [];
    
    // 2. Se não houver estatísticas, usar primeiras 3 categorias
    if (popularCategories.length === 0) {
      const allCategories = await getAllLeafFoldersCached(FOLDER_ID);
      if (allCategories.success) {
        popularCategories.push(...allCategories.folders.slice(0, 3));
      }
    }
    
    // 3. Para cada categoria popular, carregar thumbnails
    for (const category of popularCategories) {
      console.log(`Pre-warming category: ${category.name || category.id}`);
      
      const photos = await getPhotosCached(category.id);
      
      // 4. Simular requests para gerar thumbnails (primeiras 10 fotos)
      for (const photo of photos.slice(0, 10)) {
        try {
          // Fazer request interno para gerar thumbnail
          const axios = require('axios');
          const baseUrl = process.env.NODE_ENV === 'production' 
            ? 'https://seu-app.onrender.com' 
            : 'http://localhost:3000';
          
          await axios.get(`${baseUrl}/api/orders/thumbnail/${photo.id}`, {
            timeout: 5000,
            validateStatus: () => true // Aceitar qualquer status
          });
          
          console.log(`✅ Pre-warmed thumbnail: ${photo.id}`);
        } catch (err) {
          console.error(`Failed to pre-warm ${photo.id}:`, err.message);
        }
        
        // Aguardar um pouco entre requests para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('✅ Cache pre-warming completed');
  } catch (error) {
    console.error('Error during cache pre-warming:', error);
  }
}

// Função para obter categorias populares
async function getPopularCategories() {
  try {
    const SmartCache = require('./smartCache');
    const cache = new SmartCache(50);
    const status = cache.getStatus();
    
    if (status.topCategories && status.topCategories.length > 0) {
      // Buscar informações completas das categorias
      const categories = [];
      for (const cat of status.topCategories) {
        const info = await getFolderInfo(cat.id);
        if (info.success) {
          categories.push({
            id: cat.id,
            name: info.name,
            accessCount: cat.accessCount
          });
        }
      }
      return categories;
    }
    
    // Fallback: retornar primeiras categorias
    const allCategories = await getAllLeafFoldersCached(FOLDER_ID);
    return allCategories.success ? allCategories.folders.slice(0, 5) : [];
  } catch (error) {
    console.error('Error getting popular categories:', error);
    return [];
  }
}

// Chamar pre-warming após 10 segundos do startup
if (process.env.NODE_ENV === 'production' && process.env.CACHE_PRELOAD_ON_START === 'true') {
  setTimeout(prewarmCache, 10000);
}

module.exports = {
  getPhotos,
  getPhotosCached,
  getFolderStructure,
  moveFilesToFolder,
  processOrderFiles,
  updateOrderStatus,
  getRootFolderId,
  getFolderContents,
  createFolder,
  renameFolder,
  deleteFolder,
  getFolderInfo,
  checkFolderHasFiles,
  getAllLeafFoldersOptimized,
  getAllLeafFoldersCached,
  listOrderFolders,
  clearAllCaches,
  processOrderFilesWithCategories,
  prewarmCache,
  getPopularCategories
};