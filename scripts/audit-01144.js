// scripts/audit-01144.js
const mongoose = require('mongoose');
const CDEWriter = require('../src/services/CDEWriter');
require('dotenv').config();

async function auditPhoto01144() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.clear();
    console.log('=' .repeat(70));
    console.log('AUDITORIA COMPLETA DA FOTO 01144 - TESTE DE CONFIRMED');
    console.log('=' .repeat(70));
    
    const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
    const Selection = require('../src/models/Selection');
    const Cart = require('../src/models/Cart');
    
    // 1. Buscar a foto no MongoDB
    const photo = await UnifiedProductComplete.findOne({
        $or: [
            { fileName: '01144.webp' },
            { photoNumber: '01144' }
        ]
    });
    
    // 2. Verificar no CDE
    const cdeStatus = await CDEWriter.checkStatus('01144');
    
    // 3. Buscar a seleção que contém esta foto
    const selection = await Selection.findOne({
        'items.fileName': '01144.webp',
        status: { $ne: 'cancelled' }  // Ignorar seleções canceladas antigas
    });
    
    // 4. Verificar se ainda está em algum carrinho (não deveria estar)
    const cart = await Cart.findOne({
        'items.fileName': '01144.webp',
        isActive: true
    });
    
    console.log('\n📊 VERIFICAÇÃO DE CONSISTÊNCIA\n');
    console.log('┌' + '─'.repeat(68) + '┐');
    console.log('│ MONGODB (Banco de Dados)                                          │');
    console.log('├' + '─'.repeat(68) + '┤');
    console.log(`│ status:         ${photo?.status?.padEnd(50) || 'N/A'.padEnd(50)} │`);
    console.log(`│ currentStatus:  ${photo?.currentStatus?.padEnd(50) || 'N/A'.padEnd(50)} │`);
    console.log(`│ cdeStatus:      ${photo?.cdeStatus?.padEnd(50) || 'N/A'.padEnd(50)} │`);
    console.log(`│ virtualStatus:  ${photo?.virtualStatus?.status?.padEnd(50) || 'N/A'.padEnd(50)} │`);
    console.log(`│ reservedBy:     ${(photo?.reservedBy?.clientCode || 'ninguém').padEnd(50)} │`);
    console.log(`│ selectionId:    ${(photo?.selectionId || 'nenhuma').toString().padEnd(50)} │`);
    console.log('└' + '─'.repeat(68) + '┘');
    
    console.log('\n┌' + '─'.repeat(68) + '┐');
    console.log('│ CDE (Sistema Físico)                                              │');
    console.log('├' + '─'.repeat(68) + '┤');
    console.log(`│ AESTADOP:       ${(cdeStatus?.status || 'N/A').padEnd(50)} │`);
    console.log(`│ RESERVEDUSU:    ${(cdeStatus?.reservedBy || 'ninguém').padEnd(50)} │`);
    console.log('└' + '─'.repeat(68) + '┘');
    
    // Verificações de consistência
    console.log('\n🔍 ANÁLISE DE CONSISTÊNCIA\n');
    
    const checks = [];
    
    // Check 1: Status devem ser consistentes
    if (photo?.cdeStatus === cdeStatus?.status) {
        checks.push('✅ CDE status sincronizado (MongoDB.cdeStatus = CDE.AESTADOP)');
    } else {
        checks.push(`❌ CDE dessincronizado: MongoDB=${photo?.cdeStatus}, CDE=${cdeStatus?.status}`);
    }
    
    // Check 2: Para CONFIRMED, status deve ser in_selection
    if (photo?.cdeStatus === 'CONFIRMED' && photo?.status === 'in_selection') {
        checks.push('✅ Status correto para CONFIRMED (in_selection)');
    } else if (photo?.cdeStatus === 'CONFIRMED') {
        checks.push(`❌ Status incorreto: deveria ser 'in_selection', mas está '${photo?.status}'`);
    }
    
    // Check 3: Todos os campos de status devem estar alinhados
    if (photo?.status === photo?.currentStatus && 
        photo?.status === photo?.virtualStatus?.status) {
        checks.push('✅ Todos os campos de status alinhados');
    } else {
        checks.push('❌ Campos de status desalinhados');
    }
    
    // Check 4: Deve existir uma seleção ativa
    if (selection && selection.status === 'pending') {
        checks.push(`✅ Seleção encontrada: ${selection.selectionId} (PENDING)`);
    } else if (selection) {
        checks.push(`⚠️ Seleção existe mas status é: ${selection.status}`);
    } else {
        checks.push('❌ Nenhuma seleção ativa encontrada');
    }
    
    // Check 5: Não deve estar em carrinho
    if (!cart) {
        checks.push('✅ Foto não está em nenhum carrinho (correto após confirmação)');
    } else {
        checks.push('❌ Foto ainda está em um carrinho (problema!)');
    }
    
    checks.forEach(check => console.log('  ' + check));
    
    // Detalhes da seleção
    if (selection) {
        console.log('\n📋 DETALHES DA SELEÇÃO\n');
        console.log(`  ID: ${selection.selectionId}`);
        console.log(`  Status: ${selection.status}`);
        console.log(`  Cliente: ${selection.clientName} (${selection.clientCode})`);
        console.log(`  Total de Items: ${selection.items.length}`);
        console.log(`  Valor Total: $${selection.totalValue}`);
        console.log(`  Criada em: ${selection.createdAt.toLocaleString()}`);
    }
    
    // Resumo final
    console.log('\n' + '=' .repeat(70));
    const allChecksPass = checks.every(c => c.startsWith('✅'));
    if (allChecksPass) {
        console.log('✅ TESTE PASSOU COMPLETAMENTE - Sistema está funcionando perfeitamente!');
        console.log('\nPróximo passo: Testar o CANCELAMENTO desta seleção no Selection Management');
    } else {
        console.log('⚠️ Alguns problemas detectados - verifique os items marcados com ❌');
    }
    console.log('=' .repeat(70));
    
    await mongoose.connection.close();
}

auditPhoto01144();