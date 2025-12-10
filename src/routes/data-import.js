// src/routes/data-import.js
// Endpoints para importação e exportação de dados do Sunshine Intelligence AI

const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const AITrainingRule = require('../models/AITrainingRule');

// Configuração do multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/json'
        ];

        if (allowedTypes.includes(file.mimetype) ||
            file.originalname.endsWith('.csv') ||
            file.originalname.endsWith('.xlsx') ||
            file.originalname.endsWith('.json')) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não suportado. Use CSV, XLSX ou JSON.'));
        }
    }
});

// Middleware de autenticação (simplificado - usar o mesmo do intelligence.js)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de autenticação necessário' });
    }

    // Verificar token JWT (simplificado)
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'sunshine-intelligence-secret-key';

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
};

// ========== IMPORT DE TRAINING RULES ==========

/**
 * POST /api/import/training-rules
 * Importar regras de treinamento via JSON ou arquivo CSV/XLSX
 */
router.post('/training-rules', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        let rules = [];

        // Opção 1: JSON direto no body
        if (req.body.rules) {
            rules = Array.isArray(req.body.rules) ? req.body.rules : [req.body.rules];
        }

        // Opção 2: Arquivo enviado
        else if (req.file) {
            const fileBuffer = req.file.buffer;
            const fileName = req.file.originalname.toLowerCase();

            if (fileName.endsWith('.json')) {
                // Parse JSON
                const jsonContent = fileBuffer.toString('utf-8');
                const parsed = JSON.parse(jsonContent);
                rules = Array.isArray(parsed) ? parsed : [parsed];
            }
            else if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx')) {
                // Parse Excel/CSV
                const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = xlsx.utils.sheet_to_json(worksheet);

                rules = jsonData.map(row => parseRuleFromRow(row));
            }
        }

        if (rules.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nenhuma regra encontrada no arquivo ou body'
            });
        }

        // Validar e preparar regras
        const validRules = [];
        const errors = [];

        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];

            // Validação básica
            if (!rule.title || !rule.type || !rule.description) {
                errors.push({
                    index: i,
                    rule: rule.title || `Linha ${i + 1}`,
                    error: 'Campos obrigatórios: title, type, description'
                });
                continue;
            }

            // Validar tipo
            const validTypes = ['restock', 'pricing', 'seasonal', 'client', 'general', 'alert', 'lead_time'];
            if (!validTypes.includes(rule.type)) {
                errors.push({
                    index: i,
                    rule: rule.title,
                    error: `Tipo inválido: ${rule.type}. Válidos: ${validTypes.join(', ')}`
                });
                continue;
            }

            // Preparar regra para salvar
            const preparedRule = {
                title: rule.title,
                type: rule.type,
                description: rule.description,
                created_by: req.user?.username || 'Import',
                active: rule.active !== false,
                applied: rule.applied === true,

                // Campos opcionais
                trigger_value: parseNumber(rule.trigger_value),
                trigger_comparison: rule.trigger_comparison || null,
                trigger_field: rule.trigger_field || null,

                product_codes: parseArray(rule.product_codes),
                product_categories: parseArray(rule.product_categories),

                lead_time_days: parseNumber(rule.lead_time_days),
                supplier_country: rule.supplier_country || null,
                reorder_quantity: parseNumber(rule.reorder_quantity),

                seasonality: parseSeasonality(rule),

                velocity_threshold: {
                    min_per_day: parseNumber(rule.velocity_min),
                    max_per_day: parseNumber(rule.velocity_max)
                },

                client_codes: parseArray(rule.client_codes),
                client_preferences: rule.client_preferences || null,

                applies_to_channels: parseArray(rule.applies_to_channels),

                action_recommended: rule.action_recommended || null,
                priority: rule.priority || 'medium',

                alert_enabled: rule.alert_enabled === true || rule.alert_enabled === 'true',
                alert_email: rule.alert_email === true || rule.alert_email === 'true'
            };

            validRules.push(preparedRule);
        }

        // Inserir regras válidas
        let inserted = 0;
        let updated = 0;

        for (const rule of validRules) {
            // Verificar se já existe regra com mesmo título
            const existing = await AITrainingRule.findOne({ title: rule.title });

            if (existing) {
                // Atualizar existente
                await AITrainingRule.findByIdAndUpdate(existing._id, rule);
                updated++;
            } else {
                // Criar nova
                await AITrainingRule.create(rule);
                inserted++;
            }
        }

        res.json({
            success: true,
            message: `Importação concluída`,
            stats: {
                total: rules.length,
                inserted: inserted,
                updated: updated,
                errors: errors.length
            },
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('❌ Erro na importação de regras:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/import/training-rules/template
 * Baixar template CSV para importação de regras
 */
router.get('/training-rules/template', authenticateToken, (req, res) => {
    const template = [
        {
            title: 'Coasters Low Stock Alert',
            type: 'restock',
            description: 'Alert when coasters drop below 100 units',
            trigger_value: 100,
            trigger_comparison: '<',
            product_codes: '2110;2115;2129',
            lead_time_days: 45,
            supplier_country: 'Brazil',
            reorder_quantity: 500,
            priority: 'high',
            action_recommended: 'PLACE_ORDER',
            alert_enabled: 'true',
            alert_email: 'true'
        },
        {
            title: 'Holiday Season Stock Boost',
            type: 'seasonal',
            description: 'Increase stock for holiday season',
            seasonality_months: '10;11;12',
            seasonality_pattern: 'peak',
            seasonality_adjustment: 30,
            product_categories: 'Colombian;Brazilian',
            priority: 'medium',
            action_recommended: 'INCREASE_STOCK'
        },
        {
            title: 'VIP Client Jordan Preferences',
            type: 'client',
            description: 'Jordan prefers tricolor patterns',
            client_codes: 'JORDAN',
            client_preferences: 'Prefers tricolor patterns, usually orders monthly',
            priority: 'medium'
        }
    ];

    const worksheet = xlsx.utils.json_to_sheet(template);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Training Rules');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=training-rules-template.xlsx');
    res.send(buffer);
});

/**
 * GET /api/import/training-rules/export
 * Exportar todas as regras de treinamento
 */
router.get('/training-rules/export', authenticateToken, async (req, res) => {
    try {
        const format = req.query.format || 'json';
        const rules = await AITrainingRule.find({}).lean();

        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=training-rules-export.json');
            res.json(rules);
        }
        else if (format === 'xlsx' || format === 'csv') {
            // Flatten rules for Excel
            const flatRules = rules.map(rule => ({
                title: rule.title,
                type: rule.type,
                description: rule.description,
                trigger_value: rule.trigger_value,
                trigger_comparison: rule.trigger_comparison,
                trigger_field: rule.trigger_field,
                product_codes: (rule.product_codes || []).join(';'),
                product_categories: (rule.product_categories || []).join(';'),
                lead_time_days: rule.lead_time_days,
                supplier_country: rule.supplier_country,
                reorder_quantity: rule.reorder_quantity,
                seasonality_months: rule.seasonality?.months?.join(';') || '',
                seasonality_pattern: rule.seasonality?.pattern || '',
                seasonality_adjustment: rule.seasonality?.adjustment_percent || '',
                client_codes: (rule.client_codes || []).join(';'),
                client_preferences: rule.client_preferences,
                applies_to_channels: (rule.applies_to_channels || []).join(';'),
                action_recommended: rule.action_recommended,
                priority: rule.priority,
                active: rule.active,
                applied: rule.applied,
                alert_enabled: rule.alert_enabled,
                alert_email: rule.alert_email,
                trigger_count: rule.trigger_count,
                last_triggered: rule.last_triggered,
                created_at: rule.createdAt
            }));

            const worksheet = xlsx.utils.json_to_sheet(flatRules);
            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Training Rules');

            const bookType = format === 'csv' ? 'csv' : 'xlsx';
            const buffer = xlsx.write(workbook, { type: 'buffer', bookType });

            const contentType = format === 'csv' ?
                'text/csv' :
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename=training-rules-export.${format}`);
            res.send(buffer);
        }
        else {
            res.status(400).json({ error: 'Formato inválido. Use: json, xlsx, csv' });
        }

    } catch (error) {
        console.error('❌ Erro na exportação:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== IMPORT DE DADOS DE VENDAS (QuickBooks) ==========

/**
 * POST /api/import/sales-history
 * Importar histórico de vendas do QuickBooks
 * Armazenado no MongoDB para análise da AI
 */
router.post('/sales-history', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Arquivo necessário' });
        }

        const fileBuffer = req.file.buffer;
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(worksheet);

        // Mapeamento flexível de colunas
        const salesRecords = jsonData.map((row, index) => {
            return {
                date: parseDate(row.Date || row.date || row.DATA || row.Fecha),
                client: row.Customer || row.Client || row.client || row.CLIENTE || row.Cliente,
                productCode: row['Product Code'] || row.ProductCode || row.Item || row.ITEM || row.Codigo,
                productName: row['Product Name'] || row.Description || row.Product || row.PRODUTO || row.Producto,
                quantity: parseNumber(row.Quantity || row.Qty || row.quantity || row.QUANTIDADE || row.Cantidad) || 1,
                unitPrice: parseNumber(row['Unit Price'] || row.Price || row.price || row.PRECO || row.Precio),
                totalValue: parseNumber(row.Total || row.Amount || row.total || row.TOTAL),
                channel: row.Channel || row.Marketplace || row.channel || row.CANAL || row.Canal,
                orderId: row['Order ID'] || row.OrderId || row.Order || row.PEDIDO || row.Pedido,
                importedAt: new Date(),
                rowIndex: index + 1
            };
        });

        // Validar registros
        const validRecords = salesRecords.filter(r =>
            r.date && (r.productCode || r.productName)
        );

        // Salvar no MongoDB (criar collection se não existir)
        const mongoose = require('mongoose');

        // Schema para histórico de vendas importado
        const SalesHistorySchema = new mongoose.Schema({
            date: Date,
            client: String,
            productCode: String,
            productName: String,
            quantity: Number,
            unitPrice: Number,
            totalValue: Number,
            channel: String,
            orderId: String,
            importedAt: Date,
            importBatch: String
        }, { collection: 'ai_sales_history' });

        // Registrar modelo se ainda não existir
        const SalesHistory = mongoose.models.SalesHistory ||
            mongoose.model('SalesHistory', SalesHistorySchema);

        // Criar batch ID para esta importação
        const batchId = `import_${Date.now()}`;

        // Adicionar batch ID aos registros
        const recordsWithBatch = validRecords.map(r => ({
            ...r,
            importBatch: batchId
        }));

        // Inserir em lote
        const result = await SalesHistory.insertMany(recordsWithBatch, { ordered: false });

        // Calcular estatísticas
        const stats = {
            totalRows: jsonData.length,
            validRecords: validRecords.length,
            inserted: result.length,
            dateRange: {
                start: validRecords.reduce((min, r) => r.date < min ? r.date : min, validRecords[0]?.date),
                end: validRecords.reduce((max, r) => r.date > max ? r.date : max, validRecords[0]?.date)
            },
            uniqueClients: [...new Set(validRecords.map(r => r.client).filter(Boolean))].length,
            uniqueProducts: [...new Set(validRecords.map(r => r.productCode).filter(Boolean))].length,
            channels: [...new Set(validRecords.map(r => r.channel).filter(Boolean))]
        };

        res.json({
            success: true,
            message: 'Histórico de vendas importado com sucesso',
            batchId: batchId,
            stats: stats
        });

    } catch (error) {
        console.error('❌ Erro na importação de vendas:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/import/sales-history/stats
 * Estatísticas do histórico de vendas importado
 */
router.get('/sales-history/stats', authenticateToken, async (req, res) => {
    try {
        const mongoose = require('mongoose');

        // Verificar se a collection existe
        const collections = await mongoose.connection.db.listCollections({ name: 'ai_sales_history' }).toArray();

        if (collections.length === 0) {
            return res.json({
                success: true,
                message: 'Nenhum histórico importado ainda',
                stats: {
                    totalRecords: 0,
                    importBatches: 0
                }
            });
        }

        const SalesHistory = mongoose.models.SalesHistory ||
            mongoose.model('SalesHistory', new mongoose.Schema({}, { collection: 'ai_sales_history' }));

        const stats = await SalesHistory.aggregate([
            {
                $group: {
                    _id: null,
                    totalRecords: { $sum: 1 },
                    totalQuantity: { $sum: '$quantity' },
                    totalValue: { $sum: '$totalValue' },
                    minDate: { $min: '$date' },
                    maxDate: { $max: '$date' },
                    uniqueClients: { $addToSet: '$client' },
                    uniqueProducts: { $addToSet: '$productCode' },
                    channels: { $addToSet: '$channel' },
                    batches: { $addToSet: '$importBatch' }
                }
            }
        ]);

        if (stats.length === 0) {
            return res.json({
                success: true,
                stats: { totalRecords: 0 }
            });
        }

        const result = stats[0];

        res.json({
            success: true,
            stats: {
                totalRecords: result.totalRecords,
                totalQuantity: result.totalQuantity,
                totalValue: result.totalValue,
                dateRange: {
                    start: result.minDate,
                    end: result.maxDate
                },
                uniqueClients: result.uniqueClients.filter(Boolean).length,
                uniqueProducts: result.uniqueProducts.filter(Boolean).length,
                channels: result.channels.filter(Boolean),
                importBatches: result.batches.length
            }
        });

    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== IMPORT DE PREFERENCIAS DE CLIENTES ==========

/**
 * POST /api/import/client-preferences
 * Importar preferências de clientes
 */
router.post('/client-preferences', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Arquivo necessário' });
        }

        const fileBuffer = req.file.buffer;
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(worksheet);

        // Criar regras de cliente a partir dos dados
        const clientRules = [];

        for (const row of jsonData) {
            const clientName = row.Client || row.Customer || row.Name || row.CLIENTE;
            const clientCode = row.Code || row.AccessCode || row.CODIGO;
            const preferences = row.Preferences || row.Notes || row.PREFERENCIAS;
            const favoriteProducts = row.FavoriteProducts || row.Products || row.PRODUCTOS;

            if (!clientName && !clientCode) continue;

            const rule = {
                title: `Client ${clientName || clientCode} Preferences`,
                type: 'client',
                description: preferences || `Preferences for ${clientName || clientCode}`,
                client_codes: clientCode ? [clientCode] : [],
                client_preferences: preferences,
                product_codes: favoriteProducts ? favoriteProducts.split(/[;,]/).map(p => p.trim()) : [],
                priority: row.VIP === 'true' || row.VIP === true ? 'high' : 'medium',
                active: true
            };

            clientRules.push(rule);
        }

        // Inserir regras
        let inserted = 0;
        let updated = 0;

        for (const rule of clientRules) {
            const existing = await AITrainingRule.findOne({ title: rule.title });

            if (existing) {
                await AITrainingRule.findByIdAndUpdate(existing._id, rule);
                updated++;
            } else {
                await AITrainingRule.create(rule);
                inserted++;
            }
        }

        res.json({
            success: true,
            message: 'Preferências de clientes importadas',
            stats: {
                total: jsonData.length,
                inserted: inserted,
                updated: updated
            }
        });

    } catch (error) {
        console.error('❌ Erro na importação de preferências:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== FUNCOES AUXILIARES ==========

function parseNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? null : num;
}

function parseArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return String(value).split(/[;,]/).map(s => s.trim()).filter(Boolean);
}

function parseDate(value) {
    if (!value) return null;

    // Se já é Date
    if (value instanceof Date) return value;

    // Se é número (Excel serial date)
    if (typeof value === 'number') {
        // Excel serial date to JS Date
        const excelEpoch = new Date(1899, 11, 30);
        return new Date(excelEpoch.getTime() + value * 86400000);
    }

    // Se é string
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
}

function parseSeasonality(rule) {
    const months = parseArray(rule.seasonality_months || rule.months);
    const pattern = rule.seasonality_pattern || rule.pattern;
    const adjustment = parseNumber(rule.seasonality_adjustment || rule.adjustment_percent);

    if (months.length === 0 && !pattern && !adjustment) {
        return undefined;
    }

    return {
        months: months.map(m => parseInt(m)).filter(m => m >= 1 && m <= 12),
        pattern: ['peak', 'low', 'normal'].includes(pattern) ? pattern : null,
        adjustment_percent: adjustment
    };
}

function parseRuleFromRow(row) {
    return {
        title: row.title || row.Title || row.TITLE,
        type: (row.type || row.Type || row.TYPE || 'general').toLowerCase(),
        description: row.description || row.Description || row.DESCRIPTION,

        trigger_value: row.trigger_value || row.TriggerValue,
        trigger_comparison: row.trigger_comparison || row.TriggerComparison || row.comparison,
        trigger_field: row.trigger_field || row.TriggerField,

        product_codes: row.product_codes || row.ProductCodes || row.products,
        product_categories: row.product_categories || row.ProductCategories || row.categories,

        lead_time_days: row.lead_time_days || row.LeadTime || row.leadtime,
        supplier_country: row.supplier_country || row.SupplierCountry || row.country,
        reorder_quantity: row.reorder_quantity || row.ReorderQty || row.quantity,

        seasonality_months: row.seasonality_months || row.months,
        seasonality_pattern: row.seasonality_pattern || row.pattern,
        seasonality_adjustment: row.seasonality_adjustment || row.adjustment,

        velocity_min: row.velocity_min || row.VelocityMin,
        velocity_max: row.velocity_max || row.VelocityMax,

        client_codes: row.client_codes || row.ClientCodes || row.clients,
        client_preferences: row.client_preferences || row.ClientPreferences || row.preferences,

        applies_to_channels: row.applies_to_channels || row.Channels || row.channels,

        action_recommended: row.action_recommended || row.Action || row.action,
        priority: row.priority || row.Priority || 'medium',

        active: row.active !== false && row.active !== 'false',
        applied: row.applied === true || row.applied === 'true',
        alert_enabled: row.alert_enabled === true || row.alert_enabled === 'true',
        alert_email: row.alert_email === true || row.alert_email === 'true'
    };
}

module.exports = router;
