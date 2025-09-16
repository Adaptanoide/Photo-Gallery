// analyze-active-pases-fixed.js
// Script CORRIGIDO - removido campo AFECINV que não existe

const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
const AWS = require('aws-sdk');
require('dotenv').config();

const UnifiedProductComplete = require('./src/models/UnifiedProductComplete');
const PhotoCategory = require('./src/models/PhotoCategory');

class ActivePasesAnalyzer {
    constructor() {
        this.cdeConfig = {
            host: process.env.CDE_HOST,
            port: parseInt(process.env.CDE_PORT),
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        };
        
        // Configurar R2
        this.r2 = new AWS.S3({
            endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            region: 'auto',
            signatureVersion: 'v4'
        });
        
        this.activePases = [];
        this.problems = [];
        this.summary = {
            totalActivePases: 0,
            pasesWithProblems: 0,
            photosNotInMongo: 0,
            photosWithWrongCategory: 0,
            photosNeedingR2Move: 0
        };
    }

    async connect() {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB conectado');
        
        this.cdeConn = await mysql.createConnection(this.cdeConfig);
        console.log('✅ CDE MySQL conectado\n');
    }

    extractPhotoNumber(idh) {
        if (!idh) return null;
        const idhStr = String(idh);
        if (idhStr.startsWith('2000')) {
            return idhStr.substring(4);
        }
        if (idhStr.length >= 5) {
            return idhStr.substring(idhStr.length - 5);
        }
        return null;
    }

    async fetchActivePasesFromCDE() {
        console.log('=' .repeat(60));
        console.log('🎯 BUSCANDO APENAS PASES DE FOTOS DISPONÍVEIS (INGRESADO)');
        console.log('=' .repeat(60) + '\n');
        
        try {
            // Primeiro, buscar todos os pases
            const [pasesRows] = await this.cdeConn.execute(`
                SELECT 
                    AIDHRF as idh,
                    AQBITEMRF as currentQBItem,
                    AORDEN as oldQBItem,
                    ARF as type,
                    AFECHARF as dateChanged
                FROM tbretornosf
                WHERE ARF = 'P'
            `);
            
            console.log(`📌 Total de pases no CDE: ${pasesRows.length}`);
            
            // Para cada pase, verificar se a foto ainda está INGRESADO
            let countIngresado = 0;
            let countRetirado = 0;
            let countOther = 0;
            
            for (const pase of pasesRows) {
                const photoNumber = this.extractPhotoNumber(pase.idh);
                if (!photoNumber) continue;
                
                // Verificar status atual no inventário - QUERY CORRIGIDA
                const [invRows] = await this.cdeConn.execute(
                    `SELECT AIDH, AESTADOP, AQBITEM 
                     FROM tbinventario 
                     WHERE AIDH = ?`,
                    [pase.idh]
                );
                
                // Se não encontrou no inventário, pular
                if (invRows.length === 0) {
                    countOther++;
                    continue;
                }
                
                const currentInventory = invRows[0];
                
                // Contar por status
                if (currentInventory.AESTADOP === 'INGRESADO') {
                    countIngresado++;
                    
                    // Verificar se o QBITEM atual no inventário corresponde ao pase
                    if (currentInventory.AQBITEM !== pase.currentQBItem) {
                        console.log(`⚠️  Inconsistência: Foto ${photoNumber} tem QBITEM ${currentInventory.AQBITEM} no inventário mas ${pase.currentQBItem} no pase`);
                    }
                    
                    this.activePases.push({
                        photoNumber: photoNumber,
                        idh: pase.idh,
                        oldQBItem: pase.oldQBItem,
                        currentQBItem: pase.currentQBItem,
                        inventoryQBItem: currentInventory.AQBITEM,
                        status: currentInventory.AESTADOP,
                        dateChanged: pase.dateChanged
                    });
                    
                    this.summary.totalActivePases++;
                    
                } else if (currentInventory.AESTADOP === 'RETIRADO') {
                    countRetirado++;
                } else {
                    countOther++;
                }
            }
            
            console.log(`\n📊 Análise dos ${pasesRows.length} pases:`);
            console.log(`   ✅ INGRESADO (disponível): ${countIngresado}`);
            console.log(`   🚚 RETIRADO (vendido): ${countRetirado}`);
            console.log(`   ❓ Outros status: ${countOther}`);
            
            console.log(`\n✅ ${this.activePases.length} pases de fotos DISPONÍVEIS encontrados\n`);
            
            // Mostrar resumo dos pases ativos
            if (this.activePases.length > 0) {
                console.log('📋 FOTOS COM PASES QUE AINDA ESTÃO DISPONÍVEIS:');
                this.activePases.forEach(p => {
                    console.log(`   Foto ${p.photoNumber}: ${p.oldQBItem} → ${p.currentQBItem} (Pase em: ${new Date(p.dateChanged).toLocaleDateString()})`);
                });
                console.log('');
            }
            
        } catch (error) {
            console.error('❌ Erro:', error.message);
            throw error;
        }
    }

