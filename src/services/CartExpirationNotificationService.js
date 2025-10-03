// src/services/CartExpirationNotificationService.js
// Sistema de notificação automática para carrinhos prestes a expirar

const Cart = require('../models/Cart');
const AccessCode = require('../models/AccessCode');
const EmailService = require('./EmailService');

class CartExpirationNotificationService {
    constructor() {
        this.emailService = EmailService.getInstance();
        this.isRunning = false;
        this.interval = null;
        this.stats = {
            totalChecks: 0,
            emailsSent: 0,
            errors: 0,
            lastRun: null
        };
    }

    /**
     * Iniciar serviço automático
     * @param {number} intervalMinutes - Intervalo de verificação em minutos (padrão: 30)
     */
    start(intervalMinutes = 30) {
        if (this.isRunning) {
            console.log('[EXPIRATION-NOTIFY] Serviço já está rodando');
            return;
        }

        console.log('\n' + '='.repeat(60));
        console.log('📧 CART EXPIRATION NOTIFICATION SERVICE');
        console.log('='.repeat(60));
        console.log(`Intervalo: ${intervalMinutes} minutos`);
        console.log(`Aviso: 2 horas antes da expiração`);
        console.log('='.repeat(60) + '\n');

        this.isRunning = true;

        // Executar primeira verificação após 2 minutos
        setTimeout(() => {
            this.checkAndNotify();
        }, 120000); // 2 minutos

        // Configurar intervalo regular
        this.interval = setInterval(() => {
            this.checkAndNotify();
        }, intervalMinutes * 60 * 1000);

        console.log('[EXPIRATION-NOTIFY] ✅ Serviço iniciado com sucesso\n');
    }

    /**
     * Parar serviço
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isRunning = false;
        console.log('[EXPIRATION-NOTIFY] ⏹️  Serviço parado');
    }

    /**
     * Verificar carrinhos e enviar notificações
     */
    async checkAndNotify() {
        try {
            console.log(`[EXPIRATION-NOTIFY] 🔍 Verificando carrinhos... [${new Date().toLocaleString()}]`);

            this.stats.totalChecks++;
            this.stats.lastRun = new Date();

            // Calcular janela de tempo: 2 horas no futuro
            const now = new Date();
            const twoHoursFromNow = new Date(now.getTime() + (2 * 60 * 60 * 1000));
            const twoHoursAndThirtyMinFromNow = new Date(now.getTime() + (2.5 * 60 * 60 * 1000));

            // Buscar carrinhos ativos com items que vão expirar nas próximas 2-2.5 horas
            // E que ainda não receberam aviso
            const cartsToNotify = await Cart.find({
                isActive: true,
                'items.0': { $exists: true }, // Tem pelo menos 1 item
                'items.expiresAt': {
                    $gte: twoHoursFromNow,
                    $lte: twoHoursAndThirtyMinFromNow
                },
                expirationWarningSet: { $ne: true } // Ainda não foi avisado
            });

            console.log(`[EXPIRATION-NOTIFY] 📋 Encontrados ${cartsToNotify.length} carrinho(s) para notificar`);

            if (cartsToNotify.length === 0) {
                return;
            }

            // Processar cada carrinho
            for (const cart of cartsToNotify) {
                await this.sendExpirationWarning(cart);
            }

            console.log(`[EXPIRATION-NOTIFY] ✅ Verificação concluída\n`);

        } catch (error) {
            console.error('[EXPIRATION-NOTIFY] ❌ Erro na verificação:', error.message);
            this.stats.errors++;
        }
    }

    /**
     * Enviar email de aviso para um carrinho específico
     */
    async sendExpirationWarning(cart) {
        try {
            console.log(`[EXPIRATION-NOTIFY] 📤 Processando carrinho do cliente ${cart.clientCode}`);

            // Buscar informações do cliente
            const clientInfo = await AccessCode.findOne({ code: cart.clientCode });

            if (!clientInfo || !clientInfo.clientEmail) {
                console.log(`[EXPIRATION-NOTIFY] ⚠️  Cliente ${cart.clientCode} não tem email cadastrado`);
                return;
            }

            // Preparar dados para o email
            const emailData = {
                clientName: cart.clientName || clientInfo.clientName,
                clientEmail: clientInfo.clientEmail,
                totalItems: cart.items.length,
                clientCode: cart.clientCode
            };

            // Enviar email
            const result = await this.emailService.sendEmail({
                to: [{
                    name: emailData.clientName,
                    email: emailData.clientEmail
                }],
                subject: 'Your Sunshine Cowhides Selection - Reminder',
                html: this.generateExpirationEmailHtml(emailData)
            });

            if (result.success) {
                // Marcar que o aviso foi enviado
                cart.expirationWarningSet = true;
                cart.expirationWarningSentAt = new Date();
                await cart.save();

                this.stats.emailsSent++;
                console.log(`[EXPIRATION-NOTIFY] ✅ Email enviado para ${emailData.clientEmail}`);
            } else {
                console.error(`[EXPIRATION-NOTIFY] ❌ Falha ao enviar email:`, result.error);
                this.stats.errors++;
            }

        } catch (error) {
            console.error(`[EXPIRATION-NOTIFY] ❌ Erro ao enviar aviso:`, error.message);
            this.stats.errors++;
        }
    }

