// clean-melissa-complete.js
const mongoose = require('mongoose');
require('dotenv').config();

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  
  console.log('Limpando fotos da Melissa...');
  
  // 1. Limpar carrinho
  await db.collection('carts').updateOne(
    { clientCode: '2960' },
    { 
      $set: { 
        items: [],
        totalItems: 0
      }
    }
  );
  
  // 2. Liberar TODAS as fotos reservadas por ela
  await db.collection('unified_products_complete').updateMany(
    { 'reservedBy.clientCode': '2960' },
    {
      $set: {
        status: 'available',
        currentStatus: 'available',
        'virtualStatus.status': 'available',
        cdeStatus: 'INGRESADO'
      },
      $unset: {
        'reservedBy': 1,
        'cartAddedAt': 1,
        'virtualStatus.clientCode': 1,
        'virtualStatus.in_cart': 1
      }
    }
  );
  
  console.log('✅ Tudo limpo! Melissa pode adicionar as fotos novamente.');
  await mongoose.disconnect();
})();