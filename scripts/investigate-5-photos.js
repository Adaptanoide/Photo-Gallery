// scripts/investigate-5-photos.js
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
require('dotenv').config();

const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
const Selection = require('../src/models/Selection');

const PHOTOS = ['25571', '26289', '26625', '26705', '71022'];

async function connectCDE() {
    return await mysql.createConnection({
        host: process.env.CDE_HOST,
        port: process.env.CDE_PORT,
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE
    });
}

async function main() {
    let cdeConnection = null;
    
    try {
        console.log('═══════════════════════════════════════════════════');
        console.log('🔍 INVESTIGAR 5 FOTOS');
        console.log('═══════════════════════════════════════════════════\n');
        
        await mongoose.connect(process.env.MONGODB_URI);
        cdeConnection = await connectCDE();
        console.log('✅ Conectado\n');
        
        for (const photoNumber of PHOTOS) {
            console.log(`📸 FOTO ${photoNumber}`);
            console.log('─'.repeat(50));
            
            // MongoDB
            const photo = await UnifiedProductComplete.findOne({ photoNumber });
            console.log(`MongoDB: ${photo.status}`);
            console.log(`QB: ${photo.qbItem}`);
            console.log(`SelectionId: ${photo.selectionId || 'NULL'}`);
            
            // CDE
            const [cdeRows] = await cdeConnection.execute(
                `SELECT AESTADOP FROM tbinventario WHERE ATIPOETIQUETA = ?`,
                [photoNumber]
            );
            console.log(`CDE: ${cdeRows[0]?.AESTADOP || 'N/A'}`);
            
            // Se tem selectionId, buscar seleção
            if (photo.selectionId) {
                const selection = await Selection.findOne({ 
                    selectionId: photo.selectionId 
                });
                
                if (selection) {
                    console.log(`\nSeleção: ${selection.selectionId}`);
                    console.log(`Status: ${selection.status}`);
                    console.log(`Cliente: ${selection.clientName || 'N/A'}`);
                    console.log(`Data: ${selection.createdAt}`);
                    
                    if (selection.status === 'cancelled' || selection.status === 'finalized') {
                        console.log('⚠️ PROBLEMA: Seleção não está ativa!');
                        console.log('AÇÃO: Liberar foto (remover selectionId)');
                    }
                } else {
                    console.log('⚠️ PROBLEMA: SelectionId existe mas seleção não!');
                    console.log('AÇÃO: Liberar foto (remover selectionId)');
                }
            }
            
            // Comparar CDE vs MongoDB
            if (cdeRows[0]?.AESTADOP === 'INGRESADO' && photo.status === 'sold') {
                console.log('\n⚠️ PROBLEMA: CDE diz INGRESADO mas MongoDB diz sold');
                console.log('AÇÃO: Atualizar MongoDB para available');
            }
            
            console.log('\n');
        }
        
        console.log('═══════════════════════════════════════════════════\n');
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        if (cdeConnection) await cdeConnection.end();
        await mongoose.disconnect();
    }
}

main();