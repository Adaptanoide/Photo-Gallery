// scripts/analyze-all-monitor-issues.js
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
require('dotenv').config();

const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
const Selection = require('../src/models/Selection');
const PhotoCategory = require('../src/models/PhotoCategory');

// TODAS as fotos que aparecem no monitor
const ALL_MONITOR_PHOTOS = [
    '02936', '02937', '08128', '09725', '12348', '18945', '22434',
    '25571', '26289', '26625', '26705', '29316', '29317', '29559',
    '29560', '29561', '30168', '30169', '30170', '71022'
];

async function connectCDE() {
    return await mysql.createConnection({
        host: process.env.CDE_HOST,
        port: process.env.CDE_PORT,
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE
    });
}

async function main() {
    let cdeConnection = null;
    
    try {
        console.log('═══════════════════════════════════════════════════');
        console.log('📊 ANÁLISE COMPLETA - TODAS AS FOTOS DO MONITOR');
        console.log('═══════════════════════════════════════════════════\n');
        
        await mongoose.connect(process.env.MONGODB_URI);
        cdeConnection = await connectCDE();
        console.log('✅ Conectado\n');
        
        const results = {
            lorettaSelection: [],
            needPhotograph: [],
            qb8203Issues: [],
            canFix: [],
            alreadyOk: []
        };
        
        for (const photoNumber of ALL_MONITOR_PHOTOS) {
            console.log(`📸 ${photoNumber}`);
            
            // 1. MongoDB
            const mongoDoc = await UnifiedProductComplete.findOne({ photoNumber });
            
            // 2. CDE
            const [cdeRows] = await cdeConnection.execute(
                `SELECT AESTADOP, AQBITEM, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA = ?`,
                [photoNumber]
            );
            
            const cdeData = cdeRows[0];
            
            const analysis = {
                photoNumber,
                mongoExists: !!mongoDoc,
                mongoStatus: mongoDoc?.status || 'N/A',
                mongoQB: mongoDoc?.qbItem || 'N/A',
                selectionId: mongoDoc?.selectionId || null,
                cdeStatus: cdeData?.AESTADOP || 'N/A',
                cdeQB: cdeData?.AQBITEM || 'N/A',
                cdeReserved: cdeData?.RESERVEDUSU || null
            };
            
            // 3. Se tem seleção, buscar
            if (analysis.selectionId) {
                const selection = await Selection.findOne({ 
                    selectionId: analysis.selectionId 
                });
                
                if (selection) {
                    analysis.selectionStatus = selection.status;
                    analysis.clientName = selection.clientName;
                    
                    // LORETTA - separar
                    if (selection.clientName === 'Loretta Barrett') {
                        console.log(`   ⚠️  LORETTA - Ver com Ingrid`);
                        results.lorettaSelection.push(analysis);
                        console.log('');
                        continue;
                    }
                    
                    // Seleção finalizada - pode liberar
                    if (selection.status === 'finalized') {
                        console.log(`   🔄 RETORNO - Pode liberar`);
                        results.canFix.push({
                            ...analysis,
                            action: 'LIBERAR_RETORNO',
                            reason: 'Seleção finalizada mas CDE INGRESADO'
                        });
                        console.log('');
                        continue;
                    }
                }
            }
            
            // 4. QB 8203 - separar
            if (analysis.cdeQB === '8203') {
                console.log(`   ⚪ QB 8203 - Ver com Ingrid`);
                results.qb8203Issues.push(analysis);
                console.log('');
                continue;
            }
            
            // 5. Não existe no MongoDB
            if (!mongoDoc) {
                // Verificar se categoria existe
                const category = await PhotoCategory.findOne({ 
                    qbItem: analysis.cdeQB 
                });
                
                if (!category) {
                    console.log(`   🔴 Precisa fotografar (categoria não existe)`);
                    results.needPhotograph.push({
                        ...analysis,
                        reason: 'Categoria não existe no sistema'
                    });
                } else {
                    console.log(`   🟢 PODE CRIAR - Categoria existe!`);
                    results.canFix.push({
                        ...analysis,
                        action: 'CRIAR_REGISTRO',
                        category: category.displayName,
                        price: category.basePrice
                    });
                }
                console.log('');
                continue;
            }
            
            // 6. Já OK
            if (mongoDoc.status === 'available' && cdeData.AESTADOP === 'INGRESADO') {
                console.log(`   ✅ OK`);
                results.alreadyOk.push(analysis);
                console.log('');
                continue;
            }
            
            console.log(`   ❓ Status indefinido`);
            console.log('');
        }
        
        // ═══ RESUMO ═══
        console.log('\n═══════════════════════════════════════════════════');
        console.log('📊 RESUMO GERAL:');
        console.log('═══════════════════════════════════════════════════\n');
        
        console.log(`🟡 LORETTA (ver com Ingrid): ${results.lorettaSelection.length}`);
        if (results.lorettaSelection.length > 0) {
            results.lorettaSelection.forEach(p => {
                console.log(`   ${p.photoNumber} - ${p.selectionStatus}`);
            });
            console.log('');
        }
        
        console.log(`⚪ QB 8203 (ver com Ingrid): ${results.qb8203Issues.length}`);
        if (results.qb8203Issues.length > 0) {
            results.qb8203Issues.forEach(p => {
                console.log(`   ${p.photoNumber}`);
            });
            console.log('');
        }
        
        console.log(`🔴 PRECISAM FOTOGRAFAR: ${results.needPhotograph.length}`);
        if (results.needPhotograph.length > 0) {
            results.needPhotograph.forEach(p => {
                console.log(`   ${p.photoNumber} - QB: ${p.cdeQB}`);
            });
            console.log('');
        }
        
        console.log(`🟢 PODEM CORRIGIR AGORA: ${results.canFix.length}`);
        if (results.canFix.length > 0) {
            results.canFix.forEach(p => {
                if (p.action === 'CRIAR_REGISTRO') {
                    console.log(`   ${p.photoNumber} - CRIAR - QB: ${p.cdeQB} - $${p.price}`);
                } else if (p.action === 'LIBERAR_RETORNO') {
                    console.log(`   ${p.photoNumber} - LIBERAR - Retorno de ${p.clientName}`);
                }
            });
            console.log('');
        }
        
        console.log(`✅ JÁ OK: ${results.alreadyOk.length}`);
        console.log('');
        
        console.log('═══════════════════════════════════════════════════\n');
        
        // Salvar JSON
        const fs = require('fs');
        fs.writeFileSync(
            'monitor-analysis-complete.json',
            JSON.stringify(results, null, 2)
        );
        console.log('📄 Análise salva em: monitor-analysis-complete.json\n');
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        if (cdeConnection) await cdeConnection.end();
        await mongoose.disconnect();
    }
}

main();