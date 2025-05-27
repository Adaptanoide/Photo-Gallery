// src/services/localStorageService.js
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

class LocalStorageService {
  constructor() {
    // Usar o mesmo path do smartCache para consistência
    this.baseStoragePath = process.env.CACHE_STORAGE_PATH || '/opt/render/project/storage/cache';
    this.photosPath = path.join(this.baseStoragePath, 'fotos/imagens-webp');
    this.metadataPath = path.join(this.baseStoragePath, 'metadata');
    this.indexFile = path.join(this.baseStoragePath, 'folder-index.json');

    // Nova flag para desativar Google Drive
    this.useOnlyLocalStorage = true;

    // Cache em memória para performance
    this.folderCache = null;
    this.folderCacheTime = null;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
  }

  // Atualize o método getFolderStructure para não depender do Google Drive
  async getFolderStructure(isAdmin = false, useLeafFolders = true) {
    try {
      // Verificar cache primeiro
      if (this.folderCache && Date.now() - this.folderCacheTime < this.CACHE_DURATION) {
        return this.formatFolderStructure(this.folderCache, isAdmin, useLeafFolders);
      }

      // Ler índice ou reconstruir
      let index;
      try {
        const indexData = await fs.readFile(this.indexFile, 'utf8');
        index = JSON.parse(indexData);
      } catch {
        console.log('📋 Index not found, rebuilding...');
        index = await this.rebuildIndex();
      }

      // Atualizar cache
      this.folderCache = index;
      this.folderCacheTime = Date.now();

      return this.formatFolderStructure(index, isAdmin, useLeafFolders);
    } catch (error) {
      console.error('Error getting folder structure:', error);
      return [];
    }
  }

