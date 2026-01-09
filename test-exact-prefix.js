const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const UnifiedProductComplete = require('./src/models/UnifiedProductComplete');

async function testPrefixes() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Conectado ao MongoDB\n');

        const prefixes = [
            'Cowhide Hair On BRA With Leather Binding And Lined/Palomino Exotic/',
            'Cowhide Hair On BRA With Leather Binding And Lined/Palomino Exotic',
        ];

        for (const prefix of prefixes) {
            const separator = '='.repeat(80);
            console.log(`\n${separator}`);
            console.log(`🔍 Testando: "${prefix}"`);
            console.log(`${separator}\n`);

            const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\'"]/g, '\\$&');

            const searchQuery = {
                status: 'available',
                transitStatus: { $ne: 'coming_soon' },
                cdeTable: { $ne: 'tbetiqueta' },
                $or: [
                    { selectionId: { $exists: false } },
                    { selectionId: null }
                ],
                driveFileId: { $regex: escapedPrefix, $options: 'i' }
            };

            console.log('Query:', JSON.stringify(searchQuery, null, 2));

            const photos = await UnifiedProductComplete.find(searchQuery)
                .select('photoNumber fileName driveFileId status');

            console.log(`\n✅ Encontradas: ${photos.length} fotos`);

            if (photos.length > 0) {
                console.log('\nFotos:');
                photos.forEach(p => {
                    console.log(`   ${p.photoNumber} - driveFileId: "${p.driveFileId}"`);
                });
            }
        }

        await mongoose.connection.close();
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

testPrefixes();
