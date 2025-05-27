const fs = require('fs').promises;
const path = require('path');
const localStorageService = require('./localStorageService');

class LocalOrderService {
  constructor() {
    this.ordersPath = process.env.CACHE_STORAGE_PATH
      ? path.join(process.env.CACHE_STORAGE_PATH, 'fotos/imagens-webp')
      : '/opt/render/project/storage/cache/fotos/imagens-webp';
  }

  async ensureAdminFolders() {
    console.log('📁 Verificando pastas administrativas...');

    const adminFolders = ['Waiting Payment', 'Sold'];

    for (const folderName of adminFolders) {
      const folderPath = path.join(this.ordersPath, folderName);
      try {
        await fs.mkdir(folderPath, { recursive: true });
        console.log(`✅ Pasta criada/verificada: ${folderName}`);
      } catch (error) {
        console.error(`❌ Erro ao criar pasta ${folderName}:`, error);
      }
    }
  }

  // Criar pasta do pedido
  async createOrderFolder(customerName, photosByCategory, status = 'waiting') {
    try {
      // ADICIONAR esta linha no início:
      await this.ensureAdminFolders();
      
      // Gerar nome da pasta
      const totalPhotos = Object.values(photosByCategory)
        .reduce((sum, photos) => sum + photos.length, 0);

      const date = new Date();
      const monthName = date.toLocaleString('en-US', { month: 'short' });
      const day = date.getDate();
      const year = date.getFullYear();

      const folderName = `${customerName} ${totalPhotos}un ${monthName} ${day} ${year}`;
      const statusFolder = status === 'waiting' ? 'Waiting Payment' : 'Sold';
      const orderPath = path.join(this.ordersPath, statusFolder, folderName);

      // Criar pasta do pedido
      await fs.mkdir(orderPath, { recursive: true });

      // Copiar fotos organizadas por categoria
      for (const [categoryName, photos] of Object.entries(photosByCategory)) {
        const categoryPath = path.join(orderPath, categoryName);
        await fs.mkdir(categoryPath, { recursive: true });

        // Copiar cada foto
        for (const photo of photos) {
          const sourcePath = await this.findPhotoPath(photo.id);
          if (sourcePath) {
            const destPath = path.join(categoryPath, `${photo.id}.webp`);
            await fs.copyFile(sourcePath, destPath);
          }
        }
      }

      // Atualizar índice
      const folderId = localStorageService.generateId();
      await this.updateIndexForOrder(statusFolder, folderName, folderId, totalPhotos);

      return {
        success: true,
        folderId: folderId,
        folderName: folderName,
        folderPath: orderPath
      };
    } catch (error) {
      console.error('Error creating order folder:', error);
      throw error;
    }
  }

  // Mover pedido entre status
  async moveOrderToStatus(folderId, newStatus) {
    try {
      const index = await localStorageService.getIndex();

      // Encontrar pasta atual
      let currentFolder = null;
      let parentFolder = null;

      // Buscar em Waiting Payment
      const waitingFolder = index.folders.find(f => f.name === 'Waiting Payment');
      if (waitingFolder && waitingFolder.children) {
        currentFolder = waitingFolder.children.find(f => f.id === folderId);
        if (currentFolder) parentFolder = waitingFolder;
      }

      // Se não encontrou, buscar em Sold
      if (!currentFolder) {
        const soldFolder = index.folders.find(f => f.name === 'Sold');
        if (soldFolder && soldFolder.children) {
          currentFolder = soldFolder.children.find(f => f.id === folderId);
          if (currentFolder) parentFolder = soldFolder;
        }
      }

      if (!currentFolder) {
        throw new Error('Order folder not found');
      }

      // Definir destino
      const targetFolderName = newStatus === 'paid' ? 'Sold' : 'Waiting Payment';
      const targetFolder = index.folders.find(f => f.name === targetFolderName);

      if (!targetFolder) {
        throw new Error('Target folder not found');
      }

      // Mover fisicamente
      const sourcePath = path.join(this.ordersPath, parentFolder.name, currentFolder.name);
      const destPath = path.join(this.ordersPath, targetFolderName, currentFolder.name);

      await fs.rename(sourcePath, destPath);

      // Atualizar índice
      parentFolder.children = parentFolder.children.filter(f => f.id !== folderId);
      if (!targetFolder.children) targetFolder.children = [];

      currentFolder.relativePath = path.join(targetFolderName, currentFolder.name);
      targetFolder.children.push(currentFolder);

      await localStorageService.saveIndex(index);
      localStorageService.clearCache();

      return { success: true };
    } catch (error) {
      console.error('Error moving order:', error);
      throw error;
    }
  }

  // Listar pedidos por status
  async listOrdersByStatus(status = 'waiting') {
    try {
      const index = await localStorageService.getIndex();
      const folderName = status === 'waiting' ? 'Waiting Payment' : 'Sold';

      const statusFolder = index.folders.find(f => f.name === folderName);
      if (!statusFolder || !statusFolder.children) {
        return { success: true, folders: [] };
      }

      const folders = statusFolder.children.map(folder => ({
        id: folder.id,
        name: folder.name,
        createdTime: folder.createdTime || new Date().toISOString(),
        photoCount: folder.photoCount || 0
      }));

      return { success: true, folders };
    } catch (error) {
      console.error('Error listing orders:', error);
      return { success: false, folders: [], error: error.message };
    }
  }

  // Helpers
  async findPhotoPath(photoId) {
    // Buscar recursivamente a foto no disco
    const searchInFolder = async (folderPath) => {
      const items = await fs.readdir(folderPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(folderPath, item.name);

        if (item.isDirectory() && !['Waiting Payment', 'Sold'].includes(item.name)) {
          const found = await searchInFolder(itemPath);
          if (found) return found;
        } else if (item.isFile() && item.name === `${photoId}.webp`) {
          return itemPath;
        }
      }
      return null;
    };

    return await searchInFolder(this.ordersPath);
  }

  // SUBSTITUIR a função updateIndexForOrder por esta versão segura:
  async updateIndexForOrder(statusFolder, folderName, folderId, photoCount) {
    console.log(`📝 Atualizando índice para pasta: ${statusFolder}/${folderName}`);

    const index = await localStorageService.getIndex();

    // Verificar se as pastas administrativas existem
    let parentFolder = index.folders.find(f => f.name === statusFolder);

    if (!parentFolder) {
      console.log(`📁 Criando pasta administrativa: ${statusFolder}`);
      // Criar a pasta se não existir
      parentFolder = {
        id: localStorageService.generateId(),
        name: statusFolder,
        relativePath: statusFolder,
        photoCount: 0,
        children: []
      };
      index.folders.push(parentFolder);
    }

    // Garantir que children existe
    if (!parentFolder.children) {
      parentFolder.children = [];
    }

    // Adicionar o pedido
    parentFolder.children.push({
      id: folderId,
      name: folderName,
      relativePath: path.join(statusFolder, folderName),
      photoCount: photoCount,
      createdTime: new Date().toISOString()
    });

    console.log(`✅ Pedido adicionado ao índice: ${folderName}`);

    await localStorageService.saveIndex(index);
    localStorageService.clearCache();
  }
}

module.exports = new LocalOrderService();