    async analyzeInMongoDB() {
        console.log('=' .repeat(60));
        console.log('🔍 ANALISANDO FOTOS ATIVAS NO MONGODB E R2');
        console.log('=' .repeat(60) + '\n');
        
        for (const pase of this.activePases) {
            console.log(`\n📸 Analisando foto ${pase.photoNumber}:`);
            
            // Buscar no MongoDB
            const photo = await UnifiedProductComplete.findOne({
                photoNumber: pase.photoNumber
            });
            
            if (!photo) {
                console.log(`   ❌ NÃO encontrada no MongoDB`);
                this.problems.push({
                    type: 'NOT_IN_MONGO',
                    photoNumber: pase.photoNumber,
                    idh: pase.idh,
                    currentQBItem: pase.currentQBItem,
                    action: 'NEEDS_SYNC_FROM_CDE'
                });
                this.summary.photosNotInMongo++;
                continue;
            }
            
            console.log(`   ✅ Encontrada no MongoDB`);
            console.log(`   📁 Categoria atual: "${photo.category}"`);
            console.log(`   📂 R2 Path: "${photo.r2Path}"`);
            
            // Buscar a categoria esperada baseada no QB Item atual
            const expectedCategory = await PhotoCategory.findOne({ 
                qbItem: pase.currentQBItem 
            });
            
            if (!expectedCategory) {
                console.log(`   ⚠️  QBITEM ${pase.currentQBItem} não tem categoria mapeada`);
                continue;
            }
            
            console.log(`   🎯 Categoria esperada: "${expectedCategory.folderName || expectedCategory.displayName}"`);
            
            // Verificar se está na categoria correta
            const currentCategory = photo.category;
            const expectedCategoryName = expectedCategory.folderName || expectedCategory.displayName;
            
            if (currentCategory !== expectedCategoryName) {
                console.log(`   ❌ CATEGORIA INCORRETA!`);
                
                // Verificar se a foto existe fisicamente no R2 no caminho atual
                await this.checkR2Location(photo, expectedCategoryName, pase);
            } else {
                console.log(`   ✅ Categoria correta no MongoDB`);
                
                // Mesmo com categoria correta, verificar se está no lugar certo no R2
                const expectedR2Path = this.buildExpectedR2Path(expectedCategory, pase.photoNumber);
                if (photo.r2Path !== expectedR2Path) {
                    console.log(`   ⚠️  R2 Path pode estar desatualizado`);
                    await this.checkR2Location(photo, expectedCategoryName, pase);
                }
            }
        }
    }

