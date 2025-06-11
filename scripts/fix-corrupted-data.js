const mongoose = require('mongoose');
const CategoryAccess = require('../src/models/categoryAccess');

async function fixCorruptedData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('🔧 Fixing corrupted CategoryAccess data...');
    
    const allRecords = await CategoryAccess.find({});
    
    for (const record of allRecords) {
      console.log(`\n📋 Processing customer: ${record.customerCode}`);
      console.log(`Categories BEFORE: ${record.categoryAccess.length}`);
      
      // Manter apenas categorias com configurações reais
      const filtered = record.categoryAccess.filter(item => 
        item.customPrice > 0 || 
        item.minQuantityForDiscount > 0 ||
        item.discountPercentage > 0 ||
        item.enabled === false // Manter apenas explicitamente desabilitadas
      );
      
      console.log(`Categories AFTER: ${filtered.length}`);
      
      if (filtered.length !== record.categoryAccess.length) {
        record.categoryAccess = filtered;
        await record.save();
        console.log(`✅ Fixed customer ${record.customerCode}`);
      } else {
        console.log(`✅ Customer ${record.customerCode} already clean`);
      }
    }
    
    console.log('\n🎉 Data cleanup completed!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error fixing data:', error);
    process.exit(1);
  }
}

fixCorruptedData();