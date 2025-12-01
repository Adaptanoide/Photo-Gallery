/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DIAGNÓSTICO DE CATEGORIAS DUPLICADAS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este script APENAS ANALISA - NÃO MODIFICA NADA no banco de dados.
 * 
 * O que ele faz:
 * 1. Identifica categorias com mesmo qbItem (duplicadas)
 * 2. Mostra quantas fotos cada versão tem
 * 3. Identifica qual é a "antiga" (nome curto) vs "nova" (nome longo)
 * 4. Mostra exatamente o que o script de correção fará
 * 
 * Uso: 
 *   cd C:\Users\Tiago\Desktop\GALERIA
 *   node scripts/diagnostico-categorias-duplicadas.js
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Modelos
const PhotoCategory = require('../src/models/PhotoCategory');
const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
// ═══════════════════════════════════════════════════════════════════════════
// CORES PARA O TERMINAL
// ═══════════════════════════════════════════════════════════════════════════
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m'
};

function log(color, message) {
    console.log(`${color}${message}${colors.reset}`);
}

function header(text) {
    console.log('\n' + '═'.repeat(75));
    log(colors.cyan + colors.bright, `  ${text}`);
    console.log('═'.repeat(75));
}

function subheader(text) {
    console.log('\n' + '─'.repeat(75));
    log(colors.yellow, `  ${text}`);
    console.log('─'.repeat(75));
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
async function runDiagnostic() {
    header('🔍 DIAGNÓSTICO DE CATEGORIAS DUPLICADAS');
    console.log(`📅 Data: ${new Date().toLocaleString('pt-BR')}`);
    log(colors.green + colors.bright, '⚠️  Este script APENAS ANALISA - NÃO MODIFICA NADA!\n');

    try {
        // ═══════════════════════════════════════════════════════════════════
        // CONECTAR AO MONGODB
        // ═══════════════════════════════════════════════════════════════════
        log(colors.yellow, '🔌 Conectando ao MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        log(colors.green, '✅ Conectado!\n');

        // ═══════════════════════════════════════════════════════════════════
        // PARTE 1: BUSCAR CATEGORIAS DUPLICADAS POR QBITEM
        // ═══════════════════════════════════════════════════════════════════
        subheader('📊 PARTE 1: CATEGORIAS DUPLICADAS POR QB ITEM');

        const duplicates = await PhotoCategory.aggregate([
            { $match: { isActive: true, qbItem: { $ne: "" }, qbItem: { $ne: null } } },
            {
                $group: {
                    _id: "$qbItem",
                    count: { $sum: 1 },
                    categories: {
                        $push: {
                            id: "$_id",
                            displayName: "$displayName",
                            googleDrivePath: "$googleDrivePath",
                            photoCount: "$photoCount",
                            basePrice: "$basePrice",
                            createdAt: "$createdAt"
                        }
                    }
                }
            },
            { $match: { count: { $gt: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        if (duplicates.length === 0) {
            log(colors.green + colors.bright, '\n✅ NENHUMA CATEGORIA DUPLICADA ENCONTRADA!');
            log(colors.green, '   O sistema está limpo.\n');
            await mongoose.disconnect();
            return;
        }

        log(colors.red + colors.bright, `\n⚠️  ENCONTRADOS ${duplicates.length} QB ITEMS COM DUPLICATAS:\n`);

        // ═══════════════════════════════════════════════════════════════════
        // PARTE 2: ANALISAR CADA DUPLICATA
        // ═══════════════════════════════════════════════════════════════════
        const corrections = [];

        for (const dup of duplicates) {
            console.log('┌' + '─'.repeat(73) + '┐');
            log(colors.yellow + colors.bright, `│ QB Item: ${dup._id.padEnd(62)}│`);
            console.log('├' + '─'.repeat(73) + '┤');

            // Identificar qual é a categoria "antiga" (nome mais curto) e "nova" (nome mais longo)
            const sorted = dup.categories.sort((a, b) => a.displayName.length - b.displayName.length);
            const oldCategory = sorted[0]; // Nome mais curto = antiga
            const newCategories = sorted.slice(1); // Nomes mais longos = novas (duplicadas)

            // Contar fotos REAIS no MongoDB para cada categoria
            const oldPhotoCount = await UnifiedProductComplete.countDocuments({
                category: oldCategory.displayName
            });

            console.log(`│ ${colors.green}✅ MANTER (nome curto):${colors.reset}`.padEnd(84) + '│');
            console.log(`│    📛 ${oldCategory.displayName.substring(0, 63)}`.padEnd(74) + '│');
            if (oldCategory.displayName.length > 63) {
                console.log(`│       ${oldCategory.displayName.substring(63, 126)}`.padEnd(74) + '│');
            }
            console.log(`│    📁 Path: ${oldCategory.googleDrivePath.substring(0, 55)}`.padEnd(74) + '│');
            console.log(`│    📷 Fotos no MongoDB: ${oldPhotoCount} | 💰 Preço: $${oldCategory.basePrice || 0}`.padEnd(74) + '│');
            console.log(`│    🆔 ID: ${oldCategory.id}`.padEnd(74) + '│');
            console.log('│'.padEnd(74) + '│');

            for (const newCat of newCategories) {
                const newPhotoCount = await UnifiedProductComplete.countDocuments({
                    category: newCat.displayName
                });

                // Buscar as fotos que serão migradas
                const photosToMigrate = await UnifiedProductComplete.find({
                    category: newCat.displayName
                }).select('photoNumber status').lean();

                const photoNumbers = photosToMigrate.map(p => p.photoNumber).join(', ');

                console.log(`│ ${colors.red}❌ REMOVER (duplicada):${colors.reset}`.padEnd(84) + '│');
                console.log(`│    📛 ${newCat.displayName.substring(0, 63)}`.padEnd(74) + '│');
                if (newCat.displayName.length > 63) {
                    console.log(`│       ${newCat.displayName.substring(63, 126)}`.padEnd(74) + '│');
                }
                console.log(`│    📷 Fotos a migrar: ${newPhotoCount}`.padEnd(74) + '│');
                if (photoNumbers) {
                    console.log(`│    🔢 Números: ${photoNumbers.substring(0, 55)}`.padEnd(74) + '│');
                }
                console.log(`│    🆔 ID: ${newCat.id}`.padEnd(74) + '│');

                corrections.push({
                    qbItem: dup._id,
                    keepCategory: {
                        id: oldCategory.id,
                        displayName: oldCategory.displayName,
                        currentPhotos: oldPhotoCount
                    },
                    removeCategory: {
                        id: newCat.id,
                        displayName: newCat.displayName,
                        photosToMigrate: newPhotoCount,
                        photoNumbers: photosToMigrate.map(p => p.photoNumber)
                    }
                });
            }

            console.log('└' + '─'.repeat(73) + '┘\n');
        }

        // ═══════════════════════════════════════════════════════════════════
        // PARTE 3: RESUMO DAS CORREÇÕES
        // ═══════════════════════════════════════════════════════════════════
        subheader('📋 RESUMO DAS CORREÇÕES NECESSÁRIAS');

        const totalPhotosToMigrate = corrections.reduce((sum, c) => sum + c.removeCategory.photosToMigrate, 0);
        const totalCategoriesToDelete = corrections.length;

        console.log(`\n📊 ESTATÍSTICAS:`);
        console.log(`   • QB Items com duplicatas: ${duplicates.length}`);
        console.log(`   • Categorias a DELETAR: ${totalCategoriesToDelete}`);
        console.log(`   • Fotos a MIGRAR: ${totalPhotosToMigrate}`);

        console.log(`\n📝 AÇÕES QUE O SCRIPT DE CORREÇÃO FARÁ:`);

        for (const correction of corrections) {
            console.log(`\n   ${colors.yellow}QB Item: ${correction.qbItem}${colors.reset}`);
            console.log(`   ├─ Migrar ${correction.removeCategory.photosToMigrate} fotos:`);
            console.log(`   │  DE: "${correction.removeCategory.displayName.substring(0, 50)}..."`);
            console.log(`   │  PARA: "${correction.keepCategory.displayName.substring(0, 50)}..."`);
            console.log(`   │  Fotos: ${correction.removeCategory.photoNumbers.join(', ')}`);
            console.log(`   └─ Deletar categoria ID: ${correction.removeCategory.id}`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // PARTE 4: VERIFICAÇÃO ADICIONAL - FOTOS SEM CATEGORIA
        // ═══════════════════════════════════════════════════════════════════
        subheader('🔍 VERIFICAÇÃO ADICIONAL');

        // Verificar se há fotos com qbItem que não batem com nenhuma categoria
        const qbItemsWithIssues = duplicates.map(d => d._id);

        for (const qbItem of qbItemsWithIssues) {
            const photosWithQb = await UnifiedProductComplete.find({ qbItem: qbItem })
                .select('photoNumber category status')
                .lean();

            const categories = await PhotoCategory.find({ qbItem: qbItem })
                .select('displayName')
                .lean();

            const categoryNames = categories.map(c => c.displayName);

            const orphanPhotos = photosWithQb.filter(p => !categoryNames.includes(p.category));

            if (orphanPhotos.length > 0) {
                log(colors.red, `\n⚠️  QB Item ${qbItem}: ${orphanPhotos.length} fotos com categoria não encontrada!`);
                orphanPhotos.forEach(p => {
                    console.log(`   • Foto ${p.photoNumber}: "${p.category.substring(0, 50)}..."`);
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // PARTE 5: INSTRUÇÕES
        // ═══════════════════════════════════════════════════════════════════
        subheader('📌 PRÓXIMOS PASSOS');

        console.log(`
${colors.green}Se concordas com as correções acima, executa:${colors.reset}

   node scripts/corrigir-categorias-duplicadas.js

${colors.yellow}⚠️  IMPORTANTE:${colors.reset}
   • Testa PRIMEIRO em localhost
   • O script de correção fará backup antes de modificar
   • Podes reverter se algo correr mal
`);

        // ═══════════════════════════════════════════════════════════════════
        // EXPORTAR RELATÓRIO JSON
        // ═══════════════════════════════════════════════════════════════════
        const report = {
            generatedAt: new Date().toISOString(),
            duplicatesFound: duplicates.length,
            corrections: corrections,
            summary: {
                categoriesToDelete: totalCategoriesToDelete,
                photosToMigrate: totalPhotosToMigrate
            }
        };

        const fs = require('fs');
        const reportPath = './scripts/diagnostico-report.json';
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        log(colors.green, `\n📄 Relatório salvo em: ${reportPath}`);

    } catch (error) {
        log(colors.red + colors.bright, `\n❌ ERRO: ${error.message}`);
        console.error(error);
    } finally {
        await mongoose.disconnect();
        log(colors.dim, '\n🔌 Desconectado do MongoDB');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTAR
// ═══════════════════════════════════════════════════════════════════════════
runDiagnostic();