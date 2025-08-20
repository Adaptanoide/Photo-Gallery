// scripts/add-keep-to-all.js
require('dotenv').config();
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

async function addKeepToAllFolders() {
    console.log('🚀 Adicionando .keep em TODAS as pastas do R2...\n');
    
    const client = new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        }
    });

    // PASSO 1: Buscar TODOS os objetos
    console.log('📦 Passo 1: Listando todos os objetos...');
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

    console.log(`✅ Total de objetos encontrados: ${allObjects.length}\n`);

    // PASSO 2: Identificar TODAS as pastas únicas
    console.log('📂 Passo 2: Identificando todas as pastas...');
    const allFolders = new Set();
    
    for (const obj of allObjects) {
        // Ignorar thumbnails
        if (obj.Key.startsWith('_thumbnails/')) continue;
        
        // Extrair caminho da pasta
        const lastSlash = obj.Key.lastIndexOf('/');
        if (lastSlash > 0) {
            const folderPath = obj.Key.substring(0, lastSlash);
            
            // Adicionar esta pasta e TODAS as pastas pai
            const parts = folderPath.split('/');
            for (let i = 1; i <= parts.length; i++) {
                const subPath = parts.slice(0, i).join('/');
                if (subPath) allFolders.add(subPath);
            }
        }
    }

    // Adicionar pastas conhecidas que podem estar vazias
    const knownEmptyFolders = [
        // Estrutura esperada - adicione se souber de pastas vazias específicas
        'Brazil Top Selected Categories/Extra Small',
        'Colombian Cowhides/4. XX-Large',
        // ... adicione outras que você conhece
    ];
    
    knownEmptyFolders.forEach(folder => allFolders.add(folder));

    console.log(`✅ Total de pastas únicas: ${allFolders.size}\n`);

    // PASSO 3: Verificar quais já têm .keep
    console.log('🔍 Passo 3: Verificando pastas que já têm .keep...');
    const foldersWithKeep = new Set();
    
    for (const obj of allObjects) {
        if (obj.Key.endsWith('/.keep')) {
            const folder = obj.Key.replace('/.keep', '');
            foldersWithKeep.add(folder);
        }
    }
    
    console.log(`📌 Pastas que já têm .keep: ${foldersWithKeep.size}\n`);

    // PASSO 4: Criar .keep onde não existe
    console.log('✨ Passo 4: Criando arquivos .keep...\n');
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const folder of allFolders) {
        if (foldersWithKeep.has(folder)) {
            skipped++;
            continue;
        }
        
        const keepKey = `${folder}/.keep`;
        console.log(`📁 Criando: ${keepKey}`);
        
        const putCommand = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: keepKey,
            Body: 'This file maintains folder structure in R2',
            ContentType: 'text/plain',
            Metadata: {
                'purpose': 'folder-structure',
                'created': new Date().toISOString()
            }
        });
        
        try {
            await client.send(putCommand);
            created++;
            console.log(`   ✅ Criado com sucesso!`);
        } catch (error) {
            errors++;
            console.error(`   ❌ Erro: ${error.message}`);
        }
    }

    // RESUMO FINAL
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMO FINAL:');
    console.log('='.repeat(50));
    console.log(`✅ Arquivos .keep criados: ${created}`);
    console.log(`⏭️ Pastas puladas (já tinham): ${skipped}`);
    console.log(`❌ Erros: ${errors}`);
    console.log(`📁 Total de pastas com .keep: ${foldersWithKeep.size + created}`);
    console.log('='.repeat(50));
    
    if (created > 0) {
        console.log('\n🎉 Sucesso! Agora TODAS as pastas têm .keep');
        console.log('📌 Próximo passo: Execute "Refresh from R2" no admin');
    }
}

// Executar
addKeepToAllFolders().catch(console.error);