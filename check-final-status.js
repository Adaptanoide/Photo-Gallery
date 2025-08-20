require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\n📊 STATUS FINAL APÓS CANCELAMENTO:\n');
    
    const available = await PhotoStatus.countDocuments({ 'virtualStatus.status': 'available' });
    const reserved = await PhotoStatus.countDocuments({ 'virtualStatus.status': 'reserved' });
    const sold = await PhotoStatus.countDocuments({ 'virtualStatus.status': 'sold' });
    
    console.log(`✅ Disponíveis: ${available} (deve ser 37)`);
    console.log(`⏸️  Reservadas: ${reserved} (deve ser 0)`);
    console.log(`💰 Vendidas: ${sold} (deve ser 3)`);
    console.log(`📦 TOTAL: ${available + reserved + sold}`);
    
    await mongoose.disconnect();
}

check();
