require('dotenv').config();
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');

async function verifySelection5720() {
    console.log('🔍 VERIFICANDO STATUS REAL DA SELEÇÃO 5720\n');
    console.log('='.repeat(60) + '\n');

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
            console.log('❌ Seleção 5720 não encontrada\n');
            await mongoose.connection.close();
            await cdeConnection.end();
            return;
        }

        console.log('📋 SELEÇÃO ENCONTRADA:');
        console.log(`   ID: ${selection._id}`);
        console.log(`   Status: ${selection.status}`);
        console.log(`   Criada: ${new Date(selection.createdAt).toLocaleString()}`);
        console.log(`   Total Items: ${selection.items.length}\n`);

        // Separar fotos de produtos de catálogo
        const photoItems = selection.items.filter(i => !i.isCatalogProduct);
        const catalogItems = selection.items.filter(i => i.isCatalogProduct);

        console.log(`   📸 Fotos: ${photoItems.length}`);
        console.log(`   📦 Catálogo: ${catalogItems.length}\n`);
        console.log('='.repeat(60) + '\n');

        // Contadores
        let fotosOK = [];
        let fotosRETIRADO = [];
        let fotosReservadas = [];
        let fotosOutrosProblemas = [];
        let fotosNaoExistemMongo = [];
        let fotosNaoExistemCDE = [];

        console.log('🔍 ANALISANDO CADA FOTO:\n');

        for (const item of photoItems) {
            const fileName = item.fileName;
            const photoNumber = fileName.match(/(\d+)/)?.[0];

            if (!photoNumber) {
                fotosOutrosProblemas.push({ fileName, motivo: 'Número inválido' });
                continue;
            }

            // 1. Verificar MongoDB
            const mongoPhoto = await UnifiedProductComplete.findOne({ fileName });

            if (!mongoPhoto) {
                fotosNaoExistemMongo.push({ fileName, photoNumber });
                console.log(`❌ ${photoNumber.padEnd(6)} - NÃO EXISTE NO MONGODB`);
                continue;
            }

            // 2. Verificar CDE
            const [rows] = await cdeConnection.execute(
                'SELECT AESTADOP, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA = ?',
                [photoNumber.padStart(5, '0')]
            );

            if (rows.length === 0) {
                fotosNaoExistemCDE.push({ fileName, photoNumber });
                console.log(`❌ ${photoNumber.padEnd(6)} - NÃO EXISTE NO CDE`);
                continue;
            }

            const estadoCDE = rows[0].AESTADOP;
            const reservedBy = rows[0].RESERVEDUSU || '';

            // 3. Classificar status
            if (estadoCDE === 'RETIRADO') {
                fotosRETIRADO.push({ fileName, photoNumber, reservedBy });
                console.log(`🔴 ${photoNumber.padEnd(6)} - RETIRADO (vendida)`);
            } else if (estadoCDE === 'RESERVED' || estadoCDE === 'CONFIRMED') {
                const pertenceAoCliente = reservedBy.includes('5720') ||
                                          reservedBy.includes('-5720') ||
                                          reservedBy.includes('_5720') ||
                                          reservedBy === '5720';

                if (pertenceAoCliente) {
                    fotosOK.push({ fileName, photoNumber, estado: estadoCDE, reservedBy });
                    console.log(`✅ ${photoNumber.padEnd(6)} - ${estadoCDE} (cliente 5720)`);
                } else {
                    fotosReservadas.push({ fileName, photoNumber, reservedBy, estado: estadoCDE });
                    console.log(`⚠️  ${photoNumber.padEnd(6)} - ${estadoCDE} para ${reservedBy}`);
                }
            } else if (estadoCDE === 'INGRESADO') {
                fotosOK.push({ fileName, photoNumber, estado: estadoCDE });
                console.log(`✅ ${photoNumber.padEnd(6)} - DISPONÍVEL (INGRESADO)`);
            } else {
                fotosOutrosProblemas.push({ fileName, photoNumber, estado: estadoCDE, reservedBy });
                console.log(`⚠️  ${photoNumber.padEnd(6)} - Estado: ${estadoCDE}`);
            }
        }

        // RESUMO FINAL
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMO FINAL:\n');

        console.log(`✅ FOTOS OK (disponíveis): ${fotosOK.length}`);
        if (fotosOK.length > 0) {
            fotosOK.forEach(f => {
                console.log(`   - ${f.photoNumber} (${f.estado}${f.reservedBy ? ' - ' + f.reservedBy : ''})`);
            });
        }
        console.log('');

        console.log(`🔴 FOTOS RETIRADO (vendidas): ${fotosRETIRADO.length}`);
        if (fotosRETIRADO.length > 0) {
            fotosRETIRADO.forEach(f => {
                console.log(`   - ${f.photoNumber}${f.reservedBy ? ' (era de: ' + f.reservedBy + ')' : ''}`);
            });
        }
        console.log('');

        console.log(`⚠️  FOTOS RESERVADAS (outro cliente): ${fotosReservadas.length}`);
        if (fotosReservadas.length > 0) {
            fotosReservadas.forEach(f => {
                console.log(`   - ${f.photoNumber} (${f.estado} - ${f.reservedBy})`);
            });
        }
        console.log('');

        console.log(`❌ FOTOS NÃO EXISTEM NO MONGODB: ${fotosNaoExistemMongo.length}`);
        if (fotosNaoExistemMongo.length > 0) {
            fotosNaoExistemMongo.forEach(f => {
                console.log(`   - ${f.photoNumber}`);
            });
        }
        console.log('');

        console.log(`❌ FOTOS NÃO EXISTEM NO CDE: ${fotosNaoExistemCDE.length}`);
        if (fotosNaoExistemCDE.length > 0) {
            fotosNaoExistemCDE.forEach(f => {
                console.log(`   - ${f.photoNumber}`);
            });
        }
        console.log('');

        console.log(`⚠️  OUTROS PROBLEMAS: ${fotosOutrosProblemas.length}`);
        if (fotosOutrosProblemas.length > 0) {
            fotosOutrosProblemas.forEach(f => {
                console.log(`   - ${f.photoNumber || f.fileName} (${f.motivo || f.estado})`);
            });
        }

        console.log('\n' + '='.repeat(60));
        console.log('\n💡 CONCLUSÃO:\n');

        const totalProblematicas = fotosRETIRADO.length + fotosReservadas.length +
                                   fotosNaoExistemMongo.length + fotosNaoExistemCDE.length +
                                   fotosOutrosProblemas.length;

        console.log(`   Total de fotos na seleção: ${photoItems.length}`);
        console.log(`   Fotos OK: ${fotosOK.length}`);
        console.log(`   Fotos problemáticas: ${totalProblematicas}`);
        console.log(`   Diferença: ${photoItems.length - fotosOK.length} fotos\n`);

        if (fotosOK.length < photoItems.length) {
            console.log('🎯 AÇÃO RECOMENDADA:');
            console.log(`   Cliente pode adicionar ${photoItems.length - fotosOK.length} fotos para compensar\n`);
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

verifySelection5720();
