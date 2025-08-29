require('dotenv').config();
const mongoose = require('mongoose');
const CDESync = require('../src/services/CDESync');

async function test() {
    try {
        console.log('Conectando ao MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Conectado. Iniciando sync...');

        // FORÇAR buscar desde ontem para pegar os RETIRADOS de hoje
        CDESync.lastSync = new Date('2025-08-26T00:00:00');
        console.log('Buscando RETIRADOS desde:', CDESync.lastSync);

        const result = await CDESync.syncRetirados();
        console.log('Resultado:', result);

        await mongoose.disconnect();
    } catch (error) {
        console.error('Erro:', error.message);
    }
}

test();