// src/services/FileProcessorService.js - Serviço de processamento de arquivos
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const XLSX = require('xlsx');

class FileProcessorService {
    constructor() {
        // Tipos de arquivo suportados
        this.supportedTypes = {
            'application/pdf': 'pdf',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
            'application/vnd.ms-excel': 'xls',
            'text/csv': 'csv',
            'text/plain': 'txt'
        };

        // Limite de tamanho (10MB)
        this.maxFileSize = 10 * 1024 * 1024;

        // Limite de texto extraído (para não estourar tokens)
        this.maxTextLength = 15000;
    }

    /**
     * Processa um arquivo e extrai seu conteúdo
     * @param {Buffer} fileBuffer - Buffer do arquivo
     * @param {string} mimeType - Tipo MIME do arquivo
     * @param {string} fileName - Nome original do arquivo
     * @returns {Object} Dados extraídos do arquivo
     */
    async processFile(fileBuffer, mimeType, fileName) {
        const fileType = this.supportedTypes[mimeType];

        if (!fileType) {
            throw new Error(`Tipo de arquivo não suportado: ${mimeType}. Tipos aceitos: PDF, Excel, CSV, TXT`);
        }

        if (fileBuffer.length > this.maxFileSize) {
            throw new Error(`Arquivo muito grande. Limite: ${this.maxFileSize / 1024 / 1024}MB`);
        }

        console.log(`📄 Processing file: ${fileName} (${fileType})`);

        let result;
        switch (fileType) {
            case 'pdf':
                result = await this.processPDF(fileBuffer, fileName);
                break;
            case 'xlsx':
            case 'xls':
                result = await this.processExcel(fileBuffer, fileName);
                break;
            case 'csv':
                result = await this.processCSV(fileBuffer, fileName);
                break;
            case 'txt':
                result = await this.processText(fileBuffer, fileName);
                break;
            default:
                throw new Error(`Processador não implementado para: ${fileType}`);
        }

        // Truncar se muito grande
        if (result.content && result.content.length > this.maxTextLength) {
            result.content = result.content.substring(0, this.maxTextLength);
            result.truncated = true;
            result.warning = `Conteúdo truncado para ${this.maxTextLength} caracteres`;
        }

        return result;
    }

    /**
     * Processa arquivo PDF
     */
    async processPDF(fileBuffer, fileName) {
        try {
            const data = await pdfParse(fileBuffer);

            return {
                type: 'pdf',
                fileName,
                pageCount: data.numpages,
                content: data.text.trim(),
                metadata: {
                    info: data.info,
                    pages: data.numpages
                },
                summary: `PDF com ${data.numpages} página(s), ${data.text.length} caracteres`
            };
        } catch (error) {
            console.error('PDF processing error:', error);
            throw new Error(`Erro ao processar PDF: ${error.message}`);
        }
    }

    /**
     * Processa arquivo Excel (XLSX/XLS)
     */
    async processExcel(fileBuffer, fileName) {
        try {
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheets = {};
            let totalRows = 0;
            let contentParts = [];

            // Processar cada sheet
            for (const sheetName of workbook.SheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                sheets[sheetName] = {
                    rowCount: jsonData.length,
                    columnCount: jsonData[0]?.length || 0,
                    headers: jsonData[0] || [],
                    preview: jsonData.slice(0, 20) // Primeiras 20 linhas
                };

                totalRows += jsonData.length;

                // Formatar conteúdo para AI
                contentParts.push(`\n=== SHEET: ${sheetName} ===`);
                contentParts.push(`Colunas: ${sheets[sheetName].headers.join(', ')}`);
                contentParts.push(`Total linhas: ${jsonData.length}`);
                contentParts.push('\nDados:');

                // Converter para texto tabular
                const csvContent = XLSX.utils.sheet_to_csv(worksheet);
                contentParts.push(csvContent);
            }

            return {
                type: 'excel',
                fileName,
                sheetCount: workbook.SheetNames.length,
                sheetNames: workbook.SheetNames,
                totalRows,
                sheets,
                content: contentParts.join('\n'),
                summary: `Excel com ${workbook.SheetNames.length} sheet(s), ${totalRows} linhas totais`
            };
        } catch (error) {
            console.error('Excel processing error:', error);
            throw new Error(`Erro ao processar Excel: ${error.message}`);
        }
    }

    /**
     * Processa arquivo CSV
     */
    async processCSV(fileBuffer, fileName) {
        try {
            const content = fileBuffer.toString('utf-8');
            const lines = content.split('\n').filter(l => l.trim());
            const headers = lines[0]?.split(',').map(h => h.trim()) || [];

            return {
                type: 'csv',
                fileName,
                rowCount: lines.length,
                columnCount: headers.length,
                headers,
                content,
                summary: `CSV com ${lines.length} linhas, ${headers.length} colunas`
            };
        } catch (error) {
            console.error('CSV processing error:', error);
            throw new Error(`Erro ao processar CSV: ${error.message}`);
        }
    }

    /**
     * Processa arquivo de texto
     */
    async processText(fileBuffer, fileName) {
        try {
            const content = fileBuffer.toString('utf-8');
            const lines = content.split('\n').length;

            return {
                type: 'text',
                fileName,
                lineCount: lines,
                content,
                summary: `Arquivo texto com ${lines} linhas, ${content.length} caracteres`
            };
        } catch (error) {
            console.error('Text processing error:', error);
            throw new Error(`Erro ao processar texto: ${error.message}`);
        }
    }

    /**
     * Formata o conteúdo do arquivo para incluir no prompt da AI
     */
    formatForAI(fileData) {
        let formatted = `\n📎 ARQUIVO ANEXADO: ${fileData.fileName}\n`;
        formatted += `📊 Tipo: ${fileData.type.toUpperCase()}\n`;
        formatted += `📝 ${fileData.summary}\n`;

        if (fileData.truncated) {
            formatted += `⚠️ ${fileData.warning}\n`;
        }

        formatted += `\n--- CONTEÚDO DO ARQUIVO ---\n`;
        formatted += fileData.content;
        formatted += `\n--- FIM DO ARQUIVO ---\n`;

        return formatted;
    }

    /**
     * Retorna tipos de arquivo aceitos
     */
    getAcceptedTypes() {
        return Object.keys(this.supportedTypes);
    }

    /**
     * Verifica se um tipo é suportado
     */
    isSupported(mimeType) {
        return mimeType in this.supportedTypes;
    }
}

module.exports = new FileProcessorService();
