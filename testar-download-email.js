// testar-download-email.js
// Script para testar o envio de email com link de download

const mongoose = require('mongoose');
require('dotenv').config();

const EMAIL_TESTE = 'tiagoivoti9@gmail.com';
const SELECAO_ID = 'SEL_MIM3PA3Q_L5DF4'; // Seleção da Gena

async function testarEnvioEmail() {
    try {
        console.log('🔄 TESTANDO ENVIO DE EMAIL COM LINK DE DOWNLOAD');
        console.log('='.repeat(60));
        
        // 1. Conectar ao MongoDB
        console.log('\n📦 Conectando ao MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://easyadmin:2NwxuiOlK57wH8cY@cluster.tsbl7y8.mongodb.net/sunshine_cowhides?retryWrites=true&w=majority&appName=Cluster');
        console.log('✅ MongoDB conectado!');
        
        // 2. Importar modelos e services
        const Selection = require('./src/models/Selection');
        const EmailService = require('./src/services/EmailService');
        
        // 3. Buscar seleção
        console.log(`\n🔍 Buscando seleção: ${SELECAO_ID}...`);
        const selection = await Selection.findOne({ selectionId: SELECAO_ID });
        
        if (!selection) {
            throw new Error(`Seleção ${SELECAO_ID} não encontrada!`);
        }
        
        console.log(`✅ Seleção encontrada:`);
        console.log(`   Cliente: ${selection.clientName}`);
        console.log(`   Items: ${selection.totalItems}`);
        console.log(`   Valor: $${selection.totalValue}`);
        console.log(`   Email cadastrado: ${selection.clientEmail || '(nenhum)'}`);
        
        // 4. Gerar token único
        console.log('\n🔐 Gerando token de download...');
        const crypto = require('crypto');
        const downloadToken = crypto.randomBytes(32).toString('hex');
        
        // 5. Salvar token na seleção
        selection.downloadToken = downloadToken;
        selection.downloadTokenCreatedAt = new Date();
        selection.downloadLinkSentAt = new Date();
        selection.downloadLinkSentTo = EMAIL_TESTE;
        await selection.save();
        
        console.log(`✅ Token gerado e salvo: ${downloadToken.substring(0, 16)}...`);
        
        // 6. Gerar URL de download
        const baseUrl = process.env.BASE_URL || 'https://sunshinecowhides-gallery.com';
        const downloadUrl = `${baseUrl}/download.html?token=${downloadToken}`;
        
        console.log(`\n🔗 URL de download:`);
        console.log(`   ${downloadUrl}`);
        
        // 7. Inicializar EmailService
        console.log('\n📧 Inicializando EmailService...');
        const emailService = EmailService.getInstance();
        await emailService.initialize();
        
        if (!emailService.isReady()) {
            throw new Error('EmailService não está pronto!');
        }
        console.log('✅ EmailService pronto!');
        
        // 8. Enviar email
        console.log(`\n📤 Enviando email para: ${EMAIL_TESTE}...`);
        
        const emailResult = await emailService.sendDownloadLink({
            to: EMAIL_TESTE,
            clientName: selection.clientName,
            totalItems: selection.totalItems,
            downloadUrl: downloadUrl
        });
        
        if (emailResult.success) {
            console.log('\n' + '='.repeat(60));
            console.log('✅ EMAIL ENVIADO COM SUCESSO!');
            console.log('='.repeat(60));
            console.log(`\n📬 Verifique sua caixa de entrada: ${EMAIL_TESTE}`);
            console.log(`\n🔗 Ou acesse diretamente:`);
            console.log(`   ${downloadUrl}`);
            console.log(`\n⚠️  Para testar em localhost, use:`);
            console.log(`   http://localhost:3000/download.html?token=${downloadToken}`);
        } else {
            console.error('\n❌ FALHA AO ENVIAR EMAIL:', emailResult.error);
        }
        
    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n📦 MongoDB desconectado');
    }
}

// Executar
testarEnvioEmail();