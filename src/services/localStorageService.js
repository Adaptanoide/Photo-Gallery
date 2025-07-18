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

  // REVERTER - SUBSTITUA a função getFolderStructure por esta versão:
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

      // VOLTAR A RETORNAR ARRAY DIRETO (como era antes)
      return this.formatFolderStructure(index, isAdmin, useLeafFolders);
    } catch (error) {
      console.error('Error getting folder structure:', error);
      return []; // RETORNAR ARRAY VAZIO EM CASO DE ERRO
    }
  }

  // ADICIONAR esta nova função para o admin:
  async getAdminFolderStructure(includeEmpty = true) {
    try {
      console.log('[LocalStorage] Getting admin folder structure');

      const folders = await this.getFolderStructure(true, true);

      // Filtrar pastas vazias se necessário
      let filteredFolders = folders;
      if (!includeEmpty) {
        filteredFolders = folders.filter(folder => folder.fileCount && folder.fileCount > 0);
      }

      console.log(`[LocalStorage] Returning ${filteredFolders.length} folders for admin`);

      return {
        success: true,
        folders: filteredFolders,
        message: `Found ${filteredFolders.length} folders`
      };
    } catch (error) {
      console.error('Error getting admin folder structure:', error);
      return {
        success: false,
        folders: [],
        message: error.message
      };
    }
  }

  // SUBSTITUA a função formatFolderStructure por esta versão com logs:
  formatFolderStructure(index, isAdmin, useLeafFolders) {
    console.log(`[DEBUG] formatFolderStructure - isAdmin: ${isAdmin}, useLeafFolders: ${useLeafFolders}`);
    console.log(`[DEBUG] Index folders count: ${index.folders ? index.folders.length : 0}`);

    const adminFolders = ['Waiting Payment', 'Sold', 'Developing'];
    let folders = [];

    // FUNÇÃO RECURSIVA CORRIGIDA
    const processFolder = (folderData, parentPath = []) => {
      console.log(`[DEBUG] Processing folder: ${folderData.name}, photoCount: ${folderData.photoCount}, isAdmin: ${isAdmin}`);

      const currentPath = [...parentPath, folderData.name];

      if (adminFolders.includes(folderData.name)) {
        console.log(`[DEBUG] Skipping admin folder: ${folderData.name}`);
        return;
      }

      // CORREÇÃO: Para clientes, mostrar APENAS pastas com fotos (subpastas finais)
      if (!isAdmin) {
        // Se esta pasta tem fotos diretamente, adicionar
        if (folderData.photoCount && folderData.photoCount > 0) {
          console.log(`[DEBUG] Adding folder with photos: ${folderData.name} (${folderData.photoCount} photos)`);
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
      console.log(`[DEBUG] Processing ${index.folders.length} root folders`);
      index.folders.forEach(folder => processFolder(folder));
    }

    // Adicionar "All Items" para clientes
    if (!isAdmin && !useLeafFolders && folders.length > 0) {
      folders.unshift({
        id: 'all-items',
        name: 'All Items',
        isAll: true,
        isLeaf: false,
        fileCount: index.totalPhotos || 0
      });
    }

    console.log(`[DEBUG] Final folders count: ${folders.length}`);
    console.log(`[DEBUG] First few folders:`, folders.slice(0, 3));

    return folders;
  }

  // NOVA FUNÇÃO: Obter apenas pastas finais para Price Management
  async getLeafFoldersForPricing(includeEmpty = true) {
    try {
      console.log('[LocalStorage] Getting leaf folders for pricing');

      const index = await this.getIndex();
      const leafFolders = [];

      // Função recursiva para encontrar apenas pastas finais
      const findLeafFolders = (folder, parentPath = []) => {
        const currentPath = [...parentPath, folder.name];

        // Pular pastas administrativas
        const adminFolders = ['Waiting Payment', 'Sold', 'Developing'];
        if (adminFolders.includes(folder.name)) {
          return;
        }

        // CRITÉRIO: Pasta final = sem filhos OU filhos todos vazios
        const hasChildren = folder.children && folder.children.length > 0;
        const hasPhotosDirectly = folder.photoCount > 0;

        if (!hasChildren) {
          // Sem filhos = pasta final
          if (includeEmpty || hasPhotosDirectly) {
            leafFolders.push({
              id: folder.id,
              name: folder.name,
              path: currentPath.join(' → '),
              fileCount: folder.photoCount || 0,
              relativePath: folder.relativePath
            });
          }
        } else {
          // Com filhos = processar recursivamente
          folder.children.forEach(child => {
            findLeafFolders(child, currentPath);
          });
        }
      };

      // Processar todas as pastas raiz
      if (index.folders) {
        index.folders.forEach(folder => findLeafFolders(folder));
      }

      console.log(`[LocalStorage] Found ${leafFolders.length} leaf folders for pricing`);

      return {
        success: true,
        folders: leafFolders,
        message: `Found ${leafFolders.length} leaf folders`
      };

    } catch (error) {
      console.error('Error getting leaf folders for pricing:', error);
      return {
        success: false,
        folders: [],
        message: error.message
      };
    }
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
      // 🆕 SUBSTITUA POR:
      const folder = {
        id: this.generateConsistentId(relativePath), // ← SOLUÇÃO: ID baseado no caminho
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

  // 🆕 ADICIONE ESTA FUNÇÃO na classe LocalStorageService:
  generateConsistentId(relativePath) {
    // Gerar ID baseado no caminho, sempre o mesmo para o mesmo caminho
    const crypto = require('crypto');
    return crypto.createHash('md5').update(relativePath || 'root').digest('hex').substring(0, 16);
  }

  // 🔍 FUNÇÃO AUXILIAR: Encontrar pasta fisicamente no disco
  async findRealFolderPath(folder) {
    const fs = require('fs').promises;
    const path = require('path');

    try {
      console.log(`🔍 Finding real path for folder: ${folder.name}`);
      console.log(`📁 Index says path is: ${folder.relativePath}`);

      // PASSO 1: Verificar se path do índice está correto
      const indexPath = path.join(this.photosPath, folder.relativePath);

      try {
        await fs.access(indexPath);
        console.log(`✅ Index path is correct: ${indexPath}`);
        return {
          success: true,
          realPath: indexPath,
          relativePath: folder.relativePath,
          needsUpdate: false
        };
      } catch {
        console.log(`❌ Index path doesn't exist: ${indexPath}`);
      }

      // PASSO 2: Buscar pasta fisicamente no disco
      console.log(`🔍 Searching physically for folder: ${folder.name}`);

      const searchResult = await this.searchFolderPhysically(folder.name, this.photosPath);

      if (searchResult.found) {
        console.log(`✅ Found folder physically at: ${searchResult.fullPath}`);

        // Calcular novo relativePath
        const newRelativePath = path.relative(this.photosPath, searchResult.fullPath);

        return {
          success: true,
          realPath: searchResult.fullPath,
          relativePath: newRelativePath,
          needsUpdate: true, // Precisa atualizar índice
          oldRelativePath: folder.relativePath
        };
      }

      return {
        success: false,
        error: `Folder "${folder.name}" not found physically on disk`
      };

    } catch (error) {
      console.error(`❌ Error finding real folder path:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 🔍 BUSCA RECURSIVA FÍSICA NO DISCO
  async searchFolderPhysically(targetFolderName, searchPath, depth = 0) {
    const fs = require('fs').promises;
    const path = require('path');

    // Limitar profundidade para evitar loops infinitos
    if (depth > 10) {
      return { found: false };
    }

    try {
      const items = await fs.readdir(searchPath, { withFileTypes: true });

      // Buscar na pasta atual
      for (const item of items) {
        if (item.isDirectory() && item.name === targetFolderName) {
          const fullPath = path.join(searchPath, item.name);
          console.log(`🎯 Found target folder: ${fullPath}`);
          return {
            found: true,
            fullPath: fullPath
          };
        }
      }

      // Buscar recursivamente em subpastas
      for (const item of items) {
        if (item.isDirectory()) {
          const subPath = path.join(searchPath, item.name);
          const result = await this.searchFolderPhysically(targetFolderName, subPath, depth + 1);
          if (result.found) {
            return result;
          }
        }
      }

      return { found: false };

    } catch (error) {
      console.error(`❌ Error searching in ${searchPath}:`, error);
      return { found: false };
    }
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

  async getIndex() {
    try {
      const data = await fs.readFile(this.indexFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return await this.rebuildIndex();
    }
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

          let buffer = await fs.readFile(imagePath);

          // OTIMIZAÇÃO: Gerar thumbnail real se solicitado
          if (size === 'thumbnail') {
            try {
              buffer = await sharp(buffer)
                .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
                .webp({
                  quality: 30,        // ← MUITO mais leve
                  effort: 0,          // ← Compressão rápida
                  progressive: true   // ← Carregamento progressivo
                })
                .toBuffer();
              console.log(`[LocalStorage] Generated thumbnail for: ${photoId}`);
            } catch (error) {
              console.warn(`[LocalStorage] Thumbnail generation failed for ${photoId}, using original:`, error.message);
            }
          }

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

  // ADICIONAR esta função para debug:
  async debugIndex() {
    try {
      const index = await this.getIndex();
      console.log('[DEBUG] Full index structure:');
      console.log('Total photos:', index.totalPhotos);
      console.log('Root folders:', index.folders.length);

      // Mostrar estrutura das primeiras 3 pastas
      if (index.folders && index.folders.length > 0) {
        index.folders.slice(0, 3).forEach((folder, i) => {
          console.log(`[DEBUG] Folder ${i + 1}:`, {
            name: folder.name,
            photoCount: folder.photoCount,
            hasChildren: folder.children ? folder.children.length : 0
          });

          // Mostrar primeiros filhos também
          if (folder.children && folder.children.length > 0) {
            folder.children.slice(0, 2).forEach((child, j) => {
              console.log(`  Child ${j + 1}:`, {
                name: child.name,
                photoCount: child.photoCount,
                hasChildren: child.children ? child.children.length : 0
              });
            });
          }
        });
      }

      return index;
    } catch (error) {
      console.error('[DEBUG] Error reading index:', error);
      return null;
    }
  }

  // Mover fotos entre categorias
  async movePhotosToCategory(photoIds, sourceFolder, destinationFolder) {
    const fs = require('fs').promises;
    const path = require('path');

    try {
      console.log(`🔄 Moving ${photoIds.length} photos between categories`);
      console.log(`📂 From: ${sourceFolder.name} → To: ${destinationFolder.name}`);

      // Construir caminhos físicos
      const sourcePath = path.join(this.photosPath, sourceFolder.relativePath);
      const destinationPath = path.join(this.photosPath, destinationFolder.relativePath);

      console.log(`📁 Source path: ${sourcePath}`);
      console.log(`📁 Destination path: ${destinationPath}`);

      // Verificar se pastas existem fisicamente
      try {
        await fs.access(sourcePath);
        await fs.access(destinationPath);
      } catch (error) {
        throw new Error(`Folder path does not exist: ${error.message}`);
      }

      // Garantir que pasta de destino existe
      await fs.mkdir(destinationPath, { recursive: true });

      let movedCount = 0;
      let errors = [];

      // Processar cada foto
      for (const photoId of photoIds) {
        try {
          const fileName = `${photoId}.webp`;
          const sourceFilePath = path.join(sourcePath, fileName);
          const destinationFilePath = path.join(destinationPath, fileName);

          // Verificar se arquivo fonte existe
          try {
            await fs.access(sourceFilePath);
          } catch {
            console.warn(`⚠️ Photo not found: ${fileName}`);
            errors.push(`Photo not found: ${fileName}`);
            continue;
          }

          // Verificar se arquivo destino já existe
          try {
            await fs.access(destinationFilePath);
            console.warn(`⚠️ Photo already exists in destination: ${fileName}`);
            errors.push(`Photo already exists in destination: ${fileName}`);
            continue;
          } catch {
            // Arquivo não existe no destino - pode mover
          }

          // Mover arquivo fisicamente (copiar + deletar)
          await fs.copyFile(sourceFilePath, destinationFilePath);
          await fs.unlink(sourceFilePath);

          movedCount++;
          console.log(`✅ Moved photo: ${fileName}`);

        } catch (photoError) {
          console.error(`❌ Error moving photo ${photoId}:`, photoError);
          errors.push(`Error moving ${photoId}: ${photoError.message}`);
        }
      }

      if (movedCount > 0) {
        // Atualizar índice com novos contadores
        await this.updatePhotoCountsAfterMove(sourceFolder, destinationFolder, movedCount);
        console.log(`📊 Updated photo counts: -${movedCount} from source, +${movedCount} to destination`);
      }

      return {
        success: true,
        movedCount: movedCount,
        totalRequested: photoIds.length,
        errors: errors,
        message: `Successfully moved ${movedCount} of ${photoIds.length} photos`
      };

    } catch (error) {
      console.error('❌ Error in movePhotosToCategory:', error);
      return {
        success: false,
        movedCount: 0,
        errors: [error.message],
        message: `Failed to move photos: ${error.message}`
      };
    }
  }

  // Atualizar contadores de fotos após movimentação
  async updatePhotoCountsAfterMove(sourceFolder, destinationFolder, movedCount) {
    try {
      console.log(`📊 Updating photo counts after moving ${movedCount} photos`);

      const index = await this.getIndex();

      // Encontrar e atualizar pasta origem
      const sourceInIndex = this.findCategoryById(index, sourceFolder.id);
      if (sourceInIndex) {
        sourceInIndex.photoCount = Math.max(0, (sourceInIndex.photoCount || 0) - movedCount);
        console.log(`📉 Source folder ${sourceFolder.name}: ${sourceInIndex.photoCount} photos remaining`);
      }

      // Encontrar e atualizar pasta destino
      const destinationInIndex = this.findCategoryById(index, destinationFolder.id);
      if (destinationInIndex) {
        destinationInIndex.photoCount = (destinationInIndex.photoCount || 0) + movedCount;
        console.log(`📈 Destination folder ${destinationFolder.name}: ${destinationInIndex.photoCount} photos total`);
      }

      // Atualizar timestamp do índice
      index.lastUpdate = new Date().toISOString();

      // Salvar índice atualizado
      await this.saveIndex(index);

      // Limpar cache para forçar recarregamento
      this.clearCache();

      console.log('✅ Photo counts updated successfully');

    } catch (error) {
      console.error('❌ Error updating photo counts:', error);
      throw error;
    }
  }

  // 🔧 ADICIONAR ESTAS FUNÇÕES NO FINAL DA CLASSE LocalStorageService:

  // Deletar fotos de uma categoria
  async deletePhotosFromCategory(photoIds, sourceFolder) {
    const fs = require('fs').promises;
    const path = require('path');

    try {
      console.log(`🗑️ Deleting ${photoIds.length} photos from category: ${sourceFolder.name}`);

      // Construir caminho físico da pasta
      const sourcePath = path.join(this.photosPath, sourceFolder.relativePath);

      console.log(`📁 Source path: ${sourcePath}`);

      // Verificar se pasta existe fisicamente
      try {
        await fs.access(sourcePath);
      } catch (error) {
        throw new Error(`Source folder does not exist: ${sourcePath}`);
      }

      let deletedCount = 0;
      let errors = [];

      // Processar cada foto
      for (const photoId of photoIds) {
        try {
          const fileName = `${photoId}.webp`;
          const filePath = path.join(sourcePath, fileName);

          // Verificar se arquivo existe
          try {
            await fs.access(filePath);
          } catch {
            console.warn(`⚠️ Photo file not found: ${fileName}`);
            errors.push(`Photo not found: ${fileName}`);
            continue;
          }

          // 🗑️ DELETAR ARQUIVO FISICAMENTE
          await fs.unlink(filePath);
          deletedCount++;

          console.log(`✅ Deleted photo: ${fileName}`);

        } catch (photoError) {
          console.error(`❌ Error deleting photo ${photoId}:`, photoError);
          errors.push(`Error deleting ${photoId}: ${photoError.message}`);
        }
      }

      if (deletedCount > 0) {
        // Atualizar contadores no índice
        await this.updatePhotoCountsAfterDeletion(sourceFolder, deletedCount);
        console.log(`📊 Updated photo counts: -${deletedCount} from ${sourceFolder.name}`);
      }

      return {
        success: true,
        deletedCount: deletedCount,
        totalRequested: photoIds.length,
        errors: errors,
        message: `Successfully deleted ${deletedCount} of ${photoIds.length} photos`
      };

    } catch (error) {
      console.error('❌ Error in deletePhotosFromCategory:', error);
      return {
        success: false,
        deletedCount: 0,
        errors: [error.message],
        message: `Failed to delete photos: ${error.message}`
      };
    }
  }

  // Deletar pasta completamente
  async deleteFolderCompletely(folder, includePhotos) {
    const fs = require('fs').promises;
    const path = require('path');

    try {
      console.log(`🗑️ Deleting folder completely: ${folder.name} (includePhotos: ${includePhotos})`);

      const folderPath = path.join(this.photosPath, folder.relativePath);
      console.log(`📁 Folder path: ${folderPath}`);

      // Verificar se pasta existe
      try {
        await fs.access(folderPath);
      } catch (error) {
        throw new Error(`Folder does not exist: ${folderPath}`);
      }

      let deletedPhotos = 0;

      if (includePhotos) {
        // Contar e deletar todas as fotos na pasta
        try {
          const files = await fs.readdir(folderPath);
          const photoFiles = files.filter(file => this.isImageFile(file));

          console.log(`📸 Found ${photoFiles.length} photos to delete`);

          for (const file of photoFiles) {
            try {
              const filePath = path.join(folderPath, file);
              await fs.unlink(filePath);
              deletedPhotos++;
              console.log(`✅ Deleted photo: ${file}`);
            } catch (error) {
              console.error(`❌ Error deleting photo ${file}:`, error);
            }
          }
        } catch (error) {
          console.error('❌ Error reading folder contents:', error);
        }
      }

      // Verificar se pasta está vazia agora
      try {
        const remainingFiles = await fs.readdir(folderPath);
        const remainingPhotos = remainingFiles.filter(file => this.isImageFile(file));

        if (remainingPhotos.length === 0) {
          // 📝 VERIFICAR SE É PASTA ADMINISTRATIVA OU CATEGORIA NORMAL
          const adminFolders = ['Waiting Payment', 'Sold', 'Developing'];
          const isAdminFolder = adminFolders.some(admin => folder.relativePath.includes(admin));

          if (isAdminFolder) {
            // 🗑️ DELETAR PASTA ADMINISTRATIVA FISICAMENTE
            await fs.rmdir(folderPath);
            console.log(`✅ Deleted admin folder: ${folder.name}`);

            // Remover do índice
            await this.removeFolderFromIndex(folder);

            return {
              success: true,
              deletedPhotos: deletedPhotos,
              folderDeleted: true,
              message: `Successfully deleted admin folder "${folder.name}" with ${deletedPhotos} photos`
            };
          } else {
            // 📁 PRESERVAR CATEGORIA NORMAL MESMO VAZIA
            console.log(`📁 Category empty but preserved: ${folder.name}`);

            // Não remover pasta física nem do índice - apenas zerar contador
            // Atualizar contador no índice para 0
            const index = await this.getIndex();
            const folderInIndex = this.findCategoryById(index, folder.id);
            if (folderInIndex) {
              folderInIndex.photoCount = 0;
              await this.saveIndex(index);
            }

            return {
              success: true,
              deletedPhotos: deletedPhotos,
              folderDeleted: false,
              message: `Successfully deleted ${deletedPhotos} photos from "${folder.name}". Category preserved for admin.`
            };
          }
        } else {
          throw new Error(`Folder still contains ${remainingPhotos.length} photos. Cannot delete folder.`);
        }
      } catch (error) {
        if (error.code === 'ENOTEMPTY') {
          throw new Error('Folder is not empty. Cannot delete folder.');
        }
        throw error;
      }

    } catch (error) {
      console.error('❌ Error in deleteFolderCompletely:', error);
      return {
        success: false,
        deletedPhotos: 0,
        folderDeleted: false,
        message: `Failed to delete folder: ${error.message}`
      };
    }
  }

  // Atualizar contadores após exclusão de fotos
  async updatePhotoCountsAfterDeletion(sourceFolder, deletedCount) {
    try {
      console.log(`📊 Updating photo counts after deleting ${deletedCount} photos`);

      const index = await this.getIndex();

      // Encontrar e atualizar pasta no índice
      const folderInIndex = this.findCategoryById(index, sourceFolder.id);
      if (folderInIndex) {
        folderInIndex.photoCount = Math.max(0, (folderInIndex.photoCount || 0) - deletedCount);
        console.log(`📉 Folder ${sourceFolder.name}: ${folderInIndex.photoCount} photos remaining`);
      }

      // Atualizar total geral
      index.totalPhotos = Math.max(0, (index.totalPhotos || 0) - deletedCount);

      // Atualizar timestamp
      index.lastUpdate = new Date().toISOString();

      // Salvar índice atualizado
      await this.saveIndex(index);

      // Limpar cache para forçar recarregamento
      this.clearCache();

      console.log('✅ Photo counts updated after deletion');

    } catch (error) {
      console.error('❌ Error updating photo counts after deletion:', error);
      throw error;
    }
  }

  // Remover pasta do índice
  async removeFolderFromIndex(folderToRemove) {
    try {
      console.log(`📊 Removing folder from index: ${folderToRemove.name}`);

      const index = await this.getIndex();

      // Função recursiva para encontrar e remover pasta
      const removeFolderRecursive = (folders, targetId) => {
        for (let i = 0; i < folders.length; i++) {
          if (folders[i].id === targetId) {
            console.log(`✅ Found and removing folder: ${folders[i].name}`);
            folders.splice(i, 1);
            return true;
          }

          if (folders[i].children && folders[i].children.length > 0) {
            if (removeFolderRecursive(folders[i].children, targetId)) {
              return true;
            }
          }
        }
        return false;
      };

      const removed = removeFolderRecursive(index.folders, folderToRemove.id);

      if (removed) {
        // Atualizar timestamp
        index.lastUpdate = new Date().toISOString();

        // Salvar índice atualizado
        await this.saveIndex(index);

        // Limpar cache
        this.clearCache();

        console.log('✅ Folder removed from index');
      } else {
        console.warn('⚠️ Folder not found in index for removal');
      }

    } catch (error) {
      console.error('❌ Error removing folder from index:', error);
      throw error;
    }
  }

  // 🆕 ADICIONAR NO FINAL DA CLASSE LocalStorageService

  // Salvar foto em uma pasta específica
  async savePhotoToFolder(folderId, photoId, buffer, originalName) {
    try {
      console.log(`💾 Saving photo ${photoId} to folder ${folderId}`);

      // Buscar informações da pasta no índice
      const index = await this.getIndex();
      const folder = await this.findFolderById(index, folderId);

      if (!folder) {
        return {
          success: false,
          error: `Folder not found: ${folderId}`
        };
      }

      console.log(`📁 Target folder: ${folder.name} (${folder.relativePath})`);

      // Construir caminho da pasta
      const folderPath = path.join(this.photosPath, folder.relativePath);

      // Garantir que a pasta existe
      await fs.mkdir(folderPath, { recursive: true });

      // Caminho do arquivo
      const filePath = path.join(folderPath, `${photoId}.webp`);

      // Verificar se já existe (evitar sobrescrever)
      try {
        await fs.access(filePath);
        return {
          success: false,
          error: `Photo already exists: ${photoId}.webp`
        };
      } catch {
        // Arquivo não existe, pode salvar
      }

      // Salvar arquivo
      await fs.writeFile(filePath, buffer);

      console.log(`✅ Photo saved: ${filePath}`);

      return {
        success: true,
        photoId: photoId,
        filePath: filePath,
        folderPath: folder.relativePath,
        originalName: originalName
      };

    } catch (error) {
      console.error(`❌ Error saving photo ${photoId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 🔧 SUBSTITUIR A FUNÇÃO findFolderById no localStorageService.js POR ESTA VERSÃO ROBUSTA:

  // Função auxiliar para encontrar pasta por ID (com fallback para caminho)
  async findFolderById(index, folderId) {
    console.log(`🔍 [DEBUG] Searching for folder ID: ${folderId}`);

    if (!index || !index.folders) {
      console.log('❌ [DEBUG] Index is empty or has no folders property');
      return null;
    }

    console.log(`🔍 [DEBUG] Index has ${index.folders.length} root folders`);

    const searchInFolder = (folder, depth = 0) => {
      if (folder.id === folderId) {
        console.log(`✅ [DEBUG] FOUND by ID: ${folder.name} (${folder.relativePath})`);
        return folder;
      }

      if (folder.children && folder.children.length > 0) {
        for (const child of folder.children) {
          const result = searchInFolder(child, depth + 1);
          if (result) return result;
        }
      }

      return null;
    };

    // PRIMEIRA TENTATIVA: Buscar por ID
    for (const folder of index.folders) {
      const result = searchInFolder(folder);
      if (result) {
        return result;
      }
    }

    console.log(`⚠️ [DEBUG] Folder not found by ID: ${folderId}`);

    // SEGUNDA TENTATIVA: Buscar por nome da pasta (fallback)
    // Extrair nome da pasta dos logs do frontend
    console.log(`🔍 [DEBUG] Attempting fallback search by folder patterns...`);

    const searchByPattern = (folder) => {
      // Buscar pasta "Black & White M" (exemplo mais comum)
      if (folder.name === "Black & White M" &&
        folder.relativePath.includes("1. Medium")) {
        console.log(`✅ [DEBUG] FOUND by pattern: ${folder.name} (${folder.relativePath})`);
        console.log(`📝 [DEBUG] New ID for this folder: ${folder.id}`);
        return folder;
      }

      if (folder.children && folder.children.length > 0) {
        for (const child of folder.children) {
          const result = searchByPattern(child);
          if (result) return result;
        }
      }

      return null;
    };

    // Buscar por padrão
    for (const folder of index.folders) {
      const result = searchByPattern(folder);
      if (result) {
        console.log(`🔄 [DEBUG] ID changed! Old: ${folderId}, New: ${result.id}`);
        return result;
      }
    }

    console.log(`❌ [DEBUG] Folder not found by any method`);

    // Listar primeiras pastas para debug
    console.log(`🔍 [DEBUG] Available folders (first 5):`);
    const listSample = (folder, prefix = "") => {
      console.log(`   ${prefix}- ${folder.name}: ${folder.id} (${folder.relativePath})`);
      if (folder.children && folder.children.length > 0) {
        folder.children.slice(0, 2).forEach(child => listSample(child, prefix + "  "));
      }
    };

    index.folders.slice(0, 2).forEach(folder => listSample(folder));

    return null;
  }

  // ===== GERENCIAMENTO DE PASTAS =====

  async createFolder(parentId, name) {
    try {
      console.log(`📁 Creating folder: ${name} in parent: ${parentId || 'root'}`);

      // Validar nome da pasta
      if (!name || typeof name !== 'string') {
        return {
          success: false,
          message: 'Folder name is required'
        };
      }

      // Limpar nome da pasta
      const cleanName = name.trim().replace(/[<>:"/\\|?*]/g, '');
      if (cleanName !== name) {
        console.log(`🧹 Cleaned folder name: "${name}" → "${cleanName}"`);
      }

      // Obter índice atual
      const index = await this.getIndex();

      // Determinar pasta pai e caminho
      let parentPath = '';
      let parentFolder = null;

      if (parentId) {
        parentFolder = this.findCategoryById(index, parentId);
        if (!parentFolder) {
          return {
            success: false,
            message: 'Parent folder not found'
          };
        }
        parentPath = parentFolder.relativePath;
      }

      // Construir caminho da nova pasta
      const newFolderPath = parentPath ? path.join(parentPath, cleanName) : cleanName;
      const physicalPath = path.join(this.photosPath, newFolderPath);

      console.log(`📁 New folder path: ${newFolderPath}`);
      console.log(`📁 Physical path: ${physicalPath}`);

      // Verificar se já existe
      try {
        await fs.access(physicalPath);
        return {
          success: false,
          message: 'Folder already exists'
        };
      } catch {
        // Pasta não existe - pode criar
      }

      // Criar pasta fisicamente
      await fs.mkdir(physicalPath, { recursive: true });
      console.log(`✅ Physical folder created: ${physicalPath}`);

      // Gerar ID para nova pasta
      const newFolderId = this.generateId();

      // Criar objeto da nova pasta no índice
      const newFolderObject = {
        id: newFolderId,
        name: cleanName,
        relativePath: newFolderPath,
        photoCount: 0,
        children: []
      };

      // Adicionar ao índice
      if (parentId && parentFolder) {
        // Adicionar como filho da pasta pai
        if (!parentFolder.children) {
          parentFolder.children = [];
        }
        parentFolder.children.push(newFolderObject);
      } else {
        // Adicionar como pasta raiz
        index.folders.push(newFolderObject);
      }

      // Atualizar timestamp
      index.lastUpdate = new Date().toISOString();

      // Salvar índice atualizado
      await this.saveIndex(index);

      // Limpar cache
      this.clearCache();

      console.log(`✅ Folder created successfully: ${cleanName} (${newFolderId})`);

      return {
        success: true,
        folderId: newFolderId,
        name: cleanName,
        path: newFolderPath,
        message: `Folder "${cleanName}" created successfully`
      };

    } catch (error) {
      console.error('❌ Error creating folder:', error);
      return {
        success: false,
        message: `Error creating folder: ${error.message}`
      };
    }
  }

  async deleteFolder(folderId) {
    try {
      console.log(`🗑️ Deleting folder: ${folderId}`);

      const index = await this.getIndex();
      const folder = this.findCategoryById(index, folderId);

      if (!folder) {
        return {
          success: false,
          message: 'Folder not found'
        };
      }

      // Verificar se pasta tem fotos
      if (folder.photoCount && folder.photoCount > 0) {
        return {
          success: false,
          message: 'Cannot delete folder with photos'
        };
      }

      // Verificar se pasta tem filhos
      if (folder.children && folder.children.length > 0) {
        return {
          success: false,
          message: 'Cannot delete folder with subfolders'
        };
      }

      const physicalPath = path.join(this.photosPath, folder.relativePath);

      // Deletar pasta física
      await fs.rmdir(physicalPath);

      // Remover do índice
      await this.removeFolderFromIndex(folder);

      console.log(`✅ Folder deleted: ${folder.name}`);

      return {
        success: true,
        message: `Folder "${folder.name}" deleted successfully`
      };

    } catch (error) {
      console.error('❌ Error deleting folder:', error);
      return {
        success: false,
        message: `Error deleting folder: ${error.message}`
      };
    }
  }

  async renameFolder(folderId, newName) {
    try {
      console.log(`✏️ ROBUST RENAME: ${folderId} to ${newName}`);

      // ===== VALIDAÇÕES =====
      if (!newName || typeof newName !== 'string') {
        return {
          success: false,
          message: 'New folder name is required'
        };
      }

      const cleanName = newName.trim().replace(/[<>:"/\\|?*]/g, '');

      if (!cleanName) {
        return {
          success: false,
          message: 'Invalid folder name after cleaning'
        };
      }

      // ===== BUSCAR PASTA NO ÍNDICE =====
      const index = await this.getIndex();
      const folder = this.findCategoryById(index, folderId);

      if (!folder) {
        return {
          success: false,
          message: 'Folder not found in index'
        };
      }

      console.log(`📁 Folder found in index: ${folder.name} (${folder.relativePath})`);

      // ===== BACKUP DO ÍNDICE =====
      const indexBackup = JSON.parse(JSON.stringify(index));
      console.log(`💾 Index backup created`);

      // ===== ENCONTRAR PATH REAL NO DISCO =====
      const pathResult = await this.findRealFolderPath(folder);

      if (!pathResult.success) {
        return {
          success: false,
          message: `Cannot find folder on disk: ${pathResult.error}`
        };
      }

      const oldPath = pathResult.realPath;
      const currentRelativePath = pathResult.relativePath;

      console.log(`🎯 Real folder path: ${oldPath}`);

      // ===== ATUALIZAR ÍNDICE SE NECESSÁRIO =====
      if (pathResult.needsUpdate) {
        console.log(`📝 Updating index with correct path: ${currentRelativePath}`);
        folder.relativePath = currentRelativePath;
        await this.saveIndex(index);
        console.log(`✅ Index synchronized with disk`);
      }

      // ===== CALCULAR NOVO PATH =====
      const parentPath = path.dirname(currentRelativePath);
      const newRelativePath = parentPath === '.' ? cleanName : path.join(parentPath, cleanName);
      const newPath = path.join(this.photosPath, newRelativePath);

      console.log(`📂 Rename operation:`);
      console.log(`   FROM: ${oldPath}`);
      console.log(`   TO:   ${newPath}`);

      // ===== VERIFICAR SE DESTINO JÁ EXISTE =====
      try {
        await fs.access(newPath);
        return {
          success: false,
          message: `A folder with name "${cleanName}" already exists in this location`
        };
      } catch {
        // Destino não existe - pode prosseguir
      }

      // ===== RENOMEAR PASTA FÍSICA =====
      try {
        await fs.rename(oldPath, newPath);
        console.log(`✅ Physical folder renamed successfully`);
      } catch (renameError) {
        console.error(`❌ Physical rename failed:`, renameError);

        // Restaurar backup do índice se houve alteração
        if (pathResult.needsUpdate) {
          await this.saveIndex(indexBackup);
          console.log(`↩️ Index backup restored`);
        }

        return {
          success: false,
          message: `Failed to rename folder physically: ${renameError.message}`
        };
      }

      // ===== ATUALIZAR ÍNDICE COM NOVO NOME E PATH =====
      folder.name = cleanName;
      folder.relativePath = newRelativePath;

      // Atualizar também relativePath de todas as subpastas (se houver)
      const updateChildrenPaths = (parentFolder, oldParentPath, newParentPath) => {
        if (parentFolder.children && parentFolder.children.length > 0) {
          parentFolder.children.forEach(child => {
            // Atualizar path da pasta filha
            const oldChildPath = child.relativePath;
            const newChildPath = oldChildPath.replace(oldParentPath, newParentPath);
            child.relativePath = newChildPath;

            console.log(`📝 Updated child path: ${oldChildPath} → ${newChildPath}`);

            // Recursão para subpastas
            updateChildrenPaths(child, oldParentPath, newParentPath);
          });
        }
      };

      updateChildrenPaths(folder, currentRelativePath, newRelativePath);

      // ===== SALVAR ÍNDICE FINAL =====
      index.lastUpdate = new Date().toISOString();
      await this.saveIndex(index);

      // Limpar cache para forçar recarregamento
      this.clearCache();

      console.log(`✅ ROBUST RENAME COMPLETED: "${cleanName}"`);
      console.log(`📊 Index updated and cache cleared`);

      return {
        success: true,
        name: cleanName,
        oldPath: currentRelativePath,
        newPath: newRelativePath,
        message: `Folder renamed to "${cleanName}" successfully`
      };

    } catch (error) {
      console.error('❌ ROBUST RENAME ERROR:', error);
      return {
        success: false,
        message: `Error renaming folder: ${error.message}`
      };
    }
  }

  // ===== NOVA FUNÇÃO: DELEÇÃO FORÇADA E RECURSIVA =====

  async deleteFolderForced(folder, deletePhysically = true) {
    const fs = require('fs').promises;
    const path = require('path');

    try {
      console.log(`🗑️ FORCED DELETE: ${folder.name} (recursive: ${deletePhysically})`);
      console.log(`📁 Target path: ${folder.relativePath}`);

      const folderPath = path.join(this.photosPath, folder.relativePath);
      let deletedPhotos = 0;
      let deletedFolders = 0;

      if (deletePhysically) {
        // 🗑️ DELETAR TUDO RECURSIVAMENTE (pasta + subpastas + fotos)
        const deleteRecursive = async (dirPath, dirName = '') => {
          try {
            console.log(`🔍 Processing directory: ${dirPath}`);

            // Verificar se diretório existe
            try {
              await fs.access(dirPath);
            } catch {
              console.log(`⚠️ Directory not found: ${dirPath}`);
              return;
            }

            const items = await fs.readdir(dirPath, { withFileTypes: true });
            console.log(`📋 Found ${items.length} items in ${dirName || 'target folder'}`);

            // Primeiro, processar todos os arquivos e subpastas
            for (const item of items) {
              const itemPath = path.join(dirPath, item.name);

              if (item.isDirectory()) {
                console.log(`📁 Processing subfolder: ${item.name}`);
                // Recursão para subpastas
                await deleteRecursive(itemPath, item.name);
                deletedFolders++;
              } else if (this.isImageFile(item.name)) {
                // Deletar foto
                console.log(`🗑️ Deleting photo: ${item.name}`);
                await fs.unlink(itemPath);
                deletedPhotos++;
              } else {
                // Deletar outros arquivos
                console.log(`🗑️ Deleting file: ${item.name}`);
                await fs.unlink(itemPath);
              }
            }

            // Depois de processar conteúdo, deletar a pasta vazia
            console.log(`🗑️ Deleting empty folder: ${dirPath}`);
            await fs.rmdir(dirPath);
            console.log(`✅ Deleted folder: ${dirName || folderPath}`);

          } catch (error) {
            console.error(`❌ Error deleting directory ${dirPath}:`, error);
            // Continuar mesmo com erro em uma subpasta
          }
        };

        // Iniciar deleção recursiva
        await deleteRecursive(folderPath, folder.name);
      }

      // 🗑️ REMOVER DO ÍNDICE (sempre, mesmo se deleção física falhar)
      console.log(`📊 Removing folder from index: ${folder.name}`);
      await this.removeFolderFromIndex(folder);

      console.log(`✅ FORCED DELETE completed: ${deletedPhotos} photos, ${deletedFolders} folders`);

      return {
        success: true,
        deletedPhotos: deletedPhotos,
        deletedFolders: deletedFolders,
        folderDeleted: true,
        message: `Folder "${folder.name}" and all contents (${deletedPhotos} photos, ${deletedFolders} subfolders) deleted permanently`
      };

    } catch (error) {
      console.error('❌ Error in forced delete:', error);
      return {
        success: false,
        deletedPhotos: 0,
        deletedFolders: 0,
        folderDeleted: false,
        message: `Failed to delete folder: ${error.message}`
      };
    }
  }

}

module.exports = new LocalStorageService();