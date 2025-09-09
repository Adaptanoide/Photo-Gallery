// count-clients.js
const { MongoClient } = require('mongodb');
const MONGODB_URI = 'mongodb+srv://easyadmin:2NwxuiOlK57wH8cY@cluster.tsbl7y8.mongodb.net/sunshine_cowhides?retryWrites=true&w=majority&appName=Cluster';

async function countClients() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('sunshine_cowhides');
    
    const total = await db.collection('accesscodes').countDocuments();
    const active = await db.collection('accesscodes').countDocuments({ isActive: { $ne: false } });
    
    console.log(`Total de clientes: ${total}`);
    console.log(`Clientes ativos: ${active}`);
    
    // Ver posição do DEVELOPING_TESTE
    const allClients = await db.collection('accesscodes')
        .find()
        .sort({ createdAt: -1 })
        .toArray();
    
    const position = allClients.findIndex(c => c.code === '6753');
    console.log(`\nPosição do DEVELOPING_TESTE: ${position + 1} de ${total}`);
    
    await client.close();
}

countClients();