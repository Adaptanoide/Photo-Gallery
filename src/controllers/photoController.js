const driveService = require('../services/driveService');
const { db } = require('../config/firebase');
const firebaseService = require('../services/firebaseService');
// Adicionar acesso à constante FOLDER_ID
const { FOLDER_ID } = process.env;

// Obter fotos
exports.getPhotos = async (req, res) => {
  try {
    console.log("getPhotos - Requisição recebida:", {
      query: req.query,
      categoryId: req.query.category_id,
      customerCode: req.query.customer_code
    });
    
    const categoryId = req.query.category_id || null;
    const customerCode = req.query.customer_code;
    
    // MODIFICADO: Obter todas as fotos da categoria (usando cache)
    const photos = await driveService.getPhotosCached(categoryId);
    
    // Garantir que photos é um array, mesmo se a resposta for null/undefined
    const photosArray = Array.isArray(photos) ? photos : [];
    
    console.log(`getPhotos - Obtidas ${photosArray.length} fotos da categoria ${categoryId}`);
    
    // Se não for um cliente, retornar fotos sem preços
    if (!customerCode) {
      return res.status(200).json(photosArray);
    }
    
    // Obter preços padrão das categorias
    const categoryPricesSnapshot = await db.collection('categoryPrices').get();
    const categoryPrices = {};
    
    categoryPricesSnapshot.forEach(doc => {
      categoryPrices[doc.id] = doc.data().price || 0;
    });
    
    console.log(`getPhotos - Obtidos preços para ${Object.keys(categoryPrices).length} categorias`);
    
    // Obter configurações de acesso do cliente
    const accessResult = await firebaseService.getCustomerCategoryAccess(customerCode);
    console.log("getPhotos - Dados de acesso do cliente:", accessResult);
    
    if (!accessResult.success) {
      console.log("getPhotos - Falha ao obter acesso, retornando todas as fotos sem preços");
      return res.status(200).json(photosArray); // Retornar fotos sem preços se houver erro
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
    
    // Adicionar informações de preço às fotos
    const photosWithPrice = filteredPhotos.map(photo => {
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
    const categories = await driveService.getFolderStructure(isAdmin, useLeafFolders);
    
    // Garantir que categories é um array
    const categoriesArray = Array.isArray(categories) ? categories : [];
    
    console.log(`getCategories - Obtidas ${categoriesArray.length} categorias (isAdmin=${isAdmin})`);
    
    // Lista explícita de pastas administrativas (nomes exatos)
    const adminFolderNames = ['Waiting Payment', 'Sold', 'Developing'];
    
    // Filtrar pastas administrativas para todos os usuários
    const filteredCategories = categoriesArray.filter(category => {
      // Sempre manter "All Items" para todos
      if (category.isAll) return true;
      
      // Remover categorias administrativas para todos (inclusive admin)
      if (adminFolderNames.includes(category.name)) return false;
      
      // Para clientes regulares, verificar adicionalmente:
      if (!isAdmin) {
        // Apenas incluir categorias com fotos
        if (category.isLeaf && category.fileCount && category.fileCount > 0) {
          return true;
        } else if (category.isLeaf) {
          return false; // Não mostrar categorias folha vazias para clientes
        }
      }
      
      return true; // Manter outras categorias
    });
    
    // Se não for um cliente, retornar categorias filtradas
    if (!customerCode) {
      return res.status(200).json(filteredCategories);
    }
    
    // Se for um cliente, obter suas configurações de acesso
    const accessResult = await firebaseService.getCustomerCategoryAccess(customerCode);
    console.log("getCategories - Dados de acesso do cliente:", accessResult);
    
    if (!accessResult.success) {
      console.log("getCategories - Falha ao obter acesso, retornando apenas All Items");
      return res.status(200).json(filteredCategories.filter(category => category.isAll)); 
    }
    
    const accessData = accessResult.data || {};
    const categoryAccess = accessData.categoryAccess || [];
    
    console.log(`getCategories - Cliente tem ${categoryAccess.length} configurações de acesso`);
    
    // Criar um mapa para acesso rápido
    const accessMap = {};
    categoryAccess.forEach(item => {
      accessMap[item.categoryId] = item.enabled;
    });
    
    // Filtrar categorias que o cliente tem acesso
    const accessFilteredCategories = filteredCategories.filter(category => {
      // Categoria "All Items" sempre habilitada
      if (category.isAll) return true;
      
      // MODIFICAÇÃO: Se não tiver configuração específica, NEGAR por padrão
      if (accessMap[category.id] === undefined) return false;
      
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
    
    // 1. Verificar código do cliente
    const customer = await firebaseService.verifyCustomerCode(code);
    
    if (!customer.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer code'
      });
    }
    
    // 2. Obter configurações de acesso em paralelo
    const accessPromise = firebaseService.getCustomerCategoryAccess(code);
    
    // 3. Obter preços das categorias em paralelo
    const pricesPromise = db.collection('categoryPrices').get();
    
    // 4. Obter pastas folha em paralelo (com cache)
    const foldersPromise = driveService.getAllLeafFoldersCached();
    
    // Aguardar todas as promessas
    const [accessResult, pricesSnapshot, foldersResult] = await Promise.all([
      accessPromise, pricesPromise, foldersPromise
    ]);
    
    // Processar resultados
    const accessData = accessResult.success ? accessResult.data : { categoryAccess: [] };
    
    // Criar mapa de acesso
    const accessMap = {};
    accessData.categoryAccess.forEach(item => {
      accessMap[item.categoryId] = item;
    });
    
    // Processar preços
    const categoryPrices = {};
    pricesSnapshot.forEach(doc => {
      categoryPrices[doc.id] = doc.data();
    });
    
    // Filtrar pastas permitidas
    const folders = foldersResult.success ? foldersResult.folders : [];
    
    // Lista explícita de pastas administrativas (nomes exatos)
    const adminFolderNames = ['Waiting Payment', 'Sold', 'Developing'];
    
    // MODIFICADO: Filtrar pastas administrativas e pastas sem fotos
    const allowedCategories = folders.filter(folder => {
      // Verificar se é uma pasta administrativa (pelo nome)
      if (adminFolderNames.includes(folder.name)) {
        return false;
      }
      
      // Verificar se tem uma configuração de acesso e se está habilitada
      const access = accessMap[folder.id];
      if (access && access.enabled === false) {
        return false;
      }
      
      // NOVO: Verificar se tem fotos (fileCount > 0)
      if (!folder.fileCount || folder.fileCount <= 0) {
        return false;
      }
      
      return true;
    });
    
    // Obter previews para as primeiras 4 categorias (limite para carga inicial)
    const previews = {};
    const previewPromises = [];
    
    // Limitamos a 4 categorias ou menos para a carga inicial rápida
    const categoriesToPreload = allowedCategories.slice(0, 4);
    
    for (const category of categoriesToPreload) {
      const promise = driveService.getPhotosCached(category.id)
        .then(photos => {
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
        });
      
      previewPromises.push(promise);
    }
    
    // Aguardar previews
    await Promise.all(previewPromises);
    
    // Adicionar categoria All Items
    const categories = [
      {
        id: FOLDER_ID,
        name: "All Items",
        isAll: true,
        isLeaf: false
      },
      ...allowedCategories.map(cat => ({
        id: cat.id,
        name: cat.name,
        path: cat.path || [],
        fullPath: cat.fullPath || cat.name,
        isAll: false,
        isLeaf: true,
        fileCount: cat.fileCount
      }))
    ];
    
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