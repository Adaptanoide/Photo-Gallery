// src/services/CDEWriter.js
// ✅ VERSÃO ATUALIZADA - Inclui Sales Rep no RESERVEDUSU
// Formato: CLIENTNAME-CODE(salesrep)
// Exemplo: DEVELOPING_TESTE-6753(tiago)

const mysql = require('mysql2/promise');
require('dotenv').config();

class CDEWriter {
    /**
     * Obter conexão com o CDE
     * Simples e direto - se falhar, deixa o erro subir
     */
    static async getConnection() {
        return await mysql.createConnection({
            host: process.env.CDE_HOST,
            port: process.env.CDE_PORT,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });
    }

    /**
     * 🆕 CONSTRUIR RESERVEDUSU COM SALES REP
     * Formato: CLIENTNAME-CODE(salesrep)
     */
    static buildReservedusu(clientName, clientCode, salesRep = 'Unassigned') {
        // Limpar nome do cliente (maiúsculas, sem espaços)
        const cleanClientName = clientName.toUpperCase().replace(/\s+/g, '_');

        // Limpar salesRep (remover espaços, converter para lowercase)
        const cleanSalesRep = (salesRep || 'Unassigned').toLowerCase().replace(/\s+/g, '');

        // Construir no formato: CLIENTNAME-CODE(salesrep)
        return `${cleanClientName}-${clientCode}(${cleanSalesRep})`;
    }

