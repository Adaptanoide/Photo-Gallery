// corrigir-alertas-selecoes.js
// Limpa logs de auto-correction e marca como hasRetiredPhotos para mostrar alerta correto

const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Seleções para corrigir
const SELECOES = [
    { selectionId: 'SEL_MIM3PA3Q_L5DF4', clientName: 'Gena', clientCode: '5188' },
    { selectionId: 'SEL_MII1RABB_QIK3A', clientName: 'Nicole Williams', clientCode: '5446' }
];

async function corrigirAlertas() {
    let cdeConnection = null;
    
    try {
        console.log('🔧 CORRIGINDO ALERTAS DAS SELEÇÕES');
        console.log('='.repeat(60));
        
        // Conectar MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB conectado');
        
        // Conectar CDE
        cdeConnection = await mysql.createConnection({
            host: process.env.CDE_HOST || '216.246.112.6',
            user: process.env.CDE_USER || 'tzwgctib_photos',
            password: process.env.CDE_PASSWORD || 'T14g0@photos',
            database: process.env.CDE_DATABASE || 'tzwgctib_inventario'
        });
        console.log('✅ CDE conectado\n');
        
        const Selection = require('./src/models/Selection');
        
        for (const config of SELECOES) {
            console.log('─'.repeat(60));
            console.log(`🔄 ${config.clientName} (${config.clientCode})`);
            
            // Buscar seleção
            const selecao = await Selection.findOne({ selectionId: config.selectionId });
            
            if (!selecao) {
                console.log(`   ❌ Seleção não encontrada`);
                continue;
            }
            
            console.log(`   📋 Status: ${selecao.status}`);
            console.log(`   📦 Items: ${selecao.items?.length || 0}`);
            
            // Verificar estado das fotos no CDE
            const retiredPhotosDetails = [];
            
            for (const item of selecao.items || []) {
                const fileName = item.fileName || '';
                const photoNumber = fileName.match(/(\d+)/)?.[1];
                
                if (!photoNumber) continue;
                
                // Consultar CDE
                const [rows] = await cdeConnection.execute(
                    'SELECT AESTADOP, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA = ?',
                    [photoNumber.padStart(5, '0')]
                );
                
                if (rows.length > 0) {
                    const estadoCDE = rows[0].AESTADOP;
                    const reservedUsu = rows[0].RESERVEDUSU || '';
                    
                    console.log(`   📸 ${fileName}: CDE=${estadoCDE} | RESERVEDUSU=${reservedUsu}`);
                    
                    // Se está RETIRADO, adicionar ao array
                    if (estadoCDE === 'RETIRADO') {
                        retiredPhotosDetails.push({
                            fileName: fileName,
                            photoNumber: photoNumber,
                            reservedUsu: reservedUsu,
                            detectedAt: new Date()
                        });
                    }
                }
            }
            
            // Contar logs de item_auto_removed antes
            const logsAntes = (selecao.movementLog || []).filter(
                log => log.action === 'item_auto_removed'
            ).length;
            
            console.log(`\n   📜 Logs item_auto_removed antes: ${logsAntes}`);
            
            // Remover logs de item_auto_removed do movementLog
            if (selecao.movementLog) {
                selecao.movementLog = selecao.movementLog.filter(
                    log => log.action !== 'item_auto_removed'
                );
            }
            
            const logsDepois = (selecao.movementLog || []).filter(
                log => log.action === 'item_auto_removed'
            ).length;
            
            console.log(`   📜 Logs item_auto_removed depois: ${logsDepois}`);
            
            // Atualizar flags
            if (retiredPhotosDetails.length > 0) {
                selecao.hasRetiredPhotos = true;
                selecao.retiredPhotosDetails = retiredPhotosDetails;
                console.log(`\n   ✅ Marcado hasRetiredPhotos = true (${retiredPhotosDetails.length} fotos RETIRADO)`);
            } else {
                selecao.hasRetiredPhotos = false;
                selecao.retiredPhotosDetails = [];
                console.log(`\n   ℹ️ Nenhuma foto RETIRADO encontrada`);
            }
            
            // Limpar outros flags
            selecao.lastAutoCorrection = null;
            selecao.priceReviewRequired = false;
            selecao.priceReviewReason = null;
            
            // Salvar
            await selecao.save();
            console.log(`   ✅ Seleção salva!`);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 CORREÇÃO CONCLUÍDA!');
        console.log('='.repeat(60));
        console.log('\n📋 Resultado esperado:');
        console.log('   - Badge "Auto-Corrected" (laranja) → NÃO aparece mais');
        console.log('   - Badge "RETIRADO" (azul) → Aparece se fotos estão RETIRADO no CDE');
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
        console.error(error.stack);
    } finally {
        if (cdeConnection) await cdeConnection.end();
        await mongoose.disconnect();
        console.log('\n📦 Desconectado');
    }
}

corrigirAlertas();