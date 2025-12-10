// src/services/AIAlertService.js
// Sistema de Alertas Inteligentes para Sunshine Intelligence AI

const AITrainingRule = require('../models/AITrainingRule');
const EmailService = require('./EmailService');

class AIAlertService {
    constructor() {
        this.emailService = EmailService.getInstance();
        this.alertCache = new Map(); // Cache para evitar alertas duplicados
        this.alertCooldown = 60 * 60 * 1000; // 1 hora entre alertas do mesmo tipo
    }

    // ========== VERIFICACAO DE ALERTAS ==========

    /**
     * Verificar todas as regras ativas e disparar alertas se necessário
     * @param {Object} data - Dados atuais do sistema (inventário, vendas, etc.)
     * @returns {Array} Lista de alertas disparados
     */
    async checkAllAlerts(data) {
        const alerts = [];

        try {
            // Buscar regras ativas com alertas habilitados
            const rules = await AITrainingRule.find({
                active: true,
                alert_enabled: true
            });

            console.log(`🔔 Verificando ${rules.length} regras de alerta...`);

            for (const rule of rules) {
                const triggered = await this.evaluateRule(rule, data);

                if (triggered) {
                    // Verificar cooldown para evitar spam
                    if (!this.isInCooldown(rule._id.toString())) {
                        const alert = await this.createAlert(rule, triggered);
                        alerts.push(alert);

                        // Enviar email se configurado
                        if (rule.alert_email) {
                            await this.sendAlertEmail(alert);
                        }

                        // Atualizar regra com info do trigger
                        await this.updateRuleTriggerInfo(rule);

                        // Adicionar ao cooldown
                        this.addToCooldown(rule._id.toString());
                    }
                }
            }

            if (alerts.length > 0) {
                console.log(`🚨 ${alerts.length} alertas disparados!`);
            }

            return alerts;

        } catch (error) {
            console.error('❌ Erro ao verificar alertas:', error);
            return [];
        }
    }

    /**
     * Avaliar uma regra específica contra os dados
     * @param {Object} rule - Regra de treinamento
     * @param {Object} data - Dados atuais
     * @returns {Object|null} Dados do trigger se ativado, null se não
     */
    async evaluateRule(rule, data) {
        try {
            switch (rule.type) {
                case 'restock':
                    return this.evaluateRestockRule(rule, data);

                case 'lead_time':
                    return this.evaluateLeadTimeRule(rule, data);

                case 'seasonal':
                    return this.evaluateSeasonalRule(rule, data);

                case 'client':
                    return this.evaluateClientRule(rule, data);

                case 'alert':
                    return this.evaluateGenericAlert(rule, data);

                default:
                    return null;
            }
        } catch (error) {
            console.error(`Erro ao avaliar regra ${rule.title}:`, error);
            return null;
        }
    }

    /**
     * Avaliar regra de restock
     */
    evaluateRestockRule(rule, data) {
        if (!data.inventory && !data.criticalStock && !data.restocking) {
            return null;
        }

        const inventoryData = data.criticalStock || data.restocking || data.inventory || [];
        const triggeredProducts = [];

        for (const item of inventoryData) {
            // Verificar se o produto está na lista de códigos da regra
            const productCode = item.qbCode || item.codigo;
            const currentStock = item.current_stock || item.quantity || item.estoque_atual || 0;

            // Se a regra tem product_codes específicos, verificar
            if (rule.product_codes && rule.product_codes.length > 0) {
                if (!rule.product_codes.includes(productCode)) {
                    continue;
                }
            }

            // Avaliar trigger
            if (rule.trigger_value && rule.trigger_comparison) {
                const triggered = this.compareValues(
                    currentStock,
                    rule.trigger_comparison,
                    rule.trigger_value
                );

                if (triggered) {
                    triggeredProducts.push({
                        code: productCode,
                        description: item.description || item.produto || productCode,
                        currentStock: currentStock,
                        triggerValue: rule.trigger_value,
                        reorderQuantity: rule.reorder_quantity,
                        leadTimeDays: rule.lead_time_days,
                        supplierCountry: rule.supplier_country
                    });
                }
            }
        }

        if (triggeredProducts.length > 0) {
            return {
                type: 'RESTOCK_NEEDED',
                products: triggeredProducts,
                totalProducts: triggeredProducts.length
            };
        }

        return null;
    }

