const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Importar conexão do MongoDB
const connectDB = require('./config/database');

// Importar rotas
const dbRoutes = require('./routes/db');
const photoRoutes = require('./routes/photos');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const clientRoutes = require('./routes/client');
const configRoutes = require('./routes/config');

// Inicializar app
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Rotas da API
app.use('/api/db', dbRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/config', configRoutes);

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Conectar ao MongoDB antes de iniciar o servidor
connectDB()
  .then(() => {
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });