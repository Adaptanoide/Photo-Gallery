const mongoose = require('mongoose');
const FolderStats = require('../../src/models/FolderStats');
const PhotoStatus = require('../../src/models/PhotoStatus');
const R2Service = require('../../src/services/R2Service');
require('dotenv').config();

async function updateFolderStats() {
    try {
        console.log('🔄 Iniciando atualização de estatísticas...');

        // Conectar ao MongoDB
        await mongoose.connect(process.env.MONGODB_URI);

        // Buscar todas as pastas do R2
        const rootFolders = await R2Service.getSubfolders('');

        // PROCESSAR TODAS AS PASTAS
        for (const folder of rootFolders.folders) {
            await processFolder(folder.path);
        }

        console.log('✅ Estatísticas atualizadas!');

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.disconnect();
    }
}

async function processFolder(folderPath) {
    try {
        console.log(`📂 Processando: ${folderPath}`);

        // Buscar subpastas
        const result = await R2Service.getSubfolders(folderPath);

        // Se tem subpastas, processar recursivamente
        if (result.folders && result.folders.length > 0) {
            for (const subfolder of result.folders) {
                await processFolder(subfolder.path);
            }
        }

        // Buscar fotos desta pasta
        const photosResult = await R2Service.getPhotosFromFolder(folderPath);
        const totalPhotos = photosResult.photos?.length || 0;

        if (totalPhotos === 0) return;

        // Extrair IDs das fotos
        const photoIds = photosResult.photos.map(photo => {
            const fileName = photo.fileName || photo.name.split('/').pop();
            return fileName.replace('.webp', '');
        });

        // Contar fotos disponíveis considerando o photoNumber
        const availableCount = await PhotoStatus.countDocuments({
            $or: [
                { photoId: { $in: photoIds } },
                { photoNumber: { $in: photoIds } }  // Usar também photoNumber
            ],
            $and: [
                { 'virtualStatus.status': { $ne: 'sold' } },
                { 'currentStatus': { $ne: 'sold' } },
                { 'cdeStatus': { $nin: ['RESERVED', 'STANDBY'] } }
            ]
        });

        const soldCount = totalPhotos - availableCount;

        // Atualizar ou criar registro
        await FolderStats.findOneAndUpdate(
            { folderPath: folderPath },
            {
                folderName: folderPath.split('/').pop() || 'Root',
                totalPhotos: totalPhotos,
                availablePhotos: availableCount,
                soldPhotos: soldCount,
                lastUpdated: new Date()
            },
            { upsert: true, new: true }
        );

        console.log(`   ✅ ${folderPath}: ${availableCount}/${totalPhotos} disponíveis`);

    } catch (error) {
        console.error(`   ❌ Erro em ${folderPath}:`, error.message);
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    updateFolderStats();
}