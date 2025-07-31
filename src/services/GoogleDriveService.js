//src/services/GoogleDriveService.js

const { google } = require('googleapis');

class GoogleDriveService {

    // ===== CONFIGURAÇÕES =====
    static FOLDER_IDS = {
        SALES_ROOT: '1z23OPnm10xxGwjuCH_GTnfQD0YFyE9vt',
        ACTUAL_PICTURES: '1Ky3wSKKg_mmQihdxmiYwMuqE3-SBTcbx',
        RESERVED: null,     // Será criada dinamicamente
        SYSTEM_SOLD: null,   // Será criada dinamicamente
        SPECIAL_SELECTIONS: null   // ← NOVA: Para seleções especiais
    };

    // ===== AUTENTICAÇÃO =====
    static getAuthenticatedDrive() {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
            },
            scopes: [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/drive.file'
            ]
        });

        return google.drive({ version: 'v3', auth });
    }

    // ===== GESTÃO DE PASTAS PRINCIPAIS =====

    /**
     * Criar pastas principais do sistema se não existirem
     */
    static async ensureSystemFoldersExist() {
        try {
            const drive = this.getAuthenticatedDrive();

            console.log('📁 Verificando/criando pastas principais do sistema...');

            // Verificar se pasta RESERVED existe
            if (!this.FOLDER_IDS.RESERVED) {
                this.FOLDER_IDS.RESERVED = await this.createFolderIfNotExists(
                    'RESERVED',
                    this.FOLDER_IDS.SALES_ROOT
                );
            }

            // Verificar se pasta SYSTEM SOLD existe
            if (!this.FOLDER_IDS.SYSTEM_SOLD) {
                this.FOLDER_IDS.SYSTEM_SOLD = await this.createFolderIfNotExists(
                    'System Sold',
                    this.FOLDER_IDS.SALES_ROOT
                );
            }

            // Verificar se pasta SPECIAL SELECTIONS existe
            if (!this.FOLDER_IDS.SPECIAL_SELECTIONS) {
                this.FOLDER_IDS.SPECIAL_SELECTIONS = await this.createFolderIfNotExists(
                    'Special Selections',
                    this.FOLDER_IDS.SALES_ROOT
                );
            }

            console.log('✅ Pastas principais verificadas/criadas:', {
                RESERVED: this.FOLDER_IDS.RESERVED,
                SYSTEM_SOLD: this.FOLDER_IDS.SYSTEM_SOLD,
                SPECIAL_SELECTIONS: this.FOLDER_IDS.SPECIAL_SELECTIONS  // ← ADICIONAR
            });

            return {
                success: true,
                folders: this.FOLDER_IDS
            };

        } catch (error) {
            console.error('❌ Erro ao verificar pastas principais:', error);
            throw error;
        }
    }

    /**
     * Criar pasta se não existir
     */
    static async createFolderIfNotExists(folderName, parentId) {
        try {
            const drive = this.getAuthenticatedDrive();

            // Verificar se pasta já existe
            const existingFolder = await drive.files.list({
                q: `name='${folderName}' and '${parentId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'`,
                fields: 'files(id, name)'
            });

            if (existingFolder.data.files.length > 0) {
                console.log(`📁 Pasta '${folderName}' já existe: ${existingFolder.data.files[0].id}`);
                return existingFolder.data.files[0].id;
            }

            // Criar nova pasta
            const folderMetadata = {
                name: folderName,
                parents: [parentId],
                mimeType: 'application/vnd.google-apps.folder'
            };

            const folder = await drive.files.create({
                resource: folderMetadata,
                fields: 'id, name'
            });

            console.log(`✅ Pasta '${folderName}' criada: ${folder.data.id}`);
            return folder.data.id;

        } catch (error) {
            console.error(`❌ Erro ao criar pasta '${folderName}':`, error);
            throw error;
        }
    }

    /**
     * Construir caminho hierárquico completo de uma pasta
     * Exemplo: "1 Colombian Cowhides → 1. Medium → Brown & White M"
     */
    static async buildHierarchicalPath(folderId) {
        try {
            const drive = this.getAuthenticatedDrive();
            const pathParts = [];

            let currentFolderId = folderId;
            let maxDepth = 10; // Prevenir loops infinitos

            while (currentFolderId && maxDepth > 0) {
                // Buscar informações da pasta atual
                const folder = await drive.files.get({
                    fileId: currentFolderId,
                    fields: 'id, name, parents'
                });

                // Adicionar nome da pasta ao caminho (no início para manter ordem)
                pathParts.unshift(folder.data.name);

                // Verificar se chegamos na raiz ACTUAL_PICTURES
                if (currentFolderId === this.FOLDER_IDS.ACTUAL_PICTURES) {
                    break;
                }

                // Ir para pasta pai
                if (folder.data.parents && folder.data.parents.length > 0) {
                    currentFolderId = folder.data.parents[0];
                } else {
                    break; // Sem pasta pai, chegamos na raiz
                }

                maxDepth--;
            }

            // Remover "Sunshine Cowhides Actual Pictures" da raiz se existir
            if (pathParts[0] && pathParts[0].includes('Sunshine Cowhides Actual Pictures')) {
                pathParts.shift();
            }

            const fullPath = pathParts.join(' → ');
            console.log(`🗂️ Caminho hierárquico construído: ${fullPath}`);

            return fullPath;

        } catch (error) {
            console.error(`❌ Erro ao construir caminho hierárquico para ${folderId}:`, error);
            return folderId; // Fallback para ID se der erro
        }
    }

    /**
     * Recriar hierarquia completa dentro da pasta do cliente
     * Exemplo: "1 Colombian Cowhides → 1. Medium → Brown & White M"
     * Cria: clientFolder/1 Colombian Cowhides/1. Medium/Brown & White M/
     */
    static async recreateHierarchyInFolder(clientFolderId, hierarchicalPath) {
        try {
            const drive = this.getAuthenticatedDrive();

            console.log(`📁 Recriando hierarquia: ${hierarchicalPath}`);

            // Dividir caminho em partes
            const pathParts = hierarchicalPath.split(' → ').map(part => part.trim());

            let currentFolderId = clientFolderId;
            const createdPath = [];

            // Criar cada nível da hierarquia
            for (const folderName of pathParts) {
                // Verificar se pasta já existe neste nível
                const existingFolder = await drive.files.list({
                    q: `name='${folderName}' and '${currentFolderId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'`,
                    fields: 'files(id, name)'
                });

                if (existingFolder.data.files.length > 0) {
                    // Pasta já existe
                    currentFolderId = existingFolder.data.files[0].id;
                    console.log(`📁 Pasta existente: ${folderName} (${currentFolderId})`);
                } else {
                    // Criar nova pasta
                    const folderMetadata = {
                        name: folderName,
                        parents: [currentFolderId],
                        mimeType: 'application/vnd.google-apps.folder'
                    };

                    const newFolder = await drive.files.create({
                        resource: folderMetadata,
                        fields: 'id, name'
                    });

                    currentFolderId = newFolder.data.id;
                    console.log(`✅ Pasta criada: ${folderName} (${currentFolderId})`);
                }

                createdPath.push(folderName);
            }

            console.log(`✅ Hierarquia completa criada: ${createdPath.join(' → ')}`);

            return {
                success: true,
                finalFolderId: currentFolderId,
                hierarchicalPath: createdPath.join(' → '),
                levels: pathParts.length
            };

        } catch (error) {
            console.error(`❌ Erro ao recriar hierarquia '${hierarchicalPath}':`, error);
            return {
                success: false,
                error: error.message,
                finalFolderId: clientFolderId // Fallback para pasta do cliente
            };
        }
    }

    // ===== GESTÃO DE SELEÇÕES =====

    /**
     * Criar pasta para seleção específica do cliente
     */
    static async createClientSelectionFolder(clientCode, clientName, itemCount) {
        try {
            // Garantir que pastas principais existem
            await this.ensureSystemFoldersExist();

            // Gerar nome da pasta
            const now = new Date();
            const date = now.toISOString().split('T')[0]; // 2025-01-27
            const time = now.toTimeString().split(' ')[0].replace(/:/g, 'h'); // 14h30h00
            const folderName = `Client_${clientCode}_${clientName}_${itemCount}items_${date}_${time}`;

            console.log(`📁 Criando pasta para seleção: ${folderName}`);

            // Criar pasta dentro de RESERVED
            const folderId = await this.createFolderIfNotExists(
                folderName,
                this.FOLDER_IDS.RESERVED
            );

            return {
                success: true,
                folderId,
                folderName,
                path: `RESERVED/${folderName}`
            };

        } catch (error) {
            console.error('❌ Erro ao criar pasta de seleção:', error);
            throw error;
        }
    }

    /**
     * Criar subpastas por categoria dentro da pasta do cliente
     */
    static async createCategorySubfolders(clientFolderId, categories) {
        try {
            const drive = this.getAuthenticatedDrive();
            const subfolders = {};

            console.log(`📁 Criando subpastas por categoria: ${categories.join(', ')}`);

            for (const category of categories) {
                // Limpar nome da categoria para usar como nome de pasta
                const cleanCategoryName = category.replace(/[^\w\s-]/g, '').trim();

                const subfolderId = await this.createFolderIfNotExists(
                    cleanCategoryName,
                    clientFolderId
                );

                subfolders[category] = subfolderId;
            }

            console.log('✅ Subpastas de categorias criadas:', subfolders);
            return subfolders;

        } catch (error) {
            console.error('❌ Erro ao criar subpastas de categoria:', error);
            throw error;
        }
    }

    /**
     * Criar pasta para seleção especial (método específico para special selections)
     */
    static async createSelectionFolder(clientCode, clientName, parentFolderId = null) {
        try {
            // Garantir que pastas principais existem
            await this.ensureSystemFoldersExist();

            // Usar SPECIAL_SELECTIONS como parent se não especificado
            const targetParentId = parentFolderId || this.FOLDER_IDS.SPECIAL_SELECTIONS;

            if (!targetParentId) {
                throw new Error('Parent folder ID para Special Selections não foi configurado');
            }

            // Gerar nome único da pasta
            const now = new Date();
            const date = now.toISOString().split('T')[0]; // 2025-01-27
            const time = now.toTimeString().split(' ')[0].replace(/:/g, 'h'); // 14h30h00
            const folderName = `CLIENT_${clientCode}_${clientName.replace(/[^\w\s-]/g, '')}_${date}_${time}`;

            console.log(`📁 Criando pasta para seleção especial: ${folderName}`);

            // Criar pasta dentro de Special Selections
            const folderId = await this.createFolderIfNotExists(
                folderName,
                targetParentId
            );

            return {
                success: true,
                folderId,
                folderName,
                folderPath: `Special Selections/${folderName}`
            };

        } catch (error) {
            console.error('❌ Erro ao criar pasta de seleção especial:', error);
            throw error;
        }
    }

    // ===== MOVIMENTAÇÃO DE ARQUIVOS =====

    /**
         * Mover foto para pasta de seleção
         */
    static async movePhotoToSelection(photoId, destinationFolderId) {
        try {
            const drive = this.getAuthenticatedDrive();

            console.log(`📸 Movendo foto ${photoId} para pasta ${destinationFolderId}`);

            // Buscar informações atuais da foto
            const photo = await drive.files.get({
                fileId: photoId,
                fields: 'id, name, parents'
            });

            if (!photo.data.parents || photo.data.parents.length === 0) {
                throw new Error('Foto não possui pasta parent definida');
            }

            const currentParent = photo.data.parents[0];

            // ===== NOVO: Capturar caminho hierárquico completo =====
            const originalHierarchicalPath = await this.buildHierarchicalPath(currentParent);

            // Mover foto (remover do parent atual e adicionar ao novo)
            const result = await drive.files.update({
                fileId: photoId,
                addParents: destinationFolderId,
                removeParents: currentParent,
                fields: 'id, name, parents'
            });

            console.log(`✅ Foto movida: ${photo.data.name}`);
            console.log(`   📂 De: ${originalHierarchicalPath}`);
            console.log(`   📂 Para: ${destinationFolderId}`);

            return {
                success: true,
                photoId,
                photoName: photo.data.name,
                oldParent: currentParent,
                newParent: destinationFolderId,
                originalHierarchicalPath: originalHierarchicalPath  // ← NOVO CAMPO
            };

        } catch (error) {
            console.error(`❌ Erro ao mover foto ${photoId}:`, error);
            throw error;
        }
    }

    /**
         * Mover múltiplas fotos preservando hierarquia completa
         * VERSÃO MELHORADA: Recria estrutura original dentro da pasta do cliente
         */
    static async movePhotosToSelection(photos, clientFolderId, categorySubfolders = {}) {
        try {
            console.log(`📸 Movendo ${photos.length} fotos com preservação de hierarquia...`);

            const results = [];
            const hierarchyCache = new Map(); // Cache para evitar recriar pastas duplicadas

            for (const photo of photos) {
                try {
                    console.log(`📸 Processando foto: ${photo.fileName}`);

                    // 1. Buscar informações atuais da foto no Google Drive
                    const drive = this.getAuthenticatedDrive();
                    const photoData = await drive.files.get({
                        fileId: photo.driveFileId,
                        fields: 'id, name, parents'
                    });

                    if (!photoData.data.parents || photoData.data.parents.length === 0) {
                        throw new Error('Foto não possui pasta parent definida');
                    }

                    const currentParent = photoData.data.parents[0];

                    // 2. Capturar caminho hierárquico completo da foto
                    const originalHierarchicalPath = await this.buildHierarchicalPath(currentParent);

                    console.log(`📂 Caminho original: ${originalHierarchicalPath}`);

                    // 3. Verificar cache ou recriar hierarquia na pasta do cliente
                    let destinationFolderId;

                    if (hierarchyCache.has(originalHierarchicalPath)) {
                        // Usar pasta já criada
                        destinationFolderId = hierarchyCache.get(originalHierarchicalPath);
                        console.log(`💾 Usando pasta do cache: ${destinationFolderId}`);
                    } else {
                        // Recriar hierarquia completa
                        const hierarchyResult = await this.recreateHierarchyInFolder(
                            clientFolderId,
                            originalHierarchicalPath
                        );

                        if (!hierarchyResult.success) {
                            console.warn(`⚠️ Falha ao recriar hierarquia, usando pasta do cliente como fallback`);
                            destinationFolderId = clientFolderId;
                        } else {
                            destinationFolderId = hierarchyResult.finalFolderId;
                            // Salvar no cache para próximas fotos do mesmo caminho
                            hierarchyCache.set(originalHierarchicalPath, destinationFolderId);
                        }
                    }

                    // 4. Mover foto para pasta de destino
                    console.log(`📸 Movendo ${photo.fileName} para ${destinationFolderId}`);

                    await drive.files.update({
                        fileId: photo.driveFileId,
                        addParents: destinationFolderId,
                        removeParents: currentParent,
                        fields: 'id, name, parents'
                    });

                    // 5. Resultado da movimentação
                    results.push({
                        success: true,
                        photoId: photo.driveFileId,
                        photoName: photo.fileName,
                        oldParent: currentParent,
                        newParent: destinationFolderId,
                        originalHierarchicalPath: originalHierarchicalPath,
                        category: photo.category,
                        fileName: photo.fileName
                    });

                    console.log(`✅ Foto movida: ${photo.fileName}`);
                    console.log(`   📂 Hierarquia preservada: ${originalHierarchicalPath}`);

                } catch (error) {
                    console.error(`❌ Erro ao mover foto ${photo.fileName}:`, error);
                    results.push({
                        success: false,
                        photoId: photo.driveFileId,
                        fileName: photo.fileName,
                        category: photo.category,
                        error: error.message
                    });
                }
            }

            const successCount = results.filter(r => r.success).length;
            const errorCount = results.length - successCount;

            console.log(`✅ Movimentação concluída com hierarquia preservada:`);
            console.log(`   📊 ${successCount} sucessos, ${errorCount} erros`);
            console.log(`   📁 ${hierarchyCache.size} estruturas de pastas criadas`);

            return {
                success: errorCount === 0,
                results,
                summary: {
                    total: photos.length,
                    successful: successCount,
                    failed: errorCount,
                    hierarchiesCreated: hierarchyCache.size
                }
            };

        } catch (error) {
            console.error('❌ Erro na movimentação de fotos:', error);
            throw error;
        }
    }

    // ===== OPERAÇÕES DE REVERSÃO =====

    /**
     * Reverter seleção - mover fotos de volta para disponíveis
     */
    static async revertSelection(selectionFolderId) {
        try {
            const drive = this.getAuthenticatedDrive();

            console.log(`🔄 Revertendo seleção da pasta: ${selectionFolderId}`);

            // Buscar todas as fotos na pasta de seleção recursivamente
            const photos = await this.getAllPhotosInFolder(selectionFolderId);

            const results = [];

            for (const photo of photos) {
                try {
                    const result = await this.movePhotoToSelection(
                        photo.id,
                        this.FOLDER_IDS.ACTUAL_PICTURES
                    );
                    results.push(result);
                } catch (error) {
                    console.error(`❌ Erro ao reverter foto ${photo.name}:`, error);
                    results.push({
                        success: false,
                        photoId: photo.id,
                        error: error.message
                    });
                }
            }

            console.log(`✅ Reversão concluída: ${results.filter(r => r.success).length} fotos`);

            return {
                success: true,
                results,
                photosReverted: results.filter(r => r.success).length
            };

        } catch (error) {
            console.error('❌ Erro na reversão de seleção:', error);
            throw error;
        }
    }

    /**
     * Finalizar venda - mover seleção para System Sold
     */
    static async finalizeSelection(selectionFolderId, clientCode, clientName) {
        try {
            await this.ensureSystemFoldersExist();

            console.log(`🎯 Finalizando venda da pasta: ${selectionFolderId}`);

            // SIMPLES: Apenas mover pasta de RESERVED para SYSTEM_SOLD
            const drive = this.getAuthenticatedDrive();

            // Buscar nome atual da pasta
            const folderInfo = await drive.files.get({
                fileId: selectionFolderId,
                fields: 'id, name, parents'
            });

            const currentName = folderInfo.data.name;

            // Mover pasta: RESERVED → SYSTEM_SOLD
            await drive.files.update({
                fileId: selectionFolderId,
                addParents: this.FOLDER_IDS.SYSTEM_SOLD,
                removeParents: this.FOLDER_IDS.RESERVED
            });

            console.log(`✅ Pasta movida para SYSTEM_SOLD: ${currentName}`);

            return {
                success: true,
                finalFolderId: selectionFolderId,      // ← Mesmo ID
                finalFolderName: currentName           // ← Mesmo nome
            };

        } catch (error) {
            console.error('❌ Erro ao finalizar venda:', error);
            throw error;
        }
    }

    // ===== UTILITÁRIOS =====

    /**
     * Buscar todas as fotos em uma pasta recursivamente
     */
    static async getAllPhotosInFolder(folderId) {
        try {
            const drive = this.getAuthenticatedDrive();

            const response = await drive.files.list({
                q: `'${folderId}' in parents and trashed=false and (mimeType contains 'image/' or name contains '.jpg' or name contains '.jpeg' or name contains '.png')`,
                fields: 'files(id, name, mimeType)',
                pageSize: 1000
            });

            return response.data.files;

        } catch (error) {
            console.error('❌ Erro ao buscar fotos da pasta:', error);
            throw error;
        }
    }

    /**
     * Verificar status das pastas do sistema
     */
    static async getSystemStatus() {
        try {
            const drive = this.getAuthenticatedDrive();

            const folders = await Promise.all([
                drive.files.get({ fileId: this.FOLDER_IDS.SALES_ROOT, fields: 'id, name' }),
                drive.files.get({ fileId: this.FOLDER_IDS.ACTUAL_PICTURES, fields: 'id, name' })
            ]);

            return {
                success: true,
                folders: {
                    salesRoot: folders[0].data,
                    actualPictures: folders[1].data,
                    reserved: this.FOLDER_IDS.RESERVED,
                    systemSold: this.FOLDER_IDS.SYSTEM_SOLD
                },
                timestamp: new Date()
            };

        } catch (error) {
            console.error('❌ Erro ao verificar status do sistema:', error);
            throw error;
        }
    }

    /**
     * Reverter foto para localização original (VERSÃO HÍBRIDA)
     * Funciona com seleções antigas (IDs) e novas (caminhos hierárquicos)
     */
    static async revertPhotoToOriginalLocation(photoId, originalPath) {
        try {
            console.log(`🔄 Revertendo foto ${photoId} para: ${originalPath}`);

            let destinationFolderId;

            // ===== DETECÇÃO AUTOMÁTICA: ID vs CAMINHO =====
            if (this.isGoogleDriveId(originalPath)) {
                // É um ID (seleção antiga) - usar diretamente
                console.log(`🆔 Detectado como ID do Google Drive: ${originalPath}`);
                destinationFolderId = originalPath;

                // Verificar se ID ainda existe
                const isValidId = await this.verifyFolderId(originalPath);
                if (!isValidId) {
                    console.warn(`⚠️ ID ${originalPath} não é válido, tentando método alternativo...`);
                    throw new Error(`ID de pasta inválido: ${originalPath}`);
                }

            } else {
                // É um caminho hierárquico (seleção nova) - encontrar ID
                console.log(`🗂️ Detectado como caminho hierárquico: ${originalPath}`);
                destinationFolderId = await this.findFolderByHierarchicalPath(originalPath);

                if (!destinationFolderId) {
                    throw new Error(`Pasta não encontrada para caminho: ${originalPath}`);
                }
            }

            // Mover foto para pasta de destino
            const result = await this.movePhotoToSelection(photoId, destinationFolderId);

            console.log(`✅ Foto revertida: ${result.photoName} → ${originalPath}`);

            return {
                success: true,
                photoId,
                originalPath,
                destinationFolderId,
                method: this.isGoogleDriveId(originalPath) ? 'ID_DIRETO' : 'CAMINHO_HIERARQUICO'
            };

        } catch (error) {
            console.error(`❌ Erro ao reverter foto ${photoId}:`, error);

            // ===== FALLBACK: TENTAR ENCONTRAR PASTA PAI ATUAL =====
            try {
                console.log(`🔄 Tentando fallback para foto ${photoId}...`);
                const fallbackResult = await this.fallbackRevertPhoto(photoId);

                if (fallbackResult.success) {
                    console.log(`✅ Fallback bem-sucedido: ${fallbackResult.method}`);
                    return fallbackResult;
                }
            } catch (fallbackError) {
                console.error(`❌ Fallback também falhou:`, fallbackError);
            }

            return {
                success: false,
                photoId,
                originalPath,
                error: error.message
            };
        }
    }

    /**
     * Verificar se string é um ID válido do Google Drive
     */
    static isGoogleDriveId(str) {
        // IDs do Google Drive têm formato específico
        const googleDriveIdPattern = /^[a-zA-Z0-9_-]{25,}$/;
        return googleDriveIdPattern.test(str) && !str.includes('→');
    }

    /**
     * Verificar se ID de pasta ainda existe no Google Drive
     */
    static async verifyFolderId(folderId) {
        try {
            const drive = this.getAuthenticatedDrive();

            await drive.files.get({
                fileId: folderId,
                fields: 'id, name, mimeType'
            });

            return true;
        } catch (error) {
            console.warn(`⚠️ ID ${folderId} não é válido:`, error.message);
            return false;
        }
    }

    /**
     * Método de fallback: tentar descobrir pasta original da foto
     */
    static async fallbackRevertPhoto(photoId) {
        try {
            const drive = this.getAuthenticatedDrive();

            console.log(`🔍 Fallback: Analisando foto ${photoId}...`);

            // Buscar informações da foto
            const photo = await drive.files.get({
                fileId: photoId,
                fields: 'id, name, parents'
            });

            const photoName = photo.data.name;
            const currentParent = photo.data.parents[0];

            console.log(`📸 Foto: ${photoName}, Parent atual: ${currentParent}`);

            // ===== ESTRATÉGIA 1: ENCONTRAR PASTA COM NOME SIMILAR =====
            // Extrair possível categoria do nome do arquivo
            const possibleCategory = this.extractCategoryFromFileName(photoName);

            if (possibleCategory) {
                console.log(`🎯 Categoria possível extraída: ${possibleCategory}`);

                const categoryFolderId = await this.findCategoryFolder(possibleCategory);

                if (categoryFolderId) {
                    // Mover para pasta da categoria encontrada
                    await this.movePhotoToSelection(photoId, categoryFolderId);

                    console.log(`✅ Fallback sucesso: Movido para categoria ${possibleCategory}`);

                    return {
                        success: true,
                        photoId,
                        destinationFolderId: categoryFolderId,
                        method: 'FALLBACK_CATEGORIA',
                        details: `Movido para categoria inferida: ${possibleCategory}`
                    };
                }
            }

            // ===== ESTRATÉGIA 2: MOVER PARA ACTUAL_PICTURES RAIZ =====
            console.log(`🏠 Fallback final: Movendo para ACTUAL_PICTURES raiz`);

            await this.movePhotoToSelection(photoId, this.FOLDER_IDS.ACTUAL_PICTURES);

            return {
                success: true,
                photoId,
                destinationFolderId: this.FOLDER_IDS.ACTUAL_PICTURES,
                method: 'FALLBACK_RAIZ',
                details: 'Movido para pasta raiz ACTUAL_PICTURES (requer reorganização manual)'
            };

        } catch (error) {
            console.error(`❌ Fallback falhou completamente:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Extrair possível categoria do nome do arquivo
     */
    static extractCategoryFromFileName(fileName) {
        // Remover extensão
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");

        // Padrões comuns nos seus arquivos
        const patterns = [
            /^(.*?)(XL|L|M|S)(\d+)?$/i,           // Brazilian XL2, Colombian M, etc
            /^(.*?)(Extra Large|Large|Medium|Small)/i, // Extra Large, Medium, etc  
            /^(.*?)(Black|White|Brown|Salt|Pepper)/i,  // Cores
            /^(\d+)\s*(.*?)(\d+)?$/                    // 1 Colombian, 2 Brazil, etc
        ];

        for (const pattern of patterns) {
            const match = nameWithoutExt.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        // Fallback: primeira palavra
        const firstWord = nameWithoutExt.split(/[\s_-]/)[0];
        return firstWord.length > 2 ? firstWord : null;
    }

    /**
     * Encontrar pasta de categoria por nome aproximado
     */
    static async findCategoryFolder(categoryHint) {
        try {
            const drive = this.getAuthenticatedDrive();

            // Buscar pastas que contenham o hint
            const response = await drive.files.list({
                q: `'${this.FOLDER_IDS.ACTUAL_PICTURES}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder' and name contains '${categoryHint}'`,
                fields: 'files(id, name)',
                pageSize: 10
            });

            if (response.data.files.length > 0) {
                const folder = response.data.files[0];
                console.log(`📁 Categoria encontrada: ${folder.name} (${folder.id})`);
                return folder.id;
            }

            return null;

        } catch (error) {
            console.error(`❌ Erro ao buscar categoria '${categoryHint}':`, error);
            return null;
        }
    }

    /**
     * Encontrar ID da pasta pelo caminho hierárquico
     * Exemplo: "1 Colombian Cowhides → 1. Medium → Brown & White M"
     */
    static async findFolderByHierarchicalPath(hierarchicalPath) {
        try {
            const drive = this.getAuthenticatedDrive();

            // Dividir caminho em partes
            const pathParts = hierarchicalPath.split(' → ').map(part => part.trim());

            console.log(`🔍 Procurando pasta pelo caminho: ${pathParts.join(' → ')}`);

            let currentFolderId = this.FOLDER_IDS.ACTUAL_PICTURES;

            // Navegar pela hierarquia
            for (const folderName of pathParts) {
                // Buscar pasta com este nome dentro da pasta atual
                const response = await drive.files.list({
                    q: `name='${folderName}' and '${currentFolderId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'`,
                    fields: 'files(id, name)'
                });

                if (response.data.files.length === 0) {
                    console.warn(`⚠️ Pasta '${folderName}' não encontrada em '${currentFolderId}'`);
                    return null;
                }

                if (response.data.files.length > 1) {
                    console.warn(`⚠️ Múltiplas pastas encontradas com nome '${folderName}'`);
                }

                currentFolderId = response.data.files[0].id;
                console.log(`📁 Encontrada: ${folderName} (${currentFolderId})`);
            }

            console.log(`✅ Pasta de destino encontrada: ${currentFolderId}`);
            return currentFolderId;

        } catch (error) {
            console.error(`❌ Erro ao encontrar pasta pelo caminho '${hierarchicalPath}':`, error);
            return null;
        }
    }

    /**
     * Limpar pasta vazia (após cancelamento)
     */
    static async cleanupEmptyFolder(folderId) {
        try {
            const drive = this.getAuthenticatedDrive();

            console.log(`🗑️ Verificando se pasta ${folderId} está vazia para limpeza...`);

            // Verificar se pasta tem arquivos/subpastas
            const contents = await drive.files.list({
                q: `'${folderId}' in parents and trashed=false`,
                fields: 'files(id)'
            });

            if (contents.data.files.length === 0) {
                // Pasta está vazia, pode deletar
                await drive.files.delete({ fileId: folderId });
                console.log(`✅ Pasta vazia removida: ${folderId}`);

                return { success: true, deleted: true };
            } else {
                console.log(`📁 Pasta não está vazia (${contents.data.files.length} itens), mantendo`);
                return { success: true, deleted: false };
            }

        } catch (error) {
            console.warn(`⚠️ Erro ao limpar pasta ${folderId}:`, error.message);
            return { success: false, error: error.message };
        }
    }

}

module.exports = GoogleDriveService;