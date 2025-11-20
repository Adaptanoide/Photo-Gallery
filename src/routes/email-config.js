// src/routes/email-config.js

const express = require('express');
const EmailConfig = require('../models/EmailConfig');
const EmailService = require('../services/EmailService');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Todas as rotas precisam de autenticação admin
router.use(authenticateToken);

// ===== CONFIGURAÇÃO BÁSICA =====

/**
 * GET /api/email-config
 * Buscar configuração ativa de email
 */
router.get('/', async (req, res) => {
    try {
        console.log('📧 Buscando configuração de email...');

        const config = await EmailConfig.findActiveConfig();

        if (!config) {
            return res.json({
                success: true,
                config: null,
                message: 'Nenhuma configuração encontrada'
            });
        }

        res.json({
            success: true,
            config: config.getSummary()
        });

    } catch (error) {
        console.error('❌ Erro ao buscar configuração:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar configuração de email',
            error: error.message
        });
    }
});

/**
 * POST /api/email-config
 * Criar ou atualizar configuração de email
 */
router.post('/', async (req, res) => {
    try {
        const {
            smtp,
            sender,
            notifications,
            testMode
        } = req.body;

        console.log('📧 Salvando configuração de email...');

        // Validações básicas
        if (!smtp || !smtp.host || !smtp.port || !smtp.auth?.user || !smtp.auth?.pass) {
            return res.status(400).json({
                success: false,
                message: 'Configurações SMTP obrigatórias estão faltando'
            });
        }

        if (!sender || !sender.name || !sender.email) {
            return res.status(400).json({
                success: false,
                message: 'Informações do remetente são obrigatórias'
            });
        }

        // Buscar configuração existente ou criar nova
        let config = await EmailConfig.findActiveConfig();

        if (config) {
            // Atualizar configuração existente
            config.smtp = smtp;
            config.sender = sender;
            config.notifications = notifications || config.notifications;
            config.testMode = {
                enabled: testMode ? true : false,
                testEmail: ''
            };
            config.lastModifiedBy = req.user?.username || 'admin';
        } else {
            // Criar nova configuração
            config = new EmailConfig({
                smtp,
                sender,
                notifications: notifications || {
                    newSelection: {
                        enabled: true,
                        recipients: []
                    },
                    selectionConfirmed: {
                        enabled: true,
                        recipients: []
                    },
                    selectionCancelled: {
                        enabled: false,
                        recipients: []
                    }
                },
                testMode: testMode || {
                    enabled: false,
                    testEmail: ''
                },
                createdBy: req.user?.username || 'admin'
            });
        }

        await config.save();

        console.log(`✅ Configuração de email salva por ${req.user.username}`);

        res.json({
            success: true,
            message: 'Configuração salva com sucesso',
            config: config.getSummary()
        });

    } catch (error) {
        console.error('❌ Erro ao salvar configuração:', error);

        let statusCode = 500;
        let message = 'Erro ao salvar configuração';

        if (error.name === 'ValidationError') {
            statusCode = 400;
            message = 'Dados inválidos';
        }

        res.status(statusCode).json({
            success: false,
            message,
            error: error.message
        });
    }
});

// ===== TESTE DE CONFIGURAÇÃO =====

/**
 * POST /api/email-config/test
 * Testar configuração de email
 */
router.post('/test', async (req, res) => {
    try {
        const { testEmail } = req.body;

        if (!testEmail) {
            return res.status(400).json({
                success: false,
                message: 'Email de teste é obrigatório'
            });
        }

        console.log(`📧 Testando configuração para: ${testEmail}`);

        const emailService = EmailService.getInstance();
        const result = await emailService.testConfiguration(testEmail);

        if (result.success) {
            console.log(`✅ Teste de email bem-sucedido para ${testEmail}`);
        } else {
            console.warn(`⚠️ Falha no teste de email:`, result.error);
        }

        res.json(result);

    } catch (error) {
        console.error('❌ Erro no teste de email:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao testar configuração',
            error: error.message
        });
    }
});

/**
 * POST /api/email-config/test-connection
 * Testar apenas conexão SMTP (sem enviar email)
 */
router.post('/test-connection', async (req, res) => {
    try {
        console.log('📧 Testando conexão SMTP...');

        const config = await EmailConfig.findActiveConfig();

        if (!config) {
            return res.status(404).json({
                success: false,
                message: 'Nenhuma configuração encontrada'
            });
        }

        const result = await config.testConnection();

        res.json(result);

    } catch (error) {
        console.error('❌ Erro ao testar conexão:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao testar conexão',
            error: error.message
        });
    }
});

