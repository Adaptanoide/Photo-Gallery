//src/routes/auth.js

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Admin = require('../models/Admin');
const AccessCode = require('../models/AccessCode');
const { google } = require('googleapis');

const router = express.Router();

// Configuração Google Drive
const getGoogleDriveAuth = () => {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        },
        scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });

    return google.drive({ version: 'v3', auth });
};

// Login do administrador
router.post('/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validação básica
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Usuário e senha são obrigatórios'
            });
        }

        // Buscar admin no banco
        const admin = await Admin.findOne({
            username: username.toLowerCase(),
            isActive: true
        });

        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }

        // Verificar senha
        const isPasswordValid = await admin.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }

        // Atualizar último login
        admin.lastLogin = new Date();
        await admin.save();

        // Gerar JWT
        const token = jwt.sign(
            {
                id: admin._id,
                username: admin.username,
                role: admin.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Login realizado com sucesso',
            token,
            user: {
                id: admin._id,
                username: admin.username,
                email: admin.email,
                role: admin.role,
                lastLogin: admin.lastLogin
            }
        });

    } catch (error) {
        console.error('Erro no login admin:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Verificação de código de acesso do cliente
router.post('/client/verify', async (req, res) => {
    try {
        const { code } = req.body;

        // Validação básica
        if (!code || !/^\d{4}$/.test(code)) {
            return res.status(400).json({
                success: false,
                message: 'Código deve ter exatamente 4 dígitos'
            });
        }

        // Buscar código de acesso
        const accessCode = await AccessCode.findOne({
            code: code,
            isActive: true,
            expiresAt: { $gt: new Date() }
        });

        if (!accessCode) {
            return res.status(401).json({
                success: false,
                message: 'Código inválido ou expirado'
            });
        }

        // Atualizar uso do código
        accessCode.usageCount += 1;
        accessCode.lastUsed = new Date();
        await accessCode.save();

        res.json({
            success: true,
            message: 'Código verificado com sucesso',
            client: {
                name: accessCode.clientName,
                email: accessCode.clientEmail,
                code: accessCode.code
            },
            allowedCategories: accessCode.allowedCategories,
            expiresAt: accessCode.expiresAt
        });

    } catch (error) {
        console.error('Erro na verificação do código:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Buscar dados do cliente logado com categorias filtradas (CORRIGIDO)
router.get('/client/data', async (req, res) => {
    try {
        // Buscar código de acesso na sessão (simulado via query param para teste)
        const { code } = req.query;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Código de acesso necessário'
            });
        }

        // Buscar dados do cliente
        const accessCode = await AccessCode.findOne({
            code: code,
            isActive: true,
            expiresAt: { $gt: new Date() }
        });

        if (!accessCode) {
            return res.status(404).json({
                success: false,
                message: 'Código inválido ou expirado'
            });
        }

        // Buscar categorias do Google Drive
        let availableCategories = [];

        try {
            const drive = getGoogleDriveAuth();
            const parentFolderId = process.env.DRIVE_FOLDER_AVAILABLE || '1Ky3wSKKg_mmQihdxmiYwMuqE3-SBTcbx';

            const response = await drive.files.list({
                q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
                fields: 'files(id, name, modifiedTime)',
                orderBy: 'name'
            });

            availableCategories = response.data.files;

        } catch (driveError) {
            console.error('Erro ao buscar categorias do Drive:', driveError);
        }

        // FILTRO CORRIGIDO E NORMALIZADO DE CATEGORIAS
        const allowedCategories = availableCategories.filter(category => {
            return accessCode.allowedCategories.some(allowed => {

                // Função para normalizar strings (remove espaços extras, números, etc.)
                const normalize = (str) => {
                    return str
                        .toLowerCase()
                        .replace(/^\d+\.\s*/, '')  // Remove números no início (1., 2., etc.)
                        .replace(/\s+/g, ' ')      // Normaliza múltiplos espaços para 1
                        .trim();                   // Remove espaços das bordas
                };

                // Normalizar ambos os nomes
                const categoryNormalized = normalize(category.name);
                const allowedNormalized = normalize(allowed);

                // Também testar versões originais sem normalização de números
                const categorySimple = category.name.toLowerCase().replace(/\s+/g, ' ').trim();
                const allowedSimple = allowed.toLowerCase().replace(/\s+/g, ' ').trim();

                // Múltiplas formas de match
                const matches = (
                    // Match exato original
                    category.name.toLowerCase() === allowed.toLowerCase() ||

                    // Match com espaços normalizados
                    categorySimple === allowedSimple ||

                    // Match sem números e espaços normalizados
                    categoryNormalized === allowedNormalized ||

                    // Inclusão com espaços normalizados
                    categorySimple.includes(allowedSimple) ||
                    allowedSimple.includes(categorySimple) ||

                    // Inclusão sem números
                    categoryNormalized.includes(allowedNormalized) ||
                    allowedNormalized.includes(categoryNormalized)
                );

                // Log detalhado para debug
                if (matches) {
                    console.log(`✅ MATCH ENCONTRADO:`);
                    console.log(`   Categoria Drive: "${category.name}"`);
                    console.log(`   Permitida AccessCode: "${allowed}"`);
                    console.log(`   Drive normalizado: "${categoryNormalized}"`);
                    console.log(`   Permitida normalizada: "${allowedNormalized}"`);
                }

                return matches;
            });
        });

        // Log final detalhado
        console.log(`🔍 RESULTADO DO FILTRO - Cliente: ${accessCode.clientName}`);
        console.log(`   📂 Categorias permitidas no AccessCode (${accessCode.allowedCategories.length}):`);
        accessCode.allowedCategories.forEach((cat, i) => console.log(`      ${i + 1}. "${cat}"`));
        console.log(`   📂 Categorias disponíveis no Drive (${availableCategories.length}):`);
        availableCategories.forEach((cat, i) => console.log(`      ${i + 1}. "${cat.name}"`));
        console.log(`   ✅ Categorias filtradas (${allowedCategories.length}):`);
        allowedCategories.forEach((cat, i) => console.log(`      ${i + 1}. "${cat.name}" (ID: ${cat.id})`));

        // Atualizar último uso
        accessCode.lastUsed = new Date();
        accessCode.usageCount += 1;
        await accessCode.save();

        // ===== DEBUG INTENSIVO - ANTES DE ENVIAR RESPOSTA =====
        console.log('🚨 ===== DEBUG FINAL ANTES DE ENVIAR RESPOSTA =====');
        console.log('📤 Cliente:', accessCode.clientName, '(', accessCode.code, ')');
        console.log('📂 AccessCode.allowedCategories:', JSON.stringify(accessCode.allowedCategories, null, 2));
        console.log('📂 Google Drive total:', availableCategories.length, 'categorias');
        console.log('📂 Filtro resultou em:', allowedCategories.length, 'categorias');
        console.log('✅ Categorias que serão enviadas ao cliente:');
        allowedCategories.forEach((cat, i) => {
            console.log(`   ${i + 1}. "${cat.name}" (ID: ${cat.id})`);
        });

        if (allowedCategories.length === availableCategories.length) {
            console.log('🚨 PROBLEMA: Cliente está recebendo TODAS as categorias (filtro não funcionou)');
        } else {
            console.log('✅ FILTRO FUNCIONOU: Cliente recebe apenas', allowedCategories.length, 'de', availableCategories.length);
        }

        console.log('🚨 ===== FIM DEBUG FINAL =====');

        res.json({
            success: true,
            client: {
                name: accessCode.clientName,
                email: accessCode.clientEmail,
                code: accessCode.code
            },
            allowedCategories: allowedCategories,        // ← Categorias FILTRADAS
            // REMOVIDO availableCategories para evitar confusão
            totalCategories: availableCategories.length,
            allowedCount: allowedCategories.length,
            debug: {
                originalAllowed: accessCode.allowedCategories,
                filteredResult: allowedCategories.map(c => c.name),
                filterWorked: allowedCategories.length < availableCategories.length
            }
        });

    } catch (error) {
        console.error('Erro ao buscar dados do cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Criar admin inicial (rota especial para setup)
router.post('/admin/setup', async (req, res) => {
    try {
        // Verificar se já existe admin
        const existingAdmin = await Admin.findOne();

        if (existingAdmin) {
            return res.status(409).json({
                success: false,
                message: 'Sistema já configurado'
            });
        }

        const { username, email, password } = req.body;

        // Validações
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Todos os campos são obrigatórios'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Senha deve ter pelo menos 6 caracteres'
            });
        }

        // Criar admin
        const admin = new Admin({
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password,
            role: 'super_admin'
        });

        await admin.save();

        res.json({
            success: true,
            message: 'Administrador criado com sucesso',
            admin: {
                id: admin._id,
                username: admin.username,
                email: admin.email,
                role: admin.role
            }
        });

    } catch (error) {
        console.error('Erro ao criar admin:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Usuário ou email já existe'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// DEBUG: Verificar dados do AccessCode (TEMPORÁRIO)
router.get('/debug/accesscode/:code', async (req, res) => {
    try {
        const { code } = req.params;

        const accessCode = await AccessCode.findOne({ code });

        if (!accessCode) {
            return res.json({
                success: false,
                message: 'Código não encontrado',
                code
            });
        }

        res.json({
            success: true,
            accessCode: {
                code: accessCode.code,
                clientName: accessCode.clientName,
                clientEmail: accessCode.clientEmail,
                allowedCategories: accessCode.allowedCategories,
                isActive: accessCode.isActive,
                createdAt: accessCode.createdAt,
                expiresAt: accessCode.expiresAt,
                usageCount: accessCode.usageCount,
                lastUsed: accessCode.lastUsed
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar AccessCode',
            error: error.message
        });
    }
});

// CORREÇÃO: Atualizar categorias do AccessCode (TEMPORÁRIO)
router.post('/fix/accesscode/:code', async (req, res) => {
    try {
        const { code } = req.params;

        const accessCode = await AccessCode.findOne({ code });

        if (!accessCode) {
            return res.status(404).json({
                success: false,
                message: 'Código não encontrado'
            });
        }

        // Corrigir categorias para o cliente 7064
        if (code === '7064') {
            const oldCategories = [...accessCode.allowedCategories];

            accessCode.allowedCategories = [
                "1. Colombian Cowhides",
                "2. Brazil Best Sellers"
            ];

            await accessCode.save();

            return res.json({
                success: true,
                message: 'AccessCode 7064 corrigido com sucesso',
                changes: {
                    before: oldCategories,
                    after: accessCode.allowedCategories
                },
                accessCode: {
                    code: accessCode.code,
                    clientName: accessCode.clientName,
                    allowedCategories: accessCode.allowedCategories
                }
            });
        }

        res.json({
            success: false,
            message: 'Código não necessita correção ou não é suportado para correção automática'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erro ao corrigir AccessCode',
            error: error.message
        });
    }
});

// DEBUG COMPLETO: Investigar problema das categorias
router.get('/debug/categories/:code', async (req, res) => {
    try {
        const { code } = req.params;

        // 1. Buscar dados do AccessCode
        const accessCode = await AccessCode.findOne({ code });
        if (!accessCode) {
            return res.json({
                success: false,
                message: 'Código não encontrado',
                code
            });
        }

        // 2. Buscar categorias do Google Drive
        let availableCategories = [];
        let driveError = null;

        try {
            const drive = getGoogleDriveAuth();
            const parentFolderId = process.env.DRIVE_FOLDER_AVAILABLE || '1Ky3wSKKg_mmQihdxmiYwMuqE3-SBTcbx';

            const response = await drive.files.list({
                q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
                fields: 'files(id, name, modifiedTime)',
                orderBy: 'name'
            });

            availableCategories = response.data.files;
        } catch (error) {
            driveError = error.message;
        }

        // 3. Testar TODOS os tipos de filtro possíveis
        const filterTests = [];

        for (const allowed of accessCode.allowedCategories) {
            for (const category of availableCategories) {
                // Diferentes tipos de match
                const tests = {
                    exactMatch: category.name.toLowerCase() === allowed.toLowerCase(),
                    categoryContainsAllowed: category.name.toLowerCase().includes(allowed.toLowerCase()),
                    allowedContainsCategory: allowed.toLowerCase().includes(category.name.toLowerCase()),
                    noNumbersMatch: category.name.replace(/^\d+\.\s*/, '').toLowerCase() === allowed.replace(/^\d+\.\s*/, '').toLowerCase(),
                    partialNoNumbers: category.name.replace(/^\d+\.\s*/, '').toLowerCase().includes(allowed.replace(/^\d+\.\s*/, '').toLowerCase()),
                    reversePartialNoNumbers: allowed.replace(/^\d+\.\s*/, '').toLowerCase().includes(category.name.replace(/^\d+\.\s*/, '').toLowerCase()),
                    normalizedSpaces: category.name.toLowerCase().replace(/\s+/g, ' ').trim() === allowed.toLowerCase().replace(/\s+/g, ' ').trim()
                };

                const anyMatch = Object.values(tests).some(t => t);

                filterTests.push({
                    allowed,
                    categoryName: category.name,
                    categoryId: category.id,
                    tests,
                    matches: anyMatch
                });
            }
        }

        // 4. Aplicar filtro atual
        const filteredCategories = availableCategories.filter(category => {
            return accessCode.allowedCategories.some(allowed => {
                const normalize = (str) => {
                    return str
                        .toLowerCase()
                        .replace(/^\d+\.\s*/, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                };

                const categoryNormalized = normalize(category.name);
                const allowedNormalized = normalize(allowed);
                const categorySimple = category.name.toLowerCase().replace(/\s+/g, ' ').trim();
                const allowedSimple = allowed.toLowerCase().replace(/\s+/g, ' ').trim();

                return (
                    category.name.toLowerCase() === allowed.toLowerCase() ||
                    categorySimple === allowedSimple ||
                    categoryNormalized === allowedNormalized ||
                    categorySimple.includes(allowedSimple) ||
                    allowedSimple.includes(categorySimple) ||
                    categoryNormalized.includes(allowedNormalized) ||
                    allowedNormalized.includes(categoryNormalized)
                );
            });
        });

        res.json({
            success: true,
            debug: {
                accessCode: {
                    code: accessCode.code,
                    clientName: accessCode.clientName,
                    allowedCategories: accessCode.allowedCategories,
                    allowedCount: accessCode.allowedCategories.length
                },
                googleDrive: {
                    error: driveError,
                    availableCategories: availableCategories.map(c => ({ id: c.id, name: c.name })),
                    availableCount: availableCategories.length
                },
                filtering: {
                    filteredCategories: filteredCategories.map(c => ({ id: c.id, name: c.name })),
                    filteredCount: filteredCategories.length,
                    allFilterTests: filterTests
                }
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erro no debug',
            error: error.message
        });
    }
});

// Middleware para verificar JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Token de acesso requerido'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Token inválido ou expirado'
            });
        }

        req.user = user;
        next();
    });
};

// Verificar se o token é válido
router.get('/verify-token', authenticateToken, async (req, res) => {
    try {
        const admin = await Admin.findById(req.user.id).select('-password');

        if (!admin || !admin.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não encontrado ou inativo'
            });
        }

        res.json({
            success: true,
            user: {
                id: admin._id,
                username: admin.username,
                email: admin.email,
                role: admin.role
            }
        });

    } catch (error) {
        console.error('Erro na verificação do token:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Exportar middleware para uso em outras rotas
router.authenticateToken = authenticateToken;

module.exports = router;