require('dotenv').config();
const mongoose = require('mongoose');

async function debugPalominoGallery() {
    console.log('🔍 DEBUG: PALOMINO EXOTIC NA GALERIA\n');
    console.log('='.repeat(80) + '\n');

    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const UnifiedProductComplete = mongoose.model('UnifiedProductComplete', new mongoose.Schema({}, { strict: false }));
        const PhotoCategory = mongoose.model('PhotoCategory', new mongoose.Schema({}, { strict: false }));

        // 1. VERIFICAR PHOTOCATEGORY
        console.log('📋 PASSO 1: Verificar PhotoCategory\n');

        const category = await PhotoCategory.findOne({ qbItem: '5500PE' });

        if (!category) {
            console.log('❌ Categoria NÃO encontrada!\n');
            return;
        }

        console.log('✅ Categoria encontrada:');
        console.log('   qbItem:', category.qbItem);
        console.log('   displayName:', category.displayName);
        console.log('   googleDrivePath:', category.googleDrivePath);
        console.log('   basePrice:', category.basePrice);
        console.log('');

        // 2. BUSCAR FOTOS NO MONGODB - EXATAMENTE COMO A GALERIA FAZ
        console.log('='.repeat(80));
        console.log('📸 PASSO 2: Buscar fotos como a GALERIA faz\n');

        console.log('Query 1: Usando category displayName exato');
        console.log(`   category: "${category.displayName}"`);
        console.log(`   status: "available"`);
        console.log(`   isActive: true`);
        console.log('');

        const photos1 = await UnifiedProductComplete.find({
            category: category.displayName,
            status: 'available',
            isActive: true
        }).select('photoNumber fileName category r2Path status currentStatus cdeStatus').sort({ photoNumber: 1 });

        console.log(`✅ Encontradas ${photos1.length} fotos com esta query\n`);

        if (photos1.length > 0) {
            console.log('Detalhes das fotos:');
            console.log('-'.repeat(80));
            photos1.forEach(photo => {
                console.log(`📷 ${photo.photoNumber}`);
                console.log(`   fileName: ${photo.fileName}`);
                console.log(`   category: ${photo.category}`);
                console.log(`   r2Path: ${photo.r2Path}`);
                console.log(`   status: ${photo.status}`);
                console.log(`   currentStatus: ${photo.currentStatus || 'N/A'}`);
                console.log(`   cdeStatus: ${photo.cdeStatus || 'N/A'}`);
                console.log(`   isActive: ${photo.isActive}`);
                console.log('');
            });
        } else {
            console.log('❌ Nenhuma foto encontrada!\n');
        }

        // 3. TESTAR QUERIES ALTERNATIVAS
        console.log('='.repeat(80));
        console.log('🔍 PASSO 3: Testando queries alternativas\n');

        // Query 2: Buscar por fileName
        console.log('Query 2: Por fileName (5500PE)');
        const photos2 = await UnifiedProductComplete.find({
            fileName: /5500PE/i,
            status: 'available',
            isActive: true
        }).select('photoNumber fileName category').sort({ photoNumber: 1 });
        console.log(`   Resultado: ${photos2.length} fotos`);
        if (photos2.length > 0) {
            console.log(`   Fotos: ${photos2.map(p => p.photoNumber).join(', ')}`);
        }
        console.log('');

        // Query 3: Buscar por qbItem
        console.log('Query 3: Por qbItem (5500PE)');
        const photos3 = await UnifiedProductComplete.find({
            qbItem: '5500PE',
            status: 'available',
            isActive: true
        }).select('photoNumber fileName category').sort({ photoNumber: 1 });
        console.log(`   Resultado: ${photos3.length} fotos`);
        if (photos3.length > 0) {
            console.log(`   Fotos: ${photos3.map(p => p.photoNumber).join(', ')}`);
        }
        console.log('');

        // Query 4: Buscar TODAS as fotos com esses números
        console.log('Query 4: Por photoNumbers específicos');
        const expectedPhotos = ['25651', '31122', '31125', '31126', '31142'];
        const photos4 = await UnifiedProductComplete.find({
            photoNumber: { $in: expectedPhotos }
        }).select('photoNumber fileName category status isActive').sort({ photoNumber: 1 });
        console.log(`   Resultado: ${photos4.length} fotos de ${expectedPhotos.length} esperadas`);
        if (photos4.length > 0) {
            photos4.forEach(p => {
                console.log(`   - ${p.photoNumber}: ${p.fileName} | status: ${p.status} | active: ${p.isActive}`);
            });
        }
        console.log('');

        // 4. VERIFICAR SE CATEGORY NAME ESTÁ CORRETO
        console.log('='.repeat(80));
        console.log('🔍 PASSO 4: Verificar TODAS as categories únicas no MongoDB\n');

        const allCategories = await UnifiedProductComplete.distinct('category', {
            photoNumber: { $in: expectedPhotos }
        });

        console.log(`Encontradas ${allCategories.length} categories diferentes para estas fotos:`);
        allCategories.forEach(cat => {
            console.log(`   - "${cat}"`);
        });
        console.log('');

        // 5. COMPARAÇÃO DE CAMINHOS
        console.log('='.repeat(80));
        console.log('📂 PASSO 5: Comparação de caminhos\n');

        console.log('Caminho esperado no R2:');
        console.log(`   Cowhide Hair On BRA With Leather Binding And Lined/Palomino Exotic/\n`);

        console.log('Caminho no PhotoCategory:');
        console.log(`   ${category.googleDrivePath}\n`);

        console.log('Caminhos das fotos no MongoDB:');
        if (photos1.length > 0) {
            const uniquePaths = [...new Set(photos1.map(p => p.r2Path.replace(/[^/]+$/, '')))];
            uniquePaths.forEach(path => {
                console.log(`   ${path}`);
            });
        } else {
            console.log('   (sem fotos para verificar)');
        }
        console.log('');

        // CONCLUSÃO
        console.log('='.repeat(80));
        console.log('💡 DIAGNÓSTICO:\n');

        if (photos1.length === 5) {
            console.log('✅ MongoDB tem as 5 fotos esperadas');
            console.log('✅ Query por category displayName funciona');
            console.log('');
            console.log('🔍 POSSÍVEIS CAUSAS do problema na galeria:');
            console.log('   1. Cache do navegador/servidor');
            console.log('   2. Rota da galeria usando query diferente');
            console.log('   3. Filtro adicional na galeria (ex: transitStatus, cdeTable)');
            console.log('');
        } else if (photos1.length === 0) {
            console.log('❌ MongoDB NÃO encontra fotos com category displayName');
            console.log('');
            if (photos2.length > 0 || photos3.length > 0 || photos4.length > 0) {
                console.log('⚠️  MAS fotos existem com outras queries!');
                console.log('🔧 PROBLEMA: Campo "category" está incorreto ou vazio');
                console.log('');
                console.log('AÇÃO NECESSÁRIA:');
                console.log('   Atualizar o campo "category" de todas as fotos 5500PE');
                console.log(`   para: "${category.displayName}"`);
            } else {
                console.log('❌ Fotos NÃO existem no MongoDB!');
                console.log('');
                console.log('AÇÃO NECESSÁRIA:');
                console.log('   Re-sincronizar as fotos do CDE');
            }
            console.log('');
        } else {
            console.log(`⚠️  MongoDB tem apenas ${photos1.length} fotos (esperado: 5)`);
            console.log('');
            console.log('AÇÃO NECESSÁRIA:');
            console.log('   Investigar quais fotos estão faltando');
        }

        console.log('='.repeat(80) + '\n');

        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

debugPalominoGallery();
