const mongoose = require('mongoose');

class StatusMonitor {
    static async getRecentChanges(minutes = 1) {
        const db = mongoose.connection.db;
        const since = new Date(Date.now() - (minutes * 60000));
        const changes = [];

        try {
            // Buscar da NOVA collection unificada
            const products = await db.collection('unified_products_complete')
                .find({
                    $or: [
                        { updatedAt: { $gte: since } },
                        { createdAt: { $gte: since } },
                        { status: 'reserved' }  // Incluir todos os reserved atuais
                    ]
                })
                .project({
                    driveFileId: 1,
                    photoNumber: 1,
                    fileName: 1,
                    status: 1,
                    updatedAt: 1,
                    reservedBy: 1
                })
                .toArray();

            // Processar products
            for (const product of products) {
                // Usar photoNumber ao invés de extrair do driveFileId
                const photoId = product.photoNumber ||
                    product.fileName?.replace('.webp', '') ||
                    product.driveFileId?.split('/').pop().replace('.webp', '');

                if (!photoId) continue;

                changes.push({
                    id: photoId,
                    status: product.status,
                    source: 'reservation',
                    sessionId: product.reservedBy ? product.reservedBy.sessionId : null
                });
            }

            // Se uma foto não está mais em products, está available
            const productIds = new Set();

            // CORREÇÃO 2: Filtrar produtos com driveFileId antes de mapear
            products.forEach(p => {
                if (p.driveFileId) {
                    const id = p.driveFileId.split('/').pop().replace('.webp', '');
                    productIds.add(id);
                }
            });

            // Buscar fotos que foram liberadas (não estão mais em products)
            const recentlyDeleted = await db.collection('unified_products_complete')
                .find({
                    status: 'available',
                    updatedAt: { $gte: since }
                })
                .toArray();

            // Adicionar fotos explicitamente marcadas como available
            for (const freed of recentlyDeleted) {
                // CORREÇÃO 3: Verificar se driveFileId existe
                if (!freed.driveFileId) {
                    continue; // Pular este produto
                }

                const photoId = freed.driveFileId
                    .split('/').pop()
                    .replace('.webp', '');

                if (!productIds.has(photoId)) {
                    changes.push({
                        id: photoId,
                        status: 'available',
                        source: 'freed'
                    });
                }
            }

            // Remover duplicatas, mantendo a mudança mais recente
            const uniqueChanges = {};
            changes.forEach(change => {
                uniqueChanges[change.id] = change;
            });

            return Object.values(uniqueChanges);

        } catch (error) {
            console.error('Erro no StatusMonitor:', error);
            return [];
        }
    }
}

module.exports = StatusMonitor;