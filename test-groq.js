// test-groq.js
require('dotenv').config();
const Groq = require('groq-sdk');

async function testGroq() {
    console.log('🧪 Testando conexão com Groq...\n');
    
    try {
        const groq = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });
        
        const completion = await groq.chat.completions.create({
            messages: [{
                role: "user",
                content: "Say 'Hello Andy! Sunshine Intelligence is ready!' if you're working"
            }],
            model: "llama-3.3-70b-versatile",  // ← MUDANÇA AQUI
            temperature: 0.1
        });
        
        console.log('✅ SUCESSO! Resposta da IA:');
        console.log(completion.choices[0].message.content);
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
    }
}

testGroq();