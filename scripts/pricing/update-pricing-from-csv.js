require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// ⚠️ MODO DRY-RUN - MUDE PARA false PARA SALVAR DE VERDADE
const DRY_RUN = false;

// Modelo
const PhotoCategory = require('../src/models/PhotoCategory');

const CSV_PATH = path.join(__dirname, 'pricing-update.csv');
const MONGODB_URI = process.env.MONGODB_URI;

// Tiers ranges
const TIERS = [
  { min: 1, max: 5 },
  { min: 6, max: 12 },
  { min: 13, max: 36 },
  { min: 37, max: null }
];

async function parseCsv() {
  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = content.split('\n').filter(line => 
    line.trim() && !line.startsWith('#') && !line.startsWith('qbItem')
  );

  return lines.map(line => {
    const [qbItem, displayName, category, tier1, tier2, tier3, tier4, mixMatch] = 
      line.split(',').map(s => s.trim());
    
    return {
      qbItem,
      displayName,
      category,
      prices: [
        parseFloat(tier1),
        parseFloat(tier2),
        parseFloat(tier3),
        parseFloat(tier4)
      ],
      mixMatch: mixMatch === 'true'
    };
  });
}

async function updatePricing() {
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
      const category = await PhotoCategory.findOne({ qbItem: item.qbItem });

      if (!category) {
        console.log(`❌ Não encontrado: ${item.qbItem} - ${item.displayName}`);
        notFound++;
        continue;
      }

      // Mostrar mudanças
      console.log(`\n📦 ${item.qbItem} - ${item.displayName}`);
      console.log(`   Categoria: ${item.category}`);
      console.log(`   Base Price: $${category.basePrice} → $${item.prices[0]}`);
      console.log(`   Mix&Match: ${category.participatesInMixMatch || false} → ${item.mixMatch}`);
      console.log(`   Tiers: $${item.prices.join(' → $')}`);

      if (!DRY_RUN) {
        // Atualizar basePrice
        category.basePrice = item.prices[0];

        // Atualizar participatesInMixMatch
        category.participatesInMixMatch = item.mixMatch;

        // Criar/atualizar VOLUME rule
        const volumeRuleIndex = category.discountRules.findIndex(
          rule => rule.clientCode === 'VOLUME'
        );

        const newVolumeRule = {
          clientCode: 'VOLUME',
          clientName: 'All Regular Clients',
          priceRanges: TIERS.map((tier, index) => ({
            min: tier.min,
            max: tier.max,
            price: item.prices[index]
          })),
          isActive: true,
          createdAt: new Date()
        };

        if (volumeRuleIndex >= 0) {
          category.discountRules[volumeRuleIndex] = newVolumeRule;
        } else {
          category.discountRules.push(newVolumeRule);
        }

        await category.save();
        console.log('   ✅ SALVO');
      } else {
        console.log('   🔍 DRY RUN - não salvo');
      }

      updated++;

    } catch (error) {
      console.error(`❌ Erro ao processar ${item.qbItem}:`, error.message);
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
    console.log('💡 Para salvar de verdade, mude DRY_RUN para false');
  }
  
  console.log('='.repeat(60));

  await mongoose.disconnect();
}

updatePricing().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
