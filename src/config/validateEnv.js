// src/config/validateEnv.js
// Valida variáveis de ambiente críticas no startup

/**
 * Variáveis de ambiente obrigatórias
 * Se alguma estiver ausente, o servidor não deve iniciar
 */
const REQUIRED_VARS = [
    'MONGODB_URI',
    'JWT_SECRET',
];

/**
 * Variáveis de ambiente recomendadas
 * Se ausentes, apenas mostra warning
 */
const RECOMMENDED_VARS = [
    'CDE_HOST',
    'CDE_USER',
    'CDE_PASSWORD',
    'CDE_DATABASE',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_ENDPOINT',
    'R2_BUCKET_NAME',
];

/**
 * Variáveis com valores padrão (opcional)
 */
const DEFAULTS = {
    PORT: '3000',
    NODE_ENV: 'development',
    SYNC_INTERVAL_MINUTES: '5',
    CART_DEFAULT_TTL_HOURS: '24',
};

/**
 * Valida todas as variáveis de ambiente
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
 */
function validateEnv() {
    const errors = [];
    const warnings = [];

    console.log('\n🔍 Validando variáveis de ambiente...\n');

    // Verificar obrigatórias
    for (const varName of REQUIRED_VARS) {
        if (!process.env[varName]) {
            errors.push(`❌ OBRIGATÓRIA: ${varName} não está definida`);
        } else {
            console.log(`✅ ${varName}: definida`);
        }
    }

    // Verificar recomendadas
    for (const varName of RECOMMENDED_VARS) {
        if (!process.env[varName]) {
            warnings.push(`⚠️ RECOMENDADA: ${varName} não está definida`);
        }
    }

    // Aplicar defaults se necessário
    for (const [varName, defaultValue] of Object.entries(DEFAULTS)) {
        if (!process.env[varName]) {
            process.env[varName] = defaultValue;
            console.log(`📝 ${varName}: usando valor padrão "${defaultValue}"`);
        }
    }

    // Resumo
    console.log('\n' + '='.repeat(50));

    if (errors.length > 0) {
        console.error('\n🚨 ERROS CRÍTICOS:');
        errors.forEach(e => console.error(e));
    }

    if (warnings.length > 0) {
        console.warn('\n⚠️ AVISOS:');
        warnings.forEach(w => console.warn(w));
    }

    if (errors.length === 0 && warnings.length === 0) {
        console.log('✅ Todas as variáveis de ambiente estão OK!\n');
    }

    console.log('='.repeat(50) + '\n');

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Executa validação e para o servidor se houver erros críticos
 */
function validateEnvOrExit() {
    const result = validateEnv();

    if (!result.valid) {
        console.error('\n🛑 Servidor NÃO iniciado devido a variáveis de ambiente faltando.');
        console.error('Por favor, configure as variáveis obrigatórias no arquivo .env\n');

        // Em produção, para o servidor
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        } else {
            // Em desenvolvimento, apenas avisa mas continua
            console.warn('⚠️ Continuando em modo desenvolvimento mesmo com erros...\n');
        }
    }

    return result;
}

module.exports = {
    validateEnv,
    validateEnvOrExit,
    REQUIRED_VARS,
    RECOMMENDED_VARS,
    DEFAULTS,
};
