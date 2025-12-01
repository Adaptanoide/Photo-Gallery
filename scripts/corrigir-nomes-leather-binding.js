/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CORREÇÃO DE NOMES - LEATHER BINDING SUBCATEGORIES
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este script corrige os nomes longos das subcategorias Leather Binding
 * para o padrão curto usado nas categorias antigas.
 * 
 * DE: "Cowhide Hair On BRA With Leather Binding And Lined → Cowhide Hair On BRA With Leather Binding And Lined-Brindle White Backbone"
 * PARA: "Cowhide Hair On BRA With Leather Binding And Lined → Brindle White Backbone"
 * 
 * IMPORTANTE:
 *    - Atualiza PhotoCategory (displayName)
 *    - Atualiza UnifiedProductComplete (category)
 *    - Faz backup automático antes de modificar
 * 
 * Uso:
 *   node scripts/corrigir-nomes-leather-binding.js           # Dry-run (só mostra)
 *   node scripts/corrigir-nomes-leather-binding.js --execute # Executa de verdade
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

// Prefixo da categoria pai
const PARENT_PREFIX = 'Cowhide Hair On BRA With Leather Binding And Lined';

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
// FUNÇÃO PARA EXTRAIR NOME CURTO
// ═══════════════════════════════════════════════════════════════════════════
function extractShortName(displayName) {
    // Exemplo: "...Lined → ...Lined-Brindle White Backbone"
    // Queremos: "Brindle White Backbone"
    
    const parts = displayName.split(' → ');
    if (parts.length !== 2) return null;
    
    const subcategory = parts[1];
    
    // Se a subcategoria começa com o prefixo pai, extrair só o nome após o hífen
    if (subcategory.startsWith(PARENT_PREFIX)) {
        // Remove o prefixo e o hífen
        const shortName = subcategory.replace(PARENT_PREFIX + '-', '');
        return shortName;
    }
    
    return null; // Já está no formato curto
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÃO DE BACKUP
// ═══════════════════════════════════════════════════════════════════════════
async function createBackup(categoriesToFix) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `backup-nomes-${timestamp}`);
    
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    fs.mkdirSync(backupPath, { recursive: true });

    log(colors.yellow, `\n📦 Criando backup em: ${backupPath}`);

    // Backup das categorias
    const categoriesData = await PhotoCategory.find({
        _id: { $in: categoriesToFix.map(c => c._id) }
    }).lean();
    
    fs.writeFileSync(
        path.join(backupPath, 'categories-before-fix.json'),
        JSON.stringify(categoriesData, null, 2)
    );
    log(colors.green, `   ✅ ${categoriesData.length} categorias salvas`);

    // Backup das fotos
    const categoryNames = categoriesToFix.map(c => c.displayName);
    const photosData = await UnifiedProductComplete.find({
        category: { $in: categoryNames }
    }).lean();
    
    fs.writeFileSync(
        path.join(backupPath, 'photos-before-fix.json'),
        JSON.stringify(photosData, null, 2)
    );
    log(colors.green, `   ✅ ${photosData.length} fotos salvas`);

    // Metadados
    fs.writeFileSync(
        path.join(backupPath, 'corrections-metadata.json'),
        JSON.stringify({
            timestamp: new Date().toISOString(),
            categoriesToFix: categoriesToFix.map(c => ({
                qbItem: c.qbItem,
                oldName: c.displayName,
                newName: c.newDisplayName
            }))
        }, null, 2)
    );
    log(colors.green, `   ✅ Metadados salvos`);

    return backupPath;
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
async function runCorrection() {
    header('🔧 CORREÇÃO DE NOMES - LEATHER BINDING');
    console.log(`📅 Data: ${new Date().toLocaleString('pt-BR')}`);
    
    if (DRY_RUN) {
        log(colors.yellow + colors.bright, '\n⚠️  MODO DRY-RUN: Nenhuma alteração será feita!');
        log(colors.yellow, '   Para executar de verdade, use: node scripts/corrigir-nomes-leather-binding.js --execute\n');
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
        // IDENTIFICAR CATEGORIAS COM NOMES LONGOS
        // ═══════════════════════════════════════════════════════════════════
        subheader('🔍 IDENTIFICANDO CATEGORIAS COM NOMES LONGOS');

        // Buscar todas as subcategorias do Leather Binding
        const allCategories = await PhotoCategory.find({
            displayName: new RegExp(PARENT_PREFIX, 'i')
        }).lean();

        const categoriesToFix = [];

        for (const cat of allCategories) {
            const shortName = extractShortName(cat.displayName);
            
            if (shortName) {
                // Esta categoria precisa ser corrigida
                const newDisplayName = `${PARENT_PREFIX} → ${shortName}`;
                
                // Contar fotos associadas
                const photoCount = await UnifiedProductComplete.countDocuments({
                    category: cat.displayName
                });

                categoriesToFix.push({
                    _id: cat._id,
                    qbItem: cat.qbItem,
                    displayName: cat.displayName,
                    newDisplayName: newDisplayName,
                    shortName: shortName,
                    photoCount: photoCount
                });
            }
        }

        if (categoriesToFix.length === 0) {
            log(colors.green, '\n✅ Nenhuma categoria precisa de correção!');
            await mongoose.disconnect();
            return;
        }

        console.log(`\n📋 Encontradas ${categoriesToFix.length} categorias para corrigir:\n`);
        
        let totalPhotos = 0;
        for (const cat of categoriesToFix) {
            totalPhotos += cat.photoCount;
            console.log(`   ${colors.yellow}${cat.qbItem}${colors.reset} | ${cat.shortName}`);
            console.log(`   ${colors.dim}DE:   ...Lined → ...Lined-${cat.shortName}${colors.reset}`);
            console.log(`   ${colors.green}PARA: ...Lined → ${cat.shortName}${colors.reset}`);
            console.log(`   ${colors.dim}Fotos: ${cat.photoCount}${colors.reset}\n`);
        }

        console.log(`   ${colors.bright}Total de fotos a atualizar: ${totalPhotos}${colors.reset}`);

        // ═══════════════════════════════════════════════════════════════════
        // CRIAR BACKUP (se não for dry-run)
        // ═══════════════════════════════════════════════════════════════════
        let backupPath = null;
        if (!DRY_RUN) {
            subheader('📦 CRIANDO BACKUP');
            backupPath = await createBackup(categoriesToFix);
        }

        // ═══════════════════════════════════════════════════════════════════
        // EXECUTAR CORREÇÕES
        // ═══════════════════════════════════════════════════════════════════
        subheader('🔧 EXECUTANDO CORREÇÕES');

        for (const cat of categoriesToFix) {
            console.log(`\n   📝 ${cat.qbItem} - ${cat.shortName}`);

            if (!DRY_RUN) {
                // 1. Atualizar displayName da categoria
                const catResult = await PhotoCategory.updateOne(
                    { _id: cat._id },
                    { $set: { displayName: cat.newDisplayName } }
                );
                log(colors.green, `      ✅ Categoria atualizada: ${catResult.modifiedCount}`);

                // 2. Atualizar category das fotos
                const photosResult = await UnifiedProductComplete.updateMany(
                    { category: cat.displayName },
                    { 
                        $set: { 
                            category: cat.newDisplayName,
                            'currentLocation.currentCategory': cat.newDisplayName,
                            'originalLocation.originalCategory': cat.newDisplayName
                        }
                    }
                );
                log(colors.green, `      ✅ Fotos atualizadas: ${photosResult.modifiedCount}`);
            } else {
                log(colors.dim, `      [DRY-RUN] Categoria seria atualizada`);
                log(colors.dim, `      [DRY-RUN] ${cat.photoCount} fotos seriam atualizadas`);
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // VERIFICAÇÃO PÓS-CORREÇÃO
        // ═══════════════════════════════════════════════════════════════════
        if (!DRY_RUN) {
            subheader('🔍 VERIFICAÇÃO PÓS-CORREÇÃO');

            // Verificar se ainda existem categorias com nomes longos
            const remainingLong = await PhotoCategory.find({
                displayName: new RegExp(PARENT_PREFIX + ' → ' + PARENT_PREFIX, 'i')
            }).lean();

            if (remainingLong.length === 0) {
                log(colors.green, '\n✅ Todas as categorias estão com nomes curtos!');
            } else {
                log(colors.red, `\n⚠️  Ainda existem ${remainingLong.length} categorias com nomes longos!`);
            }

            // Listar todas as subcategorias agora
            console.log('\n📋 Subcategorias Leather Binding atuais:\n');
            const allFixed = await PhotoCategory.find({
                displayName: new RegExp(PARENT_PREFIX, 'i')
            }).sort({ qbItem: 1 }).lean();

            for (const cat of allFixed) {
                const parts = cat.displayName.split(' → ');
                const subcat = parts[1] || cat.displayName;
                const isShort = !subcat.includes(PARENT_PREFIX);
                console.log(`   ${isShort ? '✅' : '❌'} ${cat.qbItem} | ${subcat.substring(0, 40)}...`);
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // RESUMO FINAL
        // ═══════════════════════════════════════════════════════════════════
        subheader('📊 RESUMO FINAL');

        if (DRY_RUN) {
            console.log(`
${colors.yellow}MODO DRY-RUN - Nenhuma alteração foi feita!${colors.reset}

Se os resultados parecem corretos, execute:

   node scripts/corrigir-nomes-leather-binding.js --execute
`);
        } else {
            console.log(`
${colors.green}✅ CORREÇÃO CONCLUÍDA COM SUCESSO!${colors.reset}

📊 Alterações realizadas:
   • ${categoriesToFix.length} categorias renomeadas
   • ${totalPhotos} fotos atualizadas

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