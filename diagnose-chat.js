// diagnose-chat.js
// Script para diagnosticar problemas no chat do cliente 6753

require('dotenv').config();
const mongoose = require('mongoose');

// Conectar ao MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const ChatConversation = require('./src/models/ChatConversation');
const ChatMessage = require('./src/models/ChatMessage');

async function diagnose() {
    try {
        console.log('\n🔍 DIAGNÓSTICO DO CHAT - Cliente 6753\n');
        console.log('='.repeat(60));

        // Buscar TODAS as conversas do cliente 6753
        const conversations = await ChatConversation.find({ 
            clientCode: '6753' 
        }).sort({ createdAt: -1 });

        console.log(`\n📊 Total de conversas encontradas: ${conversations.length}\n`);

        if (conversations.length === 0) {
            console.log('❌ PROBLEMA: Nenhuma conversa encontrada para o código 6753!');
            console.log('   Isso significa que o cliente nunca iniciou uma conversa, ou foi deletado.\n');
            await mongoose.disconnect();
            return;
        }

        // Analisar cada conversa
        for (let i = 0; i < conversations.length; i++) {
            const conv = conversations[i];
            console.log(`\n${'─'.repeat(60)}`);
            console.log(`CONVERSA ${i + 1}:`);
            console.log(`${'─'.repeat(60)}`);
            console.log(`ID da Conversa: ${conv.conversationId}`);
            console.log(`Status: ${conv.status}`);
            console.log(`Slack Thread TS: ${conv.slackThreadTs || '⚠️  VAZIO/NULL'}`);
            console.log(`Slack Channel: ${conv.slackChannel}`);
            console.log(`Criada em: ${conv.createdAt}`);
            console.log(`Última mensagem: ${conv.lastMessageAt}`);
            console.log(`Não lidas pelo cliente: ${conv.unreadByClient}`);
            console.log(`Não lidas pelo vendedor: ${conv.unreadBySalesRep}`);

            // Buscar mensagens dessa conversa
            const messages = await ChatMessage.find({
                conversationId: conv.conversationId
            }).sort({ createdAt: 1 });

            console.log(`\n📨 Total de mensagens: ${messages.length}`);

            if (messages.length > 0) {
                console.log('\nMensagens:');
                messages.forEach((msg, idx) => {
                    console.log(`  ${idx + 1}. [${msg.sender}] ${msg.message.substring(0, 50)}...`);
                    console.log(`     Enviada: ${msg.createdAt}`);
                    console.log(`     Lida: ${msg.read ? 'Sim' : 'Não'}`);
                });
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('\n🔎 ANÁLISE:\n');

        // Buscar especificamente pela thread que apareceu no log
        const threadFromLog = '1763047624.329939';
        const conversationWithThread = await ChatConversation.findOne({
            slackThreadTs: threadFromLog
        });

        console.log(`Thread do log do Slack: ${threadFromLog}`);
        
        if (conversationWithThread) {
            console.log(`✅ ENCONTRADO! Esta thread pertence à conversa:`);
            console.log(`   - Conversation ID: ${conversationWithThread.conversationId}`);
            console.log(`   - Cliente: ${conversationWithThread.clientCode}`);
            console.log(`   - Status: ${conversationWithThread.status}`);
        } else {
            console.log(`❌ PROBLEMA IDENTIFICADO!`);
            console.log(`   A thread "${threadFromLog}" NÃO existe no banco de dados!`);
            console.log(`   Isso explica porque as respostas não chegam ao cliente.\n`);
            
            console.log(`📋 POSSÍVEIS CAUSAS:`);
            console.log(`   1. O slackThreadTs não foi salvo quando a primeira mensagem foi enviada`);
            console.log(`   2. A conversa foi deletada ou recriada`);
            console.log(`   3. Bug no código que salva o thread_ts\n`);
        }

        console.log('='.repeat(60) + '\n');

        await mongoose.disconnect();
        console.log('✅ Diagnóstico concluído!\n');

    } catch (error) {
        console.error('❌ Erro no diagnóstico:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

diagnose();