    /**
     * Gerar HTML do email de aviso
     */
    generateExpirationEmailHtml(data) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        line-height: 1.6; 
                        color: #333;
                        margin: 0;
                        padding: 0;
                    }
                    .container {
                        max-width: 600px;
                        margin: 0 auto;
                        background: white;
                    }
                    .header { 
                        background: #D4AF37; 
                        color: white; 
                        padding: 30px 20px; 
                        text-align: center;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 24px;
                    }
                    .content { 
                        padding: 30px 20px;
                    }
                    .info-box { 
                        background: #f8f9fa; 
                        border-left: 4px solid #D4AF37; 
                        padding: 20px; 
                        margin: 20px 0;
                        border-radius: 4px;
                    }
                    .button {
                        display: inline-block;
                        background-color: #D4AF37;
                        color: white;
                        padding: 15px 35px;
                        text-decoration: none;
                        border-radius: 5px;
                        font-weight: bold;
                        margin: 20px 0;
                    }
                    .button:hover {
                        background-color: #c49d2e;
                    }
                    .footer { 
                        background: #f8f9fa;
                        color: #666;
                        padding: 20px;
                        text-align: center;
                        font-size: 12px;
                        border-top: 1px solid #ddd;
                    }
                    .highlight {
                        color: #D4AF37;
                        font-weight: bold;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🛒 Your Selection is Waiting!</h1>
                    </div>
                    
                    <div class="content">
                        <p>Hi <strong>${data.clientName}</strong>,</p>
                        
                        <p>We noticed you have <span class="highlight">${data.totalItems} product${data.totalItems > 1 ? 's' : ''}</span> in your selection cart.</p>
                        
                        <div class="info-box">
                            <p style="margin: 0; font-size: 16px;">
                                <strong>⏰ Friendly Reminder:</strong><br>
                                Your reserved products will be released soon if not confirmed.
                            </p>
                        </div>
                        
                        <p>To keep your selection, please review and confirm your cart at your earliest convenience.</p>
                        
                        <p style="text-align: center;">
                            <a href="https://sunshinecowhides-gallery.com/client" class="button">
                                View My Selection
                            </a>
                        </p>
                        
                        <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
                        
                        <p>Best regards,<br>
                        <strong>Sunshine Cowhides Gallery Team</strong></p>
                    </div>
                    
                    <div class="footer">
                        <p>This is an automated reminder from Sunshine Cowhides Gallery</p>
                        <p>📍 Sunshine Cowhides Gallery | 📧 sales@sunshinecowhides.com</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Obter estatísticas do serviço
     */
    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            uptime: this.stats.lastRun ?
                Math.floor((new Date() - this.stats.lastRun) / 1000) : 0
        };
    }

    /**
     * Testar envio de email manualmente
     */
    async testEmail(clientCode) {
        try {
            console.log(`[EXPIRATION-NOTIFY] 🧪 Enviando email de teste para cliente ${clientCode}`);

            const cart = await Cart.findOne({
                clientCode,
                isActive: true
            });

            if (!cart) {
                throw new Error(`Carrinho ativo não encontrado para cliente ${clientCode}`);
            }

            const clientInfo = await AccessCode.findOne({ code: clientCode });

            if (!clientInfo || !clientInfo.clientEmail) {
                throw new Error(`Email não cadastrado para cliente ${clientCode}`);
            }

            const emailData = {
                clientName: cart.clientName || clientInfo.clientName,
                clientEmail: clientInfo.clientEmail,
                totalItems: cart.items.length,
                clientCode: cart.clientCode
            };

            const result = await this.emailService.sendEmail({
                to: [{
                    name: emailData.clientName,
                    email: emailData.clientEmail
                }],
                subject: '[TEST] Your Sunshine Cowhides Selection - Reminder',
                html: this.generateExpirationEmailHtml(emailData)
            });

            if (result.success) {
                console.log(`[EXPIRATION-NOTIFY] ✅ Email de teste enviado com sucesso!`);
                return {
                    success: true,
                    message: 'Email de teste enviado',
                    sentTo: emailData.clientEmail
                };
            } else {
                throw new Error(result.error || 'Falha ao enviar email');
            }

        } catch (error) {
            console.error(`[EXPIRATION-NOTIFY] ❌ Erro no teste:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Instância singleton
     */
    static getInstance() {
        if (!CartExpirationNotificationService.instance) {
            CartExpirationNotificationService.instance = new CartExpirationNotificationService();
        }
        return CartExpirationNotificationService.instance;
    }
}

module.exports = CartExpirationNotificationService;