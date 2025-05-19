// src/config/database.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Configurações otimizadas para MongoDB Atlas
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sunshine_cowhides';
    
    // Opções de conexão CORRIGIDAS (removendo bufferMaxEntries)
    const options = {
      // Configurações básicas
      maxPoolSize: 10, // Máximo de 10 conexões simultâneas
      serverSelectionTimeoutMS: 5000, // 5 segundos para conectar
      socketTimeoutMS: 45000, // 45 segundos timeout
      
      // Configurações para Atlas
      retryWrites: true,
      w: 'majority',
      
      // Para free tier - configurações conservadoras
      maxIdleTimeMS: 30000, // Fechar conexões inativas após 30s
      heartbeatFrequencyMS: 10000, // Verificar conectividade a cada 10s
    };
    
    // Conectar ao MongoDB
    const conn = await mongoose.connect(mongoURI, options);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    // Event listeners para monitoramento
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });
    
    return conn;
  } catch (error) {
    console.error(`❌ Error connecting to MongoDB: ${error.message}`);
    
    // Em desenvolvimento, tentar reconectar apenas uma vez
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Retrying connection in 5 seconds...');
      setTimeout(() => connectDB(), 5000);
    } else {
      process.exit(1);
    }
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('📴 MongoDB connection closed through app termination');
    process.exit(0);
  } catch (error) {
    console.error('Error during database cleanup:', error);
    process.exit(1);
  }
});

module.exports = connectDB;