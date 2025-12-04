// src/routes/registration.js

const express = require('express');
const ClientRegistration = require('../models/ClientRegistration');
const AccessCode = require('../models/AccessCode');
const { authenticateToken } = require('./auth');
const EmailService = require('../services/EmailService');

const router = express.Router();

/**
 * POST /api/register
 * Submeter novo cadastro (ROTA PÚBLICA)
 */
router.post('/', async (req, res) => {
    try {
        const {
            contactName,
            email,
            phone,
            companyName,
            businessType,
            businessTypeOther,
            city,
            state,
            country,
            interestMessage,
            howDidYouHear,
            referredBy
        } = req.body;

        // Validações básicas
        if (!contactName || !email || !phone || !companyName || !city || !state || !interestMessage) {
            return res.status(400).json({
                success: false,
                message: 'Please fill in all required fields'
            });
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address'
            });
        }

        // Verificar se email já existe em cadastros pendentes/aprovados
        const emailExists = await ClientRegistration.emailExists(email);
        if (emailExists) {
            return res.status(400).json({
                success: false,
                message: 'This email has already been registered. Please contact us if you need assistance.'
            });
        }

        // Verificar se email já existe como cliente ativo
        const existingClient = await AccessCode.findOne({
            clientEmail: email.toLowerCase(),
            isActive: true
        });
        if (existingClient) {
            return res.status(400).json({
                success: false,
                message: 'This email is already registered as a client.'
            });
        }

        // Criar novo registro
        const registration = new ClientRegistration({
            contactName: contactName.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            companyName: companyName.trim(),
            businessType: businessType || 'retailer',
            businessTypeOther: businessTypeOther?.trim() || '',
            city: city.trim(),
            state: state.trim(),
            country: country || 'United States',
            interestMessage: interestMessage.trim(),
            howDidYouHear: howDidYouHear || '',
            referredBy: referredBy?.trim() || '',
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || ''
        });

        await registration.save();

        console.log(`📝 [REGISTRATION] New: ${companyName} - ${contactName} (${email})`);

        // Enviar notificação para admin
        try {
            const emailService = EmailService.getInstance();
            await emailService.notifyNewRegistration({
                contactName: registration.contactName,
                companyName: registration.companyName,
                email: registration.email,
                phone: registration.phone,
                city: registration.city,
                state: registration.state,
                country: registration.country,
                businessType: registration.businessType,
                interestMessage: registration.interestMessage,
                submittedAt: registration.submittedAt
            });
            console.log(`📧 [REGISTRATION] Notification sent to admin`);
        } catch (emailError) {
            console.error('⚠️ [REGISTRATION] Failed to send notification:', emailError);
            // Não falha a requisição se email não for enviado
        }

        res.status(201).json({
            success: true,
            message: 'Registration submitted successfully! We will review your request and contact you soon.'
        });

    } catch (error) {
        console.error('❌ [REGISTRATION] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting registration. Please try again.'
        });
    }
});

// ============================================================
// ROTAS ADMIN (com autenticação)
// ============================================================

/**
 * GET /api/register/admin/count
 * Contar cadastros pendentes (para badge)
 */
router.get('/admin/count', authenticateToken, async (req, res) => {
    try {
        const count = await ClientRegistration.countPending();
        res.json({ success: true, count });
    } catch (error) {
        console.error('❌ [REGISTRATION] Error counting:', error);
        res.status(500).json({ success: false, count: 0 });
    }
});

/**
 * GET /api/register/admin/list
 * Listar cadastros pendentes
 */
router.get('/admin/list', authenticateToken, async (req, res) => {
    try {
        const { status = 'pending' } = req.query;

        let registrations;
        if (status === 'all') {
            registrations = await ClientRegistration.find().sort({ submittedAt: -1 });
        } else {
            registrations = await ClientRegistration.find({ status }).sort({ submittedAt: -1 });
        }

        res.json({
            success: true,
            registrations,
            count: registrations.length
        });

    } catch (error) {
        console.error('❌ [REGISTRATION] Error listing:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching registrations'
        });
    }
});

