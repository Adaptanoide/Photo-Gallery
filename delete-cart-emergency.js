// Script de Emergência - Deletar Carrinho e Liberar Fotos
// USO: node delete-cart-emergency.js

require('dotenv').config();
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');

const CLIENT_CODE = '2616'; // Alison Linton

async function deleteCartAndReleasePhotos() {
    console.log('🚨 SCRIPT DE EMERGÊNCIA - DELETAR CARRINHO');
    console.log('==========================================\n');

    try {
        // 1. Conectar MongoDB
        console.log('📊 Conectando ao MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB conectado\n');

        const Cart = mongoose.model('Cart', new mongoose.Schema({}, { strict: false }));
        const UnifiedProductComplete = mongoose.model('UnifiedProductComplete', new mongoose.Schema({}, { strict: false }));

        // 2. Buscar carrinho
        console.log(`🔍 Buscando carrinho do cliente ${CLIENT_CODE}...`);
        const cart = await Cart.findOne({ clientCode: CLIENT_CODE });

        if (!cart) {
            console.log('❌ Carrinho não encontrado!');
            process.exit(1);
        }

        console.log(`✅ Carrinho encontrado: ${cart.items.length} itens`);
        console.log(`   SessionId: ${cart.sessionId}\n`);

        // 3. Extrair fotos
        const photoItems = cart.items.filter(item =>
            !item.isCatalogProduct && item.fileName
        );

        console.log(`📸 ${photoItems.length} fotos encontradas:`);
        photoItems.forEach(item => {
            const photoNumber = item.fileName.match(/(\d+)/)?.[0];
            console.log(`   - ${item.fileName} (${photoNumber})`);
        });
        console.log('');

        // 4. Conectar CDE
        console.log('🔌 Conectando ao CDE MySQL...');
        const cdeConnection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE,
            port: process.env.CDE_PORT || 3306
        });
        console.log('✅ CDE conectado\n');

        // 5. Liberar fotos no CDE
        console.log('🔓 Liberando fotos no CDE (INGRESADO)...');
        for (const item of photoItems) {
            const photoNumber = item.fileName.match(/(\d+)/)?.[0];
            if (!photoNumber) continue;

            try {
                await cdeConnection.execute(
                    `UPDATE tbinventario
                     SET AESTADOP = 'INGRESADO',
                         RESERVEDUSU = NULL,
                         RESERVEDDATE = NULL
                     WHERE ATIPOETIQUETA = ?`,
                    [photoNumber.padStart(5, '0')]
                );
                console.log(`   ✅ Foto ${photoNumber} → INGRESADO`);
            } catch (cdeError) {
                console.error(`   ❌ Erro foto ${photoNumber}:`, cdeError.message);
            }
        }
        console.log('');

        // 6. Liberar fotos no MongoDB
        console.log('🔓 Liberando fotos no MongoDB...');
        const result = await UnifiedProductComplete.updateMany(
            { fileName: { $in: photoItems.map(i => i.fileName) } },
            {
                $set: { status: 'available' },
                $unset: {
                    reservedBy: 1,
                    reservedAt: 1,
                    cartAddedAt: 1
                }
            }
        );
        console.log(`   ✅ ${result.modifiedCount} fotos liberadas\n`);

        // 7. Deletar carrinho
        console.log('🗑️  Deletando carrinho...');
        await Cart.deleteOne({ _id: cart._id });
        console.log('   ✅ Carrinho deletado!\n');

        // 8. Fechar conexões
        await cdeConnection.end();
        await mongoose.connection.close();

        console.log('==========================================');
        console.log('✅ OPERAÇÃO CONCLUÍDA COM SUCESSO!');
        console.log('==========================================\n');
        console.log('📋 PRÓXIMOS PASSOS:');
        console.log('1. Keith deve adicionar as 12 fotos novamente');
        console.log('2. Testar finalização da seleção');
        console.log('3. Verificar que não há write conflict\n');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERRO:', error);
        process.exit(1);
    }
}

// Executar
deleteCartAndReleasePhotos();
