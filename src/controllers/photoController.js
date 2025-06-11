// photoController.js
const driveService = require('../services/driveService');
const mongoService = require('../services/mongoService');
const CategoryPrice = require('../models/categoryPrice');
const CustomerCode = require('../models/customerCode');
const CategoryAccess = require('../models/categoryAccess');
const localStorageService = require('../services/localStorageService');


// Adicionar acesso à constante FOLDER_ID
const { FOLDER_ID } = process.env;

// Cache de imagens processadas em memória
const processedImageCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos
const MAX_CACHE_SIZE = 200; // Máximo de imagens no cache

// Função para limpar cache antigo
function cleanupImageCache() {
  const now = Date.now();
  const entriesToDelete = [];
  
  processedImageCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_TTL) {
      entriesToDelete.push(key);
    }
  });
  
  entriesToDelete.forEach(key => processedImageCache.delete(key));
  
  // Se ainda estiver muito grande, remover os mais antigos
  if (processedImageCache.size > MAX_CACHE_SIZE) {
    const sortedEntries = Array.from(processedImageCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = sortedEntries.slice(0, processedImageCache.size - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => processedImageCache.delete(key));
  }
}

// Limpar cache periodicamente
setInterval(cleanupImageCache, 5 * 60 * 1000); // A cada 5 minutos

// Obter fotos
// FUNÇÃO COMPLETA PARA SUBSTITUIR exports.getPhotos no photoController.js

