// src/services/localStorageService.js
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

class LocalStorageService {
  constructor() {
    this.baseStoragePath = process.env.CACHE_STORAGE_PATH || '/opt/render/project/storage/cache';
    this.photosPath = '/opt/render/project/storage/cache/fotos/imagens-webp'; // CAMINHO FIXO CORRETO
    this.metadataPath = path.join(this.baseStoragePath, 'metadata');
    this.indexFile = path.join(this.baseStoragePath, 'folder-index.json');
    
    this.folderCache = null;
    this.folderCacheTime = null;
    this.CACHE_DURATION = 5 * 60 * 1000;
  }

  async initialize() {
    console.log('🚀 Initializing LocalStorageService...');
    
    const dirs = [this.photosPath, this.metadataPath];
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
    
    try {
      await fs.access(this.indexFile);
    } catch {
      await this.rebuildIndex();
    }
    
    console.log('✅ LocalStorageService initialized');
  }

  async initializeOrderFolders() {
    console.log('📁 Creating order folders structure...');
    const orderFolders = ['Waiting Payment', 'Sold'];
    
    for (const folder of orderFolders) {
      const folderPath = path.join(this.photosPath, folder);
      await fs.mkdir(folderPath, { recursive: true });
    }
    console.log('✅ Order folders initialized');
  }

  // FUNÇÃO PRINCIPAL CORRIGIDA - SEM DUPLICAÇÃO
  async getFolderStructure(isAdmin = false, useLeafFolders = true) {
    try {
      console.log(`[LocalStorage] Getting folder structure (admin=${isAdmin})`);
      
      if (this.folderCache && Date.now() - this.folderCacheTime < this.CACHE_DURATION) {
        return this.formatFolderStructure(this.folderCache, isAdmin, useLeafFolders);
      }

      let index;
      try {
        const indexData = await fs.readFile(this.indexFile, 'utf8');
        index = JSON.parse(indexData);
      } catch {
        console.log('📋 Index not found, rebuilding...');
        index = await this.rebuildIndex();
      }

      this.folderCache = index;
      this.folderCacheTime = Date.now();

      return this.formatFolderStructure(index, isAdmin, useLeafFolders);
    } catch (error) {
      console.error('Error getting folder structure:', error);
      return [];
    }
  }

  // FORMATAÇÃO CORRIGIDA - MOSTRA SUBPASTAS COM FOTOS
  formatFolderStructure(index, isAdmin, useLeafFolders) {
    const adminFolders = ['Waiting Payment', 'Sold', 'Developing'];
    let folders = [];

    // FUNÇÃO RECURSIVA CORRIGIDA
    const processFolder = (folderData, parentPath = []) => {
      const currentPath = [...parentPath, folderData.name];
      
      if (!isAdmin && adminFolders.includes(folderData.name)) {
        return;
      }

      // CORREÇÃO: Para clientes, mostrar APENAS pastas com fotos (subpastas finais)
      if (!isAdmin) {
        // Se esta pasta tem fotos diretamente, adicionar
        if (folderData.photoCount > 0) {
          folders.push({
            id: folderData.id,
            name: folderData.name,
            path: currentPath,
            fullPath: currentPath.join(' → '),
            isAll: false,
            isLeaf: true,
            fileCount: folderData.photoCount
          });
        }
        
        // Processar filhos para encontrar mais pastas com fotos
        if (folderData.children && folderData.children.length > 0) {
          folderData.children.forEach(child => {
            processFolder(child, currentPath);
          });
        }
      } else {
        // Para admin, mostrar estrutura completa
        folders.push({
          id: folderData.id,
          name: folderData.name,
          path: currentPath,
          fullPath: currentPath.join(' → '),
          isAll: false,
          isLeaf: folderData.photoCount > 0,
          fileCount: folderData.photoCount || 0,
          hasChildren: folderData.children && folderData.children.length > 0
        });
        
        if (folderData.children && folderData.children.length > 0) {
          folderData.children.forEach(child => {
            processFolder(child, currentPath);
          });
        }
      }
    };

    if (index.folders) {
      index.folders.forEach(folder => processFolder(folder));
    }

    // Adicionar "All Items" para clientes
    if (!isAdmin && folders.length > 0) {
      folders.unshift({
        id: 'all-items',
        name: 'All Items',
        isAll: true,
        isLeaf: false,
        fileCount: index.totalPhotos || 0
      });
    }

    console.log(`[LocalStorage] Returning ${folders.length} folders`);
    return folders;
  }

