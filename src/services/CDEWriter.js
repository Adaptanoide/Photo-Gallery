// src/services/CDEWriter.js
const mysql = require('mysql2/promise');

class CDEWriter {
    constructor() {
        this.config = {
            host: process.env.CDE_HOST,
            port: process.env.CDE_PORT,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        };
        
        // MODO SIMULAÇÃO - MUDAR PARA false QUANDO TIVER PERMISSÃO!
        this.simulationMode = true;
        
        // Fila para retry se CDE estiver offline
        this.retryQueue = [];
        
        // Processar fila a cada 5 minutos
        setInterval(() => this.processRetryQueue(), 5 * 60 * 1000);
    }

    // Método auxiliar para conectar
    async getConnection() {
        try {
            return await mysql.createConnection(this.config);
        } catch (error) {
            console.error('[CDEWriter] Erro ao conectar:', error.message);
            return null;
        }
    }

    // 1. QUANDO CLIENTE ADICIONA AO CARRINHO
    async markAsReserved(photoNumber, idhCode, clientCode, sessionId) {
        // MODO SIMULAÇÃO
        if (this.simulationMode) {
            console.log(`\n[CDEWriter - SIMULAÇÃO] Reservaria foto ${photoNumber}`);
            console.log(`  Cliente: ${clientCode}`);
            console.log(`  Session: ${sessionId}`);
            console.log(`  SQL: UPDATE tbinventario SET RESERVEDUSU = 'SUNSHINE_${clientCode}_${sessionId}' WHERE ATIPOETIQUETA = '${photoNumber}'`);
            return true;
        }
        
        const connection = await this.getConnection();
        if (!connection) {
            // Adicionar à fila para retry
            this.retryQueue.push({
                action: 'reserve',
                data: { photoNumber, idhCode, clientCode, sessionId },
                timestamp: new Date()
            });
            return false;
        }

        try {
            console.log(`[CDEWriter] Marcando ${photoNumber} como RESERVED para cliente ${clientCode}`);
            
            // Por enquanto, usar campo RESERVEDUSU até Ingrid criar os novos
            const query = `
                UPDATE tbinventario 
                SET RESERVEDUSU = ?,
                    AFECHA = NOW()
                WHERE (AIDH = ? OR ATIPOETIQUETA = ?)
                AND AESTADOP = 'INGRESADO'
            `;
            
            const reserveInfo = `SUNSHINE_${clientCode}_${sessionId}`;
            
            const [result] = await connection.execute(
                query,
                [reserveInfo, idhCode || '', photoNumber]
            );
            
            if (result.affectedRows > 0) {
                console.log(`[CDEWriter] ✅ Foto ${photoNumber} reservada no CDE`);
                return true;
            } else {
                console.log(`[CDEWriter] ⚠️ Foto ${photoNumber} não atualizada - pode já estar reservada`);
                return false;
            }
            
        } catch (error) {
            console.error(`[CDEWriter] Erro ao reservar ${photoNumber}:`, error.message);
            
            // Adicionar à fila para retry
            this.retryQueue.push({
                action: 'reserve',
                data: { photoNumber, idhCode, clientCode, sessionId },
                timestamp: new Date()
            });
            
            return false;
        } finally {
            if (connection) await connection.end();
        }
    }

