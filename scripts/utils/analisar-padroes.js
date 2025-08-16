// analisar-padroes.js
const mongoose = require('mongoose');
require('dotenv').config();

async function analisarPadroes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const PhotoCategory = require('./src/models/PhotoCategory');
        
        const categorias = await PhotoCategory.find({ basePrice: 0 });
        
        // Agrupar por tipo principal
        const grupos = {
            'Colombian': [],
            'Brazil Best Sellers': [],
            'Brazil Top Selected - Small': [],
            'Brazil Top Selected - Medium Large': [],
            'Brazil Top Selected - Extra Large': [],
            'Rodeo Rugs': [],
            'Calfskins': [],
            'Sheepskins': [],
            'Duffle Bags': [],
            'Outros': []
        };
        
        categorias.forEach(cat => {
            const nome = cat.displayName;
            
            if (nome.includes('Colombian')) {
                grupos['Colombian'].push(nome);
            } else if (nome.includes('Brazil Best Sellers')) {
                grupos['Brazil Best Sellers'].push(nome);
            } else if (nome.includes('Brazil Top Selected') && nome.includes('Small')) {
                grupos['Brazil Top Selected - Small'].push(nome);
            } else if (nome.includes('Brazil Top Selected') && nome.includes('Medium Large')) {
                grupos['Brazil Top Selected - Medium Large'].push(nome);
            } else if (nome.includes('Brazil Top Selected') && nome.includes('Extra Large')) {
                grupos['Brazil Top Selected - Extra Large'].push(nome);
            } else if (nome.includes('Rodeo Rugs')) {
                grupos['Rodeo Rugs'].push(nome);
            } else if (nome.includes('Calfskins')) {
                grupos['Calfskins'].push(nome);
            } else if (nome.includes('Sheepskins')) {
                grupos['Sheepskins'].push(nome);
            } else if (nome.includes('Duffle Bags')) {
                grupos['Duffle Bags'].push(nome);
            } else {
                grupos['Outros'].push(nome);
            }
        });
        
        // Mostrar resumo
        console.log('📊 RESUMO POR CATEGORIA:\n');
        for (const [tipo, items] of Object.entries(grupos)) {
            if (items.length > 0) {
                console.log(`\n${tipo}: ${items.length} categorias`);
                console.log('-------------------');
                items.slice(0, 3).forEach(item => {
                    console.log(`  • ${item.split('→').pop().trim()}`);
                });
                if (items.length > 3) {
                    console.log(`  ... e mais ${items.length - 3}`);
                }
            }
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Erro:', error);
        process.exit(1);
    }
}

analisarPadroes();
