// restaurar-selecoes-canceladas-v2.js
// Script CORRIGIDO para restaurar as 3 seleções canceladas automaticamente

const mongoose = require('mongoose');
require('dotenv').config();

// SELEÇÕES PARA RESTAURAR
const SELECOES_PARA_RESTAURAR = [
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

async function restaurarSelecoes() {
    try {
        console.log('🔧 RESTAURAÇÃO DE SELEÇÕES CANCELADAS AUTOMATICAMENTE (v2)');
        console.log('='.repeat(70));
        
        // Conectar ao MongoDB
        console.log('\n📦 Conectando ao MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado!\n');
        
        const Selection = require('./src/models/Selection');
        const UnifiedProductComplete = require('./src/models/UnifiedProductComplete');
        const PhotoCategory = require('./src/models/PhotoCategory');
        
        let totalRestauradas = 0;
        let totalFotosRestauradas = 0;
        
        for (const config of SELECOES_PARA_RESTAURAR) {
            console.log('─'.repeat(70));
            console.log(`\n🔄 RESTAURANDO: ${config.clientName} (${config.clientCode})`);
            console.log(`   SelectionId: ${config.selectionId}`);
            console.log(`   Fotos: ${config.fotos.join(', ')}`);
            
            // 1. Buscar a seleção
            const selecao = await Selection.findOne({ selectionId: config.selectionId });
            
            if (!selecao) {
                console.log(`   ❌ Seleção não encontrada!`);
                continue;
            }
            
            console.log(`   📋 Status atual: ${selecao.status}`);
            console.log(`   📦 Items atuais: ${selecao.items?.length || 0}`);
            
            // 2. Buscar as fotos no MongoDB
            const fotosParaAdicionar = [];
            
            for (const fotoName of config.fotos) {
                const foto = await UnifiedProductComplete.findOne({ fileName: fotoName });
                
                if (!foto) {
                    console.log(`   ⚠️ Foto ${fotoName} não encontrada no MongoDB`);
                    continue;
                }
                
                console.log(`   📸 Encontrada: ${fotoName} | Status: ${foto.status} | Categoria: ${foto.categoryPath || foto.category}`);
                
                // Buscar preço da categoria
                let preco = 0;
                try {
                    const categoryPath = foto.categoryPath || foto.category;
                    const categoria = await PhotoCategory.findOne({ 
                        $or: [
                            { name: categoryPath },
                            { categoryPath: categoryPath }
                        ]
                    });
                    
                    if (categoria) {
                        preco = categoria.basePrice || categoria.price || 0;
                    }
                } catch (err) {
                    console.log(`   ⚠️ Erro ao buscar preço: ${err.message}`);
                }
                
                // Preparar item para adicionar
                fotosParaAdicionar.push({
                    productId: foto._id,
                    fileName: foto.fileName,
                    category: foto.categoryPath || foto.category,
                    price: preco,
                    thumbnailUrl: foto.thumbnailUrl || `https://images.sunshinecowhides-gallery.com/_thumbnails/${foto.categoryPath || ''}/${foto.fileName}`,
                    originalPath: foto.categoryPath || foto.category,
                    driveFileId: foto.driveFileId
                });
            }
            
            if (fotosParaAdicionar.length === 0) {
                console.log(`   ❌ Nenhuma foto encontrada para restaurar`);
                continue;
            }
            
            // 3. Adicionar fotos de volta à seleção
            selecao.items = fotosParaAdicionar;
            selecao.totalItems = fotosParaAdicionar.length;
            
            // 4. Recalcular preços
            const mixMatchCategories = ['Colombian Cowhides', 'Brazil Best Sellers', 'Brazil Top Selected Categories'];
            
            let mixMatchCount = 0;
            let totalValue = 0;
            
            for (const item of selecao.items) {
                const isMixMatch = mixMatchCategories.some(cat => 
                    item.category?.includes(cat) || item.originalPath?.includes(cat)
                );
                
                if (isMixMatch) {
                    mixMatchCount++;
                }
            }
            
            // Determinar tier
            let tier = 1;
            if (mixMatchCount >= 37) tier = 4;
            else if (mixMatchCount >= 13) tier = 3;
            else if (mixMatchCount >= 6) tier = 2;
            
            console.log(`   📊 Mix & Match count: ${mixMatchCount} → Tier ${tier}`);
            
            // Buscar preços corretos
            for (const item of selecao.items) {
                try {
                    const categoria = await PhotoCategory.findOne({ 
                        $or: [
                            { name: item.category },
                            { categoryPath: item.category }
                        ]
                    });
                    
                    if (categoria && categoria.getPriceForClient) {
                        const precoInfo = categoria.getPriceForClient(config.clientCode, mixMatchCount);
                        item.price = precoInfo.finalPrice || precoInfo.price || categoria.basePrice || 0;
                    } else if (categoria) {
                        item.price = categoria.basePrice || categoria.price || 0;
                    }
                    
                    totalValue += item.price;
                } catch (err) {
                    console.log(`   ⚠️ Erro ao calcular preço de ${item.fileName}: ${err.message}`);
                }
            }
            
            selecao.totalValue = totalValue;
            
            // 5. Mudar status para PENDING
            selecao.status = 'pending';
            
            // 6. Limpar flags de problema
            selecao.priceReviewRequired = false;
            selecao.priceReviewReason = null;
            selecao.hasRetiredPhotos = false;
            selecao.retiredPhotosDetails = [];
            
            // 7. Adicionar log de restauração - USANDO ACTION VÁLIDO: 'reopened'
            selecao.movementLog = selecao.movementLog || [];
            selecao.movementLog.push({
                action: 'reopened',  // ← ACTION VÁLIDO!
                timestamp: new Date(),
                details: `✅ Seleção restaurada manualmente. ${fotosParaAdicionar.length} foto(s) recuperada(s). Novo total: $${totalValue.toFixed(2)}. Motivo: Seleção foi cancelada automaticamente pelo sync de forma incorreta.`,
                success: true,
                extraData: { 
                    restoredPhotos: config.fotos,
                    restoredBy: 'admin-script',
                    reason: 'auto-cancel-fix'
                }
            });
            
            // 8. Atualizar contadores de reopen
            selecao.reopenedAt = new Date();
            selecao.reopenedBy = 'admin-script';
            selecao.reopenCount = (selecao.reopenCount || 0) + 1;
            
            // 9. Atualizar fotos no MongoDB para vincular à seleção
            for (const item of fotosParaAdicionar) {
                await UnifiedProductComplete.updateOne(
                    { fileName: item.fileName },
                    {
                        $set: {
                            selectionId: config.selectionId,
                            status: 'in_selection'
                        }
                    }
                );
            }
            
            // 10. Salvar seleção
            await selecao.save();
            
            console.log(`\n   ✅ RESTAURADA COM SUCESSO!`);
            console.log(`   📦 Items: ${selecao.totalItems}`);
            console.log(`   💰 Valor: $${selecao.totalValue.toFixed(2)}`);
            console.log(`   📋 Status: ${selecao.status}`);
            
            totalRestauradas++;
            totalFotosRestauradas += fotosParaAdicionar.length;
        }
        
        // RESUMO FINAL
        console.log('\n' + '='.repeat(70));
        console.log('📊 RESUMO DA RESTAURAÇÃO:');
        console.log(`   ✅ Seleções restauradas: ${totalRestauradas}/${SELECOES_PARA_RESTAURAR.length}`);
        console.log(`   🖼️ Total de fotos restauradas: ${totalFotosRestauradas}`);
        console.log('='.repeat(70));
        
        if (totalRestauradas === SELECOES_PARA_RESTAURAR.length) {
            console.log('\n🎉 TODAS AS SELEÇÕES FORAM RESTAURADAS COM SUCESSO!');
        } else {
            console.log('\n⚠️ Algumas seleções não puderam ser restauradas. Verifique os logs acima.');
        }
        
    } catch (error) {
        console.error('\n❌ ERRO:', error);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n📦 Desconectado do MongoDB');
    }
}

// Confirmar antes de executar
console.log('⚠️  ATENÇÃO: Este script vai restaurar 3 seleções canceladas:');
console.log('   - Gena (5188): 6 fotos');
console.log('   - Nicole Williams (5446): 1 foto');
console.log('   - Hunter (1705): 1 foto');
console.log('\n🚀 Executando em 3 segundos...\n');

setTimeout(() => {
    restaurarSelecoes();
}, 3000);