exports.getPhotos = async (req, res) => {
  try {
    const categoryId = req.query.category_id || null;
    const customerCode = req.query.customer_code;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const preload = req.query.preload === 'true'; // Define preload from query params
    
    // Define a safe fallback for FOLDER_ID if it's not available
    const FOLDER_ID = process.env.FOLDER_ID || 'all-items';
    
    console.log(`[Photos] Loading from local disk for category: ${categoryId}`);
    
    // Always use localStorageService
    let allPhotos = [];
    try {
      allPhotos = await localStorageService.getPhotos(categoryId);
      console.log(`[Photos] Loaded ${allPhotos.length} photos from local storage`);
      
      // Ensure all photos have proper URL paths
      allPhotos = allPhotos.map(photo => ({
        ...photo,
        thumbnail: `/api/photos/local/thumbnail/${photo.id}`,
        highres: `/api/photos/local/${photo.folderId || categoryId}/${photo.id}`,
        source: 'local'
      }));
    } catch (error) {
      console.error('Error loading photos from local storage:', error);
      allPhotos = [];
    }
    
    // Ensure photosArray is always an array
    const photosArray = Array.isArray(allPhotos) ? allPhotos : [];
    
    console.log(`getPhotos - Obtained ${photosArray.length} photos for category ${categoryId}`);
    
    // If not a client, return photos without prices
    if (!customerCode) {
      // Apply pagination
      const paginatedPhotos = photosArray.slice(offset, offset + limit);
      return res.status(200).json(paginatedPhotos);
    }
    
    // Get default category prices
    const categoryPricesData = await CategoryPrice.find();
    console.log(`[DEBUG] Found ${categoryPricesData.length} prices in database`);
    const categoryPrices = {};
    
    categoryPricesData.forEach(price => {
      categoryPrices[price.folderId] = price.price || 0;
    });
    
    console.log(`[DEBUG] First 5 prices:`, Object.entries(categoryPrices).slice(0, 5));  
    console.log(`getPhotos - Obtained prices for ${Object.keys(categoryPrices).length} categories`);
    
    // Get client access settings
    const accessResult = await mongoService.getCustomerCategoryAccess(customerCode);
    console.log("getPhotos - Client access data:", accessResult);
    
    if (!accessResult.success) {
      console.log("getPhotos - Failed to get access, returning all photos without prices");
      // Apply pagination even in case of error
      const paginatedPhotos = photosArray.slice(offset, offset + limit);
      
      // Preload if requested
      if (preload && paginatedPhotos.length > 0) {
        preloadImages(paginatedPhotos.slice(0, 3));
      }
      
      return res.status(200).json(paginatedPhotos);
    }
    
    const accessData = accessResult.data || {};
    const categoryAccess = accessData.categoryAccess || [];
    
    console.log(`getPhotos - Client has ${categoryAccess.length} access configurations`);
    
    // Access map for quick lookup
    const accessMap = {};
    categoryAccess.forEach(item => {
      accessMap[item.categoryId] = item;
    });
    
    // If specific category is not accessible, return empty array
    // Except for "All Items" which should always show authorized photos
    if (categoryId !== FOLDER_ID && categoryId !== 'all-items' && categoryId && 
        accessMap[categoryId] && accessMap[categoryId].enabled === false) {
      console.log(`getPhotos - Category ${categoryId} is not accessible for client ${customerCode}`);
      return res.status(200).json([]);
    }
    
    // If it's the All Items category, filter only photos from authorized categories
    let filteredPhotos = photosArray;
    if (categoryId === FOLDER_ID || categoryId === 'all-items') {
      filteredPhotos = photosArray.filter(photo => {
        const folderIdToCheck = photo.folderId;
        
        // If there's no configuration for this folder, allow by default
        if (!accessMap[folderIdToCheck]) return true;
        
        // Check if authorized
        return accessMap[folderIdToCheck].enabled !== false;
      });
      
      console.log(`getPhotos - Filtered from ${photosArray.length} to ${filteredPhotos.length} authorized photos for All Items`);
    }
    
    // Apply pagination explicitly before returning
    const totalFiltered = filteredPhotos.length;
    const paginatedFiltered = filteredPhotos.slice(offset, offset + limit);
    
    console.log(`Total photos: ${totalFiltered}, Returning: ${paginatedFiltered.length} (offset ${offset}, limit ${limit})`);
    
    // Add price information to photos
    const photosWithPrice = paginatedFiltered.map(photo => {
      const categoryFolderId = photo.folderId || categoryId;
      
      // Default category price
      const defaultPrice = categoryPrices[categoryFolderId] || 0;
      
      // Category access settings
      const access = accessMap[categoryFolderId];
      
      // Custom price or default price
      const price = access && access.customPrice !== undefined && access.customPrice !== null 
        ? access.customPrice 
        : defaultPrice;
      
      // Discount information
      const minQuantityForDiscount = access ? access.minQuantityForDiscount : null;
      const discountPercentage = access ? access.discountPercentage : null;
      
      return {
        ...photo,
        price,
        defaultPrice,
        minQuantityForDiscount,
        discountPercentage
      };
    });
    
    // Preload if requested
    if (preload && photosWithPrice.length > 0) {
      // Preprocess the first 3-5 images
      const imagesToPreload = photosWithPrice.slice(0, 5);
      preloadImages(imagesToPreload);
    }
    
    console.log(`getPhotos - Returning ${photosWithPrice.length} photos with prices for client ${customerCode}`);
    res.status(200).json(photosWithPrice);

  } catch (error) {
    console.error('Error getting photos:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting photos: ' + error.message
    });
  }
};

// NOVA FUNÇÃO: Pré-processar imagens em background
async function preloadImages(photos) {
  if (!photos || photos.length === 0) return;
  
  console.log(`[Preload] Iniciando pré-processamento de ${photos.length} imagens`);
  
  // Processar em paralelo mas com limite
  const BATCH_SIZE = 3;
  
  for (let i = 0; i < photos.length; i += BATCH_SIZE) {
    const batch = photos.slice(i, i + BATCH_SIZE);
    
    // Processar batch em paralelo
    const promises = batch.map(async (photo) => {
      try {
        // Verificar se já está em cache
        if (processedImageCache.has(photo.id)) {
          console.log(`[Preload] Imagem ${photo.id} já está em cache`);
          return;
        }
        
        // Simular processamento (aqui você adicionaria a lógica real de conversão WebP)
        // Por agora, apenas marcamos como processada
        console.log(`[Preload] Processando imagem ${photo.id}`);
        
        // Aqui você adicionaria a lógica real de:
        // 1. Download da imagem do Google Drive
        // 2. Conversão para WebP com qualidade otimizada
        // 3. Armazenamento temporário
        
        // Adicionar ao cache
        processedImageCache.set(photo.id, {
          timestamp: Date.now(),
          processed: true,
          // Adicione aqui os dados da imagem processada
        });
        
      } catch (error) {
        console.error(`[Preload] Erro ao processar imagem ${photo.id}:`, error);
      }
    });
    
    // Aguardar o batch completar antes de continuar
    await Promise.all(promises);
  }
  
  console.log(`[Preload] Pré-processamento concluído`);
}

