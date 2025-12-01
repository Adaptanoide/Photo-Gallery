// restaurar-selecoes-v3.js
// Script SIMPLES - apenas restaura os dados, SEM adicionar movementLog

const mongoose = require('mongoose');
require('dotenv').config();

// SELEÇÕES PARA RESTAURAR
const SELECOES = [
    {
        selectionId: 'SEL_MIM3PA3Q_L5DF4',
        clientName: 'Gena',
        clientCode: '5188',
        fotos: ['11647.webp', '16235.webp', '16342.webp', '25352.webp', '24830.webp', '26696.webp']
    },
    {
        selectionId: 'SEL_MII1RABB_QIK3A',
        clientName: 'Nicole Williams',
        clientCode: '5446',
        fotos: ['31894.webp']
    },
    {
        selectionId: 'SEL_MIM1KIIY_00MVW',
        clientName: 'Hunter',
        clientCode: '1705',
        fotos: ['19169.webp']
    }
];

async function restaurar() {
    try {
        console.log('🔧 RESTAURAÇÃO SIMPLES (v3)');
        console.log('='.repeat(60));
        
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB conectado\n');
        
        const Selection = require('./src/models/Selection');
        const UnifiedProductComplete = require('./src/models/UnifiedProductComplete');
        
        for (const config of SELECOES) {
            console.log('─'.repeat(60));
            console.log(`🔄 ${config.clientName} (${config.clientCode})`);
            
            // 1. Buscar fotos
            const fotos = await UnifiedProductComplete.find({ 
                fileName: { $in: config.fotos } 
            });
            
            console.log(`   📸 Fotos encontradas: ${fotos.length}/${config.fotos.length}`);
            
            if (fotos.length === 0) {
                console.log(`   ❌ Nenhuma foto encontrada`);
                continue;
            }
            
            // 2. Montar array de items
            const items = fotos.map(foto => ({
                productId: foto._id,
                fileName: foto.fileName,
                category: foto.categoryPath || foto.category,
                price: 100, // Preço temporário - admin pode recalcular
                thumbnailUrl: foto.thumbnailUrl,
                originalPath: foto.categoryPath || foto.category,
                driveFileId: foto.driveFileId
            }));
            
            // 3. Atualizar seleção diretamente no MongoDB (bypass validation)
            const resultado = await Selection.updateOne(
                { selectionId: config.selectionId },
                {
                    $set: {
                        status: 'pending',
                        items: items,
                        totalItems: items.length,
                        totalValue: items.length * 100, // Temporário
                        priceReviewRequired: true,
                        priceReviewReason: 'Seleção restaurada - verificar preços',
                        hasRetiredPhotos: false,
                        retiredPhotosDetails: []
                    }
                }
            );
            
            if (resultado.modifiedCount > 0) {
                console.log(`   ✅ Seleção restaurada para PENDING`);
                console.log(`   📦 Items: ${items.length}`);
            } else {
                console.log(`   ⚠️ Seleção não foi modificada`);
            }
            
            // 4. Atualizar fotos para vincular à seleção
            const updateFotos = await UnifiedProductComplete.updateMany(
                { fileName: { $in: config.fotos } },
                {
                    $set: {
                        selectionId: config.selectionId,
                        status: 'in_selection'
                    }
                }
            );
            
            console.log(`   🖼️ Fotos atualizadas: ${updateFotos.modifiedCount}`);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 RESTAURAÇÃO CONCLUÍDA!');
        console.log('='.repeat(60));
        console.log('\n⚠️  IMPORTANTE: Os preços estão temporários ($100 cada).');
        console.log('   Abra cada seleção no admin e os preços serão recalculados.');
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n📦 Desconectado');
    }
}

console.log('🚀 Executando...\n');
restaurar();