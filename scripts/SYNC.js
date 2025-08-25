#!/usr/bin/env node

/**
 * 🌟 SUNSHINE SYNC - SISTEMA COMPLETO
 * Um único script para todo o processo!
 */

const readline = require('readline');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function clear() {
    console.clear();
}

function runCommand(command) {
    return new Promise((resolve) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Erro: ${error.message}`);
            }
            console.log(stdout);
            if (stderr) console.error(stderr);
            resolve();
        });
    });
}

async function menu() {
    clear();
    console.log('=====================================');
    console.log('🌟 SUNSHINE SYNC - SISTEMA COMPLETO');
    console.log('=====================================\n');
    console.log('O QUE VOCÊ QUER FAZER?\n');
    console.log('1️⃣  SINCRONIZAÇÃO COMPLETA (novo lote de fotos)');
    console.log('2️⃣  Apenas verificar status');
    console.log('3️⃣  Limpar arquivos temporários');
    console.log('4️⃣  Sair\n');
    
    rl.question('Escolha (1-4): ', async (answer) => {
        switch(answer) {
            case '1':
                await syncComplete();
                break;
            case '2':
                await checkStatus();
                break;
            case '3':
                await cleanTemp();
                break;
            case '4':
                console.log('\n👋 Até logo!\n');
                rl.close();
                process.exit(0);
                break;
            default:
                await menu();
        }
    });
}

async function syncComplete() {
    clear();
    console.log('=====================================');
    console.log('🚀 SINCRONIZAÇÃO COMPLETA');
    console.log('=====================================\n');
    console.log('Este processo vai:');
    console.log('  1. Comparar Google Drive com R2');
    console.log('  2. Baixar fotos novas');
    console.log('  3. Processar (4 versões)');
    console.log('  4. Enviar para R2');
    console.log('  5. Atualizar banco de dados');
    console.log('  6. Marcar fotos vendidas\n');
    
    rl.question('Começar? (s/n): ', async (answer) => {
        if (answer.toLowerCase() !== 's') {
            await menu();
            return;
        }
        
        console.log('\n📊 PASSO 1/6: Analisando diferenças...\n');
        await runCommand('node scripts/analysis/analyze-drive-vs-r2.js');
        
        rl.question('\n✅ Análise completa! Continuar com download? (s/n): ', async (answer) => {
            if (answer.toLowerCase() !== 's') {
                await menu();
                return;
            }
            
            console.log('\n📥 PASSO 2/6: Baixando fotos novas...\n');
            // Aqui você executa manualmente o download
            console.log('Execute: node scripts/sync/01-download-photos.js');
            
            rl.question('\nDownload concluído? (s/n): ', async (answer) => {
                if (answer.toLowerCase() !== 's') {
                    await menu();
                    return;
                }
                
                console.log('\n🖼️ PASSO 3/6: Processando imagens...\n');
                console.log('Execute: node scripts/processing/02-process-images.js');
                
                rl.question('\nProcessamento concluído? (s/n): ', async (answer) => {
                    if (answer.toLowerCase() !== 's') {
                        await menu();
                        return;
                    }
                    
                    console.log('\n📤 PASSO 4/6: Enviando para R2...\n');
                    console.log('Execute: node scripts/sync/03-upload-to-r2.js');
                    
                    rl.question('\nUpload concluído? (s/n): ', async (answer) => {
                        if (answer.toLowerCase() !== 's') {
                            await menu();
                            return;
                        }
                        
                        console.log('\n💾 PASSO 5/6: Atualizando banco de dados...\n');
                        await runCommand('node scripts/sync/06-populate-photostatus.js');
                        
                        console.log('\n🏷️ PASSO 6/6: Marcando fotos vendidas...\n');
                        await runCommand('node scripts/sync/07-analyze-and-mark-sold.js');
                        
                        console.log('\n✅ SINCRONIZAÇÃO COMPLETA!\n');
                        await runCommand('node scripts/sync/08-final-verification.js');
                        
                        rl.question('\nVoltar ao menu? (s/n): ', async () => {
                            await menu();
                        });
                    });
                });
            });
        });
    });
}

async function checkStatus() {
    clear();
    console.log('📊 VERIFICANDO STATUS...\n');
    await runCommand('node scripts/sync/08-final-verification.js');
    
    rl.question('\nVoltar ao menu? (s/n): ', async () => {
        await menu();
    });
}

async function cleanTemp() {
    clear();
    console.log('🧹 LIMPANDO ARQUIVOS TEMPORÁRIOS...\n');
    
    const downloads = path.join(__dirname, '../../sync-workspace/downloads');
    const ready = path.join(__dirname, '../../sync-workspace/ready');
    
    rl.question('Limpar downloads e processados? (s/n): ', async (answer) => {
        if (answer.toLowerCase() === 's') {
            console.log('Limpando...');
            exec(`rm -rf ${downloads}/* ${ready}/*`, () => {
                console.log('✅ Arquivos temporários removidos!\n');
                rl.question('Voltar ao menu? (s/n): ', async () => {
                    await menu();
                });
            });
        } else {
            await menu();
        }
    });
}

// INICIAR
console.log('\n🌟 BEM-VINDO AO SUNSHINE SYNC!\n');
menu();
