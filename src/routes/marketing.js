// src/routes/marketing.js

const express = require('express');
const nodemailer = require('nodemailer');
const AccessCode = require('../models/AccessCode');
const EmailConfig = require('../models/EmailConfig');
const { authenticateToken } = require('./auth');
const router = express.Router();
const trackingRoutes = require('./tracking');
const encryptCode = trackingRoutes.encryptCode;

// Todas as rotas precisam de autenticação admin
router.use(authenticateToken);

console.log('📧 Marketing routes loaded');

// ===== RECIPIENTS COUNT =====
router.get('/recipients-count', async (req, res) => {
    try {
        console.log('📊 Counting email recipients...');

        const totalClients = await AccessCode.countDocuments({ isActive: true });
        const clientsWithEmail = await AccessCode.countDocuments({
            isActive: true,
            clientEmail: { $exists: true, $ne: '', $ne: null, $regex: /@/ }
        });

        const count = {
            total: totalClients,
            withEmail: clientsWithEmail,
            withoutEmail: totalClients - clientsWithEmail
        };

        console.log(`✅ Recipients count: ${clientsWithEmail} with email, ${count.withoutEmail} without`);

        res.json({
            success: true,
            count: count
        });

    } catch (error) {
        console.error('❌ Error counting recipients:', error);
        res.status(500).json({
            success: false,
            message: 'Error counting recipients',
            error: error.message
        });
    }
});

// ===== MARKETING STATISTICS =====
router.get('/marketing-stats', async (req, res) => {
    try {
        console.log('📊 Loading marketing statistics...');

        // Contar clientes que receberam email de marketing
        const sentCount = await AccessCode.countDocuments({
            lastMarketingEmailSent: { $exists: true, $ne: null }
        });

        // Pegar data da última campanha (mais recente)
        const lastCampaign = await AccessCode.findOne({
            lastMarketingEmailSent: { $exists: true, $ne: null }
        })
            .sort({ lastMarketingEmailSent: -1 })
            .select('lastMarketingEmailSent');

        // Contar quantos estão disponíveis para receber (não receberam nas últimas 24h)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const availableToSend = await AccessCode.countDocuments({
            isActive: true,
            clientEmail: { $exists: true, $ne: '', $ne: null, $regex: /@/ },
            $or: [
                { lastMarketingEmailSent: { $exists: false } },
                { lastMarketingEmailSent: null },
                { lastMarketingEmailSent: { $lt: twentyFourHoursAgo } }
            ]
        });

        // Total com email
        const totalWithEmail = await AccessCode.countDocuments({
            isActive: true,
            clientEmail: { $exists: true, $ne: '', $ne: null, $regex: /@/ }
        });

        // ===== TRACKING STATISTICS =====

        // Contar quantos abriram o email
        const emailsOpened = await AccessCode.countDocuments({
            marketingEmailOpened: true
        });

        // Contar quantos clicaram
        const emailsClicked = await AccessCode.countDocuments({
            marketingEmailClicked: true
        });

        // Contar quantos se desinscreveram
        const unsubscribedCount = await AccessCode.countDocuments({
            marketingUnsubscribed: true
        });

        // Calcular taxas (percentuais)
        const openRate = sentCount > 0 ? ((emailsOpened / sentCount) * 100).toFixed(1) : 0;
        const clickRate = sentCount > 0 ? ((emailsClicked / sentCount) * 100).toFixed(1) : 0;
        const unsubscribeRate = sentCount > 0 ? ((unsubscribedCount / sentCount) * 100).toFixed(1) : 0;

        const stats = {
            totalMarketingEmailsSent: sentCount,
            lastCampaignDate: lastCampaign ? lastCampaign.lastMarketingEmailSent : null,
            totalRecipients: totalWithEmail,
            protectedClients: sentCount,
            availableToSend: availableToSend,
            // Tracking statistics
            emailsOpened: emailsOpened,
            emailsClicked: emailsClicked,
            unsubscribedCount: unsubscribedCount,
            openRate: openRate,
            clickRate: clickRate,
            unsubscribeRate: unsubscribeRate
        };

        console.log('✅ Marketing stats loaded:', stats);

        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
        console.error('❌ Error loading marketing stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error loading marketing statistics',
            error: error.message
        });
    }
});

