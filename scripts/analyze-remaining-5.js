// scripts/analyze-remaining-5.js
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
require('dotenv').config();

const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
const PhotoCategory = require('../src/models/PhotoCategory');

const PHOTOS_TO_CHECK = ['25571', '26289', '26625', '26705', '71022'];

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
        console.log('🔍 ANALISAR 5 FOTOS RESTANTES');
        console.log('═══════════════════════════════════════════════════\n');
        
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB');
        
        cdeConnection = await connectCDE();
        console.log('✅ Conectado ao CDE\n');
        
        const results = {
            canCreate: [],
            needPhoto: [],
            alreadyExists: []
        };
        
        for (const photoNumber of PHOTOS_TO_CHECK) {
            console.log(`📸 FOTO ${photoNumber}`);
            console.log('─'.repeat(50));
            
            // 1. Verificar MongoDB
            const mongoDoc = await UnifiedProductComplete.findOne({ photoNumber });
            
            if (mongoDoc) {
                console.log('✅ JÁ EXISTE no MongoDB');
                console.log(`   Status: ${mongoDoc.status}`);
                console.log(`   QB: ${mongoDoc.qbItem}\n`);
                results.alreadyExists.push(photoNumber);
                continue;
            }
            
            console.log('❌ NÃO existe no MongoDB');
            
            // 2. Buscar CDE
            const [cdeRows] = await cdeConnection.execute(
                `SELECT ATIPOETIQUETA, AESTADOP, AQBITEM 
                 FROM tbinventario 
                 WHERE ATIPOETIQUETA = ?`,
                [photoNumber]
            );
            
            if (!cdeRows || cdeRows.length === 0) {
                console.log('❌ NÃO existe no CDE\n');
                results.needPhoto.push({ photoNumber, reason: 'Não existe no CDE' });
                continue;
            }
            
            const cdeData = cdeRows[0];
            console.log(`✅ CDE: ${cdeData.AESTADOP} | QB: ${cdeData.AQBITEM}`);
            
            // 3. Buscar categoria
            const category = await PhotoCategory.findOne({ qbItem: cdeData.AQBITEM });
            
            if (!category) {
                console.log(`❌ Categoria QB ${cdeData.AQBITEM} não encontrada\n`);
                results.needPhoto.push({ 
                    photoNumber, 
                    qb: cdeData.AQBITEM,
                    reason: 'Categoria não existe no sistema' 
                });
                continue;
            }
            
            console.log(`✅ Categoria: ${category.displayName}`);
            console.log(`   Path: ${category.googleDrivePath}`);
            console.log(`   Preço: $${category.basePrice}`);
            console.log('✅ PRONTA PARA CRIAR\n');
            
            results.canCreate.push({
                photoNumber,
                qb: cdeData.AQBITEM,
                category: category.displayName,
                price: category.basePrice,
                path: category.googleDrivePath
            });
        }
        
        // Resumo
        console.log('═══════════════════════════════════════════════════');
        console.log('📊 RESUMO:');
        console.log('═══════════════════════════════════════════════════\n');
        
        console.log(`✅ Já existem: ${results.alreadyExists.length}`);
        if (results.alreadyExists.length > 0) {
            results.alreadyExists.forEach(p => console.log(`   - ${p}`));
            console.log('');
        }
        
        console.log(`🟢 Podem criar: ${results.canCreate.length}`);
        if (results.canCreate.length > 0) {
            results.canCreate.forEach(p => {
                console.log(`   ${p.photoNumber} - QB: ${p.qb} - $${p.price}`);
            });
            console.log('');
        }
        
        console.log(`🔴 Precisam fotografar: ${results.needPhoto.length}`);
        if (results.needPhoto.length > 0) {
            results.needPhoto.forEach(p => {
                console.log(`   ${p.photoNumber} - ${p.reason}`);
            });
            console.log('');
        }
        
        console.log('═══════════════════════════════════════════════════\n');
        
        if (results.canCreate.length > 0) {
            console.log('💡 Para criar as fotos prontas, rode:');
            console.log('   node scripts/create-remaining-5.js\n');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        if (cdeConnection) await cdeConnection.end();
        await mongoose.disconnect();
    }
}

main();