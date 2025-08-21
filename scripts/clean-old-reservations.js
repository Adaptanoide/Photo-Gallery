require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');

async function clean() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Limpar fotos sem selection ou com selection antiga
    const result = await PhotoStatus.updateMany(
        { 
            'virtualStatus.status': 'reserved',
            'virtualStatus.currentSelection': { $in: [null, ''] }
        },
        { 
            $set: { 
                'virtualStatus.status': 'available',
                'virtualStatus.clientCode': null
            },
            $pull: {
                'virtualStatus.tags': { $in: ['reserved', /^client_/] }
            }
        }
    );
    
    console.log(`✅ ${result.modifiedCount} fotos antigas limpas`);
    
    await mongoose.disconnect();
}

clean();
