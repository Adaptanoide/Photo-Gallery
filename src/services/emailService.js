// services/emailService.js - VERSÃO LOCAL (sem Google Drive)
const nodemailer = require('nodemailer');

// Configurar transporte de e-mail (usando configurações do Gmail)
const transporter = nodemailer.createTransport({  service: 'gmail',
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
    
    // NOVO: Link para o admin panel em vez do Google Drive
    const adminPanelLink = `${process.env.BASE_URL || 'https://your-domain.onrender.com'}/admin#order-management`;
    
    // Gerar o HTML para o resumo por categoria
    let categorySummaryHTML = '';
    let totalItems = 0;
    
    if (orderDetails.photosByCategory && Object.keys(orderDetails.photosByCategory).length > 0) {
      categorySummaryHTML = '<h3>Resumo por Categoria:</h3><ul>';
      
      for (const category in orderDetails.photosByCategory) {
        const photos = orderDetails.photosByCategory[category];
        totalItems += photos.length;
        categorySummaryHTML += `<li><strong>${category}:</strong> ${photos.length} item(s)</li>`;
      }
      
      categorySummaryHTML += '</ul>';
    } else {
      totalItems = orderDetails.photos ? orderDetails.photos.length : 0;
      categorySummaryHTML = `<p><strong>Total de itens:</strong> ${totalItems}</p>`;
    }
    
    // Configurar opções do e-mail
    const mailOptions = {
      from: process.env.EMAIL_USER || process.env.ADMIN_EMAIL || 'sales.sunshinecowhides@gmail.com',
      to: process.env.ADMIN_EMAIL || 'sales.sunshinecowhides@gmail.com',
      subject: `Novo Pedido: ${customerName} - ${totalItems} itens`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #D4AF37; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">Novo Pedido Recebido</h2>
          
          <p><strong>Cliente:</strong> ${customerName}</p>
          <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
          <p><strong>Pasta:</strong> ${orderDetails.folderName}</p>
          <p><strong>Local:</strong> /storage/cache/fotos/imagens-webp/Waiting Payment/${orderDetails.folderName}</p>
          
          ${categorySummaryHTML}
                    
          <div style="margin: 25px 0; text-align: center;">
            <a href="${adminPanelLink}" style="background-color: #D4AF37; color: #212529; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Acessar Painel Administrativo
            </a>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #495057;">Próximos Passos:</h4>
            <ol style="margin-bottom: 0;">
              <li>Acesse o painel administrativo</li>
              <li>Vá para "Order Management" → "Waiting Payment"</li>
              <li>Encontre o pedido "${orderDetails.folderName}"</li>
              <li>Revise os itens e confirme o pagamento</li>
              <li>Mova para "Sold" quando pago</li>
            </ol>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 15px;">
            Este pedido está aguardando pagamento na pasta "Waiting Payment" do sistema local.
            <br><strong>ID do Pedido:</strong> ${orderDetails.folderId}
          </p>
        </div>
      `
    };
    
    // Log para debug
    console.log(`Enviando e-mail para: ${mailOptions.to}`);
    console.log(`Assunto: ${mailOptions.subject}`);
    console.log(`Pasta criada: ${orderDetails.folderName}`);

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
      subject: 'Teste de Configuração de E-mail - Sunshine Cowhides (Sistema Local)',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #D4AF37; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">Teste de Configuração</h2>
          <p>Este é um e-mail de teste para verificar se a configuração de e-mail está funcionando corretamente com o <strong>sistema local da Render</strong>.</p>
          <p>Se você está recebendo este e-mail, significa que o sistema está configurado corretamente para enviar e-mails.</p>
          <p><strong>Data e Hora do Teste:</strong> ${new Date().toLocaleString('pt-BR')}</p>
          <p><strong>Sistema:</strong> Local Storage (Render 50GB)</p>
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