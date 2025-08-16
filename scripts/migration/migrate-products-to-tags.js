// migrate-products-to-tags.js

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./src/models/Product');
const PhotoStatus = require('./src/models/PhotoStatus');

async function createPhotoStatusFromProducts() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB\n');

        // 1. Buscar todos os produtos
        const products = await Product.find({});
        console.log(`📦 Encontrados ${products.length} produtos\n`);

        let created = 0;
        let skipped = 0;

        console.log('🔄 CRIANDO PhotoStatus para cada produto...\n');

        for (const product of products) {
            // Verificar se já existe
            const exists = await PhotoStatus.findOne({ photoId: product.driveFileId });

            if (exists) {
                console.log(`⏭️ Pulando ${product.fileName} - já existe PhotoStatus`);
                skipped++;
                continue;
            }

            // Criar novo PhotoStatus
            const photoStatus = new PhotoStatus({
                photoId: product.driveFileId,
                fileName: product.fileName,
                currentStatus: product.status,

                // Localização atual
                currentLocation: {
                    locationType: 'stock',
                    currentPath: product.category || 'unknown',
                    currentParentId: 'unknown',
                    currentCategory: product.category || 'unknown',
                    lastMovedAt: new Date()
                },

                // Localização original (backup)
                originalLocation: {
                    originalPath: product.category || 'unknown',
                    originalParentId: 'unknown',
                    originalCategory: product.category || 'unknown',
                    originalPrice: product.price || 0
                },

                // NOVO: Sistema de tags
                virtualStatus: {
                    status: product.status === 'sold' ? 'sold' :
                        product.status === 'reserved' ? 'reserved' : 'available',
                    currentSelection: null,
                    clientCode: null,
                    tags: [],
                    lastStatusChange: new Date()
                }
            });

            await photoStatus.save();
            created++;
            console.log(`✅ [${created}] Criado PhotoStatus para: ${product.fileName}`);
        }

        console.log('\n📊 RESUMO DA MIGRAÇÃO:');
        console.log(`   ✅ Criados: ${created} PhotoStatus`);
        console.log(`   ⏭️ Pulados: ${skipped} (já existiam)`);
        console.log(`   📦 Total: ${created + skipped} produtos processados`);

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Desconectado');
    }
}

console.log('🚀 INICIANDO CRIAÇÃO DE PHOTOSTATUS...\n');
console.log('⚠️ Isso vai criar um PhotoStatus para cada Product!\n');

// Dar 3 segundos para cancelar se necessário
console.log('Iniciando em 3 segundos... (Ctrl+C para cancelar)\n');
setTimeout(() => {
    createPhotoStatusFromProducts();
}, 3000);