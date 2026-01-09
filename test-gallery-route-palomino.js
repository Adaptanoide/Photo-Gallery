require('dotenv').config();
const mongoose = require('mongoose');

async function testGalleryRoute() {
    console.log('🧪 TESTANDO ROTA /PHOTOS DA GALERIA - PALOMINO EXOTIC\n');
    console.log('='.repeat(80) + '\n');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const UnifiedProductComplete = mongoose.model('UnifiedProductComplete', new mongoose.Schema({}, { strict: false }));

        // SIMULAR EXATAMENTE O QUE A ROTA /PHOTOS FAZ
        const prefix = 'Cowhide Hair On BRA With Leather Binding And Lined/Palomino Exotic/';

        console.log('📍 Prefix (caminho):', prefix);
        console.log('');

        // 1. PREPARAR QUERY EXATAMENTE COMO A GALERIA FAZ (sem cliente autenticado)
        console.log('='.repeat(80));
        console.log('🔍 PASSO 1: Query base (SEM cliente autenticado)\n');

        const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\'"]/g, '\\$&');
        console.log('Escaped prefix:', escapedPrefix);
        console.log('');

        const searchQueryNoAuth = {
            status: 'available',
            transitStatus: { $ne: 'coming_soon' },
            cdeTable: { $ne: 'tbetiqueta' },
            $or: [
                { selectionId: { $exists: false } },
                { selectionId: null }
            ],
            driveFileId: { $regex: escapedPrefix, $options: 'i' }
        };

        console.log('Query completa:');
        console.log(JSON.stringify(searchQueryNoAuth, null, 2));
        console.log('');

        const photosNoAuth = await UnifiedProductComplete.find(searchQueryNoAuth)
            .sort({ fileName: 1 })
            .select('fileName driveFileId photoNumber photoId r2Path status transitStatus cdeTable selectionId');

        console.log(`✅ Fotos encontradas: ${photosNoAuth.length}\n`);

        if (photosNoAuth.length > 0) {
            photosNoAuth.forEach(photo => {
                console.log(`📷 ${photo.photoNumber} - ${photo.fileName}`);
                console.log(`   driveFileId: ${photo.driveFileId}`);
                console.log(`   r2Path: ${photo.r2Path}`);
                console.log(`   status: ${photo.status}`);
                console.log(`   transitStatus: ${photo.transitStatus || 'null'}`);
                console.log(`   cdeTable: ${photo.cdeTable || 'null'}`);
                console.log(`   selectionId: ${photo.selectionId || 'null'}`);
                console.log('');
            });
        } else {
            console.log('❌ NENHUMA foto encontrada!\n');

            // DEBUGAR CADA CONDIÇÃO
            console.log('🔍 DEBUGANDO CADA CONDIÇÃO DA QUERY:\n');

            // Teste 1: Apenas driveFileId
            console.log('Teste 1: Apenas driveFileId regex');
            const test1 = await UnifiedProductComplete.find({
                driveFileId: { $regex: escapedPrefix, $options: 'i' }
            }).select('photoNumber driveFileId status');
            console.log(`   Resultado: ${test1.length} fotos`);
            if (test1.length > 0) {
                test1.forEach(p => console.log(`      ${p.photoNumber}: status=${p.status}`));
            }
            console.log('');

            // Teste 2: driveFileId + status
            console.log('Teste 2: driveFileId + status=available');
            const test2 = await UnifiedProductComplete.find({
                driveFileId: { $regex: escapedPrefix, $options: 'i' },
                status: 'available'
            }).select('photoNumber status transitStatus');
            console.log(`   Resultado: ${test2.length} fotos`);
            if (test2.length > 0) {
                test2.forEach(p => console.log(`      ${p.photoNumber}: transitStatus=${p.transitStatus || 'null'}`));
            }
            console.log('');

            // Teste 3: driveFileId + status + transitStatus
            console.log('Teste 3: driveFileId + status + transitStatus != coming_soon');
            const test3 = await UnifiedProductComplete.find({
                driveFileId: { $regex: escapedPrefix, $options: 'i' },
                status: 'available',
                transitStatus: { $ne: 'coming_soon' }
            }).select('photoNumber transitStatus cdeTable');
            console.log(`   Resultado: ${test3.length} fotos`);
            if (test3.length > 0) {
                test3.forEach(p => console.log(`      ${p.photoNumber}: cdeTable=${p.cdeTable || 'null'}`));
            }
            console.log('');

            // Teste 4: driveFileId + status + transitStatus + cdeTable
            console.log('Teste 4: driveFileId + status + transitStatus + cdeTable != tbetiqueta');
            const test4 = await UnifiedProductComplete.find({
                driveFileId: { $regex: escapedPrefix, $options: 'i' },
                status: 'available',
                transitStatus: { $ne: 'coming_soon' },
                cdeTable: { $ne: 'tbetiqueta' }
            }).select('photoNumber cdeTable selectionId');
            console.log(`   Resultado: ${test4.length} fotos`);
            if (test4.length > 0) {
                test4.forEach(p => console.log(`      ${p.photoNumber}: selectionId=${p.selectionId || 'null'}`));
            }
            console.log('');

            // Teste 5: Query completa
            console.log('Teste 5: Query completa (com selectionId check)');
            const test5 = await UnifiedProductComplete.find({
                driveFileId: { $regex: escapedPrefix, $options: 'i' },
                status: 'available',
                transitStatus: { $ne: 'coming_soon' },
                cdeTable: { $ne: 'tbetiqueta' },
                $or: [
                    { selectionId: { $exists: false } },
                    { selectionId: null }
                ]
            }).select('photoNumber selectionId');
            console.log(`   Resultado: ${test5.length} fotos`);
            if (test5.length > 0) {
                test5.forEach(p => console.log(`      ${p.photoNumber}: selectionId=${p.selectionId || 'null'}`));
            }
            console.log('');
        }

        // 2. VERIFICAR TODAS AS FOTOS 5500PE NO BANCO
        console.log('='.repeat(80));
        console.log('🔍 PASSO 2: Verificar TODAS as fotos 5500PE no MongoDB\n');

        const allPalominoPhotos = await UnifiedProductComplete.find({
            qbItem: '5500PE'
        }).select('photoNumber fileName driveFileId status transitStatus cdeTable selectionId r2Path');

        console.log(`Total de fotos 5500PE no MongoDB: ${allPalominoPhotos.length}\n`);

        if (allPalominoPhotos.length > 0) {
            allPalominoPhotos.forEach(photo => {
                console.log(`📷 ${photo.photoNumber}`);
                console.log(`   fileName: ${photo.fileName}`);
                console.log(`   driveFileId: ${photo.driveFileId}`);
                console.log(`   status: ${photo.status}`);
                console.log(`   transitStatus: ${photo.transitStatus || 'null'}`);
                console.log(`   cdeTable: ${photo.cdeTable || 'null'}`);
                console.log(`   selectionId: ${photo.selectionId || 'null'}`);

                // CHECK: Passa na query da galeria?
                const matchesDriveFileId = photo.driveFileId && photo.driveFileId.includes(prefix);
                const matchesStatus = photo.status === 'available';
                const matchesTransit = photo.transitStatus !== 'coming_soon';
                const matchesCdeTable = photo.cdeTable !== 'tbetiqueta';
                const matchesSelection = !photo.selectionId || photo.selectionId === null;

                const passesAllChecks = matchesDriveFileId && matchesStatus && matchesTransit && matchesCdeTable && matchesSelection;

                console.log(`   ✅ Passa na query? ${passesAllChecks ? 'SIM' : 'NÃO'}`);
                if (!passesAllChecks) {
                    console.log(`      - driveFileId match: ${matchesDriveFileId} (tem: "${photo.driveFileId}")`);
                    console.log(`      - status=available: ${matchesStatus}`);
                    console.log(`      - transitStatus!=coming_soon: ${matchesTransit}`);
                    console.log(`      - cdeTable!=tbetiqueta: ${matchesCdeTable}`);
                    console.log(`      - selectionId null/empty: ${matchesSelection}`);
                }
                console.log('');
            });
        }

        console.log('='.repeat(80));
        console.log('💡 DIAGNÓSTICO FINAL:\n');

        if (photosNoAuth.length === 5) {
            console.log('✅ A query da galeria está funcionando corretamente!');
            console.log('   Problema pode ser:');
            console.log('   1. Cache do servidor (limpar com nocache=true)');
            console.log('   2. Cache do navegador');
            console.log('   3. Cliente autenticado com restrições\n');
        } else if (photosNoAuth.length === 0 && allPalominoPhotos.length > 0) {
            console.log('❌ Fotos existem no MongoDB mas não passam nos filtros!');
            console.log('   Verificar campos acima para identificar o problema.\n');
        } else if (allPalominoPhotos.length === 0) {
            console.log('❌ Fotos NÃO existem no MongoDB!');
            console.log('   Precisa re-sincronizar do CDE.\n');
        } else {
            console.log(`⚠️  Encontradas ${photosNoAuth.length} fotos de ${allPalominoPhotos.length} esperadas`);
            console.log('   Algumas fotos não passam nos filtros.\n');
        }

        console.log('='.repeat(80) + '\n');

        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

testGalleryRoute();
