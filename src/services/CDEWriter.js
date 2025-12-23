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
     * 🆕 DETERMINAR STATUS CDE BASEADO NO SALES REP
     * RETAIL (Vicky/Eduarda) → RESERVED
     * WHOLESALE (outros) → CONFIRMED
     */
    static getCDEStatusForConfirmation(salesRep) {
        const retailSalesReps = ['Vicky', 'Eduarda', 'Vicky / Eduarda'];

        const normalizedSalesRep = (salesRep || '').trim();

        const isRetail = retailSalesReps.some(rep =>
            normalizedSalesRep.toLowerCase() === rep.toLowerCase()
        );

        if (isRetail) {
            console.log(`[CDE] 🏪 RETAIL (${salesRep}) → RESERVED`);
            return 'RESERVED';
        } else {
            console.log(`[CDE] 🏢 WHOLESALE (${salesRep}) → CONFIRMED`);
            return 'CONFIRMED';
        }
    }

    /**
     * 🆕 MÉTODO AUXILIAR: Tentar operação em ambas tabelas
     * Tenta primeiro na tabela indicada, se falhar, tenta na outra
     */
    static async tryBothTables(operation, photoNumber, params, preferredTable = 'tbinventario') {
        let connection = null;

        try {
            connection = await this.getConnection();

            // 1. Tentar na tabela preferida
            const firstTable = preferredTable === 'tbetiqueta' ? 'tbetiqueta' : 'tbinventario';
            const secondTable = firstTable === 'tbinventario' ? 'tbetiqueta' : 'tbinventario';

            console.log(`[CDE] Tentando ${operation} foto ${photoNumber} em ${firstTable}`);

            // Executar operação na primeira tabela
            const query = params.query.replace('${tableName}', firstTable);
            const [result] = await connection.execute(query, params.values);

            if (result.affectedRows > 0) {
                console.log(`[CDE] ✅ Foto ${photoNumber} ${operation} com sucesso em ${firstTable}`);
                return { success: true, table: firstTable, rows: result.affectedRows };
            }

            // 2. Se não achou, tentar na outra tabela
            console.log(`[CDE] 🔄 Foto não encontrada em ${firstTable}, tentando ${secondTable}...`);

            const query2 = params.query.replace('${tableName}', secondTable);
            const [result2] = await connection.execute(query2, params.values);

            if (result2.affectedRows > 0) {
                console.log(`[CDE] ✅ Foto ${photoNumber} ${operation} com sucesso em ${secondTable}`);
                return { success: true, table: secondTable, rows: result2.affectedRows };
            }

            // 3. Não encontrou em nenhuma tabela
            console.log(`[CDE] ⚠️ Foto ${photoNumber} não encontrada em nenhuma tabela`);
            return { success: false, table: null, rows: 0 };

        } catch (error) {
            console.error(`[CDE] ❌ Erro ao ${operation}:`, error.message);
            throw error;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * MARCAR COMO PRE-SELECTED (quando adiciona ao carrinho)
     * SEM FALLBACK - usa apenas a tabela indicada para evitar modificar foto errada
     */
    static async markAsReserved(photoNumber, clientCode, clientName = 'Client', salesRep = 'Unassigned', cdeTable = 'tbinventario') {
        let connection = null;

        try {
            connection = await this.getConnection();
            const reservedusu = this.buildReservedusu(clientName, clientCode, salesRep);

            // Usar APENAS a tabela indicada - NÃO fazer fallback
            const targetTable = cdeTable === 'tbetiqueta' ? 'tbetiqueta' : 'tbinventario';

            console.log(`[CDE] Reservando foto ${photoNumber} para ${reservedusu} em ${targetTable}`);

            // PASSO 1: Tentar reservar na tabela indicada
            const [updateResult] = await connection.execute(
                `UPDATE ${targetTable}
                SET AESTADOP = 'PRE-SELECTED',
                    RESERVEDUSU = ?,
                    AFECHA = NOW()
                WHERE ATIPOETIQUETA = ?
                AND AESTADOP IN ('INGRESADO', 'WAREHOUSE', 'PRE-TRANSITO', 'TRANSITO')`,
                [reservedusu, photoNumber]
            );

            if (updateResult.affectedRows > 0) {
                console.log(`[CDE] ✅ Foto ${photoNumber} reservada em ${targetTable}`);
                return true;
            }

            // PASSO 2: Se não atualizou, verificar status atual
            const [checkRows] = await connection.execute(
                `SELECT AESTADOP, RESERVEDUSU FROM ${targetTable} WHERE ATIPOETIQUETA = ?`,
                [photoNumber]
            );

            if (checkRows.length > 0) {
                const currentStatus = checkRows[0].AESTADOP;
                const currentReservedBy = checkRows[0].RESERVEDUSU;

                if (currentStatus === 'PRE-SELECTED' && currentReservedBy === reservedusu) {
                    console.log(`[CDE] ✅ Foto ${photoNumber} já estava reservada para ${reservedusu} em ${targetTable}`);
                    return true;
                } else {
                    console.log(`[CDE] ⚠️ Foto ${photoNumber} está com status ${currentStatus} (${currentReservedBy || 'sem reserva'}) em ${targetTable}`);
                    return false;
                }
            }

            // PASSO 3: Foto não existe na tabela indicada
            console.log(`[CDE] ⚠️ Foto ${photoNumber} não encontrada em ${targetTable}`);
            return false;

        } catch (error) {
            console.error(`[CDE] ❌ Erro ao reservar ${photoNumber}:`, error.message);
            throw error;
        } finally {
            if (connection) await connection.end();
        }
    }

    static async markAsAvailable(photoNumber, cdeTable = 'tbinventario') {
        let connection = null;

        try {
            connection = await this.getConnection();

            // Usar APENAS a tabela indicada - NÃO fazer fallback para evitar modificar foto errada
            const targetTable = cdeTable === 'tbetiqueta' ? 'tbetiqueta' : 'tbinventario';
            const availableStatus = targetTable === 'tbetiqueta' ? 'PRE-TRANSITO' : 'INGRESADO';

            console.log(`[CDE] Liberando foto ${photoNumber} em ${targetTable}`);

            // PASSO 1: Tentar atualizar se estiver em status reservado
            const [updateResult] = await connection.execute(
                `UPDATE ${targetTable}
                SET AESTADOP = ?,
                    RESERVEDUSU = NULL,
                    AFECHA = NOW()
                WHERE ATIPOETIQUETA = ?
                AND AESTADOP IN ('PRE-SELECTED', 'RESERVED', 'CONFIRMED')`,
                [availableStatus, photoNumber]
            );

            if (updateResult.affectedRows > 0) {
                console.log(`[CDE] ✅ Foto ${photoNumber} liberada em ${targetTable} → ${availableStatus}`);
                return true;
            }

            // PASSO 2: Se não atualizou, verificar status atual (pode já estar liberada)
            const [checkRows] = await connection.execute(
                `SELECT AESTADOP FROM ${targetTable} WHERE ATIPOETIQUETA = ?`,
                [photoNumber]
            );

            if (checkRows.length > 0) {
                const currentStatus = checkRows[0].AESTADOP;
                if (currentStatus === availableStatus || currentStatus === 'INGRESADO' || currentStatus === 'PRE-TRANSITO') {
                    console.log(`[CDE] ✅ Foto ${photoNumber} já estava disponível em ${targetTable} (${currentStatus})`);
                    return true; // Já está OK, não precisa fazer nada
                } else {
                    console.log(`[CDE] ⚠️ Foto ${photoNumber} está com status ${currentStatus} em ${targetTable} - não modificada`);
                    return false;
                }
            }

            // PASSO 3: Foto não existe na tabela indicada
            console.log(`[CDE] ⚠️ Foto ${photoNumber} não encontrada em ${targetTable}`);
            return false;

        } catch (error) {
            console.error(`[CDE] ❌ Erro ao liberar ${photoNumber}:`, error.message);
            throw error;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * MARCAR COMO CONFIRMED (quando cliente confirma seleção)
     * 🆕 AGORA COM FALLBACK AUTOMÁTICO
     */
    static async markAsConfirmed(photoNumber, clientCode, clientName = 'Client', salesRep = 'Unassigned', cdeTable = 'tbinventario') {
        let connection = null;

        try {
            connection = await this.getConnection();
            const reservedusu = this.buildReservedusu(clientName, clientCode, salesRep);

            // Determinar ordem de tentativa
            const firstTable = cdeTable === 'tbetiqueta' ? 'tbetiqueta' : 'tbinventario';
            const secondTable = firstTable === 'tbinventario' ? 'tbetiqueta' : 'tbinventario';

            console.log(`[CDE] Confirmando foto ${photoNumber} para ${reservedusu}`);
            console.log(`[CDE] 🎯 Tentando primeiro em ${firstTable}...`);

            // TENTATIVA 1: Tabela preferida
            const [result1] = await connection.execute(
                `UPDATE ${firstTable} 
                SET AESTADOP = 'CONFIRMED',
                    RESERVEDUSU = ?,
                    AFECHA = NOW()
                WHERE ATIPOETIQUETA = ?
                AND AESTADOP IN ('PRE-SELECTED', 'INGRESADO')`,
                [reservedusu, photoNumber]
            );

            if (result1.affectedRows > 0) {
                console.log(`[CDE] ✅ Foto ${photoNumber} CONFIRMED em ${firstTable}`);
                return true;
            }

            // TENTATIVA 2: Fallback automático
            console.log(`[CDE] 🔄 Não encontrada em ${firstTable}, tentando ${secondTable}...`);

            const [result2] = await connection.execute(
                `UPDATE ${secondTable} 
                SET AESTADOP = 'CONFIRMED',
                    RESERVEDUSU = ?,
                    AFECHA = NOW()
                WHERE ATIPOETIQUETA = ?
                AND AESTADOP IN ('PRE-SELECTED', 'INGRESADO')`,
                [reservedusu, photoNumber]
            );

            if (result2.affectedRows > 0) {
                console.log(`[CDE] ✅ Foto ${photoNumber} CONFIRMED em ${secondTable} (fallback)`);
                return true;
            }

            // Não encontrou em nenhuma tabela
            console.log(`[CDE] ⚠️ Foto ${photoNumber} não estava disponível para confirmar`);
            return false;

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
    static async bulkMarkAsConfirmed(photoNumbers, clientCode, clientName = 'Client', salesRep = 'Unassigned', cdeTables = []) {
        let connection = null;

        try {
            if (!Array.isArray(photoNumbers) || photoNumbers.length === 0) {
                console.log('[CDE] ⚠️ Bulk confirm: array vazio');
                return 0;
            }

            connection = await this.getConnection();

            // 🆕 CONSTRUIR RESERVEDUSU COM SALES REP
            const reservedusu = this.buildReservedusu(clientName, clientCode, salesRep);

            // 🆕 DETERMINAR STATUS BASEADO NO SALES REP
            const cdeStatus = this.getCDEStatusForConfirmation(salesRep);

            console.log(`[CDE] 📦 Bulk confirm: ${photoNumbers.length} fotos para ${reservedusu}`);
            console.log(`[CDE] 📊 Status: ${cdeStatus} (Sales Rep: ${salesRep})`);

            // Preparar placeholders para query SQL
            const placeholders = photoNumbers.map(() => '?').join(',');

            // ✅ AGRUPAR FOTOS POR TABELA
            const photosByTable = {
                tbinventario: [],
                tbetiqueta: []
            };

            photoNumbers.forEach((photoNum, index) => {
                const table = cdeTables[index] || 'tbinventario';
                photosByTable[table].push(photoNum);
            });

            console.log(`[CDE] 📊 Distribuição: ${photosByTable.tbinventario.length} em tbinventario, ${photosByTable.tbetiqueta.length} em tbetiqueta`);

            let totalConfirmed = 0;

            // ✅ ATUALIZAR tbinventario (se houver fotos)
            if (photosByTable.tbinventario.length > 0) {
                const placeholders1 = photosByTable.tbinventario.map(() => '?').join(',');

                const [result1] = await connection.execute(
                    `UPDATE tbinventario 
                    SET AESTADOP = ?,
                        RESERVEDUSU = ?,
                        AFECHA = NOW()
                    WHERE ATIPOETIQUETA IN (${placeholders1})
                    AND AESTADOP IN ('PRE-SELECTED', 'INGRESADO')`,
                    [cdeStatus, reservedusu, ...photosByTable.tbinventario]
                );

                totalConfirmed += result1.affectedRows;
                console.log(`[CDE] ✅ tbinventario: ${result1.affectedRows}/${photosByTable.tbinventario.length} confirmadas`);
            }

            // ✅ ATUALIZAR tbetiqueta (se houver fotos)
            if (photosByTable.tbetiqueta.length > 0) {
                const placeholders2 = photosByTable.tbetiqueta.map(() => '?').join(',');

                const [result2] = await connection.execute(
                    `UPDATE tbetiqueta 
                    SET AESTADOP = ?,
                        RESERVEDUSU = ?,
                        AFECHA = NOW()
                    WHERE ATIPOETIQUETA IN (${placeholders2})
                    AND AESTADOP IN ('PRE-SELECTED', 'PRE-TRANSITO')`,
                    [cdeStatus, reservedusu, ...photosByTable.tbetiqueta]
                );

                totalConfirmed += result2.affectedRows;
                console.log(`[CDE] ✅ tbetiqueta: ${result2.affectedRows}/${photosByTable.tbetiqueta.length} confirmadas`);
            }

            console.log(`[CDE] ✅ Total: ${totalConfirmed}/${photoNumbers.length} fotos → ${cdeStatus}`);

            if (totalConfirmed < photoNumbers.length) {
                console.log(`[CDE] ⚠️ ${photoNumbers.length - totalConfirmed} fotos não estavam disponíveis para confirmar`);
            }

            return totalConfirmed;

        } catch (error) {
            console.error(`[CDE] ❌ Erro no bulk confirm:`, error.message);
            throw error;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * BULK RESERVE - Reservar múltiplas fotos de uma vez
     * 🆕 AGORA INCLUI SALES REP E MÚLTIPLAS TABELAS
     */
    static async bulkMarkAsReserved(photoNumbers, clientCode, clientName = 'Client', salesRep = 'Unassigned', cdeTables = []) {
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

            // ✅ AGRUPAR FOTOS POR TABELA
            const photosByTable = {
                tbinventario: [],
                tbetiqueta: []
            };

            photoNumbers.forEach((photoNum, index) => {
                const table = cdeTables[index] || 'tbinventario';
                photosByTable[table].push(photoNum);
            });

            console.log(`[CDE] 📊 Distribuição: ${photosByTable.tbinventario.length} em tbinventario, ${photosByTable.tbetiqueta.length} em tbetiqueta`);

            let totalReserved = 0;

            // ✅ RESERVAR tbinventario (se houver fotos)
            if (photosByTable.tbinventario.length > 0) {
                const placeholders1 = photosByTable.tbinventario.map(() => '?').join(',');

                const [result1] = await connection.execute(
                    `UPDATE tbinventario 
                    SET AESTADOP = 'PRE-SELECTED',
                        RESERVEDUSU = ?,
                        AFECHA = NOW()
                    WHERE ATIPOETIQUETA IN (${placeholders1})
                    AND AESTADOP IN ('INGRESADO', 'CONFIRMED', 'RESERVED')`,
                    [reservedusu, ...photosByTable.tbinventario]
                );

                totalReserved += result1.affectedRows;
                console.log(`[CDE] ✅ tbinventario: ${result1.affectedRows}/${photosByTable.tbinventario.length} reservadas`);
            }

            // ✅ RESERVAR tbetiqueta (se houver fotos)
            if (photosByTable.tbetiqueta.length > 0) {
                const placeholders2 = photosByTable.tbetiqueta.map(() => '?').join(',');

                const [result2] = await connection.execute(
                    `UPDATE tbetiqueta 
                    SET AESTADOP = 'PRE-SELECTED',
                        RESERVEDUSU = ?,
                        AFECHA = NOW()
                    WHERE ATIPOETIQUETA IN (${placeholders2})
                    AND AESTADOP IN ('PRE-TRANSITO', 'CONFIRMED', 'RESERVED')`,
                    [reservedusu, ...photosByTable.tbetiqueta]
                );

                totalReserved += result2.affectedRows;
                console.log(`[CDE] ✅ tbetiqueta: ${result2.affectedRows}/${photosByTable.tbetiqueta.length} reservadas`);
            }

            const reservedCount = totalReserved;
            console.log(`[CDE] ✅ Total: ${reservedCount}/${photoNumbers.length} fotos reservadas para ${reservedusu}`);

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
         * BULK RELEASE - Liberar múltiplas fotos de uma vez
         * Muito mais rápido que liberar uma por uma
         */
    static async bulkMarkAsAvailable(photoNumbers, cdeTables = []) {
        let connection = null;

        try {
            if (!Array.isArray(photoNumbers) || photoNumbers.length === 0) {
                console.log('[CDE] ⚠️ Bulk release: array vazio');
                return 0;
            }

            connection = await this.getConnection();

            console.log(`[CDE] 📦 Bulk release: ${photoNumbers.length} fotos`);

            // ✅ AGRUPAR FOTOS POR TABELA
            const photosByTable = {
                tbinventario: [],
                tbetiqueta: []
            };

            photoNumbers.forEach((photoNum, index) => {
                const table = cdeTables[index] || 'tbinventario';
                photosByTable[table].push(photoNum);
            });

            console.log(`[CDE] 📊 Distribuição: ${photosByTable.tbinventario.length} em tbinventario, ${photosByTable.tbetiqueta.length} em tbetiqueta`);

            let totalReleased = 0;

            // ✅ LIBERAR tbinventario (se houver fotos)
            if (photosByTable.tbinventario.length > 0) {
                const placeholders1 = photosByTable.tbinventario.map(() => '?').join(',');

                const [result1] = await connection.execute(
                    `UPDATE tbinventario 
                     SET AESTADOP = 'INGRESADO',
                         RESERVEDUSU = NULL,
                         AFECHA = NOW()
                     WHERE ATIPOETIQUETA IN (${placeholders1})
                     AND AESTADOP IN ('PRE-SELECTED', 'RESERVED', 'CONFIRMED')`,
                    photosByTable.tbinventario
                );

                totalReleased += result1.affectedRows;
                console.log(`[CDE] ✅ tbinventario: ${result1.affectedRows}/${photosByTable.tbinventario.length} liberadas → INGRESADO`);
            }

            // ✅ LIBERAR tbetiqueta (se houver fotos)
            if (photosByTable.tbetiqueta.length > 0) {
                const placeholders2 = photosByTable.tbetiqueta.map(() => '?').join(',');

                const [result2] = await connection.execute(
                    `UPDATE tbetiqueta 
                     SET AESTADOP = 'PRE-TRANSITO',
                         RESERVEDUSU = NULL,
                         AFECHA = NOW()
                     WHERE ATIPOETIQUETA IN (${placeholders2})
                     AND AESTADOP IN ('PRE-SELECTED', 'RESERVED', 'CONFIRMED')`,
                    photosByTable.tbetiqueta
                );

                totalReleased += result2.affectedRows;
                console.log(`[CDE] ✅ tbetiqueta: ${result2.affectedRows}/${photosByTable.tbetiqueta.length} liberadas → PRE-TRANSITO`);
            }

            const releasedCount = totalReleased;
            console.log(`[CDE] ✅ Total: ${releasedCount}/${photoNumbers.length} fotos liberadas`);

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

    // =====================================================
    // CATALOG PRODUCTS - Reserva por AIDH (não tem foto)
    // =====================================================

    /**
     * MARCAR IDHs DE CATÁLOGO COMO PRE-SELECTED
     * Usa AIDH em vez de ATIPOETIQUETA (produtos sem foto)
     */
    static async markCatalogIDHsAsReserved(idhs, clientCode, clientName = 'Client', salesRep = 'Unassigned') {
        let connection = null;

        if (!Array.isArray(idhs) || idhs.length === 0) {
            console.log('[CDE-CATALOG] Nenhum IDH para reservar');
            return { success: true, reserved: 0 };
        }

        try {
            connection = await this.getConnection();
            const reservedusu = this.buildReservedusu(clientName, clientCode, salesRep);

            console.log(`[CDE-CATALOG] Reservando ${idhs.length} IDHs para ${reservedusu}`);

            // Construir placeholders para IN clause
            const placeholders = idhs.map(() => '?').join(',');

            const [result] = await connection.execute(
                `UPDATE tbinventario
                 SET AESTADOP = 'PRE-SELECTED',
                     RESERVEDUSU = ?,
                     AFECHA = NOW()
                 WHERE AIDH IN (${placeholders})
                 AND AESTADOP = 'INGRESADO'
                 AND (ATIPOETIQUETA IS NULL OR ATIPOETIQUETA = '')`,
                [reservedusu, ...idhs]
            );

            console.log(`[CDE-CATALOG] ✅ ${result.affectedRows}/${idhs.length} IDHs reservados`);

            return {
                success: true,
                reserved: result.affectedRows,
                total: idhs.length
            };

        } catch (error) {
            console.error(`[CDE-CATALOG] ❌ Erro ao reservar IDHs:`, error.message);
            throw error;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * LIBERAR IDHs DE CATÁLOGO (voltar para INGRESADO)
     * Usado quando carrinho expira ou item é removido
     */
    static async releaseCatalogIDHs(idhs) {
        let connection = null;

        if (!Array.isArray(idhs) || idhs.length === 0) {
            console.log('[CDE-CATALOG] Nenhum IDH para liberar');
            return { success: true, released: 0 };
        }

        try {
            connection = await this.getConnection();

            console.log(`[CDE-CATALOG] Liberando ${idhs.length} IDHs`);

            const placeholders = idhs.map(() => '?').join(',');

            const [result] = await connection.execute(
                `UPDATE tbinventario
                 SET AESTADOP = 'INGRESADO',
                     RESERVEDUSU = NULL,
                     AFECHA = NOW()
                 WHERE AIDH IN (${placeholders})
                 AND AESTADOP IN ('PRE-SELECTED', 'CONFIRMED')
                 AND (ATIPOETIQUETA IS NULL OR ATIPOETIQUETA = '')`,
                idhs
            );

            console.log(`[CDE-CATALOG] ✅ ${result.affectedRows}/${idhs.length} IDHs liberados`);

            return {
                success: true,
                released: result.affectedRows,
                total: idhs.length
            };

        } catch (error) {
            console.error(`[CDE-CATALOG] ❌ Erro ao liberar IDHs:`, error.message);
            throw error;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * VERIFICAR STATUS DE IDHs DE CATÁLOGO
     * Útil para debug e sincronização
     */
    static async checkCatalogIDHsStatus(idhs) {
        let connection = null;

        if (!Array.isArray(idhs) || idhs.length === 0) {
            return [];
        }

        try {
            connection = await this.getConnection();

            const placeholders = idhs.map(() => '?').join(',');

            const [rows] = await connection.execute(
                `SELECT AIDH, AQBITEM, AESTADOP, RESERVEDUSU
                 FROM tbinventario
                 WHERE AIDH IN (${placeholders})`,
                idhs
            );

            return rows.map(row => ({
                idh: row.AIDH,
                qbItem: row.AQBITEM,
                status: row.AESTADOP,
                reservedBy: row.RESERVEDUSU
            }));

        } catch (error) {
            console.error(`[CDE-CATALOG] ❌ Erro ao verificar IDHs:`, error.message);
            return [];
        } finally {
            if (connection) await connection.end();
        }
    }
}

module.exports = CDEWriter;