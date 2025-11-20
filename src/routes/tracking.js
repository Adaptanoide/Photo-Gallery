// ===== TRACKING & UNSUBSCRIBE ROUTES =====
// Rotas públicas para tracking de emails e unsubscribe

const express = require('express');
const router = express.Router();
const AccessCode = require('../models/AccessCode');
const crypto = require('crypto');

// ===== ENCRYPTION/DECRYPTION =====
const ENCRYPTION_KEY = process.env.TRACKING_SECRET || 'sunshine-tracking-secret-key-2025';

function encryptCode(code) {
    const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
    let encrypted = cipher.update(code, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decryptCode(encrypted) {
    try {
        const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('❌ Error decrypting code:', error);
        return null;
    }
}

// ===== TRACK EMAIL OPEN =====
router.get('/track/open/:encryptedCode', async (req, res) => {
    try {
        const code = decryptCode(req.params.encryptedCode);
        
        if (!code) {
            // Return 1x1 transparent pixel anyway (don't reveal error)
            return res.status(200).type('image/png').send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
        }

        console.log(`📧 Email opened by client: ${code}`);

        // Update tracking
        await AccessCode.findOneAndUpdate(
            { code: code },
            {
                marketingEmailOpened: true,
                marketingEmailOpenedAt: new Date(),
                $inc: { marketingEmailOpenCount: 1 }
            }
        );

        // Return 1x1 transparent pixel
        res.status(200).type('image/png').send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));

    } catch (error) {
        console.error('❌ Error tracking open:', error);
        res.status(200).type('image/png').send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
    }
});

// ===== TRACK EMAIL CLICK =====
router.get('/track/click/:encryptedCode', async (req, res) => {
    try {
        const code = decryptCode(req.params.encryptedCode);
        
        if (!code) {
            return res.redirect('https://sunshinecowhides-gallery.com/');
        }

        console.log(`🖱️ Email clicked by client: ${code}`);

        // Update tracking
        await AccessCode.findOneAndUpdate(
            { code: code },
            {
                marketingEmailClicked: true,
                marketingEmailClickedAt: new Date(),
                $inc: { marketingEmailClickCount: 1 }
            }
        );

        // Redirect to gallery
        res.redirect('https://sunshinecowhides-gallery.com/');

    } catch (error) {
        console.error('❌ Error tracking click:', error);
        res.redirect('https://sunshinecowhides-gallery.com/');
    }
});

// ===== UNSUBSCRIBE PAGE =====
router.get('/unsubscribe', async (req, res) => {
    try {
        const encryptedCode = req.query.code;
        
        if (!encryptedCode) {
            return res.status(400).send(getUnsubscribeHTML('error', 'Invalid unsubscribe link'));
        }

        const code = decryptCode(encryptedCode);
        
        if (!code) {
            return res.status(400).send(getUnsubscribeHTML('error', 'Invalid or expired unsubscribe link'));
        }

        // Find client
        const client = await AccessCode.findOne({ code: code });

        if (!client) {
            return res.status(404).send(getUnsubscribeHTML('error', 'Client not found'));
        }

        // Check if already unsubscribed
        if (client.marketingUnsubscribed) {
            return res.send(getUnsubscribeHTML('already', client.clientName));
        }

        // Show confirmation page
        res.send(getUnsubscribeHTML('confirm', client.clientName, encryptedCode));

    } catch (error) {
        console.error('❌ Error in unsubscribe:', error);
        res.status(500).send(getUnsubscribeHTML('error', 'An error occurred'));
    }
});

// ===== UNSUBSCRIBE CONFIRM (POST) =====
router.post('/unsubscribe/confirm', express.json(), async (req, res) => {
    try {
        const { code: encryptedCode } = req.body;
        
        if (!encryptedCode) {
            return res.status(400).json({ success: false, message: 'Invalid request' });
        }

        const code = decryptCode(encryptedCode);
        
        if (!code) {
            return res.status(400).json({ success: false, message: 'Invalid code' });
        }

        console.log(`🚫 Client unsubscribed: ${code}`);

        // Update client
        const client = await AccessCode.findOneAndUpdate(
            { code: code },
            {
                marketingUnsubscribed: true,
                marketingUnsubscribedAt: new Date()
            },
            { new: true }
        );

        if (!client) {
            return res.status(404).json({ success: false, message: 'Client not found' });
        }

        res.json({ 
            success: true, 
            message: 'Successfully unsubscribed',
            clientName: client.clientName
        });

    } catch (error) {
        console.error('❌ Error confirming unsubscribe:', error);
        res.status(500).json({ success: false, message: 'An error occurred' });
    }
});

