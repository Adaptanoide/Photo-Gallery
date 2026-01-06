// src/routes/systemHealth.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const SlackChatService = require('../services/SlackChatService');
const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
const mysql = require('mysql2/promise');
const { authenticateToken } = require('./auth');

/**
 * Helper: Promise com timeout
 */
function timeoutPromise(ms, serviceName) {
    return new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(`${serviceName} timeout after ${ms}ms`));
        }, ms);
    });
}

/**
 * GET /api/system/health
 * Retorna status de todos os serviços do sistema
 * Requer autenticação de admin
 */
router.get('/health', authenticateToken, async (req, res) => {
    console.log('🏥 [HEALTH] Endpoint chamado');

    try {
        const healthStatus = {
            timestamp: new Date().toISOString(),
            overall: 'healthy',
            services: {}
        };

        // 1. MongoDB Health Check
        try {
            console.log('🏥 [HEALTH] Checking MongoDB...');
            healthStatus.services.mongodb = await Promise.race([
                checkMongoDB(),
                timeoutPromise(5000, 'MongoDB')
            ]);
        } catch (error) {
            healthStatus.services.mongodb = {
                status: 'error',
                message: 'Timeout ou erro',
                error: error.message
            };
        }

        // 2. Slack Health Check
        try {
            console.log('🏥 [HEALTH] Checking Slack...');
            healthStatus.services.slack = await Promise.race([
                checkSlack(),
                timeoutPromise(5000, 'Slack')
            ]);
        } catch (error) {
            healthStatus.services.slack = {
                status: 'error',
                message: 'Timeout ou erro',
                error: error.message
            };
        }

        // 3. R2/Cloudflare Health Check
        try {
            console.log('🏥 [HEALTH] Checking R2...');
            healthStatus.services.r2 = await Promise.race([
                checkR2(),
                timeoutPromise(10000, 'R2')
            ]);
        } catch (error) {
            healthStatus.services.r2 = {
                status: 'error',
                message: 'Timeout ou erro',
                error: error.message
            };
        }

        // 4. CDE Database Health Check (timeout maior - 10s)
        try {
            console.log('🏥 [HEALTH] Checking CDE...');
            healthStatus.services.cde = await Promise.race([
                checkCDE(),
                timeoutPromise(10000, 'CDE')
            ]);
        } catch (error) {
            healthStatus.services.cde = {
                status: 'error',
                message: 'Timeout ou erro',
                error: error.message
            };
        }

        // 5. Google Drive Health Check (opcional)
        try {
            console.log('🏥 [HEALTH] Checking Google Drive...');
            healthStatus.services.googleDrive = await checkGoogleDrive();
        } catch (error) {
            healthStatus.services.googleDrive = {
                status: 'error',
                message: 'Erro ao verificar',
                error: error.message
            };
        }

        // Determinar status geral
        const statuses = Object.values(healthStatus.services).map(s => s.status);
        if (statuses.includes('error')) {
            healthStatus.overall = 'unhealthy';
        } else if (statuses.includes('warning')) {
            healthStatus.overall = 'degraded';
        }

        console.log('✅ [HEALTH] Status geral:', healthStatus.overall);
        console.log('📊 [HEALTH] Enviando resposta...');

        res.json(healthStatus);

    } catch (error) {
        console.error('❌ [HEALTH] Erro ao verificar status:', error);
        res.status(500).json({
            timestamp: new Date().toISOString(),
            overall: 'error',
            error: error.message
        });
    }
});

/**
 * MongoDB Health Check
 */
async function checkMongoDB() {
    try {
        const start = Date.now();

        if (mongoose.connection.readyState !== 1) {
            return {
                status: 'error',
                message: 'MongoDB desconectado',
                responseTime: null
            };
        }

        // Testar conexão com ping
        await mongoose.connection.db.admin().ping();

        const responseTime = Date.now() - start;

        return {
            status: 'healthy',
            message: 'MongoDB conectado',
            responseTime: `${responseTime}ms`,
            database: mongoose.connection.name
        };

    } catch (error) {
        return {
            status: 'error',
            message: 'Falha ao conectar com MongoDB',
            error: error.message
        };
    }
}

/**
 * Slack Health Check
 */
async function checkSlack() {
    try {
        const start = Date.now();
        const result = await SlackChatService.healthCheck();
        const responseTime = Date.now() - start;

        return {
            ...result,
            responseTime: `${responseTime}ms`
        };

    } catch (error) {
        return {
            status: 'error',
            message: 'Falha ao verificar Slack',
            error: error.message
        };
    }
}

/**
 * R2/Cloudflare Health Check
 */
async function checkR2() {
    try {
        if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
            return {
                status: 'warning',
                message: 'Credenciais R2 não configuradas',
                error: 'R2 credentials missing'
            };
        }

        const start = Date.now();

        const s3Client = new S3Client({
            region: 'auto',
            endpoint: process.env.R2_ENDPOINT,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
            }
        });

        await s3Client.send(new HeadBucketCommand({
            Bucket: process.env.R2_BUCKET_NAME
        }));

        const responseTime = Date.now() - start;

        return {
            status: 'healthy',
            message: 'R2 conectado',
            responseTime: `${responseTime}ms`,
            bucket: process.env.R2_BUCKET_NAME
        };

    } catch (error) {
        return {
            status: 'error',
            message: 'Falha ao conectar com R2',
            error: error.message
        };
    }
}

/**
 * CDE Database Health Check
 */
async function checkCDE() {
    try {
        if (!process.env.CDE_HOST || !process.env.CDE_USER) {
            return {
                status: 'warning',
                message: 'Credenciais CDE não configuradas',
                error: 'CDE credentials missing'
            };
        }

        const start = Date.now();

        const connection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            port: process.env.CDE_PORT || 3306,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE,
            connectTimeout: 5000
        });

        await connection.ping();
        await connection.end();

        const responseTime = Date.now() - start;

        return {
            status: 'healthy',
            message: 'CDE Database conectado',
            responseTime: `${responseTime}ms`,
            database: process.env.CDE_DATABASE
        };

    } catch (error) {
        return {
            status: 'error',
            message: 'Falha ao conectar com CDE',
            error: error.message
        };
    }
}

/**
 * Google Drive Health Check
 */
async function checkGoogleDrive() {
    try {
        if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
            return {
                status: 'warning',
                message: 'Credenciais Google Drive não configuradas',
                error: 'Google credentials missing'
            };
        }

        // Verificação básica - apenas checa se as credenciais estão presentes
        return {
            status: 'healthy',
            message: 'Google Drive configurado',
            note: 'Credenciais presentes (não testado conexão real)'
        };

    } catch (error) {
        return {
            status: 'error',
            message: 'Falha ao verificar Google Drive',
            error: error.message
        };
    }
}

module.exports = router;
