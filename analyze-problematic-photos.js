require('dotenv').config();
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');

async function analyzeProblematicPhotos() {
    console.log('🔍 ANALISANDO FOTOS PROBLEMÁTICAS DA SELEÇÃO\n');
    console.log('='.repeat(70) + '\n');

    try {
        // Conectar MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        const Selection = mongoose.model('Selection', new mongoose.Schema({}, { strict: false }));

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

        // Calcular totalAmount se não existir
        let totalAmount = selection.totalAmount;
        if (!totalAmount) {
            totalAmount = selection.items.reduce((sum, item) => {
                return sum + (item.subtotal || item.price || 0);
            }, 0);
        }

        console.log('📋 SELEÇÃO ENCONTRADA:');
        console.log(`   Cliente: ${selection.clientCode} (${selection.clientName || 'N/A'})`);
        console.log(`   Status: ${selection.status}`);
        console.log(`   Total Items: ${selection.items.length}`);
        console.log(`   Total Amount: $${totalAmount.toFixed(2)}\n`);
        console.log('='.repeat(70) + '\n');

        // Fotos problemáticas conhecidas
        const fotosRETIRADO = [
            '08223', '28639', '29170', '29202',
            '31462', '31452', '32344', '35528',
            '35529', '36517', '36520'
        ];
        const fotoQBITEMErrado = '35497';

        const problematicPhotos = [...fotosRETIRADO, fotoQBITEMErrado];

        console.log(`🔴 FOTOS PROBLEMÁTICAS (${problematicPhotos.length} no total):\n`);
        console.log(`   - 11 fotos RETIRADO (vendidas)`);
        console.log(`   - 1 foto com QBITEM errado (${fotoQBITEMErrado})\n`);
        console.log('='.repeat(70) + '\n');

        // Encontrar essas fotos na seleção
        const fotosEncontradas = [];
        const fotosNaoEncontradas = [];

        for (const photoNum of problematicPhotos) {
            const item = selection.items.find(i => {
                if (!i.fileName) return false;
                const num = i.fileName.match(/(\d+)/)?.[0];
                return num === photoNum;
            });

            if (item) {
                // Verificar status no CDE
                let estadoCDE = 'N/A';
                let qbItemCDE = 'N/A';

                try {
                    const [rows] = await cdeConnection.execute(
                        'SELECT AESTADOP, AQBITEM FROM tbinventario WHERE ATIPOETIQUETA = ?',
                        [photoNum.padStart(5, '0')]
                    );

                    if (rows.length > 0) {
                        estadoCDE = rows[0].AESTADOP;
                        qbItemCDE = rows[0].AQBITEM || 'N/A';
                    }
                } catch (err) {
                    console.error(`⚠️ Erro ao buscar ${photoNum} no CDE:`, err.message);
                }

                fotosEncontradas.push({
                    photoNumber: photoNum,
                    fileName: item.fileName,
                    title: item.title,
                    category: item.category,
                    qbItem: item.qbItem,
                    qbItemCDE: qbItemCDE,
                    price: item.price,
                    quantity: item.quantity || 1,
                    subtotal: item.subtotal || item.price,
                    estadoCDE: estadoCDE,
                    motivo: fotosRETIRADO.includes(photoNum) ? 'RETIRADO' : 'QBITEM ERRADO'
                });
            } else {
                fotosNaoEncontradas.push(photoNum);
            }
        }

        console.log('📸 FOTOS PROBLEMÁTICAS ENCONTRADAS NA SELEÇÃO:\n');

        let totalSubtrair = 0;
        const ajustesPorCategoria = {};

        fotosEncontradas.forEach((foto, idx) => {
            console.log(`${idx + 1}. Foto ${foto.photoNumber} (${foto.motivo})`);
            console.log(`   FileName: ${foto.fileName}`);
            console.log(`   Categoria: ${foto.category || 'N/A'}`);
            console.log(`   QBITEM Galeria: ${foto.qbItem || 'N/A'}`);
            console.log(`   QBITEM CDE: ${foto.qbItemCDE}`);
            console.log(`   Estado CDE: ${foto.estadoCDE}`);
            console.log(`   Preço unitário: $${foto.price.toFixed(2)}`);
            console.log(`   Quantidade: ${foto.quantity}`);
            console.log(`   Subtotal: $${foto.subtotal.toFixed(2)}`);

            if (foto.motivo === 'QBITEM ERRADO') {
                console.log(`   ⚠️ QBITEM na galeria (${foto.qbItem}) ≠ QBITEM no CDE (${foto.qbItemCDE})`);
            }

            console.log('');

            totalSubtrair += foto.subtotal;

            // Agrupar por categoria
            const catKey = foto.qbItem || foto.category || 'Unknown';
            if (!ajustesPorCategoria[catKey]) {
                ajustesPorCategoria[catKey] = {
                    categoria: foto.category || 'N/A',
                    qbItem: foto.qbItem || 'N/A',
                    fotos: [],
                    quantidadeTotal: 0,
                    valorTotal: 0
                };
            }

            ajustesPorCategoria[catKey].fotos.push(foto.photoNumber);
            ajustesPorCategoria[catKey].quantidadeTotal += foto.quantity;
            ajustesPorCategoria[catKey].valorTotal += foto.subtotal;
        });

        if (fotosNaoEncontradas.length > 0) {
            console.log('⚠️ FOTOS NÃO ENCONTRADAS NA SELEÇÃO:');
            fotosNaoEncontradas.forEach(num => console.log(`   - ${num}`));
            console.log('');
        }

        console.log('='.repeat(70) + '\n');
        console.log('📊 AJUSTES POR CATEGORIA:\n');

        Object.entries(ajustesPorCategoria).forEach(([key, data]) => {
            console.log(`📦 ${data.categoria}`);
            console.log(`   QBITEM: ${data.qbItem}`);
            console.log(`   Fotos: ${data.fotos.join(', ')}`);
            console.log(`   Quantidade a subtrair: ${data.quantidadeTotal}`);
            console.log(`   Valor a subtrair: $${data.valorTotal.toFixed(2)}`);
            console.log('');
        });

        console.log('='.repeat(70) + '\n');
        console.log('💰 RESUMO FINANCEIRO:\n');
        console.log(`   Total ATUAL na seleção: $${totalAmount.toFixed(2)}`);
        console.log(`   Total a SUBTRAIR: $${totalSubtrair.toFixed(2)}`);
        console.log(`   Total NOVO (esperado): $${(totalAmount - totalSubtrair).toFixed(2)}`);
        console.log('');
        console.log(`   Items ATUAIS: ${selection.items.length}`);
        console.log(`   Items a REMOVER: ${fotosEncontradas.length}`);
        console.log(`   Items NOVOS (esperados): ${selection.items.length - fotosEncontradas.length}`);
        console.log('');

        console.log('='.repeat(70) + '\n');
        console.log('🎯 PRÓXIMO PASSO:\n');
        console.log(`   Remover as ${fotosEncontradas.length} fotos problemáticas da seleção`);
        console.log(`   Recalcular totalAmount: $${totalAmount.toFixed(2)} → $${(totalAmount - totalSubtrair).toFixed(2)}`);
        console.log(`   Manter status como: ${selection.status}`);
        console.log('');

        // Salvar detalhes em JSON para usar depois
        const detalhes = {
            selectionId: selection._id.toString(),
            clientCode: selection.clientCode,
            totalAtual: totalAmount,
            totalSubtrair: totalSubtrair,
            totalNovo: totalAmount - totalSubtrair,
            itemsAtual: selection.items.length,
            itemsRemover: fotosEncontradas.length,
            itemsNovo: selection.items.length - fotosEncontradas.length,
            fotosRemover: fotosEncontradas.map(f => ({
                photoNumber: f.photoNumber,
                fileName: f.fileName,
                motivo: f.motivo,
                subtotal: f.subtotal
            })),
            ajustesPorCategoria
        };

        const fs = require('fs');
        fs.writeFileSync(
            'selection-5720-ajustes.json',
            JSON.stringify(detalhes, null, 2)
        );

        console.log('✅ Detalhes salvos em: selection-5720-ajustes.json\n');

        await cdeConnection.end();
        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

analyzeProblematicPhotos();
