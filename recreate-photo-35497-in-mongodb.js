require('dotenv').config();
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');

async function recreatePhoto35497() {
    console.log('🔧 RECRIANDO FOTO 35497 NO MONGODB\n');
    console.log('='.repeat(70) + '\n');

    try {
        // Conectar MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        const UnifiedProductComplete = mongoose.model('UnifiedProductComplete', new mongoose.Schema({}, { strict: false }));

        // Conectar CDE
        const cdeConnection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });

        // 1. Buscar dados no CDE
        console.log('📊 Buscando dados da foto 35497 no CDE...\n');

        const [rows] = await cdeConnection.execute(
            'SELECT * FROM tbinventario WHERE ATIPOETIQUETA = ?',
            ['35497']
        );

        if (rows.length === 0) {
            console.log('❌ Foto 35497 não encontrada no CDE\n');
            await cdeConnection.end();
            await mongoose.connection.close();
            return;
        }

        const cdeData = rows[0];

        console.log('✅ Dados encontrados no CDE:');
        console.log(`   ATIPOETIQUETA: ${cdeData.ATIPOETIQUETA}`);
        console.log(`   AESTADOP: ${cdeData.AESTADOP}`);
        console.log(`   AQBITEM: ${cdeData.AQBITEM}`);
        console.log(`   RESERVEDUSU: ${cdeData.RESERVEDUSU || 'N/A'}`);
        console.log('');

        // 2. Criar documento no MongoDB
        console.log('📝 Criando foto 35497 no MongoDB...\n');

        const photoDoc = {
            fileName: '35497.webp',
            photoNumber: '35497',
            title: '35497',
            category: 'Colombian Cowhides → 2. Large → Black & White',
            qbItem: cdeData.AQBITEM || '5202BLW',
            status: 'reserved', // Porque está RESERVED no CDE
            reservedBy: {
                clientCode: '5720',
                clientName: 'Jennifer Kenjura',
                reservedAt: new Date()
            },
            price: 85.00,
            r2Key: '5202BLW/35497.webp',
            thumbnailUrl: `https://yourcdn.com/5202BLW/thumbnails/35497_thumb.webp`,
            sizes: {
                thumbnail: `5202BLW/thumbnails/35497_thumb.webp`,
                medium: `5202BLW/medium/35497_medium.webp`,
                large: `5202BLW/large/35497_large.webp`,
                original: `5202BLW/original/35497.webp`
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Verificar se já existe
        const existing = await UnifiedProductComplete.findOne({ fileName: '35497.webp' });

        if (existing) {
            console.log('⚠️ Foto 35497 já existe no MongoDB');
            console.log('   Atualizando dados...\n');

            await UnifiedProductComplete.updateOne(
                { _id: existing._id },
                { $set: photoDoc }
            );

            console.log('✅ Foto 35497 atualizada no MongoDB\n');
        } else {
            const newPhoto = new UnifiedProductComplete(photoDoc);
            await newPhoto.save();

            console.log('✅ Foto 35497 criada no MongoDB\n');
        }

        // 3. Verificar
        const photo = await UnifiedProductComplete.findOne({ fileName: '35497.webp' });

        console.log('='.repeat(70) + '\n');
        console.log('📸 FOTO 35497 NO MONGODB:\n');
        console.log(`   fileName: ${photo.fileName}`);
        console.log(`   category: ${photo.category}`);
        console.log(`   qbItem: ${photo.qbItem}`);
        console.log(`   status: ${photo.status}`);
        console.log(`   reservedBy: ${photo.reservedBy?.clientCode || 'N/A'}`);
        console.log(`   price: $${photo.price}\n`);

        console.log('✅ FOTO 35497 RECRIADA COM SUCESSO!\n');
        console.log('🎯 Agora o Selection Management deve mostrar o QBITEM correto\n');
        console.log('   Recarregue a página (F5)\n');

        console.log('='.repeat(70) + '\n');

        await cdeConnection.end();
        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

recreatePhoto35497();