    /**
     * Avaliar regra de lead time
     */
    evaluateLeadTimeRule(rule, data) {
        if (!data.transit && !data.detailedTransit) {
            return null;
        }

        const transitData = data.detailedTransit || data.transit || [];
        const lateProducts = [];

        for (const item of transitData) {
            const daysInTransit = item.dias_em_transito || item.daysInTransit || 0;

            // Verificar origem se especificada
            if (rule.supplier_country) {
                const itemOrigin = (item.origem || item.origin || '').toLowerCase();
                if (!itemOrigin.includes(rule.supplier_country.toLowerCase())) {
                    continue;
                }
            }

            // Avaliar se excede lead time esperado
            if (rule.lead_time_days && daysInTransit > rule.lead_time_days) {
                lateProducts.push({
                    code: item.qbCode || item.codigo,
                    description: item.description || item.produto,
                    daysInTransit: daysInTransit,
                    expectedDays: rule.lead_time_days,
                    daysLate: daysInTransit - rule.lead_time_days,
                    origin: item.origem || item.origin
                });
            }
        }

        if (lateProducts.length > 0) {
            return {
                type: 'LEAD_TIME_EXCEEDED',
                products: lateProducts,
                totalProducts: lateProducts.length
            };
        }

        return null;
    }

    /**
     * Avaliar regra sazonal
     */
    evaluateSeasonalRule(rule, data) {
        if (!rule.seasonality || !rule.seasonality.months) {
            return null;
        }

        const currentMonth = new Date().getMonth() + 1; // 1-12

        // Verificar se estamos no período sazonal
        if (!rule.seasonality.months.includes(currentMonth)) {
            return null;
        }

        // Se é período de pico e temos dados de estoque
        if (rule.seasonality.pattern === 'peak' && data.inventory) {
            const lowStockProducts = [];

            for (const item of data.inventory) {
                const productCode = item.qbCode || item.codigo;

                // Verificar produtos específicos da regra
                if (rule.product_codes && rule.product_codes.length > 0) {
                    if (!rule.product_codes.includes(productCode)) {
                        continue;
                    }
                }

                const currentStock = item.current_stock || item.quantity || 0;
                const adjustedMinimum = rule.trigger_value ?
                    rule.trigger_value * (1 + (rule.seasonality.adjustment_percent || 0) / 100) :
                    100;

                if (currentStock < adjustedMinimum) {
                    lowStockProducts.push({
                        code: productCode,
                        description: item.description || item.produto,
                        currentStock: currentStock,
                        seasonalMinimum: Math.round(adjustedMinimum),
                        adjustment: rule.seasonality.adjustment_percent
                    });
                }
            }

            if (lowStockProducts.length > 0) {
                return {
                    type: 'SEASONAL_LOW_STOCK',
                    season: rule.seasonality.pattern,
                    month: currentMonth,
                    products: lowStockProducts,
                    totalProducts: lowStockProducts.length
                };
            }
        }

        return null;
    }

    /**
     * Avaliar regra de cliente
     */
    evaluateClientRule(rule, data) {
        if (!data.clients && !data.inactiveClients) {
            return null;
        }

        // Verificar clientes inativos
        if (rule.trigger_field === 'days_since_last_order' && data.inactiveClients) {
            const flaggedClients = [];

            for (const client of data.inactiveClients) {
                const daysSinceOrder = client.dias_sem_comprar || client.daysSinceLastOrder || 0;

                // Verificar clientes específicos se configurado
                if (rule.client_codes && rule.client_codes.length > 0) {
                    const clientCode = client.code || client.accessCode;
                    if (!rule.client_codes.includes(clientCode)) {
                        continue;
                    }
                }

                if (rule.trigger_value && daysSinceOrder > rule.trigger_value) {
                    flaggedClients.push({
                        name: client.cliente || client.name,
                        code: client.code || client.accessCode,
                        daysSinceOrder: daysSinceOrder,
                        lastOrder: client.ultima_compra || client.lastOrder
                    });
                }
            }

            if (flaggedClients.length > 0) {
                return {
                    type: 'INACTIVE_CLIENTS',
                    clients: flaggedClients,
                    totalClients: flaggedClients.length
                };
            }
        }

        return null;
    }

    /**
     * Avaliar alerta genérico
     */
    evaluateGenericAlert(rule, data) {
        // Para regras genéricas, verificar o trigger_field nos dados
        if (!rule.trigger_field || !rule.trigger_value) {
            return null;
        }

        // Tentar encontrar o campo nos dados
        const fieldValue = this.getNestedValue(data, rule.trigger_field);

        if (fieldValue !== null && fieldValue !== undefined) {
            const triggered = this.compareValues(
                fieldValue,
                rule.trigger_comparison || '<',
                rule.trigger_value
            );

            if (triggered) {
                return {
                    type: 'GENERIC_ALERT',
                    field: rule.trigger_field,
                    currentValue: fieldValue,
                    triggerValue: rule.trigger_value,
                    comparison: rule.trigger_comparison
                };
            }
        }

        return null;
    }

