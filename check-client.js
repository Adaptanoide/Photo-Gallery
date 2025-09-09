// check-client.js
const { MongoClient } = require('mongodb');
const MONGODB_URI = 'mongodb+srv://easyadmin:2NwxuiOlK57wH8cY@cluster.tsbl7y8.mongodb.net/sunshine_cowhides?retryWrites=true&w=majority&appName=Cluster';

async function checkClient() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('sunshine_cowhides');
    
    // Procurar cliente
    const testClient = await db.collection('accesscodes').findOne({
        $or: [
            { clientName: /developing.*testing/i },
            { clientName: /testing/i },
            { code: '6753' }
        ]
    });
    
    if (testClient) {
        console.log('✅ Cliente encontrado:', testClient.clientName, '- Código:', testClient.code);
    } else {
        console.log('❌ Cliente "developing testing" não encontrado');
        console.log('Você pode criar um novo cliente de teste');
    }
    
    // Listar clientes recentes para ver o que tem
    console.log('\n📋 Últimos 5 clientes:');
    const recent = await db.collection('accesscodes').find()
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();
    
    recent.forEach(c => {
        console.log(`  - ${c.clientName} (${c.code})`);
    });
    
    await client.close();
}

checkClient();