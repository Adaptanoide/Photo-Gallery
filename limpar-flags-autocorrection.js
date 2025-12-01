// limpar-flags-autocorrection.js
// Script para limpar os flags de auto-correction das seleções restauradas

const mongoose = require('mongoose');
require('dotenv').config();

// Seleções para limpar
const SELECOES = [
    'SEL_MIM3PA3Q_L5DF4',  // Gena
    'SEL_MII1RABB_QIK3A',  // Nicole Williams
    'SEL_MIM1KIIY_00MVW'   // Hunter
];

async function limparFlags() {
    try {
        console.log('🧹 LIMPANDO FLAGS DE AUTO-CORRECTION');
        console.log('='.repeat(50));
        
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB conectado\n');
        
        const Selection = require('./src/models/Selection');
        
        for (const selectionId of SELECOES) {
            const selecao = await Selection.findOne({ selectionId });
            
            if (!selecao) {
                console.log(`❌ ${selectionId} não encontrada`);
                continue;
            }
            
            console.log(`🔄 ${selecao.clientName} (${selecao.clientCode})`);
            console.log(`   Status: ${selecao.status}`);
            console.log(`   hasAutoCorrection antes: ${selecao.hasAutoCorrection || false}`);
            console.log(`   autoCorrections antes: ${selecao.autoCorrections?.length || 0} registros`);
            
            // Limpar flags usando updateOne para bypass de validação
            await Selection.updateOne(
                { selectionId },
                {
                    $set: {
                        hasAutoCorrection: false,
                        priceReviewRequired: false,
                        priceReviewReason: null,
                        lastAutoCorrection: null
                    },
                    $unset: {
                        autoCorrections: 1
                    }
                }
            );
            
            console.log(`   ✅ Flags limpos!\n`);
        }
        
        console.log('='.repeat(50));
        console.log('🎉 LIMPEZA CONCLUÍDA!');
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n📦 Desconectado');
    }
}

limparFlags();