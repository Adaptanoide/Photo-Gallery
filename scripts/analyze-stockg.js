const xlsx = require('xlsx');

const workbook = xlsx.readFile('StockGReport.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

// Skip header rows - QBITEM is at index 1, DESCRIPTION at index 2, TOTAL at index 6
const products = data.slice(2).map(row => ({
    qbitem: row[1],
    description: row[2],
    stock: row[6] || 0
})).filter(p => p.qbitem && p.qbitem !== 'ITEM' && p.qbitem !== '0000');

console.log('📊 Total produtos válidos:', products.length);

// Analyze by code prefix (first digit)
const byPrefix = {};
products.forEach(p => {
    const code = String(p.qbitem);
    const prefix = code[0];
    if (!byPrefix[prefix]) byPrefix[prefix] = [];
    byPrefix[prefix].push(p);
});

console.log('\n📁 PRODUTOS POR PREFIXO (primeiro dígito):');
console.log('-'.repeat(60));
Object.keys(byPrefix).sort().forEach(prefix => {
    const items = byPrefix[prefix];
    const sample = items.slice(0, 3).map(i => i.qbitem).join(', ');
    console.log('   ' + prefix + 'XXX: ' + items.length + ' produtos (ex: ' + sample + ')');
});

// COWHIDES Analysis (5XXX)
console.log('\n🐄 ANÁLISE DETALHADA: COWHIDES (5XXX)');
console.log('-'.repeat(60));

const cowhides = products.filter(p => String(p.qbitem).match(/^5\d/));
console.log('Total cowhides:', cowhides.length);

// Group by base code (first 4 digits)
const baseCodeGroups = {};
cowhides.forEach(p => {
    const code = String(p.qbitem);
    const base = code.match(/^(\d{4})/);
    if (base) {
        if (!baseCodeGroups[base[1]]) baseCodeGroups[base[1]] = [];
        baseCodeGroups[base[1]].push(p);
    }
});

console.log('\nGrupos de cowhides por código base:');
Object.keys(baseCodeGroups).sort().forEach(base => {
    const items = baseCodeGroups[base];
    const firstDesc = items[0].description ? items[0].description.substring(0, 50) : '';
    console.log('   ' + base + ': ' + items.length + ' variações - ' + firstDesc);
});

// Analyze suffixes in cowhides
console.log('\n🔤 SUFIXOS DOS COWHIDES:');
const suffixMap = {};
cowhides.forEach(p => {
    const code = String(p.qbitem);
    const match = code.match(/^\d{4}(.+)$/);
    if (match && match[1]) {
        const suffix = match[1];
        if (!suffixMap[suffix]) {
            suffixMap[suffix] = { count: 0, examples: [], descriptions: [] };
        }
        suffixMap[suffix].count++;
        if (suffixMap[suffix].examples.length < 2) {
            suffixMap[suffix].examples.push(code);
            suffixMap[suffix].descriptions.push(p.description ? p.description.substring(0, 40) : '');
        }
    }
});

Object.entries(suffixMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 25)
    .forEach(([suffix, data]) => {
        console.log('   ' + suffix.padEnd(10) + ': ' + data.count + ' produtos');
        console.log('      Ex: ' + data.examples[0] + ' = ' + data.descriptions[0]);
    });

// DESIGNER RUGS Analysis (4XXX)
console.log('\n🎨 ANÁLISE DETALHADA: DESIGNER RUGS (4XXX)');
console.log('-'.repeat(60));

const rugs = products.filter(p => String(p.qbitem).match(/^4\d/));
console.log('Total designer rugs:', rugs.length);

rugs.slice(0, 15).forEach(r => {
    console.log('   [' + r.qbitem + '] ' + (r.description || '').substring(0, 55));
});

// ACCESSORIES Analysis (2XXX)
console.log('\n🎁 ANÁLISE DETALHADA: ACESSÓRIOS (2XXX)');
console.log('-'.repeat(60));

const acc = products.filter(p => String(p.qbitem).match(/^2\d/));
console.log('Total acessórios:', acc.length);

// Show coasters specifically (211X, 212X, 213X)
const coasters = acc.filter(p => String(p.qbitem).match(/^21[1-3]/));
console.log('\nCoasters (top sellers - 211X, 212X, 213X):');
coasters.forEach(c => {
    console.log('   [' + c.qbitem + '] ' + (c.description || '').substring(0, 55));
});

// Export all products as JSON for reference
console.log('\n📤 Exportando lista completa para análise...');
const productMap = {};
products.forEach(p => {
    productMap[p.qbitem] = p.description;
});
console.log('Total de produtos mapeados:', Object.keys(productMap).length);

// Show products starting with other prefixes
console.log('\n📦 OUTROS PRODUTOS:');
const others = products.filter(p => !String(p.qbitem).match(/^[245]\d/));
console.log('Produtos com outros prefixos:', others.length);
others.slice(0, 20).forEach(o => {
    console.log('   [' + o.qbitem + '] ' + (o.description || '').substring(0, 50));
});
