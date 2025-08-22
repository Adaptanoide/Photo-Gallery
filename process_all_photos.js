#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// Configuração do R2
const s3Client = new S3Client({
    endpoint: process.env.R2_ENDPOINT,
    region: 'auto',
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});

// Configurações
const LOCAL_PHOTOS_DIR = './all_photos';
const BUCKET_NAME = 'sunshine-photos';
const CATEGORIES_TO_SKIP = ['Sheepskins']; // Já processada
const BATCH_SIZE = 10;

// Contadores globais
let stats = {
    total: 0,
    processed: 0,
    skipped: 0,
    errors: 0,
    startTime: Date.now()
};

// Arquivo de progresso
const PROGRESS_FILE = './processing_progress.json';

// Carregar progresso anterior se existir
function loadProgress() {
    if (fs.existsSync(PROGRESS_FILE)) {
        const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
        console.log(`📊 Continuando do progresso anterior: ${data.processed}/${data.total}`);
        return new Set(data.completed || []);
    }
    return new Set();
}

// Salvar progresso
function saveProgress(completed) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
        total: stats.total,
        processed: stats.processed,
        completed: Array.from(completed),
        timestamp: new Date().toISOString()
    }, null, 2));
}

// Verificar se arquivo já existe no R2
async function existsInR2(key) {
    try {
        await s3Client.send(new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        }));
        return true;
    } catch {
        return false;
    }
}

// Upload para R2
async function uploadToR2(buffer, key, contentType = 'image/webp') {
    try {
        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType
        }));
        return true;
    } catch (error) {
        console.error(`❌ Erro upload ${key}:`, error.message);
        return false;
    }
}

// Processar uma foto
async function processPhoto(photoPath, relativePath, completed) {
    // Skip se já foi processada
    if (completed.has(relativePath)) {
        stats.skipped++;
        return;
    }

    // Skip categorias já processadas
    if (CATEGORIES_TO_SKIP.some(cat => relativePath.includes(cat))) {
        console.log(`⏭️  Pulando (Sheepskins já processada): ${relativePath}`);
        stats.skipped++;
        completed.add(relativePath);
        return;
    }

    try {
        console.log(`\n📸 [${stats.processed + 1}/${stats.total}] Processando: ${relativePath}`);
        
        // Verificar se preview já existe
        const previewKey = `_preview/${relativePath}`;
        const displayKey = `_display/${relativePath}`;
        
        let previewExists = await existsInR2(previewKey);
        let displayExists = await existsInR2(displayKey);
        
        if (previewExists && displayExists) {
            console.log(`✅ Já existe no R2, pulando...`);
            stats.skipped++;
            completed.add(relativePath);
            return;
        }

        // Ler imagem original
        const imageBuffer = await fs.promises.readFile(photoPath);
        
        // Criar e fazer upload do preview se não existir
        if (!previewExists) {
            console.log(`  📐 Criando preview (400KB)...`);
            const previewBuffer = await sharp(imageBuffer)
                .webp({ 
                    quality: 85,
                    effort: 4
                })
                .resize(1400, 1400, { 
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .toBuffer();
            
            const uploaded = await uploadToR2(previewBuffer, previewKey);
            if (uploaded) {
                console.log(`  ✅ Preview uploaded: ${(previewBuffer.length / 1024).toFixed(0)}KB`);
            }
        }

        // Criar e fazer upload do display se não existir
        if (!displayExists) {
            console.log(`  📐 Criando display (1MB)...`);
            const displayBuffer = await sharp(imageBuffer)
                .webp({ 
                    quality: 92,
                    effort: 4
                })
                .resize(2000, 2000, { 
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .toBuffer();
            
            const uploaded = await uploadToR2(displayBuffer, displayKey);
            if (uploaded) {
                console.log(`  ✅ Display uploaded: ${(displayBuffer.length / 1024).toFixed(0)}KB`);
            }
        }

        stats.processed++;
        completed.add(relativePath);
        
        // Salvar progresso a cada 10 fotos
        if (stats.processed % 10 === 0) {
            saveProgress(completed);
            const elapsed = (Date.now() - stats.startTime) / 1000 / 60;
            const rate = stats.processed / elapsed;
            const remaining = (stats.total - stats.processed) / rate;
            console.log(`\n📊 Progresso: ${stats.processed}/${stats.total} (${(stats.processed/stats.total*100).toFixed(1)}%)`);
            console.log(`⏱️  Tempo restante estimado: ${remaining.toFixed(0)} minutos`);
        }

    } catch (error) {
        console.error(`❌ Erro processando ${relativePath}:`, error.message);
        stats.errors++;
    }
}

// Encontrar todas as fotos recursivamente
function findAllPhotos(dir, baseDir = dir) {
    let photos = [];
    
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            photos = photos.concat(findAllPhotos(fullPath, baseDir));
        } else if (item.endsWith('.webp') || item.endsWith('.jpg')) {
            const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
            photos.push({ fullPath, relativePath });
        }
    }
    
    return photos;
}

// Processar em lotes
async function processBatch(photos, completed) {
    for (let i = 0; i < photos.length; i += BATCH_SIZE) {
        const batch = photos.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(photo => 
            processPhoto(photo.fullPath, photo.relativePath, completed)
        ));
    }
}

// Main
async function main() {
    console.log('🚀 PROCESSADOR DE FOTOS SUNSHINE - R2 OPTIMIZATION');
    console.log('===================================================\n');
    
    // Verificar se diretório existe
    if (!fs.existsSync(LOCAL_PHOTOS_DIR)) {
        console.error(`❌ Diretório ${LOCAL_PHOTOS_DIR} não encontrado!`);
        console.log(`📝 Crie o diretório e copie as fotos do R2 primeiro.`);
        return;
    }

    // Carregar progresso anterior
    const completed = loadProgress();
    
    // Encontrar todas as fotos
    console.log('🔍 Procurando fotos...');
    const photos = findAllPhotos(LOCAL_PHOTOS_DIR);
    stats.total = photos.length;
    
    console.log(`📊 Encontradas ${stats.total} fotos para processar`);
    console.log(`⏭️  ${completed.size} já processadas anteriormente`);
    console.log(`📁 Categorias que serão puladas: ${CATEGORIES_TO_SKIP.join(', ')}\n`);
    
    if (stats.total === 0) {
        console.log('Nenhuma foto para processar!');
        return;
    }

    // Processar
    console.log('🎬 Iniciando processamento...\n');
    await processBatch(photos, completed);
    
    // Estatísticas finais
    const elapsed = (Date.now() - stats.startTime) / 1000 / 60;
    console.log('\n\n✅ PROCESSAMENTO COMPLETO!');
    console.log('========================');
    console.log(`📊 Total: ${stats.total} fotos`);
    console.log(`✅ Processadas: ${stats.processed}`);
    console.log(`⏭️  Puladas: ${stats.skipped}`);
    console.log(`❌ Erros: ${stats.errors}`);
    console.log(`⏱️  Tempo total: ${elapsed.toFixed(1)} minutos`);
    
    // Limpar arquivo de progresso se completou
    if (stats.processed + stats.skipped === stats.total) {
        fs.unlinkSync(PROGRESS_FILE);
        console.log('\n🎉 Todas as fotos foram processadas com sucesso!');
    }
}

// Executar
main().catch(console.error);
