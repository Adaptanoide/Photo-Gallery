//src/services/SpecialSelectionService.js

const mongoose = require('mongoose');
const Selection = require('../models/Selection');
const AccessCode = require('../models/AccessCode');
const PhotoStatus = require('../models/PhotoStatus');

class SpecialSelectionService {

    // ===== CRIAR NOVA SELEÇÃO ESPECIAL =====

    /**
     * Criar uma nova seleção especial
     */
    static async createSpecialSelection(selectionData, adminUser) {
        const session = await mongoose.startSession();

        try {
            return await session.withTransaction(async () => {
                console.log(`🎯 Criando seleção especial para cliente ${selectionData.clientCode}...`);

                // 1. Validar dados básicos
                if (!selectionData.clientCode || !selectionData.selectionName) {
                    throw new Error('Código do cliente e nome da seleção são obrigatórios');
                }

                // 2. Verificar se cliente existe
                const existingAccessCode = await AccessCode.findOne({
                    code: selectionData.clientCode
                }).session(session);

                if (!existingAccessCode) {
                    throw new Error(`Cliente com código ${selectionData.clientCode} não encontrado`);
                }

                // 3. Gerar IDs únicos
                const selectionId = Selection.generateSpecialSelectionId();
                const sessionId = `special_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                // 4. Criar referência virtual para seleção especial (R2 usa prefixos)
                const driveResult = {
                    success: true,
                    folderId: `special-${selectionId}`,
                    folderName: `${existingAccessCode.clientName}_${new Date().toISOString().split('T')[0]}`,
                    folderPath: `special-selections/${selectionData.clientCode}/${selectionId}`
                };
                console.log('📁 [R2] Referência de seleção criada (sem pasta física)');

                // 5. Criar documento de seleção especial
                const specialSelection = new Selection({
                    selectionId: selectionId,
                    sessionId: sessionId,
                    clientCode: selectionData.clientCode,
                    clientName: existingAccessCode.clientName,
                    clientEmail: existingAccessCode.clientEmail,

                    // Definir como seleção especial
                    selectionType: 'special',

                    // Configurações específicas da seleção especial
                    specialSelectionConfig: {
                        selectionName: selectionData.selectionName,
                        description: selectionData.description || '',

                        pricingConfig: {
                            showPrices: selectionData.showPrices !== false,
                            allowGlobalDiscount: selectionData.allowGlobalDiscount || false,
                            globalDiscountPercent: selectionData.globalDiscountPercent || 0
                        },

                        quantityDiscounts: {
                            enabled: selectionData.quantityDiscountsEnabled || false,
                            rules: selectionData.quantityDiscountRules || []
                        },

                        accessConfig: {
                            isActive: false, // Inicia inativa até ser configurada
                            expiresAt: selectionData.expiresAt || null,
                            restrictedAccess: true
                        }
                    },

                    // ✅ NOVO: Informações do Google Drive
                    googleDriveInfo: {
                        specialSelectionInfo: {
                            specialFolderId: driveResult.folderId,
                            specialFolderName: driveResult.folderName,
                            folderPath: driveResult.folderPath
                        }
                    },


                    // Informações do Google Drive
                    googleDriveInfo: {
                        clientFolderId: driveResult.folderId,
                        clientFolderName: driveResult.folderName,
                        clientFolderPath: driveResult.folderPath,
                        specialSelectionInfo: {
                            specialFolderId: driveResult.folderId,
                            specialFolderName: driveResult.folderName,
                            originalPhotosBackup: []
                        }
                    },

                    // Status inicial
                    status: 'pending',
                    items: [],
                    customCategories: [],
                    totalItems: 0,
                    totalValue: 0,

                    // Metadados
                    createdBy: adminUser,
                    processedBy: adminUser
                });

                // 6. Adicionar log inicial
                specialSelection.addMovementLog(
                    'special_selection_created',
                    `Seleção especial criada: ${selectionData.selectionName}`,
                    true,
                    null,
                    {
                        selectionName: selectionData.selectionName,
                        adminUser: adminUser,
                        clientCode: selectionData.clientCode,
                        googleDriveFolderId: driveResult.folderId
                    }
                );

                // 7. Salvar seleção
                console.log('🔍 STATUS ANTES DO SAVE:', specialSelection.status);
                await specialSelection.save({ session });
                console.log('🔍 STATUS DEPOIS DO SAVE:', specialSelection.status);

                console.log(`✅ Seleção especial criada: ${selectionId}`);

                return {
                    success: true,
                    selectionId: selectionId,
                    selection: specialSelection,
                    googleDriveInfo: driveResult,
                    message: 'Seleção especial criada com sucesso'
                };
            });

        } catch (error) {
            console.error('❌ Erro ao criar seleção especial:', error);
            throw error;
        } finally {
            await session.endSession();
        }
    }

    // ===== GERENCIAR CATEGORIAS CUSTOMIZADAS =====

    /**
     * Adicionar categoria customizada à seleção especial
     */
    static async addCustomCategory(selectionId, categoryData, adminUser) {
        try {
            console.log(`📁 Adicionando categoria customizada à seleção ${selectionId}...`);

            const selection = await Selection.findOne({
                selectionId: selectionId,
                selectionType: 'special'
            });

            if (!selection) {
                throw new Error('Seleção especial não encontrada');
            }

            // ✅ NOVO: Criar pasta da categoria no Google Drive
            const selectionFolderId = selection.googleDriveInfo.specialSelectionInfo.specialFolderId;

            const driveResult = {
                success: true,
                categoryFolderId: `category-${Date.now()}`,
                categoryFolderName: categoryData.categoryName
            };
            console.log('📁 [R2] Categoria virtual criada:', categoryData.categoryName);

            if (!driveResult.success) {
                throw new Error(`Erro ao criar pasta no Google Drive: ${driveResult.error}`);
            }

            // Adicionar categoria customizada com ID da pasta
            const categoryId = selection.addCustomCategory({
                categoryName: categoryData.categoryName,
                categoryDisplayName: categoryData.categoryDisplayName,
                baseCategoryPrice: categoryData.baseCategoryPrice || 0,
                originalCategoryInfo: categoryData.originalCategoryInfo || {},
                // ✅ NOVO: Salvar ID da pasta no Google Drive
                googleDriveFolderId: driveResult.categoryFolderId,
                googleDriveFolderName: driveResult.categoryFolderName
            });

            await selection.save();

            console.log(`✅ Categoria customizada adicionada: ${categoryData.categoryName}`);
            console.log(`📁 Pasta criada no Google Drive: ${driveResult.categoryFolderId}`);

            return {
                success: true,
                categoryId: categoryId,
                categoryName: categoryData.categoryName,
                googleDriveFolderId: driveResult.categoryFolderId,
                message: 'Categoria customizada adicionada com sucesso'
            };

        } catch (error) {
            console.error('❌ Erro ao adicionar categoria customizada:', error);
            throw error;
        }
    }

    /**
     * Remover categoria customizada
     */
    static async removeCustomCategory(selectionId, categoryId, adminUser) {
        const session = await mongoose.startSession();

        try {
            return await session.withTransaction(async () => {
                console.log(`🗑️ Removendo categoria ${categoryId} da seleção ${selectionId}...`);

                const selection = await Selection.findOne({
                    selectionId: selectionId,
                    selectionType: 'special'
                }).session(session);

                if (!selection) {
                    throw new Error('Seleção especial não encontrada');
                }

                const category = selection.customCategories.find(cat => cat.categoryId === categoryId);
                if (!category) {
                    throw new Error('Categoria não encontrada');
                }

                // Se categoria tem fotos, devolver para estoque original
                if (category.photos && category.photos.length > 0) {
                    for (const photo of category.photos) {
                        await this.returnPhotoToOriginalLocation(photo.photoId, adminUser, session);
                    }
                }

                // Remover categoria
                selection.customCategories = selection.customCategories.filter(cat => cat.categoryId !== categoryId);

                // Adicionar log
                selection.addMovementLog(
                    'category_removed',
                    `Categoria customizada removida: ${category.categoryName}`,
                    true,
                    null,
                    { categoryId, categoryName: category.categoryName, adminUser }
                );

                await selection.save({ session });

                console.log(`✅ Categoria removida: ${category.categoryName}`);

                return {
                    success: true,
                    message: 'Categoria removida com sucesso'
                };
            });

        } catch (error) {
            console.error('❌ Erro ao remover categoria:', error);
            throw error;
        } finally {
            await session.endSession();
        }
    }

    // ===== GERENCIAR FOTOS =====

    /**
     * Mover foto para categoria customizada
     */
    static async movePhotoToCustomCategory(selectionId, photoData, categoryId, adminUser) {
        const session = await mongoose.startSession();

        try {
            return await session.withTransaction(async () => {
                console.log(`📸 Movendo foto ${photoData.fileName} para categoria ${categoryId}...`);

                // 1. Buscar seleção especial
                const selection = await Selection.findOne({
                    selectionId: selectionId,
                    selectionType: 'special'
                }).session(session);

                if (!selection) {
                    throw new Error('Seleção especial não encontrada');
                }

                // 2. Verificar se categoria existe
                const category = selection.customCategories.find(cat => cat.categoryId === categoryId);
                if (!category) {
                    throw new Error('Categoria customizada não encontrada');
                }

                // ✅ VERIFICAR SE CATEGORIA TEM PASTA NO GOOGLE DRIVE
                if (!category.googleDriveFolderId) {
                    // Se não tem, criar agora (fallback para categorias antigas)
                    console.log('⚠️ Categoria sem pasta do Google Drive, criando...');

                    const selectionFolderId = selection.googleDriveInfo.specialSelectionInfo.specialFolderId;
                    const driveResult = {
                        success: true,
                        categoryFolderId: `category-${Date.now()}`,
                        categoryFolderName: category.categoryName
                    };
                    console.log('📁 [R2] Categoria virtual criada:', category.categoryName);

                    if (driveResult.success) {
                        category.googleDriveFolderId = driveResult.categoryFolderId;
                        category.googleDriveFolderName = driveResult.categoryFolderName;
                        await selection.save({ session });
                    } else {
                        throw new Error('Erro ao criar pasta da categoria no Google Drive');
                    }
                }

                // 3. Verificar/criar status da foto
                let photoStatus = await PhotoStatus.findOne({ photoId: photoData.photoId }).session(session);

                if (!photoStatus) {
                    photoStatus = PhotoStatus.createForPhoto({
                        photoId: photoData.photoId,
                        fileName: photoData.fileName,
                        currentPath: photoData.originalPath,
                        currentParentId: photoData.originalParentId,
                        currentCategory: photoData.originalCategory,
                        currentPrice: photoData.originalPrice || 0
                    });
                }

                // 4. Verificar se foto está disponível
                if (!photoStatus.isAvailable()) {
                    const reason = photoStatus.isLocked() ? 'está bloqueada por outro admin' :
                        photoStatus.isReserved() ? 'está reservada por um cliente' :
                            photoStatus.isSold() ? 'já foi vendida' : 'não está disponível';
                    throw new Error(`A foto ${photoData.fileName} ${reason}`);
                }

                // 5. Bloquear foto temporariamente
                photoStatus.lock(adminUser, 'moving', 30);

                // ✅ 6. SISTEMA DE TAGS: Marcar foto na categoria (SEM MOVER!)
                console.log(`🏷️ [TAGS] Marcando foto ${photoData.fileName} na categoria ${category.categoryName}`);

                // Criar resultado fake para compatibilidade
                const driveResult = {
                    success: true,
                    photoId: photoData.photoId,
                    photoName: photoData.fileName,
                    categoryFolderId: category.googleDriveFolderId,
                    categoryName: category.categoryName,
                    oldParent: 'original_location',
                    newParent: category.googleDriveFolderId,
                    originalHierarchicalPath: photoData.sourcePath || 'unknown'
                };

                console.log(`✅ [TAGS] Foto marcada com tag: special_${category.categoryName}`);
                console.log('📁 [TAGS] Nenhuma movimentação física realizada!');

                // 7. Adicionar backup da localização original
                if (!selection.googleDriveInfo.specialSelectionInfo.originalPhotosBackup) {
                    selection.googleDriveInfo.specialSelectionInfo.originalPhotosBackup = [];
                }

                selection.googleDriveInfo.specialSelectionInfo.originalPhotosBackup.push({
                    photoId: photoData.photoId,
                    originalPath: photoData.sourcePath || 'Caminho desconhecido',
                    originalParentId: photoData.originalParentId || null,
                    sourceCategory: photoData.sourceCategory || 'Categoria desconhecida'
                });

                // 8. Atualizar status da foto
                photoStatus.moveTo({
                    locationType: 'special_selection',
                    currentPath: `Special Selections/${selection.googleDriveInfo.clientFolderName}/${category.categoryName}`,
                    currentParentId: category.googleDriveFolderId,  // ← PASTA DA CATEGORIA!
                    currentCategory: category.categoryName,
                    specialSelectionId: selection._id
                }, adminUser, 'admin');

                // 9. Aplicar preço customizado se especificado
                if (photoData.customPrice && photoData.customPrice > 0) {
                    photoStatus.updatePrice(photoData.customPrice, 'special_selection', adminUser);
                } else if (category.baseCategoryPrice > 0) {
                    photoStatus.updatePrice(category.baseCategoryPrice, 'special_selection', adminUser);
                }

                // 10. Desbloquear foto
                photoStatus.unlock(adminUser);

                // 11. Adicionar foto à categoria na seleção
                selection.movePhotoToCustomCategory({
                    photoId: photoData.photoId,
                    fileName: photoData.fileName,
                    originalLocation: {
                        path: photoStatus.originalLocation.originalPath,
                        categoryName: photoStatus.originalLocation.originalCategory,
                        price: photoStatus.originalLocation.originalPrice
                    },
                    customPrice: photoData.customPrice || category.baseCategoryPrice || 0
                }, categoryId);

                // 12. Salvar tudo
                await photoStatus.save({ session });
                await selection.save({ session });

                console.log(`✅ Foto movida: ${photoData.fileName} → ${category.categoryName}`);
                console.log(`📁 Pasta de destino: ${category.googleDriveFolderId}`);

                return {
                    success: true,
                    photoId: photoData.photoId,
                    categoryName: category.categoryName,
                    categoryFolderId: category.googleDriveFolderId,
                    newPrice: photoData.customPrice || category.baseCategoryPrice || 0,
                    message: 'Foto movida com sucesso para categoria navegável'
                };
            });

        } catch (error) {
            console.error('❌ Erro ao mover foto:', error);
            throw error;
        } finally {
            await session.endSession();
        }
    }

    /**
         * Remover foto de seleção especial (devolver ao estoque)
         */
    static async returnPhotoToOriginalLocation(photoId, adminUser, session = null) {
        const useExternalSession = session !== null;
        if (!session) session = await mongoose.startSession();

        try {
            const operation = async () => {
                console.log(`🔄 Devolvendo foto ${photoId} ao estoque original...`);

                // 1. Buscar status da foto (opcional)
                let photoStatus = await PhotoStatus.findOne({ photoId }).session(session);
                // Se não existir PhotoStatus, criar temporário ou pular bloqueio
                if (!photoStatus) {
                    console.log(`⚠️ PhotoStatus não encontrado para ${photoId}, pulando bloqueio`);
                    photoStatus = null; // Continua sem bloqueio
                }

                // 2. Buscar seleção especial que contém a foto
                const selection = await Selection.findOne({
                    selectionType: 'special',
                    'customCategories.photos.photoId': photoId
                }).session(session);

                if (!selection) {
                    throw new Error('Seleção especial não encontrada');
                }

                // 3. Bloquear foto (se PhotoStatus existir)
                if (photoStatus) {
                    photoStatus.lock(adminUser, 'returning', 30);
                }

                // 4. Encontrar backup da localização original
                const backup = selection.googleDriveInfo.specialSelectionInfo.originalPhotosBackup?.find(
                    b => b.photoId === photoId
                );

                if (!backup) {
                    console.warn(`⚠️ Backup não encontrado para ${photoId}, usando localização padrão`);
                }

                // 5. SISTEMA DE TAGS: Marcar foto como disponível (SEM MOVER!)
                console.log(`🏷️ [TAGS] Marcando foto ${photoId} como AVAILABLE`);

                // Criar resultado fake para compatibilidade
                const driveResult = {
                    success: true,
                    photoId: photoId,
                    message: '[TAGS] Foto marcada como disponível'
                };

                console.log(`✅ [TAGS] Foto liberada - sem movimentação física!`);

                // 6. Atualizar status da foto (se existir)
                if (photoStatus) {
                    photoStatus.moveTo({
                        locationType: 'stock',
                        currentPath: photoStatus.originalLocation.originalPath,
                        currentParentId: photoStatus.originalLocation.originalParentId,
                        currentCategory: photoStatus.originalLocation.originalCategory,
                        specialSelectionId: null
                    }, adminUser, 'admin');
                } else {
                    console.log(`⚠️ PhotoStatus null, pulando atualização de status para ${photoId}`);
                }

                // 7. Restaurar preço original (se PhotoStatus existir)
                if (photoStatus) {
                    photoStatus.updatePrice(
                        photoStatus.originalLocation.originalPrice,
                        'category',
                        adminUser
                    );
                } else {
                    console.log(`⚠️ PhotoStatus null, pulando atualização de preço para ${photoId}`);
                }

                // 8. Desbloquear foto (se PhotoStatus existir)
                if (photoStatus) {
                    photoStatus.unlock(adminUser);
                } else {
                    console.log(`⚠️ PhotoStatus null, pulando desbloqueio para ${photoId}`);
                }

                // 9. Remover foto de todas as categorias customizadas
                selection.customCategories.forEach(category => {
                    category.photos = category.photos.filter(photo => photo.photoId !== photoId);
                });

                // 10. Remover do backup
                if (selection.googleDriveInfo.specialSelectionInfo.originalPhotosBackup) {
                    selection.googleDriveInfo.specialSelectionInfo.originalPhotosBackup =
                        selection.googleDriveInfo.specialSelectionInfo.originalPhotosBackup.filter(
                            b => b.photoId !== photoId
                        );
                }

                // ✅ CORREÇÃO: Buscar fileName da seleção se PhotoStatus for null
                let fileName = 'unknown';
                if (photoStatus && photoStatus.fileName) {
                    fileName = photoStatus.fileName;
                } else {
                    // Buscar fileName na seleção
                    for (const category of selection.customCategories) {
                        const photo = category.photos.find(p => p.photoId === photoId);
                        if (photo && photo.fileName) {
                            fileName = photo.fileName;
                            break;
                        }
                    }
                }

                // 11. Adicionar log (✅ CORRIGIDO)
                selection.addMovementLog(
                    'photo_returned',
                    `Foto ${fileName} devolvida ao estoque original`,
                    true,
                    null,
                    {
                        photoId,
                        adminUser,
                        originalLocation: photoStatus ? photoStatus.originalLocation : backup?.originalPath || 'unknown',
                        hadPhotoStatus: !!photoStatus
                    }
                );

                // 12. Salvar (✅ CORRIGIDO - só salva PhotoStatus se existir)
                if (photoStatus) {
                    await photoStatus.save({ session });
                }
                await selection.save({ session });

                console.log(`✅ Foto devolvida ao estoque: ${fileName}`); // ✅ CORRIGIDO

                return { success: true, photoId, fileName: fileName }; // ✅ CORRIGIDO

            };

            if (useExternalSession) {
                return await operation();
            } else {
                return await session.withTransaction(operation);
            }

        } catch (error) {
            console.error(`❌ Erro ao devolver foto ${photoId}:`, error);
            throw error;
        } finally {
            if (!useExternalSession) {
                await session.endSession();
            }
        }
    }

    // ===== ATIVAÇÃO E CONTROLE DE ACESSO =====

    /**
     * Ativar seleção especial e configurar acesso do cliente
     */
    static async activateSpecialSelection(selectionId, adminUser) {
        const session = await mongoose.startSession();

        try {
            return await session.withTransaction(async () => {
                console.log(`🚀 Ativando seleção especial ${selectionId}...`);

                // 1. Buscar seleção especial
                const selection = await Selection.findOne({
                    selectionId: selectionId,
                    selectionType: 'special'
                }).session(session);

                if (!selection) {
                    throw new Error('Seleção especial não encontrada');
                }

                // 2. Validar se seleção tem conteúdo
                const totalPhotos = selection.customCategories.reduce((total, cat) => total + cat.photos.length, 0);
                if (totalPhotos === 0) {
                    throw new Error('Seleção especial não tem fotos. Adicione pelo menos uma foto antes de ativar.');
                }

                // 3. Buscar código de acesso do cliente
                const accessCode = await AccessCode.findOne({
                    code: selection.clientCode
                }).session(session);

                if (!accessCode) {
                    throw new Error('Código de acesso do cliente não encontrado');
                }

                // 3.5 GUARDAR CATEGORIAS ORIGINAIS ANTES DE MUDAR
                const originalCategories = [...accessCode.allowedCategories]; // Clonar array
                console.log(`📦 Guardando categorias originais: ${originalCategories.join(', ')}`);

                // 4. Configurar acesso especial no AccessCode
                accessCode.setSpecialAccess({
                    selectionId: selection._id,
                    selectionCode: selectionId,
                    selectionName: selection.specialSelectionConfig.selectionName,
                    originalCategories: originalCategories,
                    showPrices: selection.specialSelectionConfig.pricingConfig.showPrices,
                    showDiscountInfo: selection.specialSelectionConfig.quantityDiscounts.enabled,
                    welcomeMessage: `Welcome to your special selection: ${selection.specialSelectionConfig.selectionName}`,
                    hideOriginalCategories: true
                }, adminUser);

                // 5. Ativar seleção especial
                selection.specialSelectionConfig.accessConfig.isActive = true;
                // ✅ CORREÇÃO: Status permanece 'pending' até cliente finalizar
                // selection.status permanece como estava (pending)

                // 6. Adicionar logs
                selection.addMovementLog(
                    'special_selection_activated',
                    `Seleção especial ativada para acesso do cliente`,
                    true,
                    null,
                    {
                        adminUser,
                        totalPhotos,
                        totalCategories: selection.customCategories.length,
                        clientCode: selection.clientCode
                    }
                );

                // 7. Salvar tudo
                await accessCode.save({ session });
                await selection.save({ session });

                console.log(`✅ Seleção especial ativada: ${selectionId}`);

                return {
                    success: true,
                    selectionId: selectionId,
                    clientCode: selection.clientCode,
                    totalPhotos: totalPhotos,
                    totalCategories: selection.customCategories.length,
                    message: 'Seleção especial ativada com sucesso'
                };
            });

        } catch (error) {
            console.error('❌ Erro ao ativar seleção especial:', error);
            throw error;
        } finally {
            await session.endSession();
        }
    }

    /**
     * Desativar seleção especial (voltar cliente para acesso normal)
     */
    static async deactivateSpecialSelection(selectionId, adminUser, returnPhotos = false) {
        const session = await mongoose.startSession();

        try {
            return await session.withTransaction(async () => {
                console.log(`⏸️ Desativando seleção especial ${selectionId}...`);

                // 1. Buscar seleção especial
                const selection = await Selection.findOne({
                    selectionId: selectionId,
                    selectionType: 'special'
                }).session(session);

                if (!selection) {
                    throw new Error('Seleção especial não encontrada');
                }

                // 2. Buscar código de acesso do cliente
                const accessCode = await AccessCode.findOne({
                    code: selection.clientCode
                }).session(session);

                if (!accessCode) {
                    throw new Error('Código de acesso do cliente não encontrado');
                }

                // 3. Se solicitado, devolver todas as fotos ao estoque
                if (returnPhotos) {
                    const allPhotos = selection.customCategories.flatMap(cat => cat.photos);
                    for (const photo of allPhotos) {
                        await this.returnPhotoToOriginalLocation(photo.photoId, adminUser, session);
                    }
                }

                // 4. Voltar cliente para acesso normal (usar categorias que tinha antes)
                const originalCategories = accessCode.allowedCategories.length > 0 ?
                    accessCode.allowedCategories :
                    ['1. Colombian Cowhides', '2. Brazil Best Sellers']; // Categorias padrão

                accessCode.setNormalAccess(originalCategories, adminUser);

                // 5. Desativar seleção especial
                selection.specialSelectionConfig.accessConfig.isActive = false;
                // NÃO MUDAR STATUS! Apenas desativar
                selection.isActive = false;
                // selection.status = 'cancelled'; // REMOVER ESTA LINHA!

                // 6. Adicionar logs
                selection.addMovementLog(
                    'special_selection_deactivated',
                    `Seleção especial desativada. Cliente voltou para acesso normal.`,
                    true,
                    null,
                    {
                        adminUser,
                        returnPhotos,
                        originalCategories,
                        clientCode: selection.clientCode
                    }
                );

                // 7. Salvar tudo
                await accessCode.save({ session });
                await selection.save({ session });

                console.log(`✅ Seleção especial desativada: ${selectionId}`);

                return {
                    success: true,
                    selectionId: selectionId,
                    clientCode: selection.clientCode,
                    returnedToNormalAccess: true,
                    photosReturned: returnPhotos,
                    message: 'Seleção especial desativada com sucesso'
                };
            });

        } catch (error) {
            console.error('❌ Erro ao desativar seleção especial:', error);
            throw error;
        } finally {
            await session.endSession();
        }
    }

    // ===== MÉTODOS DE CONSULTA =====

    /**
     * Listar todas as seleções especiais
     */
    static async listSpecialSelections(filters = {}, options = {}) {
        try {
            // ADICIONE ESTE LOG:
            console.log('🔍 Filtros recebidos no backend:', filters);

            const {
                status = null,
                clientCode = null,
                isActive = null,
                hasItems = null,  // ← ADICIONAR ESTA LINHA!
                page = 1,
                limit = 20,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = { ...filters, ...options };

            const query = { selectionType: 'special' };

            // ✅ TRATAMENTO CORRETO DOS FILTROS ESPECIAIS:
            if (status && status !== 'all') {
                query.status = status;
            }

            if (clientCode && clientCode.trim() !== '') {
                query.clientCode = clientCode;
            }

            if (isActive !== null && isActive !== 'all') {
                // ✅ VERSÃO MAIS SEGURA (aceita string E boolean):
                if (isActive === true || isActive === 'true') {
                    query['specialSelectionConfig.accessConfig.isActive'] = true;
                } else if (isActive === false || isActive === 'false') {
                    query['specialSelectionConfig.accessConfig.isActive'] = false;
                }
            }

            // Filtrar por hasItems (para distinguir draft de pending_approval)
            if (hasItems !== null && hasItems !== undefined) {
                if (hasItems === true || hasItems === 'true') {
                    // Pending Approval - tem items
                    query['items.0'] = { $exists: true };
                } else if (hasItems === false || hasItems === 'false') {
                    // Draft - sem items
                    query.$or = [
                        { items: { $size: 0 } },
                        { items: { $exists: false } }
                    ];
                }
            }

            // ✅ ADICIONAR ESTAS 3 LINHAS AQUI:

            const sortOptions = {};
            sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;


            // ADICIONE ESTE LOG ANTES DA QUERY:
            console.log('🔍 Query MongoDB final:', JSON.stringify(query, null, 2));

            const selections = await Selection.find(query)
                .sort(sortOptions)
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .populate('items.productId');


            const total = await Selection.countDocuments(query);

            // Processar dados para resposta
            const processedSelections = selections.map(selection => ({
                ...selection.getSpecialSelectionSummary(),
                // ✅ ADICIONAR O CAMPO ITEMS AQUI
                items: selection.items || [],
                customCategories: selection.customCategories.map(cat => ({
                    categoryId: cat.categoryId,
                    categoryName: cat.categoryName,
                    photoCount: cat.photos.length,
                    baseCategoryPrice: cat.baseCategoryPrice
                }))
            }));

            return {
                success: true,
                selections: processedSelections,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };

        } catch (error) {
            console.error('❌ Erro ao listar seleções especiais:', error);
            throw error;
        }
    }

    /**
     * Obter detalhes completos de uma seleção especial
     */
    static async getSpecialSelectionDetails(selectionId) {
        try {
            const selection = await Selection.findOne({
                selectionId: selectionId,
                selectionType: 'special'
            }).populate('items.productId');

            if (!selection) {
                throw new Error('Seleção especial não encontrada');
            }

            // Buscar informações do código de acesso
            const accessCode = await AccessCode.findOne({ code: selection.clientCode });

            // Buscar status das fotos
            const allPhotoIds = selection.customCategories.flatMap(cat => cat.photos.map(p => p.photoId));
            const photoStatuses = await PhotoStatus.find({ photoId: { $in: allPhotoIds } });

            // Montar resposta completa
            const response = {
                ...selection.getSpecialSelectionSummary(),
                fullDetails: {
                    selection: selection,
                    accessCode: accessCode?.getAdminSummary(),
                    customCategories: selection.customCategories.map(cat => ({
                        ...cat.toObject(),
                        photos: cat.photos.map(photo => {
                            const status = photoStatuses.find(s => s.photoId === photo.photoId);
                            return {
                                ...photo.toObject(),
                                currentStatus: status?.currentStatus,
                                isLocked: status?.isLocked(),
                                isReserved: status?.isReserved()
                            };
                        })
                    })),
                    stats: {
                        totalPhotos: allPhotoIds.length,
                        totalCategories: selection.customCategories.length,
                        averagePhotoPrice: allPhotoIds.length > 0 ?
                            selection.customCategories.flatMap(cat => cat.photos).reduce((sum, p) => sum + (p.customPrice || 0), 0) / allPhotoIds.length : 0
                    }
                }
            };

            return {
                success: true,
                ...response
            };

        } catch (error) {
            console.error('❌ Erro ao obter detalhes da seleção especial:', error);
            throw error;
        }
    }

    // ===== UTILITÁRIOS =====

    /**
     * Obter estatísticas das seleções especiais
     */
    static async getStatistics() {
        try {
            const totalSpecial = await Selection.countDocuments({ selectionType: 'special' });
            const activeSpecial = await Selection.countDocuments({
                selectionType: 'special',
                'specialSelectionConfig.accessConfig.isActive': true
            });

            const statusStats = await Selection.aggregate([
                { $match: { selectionType: 'special' } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]);

            const clientsWithSpecialAccess = await AccessCode.countDocuments({ accessType: 'special' });

            return {
                success: true,
                stats: {
                    totalSpecialSelections: totalSpecial,
                    activeSpecialSelections: activeSpecial,
                    inactiveSpecialSelections: totalSpecial - activeSpecial,
                    statusBreakdown: statusStats.reduce((acc, stat) => {
                        acc[stat._id] = stat.count;
                        return acc;
                    }, {}),
                    clientsWithSpecialAccess: clientsWithSpecialAccess
                },
                timestamp: new Date()
            };

        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error);
            throw error;
        }
    }

    /**
     * Limpar recursos temporários (locks expirados, etc.)
     */
    static async cleanup() {
        try {
            console.log('🧹 Iniciando limpeza de recursos temporários...');

            // Limpar locks e reservas expiradas das fotos
            const cleanedPhotos = await PhotoStatus.cleanupExpired();

            console.log(`✅ Limpeza concluída: ${cleanedPhotos} fotos limpas`);

            return {
                success: true,
                cleanedPhotos: cleanedPhotos,
                timestamp: new Date()
            };

        } catch (error) {
            console.error('❌ Erro na limpeza:', error);
            throw error;
        }
    }

    /**
     * NOVO: Marcar foto para Special Selection usando TAGS (sem mover arquivo!)
     */
    static async tagPhotoForSpecialSelection(photoId, clientCode, selectionId, categoryName = 'default', customPrice = 0) {
        try {
            console.log(`🏷️ [SPECIAL TAG] Marcando foto ${photoId} para cliente ${clientCode}`);

            // 1. Buscar ou criar PhotoStatus
            let photoStatus = await PhotoStatus.findOne({ photoId });

            if (!photoStatus) {
                // Criar registro se não existir
                photoStatus = new PhotoStatus({
                    photoId: photoId,
                    fileName: photoId,
                    currentStatus: 'available',
                    originalLocation: {
                        originalPath: 'Stock',
                        originalParentId: 'root',
                        originalCategory: 'Stock',
                        originalPrice: customPrice
                    },
                    currentLocation: {
                        locationType: 'stock',
                        currentPath: 'Stock',
                        currentParentId: 'root',
                        currentCategory: 'Stock'
                    }
                });
            }

            // 2. VERIFICAR CONFLITOS
            if (photoStatus.virtualStatus.status === 'reserved') {
                throw new Error(`Foto já reservada por cliente ${photoStatus.virtualStatus.clientCode}`);
            }

            if (photoStatus.virtualStatus.status &&
                photoStatus.virtualStatus.status.startsWith('special_') &&
                photoStatus.virtualStatus.clientCode !== clientCode) {
                throw new Error(`Foto já em outra Special Selection (${photoStatus.virtualStatus.clientCode})`);
            }

            // 3. MARCAR COM TAGS
            photoStatus.virtualStatus = {
                status: 'reserved',  // ✅ Status válido!
                currentSelection: selectionId,
                clientCode: clientCode,
                tags: [
                    `special_selection`,  // Tag genérica
                    `special_${clientCode}`,  // Tag específica do cliente
                    `selection_${selectionId}`,
                    `category_${categoryName.toLowerCase().replace(/\s+/g, '_')}`,
                    `price_${customPrice}`
                ],
                lastStatusChange: new Date()
            };

            // 4. Adicionar ao histórico
            photoStatus.addToHistory(
                'selection_moved',
                `Foto adicionada à Special Selection do cliente ${clientCode}`,
                'admin',
                'admin',
                { clientCode, selectionId, categoryName, customPrice }
            );

            // 5. Salvar
            await photoStatus.save();

            console.log(`✅ [SPECIAL TAG] Foto ${photoId} marcada com sucesso!`);
            console.log(`   Status: ${photoStatus.virtualStatus.status}`);
            console.log(`   Tags: ${photoStatus.virtualStatus.tags.join(', ')}`);

            return {
                success: true,
                photoId,
                status: photoStatus.virtualStatus.status,
                tags: photoStatus.virtualStatus.tags
            };

        } catch (error) {
            console.error(`❌ [SPECIAL TAG] Erro:`, error.message);
            throw error;
        }
    }

}

module.exports = SpecialSelectionService;