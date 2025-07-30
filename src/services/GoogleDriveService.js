//src/services/GoogleDriveService.js

const { google } = require('googleapis');

class GoogleDriveService {

    // ===== CONFIGURAÇÕES =====
    static FOLDER_IDS = {
        SALES_ROOT: '1z23OPnm10xxGwjuCH_GTnfQD0YFyE9vt',
        ACTUAL_PICTURES: '1Ky3wSKKg_mmQihdxmiYwMuqE3-SBTcbx',
        RESERVED: null,     // Será criada dinamicamente
        SYSTEM_SOLD: null   // Será criada dinamicamente
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

            console.log('✅ Pastas principais verificadas/criadas:', {
                RESERVED: this.FOLDER_IDS.RESERVED,
                SYSTEM_SOLD: this.FOLDER_IDS.SYSTEM_SOLD
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
     * Mover múltiplas fotos para suas respectivas categorias
     */
    static async movePhotosToSelection(photos, clientFolderId, categorySubfolders) {
        try {
            console.log(`📸 Movendo ${photos.length} fotos para seleção...`);

            const results = [];

            for (const photo of photos) {
                try {
                    // Determinar pasta de destino baseada na categoria
                    const destinationFolder = categorySubfolders[photo.category] || clientFolderId;

                    const result = await this.movePhotoToSelection(
                        photo.driveFileId,
                        destinationFolder
                    );

                    results.push({
                        ...result,
                        category: photo.category,
                        fileName: photo.fileName
                    });

                } catch (error) {
                    console.error(`❌ Erro ao mover foto ${photo.fileName}:`, error);
                    results.push({
                        success: false,
                        photoId: photo.driveFileId,
                        fileName: photo.fileName,
                        error: error.message
                    });
                }
            }

            const successCount = results.filter(r => r.success).length;
            const errorCount = results.length - successCount;

            console.log(`✅ Movimentação concluída: ${successCount} sucessos, ${errorCount} erros`);

            return {
                success: errorCount === 0,
                results,
                summary: {
                    total: photos.length,
                    successful: successCount,
                    failed: errorCount
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

            // Criar pasta final em System Sold
            const now = new Date();
            const date = now.toISOString().split('T')[0];
            const finalFolderName = `Client_${clientCode}_${clientName}_FINAL_${date}`;

            const finalFolderId = await this.createFolderIfNotExists(
                finalFolderName,
                this.FOLDER_IDS.SYSTEM_SOLD
            );

            // Mover pasta completa
            const drive = this.getAuthenticatedDrive();
            await drive.files.update({
                fileId: selectionFolderId,
                addParents: this.FOLDER_IDS.SYSTEM_SOLD,
                removeParents: this.FOLDER_IDS.RESERVED
            });

            console.log(`✅ Venda finalizada: ${finalFolderName}`);

            return {
                success: true,
                finalFolderId,
                finalFolderName
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
}

module.exports = GoogleDriveService;