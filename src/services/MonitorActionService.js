// src/services/MonitorActionService.js
// SERVICE PARA EXECUTAR AÇÕES DO MONITOR
// Corrige retornos, pases simples e pases complexos

const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const PhotoCategory = require('../models/PhotoCategory');
const { S3Client, CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const mysql = require('mysql2/promise');

class MonitorActionService {
    constructor() {
        // Configurar cliente R2
        this.r2Client = new S3Client({
            region: 'auto',
            endpoint: process.env.R2_ENDPOINT,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
            }
        });

        this.bucketName = process.env.R2_BUCKET_NAME || 'sunshine-photos';
    }

    // ============================================
    // AÇÃO 1: CORRIGIR RETORNO
    // ============================================
    async corrigirRetorno(photoNumber, adminUser = 'system') {
        console.log(`[MONITOR ACTION] 🔙 Corrigindo retorno da foto ${photoNumber}...`);

        try {
            // 1. Buscar foto no MongoDB
            const photo = await UnifiedProductComplete.findOne({
                $or: [
                    { photoNumber: photoNumber },
                    { photoNumber: photoNumber.padStart(5, '0') }
                ]
            });

            if (!photo) {
                return {
                    success: false,
                    message: `Foto ${photoNumber} não encontrada no MongoDB`
                };
            }

            // 2. Verificar status no CDE
            const cdeConnection = await this.connectCDE();
            const [cdeData] = await cdeConnection.execute(
                'SELECT AESTADOP, AQBITEM FROM tbinventario WHERE ATIPOETIQUETA = ? ORDER BY AFECHA DESC LIMIT 1',
                [photoNumber]
            );
            await cdeConnection.end();

            if (cdeData.length === 0) {
                return {
                    success: false,
                    message: `Foto ${photoNumber} não encontrada no CDE`
                };
            }

            const cdeStatus = cdeData[0].AESTADOP;
            const cdeQB = cdeData[0].AQBITEM;

            // 3. Validar que é realmente um retorno
            if (cdeStatus !== 'INGRESADO') {
                return {
                    success: false,
                    message: `Foto ${photoNumber} não está INGRESADO no CDE (status: ${cdeStatus})`
                };
            }

            if (photo.status !== 'sold') {
                return {
                    success: false,
                    message: `Foto ${photoNumber} não está marcada como sold no MongoDB (status: ${photo.status})`
                };
            }

            // 4. Preparar atualização
            const updates = {
                status: 'available',
                cdeStatus: 'INGRESADO',
                currentStatus: 'available'
            };

            // Se QB mudou, atualizar também
            if (photo.qbItem !== cdeQB) {
                console.log(`[MONITOR ACTION] ⚠️  QB também mudou: ${photo.qbItem} → ${cdeQB}`);
                updates.qbItem = cdeQB;

                // Buscar nova categoria
                const newCategory = await this.findCategoryByQB(cdeQB);
                if (newCategory) {
                    updates.category = newCategory.displayName || newCategory.googleDrivePath;
                }
            }

            // Limpar selectionId e reservedBy
            updates.$unset = {
                selectionId: 1,
                'reservedBy.clientCode': 1,
                'reservedBy.sessionId': 1,
                'reservedBy.expiresAt': 1
            };

            // 5. Aplicar atualização
            await UnifiedProductComplete.updateOne(
                { _id: photo._id },
                updates
            );

            // 6. Log da ação
            console.log(`[MONITOR ACTION] ✅ Retorno corrigido: ${photoNumber}`);
            console.log(`   - Status: sold → available`);
            console.log(`   - CDE Status: ${photo.cdeStatus || 'N/A'} → INGRESADO`);
            if (photo.qbItem !== cdeQB) {
                console.log(`   - QB: ${photo.qbItem} → ${cdeQB}`);
            }

            return {
                success: true,
                message: `Foto ${photoNumber} marcada como disponível`,
                changes: {
                    before: {
                        status: photo.status,
                        cdeStatus: photo.cdeStatus,
                        qbItem: photo.qbItem
                    },
                    after: {
                        status: 'available',
                        cdeStatus: 'INGRESADO',
                        qbItem: cdeQB
                    }
                }
            };

        } catch (error) {
            console.error(`[MONITOR ACTION] ❌ Erro ao corrigir retorno:`, error);
            return {
                success: false,
                message: `Erro ao corrigir retorno: ${error.message}`
            };
        }
    }

    // ============================================
    // AÇÃO 2: APLICAR PASE (SEMPRE MOVE NO R2!)
    // ============================================
    async aplicarPase(photoNumber, adminUser = 'system') {
        console.log(`[MONITOR ACTION] 🔀 Aplicando PASE da foto ${photoNumber}...`);

        try {
            // 1. Buscar foto no MongoDB
            const photo = await UnifiedProductComplete.findOne({
                $or: [
                    { photoNumber: photoNumber },
                    { photoNumber: photoNumber.padStart(5, '0') }
                ]
            });

            if (!photo) {
                return {
                    success: false,
                    message: `Foto ${photoNumber} não encontrada no MongoDB`
                };
            }

            // 2. Buscar QB correto no CDE
            const cdeConnection = await this.connectCDE();
            const [cdeData] = await cdeConnection.execute(
                'SELECT AQBITEM FROM tbinventario WHERE ATIPOETIQUETA = ? ORDER BY AFECHA DESC LIMIT 1',
                [photoNumber]
            );
            await cdeConnection.end();

            if (cdeData.length === 0) {
                return {
                    success: false,
                    message: `Foto ${photoNumber} não encontrada no CDE`
                };
            }

            const cdeQB = cdeData[0].AQBITEM;

            // 3. Validar que QB realmente mudou
            if (photo.qbItem === cdeQB) {
                return {
                    success: false,
                    message: `QB já está correto: ${cdeQB}. Não há pase a aplicar.`
                };
            }

            console.log(`[MONITOR ACTION] 📋 QB mudou: ${photo.qbItem} → ${cdeQB}`);

            // 4. Buscar categoria de DESTINO pelo QB do CDE
            const newCategory = await this.findCategoryByQB(cdeQB);
            if (!newCategory) {
                return {
                    success: false,
                    message: `Categoria não encontrada para QB de destino: ${cdeQB}`
                };
            }

            console.log(`[MONITOR ACTION] 📁 Destino: ${newCategory.googleDrivePath}`);

            // 5. Validar que foto tem r2Path
            if (!photo.r2Path) {
                return {
                    success: false,
                    message: `Foto ${photoNumber} não tem r2Path definido`
                };
            }

            // 6. MOVER FOTOS NO R2 (4 versões!)
            console.log(`[MONITOR ACTION] 📦 Movendo 4 versões no R2...`);

            const moveResult = await this.movePhotoInR2(
                photoNumber,
                photo.r2Path,
                newCategory.googleDrivePath
            );

            if (!moveResult.success) {
                return {
                    success: false,
                    message: `Erro ao mover fotos no R2: ${moveResult.message}`
                };
            }

            // 7. Construir novo r2Path
            const newR2Path = `${newCategory.googleDrivePath}/${photoNumber}.webp`;

            // 8. Atualizar MongoDB com TODOS os novos dados
            const updates = {
                qbItem: cdeQB,
                category: newCategory.displayName || newCategory.googleDrivePath,
                r2Path: newR2Path,
                thumbnailUrl: `${process.env.R2_PUBLIC_URL}/${newCategory.googleDrivePath}/_thumbnails/${photoNumber}.webp`,
                webViewLink: `${process.env.R2_PUBLIC_URL}/${newR2Path}`
            };

            await UnifiedProductComplete.updateOne(
                { _id: photo._id },
                { $set: updates }
            );

            // 9. Log completo
            console.log(`[MONITOR ACTION] ✅ PASE aplicado com sucesso: ${photoNumber}`);
            console.log(`   - QB: ${photo.qbItem} → ${cdeQB}`);
            console.log(`   - Categoria: ${photo.category} → ${newCategory.displayName}`);
            console.log(`   - Path: ${photo.r2Path} → ${newR2Path}`);
            console.log(`   - Versões movidas no R2: ${moveResult.movedFiles.length}`);

            return {
                success: true,
                message: `Pase aplicado com sucesso - 4 versões movidas no R2`,
                changes: {
                    before: {
                        qbItem: photo.qbItem,
                        category: photo.category,
                        r2Path: photo.r2Path
                    },
                    after: {
                        qbItem: cdeQB,
                        category: newCategory.displayName,
                        r2Path: newR2Path
                    },
                    r2Moves: moveResult.movedFiles
                }
            };

        } catch (error) {
            console.error(`[MONITOR ACTION] ❌ Erro ao aplicar pase:`, error);
            return {
                success: false,
                message: `Erro ao aplicar pase: ${error.message}`
            };
        }
    }


    // ============================================
    // HELPER: MOVER FOTO NO R2
    // ============================================
    async movePhotoInR2(photoNumber, fromPath, toPath) {
        console.log(`[R2 MOVE] Movendo foto ${photoNumber}`);
        console.log(`   DE: ${fromPath}`);
        console.log(`   PARA: ${toPath}`);

        try {
            // Remover extensão do fromPath se existir
            const cleanFromPath = fromPath.replace(/\.webp$/, '').replace(/\/$/, '');
            const cleanToPath = toPath.replace(/\/$/, '');

            // 4 versões a mover
            const versions = [
                { name: 'original', from: `${cleanFromPath}.webp`, to: `${cleanToPath}/${photoNumber}.webp` },
                { name: 'thumbnail', from: `${cleanFromPath}/_thumbnails/${photoNumber}.webp`, to: `${cleanToPath}/_thumbnails/${photoNumber}.webp` },
                { name: 'preview', from: `${cleanFromPath}/_previews/${photoNumber}.webp`, to: `${cleanToPath}/_previews/${photoNumber}.webp` },
                { name: 'display', from: `${cleanFromPath}/_display/${photoNumber}.webp`, to: `${cleanToPath}/_display/${photoNumber}.webp` }
            ];

            const movedFiles = [];
            const errors = [];

            for (const version of versions) {
                try {
                    console.log(`[R2 MOVE]    Movendo ${version.name}...`);

                    // Copiar para novo local
                    await this.r2Client.send(new CopyObjectCommand({
                        Bucket: this.bucketName,
                        CopySource: `${this.bucketName}/${version.from}`,
                        Key: version.to
                    }));

                    // Deletar do local antigo
                    await this.r2Client.send(new DeleteObjectCommand({
                        Bucket: this.bucketName,
                        Key: version.from
                    }));

                    movedFiles.push(version.name);
                    console.log(`[R2 MOVE]    ✅ ${version.name} movido`);

                } catch (error) {
                    console.error(`[R2 MOVE]    ❌ Erro ao mover ${version.name}:`, error.message);
                    errors.push({ version: version.name, error: error.message });
                }
            }

            if (errors.length > 0) {
                return {
                    success: false,
                    message: `Erro ao mover algumas versões: ${errors.map(e => e.version).join(', ')}`,
                    movedFiles,
                    errors
                };
            }

            return {
                success: true,
                message: `${movedFiles.length} versões movidas com sucesso`,
                movedFiles
            };

        } catch (error) {
            console.error(`[R2 MOVE] ❌ Erro geral:`, error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    // ============================================
    // HELPER: CONECTAR AO CDE
    // ============================================
    async connectCDE() {
        return await mysql.createConnection({
            host: process.env.CDE_HOST,
            port: process.env.CDE_PORT,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });
    }

    // ============================================
    // HELPER: BUSCAR CATEGORIA POR QB
    // ============================================
    async findCategoryByQB(qbItem) {
        // Buscar por código QB exato
        let category = await PhotoCategory.findOne({ qbItem: qbItem });

        if (!category) {
            // Buscar por prefixo (primeiros 4 dígitos)
            const prefix = qbItem.substring(0, 4);
            category = await PhotoCategory.findOne({
                qbItem: new RegExp(`^${prefix}`)
            });
        }

        return category;
    }

    // ============================================
    // HELPER: BUSCAR CATEGORIA POR PATH
    // ============================================
    async findCategoryByPath(path) {
        // Normalizar path
        const cleanPath = path.replace(/\/$/, '');

        // Buscar exato
        let category = await PhotoCategory.findOne({
            $or: [
                { googleDrivePath: cleanPath },
                { googleDrivePath: cleanPath + '/' },
                { displayName: cleanPath }
            ]
        });

        return category;
    }
}

module.exports = new MonitorActionService();
