const mongoose = require('mongoose');

class StatusMonitor {
    static async getRecentChanges(minutes = 1) {
        const db = mongoose.connection.db;
        const since = new Date(Date.now() - (minutes * 60000));
        const changes = [];

        try {
            // 1. Monitorar mudanças em products (reservas temporárias)
            const products = await db.collection('products')
                .find({
                    $or: [
                        { updatedAt: { $gte: since } },
                        { createdAt: { $gte: since } },
                        { status: 'reserved' }  // Incluir todos os reserved atuais
                    ]
                })
                .project({
                    driveFileId: 1,
                    status: 1,
                    updatedAt: 1,
                    reservedBy: 1
                })
                .toArray();

            // 2. Monitorar mudanças em photostatuses (vendas CDE)
            const photoStatuses = await db.collection('photostatuses')
                .find({
                    updatedAt: { $gte: since },
                    currentStatus: 'sold'
                })
                .project({
                    photoId: 1,
                    currentStatus: 1
                })
                .toArray();

            // Processar products
            for (const product of products) {
                // CORREÇÃO 1: Verificar se driveFileId existe
                if (!product.driveFileId) {
                    continue; // Pular este produto
                }
                
                const photoId = product.driveFileId
                    .split('/').pop()
                    .replace('.webp', '');

                changes.push({
                    id: photoId,
                    status: product.status,
                    source: 'reservation',
                    sessionId: product.reservedBy ? product.reservedBy.sessionId : null
                });
            }

            // Processar photostatuses
            for (const photo of photoStatuses) {
                changes.push({
                    id: photo.photoId,
                    status: photo.currentStatus,
                    source: 'cde'
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
            const recentlyDeleted = await db.collection('products')
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