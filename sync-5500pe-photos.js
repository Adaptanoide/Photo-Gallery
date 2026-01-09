require('dotenv').config();
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');

async function sync5500PEPhotos() {
    console.log('🔄 SINCRONIZANDO FOTOS 5500PE DO CDE PARA MONGODB\n');
    console.log('='.repeat(70) + '\n');

    try {
        // Conectar MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        const UnifiedProductComplete = mongoose.model('UnifiedProductComplete', new mongoose.Schema({}, { strict: false }));
        const PhotoCategory = mongoose.model('PhotoCategory', new mongoose.Schema({}, { strict: false }));

        // Conectar CDE
        const cdeConnection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });

        console.log('✅ Conectado ao MongoDB e CDE\n');

        // Buscar categoria 5500PE
        const category = await PhotoCategory.findOne({ qbItem: '5500PE' });
        if (!category) {
            console.log('❌ Categoria 5500PE não encontrada!');
            return;
        }

        console.log(`📋 Categoria: ${category.displayName}`);
        console.log(`   Path: ${category.googleDrivePath}`);
        console.log(`   Preço: $${category.basePrice}\n`);

        // Buscar fotos INGRESADO do CDE
        const [cdePhotos] = await cdeConnection.execute(`
            SELECT
                ATIPOETIQUETA as photoNumber,
                AQBITEM as qbItem,
                AESTADOP as status,
                AORIGEN as origin,
                AIDH as idhCode,
                AFECHA as date
            FROM tbinventario
            WHERE AQBITEM = '5500PE' AND AESTADOP = 'INGRESADO'
            ORDER BY ATIPOETIQUETA
        `);

        console.log(`📸 Encontradas ${cdePhotos.length} fotos INGRESADO no CDE\n`);

        let synced = 0;
        let errors = 0;

        for (const cdePhoto of cdePhotos) {
            try {
                const photoNumber = cdePhoto.photoNumber.toString();
                const fileName = `${cdePhoto.qbItem}_${photoNumber}.webp`;
                const idhCode = cdePhoto.idhCode || `${cdePhoto.qbItem}${photoNumber}`;

                // Construir R2 path baseado no googleDrivePath da categoria
                // Ex: "Cowhide Hair On BRA With Leather Binding And Lined/Palomino Exotic/5500PE_31122.webp"
                const r2Path = category.googleDrivePath + fileName;

                console.log(`\n🔄 Sincronizando foto ${photoNumber}...`);
                console.log(`   FileName: ${fileName}`);
                console.log(`   IDH: ${idhCode}`);
                console.log(`   R2 Path: ${r2Path}`);

                // Verificar se já existe
                const existing = await UnifiedProductComplete.findOne({ photoNumber });

                if (existing) {
                    console.log(`   ⚠️  Já existe - atualizando...`);

                    await UnifiedProductComplete.updateOne(
                        { photoNumber },
                        {
                            $set: {
                                fileName,
                                idhCode,
                                category: category.displayName,
                                subcategory: 'Palomino Exotic',
                                r2Path,
                                status: 'available',
                                cdeStatus: 'INGRESADO',
                                isActive: true,
                                basePrice: category.basePrice || 299,
                                qbItem: '5500PE',
                                lastCDESync: new Date(),
                                // Campos legados para compatibilidade
                                driveFileId: idhCode,
                                photoId: idhCode
                            }
                        }
                    );

                    console.log(`   ✅ Atualizado!`);
                } else {
                    console.log(`   ➕ Novo registro - criando...`);

                    await UnifiedProductComplete.create({
                        photoNumber,
                        fileName,
                        idhCode,
                        category: category.displayName,
                        subcategory: 'Palomino Exotic',
                        r2Path,
                        status: 'available',
                        currentStatus: 'available',
                        cdeStatus: 'INGRESADO',
                        cdeTable: 'tbinventario',
                        isActive: true,
                        basePrice: category.basePrice || 299,
                        qbItem: '5500PE',
                        price: category.basePrice || 299,
                        lastCDESync: new Date(),
                        createdAt: new Date(),
                        // Campos legados para compatibilidade
                        driveFileId: idhCode,
                        photoId: idhCode,
                        // Current location
                        currentLocation: {
                            locationType: 'stock',
                            currentPath: category.googleDrivePath,
                            currentCategory: category.displayName
                        },
                        // Original location
                        originalLocation: {
                            originalPath: category.googleDrivePath,
                            originalCategory: category.displayName,
                            originalPrice: category.basePrice || 299
                        },
                        // Virtual status
                        virtualStatus: {
                            status: 'available',
                            tags: [],
                            lastStatusChange: new Date()
                        },
                        // Metadata
                        metadata: {
                            fileType: 'webp',
                            quality: 'standard',
                            popularity: {
                                viewCount: 0,
                                reservationCount: 0
                            }
                        },
                        // História
                        statusHistory: [{
                            action: 'created',
                            newStatus: 'available',
                            actionDetails: 'Sincronizado do CDE',
                            performedBy: 'system',
                            performedByType: 'system',
                            timestamp: new Date()
                        }]
                    });

                    console.log(`   ✅ Criado!`);
                }

                synced++;

            } catch (error) {
                console.error(`   ❌ Erro: ${error.message}`);
                errors++;
            }
        }

        console.log('\n' + '='.repeat(70));
        console.log('📊 RESUMO:\n');
        console.log(`   ✅ Sincronizadas: ${synced}`);
        console.log(`   ❌ Erros: ${errors}`);
        console.log('');

        // Verificar resultado
        const mongoCount = await UnifiedProductComplete.countDocuments({
            fileName: /5500PE/i,
            status: 'available',
            isActive: true
        });

        console.log(`   📸 Fotos disponíveis no MongoDB agora: ${mongoCount}`);
        console.log('\n' + '='.repeat(70) + '\n');

        await cdeConnection.end();
        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

sync5500PEPhotos();