// ===== RECIPIENTS LIST =====
router.get('/recipients-list', async (req, res) => {
    try {
        console.log('📋 Fetching recipients list...');

        const limit = parseInt(req.query.limit) || 50;

        const clients = await AccessCode.find({
            isActive: true,
            clientEmail: { $exists: true, $ne: '', $ne: null, $regex: /@/ },
            marketingUnsubscribed: { $ne: true } // ← Excluir quem se desinscreveu
        })
            .select('code clientName clientEmail companyName')
            .sort({ clientName: 1 })
            .limit(limit);

        console.log(`✅ Found ${clients.length} clients with email`);

        res.json({
            success: true,
            recipients: clients.map(c => ({
                code: c.code,
                name: c.clientName,
                email: c.clientEmail,
                company: c.companyName || 'N/A'
            })),
            total: clients.length,
            showing: Math.min(limit, clients.length)
        });

    } catch (error) {
        console.error('❌ Error fetching recipients list:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching recipients',
            error: error.message
        });
    }
});

// ===== EMAIL PREVIEW =====
router.post('/preview', async (req, res) => {
    try {
        const { subject, message } = req.body;

        if (!subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'Subject and message are required'
            });
        }

        console.log('👁️ Generating email preview...');

        const exampleClient = await AccessCode.findOne({
            isActive: true,
            clientEmail: { $exists: true, $ne: '' }
        });

        const clientName = exampleClient ? exampleClient.clientName : 'John Doe';
        const clientCode = exampleClient ? exampleClient.code : '1234';

        const html = generateMarketingEmailHtml({
            subject,
            message,
            clientName,
            clientCode,
            encryptedCode: encryptCode(clientCode)
        });

        console.log('✅ Preview generated');

        res.json({
            success: true,
            preview: {
                subject,
                html,
                exampleRecipient: exampleClient ? {
                    name: clientName,
                    email: exampleClient.clientEmail,
                    code: clientCode
                } : null
            }
        });

    } catch (error) {
        console.error('❌ Error generating preview:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating preview',
            error: error.message
        });
    }
});

// ===== SEND TEST EMAIL =====
router.post('/send-test-email', async (req, res) => {
    try {
        const { subject, message, testEmail } = req.body;
        const adminUser = req.user?.username || 'admin';

        if (!subject || !message || !testEmail) {
            return res.status(400).json({
                success: false,
                message: 'Subject, message, and test email are required'
            });
        }

        console.log(`🧪 Sending test email to ${testEmail} by ${adminUser}...`);

        // Buscar configuração de email
        const config = await EmailConfig.findActiveConfig();

        if (!config) {
            return res.status(500).json({
                success: false,
                message: 'Email service not configured. Please configure SMTP settings first.'
            });
        }

        // Criar transporter
        const transporter = nodemailer.createTransport({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.secure,
            auth: {
                user: config.smtp.auth.user,
                pass: config.smtp.auth.pass
            }
        });

        // Gerar HTML do email
        const html = generateMarketingEmailHtml({
            subject,
            message,
            clientName: 'Test Customer',
            clientCode: '1234',
            encryptedCode: encryptCode('1234')
        });

        // Enviar email com o NOVO domínio
        const mailOptions = {
            from: 'Sunshine Cowhides <sales@sunshinecowhides-gallery.com>',
            to: testEmail,
            subject: `[TEST] ${subject}`,
            html: html,
            headers: {
                'List-Unsubscribe': '<mailto:sales@sunshinecowhides.com?subject=Unsubscribe>',
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                'X-Mailer': 'Sunshine Cowhides Marketing System'
            }
        };

        const result = await transporter.sendMail(mailOptions);

        // Incrementar contador
        await config.incrementEmailCounter();

        console.log(`✅ Test email sent to ${testEmail}`);

        res.json({
            success: true,
            message: `Test email sent successfully to ${testEmail}`,
            messageId: result.messageId,
            sentBy: adminUser,
            sentAt: new Date()
        });

    } catch (error) {
        console.error('❌ Error sending test email:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending test email',
            error: error.message
        });
    }
});

