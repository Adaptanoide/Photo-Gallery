const mongoose = require('mongoose');
require('dotenv').config();

const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const photos = await UnifiedProductComplete.find({
        photoNumber: { $in: ['25571', '26289', '26625', '26705'] }
    }).select('photoNumber status isActive currentStatus');
    
    console.log('Estado atual no MongoDB:');
    photos.forEach(p => {
        console.log(`${p.photoNumber}: status=${p.status}, isActive=${p.isActive}, currentStatus=${p.currentStatus}`);
    });
    
    await mongoose.disconnect();
}

main().catch(console.error);
