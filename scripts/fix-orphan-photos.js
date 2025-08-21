require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const Selection = require('./src/models/Selection');
const Product = require('./src/models/Product');

async function fixOrphanPhotos() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\\n🔧 LIBERANDO FOTOS ÓRFÃS:\\n');
    
    // 1. Buscar todas as fotos reservadas
    const reservedPhotos = await PhotoStatus.find({
        'virtualStatus.status': 'reserved'
    });
    
    let freedCount = 0;
    
    for (const photo of reservedPhotos) {
        const selectionId = photo.virtualStatus.currentSelection;
        
        // Verificar se a seleção existe e está ativa
        const selection = await Selection.findOne({ 
            selectionId: selectionId,
            status: { $in: ['pending', 'confirmed'] }
        });
        
        if (!selection) {
            // Seleção não existe ou foi cancelada - LIBERAR!
            console.log(`🔓 Liberando ${photo.fileName} (seleção ${selectionId} inválida)`);
            
            // Atualizar PhotoStatus
            await PhotoStatus.updateOne(
                { _id: photo._id },
                {
                    $set: {
                        'virtualStatus.status': 'available',
                        'virtualStatus.currentSelection': null,
                        'virtualStatus.clientCode': null,
                        'virtualStatus.tags': ['available']
                    }
                }
            );
            
            // Atualizar Product também
            await Product.updateOne(
                { driveFileId: photo.photoId },
                { 
                    $set: { status: 'available' },
                    $unset: { reservedBy: 1 }
                }
            );
            
            freedCount++;
        }
    }
    
    console.log(`\\n✅ ${freedCount} fotos liberadas!`);
    
    // Verificar resultado final
    const stillReserved = await PhotoStatus.countDocuments({
        'virtualStatus.status': 'reserved'
    });
    
    console.log(`📊 Ainda reservadas: ${stillReserved}`);
    
    await mongoose.disconnect();
}

// Confirmar antes
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

readline.question('⚠️ Liberar fotos órfãs? (yes/no): ', answer => {
    if (answer.toLowerCase() === 'yes') {
        fixOrphanPhotos();
    } else {
        console.log('Cancelado!');
        process.exit();
    }
    readline.close();
});