// ===== SEND MASS EMAIL =====
router.post('/send-mass-email', async (req, res) => {
    try {
        const { subject, message, sendToAll } = req.body;
        const adminUser = req.user?.username || 'admin';

        if (!subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'Subject and message are required'
            });
        }

        if (!sendToAll) {
            return res.status(400).json({
                success: false,
                message: 'Confirmation required for mass email'
            });
        }

        console.log(`📧 Starting mass email campaign by ${adminUser}...`);

        // Pegar limite do request (50 ou todos)
        const limit = req.body.limit || null;

        // Data de 24 horas atrás
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        let query = AccessCode.find({
            isActive: true,
            clientEmail: { $exists: true, $ne: '', $ne: null, $regex: /@/ },
            marketingUnsubscribed: { $ne: true }, // ← NOVA LINHA: Excluir quem se desinscreveu
            // Pular quem recebeu email nas últimas 24h
            $or: [
                { lastMarketingEmailSent: { $exists: false } },
                { lastMarketingEmailSent: null },
                { lastMarketingEmailSent: { $lt: twentyFourHoursAgo } }
            ]
        }).select('clientName clientEmail code').sort({ clientName: 1 });
        // Aplicar limite se especificado
        if (limit && limit !== 'all') {
            query = query.limit(parseInt(limit));
        }

        const clients = await query;

        if (clients.length === 0) {
            return res.json({
                success: true,
                message: 'No clients with email found',
                stats: {
                    total: 0,
                    sent: 0,
                    failed: 0
                }
            });
        }

        console.log(`📬 Sending to ${clients.length} clients...`);

        // Buscar configuração e criar transporter
        const config = await EmailConfig.findActiveConfig();

        if (!config) {
            return res.status(500).json({
                success: false,
                message: 'Email service not configured'
            });
        }

        const transporter = nodemailer.createTransport({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.secure,
            auth: {
                user: config.smtp.auth.user,
                pass: config.smtp.auth.pass
            }
        });

        // Enviar em batches
        const BATCH_SIZE = 5;
        const DELAY_MS = 2000;

        let sent = 0;
        let failed = 0;
        const failedEmails = [];

        for (let i = 0; i < clients.length; i += BATCH_SIZE) {
            const batch = clients.slice(i, i + BATCH_SIZE);

            const promises = batch.map(async (client) => {
                try {
                    const html = generateMarketingEmailHtml({
                        subject,
                        message,
                        clientName: client.clientName,
                        clientCode: client.code,
                        encryptedCode: encryptCode(client.code)
                    });

                    const mailOptions = {
                        from: 'Sunshine Cowhides <sales@sunshinecowhides-gallery.com>',
                        to: `${client.clientName} <${client.clientEmail}>`,
                        subject: subject,
                        html: html,
                        headers: {
                            'List-Unsubscribe': '<mailto:sales@sunshinecowhides.com?subject=Unsubscribe>',
                            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                            'X-Mailer': 'Sunshine Cowhides Marketing System'
                        }
                    };

                    await transporter.sendMail(mailOptions);

                    sent++;
                    console.log(`✅ Email sent to ${client.clientEmail} (${client.clientName})`);

                    // Registrar que cliente recebeu email de marketing
                    await AccessCode.findOneAndUpdate(
                        { code: client.code },
                        { lastMarketingEmailSent: new Date() }
                    );

                } catch (error) {
                    failed++;
                    failedEmails.push({
                        email: client.clientEmail,
                        name: client.clientName,
                        error: error.message
                    });
                    console.error(`❌ Error sending to ${client.clientEmail}:`, error);
                }
            });

            await Promise.all(promises);

            if (i + BATCH_SIZE < clients.length) {
                console.log(`⏳ Waiting ${DELAY_MS}ms before next batch...`);
                await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
        }

        // Atualizar contador total
        config.stats.totalEmailsSent += sent;
        config.stats.lastEmailSent = new Date();
        await config.save();

        console.log(`✅ Mass email campaign completed: ${sent} sent, ${failed} failed`);

        res.json({
            success: true,
            message: `Email campaign sent to ${sent} of ${clients.length} clients`,
            stats: {
                total: clients.length,
                sent: sent,
                failed: failed,
                failedEmails: failedEmails.length > 0 ? failedEmails : undefined
            },
            sentBy: adminUser,
            sentAt: new Date()
        });

    } catch (error) {
        console.error('❌ Error in mass email campaign:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending mass email',
            error: error.message
        });
    }
});

