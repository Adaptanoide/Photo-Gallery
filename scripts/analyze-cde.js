const mysql = require('mysql2/promise');
require('dotenv').config();

async function analyzeItems() {
    const pool = mysql.createPool({
        host: process.env.CDE_HOST,
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE,
        port: process.env.CDE_PORT || 3306
    });

    console.log('='.repeat(70));
    console.log('🏷️ ANÁLISE DA TABELA ITEMS (Catálogo de Produtos)');
    console.log('='.repeat(70));

    // Get all items
    const [items] = await pool.query('SELECT AQBITEM, ADESCRIPTION, ACATEGORIA, ASUBCATEGORIA, ORIGEN FROM items ORDER BY AQBITEM');

    console.log('\n📊 Total de produtos no catálogo:', items.length);

    // Analyze by category
    const byCategory = {};
    items.forEach(i => {
        const cat = i.ACATEGORIA || 'SEM CATEGORIA';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(i);
    });

    console.log('\n📁 PRODUTOS POR CATEGORIA:');
    Object.keys(byCategory).sort().forEach(cat => {
        console.log('   ' + cat + ': ' + byCategory[cat].length + ' produtos');
    });

    // Analyze COWHIDES (5XXX)
    const cowhides = items.filter(i => i.AQBITEM && i.AQBITEM.match(/^5\d{3}/));
    console.log('\n🐄 COWHIDES (códigos 5XXX): ' + cowhides.length + ' produtos');

    // Show sample cowhides with variations
    console.log('\n   Exemplos de COWHIDES:');
    const cowhideSamples = cowhides.slice(0, 25);
    cowhideSamples.forEach(c => {
        console.log('   [' + c.AQBITEM + '] ' + (c.ADESCRIPTION || '').substring(0, 55) + ' (' + c.ORIGEN + ')');
    });

    // Analyze DESIGNER RUGS (4XXX)
    const rugs = items.filter(i => i.AQBITEM && i.AQBITEM.match(/^4\d{3}/));
    console.log('\n🎨 DESIGNER RUGS (códigos 4XXX): ' + rugs.length + ' produtos');

    console.log('\n   Exemplos de DESIGNER RUGS:');
    const rugSamples = rugs.slice(0, 15);
    rugSamples.forEach(r => {
        console.log('   [' + r.AQBITEM + '] ' + (r.ADESCRIPTION || '').substring(0, 55) + ' (' + r.ORIGEN + ')');
    });

    // Analyze ACCESSORIES (2XXX)
    const accessories = items.filter(i => i.AQBITEM && i.AQBITEM.match(/^2\d{3}/));
    console.log('\n🎁 ACESSÓRIOS (códigos 2XXX): ' + accessories.length + ' produtos');

    console.log('\n   Exemplos de ACESSÓRIOS:');
    const accSamples = accessories.slice(0, 10);
    accSamples.forEach(a => {
        console.log('   [' + a.AQBITEM + '] ' + (a.ADESCRIPTION || '').substring(0, 55));
    });

    // Analyze code patterns (suffixes like BR, LGT, Z, etc)
    console.log('\n🔤 ANÁLISE DE SUFIXOS (variações de produtos):');
    const suffixes = {};
    items.forEach(i => {
        if (i.AQBITEM) {
            const match = i.AQBITEM.match(/^(\d+)([A-Z]+.*)?$/);
            if (match && match[2]) {
                const suffix = match[2];
                if (!suffixes[suffix]) suffixes[suffix] = { count: 0, examples: [] };
                suffixes[suffix].count++;
                if (suffixes[suffix].examples.length < 3) {
                    suffixes[suffix].examples.push(i.AQBITEM);
                }
            }
        }
    });

    const sortedSuffixes = Object.entries(suffixes)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 20);

    sortedSuffixes.forEach(([suffix, data]) => {
        console.log('   ' + suffix.padEnd(10) + ': ' + data.count + ' produtos (ex: ' + data.examples.join(', ') + ')');
    });

    // Analyze origin distribution
    console.log('\n🌍 PRODUTOS POR ORIGEM:');
    const byOrigin = {};
    items.forEach(i => {
        const origin = i.ORIGEN || 'N/A';
        byOrigin[origin] = (byOrigin[origin] || 0) + 1;
    });
    Object.entries(byOrigin).sort((a,b) => b[1] - a[1]).forEach(([origin, count]) => {
        console.log('   ' + origin + ': ' + count + ' produtos');
    });

    await pool.end();
}

analyzeItems().catch(console.error);
