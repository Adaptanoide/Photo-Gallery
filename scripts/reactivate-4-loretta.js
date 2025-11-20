// scripts/reactivate-4-loretta.js
const mongoose = require('mongoose');
require('dotenv').config();

const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');

const LORETTA_PHOTOS = ['25571', '26289', '26625', '26705'];

async function main() {
    try {
        console.log('═══════════════════════════════════════════════════');
        console.log('🔓 REATIVAR 4 FOTOS LORETTA');
        console.log('═══════════════════════════════════════════════════\n');
        
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado\n');
        
        for (const photoNumber of LORETTA_PHOTOS) {
            const photo = await UnifiedProductComplete.findOne({ photoNumber });
            
            if (photo && !photo.isActive) {
                console.log(`📸 ${photoNumber}:`);
                console.log(`   Status antes: ${photo.status}, isActive: ${photo.isActive}`);
                
                // Reativar
                photo.status = 'available';
                photo.currentStatus = 'available';
                photo.isActive = true;
                
                if (photo.virtualStatus) {
                    photo.virtualStatus.status = 'available';
                }
                
                photo.statusHistory.push({
                    action: 'restored',
                    previousStatus: 'unavailable',
                    newStatus: 'available',
                    actionDetails: 'Reativada após resolução de duplicata CDE',
                    performedBy: 'system',
                    performedByType: 'system',
                    timestamp: new Date()
                });
                
                await photo.save();
                
                console.log(`   Status depois: ${photo.status}, isActive: ${photo.isActive}`);
                console.log(`   ✅ Reativada\n`);
            } else {
                console.log(`⚠️  ${photoNumber}: Já está ativa ou não encontrada\n`);
            }
        }
        
        console.log('═══════════════════════════════════════════════════');
        console.log('✅ REATIVAÇÃO CONCLUÍDA!');
        console.log('═══════════════════════════════════════════════════\n');
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.disconnect();
    }
}

main();