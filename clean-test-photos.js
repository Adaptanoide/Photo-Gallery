require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');

async function clean() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Limpar fotos reservadas do teste
    const result = await PhotoStatus.updateMany(
        { 'virtualStatus.status': 'reserved' },
        { 
            $set: { 
                'virtualStatus.status': 'available',
                'virtualStatus.currentSelection': null,
                'virtualStatus.clientCode': null
            },
            $pull: {
                'virtualStatus.tags': { $in: ['reserved', /^client_/, /^selection_/] }
            }
        }
    );
    
    console.log(`✅ ${result.modifiedCount} fotos limpas`);
    
    await mongoose.disconnect();
}

clean();
