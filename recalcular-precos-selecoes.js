// recalcular-precos-selecoes.js
// Script para recalcular os preços das seleções restauradas

const mongoose = require('mongoose');
require('dotenv').config();

// SELEÇÕES PARA RECALCULAR
const SELECOES = [
    { selectionId: 'SEL_MIM3PA3Q_L5DF4', clientName: 'Gena', clientCode: '5188' },
    { selectionId: 'SEL_MII1RABB_QIK3A', clientName: 'Nicole Williams', clientCode: '5446' },
    { selectionId: 'SEL_MIM1KIIY_00MVW', clientName: 'Hunter', clientCode: '1705' }
];

// Categorias Mix & Match
const MIX_MATCH_CATEGORIES = [
    'Colombian Cowhides',
    'Brazil Best Sellers', 
    'Brazil Top Selected Categories'
];

async function recalcularPrecos() {
    try {
        console.log('💰 RECALCULANDO PREÇOS DAS SELEÇÕES');
        console.log('='.repeat(60));
        
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB conectado\n');
        
        const Selection = require('./src/models/Selection');
        const PhotoCategory = require('./src/models/PhotoCategory');
        
        for (const config of SELECOES) {
            console.log('─'.repeat(60));
            console.log(`\n🔄 ${config.clientName} (${config.clientCode})`);
            console.log(`   SelectionId: ${config.selectionId}`);
            
            // 1. Buscar a seleção
            const selecao = await Selection.findOne({ selectionId: config.selectionId });
            
            if (!selecao) {
                console.log(`   ❌ Seleção não encontrada`);
                continue;
            }
            
            console.log(`   📦 Items: ${selecao.items?.length || 0}`);
            
            if (!selecao.items || selecao.items.length === 0) {
                console.log(`   ⚠️ Seleção sem items`);
                continue;
            }
            
            // 2. Contar items Mix & Match para determinar tier
            let mixMatchCount = 0;
            
            for (const item of selecao.items) {
                const category = item.category || item.originalPath || '';
                const isMixMatch = MIX_MATCH_CATEGORIES.some(cat => category.includes(cat));
                if (isMixMatch) {
                    mixMatchCount++;
                }
            }
            
            // Determinar tier
            let tier = 1;
            let tierName = 'Tier 1 (1-5)';
            if (mixMatchCount >= 37) {
                tier = 4;
                tierName = 'Tier 4 (37+)';
            } else if (mixMatchCount >= 13) {
                tier = 3;
                tierName = 'Tier 3 (13-36)';
            } else if (mixMatchCount >= 6) {
                tier = 2;
                tierName = 'Tier 2 (6-12)';
            }
            
            console.log(`   📊 Mix & Match: ${mixMatchCount} items → ${tierName}`);
            
            // 3. Recalcular preço de cada item
            let totalValue = 0;
            let itemsAtualizados = 0;
            
            for (const item of selecao.items) {
                const category = item.category || item.originalPath || '';
                
                // Buscar PhotoCategory
                const photoCategory = await PhotoCategory.findOne({
                    $or: [
                        { displayName: { $regex: category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
                        { googleDrivePath: { $regex: category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
                    ],
                    isActive: true
                });
                
                if (!photoCategory) {
                    console.log(`   ⚠️ Categoria não encontrada: ${category}`);
                    console.log(`      Mantendo preço atual: $${item.price}`);
                    totalValue += item.price || 0;
                    continue;
                }
                
                // Verificar se é Mix & Match
                const isMixMatch = MIX_MATCH_CATEGORIES.some(cat => category.includes(cat));
                
                // Quantidade para cálculo (Mix & Match usa contagem global)
                const quantityForPricing = isMixMatch ? mixMatchCount : 1;
                
                // Calcular preço
                const precoInfo = await photoCategory.getPriceForClient(config.clientCode, quantityForPricing);
                const novoPreco = precoInfo.finalPrice || photoCategory.basePrice || 0;
                
                const precoAntigo = item.price;
                item.price = novoPreco;
                totalValue += novoPreco;
                itemsAtualizados++;
                
                console.log(`   📸 ${item.fileName}: $${precoAntigo} → $${novoPreco} (${precoInfo.appliedRule})`);
            }
            
            // 4. Atualizar totais
            const valorAntigo = selecao.totalValue;
            selecao.totalValue = totalValue;
            selecao.priceReviewRequired = false;
            selecao.priceReviewReason = null;
            
            // 5. Salvar
            await selecao.save();
            
            console.log(`\n   ✅ PREÇOS ATUALIZADOS!`);
            console.log(`   💰 Valor: $${valorAntigo.toFixed(2)} → $${totalValue.toFixed(2)}`);
            console.log(`   📦 Items atualizados: ${itemsAtualizados}`);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 RECÁLCULO CONCLUÍDO!');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n📦 Desconectado');
    }
}

console.log('🚀 Executando...\n');
recalcularPrecos();