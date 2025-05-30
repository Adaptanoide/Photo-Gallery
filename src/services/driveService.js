// driveService.js - Recriado baseado no uso no photoController.js
const { google } = require('googleapis');

// Cache em memória
let foldersCache = null;
let photosCache = new Map();
let cacheExpiry = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos

// Inicializar Google Drive API
let drive = null;

try {
  // Configurar autenticação do Google Drive
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });
  
  drive = google.drive({ version: 'v3', auth });
  console.log('✅ Google Drive API inicializada com sucesso');
} catch (error) {
  console.error('⚠️ Erro ao inicializar Google Drive API:', error);
  console.log('📝 Sistema continuará usando apenas localStorage');
}

// Verificar se o cache está válido
function isCacheValid() {
  return cacheExpiry && Date.now() < cacheExpiry;
}

// Limpar todos os caches
function clearAllCaches() {
  console.log('🧹 Limpando todos os caches do driveService');
  foldersCache = null;
  photosCache.clear();
  cacheExpiry = null;
}

// Obter estrutura de pastas
async function getFolderStructure(isAdmin = false, useLeafFolders = false) {
  try {
    console.log(`📂 getFolderStructure - isAdmin: ${isAdmin}, useLeafFolders: ${useLeafFolders}`);
    
    // Se não tiver drive configurado, retornar array vazio
    if (!drive) {
      console.log('⚠️ Google Drive não configurado, retornando estrutura vazia');
      return [];
    }
    
    // Verificar cache
    if (isCacheValid() && foldersCache) {
      console.log('📦 Retornando estrutura de pastas do cache');
      return foldersCache;
    }
    
    // Buscar pastas do Google Drive
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id, name, parents)',
      pageSize: 1000
    });
    
    const folders = response.data.files || [];
    console.log(`📁 Encontradas ${folders.length} pastas no Google Drive`);
    
    // Processar estrutura hierárquica
    const structuredFolders = buildFolderHierarchy(folders, isAdmin, useLeafFolders);
    
    // Atualizar cache
    foldersCache = structuredFolders;
    cacheExpiry = Date.now() + CACHE_DURATION;
    
    return structuredFolders;
    
  } catch (error) {
    console.error('❌ Erro ao obter estrutura de pastas do Google Drive:', error);
    // Retornar cache antigo se disponível, senão array vazio
    return foldersCache || [];
  }
}

// Construir hierarquia de pastas
function buildFolderHierarchy(folders, isAdmin, useLeafFolders) {
  const folderMap = new Map();
  
  // Mapear todas as pastas
  folders.forEach(folder => {
    folderMap.set(folder.id, {
      id: folder.id,
      name: folder.name,
      parents: folder.parents || [],
      children: [],
      fileCount: 0, // Será preenchido posteriormente
      isAll: false,
      isLeaf: true
    });
  });
  
  // Construir hierarquia
  const rootFolders = [];
  
  folderMap.forEach(folder => {
    if (folder.parents.length === 0) {
      rootFolders.push(folder);
    } else {
      folder.parents.forEach(parentId => {
        const parent = folderMap.get(parentId);
        if (parent) {
          parent.children.push(folder);
          parent.isLeaf = false;
        }
      });
    }
  });
  
  // Se useLeafFolders, retornar apenas pastas folha
  if (useLeafFolders) {
    const leafFolders = [];
    folderMap.forEach(folder => {
      if (folder.isLeaf) {
        leafFolders.push(folder);
      }
    });
    return leafFolders;
  }
  
  // Adicionar "All Items" para admin
  if (isAdmin) {
    rootFolders.unshift({
      id: 'all-items',
      name: 'All Items',
      parents: [],
      children: [],
      fileCount: 0,
      isAll: true,
      isLeaf: false
    });
  }
  
  return rootFolders;
}

// Obter fotos com cache
async function getPhotosCached(categoryId) {
  try {
    console.log(`🖼️ getPhotosCached para categoria: ${categoryId}`);
    
    // Se não tiver drive, retornar array vazio
    if (!drive) {
      console.log('⚠️ Google Drive não configurado, retornando fotos vazias');
      return [];
    }
    
    // Verificar cache
    if (photosCache.has(categoryId) && isCacheValid()) {
      console.log('📦 Retornando fotos do cache');
      return photosCache.get(categoryId);
    }
    
    // Buscar fotos da pasta específica
    let query = `'${categoryId}' in parents and trashed=false and mimeType contains 'image/'`;
    
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, size, createdTime, webViewLink, thumbnailLink)',
      pageSize: 1000,
      orderBy: 'name'
    });
    
    const files = response.data.files || [];
    console.log(`📸 Encontradas ${files.length} fotos na categoria ${categoryId}`);
    
    // Processar fotos
    const photos = files.map(file => ({
      id: file.id,
      filename: file.name,
      folderId: categoryId,
      size: file.size,
      createdTime: file.createdTime,
      thumbnail: file.thumbnailLink,
      webViewLink: file.webViewLink,
      source: 'drive'
    }));
    
    // Adicionar ao cache
    photosCache.set(categoryId, photos);
    
    return photos;
    
  } catch (error) {
    console.error(`❌ Erro ao obter fotos da categoria ${categoryId}:`, error);
    // Retornar cache antigo se disponível, senão array vazio
    return photosCache.get(categoryId) || [];
  }
}

// Obter todas as pastas folha com cache
async function getAllLeafFoldersCached() {
  try {
    console.log('🍃 getAllLeafFoldersCached');
    
    // Obter estrutura completa
    const folders = await getFolderStructure(false, true);
    
    return {
      success: true,
      folders: folders
    };
    
  } catch (error) {
    console.error('❌ Erro ao obter pastas folha:', error);
    return {
      success: false,
      folders: [],
      error: error.message
    };
  }
}

// Obter foto por ID
async function getPhotoById(photoId) {
  try {
    console.log(`🔍 getPhotoById: ${photoId}`);
    
    // Se não tiver drive, retornar null
    if (!drive) {
      console.log('⚠️ Google Drive não configurado');
      return null;
    }
    
    const response = await drive.files.get({
      fileId: photoId,
      fields: 'id, name, size, createdTime, webViewLink, thumbnailLink, parents'
    });
    
    const file = response.data;
    
    return {
      id: file.id,
      filename: file.name,
      folderId: file.parents ? file.parents[0] : null,
      size: file.size,
      createdTime: file.createdTime,
      thumbnail: file.thumbnailLink,
      webViewLink: file.webViewLink,
      source: 'drive'
    };
    
  } catch (error) {
    console.error(`❌ Erro ao obter foto ${photoId}:`, error);
    return null;
  }
}

// Exportar funções
module.exports = {
  getFolderStructure,
  getPhotosCached,
  getAllLeafFoldersCached,
  getPhotoById,
  clearAllCaches
};