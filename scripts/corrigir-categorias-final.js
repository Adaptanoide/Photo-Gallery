/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CORREÇÃO DE CATEGORIAS - PROBLEMAS ESPECÍFICOS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este script corrige:
 * 
 * 1. 5500SP - QB Code ERRADO
 *    - Categoria "Salt & Pepper Brown and White" tem qbItem 5500BR (errado)
 *    - Deve ser 5500SP
 *    - Fotos 31133, 31132 também precisam correção
 * 
 * 2. 5500PE - DUPLICATA
 *    - Categoria antiga: "...→ Palomino Exotic" (3 fotos) - MANTER
 *    - Categoria nova: "...→ ...Lined-Palomino Exotic" (5 fotos) - DELETAR
 *    - Migrar 5 fotos + deletar duplicada
 * 
 * IMPORTANTE:
 *    - 5500BR "Brown & White" NÃO SERÁ MEXIDA
 *    - Fotos em trânsito: só alteramos 'category' e 'qbItem', nada mais
 * 
 * Uso:
 *   node scripts/corrigir-categorias-final.js           # Dry-run (só mostra)
 *   node scripts/corrigir-categorias-final.js --execute # Executa de verdade
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Modelos
const PhotoCategory = require('../src/models/PhotoCategory');
const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════════════
const DRY_RUN = !process.argv.includes('--execute');
const BACKUP_DIR = './scripts/backups';

