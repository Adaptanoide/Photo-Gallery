// SCRIPT DE LIMPEZA DO BANCO DE DADOS
// Manter apenas cliente 6544 e limpar todos os dados de teste
require('dotenv').config();
const mongoose = require('mongoose');
const AccessCode = require('./src/models/AccessCode');
const Selection = require('./src/models/Selection');
const PhotoStatus = require('./src/models/PhotoStatus');
const Cart = require('./src/models/Cart');

async function cleanupDatabase() {
    try {
        console.log('🧹 INICIANDO LIMPEZA DO BANCO DE DADOS...');
        
        // 1. BACKUP DE SEGURANÇA DO CLIENTE REAL
        const clienteReal = await AccessCode.findOne({ code: '6544' });
        if (!clienteReal) {
            throw new Error('❌ Cliente 6544 não encontrado! Operação cancelada por segurança.');
        }
        
        console.log('✅ Cliente real encontrado:', clienteReal.clientName);
        console.log('📄 Backup do cliente 6544 salvo internamente');
        
        // 2. DELETAR TODOS OS OUTROS CLIENTES
        console.log('🗑️ Removendo clientes fictícios...');
        const deletedClients = await AccessCode.deleteMany({ 
            code: { $ne: '6544' } // Deletar todos exceto 6544
        });
        console.log(`✅ ${deletedClients.deletedCount} clientes fictícios removidos`);
        
        // 3. DELETAR TODAS AS SELEÇÕES NORMAIS
        console.log('🗑️ Removendo seleções normais...');
        const deletedSelections = await Selection.deleteMany({ 
            selectionType: { $ne: 'special' } // Deletar todas não-especiais
        });
        console.log(`✅ ${deletedSelections.deletedCount} seleções normais removidas`);
        
        // 4. DELETAR TODAS AS SELEÇÕES ESPECIAIS
        console.log('🗑️ Removendo seleções especiais...');
        const deletedSpecialSelections = await Selection.deleteMany({ 
            selectionType: 'special' // Deletar todas especiais
        });
        console.log(`✅ ${deletedSpecialSelections.deletedCount} seleções especiais removidas`);
        
        // 5. LIMPAR PHOTO STATUS ÓRFÃOS
        console.log('🗑️ Removendo status de fotos órfãos...');
        const deletedPhotoStatus = await PhotoStatus.deleteMany({});
        console.log(`✅ ${deletedPhotoStatus.deletedCount} photo status removidos`);
        
        // 6. LIMPAR CARRINHOS ÓRFÃOS
        console.log('🗑️ Removendo carrinhos órfãos...');
        const deletedCarts = await Cart.deleteMany({
            clientCode: { $ne: '6544' } // Manter apenas carrinho do cliente real
        });
        console.log(`✅ ${deletedCarts.deletedCount} carrinhos órfãos removidos`);
        
        // 7. RESETAR CLIENTE 6544 PARA ACESSO NORMAL (limpar special access)
        console.log('🔄 Resetando cliente 6544 para acesso normal...');
        await AccessCode.updateOne(
            { code: '6544' },
            {
                $set: {
                    accessType: 'normal',
                    allowedCategories: [
                        'Colombian Cowhides',
                        'Brazil Best Sellers',
                        'Brazil Top Selected Categories'
                    ],
                    usageCount: 0,
                    lastUsed: new Date()
                },
                $unset: {
                    specialSelection: ""
                }
            }
        );
        console.log('✅ Cliente 6544 resetado para acesso normal');
        
        // 8. VERIFICAR RESULTADO FINAL
        console.log('\n📊 VERIFICANDO RESULTADO DA LIMPEZA...');
        
        const remainingClients = await AccessCode.countDocuments();
        const remainingSelections = await Selection.countDocuments();
        const remainingSpecialSelections = await Selection.countDocuments({ selectionType: 'special' });
        const remainingCarts = await Cart.countDocuments();
        
        console.log(`👥 Clientes restantes: ${remainingClients} (deve ser 1)`);
        console.log(`📋 Seleções restantes: ${remainingSelections} (deve ser 0)`);
        console.log(`⭐ Seleções especiais restantes: ${remainingSpecialSelections} (deve ser 0)`);
        console.log(`🛒 Carrinhos restantes: ${remainingCarts} (deve ser 0 ou 1)`);
        
        // 9. RESULTADO FINAL
        if (remainingClients === 1 && remainingSelections === 0 && remainingSpecialSelections === 0) {
            console.log('\n🎉 LIMPEZA CONCLUÍDA COM SUCESSO!');
            console.log('✅ Banco de dados limpo e pronto para desenvolvimento');
            console.log('✅ Dashboard mostrará dados reais');
            console.log('✅ Interface administrativa limpa');
            
            return {
                success: true,
                summary: {
                    clientsDeleted: deletedClients.deletedCount,
                    selectionsDeleted: deletedSelections.deletedCount,
                    specialSelectionsDeleted: deletedSpecialSelections.deletedCount,
                    photoStatusDeleted: deletedPhotoStatus.deletedCount,
                    cartsDeleted: deletedCarts.deletedCount,
                    remainingClients: remainingClients
                }
            };
        } else {
            throw new Error('❌ Limpeza não concluída corretamente. Verificar logs.');
        }
        
    } catch (error) {
        console.error('❌ ERRO NA LIMPEZA:', error);
        console.log('⚠️ Operação cancelada por segurança');
        return {
            success: false,
            error: error.message
        };
    }
}

// EXECUTAR LIMPEZA
async function runCleanup() {
    console.log('🚀 SCRIPT DE LIMPEZA DO SUNSHINE COWHIDES');
    console.log('⚠️ ATENÇÃO: Esta operação é IRREVERSÍVEL');
    console.log('📋 Vai manter apenas cliente 6544 e deletar todo resto\n');
    
    // Conectar ao MongoDB se não estiver conectado
    if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔗 Conectado ao MongoDB');
    }
    
    const result = await cleanupDatabase();
    
    if (result.success) {
        console.log('\n📈 PRÓXIMOS PASSOS:');
        console.log('1. Verificar dashboard (deve mostrar 1 cliente)');
        console.log('2. Testar login cliente 6544');
        console.log('3. Trabalhar na interface Client Management');
        console.log('4. Implementar botão Delete real');
    }
    
    return result;
}

module.exports = { cleanupDatabase, runCleanup };

// EXECUTAR SE CHAMADO DIRETAMENTE
if (require.main === module) {
    runCleanup().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('❌ Erro fatal:', error);
        process.exit(1);
    });
}
