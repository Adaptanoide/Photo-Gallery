// scripts/analyze-r2-complete.js
require('dotenv').config();
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

async function analyzeR2Complete() {
    console.log('🔍 ANÁLISE COMPLETA DO R2\n');
    
    const client = new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        }
    });

    // Buscar TODOS os objetos
    const allObjects = [];
    let continuationToken = null;
    
    do {
        const command = new ListObjectsV2Command({
            Bucket: process.env.R2_BUCKET_NAME,
            MaxKeys: 1000,
            ContinuationToken: continuationToken
        });
        
        const response = await client.send(command);
        if (response.Contents) {
            allObjects.push(...response.Contents);
        }
        continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    console.log(`📦 Total de objetos: ${allObjects.length}\n`);

    // Agrupar por pasta e contar
    const folders = {};
    let totalImages = 0;
    
    for (const obj of allObjects) {
        // Ignorar thumbnails
        if (obj.Key.startsWith('_thumbnails/')) continue;
        
        // Verificar se é imagem
        if (!/\.(jpg|jpeg|png|webp)$/i.test(obj.Key)) continue;
        
        totalImages++;
        
        // Pegar pasta pai
        const parts = obj.Key.split('/');
        parts.pop(); // Remove filename
        
        // Contar para CADA nível
        for (let i = 1; i <= parts.length; i++) {
            const path = parts.slice(0, i).join('/');
            if (!folders[path]) {
                folders[path] = { 
                    level: i, 
                    photoCount: 0,
                    path: path 
                };
            }
            folders[path].photoCount++;
        }
    }

    // Filtrar apenas pastas FINAIS (que têm fotos diretas)
    const finalFolders = {};
    
    for (const [path, data] of Object.entries(folders)) {
        // Verificar se tem subpastas
        const hasSubfolders = Object.keys(folders).some(p => 
            p !== path && p.startsWith(path + '/')
        );
        
        if (!hasSubfolders && data.photoCount > 0) {
            finalFolders[path] = data;
        }
    }

    // Estatísticas
    console.log('📊 ESTATÍSTICAS GERAIS:');
    console.log(`   Total de imagens: ${totalImages}`);
    console.log(`   Total de pastas: ${Object.keys(folders).length}`);
    console.log(`   Categorias finais (com fotos): ${Object.keys(finalFolders).length}\n`);

    // Agrupar por pasta principal
    const byMainFolder = {};
    for (const [path, data] of Object.entries(finalFolders)) {
        const mainFolder = path.split('/')[0];
        if (!byMainFolder[mainFolder]) {
            byMainFolder[mainFolder] = [];
        }
        byMainFolder[mainFolder].push(data);
    }

    // Mostrar resumo
    console.log('📁 RESUMO POR PASTA PRINCIPAL:');
    for (const [main, categories] of Object.entries(byMainFolder)) {
        const total = categories.reduce((sum, c) => sum + c.photoCount, 0);
        console.log(`\n   ${main}:`);
        console.log(`      - Subcategorias: ${categories.length}`);
        console.log(`      - Total de fotos: ${total}`);
        
        // Mostrar primeiras 3
        categories.slice(0, 3).forEach(cat => {
            console.log(`        • ${cat.path} (${cat.photoCount} fotos)`);
        });
        if (categories.length > 3) {
            console.log(`        ... e mais ${categories.length - 3} categorias`);
        }
    }

    // Comparar com MongoDB
    const mongoose = require('mongoose');
    const PhotoCategory = require('../src/models/PhotoCategory');
    
    await mongoose.connect(process.env.MONGODB_URI);
    const mongoCount = await PhotoCategory.countDocuments({ isActive: true });
    
    console.log('\n🔄 COMPARAÇÃO COM MONGODB:');
    console.log(`   R2 tem: ${Object.keys(finalFolders).length} categorias`);
    console.log(`   MongoDB tem: ${mongoCount} categorias`);
    console.log(`   Diferença: ${Object.keys(finalFolders).length - mongoCount} categorias faltando!\n`);
    
    mongoose.connection.close();
    
    // Salvar em arquivo
    const fs = require('fs');
    fs.writeFileSync('r2-analysis.json', JSON.stringify({
        totalImages,
        totalFolders: Object.keys(folders).length,
        finalCategories: Object.keys(finalFolders).length,
        categories: finalFolders
    }, null, 2));
    
    console.log('💾 Análise salva em r2-analysis.json');
}

analyzeR2Complete().catch(console.error);