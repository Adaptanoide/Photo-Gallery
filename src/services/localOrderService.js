const fs = require('fs').promises;
const path = require('path');
const localStorageService = require('./localStorageService');

class LocalOrderService {
  constructor() {
    this.ordersPath = process.env.CACHE_STORAGE_PATH
      ? path.join(process.env.CACHE_STORAGE_PATH, 'fotos/imagens-webp')
      : '/opt/render/project/storage/cache/fotos/imagens-webp';

    console.log(`📁 LocalOrderService initialized with path: ${this.ordersPath}`);
  }

  // Garantir que as pastas administrativas existam
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
      console.log(`🚀 Criando pasta para pedido: ${customerName} (${status})`);

      // Garantir que as pastas administrativas existam
      await this.ensureAdminFolders();

      // Gerar nome da pasta
      const totalPhotos = Object.values(photosByCategory)
        .reduce((sum, photos) => sum + photos.length, 0);

      console.log(`📊 Total de fotos no pedido: ${totalPhotos}`);
      console.log(`📂 Categorias: ${Object.keys(photosByCategory).join(', ')}`);

      const date = new Date();
      const monthName = date.toLocaleString('en-US', { month: 'short' });
      const day = date.getDate();
      const year = date.getFullYear();

      const folderName = `${customerName} ${totalPhotos}un ${monthName} ${day} ${year}`;
      const statusFolder = status === 'waiting' ? 'Waiting Payment' : 'Sold';
      const orderPath = path.join(this.ordersPath, statusFolder, folderName);

      console.log(`📁 Criando pasta: ${orderPath}`);

      // Criar pasta do pedido
      await fs.mkdir(orderPath, { recursive: true });

      // Copiar fotos organizadas por categoria
      let copiedPhotos = 0;
      for (const [categoryName, photos] of Object.entries(photosByCategory)) {
        console.log(`📂 Processando categoria: ${categoryName} (${photos.length} fotos)`);

        const categoryPath = path.join(orderPath, categoryName);
        await fs.mkdir(categoryPath, { recursive: true });

        for (const photo of photos) {
          try {
            console.log(`🔍 TESTE: Buscando foto ${photo.id}`);
            const sourcePath = await this.findPhotoPath(photo.id);
            console.log(`📁 TESTE: sourcePath = ${sourcePath}`);

            if (sourcePath) {
              const destPath = path.join(categoryPath, `${photo.id}.webp`);
              console.log(`📋 TESTE: Copiando ${sourcePath} → ${destPath}`);

              await fs.copyFile(sourcePath, destPath);
              console.log(`📋 TESTE: copyFile concluído`);

              await fs.unlink(sourcePath);
              console.log(`🗑️ TESTE: unlink concluído`);

              copiedPhotos++;
              console.log(`✅ TESTE: Foto movida: ${photo.id}.webp`);
            } else {
              console.warn(`⚠️ TESTE: Foto não encontrada: ${photo.id}`);
            }
          } catch (copyError) {
            console.error(`❌ TESTE: Erro ao mover foto ${photo.id}:`, copyError);
          }
        }
      }

      console.log(`✅ ${copiedPhotos} fotos copiadas com sucesso`);

      // 🔧 NOVO: Atualizar contadores das categorias originais
      await this.updateSourceCategoriesCount(photosByCategory);

      // Atualizar índice
      const folderId = localStorageService.generateId();
      await this.updateIndexForOrder(statusFolder, folderName, folderId, totalPhotos);

