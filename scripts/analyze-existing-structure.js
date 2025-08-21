require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');

async function analyzeExisting() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\n📊 ANALISANDO OS 40 REGISTROS EXISTENTES:\n');
    
    // Pegar um exemplo
    const example = await PhotoStatus.findOne();
    
    if (example) {
        console.log('EXEMPLO DE REGISTRO EXISTENTE:');
        console.log('--------------------------------');
        console.log('photoId:', example.photoId);
        console.log('fileName:', example.fileName);
        console.log('\noriginalLocation:');
        console.log('  originalPath:', example.originalLocation?.originalPath);
        console.log('  originalParentId:', example.originalLocation?.originalParentId);
        console.log('  originalCategory:', example.originalLocation?.originalCategory);
        console.log('\ncurrentLocation:');
        console.log('  currentPath:', example.currentLocation?.currentPath);
        console.log('  currentParentId:', example.currentLocation?.currentParentId);
        console.log('  currentCategory:', example.currentLocation?.currentCategory);
        console.log('\nvirtualStatus:');
        console.log('  status:', example.virtualStatus?.status);
        console.log('  tags:', example.virtualStatus?.tags);
    }
    
    await mongoose.disconnect();
}

analyzeExisting();