    // ========== CRIACAO E ENVIO DE ALERTAS ==========

    /**
     * Criar objeto de alerta
     */
    async createAlert(rule, triggerData) {
        return {
            id: `alert_${Date.now()}_${rule._id}`,
            ruleId: rule._id,
            ruleTitle: rule.title,
            ruleType: rule.type,
            priority: rule.priority || 'medium',
            actionRecommended: rule.action_recommended,
            triggerData: triggerData,
            createdAt: new Date(),
            message: this.generateAlertMessage(rule, triggerData)
        };
    }

    /**
     * Gerar mensagem de alerta
     */
    generateAlertMessage(rule, triggerData) {
        const priorityEmoji = {
            'low': 'ℹ️',
            'medium': '⚠️',
            'high': '🔶',
            'critical': '🚨'
        };

        const emoji = priorityEmoji[rule.priority] || '⚠️';
        let message = `${emoji} **${rule.title}**\n\n`;

        switch (triggerData.type) {
            case 'RESTOCK_NEEDED':
                message += `${triggerData.totalProducts} produto(s) precisam de reposição:\n`;
                triggerData.products.slice(0, 5).forEach(p => {
                    message += `• ${p.code}: ${p.currentStock} em estoque (mínimo: ${p.triggerValue})`;
                    if (p.reorderQuantity) message += ` - Pedir: ${p.reorderQuantity}`;
                    if (p.leadTimeDays) message += ` - Lead time: ${p.leadTimeDays} dias`;
                    message += '\n';
                });
                if (triggerData.totalProducts > 5) {
                    message += `... e mais ${triggerData.totalProducts - 5} produtos\n`;
                }
                break;

            case 'LEAD_TIME_EXCEEDED':
                message += `${triggerData.totalProducts} produto(s) com lead time excedido:\n`;
                triggerData.products.slice(0, 5).forEach(p => {
                    message += `• ${p.code}: ${p.daysInTransit} dias (esperado: ${p.expectedDays}) - ${p.daysLate} dias de atraso\n`;
                });
                break;

            case 'SEASONAL_LOW_STOCK':
                message += `Período sazonal (${triggerData.season}): ${triggerData.totalProducts} produto(s) com estoque baixo:\n`;
                triggerData.products.slice(0, 5).forEach(p => {
                    message += `• ${p.code}: ${p.currentStock} (mínimo sazonal: ${p.seasonalMinimum})\n`;
                });
                break;

            case 'INACTIVE_CLIENTS':
                message += `${triggerData.totalClients} cliente(s) inativos:\n`;
                triggerData.clients.slice(0, 5).forEach(c => {
                    message += `• ${c.name}: ${c.daysSinceOrder} dias sem comprar\n`;
                });
                break;

            default:
                message += `Condição atingida: ${JSON.stringify(triggerData)}\n`;
        }

        if (rule.action_recommended) {
            message += `\n📋 Ação recomendada: ${rule.action_recommended}`;
        }

        return message;
    }