    async checkR2Location(photo, expectedCategory, pase) {
        console.log(`   🔍 Verificando localização no R2...`);
        
        try {
            // Verificar se existe no caminho atual
            const currentKey = photo.r2Path || `${photo.category}/${photo.photoNumber}.webp`;
            const currentExists = await this.checkIfExistsInR2(currentKey);
            
            console.log(`   📍 Existe no caminho atual (${currentKey}): ${currentExists ? 'SIM' : 'NÃO'}`);
            
            // Construir caminho esperado
            const expectedPath = await this.buildExpectedR2PathFromQBItem(pase.currentQBItem, pase.photoNumber);
            const expectedExists = await this.checkIfExistsInR2(expectedPath);
            
            console.log(`   📍 Existe no caminho esperado (${expectedPath}): ${expectedExists ? 'SIM' : 'NÃO'}`);
            
            if (currentExists && !expectedExists) {
                console.log(`   ⚠️  AÇÃO NECESSÁRIA: Foto precisa ser MOVIDA no R2`);
                this.problems.push({
                    type: 'NEEDS_R2_MOVE',
                    photoNumber: pase.photoNumber,
                    currentR2Path: currentKey,
                    expectedR2Path: expectedPath,
                    currentMongoCategory: photo.category,
                    expectedMongoCategory: expectedCategory,
                    currentQBItem: pase.currentQBItem,
                    action: 'MOVE_IN_R2_AND_UPDATE_MONGO'
                });
                this.summary.photosNeedingR2Move++;
            } else if (!currentExists && expectedExists) {
                console.log(`   ✅ Foto já está no lugar correto no R2, apenas MongoDB precisa atualização`);
                this.problems.push({
                    type: 'MONGO_UPDATE_ONLY',
                    photoNumber: pase.photoNumber,
                    currentMongoCategory: photo.category,
                    expectedMongoCategory: expectedCategory,
                    correctR2Path: expectedPath,
                    currentQBItem: pase.currentQBItem,
                    action: 'UPDATE_MONGO_ONLY'
                });
                this.summary.photosWithWrongCategory++;
            } else if (!currentExists && !expectedExists) {
                console.log(`   ❌ PROBLEMA: Foto não encontrada em nenhum lugar no R2!`);
                this.problems.push({
                    type: 'MISSING_IN_R2',
                    photoNumber: pase.photoNumber,
                    action: 'NEEDS_INVESTIGATION'
                });
            }
            
        } catch (error) {
            console.log(`   ❌ Erro ao verificar R2: ${error.message}`);
        }
    }

    async checkIfExistsInR2(key) {
        try {
            await this.r2.headObject({
                Bucket: 'sunshine-photos',
                Key: key
            }).promise();
            return true;
        } catch (error) {
            return false;
        }
    }

    async buildExpectedR2PathFromQBItem(qbItem, photoNumber) {
        // Buscar a categoria completa baseada no QB Item
        const category = await PhotoCategory.findOne({ qbItem: qbItem });
        if (!category) {
            return `unknown/${photoNumber}.webp`;
        }
        
        // Usar o googleDrivePath que geralmente tem o caminho completo
        const path = category.googleDrivePath || category.folderName;
        return `${path}${photoNumber}.webp`;
    }

    buildExpectedR2Path(category, photoNumber) {
        const path = category.googleDrivePath || category.folderName;
        // Remover barra final se existir
        const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
        return `${cleanPath}/${photoNumber}.webp`;
    }

    generateActionPlan() {
        console.log('\n' + '=' .repeat(60));
        console.log('📋 PLANO DE AÇÃO');
        console.log('=' .repeat(60) + '\n');
        
        if (this.problems.length === 0) {
            console.log('✅ Nenhuma ação necessária! Todas as fotos ativas estão corretas.\n');
            return;
        }
        
        // Agrupar problemas por tipo
        const r2Moves = this.problems.filter(p => p.type === 'NEEDS_R2_MOVE');
        const mongoUpdates = this.problems.filter(p => p.type === 'MONGO_UPDATE_ONLY');
        const notInMongo = this.problems.filter(p => p.type === 'NOT_IN_MONGO');
        const missingInR2 = this.problems.filter(p => p.type === 'MISSING_IN_R2');
        
        if (r2Moves.length > 0) {
            console.log(`🚨 ${r2Moves.length} FOTOS PRECISAM SER MOVIDAS NO R2:\n`);
            r2Moves.forEach(p => {
                console.log(`Foto ${p.photoNumber}:`);
                console.log(`  De: ${p.currentR2Path}`);
                console.log(`  Para: ${p.expectedR2Path}`);
                console.log(`  Novo QBITEM: ${p.currentQBItem}\n`);
            });
            console.log('⚠️  ESTAS PRECISAM DE AÇÃO MANUAL NO R2!\n');
        }
        
        if (mongoUpdates.length > 0) {
            console.log(`📝 ${mongoUpdates.length} FOTOS PRECISAM APENAS DE ATUALIZAÇÃO NO MONGODB:\n`);
            console.log('// Comandos para executar no MongoDB:\n');
            
            mongoUpdates.forEach(p => {
                console.log(`// Foto ${p.photoNumber}: ${p.currentMongoCategory} → ${p.expectedMongoCategory}`);
                console.log(`db.unified_products_complete.updateOne(`);
                console.log(`  { photoNumber: "${p.photoNumber}" },`);
                console.log(`  {`);
                console.log(`    $set: {`);
                console.log(`      category: "${p.expectedMongoCategory}",`);
                console.log(`      r2Path: "${p.correctR2Path}",`);
                console.log(`      driveFileId: "${p.correctR2Path}",`);
                console.log(`      photoId: "${p.correctR2Path}",`);
                console.log(`      "currentLocation.currentCategory": "${p.expectedMongoCategory}",`);
                console.log(`      "originalLocation.originalCategory": "${p.expectedMongoCategory}"`);
                console.log(`    }`);
                console.log(`  }`);
                console.log(`);\n`);
            });
        }
        
        if (notInMongo.length > 0) {
            console.log(`❓ ${notInMongo.length} FOTOS DISPONÍVEIS NO CDE MAS NÃO NO MONGODB:\n`);
            notInMongo.forEach(p => {
                console.log(`  - Foto ${p.photoNumber} (IDH: ${p.idh}, QBITEM: ${p.currentQBItem})`);
            });
            console.log('\n⚠️  Estas precisam ser sincronizadas do CDE/R2\n');
        }
        
        if (missingInR2.length > 0) {
            console.log(`🔴 ${missingInR2.length} FOTOS ESTÃO NO MONGODB MAS NÃO NO R2:\n`);
            missingInR2.forEach(p => {
                console.log(`  - Foto ${p.photoNumber}`);
            });
            console.log('\n⚠️  INVESTIGAÇÃO URGENTE NECESSÁRIA!\n');
        }
    }

