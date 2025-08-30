const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function deepAudit() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    const mysqlConn = await mysql.createConnection({
        host: process.env.CDE_HOST,
        port: parseInt(process.env.CDE_PORT),
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE
    });
    
    console.log('=================================================');
    console.log('AUDITORIA COMPLETA DO BANCO DE DADOS');
    console.log('=================================================\n');
    
    // 1. ANÁLISE DE PADRÕES DE PHOTOID
    console.log('1. ANALISANDO PADRÕES DE PHOTOID\n');
    
    const photostatuses = await db.collection('photostatuses').find({}).toArray();
    
    const patterns = {
        'numero_simples': [],      // "01214"
        'path_completo': [],        // "Brazil/.../01214.webp"
        'numero_com_underscore': [], // "1154_03_239"
        'outros': []
    };
    
    photostatuses.forEach(photo => {
        const id = photo.photoId;
        if (!id) return;
        
        if (id.includes('/')) {
            patterns.path_completo.push(id);
        } else if (id.includes('_')) {
            patterns.numero_com_underscore.push(id);
        } else if (/^\d+$/.test(id)) {
            patterns.numero_simples.push(id);
        } else {
            patterns.outros.push(id);
        }
    });
    
    console.log(`   Números simples: ${patterns.numero_simples.length} (ex: "01214")`);
    console.log(`   Paths completos: ${patterns.path_completo.length} (ex: "Brazil/.../01214.webp")`);
    console.log(`   Com underscore: ${patterns.numero_com_underscore.length} (ex: "1154_03_239")`);
    console.log(`   Outros formatos: ${patterns.outros.length}`);
    
    // 2. ANÁLISE DE ONDE CADA PADRÃO É USADO
    console.log('\n2. VERIFICANDO USO EM OUTRAS COLLECTIONS\n');
    
    // Products (carrinho)
    const products = await db.collection('products').find({}).toArray();
    let productsWithPath = 0;
    let productsWithNumber = 0;
    
    products.forEach(p => {
        if (p.driveFileId && p.driveFileId.includes('/')) productsWithPath++;
        else productsWithNumber++;
    });
    
    console.log(`   Products:`);
    console.log(`   - Com path: ${productsWithPath}`);
    console.log(`   - Só número: ${productsWithNumber}`);
    
    // 3. ANÁLISE DE CAMPOS FALTANTES
    console.log('\n3. CAMPOS FALTANTES EM PHOTOSTATUSES\n');
    
    const missing = {
        idhCode: 0,
        fileName: 0,
        currentLocation: 0,
        originalLocation: 0,
        cdeStatus: 0
    };
    
    photostatuses.forEach(photo => {
        if (!photo.idhCode) missing.idhCode++;
        if (!photo.fileName) missing.fileName++;
        if (!photo.currentLocation) missing.currentLocation++;
        if (!photo.originalLocation) missing.originalLocation++;
        if (!photo.cdeStatus) missing.cdeStatus++;
    });
    
    Object.entries(missing).forEach(([field, count]) => {
        const percent = ((count / photostatuses.length) * 100).toFixed(1);
        console.log(`   ${field}: ${count} faltando (${percent}%)`);
    });
    
    // 4. VERIFICAR DUPLICATAS
    console.log('\n4. VERIFICANDO DUPLICATAS\n');
    
    const idMap = new Map();
    const duplicates = [];
    
    photostatuses.forEach(photo => {
        let normalizedId = photo.photoId;
        if (normalizedId && normalizedId.includes('/')) {
            normalizedId = normalizedId.split('/').pop().replace('.webp', '');
        }
        
        if (idMap.has(normalizedId)) {
            duplicates.push({
                id: normalizedId,
                entries: [idMap.get(normalizedId), photo.photoId]
            });
        } else {
            idMap.set(normalizedId, photo.photoId);
        }
    });
    
    console.log(`   Encontradas ${duplicates.length} possíveis duplicatas`);
    if (duplicates.length > 0 && duplicates.length <= 10) {
        duplicates.forEach(d => {
            console.log(`   - ${d.id}: [${d.entries.join(', ')}]`);
        });
    }
    
    // 5. ANÁLISE DE SCRIPTS QUE CRIAM REGISTROS
    console.log('\n5. SCRIPTS QUE CRIAM/MODIFICAM REGISTROS\n');
    
    const scripts = [
        'src/services/CDESync.js - Cria/atualiza com números simples',
        'src/services/CartService.js - Usa driveFileId com path completo',
        'scripts/sync-r2-to-mongodb.js - Criou registros com números simples',
        'Migração antiga - Provavelmente criou com números simples',
        'Migração R2 - Pode ter criado com paths completos'
    ];
    
    scripts.forEach(s => console.log(`   - ${s}`));
    
    // 6. COMPARAÇÃO COM CDE
    console.log('\n6. COMPARAÇÃO COM CDE\n');
    
    const [cdeCount] = await mysqlConn.execute(
        'SELECT COUNT(*) as total FROM tbinventario WHERE ATIPOETIQUETA != "0" AND ATIPOETIQUETA != ""'
    );
    
    console.log(`   Total no CDE: ${cdeCount[0].total}`);
    console.log(`   Total no MongoDB: ${photostatuses.length}`);
    console.log(`   Diferença: ${cdeCount[0].total - photostatuses.length}`);
    
    // 7. RECOMENDAÇÕES
    console.log('\n7. ANÁLISE E RECOMENDAÇÕES\n');
    
    const report = [];
    
    if (patterns.path_completo.length > patterns.numero_simples.length) {
        report.push('PROBLEMA: Maioria usa path completo ao invés de número simples');
        report.push('IMPACTO: Dificulta sincronização com CDE');
        report.push('SOLUÇÃO: Padronizar para usar apenas números');
    }
    
    if (missing.idhCode > photostatuses.length * 0.5) {
        report.push('PROBLEMA: Mais de 50% sem idhCode mapeado');
        report.push('IMPACTO: Impossível enviar updates para CDE');
        report.push('SOLUÇÃO: Executar mapeamento completo');
    }
    
    if (duplicates.length > 0) {
        report.push('PROBLEMA: Existem registros duplicados');
        report.push('IMPACTO: Pode causar conflitos de sincronização');
        report.push('SOLUÇÃO: Mesclar ou remover duplicatas');
    }
    
    report.forEach(r => console.log(`   ${r}`));
    
    // Salvar relatório completo
    const fullReport = {
        patterns,
        missing,
        duplicates: duplicates.slice(0, 100),
        recommendations: report
    };
    
    fs.writeFileSync('database_audit_report.json', JSON.stringify(fullReport, null, 2));
    console.log('\n📄 Relatório completo salvo em: database_audit_report.json');
    
    await mysqlConn.end();
    await mongoose.disconnect();
}

deepAudit();