// verificar-precos.js
const mongoose = require('mongoose');
require('dotenv').config();

async function verificarPrecos() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const PhotoCategory = require('./src/models/PhotoCategory');
        
        // Estatísticas
        const total = await PhotoCategory.countDocuments();
        const comPreco = await PhotoCategory.countDocuments({ basePrice: { $gt: 0 } });
        const semPreco = await PhotoCategory.countDocuments({ basePrice: 0 });
        
        console.log('📊 ESTATÍSTICAS ATUAIS:');
        console.log(`Total: ${total} | Com preço: ${comPreco} | Sem preço: ${semPreco}\n`);
        
        // Agrupar por faixa de preço
        const faixas = await PhotoCategory.aggregate([
            { $match: { basePrice: { $gt: 0 } } },
            {
                $group: {
                    _id: {
                        $switch: {
                            branches: [
                                { case: { $lte: ['$basePrice', 50] }, then: '$0-50' },
                                { case: { $lte: ['$basePrice', 100] }, then: '$51-100' },
                                { case: { $lte: ['$basePrice', 150] }, then: '$101-150' },
                                { case: { $lte: ['$basePrice', 200] }, then: '$151-200' },
                            ],
                            default: '$200+'
                        }
                    },
                    count: { $sum: 1 },
                    examples: { $push: '$displayName' }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        console.log('💰 FAIXAS DE PREÇO:');
        faixas.forEach(f => {
            console.log(`${f._id}: ${f.count} categorias`);
            console.log(`  Ex: ${f.examples[0].split('→').pop().trim()}\n`);
        });
        
        // Ver os que faltam
        const semPrecoLista = await PhotoCategory.find({ basePrice: 0 }).limit(10);
        console.log('❌ AINDA SEM PREÇO (primeiras 10):');
        semPrecoLista.forEach(cat => {
            const nome = cat.displayName.split('→').slice(-2).join(' → ');
            console.log(`  ${nome}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Erro:', error);
        process.exit(1);
    }
}

verificarPrecos();
