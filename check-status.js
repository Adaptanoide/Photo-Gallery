// check-status.js
const { MongoClient } = require('mongodb');
const MONGODB_URI = 'mongodb+srv://easyadmin:2NwxuiOlK57wH8cY@cluster.tsbl7y8.mongodb.net/sunshine_cowhides?retryWrites=true&w=majority&appName=Cluster';

async function checkStatus() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('sunshine_cowhides');
    
    const testClient = await db.collection('accesscodes').findOne({ code: '6753' });
    
    console.log('Cliente DEVELOPING_TESTE:');
    console.log('  Código:', testClient.code);
    console.log('  Nome:', testClient.clientName);
    console.log('  Ativo?:', testClient.isActive !== false ? '✅ SIM' : '❌ NÃO');
    console.log('  Expirado?:', new Date(testClient.expiresAt) < new Date() ? '❌ SIM' : '✅ NÃO');
    console.log('  Tipo:', testClient.accessType || 'normal');
    
    await client.close();
}

checkStatus();