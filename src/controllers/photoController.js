// photoController.js
const driveService = require('../services/driveService');
const mongoService = require('../services/mongoService');
const CategoryPrice = require('../models/categoryPrice');
const CustomerCode = require('../models/customerCode');
const CategoryAccess = require('../models/categoryAccess');
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
exports.getPhotos = async (req, res) => {
  try {
    // Log detalhado para depuração
    console.log("===== REQUISIÇÃO DE FOTOS =====");
    console.log("Query params:", req.query);
    
    const categoryId = req.query.category_id || null;
    const customerCode = req.query.customer_code;
    const limit = parseInt(req.query.limit) || 50; // Padrão: 50 fotos
    const offset = parseInt(req.query.offset) || 0;
    const preload = req.query.preload === 'true'; // Nova flag para pré-carregamento
    
    console.log(`Parâmetros de paginação: limit=${limit}, offset=${offset}, preload=${preload}`);
    
    // MODIFICADO: Obter todas as fotos da categoria (usando cache)
    const allPhotos = await driveService.getPhotosCached(categoryId);
    
    // Garantir que photos é um array, mesmo se a resposta for null/undefined
    const photosArray = Array.isArray(allPhotos) ? allPhotos : [];
    
    console.log(`getPhotos - Obtidas ${photosArray.length} fotos da categoria ${categoryId}`);
    
    // Se não for um cliente, retornar fotos sem preços
    if (!customerCode) {
      // Aplicar paginação
      const paginatedPhotos = photosArray.slice(offset, offset + limit);
      
      // NOVO: Se for pré-carregamento, processar imagens em background
      if (preload && paginatedPhotos.length > 0) {
        preloadImages(paginatedPhotos.slice(0, 3)); // Pré-processar primeiras 3 imagens
      }
      
      return res.status(200).json(paginatedPhotos);
    }
    
    // Obter preços padrão das categorias
    const categoryPricesData = await CategoryPrice.find();
    const categoryPrices = {};
    
    categoryPricesData.forEach(price => {
      categoryPrices[price.folderId] = price.price || 0;
    });
    
    console.log(`getPhotos - Obtidos preços para ${Object.keys(categoryPrices).length} categorias`);
    
    // Obter configurações de acesso do cliente
    const accessResult = await mongoService.getCustomerCategoryAccess(customerCode);
    console.log("getPhotos - Dados de acesso do cliente:", accessResult);
    
    if (!accessResult.success) {
      console.log("getPhotos - Falha ao obter acesso, retornando todas as fotos sem preços");
      // Aplicar paginação mesmo em caso de erro
      const paginatedPhotos = photosArray.slice(offset, offset + limit);
      
      // NOVO: Pré-carregamento se solicitado
      if (preload && paginatedPhotos.length > 0) {
        preloadImages(paginatedPhotos.slice(0, 3));
      }
      
      return res.status(200).json(paginatedPhotos);
    }
    
    const accessData = accessResult.data || {};
    const categoryAccess = accessData.categoryAccess || [];
    
    console.log(`getPhotos - Cliente tem ${categoryAccess.length} configurações de acesso`);
    
    // Mapa de acesso para consulta rápida
    const accessMap = {};
    categoryAccess.forEach(item => {
      accessMap[item.categoryId] = item;
    });
    
    // Se a categoria específica não está acessível, retornar array vazio
    // Exceto para "All Items" que sempre deve mostrar fotos autorizadas
    if (categoryId !== FOLDER_ID && categoryId && accessMap[categoryId] && accessMap[categoryId].enabled === false) {
      console.log(`getPhotos - Categoria ${categoryId} não está acessível para o cliente ${customerCode}`);
      return res.status(200).json([]);
    }
    
    // Se for a categoria All Items, filtre apenas fotos de categorias autorizadas
    let filteredPhotos = photosArray;
    if (categoryId === FOLDER_ID) {
      filteredPhotos = photosArray.filter(photo => {
        const folderIdToCheck = photo.folderId;
        
        // Se não houver configuração para esta pasta, permite por padrão
        if (!accessMap[folderIdToCheck]) return true;
        
        // Verifica se está autorizado
        return accessMap[folderIdToCheck].enabled !== false;
      });
      
      console.log(`getPhotos - Filtradas de ${photosArray.length} para ${filteredPhotos.length} fotos autorizadas para All Items`);
    }
    
    // IMPORTANTE: Aplicar paginação explicitamente antes de retornar
    const totalFiltered = filteredPhotos.length;
    const paginatedFiltered = filteredPhotos.slice(offset, offset + limit);
    
    console.log(`Total de fotos: ${totalFiltered}, Retornando: ${paginatedFiltered.length} (offset ${offset}, limit ${limit})`);
    
    // Adicionar informações de preço às fotos
    const photosWithPrice = paginatedFiltered.map(photo => {
      const categoryFolderId = photo.folderId || categoryId;
      
      // Preço padrão da categoria
      const defaultPrice = categoryPrices[categoryFolderId] || 0;
      
      // Configurações de acesso à categoria
      const access = accessMap[categoryFolderId];
      
      // Preço personalizado ou preço padrão
      const price = access && access.customPrice !== undefined && access.customPrice !== null 
        ? access.customPrice 
        : defaultPrice;
      
      // Informações de desconto
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
    
    // NOVO: Se for pré-carregamento, processar imagens em background
    if (preload && photosWithPrice.length > 0) {
      // Pré-processar as primeiras 3-5 imagens
      const imagesToPreload = photosWithPrice.slice(0, 5);
      preloadImages(imagesToPreload);
    }
    
    console.log(`getPhotos - Retornando ${photosWithPrice.length} fotos com preços para o cliente ${customerCode}`);
    res.status(200).json(photosWithPrice);

  } catch (error) {
    console.error('Erro ao obter fotos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter fotos: ' + error.message
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

// Modificação na função getCategories em photoController.js
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
    
    // Obter todas as categorias
    let categories = await driveService.getFolderStructure(isAdmin, useLeafFolders);
    
    // Garantir que categories é um array
    const categoriesArray = Array.isArray(categories) ? categories : [];
    
    console.log(`getCategories - Obtidas ${categoriesArray.length} categorias (isAdmin=${isAdmin})`);
    
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

// NOVA FUNÇÃO: Obter dados iniciais do cliente
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
    
    // 4. Obter pastas folha em paralelo (com cache)
    const foldersPromise = driveService.getAllLeafFoldersCached();
    
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
      
      // CORREÇÃO CRÍTICA: Verificar se tem uma configuração de acesso e se está habilitada
      const access = accessMap[folder.id];
      
      // Verificação robusta do objeto de acesso
      if (access) {
        console.log(`Verificando acesso para ${folder.name}: access.enabled=${access.enabled}`);
        
        // AQUI ESTÁ O BUG: precisamos verificar se é EXPLICITAMENTE false
        if (access.enabled === false) {
          console.log(`Categoria ${folder.name} negada explicitamente`);
          return false;
        }
      } else {
        console.log(`Sem configuração de acesso para ${folder.name}, permitindo por padrão`);
      }
      
      // MODIFICADO: Verificação mais robusta para fileCount
      if (!folder.fileCount || folder.fileCount <= 0) {
        console.log(`Excluindo categoria ${folder.name} por estar vazia (fileCount=${folder.fileCount})`);
        return false;
      }
      
      // CORREÇÃO: Por padrão, permitir acesso (incluir a categoria)
      return true;
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
      const promise = driveService.getPhotosCached(category.id)
        .then(photos => {
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
        });
      
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