    /**
     * MARCAR COMO PRE-SELECTED (quando adiciona ao carrinho)
     * 🆕 AGORA INCLUI SALES REP
     */
    static async markAsReserved(photoNumber, clientCode, clientName = 'Client', salesRep = 'Unassigned') {
        let connection = null;

        try {
            connection = await this.getConnection();

            // 🆕 CONSTRUIR RESERVEDUSU COM SALES REP
            const reservedusu = this.buildReservedusu(clientName, clientCode, salesRep);

            console.log(`[CDE] Reservando foto ${photoNumber} para ${reservedusu}`);

            const [result] = await connection.execute(
                `UPDATE tbinventario 
                 SET AESTADOP = 'PRE-SELECTED',
                     RESERVEDUSU = ?,
                     AFECHA = NOW()
                 WHERE ATIPOETIQUETA = ?
                 AND AESTADOP IN ('INGRESADO', 'CONFIRMED')`,
                [reservedusu, photoNumber]
            );

            if (result.affectedRows > 0) {
                console.log(`[CDE] ✅ Foto ${photoNumber} reservada com sucesso para ${reservedusu}`);
                return true;
            } else {
                console.log(`[CDE] ⚠️ Foto ${photoNumber} não estava disponível`);
                return false;
            }

        } catch (error) {
            console.error(`[CDE] ❌ Erro ao reservar ${photoNumber}:`, error.message);
            throw error;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * MARCAR COMO INGRESADO (quando remove do carrinho ou expira)
     * Operação síncrona e direta
     */
    static async markAsAvailable(photoNumber) {
        let connection = null;

        try {
            connection = await this.getConnection();

            console.log(`[CDE] Liberando foto ${photoNumber}`);

            const [result] = await connection.execute(
                `UPDATE tbinventario 
                 SET AESTADOP = 'INGRESADO',
                     RESERVEDUSU = NULL,
                     AFECHA = NOW()
                 WHERE ATIPOETIQUETA = ?
                 AND AESTADOP IN ('PRE-SELECTED', 'RESERVED', 'CONFIRMED')`,
                [photoNumber]
            );

            if (result.affectedRows > 0) {
                console.log(`[CDE] ✅ Foto ${photoNumber} liberada com sucesso`);
                return true;
            } else {
                console.log(`[CDE] ⚠️ Foto ${photoNumber} já estava liberada`);
                return false;
            }

        } catch (error) {
            console.error(`[CDE] ❌ Erro ao liberar ${photoNumber}:`, error.message);
            throw error;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * MARCAR COMO CONFIRMED (quando cliente confirma seleção)
     * 🆕 AGORA INCLUI SALES REP
     */
    static async markAsConfirmed(photoNumber, clientCode, clientName = 'Client', salesRep = 'Unassigned') {
        let connection = null;

        try {
            connection = await this.getConnection();

            // 🆕 CONSTRUIR RESERVEDUSU COM SALES REP
            const reservedusu = this.buildReservedusu(clientName, clientCode, salesRep);

            console.log(`[CDE] Confirmando foto ${photoNumber} para ${reservedusu}`);

            const [result] = await connection.execute(
                `UPDATE tbinventario 
                 SET AESTADOP = 'CONFIRMED',
                     RESERVEDUSU = ?,
                     AFECHA = NOW()
                 WHERE ATIPOETIQUETA = ?
                 AND AESTADOP IN ('PRE-SELECTED', 'INGRESADO')`,
                [reservedusu, photoNumber]
            );

            if (result.affectedRows > 0) {
                console.log(`[CDE] ✅ Foto ${photoNumber} CONFIRMED para ${reservedusu}`);
                return true;
            } else {
                console.log(`[CDE] ⚠️ Foto ${photoNumber} não estava disponível para confirmar`);
                return false;
            }

        } catch (error) {
            console.error(`[CDE] ❌ Erro ao confirmar ${photoNumber}:`, error.message);
            throw error;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * BULK CONFIRM - Confirmar múltiplas fotos de uma vez
     * 🆕 AGORA INCLUI SALES REP
     */
    static async bulkMarkAsConfirmed(photoNumbers, clientCode, clientName = 'Client', salesRep = 'Unassigned') {
        let connection = null;

        try {
            if (!Array.isArray(photoNumbers) || photoNumbers.length === 0) {
                console.log('[CDE] ⚠️ Bulk confirm: array vazio');
                return 0;
            }

            connection = await this.getConnection();

            // 🆕 CONSTRUIR RESERVEDUSU COM SALES REP
            const reservedusu = this.buildReservedusu(clientName, clientCode, salesRep);

            console.log(`[CDE] 📦 Bulk confirm: ${photoNumbers.length} fotos para ${reservedusu}`);

            // Preparar placeholders para query SQL
            const placeholders = photoNumbers.map(() => '?').join(',');

            // 1 QUERY para TODAS as fotos!
            const [result] = await connection.execute(
                `UPDATE tbinventario 
                 SET AESTADOP = 'CONFIRMED',
                     RESERVEDUSU = ?,
                     AFECHA = NOW()
                 WHERE ATIPOETIQUETA IN (${placeholders})
                 AND AESTADOP IN ('PRE-SELECTED', 'INGRESADO')`,
                [reservedusu, ...photoNumbers]
            );

            const confirmedCount = result.affectedRows;
            console.log(`[CDE] ✅ Bulk confirm: ${confirmedCount}/${photoNumbers.length} fotos confirmadas para ${reservedusu}`);

            if (confirmedCount < photoNumbers.length) {
                console.log(`[CDE] ⚠️ ${photoNumbers.length - confirmedCount} fotos não estavam disponíveis para confirmar`);
            }

            return confirmedCount;

        } catch (error) {
            console.error(`[CDE] ❌ Erro no bulk confirm:`, error.message);
            throw error;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * BULK RELEASE - Liberar múltiplas fotos de uma vez
     * Muito mais rápido que liberar uma por uma
     */
    static async bulkMarkAsAvailable(photoNumbers) {
        let connection = null;

        try {
            if (!Array.isArray(photoNumbers) || photoNumbers.length === 0) {
                console.log('[CDE] ⚠️ Bulk release: array vazio');
                return 0;
            }

            connection = await this.getConnection();

            console.log(`[CDE] 📦 Bulk release: ${photoNumbers.length} fotos`);

            // Preparar placeholders para query SQL
            const placeholders = photoNumbers.map(() => '?').join(',');

            // 1 QUERY para TODAS as fotos!
            const [result] = await connection.execute(
                `UPDATE tbinventario 
                 SET AESTADOP = 'INGRESADO',
                     RESERVEDUSU = NULL,
                     AFECHA = NOW()
                 WHERE ATIPOETIQUETA IN (${placeholders})
                 AND AESTADOP IN ('PRE-SELECTED', 'RESERVED', 'CONFIRMED')`,
                photoNumbers
            );

            const releasedCount = result.affectedRows;
            console.log(`[CDE] ✅ Bulk release: ${releasedCount}/${photoNumbers.length} fotos liberadas`);

            if (releasedCount < photoNumbers.length) {
                console.log(`[CDE] ⚠️ ${photoNumbers.length - releasedCount} fotos já estavam liberadas`);
            }

            return releasedCount;

        } catch (error) {
            console.error(`[CDE] ❌ Erro no bulk release:`, error.message);
            throw error;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * BULK RESERVE - Reservar múltiplas fotos de uma vez
     * 🆕 AGORA INCLUI SALES REP
     */
    static async bulkMarkAsReserved(photoNumbers, clientCode, clientName = 'Client', salesRep = 'Unassigned') {
        let connection = null;

        try {
            if (!Array.isArray(photoNumbers) || photoNumbers.length === 0) {
                console.log('[CDE] ⚠️ Bulk reserve: array vazio');
                return 0;
            }

            connection = await this.getConnection();

            // 🆕 CONSTRUIR RESERVEDUSU COM SALES REP
            const reservedusu = this.buildReservedusu(clientName, clientCode, salesRep);

            console.log(`[CDE] 📦 Bulk reserve: ${photoNumbers.length} fotos para ${reservedusu}`);

            // Preparar placeholders para query SQL
            const placeholders = photoNumbers.map(() => '?').join(',');

            // 1 QUERY para TODAS as fotos!
            const [result] = await connection.execute(
                `UPDATE tbinventario 
                 SET AESTADOP = 'PRE-SELECTED',
                     RESERVEDUSU = ?,
                     AFECHA = NOW()
                 WHERE ATIPOETIQUETA IN (${placeholders})
                 AND AESTADOP IN ('INGRESADO', 'CONFIRMED')`,
                [reservedusu, ...photoNumbers]
            );

            const reservedCount = result.affectedRows;
            console.log(`[CDE] ✅ Bulk reserve: ${reservedCount}/${photoNumbers.length} fotos reservadas para ${reservedusu}`);

            if (reservedCount < photoNumbers.length) {
                console.log(`[CDE] ⚠️ ${photoNumbers.length - reservedCount} fotos não estavam disponíveis para reservar`);
            }

            return reservedCount;

        } catch (error) {
            console.error(`[CDE] ❌ Erro no bulk reserve:`, error.message);
            throw error;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * Método alternativo para liberarFoto (compatibilidade)
     */
    static async liberarFoto(photoNumber) {
        return this.markAsAvailable(photoNumber);
    }

    /**
     * VERIFICAR STATUS ATUAL NO CDE
     * Consulta direta e síncrona
     */
    static async checkStatus(photoNumber) {
        let connection = null;

        try {
            connection = await this.getConnection();

            const [rows] = await connection.execute(
                `SELECT ATIPOETIQUETA, AESTADOP, RESERVEDUSU, AFECHA 
                 FROM tbinventario 
                 WHERE ATIPOETIQUETA = ?`,
                [photoNumber]
            );

            if (rows.length > 0) {
                return {
                    photoNumber: rows[0].ATIPOETIQUETA,
                    status: rows[0].AESTADOP,
                    reservedBy: rows[0].RESERVEDUSU,
                    lastUpdate: rows[0].AFECHA
                };
            }

            return null;

        } catch (error) {
            console.error(`[CDE] ❌ Erro ao verificar status:`, error.message);
            return null;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * VERIFICAR MÚLTIPLAS FOTOS DE UMA VEZ
     * Para operações em lote quando necessário
     */
    static async checkMultipleStatus(photoNumbers) {
        let connection = null;

        try {
            if (!Array.isArray(photoNumbers) || photoNumbers.length === 0) {
                return [];
            }

            connection = await this.getConnection();

            const placeholders = photoNumbers.map(() => '?').join(',');
            const [rows] = await connection.execute(
                `SELECT ATIPOETIQUETA, AESTADOP, RESERVEDUSU 
                 FROM tbinventario 
                 WHERE ATIPOETIQUETA IN (${placeholders})`,
                photoNumbers
            );

            return rows.map(row => ({
                photoNumber: row.ATIPOETIQUETA,
                status: row.AESTADOP,
                reservedBy: row.RESERVEDUSU
            }));

        } catch (error) {
            console.error(`[CDE] ❌ Erro ao verificar múltiplos status:`, error.message);
            return [];
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * TESTAR CONEXÃO COM O CDE
     * Útil para verificar se o CDE está acessível
     */
    static async testConnection() {
        let connection = null;

        try {
            connection = await this.getConnection();

            const [result] = await connection.execute('SELECT 1');

            console.log('[CDE] ✅ Conexão com CDE funcionando');
            return true;

        } catch (error) {
            console.error('[CDE] ❌ Erro ao conectar:', error.message);
            return false;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * MARCAR COMO VENDIDO (RETIRADO)
     * Usado apenas quando uma venda é confirmada fisicamente
     * NOTA: Normalmente não usamos - o processo físico no CDE faz isso
     */
    static async markAsSold(photoNumber, clientCode) {
        let connection = null;

        try {
            connection = await this.getConnection();

            console.log(`[CDE] Marcando foto ${photoNumber} como VENDIDA`);

            const [result] = await connection.execute(
                `UPDATE tbinventario 
                 SET AESTADOP = 'RETIRADO',
                     RESERVEDUSU = ?,
                     AFECHA = NOW()
                 WHERE ATIPOETIQUETA = ?`,
                [`SOLD_${clientCode}`, photoNumber]
            );

            if (result.affectedRows > 0) {
                console.log(`[CDE] ✅ Foto ${photoNumber} marcada como vendida`);
                return true;
            }

            return false;

        } catch (error) {
            console.error(`[CDE] ❌ Erro ao marcar como vendida:`, error.message);
            throw error;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * BUSCAR FOTOS POR STATUS
     * Útil para relatórios e verificações
     */
    static async getPhotosByStatus(status) {
        let connection = null;

        try {
            connection = await this.getConnection();

            const [rows] = await connection.execute(
                `SELECT ATIPOETIQUETA, AESTADOP, RESERVEDUSU, AFECHA 
                 FROM tbinventario 
                 WHERE AESTADOP = ?
                 AND ATIPOETIQUETA != '0'
                 AND ATIPOETIQUETA != ''
                 ORDER BY AFECHA DESC`,
                [status]
            );

            return rows.map(row => ({
                photoNumber: row.ATIPOETIQUETA,
                status: row.AESTADOP,
                reservedBy: row.RESERVEDUSU,
                lastUpdate: row.AFECHA
            }));

        } catch (error) {
            console.error(`[CDE] ❌ Erro ao buscar fotos por status:`, error.message);
            return [];
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * EXECUTAR QUERY CUSTOMIZADA
     * Para casos especiais que precisam de queries específicas
     */
    static async executeQuery(query, params = []) {
        let connection = null;

        try {
            connection = await this.getConnection();

            const [result] = await connection.execute(query, params);
            return result;

        } catch (error) {
            console.error(`[CDE] ❌ Erro ao executar query:`, error.message);
            throw error;
        } finally {
            if (connection) await connection.end();
        }
    }
}

module.exports = CDEWriter;