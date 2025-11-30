// reverter-selecao-gena.js
// Script para reverter a seleção da GENA ao estado original (6 fotos, Tier 2)

const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Dados da foto removida
const FOTO_REMOVIDA = {
    photoNumber: '26696',
    fileName: '26696.webp',
    category: 'Brazil Best Sellers → Super Promo Small - Assorted Natural Tones',
    driveFileId: 'Brazil Best Sellers/Super Promo Small - Assorted Natural Tones/26696.webp'
};

const SELECAO_ID = 'SEL_MIM3PA3Q_L5DF4';
const CLIENT_CODE = '5188';
const CLIENT_NAME = 'GENA';
const SALES_REP = 'karen';

// Preços Tier 2 (6-12 items)
const PRECOS_TIER_2 = {
    'Brazil Best Sellers': 105,
    'Brazil Top Selected Categories': 165
};

async function reverterSelecaoGena() {
    let mongoConnection = null;
    let cdeConnection = null;
    
    try {
        console.log('🔄 REVERTENDO SELEÇÃO DA GENA AO ESTADO ORIGINAL');
        console.log('='.repeat(60));
        
        // 1. Conectar ao MongoDB
        console.log('\n📦 Conectando ao MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://easyadmin:2NwxuiOlK57wH8cY@cluster.tsbl7y8.mongodb.net/sunshine_cowhides?retryWrites=true&w=majority&appName=Cluster');
        console.log('✅ MongoDB conectado!');
        
        // 2. Conectar ao CDE
        console.log('\n🔌 Conectando ao CDE...');
        cdeConnection = await mysql.createConnection({
            host: process.env.CDE_HOST || '216.246.112.6',
            port: process.env.CDE_PORT || 3306,
            user: process.env.CDE_USER || 'tzwgctib_photos',
            password: process.env.CDE_PASSWORD || 'T14g0@photos',
            database: process.env.CDE_DATABASE || 'tzwgctib_inventario'
        });
        console.log('✅ CDE conectado!');
        
        // 3. Verificar estado atual no CDE
        console.log('\n📊 ESTADO ATUAL NO CDE:');
        const [rowsAntes] = await cdeConnection.execute(
            'SELECT AESTADOP, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA = ?',
            [FOTO_REMOVIDA.photoNumber.padStart(5, '0')]
        );
        
        if (rowsAntes.length > 0) {
            console.log(`   Foto: ${FOTO_REMOVIDA.photoNumber}`);
            console.log(`   Estado: ${rowsAntes[0].AESTADOP}`);
            console.log(`   RESERVEDUSU: ${rowsAntes[0].RESERVEDUSU || '(vazio)'}`);
        }
        
        // 4. Reverter CDE para CONFIRMED
        console.log('\n🔧 REVERTENDO CDE...');
        const reservedUsu = `${CLIENT_NAME}-${CLIENT_CODE}(${SALES_REP})`;
        
        await cdeConnection.execute(
            `UPDATE tbinventario 
             SET AESTADOP = 'CONFIRMED', RESERVEDUSU = ?
             WHERE ATIPOETIQUETA = ?`,
            [reservedUsu, FOTO_REMOVIDA.photoNumber.padStart(5, '0')]
        );
        console.log(`✅ CDE revertido: CONFIRMED | ${reservedUsu}`);
        
        // 5. Buscar a seleção no MongoDB
        console.log('\n📋 BUSCANDO SELEÇÃO NO MONGODB...');
        const Selection = require('./src/models/Selection');
        const UnifiedProductComplete = require('./src/models/UnifiedProductComplete');
        
        const selecao = await Selection.findOne({ selectionId: SELECAO_ID });
        
        if (!selecao) {
            throw new Error(`Seleção ${SELECAO_ID} não encontrada!`);
        }
        
        console.log(`✅ Seleção encontrada: ${selecao.clientName}`);
        console.log(`   Items atuais: ${selecao.items.length}`);
        console.log(`   Total atual: $${selecao.totalValue}`);
        
        // 6. Verificar se a foto já está na seleção
        const fotoJaExiste = selecao.items.some(item => item.fileName === FOTO_REMOVIDA.fileName);
        
        if (fotoJaExiste) {
            console.log(`⚠️ Foto ${FOTO_REMOVIDA.fileName} já existe na seleção!`);
        } else {
            // 7. Buscar o produto no MongoDB
            console.log('\n🔍 BUSCANDO PRODUTO NO MONGODB...');
            let produto = await UnifiedProductComplete.findOne({ 
                fileName: FOTO_REMOVIDA.fileName 
            });
            
            if (!produto) {
                // Tentar buscar por driveFileId
                produto = await UnifiedProductComplete.findOne({
                    driveFileId: FOTO_REMOVIDA.driveFileId
                });
            }
            
            if (!produto) {
                console.log(`⚠️ Produto não encontrado, criando referência...`);
                // Usar dados mínimos
                produto = { _id: new mongoose.Types.ObjectId() };
            } else {
                console.log(`✅ Produto encontrado: ${produto.fileName}`);
            }
            
            // 8. Adicionar foto de volta à seleção
            console.log('\n➕ ADICIONANDO FOTO À SELEÇÃO...');
            
            const novoItem = {
                productId: produto._id,
                driveFileId: FOTO_REMOVIDA.driveFileId,
                fileName: FOTO_REMOVIDA.fileName,
                category: FOTO_REMOVIDA.category,
                thumbnailUrl: `https://images.sunshinecowhides-gallery.com/_thumbnails/${FOTO_REMOVIDA.driveFileId}`,
                originalPath: FOTO_REMOVIDA.category,
                price: PRECOS_TIER_2['Brazil Best Sellers'], // $105 para Tier 2
                selectedAt: new Date()
            };
            
            selecao.items.push(novoItem);
            console.log(`✅ Foto adicionada: ${FOTO_REMOVIDA.fileName}`);
            
            // 9. Atualizar produto no MongoDB
            if (produto.fileName) {
                await UnifiedProductComplete.updateOne(
                    { _id: produto._id },
                    {
                        $set: {
                            status: 'in_selection',
                            cdeStatus: 'CONFIRMED',
                            selectionId: SELECAO_ID,
                            'reservedBy.clientCode': CLIENT_CODE,
                            'reservedBy.inSelection': true,
                            'reservedBy.selectionId': SELECAO_ID
                        }
                    }
                );
                console.log(`✅ Produto atualizado no MongoDB`);
            }
        }
        
        // 10. Recalcular TODOS os preços para Tier 2
        console.log('\n🧮 RECALCULANDO PREÇOS PARA TIER 2...');
        
        let novoTotal = 0;
        for (const item of selecao.items) {
            const categoria = item.category || '';
            let novoPreco;
            
            if (categoria.includes('Brazil Best Sellers')) {
                novoPreco = PRECOS_TIER_2['Brazil Best Sellers']; // $105
            } else if (categoria.includes('Brazil Top Selected')) {
                novoPreco = PRECOS_TIER_2['Brazil Top Selected Categories']; // $165
            } else {
                novoPreco = item.price; // Manter preço atual
            }
            
            if (item.price !== novoPreco) {
                console.log(`   📝 ${item.fileName}: $${item.price} → $${novoPreco}`);
            }
            
            item.price = novoPreco;
            novoTotal += novoPreco;
        }
        
        // 11. Atualizar totais
        selecao.totalItems = selecao.items.length;
        selecao.totalValue = novoTotal;
        selecao.priceReviewRequired = false;
        selecao.priceReviewReason = null;
        
        // 12. Adicionar log de reversão
        selecao.movementLog.push({
            action: 'reverted',
            timestamp: new Date(),
            details: `Seleção revertida manualmente ao estado original. Foto ${FOTO_REMOVIDA.fileName} adicionada de volta. Preços recalculados para Tier 2.`,
            success: true,
            extraData: {
                fotoAdicionada: FOTO_REMOVIDA.fileName,
                tierRestaurado: 'Tier 2 (6-12)',
                novoTotal: novoTotal
            }
        });
        
        // 13. Salvar seleção
        await selecao.save();
        
        // 14. Verificar resultado final
        console.log('\n' + '='.repeat(60));
        console.log('✅ REVERSÃO COMPLETA!');
        console.log('='.repeat(60));
        console.log(`\n📊 ESTADO FINAL DA SELEÇÃO:`);
        console.log(`   Selection ID: ${selecao.selectionId}`);
        console.log(`   Cliente: ${selecao.clientName} (${selecao.clientCode})`);
        console.log(`   Total Items: ${selecao.totalItems}`);
        console.log(`   Total Value: $${selecao.totalValue.toFixed(2)}`);
        console.log(`   Tier: Tier 2 (6-12)`);
        
        console.log(`\n📦 ITEMS:`);
        selecao.items.forEach((item, i) => {
            console.log(`   ${i+1}. ${item.fileName} - $${item.price}`);
        });
        
        // Verificar CDE final
        const [rowsDepois] = await cdeConnection.execute(
            'SELECT AESTADOP, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA = ?',
            [FOTO_REMOVIDA.photoNumber.padStart(5, '0')]
        );
        
        console.log(`\n📊 ESTADO FINAL NO CDE:`);
        console.log(`   Foto: ${FOTO_REMOVIDA.photoNumber}`);
        console.log(`   Estado: ${rowsDepois[0].AESTADOP}`);
        console.log(`   RESERVEDUSU: ${rowsDepois[0].RESERVEDUSU}`);
        
    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error.stack);
    } finally {
        if (cdeConnection) {
            await cdeConnection.end();
            console.log('\n🔌 CDE desconectado');
        }
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('📦 MongoDB desconectado');
        }
    }
}

// Executar
reverterSelecaoGena();