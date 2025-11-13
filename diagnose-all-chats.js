// diagnose-all-chats.js
// Investigar TODAS as conversas para encontrar padrão sistêmico

require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI);

const ChatConversation = require('./src/models/ChatConversation');
const ChatMessage = require('./src/models/ChatMessage');

async function diagnoseAll() {
    try {
        console.log('\n🔍 DIAGNÓSTICO COMPLETO - TODAS AS CONVERSAS\n');
        console.log('='.repeat(70));

        // Buscar TODAS as conversas
        const allConversations = await ChatConversation.find({})
            .sort({ lastMessageAt: -1 })
            .limit(20); // Últimas 20 conversas

        console.log(`\n📊 Total de conversas (últimas 20): ${allConversations.length}\n`);

        for (let i = 0; i < allConversations.length; i++) {
            const conv = allConversations[i];
            
            // Buscar mensagens
            const messages = await ChatMessage.find({
                conversationId: conv.conversationId
            }).sort({ createdAt: -1 }).limit(5);

            const clientMessages = messages.filter(m => m.sender === 'client').length;
            const salesMessages = messages.filter(m => m.sender === 'salesrep').length;

            console.log(`${i + 1}. Cliente: ${conv.clientCode} | Status: ${conv.status}`);
            console.log(`   Thread TS: ${conv.slackThreadTs || '⚠️  VAZIO'}`);
            console.log(`   Criada: ${conv.createdAt.toISOString().split('T')[0]}`);
            console.log(`   Última msg: ${conv.lastMessageAt.toISOString().split('T')[0]}`);
            console.log(`   Mensagens: ${clientMessages} cliente, ${salesMessages} vendedor`);
            console.log(`   Não lidas vendedor: ${conv.unreadBySalesRep}`);
            console.log('');
        }

        console.log('='.repeat(70));
        console.log('\n🔎 PROCURANDO PADRÕES...\n');

        // Análise 1: Conversas sem thread_ts
        const noThread = await ChatConversation.countDocuments({
            $or: [
                { slackThreadTs: null },
                { slackThreadTs: { $exists: false } },
                { slackThreadTs: '' }
            ]
        });

        console.log(`❌ Conversas SEM thread_ts: ${noThread}`);

        // Análise 2: Conversas ativas com mensagens não lidas do vendedor
        const activeWithUnread = await ChatConversation.find({
            status: 'active',
            unreadBySalesRep: { $gt: 0 } // Cliente enviou mas vendedor não respondeu
        });

        console.log(`📬 Conversas aguardando resposta do vendedor: ${activeWithUnread.length}`);

        // Análise 3: Mensagens de vendedor não entregues (últimos 30 dias)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentSalesMessages = await ChatMessage.find({
            sender: 'salesrep',
            createdAt: { $gte: thirtyDaysAgo }
        }).sort({ createdAt: -1 });

        console.log(`💬 Mensagens de vendedor (últimos 30 dias): ${recentSalesMessages.length}`);

        if (recentSalesMessages.length > 0) {
            console.log('\nÚltimas 5 mensagens de vendedor:');
            recentSalesMessages.slice(0, 5).forEach((msg, idx) => {
                console.log(`  ${idx + 1}. [${msg.createdAt.toISOString().split('T')[0]}] ${msg.message.substring(0, 40)}...`);
                console.log(`     Conversation: ${msg.conversationId}`);
            });
        } else {
            console.log('\n⚠️  NENHUMA mensagem de vendedor nos últimos 30 dias!');
            console.log('   Isso confirma que as respostas NÃO estão chegando ao banco!');
        }

        // Análise 4: Verificar quando foi a ÚLTIMA mensagem de vendedor que chegou
        const lastSalesMessage = await ChatMessage.findOne({
            sender: 'salesrep'
        }).sort({ createdAt: -1 });

        if (lastSalesMessage) {
            console.log(`\n📅 Última mensagem de vendedor que chegou:`);
            console.log(`   Data: ${lastSalesMessage.createdAt}`);
            console.log(`   Conteúdo: ${lastSalesMessage.message}`);
            console.log(`   Conversation: ${lastSalesMessage.conversationId}`);
            
            const daysSince = Math.floor((Date.now() - lastSalesMessage.createdAt.getTime()) / (1000 * 60 * 60 * 24));
            console.log(`   Há ${daysSince} dias atrás`);
        }

        console.log('\n' + '='.repeat(70));
        console.log('\n📋 CONCLUSÃO:\n');

        if (recentSalesMessages.length === 0) {
            console.log('🚨 PROBLEMA SISTÊMICO CONFIRMADO!');
            console.log('   Nenhuma resposta de vendedor foi salva nos últimos 30 dias.');
            console.log('   Todas as conversas estão afetadas.\n');
            console.log('   Possíveis causas:');
            console.log('   1. Webhook DO Slack não está sendo chamado');
            console.log('   2. Webhook está sendo chamado mas falhando silenciosamente');
            console.log('   3. Bug no processSalesRepReply que afeta TODAS as threads');
            console.log('   4. Token do Slack expirou ou perdeu permissões');
        } else {
            console.log('✅ Algumas mensagens de vendedor foram salvas recentemente.');
            console.log('   O problema pode ser específico de certas conversas ou períodos.');
        }

        console.log('\n' + '='.repeat(70) + '\n');

        await mongoose.disconnect();

    } catch (error) {
        console.error('❌ Erro:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

diagnoseAll();