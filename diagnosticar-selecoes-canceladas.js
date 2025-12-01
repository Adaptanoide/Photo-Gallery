// diagnosticar-selecoes-canceladas.js
// Script para analisar seleções canceladas automaticamente pelo sync

const mongoose = require('mongoose');
require('dotenv').config();

async function diagnosticar() {
    try {
        console.log('🔍 DIAGNÓSTICO DE SELEÇÕES CANCELADAS AUTOMATICAMENTE');
        console.log('='.repeat(70));
        
        // Conectar ao MongoDB
        console.log('\n📦 Conectando ao MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado!\n');
        
        const Selection = require('./src/models/Selection');
        
        // Buscar seleções canceladas que têm "cancelada automaticamente" no log
        const selecoesCanceladas = await Selection.find({
            status: 'cancelled',
            'movementLog.details': { $regex: /cancelada automaticamente|auto.*removed/i }
        }).sort({ updatedAt: -1 });
        
        console.log(`📋 Encontradas ${selecoesCanceladas.length} seleções canceladas automaticamente:\n`);
        
        for (const sel of selecoesCanceladas) {
            console.log('─'.repeat(70));
            console.log(`👤 Cliente: ${sel.clientName} (${sel.clientCode})`);
            console.log(`🆔 SelectionId: ${sel.selectionId}`);
            console.log(`📅 Cancelada em: ${sel.updatedAt}`);
            console.log(`📦 Items atuais: ${sel.items?.length || 0}`);
            console.log(`💰 Valor atual: $${sel.totalValue || 0}`);
            
            // Procurar no movementLog as fotos que foram removidas
            const logsRemocao = sel.movementLog?.filter(log => 
                log.action === 'item_auto_removed' || 
                log.details?.includes('removida')
            ) || [];
            
            if (logsRemocao.length > 0) {
                console.log(`\n📜 HISTÓRICO DE REMOÇÕES:`);
                
                let fotosRemovidas = [];
                
                for (const log of logsRemocao) {
                    console.log(`   📅 ${log.timestamp}`);
                    console.log(`   📝 ${log.details}`);
                    
                    // Extrair fotos removidas do metadata ou do texto
                    if (log.metadata?.removedPhotos) {
                        fotosRemovidas = fotosRemovidas.concat(log.metadata.removedPhotos);
                    } else {
                        // Tentar extrair do texto (ex: "Fotos: 11647.webp, 16235.webp")
                        const match = log.details?.match(/Fotos?:\s*([^\.\n]+)/i);
                        if (match) {
                            const fotos = match[1].split(',').map(f => f.trim());
                            fotosRemovidas = fotosRemovidas.concat(fotos);
                        }
                    }
                    console.log('');
                }
                
                if (fotosRemovidas.length > 0) {
                    console.log(`   🖼️ FOTOS PARA RESTAURAR:`);
                    fotosRemovidas.forEach(f => console.log(`      - ${f}`));
                }
            }
            
            // Log de cancelamento
            const logCancelamento = sel.movementLog?.find(log => 
                log.action === 'cancelled' && log.details?.includes('automaticamente')
            );
            
            if (logCancelamento) {
                console.log(`\n❌ CANCELAMENTO:`);
                console.log(`   📅 ${logCancelamento.timestamp}`);
                console.log(`   📝 ${logCancelamento.details}`);
            }
            
            console.log('');
        }
        
        // Resumo
        console.log('='.repeat(70));
        console.log('📊 RESUMO:');
        console.log(`   Total de seleções canceladas automaticamente: ${selecoesCanceladas.length}`);
        
        if (selecoesCanceladas.length > 0) {
            console.log(`\n🔧 PRÓXIMO PASSO:`);
            console.log(`   Execute o script de restauração para recuperar essas seleções.`);
        }
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n📦 Desconectado do MongoDB');
    }
}

diagnosticar();