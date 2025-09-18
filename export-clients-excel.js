// export-clients-excel.js
require('dotenv').config();
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const AccessCode = require('./src/models/AccessCode');

async function exportClientsToExcel() {
    try {
        // Conectar ao MongoDB
        console.log('📊 Conectando ao banco...');
        await mongoose.connect(process.env.MONGODB_URI);
        
        // Buscar todos os clientes
        console.log('🔍 Buscando clientes...');
        const clients = await AccessCode.find()
            .sort({ clientName: 1 }); // Ordenar por nome
        
        console.log(`✅ Encontrados ${clients.length} clientes`);
        
        // Preparar dados para Excel
        const excelData = clients.map(client => ({
            'Code': client.code,
            'Client Name': client.clientName,
            'Company': client.companyName || '',
            'Sales Rep': client.salesRep || '',
            'Email': client.clientEmail || '',
            'Status': client.isActive ? 'Active' : 'Inactive'
        }));
        
        // Criar workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        
        // Ajustar largura das colunas
        ws['!cols'] = [
            { wch: 8 },   // Code
            { wch: 30 },  // Client Name
            { wch: 35 },  // Company
            { wch: 20 },  // Sales Rep
            { wch: 30 },  // Email
            { wch: 10 }   // Status
        ];
        
        // Adicionar sheet ao workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Clients');
        
        // Salvar arquivo
        const fileName = `clients_salesrep_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        console.log(`✅ Arquivo salvo: ${fileName}`);
        console.log('📤 Pronto para compartilhar no Slack!');
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.connection.close();
    }
}

// Executar
exportClientsToExcel();