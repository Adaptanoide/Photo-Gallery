// Script para marcar clientes que já receberam email
const mongoose = require('mongoose');
require('dotenv').config();

const emails = [
    'amber@kylebunting.com',
    'aengle429@icloud.com',
    'sales@signaturecowboy.com',
    'milanovic@budi-alex.de',
    'office@modularnipodovi.com',
    'alison@tumbleweedstucson.com',
    'shugrenleather@gmail.com',
    'alexis@cortinaleathers.com'
];

async function markClients() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB');

        const AccessCode = require('./src/models/AccessCode');

        // Data de ontem (aproximadamente quando enviaram)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(20, 0, 0, 0); // Ontem às 20:00

        console.log(`\n📧 Marcando ${emails.length} clientes como tendo recebido em:`, yesterday);
        console.log('\n');

        for (const email of emails) {
            const result = await AccessCode.findOneAndUpdate(
                { clientEmail: email },
                { lastMarketingEmailSent: yesterday },
                { new: true }
            );

            if (result) {
                console.log(`✅ ${result.clientName} (${email})`);
            } else {
                console.log(`❌ NÃO ENCONTRADO: ${email}`);
            }
        }

        console.log('\n🎉 Clientes marcados com sucesso!\n');

        // Verificar quantos agora têm data
        const withDate = await AccessCode.countDocuments({
            lastMarketingEmailSent: { $exists: true, $ne: null }
        });

        console.log(`📊 Total de clientes com lastMarketingEmailSent: ${withDate}`);

        process.exit(0);

    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

markClients();
