require('dotenv').config();
const mongoose = require('mongoose');

async function checkDriveFileId() {
    console.log('🔍 VERIFICANDO driveFileId DAS FOTOS PALOMINO EXOTIC\n');
    console.log('='.repeat(80) + '\n');

    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const UnifiedProductComplete = mongoose.model('UnifiedProductComplete', new mongoose.Schema({}, { strict: false }));

        const photos = await UnifiedProductComplete.find({
            photoNumber: { $in: ['25651', '31122', '31125', '31126', '31142'] }
        }).select('photoNumber fileName driveFileId photoId r2Path category').sort({ photoNumber: 1 });

        console.log(`📸 Fotos encontradas: ${photos.length}\n`);

        photos.forEach(photo => {
            console.log(`📷 Foto ${photo.photoNumber}:`);
            console.log(`   fileName: ${photo.fileName}`);
            console.log(`   driveFileId: ${photo.driveFileId}`);
            console.log(`   photoId: ${photo.photoId}`);
            console.log(`   r2Path: ${photo.r2Path}`);
            console.log('');
        });

        console.log('='.repeat(80));
        console.log('🔍 TESTANDO A QUERY DA GALERIA\n');

        const prefix = 'Cowhide Hair On BRA With Leather Binding And Lined/Palomino Exotic/';
        console.log(`Prefix (caminho da pasta): ${prefix}\n`);

        // Escapar caracteres especiais
        const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\'"]/g, '\\$&');

        console.log('Query que a galeria usa:');
        console.log(`   driveFileId: { $regex: "${escapedPrefix}", $options: "i" }\n`);

        const galleryQuery = {
            driveFileId: { $regex: escapedPrefix, $options: 'i' },
            status: 'available',
            $or: [
                { selectionId: { $exists: false } },
                { selectionId: null }
            ]
        };

        const foundByGallery = await UnifiedProductComplete.find(galleryQuery)
            .select('photoNumber fileName driveFileId')
            .sort({ photoNumber: 1 });

        console.log(`✅ Fotos encontradas pela query da galeria: ${foundByGallery.length}\n`);

        if (foundByGallery.length > 0) {
            foundByGallery.forEach(photo => {
                console.log(`   - ${photo.photoNumber}: ${photo.driveFileId}`);
            });
        } else {
            console.log('   ❌ NENHUMA foto encontrada!\n');
            console.log('🔴 PROBLEMA CONFIRMADO:');
            console.log('   O campo "driveFileId" NÃO contém o caminho da pasta');
            console.log('   Mas a galeria espera que contenha!\n');
        }

        console.log('\n' + '='.repeat(80));
        console.log('💡 SOLUÇÃO:\n');
        console.log('   Atualizar o campo "driveFileId" de todas as fotos 5500PE');
        console.log('   para incluir o caminho completo da pasta.\n');
        console.log('   Exemplo:');
        console.log('   ANTES: driveFileId = "200131122"');
        console.log('   DEPOIS: driveFileId = "Cowhide Hair On BRA With Leather Binding And Lined/Palomino Exotic/31122.webp"\n');
        console.log('='.repeat(80) + '\n');

        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

checkDriveFileId();
