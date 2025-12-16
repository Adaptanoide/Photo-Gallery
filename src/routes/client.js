// src/routes/client.js

const express = require('express');
const UnifiedProductComplete = require('../models/UnifiedProductComplete');
const AccessCode = require('../models/AccessCode');
const Cart = require('../models/Cart');

const router = express.Router();

// ===== CLIENT PROFILE ENDPOINTS =====

/**
 * GET /api/client/profile
 * Get client profile data
 */
router.get('/profile', async (req, res) => {
    try {
        const { code } = req.query;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Access code is required'
            });
        }

        const client = await AccessCode.findOne({ code, isActive: true });

        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Client not found'
            });
        }

        res.json({
            success: true,
            profile: {
                clientName: client.clientName || '',
                clientEmail: client.clientEmail || '',
                clientPhone: client.clientPhone || '',
                companyName: client.companyName || '',
                addressLine1: client.addressLine1 || '',
                addressLine2: client.addressLine2 || '',
                city: client.city || '',
                state: client.state || '',
                zipCode: client.zipCode || ''
            }
        });

    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching profile'
        });
    }
});

/**
 * PUT /api/client/profile
 * Update client profile data
 */
router.put('/profile', async (req, res) => {
    try {
        const {
            code,
            clientName,
            clientEmail,
            clientPhone,
            companyName,
            addressLine1,
            addressLine2,
            city,
            state,
            zipCode
        } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Access code is required'
            });
        }

        if (!clientName || clientName.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Name must be at least 2 characters'
            });
        }

        if (!clientEmail) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(clientEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        const client = await AccessCode.findOne({ code, isActive: true });

        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Client not found'
            });
        }

        // Update fields
        client.clientName = clientName.trim();
        client.clientEmail = clientEmail.trim().toLowerCase();
        client.clientPhone = clientPhone?.trim() || '';
        client.companyName = companyName?.trim() || '';
        client.addressLine1 = addressLine1?.trim() || '';
        client.addressLine2 = addressLine2?.trim() || '';
        client.city = city?.trim() || '';
        client.state = state?.trim() || '';
        client.zipCode = zipCode?.trim() || '';

        await client.save();

        console.log(`✅ Profile updated for client ${code}: ${clientName}`);

        res.json({
            success: true,
            message: 'Profile updated successfully',
            profile: {
                clientName: client.clientName,
                clientEmail: client.clientEmail,
                clientPhone: client.clientPhone,
                companyName: client.companyName,
                addressLine1: client.addressLine1,
                addressLine2: client.addressLine2,
                city: client.city,
                state: client.state,
                zipCode: client.zipCode
            }
        });

    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating profile'
        });
    }
});

/**
 * POST /api/client/change-code
 * Change client access code
 */
router.post('/change-code', async (req, res) => {
    try {
        const { currentCode, newCode } = req.body;

        if (!currentCode || !newCode) {
            return res.status(400).json({
                success: false,
                message: 'Current and new codes are required'
            });
        }

        // Validate code format
        if (!/^\d{4}$/.test(currentCode) || !/^\d{4}$/.test(newCode)) {
            return res.status(400).json({
                success: false,
                message: 'Codes must be 4-digit numbers'
            });
        }

        if (currentCode === newCode) {
            return res.status(400).json({
                success: false,
                message: 'New code must be different from current code'
            });
        }

        // Find client by current code
        const client = await AccessCode.findOne({ code: currentCode, isActive: true });

        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Client not found with this code'
            });
        }

        // Check if new code already exists
        const existingCode = await AccessCode.findOne({ code: newCode });
        if (existingCode) {
            return res.status(400).json({
                success: false,
                message: 'This code is already in use. Please choose another.'
            });
        }

        // Update the code
        const oldCode = client.code;
        client.code = newCode;
        await client.save();

        console.log(`🔑 Access code changed for ${client.clientName}: ${oldCode} → ${newCode}`);

        // 🆕 MIGRAR CARRINHO: Se o cliente tinha carrinho ativo, atualizar o clientCode
        let cartMigrated = false;
        try {
            const existingCart = await Cart.findOne({ clientCode: oldCode, isActive: true });
            if (existingCart) {
                existingCart.clientCode = newCode;
                await existingCart.save();
                cartMigrated = true;
                console.log(`🛒 Carrinho migrado: ${oldCode} → ${newCode} (${existingCart.totalItems} itens)`);
            }
        } catch (cartError) {
            // Não falhar a operação principal se migração do carrinho falhar
            console.error(`⚠️ Erro ao migrar carrinho (não crítico):`, cartError.message);
        }

        res.json({
            success: true,
            message: 'Access code changed successfully',
            newCode: newCode,
            cartMigrated: cartMigrated  // 🆕 Informar frontend se houve migração
        });

    } catch (error) {
        console.error('Error changing access code:', error);
        res.status(500).json({
            success: false,
            message: 'Error changing access code'
        });
    }
});

// ===== PRODUCT ENDPOINTS =====

// Listar produtos disponíveis por categoria (temporário)
router.get('/products/:category', async (req, res) => {
    try {
        const { category } = req.params;

        const products = await UnifiedProductComplete.find({
            category: { $regex: category, $options: 'i' },
            status: 'available'
        }).limit(20);

        res.json({
            success: true,
            products,
            category
        });

    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar produtos'
        });
    }
});

module.exports = router;
