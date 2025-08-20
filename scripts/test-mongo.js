require('dotenv').config();
const mongoose = require('mongoose');
const PhotoCategory = require('./src/models/PhotoCategory');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const total = await PhotoCategory.countDocuments({ isActive: true });
    console.log('📊 Total categorias no MongoDB:', total);
    
    mongoose.connection.close();
}

test();