// ═══════════════════════════════════════════════════════════════════════════
// DADOS DAS CORREÇÕES (baseado no diagnóstico)
// ═══════════════════════════════════════════════════════════════════════════
const CORRECTIONS = {
    // Problema 1: QB Code errado
    qbCodeFix: {
        categoryId: '692db42636c9408194cf73c6',
        categoryDisplayName: 'Cowhide Hair On BRA With Leather Binding And Lined → Cowhide Hair On BRA With Leather Binding And Lined-Salt & Pepper Brown and White',
        wrongQbItem: '5500BR',
        correctQbItem: '5500SP',
        photoNumbers: ['31133', '31132']
    },
    
    // Problema 2: Duplicata 5500PE
    duplicate5500PE: {
        keepCategory: {
            id: '68ee70733fde6b23d70f1e88',
            displayName: 'Cowhide Hair On BRA With Leather Binding And Lined → Palomino Exotic'
        },
        deleteCategory: {
            id: '692db44a36c9408194cf73ce',
            displayName: 'Cowhide Hair On BRA With Leather Binding And Lined → Cowhide Hair On BRA With Leather Binding And Lined-Palomino Exotic'
        },
        photosToMigrate: ['31142', '31126', '31125', '31123', '31122']
    }
};

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
    cyan: '\x1b[36m'
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
// FUNÇÃO DE BACKUP
// ═══════════════════════════════════════════════════════════════════════════
async function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`);
    
    // Criar diretório de backup
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    fs.mkdirSync(backupPath, { recursive: true });

    log(colors.yellow, `\n📦 Criando backup em: ${backupPath}`);

    // Backup da categoria que será deletada (5500PE duplicada)
    const categoryToDelete = await PhotoCategory.findById(CORRECTIONS.duplicate5500PE.deleteCategory.id).lean();
    if (categoryToDelete) {
        fs.writeFileSync(
            path.join(backupPath, 'category-5500PE-deleted.json'),
            JSON.stringify(categoryToDelete, null, 2)
        );
        log(colors.green, `   ✅ Categoria 5500PE duplicada salva`);
    }

    // Backup da categoria que terá QB corrigido
    const categoryToFix = await PhotoCategory.findById(CORRECTIONS.qbCodeFix.categoryId).lean();
    if (categoryToFix) {
        fs.writeFileSync(
            path.join(backupPath, 'category-5500SP-before-fix.json'),
            JSON.stringify(categoryToFix, null, 2)
        );
        log(colors.green, `   ✅ Categoria 5500SP (antes da correção) salva`);
    }

    // Backup das fotos que serão modificadas
    const allPhotoNumbers = [
        ...CORRECTIONS.qbCodeFix.photoNumbers,
        ...CORRECTIONS.duplicate5500PE.photosToMigrate
    ];
    
    const photosData = await UnifiedProductComplete.find({ 
        photoNumber: { $in: allPhotoNumbers } 
    }).lean();
    
    fs.writeFileSync(
        path.join(backupPath, 'photos-before-fix.json'),
        JSON.stringify(photosData, null, 2)
    );
    log(colors.green, `   ✅ ${photosData.length} fotos salvas`);

    // Salvar metadados
    fs.writeFileSync(
        path.join(backupPath, 'corrections-metadata.json'),
        JSON.stringify({
            timestamp: new Date().toISOString(),
            corrections: CORRECTIONS
        }, null, 2)
    );
    log(colors.green, `   ✅ Metadados salvos`);

    return backupPath;
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
async function runCorrection() {
    header('🔧 CORREÇÃO DE CATEGORIAS DUPLICADAS');
    console.log(`📅 Data: ${new Date().toLocaleString('pt-BR')}`);
    
    if (DRY_RUN) {
        log(colors.yellow + colors.bright, '\n⚠️  MODO DRY-RUN: Nenhuma alteração será feita!');
        log(colors.yellow, '   Para executar de verdade, use: node scripts/corrigir-categorias-final.js --execute\n');
    } else {
        log(colors.red + colors.bright, '\n🚨 MODO EXECUÇÃO: As alterações SERÃO aplicadas!\n');
    }

    try {
        // ═══════════════════════════════════════════════════════════════════
        // CONECTAR AO MONGODB
        // ═══════════════════════════════════════════════════════════════════
        log(colors.yellow, '🔌 Conectando ao MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        log(colors.green, '✅ Conectado!\n');

        // ═══════════════════════════════════════════════════════════════════
        // VERIFICAÇÃO PRÉ-CORREÇÃO
        // ═══════════════════════════════════════════════════════════════════
        subheader('🔍 VERIFICAÇÃO PRÉ-CORREÇÃO');

        // Verificar que 5500BR "Brown & White" existe e NÃO será mexida
        const brownWhiteCategory = await PhotoCategory.findOne({ 
            qbItem: '5500BR',
            displayName: { $regex: /Brown & White/i, $not: /Salt & Pepper/i }
        });
        
        if (brownWhiteCategory) {
            log(colors.green, `✅ 5500BR "Brown & White" encontrada (ID: ${brownWhiteCategory._id})`);
            log(colors.green, `   Esta categoria NÃO será alterada.`);
        } else {
            log(colors.yellow, `⚠️  5500BR "Brown & White" não encontrada com o filtro esperado.`);
            // Vamos buscar de outra forma
            const allBR = await PhotoCategory.find({ qbItem: '5500BR' });
            console.log(`   Categorias com 5500BR encontradas: ${allBR.length}`);
            allBR.forEach(c => console.log(`   - ${c.displayName.substring(0, 50)}...`));
        }

        // Verificar categoria que terá QB corrigido
        const categoryToFix = await PhotoCategory.findById(CORRECTIONS.qbCodeFix.categoryId);
        if (categoryToFix) {
            log(colors.green, `\n✅ Categoria para corrigir QB encontrada:`);
            log(colors.dim, `   Nome: ${categoryToFix.displayName.substring(0, 60)}...`);
            log(colors.dim, `   QB atual: ${categoryToFix.qbItem} → será: ${CORRECTIONS.qbCodeFix.correctQbItem}`);
        } else {
            log(colors.red, `\n❌ Categoria ${CORRECTIONS.qbCodeFix.categoryId} não encontrada!`);
            await mongoose.disconnect();
            return;
        }

        // Verificar categorias 5500PE
        const keepCategory = await PhotoCategory.findById(CORRECTIONS.duplicate5500PE.keepCategory.id);
        const deleteCategory = await PhotoCategory.findById(CORRECTIONS.duplicate5500PE.deleteCategory.id);

        if (keepCategory && deleteCategory) {
            log(colors.green, `\n✅ Categorias 5500PE encontradas:`);
            log(colors.dim, `   MANTER: ${keepCategory.displayName.substring(0, 50)}...`);
            log(colors.dim, `   DELETAR: ${deleteCategory.displayName.substring(0, 50)}...`);
        } else {
            log(colors.red, `\n❌ Uma das categorias 5500PE não foi encontrada!`);
            if (!keepCategory) log(colors.red, `   - Categoria a MANTER não encontrada`);
            if (!deleteCategory) log(colors.red, `   - Categoria a DELETAR não encontrada`);
            await mongoose.disconnect();
            return;
        }

        // ═══════════════════════════════════════════════════════════════════
        // CRIAR BACKUP (se não for dry-run)
        // ═══════════════════════════════════════════════════════════════════
        let backupPath = null;
        if (!DRY_RUN) {
            subheader('📦 CRIANDO BACKUP');
            backupPath = await createBackup();
        }

        // ═══════════════════════════════════════════════════════════════════
        // CORREÇÃO 1: QB CODE 5500SP
        // ═══════════════════════════════════════════════════════════════════
        subheader('🔧 CORREÇÃO 1: QB Code 5500BR → 5500SP');

        console.log(`\n📋 O que será feito:`);
        console.log(`   • Categoria "Salt & Pepper Brown and White": qbItem 5500BR → 5500SP`);
        console.log(`   • Fotos 31133, 31132: qbItem 5500BR → 5500SP`);

        if (!DRY_RUN) {
            // Corrigir categoria
            const catResult = await PhotoCategory.updateOne(
                { _id: CORRECTIONS.qbCodeFix.categoryId },
                { $set: { qbItem: CORRECTIONS.qbCodeFix.correctQbItem } }
            );
            log(colors.green, `\n   ✅ Categoria atualizada: ${catResult.modifiedCount} documento(s)`);

            // Corrigir fotos
            const photosResult = await UnifiedProductComplete.updateMany(
                { photoNumber: { $in: CORRECTIONS.qbCodeFix.photoNumbers } },
                { $set: { qbItem: CORRECTIONS.qbCodeFix.correctQbItem } }
            );
            log(colors.green, `   ✅ Fotos atualizadas: ${photosResult.modifiedCount} documento(s)`);
        } else {
            log(colors.dim, `\n   [DRY-RUN] Categoria seria atualizada`);
            log(colors.dim, `   [DRY-RUN] 2 fotos seriam atualizadas`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // CORREÇÃO 2: DUPLICATA 5500PE
        // ═══════════════════════════════════════════════════════════════════
        subheader('🔧 CORREÇÃO 2: Duplicata 5500PE');

        console.log(`\n📋 O que será feito:`);
        console.log(`   • Migrar 5 fotos para categoria antiga`);
        console.log(`   • Atualizar photoCount da categoria antiga`);
        console.log(`   • Deletar categoria duplicada`);

        if (!DRY_RUN) {
            // Migrar fotos (apenas campo category)
            const migrateResult = await UnifiedProductComplete.updateMany(
                { photoNumber: { $in: CORRECTIONS.duplicate5500PE.photosToMigrate } },
                { 
                    $set: { 
                        category: CORRECTIONS.duplicate5500PE.keepCategory.displayName,
                        'currentLocation.currentCategory': CORRECTIONS.duplicate5500PE.keepCategory.displayName,
                        'originalLocation.originalCategory': CORRECTIONS.duplicate5500PE.keepCategory.displayName
                    }
                }
            );
            log(colors.green, `\n   ✅ Fotos migradas: ${migrateResult.modifiedCount} documento(s)`);

            // Atualizar photoCount da categoria mantida
            const newPhotoCount = await UnifiedProductComplete.countDocuments({
                category: CORRECTIONS.duplicate5500PE.keepCategory.displayName
            });
            
            await PhotoCategory.updateOne(
                { _id: CORRECTIONS.duplicate5500PE.keepCategory.id },
                { $set: { photoCount: newPhotoCount, lastSync: new Date() } }
            );
            log(colors.green, `   ✅ photoCount atualizado: ${newPhotoCount} fotos`);

            // Deletar categoria duplicada
            const deleteResult = await PhotoCategory.deleteOne({
                _id: CORRECTIONS.duplicate5500PE.deleteCategory.id
            });
            log(colors.green, `   ✅ Categoria duplicada deletada: ${deleteResult.deletedCount} documento(s)`);
        } else {
            log(colors.dim, `\n   [DRY-RUN] 5 fotos seriam migradas`);
            log(colors.dim, `   [DRY-RUN] photoCount seria atualizado`);
            log(colors.dim, `   [DRY-RUN] Categoria duplicada seria deletada`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // VERIFICAÇÃO PÓS-CORREÇÃO
        // ═══════════════════════════════════════════════════════════════════
        if (!DRY_RUN) {
            subheader('🔍 VERIFICAÇÃO PÓS-CORREÇÃO');

            // Verificar 5500SP
            const fixed5500SP = await PhotoCategory.findById(CORRECTIONS.qbCodeFix.categoryId);
            log(colors.green, `\n✅ 5500SP verificação:`);
            log(colors.dim, `   qbItem: ${fixed5500SP.qbItem}`);

            // Verificar 5500BR ainda existe
            const still5500BR = await PhotoCategory.findOne({ 
                qbItem: '5500BR'
            });
            if (still5500BR) {
                log(colors.green, `\n✅ 5500BR "Brown & White" ainda existe (não foi alterada)`);
                log(colors.dim, `   Nome: ${still5500BR.displayName}`);
            }

            // Verificar 5500PE não tem mais duplicatas
            const remaining5500PE = await PhotoCategory.find({ qbItem: '5500PE' });
            log(colors.green, `\n✅ 5500PE verificação:`);
            log(colors.dim, `   Categorias com 5500PE: ${remaining5500PE.length} (deve ser 1)`);
            
            if (remaining5500PE.length === 1) {
                log(colors.green, `   ✅ Duplicata removida com sucesso!`);
            } else {
                log(colors.red, `   ⚠️  Ainda existem ${remaining5500PE.length} categorias!`);
            }

            // Contar fotos por categoria
            const photosInPalominoExotic = await UnifiedProductComplete.countDocuments({
                category: CORRECTIONS.duplicate5500PE.keepCategory.displayName
            });
            log(colors.green, `\n✅ Fotos em "Palomino Exotic": ${photosInPalominoExotic}`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // RESUMO FINAL
        // ═══════════════════════════════════════════════════════════════════
        subheader('📊 RESUMO FINAL');

        if (DRY_RUN) {
            console.log(`
${colors.yellow}MODO DRY-RUN - Nenhuma alteração foi feita!${colors.reset}

Se os resultados parecem corretos, execute:

   node scripts/corrigir-categorias-final.js --execute
`);
        } else {
            console.log(`
${colors.green}✅ CORREÇÃO CONCLUÍDA COM SUCESSO!${colors.reset}

📊 Alterações realizadas:
   • 5500SP: QB code corrigido (categoria + 2 fotos)
   • 5500PE: 5 fotos migradas + categoria duplicada deletada
   • 5500BR "Brown & White": NÃO foi alterada ✅

📦 Backup salvo em: ${backupPath}

${colors.yellow}Próximo passo:${colors.reset}
   Verificar no Price Management se está tudo correto!
`);
        }

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
runCorrection();