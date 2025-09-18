// src/services/CDEWriter.js
// VERSÃO SIMPLIFICADA - Operações diretas no CDE sem complexidade

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
     * MARCAR COMO PRE-SELECTED (quando adiciona ao carrinho)
     * Operação síncrona e direta
     */
    static async markAsReserved(photoNumber, clientCode, clientName = 'Client') {
        let connection = null;

        try {
            connection = await this.getConnection();

            console.log(`[CDE] Reservando foto ${photoNumber} para ${clientCode}`);

            const [result] = await connection.execute(
                `UPDATE tbinventario 
                 SET AESTADOP = 'PRE-SELECTED',
                     RESERVEDUSU = ?,
                     AFECHA = NOW()
                 WHERE ATIPOETIQUETA = ?
                 AND AESTADOP = 'INGRESADO'`,
                [`${clientName}-${clientCode}`, photoNumber]
            );

            if (result.affectedRows > 0) {
                console.log(`[CDE] ✅ Foto ${photoNumber} reservada com sucesso`);
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
                 AND AESTADOP IN ('PRE-SELECTED', 'RESERVED')`,
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