// NOVA FUNÇÃO: Endpoint para pré-carregar imagens específicas
exports.preloadImages = async (req, res) => {
  try {
    const { photoIds } = req.body;
    const customerCode = req.query.customer_code;
    
    if (!photoIds || !Array.isArray(photoIds)) {
      return res.status(400).json({
        success: false,
        message: 'photoIds array is required'
      });
    }
    
    console.log(`[API Preload] Solicitação para pré-carregar ${photoIds.length} imagens`);
    
    // Buscar informações das fotos
    const photos = [];
    for (const photoId of photoIds) {
      const photo = await driveService.getPhotoById(photoId);
      if (photo) {
        photos.push(photo);
      }
    }
    
    // Processar em background (não aguardar)
    preloadImages(photos);
    
    res.status(200).json({
      success: true,
      message: `Iniciado pré-carregamento de ${photos.length} imagens`
    });
    
  } catch (error) {
    console.error('Erro ao pré-carregar imagens:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao pré-carregar imagens: ' + error.message
    });
  }
};

// NOVA FUNÇÃO: Verificar status de imagem processada
exports.checkImageStatus = async (req, res) => {
  try {
    const { photoId } = req.params;
    
    // Verificar se está em cache
    const cached = processedImageCache.get(photoId);
    
    if (cached) {
      res.status(200).json({
        success: true,
        processed: true,
        cached: true
      });
    } else {
      res.status(200).json({
        success: true,
        processed: false,
        cached: false
      });
    }
    
  } catch (error) {
    console.error('Erro ao verificar status da imagem:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar status: ' + error.message
    });
  }
};