// ===== HTML TEMPLATES =====
function getUnsubscribeHTML(type, clientName, encryptedCode) {
    const baseStyle = `
        body { 
            font-family: Arial, sans-serif; 
            background: #f4f4f4; 
            margin: 0; 
            padding: 40px 20px; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            min-height: 100vh;
        }
        .container { 
            background: white; 
            max-width: 500px; 
            padding: 40px; 
            border-radius: 12px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.1); 
            text-align: center;
        }
        .logo { 
            font-size: 32px; 
            font-weight: bold; 
            color: #D4AF37; 
            margin-bottom: 20px;
        }
        h1 { 
            color: #2c3e50; 
            font-size: 24px; 
            margin-bottom: 20px;
        }
        p { 
            color: #666; 
            line-height: 1.6; 
            margin-bottom: 20px;
        }
        .btn { 
            display: inline-block; 
            background: #D4AF37; 
            color: white; 
            padding: 14px 32px; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: bold; 
            border: none;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
        }
        .btn:hover { 
            background: #C5A028; 
        }
        .btn-secondary {
            background: #6c757d;
        }
        .btn-secondary:hover {
            background: #5a6268;
        }
        .icon { 
            font-size: 64px; 
            margin-bottom: 20px;
        }
        .success { color: #28a745; }
        .error { color: #dc3545; }
        .warning { color: #ffc107; }
    `;

    if (type === 'confirm') {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Unsubscribe - Sunshine Cowhides</title>
                <style>${baseStyle}</style>
            </head>
            <body>
                <div class="container">
                    <div class="logo">🐄 SUNSHINE COWHIDES</div>
                    <div class="icon warning">⚠️</div>
                    <h1>Unsubscribe from Marketing Emails</h1>
                    <p>Hi <strong>${clientName}</strong>,</p>
                    <p>Are you sure you want to unsubscribe from Sunshine Cowhides marketing emails?</p>
                    <p style="color: #999; font-size: 14px;">
                        You will no longer receive updates about new products, special offers, and exclusive collections.
                    </p>
                    <button class="btn" onclick="confirmUnsubscribe()">Yes, Unsubscribe Me</button>
                    <a href="https://sunshinecowhides-gallery.com/" class="btn btn-secondary">Cancel</a>
                    <div id="message" style="margin-top: 20px; display: none;"></div>
                </div>
                <script>
                    async function confirmUnsubscribe() {
                        const btn = event.target;
                        btn.disabled = true;
                        btn.textContent = 'Processing...';
                        
                        try {
                            const response = await fetch('/unsubscribe/confirm', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ code: '${encryptedCode}' })
                            });
                            
                            const data = await response.json();
                            
                            if (data.success) {
                                document.querySelector('.container').innerHTML = \`
                                    <div class="logo">🐄 SUNSHINE COWHIDES</div>
                                    <div class="icon success">✅</div>
                                    <h1>Successfully Unsubscribed</h1>
                                    <p>Hi <strong>\${data.clientName}</strong>,</p>
                                    <p>You have been successfully removed from our marketing email list.</p>
                                    <p style="color: #999; font-size: 14px;">
                                        You will no longer receive marketing emails from Sunshine Cowhides.
                                    </p>
                                    <a href="https://sunshinecowhides-gallery.com/" class="btn">Return to Gallery</a>
                                \`;
                            } else {
                                throw new Error(data.message);
                            }
                        } catch (error) {
                            document.getElementById('message').style.display = 'block';
                            document.getElementById('message').style.color = '#dc3545';
                            document.getElementById('message').innerHTML = '<strong>Error:</strong> ' + error.message;
                            btn.disabled = false;
                            btn.textContent = 'Yes, Unsubscribe Me';
                        }
                    }
                </script>
            </body>
            </html>
        `;
    }

    if (type === 'already') {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Already Unsubscribed - Sunshine Cowhides</title>
                <style>${baseStyle}</style>
            </head>
            <body>
                <div class="container">
                    <div class="logo">🐄 SUNSHINE COWHIDES</div>
                    <div class="icon">ℹ️</div>
                    <h1>Already Unsubscribed</h1>
                    <p>Hi <strong>${clientName}</strong>,</p>
                    <p>You are already unsubscribed from our marketing emails.</p>
                    <a href="https://sunshinecowhides-gallery.com/" class="btn">Return to Gallery</a>
                </div>
            </body>
            </html>
        `;
    }

    if (type === 'error') {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Error - Sunshine Cowhides</title>
                <style>${baseStyle}</style>
            </head>
            <body>
                <div class="container">
                    <div class="logo">🐄 SUNSHINE COWHIDES</div>
                    <div class="icon error">❌</div>
                    <h1>Error</h1>
                    <p>${clientName}</p>
                    <a href="https://sunshinecowhides-gallery.com/" class="btn">Return to Gallery</a>
                </div>
            </body>
            </html>
        `;
    }
}

// Export encryption functions for use in email template
router.encryptCode = encryptCode;

module.exports = router;