// ===== EMAIL TEMPLATE =====
function generateMarketingEmailHtml({ subject, message, clientName, clientCode, encryptedCode }) {
    const formattedMessage = message.replace(/\n/g, '<br>');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="format-detection" content="telephone=no">
    <meta name="x-apple-disable-message-reformatting">
    <title>${subject}</title>
    <style>
        body {
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }
        .email-wrapper {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .email-header {
            background: linear-gradient(135deg, #D4AF37 0%, #C5A028 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        .email-header h1 {
            margin: 0 0 10px 0;
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 1px;
        }
        .email-header p {
            margin: 0;
            font-size: 16px;
            opacity: 0.95;
        }
        .email-body {
            padding: 40px 30px;
            background-color: #ffffff;
        }
        .welcome-section {
            background: linear-gradient(to right, #f8f9fa, #ffffff);
            border-left: 4px solid #D4AF37;
            padding: 20px;
            margin-bottom: 30px;
            border-radius: 8px;
        }
        .welcome-section h2 {
            margin: 0 0 5px 0;
            font-size: 24px;
            color: #2c3e50;
        }
        .access-code {
            display: inline-block;
            background: #D4AF37;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: bold;
            font-size: 18px;
            letter-spacing: 2px;
            margin-top: 5px;
        }
        .message-box {
            background: #ffffff;
            padding: 25px;
            margin: 25px 0;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            font-size: 16px;
            line-height: 1.8;
            color: #495057;
        }
        .highlight-box {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 20px;
            margin: 25px 0;
            border-radius: 6px;
        }
        .highlight-box strong {
            color: #856404;
            font-size: 17px;
        }
        .cta-section {
            text-align: center;
            margin: 40px 0;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #D4AF37 0%, #C5A028 100%);
            color: white !important;
            padding: 18px 45px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            font-size: 18px;
            box-shadow: 0 4px 10px rgba(212, 175, 55, 0.3);
        }
        .email-footer {
            background: #2c3e50;
            color: white;
            padding: 30px;
            text-align: center;
        }
        .email-footer p {
            margin: 8px 0;
            font-size: 14px;
            line-height: 1.6;
        }
        .footer-logo {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 15px;
            color: #D4AF37;
        }
        .unsubscribe-section {
            margin-top: 25px;
            padding-top: 20px;
            border-top: 1px solid rgba(255,255,255,0.2);
            font-size: 12px;
            opacity: 0.8;
        }
        .unsubscribe-link {
            color: #D4AF37;
            text-decoration: underline;
        }
        .social-links {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid rgba(255,255,255,0.2);
        }
        .social-links a {
            color: #D4AF37;
            text-decoration: none;
            margin: 0 12px;
            font-size: 14px;
        }
        .divider {
            height: 2px;
            background: linear-gradient(to right, transparent, #D4AF37, transparent);
            margin: 30px 0;
        }
        @media only screen and (max-width: 600px) {
            .email-wrapper {
                margin: 0;
                border-radius: 0;
            }
            .email-header, .email-body, .email-footer {
                padding: 30px 20px;
            }
            .email-header h1 {
                font-size: 26px;
            }
            .cta-button {
                padding: 15px 35px;
                font-size: 16px;
            }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-header">
            <h1>${subject.toUpperCase()}</h1>
        </div>
        
        <div class="email-body">
            <div class="welcome-section">
                <h2>Welcome back, ${clientName}!</h2>
                <p style="margin: 5px 0; color: #6c757d;">Your Access Code: <span class="access-code">#${clientCode}</span></p>
            </div>
            
            <div class="message-box">
                ${formattedMessage}
            </div>
            
            <div class="divider"></div>
            
            <div class="cta-section">
                <a href="https://sunshinecowhides-gallery.com/track/click/${encryptedCode}" class="cta-button" target="_blank">
                    Browse New Collection
                </a>
            </div>
        </div>
        
        <div class="email-footer">
            <div class="footer-logo">SUNSHINE COWHIDES</div>
            <p><strong>Premium Cowhides Gallery</strong></p>
            <p>Quality Products for Discerning Businesses</p>
            
            <div class="social-links">
                <a href="https://sunshinecowhides-gallery.com/" target="_blank">Visit Website</a>
                <span style="color: rgba(255,255,255,0.3);">|</span>
                <a href="mailto:sales@sunshinecowhides.com">Contact Us</a>
            </div>
            
            <div class="unsubscribe-section">
                <p>
                    This email was sent to you because you are a valued Sunshine Cowhides customer.<br>
                    If you wish to unsubscribe from marketing emails, please 
                    <a href="https://sunshinecowhides-gallery.com/unsubscribe?code=${encryptedCode}" class="unsubscribe-link">
                        click here to unsubscribe
                    </a>.
                </p>
                <p style="margin-top: 10px; font-size: 11px;">
                    Sunshine Cowhides Gallery<br>
                    Premium Quality Cowhides<br>
                    Email: sales@sunshinecowhides.com
                </p>
            </div>
        </div>
    </div>
    <!-- Tracking Pixel -->
        <img src="https://sunshinecowhides-gallery.com/track/open/${encryptedCode}" width="1" height="1" style="display:none;" alt="">
    </body>
</html>
    `;
}

module.exports = router;