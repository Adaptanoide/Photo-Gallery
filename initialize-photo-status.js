require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./src/models/Product');
const PhotoStatus = require('./src/models/PhotoStatus');

async function initialize() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('🚀 INICIALIZANDO SISTEMA DE PHOTO STATUS...\n');
    
    // 1. Buscar todos os produtos
    const products = await Product.find({});
    console.log(`📊 Encontrados ${products.length} produtos\n`);
    
    let created = 0;
    let skipped = 0;
    
    for (const product of products) {
        // Verificar se já existe PhotoStatus
        const exists = await PhotoStatus.findOne({ photoId: product.driveFileId });
        
        if (exists) {
            console.log(`⏭️  Pulando ${product.fileName} (já existe)`);
            skipped++;
            continue;
        }
        
        // Criar novo PhotoStatus
        const photoStatus = new PhotoStatus({
            photoId: product.driveFileId,
            fileName: product.fileName,
            currentStatus: 'available',
            
            // Localização atual (usando dados do R2)
            currentLocation: {
                locationType: 'stock',
                currentPath: product.driveFileId,
                currentParentId: product.category,
                currentCategory: product.category
            },
            
            // Localização original (backup)
            originalLocation: {
                originalPath: product.driveFileId,
                originalParentId: product.category,
                originalCategory: product.category,
                originalPrice: product.price || 0
            },
            
            // Sistema de tags virtual (IMPORTANTE!)
            virtualStatus: {
                status: 'available',
                currentSelection: null,
                clientCode: null,
                tags: ['available'],
                lastStatusChange: new Date()
            },
            
            // Pricing
            currentPricing: {
                currentPrice: product.price || 0,
                hasPrice: product.price > 0,
                priceSource: 'category',
                formattedPrice: product.price > 0 ? `$${product.price}` : 'No price'
            }
        });
        
        await photoStatus.save();
        created++;
        console.log(`✅ Criado PhotoStatus para ${product.fileName}`);
    }
    
    console.log('\n📊 RESUMO:');
    console.log(`✅ Criados: ${created}`);
    console.log(`⏭️  Pulados: ${skipped}`);
    console.log(`📦 Total PhotoStatus agora: ${await PhotoStatus.countDocuments()}`);
    
    await mongoose.disconnect();
}

initialize();
