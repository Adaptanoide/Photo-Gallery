require('dotenv').config();
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');

async function checkPhotosInCDE() {
    console.log('🔍 VERIFICANDO FOTOS NO CDE (Fonte da Verdade)\n');
    console.log('='.repeat(60) + '\n');

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
            console.log('❌ Seleção 5720 não encontrada\n');
            await mongoose.connection.close();
            await cdeConnection.end();
            return;
        }

        const photoItems = selection.items.filter(i => !i.isCatalogProduct);
        console.log(`📸 Total de fotos na seleção: ${photoItems.length}\n`);
        console.log('='.repeat(60) + '\n');

        // Contadores
        let disponibles = [];
        let retirado = [];
        let reservadas = [];
        let preselected = [];
        let confirmed = [];
        let outrosEstados = [];
        let naoEncontradas = [];

        console.log('🔍 VERIFICANDO CADA FOTO NO CDE:\n');

        for (const item of photoItems) {
            const fileName = item.fileName;
            const photoNumber = fileName.match(/(\d+)/)?.[0];

            if (!photoNumber) continue;

            const photoNumberPadded = photoNumber.padStart(5, '0');

            try {
                const [rows] = await cdeConnection.execute(
                    'SELECT ATIPOETIQUETA, AESTADOP, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA = ?',
                    [photoNumberPadded]
                );

                if (rows.length === 0) {
                    naoEncontradas.push({ photoNumber, fileName });
                    console.log(`❌ ${photoNumber.padEnd(6)} - NÃO ENCONTRADA NO CDE`);
                    continue;
                }

                const estado = rows[0].AESTADOP;
                const reservedBy = rows[0].RESERVEDUSU || '';

                const info = { photoNumber, fileName, estado, reservedBy };

                if (estado === 'INGRESADO') {
                    disponibles.push(info);
                    console.log(`✅ ${photoNumber.padEnd(6)} - DISPONÍVEL (INGRESADO)`);
                } else if (estado === 'RETIRADO') {
                    retirado.push(info);
                    console.log(`🔴 ${photoNumber.padEnd(6)} - RETIRADO (vendida)`);
                } else if (estado === 'PRE-SELECTED') {
                    const pertenceAoCliente = reservedBy.includes('5720') || reservedBy === '5720';
                    if (pertenceAoCliente) {
                        preselected.push(info);
                        console.log(`✅ ${photoNumber.padEnd(6)} - PRE-SELECTED (cliente 5720)`);
                    } else {
                        preselected.push(info);
                        console.log(`⚠️  ${photoNumber.padEnd(6)} - PRE-SELECTED (${reservedBy})`);
                    }
                } else if (estado === 'RESERVED') {
                    const pertenceAoCliente = reservedBy.includes('5720') || reservedBy === '5720';
                    if (pertenceAoCliente) {
                        reservadas.push(info);
                        console.log(`✅ ${photoNumber.padEnd(6)} - RESERVED (cliente 5720)`);
                    } else {
                        reservadas.push(info);
                        console.log(`⚠️  ${photoNumber.padEnd(6)} - RESERVED (${reservedBy})`);
                    }
                } else if (estado === 'CONFIRMED') {
                    const pertenceAoCliente = reservedBy.includes('5720') || reservedBy === '5720';
                    if (pertenceAoCliente) {
                        confirmed.push(info);
                        console.log(`✅ ${photoNumber.padEnd(6)} - CONFIRMED (cliente 5720)`);
                    } else {
                        confirmed.push(info);
                        console.log(`⚠️  ${photoNumber.padEnd(6)} - CONFIRMED (${reservedBy})`);
                    }
                } else {
                    outrosEstados.push(info);
                    console.log(`⚠️  ${photoNumber.padEnd(6)} - ${estado} (${reservedBy})`);
                }

            } catch (err) {
                console.error(`❌ ${photoNumber.padEnd(6)} - ERRO: ${err.message}`);
            }
        }

        // RESUMO
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMO NO CDE:\n');

        const fotosDoCliente = [...disponibles, ...preselected, ...reservadas, ...confirmed].filter(f => {
            return !f.reservedBy || f.reservedBy.includes('5720') || f.reservedBy === '5720' || f.estado === 'INGRESADO';
        });

        const fotasDeOutros = [...reservadas, ...confirmed, ...preselected].filter(f => {
            return f.reservedBy && !f.reservedBy.includes('5720') && f.reservedBy !== '5720';
        });

        console.log(`✅ DISPONÍVEIS PARA CLIENTE 5720: ${fotosDoCliente.length}`);
        console.log(`   - INGRESADO: ${disponibles.length}`);
        console.log(`   - PRE-SELECTED (5720): ${preselected.filter(f => !f.reservedBy || f.reservedBy.includes('5720')).length}`);
        console.log(`   - RESERVED (5720): ${reservadas.filter(f => f.reservedBy.includes('5720')).length}`);
        console.log(`   - CONFIRMED (5720): ${confirmed.filter(f => f.reservedBy.includes('5720')).length}`);
        console.log('');

        console.log(`🔴 RETIRADO (vendidas para outros): ${retirado.length}`);
        if (retirado.length > 0) {
            retirado.slice(0, 15).forEach(f => {
                console.log(`   - ${f.photoNumber}`);
            });
            if (retirado.length > 15) console.log(`   ... e mais ${retirado.length - 15}`);
        }
        console.log('');

        console.log(`⚠️  RESERVADAS PARA OUTROS CLIENTES: ${fotasDeOutros.length}`);
        if (fotasDeOutros.length > 0) {
            fotasDeOutros.slice(0, 10).forEach(f => {
                console.log(`   - ${f.photoNumber} (${f.estado} - ${f.reservedBy})`);
            });
            if (fotasDeOutros.length > 10) console.log(`   ... e mais ${fotasDeOutros.length - 10}`);
        }
        console.log('');

        console.log(`❌ NÃO ENCONTRADAS NO CDE: ${naoEncontradas.length}`);
        if (naoEncontradas.length > 0) {
            naoEncontradas.slice(0, 10).forEach(f => {
                console.log(`   - ${f.photoNumber}`);
            });
            if (naoEncontradas.length > 10) console.log(`   ... e mais ${naoEncontradas.length - 10}`);
        }
        console.log('');

        console.log(`⚠️  OUTROS ESTADOS: ${outrosEstados.length}`);

        console.log('\n' + '='.repeat(60));
        console.log('\n💡 CONCLUSÃO:\n');

        const fotosPerdidas = retirado.length + fotasDeOutros.length + naoEncontradas.length;

        console.log(`   Total na seleção: ${photoItems.length}`);
        console.log(`   Disponíveis para cliente 5720: ${fotosDoCliente.length}`);
        console.log(`   Perdidas/Indisponíveis: ${fotosPerdidas}`);
        console.log(`   Diferença: ${photoItems.length - fotosDoCliente.length} fotos\n`);

        if (fotosPerdidas > 0) {
            console.log('🎯 AÇÃO:');
            console.log(`   Cliente precisa selecionar ${fotosPerdidas} fotos novas para compensar\n`);
        }

        console.log('='.repeat(60) + '\n');

        await cdeConnection.end();
        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

checkPhotosInCDE();
