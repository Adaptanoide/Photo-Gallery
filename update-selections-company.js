// update-selections-company.js
require('dotenv').config();
const mongoose = require('mongoose');
const Selection = require('./src/models/Selection');
const AccessCode = require('./src/models/AccessCode');

async function updateSelectionsWithCompany() {
    try {
        // Conectar ao MongoDB
        console.log('🔌 Conectando ao banco...');
        await mongoose.connect(process.env.MONGODB_URI);
        
        // Buscar todas as seleções
        console.log('📋 Buscando seleções...');
        const selections = await Selection.find({});
        console.log(`✅ Encontradas ${selections.length} seleções`);
        
        // Buscar todos os access codes
        const accessCodes = await AccessCode.find({});
        
        // Criar mapa de código -> company
        const codeToCompany = {};
        accessCodes.forEach(ac => {
            codeToCompany[ac.code] = ac.companyName || null;
        });
        
        let updated = 0;
        
        // Atualizar cada seleção
        for (const selection of selections) {
            const companyName = codeToCompany[selection.clientCode];
            
            if (companyName) {
                selection.clientCompany = companyName;
                await selection.save();
                updated++;
                console.log(`✅ ${selection.clientCode} - ${selection.clientName} → Company: ${companyName}`);
            } else {
                console.log(`⚠️ ${selection.clientCode} - ${selection.clientName} → Sem company`);
            }
        }
        
        console.log(`\n✅ Total atualizado: ${updated} de ${selections.length} seleções`);
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.connection.close();
    }
}

// Executar
updateSelectionsWithCompany();