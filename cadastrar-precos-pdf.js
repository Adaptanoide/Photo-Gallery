// cadastrar-precos-pdf.js
const mongoose = require('mongoose');
require('dotenv').config();

// MAPA DE PREÇOS BASEADO NO PDF SUNSHINE COWHIDES
const REGRAS_PRECOS = {
    // ============ COLOMBIAN COWHIDES ============
    'Colombian': {
        'Small': 95,      // Página 1: S/M $95
        'Medium': 105,    // Página 1: L $105-115
        'Large': 115,     // Página 1: L $115
        'X-Large': 119,   // Página 1: XL $119
        'Value Tricolor Dark Tones & Creamish White S-M': 85,  // Página 1
        'Value Tricolor Dark Tones & Creamish White L-XL': 95  // Página 1
    },
    
    // ============ BRAZIL BEST SELLERS ============
    'Brazil Best Sellers': {
        'Super Promo XS': 75,   // Extra Small - Página 1
        'Super Promo Small': 79, // Small - baseado em "Limited Availability"
        'Tannery Run.*SMALL': 89,   // Salt & Pepper Small
        'Tannery Run.*ML.*XL': 100, // Mix ML-XL
        'Best Value.*Brindle': 100  // Já cadastrado
    },
    
    // ============ BRAZIL TOP SELECTED - SMALL ============
    'Brazil Top Selected.*Small': {
        // Baseado na Página 1 - Selected Categories Small
        'Hereford': 89,
        'Palomino': 89,
        'Brindle Medium': 89,
        'Brindle White Belly': 99,
        'Champagne': 99,
        'Taupe': 99,
        'Black & White Reddish': 99,
        'Black & White': 119,
        'Salt & Pepper': 119,
        'Brindle White Backbone': 119,
        'Grey': 139,
        'Brindle Light Grey': 139,
        'Brindle Grey': 139
    },
    
    // ============ BRAZIL TOP SELECTED - MEDIUM LARGE ============
    'Brazil Top Selected.*Medium Large': {
        // Baseado na Página 2 - ML
        'Hereford': 119,
        'Palomino': 119,
        'Brindle White Belly': 129,
        'Mahogany': 129,
        'Black & White Reddish': 149,
        'Black & White': 149,
        'Taupe': 149,
        'Brindle White Backbone': 159,
        'Greyish Beige': 169,
        'Champagne': 169,
        'Salt & Pepper': 179,
        'Brown & White': 189,
        'Brindle Light': 199,
        'Grey': 199,
        'Brindle Grey': 219
    },
    
    // ============ BRAZIL TOP SELECTED - EXTRA LARGE ============
    'Brazil Top Selected.*Extra Large': {
        // Baseado na Página 2 - XL
        'Hereford': 129,
        'Palomino': 129,
        'Brindle White Belly': 139,
        'Mahogany': 139,
        'Black & White Reddish': 159,
        'Black & White': 159,
        'Taupe': 159,
        'Brindle White Backbone': 169,
        'Greyish Beige': 179,
        'Champagne': 179,
        'Salt & Pepper': 189,
        'Brown & White': 199,
        'Brindle Light': 209,
        'Grey': 209,
        'Brindle Grey': 229
    },
    
    // ============ RODEO RUGS ============
    'Rodeo Rugs': {
        '3\' x 5\'': 79,     // Página 4
        '40" Round': 59,     // Página 4
        '60.*Round': 109,    // Página 4
        '80.*Round': 199     // Página 4
    },
    
    // ============ OUTROS PRODUTOS ============
    'Calfskins': {
        'Metallica': 45      // Página 3
    },
    
    'Sheepskins': {
        'Himalayan': 49,     // Página 3
        'Tibetan': 49        // Página 3
    },
    
    'Duffle Bags': {
        'Duffle Bags Brazil': 115  // Página 3
    }
};

async function cadastrarPrecos() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB\n');
        
        const PhotoCategory = require('./src/models/PhotoCategory');
        
        // Buscar categorias sem preço
        const categorias = await PhotoCategory.find({ 
            $or: [
                { basePrice: 0 },
                { basePrice: null }
            ]
        });
        
        console.log(`📊 Processando ${categorias.length} categorias sem preço...\n`);
        
        let atualizadas = 0;
        let naoEncontradas = [];
        
        for (const categoria of categorias) {
            const nome = categoria.displayName;
            let precoEncontrado = null;
            let regraUsada = '';
            
            // Procurar preço nas regras
            for (const [grupoKey, regras] of Object.entries(REGRAS_PRECOS)) {
                if (nome.includes(grupoKey)) {
                    for (const [padraoKey, preco] of Object.entries(regras)) {
                        // Criar regex para match mais flexível
                        const regex = new RegExp(padraoKey, 'i');
                        if (regex.test(nome)) {
                            precoEncontrado = preco;
                            regraUsada = `${grupoKey} → ${padraoKey}`;
                            break;
                        }
                    }
                }
                if (precoEncontrado) break;
            }
            
            if (precoEncontrado) {
                categoria.basePrice = precoEncontrado;
                categoria.pricingMode = 'base';
                await categoria.save();
                console.log(`✅ ${nome}`);
                console.log(`   Preço: $${precoEncontrado} (Regra: ${regraUsada})\n`);
                atualizadas++;
            } else {
                naoEncontradas.push(nome);
            }
        }
        
        console.log('\n========== RESUMO ==========');
        console.log(`✅ Categorias atualizadas: ${atualizadas}`);
        console.log(`❌ Categorias sem regra: ${naoEncontradas.length}`);
        
        if (naoEncontradas.length > 0) {
            console.log('\n📋 Categorias que precisam de preço manual:');
            naoEncontradas.forEach(cat => {
                console.log(`  - ${cat.split('→').pop().trim()}`);
            });
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Erro:', error);
        process.exit(1);
    }
}

// Confirmar antes de executar
console.log('⚠️  ATENÇÃO: Este script vai cadastrar preços no banco de dados!');
console.log('📋 Baseado no PDF de preços Sunshine Cowhides Aug 2025');
console.log('\nPressione Ctrl+C para cancelar ou aguarde 5 segundos...\n');

setTimeout(() => {
    cadastrarPrecos();
}, 5000);
