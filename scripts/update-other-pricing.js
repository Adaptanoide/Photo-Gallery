require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const PhotoCategory = require('../src/models/PhotoCategory');

const CSV_PATH = path.join(__dirname, 'pricing-update-other.csv');
const MONGODB_URI = process.env.MONGODB_URI;
const DRY_RUN = true; // ⚠️ MUDE PARA false PARA SALVAR

async function parseCsv() {
  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = content.split('\n').filter(line => 
    line.trim() && !line.startsWith('#') && !line.startsWith('qbItem')
  );

  return lines.map(line => {
    const [qbItem, displayName, basePrice, hasVolume] = 
      line.split(',').map(s => s.trim());
    
    return {
      displayName,
      basePrice: parseFloat(basePrice),
      hasVolume: hasVolume === 'true'
    };
  });
}

async function updateOtherPricing() {
  console.log('🔄 Conectando ao MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Conectado!\n');

  if (DRY_RUN) {
    console.log('🔍 ===== MODO DRY RUN - NADA SERÁ SALVO =====\n');
  }

  const data = await parseCsv();
  console.log(`📊 ${data.length} categorias para processar\n`);

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const item of data) {
    try {
      // Buscar por displayName parcial (contém o nome)
      const category = await PhotoCategory.findOne({
        displayName: { $regex: item.displayName, $options: 'i' },
        photoCount: { $gt: 0 }
      });

      if (!category) {
        console.log(`❌ Não encontrado: ${item.displayName}`);
        notFound++;
        continue;
      }

      console.log(`\n📦 ${category.qbItem || 'NO-QB'} - ${category.displayName}`);
      console.log(`   Base Price: $${category.basePrice} → $${item.basePrice}`);
      console.log(`   Mix&Match: ${category.participatesInMixMatch || false} → false`);

      if (!DRY_RUN) {
        // Atualizar
        category.basePrice = item.basePrice;
        category.participatesInMixMatch = false;
        
        // Limpar volume rules (queremos apenas base price)
        category.discountRules = category.discountRules.filter(
          rule => rule.clientCode !== 'VOLUME'
        );

        await category.save();
        console.log('   ✅ SALVO');
      } else {
        console.log('   🔍 DRY RUN - não salvo');
      }

      updated++;

    } catch (error) {
      console.error(`❌ Erro: ${item.displayName}:`, error.message);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO:');
  console.log(`   ✅ Processados: ${updated}`);
  console.log(`   ❌ Não encontrados: ${notFound}`);
  console.log(`   ⚠️  Erros: ${errors}`);
  
  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN - Nenhuma alteração foi salva!');
    console.log('💡 Para salvar, mude DRY_RUN para false');
  }
  
  console.log('='.repeat(60));

  await mongoose.disconnect();
}

updateOtherPricing().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