    /**
     * Enviar alerta por email
     * NOTA: Em modo de teste, emails vão para tiagoioti@gmail.com
     * Quando for para produção, mudar para: ahuisman@outlook.com ou sales@sunshinecowhides.com
     */
    async sendAlertEmail(alert) {
        try {
            // ========== CONFIGURAÇÃO DE EMAIL ==========
            // MODO TESTE: Enviar para desenvolvedor
            const TEST_MODE = true;
            const TEST_EMAIL = 'tiagoioti@gmail.com';
            const PRODUCTION_EMAIL = 'ahuisman@outlook.com';

            const recipientEmail = TEST_MODE ? TEST_EMAIL : PRODUCTION_EMAIL;
            const recipientName = TEST_MODE ? 'Tiago (Test)' : 'Andy';
            // ============================================

            const priorityColors = {
                'low': '#17a2b8',
                'medium': '#ffc107',
                'high': '#fd7e14',
                'critical': '#dc3545'
            };

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .header { background: ${priorityColors[alert.priority] || '#ffc107'}; color: white; padding: 20px; text-align: center; }
                        .content { padding: 20px; }
                        .alert-box { background: #f8f9fa; border-left: 4px solid ${priorityColors[alert.priority] || '#ffc107'}; padding: 15px; margin: 15px 0; }
                        .footer { background: #6c757d; color: white; padding: 15px; text-align: center; font-size: 12px; }
                        pre { background: #e9ecef; padding: 10px; border-radius: 4px; white-space: pre-wrap; }
                        .test-banner { background: #ff6b6b; color: white; padding: 10px; text-align: center; font-weight: bold; }
                    </style>
                </head>
                <body>
                    ${TEST_MODE ? '<div class="test-banner">⚠️ TEST MODE - This is a test email</div>' : ''}

                    <div class="header">
                        <h1>🔔 Sunshine AI Alert</h1>
                        <p>Priority: ${alert.priority.toUpperCase()}</p>
                    </div>

                    <div class="content">
                        <h2>${alert.ruleTitle}</h2>

                        <div class="alert-box">
                            <pre>${alert.message}</pre>
                        </div>

                        <p><strong>Alert Type:</strong> ${alert.ruleType}</p>
                        <p><strong>Generated:</strong> ${alert.createdAt.toLocaleString()}</p>

                        ${alert.actionRecommended ? `
                            <div class="alert-box" style="border-left-color: #28a745;">
                                <h3>Recommended Action</h3>
                                <p>${alert.actionRecommended}</p>
                            </div>
                        ` : ''}
                    </div>

                    <div class="footer">
                        <p>This alert was automatically generated by Sunshine Intelligence AI</p>
                        <p>Configure your alerts at the Intelligence Dashboard</p>
                        ${TEST_MODE ? '<p style="color: #ff6b6b;">📧 Test mode: emails going to ' + TEST_EMAIL + '</p>' : ''}
                    </div>
                </body>
                </html>
            `;

            await this.emailService.sendEmail({
                to: [{ name: recipientName, email: recipientEmail }],
                subject: `${TEST_MODE ? '[TEST] ' : ''}[${alert.priority.toUpperCase()}] ${alert.ruleTitle}`,
                html: html
            });

            console.log(`📧 Alerta enviado por email para ${recipientEmail}: ${alert.ruleTitle}`);

        } catch (error) {
            console.error('❌ Erro ao enviar email de alerta:', error);
        }
    }

    // ========== METODOS AUXILIARES ==========

    /**
     * Comparar valores baseado no operador
     */
    compareValues(value, operator, target) {
        switch (operator) {
            case '<': return value < target;
            case '>': return value > target;
            case '==': return value == target;
            case '>=': return value >= target;
            case '<=': return value <= target;
            case '!=': return value != target;
            default: return false;
        }
    }

    /**
     * Obter valor aninhado de objeto
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }

    /**
     * Verificar se regra está em cooldown
     */
    isInCooldown(ruleId) {
        const lastAlert = this.alertCache.get(ruleId);
        if (!lastAlert) return false;

        const timeSinceLastAlert = Date.now() - lastAlert;
        return timeSinceLastAlert < this.alertCooldown;
    }

    /**
     * Adicionar regra ao cooldown
     */
    addToCooldown(ruleId) {
        this.alertCache.set(ruleId, Date.now());
    }

    /**
     * Atualizar informações de trigger na regra
     */
    async updateRuleTriggerInfo(rule) {
        try {
            await AITrainingRule.findByIdAndUpdate(rule._id, {
                last_triggered: new Date(),
                $inc: { trigger_count: 1 }
            });
        } catch (error) {
            console.error('Erro ao atualizar trigger info:', error);
        }
    }

    // ========== METODOS PUBLICOS ==========

    /**
     * Obter alertas ativos (disparados recentemente)
     */
    getActiveAlerts() {
        const activeAlerts = [];

        for (const [ruleId, timestamp] of this.alertCache.entries()) {
            activeAlerts.push({
                ruleId,
                triggeredAt: new Date(timestamp),
                minutesAgo: Math.round((Date.now() - timestamp) / 60000)
            });
        }

        return activeAlerts.sort((a, b) => b.triggeredAt - a.triggeredAt);
    }

    /**
     * Limpar cache de alertas
     */
    clearAlertCache() {
        this.alertCache.clear();
        console.log('🧹 Cache de alertas limpo');
    }

    /**
     * Verificar alertas manualmente (para teste)
     */
    async forceCheckAlerts(data) {
        // Limpa cooldown temporariamente
        const savedCache = new Map(this.alertCache);
        this.alertCache.clear();

        const alerts = await this.checkAllAlerts(data);

        // Restaura cooldown
        this.alertCache = savedCache;

        return alerts;
    }

    // ========== SINGLETON ==========

    static getInstance() {
        if (!AIAlertService.instance) {
            AIAlertService.instance = new AIAlertService();
        }
        return AIAlertService.instance;
    }
}

module.exports = AIAlertService;