// FUNÇÃO COMPLETA PARA SUBSTITUIR exports.getCategories no photoController.js
exports.getCategories = async (req, res) => {
  try {
    console.log("getCategories - Requisição recebida:", {
      query: req.query,
      isAdmin: req.query.is_admin === 'true',
      customerCode: req.query.customer_code
    });
    
    const isAdmin = req.query.is_admin === 'true';
    const customerCode = req.query.customer_code;
    const useLeafFolders = !isAdmin && customerCode; // Use folhas para clientes
    
    // NOVA LÓGICA: Tentar local primeiro, fallback para Drive
    let categories = [];
    let source = 'local';
    
    try {
      console.log('[Categories] Tentando carregar do disco local...');
      categories = await localStorageService.getFolderStructure(isAdmin, useLeafFolders);
      
      if (!categories || categories.length === 0) {
        console.log('[Categories] Nenhuma categoria local, tentando Google Drive...');
        source = 'drive';
        categories = await driveService.getFolderStructure(isAdmin, useLeafFolders);
      } else {
        console.log(`[Categories] ${categories.length} categorias carregadas do disco local!`);
      }
    } catch (localError) {
      console.error('Erro ao buscar categorias localmente:', localError);
      source = 'drive';
      categories = await driveService.getFolderStructure(isAdmin, useLeafFolders);
    }
    
    // Garantir que categories é um array
    const categoriesArray = Array.isArray(categories) ? categories : [];
    
    console.log(`getCategories - Obtidas ${categoriesArray.length} categorias (isAdmin=${isAdmin}, source=${source})`);
    
    // Lista explícita de pastas administrativas (nomes exatos)
    const adminFolderNames = ['Waiting Payment', 'Sold', 'Developing'];
    
    // Filtrar pastas administrativas para todos os usuários
    let filteredCategories = categoriesArray.filter(category => {
      // Sempre manter "All Items" para todos
      if (category.isAll) return true;
      
      // Remover categorias administrativas para todos (inclusive admin)
      if (adminFolderNames.includes(category.name)) return false;
      
      // Para clientes regulares, verificar adicionalmente:
      if (!isAdmin) {
        // MODIFICAÇÃO: Verificação mais robusta - excluir categorias sem fotos
        if (!category.fileCount || category.fileCount <= 0) {
          console.log(`Excluindo categoria ${category.name} por não conter fotos (count=${category.fileCount})`);
          return false;
        }
      }
      
      return true; // Manter outras categorias
    });
    
    // Se não for um cliente, retornar categorias filtradas
    if (!customerCode) {
      return res.status(200).json(filteredCategories);
    }
    
    // Se for um cliente, obter suas configurações de acesso
    const accessResult = await mongoService.getCustomerCategoryAccess(customerCode);
    console.log("getCategories - Dados de acesso do cliente:", accessResult);
    console.log("getCategories - Dados de acesso completos:", JSON.stringify(accessResult));
    console.log("getCategories - Dados de acesso do cliente:", accessResult);
    
    if (!accessResult.success) {
      console.log("getCategories - Falha ao obter acesso, retornando todas categorias por padrão");
      // Retornar todas as categorias filtradas, não apenas All Items
      return res.status(200).json(filteredCategories); 
    }
    
    const accessData = accessResult.data || {};
    const categoryAccess = accessData.categoryAccess || [];
    
    console.log(`getCategories - Cliente tem ${categoryAccess.length} configurações de acesso`);
    
    // Criar um mapa para acesso rápido
    const accessMap = {};
    categoryAccess.forEach(item => {
      accessMap[item.categoryId] = item.enabled;
    });
    
    // Filtrar categorias que o cliente tem acesso E que têm fotos
    const accessFilteredCategories = filteredCategories.filter(category => {
      // Categoria "All Items" sempre habilitada
      if (category.isAll) return true;
      
      // MODIFICAÇÃO: Verificação redundante para garantir que a categoria tem arquivos
      if (!category.fileCount || category.fileCount === 0) return false;
      
      // CORREÇÃO: Se não tiver configuração específica, PERMITIR por padrão
      if (accessMap[category.id] === undefined) return true;
      
      // Usar configuração de acesso
      return accessMap[category.id];
    });
    
    console.log(`getCategories - Filtrando de ${filteredCategories.length} para ${accessFilteredCategories.length} categorias acessíveis`);
    
    res.status(200).json(accessFilteredCategories);
  } catch (error) {
    console.error('Erro ao obter categorias:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter categorias: ' + error.message
    });
  }
};

