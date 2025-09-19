// scripts/update-paige-to-confirmed.js
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
require('dotenv').config();

const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
const Selection = require('../src/models/Selection');

async function updatePaigeToConfirmed() {
    let connection = null;

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB conectado');

        // 1. Buscar seleção da Paige
        const selection = await Selection.findOne({
            clientCode: '5287',
            status: 'pending'
        });

        if (!selection) {
            console.log('❌ Seleção da Paige não encontrada');
            return;
        }

        console.log(`📋 Seleção encontrada: ${selection.selectionId} com ${selection.items.length} items`);

        // 2. Extrair números das fotos
        const photoNumbers = selection.items.map(item => {
            const match = item.fileName.match(/\d+/);
            return match ? match[0] : null;
        }).filter(Boolean);

        console.log(`📸 ${photoNumbers.length} fotos para atualizar no CDE`);

        // 3. Atualizar MongoDB
        const mongoResult = await UnifiedProductComplete.updateMany(
            { selectionId: selection.selectionId },
            { $set: { cdeStatus: 'CONFIRMED' } }
        );

        console.log(`✅ MongoDB: ${mongoResult.modifiedCount} fotos atualizadas para CONFIRMED`);

        // 4. Conectar ao CDE
        connection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            port: process.env.CDE_PORT,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });

        // 5. Atualizar cada foto no CDE para CONFIRMED
        let successCount = 0;
        for (const photoNumber of photoNumbers) {
            try {
                const [result] = await connection.execute(
                    `UPDATE tbinventario 
                     SET AESTADOP = 'CONFIRMED',
                         AFECHA = NOW()
                     WHERE ATIPOETIQUETA = ?`,
                    [photoNumber]
                );

                if (result.affectedRows > 0) {
                    console.log(`✅ CDE: ${photoNumber} → CONFIRMED`);
                    successCount++;
                } else {
                    console.log(`⚠️ CDE: ${photoNumber} não encontrada`);
                }
            } catch (error) {
                console.error(`❌ Erro em ${photoNumber}:`, error.message);
            }
        }

        console.log(`\n📊 RESUMO: ${successCount}/${photoNumbers.length} fotos atualizadas no CDE`);

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        if (connection) await connection.end();
        await mongoose.connection.close();
        process.exit(0);
    }
}

updatePaigeToConfirmed();