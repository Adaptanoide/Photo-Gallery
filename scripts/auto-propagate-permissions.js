#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const AccessCode = require('../src/models/AccessCode');
const PhotoCategory = require('../src/models/PhotoCategory');

async function propagate() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('Propagando permissoes de categorias...\n');
    
    const categories = await PhotoCategory.find({ isActive: true });
    const codes = await AccessCode.find({});
    
    let totalUpdated = 0;
    
    for (const code of codes) {
        if (!code.permissions?.allowedCategories) continue;
        
        let updated = false;
        
        for (const category of categories) {
            const catDisplay = category.displayName;
            const rootCategory = catDisplay.split(' → ')[0];
            
            const hasRootAccess = code.permissions.allowedCategories.some(
                allowed => allowed.startsWith(rootCategory)
            );
            
            if (hasRootAccess && !code.permissions.allowedCategories.includes(catDisplay)) {
                code.permissions.allowedCategories.push(catDisplay);
                updated = true;
            }
        }
        
        if (updated) {
            await code.save();
            console.log(`Atualizado: ${code.code} - ${code.companyName}`);
            totalUpdated++;
        }
    }
    
    console.log(`\n${totalUpdated} clientes atualizados`);
    await mongoose.disconnect();
}

propagate();