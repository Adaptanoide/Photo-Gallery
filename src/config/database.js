// src/config/database.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Usar a variável de ambiente ou uma string de conexão padrão
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sunshine_cowhides';
    
    // Conectar ao MongoDB
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;