    // 2. QUANDO CLIENTE REMOVE DO CARRINHO
    async markAsAvailable(photoNumber, idhCode) {
        // MODO SIMULAÇÃO
        if (this.simulationMode) {
            console.log(`\n[CDEWriter - SIMULAÇÃO] Liberaria foto ${photoNumber}`);
            console.log(`  SQL: UPDATE tbinventario SET RESERVEDUSU = NULL WHERE ATIPOETIQUETA = '${photoNumber}'`);
            return true;
        }
        
        const connection = await this.getConnection();
        if (!connection) {
            this.retryQueue.push({
                action: 'release',
                data: { photoNumber, idhCode },
                timestamp: new Date()
            });
            return false;
        }

        try {
            console.log(`[CDEWriter] Liberando ${photoNumber}`);
            
            const query = `
                UPDATE tbinventario 
                SET RESERVEDUSU = NULL,
                    AFECHA = NOW()
                WHERE (AIDH = ? OR ATIPOETIQUETA = ?)
                AND RESERVEDUSU LIKE 'SUNSHINE_%'
            `;
            
            const [result] = await connection.execute(
                query,
                [idhCode || '', photoNumber]
            );
            
            if (result.affectedRows > 0) {
                console.log(`[CDEWriter] ✅ Foto ${photoNumber} liberada no CDE`);
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error(`[CDEWriter] Erro ao liberar ${photoNumber}:`, error.message);
            
            this.retryQueue.push({
                action: 'release',
                data: { photoNumber, idhCode },
                timestamp: new Date()
            });
            
            return false;
        } finally {
            if (connection) await connection.end();
        }
    }

    // 3. QUANDO ADMIN APROVA SELEÇÃO
    async markAsSold(photoNumber, idhCode, clientCode) {
        // MODO SIMULAÇÃO
        if (this.simulationMode) {
            console.log(`\n[CDEWriter - SIMULAÇÃO] Marcaria foto ${photoNumber} como VENDIDA`);
            console.log(`  Cliente: ${clientCode}`);
            console.log(`  SQL: UPDATE tbinventario SET AESTADOP = 'RETIRADO', RESERVEDUSU = 'SOLD_SUNSHINE_${clientCode}' WHERE ATIPOETIQUETA = '${photoNumber}'`);
            return true;
        }
        
        const connection = await this.getConnection();
        if (!connection) {
            this.retryQueue.push({
                action: 'sell',
                data: { photoNumber, idhCode, clientCode },
                timestamp: new Date()
            });
            return false;
        }

        try {
            console.log(`[CDEWriter] Marcando ${photoNumber} como RETIRADO (vendido)`);
            
            const query = `
                UPDATE tbinventario 
                SET AESTADOP = 'RETIRADO',
                    RESERVEDUSU = ?,
                    AFECHA = NOW()
                WHERE (AIDH = ? OR ATIPOETIQUETA = ?)
            `;
            
            const soldInfo = `SOLD_SUNSHINE_${clientCode}`;
            
            const [result] = await connection.execute(
                query,
                [soldInfo, idhCode || '', photoNumber]
            );
            
            if (result.affectedRows > 0) {
                console.log(`[CDEWriter] ✅ Foto ${photoNumber} marcada como VENDIDA no CDE`);
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error(`[CDEWriter] Erro ao marcar como vendida ${photoNumber}:`, error.message);
            
            this.retryQueue.push({
                action: 'sell',
                data: { photoNumber, idhCode, clientCode },
                timestamp: new Date()
            });
            
            return false;
        } finally {
            if (connection) await connection.end();
        }
    }

    // 4. PROCESSAR FILA DE RETRY (para quando CDE estava offline)
    async processRetryQueue() {
        if (this.retryQueue.length === 0) return;
        
        console.log(`[CDEWriter] Processando ${this.retryQueue.length} itens na fila de retry`);
        
        const queue = [...this.retryQueue];
        this.retryQueue = [];
        
        for (const item of queue) {
            switch (item.action) {
                case 'reserve':
                    await this.markAsReserved(
                        item.data.photoNumber,
                        item.data.idhCode,
                        item.data.clientCode,
                        item.data.sessionId
                    );
                    break;
                case 'release':
                    await this.markAsAvailable(
                        item.data.photoNumber,
                        item.data.idhCode
                    );
                    break;
                case 'sell':
                    await this.markAsSold(
                        item.data.photoNumber,
                        item.data.idhCode,
                        item.data.clientCode
                    );
                    break;
            }
        }
    }

    // 5. TESTE DE CONEXÃO
    async testConnection() {
        const connection = await this.getConnection();
        if (!connection) {
            console.log('[CDEWriter] ❌ Não foi possível conectar ao CDE');
            return false;
        }
        
        try {
            const [result] = await connection.execute('SELECT 1');
            console.log('[CDEWriter] ✅ Conexão com CDE funcionando!');
            return true;
        } catch (error) {
            console.log('[CDEWriter] ❌ Erro ao testar conexão:', error.message);
            return false;
        } finally {
            if (connection) await connection.end();
        }
    }
}

module.exports = new CDEWriter();