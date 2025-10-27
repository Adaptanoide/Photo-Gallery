//src/services/EmailService.js

const nodemailer = require('nodemailer');
const EmailConfig = require('../models/EmailConfig');

class EmailService {
    constructor() {
        this.transporter = null;
        this.config = null;
    }

    // ===== INICIALIZAÇÃO =====

    /**
     * Inicializar service com configuração ativa
     */
    async initialize() {
        try {
            this.config = await EmailConfig.findActiveConfig();

            if (!this.config) {
                console.warn('⚠️ Nenhuma configuração de email ativa encontrada');
                return false;
            }

            this.transporter = nodemailer.createTransport({
                host: this.config.smtp.host,
                port: this.config.smtp.port,
                secure: this.config.smtp.secure,
                auth: {
                    user: this.config.smtp.auth.user,
                    pass: this.config.smtp.auth.pass
                }
            });

            console.log(`📧 EmailService inicializado com ${this.config.smtp.host}`);
            return true;

        } catch (error) {
            console.error('❌ Erro ao inicializar EmailService:', error);
            return false;
        }
    }

    /**
     * Verificar se service está pronto para envio
     */
    isReady() {
        return this.transporter !== null && this.config !== null;
    }

    // ===== MÉTODOS DE ENVIO =====

    /**
     * Enviar email genérico
     */
    async sendEmail({ to, subject, html, text }) {
        try {
            if (!this.isReady()) {
                const initialized = await this.initialize();
                if (!initialized) {
                    throw new Error('EmailService não pôde ser inicializado');
                }
            }

            // Verificar modo de teste
            if (this.config.testMode.enabled && this.config.testMode.testEmail) {
                console.log(`🧪 Modo teste ativo - redirecionando para: ${this.config.testMode.testEmail}`);
                to = [{ email: this.config.testMode.testEmail, name: 'Teste' }];
            }

            // Preparar destinatários
            const recipients = Array.isArray(to) ?
                to.map(recipient => `${recipient.name} <${recipient.email}>`) :
                to;

            const mailOptions = {
                from: `${this.config.sender.name} <${this.config.sender.email}>`,
                to: recipients,
                subject: subject,
                html: html,
                text: text || this.stripHtml(html)
            };

            console.log(`📧 Enviando email: "${subject}" para ${recipients}`);

            const result = await this.transporter.sendMail(mailOptions);

            // Atualizar estatísticas
            await this.config.incrementEmailCounter();

            console.log(`✅ Email enviado com sucesso: ${result.messageId}`);

            return {
                success: true,
                messageId: result.messageId,
                recipients: recipients
            };

        } catch (error) {
            console.error('❌ Erro ao enviar email:', error);

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Notificar nova seleção para admins
     */
    async notifyNewSelection(selectionData) {
        try {
            // Garantir que o service está inicializado
            if (!this.isReady()) {
                const initialized = await this.initialize();
                if (!initialized) {
                    throw new Error('EmailService não pôde ser inicializado');
                }
            }

            if (!this.config?.notifications.newSelection.enabled) {
                console.log('📧 Notificação de nova seleção desabilitada');
                return { success: true, message: 'Notificação desabilitada' };
            }

            const recipients = this.config.notifications.newSelection.recipients;

            if (!recipients || recipients.length === 0) {
                console.warn('⚠️ Nenhum destinatário configurado para nova seleção');
                return { success: false, message: 'Nenhum destinatário configurado' };
            }

            // Preparar dados para template
            const templateData = {
                clientName: selectionData.clientName,
                clientCode: selectionData.clientCode,
                totalItems: selectionData.totalItems,
                totalValue: selectionData.totalValue ? `$${selectionData.totalValue.toFixed(2)}` : 'To be calculated',
                folderName: selectionData.googleDriveInfo?.clientFolderName || 'Folder not specified',
                selectionId: selectionData.selectionId,
                createdAt: new Date().toLocaleString('pt-BR'),
                observations: selectionData.observations,
                salesRep: selectionData.salesRep || 'Unassigned'
            };

            // Aplicar template
            const subject = this.applyTemplate(this.config.templates.newSelection.subject, templateData);
            const body = this.applyTemplate(this.config.templates.newSelection.body, templateData);

            // HTML mais elaborado
            const html = this.generateNewSelectionHtml(templateData);

            return await this.sendEmail({
                to: recipients,
                subject: subject,
                html: html,
                text: body
            });

        } catch (error) {
            console.error('❌ Erro ao notificar nova seleção:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Notificar seleção confirmada
     */
    async notifySelectionConfirmed(selectionData, adminUser) {
        try {
            if (!this.config?.notifications.selectionConfirmed.enabled) {
                return { success: true, message: 'Notificação desabilitada' };
            }

            const recipients = this.config.notifications.selectionConfirmed.recipients;

            if (!recipients || recipients.length === 0) {
                return { success: false, message: 'Nenhum destinatário configurado' };
            }

            const templateData = {
                clientName: selectionData.clientName,
                clientCode: selectionData.clientCode,
                totalItems: selectionData.totalItems,
                totalValue: selectionData.totalValue ? `$${selectionData.totalValue.toFixed(2)}` : 'To be calculated',
                selectionId: selectionData.selectionId,
                adminUser: adminUser,
                confirmedAt: new Date().toLocaleString('pt-BR')
            };

            const subject = `[Sunshine Cowhides] Selection Confirmed - ${selectionData.clientName}`;
            const html = this.generateSelectionConfirmedHtml(templateData);

            return await this.sendEmail({
                to: recipients,
                subject: subject,
                html: html
            });

        } catch (error) {
            console.error('❌ Erro ao notificar seleção confirmada:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Notificar seleção cancelada
     */
    async notifySelectionCancelled(selectionData, reason, adminUser) {
        try {
            if (!this.config?.notifications.selectionCancelled.enabled) {
                return { success: true, message: 'Notificação desabilitada' };
            }

            const recipients = this.config.notifications.selectionCancelled.recipients;

            if (!recipients || recipients.length === 0) {
                return { success: false, message: 'Nenhum destinatário configurado' };
            }

            const templateData = {
                clientName: selectionData.clientName,
                clientCode: selectionData.clientCode,
                totalItems: selectionData.totalItems,
                selectionId: selectionData.selectionId,
                reason: reason,
                adminUser: adminUser || 'Sistema',
                cancelledAt: new Date().toLocaleString('pt-BR')
            };

            const subject = `[Sunshine Cowhides] Selection Cancelled - ${selectionData.clientName}`;
            const html = this.generateSelectionCancelledHtml(templateData);

            return await this.sendEmail({
                to: recipients,
                subject: subject,
                html: html
            });

        } catch (error) {
            console.error('❌ Erro ao notificar seleção cancelada:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Testar configuração de email
     */
    async testConfiguration(testEmail) {
        try {
            const testSubject = '[Sunshine Cowhides] Configuration Test';
            const testHtml = `
                <h2>✅ Email Test</h2>
                <p>If you received this email, the SMTP configuration is working correctly!</p>
                <p><strong>Date/Time:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                <p><strong>System:</strong> Sunshine Cowhides</p>
            `;

            const result = await this.sendEmail({
                to: [{ name: 'Teste', email: testEmail }],
                subject: testSubject,
                html: testHtml
            });

            if (result.success) {
                // Atualizar data do último teste
                this.config.stats.lastTestAt = new Date();
                await this.config.save();
            }

            return result;

        } catch (error) {
            console.error('❌ Erro no teste de configuração:', error);
            return { success: false, error: error.message };
        }
    }

    // ===== MÉTODOS AUXILIARES =====

    /**
     * Aplicar variáveis ao template
     */
    applyTemplate(template, data) {
        let result = template;

        for (const [key, value] of Object.entries(data)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, value);
        }

        return result;
    }

    /**
     * Gerar HTML para nova seleção
     */
    generateNewSelectionHtml(data) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .header { background: #D4AF37; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .info-box { background: #f8f9fa; border-left: 4px solid #D4AF37; padding: 15px; margin: 15px 0; }
                    .footer { background: #6c757d; color: white; padding: 15px; text-align: center; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1> New Customer Selection!</h1>
                </div>
                
                <div class="content">
                    <p>Hello!</p>
                    
                    <p>A new selection has been created and needs your attention:</p>
                    
                    <div class="info-box">
                        <h3>📋 Selection Details</h3>
                        <p><strong>Customer:</strong> ${data.clientName} (${data.clientCode})</p>
                        <p><strong>Sales Rep:</strong> ${data.salesRep}</p>
                        <p><strong>Selected Items:</strong> ${data.totalItems} photos</p>
                        <p><strong>Total Value:</strong> ${data.totalValue}${['Vicky', 'Eduarda', 'Vicky / Eduarda'].some(rep => rep.toLowerCase() === (data.salesRep || '').toLowerCase()) ? ' <span style="color: #dc3545; font-style: italic;">(Retail - Prices subject to change)</span>' : ''}</p>
                        <p><strong>Date/Time:</strong> ${data.createdAt}</p>
                    </div>
                    
                    ${data.observations ? `
                        <div class="info-box">
                            <h3>📝 Client Observations</h3>
                            <p style="font-style: italic; color: #555;">"${data.observations}"</p>
                        </div>
                    ` : ''}
                    
                    <p>🔗 <strong>Access the admin panel</strong> to process this selection and contact the customer.</p>
                    
                    <p>Best regards,<br>Sunshine Cowhides System</p>
                </div>
                
                <div class="footer">
                    This email was automatically sent by Sunshine Cowhides system
                </div>

                <div style="text-align: center; margin: 40px 0;">
                    <a href="https://sunshinecowhides-gallery.com/" 
                    style="background-color: #D4AF37; 
                            color: white; 
                            padding: 15px 35px; 
                            text-decoration: none; 
                            border-radius: 5px; 
                            display: inline-block;
                            font-weight: bold;">
                        Visit Our Gallery
                    </a>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Gerar HTML para seleção confirmada
     */
    generateSelectionConfirmedHtml(data) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .header { background: #28a745; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .info-box { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>✅ Selection Confirmed!</h1>
                </div>
                
                <div class="content">
                    <div class="info-box">
                        <h3>📋 Confirmed Selection</h3>
                        <p><strong>Customer:</strong> ${data.clientName} (${data.clientCode})</p>
                        <p><strong>ID:</strong> ${data.selectionId}</p>
                        <p><strong>Items:</strong> ${data.totalItems} photos</p>
                        <p><strong>Value:</strong> ${data.totalValue}</p>
                        <p><strong>Processed by:</strong> ${data.adminUser}</p>
                        <p><strong>Date:</strong> ${data.confirmedAt}</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Gerar HTML para seleção cancelada
     */
    generateSelectionCancelledHtml(data) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .info-box { background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>❌ Selection Cancelled</h1>
                </div>
                
                <div class="content">
                    <div class="info-box">
                        <h3>📋 Cancelled Selection</h3>
                        <p><strong>Customer:</strong> ${data.clientName} (${data.clientCode})</p>
                        <p><strong>ID:</strong> ${data.selectionId}</p>
                        <p><strong>Items:</strong> ${data.totalItems} photos</p>
                        <p><strong>Reason:</strong> ${data.reason}</p>
                        <p><strong>Cancelled by:</strong> ${data.adminUser}</p>
                        <p><strong>Date:</strong> ${data.cancelledAt}</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Remover HTML de texto
     */
    stripHtml(html) {
        return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }

    // ===== MÉTODOS ESTÁTICOS =====

    /**
     * Instância singleton
     */
    static getInstance() {
        if (!EmailService.instance) {
            EmailService.instance = new EmailService();
        }
        return EmailService.instance;
    }
}

module.exports = EmailService;