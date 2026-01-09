const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const UnifiedProductComplete = require('./src/models/UnifiedProductComplete');

async function checkDuplicatedPaths() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Conectado ao MongoDB\n');
        console.log('🔍 PROCURANDO FOTOS COM driveFileId DUPLICADO\n');

        // Buscar fotos onde driveFileId contém padrões duplicados
        const allPhotos = await UnifiedProductComplete.find({
            driveFileId: { $exists: true, $ne: null }
        }).select('photoNumber qbItem fileName driveFileId r2Path').limit(5000);

        const problematic = [];

        allPhotos.forEach(photo => {
            const path = photo.driveFileId || '';

            // Detectar se o caminho parece ter duplicação
            // Exemplo: "A/A-B/file" ou "A/B/A/B/file"
            const hasCowhideTwice = (path.match(/Cowhide Hair On BRA With Leather Binding And Lined/g) || []).length > 1;
            const hasBrazilTwice = (path.match(/Brazil Top Selected Categories/g) || []).length > 1;
            const hasColombianTwice = (path.match(/Colombian Cowhides/g) || []).length > 1;

            // Ou se tem hífen suspeito no meio
            const hasSuspiciousHyphen = path.includes('Lined-') || path.includes('Categories-') || path.includes('Cowhides-');

            if (hasCowhideTwice || hasBrazilTwice || hasColombianTwice || hasSuspiciousHyphen) {
                problematic.push({
                    photoNumber: photo.photoNumber,
                    qbItem: photo.qbItem,
                    fileName: photo.fileName,
                    driveFileId: path,
                    r2Path: photo.r2Path
                });
            }
        });

        console.log(`Total de fotos verificadas: ${allPhotos.length}`);
        console.log(`🔴 Fotos com problemas: ${problematic.length}\n`);

        if (problematic.length > 0) {
            console.log('Primeiras 30 fotos problemáticas:\n');
            problematic.slice(0, 30).forEach(p => {
                console.log(`📷 ${p.photoNumber} (${p.qbItem}):`);
                console.log(`   ❌ driveFileId: ${p.driveFileId}`);
                if (p.r2Path) {
                    console.log(`   ✅ r2Path: ${p.r2Path}`);
                }
                console.log('');
            });

            // Agrupar por qbItem
            const byQbItem = {};
            problematic.forEach(p => {
                if (!byQbItem[p.qbItem]) byQbItem[p.qbItem] = 0;
                byQbItem[p.qbItem]++;
            });

            console.log('📊 Problemas por QB Item (Top 20):\n');
            Object.entries(byQbItem)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 20)
                .forEach(([qb, count]) => {
                    console.log(`   ${qb}: ${count} fotos`);
                });
        } else {
            console.log('✅ Nenhuma foto com driveFileId duplicado encontrada!');
        }

        await mongoose.connection.close();
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

checkDuplicatedPaths();