// ===== GESTÃO DE DESTINATÁRIOS =====

/**
 * POST /api/email-config/recipients/:type
 * Adicionar destinatário para tipo de notificação
 */
router.post('/recipients/:type', async (req, res) => {
    try {
        const { type } = req.params; // newSelection, selectionConfirmed, selectionCancelled
        const { name, email } = req.body;

        if (!['newSelection', 'selectionConfirmed', 'selectionCancelled'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo de notificação inválido'
            });
        }

        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: 'Nome e email são obrigatórios'
            });
        }

        const config = await EmailConfig.findActiveConfig();

        if (!config) {
            return res.status(404).json({
                success: false,
                message: 'Configuração não encontrada'
            });
        }

        // Verificar se email já existe
        const existingRecipient = config.notifications[type].recipients.find(r => r.email === email);

        if (existingRecipient) {
            return res.status(409).json({
                success: false,
                message: 'Este email já está cadastrado para este tipo de notificação'
            });
        }

        // Adicionar destinatário
        config.notifications[type].recipients.push({
            name: name.trim(),
            email: email.toLowerCase().trim()
        });

        config.lastModifiedBy = req.user.username;
        await config.save();

        console.log(`✅ Destinatário ${email} adicionado para ${type}`);

        res.json({
            success: true,
            message: 'Destinatário adicionado com sucesso',
            config: config.getSummary()
        });

    } catch (error) {
        console.error('❌ Erro ao adicionar destinatário:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao adicionar destinatário',
            error: error.message
        });
    }
});

/**
 * DELETE /api/email-config/recipients/:type/:email
 * Remover destinatário
 */
router.delete('/recipients/:type/:email', async (req, res) => {
    try {
        const { type, email } = req.params;

        const config = await EmailConfig.findActiveConfig();

        if (!config) {
            return res.status(404).json({
                success: false,
                message: 'Configuração não encontrada'
            });
        }

        // Remover destinatário
        const originalLength = config.notifications[type].recipients.length;
        config.notifications[type].recipients = config.notifications[type].recipients.filter(
            r => r.email !== email
        );

        if (config.notifications[type].recipients.length === originalLength) {
            return res.status(404).json({
                success: false,
                message: 'Destinatário não encontrado'
            });
        }

        config.lastModifiedBy = req.user.username;
        await config.save();

        console.log(`✅ Destinatário ${email} removido de ${type}`);

        res.json({
            success: true,
            message: 'Destinatário removido com sucesso',
            config: config.getSummary()
        });

    } catch (error) {
        console.error('❌ Erro ao remover destinatário:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao remover destinatário',
            error: error.message
        });
    }
});

// ===== ESTATÍSTICAS =====

/**
 * GET /api/email-config/stats
 * Buscar estatísticas de email
 */
router.get('/stats', async (req, res) => {
    try {
        const config = await EmailConfig.findActiveConfig();

        if (!config) {
            return res.json({
                success: true,
                stats: {
                    totalEmailsSent: 0,
                    lastEmailSent: null,
                    lastTestAt: null,
                    isConfigured: false
                }
            });
        }

        res.json({
            success: true,
            stats: {
                ...config.stats,
                isConfigured: true,
                configuredAt: config.createdAt,
                lastModified: config.updatedAt
            }
        });

    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar estatísticas',
            error: error.message
        });
    }
});

// ===== UTILITÁRIOS =====

/**
 * POST /api/email-config/reset
 * Resetar configurações para padrão
 */
router.post('/reset', async (req, res) => {
    try {
        console.log(`📧 Resetando configurações por ${req.user.username}...`);

        // Desativar configuração atual
        await EmailConfig.updateMany(
            { isActive: true },
            { $set: { isActive: false } }
        );

        // Criar configuração padrão
        const defaultConfig = EmailConfig.createDefaultConfig(req.user.username);
        await defaultConfig.save();

        console.log('✅ Configurações resetadas para padrão');

        res.json({
            success: true,
            message: 'Configurações resetadas com sucesso',
            config: defaultConfig.getSummary()
        });

    } catch (error) {
        console.error('❌ Erro ao resetar configurações:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao resetar configurações',
            error: error.message
        });
    }
});

module.exports = router;