// scripts/sync-retirados-simple.js
// Script SUPER SIMPLES para marcar fotos como sold quando saem do CDE

const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Configurações
const cdeConfig = {
    host: '216.246.112.6',
    port: 3306,
    user: 'tzwgctib_photos',
    password: 'T14g0@photos',
    database: 'tzwgctib_inventario'
};

// Schema do PhotoStatus (simplificado)
const photoStatusSchema = new mongoose.Schema({
    photoId: String,
    currentStatus: String,
    virtualStatus: {
        status: String,
        lastStatusChange: Date
    },
    idhCode: String,
    lastCDECheck: Date
});

const PhotoStatus = mongoose.model('PhotoStatus', photoStatusSchema, 'photostatuses');

async function syncRetirados() {
    let mysqlConnection;

    try {
        // 1. Conectar aos dois bancos
        console.log('🔗 Conectando aos bancos...');
        await mongoose.connect(process.env.MONGODB_URI);
        mysqlConnection = await mysql.createConnection(cdeConfig);
        console.log('✅ Conectado ao MongoDB e CDE!\n');

        // Buscar de ontem e hoje
        const hoje = new Date();
        const ontem = new Date();
        ontem.setDate(ontem.getDate() - 1);

        const hojeStr = hoje.toISOString().split('T')[0];
        const ontemStr = ontem.toISOString().split('T')[0];

        console.log(`📅 Buscando RETIRADOS de ${ontemStr} e ${hojeStr}...`);

        const [retirados] = await mysqlConnection.execute(
            `SELECT AIDH, AESTADOP, AFECHA, AQR, ATIPOETIQUETA
            FROM tbinventario 
            WHERE AESTADOP = 'RETIRADO' 
            AND DATE(AFECHA) IN (?, ?)`,
            [ontemStr, hojeStr]
        );

        console.log(`📦 Encontrados ${retirados.length} produtos RETIRADOS hoje\n`);

        // 3. Processar cada RETIRADO
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const item of retirados) {
            try {
                // Usar ATIPOETIQUETA como número da foto
                let photoNumber = item.ATIPOETIQUETA;

                // Só processar se tem foto
                if (!photoNumber || photoNumber === '0') {
                    console.log(`  ⏭️ IDH ${item.AIDH} sem foto (ATIPOETIQUETA: ${photoNumber})`);
                    continue;
                }

                // Padronizar com zeros à esquerda para buscar
                const photoId = photoNumber.padStart(5, '0');

                // Remover zeros à esquerda (00123 → 123)
                photoNumber = photoNumber.replace(/^0+/, '') || '0';

                console.log(`  Processando: IDH ${item.AIDH} → Foto ${photoNumber}`);

                // Atualizar no MongoDB
                // Padronizar com zeros à esquerda
                const photoIdPadded = photoNumber.padStart(5, '0');

                const result = await PhotoStatus.updateOne(
                    {
                        $or: [
                            { photoId: photoNumber },        // sem zeros: "2205"
                            { photoId: photoIdPadded },      // com zeros: "02205"
                            { fileName: `${photoIdPadded}.webp` }  // pelo fileName: "02205.webp"
                        ]
                    },
                    {
                        $set: {
                            currentStatus: 'sold',
                            'virtualStatus.status': 'sold',
                            'virtualStatus.lastStatusChange': new Date(),
                            idhCode: item.AIDH,
                            lastCDECheck: new Date()
                        }
                    }
                );

                if (result.matchedCount > 0) {
                    console.log(`    ✅ Marcada como SOLD`);
                    successCount++;
                } else {
                    console.log(`    ⚠️ Foto ${photoNumber} não encontrada no sistema`);
                    errors.push({
                        idh: item.AIDH,
                        photoNumber: photoNumber,
                        reason: 'Não encontrada no MongoDB'
                    });
                    errorCount++;
                }

            } catch (err) {
                console.log(`    ❌ Erro ao processar IDH ${item.AIDH}: ${err.message}`);
                errors.push({
                    idh: item.AIDH,
                    reason: err.message
                });
                errorCount++;
            }
        }

        // 4. Relatório final
        console.log('\n' + '='.repeat(50));
        console.log('📊 RELATÓRIO DE SINCRONIZAÇÃO');
        console.log('='.repeat(50));
        console.log(`✅ Sucesso: ${successCount} fotos marcadas como SOLD`);
        console.log(`⚠️ Erros: ${errorCount} fotos com problemas`);

        if (errors.length > 0) {
            console.log('\n❌ FOTOS COM PROBLEMAS:');
            errors.forEach(err => {
                console.log(`  IDH: ${err.idh} - ${err.reason}`);
            });
        }

        // 5. Verificar duplicatas (números que se repetem)
        console.log('\n🔍 VERIFICANDO POSSÍVEIS DUPLICATAS:');
        const [duplicates] = await mysqlConnection.execute(
            `SELECT AIDH, COUNT(*) as qtd
             FROM tbinventario 
             WHERE AESTADOP IN ('INGRESADO', 'RETIRADO')
             GROUP BY SUBSTRING(AIDH, 5)
             HAVING qtd > 1
             LIMIT 10`
        );

        if (duplicates.length > 0) {
            console.log('⚠️ Números de foto que aparecem mais de uma vez:');
            duplicates.forEach(dup => {
                console.log(`  Número termina em: ${dup.AIDH.substring(4)} (${dup.qtd} vezes)`);
            });
        } else {
            console.log('✅ Nenhuma duplicata encontrada!');
        }

    } catch (error) {
        console.error('\n❌ Erro geral:', error.message);
    } finally {
        // Fechar conexões
        if (mysqlConnection) await mysqlConnection.end();
        await mongoose.disconnect();
        console.log('\n✅ Conexões fechadas!');
    }
}

// Executar
console.log('🚀 INICIANDO SINCRONIZAÇÃO SIMPLES DE RETIRADOS\n');
console.log('Este script vai:');
console.log('1. Buscar fotos marcadas como RETIRADO hoje no CDE');
console.log('2. Marcar essas fotos como SOLD no sistema Sunshine');
console.log('3. Adicionar o IDH completo em cada registro\n');

syncRetirados();