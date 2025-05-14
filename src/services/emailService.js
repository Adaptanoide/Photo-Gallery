// services/emailService.js
const nodemailer = require('nodemailer');

// Configurar transporte de e-mail (usando configurações do Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || process.env.ADMIN_EMAIL || 'sales.sunshinecowhides@gmail.com',
    pass: process.env.EMAIL_PASSWORD // Precisa ser uma senha de app específica para Gmail
  }
});

/**
 * Envia e-mail de confirmação do pedido com resumo por categoria
 * @param {string} customerName - Nome do cliente
 * @param {object} orderDetails - Detalhes do pedido com folderName, folderId e photosByCategory
 */
async function sendOrderConfirmation(customerName, orderDetails) {
  try {
    console.log('Enviando e-mail de confirmação de pedido...');
    
    // Gerar o link para a pasta no Google Drive
    const folderLink = `https://drive.google.com/drive/folders/${orderDetails.folderId}`;
    
    // Gerar o HTML para o resumo por categoria
    let categorySummaryHTML = '';
    if (orderDetails.photosByCategory && Object.keys(orderDetails.photosByCategory).length > 0) {
      categorySummaryHTML = '<h3>Resumo por Categoria:</h3><ul>';
      
      for (const category in orderDetails.photosByCategory) {
        const photos = orderDetails.photosByCategory[category];
        categorySummaryHTML += `<li><strong>${category}:</strong> ${photos.length} item(s)</li>`;
      }
      
      categorySummaryHTML += '</ul>';
    } else {
      categorySummaryHTML = `<p><strong>Total de itens:</strong> ${orderDetails.photos ? orderDetails.photos.length : 0}</p>`;
    }
    
    // Configurar opções do e-mail
    const mailOptions = {
      from: process.env.EMAIL_USER || process.env.ADMIN_EMAIL || 'sales.sunshinecowhides@gmail.com',
      to: process.env.ADMIN_EMAIL || 'sales.sunshinecowhides@gmail.com',
      subject: `Novo Pedido: ${customerName} - ${orderDetails.folderName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #D4AF37; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">Novo Pedido Recebido</h2>
          
          <p><strong>Cliente:</strong> ${customerName}</p>
          <p><strong>Data:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Pasta:</strong> ${orderDetails.folderName}</p>
          
          ${categorySummaryHTML}
          
          <p><strong>Observações:</strong> ${orderDetails.comments || 'Nenhuma observação'}</p>
          
          <div style="margin: 25px 0; text-align: center;">
            <a href="${folderLink}" style="background-color: #D4AF37; color: #212529; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Ver Pasta no Google Drive
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 15px;">
            Este pedido está aguardando pagamento. Acesse o painel administrativo para mais detalhes.
          </p>
        </div>
      `
    };
    
    // Log para debug - remover em produção
    console.log(`Enviando e-mail para: ${mailOptions.to}`);
    console.log(`Assunto: ${mailOptions.subject}`);

    // Enviar o e-mail
    const info = await transporter.sendMail(mailOptions);
    console.log('E-mail enviado com sucesso:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return { success: false, message: error.message };
  }
}

// Função simples para testar a configuração de e-mail
async function testEmailConfiguration() {
  try {
    const testMailOptions = {
      from: process.env.EMAIL_USER || process.env.ADMIN_EMAIL || 'sales.sunshinecowhides@gmail.com',
      to: process.env.ADMIN_EMAIL || 'sales.sunshinecowhides@gmail.com',
      subject: 'Teste de Configuração de E-mail - Sunshine Cowhides',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #D4AF37; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">Teste de Configuração</h2>
          <p>Este é um e-mail de teste para verificar se a configuração de e-mail está funcionando corretamente.</p>
          <p>Se você está recebendo este e-mail, significa que o sistema está configurado corretamente para enviar e-mails.</p>
          <p><strong>Data e Hora do Teste:</strong> ${new Date().toLocaleString()}</p>
        </div>
      `
    };
    
    const info = await transporter.sendMail(testMailOptions);
    console.log('E-mail de teste enviado com sucesso:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Erro ao enviar e-mail de teste:', error);
    return { success: false, message: error.message };
  }
}

module.exports = {
  sendOrderConfirmation,
  testEmailConfiguration
};