const mongoose = require('mongoose');
require('dotenv').config();
const PhotoCategory = require('../src/models/PhotoCategory');

async function debugExactMatch() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('🔍 DEBUG EXATO DA CATEGORIA\n');
        
        // String que está vindo do carrinho
        const searchString = "Best Value - Brindle Medium and Dark Tones Mix ML-XL";
        
        console.log('Buscando por:', searchString);
        console.log('Length:', searchString.length);
        console.log('Bytes:', Buffer.from(searchString).toString('hex'));
        console.log('---\n');
        
        // Buscar TODAS as categorias que contenham "Best Value"
        const categories = await PhotoCategory.find({
            $or: [
                { folderName: { $regex: 'Best Value', $options: 'i' } },
                { displayName: { $regex: 'Best Value', $options: 'i' } }
            ]
        });
        
        console.log(`Encontradas ${categories.length} categorias com "Best Value"\n`);
        
        for (const cat of categories) {
            console.log('📂 CATEGORIA NO BANCO:');
            console.log('  ID:', cat._id);
            console.log('  FolderName:', cat.folderName);
            console.log('  Length:', cat.folderName.length);
            console.log('  Bytes:', Buffer.from(cat.folderName).toString('hex'));
            console.log('  DisplayName:', cat.displayName);
            console.log('  BasePrice:', cat.basePrice);
            
            // Comparação exata
            console.log('\n  COMPARAÇÕES:');
            console.log('  Igual exato?', cat.folderName === searchString);
            console.log('  Igual trim?', cat.folderName.trim() === searchString.trim());
            console.log('  Igual lower?', cat.folderName.toLowerCase() === searchString.toLowerCase());
            
            // Mostrar diferenças caractere por caractere
            if (cat.folderName !== searchString) {
                console.log('\n  DIFERENÇAS CARACTERE POR CARACTERE:');
                const maxLen = Math.max(cat.folderName.length, searchString.length);
                for (let i = 0; i < maxLen; i++) {
                    const charDB = cat.folderName[i] || '∅';
                    const charSearch = searchString[i] || '∅';
                    if (charDB !== charSearch) {
                        console.log(`    Posição ${i}: DB='${charDB}' (${charDB.charCodeAt(0)}) vs Search='${charSearch}' (${charSearch.charCodeAt(0)})`);
                    }
                }
            }
            
            console.log('\n---\n');
        }
        
        // Testar busca direta
        console.log('🔎 TESTANDO BUSCAS DIRETAS:\n');
        
        const test1 = await PhotoCategory.findOne({ 
            folderName: searchString 
        });
        console.log('Busca exata por folderName:', test1 ? '✅ ENCONTROU' : '❌ NÃO ENCONTROU');
        
        const test2 = await PhotoCategory.findOne({ 
            folderName: { $regex: `^${searchString}$`, $options: 'i' } 
        });
        console.log('Busca regex case-insensitive:', test2 ? '✅ ENCONTROU' : '❌ NÃO ENCONTROU');
        
        const test3 = await PhotoCategory.findOne({ 
            displayName: { $regex: searchString, $options: 'i' } 
        });
        console.log('Busca em displayName:', test3 ? '✅ ENCONTROU' : '❌ NÃO ENCONTROU');
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugExactMatch();
