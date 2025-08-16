// resumo-precos-final.js
const mongoose = require('mongoose');
require('dotenv').config();

async function resumoFinal() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const PhotoCategory = require('./src/models/PhotoCategory');
        
        // Estatísticas gerais
        const stats = await PhotoCategory.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    comPreco: { $sum: { $cond: [{ $gt: ['$basePrice', 0] }, 1, 0] } },
                    menorPreco: { $min: '$basePrice' },
                    maiorPreco: { $max: '$basePrice' },
                    mediaPreco: { $avg: '$basePrice' }
                }
            }
        ]);
        
        console.log('�� RESUMO FINAL DOS PREÇOS\n');
        console.log('📊 ESTATÍSTICAS:');
        console.log(`Total de categorias: ${stats[0].total}`);
        console.log(`Com preço: ${stats[0].comPreco}`);
        console.log(`Menor preço: $${stats[0].menorPreco}`);
        console.log(`Maior preço: $${stats[0].maiorPreco}`);
        console.log(`Preço médio: $${Math.round(stats[0].mediaPreco)}\n`);
        
        // Agrupar por tipo principal
        const porTipo = await PhotoCategory.aggregate([
            { $match: { basePrice: { $gt: 0 } } },
            {
                $group: {
                    _id: {
                        $switch: {
                            branches: [
                                { case: { $regexMatch: { input: '$displayName', regex: /Colombian/i } }, then: 'Colombian' },
                                { case: { $regexMatch: { input: '$displayName', regex: /Brazil Best Sellers/i } }, then: 'Brazil Best Sellers' },
                                { case: { $regexMatch: { input: '$displayName', regex: /Brazil Top.*Small/i } }, then: 'Brazil Top - Small' },
                                { case: { $regexMatch: { input: '$displayName', regex: /Brazil Top.*Medium Large/i } }, then: 'Brazil Top - ML' },
                                { case: { $regexMatch: { input: '$displayName', regex: /Brazil Top.*Extra Large/i } }, then: 'Brazil Top - XL' },
                                { case: { $regexMatch: { input: '$displayName', regex: /Rodeo Rugs/i } }, then: 'Rodeo Rugs' },
                            ],
                            default: 'Outros'
                        }
                    },
                    quantidade: { $sum: 1 },
                    precoMin: { $min: '$basePrice' },
                    precoMax: { $max: '$basePrice' },
                    precoMedio: { $avg: '$basePrice' }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        console.log('💰 PREÇOS POR CATEGORIA:');
        console.log('─'.repeat(60));
        porTipo.forEach(tipo => {
            console.log(`${tipo._id}:`);
            console.log(`  Qtd: ${tipo.quantidade} | Min: $${tipo.precoMin} | Max: $${tipo.precoMax} | Média: $${Math.round(tipo.precoMedio)}`);
        });
        
        // Ver se ainda tem alguma sem preço
        const semPreco = await PhotoCategory.find({ basePrice: 0 });
        if (semPreco.length > 0) {
            console.log('\n⚠️ AINDA SEM PREÇO:');
            semPreco.forEach(cat => {
                console.log(`  - ${cat.displayName.split('→').slice(-2).join(' → ')}`);
            });
        } else {
            console.log('\n✅ TODAS AS CATEGORIAS TÊM PREÇO!');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Erro:', error);
        process.exit(1);
    }
}

resumoFinal();
