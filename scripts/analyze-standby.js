/**
 * Script de Análise Minuciosa de Fotos STANDBY
 * Investiga onde estão (ou não) as fotos no R2 e seus estados no CDE
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { S3Client, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3');

// Configurar cliente R2
const r2Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'sunshine-photos';

async function main() {
    console.log('='.repeat(70));
    console.log('ANÁLISE MINUCIOSA DE FOTOS STANDBY');
    console.log('='.repeat(70));
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('');

    // 1. Conectar ao CDE e buscar todos os STANDBY
    console.log('[1/4] Buscando fotos STANDBY no CDE...');

    const cdeConnection = await mysql.createConnection({
        host: process.env.CDE_HOST,
        port: process.env.CDE_PORT,
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE
    });

    // IMPORTANTE: Só buscar STANDBY que:
    // 1. Tem número de foto REAL (não 0, não vazio)
    // 2. Existe na tbetiqueta (foi etiquetado = tem foto física)
    const [standbyPhotos] = await cdeConnection.execute(`
        SELECT DISTINCT
            i.ATIPOETIQUETA as photoNumber,
            i.AESTADOP as status,
            i.AQBITEM as qb,
            i.AIDH as idh,
            i.AFECHA as fecha,
            i.RESERVEDUSU as reservedBy
        FROM tbinventario i
        INNER JOIN tbetiqueta e ON i.ATIPOETIQUETA = e.ATIPOETIQUETA
        WHERE i.AESTADOP = 'STANDBY'
        AND i.ATIPOETIQUETA IS NOT NULL
        AND i.ATIPOETIQUETA != ''
        AND i.ATIPOETIQUETA != '0'
        AND i.ATIPOETIQUETA REGEXP '^[0-9]+$'
        AND LENGTH(i.ATIPOETIQUETA) >= 3
        ORDER BY i.AFECHA DESC
    `);

    await cdeConnection.end();

    console.log(`   Encontradas: ${standbyPhotos.length} fotos em STANDBY no CDE`);
    console.log('');

    // 2. Listar todas as pastas do R2 para referência
    console.log('[2/4] Listando estrutura do R2...');

    const r2Folders = new Set();
    const r2AllFiles = new Map(); // photoNumber -> [paths]

    let continuationToken = null;
    let totalFiles = 0;

    do {
        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            MaxKeys: 1000,
            ContinuationToken: continuationToken
        });

        const response = await r2Client.send(command);

        if (response.Contents) {
            for (const obj of response.Contents) {
                totalFiles++;

                // Extrair pasta
                const parts = obj.Key.split('/');
                if (parts.length > 1) {
                    r2Folders.add(parts[0]);
                }

                // Extrair número da foto de qualquer path
                const match = obj.Key.match(/(\d{4,5})\.(webp|jpg|JPG|jpeg|JPEG|png|PNG)$/i);
                if (match) {
                    const photoNum = match[1];
                    if (!r2AllFiles.has(photoNum)) {
                        r2AllFiles.set(photoNum, []);
                    }
                    r2AllFiles.get(photoNum).push(obj.Key);
                }
            }
        }

        continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
    } while (continuationToken);

    console.log(`   Total de arquivos no R2: ${totalFiles}`);
    console.log(`   Pastas encontradas: ${[...r2Folders].join(', ')}`);
    console.log(`   Números de foto únicos indexados: ${r2AllFiles.size}`);
    console.log('');

    // 3. Analisar cada foto STANDBY
    console.log('[3/4] Analisando cada foto STANDBY...');
    console.log('');

    const results = {
        withPhoto: [],
        withoutPhoto: [],
        partialPhoto: []
    };

    for (const photo of standbyPhotos) {
        const photoNumber = photo.photoNumber;
        const photoNumberClean = photoNumber.replace(/^0+/, '');

        // Verificar se existe no mapa
        const exactMatch = r2AllFiles.get(photoNumber) || [];
        const cleanMatch = r2AllFiles.get(photoNumberClean) || [];
        const allMatches = [...new Set([...exactMatch, ...cleanMatch])];

        // Classificar
        const analysis = {
            photoNumber,
            qb: photo.qb,
            idh: photo.idh,
            fecha: photo.fecha,
            reservedBy: photo.reservedBy,
            r2Paths: allMatches,
            hasProcessedWebp: allMatches.some(p => p.includes('.webp')),
            hasOriginalJpg: allMatches.some(p => p.toLowerCase().includes('.jpg')),
            inPhotosFolder: allMatches.some(p => p.startsWith('photos/')),
            inCategoryFolder: allMatches.some(p =>
                p.startsWith('Brazil Best Sellers/') ||
                p.startsWith('Brazil Top Selected Categories/') ||
                p.startsWith('Colombian Cowhides/') ||
                p.startsWith('Sheepskins/') ||
                p.startsWith('Calfskins/')
            )
        };

        if (allMatches.length === 0) {
            results.withoutPhoto.push(analysis);
        } else if (analysis.hasProcessedWebp && analysis.inCategoryFolder) {
            results.withPhoto.push(analysis);
        } else {
            results.partialPhoto.push(analysis);
        }
    }

    // 4. Gerar relatório
    console.log('[4/4] RELATÓRIO DETALHADO');
    console.log('='.repeat(70));

    // Fotos COM imagem completa (processada + na categoria)
    console.log(`\n✅ STANDBY COM FOTO COMPLETA: ${results.withPhoto.length}`);
    console.log('   (Tem .webp processado na pasta de categoria - PODE usar botão Preparar)');
    if (results.withPhoto.length > 0) {
        console.log('-'.repeat(70));
        for (const p of results.withPhoto) {
            console.log(`   📷 ${p.photoNumber} | QB: ${p.qb} | IDH: ${p.idh}`);
            console.log(`      Paths: ${p.r2Paths.join(', ')}`);
        }
    }

    // Fotos com imagem PARCIAL (original mas não processada)
    console.log(`\n⚠️  STANDBY COM FOTO PARCIAL: ${results.partialPhoto.length}`);
    console.log('   (Tem imagem original mas NÃO processada - precisa processamento)');
    if (results.partialPhoto.length > 0) {
        console.log('-'.repeat(70));
        for (const p of results.partialPhoto) {
            console.log(`   📷 ${p.photoNumber} | QB: ${p.qb} | IDH: ${p.idh}`);
            console.log(`      Paths encontrados: ${p.r2Paths.join(', ')}`);
            console.log(`      Original JPG: ${p.hasOriginalJpg ? 'SIM' : 'NÃO'}`);
            console.log(`      Processada WEBP: ${p.hasProcessedWebp ? 'SIM' : 'NÃO'}`);
            console.log(`      Na pasta photos/: ${p.inPhotosFolder ? 'SIM' : 'NÃO'}`);
            console.log(`      Na pasta categoria: ${p.inCategoryFolder ? 'SIM' : 'NÃO'}`);
        }
    }

    // Fotos SEM imagem
    console.log(`\n❌ STANDBY SEM FOTO: ${results.withoutPhoto.length}`);
    console.log('   (NÃO existe imagem no R2 - precisa ser fotografada)');
    if (results.withoutPhoto.length > 0) {
        console.log('-'.repeat(70));
        for (const p of results.withoutPhoto) {
            console.log(`   📷 ${p.photoNumber} | QB: ${p.qb} | IDH: ${p.idh} | Reserved: ${p.reservedBy || '-'}`);
        }
    }

    // Resumo e recomendações
    console.log('\n' + '='.repeat(70));
    console.log('RESUMO E RECOMENDAÇÕES');
    console.log('='.repeat(70));

    console.log(`
Total STANDBY no CDE: ${standbyPhotos.length}
├── Com foto completa (prontas): ${results.withPhoto.length}
├── Com foto parcial (precisam processamento): ${results.partialPhoto.length}
└── Sem foto (precisam ser fotografadas): ${results.withoutPhoto.length}
`);

    if (results.withPhoto.length > 0) {
        console.log('🔧 AÇÃO IMEDIATA POSSÍVEL:');
        console.log(`   ${results.withPhoto.length} fotos podem ser importadas com o botão "Preparar"`);
        console.log(`   PhotoNumbers: ${results.withPhoto.map(p => p.photoNumber).join(', ')}`);
    }

    if (results.partialPhoto.length > 0) {
        console.log('\n🔄 PRECISAM PROCESSAMENTO:');
        console.log(`   ${results.partialPhoto.length} fotos têm original mas precisam ser processadas`);
        console.log(`   PhotoNumbers: ${results.partialPhoto.map(p => p.photoNumber).join(', ')}`);
        console.log(`   Ação: Rodar o script de processamento de imagens para estas fotos`);
    }

    if (results.withoutPhoto.length > 0) {
        console.log('\n📷 PRECISAM SER FOTOGRAFADAS:');
        console.log(`   ${results.withoutPhoto.length} fotos não existem no R2`);
        console.log(`   PhotoNumbers: ${results.withoutPhoto.map(p => p.photoNumber).join(', ')}`);
        console.log(`   QBs: ${[...new Set(results.withoutPhoto.map(p => p.qb))].join(', ')}`);
    }

    // Exportar para JSON
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            totalStandby: standbyPhotos.length,
            withPhoto: results.withPhoto.length,
            partialPhoto: results.partialPhoto.length,
            withoutPhoto: results.withoutPhoto.length
        },
        r2Structure: {
            totalFiles,
            folders: [...r2Folders]
        },
        details: {
            withPhoto: results.withPhoto,
            partialPhoto: results.partialPhoto,
            withoutPhoto: results.withoutPhoto
        }
    };

    const fs = require('fs');
    const reportPath = './standby-analysis-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Relatório completo salvo em: ${reportPath}`);

    console.log('\n' + '='.repeat(70));
    console.log('FIM DA ANÁLISE');
    console.log('='.repeat(70));
}

main().catch(err => {
    console.error('ERRO:', err);
    process.exit(1);
});
