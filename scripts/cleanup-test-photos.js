// cleanup-test-photos.js
// Script para limpar fotos de teste e resetar seus status em todos os sistemas

const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
const Cart = require('./src/models/Cart');
const UnifiedProductComplete = require('./src/models/UnifiedProductComplete');
const PhotoStatus = require('./src/models/PhotoStatus');
require('dotenv').config();

// Lista das fotos para limpar (adicione ou remova conforme necessário)
const PHOTOS_TO_CLEAN = [
    '82883',
    '08212',
    '08216'
];

async function cleanupTestPhotos() {
    let cdeConnection = null;

    try {
        // 1. Conectar ao MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB');

        // 2. Conectar ao CDE MySQL
        cdeConnection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            port: process.env.CDE_PORT,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });
        console.log('✅ Conectado ao CDE MySQL');

        console.log('\n🧹 INICIANDO LIMPEZA DE FOTOS DE TESTE');
        console.log('=====================================');
        console.log(`Fotos para limpar: ${PHOTOS_TO_CLEAN.join(', ')}`);
        console.log('=====================================\n');

        // Processar cada foto
        for (const photoNumber of PHOTOS_TO_CLEAN) {
            console.log(`\n📸 Processando foto ${photoNumber}...`);

            // ====== PASSO 1: Limpar no CDE (MySQL) ======
            console.log('  1️⃣ Limpando no CDE...');
            try {
                const [result] = await cdeConnection.execute(
                    `UPDATE tbinventario 
                     SET AESTADOP = 'INGRESADO',
                         RESERVEDUSU = NULL,
                         AFECHA = NOW()
                     WHERE ATIPOETIQUETA = ?`,
                    [photoNumber]
                );

                if (result.affectedRows > 0) {
                    console.log(`     ✅ CDE atualizado: ${photoNumber} → INGRESADO`);
                } else {
                    console.log(`     ⚠️ Foto ${photoNumber} não encontrada no CDE`);
                }
            } catch (error) {
                console.error(`     ❌ Erro no CDE: ${error.message}`);
            }

            // ====== PASSO 2: Limpar no MongoDB (UnifiedProductComplete) ======
            console.log('  2️⃣ Limpando no MongoDB...');

            // Buscar por várias formas possíveis do nome
            const possibleFileNames = [
                `${photoNumber}.webp`,
                photoNumber,
                `0${photoNumber}.webp`,  // Com zero à esquerda
                `0${photoNumber}`
            ];

            const updateResult = await UnifiedProductComplete.updateMany(
                {
                    $or: [
                        { photoNumber: photoNumber },
                        { fileName: { $in: possibleFileNames } },
                        { driveFileId: { $regex: photoNumber } }
                    ]
                },
                {
                    $set: {
                        status: 'available',
                        currentStatus: 'available',
                        cdeStatus: 'INGRESADO'
                    },
                    $unset: {
                        reservedBy: 1,
                        reservedAt: 1,
                        sessionId: 1
                    }
                }
            );

            if (updateResult.modifiedCount > 0) {
                console.log(`     ✅ MongoDB atualizado: ${updateResult.modifiedCount} documento(s)`);
            } else {
                console.log(`     ⚠️ Nenhum documento encontrado no MongoDB`);
            }

            // ====== PASSO 3: Limpar no PhotoStatus ======
            console.log('  3️⃣ Limpando PhotoStatus...');

            const statusResult = await PhotoStatus.deleteMany({
                $or: [
                    { photoId: { $regex: photoNumber } },
                    { fileName: { $in: possibleFileNames } }
                ]
            });

            if (statusResult.deletedCount > 0) {
                console.log(`     ✅ PhotoStatus limpo: ${statusResult.deletedCount} registro(s)`);
            } else {
                console.log(`     ℹ️ Nenhum registro em PhotoStatus`);
            }

            // ====== PASSO 4: Remover de todos os carrinhos ======
            console.log('  4️⃣ Removendo de carrinhos...');

            // Buscar todos os carrinhos que têm essa foto
            const cartsWithPhoto = await Cart.find({
                'items.fileName': { $in: possibleFileNames }
            });

            if (cartsWithPhoto.length > 0) {
                for (const cart of cartsWithPhoto) {
                    // Filtrar itens removendo a foto
                    const originalCount = cart.items.length;
                    cart.items = cart.items.filter(item => {
                        // Verificar se o nome do arquivo contém o número da foto
                        return !possibleFileNames.includes(item.fileName) &&
                            !item.fileName.includes(photoNumber);
                    });

                    // Atualizar totalItems
                    cart.totalItems = cart.items.length;

                    // Se carrinho ficou vazio, desativar
                    if (cart.items.length === 0) {
                        cart.isActive = false;
                    }

                    await cart.save();

                    const removedCount = originalCount - cart.items.length;
                    if (removedCount > 0) {
                        console.log(`     ✅ Removido do carrinho ${cart.clientCode}: ${removedCount} item(s)`);
                    }
                }
            } else {
                console.log(`     ℹ️ Foto não está em nenhum carrinho`);
            }

            console.log(`  ✅ Foto ${photoNumber} completamente limpa!`);
        }

        // ====== RELATÓRIO FINAL ======
        console.log('\n=====================================');
        console.log('📊 RELATÓRIO FINAL');
        console.log('=====================================');

        // Verificar status final no CDE
        console.log('\n🔍 Verificando status final no CDE:');
        for (const photoNumber of PHOTOS_TO_CLEAN) {
            const [rows] = await cdeConnection.execute(
                'SELECT ATIPOETIQUETA, AESTADOP, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA = ?',
                [photoNumber]
            );

            if (rows.length > 0) {
                const row = rows[0];
                console.log(`  ${photoNumber}: ${row.AESTADOP} ${row.RESERVEDUSU ? `(${row.RESERVEDUSU})` : ''}`);
            }
        }

        // Estatísticas do MongoDB
        const availableCount = await UnifiedProductComplete.countDocuments({ status: 'available' });
        const reservedCount = await UnifiedProductComplete.countDocuments({ status: 'reserved' });
        const activeCartsCount = await Cart.countDocuments({ isActive: true });

        console.log('\n📈 Estatísticas do Sistema:');
        console.log(`  Produtos disponíveis: ${availableCount}`);
        console.log(`  Produtos reservados: ${reservedCount}`);
        console.log(`  Carrinhos ativos: ${activeCartsCount}`);

        console.log('\n✅ LIMPEZA COMPLETA COM SUCESSO!');

    } catch (error) {
        console.error('\n❌ ERRO GERAL:', error);
        console.error('Stack:', error.stack);
    } finally {
        // Fechar conexões
        if (cdeConnection) {
            await cdeConnection.end();
            console.log('\n🔌 Conexão CDE fechada');
        }

        await mongoose.connection.close();
        console.log('🔌 Conexão MongoDB fechada');
    }
}

// Executar o script
console.log('🚀 Iniciando script de limpeza...\n');
cleanupTestPhotos().then(() => {
    console.log('\n👍 Script finalizado!');
    process.exit(0);
}).catch(error => {
    console.error('\n💥 Erro fatal:', error);
    process.exit(1);
});