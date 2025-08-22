const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const Selection = require('./src/models/Selection');
    
    // Buscar a Special Selection
    const selection = await Selection.findOne({ 
        selectionId: 'SPEC_TEST_TAGS_001' 
    });
    
    if (!selection) {
        console.log('❌ Special Selection não encontrada!');
        process.exit();
    }
    
    // Adicionar categorias virtuais COM ESTRUTURA CORRETA
    selection.customCategories = [
        {
            categoryId: 'cat_premium',
            categoryName: 'Premium Selection',
            categoryDisplayName: 'Premium Cowhides',
            baseCategoryPrice: 150,
            photos: [
                {
                    photoId: 'test_001.webp',
                    fileName: 'test_001.webp',
                    customPrice: 150
                },
                {
                    photoId: 'test_002.webp',
                    fileName: 'test_002.webp',
                    customPrice: 150
                }
            ]
        },
        {
            categoryId: 'cat_budget',
            categoryName: 'Budget Selection',  
            categoryDisplayName: 'Budget Friendly',
            baseCategoryPrice: 75,
            photos: [
                {
                    photoId: 'test_003.webp',
                    fileName: 'test_003.webp',
                    customPrice: 75
                }
            ]
        }
    ];
    
    await selection.save();
    
    console.log('✅ 2 categorias virtuais criadas!');
    console.log('  - Premium Selection (2 fotos)');
    console.log('  - Budget Selection (1 foto)');
    
    process.exit();
});

