// scripts/test-cart-consistency.js
const mongoose = require('mongoose');
const CartService = require('../src/services/CartService');
const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
const StatusConsistencyGuard = require('../src/services/StatusConsistencyGuard');
require('dotenv').config();

async function testCartOperations() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB\n');
        console.log('=' .repeat(60));
        console.log('TESTE DE CONSISTÊNCIA DO CARRINHO');
        console.log('=' .repeat(60));
        
        // 1. Encontrar uma foto disponível para teste
        console.log('\n1️⃣ Buscando uma foto disponível para teste...');
        const availablePhoto = await UnifiedProductComplete.findOne({
            status: 'available',
            cdeStatus: 'INGRESADO'
        });
        
        if (!availablePhoto) {
            console.log('❌ Nenhuma foto disponível encontrada para teste');
            return;
        }
        
        console.log(`   Foto encontrada: ${availablePhoto.fileName}`);
        console.log(`   Status inicial: ${availablePhoto.status}`);
        console.log(`   CDE Status: ${availablePhoto.cdeStatus}`);
        
        // 2. Simular dados de sessão
        const testSessionId = `test_session_${Date.now()}`;
        const testClientCode = 'TEST';
        const testClientName = 'Teste Local';
        
        console.log(`\n2️⃣ Dados do teste:`);
        console.log(`   SessionId: ${testSessionId}`);
        console.log(`   Cliente: ${testClientName} (${testClientCode})`);
        
        // 3. Adicionar ao carrinho
        console.log(`\n3️⃣ Adicionando foto ao carrinho...`);
        try {
            const addResult = await CartService.addToCart(
                testSessionId,
                testClientCode,
                testClientName,
                availablePhoto.driveFileId,
                {
                    fileName: availablePhoto.fileName,
                    category: availablePhoto.category,
                    price: 100
                }
            );
            
            console.log(`   ✅ Foto adicionada ao carrinho com sucesso`);
            
            // Verificar consistência após adicionar
            const afterAdd = await UnifiedProductComplete.findById(availablePhoto._id);
            console.log(`\n   Verificando consistência após adicionar:`);
            console.log(`   Status: ${afterAdd.status}`);
            console.log(`   CurrentStatus: ${afterAdd.currentStatus}`);
            console.log(`   CDE Status: ${afterAdd.cdeStatus}`);
            
            const issuesAfterAdd = StatusConsistencyGuard.checkConsistency(afterAdd);
            if (issuesAfterAdd.length === 0) {
                console.log(`   ✅ Todos os status estão consistentes!`);
            } else {
                console.log(`   ⚠️ Problemas encontrados:`);
                issuesAfterAdd.forEach(issue => console.log(`      - ${issue}`));
            }
            
        } catch (error) {
            console.log(`   ❌ Erro ao adicionar: ${error.message}`);
            return;
        }
        
        // 4. Aguardar um pouco
        console.log(`\n⏳ Aguardando 3 segundos...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 5. Remover do carrinho
        console.log(`\n4️⃣ Removendo foto do carrinho...`);
        try {
            const removeResult = await CartService.removeFromCart(
                testSessionId,
                availablePhoto.driveFileId
            );
            
            console.log(`   ✅ Foto removida do carrinho com sucesso`);
            
            // Verificar consistência após remover
            const afterRemove = await UnifiedProductComplete.findById(availablePhoto._id);
            console.log(`\n   Verificando consistência após remover:`);
            console.log(`   Status: ${afterRemove.status}`);
            console.log(`   CurrentStatus: ${afterRemove.currentStatus}`);
            console.log(`   CDE Status: ${afterRemove.cdeStatus}`);
            
            const issuesAfterRemove = StatusConsistencyGuard.checkConsistency(afterRemove);
            if (issuesAfterRemove.length === 0) {
                console.log(`   ✅ Todos os status estão consistentes!`);
            } else {
                console.log(`   ⚠️ Problemas encontrados:`);
                issuesAfterRemove.forEach(issue => console.log(`      - ${issue}`));
            }
            
        } catch (error) {
            console.log(`   ❌ Erro ao remover: ${error.message}`);
        }
        
        // 6. Resultado final
        console.log('\n' + '=' .repeat(60));
        console.log('RESULTADO DO TESTE:');
        console.log('=' .repeat(60));
        
        const finalPhoto = await UnifiedProductComplete.findById(availablePhoto._id);
        const finalIssues = StatusConsistencyGuard.checkConsistency(finalPhoto);
        
        if (finalIssues.length === 0 && finalPhoto.status === 'available') {
            console.log('✅ TESTE PASSOU! A foto voltou ao estado inicial e está consistente.');
        } else {
            console.log('❌ TESTE FALHOU! Verifique os problemas acima.');
        }
        
    } catch (error) {
        console.error('❌ Erro no teste:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n👋 Conexão fechada');
    }
}

testCartOperations();