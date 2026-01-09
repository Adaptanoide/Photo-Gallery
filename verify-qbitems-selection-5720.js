require('dotenv').config();
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');

async function verifyQBItemsSelection5720() {
    console.log('🔍 VERIFICANDO QBITEMS DA SELEÇÃO 5720\n');
    console.log('='.repeat(70) + '\n');

    try {
        // Conectar MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        const Selection = mongoose.model('Selection', new mongoose.Schema({}, { strict: false }));
        const UnifiedProductComplete = mongoose.model('UnifiedProductComplete', new mongoose.Schema({}, { strict: false }));

        // Conectar CDE
        const cdeConnection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });

        // Buscar seleção
        const selection = await Selection.findOne({ clientCode: '5720' }).sort({ createdAt: -1 });

        if (!selection) {
            console.log('❌ Seleção não encontrada\n');
            await mongoose.connection.close();
            await cdeConnection.end();
            return;
        }

        console.log(`📋 Seleção: ${selection.clientCode} (${selection.clientName})`);
        console.log(`   Total fotos: ${selection.items.length}\n`);
        console.log('='.repeat(70) + '\n');

        const photoItems = selection.items.filter(i => !i.isCatalogProduct);

        console.log(`🔍 VERIFICANDO ${photoItems.length} FOTOS:\n`);

        let fotosComErro = [];
        let fotosSemProblema = [];
        let fotasNaoEncontradas = [];

        for (const item of photoItems) {
            const fileName = item.fileName;
            const photoNumber = fileName.match(/(\d+)/)?.[0];

            if (!photoNumber) continue;

            const photoNumberPadded = photoNumber.padStart(5, '0');

            // 1. Buscar no MongoDB
            const mongoPhoto = await UnifiedProductComplete.findOne({ fileName });

            // 2. Buscar no CDE
            let qbItemCDE = null;
            let estadoCDE = null;
            try {
                const [rows] = await cdeConnection.execute(
                    'SELECT AQBITEM, AESTADOP FROM tbinventario WHERE ATIPOETIQUETA = ?',
                    [photoNumberPadded]
                );

                if (rows.length > 0) {
                    qbItemCDE = rows[0].AQBITEM;
                    estadoCDE = rows[0].AESTADOP;
                }
            } catch (err) {
                console.error(`⚠️ Erro ao buscar ${photoNumber} no CDE:`, err.message);
            }

            // 3. Comparar
            const qbItemGaleria = mongoPhoto?.qbItem || item.qbItem || 'N/A';
            const categoryGaleria = mongoPhoto?.category || item.category || 'N/A';

            if (!qbItemCDE) {
                fotasNaoEncontradas.push({
                    photoNumber,
                    fileName,
                    motivo: 'Não encontrada no CDE'
                });
                console.log(`❌ ${photoNumber.padEnd(6)} - NÃO ENCONTRADA NO CDE`);
                continue;
            }

            // Comparar QBITEMs
            const qbItemsIguais = qbItemGaleria === qbItemCDE || qbItemGaleria === 'N/A';

            if (!qbItemsIguais) {
                fotosComErro.push({
                    photoNumber,
                    fileName,
                    category: categoryGaleria,
                    qbItemGaleria,
                    qbItemCDE,
                    estadoCDE
                });
                console.log(`🔴 ${photoNumber.padEnd(6)} - QBITEM ERRADO`);
                console.log(`     Galeria: ${qbItemGaleria}`);
                console.log(`     CDE:     ${qbItemCDE}`);
                console.log(`     Estado:  ${estadoCDE}`);
                console.log('');
            } else {
                fotosSemProblema.push({
                    photoNumber,
                    qbItem: qbItemCDE
                });
                console.log(`✅ ${photoNumber.padEnd(6)} - OK (${qbItemCDE})`);
            }
        }

        console.log('\n' + '='.repeat(70) + '\n');
        console.log('📊 RESUMO:\n');
        console.log(`   ✅ Fotos OK: ${fotosSemProblema.length}`);
        console.log(`   🔴 Fotos com QBITEM ERRADO: ${fotosComErro.length}`);
        console.log(`   ❌ Fotos não encontradas no CDE: ${fotasNaoEncontradas.length}\n`);

        if (fotosComErro.length > 0) {
            console.log('='.repeat(70) + '\n');
            console.log('🔴 FOTOS COM QBITEM ERRADO:\n');
            fotosComErro.forEach((foto, idx) => {
                console.log(`${idx + 1}. Foto ${foto.photoNumber}`);
                console.log(`   Category: ${foto.category}`);
                console.log(`   QBITEM Galeria: ${foto.qbItemGaleria} ❌`);
                console.log(`   QBITEM CDE:     ${foto.qbItemCDE} ✅`);
                console.log(`   Estado CDE:     ${foto.estadoCDE}`);
                console.log('');
            });

            // Salvar em JSON
            const fs = require('fs');
            fs.writeFileSync(
                'qbitem-errors-selection-5720.json',
                JSON.stringify(fotosComErro, null, 2)
            );

            console.log('💾 Detalhes salvos em: qbitem-errors-selection-5720.json\n');
        }

        console.log('='.repeat(70) + '\n');

        if (fotosComErro.length > 0) {
            console.log('🎯 PRÓXIMO PASSO:\n');
            console.log(`   ${fotosComErro.length} fotos precisam ter QBITEM corrigido no MongoDB`);
            console.log('   Atualizar qbItem e category para corresponder ao CDE\n');
        } else {
            console.log('✅ TODAS AS FOTOS ESTÃO CORRETAS!\n');
        }

        await cdeConnection.end();
        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

verifyQBItemsSelection5720();