  // Adicione este método para construir o índice de pastas baseado apenas no sistema de arquivos local
  async rebuildIndex() {
    console.log('🔄 Rebuilding folder index...');

    const index = {
      version: '1.0',
      lastUpdate: new Date().toISOString(),
      totalPhotos: 0,
      folders: []
    };

    // Função recursiva para escanear pastas
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

    // Escanear pasta raiz
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

  async initialize() {
    console.log('🚀 Initializing LocalStorageService...');

    const dirs = [
      this.photosPath,
      this.metadataPath
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Criar índice se não existir
    try {
      await fs.access(this.indexFile);
    } catch {
      await this.rebuildIndex();
    }

    console.log('✅ LocalStorageService initialized');
  }

  // Adicionar ao initialize() do localStorageService.js
  async initializeOrderFolders() {
    console.log('📁 Creating order folders structure...');

    const orderFolders = ['Waiting Payment', 'Sold'];

    for (const folder of orderFolders) {
      const folderPath = path.join(this.photosPath, folder);
      await fs.mkdir(folderPath, { recursive: true });

      // Adicionar ao índice se não existir
      const index = await this.getIndex();
      const exists = this.findCategoryByPath(index, folder);

      if (!exists) {
        const newFolder = {
          id: this.generateId(),
          name: folder,
          relativePath: folder,
          photoCount: 0,
          children: [],
          isAdminFolder: true // Flag especial para pastas admin
        };

        if (!index.folders) index.folders = [];
        index.folders.push(newFolder);
        await this.saveIndex(index);
      }
    }

    console.log('✅ Order folders initialized');
  }

  // CRÍTICO: Função para obter estrutura de pastas (substitui getFolderStructure do driveService)
  async getFolderStructure(isAdmin = false, useLeafFolders = true) {
    try {
      // Verificar cache primeiro
      if (this.folderCache && Date.now() - this.folderCacheTime < this.CACHE_DURATION) {
        return this.formatFolderStructure(this.folderCache, isAdmin, useLeafFolders);
      }

      // Ler índice ou reconstruir
      let index;
      try {
        const indexData = await fs.readFile(this.indexFile, 'utf8');
        index = JSON.parse(indexData);
      } catch {
        console.log('📋 Index not found, rebuilding...');
        index = await this.rebuildIndex();
      }

      // Atualizar cache
      this.folderCache = index;
      this.folderCacheTime = Date.now();

      return this.formatFolderStructure(index, isAdmin, useLeafFolders);
    } catch (error) {
      console.error('Error getting folder structure:', error);
      return [];
    }
  }

  // Formatar estrutura para compatibilidade com código existente
  formatFolderStructure(index, isAdmin, useLeafFolders) {
    const adminFolders = ['Waiting Payment', 'Sold', 'Developing'];
    let folders = [];

    // Função recursiva para processar pastas
    const processFolder = (folderData, parentPath = []) => {
      const currentPath = [...parentPath, folderData.name];

      // Pular pastas administrativas para não-admin
      if (!isAdmin && adminFolders.includes(folderData.name)) {
        return;
      }

      // Se tem subpastas
      if (folderData.children && folderData.children.length > 0) {
        folderData.children.forEach(child => {
          processFolder(child, currentPath);
        });
      } else if (folderData.photoCount > 0 || isAdmin) {
        // É uma pasta folha com fotos (ou admin vê todas)
        folders.push({
          id: folderData.id,
          name: folderData.name,
          path: currentPath,
          fullPath: currentPath.join(' → '),
          isAll: false,
          isLeaf: true,
          fileCount: folderData.photoCount || 0
        });
      }
    };

    // Processar cada pasta raiz
    if (index.folders) {
      index.folders.forEach(folder => processFolder(folder));
    }

    // Adicionar "All Items" no início
    if (!isAdmin) {
      folders.unshift({
        id: 'all-items',
        name: 'All Items',
        isAll: true,
        isLeaf: false,
        fileCount: index.totalPhotos || 0
      });
    }

    return folders;
  }

  // Obter fotos de uma categoria (substitui getPhotos do driveService)
  async getPhotos(categoryId) {
    try {
      console.log(`[LocalStorage] Getting photos for category: ${categoryId}`);

      if (categoryId === 'all-items' || !categoryId) {
        // Retornar todas as fotos
        return this.getAllPhotos();
      }

      // Buscar no índice
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
            const metadata = await this.getPhotoMetadata(photoId);

            photos.push({
              id: photoId,
              name: file,
              folderId: categoryId,
              categoryPath: category.relativePath,
              thumbnail: `/api/photos/local/thumbnail/${photoId}`,
              highres: `/api/photos/local/${categoryId}/${photoId}`,
              metadata: metadata,
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

  // Obter todas as fotos
  async getAllPhotos() {
    const photos = [];
    const index = await this.getIndex();

    // Recursivamente obter fotos de todas as categorias
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

  // Mover foto entre categorias
  async movePhoto(photoId, fromCategoryId, toCategoryId) {
    try {
      const index = await this.getIndex();
      const fromCategory = this.findCategoryById(index, fromCategoryId);
      const toCategory = this.findCategoryById(index, toCategoryId);

      if (!fromCategory || !toCategory) {
        throw new Error('Category not found');
      }

      const fromPath = path.join(this.photosPath, fromCategory.relativePath, `${photoId}.webp`);
      const toPath = path.join(this.photosPath, toCategory.relativePath, `${photoId}.webp`);

      // Garantir que pasta destino existe
      await fs.mkdir(path.dirname(toPath), { recursive: true });

      // Mover arquivo
      await fs.rename(fromPath, toPath);

      // Atualizar metadata
      const metadata = await this.getPhotoMetadata(photoId);
      metadata.categoryId = toCategoryId;
      metadata.categoryPath = toCategory.relativePath;
      metadata.movedDate = new Date().toISOString();
      await this.savePhotoMetadata(photoId, metadata);

      // Atualizar índice
      fromCategory.photoCount--;
      toCategory.photoCount++;
      await this.saveIndex(index);

      // Limpar cache
      this.clearCache();

      return { success: true };
    } catch (error) {
      console.error('Error moving photo:', error);
      throw error;
    }
  }

  // Criar nova pasta
  async createFolder(folderPath) {
    try {
      const parts = folderPath.split('/').filter(p => p);
      const folderName = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join('/');

      // Criar pasta física
      const fullPath = path.join(this.photosPath, folderPath);
      await fs.mkdir(fullPath, { recursive: true });

      // Atualizar índice
      const index = await this.getIndex();
      const parentFolder = parentPath ? this.findCategoryByPath(index, parentPath) : null;

      const newFolder = {
        id: this.generateId(),
        name: folderName,
        relativePath: folderPath,
        photoCount: 0,
        children: []
      };

      if (parentFolder) {
        if (!parentFolder.children) parentFolder.children = [];
        parentFolder.children.push(newFolder);
      } else {
        if (!index.folders) index.folders = [];
        index.folders.push(newFolder);
      }

      await this.saveIndex(index);
      this.clearCache();

      return { success: true, folder: newFolder };
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }

  // Deletar pasta (apenas se vazia)
  async deleteFolder(folderId) {
    try {
      const index = await this.getIndex();
      const folder = this.findCategoryById(index, folderId);

      if (!folder) {
        throw new Error('Folder not found');
      }

      if (folder.photoCount > 0) {
        throw new Error('Folder is not empty');
      }

      // Deletar pasta física
      const fullPath = path.join(this.photosPath, folder.relativePath);
      await fs.rmdir(fullPath);

      // Remover do índice
      this.removeFromIndex(index, folderId);
      await this.saveIndex(index);
      this.clearCache();

      return { success: true };
    } catch (error) {
      console.error('Error deleting folder:', error);
      throw error;
    }
  }

  // Renomear pasta
  async renameFolder(folderId, newName) {
    try {
      const index = await this.getIndex();
      const folder = this.findCategoryById(index, folderId);

      if (!folder) {
        throw new Error('Folder not found');
      }

      const oldPath = path.join(this.photosPath, folder.relativePath);
      const parentPath = path.dirname(folder.relativePath);
      const newRelativePath = path.join(parentPath, newName);
      const newPath = path.join(this.photosPath, newRelativePath);

      // Renomear pasta física
      await fs.rename(oldPath, newPath);

      // Atualizar índice
      folder.name = newName;
      folder.relativePath = newRelativePath;

      // Atualizar paths dos filhos recursivamente
      this.updateChildPaths(folder, newRelativePath);

      await this.saveIndex(index);
      this.clearCache();

      return { success: true, folder: folder };
    } catch (error) {
      console.error('Error renaming folder:', error);
      throw error;
    }
  }

  // Servir imagem local
  async serveImage(photoId, size = 'full') {
    try {
      const metadata = await this.getPhotoMetadata(photoId);

      if (!metadata || !metadata.categoryPath) {
        return null;
      }

      let imagePath;
      if (size === 'thumbnail') {
        // Verificar se thumbnail existe
        const thumbPath = path.join(this.baseStoragePath, 'thumbnails', 'medium', `${photoId}.webp`);
        try {
          await fs.access(thumbPath);
          imagePath = thumbPath;
        } catch {
          // Gerar thumbnail se não existir
          const fullPath = path.join(this.photosPath, metadata.categoryPath, `${photoId}.webp`);
          await this.generateThumbnail(fullPath, photoId);
          imagePath = thumbPath;
        }
      } else {
        imagePath = path.join(this.photosPath, metadata.categoryPath, `${photoId}.webp`);
      }

      const buffer = await fs.readFile(imagePath);
      return {
        buffer: buffer,
        contentType: 'image/webp',
        path: imagePath
      };
    } catch (error) {
      console.error(`Error serving image ${photoId}:`, error);
      return null;
    }
  }

  // Gerar thumbnail
  async generateThumbnail(sourcePath, photoId) {
    const sizes = {
      small: 150,
      medium: 300,
      large: 600
    };

    for (const [size, width] of Object.entries(sizes)) {
      const outputDir = path.join(this.baseStoragePath, 'thumbnails', size);
      await fs.mkdir(outputDir, { recursive: true });

      const outputPath = path.join(outputDir, `${photoId}.webp`);

      await sharp(sourcePath)
        .resize(width, width, {
          fit: 'cover',
          position: 'centre'
        })
        .webp({ quality: 80 })
        .toFile(outputPath);
    }
  }

  // Reconstruir índice completo
  async rebuildIndex() {
    console.log('🔄 Rebuilding folder index...');

    const index = {
      version: '1.0',
      lastUpdate: new Date().toISOString(),
      totalPhotos: 0,
      folders: []
    };

    // Função recursiva para escanear pastas
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

    // Escanear pasta raiz
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

  // Funções auxiliares
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

  findCategoryByPath(index, path) {
    const parts = path.split('/').filter(p => p);
    let current = index.folders || [];
    let folder = null;

    for (const part of parts) {
      folder = current.find(f => f.name === part);
      if (!folder) return null;
      current = folder.children || [];
    }

    return folder;
  }

  removeFromIndex(index, folderId) {
    const remove = (folders, parent = null) => {
      for (let i = 0; i < folders.length; i++) {
        if (folders[i].id === folderId) {
          folders.splice(i, 1);
          return true;
        }
        if (folders[i].children) {
          if (remove(folders[i].children, folders[i])) return true;
        }
      }
      return false;
    };

    remove(index.folders || []);
  }

  updateChildPaths(folder, newBasePath) {
    if (folder.children) {
      folder.children.forEach(child => {
        child.relativePath = path.join(newBasePath, child.name);
        this.updateChildPaths(child, child.relativePath);
      });
    }
  }

  async getPhotoMetadata(photoId) {
    try {
      const metadataFile = path.join(this.metadataPath, `${photoId}.json`);
      const data = await fs.readFile(metadataFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  async savePhotoMetadata(photoId, metadata) {
    const metadataFile = path.join(this.metadataPath, `${photoId}.json`);
    await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
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

  // Obter estatísticas de armazenamento
  async getStorageStats() {
    const stats = {
      totalSize: 0,
      photoCount: 0,
      folderCount: 0
    };

    const calculateSize = async (dirPath) => {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);

        if (item.isDirectory()) {
          stats.folderCount++;
          await calculateSize(itemPath);
        } else if (item.isFile()) {
          const stat = await fs.stat(itemPath);
          stats.totalSize += stat.size;
          if (this.isImageFile(item.name)) {
            stats.photoCount++;
          }
        }
      }
    };

    await calculateSize(this.photosPath);

    const totalAvailable = 50 * 1024 * 1024 * 1024; // 50GB
    stats.usedGB = (stats.totalSize / (1024 * 1024 * 1024)).toFixed(2);
    stats.availableGB = ((totalAvailable - stats.totalSize) / (1024 * 1024 * 1024)).toFixed(2);
    stats.percentUsed = ((stats.totalSize / totalAvailable) * 100).toFixed(1);

    return stats;
  }
}

module.exports = new LocalStorageService();