/**
 * GET /api/register/admin/:id
 * Detalhes de um cadastro
 */
router.get('/admin/:id', authenticateToken, async (req, res) => {
    try {
        const registration = await ClientRegistration.findById(req.params.id);

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        res.json({
            success: true,
            registration
        });

    } catch (error) {
        console.error('❌ [REGISTRATION] Error fetching:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching registration'
        });
    }
});

/**
 * PUT /api/register/admin/:id/reject
 * Rejeitar cadastro
 */
router.put('/admin/:id/reject', authenticateToken, async (req, res) => {
    try {
        const { reason = '' } = req.body;

        const registration = await ClientRegistration.findById(req.params.id);

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        if (registration.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Registration already ${registration.status}`
            });
        }

        registration.reject(req.user.username || 'admin', reason);
        await registration.save();

        console.log(`❌ [REGISTRATION] Rejected: ${registration.companyName}`);

        res.json({
            success: true,
            message: 'Registration rejected'
        });

    } catch (error) {
        console.error('❌ [REGISTRATION] Error rejecting:', error);
        res.status(500).json({
            success: false,
            message: 'Error rejecting registration'
        });
    }
});

/**
 * PUT /api/register/admin/:id/approve
 * Aprovar cadastro e criar cliente
 */
router.put('/admin/:id/approve', authenticateToken, async (req, res) => {
    try {
        const { salesRep } = req.body;

        if (!salesRep) {
            return res.status(400).json({
                success: false,
                message: 'Sales Rep is required'
            });
        }

        const registration = await ClientRegistration.findById(req.params.id);

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        if (registration.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Registration already ${registration.status}`
            });
        }

        // Gerar código único de 4 dígitos
        let code;
        let attempts = 0;
        const maxAttempts = 100;

        while (attempts < maxAttempts) {
            code = Math.floor(1000 + Math.random() * 9000).toString();
            const existing = await AccessCode.findOne({ code });
            if (!existing) break;
            attempts++;
        }

        if (attempts >= maxAttempts) {
            return res.status(500).json({
                success: false,
                message: 'Could not generate unique code'
            });
        }

        // Criar AccessCode (cliente)
        const accessCode = new AccessCode({
            code,
            clientName: registration.contactName,
            companyName: registration.companyName,
            clientEmail: registration.email,
            clientPhone: registration.phone,
            city: registration.city,
            state: registration.state,
            country: registration.country,
            salesRep: salesRep,
            isActive: true,
            showPrices: true,
            allowedCategories: [],
            usageCount: 0
        });

        await accessCode.save();

        // Atualizar registro como aprovado
        registration.approve(req.user?.username || 'admin', code);
        await registration.save();

        console.log(`✅ [REGISTRATION] Approved: ${registration.companyName} - Code: ${code}`);

        // Enviar email de boas-vindas para o cliente
        try {
            const emailService = EmailService.getInstance();
            await emailService.sendWelcomeEmail({
                to: registration.email,
                clientName: registration.contactName,
                companyName: registration.companyName,
                accessCode: code,
                salesRep: salesRep,
                customMessage: req.body.customMessage || ''
            });
            console.log(`📧 [REGISTRATION] Welcome email sent to ${registration.email}`);
        } catch (emailError) {
            console.error('⚠️ [REGISTRATION] Failed to send welcome email:', emailError);
            // Não falha a requisição se email não for enviado
        }

        res.json({
            success: true,
            message: 'Registration approved',
            accessCode: {
                code: accessCode.code,
                clientName: accessCode.clientName,
                companyName: accessCode.companyName,
                _id: accessCode._id
            }
        });

    } catch (error) {
        console.error('❌ [REGISTRATION] Error approving:', error);
        res.status(500).json({
            success: false,
            message: 'Error approving registration'
        });
    }
});

module.exports = router;