// FUNÇÃO COMPLETA PARA SUBSTITUIR exports.getClientInitialData no photoController.js
exports.getClientInitialData = async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Customer code is required'
      });
    }
    
    // LOG DE DIAGNÓSTICO
    console.log(`===== DEBUG: getClientInitialData para código ${code} =====`);
    
    // 1. Verificar código do cliente
    const customer = await mongoService.verifyCustomerCode(code);
    
    if (!customer.success) {
      console.log(`Cliente não encontrado: ${code}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid customer code'
      });
    }
    
    console.log(`Cliente verificado: ${customer.customerName}`);
    
    // 2. Obter configurações de acesso em paralelo
    const accessPromise = mongoService.getCustomerCategoryAccess(code);
    
    // 3. Obter preços das categorias em paralelo
    const pricesPromise = CategoryPrice.find();
    
    // 4. MODIFICADO: Obter pastas folha com fallback para local/drive
    const foldersPromise = (async () => {
      try {
        // Tentar local primeiro
        console.log('[InitialData] Tentando carregar categorias do disco local...');
        const localFolders = await localStorageService.getFolderStructure(false, true);
        if (localFolders && localFolders.length > 0) {
          console.log(`[InitialData] ${localFolders.length} categorias carregadas do disco local!`);
          // Formatar para compatibilidade
          return { 
            success: true, 
            folders: localFolders.filter(f => !f.isAll) // Remover "All Items" das pastas
          };
        }
      } catch (e) {
        console.log('[InitialData] Erro ao carregar local, tentando Google Drive...');
      }
      // Fallback para Drive
      return driveService.getAllLeafFoldersCached();
    })();
    
    // Aguardar todas as promessas
    const [accessResult, pricesData, foldersResult] = await Promise.all([
      accessPromise, pricesPromise, foldersPromise
    ]);
    
    // Processar resultados
    const accessData = accessResult.success ? accessResult.data : { categoryAccess: [] };
    
    // Criar mapa de acesso
    const accessMap = {};
    if (accessData.categoryAccess && Array.isArray(accessData.categoryAccess)) {
      accessData.categoryAccess.forEach(item => {
        if (item && item.categoryId) {
          accessMap[item.categoryId] = item;
        }
      });
      
      console.log("Mapa de acesso criado com sucesso, contendo as seguintes configurações:", 
        Object.keys(accessMap).map(key => ({
          id: key,
          enabled: accessMap[key].enabled
        }))
      );
    } else {
      console.log("AVISO: Não há configurações de acesso ou o formato é inválido:", accessData);
    }
    
    // LOG: Mostrar dados brutos de acesso para depuração
    console.log("Dados brutos de acesso:", JSON.stringify(accessData));
    
    // Processar preços
    const categoryPrices = {};
    pricesData.forEach(price => {
      categoryPrices[price.folderId] = {
        folderId: price.folderId,
        name: price.name,
        price: price.price,
        path: price.path || ''
      };
    });
    
    // Filtrar pastas permitidas
    const folders = foldersResult.success ? foldersResult.folders : [];
    console.log(`Total de pastas encontradas: ${folders.length}`);
    
    // Lista explícita de pastas administrativas (nomes exatos)
    const adminFolderNames = ["Waiting Payment", "Sold", "Developing"];
    
    // MODIFICADO: Filtrar pastas administrativas e pastas sem fotos
    const allowedCategories = folders.filter(folder => {
      // Verificar se é uma pasta administrativa (pelo nome)
      if (adminFolderNames.includes(folder.name)) {
        console.log(`Categoria ${folder.name} excluída por ser administrativa`);
        return false;
      }
      
      // MODIFICADO: Verificação para fileCount primeiro
      if (!folder.fileCount || folder.fileCount <= 0) {
        console.log(`Excluindo categoria ${folder.name} por estar vazia (fileCount=${folder.fileCount})`);
        return false;
      }
      
      // CORREÇÃO CRÍTICA: Verificar se tem uma configuração de acesso e se está habilitada
      const access = accessMap[folder.id];
      
      // Verificação robusta do objeto de acesso
      if (access) {
        console.log(`Verificando acesso para ${folder.name}: access.enabled=${access.enabled}`);
        
        // Se tem configuração, usar ela
        const isAllowed = access.enabled === true;
        console.log(`Categoria ${folder.name}: configuração encontrada, enabled=${access.enabled}, permitida=${isAllowed}`);
        return isAllowed;
      } else {
        // 🆕 CORREÇÃO: SEM configuração = NEGAR acesso (antes era permitir)
        console.log(`Categoria ${folder.name}: sem configuração, negando acesso`);
        return false;
      }
    });
    
    console.log(`Categorias permitidas após filtragem: ${allowedCategories.length}`);
    allowedCategories.forEach(cat => console.log(`- ${cat.name}`));
    
    // Obter previews para as primeiras 4 categorias (limite para carga inicial)
    const previews = {};
    const previewPromises = [];
    
    // Limitamos a 4 categorias ou menos para a carga inicial rápida
    const categoriesToPreload = allowedCategories.slice(0, 4);
    console.log(`Pré-carregando ${categoriesToPreload.length} categorias`);
    
    for (const category of categoriesToPreload) {
      // MODIFICADO: Tentar local primeiro, depois Drive
      const promise = (async () => {
        let photos = [];
        try {
          // Tentar local
          photos = await localStorageService.getPhotos(category.id);
          if (photos.length === 0) {
            // Fallback para Drive
            photos = await driveService.getPhotosCached(category.id);
          }
        } catch (e) {
          // Em caso de erro, tentar Drive
          photos = await driveService.getPhotosCached(category.id);
        }
        
        console.log(`Obtidas ${photos.length} fotos para categoria ${category.name}`);
        
        // Processar preços para as fotos
        const photosWithPrice = photos.map(photo => {
          const defaultPrice = categoryPrices[category.id] ? categoryPrices[category.id].price || 0 : 0;
          const access = accessMap[category.id];
          
          // Preço personalizado ou preço padrão
          const price = access && access.customPrice !== undefined && access.customPrice !== null 
            ? access.customPrice 
            : defaultPrice;
            
          return {
            ...photo,
            price
          };
        });
        
        // Armazenar apenas os primeiros 6 itens para cada categoria
        previews[category.id] = photosWithPrice.slice(0, 6);
        
        // NOVO: Pré-processar as primeiras 3 imagens de cada categoria
        if (photosWithPrice.length > 0) {
          preloadImages(photosWithPrice.slice(0, 3));
        }
      })();
      
      previewPromises.push(promise);
    }
    
    // Aguardar previews
    await Promise.all(previewPromises);
    
    // Retornar apenas as categorias específicas
    const categories = allowedCategories.map(cat => ({
      id: cat.id,
      name: cat.name,
      path: cat.path || [],
      fullPath: cat.fullPath || cat.name,
      isAll: false,
      isLeaf: true,
      fileCount: cat.fileCount
    }));
    
    console.log(`Total de ${categories.length} categorias sendo retornadas ao cliente`);
    
    // Retornar todos os dados combinados
    return res.status(200).json({
      success: true,
      customer: {
        code: customer.code,
        name: customer.customerName
      },
      categories: categories,
      accessMap: accessMap,
      prices: categoryPrices,
      previews: previews
    });
  } catch (error) {
    console.error('Error getting client initial data:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// NOVA FUNÇÃO: Limpar cache do servidor - MOVIDA PARA FORA DE getClientInitialData
exports.clearCache = async (req, res) => {
  try {
    // Limpar todos os caches
    driveService.clearAllCaches();
    
    // Limpar cache de imagens processadas
    processedImageCache.clear();
    
    res.status(200).json({
      success: true,
      message: 'Cache limpo com sucesso'
    });
  } catch (error) {
    console.error('Erro ao limpar cache:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao limpar cache: ' + error.message
    });
  }
};

// Nova função para salvar seleções do cliente
exports.saveCustomerSelections = async (req, res) => {
  try {
    const { code, items } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Customer code is required'
      });
    }
    
    // Usar mongoService para salvar
    const result = await mongoService.saveCustomerSelections(code, items || []);
    
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Error saving customer selections:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving customer selections: ' + error.message
    });
  }
};

// Serve imagem do disco local (thumb ou full)
exports.serveLocalImage = async (req, res) => {
  try {
    const { categoryId, photoId } = req.params;
    const buffer = await localStorageService.getImage(categoryId, photoId);
    res.type('image/webp').send(buffer);
  } catch (err) {
    res.status(404).send('Imagem não encontrada');
  }
};

// Pasta: estrutura de pastas
exports.getFolderStructure = async (req, res) => {
  const data = await localStorageService.getFolderStructure(req.query.is_admin==='true', true);
  res.json(data);
};

// CRUD de pastas
exports.createFolder = async (req, res) => {
  const { parentId, name } = req.body;
  const result = await localStorageService.createFolder(parentId, name);
  res.json(result);
};
exports.deleteFolder = async (req, res) => {
  const { folderId } = req.body;
  const result = await localStorageService.deleteFolder(folderId);
  res.json(result);
};
exports.renameFolder = async (req, res) => {
  const { folderId, newName } = req.body;
  const result = await localStorageService.renameFolder(folderId, newName);
  res.json(result);
};

// CRUD de fotos
exports.movePhoto = async (req, res) => {
  const { photoId, toFolderId } = req.body;
  const result = await localStorageService.movePhoto(photoId, toFolderId);
  res.json(result);
};
exports.deletePhoto = async (req, res) => {
  const { photoId } = req.body;
  const result = await localStorageService.deletePhoto(photoId);
  res.json(result);
};