      return {
        success: true,
        folderId: folderId,
        folderName: folderName,
        folderPath: orderPath,
        copiedPhotos: copiedPhotos
      };
    } catch (error) {
      console.error('❌ Error creating order folder:', error);
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  }

  // Mover pedido entre status
  async moveOrderToStatus(folderId, newStatus) {
    try {
      console.log(`🔄 Movendo pedido ${folderId} para status: ${newStatus}`);

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
        throw new Error(`Order folder not found: ${folderId}`);
      }

      console.log(`📁 Pedido encontrado: ${currentFolder.name} em ${parentFolder.name}`);

      // Definir destino
      const targetFolderName = newStatus === 'paid' ? 'Sold' : 'Waiting Payment';
      let targetFolder = index.folders.find(f => f.name === targetFolderName);

      if (!targetFolder) {
        console.log(`📁 Criando pasta de destino: ${targetFolderName}`);
        targetFolder = {
          id: localStorageService.generateId(),
          name: targetFolderName,
          relativePath: targetFolderName,
          photoCount: 0,
          children: []
        };
        index.folders.push(targetFolder);
      }

      // Garantir que children existe
      if (!targetFolder.children) {
        targetFolder.children = [];
      }

      // Mover fisicamente
      const sourcePath = path.join(this.ordersPath, parentFolder.name, currentFolder.name);
      const destPath = path.join(this.ordersPath, targetFolderName, currentFolder.name);

      console.log(`📦 Movendo pasta fisicamente: ${sourcePath} → ${destPath}`);

      await fs.rename(sourcePath, destPath);

      // Atualizar índice
      parentFolder.children = parentFolder.children.filter(f => f.id !== folderId);

      currentFolder.relativePath = path.join(targetFolderName, currentFolder.name);
      targetFolder.children.push(currentFolder);

      await localStorageService.saveIndex(index);
      localStorageService.clearCache();

      console.log(`✅ Pedido movido para ${targetFolderName}`);

      return {
        success: true,
        message: `Order moved to ${targetFolderName}`,
        newStatus: targetFolderName
      };
    } catch (error) {
      console.error('❌ Error moving order:', error);
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  }

  // Listar pedidos por status
  async listOrdersByStatus(status = 'waiting') {
    try {
      console.log(`📋 Listando pedidos com status: ${status}`);

      const index = await localStorageService.getIndex();
      const folderName = status === 'waiting' ? 'Waiting Payment' : 'Sold';

      const statusFolder = index.folders.find(f => f.name === folderName);
      if (!statusFolder || !statusFolder.children) {
        console.log(`📂 Nenhum pedido encontrado em: ${folderName}`);
        return { success: true, folders: [] };
      }

      const folders = statusFolder.children.map(folder => ({
        id: folder.id,
        name: folder.name,
        createdTime: folder.createdTime || new Date().toISOString(),
        photoCount: folder.photoCount || 0
      }));

      console.log(`📋 Encontrados ${folders.length} pedidos em ${folderName}`);

      return { success: true, folders };
    } catch (error) {
      console.error('❌ Error listing orders:', error);
      return { success: false, folders: [], error: error.message };
    }
  }

  // Buscar caminho de uma foto específica
  async findPhotoPath(photoId) {
    console.log(`🔍 Procurando foto: ${photoId}`);

    // Buscar recursivamente a foto no disco
    const searchInFolder = async (folderPath) => {
      try {
        const items = await fs.readdir(folderPath, { withFileTypes: true });

        for (const item of items) {
          const itemPath = path.join(folderPath, item.name);

          if (item.isDirectory() && !['Waiting Payment', 'Sold'].includes(item.name)) {
            const found = await searchInFolder(itemPath);
            if (found) return found;
          } else if (item.isFile() && item.name === `${photoId}.webp`) {
            console.log(`✅ Foto encontrada: ${itemPath}`);
            return itemPath;
          }
        }
        return null;
      } catch (error) {
        console.error(`❌ Erro ao buscar em ${folderPath}:`, error);
        return null;
      }
    };

    const result = await searchInFolder(this.ordersPath);
    if (!result) {
      console.warn(`⚠️ Foto ${photoId} não encontrada`);
    }
    return result;
  }

  // Atualizar índice com informações do pedido
  async updateIndexForOrder(statusFolder, folderName, folderId, photoCount) {
    console.log(`📝 Atualizando índice para pasta: ${statusFolder}/${folderName}`);

    try {
      const index = await localStorageService.getIndex();

      // Verificar se as pastas administrativas existem no índice
      let parentFolder = index.folders.find(f => f.name === statusFolder);

      if (!parentFolder) {
        console.log(`📁 Criando pasta administrativa no índice: ${statusFolder}`);
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

      return { success: true };
    } catch (error) {
      console.error('❌ Erro ao atualizar índice:', error);
      throw error;
    }
  }

  // Obter detalhes de um pedido específico
  async getOrderDetails(folderId) {
    try {
      console.log(`📋 Obtendo detalhes do pedido: ${folderId}`);

      const index = await localStorageService.getIndex();

      // Buscar o pedido em ambas as pastas
      let orderFolder = null;
      let parentFolderName = null;

      const adminFolders = ['Waiting Payment', 'Sold'];
      for (const folderName of adminFolders) {
        const adminFolder = index.folders.find(f => f.name === folderName);
        if (adminFolder && adminFolder.children) {
          const found = adminFolder.children.find(f => f.id === folderId);
          if (found) {
            orderFolder = found;
            parentFolderName = folderName;
            break;
          }
        }
      }

      if (!orderFolder) {
        return {
          success: false,
          message: 'Order not found'
        };
      }

      // Ler conteúdo da pasta física
      const orderPath = path.join(this.ordersPath, parentFolderName, orderFolder.name);
      const categories = [];

      try {
        const folderContents = await fs.readdir(orderPath, { withFileTypes: true });

        for (const item of folderContents) {
          if (item.isDirectory()) {
            const categoryPath = path.join(orderPath, item.name);
            const categoryFiles = await fs.readdir(categoryPath);

            const photos = categoryFiles
              .filter(file => file.endsWith('.webp'))
              .map(file => ({
                id: path.parse(file).name,
                name: file
              }));

            categories.push({
              name: item.name,
              photos: photos,
              count: photos.length
            });
          }
        }
      } catch (readError) {
        console.error('❌ Erro ao ler pasta do pedido:', readError);
      }

      return {
        success: true,
        order: {
          id: folderId,
          name: orderFolder.name,
          status: parentFolderName,
          createdTime: orderFolder.createdTime,
          photoCount: orderFolder.photoCount,
          categories: categories,
          path: orderPath
        }
      };
    } catch (error) {
      console.error('❌ Error getting order details:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Verificar estatísticas dos pedidos
  async getOrderStats() {
    try {
      const waitingResult = await this.listOrdersByStatus('waiting');
      const soldResult = await this.listOrdersByStatus('paid');

      return {
        success: true,
        stats: {
          waiting: waitingResult.folders ? waitingResult.folders.length : 0,
          sold: soldResult.folders ? soldResult.folders.length : 0,
          total: (waitingResult.folders ? waitingResult.folders.length : 0) +
            (soldResult.folders ? soldResult.folders.length : 0)
        }
      };
    } catch (error) {
      console.error('❌ Error getting order stats:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // NOVA FUNÇÃO: Return photos to stock
  async returnPhotosToStock(folderId, selectedPhotoIds) {
    try {
      console.log(`🔄 Returning ${selectedPhotoIds.length} photos to stock from order: ${folderId}`);

      const index = await localStorageService.getIndex();

      // Encontrar pasta do pedido
      let orderFolder = null;
      let parentFolderName = null;

      const adminFolders = ['Waiting Payment', 'Sold'];
      for (const folderName of adminFolders) {
        const adminFolder = index.folders.find(f => f.name === folderName);
        if (adminFolder && adminFolder.children) {
          const found = adminFolder.children.find(f => f.id === folderId);
          if (found) {
            orderFolder = found;
            parentFolderName = folderName;
            break;
          }
        }
      }

      if (!orderFolder) {
        throw new Error(`Order folder not found: ${folderId}`);
      }

      const orderPath = path.join(this.ordersPath, parentFolderName, orderFolder.name);
      console.log(`📁 Pedido encontrado: ${orderPath}`);

      // Verificar se pasta existe fisicamente
      try {
        await fs.access(orderPath);
      } catch {
        throw new Error(`Order folder does not exist: ${orderPath}`);
      }

      let movedPhotos = 0;
      let emptyCategories = [];

      // Ler categorias dentro do pedido
      const folderContents = await fs.readdir(orderPath, { withFileTypes: true });

      for (const item of folderContents) {
        if (item.isDirectory()) {
          const categoryName = item.name;
          const categoryPath = path.join(orderPath, categoryName);

          console.log(`📂 Processando categoria: ${categoryName}`);

          // Ler fotos da categoria
          const categoryFiles = await fs.readdir(categoryPath);

          for (const fileName of categoryFiles) {
            if (fileName.endsWith('.webp')) {
              const photoId = path.parse(fileName).name;

              // Verificar se esta foto foi selecionada para retorno
              if (selectedPhotoIds.includes(photoId)) {
                console.log(`📋 Retornando foto: ${photoId} para categoria: ${categoryName}`);

                // Encontrar pasta original da categoria
                const originalCategoryPath = await this.findOriginalCategoryPath(categoryName);

                if (originalCategoryPath) {
                  const sourcePath = path.join(categoryPath, fileName);
                  const destPath = path.join(originalCategoryPath, fileName);

                  // Mover foto de volta
                  await fs.copyFile(sourcePath, destPath);
                  await fs.unlink(sourcePath);

                  movedPhotos++;
                  console.log(`✅ Foto ${photoId} movida para: ${originalCategoryPath}`);
                } else {
                  console.warn(`⚠️ Categoria original não encontrada para: ${categoryName}`);
                }
              }
            }
          }

          // Verificar se categoria ficou vazia
          const remainingFiles = await fs.readdir(categoryPath);
          const remainingPhotos = remainingFiles.filter(f => f.endsWith('.webp'));

          //if (remainingPhotos.length === 0) {
          //  console.log(`📁 Categoria vazia, removendo: ${categoryName}`);
          //  await fs.rmdir(categoryPath);
          //  emptyCategories.push(categoryName);
          //}
        }
      }

      // Verificar se pasta do pedido ficou vazia
      const remainingContents = await fs.readdir(orderPath, { withFileTypes: true });
      const remainingDirectories = remainingContents.filter(item => item.isDirectory());

      if (remainingDirectories.length === 0) {
        console.log(`📁 Pedido vazio, removendo pasta: ${orderFolder.name}`);
        await fs.rmdir(orderPath);

        // Remover do índice
        const parentFolder = index.folders.find(f => f.name === parentFolderName);
        if (parentFolder && parentFolder.children) {
          parentFolder.children = parentFolder.children.filter(f => f.id !== folderId);
        }
      } else {
        // Atualizar contador de fotos no índice
        orderFolder.photoCount = (orderFolder.photoCount || 0) - movedPhotos;
      }

      // Salvar índice atualizado
      await localStorageService.saveIndex(index);
      //await localStorageService.rebuildIndex(); // Rebuild para atualizar contadores
      //localStorageService.clearCache();

      console.log(`✅ ${movedPhotos} fotos retornadas ao estoque`);

      return {
        success: true,
        movedPhotos: movedPhotos,
        emptyCategories: emptyCategories,
        orderDeleted: remainingDirectories.length === 0,
        message: `Successfully returned ${movedPhotos} photos to stock`
      };

    } catch (error) {
      console.error('❌ Error returning photos to stock:', error);
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  }

  // NOVA FUNÇÃO: Encontrar pasta original da categoria
  async findOriginalCategoryPath(categoryName) {
    console.log(`🔍 Procurando categoria original: ${categoryName}`);

    const searchInFolder = async (folderPath) => {
      try {
        const items = await fs.readdir(folderPath, { withFileTypes: true });

        for (const item of items) {
          if (item.isDirectory() && !['Waiting Payment', 'Sold'].includes(item.name)) {
            const itemPath = path.join(folderPath, item.name);

            // Verificar se o nome da pasta corresponde
            if (item.name === categoryName) {
              console.log(`✅ Categoria encontrada: ${itemPath}`);
              return itemPath;
            }

            // Buscar recursivamente
            const found = await searchInFolder(itemPath);
            if (found) return found;
          }
        }
        return null;
      } catch (error) {
        console.error(`❌ Erro ao buscar em ${folderPath}:`, error);
        return null;
      }
    };

    return await searchInFolder(this.ordersPath);
  }

  // 🔧 NOVA FUNÇÃO: Atualizar contadores das categorias de origem
  async updateSourceCategoriesCount(photosByCategory) {
    try {
      console.log(`📊 Atualizando contadores das categorias de origem...`);

      const index = await localStorageService.getIndex();
      let updated = false;

      // Para cada categoria que teve fotos movidas
      for (const [categoryName, photos] of Object.entries(photosByCategory)) {
        const photoCount = photos.length;
        console.log(`📉 Categoria "${categoryName}": diminuindo ${photoCount} fotos`);

        // Encontrar categoria no índice
        const category = this.findCategoryByNameInIndex(index, categoryName);
        if (category) {
          category.photoCount = Math.max(0, (category.photoCount || 0) - photoCount);
          console.log(`✅ "${categoryName}": novo contador = ${category.photoCount}`);
          updated = true;
        } else {
          console.warn(`⚠️ Categoria "${categoryName}" não encontrada no índice`);
        }
      }

      if (updated) {
        // Salvar índice atualizado
        await localStorageService.saveIndex(index);
        localStorageService.clearCache();
        console.log(`✅ Contadores das categorias atualizados`);
      }

    } catch (error) {
      console.error('❌ Erro ao atualizar contadores das categorias:', error);
    }
  }

  // 🔧 FUNÇÃO AUXILIAR: Encontrar categoria por nome no índice
  findCategoryByNameInIndex(index, categoryName) {
    const searchInFolders = (folders) => {
      for (const folder of folders) {
        if (folder.name === categoryName) {
          return folder;
        }
        if (folder.children && folder.children.length > 0) {
          const found = searchInFolders(folder.children);
          if (found) return found;
        }
      }
      return null;
    };

    return searchInFolders(index.folders || []);
  }

}

module.exports = new LocalOrderService();