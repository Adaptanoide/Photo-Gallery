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

            this.transporter = nodemailer.createTransporter({
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
                totalValue: selectionData.totalValue ? `R$ ${selectionData.totalValue.toFixed(2)}` : 'A calcular',
                folderName: selectionData.googleDriveInfo?.clientFolderName || 'Pasta não informada',
                selectionId: selectionData.selectionId,
                createdAt: new Date().toLocaleString('pt-BR')
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
                totalValue: selectionData.totalValue ? `R$ ${selectionData.totalValue.toFixed(2)}` : 'A calcular',
                selectionId: selectionData.selectionId,
                adminUser: adminUser,
                confirmedAt: new Date().toLocaleString('pt-BR')
            };

            const subject = `[Sunshine Cowhides] Seleção Confirmada - ${selectionData.clientName}`;
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

            const subject = `[Sunshine Cowhides] Seleção Cancelada - ${selectionData.clientName}`;
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
            const testSubject = '[Sunshine Cowhides] Teste de Configuração';
            const testHtml = `
                <h2>✅ Teste de Email</h2>
                <p>Se você recebeu este email, a configuração SMTP está funcionando corretamente!</p>
                <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                <p><strong>Sistema:</strong> Sunshine Cowhides</p>
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
                    .header { background: #007bff; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .info-box { background: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin: 15px 0; }
                    .footer { background: #6c757d; color: white; padding: 15px; text-align: center; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🎉 Nova Seleção de Cliente!</h1>
                </div>
                
                <div class="content">
                    <p>Olá!</p>
                    
                    <p>Uma nova seleção foi criada e precisa da sua atenção:</p>
                    
                    <div class="info-box">
                        <h3>📋 Detalhes da Seleção</h3>
                        <p><strong>Cliente:</strong> ${data.clientName} (${data.clientCode})</p>
                        <p><strong>ID da Seleção:</strong> ${data.selectionId}</p>
                        <p><strong>Itens Selecionados:</strong> ${data.totalItems} fotos</p>
                        <p><strong>Valor Total:</strong> ${data.totalValue}</p>
                        <p><strong>Pasta no Drive:</strong> ${data.folderName}</p>
                        <p><strong>Data/Hora:</strong> ${data.createdAt}</p>
                    </div>
                    
                    <p>🔗 <strong>Acesse o painel administrativo</strong> para processar esta seleção e entrar em contato com o cliente.</p>
                    
                    <p>Atenciosamente,<br>Sistema Sunshine Cowhides</p>
                </div>
                
                <div class="footer">
                    Este email foi enviado automaticamente pelo sistema Sunshine Cowhides
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
                    <h1>✅ Seleção Confirmada!</h1>
                </div>
                
                <div class="content">
                    <div class="info-box">
                        <h3>📋 Seleção Confirmada</h3>
                        <p><strong>Cliente:</strong> ${data.clientName} (${data.clientCode})</p>
                        <p><strong>ID:</strong> ${data.selectionId}</p>
                        <p><strong>Itens:</strong> ${data.totalItems} fotos</p>
                        <p><strong>Valor:</strong> ${data.totalValue}</p>
                        <p><strong>Processado por:</strong> ${data.adminUser}</p>
                        <p><strong>Data:</strong> ${data.confirmedAt}</p>
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
                    <h1>❌ Seleção Cancelada</h1>
                </div>
                
                <div class="content">
                    <div class="info-box">
                        <h3>📋 Seleção Cancelada</h3>
                        <p><strong>Cliente:</strong> ${data.clientName} (${data.clientCode})</p>
                        <p><strong>ID:</strong> ${data.selectionId}</p>
                        <p><strong>Itens:</strong> ${data.totalItems} fotos</p>
                        <p><strong>Motivo:</strong> ${data.reason}</p>
                        <p><strong>Cancelado por:</strong> ${data.adminUser}</p>
                        <p><strong>Data:</strong> ${data.cancelledAt}</p>
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