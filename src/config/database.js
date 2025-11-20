//src/config/database.js

const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            // Configurações recomendadas para MongoDB Atlas
        });

        console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
        
        // Log das collections existentes
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`📦 Collections disponíveis: ${collections.map(c => c.name).join(', ')}`);
        
    } catch (error) {
        console.error('❌ Erro ao conectar com MongoDB:', error.message);
        process.exit(1);
    }
};

// Eventos de conexão
mongoose.connection.on('connected', () => {
    console.log('🔗 Mongoose conectado ao MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Erro de conexão Mongoose:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('🔌 Mongoose desconectado');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('🛑 Conexão MongoDB fechada devido ao encerramento da aplicação');
    process.exit(0);
});

module.exports = connectDB;