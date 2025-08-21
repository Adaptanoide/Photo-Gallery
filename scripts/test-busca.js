require('dotenv').config();
const mongoose = require('mongoose');
const PhotoCategory = require('./src/models/PhotoCategory');

async function testar() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const categoryPath = 'Best Value -Salt & Pepper Mix - Black & White';
  console.log('BUSCANDO:', categoryPath);
  
  // Teste 1 - Busca por folderName
  const cat1 = await PhotoCategory.findOne({ folderName: categoryPath });
  console.log('Por folderName:', cat1 ? 'ENCONTROU' : 'NÃO ENCONTROU');
  
  // Teste 2 - Busca por displayName terminando com
  const cat2 = await PhotoCategory.findOne({ 
    displayName: { $regex: ` → ${categoryPath}$` }
  });
  console.log('Por displayName com →:', cat2 ? 'ENCONTROU' : 'NÃO ENCONTROU');
  
  // Teste 3 - Busca exata
  const cat3 = await PhotoCategory.findOne({ displayName: categoryPath });
  console.log('Por displayName exato:', cat3 ? 'ENCONTROU' : 'NÃO ENCONTROU');
  
  mongoose.connection.close();
}

testar();
