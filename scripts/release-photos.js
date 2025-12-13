// scripts/release-photos.js
// Script para liberar fotos específicas que ficaram PRE-SELECTED
// Uso: node scripts/release-photos.js

require('dotenv').config();
const CDEWriter = require('../src/services/CDEWriter');

async function releasePhotos() {
    // Fotos que precisam ser liberadas (do teste que falhou)
    const photosToRelease = ['08223', '32257', '13880', '24873', '26300'];

    console.log('🔓 Liberando fotos PRE-SELECTED no CDE...');
    console.log(`📸 Fotos: ${photosToRelease.join(', ')}`);

    try {
        const released = await CDEWriter.bulkMarkAsAvailable(photosToRelease);
        console.log(`✅ ${released}/${photosToRelease.length} fotos liberadas com sucesso!`);
    } catch (error) {
        console.error('❌ Erro ao liberar fotos:', error.message);
    }

    process.exit(0);
}

releasePhotos();
