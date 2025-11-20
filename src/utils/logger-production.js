const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

class ProductionLogger {
    constructor() {
        this.isProduction = process.env.NODE_ENV === 'production';
        this.buffer = [];

        if (this.isProduction) {
            this.s3Client = new S3Client({
                endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
                region: 'auto',
                credentials: {
                    accessKeyId: process.env.R2_ACCESS_KEY_ID,
                    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
                }
            });

            // Enviar a cada hora
            setInterval(() => this.flush(), 3600000); // 1 hora

            // Enviar quando o servidor desligar (importante!)
            process.on('SIGTERM', () => {
                console.log('[LOGGER] Salvando logs antes de desligar...');
                this.flush();
            });

            process.on('SIGINT', () => {
                console.log('[LOGGER] Salvando logs antes de desligar...');
                this.flush();
            });
        }
    }

    log(level, message, data = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data
        };

        console.log(`[${level}] ${message}`);

        if (this.isProduction) {
            this.buffer.push(entry);
            if (this.buffer.length >= 50) {
                this.flush();
            }
        }
    }

    async flush() {
        if (!this.isProduction || this.buffer.length === 0) return;

        try {
            const date = new Date().toISOString().split('T')[0];
            const timestamp = Date.now();
            const key = `logs/${date}/${timestamp}.json`;

            await this.s3Client.send(new PutObjectCommand({
                Bucket: 'sunshine-photos',
                Key: key,
                Body: JSON.stringify(this.buffer, null, 2),
                ContentType: 'application/json'
            }));

            this.buffer = [];
        } catch (error) {
            console.error('[LOGGER] Erro:', error.message);
        }
    }

    info(message, data) { this.log('INFO', message, data); }
    error(message, data) { this.log('ERROR', message, data); }
    cde(message, data) { this.log('CDE', message, data); }
}

module.exports = new ProductionLogger();