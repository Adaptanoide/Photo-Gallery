const mongoose = require('mongoose');
require('dotenv').config();
const AccessCode = require('../src/models/AccessCode');

async function checkClient() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('🔍 VERIFICANDO CLIENTES\n');
        
        // Listar TODOS os clientes ativos
        const clients = await AccessCode.find({ isActive: true })
            .select('code clientName accessType')
            .sort({ code: 1 });
        
        console.log(`Total de clientes ativos: ${clients.length}\n`);
        
        for (const client of clients) {
            console.log(`📱 Código: ${client.code}`);
            console.log(`   Nome: ${client.clientName}`);
            console.log(`   Tipo: ${client.accessType}`);
            console.log('---');
        }
        
        // Verificar especificamente o 8041
        console.log('\n🎯 CLIENTE 8041 (que tem regra customizada):');
        const client8041 = await AccessCode.findOne({ code: '8041' });
        if (client8041) {
            console.log('  Nome:', client8041.clientName);
            console.log('  Tipo:', client8041.accessType);
            console.log('  Ativo:', client8041.isActive);
        }
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkClient();
