require('dotenv').config();
const mongoose = require('mongoose');

async function investigatePalominoExotic() {
    console.log('🔍 INVESTIGANDO PALOMINO EXOTIC (5500PE)\n');
    console.log('='.repeat(70) + '\n');

    try {
        // Conectar MongoDB
        await mongoose.connect(process.env.MONGODB_URI);

        const UnifiedProductComplete = mongoose.model('UnifiedProductComplete', new mongoose.Schema({}, { strict: false }));
        const PhotoCategory = mongoose.model('PhotoCategory', new mongoose.Schema({}, { strict: false }));

        // 1. Verificar PhotoCategory para 5500PE
        console.log('📋 PASSO 1: Buscando categoria 5500PE no PhotoCategory...\n');

        const category = await PhotoCategory.findOne({ qbItem: '5500PE' });

        if (category) {
            console.log('✅ Categoria 5500PE encontrada:');
            console.log(`   Display Name: ${category.displayName}`);
            console.log(`   Google Drive Path: ${category.googleDrivePath}`);
            console.log(`   QB Item: ${category.qbItem}`);
            console.log(`   Base Price: $${category.basePrice || 0}`);
            console.log('');
        } else {
            console.log('❌ Categoria 5500PE NÃO encontrada no PhotoCategory!\n');
        }

        // 2. Buscar TODAS as fotos 5500PE no MongoDB
        console.log('📸 PASSO 2: Buscando TODAS as fotos com "5500PE" no fileName...\n');

        const allPhotos = await UnifiedProductComplete.find({
            fileName: /5500PE/i
        }).select('photoNumber fileName category subcategory status cdeStatus isActive r2Path');

        console.log(`Total de fotos encontradas: ${allPhotos.length}\n`);

        if (allPhotos.length > 0) {
            console.log('Lista de fotos:');
            console.log('-'.repeat(70));
            allPhotos.forEach(photo => {
                console.log(`📷 ${photo.photoNumber.padEnd(8)} | Status: ${photo.status.padEnd(12)} | CDE: ${(photo.cdeStatus || 'null').padEnd(12)} | Active: ${photo.isActive}`);
                console.log(`   Category: ${photo.category || 'N/A'}`);
                console.log(`   R2 Path: ${photo.r2Path || 'N/A'}`);
                console.log('');
            });
        }

        // 3. Contar por status
        console.log('='.repeat(70));
        console.log('📊 PASSO 3: Contagem por status\n');

        const statusCount = await UnifiedProductComplete.aggregate([
            { $match: { fileName: /5500PE/i } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        console.log('Por Status:');
        statusCount.forEach(s => {
            console.log(`   ${s._id.padEnd(15)}: ${s.count}`);
        });
        console.log('');

        const cdeStatusCount = await UnifiedProductComplete.aggregate([
            { $match: { fileName: /5500PE/i } },
            { $group: { _id: '$cdeStatus', count: { $sum: 1 } } }
        ]);

        console.log('Por CDE Status:');
        cdeStatusCount.forEach(s => {
            console.log(`   ${(s._id || 'null').padEnd(15)}: ${s.count}`);
        });
        console.log('');

        // 4. Verificar fotos AVAILABLE
        console.log('='.repeat(70));
        console.log('✅ PASSO 4: Fotos AVAILABLE\n');

        const availablePhotos = await UnifiedProductComplete.find({
            fileName: /5500PE/i,
            status: 'available',
            isActive: true
        }).select('photoNumber fileName status cdeStatus r2Path');

        console.log(`Total de fotos AVAILABLE: ${availablePhotos.length}\n`);

        if (availablePhotos.length > 0) {
            availablePhotos.forEach(photo => {
                console.log(`✅ ${photo.photoNumber} - ${photo.fileName}`);
                console.log(`   CDE Status: ${photo.cdeStatus || 'N/A'}`);
                console.log(`   R2 Path: ${photo.r2Path || 'N/A'}`);
                console.log('');
            });
        } else {
            console.log('❌ Nenhuma foto AVAILABLE encontrada!\n');
        }

        // 5. Verificar category matching
        console.log('='.repeat(70));
        console.log('🔍 PASSO 5: Verificando category matching\n');

        if (category) {
            const photosInCategory = await UnifiedProductComplete.find({
                category: category.displayName,
                status: 'available',
                isActive: true
            }).select('photoNumber fileName status');

            console.log(`Fotos com category="${category.displayName}" e status=available: ${photosInCategory.length}\n`);

            photosInCategory.forEach(photo => {
                console.log(`   ${photo.photoNumber} - ${photo.fileName}`);
            });
            console.log('');
        }

        // 6. BUSCAR LITERALMENTE 31122, 31125, 31126, 31142, 25651
        console.log('='.repeat(70));
        console.log('🎯 PASSO 6: Buscando fotos específicas da tabela (31122, 31125, 31126, 31142, 25651)\n');

        const specificPhotos = ['31122', '31125', '31126', '31142', '25651'];

        for (const photoNum of specificPhotos) {
            const photo = await UnifiedProductComplete.findOne({
                photoNumber: photoNum
            }).select('photoNumber fileName category status cdeStatus r2Path isActive');

            if (photo) {
                console.log(`✅ Foto ${photoNum} ENCONTRADA:`);
                console.log(`   FileName: ${photo.fileName}`);
                console.log(`   Category: ${photo.category || 'N/A'}`);
                console.log(`   Status: ${photo.status}`);
                console.log(`   CDE Status: ${photo.cdeStatus || 'N/A'}`);
                console.log(`   Active: ${photo.isActive}`);
                console.log(`   R2 Path: ${photo.r2Path || 'N/A'}`);
            } else {
                console.log(`❌ Foto ${photoNum} NÃO ENCONTRADA no MongoDB`);
            }
            console.log('');
        }

        // CONCLUSÃO
        console.log('='.repeat(70));
        console.log('💡 CONCLUSÃO:\n');
        console.log(`   Total de fotos 5500PE no MongoDB: ${allPhotos.length}`);
        console.log(`   Fotos AVAILABLE: ${availablePhotos.length}`);
        console.log(`   Fotos específicas da tabela encontradas: ${specificPhotos.filter(async num => await UnifiedProductComplete.findOne({ photoNumber: num })).length}`);
        console.log('\n' + '='.repeat(70) + '\n');

        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

investigatePalominoExotic();
