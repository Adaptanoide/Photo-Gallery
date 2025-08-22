// scripts/update-version.js
const fs = require('fs');
const path = require('path');

// Gerar versão baseada em timestamp
const version = new Date().getTime();

// Arquivos HTML para atualizar
const htmlFiles = [
    'public/client.html',
    'public/index.html'
];

// Atualizar versão em cada arquivo
htmlFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        // Substituir qualquer versão por nova
        content = content.replace(/\.js\?v=[\d.]+/g, `.js?v=${version}`);
        content = content.replace(/\.css\?v=[\d.]+/g, `.css?v=${version}`);
        fs.writeFileSync(filePath, content);
        console.log(`✅ Atualizado: ${file} com versão ${version}`);
    }
});

console.log(`\n📦 Nova versão: ${version}`);
console.log('Use: git add . && git commit -m "update: version" && git push');