  // FUNÇÃO GETPHOTOS SIMPLIFICADA
  async getPhotos(categoryId) {
    try {
      console.log(`[LocalStorage] Getting photos for category: ${categoryId}`);
      
      if (categoryId === 'all-items' || !categoryId) {
        return this.getAllPhotos();
      }

      const index = await this.getIndex();
      const category = this.findCategoryById(index, categoryId);
      
      if (!category) {
        console.log(`[LocalStorage] Category not found: ${categoryId}`);
        return [];
      }

      const photos = [];
      const categoryPath = path.join(this.photosPath, category.relativePath);
      
      try {
        const files = await fs.readdir(categoryPath);
        
        for (const file of files) {
          if (this.isImageFile(file)) {
            const photoId = path.parse(file).name;
            
            photos.push({
              id: photoId,
              name: file,
              folderId: categoryId,
              categoryPath: category.relativePath,
              thumbnail: `/api/photos/local/thumbnail/${photoId}`,
              highres: `/api/photos/local/${categoryId}/${photoId}`,
              source: 'local'
            });
          }
        }
      } catch (error) {
        console.error(`Error reading category ${categoryId}:`, error);
      }

      console.log(`[LocalStorage] Found ${photos.length} photos in category ${categoryId}`);
      return photos;
    } catch (error) {
      console.error('Error getting photos:', error);
      return [];
    }
  }

  async getAllPhotos() {
    const photos = [];
    const index = await this.getIndex();

    const processFolder = async (folder) => {
      if (folder.photoCount > 0) {
        const categoryPhotos = await this.getPhotos(folder.id);
        photos.push(...categoryPhotos);
      }

      if (folder.children) {
        for (const child of folder.children) {
          await processFolder(child);
        }
      }
    };

    if (index.folders) {
      for (const folder of index.folders) {
        await processFolder(folder);
      }
    }

    return photos;
  }

  // REBUILDINDEX - SEM DUPLICAÇÃO
  async rebuildIndex() {
    console.log('🔄 Rebuilding folder index...');
    
    const index = {
      version: '1.0',
      lastUpdate: new Date().toISOString(),
      totalPhotos: 0,
      folders: []
    };
    
    const scanFolder = async (folderPath, relativePath = '') => {
      const items = await fs.readdir(folderPath, { withFileTypes: true });
      const folder = {
        id: this.generateId(),
        name: path.basename(folderPath),
        relativePath: relativePath,
        photoCount: 0,
        children: []
      };
      
      for (const item of items) {
        const itemPath = path.join(folderPath, item.name);
        const itemRelativePath = path.join(relativePath, item.name);
        
        if (item.isDirectory()) {
          const childFolder = await scanFolder(itemPath, itemRelativePath);
          folder.children.push(childFolder);
        } else if (this.isImageFile(item.name)) {
          folder.photoCount++;
          index.totalPhotos++;
        }
      }
      
      return folder;
    };
    
    try {
      const rootItems = await fs.readdir(this.photosPath, { withFileTypes: true });
      
      for (const item of rootItems) {
        if (item.isDirectory()) {
          const folder = await scanFolder(
            path.join(this.photosPath, item.name),
            item.name
          );
          index.folders.push(folder);
        }
      }
    } catch (error) {
      console.error('Error scanning photos directory:', error);
    }
    
    await this.saveIndex(index);
    console.log(`✅ Index rebuilt: ${index.totalPhotos} photos in ${index.folders.length} root folders`);
    
    return index;
  }

  // FUNÇÕES AUXILIARES
  async getIndex() {
    try {
      const data = await fs.readFile(this.indexFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return await this.rebuildIndex();
    }
  }

  async saveIndex(index) {
    await fs.writeFile(this.indexFile, JSON.stringify(index, null, 2));
  }

  findCategoryById(index, categoryId) {
    const search = (folders) => {
      for (const folder of folders) {
        if (folder.id === categoryId) return folder;
        if (folder.children) {
          const found = search(folder.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    return search(index.folders || []);
  }

  async serveImage(photoId, size = 'full') {
    try {
      console.log(`[LocalStorage] Serving image: ${photoId}, size: ${size}`);
      
      // Buscar a foto em todas as pastas do índice
      const index = await this.getIndex();
      
      // Função recursiva para buscar a foto
      const findPhotoInFolder = async (folder) => {
        // Tentar na pasta atual
        const folderPath = path.join(this.photosPath, folder.relativePath);
        const imagePath = path.join(folderPath, `${photoId}.webp`);
        
        try {
          await fs.access(imagePath);
          console.log(`[LocalStorage] Found image at: ${imagePath}`);
          
          const buffer = await fs.readFile(imagePath);
          return {
            buffer: buffer,
            contentType: 'image/webp',
            path: imagePath
          };
        } catch {
          // Não encontrou nesta pasta
        }
        
        // Buscar nas subpastas
        if (folder.children && folder.children.length > 0) {
          for (const child of folder.children) {
            const result = await findPhotoInFolder(child);
            if (result) return result;
          }
        }
        
        return null;
      };
      
      // Buscar em todas as pastas raiz
      for (const folder of index.folders || []) {
        const result = await findPhotoInFolder(folder);
        if (result) return result;
      }
      
      console.log(`[LocalStorage] Image not found: ${photoId}`);
      return null;
    } catch (error) {
      console.error(`Error serving image ${photoId}:`, error);
      return null;
    }
  }

  isImageFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  clearCache() {
    this.folderCache = null;
    this.folderCacheTime = null;
  }

  async getStorageStats() {
    return {
      totalSize: 0,
      photoCount: 0,
      folderCount: 0,
      usedGB: '0',
      availableGB: '50',
      percentUsed: '0'
    };
  }
}

module.exports = new LocalStorageService();