// corrigir-brazil-top.js
const mongoose = require('mongoose');
require('dotenv').config();

// Preços específicos para Brazil Top Selected Categories
const PRECOS_BRAZIL_TOP = {
    // SMALL - baseado na página 1 do PDF
    'Small': {
        'Hereford': 89,
        'Palomino': 89,
        'Brindle Medium': 89,
        'Brindle White Belly': 99,
        'Champagne': 99,
        'Taupe': 99,
        'Black & White': 119,
        'Salt & Pepper': 119,
        'Brindle White Backbone': 119,
        'Grey': 139,
        'Brindle Light': 139,
        'DEFAULT': 109  // Preço médio para Small não listados
    },
    
    // MEDIUM LARGE - baseado na página 2 do PDF
    'Medium Large': {
        'Hereford': 119,
        'Palomino': 119,
        'Brindle White Belly': 129,
        'Black & White': 149,
        'Taupe': 149,
        'Brindle White Backbone': 159,
        'Champagne': 169,
        'Salt & Pepper': 179,
        'Brown & White': 189,
        'Grey': 199,
        'Brindle Grey': 219,
        'DEFAULT': 149  // Preço médio para ML
    },
    
    // EXTRA LARGE - baseado na página 2 do PDF
    'Extra Large': {
        'Hereford': 129,
        'Palomino': 129,
        'Brindle White Belly': 139,
        'Black & White': 159,
        'Taupe': 159,
        'Brindle White Backbone': 169,
        'Champagne': 179,
        'Salt & Pepper': 189,
        'Brown & White': 199,
        'Grey': 209,
        'Brindle Grey': 229,
        'DEFAULT': 159  // Preço médio para XL
    }
};

async function corrigirPrecos() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const PhotoCategory = require('./src/models/PhotoCategory');
        
        // Buscar categorias Brazil Top Selected sem preço
        const categorias = await PhotoCategory.find({ 
            displayName: /Brazil Top Selected Categories/i,
            basePrice: 0
        });
        
        console.log(`📊 Encontradas ${categorias.length} categorias Brazil Top Selected sem preço\n`);
        
        let atualizadas = 0;
        
        for (const cat of categorias) {
            const nome = cat.displayName;
            let preco = null;
            let tamanho = '';
            
            // Identificar tamanho
            if (nome.includes('→ Small →')) {
                tamanho = 'Small';
            } else if (nome.includes('→ Medium Large →')) {
                tamanho = 'Medium Large';
            } else if (nome.includes('→ Extra Large →')) {
                tamanho = 'Extra Large';
            }
            
            if (tamanho && PRECOS_BRAZIL_TOP[tamanho]) {
                // Procurar preço específico
                const ultimaParte = nome.split('→').pop().trim();
                
                for (const [padrao, valor] of Object.entries(PRECOS_BRAZIL_TOP[tamanho])) {
                    if (padrao !== 'DEFAULT' && ultimaParte.includes(padrao)) {
                        preco = valor;
                        break;
                    }
                }
                
                // Se não encontrou, usar default
                if (!preco) {
                    preco = PRECOS_BRAZIL_TOP[tamanho].DEFAULT;
                }
                
                // Atualizar
                cat.basePrice = preco;
                await cat.save();
                console.log(`✅ ${ultimaParte} (${tamanho}): $${preco}`);
                atualizadas++;
            }
        }
        
        // Corrigir também Colombian X-Large (estava pegando preço de Large)
        const colombianXL = await PhotoCategory.find({
            displayName: /Colombian.*X-Large/i
        });
        
        for (const cat of colombianXL) {
            if (cat.basePrice === 115) {  // Preço errado
                cat.basePrice = 119;  // Preço correto
                await cat.save();
                console.log(`✅ CORRIGIDO: ${cat.displayName.split('→').pop()} → $119`);
                atualizadas++;
            }
        }
        
        console.log(`\n✅ Total atualizado: ${atualizadas} categorias`);
        process.exit(0);
        
    } catch (error) {
        console.error('Erro:', error);
        process.exit(1);
    }
}

corrigirPrecos();