    generateFinalReport() {
        console.log('=' .repeat(60));
        console.log('📊 RELATÓRIO FINAL - FOTOS ATIVAS COM PASES');
        console.log('=' .repeat(60) + '\n');
        
        console.log('📈 RESUMO:');
        console.log(`   Total de pases de fotos DISPONÍVEIS: ${this.summary.totalActivePases}`);
        console.log(`   Fotos que precisam ser movidas no R2: ${this.summary.photosNeedingR2Move}`);
        console.log(`   Fotos que precisam apenas atualização no MongoDB: ${this.summary.photosWithWrongCategory}`);
        console.log(`   Fotos disponíveis no CDE mas não no MongoDB: ${this.summary.photosNotInMongo}`);
        
        const totalProblems = this.summary.photosNeedingR2Move + 
                             this.summary.photosWithWrongCategory + 
                             this.summary.photosNotInMongo;
        
        if (totalProblems > 0) {
            console.log(`\n⚠️  TOTAL DE PROBLEMAS A RESOLVER: ${totalProblems}`);
            
            if (this.summary.totalActivePases > 0) {
                const percentProblems = ((totalProblems / this.summary.totalActivePases) * 100).toFixed(1);
                console.log(`   Isso representa ${percentProblems}% das fotos ativas com pases`);
            }
        } else {
            console.log('\n✅ SISTEMA TOTALMENTE ALINHADO!');
        }
        
        // Salvar relatório
        const fs = require('fs');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFile = `active-pases-report-${timestamp}.json`;
        
        fs.writeFileSync(reportFile, JSON.stringify({
            timestamp: new Date(),
            summary: this.summary,
            activePases: this.activePases,
            problems: this.problems
        }, null, 2));
        
        console.log(`\n💾 Relatório detalhado salvo em: ${reportFile}`);
    }

    async analyze() {
        try {
            await this.connect();
            await this.fetchActivePasesFromCDE();
            
            if (this.activePases.length > 0) {
                await this.analyzeInMongoDB();
                this.generateActionPlan();
            } else {
                console.log('✅ Nenhum pase de foto disponível encontrado!\n');
            }
            
            this.generateFinalReport();
            
        } catch (error) {
            console.error('\n❌ Erro na análise:', error);
        } finally {
            if (this.cdeConn) await this.cdeConn.end();
            if (mongoose.connection) await mongoose.disconnect();
            console.log('\n✅ Análise concluída');
        }
    }
}

// Executar
if (require.main === module) {
    const analyzer = new ActivePasesAnalyzer();
    analyzer.analyze()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('❌ Erro fatal:', error);
            process.exit(1);
        });
}

module.exports = ActivePasesAnalyzer;