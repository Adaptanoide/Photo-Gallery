// scripts/export-to-excel.js

require('dotenv').config();
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');

// Importar o modelo AccessCode
const AccessCode = require('../src/models/AccessCode');

// ===== FUNÇÕES AUXILIARES =====

/**
 * Validar email
 */
function isValidEmail(email) {
    if (!email || email.trim() === '') return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// ===== SCRIPT PRINCIPAL =====

async function exportToExcel() {
    try {
        console.log('\n🚀 Iniciando exportação SIMPLIFICADA para Constant Contact...\n');
        
        // Conectar ao MongoDB
        console.log('📡 Conectando ao MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB!\n');
        
        // Buscar todos os códigos de acesso ativos
        console.log('🔍 Buscando clientes ativos...');
        const accessCodes = await AccessCode.find({ 
            isActive: true 
        }).sort({ clientName: 1 });
        
        console.log(`📊 Total de clientes encontrados: ${accessCodes.length}\n`);
        
        // Processar dados
        const validClients = [];
        const noEmail = [];
        
        accessCodes.forEach(code => {
            // Verificar email
            if (!code.clientEmail || code.clientEmail.trim() === '' || !isValidEmail(code.clientEmail)) {
                noEmail.push({
                    'Access Code': code.code,
                    'First Name': code.clientName,
                    'Email Address': code.clientEmail || '',
                    'Status': !code.clientEmail ? 'SEM EMAIL' : 'EMAIL INVÁLIDO'
                });
                return;
            }
            
            // Cliente válido - APENAS 3 CAMPOS
            validClients.push({
                'Email Address': code.clientEmail.toLowerCase().trim(),
                'First Name': code.clientName,
                'Access Code': code.code
            });
        });
        
        // ===== RELATÓRIO =====
        console.log('📊 ===== RELATÓRIO DA EXPORTAÇÃO =====\n');
        console.log(`✅ Clientes com email VÁLIDO: ${validClients.length}`);
        console.log(`⚠️  Clientes com PROBLEMAS: ${noEmail.length}`);
        console.log(`📧 Total processado: ${accessCodes.length}\n`);
        
        // ===== GERAR EXCEL 1: CLIENTES VÁLIDOS =====
        if (validClients.length > 0) {
            console.log('📝 Gerando Excel: Clientes Válidos (para Constant Contact)...');
            
            const ws1 = XLSX.utils.json_to_sheet(validClients);
            const wb1 = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb1, ws1, 'Clients');
            
            // Ajustar largura das colunas
            ws1['!cols'] = [
                { wch: 35 }, // Email Address
                { wch: 30 }, // First Name
                { wch: 15 }  // Access Code
            ];
            
            const outputPath1 = path.join(__dirname, 'constant-contact-import.xlsx');
            XLSX.writeFile(wb1, outputPath1);
            
            console.log(`✅ Arquivo gerado!`);
            console.log(`📁 Local: ${outputPath1}`);
            console.log(`📊 Total de registros: ${validClients.length}\n`);
        }
        
        // ===== GERAR EXCEL 2: CLIENTES SEM EMAIL =====
        if (noEmail.length > 0) {
            console.log('📝 Gerando Excel: Clientes SEM Email (para preencher)...');
            
            const ws2 = XLSX.utils.json_to_sheet(noEmail);
            const wb2 = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb2, ws2, 'Missing Emails');
            
            // Ajustar largura das colunas
            ws2['!cols'] = [
                { wch: 15 }, // Access Code
                { wch: 30 }, // First Name
                { wch: 35 }, // Email Address (vazio)
                { wch: 15 }  // Status
            ];
            
            const outputPath2 = path.join(__dirname, 'clientes-sem-email.xlsx');
            XLSX.writeFile(wb2, outputPath2);
            
            console.log(`✅ Arquivo 2 gerado!`);
            console.log(`📁 Local: ${outputPath2}`);
            console.log(`📊 Total de registros: ${noEmail.length}\n`);
        }
        
        // Mostrar preview dos válidos
        if (validClients.length > 0) {
            console.log('👀 PREVIEW (primeiros 10 registros):\n');
            validClients.slice(0, 10).forEach((client, index) => {
                console.log(`${index + 1}. ${client['First Name']} | ${client['Email Address']} | Code: ${client['Access Code']}`);
            });
            console.log('');
        }
        
        console.log('🎉 Exportação concluída!\n');
        console.log('📦 CAMPOS EXPORTADOS:');
        console.log('   ✅ Email Address');
        console.log('   ✅ First Name');
        console.log('   ✅ Access Code\n');
        
    } catch (error) {
        console.error('❌ Erro na exportação:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Desconectado do MongoDB');
    }
}

// Executar
exportToExcel();